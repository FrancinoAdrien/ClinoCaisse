'use strict';

module.exports = function(ipcMain, db) {

  // ── TOUS LES PRODUITS ────────────────────────────────────────────────
  ipcMain.handle('produits:getAll', () => {
    return db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p
      LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.actif = 1
      ORDER BY c.ordre, p.nom
    `).all();
  });

  ipcMain.handle('produits:getByCategorie', (e, catId) => {
    if (!catId || catId === -1) {
      return db.prepare(`
        SELECT p.*, c.nom as categorie_nom
        FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id
        WHERE p.actif = 1 ORDER BY p.nom
      `).all();
    }
    return db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.actif = 1 AND p.categorie_id = ?
      ORDER BY p.nom
    `).all(catId);
  });

  ipcMain.handle('produits:getById', (e, id) => {
    return db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
  });

  ipcMain.handle('produits:search', (e, query) => {
    const q = `%${query}%`;
    return db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.actif = 1 AND (p.nom LIKE ? OR p.reference LIKE ? OR p.description LIKE ?)
      ORDER BY p.nom
    `).all(q, q, q);
  });

  // ── CRÉER PRODUIT ────────────────────────────────────────────────────
  ipcMain.handle('produits:create', (e, data) => {
    try {
      const result = db.prepare(`
        INSERT INTO produits (reference, nom, description, prix_vente_ttc, prix_achat,
          prix_emporte, categorie_id, stock_actuel, stock_alerte, fournisseur, image_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.reference || null,
        data.nom,
        data.description || null,
        data.prix_vente_ttc || 0,
        data.prix_achat || 0,
        data.prix_emporte || 0,
        data.categorie_id || null,
        data.stock_actuel !== undefined ? data.stock_actuel : -1,
        data.stock_alerte || 0,
        data.fournisseur || null,
        data.image_data || null
      );
      const id = result.lastInsertRowid;
      // Aligner reference = id
      db.prepare('UPDATE produits SET reference = ? WHERE id = ? AND (reference IS NULL OR reference = ?)').run(
        String(id), id, String(id)
      );
      db.prepare('UPDATE produits SET reference = ? WHERE id = ? AND reference IS NULL').run(String(id), id);
      return { success: true, id };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── MODIFIER PRODUIT ─────────────────────────────────────────────────
  ipcMain.handle('produits:update', (e, id, data) => {
    try {
      db.prepare(`
        UPDATE produits SET
          nom = ?, description = ?, prix_vente_ttc = ?, prix_achat = ?,
          prix_emporte = ?, categorie_id = ?, stock_actuel = ?, stock_alerte = ?,
          fournisseur = ?, image_data = COALESCE(?, image_data)
        WHERE id = ?
      `).run(
        data.nom, data.description || null, data.prix_vente_ttc, data.prix_achat || 0,
        data.prix_emporte || 0, data.categorie_id || null, data.stock_actuel,
        data.stock_alerte || 0, data.fournisseur || null, data.image_data || null, id
      );
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── SUPPRIMER / DÉSACTIVER PRODUIT ────────────────────────────────────
  ipcMain.handle('produits:delete', (e, id) => {
    try {
      db.prepare('UPDATE produits SET actif = 0 WHERE id = ?').run(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── MISE À JOUR STOCK ────────────────────────────────────────────────
  ipcMain.handle('produits:updateStock', (e, id, qty, operation) => {
    try {
      const produit = db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
      if (!produit) return { success: false, message: 'Produit non trouvé' };
      if (produit.stock_actuel === -1) return { success: true }; // illimité

      let newStock;
      if (operation === 'set')        newStock = qty;
      else if (operation === 'add')   newStock = produit.stock_actuel + qty;
      else if (operation === 'sub')   newStock = Math.max(0, produit.stock_actuel - qty);
      else                            newStock = produit.stock_actuel;

      db.prepare('UPDATE produits SET stock_actuel = ? WHERE id = ?').run(newStock, id);
      return { success: true, newStock };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── CATÉGORIES ────────────────────────────────────────────────────────
  ipcMain.handle('categories:getAll', () => {
    return db.prepare('SELECT * FROM categories ORDER BY ordre, nom').all();
  });

  ipcMain.handle('categories:create', (e, data) => {
    try {
      const result = db.prepare(
        'INSERT INTO categories (code, nom, description, ordre) VALUES (?, ?, ?, ?)'
      ).run(data.code || data.nom.toUpperCase(), data.nom, data.description || null, data.ordre || 99);
      return { success: true, id: result.lastInsertRowid };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('categories:update', (e, id, data) => {
    try {
      db.prepare('UPDATE categories SET nom = ?, description = ? WHERE id = ?')
        .run(data.nom, data.description || null, id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('categories:delete', (e, id) => {
    try {
      // Réassigner les produits de cette catégorie à null
      db.prepare('UPDATE produits SET categorie_id = NULL WHERE categorie_id = ?').run(id);
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
