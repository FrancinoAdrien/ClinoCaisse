'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

// Initialiser la base de données
const db = require('./src/main/database/connection');
require('./src/main/database/migrations')(db);

// Enregistrer tous les handlers IPC
require('./src/main/ipc/auth.ipc')(ipcMain, db);
require('./src/main/ipc/produit.ipc')(ipcMain, db);
require('./src/main/ipc/vente.ipc')(ipcMain, db);
require('./src/main/ipc/stock.ipc')(ipcMain, db);
require('./src/main/ipc/cloture.ipc')(ipcMain, db);
require('./src/main/ipc/utilisateur.ipc')(ipcMain, db);
require('./src/main/ipc/parametre.ipc')(ipcMain, db);
require('./src/main/ipc/theme.ipc')(ipcMain, db);
require('./src/main/ipc/printer.ipc')(ipcMain, db);

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