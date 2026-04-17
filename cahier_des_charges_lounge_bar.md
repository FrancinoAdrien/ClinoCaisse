# 📄 CAHIER DES CHARGES

## Application de gestion – Lounge Bar & Grossiste de boissons

---

## 1. Contexte du projet

Le projet consiste à développer une application de gestion destinée à deux activités complémentaires :

- Un lounge bar
- Un grossiste de boissons (hygiéniques et alcoolisées)

L’application devra centraliser l’ensemble des opérations :

- Ventes
- Stock
- Achats
- Dépenses
- Salaires
- Clients
- Fournisseurs
- Caisse
- Rentabilité

### Plateformes cibles

- Ordinateur (Web)
- Android
- iPhone / iPad

---

## 2. Objectifs du projet

### Objectif général

Mettre en place une application de gestion complète permettant de piloter efficacement les activités commerciales et opérationnelles.

### Objectifs spécifiques

L’application doit permettre de :

- Gérer les ventes (bar et grossiste)
- Gérer les stocks multi-unités
- Suivre les achats et fournisseurs
- Enregistrer toutes les dépenses
- Gérer les salaires
- Calculer le coût des plats
- Analyser la rentabilité
- Gérer les crédits clients
- Suivre les livraisons
- Générer des rapports
- Sécuriser les accès

---

## 3. Spécificités métier (IMPORTANT)

### Types de produits

#### Boissons hygiéniques

- Eau
- Jus
- Sodas
- Boissons énergétiques

#### Boissons alcoolisées

- Bière
- Vin
- Whisky
- Rhum
- Vodka
- Liqueurs

---

### Contraintes spécifiques

L’application doit gérer :

- Multi-unités (carton / pack / unité)
- Conversion automatique
- Gestion des lots (option)
- Dates d’expiration
- Distinction alcool / non alcool
- Traçabilité
- Prix multiples

---

## 4. Architecture générale

### A. Noyau commun

- Utilisateurs
- Caisse
- Stock
- Dépenses
- Salaires
- Rapports
- Paramètres

### B. Module Lounge Bar

- Tables
- Commandes
- Cuisine / bar
- Réservations
- Recettes / plats

### C. Module Grossiste

- Clients
- Ventes en gros
- Crédits
- Livraisons
- Fournisseurs

---

## 5. Plateformes et exigences techniques

- Application web (ordinateur)
- Application mobile Android
- Application mobile iOS
- Synchronisation des données
- Fonctionnement hors ligne (souhaité)
- Sauvegarde automatique
- Sécurité des données

---

## 6. Besoins fonctionnels

---

### 6.1 Tableau de bord

Affichage :

- Chiffre d’affaires (bar + grossiste)
- Dépenses
- Bénéfice estimatif
- Stock faible
- Dettes clients
- Dettes fournisseurs
- Produits les plus vendus
- Produits les plus rentables
- Ventes alcool vs non alcool
- Livraisons en cours

---

### 6.2 Gestion des utilisateurs

#### Rôles

- Administrateur
- Gérant
- Caissier
- Serveur
- Cuisinier
- Magasinier
- Vendeur grossiste
- Comptable
- Livreur

#### Gestion

- Création
- Droits d’accès
- Historique des actions

---

### 6.3 Module Lounge Bar

#### a. Tables

- Plan des tables
- Statut (libre / occupée / réservée)
- Fusion / division

#### b. Commandes

- Par table
- À emporter
- Remarques
- Suivi statut

#### c. Menu

- Catégories
- Prix
- Disponibilité

#### d. Cuisine / bar

- Écran de préparation
- Statut des commandes

#### e. Réservations

- Client
- Date
- Nombre de personnes
- Événement

---

### 6.4 Module Grossiste

#### a. Produits

- Prix d’achat
- Prix de gros
- Prix détail
- Gestion multi-unités

#### b. Ventes

- Comptant
- Crédit
- Factures
- Bons de livraison

#### c. Clients

- Historique
- Crédit
- Plafond

#### d. Livraison

- Tournée
- Livreur
- Statut

---

### 6.5 Module Stock (CRITIQUE)

#### Fonctionnalités

- Entrée / sortie
- Inventaire
- Seuil d’alerte
- Pertes

#### Spécificités

- Gestion carton / pack / unité
- Conversion automatique
- Stock séparé :
  - Grossiste
  - Lounge bar

#### Transfert interne

- Grossiste → Bar

---

### 6.6 Module Achats

- Fournisseurs
- Commandes
- Réception
- Dettes

---

### 6.7 Module Dépenses

#### Catégories

- Achats
- Salaires
- Loyer
- Électricité
- Transport
- DJ / événements

#### Fonctions

- Saisie
- Justificatif
- Suivi

---

### 6.8 Module Salaires

#### Par employé

- Poste
- Salaire
- Primes
- Avances

#### Calcul

- Coût total personnel
- Coût journalier

---

### 6.9 Module Recettes & Coût des plats

#### Pour chaque plat

- Ingrédients
- Quantités
- Coût

#### Calcul

- Coût matière
- Coût total
- Prix de vente
- Marge

#### Extension

- Ajout part salaire
- Ajout charges (gaz, électricité)

---

### 6.10 Module Rentabilité

#### Calculs

- Marge par produit
- Marge par plat
- Bénéfice journalier
- Bénéfice mensuel

---

### 6.11 Module Caisse

- Ouverture
- Encaissement
- Clôture
- Écart
- Modes de paiement

---

### 6.12 Module Crédits

- Suivi dettes clients
- Paiements partiels
- Alertes

---

### 6.13 Module Rapports

- Ventes
- Dépenses
- Stock
- Salaires
- Rentabilité
- Crédits

#### Export

- PDF
- Excel

---

### 6.14 Module Paramètres

- Nom entreprise
- Logo
- Devise (Ariary)
- Unités
- Catégories

---

## 7. Besoins non fonctionnels

### Sécurité

- Authentification
- Gestion des rôles
- Sauvegarde
- Traçabilité

### Performance

- Rapide
- Fluide

### Ergonomie

- Simple
- Intuitive

---
