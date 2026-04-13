'use strict';

module.exports = function(ipcMain, db) {

  ipcMain.handle('parametres:get', (e, cle) => {
    const row = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get(cle);
    return row ? row.valeur : null;
  });

  ipcMain.handle('parametres:getAll', () => {
    const rows = db.prepare('SELECT cle, valeur FROM parametres').all();
    const result = {};
    for (const r of rows) result[r.cle] = r.valeur;
    return result;
  });

  ipcMain.handle('parametres:set', (e, cle, valeur) => {
    try {
      db.prepare("INSERT OR REPLACE INTO parametres (cle, valeur, date_maj) VALUES (?, ?, datetime('now'))")
        .run(cle, valeur);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('parametres:setBulk', (e, data) => {
    try {
      const stmt = db.prepare("INSERT OR REPLACE INTO parametres (cle, valeur, date_maj) VALUES (?, ?, datetime('now'))");
      const tx = db.transaction((entries) => {
        for (const [cle, valeur] of Object.entries(entries)) {
          stmt.run(cle, valeur);
        }
      });
      tx(data);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
