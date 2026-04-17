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
    getAlertes: ()                    => ipcRenderer.invoke('stock:getAlertes'),
    ajustement: (id, qty, motif)      => ipcRenderer.invoke('stock:ajustement', id, qty, motif),
    historique: (id)                  => ipcRenderer.invoke('stock:historique', id),
  },

  reservations: {
    getAll: (filter)                  => ipcRenderer.invoke('reservations:getAll', filter),
    getTodayMarkers: ()              => ipcRenderer.invoke('reservations:getTodayMarkers'),
    create: (data)                    => ipcRenderer.invoke('reservations:create', data),
    updateStatus: (id, status)       => ipcRenderer.invoke('reservations:updateStatus', id, status),
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
    test: (printerName)           => ipcRenderer.invoke('printer:test', printerName),
  },

  // ── SYNCHRONISATION CLOUD ─────────────────────────────────────────────
  sync: {
    configure:  (url, key) => ipcRenderer.invoke('sync:configure', url, key),
    test:       ()         => ipcRenderer.invoke('sync:test'),
    push:       ()         => ipcRenderer.invoke('sync:push'),
    pull:       ()         => ipcRenderer.invoke('sync:pull'),
    fullPush:   ()         => ipcRenderer.invoke('sync:fullPush'),
    backupLocal:()         => ipcRenderer.invoke('sync:backupLocal'),
    getStatus:  ()         => ipcRenderer.invoke('sync:getStatus'),
    getConfig:  ()         => ipcRenderer.invoke('sync:getConfig'),
  },

  // ── ANALYTIQUE ──────────────────────────────────────────────────────
  analytique: {
    getVentesByPeriod: (days)         => ipcRenderer.invoke('analytique:getVentesByPeriod', days),
    getVentesToday:    ()             => ipcRenderer.invoke('analytique:getVentesToday'),
    getTopProduits:    (days, limit)  => ipcRenderer.invoke('analytique:getTopProduits', days, limit),
    getPaiementStats:  (days)         => ipcRenderer.invoke('analytique:getPaiementStats', days),
    getCAParJour:      (days)         => ipcRenderer.invoke('analytique:getCAParJour', days),
    getClotures:       (days)         => ipcRenderer.invoke('analytique:getClotures', days),
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
    addEmploye:            (data)  => ipcRenderer.invoke('rh:addEmploye', data),
    addPaiement:           (data)  => ipcRenderer.invoke('rh:addPaiement', data),
    updateEmploye:         (data)  => ipcRenderer.invoke('rh:updateEmploye', data),
    deletePaiement:        (uuid)  => ipcRenderer.invoke('rh:deletePaiement', uuid),
    getEmployeeNetSalary:  (uuid)  => ipcRenderer.invoke('rh:getEmployeeNetSalary', uuid),
  }
});

