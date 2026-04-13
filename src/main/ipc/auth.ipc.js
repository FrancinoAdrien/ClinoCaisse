'use strict';
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

      session = {
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
      };

      return { success: true, user: session };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── LOGOUT ────────────────────────────────────────────────────────────
  ipcMain.handle('auth:logout', () => {
    session = null;
    return { success: true };
  });

  // ── GET SESSION ───────────────────────────────────────────────────────
  ipcMain.handle('auth:getSession', () => {
    return session;
  });
};
