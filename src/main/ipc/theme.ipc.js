'use strict';

module.exports = function(ipcMain, db) {

  ipcMain.handle('theme:get', (e, userId) => {
    if (!userId) return 'default';
    const row = db.prepare('SELECT theme FROM utilisateurs WHERE id = ? OR uuid = ?').get(userId, userId);
    return row ? (row.theme || 'default') : 'default';
  });

  ipcMain.handle('theme:save', (e, userId, themeName) => {
    try {
      db.prepare("UPDATE utilisateurs SET theme = ? WHERE id = ? OR uuid = ?").run(themeName, userId, userId);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
