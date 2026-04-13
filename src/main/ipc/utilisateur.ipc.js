'use strict';

module.exports = function(ipcMain, db) {

  ipcMain.handle('utilisateurs:getAll', () => {
    return db.prepare('SELECT id,nom,prenom,role,actif,theme,perm_caisse,perm_utilisateur,perm_parametres,perm_cloture,perm_stock,perm_remises,date_creation FROM utilisateurs ORDER BY nom').all();
  });

  ipcMain.handle('utilisateurs:getActifs', () => {
    return db.prepare('SELECT id,nom,prenom,role,actif,theme,perm_caisse,perm_utilisateur,perm_parametres,perm_cloture,perm_stock,perm_remises FROM utilisateurs WHERE actif = 1 ORDER BY nom').all();
  });

  ipcMain.handle('utilisateurs:create', (e, data) => {
    try {
      if (!data.nom || !data.pin) return { success: false, message: 'Nom et PIN requis' };
      if (!/^\d{4}$/.test(data.pin)) return { success: false, message: 'Le PIN doit être 4 chiffres' };
      
      const existPin = db.prepare('SELECT id FROM utilisateurs WHERE pin = ? AND actif = 1').get(data.pin);
      if (existPin) return { success: false, message: 'Ce PIN est déjà utilisé' };

      const result = db.prepare(`
        INSERT INTO utilisateurs (nom, prenom, pin, role,
          perm_caisse, perm_utilisateur, perm_parametres, perm_cloture, perm_stock, perm_remises)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.nom, data.prenom || null, data.pin, data.role || 'vendeur',
        data.perm_caisse ? 1 : 0, data.perm_utilisateur ? 1 : 0,
        data.perm_parametres ? 1 : 0, data.perm_cloture ? 1 : 0,
        data.perm_stock ? 1 : 0, data.perm_remises ? 1 : 0
      );
      return { success: true, id: result.lastInsertRowid };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('utilisateurs:update', (e, id, data) => {
    try {
      if (data.pin && !/^\d{4}$/.test(data.pin)) return { success: false, message: 'PIN invalide' };
      if (data.pin) {
        const existPin = db.prepare('SELECT id FROM utilisateurs WHERE pin = ? AND actif = 1 AND id != ?').get(data.pin, id);
        if (existPin) return { success: false, message: 'Ce PIN est déjà utilisé' };
      }
      db.prepare(`
        UPDATE utilisateurs SET
          nom = ?, prenom = ?, role = ?,
          perm_caisse = ?, perm_utilisateur = ?, perm_parametres = ?,
          perm_cloture = ?, perm_stock = ?, perm_remises = ?,
          date_modification = datetime('now')
          ${data.pin ? ', pin = ?' : ''}
        WHERE id = ?
      `).run(
        data.nom, data.prenom || null, data.role || 'vendeur',
        data.perm_caisse ? 1 : 0, data.perm_utilisateur ? 1 : 0,
        data.perm_parametres ? 1 : 0, data.perm_cloture ? 1 : 0,
        data.perm_stock ? 1 : 0, data.perm_remises ? 1 : 0,
        ...(data.pin ? [data.pin] : []),
        id
      );
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('utilisateurs:desactiver', (e, id) => {
    try {
      const admin = db.prepare("SELECT COUNT(*) as n FROM utilisateurs WHERE role='admin' AND actif=1").get().n;
      const user = db.prepare("SELECT role FROM utilisateurs WHERE id=?").get(id);
      if (user?.role === 'admin' && admin <= 1) return { success: false, message: 'Impossible de désactiver le dernier administrateur' };
      db.prepare("UPDATE utilisateurs SET actif = 0 WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('utilisateurs:reactiver', (e, id) => {
    try {
      db.prepare("UPDATE utilisateurs SET actif = 1 WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
