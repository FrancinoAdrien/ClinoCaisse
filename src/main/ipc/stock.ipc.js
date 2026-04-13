'use strict';

module.exports = function(ipcMain, db) {

  // ── ALERTES STOCK ─────────────────────────────────────────────────────
  ipcMain.handle('stock:getAlertes', () => {
    return db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.actif = 1 AND p.stock_actuel != -1 AND p.stock_actuel <= p.stock_alerte
      ORDER BY p.stock_actuel ASC
    `).all();
  });

  // ── AJUSTEMENT STOCK ─────────────────────────────────────────────────
  ipcMain.handle('stock:ajustement', (e, produitId, nouvelleQty, motif) => {
    try {
      const produit = db.prepare('SELECT * FROM produits WHERE id = ?').get(produitId);
      if (!produit) return { success: false, message: 'Produit non trouvé' };

      const ancienneQty = produit.stock_actuel;
      const delta = nouvelleQty - ancienneQty;

      db.prepare('UPDATE produits SET stock_actuel = ? WHERE id = ?').run(nouvelleQty, produitId);

      // Historique
      db.prepare(`
        INSERT INTO stock_historique (produit_id, produit_nom, ancienne_qte, nouvelle_qte, delta, motif)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(produitId, produit.nom, ancienneQty, nouvelleQty, delta, motif || 'Ajustement manuel');

      return { success: true, ancienneQty, nouvelleQty, delta };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── HISTORIQUE STOCK ─────────────────────────────────────────────────
  ipcMain.handle('stock:historique', (e, produitId) => {
    if (produitId) {
      return db.prepare(`
        SELECT * FROM stock_historique WHERE produit_id = ?
        ORDER BY date_op DESC LIMIT 100
      `).all(produitId);
    }
    return db.prepare(`
      SELECT * FROM stock_historique ORDER BY date_op DESC LIMIT 200
    `).all();
  });
};
