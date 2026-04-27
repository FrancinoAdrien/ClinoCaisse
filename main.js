'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

// Initialiser la base de données
const db = require('./src/main/database/connection');
require('./src/main/database/migrations')(db);

// Initialiser le moteur de synchronisation cloud
const SyncEngine = require('./src/main/sync/syncEngine');
const { initNotifier } = require('./src/main/sync/notifier');
const { initBroadcast } = require('./src/main/realtime/broadcast');
const syncEngine = new SyncEngine(db);
initNotifier(syncEngine); // Connecter le notifieur singleton

// Enregistrer tous les handlers IPC
require('./src/main/ipc/auth.ipc')(ipcMain, db);
require('./src/main/ipc/produit.ipc')(ipcMain, db, syncEngine);
require('./src/main/ipc/vente.ipc')(ipcMain, db);
require('./src/main/ipc/stock.ipc')(ipcMain, db);
require('./src/main/ipc/cloture.ipc')(ipcMain, db);
require('./src/main/ipc/utilisateur.ipc')(ipcMain, db);
require('./src/main/ipc/parametre.ipc')(ipcMain, db, syncEngine);
require('./src/main/ipc/theme.ipc')(ipcMain, db);
require('./src/main/ipc/printer.ipc')(ipcMain, db);
require('./src/main/ipc/journal.ipc')(ipcMain, db);
require('./src/main/ipc/reservation.ipc')(ipcMain, db);
require('./src/main/ipc/terrain.ipc')(ipcMain, db);
require('./src/main/ipc/cuisine.ipc')(ipcMain, db);
require('./src/main/ipc/finances.ipc')(ipcMain, db);
require('./src/main/ipc/rh.ipc')(ipcMain, db);

require('./src/main/ipc/sync.ipc')(ipcMain, db, syncEngine);
require('./src/main/ipc/analytique.ipc')(ipcMain, db);
require('./src/main/ipc/license.ipc')(ipcMain, db, syncEngine);

// Démarrer l'auto-sync si déjà configuré
try {
  const urlRow = db.prepare(`SELECT valeur FROM parametres WHERE cle = 'sync.supabase_url'`).get();
  const keyRow = db.prepare(`SELECT valeur FROM parametres WHERE cle = 'sync.supabase_key'`).get();
  if (urlRow && urlRow.valeur && keyRow && keyRow.valeur) {
    const ok = syncEngine.configure(urlRow.valeur, keyRow.valeur);
    if (ok) syncEngine.startAutoSync();
  }
} catch (e) {
  console.error('SyncEngine boot error:', e.message);
}

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, 'src/renderer/assets/icons/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    frame: true,
    // ⚡ amélioration perf
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // ⚡ IMPORTANT stabilité
      sandbox: false,
      webSecurity: true,
      devTools: process.argv.includes('--devtools'),
      // ⚡ perf
      spellcheck: false
    },
    ...(require('fs').existsSync(iconPath) ? { icon: iconPath } : {}),
    title: 'ClinoCaisse',
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

  // Brancher le broadcast Main -> Renderer (temps réel UI)
  initBroadcast(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
    // Ouvrir les DevTools en mode dev
    if (process.argv.includes('--devtools')) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Logger les erreurs renderer
  mainWindow.webContents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[RENDERER ${level === 3 ? 'ERR' : 'WARN'}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.disableHardwareAcceleration();

// Fallback GPU (important pour vieux PC / drivers corrompus)
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');

// Stabilité Chromium
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  try {
    db.close();
  } catch (e) {
    console.error('Erreur fermeture DB:', e);
  }

  if (process.platform !== 'darwin') app.quit();
});

app.on('render-process-gone', (event, webContents, details) => {
  console.error('Renderer crash:', details);
});

app.on('gpu-process-crashed', () => {
  console.error('GPU crash détecté');
});