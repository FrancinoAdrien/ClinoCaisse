'use strict';
const { randomUUID } = require('crypto');
const { logAction } = require('./journal.ipc');
const { notifyChange } = require('../sync/notifier');
const { broadcastChange } = require('../realtime/broadcast');
const { insertVenteComplete } = require('./venteCreateCore');

module.exports = function(ipcMain, db) {

  // ── CRÉER UNE VENTE ──────────────────────────────────────────────────
  ipcMain.handle('ventes:create', (e, data) => {
    const createVente = db.transaction((data) => insertVenteComplete(db, data));

    try {
      const result = createVente(data);
      if (result.success) {
        logAction(db, {
          categorie: 'VENTE',
          action: 'Vente créée',
          detail: `Ticket ${result.numero_ticket} — ${data.lignes ? data.lignes.length : 0} article(s)`,
          operateur: data.nom_caissier || null,
          montant: data.total_ttc || 0,
          icone: '🛒'
        });
        notifyChange();
        broadcastChange({ scope: 'stock', ts: Date.now() });
        broadcastChange({ scope: 'cuisine', ts: Date.now() });
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
        broadcastChange({ scope: 'cuisine', ts: Date.now() });
        return { success: true, id: existing.uuid };
      } else {
        const uid = randomUUID();
        const result = db.prepare(`
          INSERT INTO tickets_table (uuid, numero_table, nom_table, nom_caissier, montant_total, lignes_json, last_modified_at, sync_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        `).run(uid, data.numero_table, data.nom_table || null, data.nom_caissier, total, lignesJson, now);
        broadcastChange({ scope: 'cuisine', ts: Date.now() });
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

