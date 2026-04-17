'use strict';

const path   = require('path');
const fs     = require('fs');
const { dialog } = require('electron');

module.exports = function(ipcMain, db, syncEngine) {

  // ── CONFIGURER LA CONNEXION ──────────────────────────────────────────────
  ipcMain.handle('sync:configure', async (e, url, key) => {
    try {
      // Sauvegarder l'URL et la clé dans les paramètres
      const stmt = db.prepare("INSERT OR REPLACE INTO parametres (cle, valeur, date_maj) VALUES (?, ?, datetime('now'))");
      stmt.run('sync.supabase_url', url);
      stmt.run('sync.supabase_key', key);

      const ok = syncEngine.configure(url, key);
      if (!ok) return { success: false, message: 'Configuration invalide. Vérifiez l\'URL et la clé.' };

      // Tenter l'auto-migration
      const migration = await syncEngine.autoMigrateCloud();
      syncEngine.startAutoSync();
      return { success: true, message: migration.message || 'Connexion configurée.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── TESTER LA CONNEXION ──────────────────────────────────────────────────
  ipcMain.handle('sync:test', async () => {
    return await syncEngine.testConnexion();
  });

  // ── PUSH (local → cloud) ─────────────────────────────────────────────────
  ipcMain.handle('sync:push', async () => {
    return await syncEngine.pushPending();
  });

  // ── PULL (cloud → local) ─────────────────────────────────────────────────
  ipcMain.handle('sync:pull', async () => {
    return await syncEngine.pullUpdates();
  });

  // ── FULL PUSH (restauration massive) ─────────────────────────────────────
  ipcMain.handle('sync:fullPush', async () => {
    return await syncEngine.fullPush();
  });

  // ── BACKUP LOCAL SQLite ──────────────────────────────────────────────────
  ipcMain.handle('sync:backupLocal', async (e) => {
    try {
      const win = require('electron').BrowserWindow.getFocusedWindow();
      const dbPath = db.name; // chemin du fichier SQLite

      const { filePath, canceled } = await dialog.showSaveDialog(win, {
        title:       'Sauvegarder la base de données',
        defaultPath: `ClinoCaisse_backup_${new Date().toISOString().slice(0,10)}.sqlite`,
        filters:     [{ name: 'Fichiers SQLite', extensions: ['sqlite', 'db'] }],
      });

      if (canceled || !filePath) return { success: false, message: 'Annulé' };

      fs.copyFileSync(dbPath, filePath);
      return { success: true, message: `Sauvegarde créée : ${path.basename(filePath)}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── STATUT DE SYNC ───────────────────────────────────────────────────────
  ipcMain.handle('sync:getStatus', () => {
    return syncEngine.getStatus();
  });

  // ── RÉCUPÉRER LES CLÉS SAUVEGARDÉES ────────────────────────────────────
  ipcMain.handle('sync:getConfig', () => {
    try {
      const urlRow = db.prepare(`SELECT valeur FROM parametres WHERE cle = 'sync.supabase_url'`).get();
      const keyRow = db.prepare(`SELECT valeur FROM parametres WHERE cle = 'sync.supabase_key'`).get();
      return {
        url: urlRow ? urlRow.valeur : '',
        key: keyRow ? keyRow.valeur : '',
      };
    } catch {
      return { url: '', key: '' };
    }
  });
};
