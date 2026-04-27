-- ════════════════════════════════════════════════════════════════════
-- SCRIPT DE CRÉATION DES TABLES SUPABASE (CLINOCAISSE CLOUD SYNC)
-- Ce script est généré automatiquement par ClinoCaisse.
-- ════════════════════════════════════════════════════════════════════

-- Helper function to execute raw SQL
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Table: utilisateurs
CREATE TABLE IF NOT EXISTS utilisateurs (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    nom TEXT NOT NULL,
    prenom TEXT,
    pin TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'vendeur',
    actif INTEGER NOT NULL DEFAULT 1,
    theme TEXT DEFAULT 'default',
    perm_caisse INTEGER DEFAULT 0,
    perm_utilisateur INTEGER DEFAULT 0,
    perm_parametres INTEGER DEFAULT 0,
    perm_cloture INTEGER DEFAULT 0,
    perm_stock INTEGER DEFAULT 0,
    perm_remises INTEGER DEFAULT 0,
    perm_grossiste INTEGER DEFAULT 0,
    perm_depenses INTEGER DEFAULT 0,
    perm_ressources INTEGER DEFAULT 0,
    perm_achats INTEGER DEFAULT 0,
    perm_reserv INTEGER DEFAULT 0,
    date_creation TEXT,
    date_modification TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 2. Table: categories
CREATE TABLE IF NOT EXISTS categories (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    code TEXT,
    nom TEXT NOT NULL,
    description TEXT,
    ordre INTEGER DEFAULT 0,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT,
    parent_id INTEGER
);

-- 3. Table: produits
CREATE TABLE IF NOT EXISTS produits (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    reference TEXT,
    nom TEXT NOT NULL,
    description TEXT,
    prix_vente_ttc REAL DEFAULT 0,
    prix_achat REAL DEFAULT 0,
    prix_emporte REAL DEFAULT 0,
    prix_gros REAL DEFAULT 0,
    unite_base TEXT DEFAULT 'Unité',
    unite_carton_qte REAL DEFAULT 1,
    unite_pack_qte REAL DEFAULT 1,
    stock_grossiste REAL DEFAULT 0,
    stock_alerte_grossiste REAL DEFAULT 0,
    stock_bar REAL DEFAULT 0,
    is_alcool INTEGER DEFAULT 0,
    is_ingredient INTEGER DEFAULT 0,
    is_prepared INTEGER DEFAULT 0,
    categorie_id INTEGER,
    stock_actuel REAL DEFAULT -1,
    stock_alerte REAL DEFAULT 0,
    fournisseur TEXT,
    actif INTEGER DEFAULT 1,
    date_creation TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 4. Table: ventes
CREATE TABLE IF NOT EXISTS ventes (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    numero_ticket TEXT NOT NULL,
    date_vente TEXT,
    nom_caissier TEXT,
    total_ttc REAL DEFAULT 0,
    mode_paiement TEXT DEFAULT 'CASH',
    montant_paye REAL DEFAULT 0,
    monnaie_rendue REAL DEFAULT 0,
    statut TEXT DEFAULT 'valide',
    table_numero INTEGER,
    note TEXT,
    type_vente TEXT DEFAULT 'BAR',
    client_uuid TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 5. Table: lignes_vente
CREATE TABLE IF NOT EXISTS lignes_vente (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    vente_id INTEGER,
    vente_uuid TEXT,
    produit_id INTEGER,
    produit_nom TEXT NOT NULL,
    quantite REAL DEFAULT 1,
    prix_unitaire REAL DEFAULT 0,
    remise REAL DEFAULT 0,
    rabais REAL DEFAULT 0,
    total_ttc REAL DEFAULT 0,
    est_offert INTEGER DEFAULT 0,
    unite_choisie TEXT DEFAULT 'Unité',
    statut_cuisine TEXT DEFAULT 'servi',
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 6. Table: tickets_table
CREATE TABLE IF NOT EXISTS tickets_table (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    numero_table INTEGER NOT NULL,
    nom_table TEXT,
    nom_caissier TEXT,
    date_creation TEXT,
    date_modification TEXT,
    montant_total REAL DEFAULT 0,
    lignes_json TEXT DEFAULT '[]',
    statut TEXT DEFAULT 'en_cours',
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 7. Table: tables_config
CREATE TABLE IF NOT EXISTS tables_config (
    uuid TEXT PRIMARY KEY,
    numero_table INTEGER,
    ordre INTEGER DEFAULT 0,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 7b. Table: journal_activite
CREATE TABLE IF NOT EXISTS journal_activite (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    date_action TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    categorie TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    operateur TEXT,
    montant REAL,
    icone TEXT,
    meta_json TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 8. Table: clotures
CREATE TABLE IF NOT EXISTS clotures (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    type_cloture TEXT NOT NULL,
    numero_rapport TEXT,
    date_debut TEXT,
    date_fin TEXT,
    date_cloture TEXT,
    total_ttc REAL DEFAULT 0,
    total_cash REAL DEFAULT 0,
    total_mvola REAL DEFAULT 0,
    total_orange REAL DEFAULT 0,
    total_airtel REAL DEFAULT 0,
    total_carte REAL DEFAULT 0,
    total_autre REAL DEFAULT 0,
    nombre_tickets INTEGER DEFAULT 0,
    nombre_articles INTEGER DEFAULT 0,
    vendeur_nom TEXT,
    vendeur_id INTEGER,
    total_compte REAL DEFAULT 0,
    prelevement REAL DEFAULT 0,
    fond_debut REAL DEFAULT 0,
    fond_fin REAL DEFAULT 0,
    ecart REAL DEFAULT 0,
    details_json TEXT DEFAULT '{}',
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 9. Table: parametres
CREATE TABLE IF NOT EXISTS parametres (
    uuid TEXT PRIMARY KEY,
    cle TEXT,
    valeur TEXT,
    date_maj TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 10. Table: stock_historique
CREATE TABLE IF NOT EXISTS stock_historique (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    produit_id INTEGER,
    produit_nom TEXT,
    ancienne_qte REAL,
    nouvelle_qte REAL,
    delta REAL,
    motif TEXT,
    operateur TEXT,
    date_op TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 11. Table: stock_lots
CREATE TABLE IF NOT EXISTS stock_lots (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    produit_uuid TEXT NOT NULL,
    numero_lot TEXT,
    date_expiration TEXT,
    quantite_restante REAL DEFAULT 0,
    localisation TEXT DEFAULT 'grossiste',
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 12. Table: stock_transferts
CREATE TABLE IF NOT EXISTS stock_transferts (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    produit_uuid TEXT NOT NULL,
    quantite REAL,
    source TEXT DEFAULT 'grossiste',
    destination TEXT DEFAULT 'bar',
    date_transfert TEXT,
    operateur TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 13. Table: clients
CREATE TABLE IF NOT EXISTS clients (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    nom TEXT NOT NULL,
    contact TEXT,
    adresse TEXT,
    plafond_credit REAL DEFAULT 0,
    dettes_actuelles REAL DEFAULT 0,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 14. Table: credits_paiements
CREATE TABLE IF NOT EXISTS credits_paiements (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    client_uuid TEXT NOT NULL,
    montant REAL NOT NULL,
    type_operation TEXT DEFAULT 'remboursement',
    date_paiement TEXT,
    operateur TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 15. Table: fournisseurs
CREATE TABLE IF NOT EXISTS fournisseurs (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    nom TEXT NOT NULL,
    contact TEXT,
    dettes_actuelles REAL DEFAULT 0,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 16. Table: achats
CREATE TABLE IF NOT EXISTS achats (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    fournisseur_uuid TEXT,
    total_ttc REAL DEFAULT 0,
    statut TEXT DEFAULT 'non_paye',
    date_achat TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 17. Table: reservations
CREATE TABLE IF NOT EXISTS reservations (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    client_nom TEXT NOT NULL,
    date_reservation TEXT NOT NULL,
    nb_personnes INTEGER DEFAULT 1,
    evenement TEXT,
    table_numero INTEGER,
    statut TEXT DEFAULT 'en_attente',
    tables_json TEXT DEFAULT '[]',
    duree_heures REAL,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 18. Table: depenses
CREATE TABLE IF NOT EXISTS depenses (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    categorie TEXT,
    description TEXT,
    montant REAL NOT NULL,
    date_depense TEXT,
    operateur TEXT,
    statut TEXT DEFAULT 'payee',
    fournisseur_nom TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 19. Table: employes
CREATE TABLE IF NOT EXISTS employes (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    nom TEXT,
    poste TEXT,
    salaire_base REAL DEFAULT 0,
    date_embauche TEXT,
    actif INTEGER DEFAULT 1,
    mode_premier_salaire TEXT DEFAULT 'ce_mois',
    montant_premier_salaire REAL DEFAULT 0,
    premier_mois_paye INTEGER DEFAULT 0,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 20. Table: creances_clients
CREATE TABLE IF NOT EXISTS creances_clients (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    client_nom TEXT NOT NULL,
    montant REAL NOT NULL,
    statut TEXT DEFAULT 'en_attente',
    date_creation TEXT,
    date_echeance TEXT,
    description TEXT,
    operateur TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 21. Table: salaires_paiements
CREATE TABLE IF NOT EXISTS salaires_paiements (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    employe_uuid TEXT NOT NULL,
    type_paiement TEXT,
    montant REAL NOT NULL,
    date_paiement TEXT,
    operateur TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 22. Table: livraisons
CREATE TABLE IF NOT EXISTS livraisons (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    vente_uuid TEXT NOT NULL,
    livreur_nom TEXT,
    statut TEXT DEFAULT 'en_cours',
    date_depart TEXT,
    date_livraison TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 23. Table: recettes_lignes
CREATE TABLE IF NOT EXISTS recettes_lignes (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    plat_uuid TEXT NOT NULL,
    ingredient_uuid TEXT NOT NULL,
    quantite_requise REAL NOT NULL,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 24. Table: flux_tresorerie
CREATE TABLE IF NOT EXISTS flux_tresorerie (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    type_flux TEXT NOT NULL,
    montant REAL NOT NULL,
    motif TEXT,
    date_flux TEXT,
    operateur TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 0,
    poste_source TEXT
);

-- 25. Table: journal_activite
CREATE TABLE IF NOT EXISTS journal_activite (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    date_action TEXT NOT NULL,
    categorie TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    operateur TEXT,
    montant REAL,
    icone TEXT,
    meta_json TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 26. Table: espaces
CREATE TABLE IF NOT EXISTS espaces (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    nom TEXT NOT NULL,
    type TEXT DEFAULT 'terrain',
    description TEXT,
    tarif_heure REAL DEFAULT 0,
    actif INTEGER DEFAULT 1,
    date_creation TEXT,
    type_tarif TEXT DEFAULT 'heure',
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 27. Table: reservations_terrain
CREATE TABLE IF NOT EXISTS reservations_terrain (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    client_nom TEXT NOT NULL,
    client_contact TEXT,
    espace_id INTEGER,
    date_debut TEXT NOT NULL,
    date_fin TEXT NOT NULL,
    montant_total REAL DEFAULT 0,
    montant_paye REAL DEFAULT 0,
    statut_paiement TEXT DEFAULT 'en_attente',
    statut TEXT DEFAULT 'confirmee',
    note TEXT,
    operateur TEXT,
    date_creation TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- ════════════════════════════════════════════════════════════════════
-- CONFIGURATION DU TEMPS RÉEL (REALTIME)
-- ════════════════════════════════════════════════════════════════════
-- On supprime et recrée la publication pour garantir que toutes les tables 
-- connectées génèrent des événements websocket.
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE 
  utilisateurs, categories, produits, ventes, lignes_vente, clotures,
  stock_lots, stock_transferts, clients, credits_paiements,
  fournisseurs, achats, reservations, depenses, employes,
  creances_clients, salaires_paiements, livraisons,
  recettes_lignes, flux_tresorerie, reservations_terrain,
  tickets_table, tables_config, parametres, stock_historique, journal_activite, espaces;

-- ════════════════════════════════════════════════════════════════════
-- AUTOMATISATION DU TIMESTAMP (PULL SIDE)
-- ════════════════════════════════════════════════════════════════════
-- Cette fonction met à jour automatiquement la colonne last_modified_at 
-- (en millisecondes) à chaque fois qu'une ligne est modifiée sur le serveur.
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified_at = EXTRACT(EPOCH FROM now()) * 1000;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Application du déclencheur à toutes les tables synchronisées
DO $$ 
DECLARE
    t text;
    tables_list text[] := ARRAY[
        'utilisateurs', 'categories', 'produits', 'ventes', 'lignes_vente', 'clotures',
        'stock_lots', 'stock_transferts', 'clients', 'credits_paiements',
        'fournisseurs', 'achats', 'reservations', 'depenses', 'employes',
        'creances_clients', 'salaires_paiements', 'livraisons',
        'recettes_lignes', 'flux_tresorerie', 'reservations_terrain',
        'tickets_table', 'tables_config', 'parametres', 'stock_historique', 'journal_activite', 'espaces'
    ];
BEGIN
    FOREACH t IN ARRAY tables_list LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_update_last_modified ON %I', t);
        EXECUTE format('CREATE TRIGGER tr_update_last_modified BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_last_modified()', t);
    END LOOP;
END $$;
