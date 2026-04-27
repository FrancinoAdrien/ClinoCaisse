'use strict';
const { logAction } = require('./journal.ipc');

const PERM_COLS = 'perm_caisse, perm_utilisateur, perm_parametres, perm_cloture, perm_stock, perm_remises, perm_grossiste, perm_depenses, perm_ressources, perm_achats, perm_reserv';

function permValues(data) {
  if ((data.role || '') === 'admin') {
    return [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  }
  return [
    data.perm_caisse ? 1 : 0,
    data.perm_utilisateur ? 1 : 0,
    data.perm_parametres ? 1 : 0,
    data.perm_cloture ? 1 : 0,
    data.perm_stock ? 1 : 0,
    data.perm_remises ? 1 : 0,
    data.perm_grossiste ? 1 : 0,
    data.perm_depenses ? 1 : 0,
    data.perm_ressources ? 1 : 0,
    data.perm_achats ? 1 : 0,
    data.perm_reserv ? 1 : 0,
  ];
}

module.exports = function(ipcMain, db) {

  ipcMain.handle('utilisateurs:getAll', () => {
    return db.prepare(`SELECT id,nom,prenom,role,actif,theme,${PERM_COLS},date_creation FROM utilisateurs ORDER BY nom`).all();
  });

  ipcMain.handle('utilisateurs:getActifs', () => {
    return db.prepare(`SELECT id,nom,prenom,role,actif,theme,${PERM_COLS} FROM utilisateurs WHERE actif = 1 ORDER BY nom`).all();
  });

  ipcMain.handle('utilisateurs:create', (e, data) => {
    try {
      if (!data.nom || !data.pin) return { success: false, message: 'Nom et PIN requis' };
      if (!/^\d{4}$/.test(data.pin)) return { success: false, message: 'Le PIN doit être 4 chiffres' };
      
      const existPin = db.prepare('SELECT id FROM utilisateurs WHERE pin = ? AND actif = 1').get(data.pin);
      if (existPin) return { success: false, message: 'Ce PIN est déjà utilisé' };

      const { randomUUID } = require('crypto');
      const pv = permValues(data);
      const result = db.prepare(`
        INSERT INTO utilisateurs (uuid, nom, prenom, pin, role, last_modified_at, sync_status, ${PERM_COLS})
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(), data.nom, data.prenom || null, data.pin, data.role || 'employe', Date.now(),
        ...pv
      );

      logAction(db, {
        categorie: 'UTILISATEUR',
        action: 'Utilisateur créé',
        detail: `${data.nom}${data.prenom ? ' ' + data.prenom : ''} — Rôle: ${data.role || 'employe'}`,
        icone: '👥'
      });

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
      const pv = permValues(data);
      db.prepare(`
        UPDATE utilisateurs SET
          nom = ?, prenom = ?, role = ?,
          perm_caisse = ?, perm_utilisateur = ?, perm_parametres = ?,
          perm_cloture = ?, perm_stock = ?, perm_remises = ?,
          perm_grossiste = ?, perm_depenses = ?, perm_ressources = ?,
          perm_achats = ?, perm_reserv = ?,
          date_modification = datetime('now'),
          last_modified_at = ?, sync_status = 0
          ${data.pin ? ', pin = ?' : ''}
        WHERE id = ? OR uuid = ?
      `).run(
        data.nom, data.prenom || null, data.role || 'employe',
        ...pv,
        Date.now(),
        ...(data.pin ? [data.pin] : []),
        id, id
      );

      logAction(db, {
        categorie: 'UTILISATEUR',
        action: 'Utilisateur modifié',
        detail: `${data.nom}${data.prenom ? ' ' + data.prenom : ''} — Rôle: ${data.role || 'employe'}`,
        icone: '✏️'
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('utilisateurs:desactiver', (e, id) => {
    try {
      const admin = db.prepare("SELECT COUNT(*) as n FROM utilisateurs WHERE role='admin' AND actif=1").get().n;
      const user = db.prepare("SELECT role, nom FROM utilisateurs WHERE id = ? OR uuid = ?").get(id, id);
      if (user?.role === 'admin' && admin <= 1) return { success: false, message: 'Impossible de désactiver le dernier administrateur' };
      db.prepare("UPDATE utilisateurs SET actif = 0, last_modified_at = ?, sync_status = 0 WHERE id = ? OR uuid = ?").run(Date.now(), id, id);

      logAction(db, {
        categorie: 'UTILISATEUR',
        action: 'Utilisateur désactivé',
        detail: user ? `${user.nom}` : `ID ${id}`,
        icone: '🚫'
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('utilisateurs:reactiver', (e, id) => {
    try {
      const user = db.prepare('SELECT nom FROM utilisateurs WHERE id = ? OR uuid = ?').get(id, id);
      db.prepare("UPDATE utilisateurs SET actif = 1, last_modified_at = ?, sync_status = 0 WHERE id = ? OR uuid = ?").run(Date.now(), id, id);

      logAction(db, {
        categorie: 'UTILISATEUR',
        action: 'Utilisateur réactivé',
        detail: user ? `${user.nom}` : `ID ${id}`,
        icone: '✅'
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
