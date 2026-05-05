'use strict';
const { randomUUID } = require('crypto');
const { broadcastChange } = require('../realtime/broadcast');
const { notifyChange } = require('../sync/notifier');
const { logAction } = require('./journal.ipc');
const { insertVenteComplete } = require('./venteCreateCore');

module.exports = function (ipcMain, db) {
  // adjustCapital no longer used for livraisons — capital flows only through cloture
  // (kept as unused reference, removed from finalizeLivraisonTx)

  function genNumeroBon(db) {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const n = db.prepare("SELECT COUNT(*) as c FROM livraisons WHERE numero_bon LIKE ?").get(`L${d}-%`).c;
    return `L${d}-${String(n + 1).padStart(4, '0')}`;
  }

  function isPendingVente(liv) {
    return !liv.vente_uuid || liv.vente_uuid === '';
  }

  function venteFromSnapshot(liv, snap) {
    const livSnap = snap.livraison || {};
    return {
      numero_ticket: liv.numero_bon || '-',
      date_vente: new Date().toISOString(),
      nom_caissier: snap.nom_caissier,
      total_ttc: snap.total_ttc,
      mode_paiement: snap.mode_paiement,
      montant_paye: snap.montant_paye,
      monnaie_rendue: snap.monnaie_rendue,
      lignes: snap.lignes || [],
      remise_totale: snap.remise_totale || 0,
      livraison: {
        adresse: livSnap.adresse || liv.adresse,
        lieu: livSnap.lieu || liv.lieu,
        date_prevue: livSnap.date_prevue || liv.date_prevue,
        heure_prevue: livSnap.heure_prevue || liv.heure_prevue,
        client_nom: livSnap.client_nom || liv.client_nom,
        contact_tel: livSnap.contact_tel || liv.contact_tel,
      },
    };
  }

  // ── Création depuis caisse (pas de vente tant que non terminée) ─────────
  ipcMain.handle('livraisons:createFromCaisse', (e, payload) => {
    try {
      const snap = payload.snapshot;
      if (!snap || !snap.lignes || !snap.livraison) {
        return { success: false, message: 'Données livraison invalides' };
      }
      const liv = snap.livraison;
      const adresse = (liv.adresse || '').trim();
      const lieu = (liv.lieu || '').trim();
      const datePrev = (liv.date_prevue || '').trim();
      const heurePrev = (liv.heure_prevue || '').trim();
      if (!adresse || !lieu || !datePrev || !heurePrev) {
        return { success: false, message: 'Adresse, lieu, date et heure requis' };
      }

      const numeroBon = genNumeroBon(db);
      const uid = randomUUID();
      const now = Date.now();
      const op = (payload.operateur || snap.nom_caissier || '').trim() || null;
      const montant = parseFloat(snap.total_ttc) || 0;
      const fraisLiv = parseFloat(snap.frais_livraison) || 0;
      const montantArticles = montant - fraisLiv;

      db.prepare(`
        INSERT INTO livraisons (uuid, vente_uuid, statut, client_nom, adresse, lieu, date_prevue, heure_prevue,
          contact_tel, livreur_nom, snapshot_json, numero_bon, montant_total, operateur_creation,
          last_modified_at, sync_status)
        VALUES (?, '', 'en_attente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        uid,
        (liv.client_nom || '').trim() || null,
        adresse,
        lieu,
        datePrev,
        heurePrev,
        (liv.contact_tel || '').trim() || null,
        (liv.livreur_nom || '').trim() || null,
        JSON.stringify(snap),
        numeroBon,
        montant,
        op,
        now
      );

      logAction(db, {
        categorie: 'LIVRAISON',
        action: 'Livraison enregistrée (en attente de clôture)',
        detail: `Bon ${numeroBon} — ${(snap.lignes || []).length} article(s) — ${montantArticles}${fraisLiv > 0 ? ` + frais ${fraisLiv}` : ''}`,
        operateur: op,
        montant,
        icone: '🚚',
        meta: { livraison_uuid: uid, numero_bon: numeroBon },
      });

      notifyChange();
      broadcastChange({ scope: 'livraisons', ts: Date.now() });

      return { success: true, uuid: uid, numero_bon: numeroBon };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('livraisons:getAll', () => {
    return db.prepare(`
      SELECT l.*,
        v.numero_ticket,
        COALESCE(v.total_ttc, l.montant_total) AS total_ttc,
        v.date_vente,
        v.mode_paiement,
        v.montant_paye,
        v.monnaie_rendue,
        COALESCE(v.nom_caissier, l.operateur_creation) AS caissier_vente
      FROM livraisons l
      LEFT JOIN ventes v ON v.uuid = NULLIF(TRIM(l.vente_uuid), '')
      ORDER BY
        CASE l.statut
          WHEN 'en_attente' THEN 0
          WHEN 'en_cours' THEN 1
          WHEN 'termine' THEN 2
          WHEN 'annule' THEN 3
          ELSE 4
        END,
        COALESCE(l.date_prevue, '') DESC,
        l.rowid DESC
      LIMIT 500
    `).all();
  });

  ipcMain.handle('livraisons:getBonDetail', (e, id) => {
    const liv = db.prepare('SELECT * FROM livraisons WHERE uuid = ? OR id = ?').get(id, id);
    if (!liv) return null;
    if (isPendingVente(liv)) {
      let snap = {};
      try { snap = JSON.parse(liv.snapshot_json || '{}'); } catch { snap = {}; }
      const vente = venteFromSnapshot(liv, snap);
      return { livraison: liv, vente };
    }
    const vente = db.prepare('SELECT * FROM ventes WHERE uuid = ?').get(liv.vente_uuid);
    if (!vente) return null;
    vente.lignes = db.prepare('SELECT * FROM lignes_vente WHERE vente_uuid = ? ORDER BY rowid').all(liv.vente_uuid);
    return { livraison: liv, vente };
  });

  function finalizeLivraisonTx(livRow, operateur) {
    if (!isPendingVente(livRow)) {
      return { ok: false, message: 'Livraison déjà finalisée' };
    }
    let snap = {};
    try { snap = JSON.parse(livRow.snapshot_json || '{}'); } catch { snap = {}; }
    if (!snap.lignes || !snap.lignes.length) {
      return { ok: false, message: 'Snapshot livraison invalide' };
    }

    const venteData = {
      nom_caissier: snap.nom_caissier,
      total_ttc: snap.total_ttc,
      mode_paiement: snap.mode_paiement || 'CASH',
      montant_paye: snap.montant_paye !== undefined && snap.montant_paye !== null ? snap.montant_paye : snap.total_ttc,
      monnaie_rendue: snap.monnaie_rendue || 0,
      table_numero: snap.table_numero || null,
      note: snap.note || null,
      lignes: snap.lignes,
    };
    const fraisLiv = parseFloat(snap.frais_livraison) || 0;

    const run = db.transaction(() => {
      const r = insertVenteComplete(db, venteData);
      db.prepare(`
        UPDATE livraisons SET vente_uuid = ?, statut = 'termine', last_modified_at = ?, sync_status = 0
        WHERE uuid = ?
      `).run(r.vente_uuid, Date.now(), livRow.uuid);
      // Capital NOT adjusted here — it is accumulated through cloture
      return r;
    });

    const result = run();
    const op = (operateur || '').trim() || snap.nom_caissier || null;
    const bon = livRow.numero_bon || '';

    logAction(db, {
      categorie: 'VENTE',
      action: 'Vente créée (livraison terminée)',
      detail: `Ticket ${result.numero_ticket} — bon ${bon}${fraisLiv > 0 ? ` — frais livr. ${fraisLiv}` : ''}`,
      operateur: op,
      montant: venteData.total_ttc || 0,
      icone: '🛒',
    });
    logAction(db, {
      categorie: 'LIVRAISON',
      action: 'Livraison terminée — vente enregistrée (via clôture)',
      detail: `Bon ${bon} → Ticket ${result.numero_ticket}`,
      operateur: op,
      montant: venteData.total_ttc || 0,
      icone: '✅',
      meta: { livraison_uuid: livRow.uuid, vente_uuid: result.vente_uuid, frais_livraison: fraisLiv },
    });

    notifyChange();
    broadcastChange({ scope: 'stock', ts: Date.now() });
    broadcastChange({ scope: 'cuisine', ts: Date.now() });
    broadcastChange({ scope: 'livraisons', ts: Date.now() });

    return { ok: true, numero_ticket: result.numero_ticket, vente_uuid: result.vente_uuid };
  }

  ipcMain.handle('livraisons:updateStatut', (e, id, statut, operateur) => {
    if (!['en_attente', 'en_cours', 'termine'].includes(statut)) {
      return { success: false, message: 'Statut invalide' };
    }
    try {
      const liv = db.prepare('SELECT * FROM livraisons WHERE uuid = ? OR id = ?').get(id, id);
      if (!liv) return { success: false, message: 'Livraison introuvable' };
      if (liv.statut === 'annule') {
        return { success: false, message: 'Livraison annulée' };
      }
      if (liv.statut === 'termine') {
        return { success: false, message: 'Livraison terminée — statut figé' };
      }
      const op = (operateur || '').trim() || null;

      if (statut === 'termine') {
        if (isPendingVente(liv)) {
          const fin = finalizeLivraisonTx(liv, op);
          if (!fin.ok) return { success: false, message: fin.message };
          return { success: true, finalized: true, numero_ticket: fin.numero_ticket };
        }
        db.prepare(`
          UPDATE livraisons SET statut = 'termine', last_modified_at = ?, sync_status = 0
          WHERE uuid = ?
        `).run(Date.now(), liv.uuid);
        logAction(db, {
          categorie: 'LIVRAISON',
          action: 'Livraison marquée terminée',
          detail: `Bon ${liv.numero_bon || liv.uuid} (vente déjà enregistrée)`,
          operateur: op,
          montant: liv.montant_total || null,
          icone: '✅',
        });
        broadcastChange({ scope: 'livraisons', ts: Date.now() });
        notifyChange();
        return { success: true, finalized: false };
      }

      db.prepare(`
        UPDATE livraisons SET statut = ?, last_modified_at = ?, sync_status = 0
        WHERE uuid = ?
      `).run(statut, Date.now(), liv.uuid);

      const labels = { en_attente: 'En attente', en_cours: 'En cours' };
      logAction(db, {
        categorie: 'LIVRAISON',
        action: `Statut livraison : ${labels[statut] || statut}`,
        detail: `Bon ${liv.numero_bon || liv.uuid}`,
        operateur: op,
        montant: liv.montant_total || null,
        icone: '📌',
      });

      broadcastChange({ scope: 'livraisons', ts: Date.now() });
      notifyChange();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('livraisons:annuler', (e, id, operateur) => {
    try {
      const liv = db.prepare('SELECT * FROM livraisons WHERE uuid = ? OR id = ?').get(id, id);
      if (!liv) return { success: false, message: 'Livraison introuvable' };
      if (liv.statut === 'termine') {
        return { success: false, message: 'Une livraison terminée ne peut pas être annulée' };
      }
      if (!isPendingVente(liv)) {
        return { success: false, message: 'Cette livraison est déjà liée à une vente en caisse.' };
      }
      if (liv.statut === 'annule') {
        return { success: false, message: 'Déjà annulée' };
      }

      const op = (operateur || '').trim() || null;
      db.prepare(`
        UPDATE livraisons SET statut = 'annule', last_modified_at = ?, sync_status = 0
        WHERE uuid = ?
      `).run(Date.now(), liv.uuid);

      logAction(db, {
        categorie: 'LIVRAISON',
        action: 'Livraison annulée',
        detail: `Bon ${liv.numero_bon || liv.uuid}`,
        operateur: op,
        montant: liv.montant_total || null,
        icone: '❌',
      });

      broadcastChange({ scope: 'livraisons', ts: Date.now() });
      notifyChange();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('livraisons:decaler', (e, id, data, operateur) => {
    try {
      const liv = db.prepare('SELECT * FROM livraisons WHERE uuid = ? OR id = ?').get(id, id);
      if (!liv) return { success: false, message: 'Livraison introuvable' };
      if (liv.statut === 'termine') {
        return { success: false, message: 'Une livraison terminée ne peut pas être décalée' };
      }
      if (!isPendingVente(liv)) {
        return { success: false, message: 'Cette livraison est déjà liée à une vente en caisse.' };
      }
      if (liv.statut === 'annule') {
        return { success: false, message: 'Livraison annulée' };
      }

      const date_prevue = (data?.date_prevue || '').trim();
      const heure_prevue = (data?.heure_prevue || '').trim();
      if (!date_prevue || !heure_prevue) {
        return { success: false, message: 'Date et heure requises' };
      }

      const oldD = liv.date_prevue || '';
      const oldH = liv.heure_prevue || '';
      const op = (operateur || '').trim() || null;

      let snapStr = liv.snapshot_json || '{}';
      try {
        const snap = JSON.parse(snapStr);
        if (snap.livraison) {
          snap.livraison.date_prevue = date_prevue;
          snap.livraison.heure_prevue = heure_prevue;
        }
        snapStr = JSON.stringify(snap);
      } catch { snapStr = liv.snapshot_json || '{}'; }

      db.prepare(`
        UPDATE livraisons SET date_prevue = ?, heure_prevue = ?, snapshot_json = ?, last_modified_at = ?, sync_status = 0
        WHERE uuid = ?
      `).run(date_prevue, heure_prevue, snapStr, Date.now(), liv.uuid);

      logAction(db, {
        categorie: 'LIVRAISON',
        action: 'Livraison décalée',
        detail: `Bon ${liv.numero_bon || liv.uuid} : ${oldD} ${oldH} → ${date_prevue} ${heure_prevue}`,
        operateur: op,
        icone: '📅',
      });

      broadcastChange({ scope: 'livraisons', ts: Date.now() });
      notifyChange();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
};
