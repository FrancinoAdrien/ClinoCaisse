'use strict';

module.exports = function(ipcMain, db) {
  function normalizeRange(range = {}) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const startDate = (range.startDate || today).slice(0, 10);
    const endDate = (range.endDate || today).slice(0, 10);
    return { startDate, endDate };
  }

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
        JOIN ventes v ON lv.vente_uuid = v.uuid
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

  // ── TABLEAU PROFESSIONNEL MULTI-SOURCES ────────────────────────────────────
  ipcMain.handle('analytique:getOverview', (e, range = {}) => {
    try {
      const { startDate, endDate } = normalizeRange(range);

      const ventes = db.prepare(`
        SELECT v.*
        FROM ventes v
        WHERE date(v.date_vente) BETWEEN ? AND ?
          AND v.statut != 'annule'
        ORDER BY v.date_vente DESC
      `).all(startDate, endDate);

      const paiements = db.prepare(`
        SELECT mode_paiement, SUM(total_ttc) AS total, COUNT(*) AS nb
        FROM ventes
        WHERE date(date_vente) BETWEEN ? AND ?
          AND statut != 'annule'
        GROUP BY mode_paiement
        ORDER BY total DESC
      `).all(startDate, endDate);

      const topProduits = db.prepare(`
        SELECT
          lv.produit_nom,
          SUM(lv.quantite)  AS total_qte,
          SUM(lv.total_ttc) AS total_ca
        FROM lignes_vente lv
        JOIN ventes v ON lv.vente_uuid = v.uuid
        WHERE date(v.date_vente) BETWEEN ? AND ?
          AND v.statut != 'annule'
          AND lv.est_offert = 0
        GROUP BY lv.produit_nom
        ORDER BY total_qte DESC
        LIMIT 10
      `).all(startDate, endDate);

      const fluxStats = db.prepare(`
        SELECT
          CASE
            WHEN type_flux IN ('recette_terrain', 'recette_cloture') THEN 'entree'
            ELSE 'sortie'
          END AS sens,
          SUM(montant) AS total
        FROM flux_tresorerie
        WHERE date(date_flux) BETWEEN ? AND ?
          AND type_flux NOT IN ('ajout_capital', 'retrait_capital')
        GROUP BY sens
      `).all(startDate, endDate);

      const depenses = db.prepare(`
        SELECT COALESCE(SUM(montant), 0) AS total
        FROM depenses
        WHERE statut = 'payee'
          AND date(date_depense) BETWEEN ? AND ?
      `).get(startDate, endDate);

      const terrain = db.prepare(`
        SELECT
          COALESCE(SUM(montant_paye), 0) AS ca_terrain,
          COUNT(*) AS nb_reservations
        FROM reservations_terrain
        WHERE date(date_creation) BETWEEN ? AND ?
          AND statut != 'annulee'
      `).get(startDate, endDate);

      const caParJour = db.prepare(`
        SELECT date(date_vente) AS jour, SUM(total_ttc) AS ca, COUNT(*) AS nb_tickets
        FROM ventes
        WHERE date(date_vente) BETWEEN ? AND ?
          AND statut != 'annule'
        GROUP BY date(date_vente)
        ORDER BY jour ASC
      `).all(startDate, endDate);

      const caTerrainParJour = db.prepare(`
        SELECT date(date_creation) AS jour, SUM(montant_paye) AS ca_terrain
        FROM reservations_terrain
        WHERE date(date_creation) BETWEEN ? AND ?
          AND statut != 'annulee'
        GROUP BY date(date_creation)
        ORDER BY jour ASC
      `).all(startDate, endDate);

      const topTerrains = db.prepare(`
        SELECT
          COALESCE(e.nom, 'Espace inconnu') AS espace_nom,
          COUNT(*) AS total_reservations,
          COALESCE(SUM(rt.montant_paye), 0) AS total_ca
        FROM reservations_terrain rt
        LEFT JOIN espaces e ON rt.espace_id = e.id
        WHERE date(rt.date_creation) BETWEEN ? AND ?
          AND rt.statut != 'annulee'
        GROUP BY rt.espace_id, e.nom
        ORDER BY total_reservations DESC, total_ca DESC
        LIMIT 8
      `).all(startDate, endDate);

      const fluxBySens = { entree: 0, sortie: 0 };
      fluxStats.forEach((row) => {
        fluxBySens[row.sens] = Number(row.total || 0);
      });

      const totalVentes = ventes.reduce((sum, v) => sum + Number(v.total_ttc || 0), 0);
      const nbTickets = ventes.length;
      const panierMoyen = nbTickets ? totalVentes / nbTickets : 0;
      const totalTerrain = Number(terrain?.ca_terrain || 0);
      const totalEntrees = fluxBySens.entree + totalVentes;
      const totalSorties = fluxBySens.sortie + Number(depenses?.total || 0);

      return {
        range: { startDate, endDate },
        kpis: {
          total_ventes: totalVentes,
          nb_tickets: nbTickets,
          panier_moyen: panierMoyen,
          total_terrain: totalTerrain,
          nb_reservations: Number(terrain?.nb_reservations || 0),
          total_entrees: totalEntrees,
          total_sorties: totalSorties,
          net: totalEntrees - totalSorties
        },
        ventes,
        paiements,
        topProduits,
        topTerrains,
        caParJour,
        caTerrainParJour
      };
    } catch (err) {
      console.error('[analytique:getOverview]', err.message);
      return {
        range: normalizeRange(range),
        kpis: {
          total_ventes: 0, nb_tickets: 0, panier_moyen: 0, total_terrain: 0,
          nb_reservations: 0, total_entrees: 0, total_sorties: 0, net: 0
        },
        ventes: [],
        paiements: [],
        topProduits: [],
        topTerrains: [],
        caParJour: [],
        caTerrainParJour: []
      };
    }
  });
};
