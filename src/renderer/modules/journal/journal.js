'use strict';

/* ═══════════════════════════════════════════════════════════════════
   Journal d'Activité — Module Renderer
   ═══════════════════════════════════════════════════════════════════ */
(function JournalModule() {

  // ── État interne ──────────────────────────────────────────────────
  const PAGE_SIZE = 100;

  let state = {
    rows:        [],
    total:       0,
    page:        0,
    loading:     false,
    categorie:   'TOUS',
    search:      '',
    dateDebut:   '',
    dateFin:     '',
    stats:       null,
  };

  // ── Catalogue des catégories ──────────────────────────────────────
  const CATEGORIES = [
    { id: 'TOUS',        label: 'Tout',         icone: '📋' },
    { id: 'AUTH',        label: 'Auth',          icone: '🔐' },
    { id: 'VENTE',       label: 'Ventes',        icone: '🛒' },
    { id: 'STOCK',       label: 'Stock',         icone: '📦' },
    { id: 'PRODUIT',     label: 'Produits',      icone: '🏷️' },
    { id: 'FINANCE',     label: 'Finances',      icone: '💰' },
    { id: 'RH',          label: 'RH',            icone: '👥' },
    { id: 'CLOTURE',     label: 'Clôtures',      icone: '📊' },
    { id: 'UTILISATEUR', label: 'Utilisateurs',  icone: '👤' },
    { id: 'RESERVATION', label: 'Réservations',  icone: '📅' },
    { id: 'PARAMETRE',   label: 'Paramètres',    icone: '⚙️'  },
  ];

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────
  function render() {
    const container = document.getElementById('view-journal');
    if (!container) return;

    container.innerHTML = `
      <!-- Topbar -->
      <div class="journal-topbar">
        <button class="back-btn" id="journal-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Retour
        </button>
        <span class="journal-topbar-title">📓 Journal d'Activité</span>
        <div style="flex:1"></div>
        <button class="mod-action-btn mod-action-btn-secondary" id="journal-export-excel" title="Exporter en Excel" style="background:#1d6f42; color:#fff; border:none;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M8 13h2"></path>
            <path d="M8 17h2"></path>
            <path d="M14 13h2"></path>
            <path d="M14 17h2"></path>
          </svg>
          Excel
        </button>

        <button class="mod-action-btn mod-action-btn-secondary" id="journal-export-word" title="Exporter en Word" style="background:#2b579a; color:#fff; border:none; margin-right:15px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M9 15l2-4 2 4"></path>
          </svg>
          Word
        </button>

        <button class="mod-action-btn mod-action-btn-secondary" id="journal-refresh" title="Actualiser">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Actualiser
        </button>
      </div>

      <div class="journal-body">

        <!-- Stats -->
        <div class="journal-stats-row" id="journal-stats-row">
          <div class="journal-stat-card">
            <div class="journal-stat-label">Aujourd'hui</div>
            <div class="journal-stat-value" id="jstat-today">—</div>
            <div class="journal-stat-sub">actions</div>
          </div>
          <div class="journal-stat-card">
            <div class="journal-stat-label">Cette semaine</div>
            <div class="journal-stat-value" id="jstat-week">—</div>
            <div class="journal-stat-sub">actions</div>
          </div>
          <div class="journal-stat-card">
            <div class="journal-stat-label">Ce mois</div>
            <div class="journal-stat-value" id="jstat-month">—</div>
            <div class="journal-stat-sub">actions</div>
          </div>
          <div class="journal-stat-card">
            <div class="journal-stat-label">Total filtré</div>
            <div class="journal-stat-value" id="jstat-total">—</div>
            <div class="journal-stat-sub">entrées</div>
          </div>
        </div>

        <!-- Filtres catégorie -->
        <div class="journal-cats" id="journal-cats">
          ${CATEGORIES.map(c => `
            <button class="journal-cat-btn ${c.id === 'TOUS' ? 'active' : ''}"
                    data-cat="${c.id}" id="jcat-${c.id}">
              ${c.icone} ${c.label}
              <span class="journal-cat-count" id="jcat-count-${c.id}">0</span>
            </button>
          `).join('')}
        </div>

        <!-- Filtres texte + dates -->
        <div class="journal-filters">
          <div class="journal-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="journal-search" id="journal-search"
                   placeholder="Rechercher action, détail, opérateur…" />
          </div>
          <input type="date" class="journal-date-filter" id="journal-date-debut" title="Date de début" />
          <input type="date" class="journal-date-filter" id="journal-date-fin"   title="Date de fin" />
          <button class="mod-action-btn mod-action-btn-secondary" id="journal-reset-dates" title="Effacer dates" style="padding:7px 10px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Info résultats -->
        <div class="journal-result-info" id="journal-result-info"></div>

        <!-- Timeline -->
        <div class="journal-scroll" id="journal-scroll">
          <div class="journal-loading">
            <div class="journal-spinner"></div>
            Chargement…
          </div>
        </div>

        <!-- Pagination -->
        <div class="journal-pagination" id="journal-pagination" style="display:none">
          <button class="journal-page-btn" id="jpag-prev">← Précédent</button>
          <span class="journal-page-info" id="jpag-info"></span>
          <button class="journal-page-btn" id="jpag-next">Suivant →</button>
        </div>

      </div>
    `;

    bindEvents();
    loadStats();
    loadData();
  }

  // ── EVENTS ────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('journal-back')?.addEventListener('click', () => Router.go('dashboard'));
    document.getElementById('journal-refresh')?.addEventListener('click', () => {
      loadStats();
      loadData();
    });

    // ── Exportation
    document.getElementById('journal-export-excel')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span class="spinner" style="width:14px; height:14px; margin-right:5px; border-width:2px;"></span> Excel`;

      try {
        const params = {
          categorie: state.categorie,
          search:    state.search || undefined,
          dateDebut: state.dateDebut || undefined,
          dateFin:   state.dateFin || undefined
        };
        const res = await window.api.journal.exportExcel(params);
        if (res.success) {
          Toast.success(`Fichier Excel enregistré avec succès :\n${res.path}`);
        } else {
          if (res.message !== 'Export annulé.') Toast.error(`Erreur d'export : ${res.message}`);
        }
      } catch (err) {
        Toast.error(err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

    document.getElementById('journal-export-word')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span class="spinner" style="width:14px; height:14px; margin-right:5px; border-width:2px;"></span> Word`;

      try {
        const params = {
          categorie: state.categorie,
          search:    state.search || undefined,
          dateDebut: state.dateDebut || undefined,
          dateFin:   state.dateFin || undefined
        };
        const res = await window.api.journal.exportWord(params);
        if (res.success) {
          Toast.success(`Fichier Word enregistré avec succès :\n${res.path}`);
        } else {
          if (res.message !== 'Export annulé.') Toast.error(`Erreur d'export : ${res.message}`);
        }
      } catch (err) {
        Toast.error(err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

    // Filtres catégorie
    document.querySelectorAll('.journal-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.categorie = btn.dataset.cat;
        state.page = 0;
        document.querySelectorAll('.journal-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadData();
      });
    });

    // Recherche (debounce 300ms)
    let searchTimer;
    document.getElementById('journal-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 0;
        loadData();
      }, 300);
    });

    // Filtres dates
    document.getElementById('journal-date-debut')?.addEventListener('change', (e) => {
      state.dateDebut = e.target.value;
      state.page = 0;
      loadData();
    });
    document.getElementById('journal-date-fin')?.addEventListener('change', (e) => {
      state.dateFin = e.target.value;
      state.page = 0;
      loadData();
    });

    // Reset dates
    document.getElementById('journal-reset-dates')?.addEventListener('click', () => {
      state.dateDebut = '';
      state.dateFin   = '';
      const d1 = document.getElementById('journal-date-debut');
      const d2 = document.getElementById('journal-date-fin');
      if (d1) d1.value = '';
      if (d2) d2.value = '';
      state.page = 0;
      loadData();
    });

    // Pagination
    document.getElementById('jpag-prev')?.addEventListener('click', () => {
      if (state.page > 0) { state.page--; loadData(); }
    });
    document.getElementById('jpag-next')?.addEventListener('click', () => {
      const maxPage = Math.ceil(state.total / PAGE_SIZE) - 1;
      if (state.page < maxPage) { state.page++; loadData(); }
    });
  }

  // ── CHARGER STATS ─────────────────────────────────────────────────
  async function loadStats() {
    try {
      const stats = await window.api.journal.getStats();
      state.stats = stats;

      const el = (id) => document.getElementById(id);
      if (el('jstat-today'))  el('jstat-today').textContent  = stats.aujourd_hui ?? 0;
      if (el('jstat-week'))   el('jstat-week').textContent   = stats.semaine      ?? 0;
      if (el('jstat-month'))  el('jstat-month').textContent  = stats.mois         ?? 0;

      // Mettre à jour les compteurs par catégorie
      if (Array.isArray(stats.parCategorie)) {
        const countMap = {};
        stats.parCategorie.forEach(pc => { countMap[pc.categorie] = pc.n; });
        const total = stats.parCategorie.reduce((s, pc) => s + pc.n, 0);

        const elTous = document.getElementById('jcat-count-TOUS');
        if (elTous) elTous.textContent = total;

        CATEGORIES.filter(c => c.id !== 'TOUS').forEach(c => {
          const countEl = document.getElementById(`jcat-count-${c.id}`);
          if (countEl) countEl.textContent = countMap[c.id] ?? 0;
        });
      }
    } catch (e) {
      console.error('[Journal] loadStats error:', e);
    }
  }

  // ── CHARGER LES DONNÉES ──────────────────────────────────────────
  async function loadData() {
    if (state.loading) return;
    state.loading = true;

    const scroll = document.getElementById('journal-scroll');
    if (scroll) {
      scroll.innerHTML = `
        <div class="journal-loading">
          <div class="journal-spinner"></div>
          Chargement…
        </div>
      `;
    }

    try {
      const params = {
        categorie:  state.categorie,
        search:     state.search || undefined,
        dateDebut:  state.dateDebut || undefined,
        dateFin:    state.dateFin   || undefined,
        limit:      PAGE_SIZE,
        offset:     state.page * PAGE_SIZE,
      };

      const result = await window.api.journal.getAll(params);
      state.rows  = result.rows  || [];
      state.total = result.total || 0;

      // Mettre à jour le compteur total filtré
      const totalEl = document.getElementById('jstat-total');
      if (totalEl) totalEl.textContent = state.total;

      // Info résultats
      const infoEl = document.getElementById('journal-result-info');
      if (infoEl) {
        const start = state.page * PAGE_SIZE + 1;
        const end   = Math.min(start + PAGE_SIZE - 1, state.total);
        if (state.total === 0) {
          infoEl.textContent = 'Aucune entrée trouvée';
        } else {
          infoEl.textContent = `Affichage ${start}–${end} sur ${state.total} entrée${state.total > 1 ? 's' : ''}`;
        }
      }

      renderTimeline(state.rows);
      renderPagination();

    } catch (e) {
      console.error('[Journal] loadData error:', e);
      if (scroll) {
        scroll.innerHTML = `<div class="journal-empty">
          <div class="journal-empty-icon">⚠️</div>
          <div class="journal-empty-text">Erreur de chargement : ${Utils.esc(e.message)}</div>
        </div>`;
      }
    } finally {
      state.loading = false;
    }
  }

  // ── RENDU TIMELINE ─────────────────────────────────────────────────
  function renderTimeline(rows) {
    const scroll = document.getElementById('journal-scroll');
    if (!scroll) return;

    if (!rows || rows.length === 0) {
      scroll.innerHTML = `
        <div class="journal-empty">
          <div class="journal-empty-icon">📭</div>
          <div class="journal-empty-text">Aucune entrée dans le journal</div>
        </div>`;
      return;
    }

    // Regrouper par jour
    const groupes = {};
    rows.forEach(row => {
      const day = (row.date_action || '').slice(0, 10);
      if (!groupes[day]) groupes[day] = [];
      groupes[day].push(row);
    });

    let html = '';
    for (const [day, entries] of Object.entries(groupes)) {
      const dateParsed = new Date(day + 'T00:00:00');
      const dayLabel   = formatDayLabel(dateParsed);

      // Compter les montants du jour
      const totalMontant = entries.reduce((s, e) => s + (e.montant || 0), 0);
      const montantStr   = totalMontant > 0
        ? ` — ${totalMontant.toLocaleString('fr-FR')} Ar`
        : '';

      html += `
        <div class="journal-day-group">
          <div class="journal-day-header">
            <span class="journal-day-label">${Utils.esc(dayLabel)}</span>
            <div class="journal-day-line"></div>
            <span class="journal-day-total">${entries.length} action${entries.length > 1 ? 's' : ''}${montantStr}</span>
          </div>
          ${entries.map(renderEntry).join('')}
        </div>
      `;
    }

    scroll.innerHTML = html;

    // Scroll vers le haut à chaque rechargement
    scroll.scrollTop = 0;
  }

  // ── RENDU D'UNE ENTRÉE ───────────────────────────────────────────
  function renderEntry(row) {
    const cat   = row.categorie || 'SYSTEME';
    const icone = row.icone || getCatIcone(cat);
    const heure = formatHeure(row.date_action);

    const montantHtml = (row.montant != null && row.montant > 0)
      ? `<div class="journal-entry-montant">${row.montant.toLocaleString('fr-FR')} Ar</div>`
      : '';

    const operateurHtml = row.operateur
      ? `<div class="journal-entry-operator">👤 ${Utils.esc(row.operateur)}</div>`
      : '';

    return `
      <div class="journal-entry" data-cat="${Utils.esc(cat)}">
        <div class="journal-entry-icon icon-bg-${cat}">
          ${icone}
        </div>
        <div class="journal-entry-content">
          <div class="journal-entry-top">
            <span class="journal-entry-action">${Utils.esc(row.action || '—')}</span>
            <span class="journal-entry-badge badge-${cat}">${Utils.esc(getCatLabel(cat))}</span>
          </div>
          ${row.detail
            ? `<div class="journal-entry-detail" title="${Utils.esc(row.detail)}">${Utils.esc(row.detail)}</div>`
            : ''}
        </div>
        <div class="journal-entry-meta">
          <div class="journal-entry-time">${heure}</div>
          ${montantHtml}
          ${operateurHtml}
        </div>
      </div>
    `;
  }

  // ── PAGINATION ────────────────────────────────────────────────────
  function renderPagination() {
    const pag      = document.getElementById('journal-pagination');
    const pagInfo  = document.getElementById('jpag-info');
    const btnPrev  = document.getElementById('jpag-prev');
    const btnNext  = document.getElementById('jpag-next');

    if (!pag) return;

    const totalPages = Math.ceil(state.total / PAGE_SIZE);

    if (totalPages <= 1) {
      pag.style.display = 'none';
      return;
    }

    pag.style.display = 'flex';
    if (pagInfo) pagInfo.textContent = `Page ${state.page + 1} / ${totalPages}`;
    if (btnPrev) btnPrev.disabled = state.page <= 0;
    if (btnNext) btnNext.disabled = state.page >= totalPages - 1;
  }

  // ── HELPERS ───────────────────────────────────────────────────────
  function formatDayLabel(date) {
    const today     = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const sameDay   = (a, b) => a.toDateString() === b.toDateString();

    if (sameDay(date, today))     return "Aujourd'hui";
    if (sameDay(date, yesterday)) return 'Hier';

    return date.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function formatHeure(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('T') ? '' : 'Z'));
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return dateStr.slice(11, 19) || '—'; }
  }

  function getCatLabel(cat) {
    return CATEGORIES.find(c => c.id === cat)?.label || cat;
  }

  function getCatIcone(cat) {
    return CATEGORIES.find(c => c.id === cat)?.icone || '📝';
  }

  // ── ACTIVATION ────────────────────────────────────────────────────
  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'journal') {
      // Réinitialiser l'état à chaque ouverture
      state.page      = 0;
      state.search    = '';
      state.categorie = 'TOUS';
      state.dateDebut = '';
      state.dateFin   = '';

      render();
    }
  });

})();
