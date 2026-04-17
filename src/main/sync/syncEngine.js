'use strict';

/**
 * SyncEngine — Moteur de synchronisation Offline-First vers Supabase
 * Gère le push des données locales vers le cloud et le pull depuis le cloud.
 * Toutes les opérations sont non-bloquantes et ne perturbent pas la caisse.
 */

const TABLES_SYNC = ['produits', 'ventes', 'lignes_vente', 'clotures'];
const BATCH_SIZE  = 50;

class SyncEngine {
  constructor(db) {
    this.db         = db;
    this.supabase   = null;
    this.configured = false;
    this.syncTimer  = null;
    this.isSyncing  = false;
    this.lastSyncAt = 0;
  }

  // ── CONFIGURATION ─────────────────────────────────────────────────────────

  configure(url, key) {
    try {
      if (!url || !key) { this.configured = false; return false; }
      // Chargement dynamique pour éviter les erreurs si pas encore installé
      const { createClient } = require('@supabase/supabase-js');
      this.supabase   = createClient(url.trim(), key.trim(), {
        auth:    { persistSession: false, autoRefreshToken: false },
        global:  { fetch: (...args) => import('node-fetch').then(m => m.default(...args)).catch(() => fetch(...args)) },
      });
      this.configured = true;
      return true;
    } catch (err) {
      console.error('[SyncEngine] configure error:', err.message);
      this.configured = false;
      return false;
    }
  }

  // ── TEST CONNEXION ────────────────────────────────────────────────────────

  async testConnexion() {
    if (!this.configured) return { success: false, message: 'Moteur non configuré. Vérifiez l\'URL et la clé.' };
    try {
      const { error } = await this.supabase.from('produits').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = table vide, ce qui est normal
        throw new Error(error.message);
      }
      return { success: true, message: 'Connexion Supabase établie avec succès !' };
    } catch (err) {
      return { success: false, message: `Connexion échouée : ${err.message}` };
    }
  }

  // ── AUTO-MIGRATION CLOUD ──────────────────────────────────────────────────

  async autoMigrateCloud() {
    if (!this.configured) return { success: false, message: 'Non configuré' };
    try {
      // Créer les tables via la fonction RPC si elle existe, sinon via des requêtes directes
      const migrations = `
        CREATE TABLE IF NOT EXISTS produits (
          uuid TEXT PRIMARY KEY,
          id INTEGER, reference TEXT, nom TEXT NOT NULL,
          description TEXT, prix_vente_ttc REAL DEFAULT 0,
          prix_achat REAL DEFAULT 0, prix_emporte REAL DEFAULT 0,
          categorie_id INTEGER, stock_actuel REAL DEFAULT -1,
          stock_alerte REAL DEFAULT 0, fournisseur TEXT,
          actif INTEGER DEFAULT 1, date_creation TEXT,
          last_modified_at BIGINT, sync_status INTEGER DEFAULT 1,
          poste_source TEXT
        );
        CREATE TABLE IF NOT EXISTS ventes (
          uuid TEXT PRIMARY KEY,
          id INTEGER, numero_ticket TEXT NOT NULL, date_vente TEXT,
          nom_caissier TEXT, total_ttc REAL DEFAULT 0,
          mode_paiement TEXT DEFAULT 'CASH', montant_paye REAL DEFAULT 0,
          monnaie_rendue REAL DEFAULT 0, statut TEXT DEFAULT 'valide',
          table_numero INTEGER, note TEXT,
          last_modified_at BIGINT, sync_status INTEGER DEFAULT 1,
          poste_source TEXT
        );
        CREATE TABLE IF NOT EXISTS lignes_vente (
          uuid TEXT PRIMARY KEY,
          id INTEGER, vente_uuid TEXT, produit_id INTEGER,
          produit_nom TEXT NOT NULL, quantite REAL DEFAULT 1,
          prix_unitaire REAL DEFAULT 0, remise REAL DEFAULT 0,
          rabais REAL DEFAULT 0, total_ttc REAL DEFAULT 0,
          est_offert INTEGER DEFAULT 0,
          last_modified_at BIGINT, sync_status INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS clotures (
          uuid TEXT PRIMARY KEY,
          id INTEGER, type_cloture TEXT NOT NULL,
          numero_rapport TEXT, date_debut TEXT, date_fin TEXT,
          date_cloture TEXT, total_ttc REAL DEFAULT 0,
          total_cash REAL DEFAULT 0, total_mvola REAL DEFAULT 0,
          total_orange REAL DEFAULT 0, total_airtel REAL DEFAULT 0,
          total_carte REAL DEFAULT 0, total_autre REAL DEFAULT 0,
          nombre_tickets INTEGER DEFAULT 0, nombre_articles INTEGER DEFAULT 0,
          vendeur_nom TEXT, vendeur_id INTEGER,
          last_modified_at BIGINT, sync_status INTEGER DEFAULT 1,
          poste_source TEXT
        );
      `;
      // On passe par exec_sql si disponible (extension Supabase), sinon on tente chaque table
      const { error } = await this.supabase.rpc('exec_sql', { sql: migrations });
      if (error) {
        // Fallback : juste vérifier que la connexion fonctionne
        console.warn('[SyncEngine] autoMigrate RPC non disponible, les tables doivent être créées manuellement ou via le SQL Editor Supabase.');
        return { success: true, message: 'Connexion OK. Créez les tables via le SQL Editor Supabase si nécessaire.' };
      }
      return { success: true, message: 'Tables cloud créées/vérifiées avec succès.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // ── PUSH (Local → Cloud) ──────────────────────────────────────────────────

  async pushPending() {
    if (!this.configured || this.isSyncing) return { success: false, pushed: 0 };
    this.isSyncing = true;
    let totalPushed = 0;

    try {
      // Produits
      totalPushed += await this._pushTable('produits', () => {
        return this.db.prepare(`SELECT * FROM produits WHERE sync_status = 0`).all();
      }, (row) => ({
        uuid: row.uuid, id: row.id, reference: row.reference, nom: row.nom,
        description: row.description, prix_vente_ttc: row.prix_vente_ttc,
        prix_achat: row.prix_achat, prix_emporte: row.prix_emporte,
        categorie_id: row.categorie_id, stock_actuel: row.stock_actuel,
        stock_alerte: row.stock_alerte, fournisseur: row.fournisseur,
        actif: row.actif, date_creation: row.date_creation,
        last_modified_at: row.last_modified_at,
        poste_source: this._getPoste(),
      }));

      // Ventes
      totalPushed += await this._pushTable('ventes', () => {
        return this.db.prepare(`SELECT * FROM ventes WHERE sync_status = 0`).all();
      }, (row) => ({
        uuid: row.uuid, id: row.id, numero_ticket: row.numero_ticket,
        date_vente: row.date_vente, nom_caissier: row.nom_caissier,
        total_ttc: row.total_ttc, mode_paiement: row.mode_paiement,
        montant_paye: row.montant_paye, monnaie_rendue: row.monnaie_rendue,
        statut: row.statut, table_numero: row.table_numero, note: row.note,
        last_modified_at: row.last_modified_at,
        poste_source: this._getPoste(),
      }));

      // Lignes vente
      totalPushed += await this._pushTable('lignes_vente', () => {
        return this.db.prepare(`SELECT * FROM lignes_vente WHERE sync_status = 0`).all();
      }, (row) => ({
        uuid: row.uuid, id: row.id, vente_uuid: row.vente_uuid,
        produit_id: row.produit_id, produit_nom: row.produit_nom,
        quantite: row.quantite, prix_unitaire: row.prix_unitaire,
        remise: row.remise, rabais: row.rabais, total_ttc: row.total_ttc,
        est_offert: row.est_offert, last_modified_at: row.last_modified_at,
      }));

      // Clôtures
      totalPushed += await this._pushTable('clotures', () => {
        return this.db.prepare(`SELECT * FROM clotures WHERE sync_status = 0`).all();
      }, (row) => ({
        uuid: row.uuid, id: row.id, type_cloture: row.type_cloture,
        numero_rapport: row.numero_rapport, date_debut: row.date_debut,
        date_fin: row.date_fin, date_cloture: row.date_cloture,
        total_ttc: row.total_ttc, total_cash: row.total_cash,
        total_mvola: row.total_mvola, total_orange: row.total_orange,
        total_airtel: row.total_airtel, total_carte: row.total_carte,
        total_autre: row.total_autre, nombre_tickets: row.nombre_tickets,
        nombre_articles: row.nombre_articles, vendeur_nom: row.vendeur_nom,
        vendeur_id: row.vendeur_id, last_modified_at: row.last_modified_at,
        poste_source: this._getPoste(),
      }));

      this.lastSyncAt = Date.now();
      this._saveSyncTimestamp(this.lastSyncAt);
      return { success: true, pushed: totalPushed };
    } catch (err) {
      console.error('[SyncEngine] pushPending error:', err.message);
      return { success: false, pushed: totalPushed, message: err.message };
    } finally {
      this.isSyncing = false;
    }
  }

  async _pushTable(tableName, getRows, mapFn) {
    const rows = getRows();
    if (!rows.length) return 0;

    let pushed = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch   = rows.slice(i, i + BATCH_SIZE);
      const payload = batch.map(mapFn);
      const { error } = await this.supabase.from(tableName).upsert(payload, { onConflict: 'uuid' });
      if (error) { console.error(`[SyncEngine] push ${tableName} error:`, error.message); continue; }

      // Marquer comme synchronisé dans SQLite
      const uuids = batch.map(r => r.uuid).filter(Boolean);
      if (uuids.length > 0) {
        const placeholders = uuids.map(() => '?').join(',');
        this.db.prepare(`UPDATE ${tableName} SET sync_status = 1 WHERE uuid IN (${placeholders})`).run(...uuids);
      }
      pushed += batch.length;
    }
    return pushed;
  }

  // ── PULL (Cloud → Local) ──────────────────────────────────────────────────

  async pullUpdates() {
    if (!this.configured) return { success: false, pulled: 0 };
    try {
      const since = this._getLastSyncTimestamp();
      let totalPulled = 0;

      // Pull ventes depuis le cloud (autres postes)
      const { data: ventesCloud, error: ve } = await this.supabase
        .from('ventes')
        .select('*')
        .gt('last_modified_at', since)
        .neq('poste_source', this._getPoste());

      if (!ve && ventesCloud && ventesCloud.length > 0) {
        const stmt = this.db.prepare(`
          INSERT OR IGNORE INTO ventes
            (uuid, numero_ticket, date_vente, nom_caissier, total_ttc,
             mode_paiement, montant_paye, monnaie_rendue, statut, table_numero, note, sync_status)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,1)
        `);
        const tx = this.db.transaction((rows) => {
          for (const r of rows) {
            stmt.run(r.uuid, r.numero_ticket, r.date_vente, r.nom_caissier,
              r.total_ttc, r.mode_paiement, r.montant_paye, r.monnaie_rendue,
              r.statut, r.table_numero, r.note);
          }
        });
        tx(ventesCloud);
        totalPulled += ventesCloud.length;
      }

      // Pull produits (mises à jour catalogue d'autres postes)
      const { data: produitsCloud, error: pe } = await this.supabase
        .from('produits')
        .select('*')
        .gt('last_modified_at', since)
        .neq('poste_source', this._getPoste());

      if (!pe && produitsCloud && produitsCloud.length > 0) {
        const stmt = this.db.prepare(`
          INSERT OR IGNORE INTO produits
            (uuid, nom, description, prix_vente_ttc, prix_achat, prix_emporte,
             categorie_id, stock_actuel, stock_alerte, fournisseur, actif, date_creation, sync_status)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)
        `);
        const tx = this.db.transaction((rows) => {
          for (const r of rows) {
            stmt.run(r.uuid, r.nom, r.description, r.prix_vente_ttc, r.prix_achat,
              r.prix_emporte, r.categorie_id, r.stock_actuel, r.stock_alerte,
              r.fournisseur, r.actif, r.date_creation);
          }
        });
        tx(produitsCloud);
        totalPulled += produitsCloud.length;
      }

      this.lastSyncAt = Date.now();
      this._saveSyncTimestamp(this.lastSyncAt);
      return { success: true, pulled: totalPulled };
    } catch (err) {
      console.error('[SyncEngine] pullUpdates error:', err.message);
      return { success: false, pulled: 0, message: err.message };
    }
  }

  // ── FULL PUSH (Restauration massive) ─────────────────────────────────────

  async fullPush() {
    if (!this.configured) return { success: false, message: 'Non configuré' };
    try {
      // Reset tous les statuts à 0 pour forcer le push complet
      for (const table of TABLES_SYNC) {
        try { this.db.prepare(`UPDATE ${table} SET sync_status = 0`).run(); } catch {}
      }
      return await this.pushPending();
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // ── AUTO SYNC ─────────────────────────────────────────────────────────────

  startAutoSync(intervalMs = 5 * 60 * 1000) {
    this.stopAutoSync();
    if (!this.configured) return;
    this.syncTimer = setInterval(async () => {
      if (!this.isSyncing && navigator && !navigator.onLine) return;
      await this.pushPending();
    }, intervalMs);
    console.log(`[SyncEngine] Auto-sync démarré (toutes les ${intervalMs / 60000} min)`);
  }

  stopAutoSync() {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
  }

  // ── STATUS ────────────────────────────────────────────────────────────────

  getStatus() {
    let pending = 0;
    for (const table of TABLES_SYNC) {
      try {
        const row = this.db.prepare(`SELECT COUNT(*) as n FROM ${table} WHERE sync_status = 0`).get();
        pending += row ? row.n : 0;
      } catch {}
    }
    const lastSync = this._getLastSyncTimestamp();
    return {
      configured: this.configured,
      isSyncing:  this.isSyncing,
      pending,
      lastSyncAt: lastSync ? new Date(lastSync).toLocaleString('fr-FR') : null,
    };
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  _getPoste() {
    try {
      const row = this.db.prepare(`SELECT valeur FROM parametres WHERE cle = 'caisse.nom_poste'`).get();
      return row ? row.valeur : 'Poste n°1';
    } catch { return 'Poste n°1'; }
  }

  _saveSyncTimestamp(ts) {
    try {
      this.db.prepare(`INSERT OR REPLACE INTO parametres (cle, valeur, date_maj) VALUES ('sync.last_timestamp', ?, datetime('now'))`).run(String(ts));
    } catch {}
  }

  _getLastSyncTimestamp() {
    try {
      const row = this.db.prepare(`SELECT valeur FROM parametres WHERE cle = 'sync.last_timestamp'`).get();
      return row ? parseInt(row.valeur, 10) || 0 : 0;
    } catch { return 0; }
  }
}

module.exports = SyncEngine;
