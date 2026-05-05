-- ════════════════════════════════════════════════════════════════════
-- SCRIPT DE CORRECTION SUPABASE — À exécuter dans le SQL Editor
-- Rend les colonnes "id" nullables pour permettre la synchronisation
-- depuis SQLite (qui gère ses propres IDs locaux).
-- ════════════════════════════════════════════════════════════════════

-- Corriger journal_activite (id SERIAL → nullable)
ALTER TABLE journal_activite ALTER COLUMN id DROP NOT NULL;
ALTER TABLE journal_activite ALTER COLUMN id DROP DEFAULT;

-- Corriger stock_historique (id SERIAL → nullable)
ALTER TABLE stock_historique ALTER COLUMN id DROP NOT NULL;
ALTER TABLE stock_historique ALTER COLUMN id DROP DEFAULT;

-- Corriger date_action (permettre NULL pour compatibilité)
ALTER TABLE journal_activite ALTER COLUMN date_action DROP NOT NULL;

-- S'assurer que les colonnes NOT NULL suivantes ne bloquent pas
-- (exemple : utilisateurs.pin peut être vide pour admin système)
ALTER TABLE utilisateurs ALTER COLUMN pin DROP NOT NULL;

-- Ajouter les nouvelles colonnes manquantes
ALTER TABLE employes ADD COLUMN IF NOT EXISTS mode_premier_salaire TEXT DEFAULT 'ce_mois';
ALTER TABLE employes ADD COLUMN IF NOT EXISTS montant_premier_salaire REAL DEFAULT 0;
ALTER TABLE employes ADD COLUMN IF NOT EXISTS premier_mois_paye INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS duree_heures REAL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS montant_acompte REAL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS client_arrive INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS note_report TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS montant_report REAL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS client_tel TEXT;

-- Prix d'achat dans les lignes de vente (traçabilité des marges)
ALTER TABLE lignes_vente ADD COLUMN IF NOT EXISTS prix_achat REAL DEFAULT 0;

-- Créer les tables manquantes si elles n'existent pas du tout sur le Cloud
CREATE TABLE IF NOT EXISTS parametres (
    uuid TEXT PRIMARY KEY,
    id INTEGER,
    cle TEXT,
    valeur TEXT,
    date_maj TEXT,
    last_modified_at BIGINT DEFAULT 0,
    sync_status INTEGER DEFAULT 1,
    poste_source TEXT
);

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

-- ════════════════════════════════════════════════════════════════════
-- DÉDOUBLONNAGE UTILISATEURS
-- Garde uniquement l'enregistrement le plus récent par (nom + role)
-- et supprime les doublons créés par les re-sync successives.
-- ════════════════════════════════════════════════════════════════════

-- 1. Mettre à jour l'UUID admin vers l'UUID fixe déterministe
--    (correspond à ce que ClinoCaisse génère désormais)
UPDATE utilisateurs
SET uuid = 'aaaaaaaa-0000-0000-0000-000000000001'
WHERE role = 'admin'
  AND uuid != 'aaaaaaaa-0000-0000-0000-000000000001'
  AND uuid = (
    SELECT uuid FROM utilisateurs
    WHERE role = 'admin'
    ORDER BY last_modified_at DESC
    LIMIT 1
  );

-- 2. Supprimer les doublons admin restants (garder l'UUID fixe)
DELETE FROM utilisateurs
WHERE role = 'admin'
  AND uuid != 'aaaaaaaa-0000-0000-0000-000000000001';

-- 3. Supprimer les doublons d'autres utilisateurs (garder le plus récent par pin)
DELETE FROM utilisateurs
WHERE uuid NOT IN (
  SELECT DISTINCT ON (pin) uuid
  FROM utilisateurs
  ORDER BY pin, last_modified_at DESC NULLS LAST
);

-- Forcer le rafraîchissement du cache de l'API Supabase
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════
-- VÉRIFICATION : Ces requêtes doivent retourner 0 après correction
-- ════════════════════════════════════════════════════════════════════
-- SELECT COUNT(*) FROM journal_activite WHERE id IS NOT NULL; -- OK si nullable
-- SELECT COUNT(*) FROM stock_historique WHERE id IS NOT NULL;  -- OK si nullable
-- SELECT COUNT(*) FROM utilisateurs WHERE role = 'admin'; -- Doit retourner 1
