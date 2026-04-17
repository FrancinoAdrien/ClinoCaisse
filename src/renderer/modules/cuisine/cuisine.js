'use strict';

(function CuisineModule() {
  let filterText = '';

  function normalizeStatut(s) {
    const v = (s || '').trim();
    if (['en_attente', 'en_preparation', 'pret', 'servi'].includes(v)) return v;
    return 'en_attente';
  }

  function render() {
    const container = document.getElementById('view-cuisine');
    if (!container) return;
    container.innerHTML = `
      <div class="module-topbar">
        <button class="back-btn" id="cuisine-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Retour
        </button>
        <span class="module-topbar-title">Cuisine & bar</span>
        <div class="cuisine-filter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="cuisine-search" placeholder="Filtrer par table ou nom..." value="${filterText}" />
        </div>
        <div style="flex:1"></div>
        <div class="cuisine-legend">
          <span class="legend-dot" style="background:#e74c3c"></span> En attente
          <span class="legend-dot" style="background:#f39c12;margin-left:12px"></span> En préparation
          <span class="legend-dot" style="background:#27ae60;margin-left:12px"></span> Prêt
        </div>
      </div>

      <div class="module-body">
        <p class="cuisine-hint">Les lignes des ventes au comptoir avec <strong>table</strong> arrivent ici en « En attente ». Passez-les en préparation, puis prêt, puis servi.</p>
        <div class="cuisine-columns">
          <div class="cuisine-col">
            <div class="cuisine-col-header en-attente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              En attente (<span id="count-attente">0</span>)
            </div>
            <div class="cuisine-orders" id="orders-en_attente">
              <div class="empty-state">Chargement…</div>
            </div>
          </div>
          <div class="cuisine-col">
            <div class="cuisine-col-header en-preparation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>
              En préparation (<span id="count-preparation">0</span>)
            </div>
            <div class="cuisine-orders" id="orders-en_preparation">
              <div class="empty-state">—</div>
            </div>
          </div>
          <div class="cuisine-col">
            <div class="cuisine-col-header pret">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Prêt à servir (<span id="count-pret">0</span>)
            </div>
            <div class="cuisine-orders" id="orders-pret">
              <div class="empty-state">—</div>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    loadOrders();
    if (window._cuisineRefresh) clearInterval(window._cuisineRefresh);
    window._cuisineRefresh = setInterval(() => {
      const v = document.getElementById('view-cuisine');
      if (v?.classList.contains('active')) loadOrders();
      else {
        clearInterval(window._cuisineRefresh);
        window._cuisineRefresh = null;
      }
    }, 12000);
  }

  function bindEvents() {
    document.getElementById('cuisine-back')?.addEventListener('click', () => {
      if (window._cuisineRefresh) clearInterval(window._cuisineRefresh);
      window._cuisineRefresh = null;
      Router.go('dashboard');
    });

    const searchInput = document.getElementById('cuisine-search');
    searchInput?.addEventListener('input', (e) => {
      filterText = e.target.value.toLowerCase().trim();
      loadOrders();
    });
  }

  async function loadOrders() {
    try {
      let lignes = await window.api.cuisine.getLignes() || [];
      
      if (filterText) {
        lignes = lignes.filter(l => {
          const searchIn = [
             l.produit_nom,
             l.numero_ticket,
             l.note,
             l.table_numero != null ? 'table ' + l.table_numero : ''
          ].join(' ').toLowerCase();
          return searchIn.includes(filterText);
        });
      }

      const groups = { en_attente: [], en_preparation: [], pret: [] };
      lignes.forEach(l => {
        const st = normalizeStatut(l.statut_cuisine);
        if (groups[st]) groups[st].push({ ...l, statut_cuisine: st });
      });

      renderOrders('orders-en_attente', groups.en_attente, 'en_attente');
      renderOrders('orders-en_preparation', groups.en_preparation, 'en_preparation');
      renderOrders('orders-pret', groups.pret, 'pret');

      const ca = document.getElementById('count-attente');
      const cp = document.getElementById('count-preparation');
      const cr = document.getElementById('count-pret');
      if (ca) ca.textContent = groups.en_attente.length;
      if (cp) cp.textContent = groups.en_preparation.length;
      if (cr) cr.textContent = groups.pret.length;
    } catch (e) {
      console.error('Erreur cuisine:', e);
    }
  }

  function renderOrders(containerId, lignes, currentStatus) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (lignes.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucune commande</div>';
      return;
    }

    const nextStatus = { en_attente: 'en_preparation', en_preparation: 'pret', pret: 'servi' };
    const nextLabel = { en_attente: 'Préparer', en_preparation: 'Marquer prêt', pret: 'Servi' };

    el.innerHTML = lignes.map(l => {
      const tableBase = l.table_numero != null ? `Table ${l.table_numero}` : '';
      const orderName = l.note || (l.is_table_active ? l.numero_ticket : null) || '';
      
      let labelStr = '';
      if (tableBase) {
        labelStr = (orderName && orderName !== tableBase) ? `${tableBase} (${orderName})` : tableBase;
      } else {
        labelStr = orderName || `Ticket #${l.numero_ticket}` || 'Direct';
      }
      
      const ns = nextStatus[currentStatus];
      return `
      <div class="cuisine-card${l.is_table_active ? ' table-active-order' : ''}">
        <div class="cuisine-card-header">
          <span class="cuisine-table">${Utils.esc(labelStr)}</span>
          <span class="cuisine-qty">${l.quantite}×</span>
        </div>
        <div class="cuisine-item">${Utils.esc(l.produit_nom)}</div>
        <button type="button" class="cuisine-action-btn" data-lid="${l.id}" data-next="${ns}">
          ${nextLabel[currentStatus]} →
        </button>
      </div>`;
    }).join('');

    el.querySelectorAll('.cuisine-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.lid;
        const next = btn.dataset.next;
        advance(id, next);
      });
    });
  }

  async function advance(ligneId, newStatus) {
    try {
      const res = await window.api.cuisine.setStatut(ligneId, newStatus);
      if (res.success) {
        if (newStatus === 'servi') Toast.success('Ligne marquée servie');
        await loadOrders();
      } else Toast.error(res.message || 'Mise à jour impossible');
    } catch (e) {
      Toast.error(e.message || 'Erreur');
    }
  }

  window.CuisineModule = { advance };

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'cuisine') {
      if (!document.querySelector('.cuisine-hint')) render();
      else loadOrders();
    }
  });
})();
