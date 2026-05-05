'use strict';
const { randomUUID } = require('crypto');
const { logAction } = require('./journal.ipc');
const { notifyChange } = require('../sync/notifier');
const { broadcastChange } = require('../realtime/broadcast');

module.exports = function(ipcMain, db) {

  // ── HELPER: ajuster le capital ─────────────────────────────────────────────
  function adjustCapital(delta) {
    const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'finance.capital'").get();
    const current = parseFloat(row?.valeur || '0');
    db.prepare("INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status) VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = 'finance.capital'), lower(hex(randomblob(16)))), 'finance.capital', ?, datetime('now'), ?, 0)")
      .run(String(current + delta), Date.now());
  }

  // ── ALERTES STOCK ─────────────────────────────────────────────────────
  ipcMain.handle('stock:getAlertes', () => {
    return db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.actif = 1 AND p.stock_actuel != -1
        AND p.stock_bar <= p.stock_alerte AND p.stock_alerte > 0
      ORDER BY p.stock_bar ASC
    `).all();
  });

  // Compte rapide pour notification dashboard
  ipcMain.handle('stock:getAlertesCount', () => {
    const row = db.prepare(`
      SELECT COUNT(*) as n FROM produits
      WHERE actif = 1 AND stock_actuel != -1
        AND stock_bar <= stock_alerte AND stock_alerte > 0
    `).get();
    return row ? row.n : 0;
  });

  // ── AJUSTEMENT STOCK ─────────────────────────────────────────────────
  ipcMain.handle('stock:ajustement', (e, identifier, delta, motif, operateur, prixVal = 0, prixType = 'unitaire', impactCapital = true) => {
    try {
      const produit = db.prepare('SELECT * FROM produits WHERE id = ? OR uuid = ?').get(identifier, identifier);
      if (!produit) return { success: false, message: 'Produit non trouvé' };

      const ancienneQty = produit.stock_actuel;
      const nouvelleQty = (ancienneQty === -1) ? -1 : (ancienneQty + delta);

      // Mise à jour stock (marquer comme à synchroniser)
      db.prepare('UPDATE produits SET stock_actuel = ?, stock_bar = ?, last_modified_at = ?, sync_status = 0 WHERE id = ? OR uuid = ?').run(nouvelleQty, nouvelleQty, Date.now(), identifier, identifier);

      // Historique avec uuid et colonnes synchro
      db.prepare(`
        INSERT INTO stock_historique (uuid, produit_id, produit_nom, ancienne_qte, nouvelle_qte, delta, motif, last_modified_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(randomUUID(), identifier, produit.nom, ancienneQty, nouvelleQty, delta, motif || 'Ajustement manuel', Date.now());

      // Si c'est un achat (delta positif et prix fourni) ET qu'on veut impacter le capital
      if (delta > 0 && prixVal > 0 && impactCapital) {
        const montantTotal = (prixType === 'total') ? prixVal : (delta * prixVal);
        const pu = (prixType === 'total') ? (prixVal / delta) : prixVal;
        const uuidDepense = randomUUID();
        
        // Enregistrer la dépense
        db.prepare(`
          INSERT INTO depenses (uuid, categorie, description, montant, date_depense, statut, operateur, last_modified_at, sync_status) 
          VALUES (?, 'Achats stock', ?, ?, datetime('now'), 'payee', ?, ?, 1)
        `).run(
          uuidDepense, 
          `${produit.nom} - Qte: ${delta}, PU: ${pu.toFixed(2)}`,
          montantTotal,
          operateur || 'Système',
          Date.now()
        );

        // Déduire du capital
        adjustCapital(-montantTotal);
      }

      logAction(db, {
        categorie: 'STOCK',
        action: delta > 0 ? 'Approvisionnement stock' : 'Ajustement stock',
        detail: `${produit.nom}: ${delta > 0 ? '+' : ''}${delta} ${produit.unite_base || 'unité'}(s) — ${motif || 'Ajustement manuel'}`,
        operateur: operateur || null,
        montant: delta > 0 && prixVal > 0 && impactCapital ? (prixType === 'total' ? prixVal : delta * prixVal) : null,
        icone: delta > 0 ? '📦' : '⚠️'
      });
      notifyChange();
      broadcastChange({ scope: 'stock', ts: Date.now() });

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
