'use strict';

module.exports = function runMigrations(db) {
  db.exec(`
    -- ── UTILISATEURS ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nom             TEXT    NOT NULL,
      prenom          TEXT,
      pin             TEXT    NOT NULL,
      role            TEXT    NOT NULL DEFAULT 'vendeur',
      actif           INTEGER NOT NULL DEFAULT 1,
      theme           TEXT    DEFAULT 'default',
      perm_caisse     INTEGER NOT NULL DEFAULT 0,
      perm_utilisateur INTEGER NOT NULL DEFAULT 0,
      perm_parametres  INTEGER NOT NULL DEFAULT 0,
      perm_cloture    INTEGER NOT NULL DEFAULT 0,
      perm_stock      INTEGER NOT NULL DEFAULT 0,
      perm_remises    INTEGER NOT NULL DEFAULT 0,
      date_creation   TEXT    DEFAULT (datetime('now')),
      date_modification TEXT  DEFAULT (datetime('now'))
    );

    -- ── CATEGORIES ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT    NOT NULL UNIQUE,
      nom         TEXT    NOT NULL,
      description TEXT,
      ordre       INTEGER DEFAULT 0
    );

    -- ── PRODUITS ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS produits (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      reference       TEXT,
      nom             TEXT    NOT NULL,
      description     TEXT,
      prix_vente_ttc  REAL    NOT NULL DEFAULT 0,
      prix_achat      REAL    DEFAULT 0,
      prix_emporte    REAL    DEFAULT 0,
      categorie_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      stock_actuel    REAL    NOT NULL DEFAULT -1,
      stock_bar       REAL    NOT NULL DEFAULT 0,
      stock_alerte    REAL    DEFAULT 0,
      stock_alerte_grossiste REAL DEFAULT 0,
      fournisseur     TEXT,
      image_data      BLOB,
      actif           INTEGER NOT NULL DEFAULT 1,
      date_creation   TEXT    DEFAULT (datetime('now'))
    );

    -- ── VENTES ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ventes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_ticket   TEXT    NOT NULL,
      date_vente      TEXT    NOT NULL DEFAULT (datetime('now')),
      nom_caissier    TEXT,
      total_ttc       REAL    NOT NULL DEFAULT 0,
      mode_paiement   TEXT    DEFAULT 'CASH',
      montant_paye    REAL    DEFAULT 0,
      monnaie_rendue  REAL    DEFAULT 0,
      statut          TEXT    DEFAULT 'valide',
      table_numero    INTEGER,
      note            TEXT
    );

    -- ── LIGNES VENTE ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS lignes_vente (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      vente_id        INTEGER NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
      produit_id      INTEGER REFERENCES produits(id),
      produit_nom     TEXT    NOT NULL,
      quantite        REAL    NOT NULL DEFAULT 1,
      prix_unitaire   REAL    NOT NULL DEFAULT 0,
      remise          REAL    DEFAULT 0,
      rabais          REAL    DEFAULT 0,
      total_ttc       REAL    NOT NULL DEFAULT 0,
      est_offert      INTEGER DEFAULT 0
    );

    -- ── TICKETS TABLE ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS tickets_table (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_table        INTEGER NOT NULL,
      nom_table           TEXT,
      nom_caissier        TEXT,
      date_creation       TEXT    DEFAULT (datetime('now')),
      date_modification   TEXT    DEFAULT (datetime('now')),
      montant_total       REAL    DEFAULT 0,
      lignes_json         TEXT    DEFAULT '[]',
      statut              TEXT    DEFAULT 'en_cours'
    );

    -- ── CONFIG TABLES ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS tables_config (
      numero_table  INTEGER PRIMARY KEY,
      ordre         INTEGER DEFAULT 0
    );

    -- ── CLÔTURES ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS clotures (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
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
      details_json        TEXT    DEFAULT '{}'
    );

    -- ── PARAMÈTRES ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS parametres (
      cle         TEXT    PRIMARY KEY,
      valeur      TEXT,
      date_maj    TEXT    DEFAULT (datetime('now'))
    );

    -- ── HISTORIQUE STOCK ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS stock_historique (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      produit_id    INTEGER REFERENCES produits(id),
      produit_nom   TEXT,
      ancienne_qte  REAL,
      nouvelle_qte  REAL,
      delta         REAL,
      motif         TEXT,
      operateur     TEXT,
      date_op       TEXT    DEFAULT (datetime('now'))
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
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid             TEXT UNIQUE,
      client_nom       TEXT NOT NULL,
      montant          REAL NOT NULL,
      statut           TEXT DEFAULT 'en_attente',
      date_creation    TEXT,
      date_echeance    TEXT,
      description      TEXT,
      operateur        TEXT,
      last_modified_at INTEGER DEFAULT 0,
      sync_status      INTEGER DEFAULT 0
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
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date_action  TEXT    NOT NULL DEFAULT (datetime('now')),
      categorie    TEXT    NOT NULL,
      action       TEXT    NOT NULL,
      detail       TEXT,
      operateur    TEXT,
      montant      REAL,
      icone        TEXT,
      meta_json    TEXT
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
    
    // ── Table RESERVATIONS (Multi-tables & Durée)
    { table: 'reservations', col: 'tables_json',      def: "TEXT DEFAULT '[]'" },
    // ── Table EMPLOYES
    { table: 'employes',          col: 'actif',            def: 'INTEGER DEFAULT 1' },
    // ── Table DEPENSES
    { table: 'depenses',          col: 'statut',           def: "TEXT DEFAULT 'payee'" },
    { table: 'depenses',          col: 'fournisseur_nom',  def: 'TEXT' },
  ];
  for (const { table, col, def } of syncCols) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    } catch { /* colonne déjà existante, ignorer */ }
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
    const ins = db.prepare('INSERT OR IGNORE INTO tables_config (numero_table, ordre) VALUES (?, ?)');
    for (let i = 1; i <= 10; i++) ins.run(i, i);

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
    'caisse.version':           '2.0.0',
  };
  const setParam = db.prepare('INSERT OR IGNORE INTO parametres (cle, valeur) VALUES (?, ?)');
  Object.entries(defaults).forEach(([k, v]) => setParam.run(k, v));


};
