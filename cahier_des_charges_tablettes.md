# Cahier des Charges : Prise de Commande sur Tablette (Réseau Local)

## 1. Contexte et Objectif
Permettre aux serveurs d'un restaurant/bar de prendre les commandes directement sur une tablette tactile. Les commandes devront être transmises instantanément à la caisse principale (`ClinoCaisse`) et aux écrans/imprimantes de cuisine sans nécessiter de connexion internet.

## 2. Architecture Technique (Réseau Local)
L'approche choisie est un **Serveur Node.js embarqué dans Electron** communiquant via un réseau local (LAN / Wi-Fi classique).
- **Le Serveur (Caisse Principale) :** L'application Electron `ClinoCaisse` démarre au lancement un petit serveur Web (`express.js` + `socket.io`) branché sur l'IP locale (ex: `192.168.1.100:3000`).
- **Le Client (Les Tablettes) :** Aucune application à installer (pas de Play Store ou App Store). Les tablettes se connectent au Wi-Fi du restaurant, le serveur ouvre le navigateur (Chrome/Safari) et tape l'IP de la caisse.
- **L'Interface Web Client :** Une application type PWA (Progressive Web App) légère, codée en Vue.js ou React, spécialisée pour le tactile (Gros boutons, navigation rapide, catégories).

## 3. Workflow de Prise de Commande
1. Le serveur (personne physique) sélectionne une table libre sur sa tablette.
2. Il ajoute les produits (plats, boissons) demandés par le client.
3. Il clique sur "Valider la commande".
4. La PWA envoie un payload JSON via WebSocket (`socket.io`) ou requête HTTP à la caisse principale (`192.168.1.100:3000/api/commande`).
5. **Action Caisse Principale :**
   - Réception de la commande.
   - Enregistrement dans la base de données locale (SQLite).
   - Déclenchement automatique de l'impression du bon ou du ticket cuisine.
   - L'écran principal de ClinoCaisse (si quelqu'un le regarde) se met à jour en temps réel pour montrer la table occupée.

## 4. Spécifications du Serveur Local (Dans Electron)
- **Framework :** Express.js (pour servir les fichiers HTML/JS de l'application tablette) + Socket.io pour la communication bilatérale en temps réel.
- **Port d'écoute :** 3000 ou 8080.
- **Sécurité LAN :** Limitation possible par filtre IP si besoin (Whitelisting). L'interface tablette doit demander un code Pin (Code serveur) pour identifier qui passe la commande.

## 5. Spécifications de l'Interface Tablette (Web App)
- **Technologies :** Vue.js ou Vanilla JS avec CSS Tailwind (Simple, rapide).
- **Vues nécessaires :**
  1. Vue de connexion / Sélection du serveur (`Qui êtes-vous ?`).
  2. Vue des tables (`Table 1, Table 2...`). Les tables occupées apparaissent en rouge, les libres en vert.
  3. Vue du Menu (Catégories à gauche, Produits au centre, Résumé de la commande à droite).
- **PWA Ready :** Possibilité d'ajouter l'icône de l'application web directement sur l'écran d'accueil de la tablette pour qu'elle s'ouvre en plein écran sans la barre d'adresse du navigateur.

## 6. Résilience 
- Ne dépend d'AUCUNE connexion Internet.
- Si la caisse principale s'éteint, la tablette n'affiche plus rien (la connexion est perdue).
- Très faible latence (< 50ms) grâce au Wi-Fi local.
