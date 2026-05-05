'use strict';
const { randomUUID } = require('crypto');

function genNumeroTicket(db) {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.prepare("SELECT COUNT(*) as n FROM ventes WHERE date_vente LIKE ?").get(`${now.toISOString().slice(0, 10)}%`).n;
  return `T${d}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Insère vente + lignes + décrément stock (équivalent au corps de ventes:create, sans livraison).
 * À appeler à l'intérieur d'une transaction db.transaction().
 */
function insertVenteComplete(db, data) {
  const numero = genNumeroTicket(db);
  const venteUid = randomUUID();
  const now = Date.now();

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
    data.montant_paye !== undefined && data.montant_paye !== null ? data.montant_paye : data.total_ttc,
    data.monnaie_rendue || 0,
    data.table_numero || null,
    data.note || null,
    now
  );

  const venteId = venteResult.lastInsertRowid;
  const insLigne = db.prepare(`
    INSERT INTO lignes_vente (uuid, vente_id, vente_uuid, produit_id, produit_nom, quantite,
      prix_unitaire, prix_achat, remise, rabais, total_ttc, est_offert, statut_cuisine, last_modified_at, sync_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const hasTable = data.table_numero != null && data.table_numero !== '';
  for (const ligne of data.lignes || []) {
    const defCuisine = ligne.statut_cuisine
      || (hasTable && !ligne.est_offert ? 'en_attente' : 'servi');
    
    // Capturer le prix d'achat actuel du produit au moment de la vente
    let prixAchatCourant = ligne.prix_achat || 0;
    if (ligne.produit_id && prixAchatCourant === 0) {
      const prodRow = db.prepare('SELECT prix_achat FROM produits WHERE id = ? OR uuid = ?').get(ligne.produit_id, ligne.produit_id);
      if (prodRow) prixAchatCourant = prodRow.prix_achat || 0;
    }

    insLigne.run(
      randomUUID(),
      venteId,
      venteUid,
      ligne.produit_id || null,
      ligne.produit_nom,
      ligne.quantite,
      ligne.prix_unitaire,
      prixAchatCourant,
      ligne.remise || 0,
      ligne.rabais || 0,
      ligne.total_ttc,
      ligne.est_offert ? 1 : 0,
      defCuisine,
      now
    );

    if (ligne.produit_id && !ligne.est_offert) {
      const p = db.prepare('SELECT stock_actuel, stock_bar, is_prepared, uuid FROM produits WHERE id = ? OR uuid = ?').get(ligne.produit_id, ligne.produit_id);
      if (p) {
        if (p.is_prepared) {
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

  return { success: true, id: venteId, numero_ticket: numero, vente_uuid: venteUid };
}

module.exports = { insertVenteComplete, genNumeroTicket };
