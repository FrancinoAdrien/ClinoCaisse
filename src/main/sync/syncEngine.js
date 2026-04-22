const fs   = require('fs');
const path = require('path');

const TABLES_SYNC = [
  'utilisateurs', 'categories', 'produits', 'ventes', 'lignes_vente', 'clotures',
  'stock_lots', 'stock_transferts', 'clients', 'credits_paiements',
  'fournisseurs', 'achats', 'reservations', 'depenses', 'employes',
  'creances_clients', 'salaires_paiements', 'livraisons',
  'recettes_lignes', 'flux_tresorerie', 'reservations_terrain',
  'tickets_table', 'tables_config', 'parametres', 'stock_historique', 'journal_activite', 'espaces'
];
const BATCH_SIZE  = 50;

class SyncEngine {
  constructor(db) {
    this.db         = db;
    this.supabase   = null;
    this.configured = false;
    this.syncTimer  = null;
    this.realtimeChannel = null;
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

  async uploadAsset({ data, bucket = 'clinocaisse-assets', path: objectPath, contentType = 'application/octet-stream' }) {
    if (!this.configured || !this.supabase) {
      return { success: false, message: 'Synchronisation cloud non configurée.' };
    }
    if (!data || !objectPath) {
      return { success: false, message: 'Fichier invalide.' };
    }
    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .upload(objectPath, data, { contentType, upsert: true, cacheControl: '3600' });
      if (error) {
        if (String(error.message || '').toLowerCase().includes('bucket')) {
          return { success: false, message: `Bucket Supabase introuvable: "${bucket}". Créez-le en mode public dans Storage.` };
        }
        return { success: false, message: error.message };
      }
      const { data: pub } = this.supabase.storage.from(bucket).getPublicUrl(objectPath);
      return { success: true, url: pub?.publicUrl || null, bucket, path: objectPath };
    } catch (err) {
      return { success: false, message: err.message };
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

  // ── ENVOYER LES TABLES (DEPUIS LE FICHIER SQL) ──────────────────────────
  async sendTables() {
    if (!this.configured) return { success: false, message: 'Non configuré' };
    try {
      const schemaPath = path.join(process.cwd(), 'supabase_schema.sql');
      if (!fs.existsSync(schemaPath)) {
        return { success: false, message: 'Fichier supabase_schema.sql introuvable.' };
      }
      const sql = fs.readFileSync(schemaPath, 'utf8');
      
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      if (error) {
        if (error.message.includes('exec_sql')) {
          return { 
            success: false, 
            code: 'MISSING_RPC', 
            message: 'La fonction système exec_sql est manquante sur Supabase.' 
          };
        }
        throw new Error(error.message);
      }

      return { success: true, message: 'Schéma Supabase mis à jour avec succès.' };
    } catch (err) {
      console.error('[SyncEngine] sendTables error:', err.message);
      return { success: false, message: err.message };
    }
  }

  // ── PUSH (Local → Cloud) ──────────────────────────────────────────────────

  async pushPending() {
    if (!this.configured || this.isSyncing) return { success: false, pushed: 0 };
    this.isSyncing = true;
    let totalPushed = 0;

    try {
      for (const table of TABLES_SYNC) {
        totalPushed += await this._pushTable(table);
      }

      this.lastSyncAt = Date.now();
      this._saveSyncTimestamp(this.lastSyncAt);
      return { success: true, pushed: totalPushed };
    } catch (err) {
      if (!err.message.includes('fetch failed') && !err.message.includes('Failed to fetch')) {
        console.error('[SyncEngine] pushPending error:', err.message);
      }
      return { success: false, pushed: totalPushed, message: err.message };
    } finally {
      this.isSyncing = false;
    }
  }

  async _pushTable(tableName) {
    let rows = [];
    try {
      rows = this.db.prepare(`SELECT * FROM ${tableName} WHERE sync_status = 0`).all();
    } catch (err) {
      return 0; // Table manquante ou sans sync_status
    }
    if (!rows.length) return 0;

    const posteSource = this._getPoste();
    const crypto = require('crypto');
    let pushed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch   = rows.slice(i, i + BATCH_SIZE);
      const payload = batch.map(row => {
        // Gérer le poste source
        if ('poste_source' in row && !row.poste_source) {
          row.poste_source = posteSource;
        }

        // Injecter le timestamp réel pour Supabase si manquant ou à 0
        if (!row.last_modified_at) {
           row.last_modified_at = Date.now();
        }
        
        // Gérer l'absence d'UUID (anciennes données locales)
        if (!row.uuid) {
          row.uuid = crypto.randomUUID();
          if (row.id) {
            try { this.db.prepare(`UPDATE ${tableName} SET uuid = ? WHERE id = ?`).run(row.uuid, row.id); } catch(e) {}
          }
        }

        // Nettoyer les colonnes purement locales non présentes dans le Cloud
        // ou dont la valeur nulle provoquerait des erreurs de contrainte côté Supabase
        if ('image_data' in row) delete row.image_data;
        // Colonne locale ajoutée pour l'UI de réservation, non présente sur certains schémas cloud
        if ('duree_heures' in row) delete row.duree_heures;
        // On n'envoie JAMAIS l'id local (SQLite AUTOINCREMENT) — uuid est la PK cloud
        delete row.id;

        return row;
      });

      const { error } = await this.supabase.from(tableName).upsert(payload, { onConflict: 'uuid' });
      if (error) { console.error(`[SyncEngine] push ${tableName} error:`, error.message); continue; }

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
      const poste = this._getPoste();

      for (const table of TABLES_SYNC) {
        let tablePulled = 0;
        try {
          // Analyser la structure locale
          const info = this.db.prepare(`PRAGMA table_info(${table})`).all();
          if (!info || info.length === 0) continue;
          
          const columns = info.map(c => c.name);
          const hasPosteSource = columns.includes('poste_source');

          // Étaler le since pour pallier d'éventuels décalages d'horloge entre terminaux
          let query = this.supabase.from(table).select('*').gt('last_modified_at', Math.max(0, since - 300000));
          
          // N'exclure le poste source QUE si ce n'est pas une récupération totale (since > 0)
          // Si since == 0, on veut TOUT récupérer, même nos propres données (Restauration).
          if (hasPosteSource && since > 0) {
            query = query.neq('poste_source', poste);
          }
          
          const { data, error } = await query;
          if (error) { console.error(`[SyncEngine] pull ${table} error:`, error.message); continue; }

          if (data && data.length > 0) {
            const getStmt = this.db.prepare(`SELECT uuid FROM ${table} WHERE uuid = ?`);

            const tx = this.db.transaction((rows) => {
              for (const r of rows) {
                // Forcer statut local à synchronisé
                if ('sync_status' in r) r.sync_status = 1;
                
                let existing = getStmt.get(r.uuid);
                
                // Gérer les clés d'unicité pour les paramètres
                if (!existing && table === 'parametres' && r.cle) {
                  const byCle = this.db.prepare(`SELECT uuid FROM parametres WHERE cle = ?`).get(r.cle);
                  if (byCle) {
                    // Si on le trouve par clé mais pas par UUID, c'est que l'installation locale a généré
                    // un uuid différent pour une clé par défaut (ex: license.activated). On supprime l'ancien.
                    this.db.prepare(`DELETE FROM parametres WHERE uuid = ?`).run(byCle.uuid);
                  }
                }
                
                // Extraire uniquement les clés qui existent vraiment de part et d'autre pour ne pas injecter null
                const validKeys = Object.keys(r).filter(k => columns.includes(k));

                if (existing) {
                  const updateCols = validKeys.filter(c => c !== 'id' && c !== 'uuid');
                  if (updateCols.length === 0) continue;
                  
                  const setString = updateCols.map(c => `${c} = ?`).join(', ');
                  const values = updateCols.map(c => r[c]);
                  this.db.prepare(`UPDATE ${table} SET ${setString} WHERE uuid = ?`).run(...values, r.uuid);
                } else {
                  const insertCols = validKeys.filter(c => c !== 'id');
                  if (insertCols.length === 0) continue;
                  
                  const placeholders = insertCols.map(() => '?').join(', ');
                  const values = insertCols.map(c => r[c]);
                  // Utiliser INSERT OR REPLACE pour éviter les erreurs "UNIQUE constraint failed" sur les clés comme parametres.cle
                  this.db.prepare(`INSERT OR REPLACE INTO ${table} (${insertCols.join(', ')}) VALUES (${placeholders})`).run(...values);
                }
              }
            });
            tx(data);
            tablePulled += data.length;
          }
        } catch (e) {
          console.error(`[SyncEngine] pull tx error on ${table}:`, e.message);
        }
        totalPulled += tablePulled;
      }

      this.lastSyncAt = Date.now();
      this._saveSyncTimestamp(this.lastSyncAt);
      return { success: true, pulled: totalPulled };
    } catch (err) {
      if (!err.message.includes('fetch failed') && !err.message.includes('Failed to fetch')) {
        console.error('[SyncEngine] pullUpdates error:', err.message);
      }
      return { success: false, pulled: 0, message: err.message };
    }
  }

  // ── PULL TOTAL (Restauration massive depuis le Cloud) ───────────────────

  async fullPull() {
    if (!this.configured) return { success: false, message: 'Non configuré' };
    try {
      this._saveSyncTimestamp(0);
      const res = await this.pullUpdates();
      return { success: res.success, pulled: res.pulled, message: res.message };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // ── FULL PUSH (Restauration massive vers le Cloud) ───────────────────────

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

  // ── AUTO SYNC (Temps Réel) ────────────────────────────────────────────────

  _setupRealtime() {
    if (this.realtimeChannel && this.supabase) {
      try { this.supabase.removeChannel(this.realtimeChannel); } catch(e) {}
    }
    this.realtimeChannel = this.supabase.channel('public-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        // Déclencher le pull en cas de changement distant (Temps Réel)
        this.pullUpdates();
      })
      .subscribe();
  }

  startAutoSync(intervalMs = 3000) {
    this.stopAutoSync();
    if (!this.configured) return;
    this._setupRealtime();
    this.syncTimer = setInterval(async () => {
      // Ignorer l'erreur réseau globale pour Electron onLine si indisponible
      if (!this.isSyncing) await this.pushPending();
    }, intervalMs);
    console.log(`[SyncEngine] Temps Réel et Radar (toutes les ${intervalMs} ms) activés.`);
  }

  // ── NOTIFICATION DE CHANGEMENT (Déclencheur Instantané) ─────────────────
  // Appeler cette méthode après chaque écriture locale pour déclencher un push immédiat
  notifyChange() {
    if (!this.configured || this.isSyncing) return;
    // Déclencher dans 500ms pour regrouper les écritures simultanées (ex: transaction)
    if (this._notifyTimer) clearTimeout(this._notifyTimer);
    this._notifyTimer = setTimeout(() => {
      this.pushPending().catch(() => {});
    }, 500);
  }

  stopAutoSync() {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
    if (this.realtimeChannel && this.supabase) {
      try { this.supabase.removeChannel(this.realtimeChannel); } catch(e) {}
      this.realtimeChannel = null;
    }
    console.log(`[SyncEngine] Temps Réel et Radar désactivés.`);
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
