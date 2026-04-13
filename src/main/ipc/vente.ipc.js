'use strict';

module.exports = function(ipcMain, db) {

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
      const numero = genNumeroTicket();
      const venteResult = db.prepare(`
        INSERT INTO ventes (numero_ticket, date_vente, nom_caissier, total_ttc,
          mode_paiement, montant_paye, monnaie_rendue, statut, table_numero, note)
        VALUES (?, datetime('now'), ?, ?, ?, ?, ?, 'valide', ?, ?)
      `).run(
        numero,
        data.nom_caissier,
        data.total_ttc,
        data.mode_paiement || 'CASH',
        data.montant_paye || data.total_ttc,
        data.monnaie_rendue || 0,
        data.table_numero || null,
        data.note || null
      );

      const venteId = venteResult.lastInsertRowid;
      const insLigne = db.prepare(`
        INSERT INTO lignes_vente (vente_id, produit_id, produit_nom, quantite,
          prix_unitaire, remise, rabais, total_ttc, est_offert)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ligne of data.lignes) {
        insLigne.run(
          venteId,
          ligne.produit_id || null,
          ligne.produit_nom,
          ligne.quantite,
          ligne.prix_unitaire,
          ligne.remise || 0,
          ligne.rabais || 0,
          ligne.total_ttc,
          ligne.est_offert ? 1 : 0
        );

        // Décrémenter le stock si pas illimité
        if (ligne.produit_id && !ligne.est_offert) {
          const p = db.prepare('SELECT stock_actuel FROM produits WHERE id = ?').get(ligne.produit_id);
          if (p && p.stock_actuel !== -1) {
            db.prepare('UPDATE produits SET stock_actuel = MAX(0, stock_actuel - ?) WHERE id = ?')
              .run(ligne.quantite, ligne.produit_id);
          }
        }
      }

      return { success: true, id: venteId, numero_ticket: numero };
    });

    try {
      return createVente(data);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── TOUTES LES VENTES ────────────────────────────────────────────────
  ipcMain.handle('ventes:getAll', () => {
    return db.prepare(`
      SELECT v.*, GROUP_CONCAT(lv.produit_nom, ', ') as articles
      FROM ventes v
      LEFT JOIN lignes_vente lv ON lv.vente_id = v.id
      GROUP BY v.id
      ORDER BY v.date_vente DESC
      LIMIT 500
    `).all();
  });

  // ── VENTE PAR ID ─────────────────────────────────────────────────────
  ipcMain.handle('ventes:getById', (e, id) => {
    const vente = db.prepare('SELECT * FROM ventes WHERE id = ?').get(id);
    if (!vente) return null;
    vente.lignes = db.prepare('SELECT * FROM lignes_vente WHERE vente_id = ?').all(id);
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
      db.prepare("UPDATE ventes SET statut = 'annule' WHERE id = ?").run(id);
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
      const existing = db.prepare(
        "SELECT id FROM tickets_table WHERE numero_table = ? AND statut = 'en_cours'"
      ).get(data.numero_table);

      if (existing) {
        db.prepare(`
          UPDATE tickets_table SET nom_table = ?, nom_caissier = ?,
            date_modification = datetime('now'), montant_total = ?, lignes_json = ?
          WHERE id = ?
        `).run(data.nom_table || null, data.nom_caissier, total, lignesJson, existing.id);
        return { success: true, id: existing.id };
      } else {
        const result = db.prepare(`
          INSERT INTO tickets_table (numero_table, nom_table, nom_caissier, montant_total, lignes_json)
          VALUES (?, ?, ?, ?, ?)
        `).run(data.numero_table, data.nom_table || null, data.nom_caissier, total, lignesJson);
        return { success: true, id: result.lastInsertRowid };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('tables:charger', (e, id) => {
    const t = db.prepare('SELECT * FROM tickets_table WHERE id = ?').get(id);
    if (t && t.lignes_json) {
      try { t.lignes = JSON.parse(t.lignes_json); } catch { t.lignes = []; }
    }
    return t;
  });

  ipcMain.handle('tables:supprimer', (e, id) => {
    try {
      db.prepare("UPDATE tickets_table SET statut = 'ferme' WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('tables:ajouterTable', () => {
    try {
      const max = db.prepare('SELECT MAX(numero_table) as m FROM tables_config').get().m || 0;
      const next = max + 1;
      db.prepare('INSERT INTO tables_config (numero_table, ordre) VALUES (?, ?)').run(next, next);
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
};
