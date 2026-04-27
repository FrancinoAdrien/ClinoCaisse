'use strict';

module.exports = function runMigrations(db) {
  db.exec(`
    -- ── UTILISATEURS ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS utilisateurs (
      uuid            TEXT PRIMARY KEY,
      id              INTEGER,
      nom             TEXT    NOT NULL,
      prenom          TEXT,
      pin             TEXT    NOT NULL,
      role            TEXT    NOT NULL DEFAULT 'employe',
      actif           INTEGER NOT NULL DEFAULT 1,
      theme           TEXT    DEFAULT 'default',
      perm_caisse     INTEGER NOT NULL DEFAULT 0,
      perm_utilisateur INTEGER NOT NULL DEFAULT 0,
      perm_parametres  INTEGER NOT NULL DEFAULT 0,
      perm_cloture    INTEGER NOT NULL DEFAULT 0,
      perm_stock      INTEGER NOT NULL DEFAULT 0,
      perm_remises    INTEGER NOT NULL DEFAULT 0,
      perm_grossiste   INTEGER NOT NULL DEFAULT 0,
      perm_depenses    INTEGER NOT NULL DEFAULT 0,
      perm_ressources  INTEGER NOT NULL DEFAULT 0,
      perm_achats      INTEGER NOT NULL DEFAULT 0,
      perm_reserv      INTEGER NOT NULL DEFAULT 0,
      date_creation   TEXT    DEFAULT (datetime('now')),
      date_modification TEXT  DEFAULT (datetime('now')),
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── CATEGORIES ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categories (
      uuid            TEXT PRIMARY KEY,
      id              INTEGER,
      code            TEXT    NOT NULL UNIQUE,
      nom             TEXT    NOT NULL,
      description     TEXT,
      ordre           INTEGER DEFAULT 0,
      parent_id       INTEGER,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── PRODUITS ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS produits (
      uuid            TEXT PRIMARY KEY,
      id              INTEGER,
      reference       TEXT,
      nom             TEXT    NOT NULL,
      description     TEXT,
      prix_vente_ttc  REAL    NOT NULL DEFAULT 0,
      prix_achat      REAL    DEFAULT 0,
      prix_emporte    REAL    DEFAULT 0,
      categorie_id    INTEGER,
      stock_actuel    REAL    NOT NULL DEFAULT -1,
      stock_bar       REAL    NOT NULL DEFAULT 0,
      stock_alerte    REAL    DEFAULT 0,
      stock_alerte_grossiste REAL DEFAULT 0,
      fournisseur     TEXT,
      image_data      BLOB,
      actif           INTEGER NOT NULL DEFAULT 1,
      prix_gros        REAL DEFAULT 0,
      unite_base       TEXT DEFAULT 'Unité',
      unite_carton_qte REAL DEFAULT 1,
      unite_pack_qte   REAL DEFAULT 1,
      stock_grossiste  REAL DEFAULT 0,
      is_alcool        INTEGER DEFAULT 0,
      is_ingredient    INTEGER DEFAULT 0,
      is_prepared      INTEGER DEFAULT 0,
      date_creation   TEXT    DEFAULT (datetime('now')),
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── VENTES ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ventes (
      uuid            TEXT PRIMARY KEY,
      id              INTEGER,
      numero_ticket   TEXT    NOT NULL,
      date_vente      TEXT    NOT NULL DEFAULT (datetime('now')),
      nom_caissier    TEXT,
      total_ttc       REAL    NOT NULL DEFAULT 0,
      mode_paiement   TEXT    DEFAULT 'CASH',
      montant_paye    REAL    DEFAULT 0,
      monnaie_rendue  REAL    DEFAULT 0,
      statut          TEXT    DEFAULT 'valide',
      table_numero    INTEGER,
      type_vente      TEXT    DEFAULT 'BAR',
      client_uuid     TEXT,
      note            TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── LIGNES VENTE ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS lignes_vente (
      uuid            TEXT PRIMARY KEY,
      id              INTEGER,
      vente_id        INTEGER,
      vente_uuid      TEXT,
      produit_id      INTEGER,
      produit_nom     TEXT    NOT NULL,
      quantite        REAL    NOT NULL DEFAULT 1,
      prix_unitaire   REAL    NOT NULL DEFAULT 0,
      remise          REAL    DEFAULT 0,
      rabais          REAL    DEFAULT 0,
      total_ttc       REAL    NOT NULL DEFAULT 0,
      est_offert      INTEGER DEFAULT 0,
      unite_choisie    TEXT    DEFAULT 'Unité',
      statut_cuisine   TEXT    DEFAULT 'servi',
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── TICKETS TABLE ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS tickets_table (
      uuid                TEXT PRIMARY KEY,
      id                  INTEGER,
      numero_table        INTEGER NOT NULL,
      nom_table           TEXT,
      nom_caissier        TEXT,
      date_creation       TEXT    DEFAULT (datetime('now')),
      date_modification   TEXT    DEFAULT (datetime('now')),
      montant_total       REAL    DEFAULT 0,
      lignes_json         TEXT    DEFAULT '[]',
      statut              TEXT    DEFAULT 'en_cours',
      last_modified_at    INTEGER DEFAULT 0,
      sync_status         INTEGER DEFAULT 1,
      poste_source        TEXT
    );

    -- ── CONFIG TABLES ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS tables_config (
      uuid          TEXT PRIMARY KEY,
      numero_table  INTEGER,
      ordre         INTEGER DEFAULT 0,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── CLÔTURES ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS clotures (
      uuid                TEXT PRIMARY KEY,
      id                  INTEGER,
      type_cloture        TEXT    NOT NULL,
      numero_rapport      TEXT,
      date_debut          TEXT,
      date_fin            TEXT,
      date_cloture        TEXT    DEFAULT (datetime('now')),
      total_ttc           REAL    DEFAULT 0,
      total_cash          REAL    DEFAULT 0,
      total_mvola         REAL    DEFAULT 0,
      total_orange        REAL    DEFAULT 0,
      total_airtel        REAL    DEFAULT 0,
      total_carte         REAL    DEFAULT 0,
      total_autre         REAL    DEFAULT 0,
      nombre_tickets      INTEGER DEFAULT 0,
      nombre_articles     INTEGER DEFAULT 0,
      vendeur_nom         TEXT,
      vendeur_id          INTEGER,
      total_compte        REAL    DEFAULT 0,
      prelevement         REAL    DEFAULT 0,
      fond_debut          REAL    DEFAULT 0,
      fond_fin            REAL    DEFAULT 0,
      ecart               REAL    DEFAULT 0,
      details_json        TEXT    DEFAULT '{}',
      last_modified_at    INTEGER DEFAULT 0,
      sync_status         INTEGER DEFAULT 1,
      poste_source        TEXT
    );

    -- ── PARAMÈTRES ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS parametres (
      uuid        TEXT PRIMARY KEY,
      cle         TEXT    UNIQUE,
      valeur      TEXT,
      date_maj    TEXT    DEFAULT (datetime('now')),
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── HISTORIQUE STOCK ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS stock_historique (
      uuid          TEXT PRIMARY KEY,
      id            INTEGER,
      produit_id    INTEGER,
      produit_nom   TEXT,
      ancienne_qte  REAL,
      nouvelle_qte  REAL,
      delta         REAL,
      motif         TEXT,
      operateur     TEXT,
      date_op       TEXT    DEFAULT (datetime('now')),
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── NOUVELLES TABLES V3 (GROSSISTE & LOUNGE) ────────────────────
    
    CREATE TABLE IF NOT EXISTS stock_lots (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      produit_uuid     TEXT NOT NULL,
      numero_lot       TEXT,
      date_expiration  TEXT,
      quantite_restante REAL DEFAULT 0,
      localisation     TEXT DEFAULT 'grossiste',
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_transferts (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      produit_uuid     TEXT NOT NULL,
      quantite         REAL,
      source           TEXT DEFAULT 'grossiste',
      destination      TEXT DEFAULT 'bar',
      date_transfert   TEXT,
      operateur        TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      nom              TEXT NOT NULL,
      contact          TEXT,
      adresse          TEXT,
      plafond_credit   REAL DEFAULT 0,
      dettes_actuelles REAL DEFAULT 0,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS credits_paiements (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      client_uuid      TEXT NOT NULL,
      montant          REAL NOT NULL,
      type_operation   TEXT DEFAULT 'remboursement',
      date_paiement    TEXT,
      operateur        TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS fournisseurs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      nom              TEXT NOT NULL,
      contact          TEXT,
      dettes_actuelles REAL DEFAULT 0,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS achats (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      fournisseur_uuid TEXT,
      total_ttc        REAL DEFAULT 0,
      statut           TEXT DEFAULT 'non_paye',
      date_achat       TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      client_nom       TEXT NOT NULL,
      client_tel       TEXT,
      date_reservation TEXT NOT NULL,
      nb_personnes     INTEGER DEFAULT 1,
      evenement        TEXT,
      table_numero     INTEGER,
      statut           TEXT DEFAULT 'en_attente',
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS depenses (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      categorie        TEXT,
      description      TEXT,
      montant          REAL NOT NULL,
      date_depense     TEXT,
      operateur        TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS employes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      nom              TEXT,
      poste            TEXT,
      salaire_base     REAL DEFAULT 0,
      date_embauche    TEXT,
      actif            INTEGER DEFAULT 1,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS creances_clients (
      uuid             TEXT PRIMARY KEY,
      id               INTEGER,
      client_nom       TEXT NOT NULL,
      montant          REAL NOT NULL,
      statut           TEXT DEFAULT 'en_attente',
      date_creation    TEXT,
      date_echeance    TEXT,
      description      TEXT,
      operateur        TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS salaires_paiements (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      employe_uuid     TEXT NOT NULL,
      type_paiement    TEXT,
      montant          REAL NOT NULL,
      date_paiement    TEXT,
      operateur        TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS livraisons (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      vente_uuid       TEXT NOT NULL,
      livreur_nom      TEXT,
      statut           TEXT DEFAULT 'en_cours',
      date_depart      TEXT,
      date_livraison   TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS recettes_lignes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      plat_uuid        TEXT NOT NULL,
      ingredient_uuid  TEXT NOT NULL,
      quantite_requise REAL NOT NULL,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    CREATE TABLE IF NOT EXISTS flux_tresorerie (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      type_flux        TEXT NOT NULL,
      montant          REAL NOT NULL,
      motif            TEXT,
      date_flux        TEXT DEFAULT (datetime('now')),
      operateur        TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0,
      poste_source     TEXT
    );

    -- ── JOURNAL D'ACTIVITÉ ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS journal_activite (
      uuid         TEXT PRIMARY KEY,
      id           INTEGER,
      date_action  TEXT    NOT NULL DEFAULT (datetime('now')),
      categorie    TEXT    NOT NULL,
      action       TEXT    NOT NULL,
      detail       TEXT,
      operateur    TEXT,
      montant      REAL,
      icone        TEXT,
      meta_json    TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── ESPACES (Terrain, Local, Salle, Maison, Autre) ──────────────────
    CREATE TABLE IF NOT EXISTS espaces (
      uuid          TEXT PRIMARY KEY,
      id            INTEGER,
      nom           TEXT    NOT NULL,
      type          TEXT    DEFAULT 'terrain',
      description   TEXT,
      tarif_heure   REAL    DEFAULT 0,
      actif         INTEGER DEFAULT 1,
      date_creation TEXT    DEFAULT (datetime('now')),
      type_tarif    TEXT    DEFAULT 'heure',
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );

    -- ── RÉSERVATIONS TERRAIN ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS reservations_terrain (
      uuid            TEXT PRIMARY KEY,
      id              INTEGER,
      client_nom      TEXT    NOT NULL,
      client_contact  TEXT,
      espace_id       INTEGER,
      date_debut      TEXT    NOT NULL,
      date_fin        TEXT    NOT NULL,
      montant_total   REAL    DEFAULT 0,
      montant_paye    REAL    DEFAULT 0,
      statut_paiement TEXT    DEFAULT 'en_attente',
      statut          TEXT    DEFAULT 'confirmee',
      note            TEXT,
      operateur       TEXT,
      date_creation   TEXT    DEFAULT (datetime('now')),
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 1,
      poste_source     TEXT
    );
  `);

  // ── COLONNES DE SYNCHRONISATION (migration incrémentale) ─────────────────
  // SQLite ne supporte pas ADD COLUMN IF NOT EXISTS → on utilise try/catch
  const syncCols = [
    // ── Table UTILISATEURS (Permissions V3)
    { table: 'utilisateurs', col: 'perm_grossiste',   def: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'utilisateurs', col: 'perm_depenses',    def: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'utilisateurs', col: 'perm_ressources',  def: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'utilisateurs', col: 'perm_achats',      def: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'utilisateurs', col: 'perm_reserv',      def: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'utilisateurs', col: 'uuid',             def: 'TEXT' },
    { table: 'utilisateurs', col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'utilisateurs', col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'utilisateurs', col: 'poste_source',     def: 'TEXT' },

    // ── Table CATEGORIES (Synchro + Parent)
    { table: 'categories',   col: 'uuid',             def: 'TEXT' },
    { table: 'categories',   col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'categories',   col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'categories',   col: 'poste_source',     def: 'TEXT' },
    { table: 'categories',   col: 'parent_id',        def: 'INTEGER' },

    // ── Table PRODUITS (Grossiste & Lots)
    { table: 'produits',     col: 'uuid',             def: 'TEXT' },
    { table: 'produits',     col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'produits',     col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'produits',     col: 'poste_source',     def: 'TEXT' },
    { table: 'produits',     col: 'prix_gros',        def: 'REAL DEFAULT 0' },
    { table: 'produits',     col: 'unite_base',       def: "TEXT DEFAULT 'Unité'" },
    { table: 'produits',     col: 'unite_carton_qte', def: 'REAL DEFAULT 1' },
    { table: 'produits',     col: 'unite_pack_qte',   def: 'REAL DEFAULT 1' },
    { table: 'produits',     col: 'stock_grossiste',  def: 'REAL DEFAULT 0' },
    { table: 'produits',     col: 'stock_alerte_grossiste', def: 'REAL DEFAULT 0' },
    { table: 'produits',     col: 'stock_bar',        def: 'REAL DEFAULT 0' },
    { table: 'produits',     col: 'is_alcool',        def: 'INTEGER DEFAULT 0' },
    { table: 'produits',     col: 'is_ingredient',    def: 'INTEGER DEFAULT 0' },
    { table: 'produits',     col: 'is_prepared',      def: 'INTEGER DEFAULT 0' },

    // ── Table VENTES (Client & Type)
    { table: 'ventes',       col: 'uuid',             def: 'TEXT' },
    { table: 'ventes',       col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'ventes',       col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'ventes',       col: 'poste_source',     def: 'TEXT' },
    { table: 'ventes',       col: 'type_vente',       def: "TEXT DEFAULT 'BAR'" },
    { table: 'ventes',       col: 'client_uuid',      def: 'TEXT' },

    // ── Table LIGNES_VENTE (Unité & Cuisine)
    { table: 'lignes_vente', col: 'uuid',             def: 'TEXT' },
    { table: 'lignes_vente', col: 'vente_uuid',       def: 'TEXT' },
    { table: 'lignes_vente', col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'lignes_vente', col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'lignes_vente', col: 'unite_choisie',    def: "TEXT DEFAULT 'Unité'" },
    { table: 'lignes_vente', col: 'statut_cuisine',   def: "TEXT DEFAULT 'servi'" },

    // ── Table CLOTURES
    { table: 'clotures',     col: 'uuid',             def: 'TEXT' },
    { table: 'clotures',     col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'clotures',     col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'clotures',     col: 'poste_source',     def: 'TEXT' },
    
    // ── Table ESPACES
    { table: 'espaces',      col: 'type_tarif',       def: "TEXT DEFAULT 'heure'" },

    // ── Table RESERVATIONS (Multi-tables, Durée & Arrivée client)
    { table: 'reservations', col: 'tables_json',      def: "TEXT DEFAULT '[]'" },
    { table: 'reservations', col: 'duree_heures',     def: 'REAL' },
    { table: 'reservations', col: 'montant_acompte',  def: 'REAL DEFAULT 0' },
    { table: 'reservations', col: 'client_arrive',    def: 'INTEGER DEFAULT 0' },
    { table: 'reservations', col: 'note_report',      def: 'TEXT' },
    { table: 'reservations', col: 'montant_report',   def: 'REAL DEFAULT 0' },
    { table: 'reservations', col: 'client_tel',       def: 'TEXT' },
    // ── Table EMPLOYES
    { table: 'employes',          col: 'actif',            def: 'INTEGER DEFAULT 1' },
    { table: 'employes',          col: 'mode_premier_salaire', def: "TEXT DEFAULT 'ce_mois'" },
    { table: 'employes',          col: 'montant_premier_salaire', def: 'REAL DEFAULT 0' },
    { table: 'employes',          col: 'premier_mois_paye', def: 'INTEGER DEFAULT 0' },
    // ── Table DEPENSES
    { table: 'depenses',          col: 'statut',           def: "TEXT DEFAULT 'payee'" },
    { table: 'depenses',          col: 'fournisseur_nom',  def: 'TEXT' },

    // ── Harmonisation Globale (21 Tables)
    { table: 'stock_lots',        col: 'uuid',             def: 'TEXT' },
    { table: 'stock_lots',        col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'stock_lots',        col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'stock_lots',        col: 'poste_source',     def: 'TEXT' },

    { table: 'stock_transferts',  col: 'uuid',             def: 'TEXT' },
    { table: 'stock_transferts',  col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'stock_transferts',  col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'stock_transferts',  col: 'poste_source',     def: 'TEXT' },

    { table: 'clients',           col: 'uuid',             def: 'TEXT' },
    { table: 'clients',           col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'clients',           col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'clients',           col: 'poste_source',     def: 'TEXT' },

    { table: 'credits_paiements',  col: 'uuid',             def: 'TEXT' },
    { table: 'credits_paiements',  col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'credits_paiements',  col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'credits_paiements',  col: 'poste_source',     def: 'TEXT' },

    { table: 'fournisseurs',      col: 'uuid',             def: 'TEXT' },
    { table: 'fournisseurs',      col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'fournisseurs',      col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'fournisseurs',      col: 'poste_source',     def: 'TEXT' },

    { table: 'achats',            col: 'uuid',             def: 'TEXT' },
    { table: 'achats',            col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'achats',            col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'achats',            col: 'poste_source',     def: 'TEXT' },

    { table: 'reservations',      col: 'uuid',             def: 'TEXT' },
    { table: 'reservations',      col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'reservations',      col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'reservations',      col: 'poste_source',     def: 'TEXT' },

    { table: 'depenses',          col: 'uuid',             def: 'TEXT' },
    { table: 'depenses',          col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'depenses',          col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'depenses',          col: 'poste_source',     def: 'TEXT' },

    { table: 'employes',          col: 'uuid',             def: 'TEXT' },
    { table: 'employes',          col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'employes',          col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'employes',          col: 'poste_source',     def: 'TEXT' },

    { table: 'creances_clients',  col: 'uuid',             def: 'TEXT' },
    { table: 'creances_clients',  col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'creances_clients',  col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'creances_clients',  col: 'poste_source',     def: 'TEXT' },

    { table: 'salaires_paiements', col: 'uuid',             def: 'TEXT' },
    { table: 'salaires_paiements', col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'salaires_paiements', col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'salaires_paiements', col: 'poste_source',     def: 'TEXT' },

    { table: 'livraisons',        col: 'uuid',             def: 'TEXT' },
    { table: 'livraisons',        col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'livraisons',        col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'livraisons',        col: 'poste_source',     def: 'TEXT' },

    { table: 'recettes_lignes',   col: 'uuid',             def: 'TEXT' },
    { table: 'recettes_lignes',   col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'recettes_lignes',   col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'recettes_lignes',   col: 'poste_source',     def: 'TEXT' },

    { table: 'flux_tresorerie',   col: 'uuid',             def: 'TEXT' },
    { table: 'flux_tresorerie',   col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'flux_tresorerie',   col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'flux_tresorerie',   col: 'poste_source',     def: 'TEXT' },

    { table: 'reservations_terrain', col: 'sync_status',   def: 'INTEGER DEFAULT 0' },
    { table: 'reservations_terrain', col: 'poste_source',  def: 'TEXT' },

    { table: 'tickets_table',     col: 'uuid',             def: 'TEXT' },
    { table: 'tickets_table',     col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'tickets_table',     col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'tickets_table',     col: 'poste_source',     def: 'TEXT' },

    { table: 'tables_config',     col: 'uuid',             def: 'TEXT' },
    { table: 'tables_config',     col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'tables_config',     col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'tables_config',     col: 'poste_source',     def: 'TEXT' },

    { table: 'parametres',        col: 'uuid',             def: 'TEXT' },
    { table: 'parametres',        col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'parametres',        col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'parametres',        col: 'poste_source',     def: 'TEXT' },

    { table: 'stock_historique',  col: 'uuid',             def: 'TEXT' },
    { table: 'stock_historique',  col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'stock_historique',  col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'stock_historique',  col: 'poste_source',     def: 'TEXT' },

    { table: 'journal_activite',  col: 'uuid',             def: 'TEXT' },
    { table: 'journal_activite',  col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'journal_activite',  col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'journal_activite',  col: 'poste_source',     def: 'TEXT' },

    { table: 'espaces',           col: 'uuid',             def: 'TEXT' },
    { table: 'espaces',           col: 'last_modified_at', def: 'INTEGER DEFAULT 0' },
    { table: 'espaces',           col: 'sync_status',      def: 'INTEGER DEFAULT 0' },
    { table: 'espaces',           col: 'poste_source',     def: 'TEXT' },
  ];
  for (const { table, col, def } of syncCols) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    } catch { /* colonne déjà existante, ignorer */ }
  }

  // ── UUID BACKFILL (Données existantes) ────────────────────────────────────
  // Attribuer un UUID aux lignes qui n'en ont pas encore
  const TABLES_WITH_UUID = [
    'utilisateurs', 'categories', 'produits', 'ventes', 'lignes_vente',
    'tickets_table', 'tables_config', 'clotures', 'parametres', 'stock_historique',
    'stock_lots', 'stock_transferts', 'clients', 'credits_paiements', 'fournisseurs',
    'achats', 'reservations', 'depenses', 'employes', 'creances_clients',
    'salaires_paiements', 'livraisons', 'recettes_lignes', 'flux_tresorerie',
    'journal_activite', 'espaces', 'reservations_terrain'
  ];
  for (const tbl of TABLES_WITH_UUID) {
    try {
      db.exec(`UPDATE ${tbl} SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL OR uuid = ''`);
      db.exec(`UPDATE ${tbl} SET last_modified_at = ${Date.now()} WHERE last_modified_at IS NULL OR last_modified_at = 0`);
    } catch { /* ignore if table missing */ }
  }
  // Marquer toutes les données existantes (sync_status = 1 = déjà sync) sauf
  // celles qui n'ont jamais été envoyées (sync_status NULL → forcer à 0 pour envoi)
  // On met sync_status = 0 uniquement là où c'est NULL (jamais initialisé)
  for (const tbl of TABLES_WITH_UUID) {
    try {
      db.exec(`UPDATE ${tbl} SET sync_status = 0 WHERE sync_status IS NULL`);
    } catch { /* ignore */ }
  }

  // ── MIGRATION : Backfill id = rowid pour les tables avec uuid PRIMARY KEY ──
  // Le champ 'id' (INTEGER sans AUTOINCREMENT) n'est jamais rempli automatiquement
  // car c'est 'uuid TEXT' qui sert de PRIMARY KEY. On le backfille avec rowid.
  const TABLES_NEED_ID_BACKFILL = [
    'ventes', 'lignes_vente', 'tickets_table', 'produits', 'categories',
    'utilisateurs', 'clotures', 'depenses', 'stock_historique',
    'clients', 'creances_clients', 'credits_paiements',
    'employes', 'salaires_paiements', 'reservations', 'journal_activite'
  ];
  for (const tbl of TABLES_NEED_ID_BACKFILL) {
    try {
      db.exec(`UPDATE ${tbl} SET id = rowid WHERE id IS NULL`);
    } catch { /* ignore if table missing or no id column */ }
  }

  // ── DONNÉES PAR DÉFAUT ────────────────────────────────────────────────

  // Admin par défaut (PIN: 0000)
  const adminExiste = db.prepare('SELECT id FROM utilisateurs WHERE role = ?').get('admin');
  if (!adminExiste) {
    db.prepare(`
      INSERT INTO utilisateurs (nom, prenom, pin, role, actif,
        perm_caisse, perm_utilisateur, perm_parametres, perm_cloture, perm_stock, perm_remises,
        perm_grossiste, perm_depenses, perm_ressources, perm_achats, perm_reserv)
      VALUES (?, ?, ?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
    `).run('Admin', 'Système', '0000', 'admin');
  } else {
    // Si l'admin existe déjà, on s'assure qu'il reçoit les nouvelles permissions V3
    try {
      db.prepare(`
        UPDATE utilisateurs 
        SET perm_caisse = 1, perm_utilisateur = 1, perm_parametres = 1, perm_cloture = 1,
            perm_stock = 1, perm_remises = 1,
            perm_grossiste = 1, perm_depenses = 1, perm_ressources = 1, perm_achats = 1, perm_reserv = 1
        WHERE role = 'admin'
      `).run();
    } catch (e) {
      console.log('Erreur mise à jour permissions admin:', e);
    }
  }

  // Catégories par défaut
  const nbCats = db.prepare('SELECT COUNT(*) as n FROM categories').get().n;
  if (nbCats === 0) {
    const cats = [
      ['TOUT','TOUT','Tous les produits'],
      ['ENTREES','Entrées','Entrées'],
      ['PLATS','Plats','Plats principaux'],
      ['DESSERTS','Desserts','Desserts'],
      ['BOISSONS','Boissons','Boissons'],
      ['VINS','Vins','Vins & alcools'],
      ['PIZZAS','Pizzas','Pizzas'],
      ['GARNITURES','Garnitures','Accompagnements'],
      ['FORMULES','Formules','Menus & formules'],
      ['PETIT_DEJ','Petit Déjeuner','Petit déjeuner'],
    ];
    const ins = db.prepare('INSERT INTO categories (code, nom, description, ordre) VALUES (?, ?, ?, ?)');
    cats.forEach(([code, nom, desc], i) => ins.run(code, nom, desc, i));

  }

  // Tables par défaut (10 tables)
  const nbTables = db.prepare('SELECT COUNT(*) as n FROM tables_config').get().n;
  if (nbTables === 0) {
    const ins = db.prepare("INSERT OR IGNORE INTO tables_config (uuid, numero_table, ordre) VALUES (lower(hex(randomblob(16))), ?, ?)");
    for (let i = 1; i <= 10; i++) ins.run(i, i);

  }

  // Espaces par défaut (3 espaces exemple)
  const nbEspaces = db.prepare('SELECT COUNT(*) as n FROM espaces').get().n;
  if (nbEspaces === 0) {
    const insEspace = db.prepare("INSERT INTO espaces (uuid, nom, type, description, tarif_heure) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)");
    insEspace.run('Terrain Principal', 'terrain', 'Grand terrain extérieur', 0);
    insEspace.run('Salle Polyvalente', 'salle', 'Salle intérieure climatisée', 0);
    insEspace.run('Local Réunion', 'local', 'Local pour réunions et événements', 0);
  }

  // Paramètres par défaut
  const defaults = {
    'entreprise.nom':           'Mon Restaurant',
    'entreprise.adresse':       '123 Rue Example',
    'entreprise.ville':         '',
    'entreprise.telephone':     '',
    'entreprise.email':         '',
    'entreprise.nif':           '',
    'entreprise.stat':          '',
    'entreprise.slogan':        'Bienvenue !',
    'impression.imprimante':    'XPrinter XP80C',
    'impression.largeur':       '80',
    'impression.copies_ticket': '1',
    'impression.copies_cloture':'2',
    'impression.actif':         '1',
    'caisse.remise1':           '10',
    'caisse.remise2':           '20',
    'caisse.devise':            'Ar',
    'caisse.nom_poste':         'Poste n°1',
    'caisse.version':           '1.7.0',
    'license.activated':        '1',
    'license.first_launch':     '',
  };
  const setParam = db.prepare("INSERT OR IGNORE INTO parametres (uuid, cle, valeur) VALUES (lower(hex(randomblob(16))), ?, ?)");
  Object.entries(defaults).forEach(([k, v]) => setParam.run(k, v));


};
