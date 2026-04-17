# Plan d'Implémentation V3 (Complet) : ERP Lounge Bar & Grossiste

Ce document prend en compte **l'intégralité** de votre cahier des charges, avec une attention particulière à la gestion des sous-catégories, du stock par lots/péremption, des fonctions du Lounge Bar (Réservations, Cuisine) et du Grossiste (Achats, Livraisons). Le Dashboard sera également refondu en interface de type "Tuiles Windows 8".

---

## 1. Refonte de l'Application Electron (Windows 8 UI & Thèmes)

### A. Interface Principale (Dashboard) faĉon Windows 8
Le tableau de bord actuel sera transformé en une véritable plateforme d'accueil sous forme de **Tuiles interactives (Tiles)**.
1. Les tuiles auront des tailles variables (grandes tuiles pour la Caisse et le Stock, moyennes pour RH et Dépenses).
2. Les tuiles afficheront des informations en temps réel (ex: Tuile Stock indiquant "3 produits en alerte", Tuile Réservations indiquant "2 à venir ce soir").
3. Le tout sera infusé de vos 6 thèmes CSS actuels.

### B. Modules et Vues
- **Lounge Bar :** Plan de tables visuel, Module de Prise de Commande rapide, Réservations, et un Écran "Cuisine/Bar" pour le suivi des plats/boissons à préparer.
- **Grossiste :** Interface de vente au comptoir/crédit listant les clients et leurs plafonds.
- **Back-Office :** Gestion multi-unités et dates de péremption, Achats fournisseurs, Dépenses et Salaires avec le calcul de rentabilité, et création de recettes des plats (Ingrédients).

---

## 2. Modélisation de la Base de Données

Afin de répondre à **100%** de votre PDF, nous devons injecter une multitude de nouvelles structures :

1. **Catégories & Sous-Catégories :** Ajout d'une notion de hiérarchie (`parent_id`) pour regrouper "Boissons > Bières".
2. **Produits (Étendus) :** Distinction Alcool/Non-Alcool, gestion de multi-unités (carton/pack/unité) et prix selon la vente (Gros vs Détail).
3. **Péremption & Lots :** Une table `stock_lots` pour tracer la date d'expiration des boissons acquises.
4. **Réservations (Lounge) :** Lier une table à un client, une date et un événement.
5. **Cuisine & Commandes :** Étendre les lignes de vente avec un statut d'avancement (`en_attente`, `en_preparation`, `pret`).
6. **Achats & Fournisseurs :** Pour suivre combien le bar doit aux fournisseurs de boissons.

---

## 3. Script SQL / PostgreSQL (À exécuter dans Supabase)

Ce script englobe toute l'architecture de votre ERP.  
*(Remarque : Les tables incluent systématiquement `uuid`, `last_modified_at`, et `sync_status` pour assurer le multi-postes offline).*

```sql
-- ====== SUPABASE POSTGRESQL SCHEMA V3 (Lounge + Grossiste) ====== --

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATÉGORIES (Support Sous-catégories)
CREATE TABLE IF NOT EXISTS categories (
    uuid TEXT PRIMARY KEY,
    id SERIAL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    code TEXT UNIQUE,
    nom TEXT NOT NULL,
    description TEXT,
    ordre INTEGER DEFAULT 0,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 2. PRODUITS (Multi-unités, Alcool, Stock séparé, Ingrédient)
CREATE TABLE IF NOT EXISTS produits (
    uuid TEXT PRIMARY KEY,
    id bigint, reference TEXT, nom TEXT NOT NULL, description TEXT,
    prix_vente_ttc REAL DEFAULT 0, prix_emporte REAL DEFAULT 0, prix_gros REAL DEFAULT 0, prix_achat REAL DEFAULT 0,
    categorie_id INTEGER, 
    unite_base TEXT DEFAULT 'Unité', unite_carton_qte REAL DEFAULT 1, unite_pack_qte REAL DEFAULT 1,
    stock_grossiste REAL DEFAULT 0, stock_bar REAL DEFAULT 0, stock_alerte REAL DEFAULT 0,
    is_alcool SMALLINT DEFAULT 0, -- 1 pour alcoolisé, 0 hygiénique
    is_ingredient SMALLINT DEFAULT 0, -- Matière première pour les recettes
    actif SMALLINT DEFAULT 1, 
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 3. STOCK PAR LOTS (Dates d'expiration)
CREATE TABLE IF NOT EXISTS stock_lots (
    uuid TEXT PRIMARY KEY,
    id bigint, produit_uuid TEXT NOT NULL,
    numero_lot TEXT,
    date_expiration TEXT,
    quantite_restante REAL DEFAULT 0,
    localisation TEXT DEFAULT 'grossiste', -- 'grossiste' ou 'bar'
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 4. TRANSFERTS DE STOCK INTERNES
CREATE TABLE IF NOT EXISTS stock_transferts (
    uuid TEXT PRIMARY KEY,
    id bigint, produit_uuid TEXT NOT NULL, quantite REAL,
    source TEXT DEFAULT 'grossiste', destination TEXT DEFAULT 'bar', date_transfert TEXT,
    operateur TEXT,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 5. CLIENTS & Dettes
CREATE TABLE IF NOT EXISTS clients (
    uuid TEXT PRIMARY KEY,
    id bigint, nom TEXT NOT NULL, contact TEXT, adresse TEXT,
    plafond_credit REAL DEFAULT 0, dettes_actuelles REAL DEFAULT 0,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

CREATE TABLE IF NOT EXISTS credits_paiements (
    uuid TEXT PRIMARY KEY,
    id bigint, client_uuid TEXT NOT NULL, montant REAL NOT NULL, type_operation TEXT DEFAULT 'remboursement',
    date_paiement TEXT, operateur TEXT,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 6. FOURNISSEURS & ACHATS
CREATE TABLE IF NOT EXISTS fournisseurs (
    uuid TEXT PRIMARY KEY,
    nom TEXT NOT NULL, contact TEXT, dettes_actuelles REAL DEFAULT 0,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

CREATE TABLE IF NOT EXISTS achats (
    uuid TEXT PRIMARY KEY,
    fournisseur_uuid TEXT, total_ttc REAL DEFAULT 0, statut TEXT DEFAULT 'non_paye', date_achat TEXT,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 7. VENTES (Bar, Grossiste)
CREATE TABLE IF NOT EXISTS ventes (
    uuid TEXT PRIMARY KEY,
    id bigint, numero_ticket TEXT NOT NULL, date_vente TEXT, nom_caissier TEXT,
    type_vente TEXT DEFAULT 'BAR', -- 'BAR', 'GROSSISTE', 'EMPORTE'
    client_uuid TEXT, 
    total_ttc REAL DEFAULT 0, mode_paiement TEXT DEFAULT 'CASH', montant_paye REAL DEFAULT 0,
    monnaie_rendue REAL DEFAULT 0, statut TEXT DEFAULT 'valide', table_numero bigint, note TEXT,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

CREATE TABLE IF NOT EXISTS lignes_vente (
    uuid TEXT PRIMARY KEY,
    id bigint, vente_uuid TEXT, produit_id bigint, produit_nom TEXT NOT NULL,
    unite_choisie TEXT DEFAULT 'Unité',
    quantite REAL DEFAULT 1, prix_unitaire REAL DEFAULT 0, remise REAL DEFAULT 0,
    rabais REAL DEFAULT 0, total_ttc REAL DEFAULT 0, est_offert SMALLINT DEFAULT 0,
    statut_cuisine TEXT DEFAULT 'servi', -- 'en_attente', 'en_preparation', 'pret', 'servi'
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1
);

-- 8. RÉSERVATIONS (Lounge)
CREATE TABLE IF NOT EXISTS reservations (
    uuid TEXT PRIMARY KEY,
    client_nom TEXT NOT NULL,
    date_reservation TEXT NOT NULL,
    nb_personnes INTEGER DEFAULT 1,
    evenement TEXT,
    table_numero INTEGER,
    statut TEXT DEFAULT 'en_attente', -- 'en_attente', 'confirmee', 'annulee'
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 9. DÉPENSES
CREATE TABLE IF NOT EXISTS depenses (
    uuid TEXT PRIMARY KEY,
    id bigint, categorie TEXT, description TEXT, montant REAL NOT NULL,
    date_depense TEXT, operateur TEXT,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 10. RH : EMPLOYÉS & SALAIRES
CREATE TABLE IF NOT EXISTS employes (
    uuid TEXT PRIMARY KEY,
    id bigint, nom TEXT, poste TEXT, salaire_base REAL DEFAULT 0,
    date_embauche TEXT,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

CREATE TABLE IF NOT EXISTS salaires_paiements (
    uuid TEXT PRIMARY KEY,
    id bigint, employe_uuid TEXT NOT NULL, type_paiement TEXT, -- 'Salaire', 'Avance', 'Prime'
    montant REAL NOT NULL, date_paiement TEXT, operateur TEXT,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 11. LIVRAISONS (Grossiste)
CREATE TABLE IF NOT EXISTS livraisons (
    uuid TEXT PRIMARY KEY,
    vente_uuid TEXT NOT NULL, livreur_nom TEXT, statut TEXT DEFAULT 'en_cours',
    date_depart TEXT, date_livraison TEXT,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);

-- 12. RECETTES (Coût des plats)
CREATE TABLE IF NOT EXISTS recettes_lignes (
    uuid TEXT PRIMARY KEY,
    plat_uuid TEXT NOT NULL, ingredient_uuid TEXT NOT NULL,
    quantite_requise REAL NOT NULL,
    last_modified_at BIGINT, sync_status SMALLINT DEFAULT 1, poste_source TEXT
);
```

---

## 4. Stratégie d'Implémentation Étape par Étape

Dès réception de votre feu vert, nous procéderons par étapes :

- **Étape 1 : Le Noyau Database (SQLite).** Modification directe du fichier de migrations local `migrations.js` pour créer toutes ces structures sans détruire vos données de test existantes.
- **Étape 2 : Le Hub Windows 8.** Refonte totale du fichier `dashboard.js` et `dashboard.css` avec design en Tuiles dynamiques (Couleurs paramétrées par le thème).
- **Étape 3 : Module Stock & Sous-Catégories.** Implémentation du système "carton/pack/unité", gestion des DLC/lots et hiérarchie Boissons/Alcool.
- **Étape 4 : Lounge Bar & Réservations.** Module visuel pour les salles, l'écran de la cuisine, et système de prise de commande intelligent.
- **Étape 5 : Back-Office Financier.** Achats, Dépenses courantes, Fournisseurs et Salaires avec le calcul de Marge Intégré.
