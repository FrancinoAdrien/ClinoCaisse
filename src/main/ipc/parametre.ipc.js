'use strict';
const { logAction } = require('./journal.ipc');

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
      // Logguer uniquement si ce n'est pas finance.capital (mis à jour en continu)
      if (!cle.startsWith('finance.capital') && !cle.startsWith('sync.')) {
        logAction(db, {
          categorie: 'PARAMETRE',
          action: 'Paramètre modifié',
          detail: `${cle} = ${String(valeur).slice(0, 80)}`,
          icone: '⚙️'
        });
      }
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

      // Log en une seule entrée pour le bulk
      const clesFiltrees = Object.keys(data).filter(k => !k.startsWith('finance.capital') && !k.startsWith('sync.'));
      if (clesFiltrees.length > 0) {
        logAction(db, {
          categorie: 'PARAMETRE',
          action: 'Paramètres mis à jour',
          detail: `${clesFiltrees.length} paramètre(s) modifié(s)`,
          icone: '⚙️'
        });
      }

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
