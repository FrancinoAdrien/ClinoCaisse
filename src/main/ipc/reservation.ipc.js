'use strict';
const { randomUUID } = require('crypto');
const { logAction } = require('./journal.ipc');
const { notifyChange } = require('../sync/notifier');
const { broadcastChange } = require('../realtime/broadcast');

module.exports = function(ipcMain, db) {

  function normalizeTables(data) {
    if (Array.isArray(data?.tables) && data.tables.length) return data.tables.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n));
    if (data?.table_numero != null) {
      const n = parseInt(data.table_numero, 10);
      return Number.isFinite(n) ? [n] : [];
    }
    return [];
  }

  function hasExactConflict({ tables, date_reservation, exclude }) {
    if (!tables?.length || !date_reservation) return null;
    for (const tableNum of tables) {
      const row = db.prepare(`
        SELECT id, uuid, client_nom, date_reservation, statut, tables_json, table_numero
        FROM reservations
        WHERE statut IN ('en_attente', 'confirmee', 'reporter')
          AND date_reservation = ?
          AND (table_numero = ? OR tables_json LIKE ?)
          ${exclude ? 'AND id != ? AND uuid != ?' : ''}
        ORDER BY id DESC
        LIMIT 1
      `).get(
        ...(exclude
          ? [date_reservation, tableNum, `%${tableNum}%`, exclude, exclude]
          : [date_reservation, tableNum, `%${tableNum}%`]
        )
      );
      if (row) return row;
    }
    return null;
  }

  // ── GET ALL ──────────────────────────────────────────────────────────────
  ipcMain.handle('reservations:getAll', (e, filter) => {
    const allowed = ['all', 'en_attente', 'confirmee', 'annulee', 'client_arrive', 'reporter'];
    const f = allowed.includes(filter) ? filter : 'all';
    if (f === 'all') {
      return db.prepare('SELECT * FROM reservations ORDER BY date_reservation DESC LIMIT 500').all();
    }
    return db.prepare('SELECT * FROM reservations WHERE statut = ? ORDER BY date_reservation DESC LIMIT 500').all(f);
  });

  // ── TODAY MARKERS (plan de salle) ────────────────────────────────────────
  ipcMain.handle('reservations:getTodayMarkers', () => {
    const day = new Date().toISOString().slice(0, 10);
    // Exclure client_arrive et annulee du plan (ils ne bloquent plus la table)
    const rows = db.prepare(`
      SELECT id, table_numero, tables_json, client_nom, statut, date_reservation, nb_personnes, evenement, client_arrive
      FROM reservations
      WHERE statut IN ('en_attente', 'confirmee', 'reporter')
        AND date_reservation LIKE ?
    `).all(`${day}%`);

    const markers = [];
    rows.forEach(r => {
      let nums = [];
      if (r.tables_json && r.tables_json !== '[]') {
        try { nums = JSON.parse(r.tables_json); } catch(e) { nums = []; }
      }
      if (!nums.length && r.table_numero) nums = [r.table_numero];
      nums.forEach(n => markers.push({ ...r, table_numero: n }));
    });
    return markers;
  });

  // ── CREATE ───────────────────────────────────────────────────────────────
  ipcMain.handle('reservations:create', (e, data) => {
    try {
      if (!data.client_nom || !data.date_reservation) {
        return { success: false, message: 'Client et date requis' };
      }
      const uid = randomUUID();
      const now = Date.now();
      const tables = normalizeTables(data);
      const tablesJson = tables.length ? JSON.stringify(tables) : '[]';

      // Règle: si la table est déjà réservée à CETTE date/heure exacte, on refuse
      const exact = hasExactConflict({ tables, date_reservation: data.date_reservation });
      if (exact) {
        return {
          success: false,
          message: `Créneau indisponible: table déjà réservée à ${data.date_reservation}`,
          code: 'RESERVATION_EXACT_CONFLICT',
          conflict: exact
        };
      }

      const r = db.prepare(`
        INSERT INTO reservations
          (uuid, client_nom, date_reservation, nb_personnes, table_numero, tables_json,
           duree_heures, evenement, montant_acompte, client_tel, statut, last_modified_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmee', ?, 0)
      `).run(
        uid,
        data.client_nom.trim(),
        data.date_reservation,
        data.nb_personnes != null ? parseInt(data.nb_personnes, 10) || 1 : 1,
        data.table_numero || (tables.length ? tables[0] : null),
        tablesJson,
        data.duree_heures || null,
        data.evenement || null,
        data.montant_acompte > 0 ? parseFloat(data.montant_acompte) || 0 : 0,
        data.client_tel ? String(data.client_tel).trim() : null,
        now
      );

      logAction(db, {
        categorie: 'RESERVATION',
        action: 'Réservation créée',
        detail: `${data.client_nom} — ${data.date_reservation}${data.evenement ? ' — ' + data.evenement : ''}${data.montant_acompte > 0 ? ` — Acompte: ${data.montant_acompte}` : ''}`,
        icone: '📅'
      });
      notifyChange();
      broadcastChange({ scope: 'reservations', ts: Date.now() });

      return { success: true, id: r.lastInsertRowid };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── UPDATE STATUS ────────────────────────────────────────────────────────
  ipcMain.handle('reservations:updateStatus', (e, id, status) => {
    try {
      const allowed = ['en_attente', 'confirmee', 'annulee', 'client_arrive', 'reporter'];
      if (!allowed.includes(status)) {
        return { success: false, message: 'Statut invalide' };
      }
      const res = db.prepare('SELECT client_nom FROM reservations WHERE id = ? OR uuid = ?').get(id, id);

      // Si client arrive, on met aussi client_arrive = 1
      if (status === 'client_arrive') {
        db.prepare(`
          UPDATE reservations
          SET statut = ?, client_arrive = 1, last_modified_at = ?, sync_status = 0
          WHERE id = ? OR uuid = ?
        `).run(status, Date.now(), id, id);
      } else {
        db.prepare(`
          UPDATE reservations SET statut = ?, last_modified_at = ?, sync_status = 0 WHERE id = ? OR uuid = ?
        `).run(status, Date.now(), id, id);
      }

      const labels = {
        confirmee: 'confirmée', annulee: 'annulée',
        en_attente: 'en attente', client_arrive: 'client arrivé', reporter: 'reportée'
      };
      const icones = {
        confirmee: '✅', annulee: '❌', en_attente: '⏳',
        client_arrive: '🟢', reporter: '⏩'
      };
      logAction(db, {
        categorie: 'RESERVATION',
        action: `Réservation ${labels[status] || status}`,
        detail: res ? `${res.client_nom}` : `ID ${id}`,
        icone: icones[status] || '📅'
      });
      notifyChange();
      broadcastChange({ scope: 'reservations', ts: Date.now() });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── MARQUER CLIENT ARRIVÉ ─────────────────────────────────────────────────
  ipcMain.handle('reservations:marquerArrive', (e, id) => {
    try {
      const res = db.prepare('SELECT client_nom FROM reservations WHERE id = ? OR uuid = ?').get(id, id);
      db.prepare(`
        UPDATE reservations
        SET statut = 'client_arrive', client_arrive = 1, last_modified_at = ?, sync_status = 0
        WHERE id = ? OR uuid = ?
      `).run(Date.now(), id, id);
      logAction(db, {
        categorie: 'RESERVATION',
        action: 'Client arrivé',
        detail: res ? `${res.client_nom}` : `ID ${id}`,
        icone: '🟢'
      });
      notifyChange();
      broadcastChange({ scope: 'reservations', ts: Date.now() });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── REPORTER UNE RÉSERVATION ─────────────────────────────────────────────
  ipcMain.handle('reservations:reporter', (e, id, data) => {
    try {
      if (!data.nouvelle_date) {
        return { success: false, message: 'Nouvelle date requise' };
      }
      const res = db.prepare('SELECT client_nom FROM reservations WHERE id = ? OR uuid = ?').get(id, id);
      const tables = normalizeTables(data);
      const tablesJson = tables.length ? JSON.stringify(tables) : null;

      // Règle: interdit de reporter sur un créneau exact déjà réservé (sur les tables visées)
      const exact = hasExactConflict({ tables, date_reservation: data.nouvelle_date, exclude: id });
      if (exact) {
        return {
          success: false,
          message: `Créneau indisponible: table déjà réservée à ${data.nouvelle_date}`,
          code: 'RESERVATION_EXACT_CONFLICT',
          conflict: exact
        };
      }

      if (tablesJson) {
        db.prepare(`
          UPDATE reservations
          SET date_reservation = ?, statut = 'reporter', note_report = ?,
              montant_report = ?, tables_json = ?, table_numero = ?,
              last_modified_at = ?, sync_status = 0
          WHERE id = ? OR uuid = ?
        `).run(
          data.nouvelle_date,
          data.note_report || null,
          data.montant_report > 0 ? parseFloat(data.montant_report) || 0 : 0,
          tablesJson,
          tables.length ? tables[0] : null,
          Date.now(),
          id, id
        );
      } else {
        db.prepare(`
          UPDATE reservations
          SET date_reservation = ?, statut = 'reporter', note_report = ?,
              montant_report = ?, last_modified_at = ?, sync_status = 0
          WHERE id = ? OR uuid = ?
        `).run(
          data.nouvelle_date,
          data.note_report || null,
          data.montant_report > 0 ? parseFloat(data.montant_report) || 0 : 0,
          Date.now(),
          id, id
        );
      }

      logAction(db, {
        categorie: 'RESERVATION',
        action: 'Réservation reportée',
        detail: `${res ? res.client_nom : 'ID ' + id} → ${data.nouvelle_date}${data.note_report ? ' — ' + data.note_report : ''}${data.montant_report > 0 ? ` (+${data.montant_report})` : ''}`,
        icone: '⏩'
      });
      notifyChange();
      broadcastChange({ scope: 'reservations', ts: Date.now() });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── RÉSERVATIONS EN RETARD (pour notification dashboard) ─────────────────
  ipcMain.handle('reservations:getOverdue', () => {
    const overdue = db.prepare(`
      SELECT id, uuid, client_nom, date_reservation, nb_personnes, tables_json, table_numero, duree_heures
      FROM reservations
      WHERE statut IN ('en_attente', 'confirmee')
        AND client_arrive = 0
        AND datetime(date_reservation) < datetime('now', 'localtime')
      ORDER BY date_reservation ASC
    `).all();

    // Exclure si un ticket est déjà ouvert sur une des tables concernées
    const tickets = db.prepare("SELECT numero_table FROM tickets_table WHERE statut = 'en_cours'").all();
    const occ = new Set((tickets || []).map(t => t.numero_table));

    return (overdue || []).filter(r => {
      let nums = [];
      try { nums = JSON.parse(r.tables_json || '[]'); } catch { nums = []; }
      if (!nums.length && r.table_numero != null) nums = [r.table_numero];
      return !nums.some(n => occ.has(n));
    });
  });

  // ── VÉRIFICATION DISPONIBILITÉ TABLE ────────────────────────────────────
  // Retourne les réservations conflictuelles (même table, plage horaire proche)
  ipcMain.handle('reservations:checkDisponibilite', (e, data) => {
    try {
      // data: { tables: [num, ...], date_reservation: 'YYYY-MM-DDTHH:mm', duree_heures: float, exclude_id: null }
      const tables = normalizeTables(data);
      if (!tables.length || !data.date_reservation) return [];

      const duree = parseFloat(data.duree_heures) || 1.5; // fenêtre par défaut 1h30
      const debutMs  = new Date(data.date_reservation).getTime();
      const finMs    = debutMs + duree * 3600000;

      // Fenêtre de détection en ISO
      const debutStr = new Date(debutMs - 30 * 60000).toISOString().slice(0, 16);  // -30 min buffer
      const finStr   = new Date(finMs + 30 * 60000).toISOString().slice(0, 16);    // +30 min buffer

      const conflicts = [];
      for (const tableNum of tables) {
        // Chercher réservations actives sur cette table dans la fenêtre
        const rows = db.prepare(`
          SELECT id, uuid, client_nom, date_reservation, nb_personnes, duree_heures, statut, tables_json, table_numero
          FROM reservations
          WHERE statut IN ('en_attente', 'confirmee', 'reporter')
            AND (table_numero = ? OR tables_json LIKE ?)
            AND datetime(date_reservation) BETWEEN datetime(?) AND datetime(?)
            ${data.exclude_id ? 'AND id != ? AND uuid != ?' : ''}
        `).all(
          ...(data.exclude_id
            ? [tableNum, `%${tableNum}%`, debutStr, finStr, data.exclude_id, data.exclude_id]
            : [tableNum, `%${tableNum}%`, debutStr, finStr])
        );
        conflicts.push(...rows);
      }

      // Déduplique par id
      const seen = new Set();
      return conflicts.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
    } catch (err) {
      return [];
    }
  });

};
