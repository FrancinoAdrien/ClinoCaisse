'use strict';

module.exports = function(ipcMain, db) {

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER : calcule un rapport sur un ensemble de ventes
  // whereV : clause WHERE pour la table ventes (alias "v") ex: "AND v.date_vente > ?"
  // params  : paramètres liés
  // ─────────────────────────────────────────────────────────────────────────
  function calculerCloture(whereV, params) {

    // ── 1. Totaux par mode de paiement ────────────────────────────────────
    const ventes = db.prepare(`
      SELECT id, total_ttc, mode_paiement, statut, date_vente, nom_caissier
      FROM ventes v
      WHERE v.statut = 'valide' ${whereV}
    `).all(...params);

    let totalTTC = 0, totalCash = 0, totalMvola = 0, totalOrange = 0;
    let totalAirtel = 0, totalCarte = 0, totalAutre = 0, totalVirement = 0;
    let nbTickets = 0;
    const venteIds = [];

    for (const v of ventes) {
      nbTickets++;
      const mt = v.total_ttc || 0;
      totalTTC += mt;
      venteIds.push(v.id);
      switch (v.mode_paiement) {
        case 'CASH':         totalCash      += mt; break;
        case 'MVOLA':        totalMvola     += mt; break;
        case 'ORANGE_MONEY': totalOrange    += mt; break;
        case 'AIRTEL_MONEY': totalAirtel    += mt; break;
        case 'CARTE':        totalCarte     += mt; break;
        case 'VIREMENT':     totalVirement  += mt; break;
        default:             totalAutre     += mt; break;
      }
    }

    // ── 2. Détail articles (via IDs) ──────────────────────────────────────
    const articlesMap   = {};
    const categoriesMap = {};
    const offerts       = {};
    const remises       = {}; // key = nom, value = { qte, montant, remisePct }
    let   nbArticles    = 0;

    if (venteIds.length > 0) {
      const placeholders = venteIds.map(() => '?').join(',');
      const lignes = db.prepare(`
        SELECT lv.*,
               p.nom      AS produit_nom_db,
               c.nom      AS cat_nom
        FROM   lignes_vente lv
        LEFT JOIN produits   p ON p.id = lv.produit_id
        LEFT JOIN categories c ON c.id = p.categorie_id
        WHERE  lv.vente_id IN (${placeholders})
      `).all(...venteIds);

      for (const l of lignes) {
        nbArticles += l.quantite || 0;
        const nom = l.produit_nom || l.produit_nom_db || '?';

        if (l.est_offert) {
          offerts[nom] = (offerts[nom] || 0) + l.quantite;
          continue;
        }
        if (l.remise > 0 || l.rabais > 0) {
          const key = nom; // on garde le nom pur comme clé
          const pct = l.remise > 0 ? Math.round(l.remise) : null; // null = rabais fixe
          remises[key] = remises[key] || { qte: 0, montant: 0, remisePct: pct };
          remises[key].qte     += l.quantite;
          remises[key].montant += l.total_ttc;
          // En cas de remises mixtes sur le même article, on garde la pct
          if (pct !== null && remises[key].remisePct === null) remises[key].remisePct = pct;
        }

        articlesMap[nom] = articlesMap[nom] || { qte: 0, montant: 0 };
        articlesMap[nom].qte     += l.quantite;
        articlesMap[nom].montant += l.total_ttc;

        const catNom = l.cat_nom || 'Sans catégorie';
        categoriesMap[catNom] = categoriesMap[catNom] || { qte: 0, montant: 0 };
        categoriesMap[catNom].qte     += l.quantite;
        categoriesMap[catNom].montant += l.total_ttc;
      }
    }

    // ── 3. Plage de dates ─────────────────────────────────────────────────
    const plage = db.prepare(`
      SELECT MIN(date_vente) as debut, MAX(date_vente) as fin
      FROM   ventes v
      WHERE  v.statut = 'valide' ${whereV}
    `).get(...params);

    // ── 4. Export listes tableau ──────────────────────────────────────────
    const arrArticles = Object.entries(articlesMap)
      .sort((a, b) => b[1].montant - a[1].montant)
      .map(([nom, d]) => ({ nom, qte: d.qte, montant: d.montant }));

    const arrCats = Object.entries(categoriesMap)
      .sort((a, b) => b[1].montant - a[1].montant)
      .map(([nom, d]) => ({ nom, qte: d.qte, montant: d.montant }));

    const arrOfferts = Object.entries(offerts)
      .map(([nom, qte]) => ({ nom, qte }));

    const arrRemises = Object.entries(remises)
      .sort((a, b) => b[1].montant - a[1].montant)
      .map(([nom, d]) => ({ nom, qte: d.qte, montant: d.montant, remisePct: d.remisePct }));

    return {
      totalTTC, totalCash, totalMvola, totalOrange,
      totalAirtel, totalCarte, totalVirement, totalAutre,
      nbTickets,
      nbArticles: Math.round(nbArticles),
      dateDebut: plage?.debut || new Date().toISOString(),
      dateFin:   plage?.fin   || new Date().toISOString(),
      articlesDetail:    arrArticles,
      categoriesDetail:  arrCats,
      offertsDetail:     arrOfferts,
      remisesDetail:     arrRemises,
    };
  }

  // ── RAPPORT X — depuis dernière clôture Z ─────────────────────────────
  ipcMain.handle('cloture:rapportX', () => {
    try {
      const z = db.prepare(
        "SELECT date_cloture FROM clotures WHERE type_cloture='Z' ORDER BY id DESC LIMIT 1"
      ).get();
      const depuis = z ? z.date_cloture : '2000-01-01 00:00:00';
      const r = calculerCloture('AND datetime(v.date_vente) > datetime(?)', [depuis]);
      if (depuis !== '2000-01-01 00:00:00') {
        r.dateDebut = depuis; // Afficher la date exacte de la dernière clôture
      }
      return r;
    } catch (err) {
      return { error: err.message, totalTTC:0, totalCash:0, totalMvola:0, totalOrange:0, totalAirtel:0, totalCarte:0, totalVirement:0, totalAutre:0, nbTickets:0, nbArticles:0, articlesDetail:'', categoriesDetail:'', offertsDetail:'', remisesDetail:'', dateDebut: new Date().toISOString(), dateFin: new Date().toISOString() };
    }
  });

  // ── RAPPORT PAR DATE ──────────────────────────────────────────────────
  ipcMain.handle('cloture:rapportParDate', (e, date) => {
    try {
      const res = calculerCloture('AND date(v.date_vente) = date(?)', [date]);
      if (res.nbTickets === 0) {
        res.dateDebut = `${date}T00:00:00.000Z`;
        res.dateFin   = `${date}T23:59:59.999Z`;
      }
      return res;
    } catch (err) {
      return { error: err.message, totalTTC:0, totalCash:0, totalMvola:0, totalOrange:0, totalAirtel:0, totalCarte:0, totalVirement:0, totalAutre:0, nbTickets:0, nbArticles:0, articlesDetail:'', dateDebut:'', dateFin:'' };
    }
  });

  // ── RAPPORT PAR VENDEUR ───────────────────────────────────────────────
  ipcMain.handle('cloture:rapportParVendeur', (e, opts) => {
    try {
      const v = typeof opts === 'string' ? opts : opts.vendeur;
      const debut = typeof opts === 'object' ? opts.debut : '';
      const fin = typeof opts === 'object' ? opts.fin : '';

      let where = '';
      const params = [];

      if (v && v !== 'Tous les vendeurs') {
        where += 'AND v.nom_caissier = ? ';
        params.push(v);
      }
      if (debut) {
        where += 'AND date(v.date_vente) >= date(?) ';
        params.push(debut);
      }
      if (fin) {
        where += 'AND date(v.date_vente) <= date(?) ';
        params.push(fin);
      }

      const res = calculerCloture(where, params);

      // Force les dates sur le rapport si renseignées et aucun ticket (pour un affichage cohérent)
      if (res.nbTickets === 0) {
        if (debut) res.dateDebut = `${debut}T00:00:00.000Z`;
        if (fin) res.dateFin = `${fin}T23:59:59.999Z`;
      }

      return res;
    } catch (err) {
      return { error: err.message, totalTTC:0, totalCash:0, totalMvola:0, totalOrange:0, totalAirtel:0, totalCarte:0, totalVirement:0, totalAutre:0, nbTickets:0, nbArticles:0, articlesDetail:'', dateDebut:'', dateFin:'' };
    }
  });

  // ── CLÔTURE Z ─────────────────────────────────────────────────────────
  ipcMain.handle('cloture:faireClotureZ', (e, data) => {
    try {
      const now    = new Date().toISOString();
      const numero = `Z-${now.slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-6)}`;
      const dernZ  = db.prepare(
        "SELECT fond_fin FROM clotures WHERE type_cloture='Z' ORDER BY id DESC LIMIT 1"
      ).get();
      const fondDebut = dernZ?.fond_fin || 0;
      const fondFin   = fondDebut + (data.totalCash || 0) - (data.prelevement || 0);

      const result = db.prepare(`
        INSERT INTO clotures (
          type_cloture, numero_rapport, date_debut, date_fin, date_cloture,
          total_ttc, total_cash, total_mvola, total_orange, total_airtel,
          total_carte, total_autre, nombre_tickets, nombre_articles,
          vendeur_nom, total_compte, prelevement, fond_debut, fond_fin, ecart, details_json
        ) VALUES (?, ?, ?, ?, datetime('now'),
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'Z', numero, data.dateDebut, data.dateFin,
        data.totalTTC||0, data.totalCash||0, data.totalMvola||0, data.totalOrange||0,
        data.totalAirtel||0, data.totalCarte||0,
        (data.totalVirement||0) + (data.totalAutre||0),
        data.nbTickets||0, data.nbArticles||0, data.vendeurNom||'',
        data.totalCompte||0, data.prelevement||0,
        fondDebut, fondFin,
        (data.totalCompte||0) - fondFin,
        JSON.stringify({ articles: data.articlesDetail, categories: data.categoriesDetail, offerts: data.offertsDetail, remises: data.remisesDetail })
      );

      return { success: true, id: result.lastInsertRowid, numero };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── DERNIÈRE CLÔTURE Z ────────────────────────────────────────────────
  ipcMain.handle('cloture:getDerniereZ', () => {
    return db.prepare(
      "SELECT * FROM clotures WHERE type_cloture='Z' ORDER BY id DESC LIMIT 1"
    ).get() || null;
  });

  // ── LISTE VENDEURS ────────────────────────────────────────────────────
  ipcMain.handle('cloture:getVendeurs', () => {
    const fromVentes = db.prepare(
      "SELECT DISTINCT nom_caissier as nom FROM ventes WHERE nom_caissier IS NOT NULL ORDER BY nom_caissier"
    ).all();
    const fromUsers = db.prepare(
      "SELECT nom FROM utilisateurs WHERE actif=1 ORDER BY nom"
    ).all();
    const all = new Set([...fromVentes.map(v => v.nom), ...fromUsers.map(u => u.nom)]);
    return Array.from(all).sort();
  });
};
