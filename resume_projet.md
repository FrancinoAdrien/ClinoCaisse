# Résumé Complet du Projet : ClinoCaisse

Ce document fournit une vue d'ensemble exhaustive du projet **ClinoCaisse**, incluant son architecture technique, sa base de données et l'explication détaillée de toutes ses fonctionnalités.

## 1. Vue d'ensemble et Technologies

**ClinoCaisse** est un logiciel de caisse (Point Of Sale - POS) professionnel de bureau, axé sur la gestion d'un restaurant, bar, lounge, ou d'espaces (terrains). Il est conçu de façon *Offline-First* avec une synchronisation Cloud temps réel en tâche de fond.

*   **Environnement** : [Electron](https://www.electronjs.org/) (Application Desktop Windows/macOS/Linux)
*   **Base de Données Locale** : `better-sqlite3` avec un mode WAL (Performances accrues).
*   **Base de Données Cloud (Synchronisation)** : `@supabase/supabase-js`
*   **Frontend (Interface utilisateur)** : Vanilla HTML, CSS, JavaScript (Pas de framework lourd, assurant un rendu rapide et natif via le DOM).
*   **Fonctionnalités supplémentaires** : Génération de documents Excel (`exceljs`) et Word (`docx`), gestion d'impression native (usb).

## 2. Architecture du Projet

L'application respecte rigoureusement l'architecture processus d'Electron :

*   **Main Process (`main.js` & `src/main/`)** : S'occupe de la création de la fenêtre, possède un accès exclusif à la base de données SQLite physique et implémente le moteur de synchronisation bi-directionnel local-cloud (`SyncEngine`).
*   **Renderer Process (`src/renderer/` & `index.html`)** : Exécute uniquement le code d'interface graphique. Il ne manipule *jamais* la base de données directement, mais passe par le pont IPC communiquant avec le Main.
*   **Preload Script (`preload.js`)** : Pont de sécurité limitant l'API exposée au navigateur via `window.ipcAPI`.

## 3. Détail Complet des Fonctionnalités (Modules)

Le projet est architecturé autour de nombreux modules métiers indépendants, situés dans `src/renderer/modules/`. Voici l'explication détaillée de chaque fonctionnalité :

### 🛒 Module Caisse (`caisse`)
C'est le cœur de l'application (Point of Sale).
*   **Fonctionnalité** : Permet de saisir les commandes, de scanner des codes-barres, d'appliquer des remises manuelles, et d'encaisser les clients selon plusieurs modes de paiement (Cash, Mobile Money, Carte).
*   **Gestion des Tables** : Permet de créer, mettre en attente et rappeler des commandes assignées à des tables spécifiques.

### 📊 Module Dashboard (`dashboard`)
*   **Fonctionnalité** : La page d'accueil après connexion. Elle affiche une vue d'ensemble instantanée (chiffre d'affaires, nombre de tickets) et des graphiques statistiques de l'activité actuelle du restaurant ou magasin.

### 📦 Module Stock & Grossiste (`stock`)
*   **Fonctionnalité** : Gère l'inventaire complet de l'établissement. Il surveille le stock "Bar" local, mais intègre aussi une gestion "Grossiste" complète (gestion par Lots avec dates de péremption, transferts de stock du grossiste au bar).
*   **Produits Composites (Recettes)** : Permet de créer un plat final déduisant proportionnellement les stocks de chaque ingrédient lors d'une vente.

### 💰 Module Finances (`finances`)
*   **Fonctionnalité** : Centre névralgique de la trésorerie.
*   Il gère les crédits/dettes des clients (achats à crédit et paiements différés).
*   Il assure le suivi des dépenses quotidiennes du commerce, et la gestion des paiements aux fournisseurs (achat de marchandises).
*   Il offre un journal comptable des entrées (ventes) et sorties (dépenses, salaires).

### 👥 Module Ressources Humaines (`rh`)
*   **Fonctionnalité** : Gère les employés de l'établissement.
*   Permet le suivi des salaires fixes, le calcul des avances sur salaire, et la validation ou l'annulation du paiement (qui se répercute automatiquement dans les finances).

### 📅 Module Réservations (`reservations` & `terrain`)
*   **Fonctionnalité** : Un système double de planification.
*   **Tables** : Gère les réservations de tables multiples avec horaires et gestion d'événements.
*   **Espaces/Terrains** : Gère la facturation de location de terrains (foot, salles) avec des tarifs à la durée (heure) et statuts de paiements (acomptes).

### 🍳 Module Cuisine (`cuisine`)
*   **Fonctionnalité** : Le "Kitchen Display System" (KDS).
*   Sur un écran déporté en cuisine ou au bar, affiche les commandes en temps réel au fur et à mesure que la caisse les enregistre. Les cuisiniers peuvent valider le statut des plats (de "en préparation" à "servi").

### 🔐 Module Utilisateurs & Sécurité (`utilisateurs`)
*   **Fonctionnalité** : Permet à l'administrateur de créer les comptes employés. L'accès au logiciel est protégé par code PIN (via le module `login`).
*   Il gère pas moins de 18 niveaux de permissions strictes (accès à la caisse, possibilité de supprimer une vente, droit de voir le stock, etc.).

### 🔒 Module Clôture (`cloture`)
*   **Fonctionnalité** : Écran indispensable de fin de service (Ticket Z).
*   Calcule officiellement le chiffre d'affaires déclaré par l'application, l'encaisse physique entrée par le caissier, et calcule tout "écart de caisse" (manquant ou surplus) avant de tirer un rapport imprimé.

### 📔 Module Journal Activité (`journal`)
*   **Fonctionnalité** : Un historique indélébile pour un traçage absolu (Audit).
*   Enregistre automatiquement toutes les actions cruciales effectuées par le personnel (création de produit, suppression d'un ticket de caisse, décaissement, etc.) avec la date, l'utilisateur et les détails.

### 📈 Module Analytique (`analytique`)
*   **Fonctionnalité** : Moteur de génération de rapports professionnels. Produit des reporting formatés exportables au format Excel (XLSX) et Word (DOCX) pour une analyse comptable profonde.

### ⚙️ Module Paramètres & Thème (`parametres` & `theme-selector`)
*   **Fonctionnalité** : Centralise toute la configuration de l'établissement (Nom, Adresse, NIF/STAT pour les factures).
*   Configure les imprimantes thermiques pour sortir les tickets de caisse.
*   Permet d'entrer les clés API Supabase pour initialiser le moteur de synchronisation.
*   Gère le côté esthétique (Mode sombre, palettes de couleurs).

## 4. Modèle de Données (La Base de Données)

La base `better-sqlite3` possède un maillage de 27 tables pour soutenir ce système complet.
De par son paradigme "Offline-First", la majorité des entités incorporent scrupuleusement 4 paramètres clés : `uuid` (Primary Key générées localement), `last_modified_at` (Timestamp des updates), `sync_status` (0: à synchroniser, 1: synchronisé), et `poste_source` (Origine de la modification).

Le spectre couvre :
* L'Entité Métier de vente : `produits`, `categories`, `ventes`, `lignes_vente`.
* La Logistique : `stock_historique`, `stock_lots`, `stock_transferts`.
* La Finance globale : `clotures`, `depenses`, `creances_clients`, `achats`.
* Les Ressources : `employes`, `salaires_paiements`, `fournisseurs`, `clients`.

## 5. Flux de Synchronisation Cloud Intégré

Grâce à `src/main/sync/syncEngine.js`, ClinoCaisse assure une continuité de service invulnérable aux coupures internet de l'entreprise locale :
1. Une vente (ou n'importe quelle action) encodée "bloque" la donnée dans la base SQLite locale avec le drapeau `sync_status = 0`.
2. Le `SyncEngine` scrute la base en arrière-plan toutes les X secondes.
3. Dès que du réseau mondial est disponible, il propulse les UUIDs modifiés sur l'API **Supabase**.
4. Supabase met à jour la base dans le cloud et le moteur Electron local remet les drapeaux à 1.
5. S'il existe plusieurs Caisses physiques sur le même restaurant, le moteur écoute aussi les changements Supabase et les injecte silencieusement dans le SQLite local pour le garder à jour sans rafraîchir l'interface (via WebSocket ou Polling adaptatif).
