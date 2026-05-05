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
    currentTab: 'produits',
    recipeIngredients: [],
    imageFileName: '',
    imagePendingDataUrl: null,
  };

  function categoryDepth(cat) {
    const byId = Object.fromEntries(state.categories.map(c => [c.id, c]));
    let d = 0;
    let pid = cat.parent_id;
    while (pid) {
      d += 1;
      pid = byId[pid] ? byId[pid].parent_id : null;
    }
    return d;
  }

  function categorySubtreeIds(rootId) {
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of state.categories) {
        if (c.parent_id != null && ids.has(c.parent_id) && !ids.has(c.id)) {
          ids.add(c.id);
          grew = true;
        }
      }
    }
    return ids;
  }

  function catOptionsHtml(selectedId) {
    const sorted = [...state.categories]
      .filter(c => c.code !== 'TOUT')
      .sort((a, b) => {
        const da = categoryDepth(a);
        const db = categoryDepth(b);
        if (da !== db) return da - db;
        return (a.ordre || 0) - (b.ordre || 0) || a.nom.localeCompare(b.nom);
      });
    return sorted.map(c => {
      const d = categoryDepth(c);
      const sp = d ? `${'\u00A0\u00A0'.repeat(d)}\u21B3 ` : '';
      return `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>${sp}${Utils.esc(c.nom)}</option>`;
    }).join('');
  }

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
          <div class="stock-tabs" style="display:flex; gap:10px; margin-bottom:12px; border-bottom:1px solid var(--border)">
            <div class="stock-tab ${state.currentTab === 'produits' ? 'active' : ''}" data-tab="produits" style="padding:10px 20px; cursor:pointer; font-weight:700; ${state.currentTab === 'produits' ? 'border-bottom:3px solid var(--accent); color:var(--accent-light)' : 'opacity:0.6'}">📦 Produits vendables</div>
            <div class="stock-tab ${state.currentTab === 'ingredients' ? 'active' : ''}" data-tab="ingredients" style="padding:10px 20px; cursor:pointer; font-weight:700; ${state.currentTab === 'ingredients' ? 'border-bottom:3px solid var(--accent); color:var(--accent-light)' : 'opacity:0.6'}">🧪 Ingrédients / Matières</div>
          </div>

          <div class="stock-toolbar">
            <input type="text" class="input" id="stock-search" placeholder="🔍 Rechercher..." style="max-width:260px" />
            <button class="btn btn-success btn-sm" id="btn-add-produit">➕ Nouveau produit</button>
            <button class="btn btn-ghost btn-sm" id="btn-edit-produit" disabled>✏️ Modifier</button>
            <button class="btn btn-danger btn-sm" id="btn-delete-produit" disabled>🚫 Désactiver</button>
            <button class="btn btn-ghost btn-sm" id="btn-ajust-stock">📊 Ajuster stock</button>
            <button class="btn btn-warning btn-sm" id="btn-voir-vente" style="margin-left:auto;">📊 Voir Ventes</button>
          </div>
          <div class="data-table-wrap" style="flex:1">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Réf</th>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Pr.Vente</th>
                  <th>P.A</th>
                  <th>Stock actuel</th>
                  <th>Date créa.</th>
                  <th>Unité</th>
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

    // Construire une hiérarchie
    const roots = state.categories.filter(c => !c.parent_id);
    const byParent = {};
    state.categories.forEach(c => {
      if (c.parent_id) {
        if (!byParent[c.parent_id]) byParent[c.parent_id] = [];
        byParent[c.parent_id].push(c);
      }
    });

    function renderNode(cat, level) {
      const isAct = state.activeCatId === cat.id;
      const html = `<div class="cat-item${isAct ? ' active-cat' : ''}" data-cat-id="${cat.id}" style="padding-left:${16 + level * 14}px">
        ${level === 0 ? '📁' : '↳'} ${Utils.esc(cat.nom)}
      </div>`;
      const children = byParent[cat.id] || [];
      return html + children.map(child => renderNode(child, level + 1)).join('');
    }

    list.innerHTML = `
      <div class="cat-item${!state.activeCatId ? ' active-cat' : ''}" data-cat-id="">🏷️ Toutes</div>
      ${roots.map(r => renderNode(r, 0)).join('')}`;

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

    // Reset selection state when rendering new data
    state.selectedProduit = null;
    const btnEdit = document.getElementById('btn-edit-produit');
    const btnDel = document.getElementById('btn-delete-produit');
    if (btnEdit) btnEdit.disabled = true;
    if (btnDel) btnDel.disabled = true;

    let toShow = prods || state.produits;

    // Filtre par Tab
    if (state.currentTab === 'produits') {
      toShow = toShow.filter(p => !p.is_ingredient);
    } else {
      toShow = toShow.filter(p => !!p.is_ingredient);
    }

    if (state.activeCatId) {
      const ids = categorySubtreeIds(state.activeCatId);
      toShow = toShow.filter(p => p.categorie_id != null && ids.has(p.categorie_id));
    }
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      toShow = toShow.filter(p => p.nom.toLowerCase().includes(q) || (p.reference || '').includes(q) || (p.fournisseur || '').toLowerCase().includes(q));
    }

    tbody.innerHTML = toShow.map(p => {
      const stockActuel = p.stock_actuel;
      const barAff = p.stock_bar != null && p.stock_bar !== undefined ? p.stock_bar : stockActuel;
      const grosAff = p.stock_grossiste != null ? p.stock_grossiste : (p.stock_gros || 0);
      const isPrep = !!p.is_prepared;

      const infini = stockActuel === -1;
      const displayStock = isPrep ? (p.virtual_stock ?? 0) : barAff;
      const rupture = isPrep ? displayStock <= 0 : (!infini && barAff <= 0);
      const alerteBar = !infini && !rupture && displayStock <= (p.stock_alerte || 0);

      let badgeClass = 'ok', badgeTxt = displayStock;
      if (isPrep) {
        badgeClass = rupture ? 'rupture' : (alerteBar ? 'warn' : 'ok');
        badgeTxt = '🥣 ' + displayStock;
      } else if (infini) {
        badgeClass = 'infini'; badgeTxt = '∞';
      } else if (rupture) {
        badgeClass = 'rupture'; badgeTxt = '⛔ ' + displayStock;
      } else if (alerteBar) {
        badgeClass = 'warn'; badgeTxt = '⚠️ ' + displayStock;
      }

      return `<tr data-uuid="${p.uuid}" class="stock-row" style="cursor:pointer">
        <td>${Utils.esc(p.reference || '')}</td>
        <td><strong>${Utils.esc(p.nom)}</strong></td>
        <td>${Utils.esc(p.categorie_nom || '-')}</td>
        <td class="td-prix">${Utils.formatMontant(p.prix_vente_ttc, state.devise)}</td>
        <td class="td-prix-achat" style="opacity:0.7; font-size:12px">${Utils.formatMontant(p.prix_achat || 0, state.devise)}</td>
        <td><span class="stock-alerte-badge ${badgeClass}">${badgeTxt}</span>/${p.stock_alerte || 0}</td>
        <td>${p.date_creation ? new Date(p.date_creation).toLocaleDateString('fr-FR') : '-'}</td>
        <td style="opacity:0.8; font-size:12px">${Utils.esc(p.unite_base || '-')}</td>
        <td>${Utils.esc(p.fournisseur || '-')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" style="text-align:center;opacity:0.5;padding:30px">Aucun produit</td></tr>';

    tbody.querySelectorAll('.stock-row').forEach(row => {
      row.addEventListener('click', () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        state.selectedProduit = state.produits.find(p => p.uuid === row.dataset.uuid);
        document.getElementById('btn-edit-produit').disabled = false;
        document.getElementById('btn-delete-produit').disabled = false;
      });
      row.addEventListener('dblclick', () => {
        if (state.selectedProduit) openProduitForm(state.selectedProduit);
        else Toast.warn('Sélectionnez un produit');
      });
    });
  }

  // ── FORMULAIRE PRODUIT ────────────────────────────────────────────────
  async function openProduitForm(produit = null) {
    try {
      const isEdit = !!produit;
      state.imageData = produit?.image_data || null;
      state.imageFileName = '';
      state.imagePendingDataUrl = null;
      state.recipeIngredients = [];

      // Si c'est un produit préparé, on charge ses ingrédients avant d'ouvrir
      if (isEdit && (produit.is_prepared || produit.est_prepare)) {
        try {
          state.recipeIngredients = await window.api.produits.getIngredients(produit.uuid);
        } catch (e) {
          console.error("Erreur lors de la récupération des ingrédients:", e);
        }
      }

      Modal.open({
        title: isEdit ? `✏️ Modifier : ${produit.nom}` : '➕ Nouveau produit',
        width: '800px',
        content: `
        <div style="display:flex;gap:20px;align-items:flex-start">
          <div style="width:120px;flex-shrink:0">
            <div class="img-preview" id="img-preview-btn">
              ${state.imageData ? `<img src="${state.imageData}" />` : '📷'}
            </div>
            <input type="file" id="img-file" accept="image/*" style="display:none" />
            <div style="font-size:10px;opacity:0.5;margin-top:4px;text-align:center">Cliquer pour modifier</div>
            
            <div style="margin-top:20px; background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; border:1px solid var(--border)">
              <div style="font-size:11px; font-weight:700; margin-bottom:8px; opacity:0.7">Attributs spéciaux</div>
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px">
                <input type="checkbox" id="pf-alcool" ${(produit?.is_alcool || produit?.est_alcool) ? 'checked' : ''} style="cursor:pointer" />
                <label for="pf-alcool" style="font-size:12px; margin:0; cursor:pointer">Boisson alcoolisée</label>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <input type="checkbox" id="pf-illimite" ${produit?.stock_actuel === -1 ? 'checked' : ''} style="cursor:pointer" />
                <label for="pf-illimite" style="font-size:12px; margin:0; cursor:pointer">Stock illimité</label>
              </div>
              <div style="display:flex; align-items:center; gap:6px; margin-top:6px">
                <input type="checkbox" id="pf-ingredient" ${produit?.is_ingredient ? 'checked' : ''} style="cursor:pointer" />
                <label for="pf-ingredient" style="font-size:12px; margin:0; cursor:pointer">Ingrédient / matière</label>
              </div>
              <div style="display:flex; align-items:center; gap:6px; margin-top:6px">
                <input type="checkbox" id="pf-prepared" ${produit?.is_prepared ? 'checked' : ''} style="cursor:pointer" />
                <label for="pf-prepared" style="font-size:12px; margin:0; cursor:pointer">Produit à préparer (recette)</label>
              </div>
              <div style="display:flex; align-items:center; gap:6px; margin-top:6px; border-top:1px solid var(--border); padding-top:6px">
                <input type="checkbox" id="pf-achat" style="cursor:pointer" />
                <label for="pf-achat" style="font-size:11px; margin:0; cursor:pointer; font-weight:bold; color:var(--accent-light)">Stock initial payé (déduire du capital)</label>
              </div>
            </div>
          </div>
          
          <div class="produit-form" style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:12px">
            <!-- GENERAL -->
            <div class="form-group" style="grid-column: span 2">
              <label>Nom du produit *</label>
              <input type="text" class="input" id="pf-nom" value="${Utils.esc(produit?.nom || '')}" />
            </div>
            <div class="form-group">
              <label>Catégorie</label>
              <select class="input" id="pf-cat">
                <option value="">-- Sans catégorie --</option>
                ${catOptionsHtml(produit?.categorie_id)}
              </select>
            </div>
            <div class="form-group">
              <label>Fournisseur</label>
              <input type="text" class="input" id="pf-fourn" value="${Utils.esc(produit?.fournisseur || '')}" />
            </div>

            <div style="grid-column: span 2; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0;"></div>

            <!-- VENTE AU DÉTAIL -->
            <div class="form-group">
              <label>Prix détail (${state.devise}) *</label>
              <input type="number" class="input" id="pf-prix" value="${produit?.prix_vente_ttc || 0}" min="0" step="1" />
            </div>
            <div class="form-group">
              <label>Unité de base (bar / détail)</label>
              <input type="text" class="input" id="pf-unit-d" value="${Utils.esc(produit?.unite_base || produit?.unite_detail || 'Unité')}" placeholder="ex: bouteille" />
            </div>

            <div style="grid-column: span 2; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0;"></div>

            <!-- PURCHASE INFO (Always Visible) -->
            <div id="pf-purchase-section" style="grid-column: span 2; background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; border:1px solid var(--border); margin-bottom:8px">
              <div style="display:flex; gap:12px; align-items:flex-end">
                <div class="form-group" style="flex:1">
                  <label id="lbl-pf-prix-achat">Prix d'achat unitaire (${state.devise})</label>
                  <input type="number" class="input" id="pf-prix-achat" value="${produit?.prix_achat || 0}" min="0" step="0.01" />
                </div>
              </div>
            </div>

            <div style="grid-column: span 2; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0;"></div>

            <!-- STOCKS -->
            <div class="form-group">
              <label>Stock initial (unités de base)</label>
              <input type="number" class="input" id="pf-stock" value="${produit?.stock_actuel !== undefined && produit?.stock_actuel !== -1 ? (produit.stock_bar != null ? produit.stock_bar : produit.stock_actuel) : 0}" step="0.5" ${produit?.stock_actuel === -1 ? 'disabled style="opacity:0.5"' : ''} />
            </div>
            <div class="form-group">
              <label>Seuil d'alerte</label>
              <input type="number" class="input" id="pf-alerte" value="${produit?.stock_alerte || 0}" min="1" ${produit?.stock_actuel === -1 ? 'disabled style="opacity:0.5"' : ''} />
            </div>
            
            <div class="form-group" style="grid-column: span 2; margin-top:8px">
              <label>Description</label>
              <textarea class="input" id="pf-desc" rows="2">${Utils.esc(produit?.description || '')}</textarea>
            </div>

            <!-- RECETTE / INGRÉDIENTS -->
            <div id="pf-recipe-section" style="grid-column: span 2; display: ${produit?.is_prepared ? 'block' : 'none'}; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px">
              <div style="font-weight:700; font-size:13px; margin-bottom:10px; color:var(--accent-light)">🥣 Composition (Recette)</div>
              <div style="display:flex; gap:10px; margin-bottom:12px">
                <select class="input" id="recipe-ing-select" style="flex:1">
                  <option value="">-- Ajouter un ingrédient --</option>
                  ${state.produits.filter(p => !!p.is_ingredient).map(p => `<option value="${p.uuid}">${Utils.esc(p.nom)} (${Utils.formatMontant(p.prix_achat || 0, state.devise)})</option>`).join('')}
                </select>
                <button class="btn btn-primary btn-sm" id="btn-add-recipe-ing">Ajouter</button>
              </div>
              <div class="recipe-list" id="pf-recipe-list" style="max-height:150px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:6px; padding:8px">
                <!-- Ingrédients ajoutés ici -->
              </div>
              <div style="margin-top:8px; font-size:12px; text-align:right">
                Total coût estimé : <strong id="recipe-total-cost">0</strong> ${state.devise}
              </div>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" id="btn-cancel-produit">Annuler</button>
        <button class="btn btn-success" id="btn-save-produit">${isEdit ? '💾 Enregistrer' : '➕ Créer'}</button>
      `,
    });

    setTimeout(() => {
      document.getElementById('btn-cancel-produit')?.addEventListener('click', () => Modal.closeAll());

      document.getElementById('img-preview-btn')?.addEventListener('click', () => {
        document.getElementById('img-file')?.click();
      });
      document.getElementById('img-file')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          state.imagePendingDataUrl = ev.target.result;
          state.imageFileName = file.name || 'produit.png';
          state.imageData = state.imagePendingDataUrl;
          document.getElementById('img-preview-btn').innerHTML = `<img src="${state.imageData}" />`;
        };
        reader.readAsDataURL(file);
      });

      const chkIllimite = document.getElementById('pf-illimite');
      const inStock = document.getElementById('pf-stock');
      const inAlerte = document.getElementById('pf-alerte');
      chkIllimite?.addEventListener('change', () => {
        const isIllimite = chkIllimite.checked;
        if (inStock) {
          inStock.disabled = isIllimite;
          inStock.style.opacity = isIllimite ? '0.5' : '1';
        }
        if (inAlerte) {
          inAlerte.disabled = isIllimite;
          inAlerte.style.opacity = isIllimite ? '0.5' : '1';
        }
      });

      const chkAchat = document.getElementById('pf-achat');
      const sectionAchat = document.getElementById('pf-purchase-section');
      const inPrixAchat = document.getElementById('pf-prix-achat');
      const selPrixType = document.getElementById('pf-prix-type');
      const lblPrixAchat = document.getElementById('lbl-pf-prix-achat');

      chkAchat?.addEventListener('change', () => {
        // Optionnel: highlight visual feedback
      });

      const chkPrepared = document.getElementById('pf-prepared');
      const sectionRecipe = document.getElementById('pf-recipe-section');
      // inStock, inAlerte, inPrixAchat are already declared above
      const inPrixVente = document.getElementById('pf-prix');

      const renderRecipeList = () => {
        const listEl = document.getElementById('pf-recipe-list');
        if (!listEl) return;
        if (state.recipeIngredients.length === 0) {
          listEl.innerHTML = '<div style="opacity:0.4; font-size:11px; text-align:center; padding:10px">Aucun ingrédient</div>';
          document.getElementById('recipe-total-cost').textContent = '0';
          return;
        }

        let total = 0;
        listEl.innerHTML = state.recipeIngredients.map((ing, idx) => {
          total += (ing.prix_achat || 0) * (ing.quantite_requise || 0);
          return `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px">
              <div style="flex:1; font-size:12px">${Utils.esc(ing.nom)}</div>
              <input type="number" class="input recipe-ing-qte" data-idx="${idx}" value="${ing.quantite_requise}" step="0.1" style="width:60px; height:24px; font-size:11px; padding:2px 4px" />
              <div style="font-size:11px; opacity:0.7; width:60px; text-align:right">${Utils.formatMontant((ing.prix_achat || 0) * (ing.quantite_requise || 0), state.devise)}</div>
              <button class="btn btn-danger btn-sm btn-del-recipe-ing" data-idx="${idx}" style="padding:0 4px; height:24px">×</button>
            </div>
          `;
        }).join('');
        document.getElementById('recipe-total-cost').textContent = Utils.formatMontant(total, '');

        // Recalculer le prix d'achat conseillé
        if (inPrixAchat) {
          inPrixAchat.placeholder = `Conseillé: ${total}`;
          if (!isEdit && (parseFloat(inPrixAchat.value) === 0 || inPrixAchat.getAttribute('data-is-auto') === 'true')) {
            inPrixAchat.value = total;
            inPrixAchat.setAttribute('data-is-auto', 'true');
          }
        }

        listEl.querySelectorAll('.recipe-ing-qte').forEach(input => {
          input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            state.recipeIngredients[idx].quantite_requise = parseFloat(e.target.value) || 0;
            renderRecipeList();
          });
        });
        listEl.querySelectorAll('.btn-del-recipe-ing').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            state.recipeIngredients.splice(idx, 1);
            renderRecipeList();
          });
        });
      };

      chkPrepared?.addEventListener('change', () => {
        const isPrepared = chkPrepared.checked;
        sectionRecipe.style.display = isPrepared ? 'block' : 'none';
        if (isPrepared) {
          if (inStock) { inStock.disabled = true; inStock.style.opacity = '0.5'; }
          if (inAlerte) { inAlerte.disabled = true; inAlerte.style.opacity = '0.5'; }
          renderRecipeList();
        } else {
          // Restaurer si illimité n'est pas coché
          const isIllimite = document.getElementById('pf-illimite').checked;
          if (inStock) { inStock.disabled = isIllimite; inStock.style.opacity = isIllimite ? '0.5' : '1'; }
          if (inAlerte) { inAlerte.disabled = isIllimite; inAlerte.style.opacity = isIllimite ? '0.5' : '1'; }
        }
      });

      document.getElementById('btn-add-recipe-ing')?.addEventListener('click', () => {
        const select = document.getElementById('recipe-ing-select');
        const uuid = select.value;
        if (!uuid) return;
        const ing = state.produits.find(p => p.uuid === uuid);
        if (ing) {
          if (state.recipeIngredients.find(x => x.ingredient_uuid === ing.uuid)) {
            Toast.warn('Déjà ajouté'); return;
          }
          state.recipeIngredients.push({
            ingredient_uuid: ing.uuid,
            nom: ing.nom,
            prix_achat: ing.prix_achat || 0,
            quantite_requise: 1
          });
          renderRecipeList();
        }
        select.value = '';
      });

      if (produit?.is_prepared) renderRecipeList();

      document.getElementById('btn-save-produit')?.addEventListener('click', async () => {
        const nom = document.getElementById('pf-nom').value.trim();
        if (!nom) { Toast.warn('Nom requis'); return; }
        let productImageValue = state.imageData || null;
        if (state.imagePendingDataUrl) {
          const up = await window.api.produits.uploadImage(
            state.imagePendingDataUrl,
            state.imageFileName || 'produit.png',
            produit?.uuid || null
          );
          if (!up.success) {
            Toast.error(up.message || 'Upload image produit impossible.');
            return;
          }
          productImageValue = up.url || null;
        }

        const data = {
          nom,
          prix_vente_ttc: parseFloat(document.getElementById('pf-prix')?.value) || 0,
          categorie_id: document.getElementById('pf-cat')?.value ? parseInt(document.getElementById('pf-cat').value) : null,
          fournisseur: document.getElementById('pf-fourn')?.value?.trim() || null,
          stock_actuel: document.getElementById('pf-illimite')?.checked ? -1 : (parseFloat(document.getElementById('pf-stock')?.value) || 0),
          stock_bar: document.getElementById('pf-illimite')?.checked ? -1 : (parseFloat(document.getElementById('pf-stock')?.value) || 0),
          stock_alerte: document.getElementById('pf-illimite')?.checked ? 0 : (parseFloat(document.getElementById('pf-alerte')?.value) || 0),
          description: document.getElementById('pf-desc')?.value?.trim() || null,
          image_data: productImageValue,
          
          unite_base: document.getElementById('pf-unit-d')?.value?.trim() || 'Unité',
          is_alcool: document.getElementById('pf-alcool')?.checked ? 1 : 0,
          is_ingredient: document.getElementById('pf-ingredient')?.checked ? 1 : 0,
          is_prepared: document.getElementById('pf-prepared')?.checked ? 1 : 0,
          ingredients: state.recipeIngredients,

          // Achat initial
          is_achat: !isEdit && document.getElementById('pf-achat')?.checked,
          prix_achat_val: parseFloat(document.getElementById('pf-prix-achat')?.value) || 0,
          prix_achat_type: 'unitaire'
        };
        let res;
        if (isEdit) {
          res = await window.api.produits.update(produit.uuid, data);
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
    } catch (err) {
      console.error("Erreur critique openProduitForm:", err);
      Toast.error("Impossible d'ouvrir le formulaire");
    }
  }

  function openAjustementForm() {
    if (!state.selectedProduit) { Toast.warn('Sélectionnez un produit'); return; }
    const p = state.selectedProduit;
    if (p.stock_actuel === -1) { Toast.warn('Stock illimité'); return; }
    const cur = p.stock_bar != null ? p.stock_bar : p.stock_actuel;
    Modal.open({
      title: 'Ajuster le stock bar',
      width: '420px',
      content: `
        <p style="opacity:0.85;margin-bottom:12px;font-size:13px">${Utils.esc(p.nom)} (Stock actuel: ${cur})</p>
        <div class="form-group">
          <label>Quantité à ajouter (+ ou -)</label>
          <input type="number" class="input" id="aj-stock-qty" value="0" step="0.5" />
        </div>
        
        <div style="display:flex; gap:12px; align-items:flex-end">
          <div class="form-group" style="flex:1">
            <label id="lbl-aj-stock-prix">Prix d'achat (Fixe)</label>
            <input type="number" class="input" id="aj-stock-prix" value="${p.prix_achat || 0}" step="0.01" readonly style="opacity:0.7" />
          </div>
        </div>
        <div style="font-size: 10px; opacity: 0.6; margin-top: -8px; margin-bottom: 15px">Le prix d'achat est celui défini dans la fiche produit.</div>
        
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; background:rgba(var(--accent-rgb), 0.1); padding:8px; border-radius:6px; border:1px solid var(--accent)">
          <input type="checkbox" id="aj-impact-capital" checked style="cursor:pointer" />
          <label for="aj-impact-capital" style="font-size:12px; margin:0; cursor:pointer; font-weight:bold; color:var(--accent-light)">Déduire le coût du capital (Dépense)</label>
        </div>

        <div class="form-group">
          <label>Motif</label>
          <input type="text" class="input" id="aj-stock-motif" placeholder="Inventaire, casse, achat…" />
        </div>`,
      footer: `
        <button class="btn btn-ghost" id="btn-cancel-aj">Annuler</button>
        <button class="btn btn-primary" id="aj-stock-go">Appliquer</button>`,
    });
    setTimeout(() => {
      document.getElementById('btn-cancel-aj')?.addEventListener('click', () => Modal.closeAll());
      document.getElementById('aj-stock-go')?.addEventListener('click', async () => {
        const q = parseFloat(document.getElementById('aj-stock-qty').value);
        if (Number.isNaN(q) || q === 0) { Toast.warn('Quantité invalide'); return; }
        const pu = parseFloat(document.getElementById('aj-stock-prix')?.value) || 0;
        const pType = 'unitaire';
        const impactCapital = document.getElementById('aj-impact-capital').checked;
        const motif = document.getElementById('aj-stock-motif').value.trim() || (q > 0 ? 'Ajustement positif' : 'Ajustement négatif');
        
        const currentUserStr = Session.getUser()?.nom || 'Admin';
        const res = await window.api.stock.ajustement(p.uuid, q, motif, currentUserStr, pu, pType, impactCapital);
        if (res.success) {
          Toast.success('Stock mis à jour');
          Modal.closeAll();
          await loadData();
        } else Toast.error(res.message || 'Erreur');
      });
    }, 50);
  }

  async function openVoirVentes() {
    if (!state.selectedProduit) { Toast.warn('Sélectionnez un produit'); return; }
    const p = state.selectedProduit;

    Modal.open({
      title: `📊 Ventes : ${p.nom}`,
      width: '500px',
      content: `
        <div class="sales-filters">
          <button class="btn btn-ghost btn-sm" id="sv-7d">7 derniers jours</button>
          <button class="btn btn-ghost btn-sm" id="sv-30d">30 derniers jours</button>
          <button class="btn btn-ghost btn-sm" id="sv-custom">Personnalisé</button>
        </div>
        
        <div id="sv-custom-range" class="custom-range" style="display:none">
          <div style="display:flex; flex-direction:column; gap:8px; width:100%">
            <div style="display:flex; align-items:center; gap:10px; justify-content:center">
              <label>Du</label>
              <input type="date" id="sv-start" class="input" style="width:130px" />
              <label>au</label>
              <input type="date" id="sv-end" class="input" style="width:130px" />
            </div>
            <button class="btn btn-primary btn-sm" id="sv-apply" style="width:100px; margin:0 auto">Appliquer</button>
          </div>
        </div>

        <div class="sales-stats-grid">
          <div class="sales-stat-item">
            <div class="sales-stat-label">Quantité vendue</div>
            <div class="sales-stat-value" id="sv-qty">0</div>
          </div>
          <div class="sales-stat-item">
            <div class="sales-stat-label">Chiffre d'affaires</div>
            <div class="sales-stat-value text-success" id="sv-amount">0 ${state.devise}</div>
          </div>
          <div class="sales-stat-item">
            <div class="sales-stat-label">Pertes (Qté)</div>
            <div class="sales-stat-value text-danger" id="sv-perte-qty">0</div>
          </div>
          <div class="sales-stat-item">
            <div class="sales-stat-label">Valeur Pertes</div>
            <div class="sales-stat-value text-danger" id="sv-perte-val">0 ${state.devise}</div>
          </div>
          <div class="sales-stat-item full" style="grid-column: span 2; background: rgba(var(--accent-rgb), 0.1); border-color: var(--accent)">
            <div class="sales-stat-label" style="opacity:1; color:var(--accent-light)">Bénéfice Net</div>
            <div class="sales-stat-value" id="sv-net" style="font-size:28px">0 ${state.devise}</div>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-ghost" id="btn-close-sales">Fermer</button>`
    });

    const updateStats = async (start, end) => {
      const stats = await window.api.ventes.getStatsByProduit({ produitId: p.uuid, start, end });
      const elQty = document.getElementById('sv-qty');
      const elAmt = document.getElementById('sv-amount');
      const elPQty = document.getElementById('sv-perte-qty');
      const elPVal = document.getElementById('sv-perte-val');
      const elNet = document.getElementById('sv-net');

      if (elQty) elQty.textContent = stats.total_qty;
      if (elAmt) elAmt.textContent = Utils.formatMontant(stats.total_amount, state.devise);
      if (elPQty) elPQty.textContent = stats.total_perte_qty;
      if (elPVal) elPVal.textContent = Utils.formatMontant(stats.total_perte_val, state.devise);
      if (elNet) elNet.textContent = Utils.formatMontant(stats.benefice_net, state.devise);
    };

    setTimeout(() => {
      document.getElementById('btn-close-sales')?.addEventListener('click', () => Modal.closeAll());

      document.getElementById('sv-7d')?.addEventListener('click', () => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        updateStats(d.toISOString().slice(0,10), null);
      });
      document.getElementById('sv-30d')?.addEventListener('click', () => {
        const d = new Date(); d.setDate(d.getDate() - 30);
        updateStats(d.toISOString().slice(0,10), null);
      });
      document.getElementById('sv-custom')?.addEventListener('click', () => {
        const r = document.getElementById('sv-custom-range');
        if (r) r.style.display = r.style.display === 'none' ? 'flex' : 'none';
      });
      document.getElementById('sv-apply')?.addEventListener('click', () => {
        const s = document.getElementById('sv-start').value;
        const e = document.getElementById('sv-end').value;
        updateStats(s ? s + ' 00:00:00' : null, e ? e + ' 23:59:59' : null);
      });

      // Init total (all time)
      updateStats(null, null);
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
      else Toast.warn('Sélectionnez un produit');
    });
    document.getElementById('btn-delete-produit')?.addEventListener('click', async () => {
      if (!state.selectedProduit) {
        Toast.warn('Sélectionnez un produit');
        return;
      }
      const ok = await new Promise(r => Modal.confirm('Désactiver ce produit', `Voulez-vous vraiment désactiver le produit « ${state.selectedProduit.nom} » ?`, r));
      if (ok) {
        await window.api.produits.delete(state.selectedProduit.uuid);
        Toast.success('Produit désactivé');
        state.selectedProduit = null;
        state.produits = await window.api.produits.getAll();
        renderTable();
      }
    });
    document.getElementById('btn-ajust-stock')?.addEventListener('click', openAjustementForm);
    document.getElementById('btn-voir-vente')?.addEventListener('click', openVoirVentes);
    document.getElementById('btn-alertes-stock')?.addEventListener('click', openAlertes);

    // TABS
    document.querySelectorAll('.stock-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.currentTab = tab.dataset.tab;
        render();
      });
    });

    document.getElementById('btn-add-cat')?.addEventListener('click', () => {
      Modal.open({
        title: 'Nouvelle catégorie',
        width: '400px',
        content: `
          <div class="form-group">
            <label>Nom de la catégorie *</label>
            <input type="text" class="input" id="cat-nom" />
          </div>
          <div class="form-group">
            <label>Catégorie Parente</label>
            <select class="input" id="cat-parent">
              <option value="">-- Aucune (catégorie principale) --</option>
              ${catOptionsHtml(null)}
            </select>
          </div>
        `,
        footer: `
          <button class="btn btn-ghost" id="btn-cancel-cat">Annuler</button>
          <button class="btn btn-success" id="btn-save-cat">Enregistrer</button>
        `
      });

      setTimeout(() => {
        document.getElementById('btn-cancel-cat')?.addEventListener('click', () => Modal.closeAll());
        document.getElementById('btn-save-cat')?.addEventListener('click', async () => {
          const nom = document.getElementById('cat-nom').value.trim();
          if (!nom) { Toast.warn('Nom requis'); return; }
          const pId = document.getElementById('cat-parent').value;
          const parent_id = pId ? parseInt(pId) : null;
          
          await window.api.categories.create({ nom, code: nom.toUpperCase().replace(/\s/g, '_'), parent_id });
          Modal.closeAll();
          state.categories = await window.api.categories.getAll();
          renderCats();
        });
      }, 50);
    });

    document.getElementById('btn-del-cat')?.addEventListener('click', async () => {
      if (!state.activeCatId) return;
      const cat = state.categories.find(c => c.id === state.activeCatId);
      if (!cat) return;
      const ok = await new Promise(r => Modal.confirm(
        'Supprimer la catégorie',
        `Supprimer la catégorie « ${cat.nom} » ? Les produits rattachés seront déplacés hors catégorie ; les sous-catégories seront détachées.`,
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

      // Notification dashboard → ouvrir alertes automatiquement
      if (window._stockScrollToAlertes) {
        window._stockScrollToAlertes = false;
        setTimeout(() => {
          const btn = document.getElementById('btn-alertes-stock');
          if (btn) btn.click();
        }, 400);
      }
    }
  });

})();
