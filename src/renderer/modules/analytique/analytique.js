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
          <div class="ana-kpi-card ana-kpi-card-sales">
            <div class="ana-kpi-label">Ventes caisse</div>
            <div class="ana-kpi-value" id="kpi-sales-val">—</div>
            <div class="ana-kpi-sub" id="kpi-sales-sub"></div>
          </div>
          <div class="ana-kpi-card ana-kpi-card-terrain">
            <div class="ana-kpi-label">Terrain</div>
            <div class="ana-kpi-value" id="kpi-terrain-val">—</div>
            <div class="ana-kpi-sub" id="kpi-terrain-sub"></div>
          </div>
          <div class="ana-kpi-card ana-kpi-card-flow">
            <div class="ana-kpi-label">Entrées / sorties finance</div>
            <div class="ana-kpi-value" id="kpi-flow-val">—</div>
            <div class="ana-kpi-sub" id="kpi-flow-sub"></div>
          </div>
          <div class="ana-kpi-card ana-kpi-card-net">
            <div class="ana-kpi-label">Résultat net période</div>
            <div class="ana-kpi-value" id="kpi-net-val">—</div>
            <div class="ana-kpi-sub" id="kpi-net-sub"></div>
          </div>
        </div>

        <!-- Graphique CA -->
        <div class="ana-card">
          <div class="ana-card-title">Evolution journalière (caisse + terrain)</div>
          <div class="ana-chart-wrap">
            <canvas id="ana-chart-ca" width="900" height="280"></canvas>
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

        <div class="ana-card">
          <div class="ana-card-title">Top terrains réservés</div>
          <div id="ana-top-terrains"></div>
        </div>

        <!-- Tableau ventes récentes -->
        <div class="ana-card">
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
    const ctx = canvas.getContext('2d');
    const venteMap = {};
    (caParJour || []).forEach((r) => { venteMap[r.jour] = Number(r.ca || 0); });
    (caTerrainParJour || []).forEach((r) => {
      const day = r.jour;
      venteMap[day] = (venteMap[day] || 0) + Number(r.ca_terrain || 0);
    });
    const dates = Object.keys(venteMap).sort();
    const values = dates.map((d) => venteMap[d]);
    const maxVal = Math.max(...values, 1);

    const W = canvas.width, H = canvas.height;
    const padL = 70, padR = 20, padT = 20, padB = 50;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);

    // Couleurs CSS variables
    const style  = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || '#4a9fd4';
    const text   = style.getPropertyValue('--text').trim() || '#ccc';
    const border = style.getPropertyValue('--border').trim() || '#333';

    // Grille horizontale
    ctx.strokeStyle = border;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      const val = maxVal * (1 - i / 4);
      ctx.fillStyle = text;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(val).toLocaleString('fr-FR'), padL - 6, y + 4);
    }

    if (!dates.length) {
      ctx.fillStyle = text;
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Aucune donnée sur la période', padL, padT + 20);
      return;
    }

    const barW = Math.min(Math.floor(chartW / dates.length) - 4, 50);

    dates.forEach((d, i) => {
      const x  = padL + (chartW / dates.length) * i + (chartW / dates.length - barW) / 2;
      let h  = (values[i] / maxVal) * chartH;
      if (h <= 0) h = 1; // Sécurité anti-crash Skia Canvas
      const y  = padT + chartH - h;

      // Barre avec dégradé
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, accent + '44');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, h, 4) : ctx.rect(x, y, barW, h);
      ctx.fill();

      // Label date
      ctx.fillStyle = text;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      const label = d.slice(5);
      ctx.fillText(label, x + barW / 2, padT + chartH + 16);
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
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!data || !data.length) {
      ctx.fillStyle = '#9aa4b2';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Aucune donnee', 14, 20);
      return;
    }

    const COLORS = ['#4a9fd4','#2ecc71','#f39c12','#e74c3c','#9b59b6','#1abc9c'];
    const total  = data.reduce((s, d) => s + (d.total || 0), 0);
    if (!total) return;

    const cx = W / 2, cy = H / 2 - 20, radius = Math.min(cx, cy) - 10;
    let angleStart = -Math.PI / 2;

    data.forEach((d, i) => {
      const slice = (d.total / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angleStart, angleStart + slice);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2; ctx.stroke();
      angleStart += slice;
    });

    // Trou donut
    ctx.beginPath(); ctx.arc(cx, cy, radius * 0.55, 0, 2 * Math.PI);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#1e2a40';
    ctx.fill();

    // Légende
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text').trim() || '#ccc';
    ctx.font = '11px Inter, sans-serif';
    data.forEach((d, i) => {
      const y = H - (data.length - i) * 18 - 4;
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fillRect(8, y - 8, 12, 12);
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      const pct = Math.round((d.total / total) * 100);
      ctx.fillText(`${d.mode_paiement} — ${pct}% (${Number(d.total).toLocaleString('fr-FR')} ${DEVISE()})`, 26, y + 2);
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
      el.innerHTML = '<div class="ana-empty">Aucune vente sur la période</div>';
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
                <td>${Utils.esc(v.numero_ticket)}</td>
                <td>${new Date(v.date_vente).toLocaleString('fr-FR')}</td>
                <td>${Utils.esc(v.nom_caissier || '—')}</td>
                <td><span class="ana-badge">${Utils.esc(v.mode_paiement || 'CASH')}</span></td>
                <td><strong>${Number(v.total_ttc).toLocaleString('fr-FR')} ${DEVISE()}</strong></td>
                <td><span class="ana-status ${v.statut === 'annule' ? 'ana-status-cancel' : 'ana-status-ok'}">${v.statut || 'valide'}</span></td>
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
