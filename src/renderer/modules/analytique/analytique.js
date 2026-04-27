/* ═══════════════════════════════════════════════════════════════
   ClinoCaisse — Tableau de Bord Analytique (Admin seulement)
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(function AnalitiqueModule() {

  const DEVISE = () => localStorage.getItem('cc_devise') || 'Ar';
  const state = {
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  };
  const PERIOD_PRESETS = { day: 0, week: 6, month: 29 };

  function fmtMoney(v) {
    return `${Number(v || 0).toLocaleString('fr-FR')} ${DEVISE()}`;
  }

  function getRangeForPreset(preset) {
    const end = new Date();
    const start = new Date(end);
    const delta = PERIOD_PRESETS[preset] ?? 6;
    start.setDate(start.getDate() - delta);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  // ── RENDU PRINCIPAL ────────────────────────────────────────────────────────
  function render() {
    const container = document.getElementById('view-analytique');
    const initialRange = getRangeForPreset('week');
    state.startDate = initialRange.startDate;
    state.endDate = initialRange.endDate;

    container.innerHTML = `
      <div class="ana-layout">
      <div class="ana-topbar">
        <div class="ana-topbar-left">
          <button class="btn btn-ghost btn-sm" id="ana-retour">← Retour</button>
          <span class="ana-topbar-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="12" width="4" height="10" rx="1"/><rect x="9" y="7" width="4" height="15" rx="1"/><rect x="16" y="2" width="4" height="20" rx="1"/></svg>
            Tableau de bord analytique
          </span>
        </div>
        <div class="ana-topbar-right">
          <div class="ana-period-selector">
            <button class="ana-period-btn" data-preset="day">Jour</button>
            <button class="ana-period-btn active" data-preset="week">Semaine</button>
            <button class="ana-period-btn" data-preset="month">Mois</button>
            <button class="ana-period-btn" data-preset="custom">Personnalisé</button>
          </div>
          <div class="ana-custom-range" id="ana-custom-range">
            <input type="date" id="ana-start-date" value="${state.startDate}" />
            <span>→</span>
            <input type="date" id="ana-end-date" value="${state.endDate}" />
            <button class="btn btn-sm" id="ana-apply-custom">Appliquer</button>
          </div>
          <button class="btn btn-primary btn-sm" id="ana-export-csv" title="Exporter en CSV">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exporter CSV
          </button>
        </div>
      </div>

      <div class="ana-body">

        <!-- KPIs -->
        <div class="ana-kpi-grid" id="ana-kpis">

          <!-- Ventes caisse -->
          <div class="ana-kpi-card ana-kpi-card-sales">
            <div class="ana-kpi-top-bar" style="background:linear-gradient(90deg,#3b82f6,#60a5fa)"></div>
            <div class="ana-kpi-geo"></div>
            <div class="ana-kpi-glass"></div>
            <div class="ana-kpi-reflection"></div>
            <div class="ana-kpi-content">
              <div class="ana-kpi-header">
                <div class="ana-kpi-title-group">
                  <div class="ana-kpi-icon-badge">
                    <svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z M3 9h18M9 21V9"/></svg>
                  </div>
                  <span class="ana-kpi-label">Ventes caisse</span>
                </div>
                <div class="ana-kpi-dot"></div>
              </div>
              <div class="ana-kpi-value" id="kpi-sales-val">—</div>
              <div class="ana-kpi-sub" id="kpi-sales-sub"></div>
            </div>
          </div>

          <!-- Terrain -->
          <div class="ana-kpi-card ana-kpi-card-terrain">
            <div class="ana-kpi-top-bar" style="background:linear-gradient(90deg,#14b8a6,#2dd4bf)"></div>
            <div class="ana-kpi-geo"></div>
            <div class="ana-kpi-glass"></div>
            <div class="ana-kpi-reflection"></div>
            <div class="ana-kpi-content">
              <div class="ana-kpi-header">
                <div class="ana-kpi-title-group">
                  <div class="ana-kpi-icon-badge">
                    <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <span class="ana-kpi-label">Terrain</span>
                </div>
                <div class="ana-kpi-dot"></div>
              </div>
              <div class="ana-kpi-value" id="kpi-terrain-val">—</div>
              <div class="ana-kpi-sub" id="kpi-terrain-sub"></div>
            </div>
          </div>

          <!-- Flux finance -->
          <div class="ana-kpi-card ana-kpi-card-flow">
            <div class="ana-kpi-top-bar" style="background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div>
            <div class="ana-kpi-geo"></div>
            <div class="ana-kpi-glass"></div>
            <div class="ana-kpi-reflection"></div>
            <div class="ana-kpi-content">
              <div class="ana-kpi-header">
                <div class="ana-kpi-title-group">
                  <div class="ana-kpi-icon-badge">
                    <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <span class="ana-kpi-label">Entrées / Sorties</span>
                </div>
                <div class="ana-kpi-dot"></div>
              </div>
              <div class="ana-kpi-value" id="kpi-flow-val">—</div>
              <div class="ana-kpi-sub" id="kpi-flow-sub"></div>
            </div>
          </div>

          <!-- Résultat net -->
          <div class="ana-kpi-card ana-kpi-card-net">
            <div class="ana-kpi-top-bar" style="background:linear-gradient(90deg,#22c55e,#4ade80)"></div>
            <div class="ana-kpi-geo"></div>
            <div class="ana-kpi-glass"></div>
            <div class="ana-kpi-reflection"></div>
            <div class="ana-kpi-content">
              <div class="ana-kpi-header">
                <div class="ana-kpi-title-group">
                  <div class="ana-kpi-icon-badge">
                    <svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  </div>
                  <span class="ana-kpi-label">Résultat net</span>
                </div>
                <div class="ana-kpi-dot"></div>
              </div>
              <div class="ana-kpi-value" id="kpi-net-val">—</div>
              <div class="ana-kpi-sub" id="kpi-net-sub"></div>
            </div>
          </div>

        </div>

        <!-- Graphique CA -->
        <div class="ana-card">
          <div class="ana-card-title">Évolution journalière (caisse)</div>
          <div class="ana-chart-wrap">
            <canvas id="ana-chart-ca" height="260"></canvas>
          </div>
        </div>

        <!-- Top Produits + Moyens de paiement -->
        <div class="ana-row-2">
          <div class="ana-card">
            <div class="ana-card-title">🏆 Top 10 produits vendus</div>
            <div id="ana-top-produits"></div>
          </div>
          <div class="ana-card">
            <div class="ana-card-title">Repartition paiements</div>
            <canvas id="ana-chart-paiements" width="300" height="240"></canvas>
          </div>
        </div>

        <div id="ana-section-terrains" class="ana-card">
          <div class="ana-card-title">Top terrains réservés</div>
          <div id="ana-top-terrains"></div>
        </div>

        <!-- Tableau ventes récentes -->
        <div class="ana-card" style="overflow:visible;">
          <div class="ana-card-title">Dernières ventes</div>
          <div id="ana-ventes-table"></div>
        </div>

      </div>
      </div>
    `;

    document.getElementById('ana-retour')?.addEventListener('click', () => Router.go('dashboard'));

    document.querySelectorAll('.ana-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ana-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;
        const customWrap = document.getElementById('ana-custom-range');
        if (preset === 'custom') {
          customWrap?.classList.add('active');
          return;
        }
        customWrap?.classList.remove('active');
        const range = getRangeForPreset(preset);
        state.startDate = range.startDate;
        state.endDate = range.endDate;
        setRangeInputs();
        loadAll();
      });
    });

    document.getElementById('ana-apply-custom')?.addEventListener('click', () => {
      const startDate = document.getElementById('ana-start-date')?.value;
      const endDate = document.getElementById('ana-end-date')?.value;
      if (!startDate || !endDate || endDate < startDate) {
        Toast.error('Plage de dates invalide.');
        return;
      }
      state.startDate = startDate;
      state.endDate = endDate;
      loadAll();
    });
    document.getElementById('ana-export-csv')?.addEventListener('click', exportCSV);

    loadAll();
  }

  function setRangeInputs() {
    const start = document.getElementById('ana-start-date');
    const end = document.getElementById('ana-end-date');
    if (start) start.value = state.startDate;
    if (end) end.value = state.endDate;
  }

  // ── CHARGEMENT DONNÉES ─────────────────────────────────────────────────────
  async function loadAll() {
    try {
      const data = await window.api.analytique.getOverview({
        startDate: state.startDate,
        endDate: state.endDate,
      });
      renderKPIs(data.kpis);
      renderChartCA(data.caParJour, data.caTerrainParJour);
      renderTopProduits(data.topProduits);
      renderTopTerrains(data.topTerrains);
      renderChartPaiements(data.paiements);
      renderVentesTable(data.ventes.slice(0, 20));
    } catch (err) {
      Toast.error(`Erreur analytique: ${err.message}`);
    }
  }

  function renderKPIs(kpis) {
    document.getElementById('kpi-sales-val').textContent = fmtMoney(kpis.total_ventes);
    document.getElementById('kpi-sales-sub').textContent = `${kpis.nb_tickets} ticket(s) • panier moyen ${fmtMoney(kpis.panier_moyen)}`;
    document.getElementById('kpi-terrain-val').textContent = fmtMoney(kpis.total_terrain);
    document.getElementById('kpi-terrain-sub').textContent = `${kpis.nb_reservations} reservation(s) sur la plage`;
    document.getElementById('kpi-flow-val').textContent = `${fmtMoney(kpis.total_entrees)} / ${fmtMoney(kpis.total_sorties)}`;
    document.getElementById('kpi-flow-sub').textContent = 'Entrees puis sorties';
    document.getElementById('kpi-net-val').textContent = fmtMoney(kpis.net);
    document.getElementById('kpi-net-sub').textContent = `${state.startDate} -> ${state.endDate}`;
  }

  // ── GRAPHIQUE CA (Canvas) ──────────────────────────────────────────────────
  function renderChartCA(caParJour, caTerrainParJour) {
    const canvas = document.getElementById('ana-chart-ca');
    if (!canvas) return;

    // Ajuster la résolution du canvas à sa taille CSS réelle
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(rect.width || canvas.parentElement.clientWidth || 600, 200);
    const H = 260;
    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    const venteMap = {};
    (caParJour || []).forEach((r) => { venteMap[r.jour] = Number(r.ca || 0); });
    (caTerrainParJour || []).forEach((r) => {
      venteMap[r.jour] = (venteMap[r.jour] || 0) + Number(r.ca_terrain || 0);
    });
    const dates  = Object.keys(venteMap).sort();
    const values = dates.map((d) => venteMap[d]);
    const maxVal = Math.max(...values, 1);

    const padL = 64, padR = 16, padT = 16, padB = 44;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);

    const style  = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || '#5ab4ff';
    const accentRgb = style.getPropertyValue('--accent-rgb').trim() || '90,180,255';
    const textCol   = style.getPropertyValue('--text').trim()   || '#e8f2ff';

    // Grille + labels Y
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      const val = maxVal * (1 - i / 4);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px Inter,system-ui,sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(val).toLocaleString('fr-FR'), padL - 6, y + 4);
    }

    if (!dates.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '13px Inter,system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée sur la période', W / 2, H / 2);
      return;
    }

    const slot = chartW / dates.length;
    const barW = Math.min(Math.max(Math.floor(slot * 0.55), 4), 48);

    dates.forEach((d, i) => {
      const x = padL + slot * i + (slot - barW) / 2;
      let h = (values[i] / maxVal) * chartH;
      if (h < 2) h = 2;
      const y = padT + chartH - h;

      // Barre dégradé
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, `rgba(${accentRgb},0.15)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(x, y, barW, h, [4, 4, 2, 2]); }
      else { ctx.rect(x, y, barW, h); }
      ctx.fill();

      // Label date
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '9.5px Inter,system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.slice(5), x + barW / 2, padT + chartH + 14);
    });
  }


  // ── TOP PRODUITS ──────────────────────────────────────────────────────────
  function renderTopProduits(produits) {
    const el = document.getElementById('ana-top-produits');
    if (!el) return;
    if (!produits || !produits.length) {
      el.innerHTML = '<div class="ana-empty">Aucune donnée disponible</div>';
      return;
    }
    const max = produits[0].total_qte || 1;
    el.innerHTML = produits.map((p, i) => `
      <div class="ana-top-row">
        <span class="ana-top-rank">#${i + 1}</span>
        <div class="ana-top-info">
          <div class="ana-top-name">${Utils.esc(p.produit_nom || '?')}</div>
          <div class="ana-top-bar-wrap">
            <div class="ana-top-bar" style="width:${Math.round((p.total_qte / max) * 100)}%"></div>
          </div>
        </div>
        <div class="ana-top-stats">
          <span class="ana-top-qty">${Number(p.total_qte).toLocaleString('fr-FR')} unités</span>
          <span class="ana-top-ca">${Number(p.total_ca || 0).toLocaleString('fr-FR')} ${DEVISE()}</span>
        </div>
      </div>
    `).join('');
  }

  // ── GRAPHIQUE PAIEMENTS (donut) ────────────────────────────────────────────
  function renderChartPaiements(data) {
    const canvas = document.getElementById('ana-chart-paiements');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const SIZE = 240;
    canvas.width  = SIZE;
    canvas.height = SIZE;
    ctx.clearRect(0, 0, SIZE, SIZE);

    if (!data || !data.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '12px Inter,system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée', SIZE/2, SIZE/2);
      return;
    }

    const COLORS = ['#5ab4ff','#4ade80','#fbbf24','#f87171','#c084fc','#2dd4bf'];
    const total  = data.reduce((s, d) => s + (d.total || 0), 0);
    if (!total) return;

    const cx = SIZE/2, cy = SIZE/2 - 16, radius = 82;
    let angleStart = -Math.PI / 2;

    data.forEach((d, i) => {
      const slice = (d.total / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angleStart, angleStart + slice);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      angleStart += slice;
    });

    // Trou donut
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.52, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
    ctx.fill();

    // Légende
    ctx.font = '10.5px Inter,system-ui,sans-serif';
    data.forEach((d, i) => {
      const y = SIZE - (data.length - i) * 17 - 2;
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(6, y - 7, 10, 10, 3) : ctx.rect(6, y - 7, 10, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'left';
      const pct = Math.round((d.total / total) * 100);
      ctx.fillText(`${d.mode_paiement} ${pct}%`, 22, y + 1);
    });
  }

  function renderTopTerrains(rows) {
    const el = document.getElementById('ana-top-terrains');
    if (!el) return;
    if (!rows || !rows.length) {
      el.innerHTML = '<div class="ana-empty">Aucune reservation terrain sur la periode</div>';
      return;
    }
    const max = Math.max(...rows.map(r => Number(r.total_reservations || 0)), 1);
    el.innerHTML = rows.map((r, i) => `
      <div class="ana-top-row">
        <span class="ana-top-rank">#${i + 1}</span>
        <div class="ana-top-info">
          <div class="ana-top-name">${Utils.esc(r.espace_nom || 'Espace')}</div>
          <div class="ana-top-bar-wrap">
            <div class="ana-top-bar" style="width:${Math.round((Number(r.total_reservations || 0) / max) * 100)}%"></div>
          </div>
        </div>
        <div class="ana-top-stats">
          <span class="ana-top-qty">${Number(r.total_reservations || 0).toLocaleString('fr-FR')} réservation(s)</span>
          <span class="ana-top-ca">${fmtMoney(r.total_ca || 0)}</span>
        </div>
      </div>
    `).join('');
  }

  // ── TABLEAU VENTES RÉCENTES ────────────────────────────────────────────────
  function renderVentesTable(ventes) {
    const el = document.getElementById('ana-ventes-table');
    if (!el) return;
    if (!ventes || !ventes.length) {
      el.innerHTML = '<div class="ana-empty"><div class="ana-empty-icon">🧾</div>Aucune vente sur la période</div>';
      return;
    }
    el.innerHTML = `
      <div class="ana-table-wrap">
        <table class="ana-table">
          <thead><tr>
            <th>N° Ticket</th><th>Date</th><th>Caissier</th><th>Paiement</th><th>Total</th><th>Statut</th>
          </tr></thead>
          <tbody>
            ${ventes.map(v => `
              <tr>
                <td style="font-weight:600;font-size:11px;opacity:.55;">${Utils.esc(v.numero_ticket)}</td>
                <td>${new Date(v.date_vente).toLocaleString('fr-FR')}</td>
                <td>${Utils.esc(v.nom_caissier || '—')}</td>
                <td><span class="ana-badge">${Utils.esc(v.mode_paiement || 'CASH')}</span></td>
                <td class="ana-table-amount">${Number(v.total_ttc).toLocaleString('fr-FR')} ${DEVISE()}</td>
                <td><span class="ana-status ${v.statut === 'annule' ? 'ana-status-cancel' : 'ana-status-ok'}">${v.statut === 'annule' ? '✕ Annulé' : '✓ Validé'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function exportCSV() {
    const btn = document.getElementById('ana-export-csv');
    if (btn) { btn.disabled = true; btn.textContent = 'Export...'; }
    try {
      const data = await window.api.analytique.getOverview({
        startDate: state.startDate,
        endDate: state.endDate,
      });
      const ventes = data.ventes || [];
      const headers = ['Numero Ticket','Date','Caissier','Mode Paiement','Total TTC','Montant Paye','Monnaie Rendue','Statut'];
      const rows = ventes.map(v => [
        v.numero_ticket, v.date_vente, v.nom_caissier || '', v.mode_paiement || 'CASH',
        v.total_ttc, v.montant_paye, v.monnaie_rendue, v.statut || 'valide',
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ClinoCaisse_export_${state.startDate}_${state.endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('Export CSV généré');
    } catch (err) {
      Toast.error(`Erreur export: ${err.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exporter CSV';
      }
    }
  }

  // ── ACTIVATION ─────────────────────────────────────────────────────────────
  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'analytique') {
      const user = Session.getUser();
      if (!user || user.role !== 'admin') { Router.go('dashboard'); return; }
      render();
    }
  });

})();
