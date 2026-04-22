'use strict';
const { logAction } = require('./journal.ipc');
const { notifyChange } = require('../sync/notifier');

module.exports = function(ipcMain, db, syncEngine) {

  function parseDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
  }

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
      db.prepare("INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status) VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = ?), lower(hex(randomblob(16)))), ?, ?, datetime('now'), ?, 0)")
        .run(cle, cle, valeur, Date.now());
      // Logguer uniquement si ce n'est pas finance.capital (mis à jour en continu)
      if (!cle.startsWith('finance.capital') && !cle.startsWith('sync.')) {
        logAction(db, {
          categorie: 'PARAMETRE',
          action: 'Paramètre modifié',
          detail: `${cle} = ${String(valeur).slice(0, 80)}`,
          icone: '⚙️'
        });
        notifyChange();
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('parametres:setBulk', (e, data) => {
    try {
      const stmt = db.prepare("INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status) VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = ?), lower(hex(randomblob(16)))), ?, ?, datetime('now'), ?, 0)");
      const tx = db.transaction((entries) => {
        for (const [cle, valeur] of Object.entries(entries)) {
          stmt.run(cle, cle, valeur, Date.now());
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

  ipcMain.handle('parametres:uploadLogo', async (e, dataUrl, fileName = '') => {
    try {
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return { success: false, message: 'Image invalide.' };
      const ext = (fileName.split('.').pop() || '').toLowerCase();
      const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : (parsed.contentType.split('/')[1] || 'png');
      const objectPath = `logos/entreprise-logo.${safeExt}`;
      
      const res = await syncEngine.uploadAsset({
        data: parsed.buffer,
        contentType: parsed.contentType,
        bucket: 'clinocaisse-assets',
        path: objectPath
      });
      
      if (res.success) {
        return res;
      } else {
        // Fallback: Si Supabase non configuré ou introuvable, on le stocke en base64 localement.
        return { success: true, url: dataUrl };
      }
    } catch (err) {
      return { success: true, url: dataUrl, message: err.message };
    }
  });
};
