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

  // ── ALERTES STOCK ─────────────────────────────────────────────────────
  ipcMain.handle('stock:getAlertes', () => {
    return db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.actif = 1 AND p.stock_actuel != -1
        AND p.stock_actuel <= p.stock_alerte 
      ORDER BY p.stock_actuel ASC
    `).all();
  });

  // ── AJUSTEMENT STOCK ─────────────────────────────────────────────────
  ipcMain.handle('stock:ajustement', (e, produitId, delta, motif, prixVal = 0, prixType = 'unitaire') => {
    try {
      const produit = db.prepare('SELECT * FROM produits WHERE id = ?').get(produitId);
      if (!produit) return { success: false, message: 'Produit non trouvé' };

      const ancienneQty = produit.stock_actuel;
      const nouvelleQty = (ancienneQty === -1) ? -1 : (ancienneQty + delta);

      // Mise à jour stock
      db.prepare('UPDATE produits SET stock_actuel = ?, stock_bar = ? WHERE id = ?').run(nouvelleQty, nouvelleQty, produitId);

      // Historique
      db.prepare(`
        INSERT INTO stock_historique (produit_id, produit_nom, ancienne_qte, nouvelle_qte, delta, motif)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(produitId, produit.nom, ancienneQty, nouvelleQty, delta, motif || 'Ajustement manuel');

      // Si c'est un achat (delta positif et prix fourni)
      if (delta > 0 && prixVal > 0) {
        const montantTotal = (prixType === 'total') ? prixVal : (delta * prixVal);
        const pu = (prixType === 'total') ? (prixVal / delta) : prixVal;
        const uuidDepense = randomUUID();
        
        // Enregistrer la dépense
        db.prepare(`
          INSERT INTO depenses (uuid, categorie, description, montant, date_depense, statut, operateur, last_modified_at, sync_status) 
          VALUES (?, 'Achats stock', ?, ?, datetime('now'), 'payee', 'Système', ?, 1)
        `).run(
          uuidDepense, 
          `${produit.nom} - Qte: ${delta}, PU: ${pu.toFixed(2)}`,
          montantTotal,
          Date.now()
        );

        // Déduire du capital
        adjustCapital(-montantTotal);
      }

      logAction(db, {
        categorie: 'STOCK',
        action: delta > 0 ? 'Approvisionnement stock' : 'Ajustement stock',
        detail: `${produit.nom}: ${delta > 0 ? '+' : ''}${delta} ${produit.unite_base || 'unité'}(s) — ${motif || 'Ajustement manuel'}`,
        operateur: null,
        montant: delta > 0 && prixVal > 0 ? (prixType === 'total' ? prixVal : delta * prixVal) : null,
        icone: delta > 0 ? '📦' : '⚠️'
      });

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
