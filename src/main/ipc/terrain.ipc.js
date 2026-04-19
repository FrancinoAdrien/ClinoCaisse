'use strict';
const { randomUUID } = require('crypto');
const { logAction } = require('./journal.ipc');
const { notifyChange } = require('../sync/notifier');

module.exports = function(ipcMain, db) {

  // ── HELPER: ajuster le capital ─────────────────────────────────────────
  function adjustCapital(delta) {
    const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'finance.capital'").get();
    const current = parseFloat(row?.valeur || '0');
    db.prepare("INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status) VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = 'finance.capital'), lower(hex(randomblob(16)))), 'finance.capital', ?, datetime('now'), ?, 0)")
      .run(String(current + delta), Date.now());
  }

  // ── ESPACES ────────────────────────────────────────────────────────────

  ipcMain.handle('terrain:getEspaces', () => {
    return db.prepare('SELECT * FROM espaces WHERE actif = 1 ORDER BY type, nom').all();
  });

  ipcMain.handle('terrain:getAllEspaces', () => {
    return db.prepare('SELECT * FROM espaces ORDER BY type, nom').all();
  });

  ipcMain.handle('terrain:createEspace', (e, data) => {
    try {
      const { nom, type, description, tarif_heure, type_tarif } = data;
      if (!nom) return { success: false, message: 'Le nom est requis' };
      const r = db.prepare(`
        INSERT INTO espaces (uuid, nom, type, description, tarif_heure, type_tarif, last_modified_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).run(randomUUID(), nom.trim(), type || 'terrain', description || '', parseFloat(tarif_heure) || 0, type_tarif || 'heure', Date.now());

      logAction(db, {
        categorie: 'TERRAIN',
        action: 'Espace créé',
        detail: `${nom} (${type || 'terrain'})`,
        icone: '🏟️'
      });
      notifyChange();
      return { success: true, id: r.lastInsertRowid };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('terrain:updateEspace', (e, id, data) => {
    try {
      const { nom, type, description, tarif_heure, type_tarif } = data;
      db.prepare(`
        UPDATE espaces SET nom = ?, type = ?, description = ?, tarif_heure = ?, type_tarif = ?,
          last_modified_at = ?, sync_status = 0
        WHERE id = ? OR uuid = ?
      `).run(nom.trim(), type || 'terrain', description || '', parseFloat(tarif_heure) || 0, type_tarif || 'heure', Date.now(), id, id);

      logAction(db, {
        categorie: 'TERRAIN',
        action: 'Espace modifié',
        detail: nom,
        icone: '✏️'
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('terrain:deleteEspace', (e, id) => {
    try {
      // Vérifier si des réservations actives existent
      const actives = db.prepare(`
        SELECT COUNT(*) as n FROM reservations_terrain
        WHERE espace_id = ? AND statut != 'annulee'
      `).get(id);
      if (actives.n > 0) {
        return { success: false, message: 'Cet espace a des réservations actives. Désactivation impossible.' };
      }
      db.prepare('UPDATE espaces SET actif = 0, last_modified_at = ?, sync_status = 0 WHERE id = ? OR uuid = ?').run(Date.now(), id, id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── RÉSERVATIONS ────────────────────────────────────────────────────────

  ipcMain.handle('terrain:getReservations', (e, filter = {}) => {
    let sql = `
      SELECT rt.*, e.nom as espace_nom, e.type as espace_type, e.tarif_heure, e.type_tarif
      FROM reservations_terrain rt
      LEFT JOIN espaces e ON rt.espace_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (filter.statut && filter.statut !== 'all') {
      sql += ' AND rt.statut = ?';
      params.push(filter.statut);
    }
    if (filter.statut_paiement && filter.statut_paiement !== 'all') {
      sql += ' AND rt.statut_paiement = ?';
      params.push(filter.statut_paiement);
    }
    if (filter.espace_id) {
      sql += ' AND rt.espace_id = ?';
      params.push(filter.espace_id);
    }
    if (filter.date_debut) {
      sql += ' AND date(rt.date_debut) >= ?';
      params.push(filter.date_debut);
    }
    if (filter.date_fin) {
      sql += ' AND date(rt.date_debut) <= ?';
      params.push(filter.date_fin);
    }

    sql += ' ORDER BY rt.date_debut DESC LIMIT 500';
    return db.prepare(sql).all(...params);
  });

  ipcMain.handle('terrain:getReservationsCalendrier', (e, mois) => {
    // mois = 'YYYY-MM'
    const debut = mois + '-01';
    const finObj = new Date(mois + '-01');
    finObj.setMonth(finObj.getMonth() + 1);
    finObj.setDate(0);
    const fin = finObj.toISOString().slice(0, 10);

    return db.prepare(`
      SELECT rt.*, e.nom as espace_nom, e.type as espace_type
      FROM reservations_terrain rt
      LEFT JOIN espaces e ON rt.espace_id = e.id
      WHERE date(rt.date_debut) BETWEEN ? AND ?
        AND rt.statut != 'annulee'
      ORDER BY rt.date_debut ASC
    `).all(debut, fin);
  });

  ipcMain.handle('terrain:createReservation', (e, data) => {
    try {
      const {
        client_nom, client_contact, espace_id,
        date_debut, date_fin, montant_total, montant_paye,
        mode_paiement, note, operateur, force
      } = data;

      if (!client_nom) return { success: false, message: 'Le nom du client est requis' };
      if (!date_debut || !date_fin) return { success: false, message: 'Les dates de début et fin sont requises' };
      if (new Date(date_fin) <= new Date(date_debut)) {
        return { success: false, message: 'La date de fin doit être après la date de début' };
      }

      if (!force && espace_id) {
        const check = db.prepare(`
          SELECT COUNT(*) as n FROM reservations_terrain
          WHERE espace_id = ? AND statut != 'annulee'
            AND date_debut < ? AND date_fin > ?
        `).get(espace_id, date_fin, date_debut);
        
        if (check.n > 0) {
          return { success: false, code: 'CONFLICT', message: 'Il y a déjà une réservation à cette date pour cet espace.' };
        }
      }

      const uid = randomUUID();
      const total = parseFloat(montant_total) || 0;
      const paye = parseFloat(montant_paye) || 0;

      let statut_paiement = 'en_attente';
      if (paye >= total && total > 0) statut_paiement = 'complet';
      else if (paye > 0) statut_paiement = 'partiel';

      db.transaction(() => {
        db.prepare(`
          INSERT INTO reservations_terrain
            (uuid, client_nom, client_contact, espace_id, date_debut, date_fin,
             montant_total, montant_paye, statut_paiement, statut, note, operateur, last_modified_at, sync_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmee', ?, ?, ?, 0)
        `).run(
          uid, client_nom.trim(), client_contact || '',
          espace_id || null, date_debut, date_fin,
          total, paye, statut_paiement,
          note || '', operateur || '', Date.now()
        );

        // Ajuster capital si paiement
        if (paye > 0) {
          adjustCapital(paye);

          // Enregistrer dans flux_tresorerie
          db.prepare(`
            INSERT INTO flux_tresorerie (uuid, type_flux, montant, motif, date_flux, operateur, last_modified_at, sync_status)
            VALUES (?, 'recette_terrain', ?, ?, datetime('now'), ?, ?, 0)
          `).run(randomUUID(), paye, `Réservation terrain: ${client_nom}`, operateur || '', Date.now());
        }
      })();

      const espaceRow = espace_id ? db.prepare('SELECT nom FROM espaces WHERE id = ? OR uuid = ?').get(espace_id, espace_id) : null;

      logAction(db, {
        categorie: 'TERRAIN',
        action: 'Réservation créée',
        detail: `${client_nom} — ${espaceRow?.nom || 'Espace'} — ${date_debut}`,
        operateur,
        montant: paye,
        icone: '🏟️'
      });
      notifyChange();
      return { success: true, id: uid };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('terrain:payerSolde', (e, id, montant) => {
    try {
      const res = db.prepare('SELECT * FROM reservations_terrain WHERE id = ? OR uuid = ?').get(id, id);
      if (!res) return { success: false, message: 'Réservation introuvable' };
      if (res.statut === 'annulee') return { success: false, message: 'Réservation annulée' };

      const soldeRestant = res.montant_total - res.montant_paye;
      const versement = Math.min(parseFloat(montant) || 0, soldeRestant);
      if (versement <= 0) return { success: false, message: 'Montant invalide' };

      const nouvPaye = res.montant_paye + versement;
      const nouvStatut = nouvPaye >= res.montant_total ? 'complet' : 'partiel';

      db.transaction(() => {
        db.prepare(`
          UPDATE reservations_terrain
          SET montant_paye = ?, statut_paiement = ?, last_modified_at = ?
          WHERE id = ? OR uuid = ?
        `).run(nouvPaye, nouvStatut, Date.now(), id, id);

        adjustCapital(versement);

        db.prepare(`
          INSERT INTO flux_tresorerie (uuid, type_flux, montant, motif, date_flux, operateur, last_modified_at, sync_status)
          VALUES (?, 'recette_terrain', ?, ?, datetime('now'), ?, ?, 0)
        `).run(randomUUID(), versement, `Solde réservation terrain: ${res.client_nom}`, res.operateur || '', Date.now());
      })();

      logAction(db, {
        categorie: 'TERRAIN',
        action: nouvStatut === 'complet' ? 'Réservation soldée' : 'Paiement partiel reçu',
        detail: `${res.client_nom}: +${versement} Ar`,
        montant: versement,
        icone: '💰'
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('terrain:annuler', (e, id, rembourser) => {
    try {
      const res = db.prepare('SELECT * FROM reservations_terrain WHERE id = ? OR uuid = ?').get(id, id);
      if (!res) return { success: false, message: 'Réservation introuvable' };
      if (res.statut === 'annulee') return { success: false, message: 'Déjà annulée' };

      db.transaction(() => {
        db.prepare(`
          UPDATE reservations_terrain
          SET statut = 'annulee', last_modified_at = ?
          WHERE id = ? OR uuid = ?
        `).run(Date.now(), id, id);

        if (rembourser && res.montant_paye > 0) {
          adjustCapital(-res.montant_paye);

          db.prepare(`
            INSERT INTO flux_tresorerie (uuid, type_flux, montant, motif, date_flux, operateur, last_modified_at, sync_status)
            VALUES (?, 'remboursement_terrain', ?, ?, datetime('now'), ?, ?, 0)
          `).run(randomUUID(), res.montant_paye, `Remboursement annulation: ${res.client_nom}`, res.operateur || '', Date.now());
        }
      })();

      logAction(db, {
        categorie: 'TERRAIN',
        action: 'Réservation annulée',
        detail: `${res.client_nom}${rembourser ? ' — Remboursement: ' + res.montant_paye + ' Ar' : ''}`,
        montant: rembourser ? res.montant_paye : 0,
        icone: '❌'
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('terrain:decaler', (e, id, data) => {
    try {
      const { date_debut, date_fin, note, force } = data;
      if (!date_debut || !date_fin) return { success: false, message: 'Dates requises' };
      if (new Date(date_fin) <= new Date(date_debut)) {
        return { success: false, message: 'La date de fin doit être après la date de début' };
      }

      const res = db.prepare('SELECT client_nom, espace_id FROM reservations_terrain WHERE id = ? OR uuid = ?').get(id, id);
      if (!res) return { success: false, message: 'Réservation introuvable' };

      if (!force && res.espace_id) {
        const check = db.prepare(`
          SELECT COUNT(*) as n FROM reservations_terrain
          WHERE espace_id = ? AND statut != 'annulee' AND id != ?
            AND date_debut < ? AND date_fin > ?
        `).get(res.espace_id, id, date_fin, date_debut);
        
        if (check.n > 0) {
          return { success: false, code: 'CONFLICT', message: 'Il y a déjà une réservation à cette date pour cet espace.' };
        }
      }

      db.prepare(`
        UPDATE reservations_terrain
        SET date_debut = ?, date_fin = ?, note = COALESCE(?, note), last_modified_at = ?
        WHERE id = ? OR uuid = ?
      `).run(date_debut, date_fin, note, Date.now(), id, id);

      logAction(db, {
        categorie: 'TERRAIN',
        action: 'Réservation décalée',
        detail: `${res.client_nom} → ${date_debut}`,
        icone: '📅'
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ── STATISTIQUES ────────────────────────────────────────────────────────

  ipcMain.handle('terrain:getStats', () => {
    try {
      const firstDay = new Date().toISOString().slice(0, 7) + '-01';

      const caMois = db.prepare(`
        SELECT COALESCE(SUM(montant_paye), 0) as t
        FROM reservations_terrain
        WHERE date(date_creation) >= ? AND statut != 'annulee'
      `).get(firstDay);

      const actives = db.prepare(`
        SELECT COUNT(*) as n FROM reservations_terrain
        WHERE statut = 'confirmee' AND date(date_fin) >= date('now')
      `).get();

      const enAttente = db.prepare(`
        SELECT COUNT(*) as n FROM reservations_terrain
        WHERE statut_paiement IN ('en_attente', 'partiel') AND statut != 'annulee'
      `).get();

      const soldesDus = db.prepare(`
        SELECT COALESCE(SUM(montant_total - montant_paye), 0) as t
        FROM reservations_terrain
        WHERE statut != 'annulee' AND statut_paiement != 'complet'
      `).get();

      const nbEspaces = db.prepare('SELECT COUNT(*) as n FROM espaces WHERE actif = 1').get();

      const prochaines = db.prepare(`
        SELECT rt.*, e.nom as espace_nom
        FROM reservations_terrain rt
        LEFT JOIN espaces e ON rt.espace_id = e.id
        WHERE rt.statut = 'confirmee' AND date(rt.date_debut) >= date('now')
        ORDER BY rt.date_debut ASC LIMIT 5
      `).all();

      return {
        ca_mois: caMois?.t || 0,
        reservations_actives: actives?.n || 0,
        paiements_en_attente: enAttente?.n || 0,
        soldes_dus: soldesDus?.t || 0,
        nb_espaces: nbEspaces?.n || 0,
        prochaines_reservations: prochaines
      };
    } catch (err) {
      console.error('terrain:getStats error:', err.message);
      return { ca_mois: 0, reservations_actives: 0, paiements_en_attente: 0, soldes_dus: 0, nb_espaces: 0, prochaines_reservations: [] };
    }
  });

};
