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
      stock_alerte    REAL    DEFAULT 0,
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
  `);

  // ── DONNÉES PAR DÉFAUT ────────────────────────────────────────────────

  // Admin par défaut (PIN: 0000)
  const adminExiste = db.prepare('SELECT id FROM utilisateurs WHERE role = ?').get('admin');
  if (!adminExiste) {
    db.prepare(`
      INSERT INTO utilisateurs (nom, prenom, pin, role, actif,
        perm_caisse, perm_utilisateur, perm_parametres, perm_cloture, perm_stock, perm_remises)
      VALUES (?, ?, ?, ?, 1, 1, 1, 1, 1, 1, 1)
    `).run('Admin', 'Système', '0000', 'admin');

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
    'caisse.version':           '1.0.0',
  };
  const setParam = db.prepare('INSERT OR IGNORE INTO parametres (cle, valeur) VALUES (?, ?)');
  Object.entries(defaults).forEach(([k, v]) => setParam.run(k, v));


};
