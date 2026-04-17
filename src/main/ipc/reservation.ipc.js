'use strict';
const { randomUUID } = require('crypto');
const { logAction } = require('./journal.ipc');

module.exports = function(ipcMain, db) {

  ipcMain.handle('reservations:getAll', (e, filter) => {
    const allowed = ['all', 'en_attente', 'confirmee', 'annulee'];
    const f = allowed.includes(filter) ? filter : 'all';
    if (f === 'all') {
      return db.prepare('SELECT * FROM reservations ORDER BY date_reservation DESC LIMIT 500').all();
    }
    return db.prepare('SELECT * FROM reservations WHERE statut = ? ORDER BY date_reservation DESC LIMIT 500').all(f);
  });

  /** Réservations du jour (date locale YYYY-MM-DD sur le préfixe de date_reservation) */
  ipcMain.handle('reservations:getTodayMarkers', () => {
    const day = new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT id, table_numero, tables_json, client_nom, statut, date_reservation, nb_personnes, evenement
      FROM reservations
      WHERE statut IN ('en_attente', 'confirmee')
        AND date_reservation LIKE ?
    `).all(`${day}%`);

    const markers = [];
    rows.forEach(r => {
      let nums = [];
      if (r.tables_json && r.tables_json !== '[]') {
        try { nums = JSON.parse(r.tables_json); } catch(e) { nums = []; }
      }
      // Rétrocompatibilité
      if (!nums.length && r.table_numero) nums = [r.table_numero];

      nums.forEach(n => {
        markers.push({ ...r, table_numero: n });
      });
    });
    return markers;
  });

  ipcMain.handle('reservations:create', (e, data) => {
    try {
      if (!data.client_nom || !data.date_reservation) {
        return { success: false, message: 'Client et date requis' };
      }
      const uid = randomUUID();
      const now = Date.now();
      const tablesJson = data.tables && Array.isArray(data.tables) ? JSON.stringify(data.tables) : '[]';
      
      const r = db.prepare(`
        INSERT INTO reservations (uuid, client_nom, date_reservation, nb_personnes, table_numero, tables_json, duree_heures, evenement, statut, last_modified_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?, 0)
      `).run(
        uid,
        data.client_nom.trim(),
        data.date_reservation,
        data.nb_personnes != null ? parseInt(data.nb_personnes, 10) || 1 : 1,
        data.table_numero || (data.tables && data.tables.length ? data.tables[0] : null),
        tablesJson,
        data.duree_heures || null,
        data.evenement || null,
        now
      );

      logAction(db, {
        categorie: 'RESERVATION',
        action: 'Réservation créée',
        detail: `${data.client_nom} — ${data.date_reservation}${data.evenement ? ' — ' + data.evenement : ''}`,
        icone: '📅'
      });

      return { success: true, id: r.lastInsertRowid };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('reservations:updateStatus', (e, id, status) => {
    try {
      if (!['en_attente', 'confirmee', 'annulee'].includes(status)) {
        return { success: false, message: 'Statut invalide' };
      }
      const res = db.prepare('SELECT client_nom FROM reservations WHERE id = ?').get(id);
      db.prepare(`
        UPDATE reservations SET statut = ?, last_modified_at = ?, sync_status = 0 WHERE id = ?
      `).run(status, Date.now(), id);

      const labels = { confirmee: 'confirmée', annulee: 'annulée', en_attente: 'en attente' };
      logAction(db, {
        categorie: 'RESERVATION',
        action: `Réservation ${labels[status] || status}`,
        detail: res ? `${res.client_nom}` : `ID ${id}`,
        icone: status === 'confirmee' ? '✅' : status === 'annulee' ? '❌' : '⏳'
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
