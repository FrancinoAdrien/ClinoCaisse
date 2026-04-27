'use strict';

/**
 * Broadcast simple Main -> Renderer.
 * Permet au dashboard (et autres vues) de rafraîchir en temps réel
 * sans attendre un polling.
 */

let _mainWindow = null;

function initBroadcast(mainWindow) {
  _mainWindow = mainWindow;
}

function broadcastChange(payload) {
  try {
    if (!_mainWindow || _mainWindow.isDestroyed()) return;
    _mainWindow.webContents.send('app:dataChanged', payload || { ts: Date.now() });
  } catch { /* silencieux */ }
}

module.exports = { initBroadcast, broadcastChange };

