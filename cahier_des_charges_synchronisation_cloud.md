# Cahier des Charges : Synchronisation Cloud & Multi-Postes (Offline-First)

## 1. Contexte et Objectif

Permettre à l'application locale `ClinoCaisse` (basée sur Electron et SQLite) de se synchroniser avec une base de données sur le Cloud (Firebase ou Supabase). Le but est de permettre :

- L'utilisation du logiciel sur plusieurs ordinateurs simultanément.
- La création d'un tableau de bord de gestion accessible depuis n'importe où via un navigateur Web.
- Une résilience totale aux coupures d'internet (Fonctionnement "Offline-First").

## 2. Architecture Technique

### 2.1 Système de Base de Données

- **Local (Source de vérité de caisse) :** Reste en SQLite. Assure des performances sans latence et un fonctionnement 100% hors-ligne.
- **Distant (Cloud) :** Supabase (PostgreSQL) recommandé pour sa similarité relationnelle avec SQLite.
- **Tableau de Bord Web :** Application autonome (Next.js ou Vue.js) connectée uniquement à la base Cloud.

### 2.2 Mécanisme de Connexion (Interface Utilisateur)

- Dans les paramètres de ClinoCaisse de l'Admin, ajout d'une section "Synchronisation Cloud".
- Saisie obligatoire de deux clés :
  - `URL de la Base de Données`
  - `Clé API Sécurisée (Anon / Service Role)`
- Bouton "Tester la connexion" et "Forcer la synchronisation manuelle".

## 3. Logique de Synchronisation (Offline-First)

### 3.1 Structure des Tables Locales

Toutes les tables locales pertinentes (tickets, lignes_tickets, produits, caisse) devront recevoir trois nouvelles colonnes :

- `uuid` : Identifiant unique universel (String). Indispensable car les `id` auto-incrémentés peuvent causer des conflits sur le cloud.
- `last_modified_at` : Timestamp de la dernière modification (BigInt).
- `sync_status` : Statut (0 = non synchronisé, 1 = synchronisé).

### 3.2 Workflow d'Écriture (Depuis la caisse vers le Cloud - Push)

1. Création d'une vente ou d'un produit. Enregistrement dans SQLite avec `sync_status = 0`.
2. L'application vérifie si la connexion Internet est active.
   - **Si OUI :** Le "Sync Engine" (Processus en arrière-plan JS) prend le nouvel enregistrement, l'envoie à l'API Cloud. Si succès, met à jour `sync_status = 1` dans SQLite.
   - **Si NON :** L'opération s'arrête là sans bloquer l'utilisateur.

### 3.3 Workflow de Résolution (Retour du réseau)

1. Écouteur de statut réseau (Online/Offline event du navigateur ou module `os`).
2. Dès le retour de la connexion, déclenchement d'un job de Push.
3. Parcours de la base SQLite `WHERE sync_status = 0`, envoi par lots (Batch) vers le Cloud.

### 3.4 Workflow de Récupération (Du Cloud vers la caisse - Pull)

1. Essentiel pour le mode Mutli-postes.
2. À chaque démarrage, ou toutes les X minutes, la caisse interroge le Cloud : _"Donne-moi tout ce qui a été modifié (`last_modified_at`) après mon dernier Timestamp de synchronisation"_.
3. Si un produit a été créé sur une autre caisse, la caisse actuelle l'ajoute/le met à jour dans son SQLite local.

### 3.5 Initialisation Automatique du Cloud (Auto-Migration)

- Si une base de données Supabase vient d'être créée (totalement vide), **l'application Electron est capable de créer les tables automatiquement**.
- Lors de la première connexion réussie (via les paramètres), un script d'initialisation vérifie si les tables existent sur Supabase et lance les requêtes SQL (ex: `CREATE TABLE IF NOT EXISTS`) pour construire le schéma distant à l'identique du schéma local.

### 3.6 Stratégie de Sauvegarde (Backup)

- **Backup Cloud Automatique :** Supabase offre nativement des sauvegardes automatiques de la base de données.
- **Backup Local Manuel :** L'application Electron `ClinoCaisse` disposera d'une fonction "Exporter une sauvegarde de la caisse". Cela créera une copie sécurisée du fichier SQLite local.
- **Restauration Massive (Full-Push) :** En cas d'effacement du Cloud, la caisse "Maître" pourra déclencher une fonction "Forcer l'envoi total" qui reconstruira le Cloud à partir des données locales.

## 4. Tableau de Bord Web (Gestion à distance)

- **Rôle :** Lecture et Analyse, possiblement Ajout de produits. Ne fait pas de vente.
- **Fonctionnalités :**
  - Graphiques de chiffre d'affaires (par jour, semaine, mois).
  - Statistique des produits les plus vendus.
  - Gestion de l'inventaire en temps réel (Si un poste est en ligne).
  - Exports comptables (Excel/CSV).
- **Communication :** Branché directement et exclusivement sur le Cloud (Supabase/Firebase).

## 5. Sécurité

- Chiffrement en transit (HTTPS/TLS) entre la caisse et le cloud.
- Le Cloud ne contient pas la copie des identifiants caissiers en clair.
- Utilisation des RLS (Row Level Security) sur Supabase pour cloisonner les données par ID de Boutique/Restaurant au cas où le service devient en mode SaaS (Multi-clients).
