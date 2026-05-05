'use strict';

(function CaisseModule() {

  // ── STATE ──────────────────────────────────────────────────────────────
  let state = {
    categories: [],
    produits: [],
    panier: [],        // { produit_id, nom, prix, qte, remise, offert }
    selectedIndex: -1,
    activeCatId: null,
    searchQuery: '',
    tableActive: null, // { id, numero, nom_table }
    devise: 'Ar',
    remise1: 10,
    remise2: 20,
    // Persistance impression
    impression: { actif: true, copies: 1 },
    // Dernier ticket généré pour visualisation
    dernierTicket: null,
  };

  // ── HELPERS ───────────────────────────────────────────────────────────
  function calcLigneTotal(l) {
    if (l.offert) return 0;
    const base = l.prix * l.qte;
    return Math.round(Math.max(0, base - base * l.remise / 100));
  }

  function calcTotal() {
    return state.panier.reduce((s, l) => s + calcLigneTotal(l), 0);
  }

  // ── RENDU PRINCIPAL ───────────────────────────────────────────────────
  function render() {
    const container = document.getElementById('view-caisse');
    container.innerHTML = `
      <!-- TOPBAR -->
      <div class="caisse-topbar">
        <button class="btn btn-ghost btn-sm" id="caisse-retour">← Retour</button>
        <span class="caisse-topbar-title">Caisse</span>
        <span class="caisse-vendeur" id="caisse-vendeur"></span>
        <div style="flex:1"></div>
        <button class="btn btn-ghost btn-sm caisse-kitchen-bell" id="btn-caisse-cuisine" title="Cuisine & bar">
          <span class="caisse-kitchen-ico">🔔</span>
          <span class="caisse-kitchen-badge caisse-kitchen-badge--attente" id="caisse-kitchen-attente" style="display:none">0</span>
          <span class="caisse-kitchen-badge caisse-kitchen-badge--pret" id="caisse-kitchen-pret" style="display:none">0</span>
        </button>
        <span id="caisse-date" style="font-size:12px;opacity:0.55;color:var(--text)"></span>
      </div>

      <!-- BODY 3 COLONNES -->
      <div class="caisse-body">

        <!-- ── CATÉGORIES ── -->
        <div class="caisse-col-cats" id="caisse-cats-list"></div>

        <!-- ── PRODUITS ── -->
        <div class="caisse-col-products">
          <div class="products-search">
            <input type="text" id="product-search" placeholder="Rechercher un produit..." />
          </div>
          <div class="products-grid" id="products-grid">
            <div class="products-empty" style="width:100%">
              <div style="font-size:40px">📦</div><p>Chargement...</p>
            </div>
          </div>
        </div>

        <!-- ── PANIER ── -->
        <div class="caisse-col-panier">

          <!-- Header -->
          <div class="panier-header">
            <h3>Panier</h3>
            <span id="panier-count">0</span>
            <button class="btn btn-ghost btn-sm" id="btn-vider-panier" style="margin-left:auto;font-size:11px" title="Vider le panier">Vider</button>
          </div>

          <!-- Tableau articles -->
          <div class="panier-table-wrap">
            <table class="panier-table">
              <thead>
                <tr>
                  <th style="width:28px">Qté</th>
                  <th>Article</th>
                  <th style="width:32px">🔔</th>
                  <th style="width:50px">Rem</th>
                  <th style="width:80px;text-align:right">Prix</th>
                </tr>
              </thead>
              <tbody id="panier-tbody"></tbody>
            </table>
          </div>

          <!-- Totaux -->
          <div class="panier-total-zone">
            <div class="panier-total-line"><span>Sous-total</span><span id="p-sous-total">0 ${state.devise}</span></div>
            <div class="panier-total-line"><span>Remises</span><span id="p-remises" style="color:#f39c12">-0 ${state.devise}</span></div>
            <div class="panier-total-line total-ttc">
              <span>TOTAL</span>
              <span id="p-total">0 ${state.devise}</span>
            </div>
          </div>

          <!-- ACTIONS PANIER -->
          <div class="panier-actions">

            <!-- Ligne 1 : Remise (select) + Offert -->
            <div class="panier-act-row">
              <div class="remise-select-wrap" style="flex:2">
                <select id="remise-select">
                  <option value="0">— Remise —</option>
                  <option id="remise-opt1" value="">10%</option>
                  <option id="remise-opt2" value="">20%</option>
                  <option value="custom">Saisir...</option>
                </select>
              </div>
              <button class="btn-offert-style" id="btn-offert">Offert</button>
              <button class="btn-suppr-style" id="btn-suppr-item">Supprimer</button>
            </div>

            <!-- Ligne Tables + Sauver table -->
            <div class="panier-act-row">
              <button class="btn-table-style" id="btn-tables" style="flex:1">
                Tables
                <span id="caisse-table-active-badge" style="display:none">&#9679;</span>
              </button>
              <button class="btn-table-style btn-sauver-table" id="btn-sauver-table" style="flex:1">
                Sauver table
              </button>
            </div>

            <!-- TICKET + LIVRAISON -->
            <div class="panier-act-row panier-ticket-row">
              <button class="btn-ticket-main" id="btn-ticket" type="button">TICKET</button>
              <button class="btn-livraison-main" id="btn-livraison" type="button">LIVRAISON</button>
            </div>

            <!-- VISUALISER panier courant -->
            <button class="btn-visu-main" id="btn-visualiser">
              Visualiser le ticket
            </button>

          </div>
        </div>
      </div>
    `;

    bindEvents();
    loadData();
    bindCuisineNotif();
    updateCuisineNotif();
    updateDateDisplay();
  }

  let _cuisineNotifTimer = null;
  let _cuisineNotifBound = false;

  function bindCuisineNotif() {
    if (_cuisineNotifBound) return;
    _cuisineNotifBound = true;

    document.getElementById('btn-caisse-cuisine')?.addEventListener('click', () => {
      Router.go('cuisine');
    });

    if (_cuisineNotifTimer) clearInterval(_cuisineNotifTimer);
    _cuisineNotifTimer = setInterval(() => {
      const v = document.getElementById('view-caisse');
      if (v?.classList.contains('active')) updateCuisineNotif();
    }, 5000);

    if (window.api?.events?.onDataChanged) {
      window.api.events.onDataChanged((payload) => {
        if (payload?.scope && payload.scope !== 'cuisine') return;
        const v = document.getElementById('view-caisse');
        if (v?.classList.contains('active')) updateCuisineNotif();
      });
    }
  }

  async function updateCuisineNotif() {
    try {
      const lignes = await window.api.cuisine.getLignes().catch(() => []) || [];
      const attente = lignes.filter(l => (l.statut_cuisine || '') === 'en_attente').length;
      const pret = lignes.filter(l => (l.statut_cuisine || '') === 'pret').length;

      const bA = document.getElementById('caisse-kitchen-attente');
      const bP = document.getElementById('caisse-kitchen-pret');
      if (bA) {
        bA.textContent = attente;
        bA.style.display = attente > 0 ? 'inline-flex' : 'none';
      }
      if (bP) {
        bP.textContent = pret;
        bP.style.display = pret > 0 ? 'inline-flex' : 'none';
      }
    } catch { /* silencieux */ }
  }

  // ── CHARGEMENT DONNÉES ────────────────────────────────────────────────
  async function loadData() {
    try {
      const [cats, prods, params] = await Promise.all([
        window.api.categories.getAll(),
        window.api.produits.getAll(),
        window.api.parametres.getAll(),
      ]);

      state.categories = cats;
      state.produits = prods.filter(p => !p.is_ingredient);
      state.remise1 = parseInt(params['caisse.remise1'] || '10');
      state.remise2 = parseInt(params['caisse.remise2'] || '20');
      state.devise = params['caisse.devise'] || 'Ar';

      // Infos entreprise (pour preview tickets / bons)
      state.entreprise = {
        nom: params['entreprise.nom'] || '',
        adresse: params['entreprise.adresse'] || '',
        ville: params['entreprise.ville'] || '',
        tel: params['entreprise.telephone'] || '',
        email: params['entreprise.email'] || '',
        nif: params['entreprise.nif'] || '',
        stat: params['entreprise.stat'] || '',
        slogan: params['entreprise.slogan'] || '',
        logo_url: params['entreprise.logo_url'] || ''
      };

      // Charger préf impression (localStorage pour persistance inter-session)
      const impPref = localStorage.getItem('cc_impression');
      if (impPref) {
        try { Object.assign(state.impression, JSON.parse(impPref)); } catch { }
      }

      // Mise à jour des options de remise avec les vraies valeurs
      const opt1 = document.getElementById('remise-opt1');
      const opt2 = document.getElementById('remise-opt2');
      if (opt1) { opt1.textContent = `${state.remise1}%`; opt1.value = state.remise1; }
      if (opt2) { opt2.textContent = `${state.remise2}%`; opt2.value = state.remise2; }

      const user = Session.getUser();
      const vendeurEl = document.getElementById('caisse-vendeur');
      if (vendeurEl && user) vendeurEl.textContent = user.nom;

      renderCategories();
      renderProducts();
      renderPanier();
    } catch (err) {
      Toast.error('Erreur de chargement');
    }
  }

  function updateDateDisplay() {
    const el = document.getElementById('caisse-date');
    if (el) el.textContent = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  // ── CATÉGORIES ────────────────────────────────────────────────────────
  function renderCategories() {
    const list = document.getElementById('caisse-cats-list');
    if (!list) return;
    list.innerHTML = `
      <div class="cat-item${!state.activeCatId ? ' active-cat' : ''}" data-cat-id="">Toutes</div>
      ${state.categories.filter(c => c.code !== 'TOUT').map(c => `
        <div class="cat-item${state.activeCatId === c.id ? ' active-cat' : ''}" data-cat-id="${c.id}">${Utils.esc(c.nom)}</div>
      `).join('')}
    `;
    list.querySelectorAll('.cat-item').forEach(item => {
      item.addEventListener('click', () => {
        state.activeCatId = item.dataset.catId ? parseInt(item.dataset.catId) : null;
        state.searchQuery = '';
        const si = document.getElementById('product-search');
        if (si) si.value = '';
        renderCategories();
        renderProducts();
      });
    });
  }

  // ── PRODUITS ──────────────────────────────────────────────────────────
  function renderProducts(prods = null) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    let toShow = prods || state.produits;
    if (state.activeCatId) toShow = toShow.filter(p => p.categorie_id === state.activeCatId);
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      toShow = toShow.filter(p => p.nom.toLowerCase().includes(q) || (p.reference || '').includes(q));
    }

    if (!toShow.length) {
      grid.innerHTML = `<div class="products-empty" style="width:100%"><div style="font-size:36px">🔍</div><p>Aucun produit</p></div>`;
      return;
    }

    grid.innerHTML = toShow.map(p => {
      const isPrep = !!p.is_prepared;
      const si = isPrep ? (p.virtual_stock ?? 0) : p.stock_actuel;
      const inf = si === -1, rup = (isPrep ? si <= 0 : (!inf && si <= 0));
      const ale = !inf && !rup && si <= (p.stock_alerte || 0);
      
      const stockCls = rup ? 'rupture' : ale ? 'alerte' : '';
      let stockLbl = '';
      if (isPrep) {
        stockLbl = rup ? '🥣 0' : `🥣 ${si}`;
      } else if (!inf) {
        stockLbl = rup ? '⛔ 0' : ale ? `⚠ ${si}` : `${si}`;
      }

      const imgHtml = p.image_data
        ? `<img class="card-img" src="${p.image_data}" alt="" />`
        : ``;
      return `
        <div class="product-card${rup ? ' stock-out' : ale ? ' stock-low' : ''}"
             data-id="${p.id}" data-prix="${p.prix_vente_ttc}"
             data-nom="${Utils.esc(p.nom)}" data-stock="${si}" 
             data-is-prep="${isPrep ? 1 : 0}" title="${Utils.esc(p.nom)}">
          ${imgHtml}
          <div class="card-nom">${Utils.esc(p.nom)}</div>
          <div class="card-prix">${Math.round(p.prix_vente_ttc).toLocaleString('fr-FR')} ${state.devise}</div>
          ${stockLbl ? `<div class="card-stock ${stockCls}">${stockLbl}</div>` : ''}
        </div>`;
    }).join('');

    grid.querySelectorAll('.product-card:not(.stock-out)').forEach(card => {
      card.addEventListener('click', () => {
        // Retirer la couleur verte des autres cards
        grid.querySelectorAll('.product-card').forEach(c => c.classList.remove('selected-product'));
        // Mettre la couleur verte métallique sur la card cliquée
        card.classList.add('selected-product');

        ajouterAuPanier({
          produit_id: card.dataset.id,
          nom: card.getAttribute('data-nom'),
          prix: parseFloat(card.dataset.prix),
          stock_actuel: parseFloat(card.dataset.stock),
          is_prepared: card.dataset.isPrep === '1'
        });
      });
    });
  }

  // ── PANIER — ACTIONS ──────────────────────────────────────────────────
  function ajouterAuPanier({ produit_id, nom, prix, stock_actuel, is_prepared }) {
    if (stock_actuel !== -1 || is_prepared) {
      const limit = is_prepared ? stock_actuel : stock_actuel;
      const deja = state.panier.filter(l => l.produit_id === produit_id).reduce((s, l) => s + l.qte, 0);
      if (deja >= limit) { Toast.warn(`Stock insuffisant (max ${limit})`); return; }
    }
    // Ne plus grouper les articles identiques, toujours ajouter en nouvelle ligne
    state.panier.push({ produit_id, nom, prix, qte: 1, remise: 0, offert: false, stock_actuel, is_prepared, envoi_cuisine: false });
    state.selectedIndex = state.panier.length - 1;
    renderPanier();
  }

  function renderPanier() {
    const tbody = document.getElementById('panier-tbody');
    if (!tbody) return;
    tbody.innerHTML = state.panier.map((l, i) => {
      const total = calcLigneTotal(l);
      const remTag = l.remise > 0 ? `<span class="tag-remise">-${l.remise}%</span>` : '';
      return `
        <tr class="${i === state.selectedIndex ? 'selected' : ''}${l.offert ? ' row-offert' : ''}" data-idx="${i}">
          <td class="td-qte">${l.qte}</td>
          <td class="td-nom">${Utils.esc(l.nom)}</td>
          <td class="td-kitchen">
            <button class="btn-kitchen-patch${l.envoi_cuisine ? ' active' : ''}" data-kidx="${i}" title="Envoyer en cuisine">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </button>
          </td>
          <td style="text-align:center">${l.offert ? '<span class="tag-remise" style="background:rgba(46,204,113,.2);color:#2ecc71">Offert</span>' : remTag}</td>
          <td class="td-prix">${l.offert ? '0' : Math.round(total).toLocaleString('fr-FR')} ${state.devise}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" style="text-align:center;padding:20px;opacity:0.4">Panier vide</td></tr>`;

    tbody.querySelectorAll('.btn-kitchen-patch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.kidx);
        state.panier[idx].envoi_cuisine = !state.panier[idx].envoi_cuisine;
        renderPanier();
      });
    });

    tbody.querySelectorAll('tr[data-idx]').forEach(row => {
      row.addEventListener('click', () => {
        state.selectedIndex = parseInt(row.dataset.idx);
        renderPanier();
      });
      row.addEventListener('dblclick', () => promptQte(parseInt(row.dataset.idx)));
    });

    updateTotals();
  }

  function updateTotals() {
    const total = calcTotal();
    const sousTotal = state.panier.reduce((s, l) => s + l.prix * l.qte * (l.offert ? 0 : 1), 0);
    const remises = sousTotal - total;
    const d = state.devise;

    document.getElementById('p-sous-total').textContent = `${Math.round(sousTotal).toLocaleString('fr-FR')} ${d}`;
    document.getElementById('p-remises').textContent = remises > 0 ? `-${Math.round(remises).toLocaleString('fr-FR')} ${d}` : `0 ${d}`;
    document.getElementById('p-total').textContent = `${Math.round(total).toLocaleString('fr-FR')} ${d}`;
    document.getElementById('panier-count').textContent = state.panier.reduce((s, l) => s + l.qte, 0);
  }

  function promptQte(idx) {
    Modal.prompt('Modifier quantité', `Qté pour "${state.panier[idx].nom}" :`, state.panier[idx].qte, val => {
      const q = parseInt(val);
      if (!q || q < 1) return;
      const l = state.panier[idx];
      const limit = l.is_prepared ? l.stock_actuel : l.stock_actuel;
      if (l.stock_actuel !== -1 || l.is_prepared) {
        if (q > limit) { Toast.warn(`Max ${limit}`); return; }
      }
      state.panier[idx].qte = q;
      renderPanier();
    });
  }

  function getSelected() {
    if (state.selectedIndex < 0 || state.selectedIndex >= state.panier.length) {
      Toast.warn('Sélectionnez un article dans le panier'); return null;
    }
    return state.panier[state.selectedIndex];
  }

  function appliquerRemise(pct) {
    if (!Session.hasPerm('perm_remises')) { Toast.warn('Permission remises requise'); return; }
    const l = getSelected(); if (!l) return;
    state.panier[state.selectedIndex].remise = pct;
    renderPanier();
    // Reset le select
    const sel = document.getElementById('remise-select');
    if (sel) sel.value = '0';
  }

  function toggleOffert() {
    if (!Session.hasPerm('perm_remises')) { Toast.warn('Permission remises requise'); return; }
    const l = getSelected(); if (!l) return;
    state.panier[state.selectedIndex].offert = !l.offert;
    renderPanier();
  }

  function supprimerItem() {
    const l = getSelected(); if (!l) return;
    state.panier.splice(state.selectedIndex, 1);
    state.selectedIndex = Math.min(state.selectedIndex, state.panier.length - 1);
    renderPanier();
  }

  function updateTableBadge() {
    const badge = document.getElementById('caisse-table-active-badge');
    if (!badge) return;
    // Affiche juste un point vert si une table est active, sans afficher le nom
    badge.style.display = state.tableActive ? '' : 'none';
  }

  // ── MODAL TABLES (voir tables / charger) ─────────────────────────────
  async function openTables() {
    const tables = await window.api.tables.getAll();
    const tabId = 'tables-' + Date.now();

    Modal.open({
      id: tabId,
      title: 'Tables',
      width: '860px',
      content: `
        <div style="display:flex;gap:16px;height:65vh;min-height:380px;max-height:600px;overflow:hidden;">
          <div style="display:flex;flex-direction:column;flex:0 0 400px;max-width:400px;height:100%;">
            <div style="color: #eee;font-size:11px;opacity:0.5;text-transform:uppercase;font-weight:700;margin-bottom:10px;letter-spacing:.5px;flex-shrink:0;">Choisir une table</div>
            <div class="tables-modal-grid" id="tables-grid" style="overflow-y:auto;flex:1;align-content:flex-start;">
              ${tables.map(t => renderTableCell(t)).join('')}
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;flex-shrink:0;">
              <button class="btn btn-ghost btn-sm" id="btn-ajouter-table">+ Ajouter table</button>
            </div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:10px;min-width:0;" id="table-detail-zone">
            <div style="font-size:12px;opacity:0.4;text-align:center;padding:40px; color: #eee;">Cliquez sur une table pour voir son contenu</div>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-ghost" data-close="${tabId}">Fermer</button>`,
    });

    setTimeout(() => {
      bindTableModal(tabId, tables);
      document.getElementById('btn-ajouter-table')?.addEventListener('click', async () => {
        const res = await window.api.tables.ajouterTable();
        if (res.success) {
          const t2 = await window.api.tables.getAll();
          document.getElementById('tables-grid').innerHTML = t2.map(t => renderTableCell(t)).join('');
          bindTableModal(tabId, t2);
        }
      });
    }, 20);
  }

  // ── SAUVER TABLE ──────────────────────────────────────────────────────
  async function openSauverTable() {
    if (!state.panier.length) { Toast.warn('Panier vide — rien à sauvegarder'); return; }

    const user = Session.getUser();

    // ── Cas : une table est déjà chargée → sauvegarder directement dessus ──
    if (state.tableActive && state.tableActive.id) {
      const ticketId = state.tableActive.id;
      const existing = await window.api.tables.charger(ticketId);
      const existingLignes = JSON.parse(existing?.lignes_json || '[]');
      const nomTable = existing?.nom_table || state.tableActive.nom_table;
      const num = state.tableActive.numero;

      // Construire les lignes actuelles du panier
      const newLignes = state.panier.map(l => ({
        produit_id: l.produit_id,
        produit_nom: l.nom,
        prix_unitaire: l.prix,
        quantite: l.qte,
        remise: l.remise || 0,
        est_offert: l.offert ? 1 : 0,
        total_ttc: calcLigneTotal(l),
      }));

      // Comparer : si le panier est identique aux lignes existantes, ne rien faire
      const panierInchange = (
        newLignes.length === existingLignes.length &&
        newLignes.every((nl, i) => {
          const el = existingLignes[i];
          return el &&
            el.produit_id === nl.produit_id &&
            el.quantite === nl.quantite &&
            el.remise === nl.remise &&
            el.est_offert === nl.est_offert;
        })
      );

      if (panierInchange) {
        Toast.info('Aucune modification — table inchangée');
        return;
      }

      // Sauvegarder directement (le panier contient déjà TOUT, on remplace)
      const res = await window.api.tables.sauvegarder({
        numero_table: num,
        nom_table: nomTable,
        nom_caissier: user?.nom || '-',
        lignes: newLignes,
      });

      if (res.success) {
        state.tableActive = null;
        updateTableBadge();
        state.panier = [];
        state.selectedIndex = -1;
        renderPanier();
        Toast.success(`Table ${nomTable} sauvegardée`);
      } else {
        Toast.error('Erreur : ' + res.message);
      }
      return;
    }

    // ── Cas : aucune table active → ouvrir le modal de sélection ──
    const tables = await window.api.tables.getAll();
    const savId = 'sauver-' + Date.now();

    Modal.open({
      id: savId,
      title: 'Sauvegarder sur une table',
      width: '640px',
      content: `
        <p style="font-size:13px;opacity:0.6;margin-bottom:14px">
          Choisissez une table. Si elle est <strong style="color:#2ecc71">occupée</strong>, les articles s'ajouteront à sa commande existante.
        </p>
        <div class="tables-modal-grid" id="sauver-tables-grid">
          ${tables.map(t => {
        const occ = !!t.ticket;
        const nom = t.ticket?.nom_table || `Table ${t.numero}`;
        const total = t.ticket?.montant_total || 0;
        return `
              <div class="table-cell ${occ ? 'occupee' : 'libre'}" data-num="${t.numero}" data-ticket-id="${t.ticket?.id || ''}">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${occ ? '#2ecc71' : 'rgba(255,255,255,0.3)'}" stroke-width="2" stroke-linecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  ${occ ? '<path d="M9 12l2 2 4-4"/>' : ''}
                </svg>
                <div class="tc-nom">${Utils.esc(nom)}</div>
                <div class="tc-statut">${occ ? 'OCCUPÉE' : 'LIBRE'}</div>
                ${occ ? `<div class="tc-total">${Math.round(total).toLocaleString('fr-FR')} ${state.devise}</div>` : ''}
              </div>`;
      }).join('')}
        </div>
      `,
      footer: `<button class="btn btn-ghost" data-close="${savId}">Annuler</button>`,
    });

    setTimeout(() => {
      document.querySelectorAll('#sauver-tables-grid .table-cell').forEach(card => {
        card.addEventListener('click', async () => {
          const num = parseInt(card.dataset.num);
          const ticketId = card.dataset.ticketId || null; // uuid or null

          // Construire les nouvelles lignes depuis le panier
      const newLignes = state.panier.map(l => ({
        produit_id: l.produit_id,
        produit_nom: l.nom,
        prix_unitaire: l.prix,
        quantite: l.qte,
        remise: l.remise || 0,
        est_offert: l.offert ? 1 : 0,
        total_ttc: calcLigneTotal(l),
        envoi_cuisine: !!l.envoi_cuisine,
        statut_cuisine: l.envoi_cuisine ? 'en_attente' : 'servi'
      }));

          let lignesFinales = newLignes;
          let nomTable = `Table ${num}`;

          if (ticketId) {
            // Table occupée → gestion de la fusion ou de l'écrasement
            const existing = await window.api.tables.charger(ticketId);
            const existingLignes = JSON.parse(existing?.lignes_json || '[]');
            nomTable = existing?.nom_table || nomTable;

            if (state.tableActive && state.tableActive.id === ticketId) {
              // L'utilisateur sauvegarde le panier dans l'exacte même table qu'il a chargée
              // Le panier contient DÉJÀ tout, donc on remplace sans additionner pour ne pas doubler !
              lignesFinales = newLignes;
            } else {
              // L'utilisateur sauvegarde son panier dans une table occupée DIFFÉRENTE
              // Fusionner : si même produit+remise+offert → incrémenter qte
              for (const nl of newLignes) {
                const found = existingLignes.find(el =>
                  el.produit_id === nl.produit_id &&
                  el.remise === nl.remise &&
                  el.est_offert === nl.est_offert &&
                  el.envoi_cuisine === nl.envoi_cuisine &&
                  el.statut_cuisine === nl.statut_cuisine
                );
                if (found) {
                  found.quantite += nl.quantite;
                  found.total_ttc += nl.total_ttc;
                } else {
                  existingLignes.push(nl);
                }
              }
              lignesFinales = existingLignes;
            }
          } else {
            // Table libre → demander un nom
            nomTable = await new Promise(resolve => {
              Modal.prompt('Nom de la table', `Nom pour la Table ${num} :`, `Table ${num}`, val => {
                resolve(val !== null ? (val || `Table ${num}`) : null);
              });
            });
            if (nomTable === null) return; // annulé
          }

          const res = await window.api.tables.sauvegarder({
            numero_table: num,
            nom_table: nomTable,
            nom_caissier: user?.nom || '-',
            lignes: lignesFinales,
          });

          if (res.success) {
            // Puisqu'on vide le panier (mise en attente), la caisse doit redevenir complètement neutre !
            // Sinon, les prochains articles saisis "écraseraient" la table au lieu de fusionner.
            state.tableActive = null;
            updateTableBadge();
            // Vider le panier après sauvegarde
            state.panier = [];
            state.selectedIndex = -1;
            renderPanier();
            Modal.close(savId);
            Toast.success(`Panier sauvegardé sur ${nomTable}`);
          } else {
            Toast.error('Erreur : ' + res.message);
          }
        });
      });
    }, 20);
  }

  function renderTableCell(t) {
    const occ = !!t.ticket;
    const nom = t.ticket?.nom_table || `Table ${t.numero}`;
    const total = t.ticket?.montant_total || 0;
    return `
      <div class="table-cell ${occ ? 'occupee' : 'libre'}" data-num="${t.numero}" data-ticket-id="${t.ticket?.uuid || ''}">
        <div class="tc-icon">${occ ? '🟢' : '⬜'}</div>
        <div class="tc-nom">${Utils.esc(nom)}</div>
        <div class="tc-statut">${occ ? 'OCCUPÉE' : 'LIBRE'}</div>
        ${occ ? `<div class="tc-total">${Math.round(total).toLocaleString('fr-FR')} ${state.devise}</div>` : ''}
      </div>`;
  }

  function bindTableModal(modalId, tables) {
    document.querySelectorAll('.table-cell').forEach(card => {
      card.addEventListener('click', async () => {
        document.querySelectorAll('.table-cell').forEach(c => c.style.outline = '');
        card.style.outline = `2px solid var(--accent)`;
        const num = parseInt(card.dataset.num);
        const ticketId = card.dataset.ticketId || null; // uuid or null
        const zone = document.getElementById('table-detail-zone');
        if (!zone) return;

        if (!ticketId) {
          // Table libre — proposer de la sélectionner et d'y associer le panier
          zone.innerHTML = `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:0.7">
              <div style="font-size:36px">⬜</div>
              <div style="font-size:14px;font-weight:600">Table ${num} — Libre</div>
              <button class="btn btn-primary" id="btn-assoc-table">Associer mon panier à cette table</button>
            </div>`;
          document.getElementById('btn-assoc-table')?.addEventListener('click', () => {
            Modal.prompt('Nom de la table', `Nom pour la Table ${num} :`, `Table ${num}`, val => {
              if (val === null) return;
              state.tableActive = { id: null, numero: num, nom_table: val || `Table ${num}` };
              updateTableBadge();
              Modal.close(modalId);
            });
          });
          return;
        }

        // Table occupée — charger ticket
        const t = await window.api.tables.charger(ticketId);
        if (!t) { zone.innerHTML = '<div>Erreur chargement</div>'; return; }

        const lignes = JSON.parse(t.lignes_json || '[]');
        const total = lignes.reduce((s, l) => s + (l.total_ttc || 0), 0);

        zone.innerHTML = `
          <div class="table-detail-panier" style="flex:1">
            <div class="table-detail-header">
              ${Utils.esc(t.nom_table || `Table ${t.numero_table}`)} — ${Utils.esc(t.nom_caissier || '')}
            </div>
            <div class="table-detail-body">
              <table class="panier-table">
                <thead>
                  <tr>
                    <th style="text-align:left; width:15%">Qté</th>
                    <th style="text-align:left">Article</th>
                    <th style="text-align:right">Prix</th>
                  </tr>
                </thead>
                <tbody>
                  ${lignes.map((l, i) => `
                    <tr class="${state.tableSelectedItem === i ? 'selected' : ''}" data-tidx="${i}" style="cursor:pointer">
                      <td class="td-qte" style="text-align:left; width:15%">${Math.round(l.quantite)}</td>
                      <td class="td-nom" style="text-align:left">${Utils.esc(l.produit_nom || '')}</td>
                      <td class="td-prix" style="text-align:right">${Math.round(l.total_ttc || 0).toLocaleString('fr-FR').replace(/[\s\u202f\u00a0]/g, ' ')} ${state.devise}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
            <div style="padding:10px 12px; border-top:2px solid var(--accent); font-size:16px; font-weight:800; color:var(--accent-light); display:flex; justify-content:space-between; align-items:center; background:rgba(var(--accent-rgb), 0.1)">
              <span>TOTAL</span>
              <span>${Math.round(total).toLocaleString('fr-FR').replace(/[\s\u202f\u00a0]/g, ' ')} ${state.devise}</span>
            </div>
          </div>
          <div class="table-detail-actions">
            <button class="btn btn-success btn-sm" id="tbl-ticket">Ticket</button>
            <button class="btn btn-ghost btn-sm" id="tbl-bon">ADDITION</button>
            <button class="btn btn-danger btn-sm" id="tbl-suppr-art">Suppr. article</button>
            <button class="btn btn-ghost btn-sm" id="tbl-charger">Charger panier</button>
            <button class="btn btn-warning btn-sm" id="tbl-transferer" title="Déplacer la commande vers une autre table">⇄ Transférer</button>
            <button class="btn btn-info btn-sm" id="tbl-fusionner" title="Fusionner avec une autre table">⊕ Fusionner</button>
          </div>`;

        // Événement molette pour scroller horizontalement les boutons rapidement
        const actionsContainer = zone.querySelector('.table-detail-actions');
        if (actionsContainer) {
          actionsContainer.addEventListener('wheel', (evt) => {
            if (evt.deltaY !== 0) {
              evt.preventDefault();
              actionsContainer.scrollLeft += evt.deltaY * 1.5; // Multiplicateur pour scroll rapide
            }
          });
        }

        // Sélection article
        let tableSelectedItem = -1;
        zone.querySelectorAll('tr[data-tidx]').forEach(row => {
          row.addEventListener('click', () => {
            zone.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            tableSelectedItem = parseInt(row.dataset.tidx);
          });
        });

        // Ticket → enregistrement direct
        document.getElementById('tbl-ticket')?.addEventListener('click', () => {
          // Charger dans le panier courant puis ouvrir modal ticket
          state.panier = lignes.map(l => ({
            produit_id: l.produit_id, nom: l.produit_nom, prix: l.prix_unitaire,
            qte: l.quantite, remise: l.remise || 0, offert: !!l.est_offert, stock_actuel: -1,
          }));
          state.tableActive = { id: ticketId, numero: num, nom_table: t.nom_table };
          updateTableBadge();
          renderPanier();
          Modal.close(modalId);
          openTicketModal();
        });

        // Bon de commande → preview + imprimer
        document.getElementById('tbl-bon')?.addEventListener('click', async () => {
          openBonCommandePreview({ lignes, nom_table: t.nom_table || `Table ${num}`, nom_caissier: t.nom_caissier, total });
        });

        // Supprimer article sélectionné
        document.getElementById('tbl-suppr-art')?.addEventListener('click', async () => {
          if (tableSelectedItem < 0) { Toast.warn('Sélectionnez un article'); return; }
          const ok = await new Promise(r => Modal.confirm('Supprimer', `Supprimer "${lignes[tableSelectedItem]?.produit_nom}" ?`, r));
          if (!ok) return;

          lignes.splice(tableSelectedItem, 1);

          if (lignes.length === 0) {
            // Si c'est le dernier article, on libère purement la table
            await window.api.tables.supprimer(ticketId);
            if (state.tableActive?.id === ticketId) {
              state.tableActive = null;
              updateTableBadge();
            }
            Toast.success('Dernier article supprimé, la table est libérée');
          } else {
            // Sinon on met simplement à jour
            const newTotal = lignes.reduce((s, l) => s + (l.total_ttc || 0), 0);
            await window.api.tables.sauvegarder({
              numero_table: num, nom_table: t.nom_table, nom_caissier: t.nom_caissier, lignes
            });
            Toast.success('Article supprimé');
          }

          tableSelectedItem = -1;

          // Rafraîchir l'interface
          const t2 = await window.api.tables.getAll();
          document.getElementById('tables-grid').innerHTML = t2.map(tc => renderTableCell(tc)).join('');
          bindTableModal(modalId, t2);

          // Recharger le panneau de détail en cliquant sur la nouvelle cellule générée
          document.querySelector(`.table-cell[data-num="${num}"]`)?.click();
        });

        document.getElementById('tbl-charger')?.addEventListener('click', () => {
          state.panier = lignes.map(l => ({
            produit_id: l.produit_id, nom: l.produit_nom, prix: l.prix_unitaire,
            qte: l.quantite, remise: l.remise || 0, offert: !!l.est_offert, stock_actuel: -1,
            is_prepared: false, envoi_cuisine: !!l.envoi_cuisine
          }));
          state.tableActive = { id: ticketId, numero: num, nom_table: t.nom_table };
          updateTableBadge();
          renderPanier();
          Modal.close(modalId);
          Toast.info(`Table ${num} chargée`);
        });

        // ── TRANSFÉRER ─────────────────────────────────────────────────────
        document.getElementById('tbl-transferer')?.addEventListener('click', async () => {
          const allTables = await window.api.tables.getAll();
          // Tables disponibles = toutes les tables SAUF la table source
          const cibles = allTables.filter(tb => {
            const tbTicketId = tb.ticket?.id || tb.ticket?.uuid || null;
            return tbTicketId !== ticketId;
          });

          if (!cibles.length) {
            Toast.warn('Aucune autre table disponible pour le transfert');
            return;
          }

          const trId = 'transfert-' + Date.now();
          Modal.open({
            id: trId,
            title: `Transférer — ${Utils.esc(t.nom_table || `Table ${num}`)}`,
            width: '540px',
            content: `
              <p style="font-size:13px;opacity:0.65;margin-bottom:14px">
                Choisissez la table <strong>destination</strong>. La commande sera déplacée intégralement.
                Si la table cible est <strong style="color:#2ecc71">occupée</strong>, les articles seront fusionnés.
              </p>
              <div class="tables-modal-grid" id="tr-tables-grid">
                ${cibles.map(tb => {
                  const occ = !!tb.ticket;
                  const nom = tb.ticket?.nom_table || `Table ${tb.numero}`;
                  const ttl = tb.ticket?.montant_total || 0;
                  return `
                    <div class="table-cell ${occ ? 'occupee' : 'libre'}"
                         data-trnum="${tb.numero}"
                         data-trticket="${tb.ticket?.id || tb.ticket?.uuid || ''}">
                      <div class="tc-icon">${occ ? '🟢' : '⬜'}</div>
                      <div class="tc-nom">${Utils.esc(nom)}</div>
                      <div class="tc-statut">${occ ? 'OCCUPÉE' : 'LIBRE'}</div>
                      ${occ ? `<div class="tc-total">${Math.round(ttl).toLocaleString('fr-FR')} ${state.devise}</div>` : ''}
                    </div>`;
                }).join('')}
              </div>
            `,
            footer: `<button class="btn btn-ghost" data-close="${trId}">Annuler</button>`,
          });

          setTimeout(() => {
            document.querySelectorAll('#tr-tables-grid .table-cell').forEach(card => {
              card.addEventListener('click', async () => {
                const destNum   = parseInt(card.dataset.trnum);
                const destTicketId = card.dataset.trticket || null;

                // Demande de confirmation et du nom
                const destNom = card.querySelector('.tc-nom')?.textContent || `Table ${destNum}`;
                const sourceNom = t.nom_table || `Table ${num}`;
                const nomPropose = destTicketId ? destNom : sourceNom;

                const nomFinal = await new Promise(r => Modal.prompt(
                  'Confirmer transfert & Nommer',
                  `Transférer « ${Utils.esc(sourceNom)} » vers « ${Utils.esc(destNom)} ».\nQuel nom donner à cette table ?`,
                  nomPropose,
                  r
                ));
                if (nomFinal === null) return;

                // Construire les lignes finales pour la destination
                let lignesFinales = [...lignes];
                let nomDest = nomFinal.trim() || nomPropose;

                if (destTicketId) {
                  // Table destination occupée → fusionner
                  const destTicket = await window.api.tables.charger(destTicketId);
                  const destLignes = JSON.parse(destTicket?.lignes_json || '[]');
                  for (const nl of lignes) {
                    const found = destLignes.find(el =>
                      el.produit_id === nl.produit_id &&
                      el.remise === nl.remise &&
                      el.est_offert === nl.est_offert
                    );
                    if (found) {
                      found.quantite  += nl.quantite;
                      found.total_ttc += nl.total_ttc;
                    } else {
                      destLignes.push(nl);
                    }
                  }
                  lignesFinales = destLignes;
                }

                // Sauvegarder dans la table destination
                const user = Session.getUser();
                const resSave = await window.api.tables.sauvegarder({
                  numero_table: destNum,
                  nom_table: nomDest,
                  nom_caissier: user?.nom || t.nom_caissier || '-',
                  lignes: lignesFinales,
                });

                if (!resSave.success) { Toast.error('Erreur transfert : ' + resSave.message); return; }

                // Libérer la table source
                await window.api.tables.supprimer(ticketId);
                if (state.tableActive?.id === ticketId) {
                  state.tableActive = null;
                  updateTableBadge();
                }

                Modal.close(trId);
                Modal.close(modalId);
                Toast.success(`Commande transférée vers ${nomDest}`);

                // Rafraîchir la grille
                const t2 = await window.api.tables.getAll();
                document.getElementById('tables-grid').innerHTML = t2.map(tc => renderTableCell(tc)).join('');
                bindTableModal(modalId, t2);
              });
            });
          }, 20);
        });

        // ── FUSIONNER ──────────────────────────────────────────────────────
        document.getElementById('tbl-fusionner')?.addEventListener('click', async () => {
          const allTables = await window.api.tables.getAll();
          // Tables disponibles = uniquement les tables OCCUPÉES sauf la table source
          const ciblesOcc = allTables.filter(tb => {
            const tbTicketId = tb.ticket?.id || tb.ticket?.uuid || null;
            return tbTicketId && tbTicketId !== ticketId;
          });

          if (!ciblesOcc.length) {
            Toast.warn('Aucune autre table occupée pour la fusion');
            return;
          }

          const fuId = 'fusion-' + Date.now();
          Modal.open({
            id: fuId,
            title: `Fusionner — ${Utils.esc(t.nom_table || `Table ${num}`)}`,
            width: '540px',
            content: `
              <p style="font-size:13px;opacity:0.65;margin-bottom:14px">
                Choisissez une table avec laquelle <strong>fusionner</strong>.
                Les articles des deux tables seront regroupés et la table source sera libérée.
              </p>
              <div class="tables-modal-grid" id="fu-tables-grid">
                ${ciblesOcc.map(tb => {
                  const nom = tb.ticket?.nom_table || `Table ${tb.numero}`;
                  const ttl = tb.ticket?.montant_total || 0;
                  return `
                    <div class="table-cell occupee"
                         data-funum="${tb.numero}"
                         data-futicket="${tb.ticket?.id || tb.ticket?.uuid || ''}">
                      <div class="tc-icon">🟢</div>
                      <div class="tc-nom">${Utils.esc(nom)}</div>
                      <div class="tc-statut">OCCUPÉE</div>
                      <div class="tc-total">${Math.round(ttl).toLocaleString('fr-FR')} ${state.devise}</div>
                    </div>`;
                }).join('')}
              </div>
            `,
            footer: `<button class="btn btn-ghost" data-close="${fuId}">Annuler</button>`,
          });

          setTimeout(() => {
            document.querySelectorAll('#fu-tables-grid .table-cell').forEach(card => {
              card.addEventListener('click', async () => {
                const destNum      = parseInt(card.dataset.funum);
                const destTicketId = card.dataset.futicket;

                const destNom = card.querySelector('.tc-nom')?.textContent || `Table ${destNum}`;
                const sourceNom = t.nom_table || `Table ${num}`;

                const nomFinal = await new Promise(r => Modal.prompt(
                  'Confirmer fusion & Nommer',
                  `Fusionner « ${Utils.esc(sourceNom)} » avec « ${Utils.esc(destNom)} ».\nQuel nom donner à la table finale ?`,
                  destNom,
                  r
                ));
                if (nomFinal === null) return;

                // Charger la table destination
                const destTicket  = await window.api.tables.charger(destTicketId);
                const destLignes  = JSON.parse(destTicket?.lignes_json || '[]');
                const nomDest     = nomFinal.trim() || destNom;

                // Fusionner les lignes
                for (const nl of lignes) {
                  const found = destLignes.find(el =>
                    el.produit_id === nl.produit_id &&
                    el.remise     === nl.remise &&
                    el.est_offert === nl.est_offert
                  );
                  if (found) {
                    found.quantite  += nl.quantite;
                    found.total_ttc += nl.total_ttc;
                  } else {
                    destLignes.push(nl);
                  }
                }

                // Sauvegarder la table destination fusionnée
                const user = Session.getUser();
                const resSave = await window.api.tables.sauvegarder({
                  numero_table: destNum,
                  nom_table: nomDest,
                  nom_caissier: user?.nom || t.nom_caissier || '-',
                  lignes: destLignes,
                });

                if (!resSave.success) { Toast.error('Erreur fusion : ' + resSave.message); return; }

                // Libérer la table source
                await window.api.tables.supprimer(ticketId);
                if (state.tableActive?.id === ticketId) {
                  state.tableActive = null;
                  updateTableBadge();
                }

                Modal.close(fuId);
                Modal.close(modalId);
                Toast.success(`Tables fusionnées dans ${nomDest}`);

                // Rafraîchir la grille
                const t2 = await window.api.tables.getAll();
                document.getElementById('tables-grid').innerHTML = t2.map(tc => renderTableCell(tc)).join('');
                bindTableModal(modalId, t2);
              });
            });
          }, 20);
        });

      });
    });
  }

  // ── VISUALISER PANIER COURANT ─────────────────────────────────────────
  function openVisualiseurPanier() {
    if (!state.panier.length) { Toast.warn('Panier vide'); return; }

    const L = 40;
    const sep = '─'.repeat(L);
    const sep2 = '═'.repeat(L);
    const ctr = s => { const p = Math.max(0, (L - s.length) / 2 | 0); return ' '.repeat(p) + s; };
    const user = Session.getUser();
    const total = calcTotal();
    const sousTotal = state.panier.reduce((s, l) => s + l.prix * l.qte, 0);
    const remiseMontant = sousTotal - total;
    const { nom, adresse, ville, tel, email, nif, stat, slogan } = state.entreprise;

    const lignes = [
      sep2,
      nom ? ctr(nom.toUpperCase()) : ctr('APERÇU TICKET'),
      adresse ? ctr(adresse) : '',
      ville ? ctr(ville) : '',
      tel ? ctr('Tél: ' + tel) : '',
      email ? ctr('Email: ' + email) : '',
      nif ? ctr('NIF: ' + nif) : '',
      stat ? ctr('STAT: ' + stat) : '',
      sep2, '',
      `Date   : ${new Date().toLocaleString('fr-FR')}`,
      `Vendeur: ${user?.nom || '-'}`,
      state.tableActive ? `Table  : ${state.tableActive.nom_table || 'Table ' + state.tableActive.numero}` : '',
      '', sep,
      `${'Qté'.padEnd(4)} ${'Désignation'.padEnd(L - 4 - 12 - 1).slice(0, L - 4 - 12 - 1)} ${'Montant'.padStart(12)}`,
      sep,
      ...state.panier.map(l => {
        const mt = calcLigneTotal(l);
        const remStr = l.remise > 0 ? ` (-${l.remise}%)` : '';
        const tag = l.offert ? '(OFFERT)' : `${Math.round(mt)} ${state.devise}`;
        const mtPadded = tag.padStart(12).slice(0, 12);
        const nom = (l.nom + remStr).padEnd(L - 4 - 12 - 1).slice(0, L - 4 - 12 - 1);
        return `${String(l.qte).padEnd(4).slice(0, 4)} ${nom} ${mtPadded}`;
      }),
      sep, '',
      remiseMontant > 0 ?
        (() => { const v = `-${Math.round(remiseMontant)} ${state.devise}`; return '  Remises'.padEnd(L - v.length) + v; })() : '',
      `**` + (() => { const v = `${Math.round(total)} ${state.devise}`; return '  TOTAL'.padEnd(L - v.length) + v; })() + `**`,
      '', sep2,
      slogan ? ctr(slogan) : '',
      slogan ? sep2 : ''
    ].filter(l => l !== null && l !== undefined && l !== '').join('\n');

    const visId = 'visu-panier-' + Date.now();
    Modal.open({
      id: visId,
      title: 'Aperçu du ticket',
      width: '520px',
      content: `
        <div class="ticket-preview-paper">
          ${state.entreprise.logo_url ? `<div style="text-align:center;margin-bottom:10px;"><img src="${Utils.esc(state.entreprise.logo_url)}" style="max-height:60px; max-width: 150px; object-fit: contain;"></div>` : ''}
          ${Utils.esc(lignes).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#000; font-weight:bold">$1</strong>')}
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close="${visId}">Fermer</button>
        <button class="btn btn-primary" id="btn-go-ticket">Enregistrer →</button>
      `,
    });
    setTimeout(() => {
      document.getElementById('btn-go-ticket')?.addEventListener('click', () => {
        Modal.close(visId);
        openTicketModal();
      });
    }, 20);
  }

  // ── BON DE COMMANDE PREVIEW ────────────────────────────────────────────
  async function openBonCommandePreview({ lignes, nom_table, nom_caissier, total }) {
    const L = 40;
    const sep = '─'.repeat(L);
    const ctr = s => { const p = Math.max(0, (L - s.length) / 2 | 0); return ' '.repeat(p) + s; };
    const { nom, adresse, ville, tel, email, nif, stat, slogan } = state.entreprise;

    const bonLines = [
      '═'.repeat(L),
      nom ? ctr(nom.toUpperCase()) : '',
      adresse ? ctr(adresse) : '',
      ville ? ctr(ville) : '',
      tel ? ctr('Tél: ' + tel) : '',
      email ? ctr('Email: ' + email) : '',
      nif ? ctr('NIF: ' + nif) : '',
      stat ? ctr('STAT: ' + stat) : '',
      '═'.repeat(L),
      ctr('ADDITION'),
      ctr(nom_table || ''),
      '═'.repeat(L), '',
      `Date   : ${new Date().toLocaleString('fr-FR')}`,
      `Serveur: ${nom_caissier || '-'}`, '',
      sep,
      ...lignes.map(l => {
        const qte = String(Math.round(l.quantite || 1)).padEnd(4).slice(0, 4);
        const mtStr = `${Math.round(l.total_ttc || 0)} ${state.devise}`;
        const mt = mtStr.padStart(12).slice(0, 12);
        const nom = (l.produit_nom || '').padEnd(L - 4 - 12 - 1).slice(0, L - 4 - 12 - 1);
        return `${qte} ${nom} ${mt}`;
      }),
      sep,
      `**` + (() => {
        const mtStr = `${Math.round(total)} ${state.devise}`;
        return 'TOTAL'.padEnd(L - mtStr.length) + mtStr;
      })() + `**`,
      '═'.repeat(L),
      slogan ? ctr(slogan) : '',
      slogan ? '═'.repeat(L) : '', '', '', '',
    ].filter(l => l !== null && l !== undefined && l !== '');
    const texte = bonLines.join('\n');

    const bonId = 'bon-' + Date.now();
    Modal.open({
      id: bonId,
      title: `Addition — ${nom_table}`,
      width: '520px',
      content: `
        <div class="ticket-preview-paper">
          ${state.entreprise.logo_url ? `<div style="text-align:center;margin-bottom:10px;"><img src="${Utils.esc(state.entreprise.logo_url)}" style="max-height:60px; max-width: 150px; object-fit: contain;"></div>` : ''}
          ${Utils.esc(texte).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#000; font-weight:bold">$1</strong>')}
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close="${bonId}">Fermer</button>
        <button class="btn btn-primary" id="btn-print-bon">Imprimer</button>
      `,
    });
    setTimeout(() => {
      document.getElementById('btn-print-bon')?.addEventListener('click', async () => {
        const res = await window.api.printer.printBon({ lignes, numero_table: nom_table, nom_caissier, montant_total: total });
        if (res.success) Toast.success('Bon imprimé');
        else Toast.warn('Impression échouée');
        Modal.close(bonId);
      });
    }, 20);
  }

  // ── MODAL TICKET (ENREGISTREMENT) ─────────────────────────────────────
  function openTicketModal() {
    if (!state.panier.length) { Toast.warn('Panier vide'); return; }
    const total = calcTotal();
    const modes = [
      ['CASH', 'CASH'],
      ['MVOLA', 'MVOLA'],
      ['ORANGE_MONEY', 'ORANGE MONEY'],
      ['AIRTEL_MONEY', 'AIRTEL MONEY'],
      ['CARTE', 'CARTE (VISA/MC)'],
      ['VIREMENT', 'VIREMENT'],
    ];
    let selectedMode = 'CASH';
    let montantSaisi = '';
    const hasKitchenItems = state.panier.some(l => l.envoi_cuisine);
    const tableLabel = state.tableActive ? (state.tableActive.nom_table || `Table ${state.tableActive.numero}`) : '';

    const tikId = 'ticket-' + Date.now();
    Modal.open({
      id: tikId,
      title: 'Enregistrer la vente',
      width: '760px',
      content: `
        <div class="ticket-modal-body">

          <!-- Ligne montants -->
          <div class="montants-row">
            <div class="montant-box">
              <label>A payer</label>
              <div class="montant-val" id="tm-apayer">${Math.round(total).toLocaleString('fr-FR')}</div>
            </div>
            <div class="montant-box">
              <label>Perçu</label>
              <div class="montant-val" id="tm-percu">0,00</div>
            </div>
            <div class="montant-box">
              <label>Reste à payer</label>
              <div class="montant-val" id="tm-reste">${Math.round(total).toLocaleString('fr-FR')}</div>
            </div>
            <div class="montant-box">
              <label>A rendre</label>
              <div class="montant-val positif" id="tm-rendre">0</div>
            </div>
          </div>

          <!-- Clavier + modes -->
          <div style="display:flex;flex-direction:column;gap:10px">
            <!-- Clavier numérique -->
            <div class="num-keyboard">
              <button class="num-key" data-num="7">7</button>
              <button class="num-key" data-num="8">8</button>
              <button class="num-key" data-num="9">9</button>
              <button class="num-key shortcut" data-adj="+1000">+1000</button>

              <button class="num-key" data-num="4">4</button>
              <button class="num-key" data-num="5">5</button>
              <button class="num-key" data-num="6">6</button>
              <button class="num-key shortcut" data-adj="+2000">+2000</button>

              <button class="num-key" data-num="1">1</button>
              <button class="num-key" data-num="2">2</button>
              <button class="num-key" data-num="3">3</button>
              <button class="num-key shortcut" data-adj="+5000">+5000</button>

              <button class="num-key" data-num="0">0</button>
              <button class="num-key" data-num=".">.</button>
              <button class="num-key del-key" id="tk-del">⌫</button>
              <button class="num-key shortcut" data-shortcut="${Math.round(total)}" title="Percevoir le montant exact">${Math.round(total).toLocaleString('fr-FR')}</button>

              <button class="num-key clear-key" id="tk-clear" style="grid-column: 1 / -1">C (Effacer)</button>
            </div>
          </div>

          <!-- Modes de paiement -->
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="modes-grid">
              ${modes.map(([k, label]) => `
                <div class="mode-item ${k === selectedMode ? 'selected' : ''}" data-mode="${k}">
                  ${label}
                </div>
              `).join('')}
            </div>
          </div>
            ${tableLabel ? `<div style="font-size:12px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;opacity:0.8;color:var(--text)">Table : <strong>${Utils.esc(tableLabel)}</strong></div>` : ''}
            ${hasKitchenItems && !state.tableActive ? `
              <div style="margin-top:5px">
                <div style="font-size:11px;font-weight:700;opacity:0.6;text-transform:uppercase;margin-bottom:4px;color:var(--accent-light)">Nom de la commande (Cuisine) *</div>
                <input type="text" id="tk-nom-commande" class="commande-nom-input" placeholder="Ex: Client Jean, Salon VIP..." />
              </div>
            ` : ''}
          </div>

          <!-- Boutons action -->
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="ticket-btn-enreg" id="tk-enreg">Enregistrer</button>
            <button class="ticket-btn-annuler" data-close="${tikId}">✕ Annuler</button>
          </div>

          <!-- Zone impression -->
          <div class="impression-zone">
            <div>
              <div style="font-size:11px;font-weight:700;opacity:0.6;text-transform:uppercase;margin-bottom:6px; color:#eee;">Imprimer</div>
              <label class="toggle-imprimer" id="toggle-imprimer-lbl">
                <input type="checkbox" id="tk-imprimer" ${state.impression.actif ? 'checked' : ''} />
                <div class="toggle-track${state.impression.actif ? '  on' : ''}" id="toggle-track">
                  <div class="toggle-thumb"></div>
                </div>
                <span class="toggle-label-txt" id="toggle-txt">${state.impression.actif ? 'ON' : 'OFF'}</span>
              </label>
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;opacity:0.6;text-transform:uppercase;margin-bottom:6px; color: #eee">Copies</div>
              <input type="number" class="copies-input" id="tk-copies"
                value="${state.impression.copies}" min="1" max="9" />
            </div>
          </div>

        </div>
      `,
    });

    // ── Bind modal ticket ────────────────────────────────────
    setTimeout(() => {
      const updateMontants = () => {
        const percu = parseFloat(montantSaisi) || 0;
        const reste = Math.max(0, total - percu);
        const rendre = Math.max(0, percu - total);
        document.getElementById('tm-percu').textContent = percu.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
        document.getElementById('tm-reste').textContent = Math.round(reste).toLocaleString('fr-FR');
        const renduEl = document.getElementById('tm-rendre');
        if (renduEl) {
          renduEl.textContent = Math.round(rendre).toLocaleString('fr-FR');
          renduEl.className = rendre > 0 ? 'montant-val positif' : 'montant-val';
        }

        const btnEnreg = document.getElementById('tk-enreg');
        if (btnEnreg) {
          if (percu >= total) {
            btnEnreg.disabled = false;
            btnEnreg.style.opacity = '1';
          } else {
            btnEnreg.disabled = true;
            btnEnreg.style.opacity = '0.5';
          }
        }
      };

      updateMontants();

      // Clavier numérique
      document.querySelectorAll('.num-key[data-num]').forEach(btn => {
        btn.addEventListener('click', () => {
          const n = btn.dataset.num;
          if (n === '.' && montantSaisi.includes('.')) return;
          montantSaisi += n;
          updateMontants();
        });
      });
      document.getElementById('tk-del')?.addEventListener('click', () => {
        montantSaisi = montantSaisi.slice(0, -1);
        updateMontants();
      });
      document.getElementById('tk-clear')?.addEventListener('click', () => {
        montantSaisi = '';
        updateMontants();
      });

      // Raccourcis
      document.querySelectorAll('.num-key[data-shortcut]').forEach(btn => {
        btn.addEventListener('click', () => {
          montantSaisi = btn.dataset.shortcut;
          updateMontants();
        });
      });
      document.querySelectorAll('.num-key[data-adj]').forEach(btn => {
        btn.addEventListener('click', () => {
          const adj = parseFloat(btn.dataset.adj);
          montantSaisi = String((parseFloat(montantSaisi) || 0) + adj);
          updateMontants();
        });
      });

      // Modes paiement
      document.querySelectorAll('.mode-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.mode-item').forEach(m => m.classList.remove('selected'));
          item.classList.add('selected');
          selectedMode = item.dataset.mode;
        });
      });

      // Toggle imprimer
      const tkImp = document.getElementById('tk-imprimer');
      const track = document.getElementById('toggle-track');
      const txt = document.getElementById('toggle-txt');
      tkImp?.addEventListener('change', () => {
        state.impression.actif = tkImp.checked;
        track?.classList.toggle('on', tkImp.checked);
        if (txt) txt.textContent = tkImp.checked ? 'ON' : 'OFF';
        saveImpressionPref();
      });

      // Copies
      document.getElementById('tk-copies')?.addEventListener('change', e => {
        state.impression.copies = parseInt(e.target.value) || 1;
        saveImpressionPref();
      });

      // Enregistrer
      document.getElementById('tk-enreg')?.addEventListener('click', async () => {
        const percu = parseFloat(montantSaisi) || 0;
        const rendre = Math.max(0, percu - total);

        if (percu < total) {
          Toast.warn('Le montant perçu est insuffisant');
          return;
        }

        // Mise à jour copies depuis le champ
        const copiesEl = document.getElementById('tk-copies');
        if (copiesEl) { state.impression.copies = parseInt(copiesEl.value) || 1; saveImpressionPref(); }

        // Validation Nom Commande si cuisine
        let note = '';
        if (hasKitchenItems) {
           if (state.tableActive) {
             note = state.tableActive.nom_table || `Table ${state.tableActive.numero}`;
           } else {
             const inputNom = document.getElementById('tk-nom-commande');
             note = inputNom?.value.trim() || '';
             if (!note) {
               Toast.warn('Veuillez entrer un nom pour la cuisine');
               inputNom?.focus();
               return;
             }
           }
        }

        const btn = document.getElementById('tk-enreg');
        if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }

        await validerVente(selectedMode, percu, rendre, tikId, note);
      });

      // Verification temps réel du nom si cuisine && pas de table
      if (hasKitchenItems && !state.tableActive) {
        const inputNom = document.getElementById('tk-nom-commande');
        const btnEnreg = document.getElementById('tk-enreg');
        const checkNom = () => {
          if (btnEnreg) btnEnreg.disabled = !inputNom.value.trim();
        };
        inputNom?.addEventListener('input', checkNom);
        checkNom(); // État initial
      }
    }, 20);
  }

  // ── MODAL LIVRAISON (formulaire + paiement comme ticket) ──────────────
  function openLivraisonModal() {
    if (!state.panier.length) { Toast.warn('Panier vide'); return; }
    const total = calcTotal();
    let selectedMode = 'CASH';
    let montantSaisi = '';
    const hasKitchenItems = state.panier.some(l => l.envoi_cuisine);
    const tableLabel = state.tableActive ? (state.tableActive.nom_table || `Table ${state.tableActive.numero}`) : '';
    const now = new Date();
    const dateDef = now.toISOString().slice(0, 10);
    const heureDef = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const livId = 'livraison-' + Date.now();
    Modal.open({
      id: livId,
      title: 'Vente avec livraison',
      width: '820px',
      content: `
        <div class="ticket-modal-body livraison-modal-body">
          <div class="livraison-form-section">
            <div class="livraison-form-title">Informations de livraison</div>
            <div class="livraison-form-grid">
              <div class="lv-field lv-field-full">
                <label>Adresse complète *</label>
                <input type="text" id="lv-adresse" class="commande-nom-input" placeholder="Adresse de livraison" autocomplete="street-address" />
              </div>
              <div class="lv-field">
                <label>Lieu (ville, quartier, repère…) *</label>
                <input type="text" id="lv-lieu" placeholder="Ex: Antananarivo, Ankorondrano" />
              </div>
              <div class="lv-field">
                <label>Jour de livraison *</label>
                <input type="date" id="lv-date" value="${dateDef}" />
              </div>
              <div class="lv-field">
                <label>Heure *</label>
                <input type="time" id="lv-heure" value="${heureDef}" />
              </div>
              <div class="lv-field">
                <label>Nom du client (optionnel)</label>
                <input type="text" id="lv-nom" placeholder="Destinataire" autocomplete="name" />
              </div>
              <div class="lv-field">
                <label>Téléphone (optionnel)</label>
                <input type="tel" id="lv-tel" placeholder="Pour le livreur" autocomplete="tel" />
              </div>
              <div class="lv-field">
                <label>Frais de livraison (${localStorage.getItem('cc_devise') || 'Ar'})</label>
                <input type="number" id="lv-frais" placeholder="0" min="0" step="1" value="0" />
              </div>
            </div>
          </div>

          <div class="montants-row">
            <div class="montant-box">
              <label>Articles</label>
              <div class="montant-val" id="lv-apayer">${Math.round(total).toLocaleString('fr-FR')}</div>
            </div>
            <div class="montant-box">
              <label>Total + Frais</label>
              <div class="montant-val" id="lv-total-frais">${Math.round(total).toLocaleString('fr-FR')}</div>
            </div>
            <div class="montant-box">
              <label>Perçu</label>
              <div class="montant-val" id="lv-percu">0,00</div>
            </div>
            <div class="montant-box">
              <label>A rendre</label>
              <div class="montant-val positif" id="lv-rendre">0</div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="num-keyboard">
              <button type="button" class="num-key" data-lv-num="7">7</button>
              <button type="button" class="num-key" data-lv-num="8">8</button>
              <button type="button" class="num-key" data-lv-num="9">9</button>
              <button type="button" class="num-key shortcut" data-lv-adj="+1000">+1000</button>

              <button type="button" class="num-key" data-lv-num="4">4</button>
              <button type="button" class="num-key" data-lv-num="5">5</button>
              <button type="button" class="num-key" data-lv-num="6">6</button>
              <button type="button" class="num-key shortcut" data-lv-adj="+2000">+2000</button>

              <button type="button" class="num-key" data-lv-num="1">1</button>
              <button type="button" class="num-key" data-lv-num="2">2</button>
              <button type="button" class="num-key" data-lv-num="3">3</button>
              <button type="button" class="num-key shortcut" data-lv-adj="+5000">+5000</button>

              <button type="button" class="num-key" data-lv-num="0">0</button>
              <button type="button" class="num-key" data-lv-num=".">.</button>
              <button type="button" class="num-key del-key" id="lv-del">⌫</button>
              <button type="button" class="num-key shortcut" id="lv-shortcut-total" data-lv-shortcut="${Math.round(total)}">Total: ${Math.round(total).toLocaleString('fr-FR')}</button>

              <button type="button" class="num-key clear-key" id="lv-clear" style="grid-column: 1 / -1">C (Effacer)</button>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="modes-grid">
              ${[
                ['CASH', 'CASH'],
                ['MVOLA', 'MVOLA'],
                ['ORANGE_MONEY', 'ORANGE MONEY'],
                ['AIRTEL_MONEY', 'AIRTEL MONEY'],
                ['CARTE', 'CARTE (VISA/MC)'],
                ['VIREMENT', 'VIREMENT']
              ].map(([k, label]) => `
                <div class="mode-item ${k === selectedMode ? 'selected' : ''}" data-mode="${k}">
                  ${label}
                </div>
              `).join('')}
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            ${tableLabel ? `<div style="font-size:12px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;opacity:0.8;color:var(--text)">Table : <strong>${Utils.esc(tableLabel)}</strong></div>` : ''}
            ${hasKitchenItems && !state.tableActive ? `
              <div style="margin-top:5px">
                <div style="font-size:11px;font-weight:700;opacity:0.6;text-transform:uppercase;margin-bottom:4px;color:var(--accent-light)">Nom de la commande (Cuisine) *</div>
                <input type="text" id="lv-nom-commande" class="commande-nom-input" placeholder="Ex: Livraison M. Rakoto" />
              </div>
            ` : ''}
          </div>

          <div style="display:flex;flex-direction:column;gap:8px">
            <button type="button" class="ticket-btn-enreg" id="lv-enreg">Enregistrer la livraison</button>
            <button type="button" class="ticket-btn-annuler" data-close="${livId}">✕ Annuler</button>
          </div>

          <div class="impression-zone">
            <div>
              <div style="font-size:11px;font-weight:700;opacity:0.6;text-transform:uppercase;margin-bottom:6px; color:#eee;">Imprimer le bon</div>
              <label class="toggle-imprimer" id="toggle-imprimer-liv-lbl">
                <input type="checkbox" id="lv-imprimer" ${state.impression.actif ? 'checked' : ''} />
                <div class="toggle-track${state.impression.actif ? '  on' : ''}" id="lv-toggle-track">
                  <div class="toggle-thumb"></div>
                </div>
                <span class="toggle-label-txt" id="lv-toggle-txt">${state.impression.actif ? 'ON' : 'OFF'}</span>
              </label>
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;opacity:0.6;text-transform:uppercase;margin-bottom:6px; color: #eee">Copies</div>
              <input type="number" class="copies-input" id="lv-copies"
                value="${state.impression.copies}" min="1" max="9" />
            </div>
          </div>
        </div>
      `,
    });

    setTimeout(() => {
      const updateMontants = () => {
        const frais = parseFloat(document.getElementById('lv-frais')?.value) || 0;
        const totalAvecFrais = total + frais;
        
        let percu = parseFloat(montantSaisi);
        if (isNaN(percu) || montantSaisi === '') percu = totalAvecFrais; // fallback pour affichage et calcul
        
        const rendre = Math.max(0, percu - totalAvecFrais);
        const elTF = document.getElementById('lv-total-frais');
        const elP = document.getElementById('lv-percu');
        const elRd = document.getElementById('lv-rendre');
        const btnShortcut = document.getElementById('lv-shortcut-total');
        
        if (elTF) elTF.textContent = Math.round(totalAvecFrais).toLocaleString('fr-FR');
        if (elP) elP.textContent = percu.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
        if (elRd) {
          elRd.textContent = Math.round(rendre).toLocaleString('fr-FR');
          elRd.className = rendre > 0 ? 'montant-val positif' : 'montant-val';
        }
        if (btnShortcut) {
          btnShortcut.dataset.lvShortcut = totalAvecFrais;
          btnShortcut.textContent = `Total: ${Math.round(totalAvecFrais).toLocaleString('fr-FR')}`;
        }
        const btnEnreg = document.getElementById('lv-enreg');
        if (btnEnreg) {
          let ok = percu >= totalAvecFrais;
          if (ok && hasKitchenItems && !state.tableActive) {
            const inputNom = document.getElementById('lv-nom-commande');
            ok = !!(inputNom && inputNom.value.trim());
          }
          btnEnreg.disabled = !ok;
          btnEnreg.style.opacity = ok ? '1' : '0.5';
        }
      };

      updateMontants();

      document.querySelectorAll('.mode-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.mode-item').forEach(m => m.classList.remove('selected'));
          item.classList.add('selected');
          selectedMode = item.dataset.mode;
        });
      });

      document.querySelectorAll('.num-key[data-lv-num]').forEach(btn => {
        btn.addEventListener('click', () => {
          const n = btn.dataset.lvNum;
          if (n === '.' && montantSaisi.includes('.')) return;
          montantSaisi += n;
          updateMontants();
        });
      });
      document.getElementById('lv-del')?.addEventListener('click', () => {
        montantSaisi = montantSaisi.slice(0, -1);
        updateMontants();
      });
      document.getElementById('lv-clear')?.addEventListener('click', () => {
        montantSaisi = '';
        updateMontants();
      });
      document.querySelectorAll('.num-key[data-lv-shortcut]').forEach(btn => {
        btn.addEventListener('click', () => {
          montantSaisi = btn.dataset.lvShortcut;
          updateMontants();
        });
      });
      document.querySelectorAll('.num-key[data-lv-adj]').forEach(btn => {
        btn.addEventListener('click', () => {
          const adj = parseFloat(btn.dataset.lvAdj);
          montantSaisi = String((parseFloat(montantSaisi) || 0) + adj);
          updateMontants();
        });
      });

      const lvImp = document.getElementById('lv-imprimer');
      const lvTrack = document.getElementById('lv-toggle-track');
      const lvTxt = document.getElementById('lv-toggle-txt');
      lvImp?.addEventListener('change', () => {
        state.impression.actif = lvImp.checked;
        lvTrack?.classList.toggle('on', lvImp.checked);
        if (lvTxt) lvTxt.textContent = lvImp.checked ? 'ON' : 'OFF';
        saveImpressionPref();
      });
      document.getElementById('lv-copies')?.addEventListener('change', e => {
        state.impression.copies = parseInt(e.target.value) || 1;
        saveImpressionPref();
      });

      document.getElementById('lv-enreg')?.addEventListener('click', async () => {
        const frais = parseFloat(document.getElementById('lv-frais')?.value) || 0;
        const totalAvecFrais = total + frais;
        
        let percu = parseFloat(montantSaisi);
        if (isNaN(percu) || montantSaisi === '') percu = totalAvecFrais;
        
        const rendre = Math.max(0, percu - totalAvecFrais);
        if (percu < totalAvecFrais) {
          Toast.warn('Le montant perçu est insuffisant');
          return;
        }

        const adresse = document.getElementById('lv-adresse')?.value.trim() || '';
        const lieu = document.getElementById('lv-lieu')?.value.trim() || '';
        const date_prevue = document.getElementById('lv-date')?.value || '';
        const heure_prevue = document.getElementById('lv-heure')?.value || '';
        if (!adresse || !lieu || !date_prevue || !heure_prevue) {
          Toast.warn('Renseignez l\'adresse, le lieu, le jour et l\'heure de livraison');
          return;
        }

        const copiesEl = document.getElementById('lv-copies');
        if (copiesEl) { state.impression.copies = parseInt(copiesEl.value) || 1; saveImpressionPref(); }

        let note = '';
        if (hasKitchenItems) {
          if (state.tableActive) {
            note = state.tableActive.nom_table || `Table ${state.tableActive.numero}`;
          } else {
            const inputNom = document.getElementById('lv-nom-commande');
            note = inputNom?.value.trim() || '';
            if (!note) {
              Toast.warn('Veuillez entrer un nom pour la cuisine');
              inputNom?.focus();
              return;
            }
          }
        }

        const livraisonPayload = {
          adresse,
          lieu,
          date_prevue,
          heure_prevue,
          client_nom: document.getElementById('lv-nom')?.value.trim() || undefined,
          contact_tel: document.getElementById('lv-tel')?.value.trim() || undefined,
          frais_livraison: frais > 0 ? frais : undefined,
        };

        const btn = document.getElementById('lv-enreg');
        if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }

        await validerVente(selectedMode, percu, rendre, livId, note, livraisonPayload);
      });

      // Recalcul quand frais changent
      document.getElementById('lv-frais')?.addEventListener('input', () => updateMontants());

      if (hasKitchenItems && !state.tableActive) {
        document.getElementById('lv-nom-commande')?.addEventListener('input', () => updateMontants());
      }
    }, 20);
  }

  function saveImpressionPref() {
    localStorage.setItem('cc_impression', JSON.stringify(state.impression));
  }

  async function validerVente(mode, montantPaye, monnaie, modalId, note = '', livraisonPayload = null) {
    const total = calcTotal();
    const sousTotal = state.panier.reduce((s, l) => s + l.prix * l.qte, 0);
    const remiseTotale = sousTotal - total;
    const user = Session.getUser();

    const lignesVente = state.panier.map(l => ({
      produit_id: l.produit_id,
      produit_nom: l.nom,
      quantite: l.qte,
      prix_unitaire: l.prix,
      remise: l.remise,
      rabais: 0,
      total_ttc: calcLigneTotal(l),
      est_offert: l.offert ? 1 : 0,
      envoi_cuisine: !!l.envoi_cuisine,
      statut_cuisine: l.envoi_cuisine ? 'en_attente' : 'servi'
    }));

    const venteData = {
      nom_caissier: user?.nom || '-',
      total_ttc: total,
      mode_paiement: mode,
      montant_paye: montantPaye,
      monnaie_rendue: monnaie,
      table_numero: state.tableActive?.numero || null,
      lignes: lignesVente,
      note: note,
    };

    try {
      if (livraisonPayload) {
        const fraisLiv = parseFloat(livraisonPayload?.frais_livraison) || 0;
        const totalAvecFrais = total + fraisLiv;
        
        // On ajoute les frais comme une ligne d'article pour l'impression et la clôture
        const lignesSnapshot = [...lignesVente];
        if (fraisLiv > 0) {
          lignesSnapshot.push({
            produit_nom: 'Frais de livraison',
            prix_unitaire: fraisLiv,
            quantite: 1,
            total_ttc: fraisLiv,
            est_offert: false,
            remise: 0
          });
        }
        
        const snapshot = {
          lignes: lignesSnapshot,
          total_ttc: totalAvecFrais,
          frais_livraison: fraisLiv > 0 ? fraisLiv : 0,
          remise_totale: remiseTotale,
          mode_paiement: mode,
          montant_paye: montantPaye,
          monnaie_rendue: monnaie,
          nom_caissier: user?.nom || '-',
          note: note || null,
          table_numero: state.tableActive?.numero || null,
          livraison: { ...livraisonPayload },
        };
        const result = await window.api.livraisons.createFromCaisse({
          snapshot,
          operateur: user?.nom || null,
        });
        if (!result.success) { Toast.error('Erreur: ' + result.message); return; }

        if (state.tableActive?.id) {
          await window.api.tables.supprimer(state.tableActive.id);
        }

        state.dernierTicket = {
          numero_bon: result.numero_bon,
          numero_ticket: result.numero_bon,
          date_vente: new Date().toISOString(),
          nom_caissier: user?.nom || '-',
          total_ttc: totalAvecFrais,
          remise_totale: remiseTotale,
          mode_paiement: mode,
          montant_paye: montantPaye,
          monnaie_rendue: monnaie,
          copies: state.impression.copies,
          lignes: lignesSnapshot,
          estBonLivraison: true,
          livraison: { ...livraisonPayload },
          livraisonPending: true,
        };

        if (state.impression.actif) {
          await window.api.printer.printBonLivraison(state.dernierTicket);
        }

        state.panier = [];
        state.selectedIndex = -1;
        state.tableActive = null;
        updateTableBadge();
        renderPanier();
        state.produits = (await window.api.produits.getAll()).filter(p => !p.is_ingredient);
        renderProducts();

        Modal.close(modalId);
        Toast.success(`Bon ${result.numero_bon} — la vente sera enregistrée à la clôture lorsque la livraison sera terminée.`);
        setTimeout(() => openBonLivraisonPreviewModal(), 150);
        return;
      }

      const result = await window.api.ventes.create(venteData);
      if (!result.success) { Toast.error('Erreur: ' + result.message); return; }

      if (state.tableActive?.id) {
        await window.api.tables.supprimer(state.tableActive.id);
      }

      state.dernierTicket = {
        numero_ticket: result.numero_ticket,
        date_vente: new Date().toISOString(),
        nom_caissier: user?.nom || '-',
        total_ttc: total,
        remise_totale: remiseTotale,
        mode_paiement: mode,
        montant_paye: montantPaye,
        monnaie_rendue: monnaie,
        copies: state.impression.copies,
        lignes: lignesVente,
        estBonLivraison: false,
      };

      if (state.impression.actif) {
        await window.api.printer.printTicket(state.dernierTicket);
      }

      state.panier = [];
      state.selectedIndex = -1;
      state.tableActive = null;
      updateTableBadge();
      renderPanier();
      state.produits = (await window.api.produits.getAll()).filter(p => !p.is_ingredient);
      renderProducts();

      Modal.close(modalId);
      Toast.success(`Vente ${result.numero_ticket} enregistrée !`);

    } catch (err) {
      Toast.error('Erreur: ' + err.message);
    }
  }

  function buildBonPreviewText(t) {
    const L = 40;
    const s2 = '═'.repeat(L);
    const s1 = '─'.repeat(L);
    const ctr = str => { const p = Math.max(0, (L - str.length) / 2 | 0); return ' '.repeat(p) + str; };
    const rgt = (label, val) => `${label.padEnd(L - val.length - 1)}${val}`;
    const dev = state.devise;
    const en = state.entreprise || {};
    const liv = t.livraison || {};
    const lines = [
      s2,
      en.nom ? ctr(en.nom.toUpperCase()) : null,
      en.adresse ? ctr(en.adresse) : null,
      en.ville ? ctr(en.ville) : null,
      en.tel ? ctr('Tél: ' + en.tel) : null,
      en.email ? ctr('Email: ' + en.email) : null,
      en.nif ? ctr('NIF: ' + en.nif) : null,
      en.stat ? ctr('STAT: ' + en.stat) : null,
      s2, '',
      ctr('BON DE COMMANDE'),
      '',
      `Bon N° : ${t.numero_bon || t.numero_ticket}`,
      `Date   : ${new Date(t.date_vente).toLocaleString('fr-FR')}`,
      `Vendeur: ${t.nom_caissier || '-'}`,
      '', s1,
      ctr('LIVRAISON'),
    ];
    if (liv.adresse) lines.push(`Adresse : ${liv.adresse}`);
    if (liv.lieu) lines.push(`Lieu    : ${liv.lieu}`);
    if (liv.date_prevue) {
      lines.push(`Livr. le: ${liv.date_prevue}${liv.heure_prevue ? ' à ' + liv.heure_prevue : ''}`);
    }
    if (liv.client_nom) lines.push(`Client  : ${liv.client_nom}`);
    if (liv.contact_tel) lines.push(`Tél.    : ${liv.contact_tel}`);
    lines.push(s1, '');
    lines.push(`${'Qté'.padEnd(4)} ${'Désignation'.padEnd(L - 17).slice(0, L - 17)} ${'Montant'.padStart(11)}`);
    lines.push(s1);
    for (const l of (t.lignes || [])) {
      const mt = l.est_offert
        ? '(OFFERT)'.padStart(11)
        : `${String(Math.round(l.total_ttc || 0)).padStart(9)} ${dev}`;
      const sub = l.remise > 0 ? `\n${''.padEnd(5)}↳ Remise: ${l.remise}%` : '';
      lines.push(`${String(Math.round(l.quantite)).padEnd(4)} ${l.produit_nom.padEnd(L - 17).slice(0, L - 17)} ${mt}${sub}`);
    }
    lines.push(s1, '');
    if (t.remise_totale > 0) lines.push(rgt('Remises  :', `-${Math.round(t.remise_totale)} ${dev}`));
    lines.push(rgt('TOTAL    :', `${Math.round(t.total_ttc || 0).toLocaleString('fr-FR')} ${dev}`));
    lines.push(rgt('Mode     :', t.mode_paiement || 'CASH'));
    if ((t.montant_paye || 0) > 0) lines.push(rgt('Payé     :', `${Math.round(t.montant_paye).toLocaleString('fr-FR')} ${dev}`));
    if ((t.monnaie_rendue || 0) > 0) lines.push(rgt('Rendu    :', `${Math.round(t.monnaie_rendue).toLocaleString('fr-FR')} ${dev}`));
    lines.push('', s2);
    if (en.slogan) lines.push(ctr(en.slogan));
    if (en.slogan) lines.push(s2);
    lines.push('', s1, ctr('Signature du client'), '', '_'.repeat(32), '', '_'.repeat(32));
    return lines.filter(l => l !== null && l !== undefined && l !== '').join('\n');
  }

  function openBonLivraisonPreviewModal() {
    const t = state.dernierTicket;
    if (!t || !t.estBonLivraison) return;
    const lignes = buildBonPreviewText(t);
    const visId = 'bon-liv-' + Date.now();
    Modal.open({
      id: visId,
      title: `Bon de commande ${t.numero_ticket}`,
      width: '540px',
      content: `
        <div class="ticket-preview-paper">
          ${state.entreprise.logo_url ? `<div style="text-align:center;margin-bottom:10px;"><img src="${Utils.esc(state.entreprise.logo_url)}" style="max-height:60px; max-width: 150px; object-fit: contain;"></div>` : ''}
          ${Utils.esc(lignes).replace(/\*\*(.*?)\*\*/g, '<strong style="font-size:1.15em; color:#000; font-weight:900">$1</strong>')}
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close="${visId}">Fermer</button>
        <button class="btn btn-primary" id="btn-reimpr-bon-liv">Imprimer le bon</button>
      `,
    });
    setTimeout(() => {
      document.getElementById('btn-reimpr-bon-liv')?.addEventListener('click', async () => {
        await window.api.printer.printBonLivraison({ ...t, copies: state.impression.copies });
        Toast.success('Bon envoyé à l\'imprimante');
        Modal.close(visId);
      });
    }, 20);
  }

  // ── VISUALISER DERNIER TICKET (après enregistrement) ────────────────────
  function openVisualiseur() {
    if (!state.dernierTicket) {
      Toast.warn('Aucun ticket enregistré dans cette session');
      return;
    }
    const t = state.dernierTicket;
    if (t.estBonLivraison) {
      const lignesBon = buildBonPreviewText(t);
      const visId = 'visu-' + Date.now();
      Modal.open({
        id: visId,
        title: `Bon ${t.numero_ticket}`,
        width: '540px',
        content: `
          <div class="ticket-preview-paper">
            ${state.entreprise.logo_url ? `<div style="text-align:center;margin-bottom:10px;"><img src="${Utils.esc(state.entreprise.logo_url)}" style="max-height:60px; max-width: 150px; object-fit: contain;"></div>` : ''}
            ${Utils.esc(lignesBon).replace(/\*\*(.*?)\*\*/g, '<strong style="font-size:1.15em; color:#000; font-weight:900">$1</strong>')}
          </div>
        `,
        footer: `
          <button class="btn btn-ghost" data-close="${visId}">Fermer</button>
          <button class="btn btn-primary" id="btn-reimprimer-bon-visu">Imprimer le bon</button>
        `,
      });
      setTimeout(() => {
        document.getElementById('btn-reimprimer-bon-visu')?.addEventListener('click', async () => {
          await window.api.printer.printBonLivraison({ ...t, copies: state.impression.copies });
          Toast.success(`${state.impression.copies} copie(s) envoyée(s)`);
          Modal.close(visId);
        });
      }, 20);
      return;
    }
    const L = 40;
    const s2 = '═'.repeat(L);
    const s1 = '─'.repeat(L);
    const ctr = str => { const p = Math.max(0, (L - str.length) / 2 | 0); return ' '.repeat(p) + str; };
    const rgt = (label, val) => `${label.padEnd(L - val.length - 1)}${val}`;
    const dev = state.devise;

    const lignes = [
      s2,
      t.entrepriseNom ? ctr(t.entrepriseNom.toUpperCase()) : ctr('TICKET DE CAISSE'),
      t.entrepriseAdresse ? ctr(t.entrepriseAdresse) : '',
      t.entrepriseTel ? ctr('Tél: ' + t.entrepriseTel) : '',
      t.entrepriseEmail ? ctr('Email: ' + t.entrepriseEmail) : '',
      t.entrepriseNif ? ctr('NIF: ' + t.entrepriseNif) : '',
      t.entrepriseStat ? ctr('STAT: ' + t.entrepriseStat) : '',
      s2, '',
      `Ticket : ${t.numero_ticket}`,
      `Date   : ${new Date(t.date_vente).toLocaleString('fr-FR')}`,
      `Vendeur: ${t.nom_caissier || '-'}`,
      // Pas de table
      '', s1,
      `${'Qté'.padEnd(4)} ${'Désignation'.padEnd(L - 17).slice(0, L - 17)} ${'Montant'.padStart(11)}`,
      s1,
      ...(t.lignes || []).map(l => {
        const mt = l.est_offert
          ? '(OFFERT)'.padStart(11)
          : `${String(Math.round(l.total_ttc || 0)).padStart(9)} ${dev}`;
        const sub = l.remise > 0 ? `\n${''.padEnd(5)}↳ Remise: ${l.remise}%` : '';
        return `${String(Math.round(l.quantite)).padEnd(4)} ${l.produit_nom.padEnd(L - 17).slice(0, L - 17)} ${mt}${sub}`;
      }),
      s1, '',
      t.remise_totale > 0 ? rgt('Remises  :', `-${Math.round(t.remise_totale)} ${dev}`) : '',
      rgt('TOTAL    :', `${Math.round(t.total_ttc || 0).toLocaleString('fr-FR')} ${dev}`),
      rgt('Mode     :', t.mode_paiement || 'CASH'),
      (t.montant_paye || 0) > 0 ? rgt('Payé     :', `${Math.round(t.montant_paye).toLocaleString('fr-FR')} ${dev}`) : '',
      (t.monnaie_rendue || 0) > 0 ? rgt('Rendu    :', `${Math.round(t.monnaie_rendue).toLocaleString('fr-FR')} ${dev}`) : '',
      '', s2,
      t.slogan ? ctr(t.slogan) : '',
      t.slogan ? s2 : '',
    ].filter(l => l !== null && l !== undefined && l !== '').join('\n');

    const visId = 'visu-' + Date.now();
    Modal.open({
      id: visId,
      title: `Ticket ${t.numero_ticket}`,
      width: '540px',
      content: `
        <div class="ticket-preview-paper">
          ${state.entreprise.logo_url ? `<div style="text-align:center;margin-bottom:10px;"><img src="${Utils.esc(state.entreprise.logo_url)}" style="max-height:60px; max-width: 150px; object-fit: contain;"></div>` : ''}
          ${Utils.esc(lignes).replace(/\*\*(.*?)\*\*/g, '<strong style="font-size:1.15em; color:#000; font-weight:900">$1</strong>')}
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close="${visId}">Fermer</button>
        <button class="btn btn-primary" id="btn-reimprimer">Réimprimer</button>
      `,
    });
    setTimeout(() => {
      document.getElementById('btn-reimprimer')?.addEventListener('click', async () => {
        await window.api.printer.printTicket({ ...t, copies: state.impression.copies });
        Toast.success(`${state.impression.copies} copie(s) envoyée(s) à l'imprimante`);
        Modal.close(visId);
      });
    }, 20);
  }

  // ── EVENTS ────────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('caisse-retour')?.addEventListener('click', () => {
      // Nettoyer complètement le panier en quittant
      state.panier = [];
      state.selectedIndex = -1;
      state.tableActive = null;
      updateTableBadge();
      renderPanier();
      Router.go('dashboard');
    });

    document.getElementById('btn-offert')?.addEventListener('click', toggleOffert);
    document.getElementById('btn-suppr-item')?.addEventListener('click', supprimerItem);
    document.getElementById('btn-tables')?.addEventListener('click', openTables);
    document.getElementById('btn-sauver-table')?.addEventListener('click', openSauverTable);
    document.getElementById('btn-ticket')?.addEventListener('click', openTicketModal);
    document.getElementById('btn-livraison')?.addEventListener('click', openLivraisonModal);
    document.getElementById('btn-visualiser')?.addEventListener('click', openVisualiseurPanier);

    document.getElementById('btn-vider-panier')?.addEventListener('click', () => {
      if (!state.panier.length) return;
      Modal.confirm('Vider', 'Supprimer tous les articles ?', ok => {
        if (!ok) return;
        state.panier = []; state.selectedIndex = -1;
        state.tableActive = null; updateTableBadge(); renderPanier();
      });
    });

    // Remise select
    document.getElementById('remise-select')?.addEventListener('change', async e => {
      const val = e.target.value;
      if (val === '0') return;
      if (val === 'custom') {
        Modal.prompt('Remise personnalisée', 'Entrer le % de remise :', '5', v => {
          const pct = parseFloat(v);
          if (!isNaN(pct) && pct >= 0 && pct <= 100) appliquerRemise(pct);
        });
        e.target.value = '0';
        return;
      }
      appliquerRemise(parseFloat(val));
      e.target.value = '0';
    });

    // Recherche
    const searchFn = Utils.debounce(async q => {
      state.searchQuery = q;
      if (q) { const res = await window.api.produits.search(q); renderProducts(res); }
      else renderProducts();
    }, 250);
    document.getElementById('product-search')?.addEventListener('input', e => searchFn(e.target.value));
  }

  // ── Activation ────────────────────────────────────────────────────────
  document.addEventListener('view:activate', e => {
    if (e.detail.view === 'caisse') {
      if (!document.querySelector('.caisse-body')) render();
      else { loadData(); updateCuisineNotif(); }
    }
  });

})();
