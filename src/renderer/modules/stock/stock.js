'use strict';

(function StockModule() {

  let state = {
    categories: [],
    produits: [],
    activeCatId: null,
    selectedProduit: null,
    searchQuery: '',
    devise: 'Ar',
    imageData: null,
  };

  function render() {
    const container = document.getElementById('view-stock');
    container.innerHTML = `
      <div class="caisse-topbar">
        <button class="btn btn-ghost btn-sm" id="stock-retour">← Retour</button>
        <span class="caisse-topbar-title">📦 Gestion du Stock</span>
        <div style="flex:1"></div>
        <button class="btn btn-warning btn-sm" id="btn-alertes-stock">⚠️ Alertes</button>
      </div>

      <div class="stock-body">
        <!-- Sidebar catégories -->
        <div class="stock-sidebar">
          <div class="sidebar-title">Catégories</div>
          <div id="stock-cats-list"></div>
          <div style="padding:10px 14px;border-top:1px solid var(--border);margin-top:8px;display:flex;gap:6px;">
            <button class="btn btn-primary btn-sm" id="btn-add-cat" style="flex:1">➕ Catégorie</button>
            <button class="btn btn-danger btn-sm" id="btn-del-cat" style="display:none" title="Supprimer la catégorie">🗑️</button>
          </div>
        </div>

        <!-- Tableau produits -->
        <div class="stock-main">
          <div class="stock-toolbar">
            <input type="text" class="input" id="stock-search" placeholder="🔍 Rechercher..." style="max-width:260px" />
            <button class="btn btn-success btn-sm" id="btn-add-produit">➕ Nouveau produit</button>
            <button class="btn btn-ghost btn-sm" id="btn-edit-produit" disabled>✏️ Modifier</button>
            <button class="btn btn-danger btn-sm" id="btn-delete-produit" disabled>🚫 Désactiver</button>
            <button class="btn btn-ghost btn-sm" id="btn-ajust-stock">📊 Ajuster stock</button>
          </div>
          <div class="data-table-wrap" style="flex:1">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Réf</th>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Prix vente</th>
                  <th>Stock</th>
                  <th>Fournisseur</th>
                </tr>
              </thead>
              <tbody id="stock-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    loadData();
  }

  async function loadData() {
    const [cats, prods, params] = await Promise.all([
      window.api.categories.getAll(),
      window.api.produits.getAll(),
      window.api.parametres.getAll(),
    ]);
    state.categories = cats;
    state.produits = prods;
    state.devise = params['caisse.devise'] || 'Ar';
    renderCats();
    renderTable();
  }

  function renderCats() {
    const list = document.getElementById('stock-cats-list');
    if (!list) return;
    list.innerHTML = `
      <div class="cat-item${!state.activeCatId ? ' active-cat' : ''}" data-cat-id="">🏷️ Tous</div>
      ${state.categories.map(c => `
        <div class="cat-item${state.activeCatId === c.id ? ' active-cat' : ''}" data-cat-id="${c.id}">${Utils.esc(c.nom)}</div>
      `).join('')}`;
    list.querySelectorAll('.cat-item').forEach(item =>
      item.addEventListener('click', () => {
        state.activeCatId = item.dataset.catId ? parseInt(item.dataset.catId) : null;
        renderCats();
        renderTable();
      })
    );
    const btnDel = document.getElementById('btn-del-cat');
    if (btnDel) btnDel.style.display = state.activeCatId ? 'block' : 'none';
  }

  function renderTable(prods = null) {
    const tbody = document.getElementById('stock-tbody');
    if (!tbody) return;
    let toShow = prods || state.produits;
    if (state.activeCatId) toShow = toShow.filter(p => p.categorie_id === state.activeCatId);
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      toShow = toShow.filter(p => p.nom.toLowerCase().includes(q) || (p.reference || '').includes(q) || (p.fournisseur || '').toLowerCase().includes(q));
    }

    tbody.innerHTML = toShow.map(p => {
      const stockActuel = p.stock_actuel;
      const infini = stockActuel === -1;
      const rupture = !infini && stockActuel <= 0;
      const alerte = !infini && !rupture && stockActuel <= p.stock_alerte;
      let badgeClass = 'ok', badgeTxt = stockActuel;
      if (infini) { badgeClass = 'infini'; badgeTxt = '∞'; }
      else if (rupture) { badgeClass = 'rupture'; badgeTxt = '⛔ ' + stockActuel; }
      else if (alerte) { badgeClass = 'warn'; badgeTxt = '⚠️ ' + stockActuel; }

      return `<tr data-id="${p.id}" class="stock-row" style="cursor:pointer">
        <td>${Utils.esc(p.reference || '')}</td>
        <td><strong>${Utils.esc(p.nom)}</strong></td>
        <td>${Utils.esc(p.categorie_nom || '-')}</td>
        <td class="td-prix">${Utils.formatMontant(p.prix_vente_ttc, state.devise)}</td>
        <td><span class="stock-alerte-badge ${badgeClass}">${badgeTxt}</span></td>
        <td>${Utils.esc(p.fournisseur || '-')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;opacity:0.5;padding:30px">Aucun produit</td></tr>';

    tbody.querySelectorAll('.stock-row').forEach(row => {
      row.addEventListener('click', () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        state.selectedProduit = state.produits.find(p => p.id === parseInt(row.dataset.id));
        document.getElementById('btn-edit-produit').disabled = false;
        document.getElementById('btn-delete-produit').disabled = false;
      });
      row.addEventListener('dblclick', () => openProduitForm(state.selectedProduit));
    });
  }

  // ── FORMULAIRE PRODUIT ────────────────────────────────────────────────
  function openProduitForm(produit = null) {
    const isEdit = !!produit;
    state.imageData = produit?.image_data || null;

    const id = Modal.open({
      title: isEdit ? `✏️ Modifier : ${produit.nom}` : '➕ Nouveau produit',
      width: '700px',
      content: `
        <div style="display:flex;gap:20px;align-items:flex-start">
          <div>
            <div class="img-preview" id="img-preview-btn">
              ${state.imageData ? `<img src="${state.imageData}" />` : '📷'}
            </div>
            <input type="file" id="img-file" accept="image/*" style="display:none" />
            <div style="font-size:10px;opacity:0.5;margin-top:4px;text-align:center">Cliquer pour image</div>
          </div>
          <div class="produit-form" style="flex:1">
            <div class="form-group full">
              <label>Nom du produit *</label>
              <input type="text" class="input" id="pf-nom" value="${Utils.esc(produit?.nom || '')}" />
            </div>
            <div class="form-group">
              <label>Prix vente TTC (${state.devise}) *</label>
              <input type="number" class="input" id="pf-prix" value="${produit?.prix_vente_ttc || 0}" min="0" step="1" />
            </div>
            <div class="form-group">
              <label>Catégorie</label>
              <select class="input" id="pf-cat">
                <option value="">-- Sans catégorie --</option>
                ${state.categories.map(c => `<option value="${c.id}" ${produit?.categorie_id === c.id ? 'selected' : ''}>${Utils.esc(c.nom)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Fournisseur</label>
              <input type="text" class="input" id="pf-fourn" value="${Utils.esc(produit?.fournisseur || '')}" />
            </div>
            <div class="form-group full" style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="pf-illimite" ${produit?.stock_actuel === -1 || produit?.stock_actuel === undefined ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;" />
              <label for="pf-illimite" style="margin:0; cursor:pointer; user-select:none;">Stock illimité</label>
            </div>
            <div class="form-group">
              <label>Stock actuel</label>
              <input type="number" class="input" id="pf-stock" value="${produit?.stock_actuel !== undefined && produit?.stock_actuel !== -1 ? produit.stock_actuel : 0}" step="0.5" ${produit?.stock_actuel === -1 || produit?.stock_actuel === undefined ? 'disabled style="opacity:0.5"' : ''} />
            </div>
            <div class="form-group">
              <label>Seuil d'alerte</label>
              <input type="number" class="input" id="pf-alerte" value="${produit?.stock_alerte || 0}" min="0" ${produit?.stock_actuel === -1 || produit?.stock_actuel === undefined ? 'disabled style="opacity:0.5"' : ''} />
            </div>
            <div class="form-group full">
              <label>Description</label>
              <textarea class="input" id="pf-desc" rows="2">${Utils.esc(produit?.description || '')}</textarea>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.closeAll()">Annuler</button>
        <button class="btn btn-success" id="btn-save-produit">${isEdit ? '💾 Enregistrer' : '➕ Créer'}</button>
      `,
    });

    setTimeout(() => {
      document.getElementById('img-preview-btn')?.addEventListener('click', () => {
        document.getElementById('img-file')?.click();
      });
      document.getElementById('img-file')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          state.imageData = ev.target.result;
          document.getElementById('img-preview-btn').innerHTML = `<img src="${state.imageData}" />`;
        };
        reader.readAsDataURL(file);
      });

      const chkIllimite = document.getElementById('pf-illimite');
      const inStock = document.getElementById('pf-stock');
      const inAlerte = document.getElementById('pf-alerte');
      chkIllimite?.addEventListener('change', () => {
        const isIllimite = chkIllimite.checked;
        inStock.disabled = inAlerte.disabled = isIllimite;
        inStock.style.opacity = inAlerte.style.opacity = isIllimite ? '0.5' : '1';
      });

      document.getElementById('btn-save-produit')?.addEventListener('click', async () => {
        const nom = document.getElementById('pf-nom').value.trim();
        if (!nom) { Toast.warn('Nom requis'); return; }
        const data = {
          nom,
          prix_vente_ttc: parseFloat(document.getElementById('pf-prix').value) || 0,
          prix_achat: 0,
          categorie_id: document.getElementById('pf-cat').value ? parseInt(document.getElementById('pf-cat').value) : null,
          fournisseur: document.getElementById('pf-fourn').value.trim() || null,
          stock_actuel: document.getElementById('pf-illimite').checked ? -1 : (parseFloat(document.getElementById('pf-stock').value) || 0),
          stock_alerte: document.getElementById('pf-illimite').checked ? 0 : (parseFloat(document.getElementById('pf-alerte').value) || 0),
          description: document.getElementById('pf-desc').value.trim() || null,
          image_data: state.imageData || null,
        };
        let res;
        if (isEdit) {
          res = await window.api.produits.update(produit.id, data);
        } else {
          res = await window.api.produits.create(data);
        }
        if (res.success) {
          Toast.success(isEdit ? 'Produit modifié' : 'Produit créé');
          Modal.closeAll();
          state.produits = await window.api.produits.getAll();
          renderTable();
        } else {
          Toast.error(res.message);
        }
      });
    }, 50);
  }

  function openAjustementForm() {
    if (!state.selectedProduit) { Toast.warn('Sélectionnez un produit'); return; }
    const p = state.selectedProduit;
    const id = Modal.open({
      title: `📊 Ajustement stock : ${p.nom}`,
      width: '420px',
      content: `
        <div class="form-group" style="margin-bottom:12px">
          <label>Stock actuel</label>
          <div style="font-size:24px;font-weight:700;color:var(--accent)">${p.stock_actuel === -1 ? '∞ Illimité' : p.stock_actuel}</div>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label>Nouvelle quantité</label>
          <input type="number" class="input" id="ajust-qty" value="${p.stock_actuel === -1 ? 0 : p.stock_actuel}" step="0.5" />
        </div>
        <div class="form-group">
          <label>Motif</label>
          <input type="text" class="input" id="ajust-motif" placeholder="Inventaire, réception commande..." value="Ajustement manuel" />
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.closeAll()">Annuler</button>
        <button class="btn btn-primary" id="btn-save-ajust">💾 Confirmer</button>
      `,
    });
    setTimeout(() => {
      document.getElementById('btn-save-ajust')?.addEventListener('click', async () => {
        const qty = parseFloat(document.getElementById('ajust-qty').value);
        const motif = document.getElementById('ajust-motif').value.trim();
        const res = await window.api.stock.ajustement(p.id, qty, motif);
        if (res.success) {
          Toast.success(`Stock mis à jour: ${res.ancienneQty} → ${res.nouvelleQty}`);
          Modal.closeAll();
          state.produits = await window.api.produits.getAll();
          state.selectedProduit = state.produits.find(pr => pr.id === p.id);
          renderTable();
        } else {
          Toast.error(res.message);
        }
      });
    }, 50);
  }

  async function openAlertes() {
    const alertes = await window.api.stock.getAlertes();
    Modal.open({
      title: `⚠️ Alertes stock (${alertes.length})`,
      width: '600px',
      content: alertes.length === 0
        ? '<div class="empty-state"><div class="empty-icon">✅</div><p>Aucune alerte de stock</p></div>'
        : `<table class="data-table">
            <thead><tr><th>Produit</th><th>Catégorie</th><th>Stock</th><th>Seuil</th></tr></thead>
            <tbody>${alertes.map(p => `
              <tr>
                <td><strong>${Utils.esc(p.nom)}</strong></td>
                <td>${Utils.esc(p.categorie_nom || '-')}</td>
                <td style="color:${p.stock_actuel <= 0 ? '#e74c3c' : '#f39c12'};font-weight:700">${p.stock_actuel}</td>
                <td style="opacity:0.7">${p.stock_alerte}</td>
              </tr>`).join('')}
            </tbody>
          </table>`,
    });
  }

  function bindEvents() {
    document.getElementById('stock-retour')?.addEventListener('click', () => Router.go('dashboard'));
    document.getElementById('btn-add-produit')?.addEventListener('click', () => openProduitForm(null));
    document.getElementById('btn-edit-produit')?.addEventListener('click', () => {
      if (state.selectedProduit) openProduitForm(state.selectedProduit);
    });
    document.getElementById('btn-delete-produit')?.addEventListener('click', async () => {
      if (!state.selectedProduit) return;
      const ok = await new Promise(r => Modal.confirm('Désactiver', `Désactiver ${state.selectedProduit.nom} ?`, r));
      if (ok) {
        await window.api.produits.delete(state.selectedProduit.id);
        Toast.success('Produit désactivé');
        state.selectedProduit = null;
        state.produits = await window.api.produits.getAll();
        renderTable();
      }
    });
    document.getElementById('btn-ajust-stock')?.addEventListener('click', openAjustementForm);
    document.getElementById('btn-alertes-stock')?.addEventListener('click', openAlertes);
    document.getElementById('btn-add-cat')?.addEventListener('click', () => {
      Modal.prompt('Nouvelle catégorie', 'Nom de la catégorie :', '', async (nom) => {
        if (!nom) return;
        await window.api.categories.create({ nom, code: nom.toUpperCase().replace(/\s/g, '_') });
        state.categories = await window.api.categories.getAll();
        renderCats();
      });
    });

    document.getElementById('btn-del-cat')?.addEventListener('click', async () => {
      if (!state.activeCatId) return;
      const cat = state.categories.find(c => c.id === state.activeCatId);
      if (!cat) return;
      const ok = await new Promise(r => Modal.confirm(
        'Supprimer la catégorie',
        `Voulez-vous vraiment supprimer la catégorie "${cat.nom}" ET désactiver tous les produits qu'elle contient ?`,
        r
      ));
      if (ok) {
        await window.api.categories.delete(state.activeCatId);
        Toast.success('Catégorie supprimée');
        state.activeCatId = null;
        loadData();
      }
    });

    const searchFn = Utils.debounce(async (q) => {
      state.searchQuery = q;
      if (q) {
        const prods = await window.api.produits.search(q);
        renderTable(prods);
      } else renderTable();
    }, 250);
    document.getElementById('stock-search')?.addEventListener('input', e => searchFn(e.target.value));
  }

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'stock') {
      if (!document.querySelector('.stock-body')) render();
      else loadData();
    }
  });

})();
