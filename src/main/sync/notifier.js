'use strict';

/**
 * Module Singleton de notification de synchronisation.
 * Permet à tous les IPC handlers de notifier le SyncEngine
 * d'une modification locale sans avoir besoin de l'injecter
 * directement en paramètre.
 *
 * Usage :
 *   const { notifyChange } = require('./sync/notifier');
 *   // ... après une écriture DB...
 *   notifyChange();
 */

let _syncEngine = null;

/**
 * Initialise le notifieur avec une instance de SyncEngine.
 * À appeler UNE seule fois au démarrage, depuis main.js.
 * @param {SyncEngine} syncEngine
 */
function initNotifier(syncEngine) {
  _syncEngine = syncEngine;
}

/**
 * Notifie le SyncEngine qu'une modification locale a eu lieu.
 * Déclenche un push dans les 500ms si le moteur est configuré.
 */
function notifyChange() {
  if (_syncEngine) {
    _syncEngine.notifyChange();
  }
}

module.exports = { initNotifier, notifyChange };
