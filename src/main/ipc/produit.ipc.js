'use strict';
const { randomUUID } = require('crypto');
const { logAction } = require('./journal.ipc');

module.exports = function(ipcMain, db) {

  // ── HELPER: ajuster le capital ─────────────────────────────────────────────
  function adjustCapital(delta) {
    const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'finance.capital'").get();
    const current = parseFloat(row?.valeur || '0');
    db.prepare("INSERT OR REPLACE INTO parametres (cle, valeur, date_maj) VALUES ('finance.capital', ?, datetime('now'))")
      .run(String(current + delta));
  }

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

  ipcMain.handle('produits:getIngredients', (e, platId) => {
    // On récupère les ingrédients liés via recettes_lignes
    // On joint avec produits pour avoir le nom et le prix_achat
    return db.prepare(`
      SELECT rl.*, p.nom, p.prix_achat, p.id as ingredient_id
      FROM recettes_lignes rl
      JOIN produits p ON rl.ingredient_uuid = p.uuid
      JOIN produits plat ON rl.plat_uuid = plat.uuid
      WHERE plat.id = ?
    `).all(platId);
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
      const uid = randomUUID();
      const now = Date.now();
      const stockBar = data.stock_actuel !== undefined ? data.stock_actuel : -1;
      const stockGrossiste = data.stock_grossiste !== undefined ? data.stock_grossiste : (data.stock_gros || 0);
      const uniteBase = (data.unite_base || data.unite_detail || 'Unité').trim() || 'Unité';
      const cartonQte = data.unite_carton_qte != null ? data.unite_carton_qte : (data.pieces_par_carton || 1);
      const packQte = data.unite_pack_qte != null ? data.unite_pack_qte : 1;
      const isAlcool = data.is_alcool != null ? !!data.is_alcool : !!data.est_alcool;
      const isPrepared = data.is_prepared != null ? !!data.is_prepared : false;

      const result = db.prepare(`
        INSERT INTO produits (uuid, reference, nom, description, prix_vente_ttc, prix_achat,
          prix_emporte, categorie_id, stock_actuel, stock_alerte, fournisseur, image_data,
          unite_base, stock_bar, is_alcool, is_ingredient, is_prepared, last_modified_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        uid,
        data.reference || null,
        data.nom,
        data.description || null,
        data.prix_vente_ttc || 0,
        data.prix_achat_val || 0,
        data.prix_emporte || 0,
        data.categorie_id || null,
        stockBar,
        data.stock_alerte || 0,
        data.fournisseur || null,
        data.image_data || null,
        uniteBase,
        stockBar === -1 ? 0 : stockBar,
        isAlcool ? 1 : 0,
        data.is_ingredient ? 1 : 0,
        isPrepared ? 1 : 0,
        now
      );
      const id = result.lastInsertRowid;

      // Gestion des ingrédients si produit préparé
      if (isPrepared && data.ingredients && Array.isArray(data.ingredients)) {
        const insRecette = db.prepare(`
          INSERT INTO recettes_lignes (uuid, plat_uuid, ingredient_uuid, quantite_requise, last_modified_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const ing of data.ingredients) {
          // On a besoin du UUID de l'ingrédient
          const ingProd = db.prepare('SELECT uuid FROM produits WHERE id = ?').get(ing.ingredient_id);
          if (ingProd) {
            insRecette.run(randomUUID(), uid, ingProd.uuid, ing.quantite_requise, now);
          }
        }
      }

      // Si c'est un achat initial
      if (data.is_achat && data.prix_achat_val > 0 && stockBar > 0) {
        const montantTotal = (data.prix_achat_type === 'total') ? data.prix_achat_val : (stockBar * data.prix_achat_val);
        const pu = (data.prix_achat_type === 'total') ? (data.prix_achat_val / stockBar) : data.prix_achat_val;
        const uuidDepense = randomUUID();

        db.prepare(`
          INSERT INTO depenses (uuid, categorie, description, montant, date_depense, statut, operateur, last_modified_at, sync_status) 
          VALUES (?, 'Achats stock', ?, ?, datetime('now'), 'payee', 'Système', ?, 1)
        `).run(
          uuidDepense, 
          `Stock initial: ${data.nom} - Qte: ${stockBar}, PU: ${pu.toFixed(2)}`,
          montantTotal,
          Date.now()
        );

        adjustCapital(-montantTotal);
      }
      // Aligner reference = id si non fourni
      db.prepare('UPDATE produits SET reference = ? WHERE id = ? AND (reference IS NULL OR reference = ?)').run(
        String(id), id, String(id)
      );
      db.prepare('UPDATE produits SET reference = ? WHERE id = ? AND reference IS NULL').run(String(id), id);

      logAction(db, {
        categorie: 'PRODUIT',
        action: 'Produit créé',
        detail: `"${data.nom}" — Prix: ${data.prix_vente_ttc || 0} Ar`,
        icone: '➕'
      });

      return { success: true, id };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── MODIFIER PRODUIT ─────────────────────────────────────────────────
  ipcMain.handle('produits:update', (e, id, data) => {
    try {
      const stockBar = data.stock_actuel;
      const uniteBase = (data.unite_base || data.unite_detail || 'Unité').trim() || 'Unité';
      const isAlcool = data.is_alcool != null ? !!data.is_alcool : !!data.est_alcool;
      const isPrepared = data.is_prepared != null ? !!data.is_prepared : false;
      const now = Date.now();

      db.prepare(`
        UPDATE produits SET
          nom = ?, description = ?, prix_vente_ttc = ?, prix_achat = ?,
          prix_emporte = ?, categorie_id = ?, stock_actuel = ?, stock_alerte = ?,
          fournisseur = ?, image_data = COALESCE(?, image_data),
          unite_base = ?, stock_bar = ?,
          is_alcool = ?, is_ingredient = ?, is_prepared = ?,
          last_modified_at = ?, sync_status = 0
        WHERE id = ?
      `).run(
        data.nom,
        data.description || null,
        data.prix_vente_ttc || 0,
        data.prix_achat_val || 0,
        data.prix_emporte || 0,
        data.categorie_id || null,
        stockBar,
        data.stock_alerte || 0,
        data.fournisseur || null,
        data.image_data || null,
        uniteBase,
        stockBar === -1 ? 0 : stockBar,
        isAlcool ? 1 : 0,
        data.is_ingredient ? 1 : 0,
        isPrepared ? 1 : 0,
        now,
        id
      );

      // Gestion des ingrédients si produit préparé
      // On récupère l'UUID du plat
      const plat = db.prepare('SELECT uuid FROM produits WHERE id = ?').get(id);
      if (plat) {
        // Supprimer les anciens ingrédients
        db.prepare('DELETE FROM recettes_lignes WHERE plat_uuid = ?').run(plat.uuid);
        
        if (isPrepared && data.ingredients && Array.isArray(data.ingredients)) {
          const insRecette = db.prepare(`
            INSERT INTO recettes_lignes (uuid, plat_uuid, ingredient_uuid, quantite_requise, last_modified_at)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const ing of data.ingredients) {
            const ingProd = db.prepare('SELECT uuid FROM produits WHERE id = ?').get(ing.ingredient_id);
            if (ingProd) {
              insRecette.run(randomUUID(), plat.uuid, ingProd.uuid, ing.quantite_requise, now);
            }
          }
        }
      }
      logAction(db, {
        categorie: 'PRODUIT',
        action: 'Produit modifié',
        detail: `"${data.nom}" — Prix: ${data.prix_vente_ttc || 0} Ar`,
        icone: '✏️'
      });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── SUPPRIMER / DÉSACTIVER PRODUIT ────────────────────────────────────
  ipcMain.handle('produits:delete', (e, id) => {
    try {
      const p = db.prepare('SELECT nom FROM produits WHERE id = ?').get(id);
      db.prepare('UPDATE produits SET actif = 0 WHERE id = ?').run(id);
      logAction(db, {
        categorie: 'PRODUIT',
        action: 'Produit désactivé',
        detail: p ? `"${p.nom}"` : `ID ${id}`,
        icone: '🗑️'
      });
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

      db.prepare('UPDATE produits SET stock_actuel = ?, stock_bar = ? WHERE id = ?').run(newStock, newStock, id);
      return { success: true, newStock };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── CATÉGORIES ────────────────────────────────────────────────────────
  ipcMain.handle('categories:getAll', () => {
    return db.prepare(`
      SELECT * FROM categories
      ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, parent_id, ordre, nom
    `).all();
  });

  ipcMain.handle('categories:create', (e, data) => {
    try {
      const result = db.prepare(
        'INSERT INTO categories (code, nom, description, ordre, parent_id) VALUES (?, ?, ?, ?, ?)'
      ).run(data.code || data.nom.toUpperCase(), data.nom, data.description || null, data.ordre || 99, data.parent_id || null);
      return { success: true, id: result.lastInsertRowid };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('categories:update', (e, id, data) => {
    try {
      db.prepare('UPDATE categories SET nom = ?, description = ?, parent_id = ? WHERE id = ?')
        .run(data.nom, data.description || null, data.parent_id || null, id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('categories:delete', (e, id) => {
    try {
      // Réassigner les sous-catégories à NULL
      db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(id);
      // Réassigner les produits de cette catégorie à null
      db.prepare('UPDATE produits SET categorie_id = NULL WHERE categorie_id = ?').run(id);
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
