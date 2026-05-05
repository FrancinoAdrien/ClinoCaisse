'use strict';
const { logAction } = require('./journal.ipc');
// Session en mémoire (process principal)
let session = null;

module.exports = function(ipcMain, db) {

  // ── LOGIN ─────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', (e, pin) => {
    try {
      const user = db.prepare(`
        SELECT * FROM utilisateurs WHERE pin = ? AND actif = 1
      `).get(pin);

      if (!user) return { success: false, message: 'PIN incorrect ou utilisateur inactif' };

      // Charger le thème
      const theme = user.theme || 'default';

      const base = {
        id:               user.id,
        nom:              user.nom,
        prenom:           user.prenom,
        role:             user.role,
        theme,
        perm_caisse:      user.perm_caisse,
        perm_utilisateur: user.perm_utilisateur,
        perm_parametres:  user.perm_parametres,
        perm_cloture:     user.perm_cloture,
        perm_stock:       user.perm_stock,
        perm_remises:     user.perm_remises,
        perm_grossiste:   user.perm_grossiste,
        perm_depenses:    user.perm_depenses,
        perm_ressources:  user.perm_ressources,
        perm_achats:      user.perm_achats,
        perm_reserv:      user.perm_reserv,
      };
      if (user.role === 'admin') {
        session = {
          ...base,
          perm_caisse: 1, perm_utilisateur: 1, perm_parametres: 1, perm_cloture: 1,
          perm_stock: 1, perm_remises: 1, perm_grossiste: 1, perm_depenses: 1,
          perm_ressources: 1, perm_achats: 1, perm_reserv: 1,
        };
      } else {
        session = base;
      }

      logAction(db, {
        categorie: 'AUTH',
        action: 'Connexion',
        detail: `${user.nom}${user.prenom ? ' ' + user.prenom : ''} (${user.role})`,
        operateur: user.nom,
        icone: '🔐'
      });

      return { success: true, user: session };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── LOGOUT ────────────────────────────────────────────────────────────
  ipcMain.handle('auth:logout', () => {
    const operateur = session ? session.nom : null;
    logAction(db, {
      categorie: 'AUTH',
      action: 'Déconnexion',
      detail: operateur ? `${operateur} s'est déconnecté` : 'Déconnexion',
      operateur,
      icone: '🔓'
    });
    session = null;
    return { success: true };
  });

  // ── GET SESSION ───────────────────────────────────────────────────────
  ipcMain.handle('auth:getSession', () => {
    return session;
  });
};

module.exports.getSession = () => session;
