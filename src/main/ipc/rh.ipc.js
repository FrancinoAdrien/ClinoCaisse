'use strict';
const { logAction } = require('./journal.ipc');
const { notifyChange } = require('../sync/notifier');

module.exports = function(ipcMain, db) {

  // Helper: ajuster le capital
  function adjustCapital(delta) {
    const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'finance.capital'").get();
    const current = parseFloat(row?.valeur || '0');
    db.prepare("INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status) VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = 'finance.capital'), lower(hex(randomblob(16)))), 'finance.capital', ?, datetime('now'), ?, 0)")
      .run(String(current + delta), Date.now());
  }


  // Stats Globales RH
  ipcMain.handle('rh:getStats', async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      const nbEmp = db.prepare('SELECT COUNT(*) as n FROM employes WHERE actif = 1').get();
      
      // Masse salariale théorique (en considérant les premiers salaires)
      const employes = db.prepare('SELECT * FROM employes WHERE actif = 1').all();
      let masseSalariale = 0;
      let resteAPayer = 0;
      let totalAvancesMois = 0;

      for (const emp of employes) {
        let salaireDu = emp.salaire_base;
        if (emp.premier_mois_paye === 0) {
           salaireDu = emp.mode_premier_salaire === 'ce_mois' ? emp.montant_premier_salaire : 0;
        }
        masseSalariale += salaireDu;

        // A-t-il été payé ce mois-ci ?
        const paye = db.prepare(`
          SELECT COUNT(*) as c FROM salaires_paiements 
          WHERE employe_uuid = ? AND type_paiement = 'Salaire' AND strftime('%Y-%m', date_paiement) = ?
        `).get(emp.uuid, currentMonth);

        if (!paye || paye.c === 0) {
          // Non payé, on calcule le net (Salaire - Avances non déduites)
          // On cherche la date du dernier paiement de "Salaire"
          const lastSalaire = db.prepare(`
            SELECT date_paiement FROM salaires_paiements 
            WHERE employe_uuid = ? AND type_paiement = 'Salaire' 
            ORDER BY date_paiement DESC LIMIT 1
          `).get(emp.uuid);
          
          let dateDepuis = emp.date_embauche;
          if (lastSalaire) dateDepuis = lastSalaire.date_paiement;

          const avances = db.prepare(`
            SELECT COALESCE(SUM(montant), 0) as t 
            FROM salaires_paiements 
            WHERE employe_uuid = ? AND type_paiement = 'Avance' AND date(date_paiement) >= date(?)
          `).get(emp.uuid, dateDepuis);

          let net = salaireDu - (avances?.t || 0);
          if (net < 0) net = 0;
          resteAPayer += net;
        }
      }

      // Avances du mois en cours
      const avancesMoisQuery = db.prepare(`
        SELECT COALESCE(SUM(montant), 0) as t 
        FROM salaires_paiements 
        WHERE type_paiement = 'Avance' AND strftime('%Y-%m', date_paiement) = ?
      `).get(currentMonth);

      return {
        nb_employes: nbEmp?.n || 0,
        masse_salariale: masseSalariale,
        avances_mois: avancesMoisQuery?.t || 0,
        reste_a_payer_mois: resteAPayer
      };
    } catch (e) {
      console.error('IPC rh:getStats error:', e.message);
      throw e;
    }
  });

  // Liste des employés avec leur statut de paie ce mois-ci
  ipcMain.handle('rh:getSalairesAPayer', async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const employes = db.prepare('SELECT * FROM employes WHERE actif = 1 ORDER BY nom ASC').all();
      
      const resultat = [];
      for (const emp of employes) {
        let salaireBaseEffective = emp.salaire_base;
        if (emp.premier_mois_paye === 0) {
           salaireBaseEffective = emp.mode_premier_salaire === 'ce_mois' ? emp.montant_premier_salaire : 0;
        }

        const paye = db.prepare(`
          SELECT COUNT(*) as c FROM salaires_paiements 
          WHERE employe_uuid = ? AND type_paiement = 'Salaire' AND strftime('%Y-%m', date_paiement) = ?
        `).get(emp.uuid, currentMonth);

        const estPaye = (paye && paye.c > 0);

        const lastSalaire = db.prepare(`
          SELECT date_paiement FROM salaires_paiements 
          WHERE employe_uuid = ? AND type_paiement = 'Salaire' 
          ORDER BY date_paiement DESC LIMIT 1
        `).get(emp.uuid);
        
        let dateDepuis = emp.date_embauche;
        if (lastSalaire) dateDepuis = lastSalaire.date_paiement;

        const avances = db.prepare(`
          SELECT COALESCE(SUM(montant), 0) as t 
          FROM salaires_paiements 
          WHERE employe_uuid = ? AND type_paiement = 'Avance' AND date(date_paiement) >= date(?)
        `).get(emp.uuid, dateDepuis);

        const totalAvances = avances?.t || 0;
        let net = estPaye ? 0 : (salaireBaseEffective - totalAvances);
        if (net < 0) net = 0;

        resultat.push({
          ...emp,
          salaire_effectif: salaireBaseEffective,
          total_avances: totalAvances,
          net_a_payer: net,
          est_paye_ce_mois: estPaye
        });
      }
      return resultat;
    } catch (e) {
      console.error('IPC rh:getSalairesAPayer error:', e.message);
      throw e;
    }
  });

  // Liste des employés
  ipcMain.handle('rh:getEmployes', async () => {
    try {
      return db.prepare('SELECT * FROM employes ORDER BY nom ASC').all();
    } catch (e) {
      console.error('IPC rh:getEmployes error:', e.message);
      throw e;
    }
  });

  // Liste des paiements/salaires
  ipcMain.handle('rh:getSalaires', async (event, limit = 50) => {
    try {
      return db.prepare(`
        SELECT sp.*, e.nom as emp_nom 
        FROM salaires_paiements sp 
        LEFT JOIN employes e ON sp.employe_uuid = e.uuid 
        ORDER BY date_paiement DESC LIMIT ?
      `).all(limit);
    } catch (e) {
      console.error('IPC rh:getSalaires error:', e.message);
      throw e;
    }
  });

  // Ajouter un employé
  ipcMain.handle('rh:addEmploye', async (event, data) => {
    try {
      const { uuid, nom, poste, salaire_base, date_embauche, mode_premier_salaire, montant_premier_salaire } = data;
      const result = db.prepare(`
        INSERT INTO employes (uuid, nom, poste, salaire_base, date_embauche, mode_premier_salaire, montant_premier_salaire, premier_mois_paye, last_modified_at, sync_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1)
      `).run(uuid, nom, poste, salaire_base, date_embauche, mode_premier_salaire || 'ce_mois', montant_premier_salaire || 0, Date.now());

      logAction(db, {
        categorie: 'RH',
        action: 'Employé ajouté',
        detail: `${nom} — ${poste || 'Poste non défini'} — Salaire: ${salaire_base} Ar`,
        montant: salaire_base || 0,
        icone: '👤'
      });
      notifyChange();
      return result;
    } catch (e) {
      console.error('IPC rh:addEmploye error:', e.message);
      throw e;
    }
  });

  // Modifier un employé
  ipcMain.handle('rh:updateEmploye', async (event, data) => {
    try {
      const { uuid, nom, poste, salaire_base, date_embauche, actif } = data;
      return db.prepare(`
        UPDATE employes 
        SET nom = ?, poste = ?, salaire_base = ?, date_embauche = ?, actif = ?, last_modified_at = ?, sync_status = 1
        WHERE uuid = ?
      `).run(nom, poste, salaire_base, date_embauche, actif, Date.now(), uuid);
    } catch (e) {
      console.error('IPC rh:updateEmploye error:', e.message);
      throw e;
    }
  });

  // Calculer le salaire net (Salaire Effectif - Avances non déduites)
  ipcMain.handle('rh:getEmployeeNetSalary', async (event, uuid) => {
    try {
      const emp = db.prepare('SELECT * FROM employes WHERE uuid = ?').get(uuid);
      if (!emp) return 0;
      
      let salaireEffectif = emp.salaire_base;
      if (emp.premier_mois_paye === 0) {
         salaireEffectif = emp.mode_premier_salaire === 'ce_mois' ? emp.montant_premier_salaire : 0;
      }

      const lastSalaire = db.prepare(`
        SELECT date_paiement FROM salaires_paiements 
        WHERE employe_uuid = ? AND type_paiement = 'Salaire' 
        ORDER BY date_paiement DESC LIMIT 1
      `).get(uuid);
      
      let dateDepuis = emp.date_embauche;
      if (lastSalaire) dateDepuis = lastSalaire.date_paiement;

      const avances = db.prepare(`
        SELECT COALESCE(SUM(montant), 0) as t 
        FROM salaires_paiements 
        WHERE employe_uuid = ? AND type_paiement = 'Avance' AND date(date_paiement) >= date(?)
      `).get(uuid, dateDepuis);

      let net = salaireEffectif - (avances?.t || 0);
      return net < 0 ? 0 : net;
    } catch (e) {
      console.error('IPC rh:getEmployeeNetSalary error:', e.message);
      throw e;
    }
  });

  // Supprimer un paiement (annulation) → restituer au capital
  ipcMain.handle('rh:deletePaiement', async (event, uuid) => {
    try {
      const pmt = db.prepare('SELECT montant, type_paiement, operateur, employe_uuid FROM salaires_paiements WHERE uuid = ?').get(uuid);
      const result = db.prepare('DELETE FROM salaires_paiements WHERE uuid = ?').run(uuid);
      
      if (pmt?.montant) adjustCapital(pmt.montant);

      // Si on annule un salaire, on doit potentiellement re-basculer premier_mois_paye à 0 si c'était le premier
      // Mais c'est complexe sans historique. En général, on peut vérifier combien de salaires restent.
      if (pmt?.type_paiement === 'Salaire') {
         const count = db.prepare("SELECT COUNT(*) as c FROM salaires_paiements WHERE employe_uuid = ? AND type_paiement = 'Salaire'").get(pmt.employe_uuid);
         if (count.c === 0) {
            db.prepare('UPDATE employes SET premier_mois_paye = 0 WHERE uuid = ?').run(pmt.employe_uuid);
         }
      }

      logAction(db, {
        categorie: 'RH',
        action: 'Paiement annulé',
        detail: `Annulation ${pmt?.type_paiement || 'paiement'} — ${pmt?.montant || 0} Ar`,
        operateur: pmt?.operateur || null,
        montant: pmt?.montant || 0,
        icone: '↩️'
      });

      return result;
    } catch (e) {
      console.error('IPC rh:deletePaiement error:', e.message);
      throw e;
    }
  });

  // Ajouter un paiement (salaire ou avance) → déduire du capital
  ipcMain.handle('rh:addPaiement', async (event, data) => {
    try {
      const { uuid, employe_uuid, type_paiement, montant, date_paiement, operateur } = data;
      db.prepare(`
        INSERT INTO salaires_paiements (uuid, employe_uuid, type_paiement, montant, date_paiement, operateur, last_modified_at, sync_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(uuid, employe_uuid, type_paiement, montant, date_paiement, operateur, Date.now());
      
      // Déduire du capital (salaire + avance = sortie d'argent)
      if (montant > 0) adjustCapital(-montant);

      // Si c'est un salaire, on met à jour le fait que le premier mois est payé
      if (type_paiement === 'Salaire') {
         db.prepare('UPDATE employes SET premier_mois_paye = 1 WHERE uuid = ?').run(employe_uuid);
      }

      const emp = db.prepare('SELECT nom FROM employes WHERE uuid = ?').get(employe_uuid);
      logAction(db, {
        categorie: 'RH',
        action: type_paiement === 'Avance' ? 'Avance employé' : 'Salaire payé',
        detail: `${emp ? emp.nom : employe_uuid} — ${type_paiement}`,
        operateur,
        montant,
        icone: type_paiement === 'Avance' ? '💳' : '💵'
      });
      notifyChange();
      return { success: true };
    } catch (e) {
      console.error('IPC rh:addPaiement error:', e.message);
      throw e;
    }
  });
};

