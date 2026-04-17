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

  // ── STATS GLOBALES ─────────────────────────────────────────────────────────
  ipcMain.handle('finances:getStats', async () => {
    try {
      const firstDay = new Date().toISOString().slice(0, 7) + '-01';

      const depMois = db.prepare(
        "SELECT COALESCE(SUM(montant), 0) as t FROM depenses WHERE date(date_depense) >= ? AND statut = 'payee'"
      ).get(firstDay);

      // Recettes du mois = montant réellement payé des ventes (cash + partiel) + créances encaissées
      const ventesMois = db.prepare(
        "SELECT COALESCE(SUM(COALESCE(montant_paye, total_ttc)), 0) as t FROM ventes WHERE date(date_vente) >= ? AND statut = 'valide'"
      ).get(firstDay);

      const creancesEnc = db.prepare(
        "SELECT COALESCE(SUM(montant), 0) as t FROM creances_clients WHERE statut = 'encaissee' AND date(date_creation) >= ?"
      ).get(firstDay);

      // Total dettes fournisseurs (commandes non payées)
      const dettes = db.prepare(
        "SELECT COALESCE(SUM(montant), 0) as t FROM depenses WHERE statut = 'commande'"
      ).get();

      // Bénéfice des ventes (mois) = Somme des (lv.quantite * (lv.prix_unitaire - p.prix_achat))
      const beneficeVentes = db.prepare(`
        SELECT COALESCE(SUM(lv.quantite * (lv.prix_unitaire - COALESCE(p.prix_achat, 0))), 0) as t
        FROM lignes_vente lv
        JOIN produits p ON lv.produit_id = p.id
        JOIN ventes v ON lv.vente_id = v.id
        WHERE v.statut = 'valide' AND date(v.date_vente) >= ?
      `).get(firstDay);

      // Valeur des pertes (mois) = Somme des (ABS(delta) * p.prix_achat) pour delta < 0
      const pertesMois = db.prepare(`
        SELECT COALESCE(SUM(ABS(sh.delta) * COALESCE(p.prix_achat, 0)), 0) as t
        FROM stock_historique sh
        JOIN produits p ON sh.produit_id = p.id
        WHERE sh.delta < 0 AND date(sh.date_op) >= ?
      `).get(firstDay);

      // Bénéfice Net = Bénéfice Ventes - Valeur Pertes
      const beneficeNet = (beneficeVentes?.t || 0) - (pertesMois?.t || 0);

      // Total créances clients (ce que les clients nous doivent)
      const creances = db.prepare(
        "SELECT COALESCE(SUM(montant), 0) as t FROM creances_clients WHERE statut = 'en_attente'"
      ).get();

      // Capital
      const capitalRow = db.prepare("SELECT valeur FROM parametres WHERE cle = 'finance.capital'").get();
      const capital = parseFloat(capitalRow?.valeur || '0');

      return {
        depenses_mois: depMois?.t || 0,
        recettes_mois: (ventesMois?.t || 0) + (creancesEnc?.t || 0),
        benefice_mois: beneficeNet,
        dettes_total: dettes?.t || 0,
        creances_total: creances?.t || 0,
        capital
      };
    } catch (e) {
      console.error('IPC finances:getStats error:', e.message);
      throw e;
    }
  });

  // ── CAPITAL ────────────────────────────────────────────────────────────────
  ipcMain.handle('finances:getCapital', async () => {
    try {
      const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'finance.capital'").get();
      return parseFloat(row?.valeur || '0');
    } catch (e) {
      console.error('IPC finances:getCapital error:', e.message);
      throw e;
    }
  });

  ipcMain.handle('finances:setCapital', async (event, montant) => {
    try {
      db.prepare("INSERT OR REPLACE INTO parametres (cle, valeur, date_maj) VALUES ('finance.capital', ?, datetime('now'))")
        .run(String(montant));
      return { success: true };
    } catch (e) {
      console.error('IPC finances:setCapital error:', e.message);
      throw e;
    }
  });

  ipcMain.handle('finances:addFlux', async (event, data) => {
    try {
      const { type_flux, montant, motif, operateur } = data;
      const uuid = randomUUID();
      const delta = type_flux === 'ajout_capital' ? montant : -montant;
      
      db.transaction(() => {
        db.prepare(`
          INSERT INTO flux_tresorerie (uuid, type_flux, montant, motif, date_flux, operateur, last_modified_at, sync_status)
          VALUES (?, ?, ?, ?, datetime('now'), ?, ?, 1)
        `).run(uuid, type_flux, montant, motif, operateur, Date.now());
        
        adjustCapital(delta);
      })();

      logAction(db, {
        categorie: 'FINANCE',
        action: type_flux === 'ajout_capital' ? 'Ajout capital' : 'Retrait capital',
        detail: motif || type_flux,
        operateur,
        montant,
        icone: type_flux === 'ajout_capital' ? '⬆️' : '⬇️'
      });
      
      return { success: true };
    } catch (e) {
      console.error('IPC finances:addFlux error:', e.message);
      throw e;
    }
  });

  // ── DÉPENSES & COMMANDES ──────────────────────────────────────────────────
  ipcMain.handle('finances:getDepenses', async (event, limit = 100) => {
    try {
      return db.prepare('SELECT * FROM depenses ORDER BY date_depense DESC LIMIT ?').all(limit);
    } catch (e) {
      console.error('IPC finances:getDepenses error:', e.message);
      throw e;
    }
  });

  ipcMain.handle('finances:getDettes', async () => {
    try {
      return db.prepare(
        "SELECT * FROM depenses WHERE statut = 'commande' ORDER BY date_depense DESC"
      ).all();
    } catch (e) {
      console.error('IPC finances:getDettes error:', e.message);
      throw e;
    }
  });

  // Commander une dépense (crée une dette — pas de déduction capital)
  ipcMain.handle('finances:commander', async (event, data) => {
    try {
      const { uuid, categorie, description, montant, fournisseur_nom, date_depense, operateur } = data;
      db.prepare(`
        INSERT INTO depenses (uuid, categorie, description, montant, fournisseur_nom, date_depense, statut, operateur, last_modified_at, sync_status) 
        VALUES (?, ?, ?, ?, ?, ?, 'commande', ?, ?, 1)
      `).run(uuid, categorie, description, montant, fournisseur_nom || '', date_depense, operateur, Date.now());

      logAction(db, {
        categorie: 'FINANCE',
        action: 'Commande enregistrée',
        detail: `${description || categorie}${fournisseur_nom ? ' — ' + fournisseur_nom : ''}`,
        operateur,
        montant,
        icone: '📋'
      });

      return { success: true };
    } catch (e) {
      console.error('IPC finances:commander error:', e.message);
      throw e;
    }
  });

  // Payer une dépense commandée → déduire du capital
  ipcMain.handle('finances:payerDepense', async (event, uuid) => {
    try {
      const dep = db.prepare("SELECT montant, description, operateur FROM depenses WHERE uuid = ?").get(uuid);
      db.prepare("UPDATE depenses SET statut = 'payee', last_modified_at = ? WHERE uuid = ?")
        .run(Date.now(), uuid);
      if (dep?.montant) adjustCapital(-dep.montant);

      logAction(db, {
        categorie: 'FINANCE',
        action: 'Dépense payée',
        detail: dep?.description || uuid,
        operateur: dep?.operateur || null,
        montant: dep?.montant || 0,
        icone: '💸'
      });

      return { success: true };
    } catch (e) {
      console.error('IPC finances:payerDepense error:', e.message);
      throw e;
    }
  });

  // Ajouter une dépense directement payée → déduire du capital
  ipcMain.handle('finances:addDepense', async (event, data) => {
    try {
      const { uuid, categorie, description, montant, date_depense, operateur } = data;
      db.prepare(`
        INSERT INTO depenses (uuid, categorie, description, montant, date_depense, statut, operateur, last_modified_at, sync_status) 
        VALUES (?, ?, ?, ?, ?, 'payee', ?, ?, 1)
      `).run(uuid, categorie, description, montant, date_depense, operateur, Date.now());
      adjustCapital(-montant);

      logAction(db, {
        categorie: 'FINANCE',
        action: 'Dépense directe',
        detail: `${description || categorie}`,
        operateur,
        montant,
        icone: '💰'
      });

      return { success: true };
    } catch (e) {
      console.error('IPC finances:addDepense error:', e.message);
      throw e;
    }
  });

  // ── RECETTES ───────────────────────────────────────────────────────────────
  ipcMain.handle('finances:getRecettes', async (event, limit = 50) => {
    try {
      return db.prepare(`
        SELECT 
          numero_ticket, date_vente, nom_caissier, total_ttc,
          COALESCE(montant_paye, total_ttc) as montant_paye,
          mode_paiement, type_vente, client_uuid
        FROM ventes 
        WHERE statut = 'valide'
        ORDER BY date_vente DESC LIMIT ?
      `).all(limit);
    } catch (e) {
      console.error('IPC finances:getRecettes error:', e.message);
      throw e;
    }
  });

  // ── CRÉANCES CLIENTS ──────────────────────────────────────────────────────
  ipcMain.handle('finances:getCreances', async () => {
    try {
      return db.prepare('SELECT * FROM creances_clients ORDER BY date_creation DESC').all();
    } catch (e) {
      console.error('IPC finances:getCreances error:', e.message);
      throw e;
    }
  });

  ipcMain.handle('finances:addCreance', async (event, data) => {
    try {
      const { uuid, client_nom, montant, description, date_echeance, operateur } = data;
      db.prepare(`
        INSERT INTO creances_clients (uuid, client_nom, montant, description, date_creation, date_echeance, statut, operateur, last_modified_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, 'en_attente', ?, ?, 1)
      `).run(uuid, client_nom, montant, description || '', new Date().toISOString().slice(0,10), date_echeance || '', operateur, Date.now());

      logAction(db, {
        categorie: 'FINANCE',
        action: 'Créance ajoutée',
        detail: `${client_nom}: ${description || ''}`,
        operateur,
        montant,
        icone: '📄'
      });

      return { success: true };
    } catch (e) {
      console.error('IPC finances:addCreance error:', e.message);
      throw e;
    }
  });

  // Encaisser une créance → ajouter au capital
  ipcMain.handle('finances:encaisserCreance', async (event, uuid) => {
    try {
      const cr = db.prepare("SELECT montant, client_nom FROM creances_clients WHERE uuid = ?").get(uuid);
      db.prepare("UPDATE creances_clients SET statut = 'encaissee', last_modified_at = ? WHERE uuid = ?")
        .run(Date.now(), uuid);
      if (cr?.montant) adjustCapital(cr.montant);

      logAction(db, {
        categorie: 'FINANCE',
        action: 'Créance encaissée',
        detail: cr?.client_nom || uuid,
        montant: cr?.montant || 0,
        icone: '✅'
      });

      return { success: true };
    } catch (e) {
      console.error('IPC finances:encaisserCreance error:', e.message);
      throw e;
    }
  });

  // ── MOUVEMENTS ─────────────────────────────────────────────────────────────
  ipcMain.handle('finances:getMouvements', async (event, limit = 100) => {
    try {
      // Entrées = ventes valides (montant réellement encaissé)
      const entrees = db.prepare(`
        SELECT 'entree' as sens,
               CASE WHEN type_vente = 'GROSSISTE' THEN 'Vente Grossiste'
                    ELSE 'Vente ' || COALESCE(type_vente, 'BAR') END as libelle,
               COALESCE(montant_paye, total_ttc) as montant,
               date_vente as date_op,
               COALESCE(mode_paiement, 'CASH') as detail
        FROM ventes
        WHERE statut = 'valide' AND COALESCE(montant_paye, total_ttc) > 0
      `).all();

      // Sorties = dépenses payées
      const sorties = db.prepare(`
        SELECT 'sortie' as sens, COALESCE(categorie, 'Dépense') as libelle,
               montant, date_depense as date_op,
               COALESCE(description, '') as detail
        FROM depenses WHERE statut = 'payee'
      `).all();

      // Sorties = paiements salaires & avances
      const salaires = db.prepare(`
        SELECT 'sortie' as sens,
               CASE type_paiement WHEN 'Avance' THEN 'Avance employé' ELSE 'Salaire employé' END as libelle,
               montant, date_paiement as date_op, operateur as detail
        FROM salaires_paiements
      `).all();

      // Entrées = créances encaissées
      const creancesEnc = db.prepare(`
        SELECT 'entree' as sens, 'Créance encaissée' as libelle,
               montant, date_creation as date_op, client_nom as detail
        FROM creances_clients WHERE statut = 'encaissee'
      `).all();

      // Entrées = paiements dettes clients grossiste
      const paiements = db.prepare(`
        SELECT 'entree' as sens, 'Paiement dette client Grossiste' as libelle,
               montant, date_paiement as date_op, operateur as detail
        FROM credits_paiements WHERE type_operation = 'remboursement'
      `).all();

      // Pertes = ajustements de stock négatifs (valeur financière)
      const pertes = db.prepare(`
        SELECT 'perte' as sens, 'Perte de stock: ' || sh.produit_nom as libelle,
               ABS(sh.delta) * COALESCE(p.prix_achat, 0) as montant, 
               COALESCE(sh.date_op, datetime('now')) as date_op, 
               'Motif: ' || COALESCE(sh.motif, '-') as detail
        FROM stock_historique sh
        JOIN produits p ON sh.produit_id = p.id
        WHERE sh.delta < 0
      `).all();

      // Flux de capital (ajouts/retraits)
      const flux = db.prepare(`
        SELECT 
          CASE WHEN type_flux = 'ajout_capital' THEN 'entree' ELSE 'sortie' END as sens,
          'Mouvement Capital: ' || motif as libelle,
          montant,
          date_flux as date_op,
          operateur as detail
        FROM flux_tresorerie
      `).all();

      // Combiner et trier par date desc
      const all = [...entrees, ...sorties, ...salaires, ...creancesEnc, ...paiements, ...pertes, ...flux]
        .filter(m => m.date_op) // Sécurité
        .sort((a, b) => b.date_op.localeCompare(a.date_op));
      return all.slice(0, Math.max(limit, all.length)); // On retourne tout si on cherche vraiment les derniers, mais respectons la limite si fournie
    } catch (e) {
      console.error('IPC finances:getMouvements error:', e.message);
      throw e;
    }
  });

  // (Gardé pour rétrocompatibilité)
  ipcMain.handle('finances:getAchats', async (event, limit = 50) => {
    try {
      return db.prepare(`
        SELECT a.*, f.nom as fournisseur_nom 
        FROM achats a 
        LEFT JOIN fournisseurs f ON a.fournisseur_uuid = f.uuid 
        ORDER BY date_achat DESC LIMIT ?
      `).all(limit);
    } catch (e) {
      console.error('IPC finances:getAchats error:', e.message);
      throw e;
    }
  });

  ipcMain.handle('finances:addAchat', async (event, data) => {
    try {
      const { uuid, fournisseur_uuid, total_ttc, statut, date_achat } = data;
      db.transaction(() => {
        db.prepare(`
          INSERT INTO achats (uuid, fournisseur_uuid, total_ttc, statut, date_achat, last_modified_at, sync_status) 
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(uuid, fournisseur_uuid, total_ttc, statut, date_achat, Date.now());
        if (statut === 'non_paye' && fournisseur_uuid) {
          db.prepare('UPDATE fournisseurs SET dettes_actuelles = dettes_actuelles + ? WHERE uuid = ?')
            .run(total_ttc, fournisseur_uuid);
        }
      })();
      return { success: true };
    } catch (e) {
      console.error('IPC finances:addAchat error:', e.message);
      throw e;
    }
  });

};
