'use strict';

module.exports = function(ipcMain, db) {

  // ── VENTES PAR PÉRIODE (N jours) ─────────────────────────────────────────
  ipcMain.handle('analytique:getVentesByPeriod', (e, days = 7) => {
    try {
      const rows = db.prepare(`
        SELECT v.*
        FROM ventes v
        WHERE v.date_vente >= datetime('now', ? || ' days')
          AND v.statut != 'annule'
        ORDER BY v.date_vente DESC
      `).all(`-${days}`);
      return rows;
    } catch (err) {
      console.error('[analytique:getVentesByPeriod]', err.message);
      return [];
    }
  });

  // ── VENTES D'AUJOURD'HUI ──────────────────────────────────────────────────
  ipcMain.handle('analytique:getVentesToday', () => {
    try {
      const rows = db.prepare(`
        SELECT v.*
        FROM ventes v
        WHERE date(v.date_vente) = date('now')
          AND v.statut != 'annule'
        ORDER BY v.date_vente DESC
      `).all();
      return rows;
    } catch (err) {
      return [];
    }
  });

  // ── TOP N PRODUITS LES PLUS VENDUS ───────────────────────────────────────
  ipcMain.handle('analytique:getTopProduits', (e, days = 7, limit = 10) => {
    try {
      const rows = db.prepare(`
        SELECT
          lv.produit_nom,
          SUM(lv.quantite)  AS total_qte,
          SUM(lv.total_ttc) AS total_ca
        FROM lignes_vente lv
        JOIN ventes v ON lv.vente_id = v.id
        WHERE v.date_vente >= datetime('now', ? || ' days')
          AND v.statut != 'annule'
          AND lv.est_offert = 0
        GROUP BY lv.produit_nom
        ORDER BY total_qte DESC
        LIMIT ?
      `).all(`-${days}`, limit);
      return rows;
    } catch (err) {
      console.error('[analytique:getTopProduits]', err.message);
      return [];
    }
  });

  // ── RÉPARTITION PAR MODE DE PAIEMENT ─────────────────────────────────────
  ipcMain.handle('analytique:getPaiementStats', (e, days = 7) => {
    try {
      const rows = db.prepare(`
        SELECT
          mode_paiement,
          SUM(total_ttc) AS total,
          COUNT(*) AS nb
        FROM ventes
        WHERE date_vente >= datetime('now', ? || ' days')
          AND statut != 'annule'
        GROUP BY mode_paiement
        ORDER BY total DESC
      `).all(`-${days}`);
      return rows;
    } catch (err) {
      return [];
    }
  });

  // ── CA PAR JOUR (graphique) ───────────────────────────────────────────────
  ipcMain.handle('analytique:getCAParJour', (e, days = 30) => {
    try {
      const rows = db.prepare(`
        SELECT
          date(date_vente) AS jour,
          SUM(total_ttc)   AS ca,
          COUNT(*)         AS nb_tickets
        FROM ventes
        WHERE date_vente >= datetime('now', ? || ' days')
          AND statut != 'annule'
        GROUP BY jour
        ORDER BY jour ASC
      `).all(`-${days}`);
      return rows;
    } catch (err) {
      return [];
    }
  });

  // ── RÉSUMÉ CLÔTURES ───────────────────────────────────────────────────────
  ipcMain.handle('analytique:getClotures', (e, days = 30) => {
    try {
      const rows = db.prepare(`
        SELECT *
        FROM clotures
        WHERE date_cloture >= datetime('now', ? || ' days')
        ORDER BY date_cloture DESC
      `).all(`-${days}`);
      return rows;
    } catch (err) {
      return [];
    }
  });
};
