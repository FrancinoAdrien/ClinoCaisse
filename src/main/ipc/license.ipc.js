'use strict';

const LicenseManager = require('../license');

module.exports = function(ipcMain, db, syncEngine) {

  // ── Récupérer le statut actuel ──────────────────────────────────────────
  ipcMain.handle('license:status', (e) => {
    return LicenseManager.getStatus(db);
  });

  // ── Activer avec une clé (mois courant ou futur) ────────────────────────
  ipcMain.handle('license:activate', (e, key) => {
    const res = LicenseManager.activate(db, key);
    if (res.success && syncEngine) {
      syncEngine.notifyChange(); // Push vers Supabase
    }
    return res;
  });

  // ── Générer la clé du jour (admin seulement) ────────────────────────────
  ipcMain.handle('license:generate-key', (e) => {
    try {
      const key = LicenseManager.generateTodayKey(db);
      return { success: true, key };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── Synchroniser avec Supabase ──────────────────────────────────────────
  ipcMain.handle('license:sync', async (e) => {
    if (!syncEngine || !syncEngine.configured) {
      return { success: false, message: 'Cloud non configuré.' };
    }
    try {
      const res = await syncEngine.pullUpdates();
      if (res.success) {
        const status = LicenseManager.getStatus(db);
        if (status.status === 'activated_monthly') {
          return { success: true, message: 'Licence mensuelle détectée dans le cloud !' };
        } else {
          return { success: false, message: 'Aucune licence active trouvée dans le cloud.' };
        }
      }
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── Vérification du statut en temps réel (appelé côté renderer) ─────────
  // Le renderer peut demander un check rapide sans refaire un pull complet
  ipcMain.handle('license:check-realtime', (e) => {
    const status = LicenseManager.getStatus(db);
    return status;
  });

};
