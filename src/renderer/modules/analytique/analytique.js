/* ═══════════════════════════════════════════════════════════════
   ClinoCaisse — Tableau de Bord Analytique (Admin seulement)
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(function AnalitiqueModule() {

  const DEVISE = () => localStorage.getItem('cc_devise') || 'Ar';

  // ── RENDU PRINCIPAL ────────────────────────────────────────────────────────
  function render() {
    const container = document.getElementById('view-analytique');
    container.innerHTML = `
      <div class="ana-topbar">
        <button class="btn btn-ghost btn-sm" id="ana-retour">← Retour</button>
        <span class="ana-topbar-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="12" width="4" height="10" rx="1"/><rect x="9" y="7" width="4" height="15" rx="1"/><rect x="16" y="2" width="4" height="20" rx="1"/></svg>
          Tableau de bord analytique
        </span>
        <div class="ana-period-selector">
          <button class="ana-period-btn active" data-period="7">7 jours</button>
          <button class="ana-period-btn" data-period="30">30 jours</button>
          <button class="ana-period-btn" data-period="90">3 mois</button>
        </div>
        <button class="btn btn-primary btn-sm" id="ana-export-csv" title="Exporter en CSV">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exporter CSV
        </button>
      </div>

      <div class="ana-body">

        <!-- KPIs -->
        <div class="ana-kpi-grid" id="ana-kpis">
          <div class="ana-kpi-card" id="kpi-today">
            <div class="ana-kpi-label">CA aujourd'hui</div>
            <div class="ana-kpi-value" id="kpi-today-val">—</div>
            <div class="ana-kpi-sub" id="kpi-today-sub"></div>
          </div>
          <div class="ana-kpi-card" id="kpi-week">
            <div class="ana-kpi-label">CA cette semaine</div>
            <div class="ana-kpi-value" id="kpi-week-val">—</div>
            <div class="ana-kpi-sub" id="kpi-week-sub"></div>
          </div>
          <div class="ana-kpi-card" id="kpi-month">
            <div class="ana-kpi-label">CA ce mois</div>
            <div class="ana-kpi-value" id="kpi-month-val">—</div>
            <div class="ana-kpi-sub" id="kpi-month-sub"></div>
          </div>
          <div class="ana-kpi-card" id="kpi-tickets">
            <div class="ana-kpi-label">Tickets aujourd'hui</div>
            <div class="ana-kpi-value" id="kpi-tickets-val">—</div>
            <div class="ana-kpi-sub" id="kpi-tickets-sub"></div>
          </div>
        </div>

        <!-- Graphique CA -->
        <div class="ana-card">
          <div class="ana-card-title">Chiffre d'affaires par jour</div>
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
            <div class="ana-card-title">💳 Répartition paiements</div>
            <canvas id="ana-chart-paiements" width="300" height="240"></canvas>
          </div>
        </div>

        <!-- Tableau ventes récentes -->
        <div class="ana-card">
          <div class="ana-card-title">Dernières ventes</div>
          <div id="ana-ventes-table"></div>
        </div>

      </div>
    `;

    document.getElementById('ana-retour')?.addEventListener('click', () => Router.go('dashboard'));

    // Sélecteur de période
    document.querySelectorAll('.ana-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ana-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadAll(parseInt(btn.dataset.period, 10));
      });
    });

    document.getElementById('ana-export-csv')?.addEventListener('click', exportCSV);

    loadAll(7);
  }

  // ── CHARGEMENT DONNÉES ─────────────────────────────────────────────────────
  async function loadAll(days = 7) {
    const [ventes, allVentes] = await Promise.all([
      window.api.analytique.getVentesByPeriod(days),
      window.api.analytique.getVentesToday(),
    ]);
    const topProduits = await window.api.analytique.getTopProduits(days, 10);
    const paiements   = await window.api.analytique.getPaiementStats(days);

    renderKPIs(allVentes, days);
    renderChartCA(ventes);
    renderTopProduits(topProduits);
    renderChartPaiements(paiements);
    renderVentesTable(ventes.slice(0, 15));
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  function renderKPIs(todayData, days) {
    const fmt = v => `${Number(v || 0).toLocaleString('fr-FR')} ${DEVISE()}`;

    // CA aujourd'hui
    const caToday  = todayData.reduce((s, v) => s + (v.total_ttc || 0), 0);
    const nbToday  = todayData.length;
    document.getElementById('kpi-today-val').textContent = fmt(caToday);
    document.getElementById('kpi-today-sub').textContent = `${nbToday} ticket${nbToday > 1 ? 's' : ''}`;

    // CA semaine (fenêtre glissante 7j depuis today)
    const now     = new Date();
    const d7      = new Date(now); d7.setDate(d7.getDate() - 7);
    const d30     = new Date(now); d30.setDate(d30.getDate() - 30);

    // On récupère les données de la période sélectionnée via l'API
    window.api.analytique.getVentesByPeriod(7).then(v7 => {
      const ca7 = v7.reduce((s, v) => s + (v.total_ttc || 0), 0);
      document.getElementById('kpi-week-val').textContent = fmt(ca7);
      document.getElementById('kpi-week-sub').textContent = `${v7.length} tickets`;
    });
    window.api.analytique.getVentesByPeriod(30).then(v30 => {
      const ca30 = v30.reduce((s, v) => s + (v.total_ttc || 0), 0);
      document.getElementById('kpi-month-val').textContent = fmt(ca30);
      document.getElementById('kpi-month-sub').textContent = `${v30.length} tickets`;
    });

    document.getElementById('kpi-tickets-val').textContent = nbToday;
    document.getElementById('kpi-tickets-sub').textContent = `Panier moyen: ${nbToday ? fmt(caToday / nbToday) : '—'}`;
  }

  // ── GRAPHIQUE CA (Canvas) ──────────────────────────────────────────────────
  function renderChartCA(ventes) {
    const canvas = document.getElementById('ana-chart-ca');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Grouper par date
    const byDate = {};
    ventes.forEach(v => {
      const d = (v.date_vente || '').slice(0, 10);
      if (!d) return;
      byDate[d] = (byDate[d] || 0) + (v.total_ttc || 0);
    });

    const dates  = Object.keys(byDate).sort();
    const values = dates.map(d => byDate[d]);
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

    if (!dates.length) return;

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
      const label = d.slice(5); // MM-DD
      ctx.fillText(label, x + barW / 2, padT + chartH + 16);

      // Valeur au-dessus
      if (h > 20) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(Math.round(values[i]).toLocaleString('fr-FR'), x + barW / 2, y - 4);
      }
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
    if (!canvas || !data || !data.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

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

  // ── TABLEAU VENTES RÉCENTES ────────────────────────────────────────────────
  function renderVentesTable(ventes) {
    const el = document.getElementById('ana-ventes-table');
    if (!el) return;
    if (!ventes || !ventes.length) {
      el.innerHTML = '<div class="ana-empty">Aucune vente sur la période</div>';
      return;
    }
    el.innerHTML = `
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
    `;
  }

  // ── EXPORT CSV ────────────────────────────────────────────────────────────
  async function exportCSV() {
    const btn = document.getElementById('ana-export-csv');
    if (btn) { btn.disabled = true; btn.textContent = 'Export...'; }
    try {
      const period = parseInt(document.querySelector('.ana-period-btn.active')?.dataset.period || '7', 10);
      const ventes = await window.api.analytique.getVentesByPeriod(period);

      const headers = ['Numero Ticket','Date','Caissier','Mode Paiement','Total TTC','Montant Paye','Monnaie Rendue','Statut'];
      const rows    = ventes.map(v => [
        v.numero_ticket,
        v.date_vente,
        v.nom_caissier || '',
        v.mode_paiement || 'CASH',
        v.total_ttc,
        v.montant_paye,
        v.monnaie_rendue,
        v.statut || 'valide',
      ]);

      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ClinoCaisse_export_${period}j_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('Export CSV généré !');
    } catch (err) {
      Toast.error('Erreur export : ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exporter CSV'; }
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
