'use strict';

(function ReservationsModule() {

  let state = {
    listFilter: 'all',
    markers: [],
    overdueIds: new Set(),
  };

  /* ── RENDER PRINCIPAL ──────────────────────────────────────────────── */
  function render() {
    const container = document.getElementById('view-reservations');
    if (!container) return;
    container.innerHTML = `
      <div class="module-topbar">
        <button class="back-btn" id="reserv-back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Retour
        </button>
        <span class="module-topbar-title">📅 Réservations &amp; plan de salle</span>
        <div style="flex:1"></div>
        <button class="mod-action-btn" id="btn-new-reserv">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouvelle réservation
        </button>
      </div>

      <div class="module-body reserv-module-body">
        <div class="reserv-filters" id="reserv-tabs">
          <button class="reserv-filter-btn active" data-tab="liste">📋 Liste</button>
          <button class="reserv-filter-btn" data-tab="plan">🗺️ Plan de salle</button>
        </div>

        <div id="tab-liste" class="reserv-tab-panel">
          <div class="reserv-filters" id="reserv-status-tabs">
            <button class="reserv-filter-btn active" data-filter="all">Toutes</button>
            <button class="reserv-filter-btn" data-filter="en_attente">En attente</button>
            <button class="reserv-filter-btn" data-filter="confirmee">Confirmées</button>
            <button class="reserv-filter-btn" data-filter="client_arrive">Arrivés ✅</button>
            <button class="reserv-filter-btn" data-filter="reporter">Reportées</button>
            <button class="reserv-filter-btn" data-filter="annulee">Annulées</button>
          </div>
          <div id="reserv-overdue-banner" style="display:none" class="reserv-overdue-banner">
            <span class="reserv-overdue-banner-icon">🔔</span>
            <div class="reserv-overdue-banner-text">
              Réservations en attente d'arrivée
              <span class="reserv-overdue-banner-sub" id="overdue-sub"></span>
            </div>
          </div>
          <div class="reserv-list" id="reserv-list">
            <div class="empty-state">Chargement…</div>
          </div>
        </div>

        <div id="tab-plan" class="reserv-tab-panel" style="display:none">
          <p class="reserv-plan-hint">État des tables : libre, réservée (confirmée/en attente), occupée (ticket ouvert).</p>
          <div class="reserv-plan-legend">
            <span><i class="dot dot-libre"></i> Libre</span>
            <span><i class="dot dot-reservee"></i> Réservée</span>
            <span style="display:none"><i class="dot dot-arrive"></i> Client arrivé</span>
            <span><i class="dot dot-occupee"></i> Occupée</span>
          </div>
          <div id="table-plan-grid" class="reserv-plan-grid"></div>
        </div>
      </div>
    `;

    bindEvents();
    loadReservations(state.listFilter);
    loadPlanDeSalle();
    checkScrollToAlert();
  }

  /* ── VÉRIFIER FLAG NOTIFICATION ────────────────────────────────────── */
  function checkScrollToAlert() {
    if (window._reservScrollToAlert) {
      window._reservScrollToAlert = false;
      // Afficher le banner et scroller
      setTimeout(() => {
        const banner = document.getElementById('reserv-overdue-banner');
        if (banner) banner.scrollIntoView({ behavior: 'smooth' });
      }, 400);
    }
  }

  function maybeOpenOverdueModal(overdue) {
    if (!window._reservOpenOverdueModal) return;
    window._reservOpenOverdueModal = false;
    if (!overdue?.length) return;

    const devise = localStorage.getItem('cc_devise') || 'Ar';
    const modalId = Modal.open({
      title: `🔔 Réservations à traiter (${overdue.length})`,
      width: '720px',
      content: `
        <div style="opacity:0.8;font-size:12px;margin-bottom:10px">
          Ces réservations ont dépassé l'heure prévue et la table n'est pas encore occupée (pas de ticket ouvert).
          Choisissez une action.
        </div>
        <div class="reserv-overdue-modal-list">
          ${overdue.map(r => {
            let tables = [];
            try { tables = JSON.parse(r.tables_json || '[]'); } catch(e) {}
            if (!tables.length && r.table_numero) tables = [r.table_numero];
            const tablesTxt = tables.length ? `Table(s) ${tables.join(', ')}` : '—';
            const dur = r.duree_heures ? `${r.duree_heures}h` : '';
            return `
              <div class="reserv-overdue-item" data-rid="${r.id}">
                <div class="reserv-overdue-item-main">
                  <div class="reserv-overdue-item-title">
                    <strong>${Utils.esc(r.client_nom)}</strong>
                    <span class="reserv-overdue-mini">${tablesTxt}${dur ? ` · ${dur}` : ''}</span>
                  </div>
                  ${r.client_tel ? `<div class="reserv-overdue-mini" style="margin-top:4px">📞 ${Utils.esc(r.client_tel)}</div>` : ''}
                  <div class="reserv-overdue-item-time">🕐 ${fmtDate(r.date_reservation)}</div>
                </div>
                <div class="reserv-overdue-item-actions">
                  <button class="btn-reserv-action btn-reserv-arrive" data-rid="${r.id}" data-act="arrive">✅ Client arrivé</button>
                  <button class="btn-reserv-action btn-reserv-reporter" data-rid="${r.id}" data-act="reporter">⏩ Reporter</button>
                  <button class="btn-reserv-action btn-reserv-cancel" data-rid="${r.id}" data-act="annulee">❌ Annuler</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="margin-top:10px; font-size:11px; opacity:0.65">
          Astuce: le montant (acompte/report) reste optionnel. Devise: ${Utils.esc(devise)}.
        </div>
      `,
      footer: `<button class="btn btn-ghost" id="btn-close-overdue">Fermer</button>`
    });

    setTimeout(() => {
      document.getElementById('btn-close-overdue')?.addEventListener('click', () => Modal.close(modalId));
      document.querySelectorAll('.reserv-overdue-modal-list .btn-reserv-action').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id  = parseInt(btn.dataset.rid, 10);
          const act = btn.dataset.act;
          if (act === 'arrive') {
            const ok = await new Promise(r => Modal.confirm('Client arrivé', 'Confirmer que le client est arrivé ?', r));
            if (!ok) return;
            const res = await window.api.reservations.marquerArrive(id);
            if (res.success) { Toast.success('Client marqué comme arrivé'); Modal.close(modalId); await refreshAll(); }
            else Toast.error(res.message||'Erreur');
          } else if (act === 'reporter') {
            Modal.close(modalId);
            showReporterModal(id);
          } else if (act === 'annulee') {
            const ok = await new Promise(r => Modal.confirm('Annuler', 'Confirmer l\'annulation ?', r));
            if (!ok) return;
            const res = await window.api.reservations.updateStatus(id, 'annulee');
            if (res.success) { Toast.success('Réservation annulée'); Modal.close(modalId); await refreshAll(); }
            else Toast.error(res.message||'Erreur');
          }
        });
      });
    }, 30);
  }

  /* ── EVENTS ─────────────────────────────────────────────────────────── */
  function bindEvents() {
    document.getElementById('reserv-back')?.addEventListener('click', () => Router.go('dashboard'));
    document.getElementById('btn-new-reserv')?.addEventListener('click', showNewReservModal);

    document.querySelectorAll('#reserv-status-tabs .reserv-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#reserv-status-tabs .reserv-filter-btn').forEach(b => b.classList.remove('active'));
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
        document.getElementById('tab-plan').style.display  = tab === 'plan'  ? 'flex' : 'none';
        if (tab === 'plan') loadPlanDeSalle();
      });
    });
  }

  /* ── PLAN DE SALLE ──────────────────────────────────────────────────── */
  async function loadPlanDeSalle() {
    const el = document.getElementById('table-plan-grid');
    if (!el) return;
    try {
      const [tables, markers] = await Promise.all([
        window.api.tables.getAll(),
        window.api.reservations.getTodayMarkers(),
      ]);
      state.markers = markers || [];

      const byTable = {};
      state.markers.forEach(m => {
        if (m.table_numero != null) {
          if (!byTable[m.table_numero]) byTable[m.table_numero] = [];
          byTable[m.table_numero].push(m);
        }
      });

      const cells = (tables || []).map(({ numero, ticket }) => {
        let etat = 'libre';
        if (ticket) etat = 'occupee';
        else if (byTable[numero]?.length) {
          const hasArrive = byTable[numero].some(m => m.statut === 'client_arrive' || m.client_arrive);
          etat = hasArrive ? 'arrive' : 'reservee';
        }

        const ms = byTable[numero] || [];
        const title = ms.length
          ? ms.map(m => `${Utils.esc(m.client_nom)} (${m.nb_personnes||'?'} pers.)`).join(' · ')
          : (etat === 'occupee' ? 'Ticket ouvert' : 'Table libre');

        const timeStr = ms.length && ms[0].date_reservation
          ? fmtDate(ms[0].date_reservation)
          : '';
        const labelMap = { libre:'Libre', reservee:'Réservée', arrive:'Arrivé', occupee:'Occupée' };

        return `
          <div class="plan-table plan-table--${etat}" data-num="${numero}" title="${title}">
            <span class="plan-table-num">${numero}</span>
            <span class="plan-table-label">${labelMap[etat]||etat}</span>
            ${ms.length ? `<span class="plan-table-guest">${Utils.esc(ms[0].client_nom)}</span>` : ''}
            ${timeStr ? `<span class="plan-table-time">${timeStr}</span>` : ''}
          </div>`;
      });

      el.innerHTML = cells.length
        ? cells.join('')
        : '<div class="empty-state">Aucune table configurée.</div>';
    } catch (e) {
      console.error(e);
      el.innerHTML = '<div class="empty-state">Impossible de charger le plan.</div>';
    }
  }

  /* ── LISTE DES RÉSERVATIONS ─────────────────────────────────────────── */
  async function loadReservations(filter) {
    const el = document.getElementById('reserv-list');
    if (!el) return;
    try {
      const [list, overdue] = await Promise.all([
        window.api.reservations.getAll(filter || 'all'),
        window.api.reservations.getOverdue(),
      ]);
      state.overdueIds = new Set((overdue || []).map(r => r.id));
      renderOverdueBanner(overdue || []);
      maybeOpenOverdueModal(overdue || []);
      renderList(list || []);
    } catch (e) {
      console.error(e);
      el.innerHTML = '<div class="empty-state">Erreur de chargement.</div>';
    }
  }

  function renderOverdueBanner(overdue) {
    const banner = document.getElementById('reserv-overdue-banner');
    const sub    = document.getElementById('overdue-sub');
    if (!banner) return;
    if (!overdue.length) { banner.style.display = 'none'; return; }
    banner.style.display = 'flex';
    if (sub) {
      const names = overdue.slice(0, 3).map(r => Utils.esc(r.client_nom)).join(', ');
      sub.textContent = `${overdue.length} réservation(s) : ${names}${overdue.length > 3 ? '…' : ''}`;
    }
  }

  /* ── RENDER LISTE ────────────────────────────────────────────────────── */
  function renderList(items) {
    const el = document.getElementById('reserv-list');
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="empty-state">Aucune réservation</div>';
      return;
    }

    const statusLabels = {
      en_attente:'En attente', confirmee:'Confirmée', annulee:'Annulée',
      client_arrive:'Client arrivé ✅', reporter:'Reportée'
    };

    el.innerHTML = items.map(r => {
      let tables = [];
      try { tables = JSON.parse(r.tables_json || '[]'); } catch(e) {}
      if (!tables.length && r.table_numero) tables = [r.table_numero];

      const tablesTxt  = tables.length ? `Table(s) ${tables.join(', ')}` : '';
      const dureeTxt   = r.duree_heures ? `${r.duree_heures}h` : '';
      const isOverdue  = state.overdueIds.has(r.id);
      const hasArrive  = r.statut === 'confirmee' || r.statut === 'en_attente';
      const canAct     = hasArrive;

      const badgeReserv = (r.statut === 'en_attente' || r.statut === 'confirmee')
        ? `<span class="reserv-badge-reserv">🔒 Réservé</span>` : '';

      const timeClass = isOverdue ? 'reserv-time overdue-time' : 'reserv-time';

      const acompteTxt = r.montant_acompte > 0
        ? `<span class="reserv-acompte">💰 Acompte: ${Utils.formatMontant(r.montant_acompte, localStorage.getItem('cc_devise')||'Ar')}</span>` : '';

      const reportNote = r.note_report
        ? `<div class="reserv-note-report">↩️ ${Utils.esc(r.note_report)}${r.montant_report > 0 ? ` (+${Utils.formatMontant(r.montant_report, localStorage.getItem('cc_devise')||'Ar')})` : ''}</div>` : '';

      let actionBtns = '';
      if (canAct) {
        actionBtns = `
          <div class="reserv-btn-row">
            <button class="btn-reserv-action btn-reserv-arrive" data-rid="${r.id}" data-act="arrive">✅ Arrivé</button>
            <button class="btn-reserv-action btn-reserv-reporter" data-rid="${r.id}" data-act="reporter">⏩ Reporter</button>
            <button class="btn-reserv-action btn-reserv-cancel" data-rid="${r.id}" data-act="annulee">❌ Annuler</button>
          </div>`;
      } else if (r.statut === 'reporter') {
        actionBtns = `
          <div class="reserv-btn-row">
            <button class="btn-reserv-action btn-reserv-arrive" data-rid="${r.id}" data-act="arrive">✅ Arrivé</button>
            <button class="btn-reserv-action btn-reserv-cancel" data-rid="${r.id}" data-act="annulee">❌ Annuler</button>
          </div>`;
      }

      return `
      <div class="reserv-card${isOverdue ? ' is-overdue' : ''}" data-statut="${r.statut}">
        <div class="reserv-card-bar"></div>
        <div class="reserv-card-info">
          <div class="reserv-name">${Utils.esc(r.client_nom)} ${badgeReserv}</div>
          ${r.client_tel ? `<div class="reserv-phone">📞 ${Utils.esc(r.client_tel)}</div>` : ''}
          <div class="${timeClass}">
            <span class="reserv-time-icon">🕐</span>
            ${fmtDate(r.date_reservation)}
            ${isOverdue ? '<span style="font-size:10px;margin-left:6px;font-weight:700">EN RETARD</span>' : ''}
          </div>
          <div class="reserv-meta">
            ${r.nb_personnes || 1} pers.
            ${tablesTxt ? `<span class="reserv-meta-sep">·</span>${tablesTxt}` : ''}
            ${dureeTxt   ? `<span class="reserv-meta-sep">·</span>Durée: ${dureeTxt}` : ''}
            ${r.evenement ? `<span class="reserv-meta-sep">·</span>${Utils.esc(r.evenement)}` : ''}
          </div>
          ${acompteTxt}
          ${reportNote}
        </div>
        <div class="reserv-actions">
          <span class="reserv-status-badge s-${r.statut}">${statusLabels[r.statut]||r.statut}</span>
          ${actionBtns}
        </div>
      </div>`;
    }).join('');

    // Boutons action
    el.querySelectorAll('.btn-reserv-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id  = parseInt(btn.dataset.rid, 10);
        const act = btn.dataset.act;
        if (act === 'arrive') {
          const ok = await new Promise(r => Modal.confirm('Client arrivé', 'Confirmer que le client est arrivé ?', r));
          if (!ok) return;
          const res = await window.api.reservations.marquerArrive(id);
          if (res.success) { Toast.success('Client marqué comme arrivé'); await refreshAll(); }
          else Toast.error(res.message||'Erreur');
        } else if (act === 'reporter') {
          showReporterModal(id);
        } else if (act === 'annulee') {
          const ok = await new Promise(r => Modal.confirm('Annuler', 'Confirmer l\'annulation ?', r));
          if (!ok) return;
          const res = await window.api.reservations.updateStatus(id, 'annulee');
          if (res.success) { Toast.success('Réservation annulée'); await refreshAll(); }
          else Toast.error(res.message||'Erreur');
        }
      });
    });
  }

  async function refreshAll() {
    await loadReservations(state.listFilter);
    loadPlanDeSalle();
  }

  /* ── MODAL REPORTER ──────────────────────────────────────────────────── */
  function showReporterModal(id) {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const defVal = today.toISOString().slice(0, 16);

    const modalId = Modal.open({
      title: '⏩ Reporter la réservation',
      width: '460px',
      content: `
        <div class="form-group">
          <label>Nouvelle date &amp; heure *</label>
          <input type="datetime-local" class="input" id="rep-date" value="${defVal}" />
        </div>
        <div class="form-group">
          <label>Note / Motif du report</label>
          <input type="text" class="input" id="rep-note" placeholder="Ex: Client indisponible…" />
        </div>
        <div class="form-group">
          <label>Montant supplémentaire (optionnel)</label>
          <input type="number" class="input" id="rep-montant" placeholder="0" min="0" step="1" />
        </div>`,
      footer: `
        <button class="btn btn-ghost" id="btn-cancel-reporter">Annuler</button>
        <button class="btn btn-success" id="btn-save-reporter">Enregistrer</button>`,
    });

    setTimeout(() => {
      document.getElementById('btn-cancel-reporter')?.addEventListener('click', () => Modal.closeAll());
      document.getElementById('btn-save-reporter')?.addEventListener('click', async () => {
        const newDate = document.getElementById('rep-date')?.value;
        if (!newDate) { Toast.warn('Nouvelle date requise'); return; }
        const res = await window.api.reservations.reporter(id, {
          nouvelle_date:  newDate,
          note_report:    document.getElementById('rep-note')?.value?.trim() || null,
          montant_report: parseFloat(document.getElementById('rep-montant')?.value) || 0,
        });
        if (res.success) {
          Toast.success('Réservation reportée');
          Modal.close(modalId);
          await refreshAll();
        } else {
          if (res.code === 'RESERVATION_EXACT_CONFLICT') {
            Toast.warn(res.message || 'Créneau déjà réservé (même table / même heure)');
          } else Toast.error(res.message||'Erreur');
        }
      });
    }, 30);
  }

  /* ── MODAL NOUVELLE RÉSERVATION ─────────────────────────────────────── */
  async function showNewReservModal() {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const defVal = today.toISOString().slice(0, 16);
    const devise = localStorage.getItem('cc_devise') || 'Ar';

    const tables = await window.api.tables.getAll();
    const tableChips = (tables || []).map(t =>
      `<div class="reserv-table-chip" data-num="${t.numero}">${t.numero}</div>`
    ).join('');

    const modalId = Modal.open({
      title: '📅 Nouvelle réservation',
      width: '520px',
      content: `
        <div class="form-group">
          <label>Client *</label>
          <input type="text" class="input" id="r-nom" placeholder="Nom du client" />
        </div>
        <div class="form-group">
          <label>Téléphone (optionnel)</label>
          <input type="text" class="input" id="r-tel" placeholder="Ex: 034 12 345 67" />
        </div>
        <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px">
          <div class="form-group">
            <label>Date &amp; heure *</label>
            <input type="datetime-local" class="input" id="r-date" value="${defVal}" />
          </div>
          <div class="form-group">
            <label>Nombre de personnes</label>
            <input type="number" class="input" id="r-pers" value="2" min="1" />
          </div>
        </div>
        <div class="form-group">
          <label>Tables (cliquez pour sélectionner)</label>
          <div id="r-tables-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">${tableChips}</div>
          <p style="font-size:11px;opacity:0.55;margin-top:6px">Sélectionnez une ou plusieurs tables.</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label>Durée prévue (heures)</label>
            <input type="number" class="input" id="r-duree" placeholder="Ex: 2" min="0.5" step="0.5" />
          </div>
          <div class="form-group">
            <label>Acompte (${devise}) — optionnel</label>
            <input type="number" class="input" id="r-acompte" placeholder="0" min="0" step="1" />
          </div>
        </div>
        <div class="form-group">
          <label>Événement</label>
          <input type="text" class="input" id="r-event" placeholder="Anniversaire, groupe…" />
        </div>
        <div id="r-conflict-zone"></div>`,
      footer: `
        <button class="btn btn-ghost" id="btn-cancel-reserv">Annuler</button>
        <button class="btn btn-success" id="r-save">Enregistrer</button>`,
    });

    setTimeout(() => {
      document.getElementById('btn-cancel-reserv')?.addEventListener('click', () => Modal.closeAll());

      let selectedTables = [];
      document.querySelectorAll('.reserv-table-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
          const n = parseInt(chip.dataset.num, 10);
          if (chip.classList.contains('selected')) {
            chip.classList.remove('selected');
            selectedTables = selectedTables.filter(x => x !== n);
          } else {
            chip.classList.add('selected');
            selectedTables.push(n);
          }
          // Vérification conflits à la volée
          await checkConflicts(selectedTables);
        });
      });

      async function checkConflicts(tables) {
        const zone = document.getElementById('r-conflict-zone');
        if (!zone) return;
        if (!tables.length) { zone.innerHTML = ''; return; }
        const dateVal = document.getElementById('r-date')?.value;
        const duree   = parseFloat(document.getElementById('r-duree')?.value) || 1.5;
        if (!dateVal) { zone.innerHTML = ''; return; }

        const conflicts = await window.api.reservations.checkDisponibilite({
          tables, date_reservation: dateVal, duree_heures: duree
        });
        if (!conflicts.length) { zone.innerHTML = ''; return; }

        zone.innerHTML = `
          <div style="margin-top:10px;padding:12px 14px;border-radius:9px;background:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.4)">
            <div style="font-weight:700;color:#f39c12;margin-bottom:8px;font-size:13px">⚠️ Conflit détecté sur cette plage horaire</div>
            ${conflicts.map(c => `
              <div class="conflict-card">
                <strong>${Utils.esc(c.client_nom)}</strong> — ${fmtDate(c.date_reservation)}
                ${c.nb_personnes ? ` · ${c.nb_personnes} pers.` : ''}
                ${c.duree_heures ? ` · ${c.duree_heures}h` : ''}
              </div>`).join('')}
            <div style="font-size:12px;opacity:0.8;margin-top:8px">Vous pouvez <strong>continuer quand même</strong>, choisir une autre table, ou reporter cette réservation.</div>
          </div>`;
      }

      // Recalcul conflits si date/durée changent
      document.getElementById('r-date')?.addEventListener('change',  () => checkConflicts(selectedTables));
      document.getElementById('r-duree')?.addEventListener('change', () => checkConflicts(selectedTables));

      document.getElementById('r-save')?.addEventListener('click', async () => {
        const nom  = document.getElementById('r-nom')?.value?.trim();
        const date = document.getElementById('r-date')?.value;
        if (!nom || !date) { Toast.warn('Nom et date obligatoires'); return; }

        const res = await window.api.reservations.create({
          client_nom:      nom,
          client_tel:      document.getElementById('r-tel')?.value?.trim() || null,
          date_reservation:date,
          nb_personnes:    parseInt(document.getElementById('r-pers')?.value||'2',10)||1,
          tables:          selectedTables,
          duree_heures:    parseFloat(document.getElementById('r-duree')?.value)||null,
          evenement:       document.getElementById('r-event')?.value?.trim()||null,
          montant_acompte: parseFloat(document.getElementById('r-acompte')?.value)||0,
        });
        if (res.success) {
          Toast.success('Réservation enregistrée');
          Modal.close(modalId);
          await refreshAll();
        } else {
          if (res.code === 'RESERVATION_EXACT_CONFLICT') {
            Toast.warn(res.message || 'Créneau déjà réservé (même table / même heure)');
          } else Toast.error(res.message||'Erreur');
        }
      });
    }, 30);
  }

  /* ── UTILS ───────────────────────────────────────────────────────────── */
  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return Utils.esc(String(iso));
      return d.toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' });
    } catch { return Utils.esc(String(iso)); }
  }

  /* ── EXPORTS & LIFECYCLE ─────────────────────────────────────────────── */
  window.ReservationsModule = {
    updateStatus: async (id, status) => {
      const res = await window.api.reservations.updateStatus(id, status);
      if (res.success) { Toast.success('Mis à jour'); await refreshAll(); }
      else Toast.error(res.message||'Erreur');
    }
  };

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'reservations') {
      if (!document.querySelector('.reserv-module-body')) render();
      else { loadReservations(state.listFilter); loadPlanDeSalle(); checkScrollToAlert(); }
    }
  });
})();
