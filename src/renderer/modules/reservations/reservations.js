'use strict';

(function ReservationsModule() {

  let state = {
    listFilter: 'all',
    markers: [],
  };

  function render() {
    const container = document.getElementById('view-reservations');
    if (!container) return;
    container.innerHTML = `
      <div class="module-topbar">
        <button class="back-btn" id="reserv-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Retour
        </button>
        <span class="module-topbar-title">Réservations & plan de salle</span>
        <div style="flex:1"></div>
        <button class="mod-action-btn" id="btn-new-reserv">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouvelle réservation
        </button>
      </div>

      <div class="module-body reserv-module-body">
        <div class="reserv-filters" id="reserv-tabs">
          <button class="reserv-filter-btn active" data-tab="liste">Liste</button>
          <button class="reserv-filter-btn" data-tab="plan">Plan de salle</button>
        </div>

        <div id="tab-liste" class="reserv-tab-panel">
          <div class="reserv-filters">
            <button class="reserv-filter-btn active" data-filter="all">Toutes</button>
            <button class="reserv-filter-btn" data-filter="en_attente">En attente</button>
            <button class="reserv-filter-btn" data-filter="confirmee">Confirmées</button>
            <button class="reserv-filter-btn" data-filter="annulee">Annulées</button>
          </div>
          <div class="reserv-list" id="reserv-list">
            <div class="empty-state">Chargement…</div>
          </div>
        </div>

        <div id="tab-plan" class="reserv-tab-panel" style="display:none">
          <p class="reserv-plan-hint">État des tables pour aujourd’hui : libre, réservée (réservation confirmée ou en attente), occupée (ticket ouvert en caisse).</p>
          <div class="reserv-plan-legend">
            <span><i class="dot dot-libre"></i> Libre</span>
            <span><i class="dot dot-reservee"></i> Réservée</span>
            <span><i class="dot dot-occupee"></i> Occupée</span>
          </div>
          <div id="table-plan-grid" class="reserv-plan-grid"></div>
        </div>
      </div>
    `;

    bindEvents();
    loadReservations(state.listFilter);
    loadPlanDeSalle();
  }

  function bindEvents() {
    document.getElementById('reserv-back')?.addEventListener('click', () => Router.go('dashboard'));
    document.getElementById('btn-new-reserv')?.addEventListener('click', showNewReservModal);

    document.querySelectorAll('#tab-liste .reserv-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tab-liste .reserv-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.listFilter = btn.dataset.filter;
        loadReservations(state.listFilter);
      });
    });

    document.querySelectorAll('#reserv-tabs .reserv-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#reserv-tabs .reserv-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('tab-liste').style.display = tab === 'liste' ? 'flex' : 'none';
        document.getElementById('tab-plan').style.display = tab === 'plan' ? 'flex' : 'none';
        if (tab === 'plan') loadPlanDeSalle();
      });
    });
  }

  async function loadPlanDeSalle() {
    const el = document.getElementById('table-plan-grid');
    if (!el) return;
    try {
      const [tables, markers] = await Promise.all([
        window.api.tables.getAll(),
        window.api.reservations.getTodayMarkers(),
      ]);
      state.markers = markers || [];

      const occupeNums = new Set(
        (tables || []).filter(t => t.ticket).map(t => t.numero)
      );
      const byTable = {};
      state.markers.forEach(m => {
        if (m.table_numero != null) {
          if (!byTable[m.table_numero]) byTable[m.table_numero] = [];
          byTable[m.table_numero].push(m);
        }
      });

      const cells = (tables || []).map(({ numero, ticket }) => {
        let etat = 'libre';
        if (byTable[numero]?.length) etat = 'reservee';

        const ms = byTable[numero] || [];
        const title = ms.length
          ? ms.map(m => `${Utils.esc(m.client_nom)} (${m.nb_personnes || '?'} pers.)`).join(' · ')
          : (etat === 'occupee' ? 'Ticket ouvert en caisse' : 'Table libre');

        return `
          <div class="plan-table plan-table--${etat}" data-num="${numero}" title="${title}">
            <span class="plan-table-num">${numero}</span>
            <span class="plan-table-label">${etat === 'libre' ? 'Libre' : etat === 'reservee' ? 'Réservée' : 'Occupée'}</span>
            ${ms.length ? `<span class="plan-table-guest">${Utils.esc(ms[0].client_nom)}</span>` : ''}
          </div>`;
      });

      el.innerHTML = cells.length
        ? cells.join('')
        : '<div class="empty-state">Aucune table configurée (paramétrez les tables depuis la caisse).</div>';
    } catch (e) {
      console.error(e);
      el.innerHTML = '<div class="empty-state">Impossible de charger le plan.</div>';
    }
  }

  async function loadReservations(filter) {
    const el = document.getElementById('reserv-list');
    if (!el) return;
    try {
      const list = await window.api.reservations.getAll(filter || 'all');
      renderList(list || []);
    } catch (e) {
      console.error(e);
      el.innerHTML = '<div class="empty-state">Erreur de chargement.</div>';
    }
  }

  function renderList(items) {
    const el = document.getElementById('reserv-list');
    if (!el) return;
    if (items.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucune réservation</div>';
      return;
    }
    const colors = { en_attente: '#f39c12', confirmee: '#27ae60', annulee: '#e74c3c' };
    const labels = { en_attente: 'En attente', confirmee: 'Confirmée', annulee: 'Annulée' };
    el.innerHTML = items.map(r => {
      let tables = [];
      try { tables = JSON.parse(r.tables_json || '[]'); } catch(e) {}
      if (!tables.length && r.table_numero) tables = [r.table_numero];
      
      const tablesTxt = tables.length ? ` · Table(s) ${tables.join(', ')}` : '';
      const dureeTxt = r.duree_heures ? ` · Durée: ${r.duree_heures}h` : '';

      return `
      <div class="reserv-card">
        <div class="reserv-card-status" style="background:${colors[r.statut] || '#888'}"></div>
        <div class="reserv-card-info">
          <div class="reserv-name">${Utils.esc(r.client_nom)}</div>
          <div class="reserv-meta">
            <span>${fmtDate(r.date_reservation)}</span>
            <span>· ${r.nb_personnes || 1} pers.</span>
            ${r.evenement ? `<span>· ${Utils.esc(r.evenement)}</span>` : ''}
            ${tablesTxt}
            ${dureeTxt}
          </div>
        </div>
        <div class="reserv-actions">
          <span class="reserv-badge" style="background:${colors[r.statut]}22; color:${colors[r.statut]}">${labels[r.statut] || r.statut}</span>
          ${(r.statut === 'en_attente' || r.statut === 'confirmee') ? `
            ${r.statut === 'en_attente' ? `<button class="btn-reserv-confirm" type="button" data-rid="${r.id}" data-act="confirmee">Confirmer</button>` : ''}
            <button class="btn-reserv-cancel" type="button" data-rid="${r.id}" data-act="annulee">Annuler</button>
          ` : ''}
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('[data-rid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.rid, 10);
        const act = btn.dataset.act;
        const res = await window.api.reservations.updateStatus(id, act);
        if (res.success) {
          Toast.success('Statut mis à jour');
          await loadReservations(state.listFilter);
          loadPlanDeSalle();
        } else Toast.error(res.message || 'Erreur');
      });
    });
  }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return Utils.esc(String(iso));
      return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return Utils.esc(String(iso));
    }
  }

  async function showNewReservModal() {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const defVal = today.toISOString().slice(0, 16);

    const tables = await window.api.tables.getAll();
    const tableChips = (tables || []).map(t => {
      return `<div class="reserv-table-chip" data-num="${t.numero}">${t.numero}</div>`;
    }).join('');

    const modalId = Modal.open({
      title: 'Nouvelle réservation',
      width: '500px',
      content: `
        <div class="form-group">
          <label>Client *</label>
          <input type="text" class="input" id="r-nom" placeholder="Nom du client" />
        </div>
        <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:12px">
          <div class="form-group">
            <label>Date & heure *</label>
            <input type="datetime-local" class="input" id="r-date" value="${defVal}" />
          </div>
          <div class="form-group">
            <label>Nombre de personnes</label>
            <input type="number" class="input" id="r-pers" value="2" min="1" />
          </div>
        </div>
        
        <div class="form-group">
          <label>Tables (cliquez pour sélectionner)</label>
          <div id="r-tables-grid" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:6px">
            ${tableChips}
          </div>
          <p style="font-size:11px; opacity:0.6; margin-top:6px">Sélectionnez une ou plusieurs tables pour cette réservation.</p>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
          <div class="form-group">
            <label>Durée prévue (heures)</label>
            <input type="number" class="input" id="r-duree" placeholder="Ex: 2" min="1" step="0.5" />
          </div>
          <div class="form-group">
            <label>Événement</label>
            <input type="text" class="input" id="r-event" placeholder="Anniversaire, groupe…" />
          </div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" id="btn-cancel-reserv">Annuler</button>
        <button class="btn btn-success" id="r-save">Enregistrer</button>`,
    });

    setTimeout(() => {
      document.getElementById('btn-cancel-reserv')?.addEventListener('click', () => Modal.closeAll());
      let selectedTables = [];
      document.querySelectorAll('.reserv-table-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const n = parseInt(chip.dataset.num, 10);
          if (chip.classList.contains('selected')) {
            chip.classList.remove('selected');
            selectedTables = selectedTables.filter(x => x !== n);
          } else {
            chip.classList.add('selected');
            selectedTables.push(n);
          }
        });
      });

      document.getElementById('r-save')?.addEventListener('click', async () => {
        const nom = document.getElementById('r-nom')?.value?.trim();
        const date = document.getElementById('r-date')?.value;
        if (!nom || !date) {
          Toast.warn('Nom et date obligatoires');
          return;
        }

        const res = await window.api.reservations.create({
          client_nom: nom,
          date_reservation: date,
          nb_personnes: parseInt(document.getElementById('r-pers')?.value || '2', 10) || 1,
          tables: selectedTables,
          duree_heures: parseFloat(document.getElementById('r-duree')?.value) || null,
          evenement: document.getElementById('r-event')?.value?.trim() || null,
        });
        if (res.success) {
          Toast.success('Réservation enregistrée');
          Modal.close(modalId);
          await loadReservations(state.listFilter);
          loadPlanDeSalle();
        } else Toast.error(res.message || 'Erreur');
      });
    }, 30);
  }

  async function updateStatus(id, status) {
    const res = await window.api.reservations.updateStatus(id, status);
    if (res.success) {
      Toast.success('Mis à jour');
      await loadReservations(state.listFilter);
      loadPlanDeSalle();
    } else Toast.error(res.message || 'Erreur');
  }

  window.ReservationsModule = { updateStatus };

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'reservations') {
      if (!document.querySelector('.reserv-module-body')) render();
      else {
        loadReservations(state.listFilter);
        loadPlanDeSalle();
      }
    }
  });
})();
