'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Expose une API sécurisée au renderer via window.api
contextBridge.exposeInMainWorld('api', {

  // ── AUTH ─────────────────────────────────────────────────────────────
  auth: {
    login: (pin)          => ipcRenderer.invoke('auth:login', pin),
    logout: ()            => ipcRenderer.invoke('auth:logout'),
    getSession: ()        => ipcRenderer.invoke('auth:getSession'),
  },

  // ── PRODUITS & CATÉGORIES ─────────────────────────────────────────────
  produits: {
    getAll: ()                    => ipcRenderer.invoke('produits:getAll'),
    getByCategorie: (catId)       => ipcRenderer.invoke('produits:getByCategorie', catId),
    getById: (id)                 => ipcRenderer.invoke('produits:getById', id),
    create: (data)                => ipcRenderer.invoke('produits:create', data),
    update: (id, data)            => ipcRenderer.invoke('produits:update', id, data),
    delete: (id)                  => ipcRenderer.invoke('produits:delete', id),
    search: (query)               => ipcRenderer.invoke('produits:search', query),
    updateStock: (id, qty, op)    => ipcRenderer.invoke('produits:updateStock', id, qty, op),
    getIngredients: (id)          => ipcRenderer.invoke('produits:getIngredients', id),
    uploadImage: (dataUrl, fileName, produitId) => ipcRenderer.invoke('produits:uploadImage', dataUrl, fileName, produitId),
  },
  categories: {
    getAll: ()            => ipcRenderer.invoke('categories:getAll'),
    create: (data)        => ipcRenderer.invoke('categories:create', data),
    update: (id, data)    => ipcRenderer.invoke('categories:update', id, data),
    delete: (id)          => ipcRenderer.invoke('categories:delete', id),
  },

  // ── VENTES ───────────────────────────────────────────────────────────
  ventes: {
    create: (data)        => ipcRenderer.invoke('ventes:create', data),
    getAll: ()            => ipcRenderer.invoke('ventes:getAll'),
    getById: (id)         => ipcRenderer.invoke('ventes:getById', id),
    getByDate: (date)     => ipcRenderer.invoke('ventes:getByDate', date),
    annuler: (id)         => ipcRenderer.invoke('ventes:annuler', id),
    getStatsByProduit:(d) => ipcRenderer.invoke('ventes:getStatsByProduit', d),
  },

  // ── TICKETS TABLE ────────────────────────────────────────────────────
  tables: {
    getAll: ()                        => ipcRenderer.invoke('tables:getAll'),
    getConfig: ()                     => ipcRenderer.invoke('tables:getConfig'),
    sauvegarder: (data)               => ipcRenderer.invoke('tables:sauvegarder', data),
    charger: (id)                     => ipcRenderer.invoke('tables:charger', id),
    supprimer: (id)                   => ipcRenderer.invoke('tables:supprimer', id),
    ajouterTable: ()                  => ipcRenderer.invoke('tables:ajouterTable'),
    supprimerTable: (num)             => ipcRenderer.invoke('tables:supprimerTable', num),
  },

  // ── STOCK ────────────────────────────────────────────────────────────
  stock: {
    getAlertes:      ()                           => ipcRenderer.invoke('stock:getAlertes'),
    getAlertesCount: ()                           => ipcRenderer.invoke('stock:getAlertesCount'),
    ajustement:      (id, qty, motif, op, pu, pt, impactCapital) => ipcRenderer.invoke('stock:ajustement', id, qty, motif, op, pu, pt, impactCapital),
    historique:      (id)                          => ipcRenderer.invoke('stock:historique', id),
  },

  reservations: {
    getAll:              (filter)      => ipcRenderer.invoke('reservations:getAll', filter),
    getTodayMarkers:     ()            => ipcRenderer.invoke('reservations:getTodayMarkers'),
    create:              (data)        => ipcRenderer.invoke('reservations:create', data),
    updateStatus:        (id, status)  => ipcRenderer.invoke('reservations:updateStatus', id, status),
    marquerArrive:       (id)          => ipcRenderer.invoke('reservations:marquerArrive', id),
    reporter:            (id, data)    => ipcRenderer.invoke('reservations:reporter', id, data),
    getOverdue:          ()            => ipcRenderer.invoke('reservations:getOverdue'),
    checkDisponibilite:  (data)        => ipcRenderer.invoke('reservations:checkDisponibilite', data),
  },

  cuisine: {
    getLignes: ()                     => ipcRenderer.invoke('cuisine:getLignes'),
    setStatut: (ligneId, statut)     => ipcRenderer.invoke('cuisine:setStatut', ligneId, statut),
  },

  // ── CLÔTURE ──────────────────────────────────────────────────────────
  cloture: {
    rapportX: ()                      => ipcRenderer.invoke('cloture:rapportX'),
    rapportParDate: (date)            => ipcRenderer.invoke('cloture:rapportParDate', date),
    rapportParVendeur: (vendeur)      => ipcRenderer.invoke('cloture:rapportParVendeur', vendeur),
    faireClotureZ: (data)             => ipcRenderer.invoke('cloture:faireClotureZ', data),
    getDerniereZ: ()                  => ipcRenderer.invoke('cloture:getDerniereZ'),
    getVendeurs: ()                   => ipcRenderer.invoke('cloture:getVendeurs'),
  },

  // ── UTILISATEURS ─────────────────────────────────────────────────────
  utilisateurs: {
    getAll: ()            => ipcRenderer.invoke('utilisateurs:getAll'),
    getActifs: ()         => ipcRenderer.invoke('utilisateurs:getActifs'),
    create: (data)        => ipcRenderer.invoke('utilisateurs:create', data),
    update: (id, data)    => ipcRenderer.invoke('utilisateurs:update', id, data),
    desactiver: (id)      => ipcRenderer.invoke('utilisateurs:desactiver', id),
    reactiver: (id)       => ipcRenderer.invoke('utilisateurs:reactiver', id),
  },

  // ── PARAMÈTRES ────────────────────────────────────────────────────────
  parametres: {
    get: (cle)            => ipcRenderer.invoke('parametres:get', cle),
    getAll: ()            => ipcRenderer.invoke('parametres:getAll'),
    set: (cle, valeur)    => ipcRenderer.invoke('parametres:set', cle, valeur),
    setBulk: (data)       => ipcRenderer.invoke('parametres:setBulk', data),
    uploadLogo: (dataUrl, fileName) => ipcRenderer.invoke('parametres:uploadLogo', dataUrl, fileName),
  },

  // ── THÈME ────────────────────────────────────────────────────────────
  theme: {
    get: (userId)         => ipcRenderer.invoke('theme:get', userId),
    save: (userId, theme) => ipcRenderer.invoke('theme:save', userId, theme),
  },

  // ── IMPRESSION ────────────────────────────────────────────────────────
  printer: {
    getList: ()                   => ipcRenderer.invoke('printer:getList'),
    printTicket: (data)           => ipcRenderer.invoke('printer:printTicket', data),
    printCloture: (data)          => ipcRenderer.invoke('printer:printCloture', data),
    printBon: (data)              => ipcRenderer.invoke('printer:printBon', data),
    printBonLivraison: (data)     => ipcRenderer.invoke('printer:printBonLivraison', data),
    test: (printerName)           => ipcRenderer.invoke('printer:test', printerName),
  },

  // ── SYNCHRONISATION CLOUD ─────────────────────────────────────────────
  sync: {
    configure:  (url, key) => ipcRenderer.invoke('sync:configure', url, key),
    test:       ()         => ipcRenderer.invoke('sync:test'),
    push:       ()         => ipcRenderer.invoke('sync:push'),
    pull:       ()         => ipcRenderer.invoke('sync:pull'),
    fullPull:   ()         => ipcRenderer.invoke('sync:fullPull'),
    fullPush:   ()         => ipcRenderer.invoke('sync:fullPush'),
    backupLocal:()         => ipcRenderer.invoke('sync:backupLocal'),
    getStatus:  ()         => ipcRenderer.invoke('sync:getStatus'),
    getConfig:  ()         => ipcRenderer.invoke('sync:getConfig'),
    sendTables: ()         => ipcRenderer.invoke('sync:sendTables'),
  },

  // ── ANALYTIQUE ──────────────────────────────────────────────────────
  analytique: {
    getVentesByPeriod: (days)         => ipcRenderer.invoke('analytique:getVentesByPeriod', days),
    getVentesToday:    ()             => ipcRenderer.invoke('analytique:getVentesToday'),
    getTopProduits:    (days, limit)  => ipcRenderer.invoke('analytique:getTopProduits', days, limit),
    getPaiementStats:  (days)         => ipcRenderer.invoke('analytique:getPaiementStats', days),
    getCAParJour:      (days)         => ipcRenderer.invoke('analytique:getCAParJour', days),
    getClotures:       (days)         => ipcRenderer.invoke('analytique:getClotures', days),
    getOverview:       (range)        => ipcRenderer.invoke('analytique:getOverview', range),
  },

  // ── JOURNAL D'ACTIVITÉ ────────────────────────────────────────────────
  journal: {
    getAll:      (params) => ipcRenderer.invoke('journal:getAll', params),
    getStats:    ()       => ipcRenderer.invoke('journal:getStats'),
    log:         (data)   => ipcRenderer.invoke('journal:log', data),
    exportExcel: (params) => ipcRenderer.invoke('journal:exportExcel', params),
    exportWord:  (params) => ipcRenderer.invoke('journal:exportWord', params),
  },

  // ── FINANCES ─────────────────────────────────────────────────────────
  finances: {
    getStats:          ()       => ipcRenderer.invoke('finances:getStats'),
    getCapital:        ()       => ipcRenderer.invoke('finances:getCapital'),
    setCapital:        (m)      => ipcRenderer.invoke('finances:setCapital', m),
    getDepenses:       (limit)  => ipcRenderer.invoke('finances:getDepenses', limit),
    getDettes:         ()       => ipcRenderer.invoke('finances:getDettes'),
    commander:         (data)   => ipcRenderer.invoke('finances:commander', data),
    payerDepense:      (uuid)   => ipcRenderer.invoke('finances:payerDepense', uuid),
    addDepense:        (data)   => ipcRenderer.invoke('finances:addDepense', data),
    getRecettes:       (limit)  => ipcRenderer.invoke('finances:getRecettes', limit),
    getCreances:       ()       => ipcRenderer.invoke('finances:getCreances'),
    addCreance:        (data)   => ipcRenderer.invoke('finances:addCreance', data),
    encaisserCreance:  (uuid)   => ipcRenderer.invoke('finances:encaisserCreance', uuid),
    getMouvements:     (limit)  => ipcRenderer.invoke('finances:getMouvements', limit),
    getAchats:         (limit)  => ipcRenderer.invoke('finances:getAchats', limit),
    addAchat:          (data)   => ipcRenderer.invoke('finances:addAchat', data),
    addFlux:           (data)   => ipcRenderer.invoke('finances:addFlux', data),
  },


  // ── RH ───────────────────────────────────────────────────────────────
  rh: {
    getStats:              ()      => ipcRenderer.invoke('rh:getStats'),
    getEmployes:           ()      => ipcRenderer.invoke('rh:getEmployes'),
    getSalaires:           (limit) => ipcRenderer.invoke('rh:getSalaires', limit),
    getSalairesAPayer:     ()      => ipcRenderer.invoke('rh:getSalairesAPayer'),
    addEmploye:            (data)  => ipcRenderer.invoke('rh:addEmploye', data),
    addPaiement:           (data)  => ipcRenderer.invoke('rh:addPaiement', data),
    updateEmploye:         (data)  => ipcRenderer.invoke('rh:updateEmploye', data),
    deletePaiement:        (uuid)  => ipcRenderer.invoke('rh:deletePaiement', uuid),
    getEmployeeNetSalary:  (uuid)  => ipcRenderer.invoke('rh:getEmployeeNetSalary', uuid),
  },

  // ── LIVRAISONS ───────────────────────────────────────────────────────
  livraisons: {
    createFromCaisse: (data)   => ipcRenderer.invoke('livraisons:createFromCaisse', data),
    getAll: ()                 => ipcRenderer.invoke('livraisons:getAll'),
    getBonDetail: (id)         => ipcRenderer.invoke('livraisons:getBonDetail', id),
    updateStatut: (id, s, op) => ipcRenderer.invoke('livraisons:updateStatut', id, s, op),
    annuler: (id, op)          => ipcRenderer.invoke('livraisons:annuler', id, op),
    decaler: (id, data, op)    => ipcRenderer.invoke('livraisons:decaler', id, data, op),
  },

  // ── TERRAIN (Réservation d'espaces) ──────────────────────────────────
  terrain: {
    getEspaces:              ()           => ipcRenderer.invoke('terrain:getEspaces'),
    getAllEspaces:            ()           => ipcRenderer.invoke('terrain:getAllEspaces'),
    createEspace:            (data)       => ipcRenderer.invoke('terrain:createEspace', data),
    updateEspace:            (id, data)   => ipcRenderer.invoke('terrain:updateEspace', id, data),
    deleteEspace:            (id)         => ipcRenderer.invoke('terrain:deleteEspace', id),
    getReservations:         (filter)     => ipcRenderer.invoke('terrain:getReservations', filter),
    getReservationsCalendrier: (mois)     => ipcRenderer.invoke('terrain:getReservationsCalendrier', mois),
    createReservation:       (data)       => ipcRenderer.invoke('terrain:createReservation', data),
    payerSolde:              (id, m)      => ipcRenderer.invoke('terrain:payerSolde', id, m),
    annuler:                 (id, remb)   => ipcRenderer.invoke('terrain:annuler', id, remb),
    decaler:                 (id, data)   => ipcRenderer.invoke('terrain:decaler', id, data),
    getStats:                ()           => ipcRenderer.invoke('terrain:getStats'),
  },
  license: {
    status:   ()          => ipcRenderer.invoke('license:status'),
    activate: (key)       => ipcRenderer.invoke('license:activate', key),
    sync:     ()          => ipcRenderer.invoke('license:sync'),
  }
  ,
  // ── EVENTS (Main -> Renderer) ─────────────────────────────────────────
  events: {
    onDataChanged: (cb) => {
      if (typeof cb !== 'function') return;
      ipcRenderer.on('app:dataChanged', (_e, payload) => cb(payload));
    },
  }
});

