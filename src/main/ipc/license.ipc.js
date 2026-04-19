'use strict';

const LicenseManager = require('../license');

module.exports = function(ipcMain, db, syncEngine) {

  // Récupérer le statut actuel
  ipcMain.handle('license:status', (e) => {
    return LicenseManager.getStatus(db);
  });

  // Tenter une activation avec une clé
  ipcMain.handle('license:activate', (e, key) => {
    const res = LicenseManager.activate(db, key);
    if (res.success && syncEngine) {
      syncEngine.notifyChange(); // Déclencher le push vers le cloud
    }
    return res;
  });

  // Synchroniser avec Supabase pour voir si activé ailleurs
  ipcMain.handle('license:sync', async (e) => {
    if (!syncEngine || !syncEngine.configured) {
      return { success: false, message: 'Cloud non configuré.' };
    }
    
    try {
      // On fait un pull des paramètres uniquement pour aller vite
      const res = await syncEngine.pullUpdates();
      if (res.success) {
        // Revérifier le statut local après le pull
        const status = LicenseManager.getStatus(db);
        if (status.status === 'activated') {
          return { success: true, message: 'Activation cloud détectée !' };
        } else {
          return { success: false, message: 'Aucune licence trouvée dans le cloud.' };
        }
      }
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

};
