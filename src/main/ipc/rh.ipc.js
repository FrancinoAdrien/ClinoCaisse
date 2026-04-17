'use strict';
const { logAction } = require('./journal.ipc');

module.exports = function(ipcMain, db) {

  // Helper: ajuster le capital
  function adjustCapital(delta) {
    const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'finance.capital'").get();
    const current = parseFloat(row?.valeur || '0');
    db.prepare("INSERT OR REPLACE INTO parametres (cle, valeur, date_maj) VALUES ('finance.capital', ?, datetime('now'))")
      .run(String(current + delta));
  }


  // Stats Globales RH
  ipcMain.handle('rh:getStats', async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01'; // premier du mois
      
      const nbEmp = db.prepare('SELECT COUNT(*) as n FROM employes WHERE actif = 1').get();
      const masse = db.prepare('SELECT COALESCE(SUM(salaire_base), 0) as t FROM employes WHERE actif = 1').get();
      
      const avances = db.prepare(`
        SELECT COALESCE(SUM(montant), 0) as t 
        FROM salaires_paiements 
        WHERE type_paiement = 'Avance' AND date(date_paiement) >= ?
      `).get(currentMonth);

      const payeMois = db.prepare(`
        SELECT COALESCE(SUM(montant), 0) as t 
        FROM salaires_paiements 
        WHERE type_paiement = 'Salaire' AND date(date_paiement) >= ?
      `).get(currentMonth);

      const resteAPayer = (masse?.t || 0) - (payeMois?.t || 0);

      return {
        nb_employes: nbEmp?.n || 0,
        masse_salariale: masse?.t || 0,
        avances_mois: avances?.t || 0,
        reste_a_payer_mois: resteAPayer
      };
    } catch (e) {
      console.error('IPC rh:getStats error:', e.message);
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
      const { uuid, nom, poste, salaire_base, date_embauche } = data;
      const result = db.prepare(`
        INSERT INTO employes (uuid, nom, poste, salaire_base, date_embauche, last_modified_at, sync_status) 
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(uuid, nom, poste, salaire_base, date_embauche, Date.now());

      logAction(db, {
        categorie: 'RH',
        action: 'Employé ajouté',
        detail: `${nom} — ${poste || 'Poste non défini'} — Salaire: ${salaire_base} Ar`,
        montant: salaire_base || 0,
        icone: '👤'
      });

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

  // Calculer le salaire net (Salaire - Avances du mois)
  ipcMain.handle('rh:getEmployeeNetSalary', async (event, uuid) => {
    try {
      const emp = db.prepare('SELECT salaire_base FROM employes WHERE uuid = ?').get(uuid);
      if (!emp) return 0;
      
      const firstDayStr = new Date().toISOString().slice(0, 7) + '-01';
      const avances = db.prepare(`
        SELECT COALESCE(SUM(montant), 0) as t 
        FROM salaires_paiements 
        WHERE employe_uuid = ? AND type_paiement = 'Avance' AND date(date_paiement) >= ?
      `).get(uuid, firstDayStr);

      return emp.salaire_base - (avances?.t || 0);
    } catch (e) {
      console.error('IPC rh:getEmployeeNetSalary error:', e.message);
      throw e;
    }
  });

  // Supprimer un paiement (annulation) → restituer au capital
  ipcMain.handle('rh:deletePaiement', async (event, uuid) => {
    try {
      const pmt = db.prepare('SELECT montant, type_paiement, operateur FROM salaires_paiements WHERE uuid = ?').get(uuid);
      const result = db.prepare('DELETE FROM salaires_paiements WHERE uuid = ?').run(uuid);
      // Restituer le montant au capital
      if (pmt?.montant) adjustCapital(pmt.montant);

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

      const emp = db.prepare('SELECT nom FROM employes WHERE uuid = ?').get(employe_uuid);
      logAction(db, {
        categorie: 'RH',
        action: type_paiement === 'Avance' ? 'Avance employé' : 'Salaire payé',
        detail: `${emp ? emp.nom : employe_uuid} — ${type_paiement}`,
        operateur,
        montant,
        icone: type_paiement === 'Avance' ? '💳' : '💵'
      });

      return { success: true };
    } catch (e) {
      console.error('IPC rh:addPaiement error:', e.message);
      throw e;
    }
  });
};

