'use strict';

module.exports = function(ipcMain, db) {

  ipcMain.handle('theme:get', (e, userId) => {
    if (!userId) return 'default';
    const row = db.prepare('SELECT theme FROM utilisateurs WHERE id = ? OR uuid = ?').get(userId, userId);
    return row ? (row.theme || 'default') : 'default';
  });

  ipcMain.handle('theme:save', (e, userId, themeName) => {
    try {
      db.prepare(`
        UPDATE utilisateurs
        SET theme = ?, last_modified_at = ?, sync_status = 0
        WHERE id = ? OR uuid = ?
      `).run(themeName, Date.now(), userId, userId);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
