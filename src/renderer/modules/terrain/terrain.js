'use strict';

(function TerrainModule() {

  // ── STATE ─────────────────────────────────────────────────────────────────
  let currentTab = 'reservations';
  let currentFilter = { statut: 'all', statut_paiement: 'all', espace_id: '', date_debut: '', date_fin: '' };
  let espaces = [];
  let reservations = [];
  let calMois = new Date();
  let editingEspaceId = null;

  const ESPACE_ICONS = {
    terrain: '🏟️',
    local:   '🏢',
    salle:   '🏛️',
    maison:  '🏠',
    autre:   '📦'
  };
  const ESPACE_LABELS = {
    terrain: 'Terrain',
    local:   'Local',
    salle:   'Salle',
    maison:  'Maison',
    autre:   'Autre'
  };

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  function render() {
    const container = document.getElementById('view-terrain');
    container.innerHTML = `
      <!-- TOPBAR -->
      <div id="terrain-topbar">
        <div class="terrain-topbar-logo">
          <div class="terrain-logo-icon">🏟️</div>
          <div>
            <div style="font-size:18px;font-weight:800;color:var(--text)">Réservation d'Espaces</div>
            <div style="font-size:11px;opacity:0.5;font-weight:400;color:var(--text)">Terrain · Local · Salle · Maison</div>
          </div>
        </div>

        <div class="flex-spacer"></div>

        <div class="topbar-actions">
          <button class="btn-topbar-back" id="terrain-btn-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Dashboard
          </button>
          <button class="btn-nouvelle-resa" id="terrain-btn-new">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nouvelle réservation
          </button>
        </div>
      </div>

      <!-- ONGLETS -->
      <div id="terrain-tabs">
        <button class="terrain-tab active" id="tab-reservations" data-tab="reservations">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Réservations
        </button>
        <button class="terrain-tab" id="tab-calendrier" data-tab="calendrier">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>
          Calendrier
        </button>
        <button class="terrain-tab" id="tab-espaces" data-tab="espaces">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Espaces
        </button>
        <button class="terrain-tab" id="tab-stats" data-tab="stats">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Statistiques
        </button>
      </div>

      <!-- CONTENU -->
      <div id="terrain-content">
        <div id="terrain-tab-content">
          <!-- Injecté dynamiquement -->
        </div>
      </div>
    `;

    bindTopbarEvents();
    switchTab('reservations');
    loadEspaces();
  }

  // ── NAVIGATION TABS ───────────────────────────────────────────────────────
  function bindTopbarEvents() {
    document.getElementById('terrain-btn-back').addEventListener('click', () => Router.go('dashboard'));
    document.getElementById('terrain-btn-new').addEventListener('click', () => openFormReservation());

    document.querySelectorAll('.terrain-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.terrain-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const content = document.getElementById('terrain-tab-content');
    if (!content) return;

    switch (tab) {
      case 'reservations': renderTabReservations(content); break;
      case 'calendrier':   renderTabCalendrier(content);   break;
      case 'espaces':      renderTabEspaces(content);      break;
      case 'stats':        renderTabStats(content);        break;
    }
  }

  // ── CHARGEMENT DONNÉES ────────────────────────────────────────────────────
  async function loadEspaces() {
    try {
      espaces = await window.api.terrain.getAllEspaces();
    } catch (e) { espaces = []; }
  }

  async function loadReservations() {
    try {
      reservations = await window.api.terrain.getReservations(currentFilter);
    } catch (e) { reservations = []; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ONGLET RÉSERVATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  async function renderTabReservations(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.4;color:var(--text)">Chargement…</div>';
    await loadEspaces();
    await loadReservations();

    const devise = localStorage.getItem('cc_devise') || 'Ar';

    container.innerHTML = `
      <!-- Filtres -->
      <div class="terrain-filters">
        <select class="terrain-filter-select" id="filter-statut">
          <option value="all">Tous les statuts</option>
          <option value="confirmee">Confirmées</option>
          <option value="annulee">Annulées</option>
        </select>
        <select class="terrain-filter-select" id="filter-paiement">
          <option value="all">Tout paiement</option>
          <option value="en_attente">Non payé</option>
          <option value="partiel">Partiel</option>
          <option value="complet">Complet</option>
        </select>
        <select class="terrain-filter-select" id="filter-espace">
          <option value="">Tous les espaces</option>
          ${espaces.map(e => `<option value="${e.id}">${e.nom}</option>`).join('')}
        </select>
        <input type="date" class="terrain-filter-input" id="filter-date-debut" placeholder="Du…" value="${currentFilter.date_debut || ''}">
        <input type="date" class="terrain-filter-input" id="filter-date-fin" placeholder="Au…" value="${currentFilter.date_fin || ''}">
        <button class="btn-resa-action" id="btn-filter-reset" style="border-color:rgba(231,76,60,0.3);color:#e74c3c;">Réinitialiser</button>
      </div>

      <!-- Liste -->
      <div class="terrain-reservations-list" id="terrain-resa-list">
        ${renderResaList(reservations, devise)}
      </div>
    `;

    // Remettre valeurs filtres
    document.getElementById('filter-statut').value         = currentFilter.statut || 'all';
    document.getElementById('filter-paiement').value       = currentFilter.statut_paiement || 'all';
    document.getElementById('filter-espace').value         = currentFilter.espace_id || '';
    document.getElementById('filter-date-debut').value     = currentFilter.date_debut || '';
    document.getElementById('filter-date-fin').value       = currentFilter.date_fin || '';

    // Events filtres
    ['filter-statut', 'filter-paiement', 'filter-espace', 'filter-date-debut', 'filter-date-fin'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', async () => applyFilters());
    });
    document.getElementById('btn-filter-reset')?.addEventListener('click', () => {
      currentFilter = { statut: 'all', statut_paiement: 'all', espace_id: '', date_debut: '', date_fin: '' };
      renderTabReservations(document.getElementById('terrain-tab-content'));
    });

    bindResaCardEvents();
  }

  function renderResaList(list, devise) {
    if (!list.length) {
      return `<div class="terrain-empty"><div class="empty-icon">📋</div><p>Aucune réservation trouvée</p></div>`;
    }
    return list.map(r => {
      const icon = ESPACE_ICONS[r.espace_type] || '🏟️';
      const solde = r.montant_total - r.montant_paye;
      const debut = formatDatetime(r.date_debut);
      const fin   = formatDatetime(r.date_fin);
      const annulee = r.statut === 'annulee';

      const actionsHTML = annulee ? '' : `
        ${r.statut_paiement !== 'complet' && r.montant_total > 0 ? `<button class="btn-resa-action btn-payer" data-id="${r.id}" data-action="payer">💰 Payer</button>` : ''}
        <button class="btn-resa-action btn-decaler" data-id="${r.id}" data-action="decaler">📅 Décaler</button>
        <button class="btn-resa-action btn-annuler" data-id="${r.id}" data-action="annuler">✕ Annuler</button>
      `;

      return `
        <div class="terrain-resa-card statut-${r.statut}" data-id="${r.id}">
          <div class="terrain-resa-space-icon">${icon}</div>
          <div class="terrain-resa-info">
            <div class="terrain-resa-client">${escapeHtml(r.client_nom)}${r.client_contact ? ` · ${escapeHtml(r.client_contact)}` : ''}</div>
            <div class="terrain-resa-espace">${r.espace_nom ? escapeHtml(r.espace_nom) : '<em>Espace non spécifié</em>'}</div>
            <div class="terrain-resa-datetime">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${debut} → ${fin}
            </div>
            ${r.note ? `<div class="terrain-resa-datetime" style="font-style:italic">${escapeHtml(r.note)}</div>` : ''}
          </div>

          <div class="terrain-resa-paiement">
            <span class="badge badge-${r.statut_paiement}">${labelPaiement(r.statut_paiement)}</span>
            ${annulee ? `<span class="badge badge-annulee">Annulée</span>` : ''}
            ${r.montant_total > 0 ? `
              <div class="terrain-resa-montant">
                <span class="montant-paye">${fmtMoney(r.montant_paye, devise)}</span>
                <span class="montant-sep">/</span>
                <span class="montant-total">${fmtMoney(r.montant_total, devise)}</span>
              </div>
              ${solde > 0 && !annulee ? `<div style="font-size:11px;color:#e74c3c;">Solde: ${fmtMoney(solde, devise)}</div>` : ''}
            ` : ''}
          </div>

          <div class="terrain-resa-actions">
            ${actionsHTML}
          </div>
        </div>
      `;
    }).join('');
  }

  function bindResaCardEvents() {
    document.querySelectorAll('.btn-resa-action[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const action = btn.dataset.action;
        const resa = reservations.find(r => r.id === id);
        if (!resa) return;

        if (action === 'payer')   openPayerSolde(resa);
        if (action === 'decaler') openDecaler(resa);
        if (action === 'annuler') openAnnuler(resa);
      });
    });
  }

  async function applyFilters() {
    currentFilter = {
      statut:          document.getElementById('filter-statut')?.value || 'all',
      statut_paiement: document.getElementById('filter-paiement')?.value || 'all',
      espace_id:       document.getElementById('filter-espace')?.value || '',
      date_debut:      document.getElementById('filter-date-debut')?.value || '',
      date_fin:        document.getElementById('filter-date-fin')?.value || '',
    };
    await loadReservations();
    const devise = localStorage.getItem('cc_devise') || 'Ar';
    const list = document.getElementById('terrain-resa-list');
    if (list) {
      list.innerHTML = renderResaList(reservations, devise);
      bindResaCardEvents();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ONGLET CALENDRIER
  // ═══════════════════════════════════════════════════════════════════════════
  async function renderTabCalendrier(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.4;color:var(--text)">Chargement…</div>';

    const moisStr = `${calMois.getFullYear()}-${String(calMois.getMonth() + 1).padStart(2, '0')}`;
    let resasMois = [];
    try {
      resasMois = await window.api.terrain.getReservationsCalendrier(moisStr);
    } catch (e) { resasMois = []; }

    // Construire le calendrier
    const moisLabel = calMois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const year = calMois.getFullYear();
    const month = calMois.getMonth();
    const premierJour = new Date(year, month, 1);
    const dernierJour = new Date(year, month + 1, 0);

    // Lundi = 0
    let startDay = premierJour.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    // Grouper réservations par jour
    const resaByDay = {};
    resasMois.forEach(r => {
      const day = r.date_debut.slice(0, 10);
      if (!resaByDay[day]) resaByDay[day] = [];
      resaByDay[day].push(r);
    });

    let cellsHTML = '';
    // Cellules vides avant le 1er du mois
    for (let i = 0; i < startDay; i++) {
      cellsHTML += `<div class="cal-day other-month"></div>`;
    }
    // Jours du mois
    const today = new Date().toISOString().slice(0, 10);
    for (let d = 1; d <= dernierJour.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const resas = resaByDay[dateStr] || [];
      const pillsHTML = resas.slice(0, 3).map(r => {
        const typeClass = `type-${r.espace_type || 'terrain'}`;
        const heure = r.date_debut.length > 10 ? r.date_debut.slice(11, 16) : '';
        return `<span class="cal-resa-pill ${typeClass}" title="${escapeHtml(r.client_nom)}">${heure ? heure + ' ' : ''}${escapeHtml(r.client_nom)}</span>`;
      }).join('');
      const more = resas.length > 3 ? `<span style="font-size:10px;opacity:0.5;padding:2px 4px">+${resas.length - 3} autres</span>` : '';

      cellsHTML += `
        <div class="cal-day${isToday ? ' today' : ''}">
          <div class="cal-day-num">${d}</div>
          ${pillsHTML}${more}
        </div>`;
    }
    // Compléter à la fin
    const totalCells = startDay + dernierJour.getDate();
    const remaining = totalCells % 7 !== 0 ? 7 - (totalCells % 7) : 0;
    for (let i = 0; i < remaining; i++) {
      cellsHTML += `<div class="cal-day other-month"></div>`;
    }

    container.innerHTML = `
      <div class="terrain-calendrier-header">
        <div class="terrain-cal-nav">
          <button class="btn-cal-nav" id="cal-prev">&#8249;</button>
          <div class="cal-mois-label">${moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1)}</div>
          <button class="btn-cal-nav" id="cal-next">&#8250;</button>
        </div>
        <div style="font-size:12px;opacity:0.5;color:var(--text)">${resasMois.length} réservation(s)</div>
      </div>
      <div class="terrain-cal-grid">
        ${days.map(d => `<div class="cal-day-header">${d}</div>`).join('')}
        ${cellsHTML}
      </div>
    `;

    document.getElementById('cal-prev')?.addEventListener('click', () => {
      calMois.setMonth(calMois.getMonth() - 1);
      renderTabCalendrier(document.getElementById('terrain-tab-content'));
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      calMois.setMonth(calMois.getMonth() + 1);
      renderTabCalendrier(document.getElementById('terrain-tab-content'));
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ONGLET ESPACES
  // ═══════════════════════════════════════════════════════════════════════════
  async function renderTabEspaces(container) {
    await loadEspaces();
    container.innerHTML = `
      <div class="terrain-espaces-header">
        <div>
          <div style="font-size:18px;font-weight:700;color:var(--text)">Gestion des Espaces</div>
          <div style="font-size:12px;opacity:0.5;color:var(--text);margin-top:3px">${espaces.length} espace(s) enregistré(s)</div>
        </div>
        <button class="btn-ajouter-espace" id="btn-ajouter-espace">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter un espace
        </button>
      </div>
      <div class="terrain-espaces-grid" id="espaces-grid">
        ${renderEspacesGrid()}
      </div>
    `;

    document.getElementById('btn-ajouter-espace')?.addEventListener('click', () => openFormEspace(null));
    bindEspaceCardEvents();
  }

  function renderEspacesGrid() {
    if (!espaces.length) {
      return `<div class="terrain-empty"><div class="empty-icon">🏟️</div><p>Aucun espace enregistré</p></div>`;
    }
    const devise = localStorage.getItem('cc_devise') || 'Ar';
    return espaces.map(e => `
      <div class="terrain-espace-card${e.actif ? '' : ' inactif'}">
        <div class="espace-card-header">
          <div class="espace-type-icon">${ESPACE_ICONS[e.type] || '🏟️'}</div>
          <div>
            <div class="espace-nom">${escapeHtml(e.nom)}</div>
            <span class="espace-type-badge">${ESPACE_LABELS[e.type] || e.type}</span>
          </div>
        </div>
        ${e.description ? `<div class="espace-description">${escapeHtml(e.description)}</div>` : ''}
        <div class="espace-tarif">${e.tarif_heure > 0 ? fmtMoney(e.tarif_heure, devise) + '/h' : 'Tarif libre'}</div>
        <div class="espace-actions">
          <button class="btn-espace-edit" data-id="${e.id || ''}" data-uuid="${e.uuid || ''}">✏️ Modifier</button>
          <button class="btn-espace-delete" data-id="${e.id || ''}" data-uuid="${e.uuid || ''}">🗑 Supprimer</button>
        </div>
      </div>
    `).join('');
  }

  function findEspaceByAnyIdentifier(idOrUuid) {
    const key = String(idOrUuid || '').trim();
    if (!key) return null;
    return espaces.find(e => String(e.id) === key || String(e.uuid) === key) || null;
  }

  function bindEspaceCardEvents() {
    document.querySelectorAll('.btn-espace-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const rawId = btn.dataset.id || btn.dataset.uuid;
        const espace = findEspaceByAnyIdentifier(rawId);
        if (espace) openFormEspace(espace);
      });
    });
    document.querySelectorAll('.btn-espace-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const rawId = btn.dataset.id || btn.dataset.uuid;
        const espace = findEspaceByAnyIdentifier(rawId);
        if (!espace) return;
        Modal.confirm('Désactiver l\'espace', `Désactiver l'espace "${espace.nom}" ? (Les réservations existantes sont conservées)`, async (ok) => {
          if (!ok) return;
          const res = await window.api.terrain.deleteEspace(espace.id || espace.uuid);
          if (res.success) {
            Toast.success('Espace désactivé');
            await loadEspaces();
            const grid = document.getElementById('espaces-grid');
            if (grid) { grid.innerHTML = renderEspacesGrid(); bindEspaceCardEvents(); }
          } else {
            Toast.error(res.message || 'Erreur');
          }
        });
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ONGLET STATISTIQUES
  // ═══════════════════════════════════════════════════════════════════════════
  async function renderTabStats(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.4;color:var(--text)">Chargement…</div>';
    let stats = {};
    try {
      stats = await window.api.terrain.getStats();
    } catch (e) { stats = {}; }

    const devise = localStorage.getItem('cc_devise') || 'Ar';

    container.innerHTML = `
      <div class="terrain-stats-grid">
        <div class="terrain-stat-card stat-ca">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${fmtMoney(stats.ca_mois || 0, devise)}</div>
          <div class="stat-label">CA encaissé ce mois</div>
        </div>
        <div class="terrain-stat-card stat-actives">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${stats.reservations_actives || 0}</div>
          <div class="stat-label">Réservations actives</div>
        </div>
        <div class="terrain-stat-card stat-attente">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${stats.paiements_en_attente || 0}</div>
          <div class="stat-label">Paiements en attente</div>
        </div>
        <div class="terrain-stat-card stat-solde">
          <div class="stat-icon">📋</div>
          <div class="stat-value">${fmtMoney(stats.soldes_dus || 0, devise)}</div>
          <div class="stat-label">Soldes dus</div>
        </div>
        <div class="terrain-stat-card stat-espaces">
          <div class="stat-icon">🏟️</div>
          <div class="stat-value">${stats.nb_espaces || 0}</div>
          <div class="stat-label">Espaces actifs</div>
        </div>
      </div>

      ${stats.prochaines_reservations && stats.prochaines_reservations.length ? `
        <div class="terrain-prochaines-section">
          <h3>📅 Prochaines réservations</h3>
          ${stats.prochaines_reservations.map(r => {
            const d = new Date(r.date_debut);
            return `
              <div class="prochaine-resa-item">
                <div class="prochaine-date-badge">
                  <span class="date-day">${d.getDate()}</span>
                  <span class="date-mon">${d.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                </div>
                <div class="prochaine-resa-details">
                  <div class="prochaine-resa-client">${escapeHtml(r.client_nom)}</div>
                  <div class="prochaine-resa-meta">${r.espace_nom || 'Espace'} · ${formatDatetime(r.date_debut)} → ${formatTime(r.date_fin)}</div>
                </div>
                <span class="badge badge-${r.statut_paiement}">${labelPaiement(r.statut_paiement)}</span>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL CRÉER/ÉDITER RÉSERVATION
  // ═══════════════════════════════════════════════════════════════════════════
  function openFormReservation() {
    const user = Session.getUser();
    const devise = localStorage.getItem('cc_devise') || 'Ar';
    const now = new Date();
    const defaultDebut = toLocalISOString(now).slice(0, 16);
    now.setHours(now.getHours() + 2);
    const defaultFin = toLocalISOString(now).slice(0, 16);

    const modal = createModal('modal-nouvelle-resa', `
      <div class="modal-header">
        <span class="modal-icon">🏟️</span>
        <h2>Nouvelle Réservation</h2>
        <button class="btn-modal-close" id="resa-modal-close">✕</button>
      </div>
      <div class="modal-body">
        <!-- Client -->
        <div class="form-row two-col">
          <div class="form-group">
            <label>Nom du client *</label>
            <input class="form-control" id="resa-client-nom" type="text" placeholder="Ex: Jean Dupont">
          </div>
          <div class="form-group">
            <label>Contact (téléphone)</label>
            <input class="form-control" id="resa-client-contact" type="text" placeholder="034 XX XX XX">
          </div>
        </div>

        <!-- Espace -->
        <div class="form-group">
          <label>Espace *</label>
          <select class="form-control" id="resa-espace">
            <option value="">— Sélectionner un espace —</option>
            ${espaces.filter(e => e.actif).map(e => `<option value="${e.id}" data-tarif="${e.tarif_heure}" data-typetarif="${e.type_tarif || 'heure'}">${ESPACE_ICONS[e.type] || '🏟️'} ${escapeHtml(e.nom)} (${ESPACE_LABELS[e.type] || e.type})</option>`).join('')}
          </select>
        </div>

        <!-- Dates -->
        <div class="form-row two-col">
          <div class="form-group">
            <label>Début *</label>
            <input class="form-control" id="resa-debut" type="datetime-local" value="${defaultDebut}">
          </div>
          <div class="form-group">
            <label>Fin *</label>
            <input class="form-control" id="resa-fin" type="datetime-local" value="${defaultFin}">
          </div>
        </div>

        <!-- Montant total -->
        <div class="form-row two-col">
          <div class="form-group">
            <label>Montant total (${devise})</label>
            <input class="form-control" id="resa-montant-total" type="number" min="0" step="100" placeholder="0" value="0">
          </div>
          <div class="form-group">
            <label>Durée estimée</label>
            <input class="form-control" id="resa-duree" type="text" placeholder="Calculée auto" readonly style="opacity:0.5">
          </div>
        </div>

        <!-- Mode paiement -->
        <div class="form-group">
          <label>Mode de paiement</label>
          <div class="paiement-options">
            <button class="paiement-opt selected" data-mode="immediat" id="opt-immediat">
              <span class="opt-icon">💳</span>
              Payé de suite
            </button>
            <button class="paiement-opt" data-mode="partiel" id="opt-partiel">
              <span class="opt-icon">⚖️</span>
              Partiel (acompte)
            </button>
            <button class="paiement-opt" data-mode="attente" id="opt-attente">
              <span class="opt-icon">⏳</span>
              Non payé
            </button>
          </div>
        </div>

        <!-- Montant payé (dynamique) -->
        <div id="acompte-section">
          <div class="form-group">
            <label id="resa-paye-label">Montant payé maintenant (${devise})</label>
            <input class="form-control" id="resa-montant-paye" type="number" min="0" step="100" placeholder="0" value="0">
          </div>
        </div>

        <!-- Récapitulatif -->
        <div class="paiement-recap" id="resa-recap">
          <div class="recap-row"><span class="recap-label">Total</span><span class="recap-value" id="recap-total">0 ${devise}</span></div>
          <div class="recap-row"><span class="recap-label">Payé</span><span class="recap-value ok" id="recap-paye">0 ${devise}</span></div>
          <div class="recap-row"><span class="recap-label">Solde restant</span><span class="recap-value solde" id="recap-solde">0 ${devise}</span></div>
        </div>

        <!-- Note -->
        <div class="form-group">
          <label>Note</label>
          <input class="form-control" id="resa-note" type="text" placeholder="Événement, remarque…">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-cancel" id="resa-modal-cancel">Annuler</button>
        <button class="btn-modal-confirm" id="resa-modal-submit">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Confirmer la réservation
        </button>
      </div>
    `);

    // Events modal
    document.getElementById('resa-modal-close')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('resa-modal-cancel')?.addEventListener('click', () => closeModal(modal));

    // Calcul durée et tarif auto
    const updateDuree = () => {
      const debut = document.getElementById('resa-debut')?.value;
      const fin   = document.getElementById('resa-fin')?.value;
      if (!debut || !fin) return;
      const diff = (new Date(fin) - new Date(debut)) / 3600000;
      const dureeEl = document.getElementById('resa-duree');
      if (dureeEl) {
        if (diff > 0) dureeEl.value = `${diff.toFixed(1)}h`;
        else dureeEl.value = 'Invalide';
      }
      // Remplir tarif si espace sélectionné
      const espaceSel = document.getElementById('resa-espace');
      const opt = espaceSel?.options[espaceSel.selectedIndex];
      const tarif = parseFloat(opt?.dataset.tarif || '0');
      let manuallyEdited = document.getElementById('resa-montant-total').dataset.edited === 'true';

      if (tarif > 0 && diff > 0 && !manuallyEdited) {
        const totalEl = document.getElementById('resa-montant-total');
        if (totalEl) {
          const typeTarif = opt?.dataset.typetarif || 'heure';
          totalEl.value = typeTarif === 'fixe' ? tarif : Math.round(tarif * diff);
        }
      }
      updateRecap();
    };

    document.getElementById('resa-debut')?.addEventListener('change', updateDuree);
    document.getElementById('resa-fin')?.addEventListener('change', updateDuree);
    document.getElementById('resa-espace')?.addEventListener('change', updateDuree);
    document.getElementById('resa-montant-total')?.addEventListener('input', (e) => {
      e.target.dataset.edited = 'true';
      updateRecap();
    });
    document.getElementById('resa-montant-paye')?.addEventListener('input', updateRecap);

    updateDuree();

    // Options paiement
    let modeActuel = 'immediat';
    document.querySelectorAll('.paiement-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.paiement-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        modeActuel = opt.dataset.mode;
        const payeInput = document.getElementById('resa-montant-paye');
        const totalInput = document.getElementById('resa-montant-total');
        const payeLabel = document.getElementById('resa-paye-label');
        if (modeActuel === 'immediat') {
          payeLabel.textContent = `Montant payé maintenant (${devise})`;
          if (payeInput && totalInput) payeInput.value = totalInput.value;
        } else if (modeActuel === 'attente') {
          payeLabel.textContent = `Montant payé maintenant (${devise})`;
          if (payeInput) payeInput.value = '0';
        } else {
          payeLabel.textContent = `Acompte versé (${devise})`;
        }
        updateRecap();
      });
    });

    // Sync immediat avec total
    document.getElementById('resa-montant-total')?.addEventListener('input', () => {
      if (modeActuel === 'immediat') {
        document.getElementById('resa-montant-paye').value = document.getElementById('resa-montant-total').value;
      }
      updateRecap();
    });

    document.getElementById('resa-modal-submit')?.addEventListener('click', async () => {
      const clientNom    = document.getElementById('resa-client-nom')?.value?.trim();
      const clientContact = document.getElementById('resa-client-contact')?.value?.trim();
      const espaceId     = document.getElementById('resa-espace')?.value;
      const dateDebut    = document.getElementById('resa-debut')?.value;
      const dateFin      = document.getElementById('resa-fin')?.value;
      const montantTotal = parseFloat(document.getElementById('resa-montant-total')?.value) || 0;
      const montantPaye  = modeActuel === 'attente' ? 0 : (parseFloat(document.getElementById('resa-montant-paye')?.value) || 0);
      const note         = document.getElementById('resa-note')?.value?.trim();

      if (!clientNom) { Toast.error('Le nom du client est requis'); return; }
      if (!dateDebut || !dateFin) { Toast.error('Les dates sont requises'); return; }
      if (new Date(dateFin) <= new Date(dateDebut)) { Toast.error('La fin doit être après le début'); return; }
      if (montantPaye > montantTotal && montantTotal > 0) { Toast.error('Le montant payé ne peut pas dépasser le total'); return; }

      const btn = document.getElementById('resa-modal-submit');
      btn.disabled = true; btn.textContent = 'Enregistrement…';

      const execCreation = async (force) => {
        const res = await window.api.terrain.createReservation({
          client_nom: clientNom, client_contact: clientContact,
          espace_id: espaceId ? parseInt(espaceId) : null,
          date_debut: dateDebut, date_fin: dateFin,
          montant_total: montantTotal, montant_paye: montantPaye,
          note, operateur: `${user?.nom || ''} ${user?.prenom || ''}`.trim(),
          force
        });

        if (res.code === 'CONFLICT') {
          btn.disabled = false; btn.textContent = 'Confirmer la réservation';
          Modal.confirm('Conflit de réservation', res.message + '\n\nVoulez-vous enregistrer la réservation quand même ?', async (ok) => {
            if (ok) {
              btn.disabled = true; btn.textContent = 'Enregistrement forcé…';
              await execCreation(true);
            }
          });
          return;
        }

        if (res.success) {
          Toast.success('Réservation créée avec succès !');
          closeModal(modal);
          if (currentTab === 'reservations') switchTab('reservations');
          else if (currentTab === 'stats') switchTab('stats');
        } else {
          Toast.error(res.message || 'Erreur lors de la création');
          btn.disabled = false; btn.textContent = 'Confirmer la réservation';
        }
      };

      await execCreation(false);
    });
  }

  function updateRecap() {
    const devise = localStorage.getItem('cc_devise') || 'Ar';
    const total  = parseFloat(document.getElementById('resa-montant-total')?.value) || 0;
    const paye   = parseFloat(document.getElementById('resa-montant-paye')?.value) || 0;
    const solde  = Math.max(0, total - paye);
    const rTotal = document.getElementById('recap-total');
    const rPaye  = document.getElementById('recap-paye');
    const rSolde = document.getElementById('recap-solde');
    if (rTotal) rTotal.textContent = fmtMoney(total, devise);
    if (rPaye)  rPaye.textContent  = fmtMoney(paye, devise);
    if (rSolde) rSolde.textContent = fmtMoney(solde, devise);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL PAYER SOLDE
  // ═══════════════════════════════════════════════════════════════════════════
  function openPayerSolde(resa) {
    const devise = localStorage.getItem('cc_devise') || 'Ar';
    const soldeRestant = resa.montant_total - resa.montant_paye;

    const modal = createModal('modal-payer-solde', `
      <div class="modal-header">
        <span class="modal-icon">💰</span>
        <h2>Encaisser un paiement</h2>
        <button class="btn-modal-close" id="payer-modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="paiement-recap">
          <div class="recap-row"><span class="recap-label">Client</span><span class="recap-value">${escapeHtml(resa.client_nom)}</span></div>
          <div class="recap-row"><span class="recap-label">Espace</span><span class="recap-value">${escapeHtml(resa.espace_nom || '—')}</span></div>
          <div class="recap-row"><span class="recap-label">Total</span><span class="recap-value">${fmtMoney(resa.montant_total, devise)}</span></div>
          <div class="recap-row"><span class="recap-label">Déjà payé</span><span class="recap-value ok">${fmtMoney(resa.montant_paye, devise)}</span></div>
          <div class="recap-row"><span class="recap-label">Solde restant</span><span class="recap-value solde">${fmtMoney(soldeRestant, devise)}</span></div>
        </div>
        <div class="form-group">
          <label>Montant à encaisser (${devise})</label>
          <input class="form-control" id="payer-montant" type="number" min="0" max="${soldeRestant}" step="100" value="${soldeRestant}">
        </div>
        <div style="font-size:12px;opacity:0.5;color:var(--text)">Ce montant sera ajouté au capital financier.</div>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-cancel" id="payer-modal-cancel">Annuler</button>
        <button class="btn-modal-confirm" id="payer-modal-submit">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Encaisser
        </button>
      </div>
    `);

    document.getElementById('payer-modal-close')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('payer-modal-cancel')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('payer-modal-submit')?.addEventListener('click', async () => {
      const montant = parseFloat(document.getElementById('payer-montant')?.value) || 0;
      if (montant <= 0) { Toast.error('Montant invalide'); return; }
      if (montant > soldeRestant) { Toast.error('Montant supérieur au solde'); return; }

      const btn = document.getElementById('payer-modal-submit');
      btn.disabled = true; btn.textContent = 'Traitement…';

      const res = await window.api.terrain.payerSolde(resa.id, montant);
      if (res.success) {
        Toast.success('Paiement encaissé !');
        closeModal(modal);
        switchTab(currentTab);
      } else {
        Toast.error(res.message || 'Erreur');
        btn.disabled = false; btn.textContent = 'Encaisser';
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL ANNULER
  // ═══════════════════════════════════════════════════════════════════════════
  function openAnnuler(resa) {
    const devise = localStorage.getItem('cc_devise') || 'Ar';
    const peutRembourser = resa.montant_paye > 0;

    const modal = createModal('modal-annuler', `
      <div class="modal-header">
        <span class="modal-icon">❌</span>
        <h2>Annuler la réservation</h2>
        <button class="btn-modal-close" id="annuler-modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="paiement-recap">
          <div class="recap-row"><span class="recap-label">Client</span><span class="recap-value">${escapeHtml(resa.client_nom)}</span></div>
          <div class="recap-row"><span class="recap-label">Réservation</span><span class="recap-value">${formatDatetime(resa.date_debut)}</span></div>
          ${peutRembourser ? `<div class="recap-row"><span class="recap-label">Montant à rembourser</span><span class="recap-value solde">${fmtMoney(resa.montant_paye, devise)}</span></div>` : ''}
        </div>
        ${peutRembourser ? `
          <div class="form-group" style="flex-direction:row;align-items:center;gap:12px">
            <input type="checkbox" id="annuler-rembourser" style="width:18px;height:18px;accent-color:#e74c3c">
            <label for="annuler-rembourser" style="font-size:14px;opacity:0.9;text-transform:none;letter-spacing:0;cursor:pointer">
              Rembourser ${fmtMoney(resa.montant_paye, devise)} au client (déduire du capital)
            </label>
          </div>
        ` : '<p style="font-size:13px;opacity:0.6;color:var(--text)">Aucun montant versé à rembourser.</p>'}
        <p style="font-size:12px;opacity:0.45;color:var(--text)">Cette action est irréversible.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-cancel" id="annuler-modal-cancel">Retour</button>
        <button class="btn-modal-confirm danger" id="annuler-modal-submit">
          Confirmer l'annulation
        </button>
      </div>
    `);

    document.getElementById('annuler-modal-close')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('annuler-modal-cancel')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('annuler-modal-submit')?.addEventListener('click', async () => {
      const rembourser = peutRembourser && document.getElementById('annuler-rembourser')?.checked;
      const btn = document.getElementById('annuler-modal-submit');
      btn.disabled = true; btn.textContent = 'Annulation…';

      const res = await window.api.terrain.annuler(resa.id, rembourser);
      if (res.success) {
        Toast.success(rembourser ? 'Réservation annulée et remboursée' : 'Réservation annulée');
        closeModal(modal);
        switchTab(currentTab);
      } else {
        Toast.error(res.message || 'Erreur');
        btn.disabled = false; btn.textContent = 'Confirmer l\'annulation';
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL DÉCALER
  // ═══════════════════════════════════════════════════════════════════════════
  function openDecaler(resa) {
    const modal = createModal('modal-decaler', `
      <div class="modal-header">
        <span class="modal-icon">📅</span>
        <h2>Décaler la réservation</h2>
        <button class="btn-modal-close" id="decaler-modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="paiement-recap" style="margin-bottom:4px">
          <div class="recap-row"><span class="recap-label">Client</span><span class="recap-value">${escapeHtml(resa.client_nom)}</span></div>
          <div class="recap-row"><span class="recap-label">Ancienne date</span><span class="recap-value">${formatDatetime(resa.date_debut)} → ${formatDatetime(resa.date_fin)}</span></div>
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label>Nouvelle date/heure de début *</label>
            <input class="form-control" id="decaler-debut" type="datetime-local" value="${resa.date_debut.slice(0,16)}">
          </div>
          <div class="form-group">
            <label>Nouvelle date/heure de fin *</label>
            <input class="form-control" id="decaler-fin" type="datetime-local" value="${resa.date_fin.slice(0,16)}">
          </div>
        </div>
        <div class="form-group">
          <label>Note (raison du décalage)</label>
          <input class="form-control" id="decaler-note" type="text" placeholder="Ex: Report demande du client">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-cancel" id="decaler-modal-cancel">Annuler</button>
        <button class="btn-modal-confirm" id="decaler-modal-submit">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Confirmer le décalage
        </button>
      </div>
    `);

    document.getElementById('decaler-modal-close')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('decaler-modal-cancel')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('decaler-modal-submit')?.addEventListener('click', async () => {
      const dateDebut = document.getElementById('decaler-debut')?.value;
      const dateFin   = document.getElementById('decaler-fin')?.value;
      const note      = document.getElementById('decaler-note')?.value?.trim();

      if (!dateDebut || !dateFin) { Toast.error('Dates requises'); return; }
      if (new Date(dateFin) <= new Date(dateDebut)) { Toast.error('La fin doit être après le début'); return; }

      const btn = document.getElementById('decaler-modal-submit');
      btn.disabled = true; btn.textContent = 'Mise à jour…';

      const execDecaler = async (force) => {
        const res = await window.api.terrain.decaler(resa.id, { date_debut: dateDebut, date_fin: dateFin, note, force });
        
        if (res.code === 'CONFLICT') {
          btn.disabled = false; btn.textContent = 'Confirmer le décalage';
          Modal.confirm('Conflit de réservation', res.message + '\n\nVoulez-vous enregistrer le décalage quand même ?', async (ok) => {
            if (ok) {
              btn.disabled = true; btn.textContent = 'Décalage forcé…';
              await execDecaler(true);
            }
          });
          return;
        }

        if (res.success) {
          Toast.success('Réservation décalée !');
          closeModal(modal);
          switchTab(currentTab);
        } else {
          Toast.error(res.message || 'Erreur');
          btn.disabled = false; btn.textContent = 'Confirmer le décalage';
        }
      };

      await execDecaler(false);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL ESPACE
  // ═══════════════════════════════════════════════════════════════════════════
  function openFormEspace(espace) {
    const devise = localStorage.getItem('cc_devise') || 'Ar';
    const isEdit = !!espace;
    editingEspaceId = isEdit ? (espace.id || espace.uuid) : null;

    const modal = createModal('modal-espace', `
      <div class="modal-header">
        <span class="modal-icon">${isEdit ? '✏️' : '🏟️'}</span>
        <h2>${isEdit ? 'Modifier l\'espace' : 'Nouvel espace'}</h2>
        <button class="btn-modal-close" id="espace-modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nom de l'espace *</label>
          <input class="form-control" id="espace-nom" type="text" placeholder="Ex: Terrain A" value="${isEdit ? escapeHtml(espace.nom) : ''}">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select class="form-control" id="espace-type">
            ${Object.entries(ESPACE_LABELS).map(([k, v]) => `<option value="${k}" ${isEdit && espace.type === k ? 'selected' : ''}>${ESPACE_ICONS[k]} ${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Description</label>
          <input class="form-control" id="espace-description" type="text" placeholder="Capacité, équipements…" value="${isEdit ? escapeHtml(espace.description || '') : ''}">
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label>Mode de facturation</label>
            <select class="form-control" id="espace-type-tarif">
              <option value="heure" ${isEdit && espace.type_tarif === 'heure' ? 'selected' : ''}>Tarif par heure</option>
              <option value="fixe" ${isEdit && espace.type_tarif === 'fixe' ? 'selected' : ''}>Montant fixe (par réservation)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tarif (${devise}) — 0 = Libre</label>
            <input class="form-control" id="espace-tarif" type="number" min="0" step="100" placeholder="0" value="${isEdit ? espace.tarif_heure : '0'}">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-cancel" id="espace-modal-cancel">Annuler</button>
        <button class="btn-modal-confirm" id="espace-modal-submit">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${isEdit ? 'Modifier' : 'Créer l\'espace'}
        </button>
      </div>
    `);

    document.getElementById('espace-modal-close')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('espace-modal-cancel')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('espace-modal-submit')?.addEventListener('click', async () => {
      const nom         = document.getElementById('espace-nom')?.value?.trim();
      const type        = document.getElementById('espace-type')?.value;
      const type_tarif  = document.getElementById('espace-type-tarif')?.value || 'heure';
      const description = document.getElementById('espace-description')?.value?.trim();
      const tarif_heure = parseFloat(document.getElementById('espace-tarif')?.value) || 0;

      if (!nom) { Toast.error('Le nom est requis'); return; }

      let res;
      if (isEdit) {
        res = await window.api.terrain.updateEspace(editingEspaceId, { nom, type, description, tarif_heure, type_tarif });
      } else {
        res = await window.api.terrain.createEspace({ nom, type, description, tarif_heure, type_tarif });
      }

      if (res.success) {
        Toast.success(isEdit ? 'Espace modifié !' : 'Espace créé !');
        closeModal(modal);
        await loadEspaces();
        const grid = document.getElementById('espaces-grid');
        if (grid) { grid.innerHTML = renderEspacesGrid(); bindEspaceCardEvents(); }
      } else {
        Toast.error(res.message || 'Erreur');
      }
    });
  }

  // ── UTILITAIRES MODALS ────────────────────────────────────────────────────
  function createModal(id, innerHtml) {
    const existing = document.getElementById(id + '-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'terrain-modal-overlay';
    overlay.id = id + '-overlay';
    overlay.innerHTML = `<div class="terrain-modal modal-lg">${innerHtml}</div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
    return overlay;
  }

  function closeModal(modalOrOverlay) {
    if (modalOrOverlay) modalOrOverlay.remove();
  }

  // ── HELPERS FORMATAGE ─────────────────────────────────────────────────────
  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmtMoney(v, devise) {
    return Number(v || 0).toLocaleString('fr-FR') + ' ' + (devise || 'Ar');
  }

  function formatDatetime(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatTime(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function toLocalISOString(date) {
    const off = date.getTimezoneOffset();
    const local = new Date(date.getTime() - off * 60000);
    return local.toISOString();
  }

  function labelPaiement(statut) {
    return { en_attente: 'Non payé', partiel: 'Partiel', complet: 'Payé' }[statut] || statut;
  }

  // ── ACTIVATION VUE ────────────────────────────────────────────────────────
  document.addEventListener('view:activate', (e) => {
    if (e.detail.view !== 'terrain') return;
    const container = document.getElementById('view-terrain');
    if (!container) return;
    // Toujours re-render pour rafraîchir les données
    render();
  });

})();
