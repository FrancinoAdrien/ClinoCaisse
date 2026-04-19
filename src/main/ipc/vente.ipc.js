'use strict';
const { randomUUID } = require('crypto');
const { logAction } = require('./journal.ipc');
const { notifyChange } = require('../sync/notifier');

module.exports = function(ipcMain, db) {

  // Helper: ajuster le capital
  function adjustCapital(delta) {
    const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'finance.capital'").get();
    const current = parseFloat(row?.valeur || '0');
    db.prepare("INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status) VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = 'finance.capital'), lower(hex(randomblob(16)))), 'finance.capital', ?, datetime('now'), ?, 0)")
      .run(String(current + delta), Date.now());
  }

  // Générer numéro de ticket
  function genNumeroTicket() {
    const now = new Date();
    const d = now.toISOString().slice(0,10).replace(/-/g,'');
    const count = db.prepare("SELECT COUNT(*) as n FROM ventes WHERE date_vente LIKE ?").get(`${now.toISOString().slice(0,10)}%`).n;
    return `T${d}-${String(count + 1).padStart(4,'0')}`;
  }

  // ── CRÉER UNE VENTE ──────────────────────────────────────────────────
  ipcMain.handle('ventes:create', (e, data) => {
    const createVente = db.transaction((data) => {
      const numero   = genNumeroTicket();
      const venteUid = randomUUID();
      const now      = Date.now();

      const venteResult = db.prepare(`
        INSERT INTO ventes (uuid, numero_ticket, date_vente, nom_caissier, total_ttc,
          mode_paiement, montant_paye, monnaie_rendue, statut, table_numero, note,
          last_modified_at, sync_status)
        VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, 'valide', ?, ?, ?, 0)
      `).run(
        venteUid,
        numero,
        data.nom_caissier,
        data.total_ttc,
        data.mode_paiement || 'CASH',
        data.montant_paye || data.total_ttc,
        data.monnaie_rendue || 0,
        data.table_numero || null,
        data.note || null,
        now
      );

      const venteId  = venteResult.lastInsertRowid;
      const insLigne = db.prepare(`
        INSERT INTO lignes_vente (uuid, vente_id, vente_uuid, produit_id, produit_nom, quantite,
          prix_unitaire, remise, rabais, total_ttc, est_offert, statut_cuisine, last_modified_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      const hasTable = data.table_numero != null && data.table_numero !== '';
      for (const ligne of data.lignes) {
        const defCuisine = ligne.statut_cuisine
          || (hasTable && !ligne.est_offert ? 'en_attente' : 'servi');
        insLigne.run(
          randomUUID(),
          venteId,
          venteUid,
          ligne.produit_id || null,
          ligne.produit_nom,
          ligne.quantite,
          ligne.prix_unitaire,
          ligne.remise || 0,
          ligne.rabais || 0,
          ligne.total_ttc,
          ligne.est_offert ? 1 : 0,
          defCuisine,
          now
        );

        // Décrémenter le stock si pas illimité
        if (ligne.produit_id && !ligne.est_offert) {
          const p = db.prepare('SELECT stock_actuel, stock_bar, is_prepared, uuid FROM produits WHERE id = ? OR uuid = ?').get(ligne.produit_id, ligne.produit_id);
          if (p) {
            if (p.is_prepared) {
              // Décrémenter les ingrédients
              const ingredients = db.prepare(`
                SELECT rl.ingredient_uuid, rl.quantite_requise
                FROM recettes_lignes rl
                WHERE rl.plat_uuid = ?
              `).all(p.uuid);

              for (const ing of ingredients) {
                const totalADeduire = ing.quantite_requise * ligne.quantite;
                db.prepare(`
                  UPDATE produits 
                  SET stock_actuel = MAX(0, stock_actuel - ?),
                      stock_bar = MAX(0, COALESCE(stock_bar, stock_actuel) - ?)
                  WHERE uuid = ? AND stock_actuel != -1
                `).run(totalADeduire, totalADeduire, ing.ingredient_uuid);
              }
            } else if (p.stock_actuel !== -1) {
              // Produit simple, décrémentation classique
              db.prepare(`
                UPDATE produits 
                SET stock_actuel = MAX(0, stock_actuel - ?),
                    stock_bar = MAX(0, COALESCE(stock_bar, stock_actuel) - ?)
                WHERE id = ? OR uuid = ?
              `).run(ligne.quantite, ligne.quantite, ligne.produit_id, ligne.produit_id);
            }
          }
        }
      }

      return { success: true, id: venteId, numero_ticket: numero };
    });

    try {
      const result = createVente(data);
      // Ajouter au capital le montant réellement encaissé
      if (result.success) {
        const paye = data.montant_paye !== undefined && data.montant_paye !== null ? data.montant_paye : data.total_ttc;
        const encaisse = parseFloat(paye || 0);

        logAction(db, {
          categorie: 'VENTE',
          action: 'Vente créée',
          detail: `Ticket ${result.numero_ticket} — ${data.lignes ? data.lignes.length : 0} article(s)`,
          operateur: data.nom_caissier || null,
          montant: data.total_ttc || 0,
          icone: '🛒'
        });
        notifyChange();
      }
      return result;
    } catch (err) {
      return { success: false, message: err.message };
    }
  });


  // ── TOUTES LES VENTES ────────────────────────────────────────────────
  ipcMain.handle('ventes:getAll', () => {
    return db.prepare(`
      SELECT v.*, GROUP_CONCAT(lv.produit_nom, ', ') as articles
      FROM ventes v
      LEFT JOIN lignes_vente lv ON lv.vente_uuid = v.uuid
      GROUP BY v.uuid
      ORDER BY v.date_vente DESC
      LIMIT 500
    `).all();
  });

  // ── VENTE PAR ID ─────────────────────────────────────────────────────
  ipcMain.handle('ventes:getById', (e, id) => {
    // Support lookup by numeric id (rowid) or by uuid
    const vente = db.prepare('SELECT * FROM ventes WHERE uuid = ? OR id = ?').get(id, id);
    if (!vente) return null;
    vente.lignes = db.prepare('SELECT * FROM lignes_vente WHERE vente_uuid = ?').all(vente.uuid);
    return vente;
  });

  // ── VENTES PAR DATE ──────────────────────────────────────────────────
  ipcMain.handle('ventes:getByDate', (e, date) => {
    return db.prepare(`
      SELECT * FROM ventes WHERE date_vente LIKE ? AND statut = 'valide'
      ORDER BY date_vente DESC
    `).all(`${date}%`);
  });

  // ── ANNULER UNE VENTE ────────────────────────────────────────────────
  ipcMain.handle('ventes:annuler', (e, id) => {
    try {
      const vente = db.prepare('SELECT total_ttc, montant_paye, statut, numero_ticket, nom_caissier FROM ventes WHERE uuid = ? OR id = ?').get(id, id);
      db.prepare(`UPDATE ventes SET statut = 'annule', sync_status = 0, last_modified_at = ? WHERE uuid = ? OR id = ?`)
        .run(Date.now(), id, id);
      // Restituer au capital ce qui avait été encaissé (annulation = sortie inverse)
      if (vente?.statut === 'valide') {
        const paye = vente.montant_paye !== null ? vente.montant_paye : vente.total_ttc;
        const encaisse = parseFloat(paye || 0);

        logAction(db, {
          categorie: 'VENTE',
          action: 'Vente annulée',
          detail: `Ticket ${vente.numero_ticket || id} annulé`,
          operateur: vente.nom_caissier || null,
          montant: vente.total_ttc || 0,
          icone: '❌'
        });
        notifyChange();
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── TABLES ───────────────────────────────────────────────────────────
  ipcMain.handle('tables:getAll', () => {
    const config = db.prepare('SELECT numero_table FROM tables_config ORDER BY numero_table').all();
    const tickets = db.prepare("SELECT * FROM tickets_table WHERE statut = 'en_cours'").all();
    return config.map(c => {
      const ticket = tickets.find(t => t.numero_table === c.numero_table) || null;
      if (ticket && ticket.lignes_json) {
        try { ticket.lignes = JSON.parse(ticket.lignes_json); } catch { ticket.lignes = []; }
      }
      return { numero: c.numero_table, ticket };
    });
  });

  ipcMain.handle('tables:getConfig', () => {
    return db.prepare('SELECT numero_table FROM tables_config ORDER BY numero_table').all();
  });

  ipcMain.handle('tables:sauvegarder', (e, data) => {
    try {
      const lignesJson = JSON.stringify(data.lignes || []);
      const total = (data.lignes || []).reduce((s, l) => s + (l.total_ttc || 0), 0);
      const now = Date.now();
      const existing = db.prepare(
        "SELECT id, uuid FROM tickets_table WHERE numero_table = ? AND statut = 'en_cours'"
      ).get(data.numero_table);

      if (existing) {
        db.prepare(`
          UPDATE tickets_table SET nom_table = ?, nom_caissier = ?,
            date_modification = datetime('now'), montant_total = ?, lignes_json = ?,
            last_modified_at = ?, sync_status = 0
          WHERE uuid = ?
        `).run(data.nom_table || null, data.nom_caissier, total, lignesJson, now, existing.uuid);
        return { success: true, id: existing.uuid };
      } else {
        const uid = randomUUID();
        const result = db.prepare(`
          INSERT INTO tickets_table (uuid, numero_table, nom_table, nom_caissier, montant_total, lignes_json, last_modified_at, sync_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        `).run(uid, data.numero_table, data.nom_table || null, data.nom_caissier, total, lignesJson, now);
        return { success: true, id: result.lastInsertRowid };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('tables:charger', (e, id) => {
    // Support lookup by numeric id, rowid, or uuid
    const t = db.prepare('SELECT * FROM tickets_table WHERE uuid = ? OR id = ?').get(id, id);
    if (t && t.lignes_json) {
      try { t.lignes = JSON.parse(t.lignes_json); } catch { t.lignes = []; }
    }
    return t;
  });

  ipcMain.handle('tables:supprimer', (e, id) => {
    try {
      db.prepare("UPDATE tickets_table SET statut = 'ferme', last_modified_at = ?, sync_status = 0 WHERE uuid = ? OR id = ?").run(Date.now(), id, id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('tables:ajouterTable', () => {
    try {
      const max = db.prepare('SELECT MAX(numero_table) as m FROM tables_config').get().m || 0;
      const next = max + 1;
      db.prepare('INSERT INTO tables_config (uuid, numero_table, ordre, last_modified_at, sync_status) VALUES (?, ?, ?, ?, 0)').run(randomUUID(), next, next, Date.now());
      return { success: true, numero: next };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('tables:supprimerTable', (e, num) => {
    try {
      const hasTicket = db.prepare(
        "SELECT id FROM tickets_table WHERE numero_table = ? AND statut = 'en_cours'"
      ).get(num);
      if (hasTicket) return { success: false, message: 'Table occupée' };
      db.prepare('DELETE FROM tables_config WHERE numero_table = ?').run(num);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── STATS PRODUIT ────────────────────────────────────────────────────
  ipcMain.handle('ventes:getStatsByProduit', (e, { produitId, start, end }) => {
    try {
      // 1. Récupérer les données de vente
      let queryVentes = `
        SELECT 
          COALESCE(SUM(lv.quantite), 0) as total_qty, 
          COALESCE(SUM(lv.total_ttc), 0) as total_amount,
          COALESCE(SUM(lv.quantite * COALESCE(p.prix_achat, 0)), 0) as total_cost
        FROM lignes_vente lv
        INNER JOIN ventes v ON lv.vente_uuid = v.uuid
        LEFT JOIN produits p ON (lv.produit_id = p.id OR lv.produit_id = p.uuid)
        WHERE (lv.produit_id = ? OR lv.produit_id = (SELECT id FROM produits WHERE uuid = ?)) AND v.statut = 'valide'
      `;
      const paramsV = [produitId, produitId];
      if (start) { queryVentes += ` AND v.date_vente >= ?`; paramsV.push(start); }
      if (end) { queryVentes += ` AND v.date_vente <= ?`; paramsV.push(end); }
      const resV = db.prepare(queryVentes).get(...paramsV);

      // 2. Récupérer les données de perte (stock_historique)
      let queryPertes = `
        SELECT 
          COALESCE(SUM(ABS(sh.delta)), 0) as total_perte_qty,
          COALESCE(SUM(ABS(sh.delta) * COALESCE(p.prix_achat, 0)), 0) as total_perte_val
        FROM stock_historique sh
        LEFT JOIN produits p ON sh.produit_id = p.id
        WHERE (sh.produit_id = ? OR sh.produit_id = (SELECT id FROM produits WHERE uuid = ?)) AND sh.delta < 0
      `;
      const paramsP = [produitId, produitId];
      if (start) { queryPertes += ` AND sh.date_op >= ?`; paramsP.push(start); }
      if (end) { queryPertes += ` AND sh.date_op <= ?`; paramsP.push(end); }
      const resP = db.prepare(queryPertes).get(...paramsP);

      const CA = resV.total_amount || 0;
      const coutVendu = resV.total_cost || 0;
      const valeurPerte = resP.total_perte_val || 0;

      return {
        total_qty: resV.total_qty,
        total_amount: CA,
        total_perte_qty: resP.total_perte_qty,
        total_perte_val: valeurPerte,
        benefice_net: CA - coutVendu - valeurPerte
      };
    } catch (err) {
      console.error('Erreur getStatsByProduit:', err);
      return { total_qty: 0, total_amount: 0, total_perte_qty: 0, total_perte_val: 0, benefice_net: 0 };
    }
  });
};

