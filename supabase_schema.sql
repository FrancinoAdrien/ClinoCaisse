-- ════════════════════════════════════════════════════════════════════
-- SCRIPT DE CRÉATION DES TABLES SUPABASE (CLINOCAISSE CLOUD SYNC)
-- À exécuter dans le "SQL Editor" de votre projet Supabase.
-- ════════════════════════════════════════════════════════════════════

-- 1. TABLE: produits
CREATE TABLE IF NOT EXISTS produits (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    reference TEXT,
    nom TEXT NOT NULL,
    description TEXT,
    prix_vente_ttc REAL DEFAULT 0,
    prix_achat REAL DEFAULT 0,
    prix_emporte REAL DEFAULT 0,
    categorie_id INTEGER,
    stock_actuel REAL DEFAULT -1,
    stock_alerte REAL DEFAULT 0,
    fournisseur TEXT,
    actif INTEGER DEFAULT 1,
    date_creation TEXT,
    last_modified_at BIGINT,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 2. TABLE: ventes
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
    last_modified_at BIGINT,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- 3. TABLE: lignes_vente
CREATE TABLE IF NOT EXISTS lignes_vente (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    vente_uuid TEXT,
    produit_id INTEGER,
    produit_nom TEXT NOT NULL,
    quantite REAL DEFAULT 1,
    prix_unitaire REAL DEFAULT 0,
    remise REAL DEFAULT 0,
    rabais REAL DEFAULT 0,
    total_ttc REAL DEFAULT 0,
    est_offert INTEGER DEFAULT 0,
    last_modified_at BIGINT,
    sync_status INTEGER DEFAULT 1
);

-- 4. TABLE: clotures
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
    last_modified_at BIGINT,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

-- Optionnel: Si vous voulez permettre à l'application de créer les tables
-- automatiquement lors de la première connexion, exécutez cette fonction:
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
