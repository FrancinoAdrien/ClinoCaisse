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

-- ════════════════════════════════════════════════════════════════════
-- VÉRIFICATION : Ces requêtes doivent retourner 0 après correction
-- ════════════════════════════════════════════════════════════════════
-- SELECT COUNT(*) FROM journal_activite WHERE id IS NOT NULL; -- OK si nullable
-- SELECT COUNT(*) FROM stock_historique WHERE id IS NOT NULL;  -- OK si nullable
