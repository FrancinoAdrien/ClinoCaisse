'use strict';

(function ClotureModule() {

  let state = {
    rapport: null,
    activeFilter: 'X',
    devise: 'Ar',
    vendeurs: [],
    selectedVendeur: '',
    selectedDate: new Date().toISOString().slice(0, 10),
  };

  function render() {
    const container = document.getElementById('view-cloture');
    container.innerHTML = `
      <div class="caisse-topbar">
        <button class="btn btn-ghost btn-sm" id="cloture-retour">← Retour</button>
        <span class="caisse-topbar-title">📊 Clôture de Caisse</span>
        <div style="flex:1"></div>
        <span id="cloture-datetime" style="font-size:12px;opacity:0.6;color:var(--text)"></span>
      </div>

      <div class="cloture-body">
        <!-- Gauche : filtres -->
        <div class="cloture-left">
          <div>
            <div class="section-title">Type de rapport</div>
            <button class="filter-btn active" id="filter-X" data-filter="X">📊 Par clôture (Depuis le dernier Z)</button>
            <button class="filter-btn" id="filter-date" data-filter="date" style="margin-top:6px">📅 Par date</button>
            <button class="filter-btn" id="filter-vendeur" data-filter="vendeur" style="margin-top:6px">👤 Par vendeur</button>
          </div>

          <div id="filter-options-date" style="display:none">
            <div class="section-title">Date</div>
            <input type="date" class="input" id="cloture-date" />
          </div>

          <div id="filter-options-vendeur" style="display:none">
            <div class="section-title">Vendeur</div>
            <select class="input" id="cloture-vendeur" style="margin-bottom:10px">
              <option value="">Tous les vendeurs</option>
            </select>
            <div class="section-title">Période (Optionnel)</div>
            <div style="display:flex; gap:8px">
              <input type="date" class="input" id="cloture-vendeur-debut" title="Date de début" />
              <input type="date" class="input" id="cloture-vendeur-fin" title="Date de fin" />
            </div>
          </div>

          <button class="btn btn-primary btn-block" id="btn-generer-rapport" style="margin-top:auto">🔄 Générer</button>
          <button class="btn btn-ghost btn-block" id="btn-imprimer-rapport">🖨️ Imprimer</button>
        </div>

        <!-- Centre : rapport -->
        <div class="cloture-center">
          <div class="rapport-toolbar">
            <div id="rapport-stats" style="display:flex;gap:12px;flex-wrap:wrap"></div>
          </div>
          <div class="rapport-area">
            <div class="rapport-texte" id="rapport-texte">Cliquez sur "Générer" pour afficher le rapport...</div>
          </div>
        </div>

        <!-- Droite : saisie caisse -->
        <div class="cloture-right">
          <div class="section-title">Fond de Caisse</div>

          <div class="stat-card">
            <div class="stat-label">Total espèces</div>
            <div class="stat-value" id="cr-cash">0</div>
          </div>

          <div>
            <div class="section-title" style="margin-bottom:8px">Saisie</div>

            <div class="form-group" style="margin-bottom:10px">
              <label>Total compté (${state.devise})</label>
              <input type="number" class="input" id="cr-compte" value="0" min="0" step="1" />
            </div>
            <div class="form-group" style="margin-bottom:10px">
              <label>Prélèvement (${state.devise})</label>
              <input type="number" class="input" id="cr-prelevement" value="0" min="0" step="1" />
            </div>

            <div class="saisie-caisse-line">
              <span>Espèces en caisse</span>
              <strong id="cr-especes-display">0 ${state.devise}</strong>
            </div>
            <div class="saisie-caisse-line">
              <span>Total compté</span>
              <strong id="cr-compte-display">0 ${state.devise}</strong>
            </div>
            <div class="saisie-caisse-line">
              <span>Prélèvement</span>
              <strong id="cr-prelevement-display">0 ${state.devise}</strong>
            </div>
            <div class="saisie-caisse-line" style="margin-top:6px;padding-top:10px;border-top:2px solid var(--border)">
              <span>Reste en caisse</span>
              <strong id="cr-reste" class="">0 ${state.devise}</strong>
            </div>
          </div>

          <!-- Clôture Z -->
          <div style="margin-top:auto">
            <div class="section-title" style="margin-bottom:10px">⚠️ Clôture Z</div>
            <p style="font-size:11px;opacity:0.6;margin-bottom:12px;line-height:1.5">
              La clôture Z est définitive. Elle marque la fin de la période et réinitialise les compteurs.
            </p>
            <button class="btn-cloture-z" id="btn-faire-z">🔒 FAIRE LA CLÔTURE Z</button>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    loadInit();
    updateDateTime();
  }

  async function loadInit() {
    const params = await window.api.parametres.getAll();
    state.devise = params['caisse.devise'] || 'Ar';

    // Mettre à jour les labels devise
    document.querySelectorAll('.input[id^="cr-"]').forEach(el => {
      const label = el.previousElementSibling;
      if (label && label.tagName === 'LABEL') {
        label.textContent = label.textContent.replace(/\(.*\)/, `(${state.devise})`);
      }
    });

    // Charger vendeurs
    state.vendeurs = await window.api.cloture.getVendeurs();
    const sel = document.getElementById('cloture-vendeur');
    if (sel) {
      state.vendeurs.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        sel.appendChild(opt);
      });
    }

    // Date par défaut
    const dateInput = document.getElementById('cloture-date');
    if (dateInput) dateInput.value = state.selectedDate;

    // Vider les dates côté vendeur pour signifier 'depuis toujours' par défaut, 
    // ou on peut mettre vide pour le laisser libre selon la demande
    const vDebut = document.getElementById('cloture-vendeur-debut');
    if (vDebut) vDebut.value = '';
    const vFin = document.getElementById('cloture-vendeur-fin');
    if (vFin) vFin.value = '';

    // Générer rapport X automatiquement
    await genererRapport();
  }

  function updateDateTime() {
    const el = document.getElementById('cloture-datetime');
    if (el) el.textContent = new Date().toLocaleString('fr-FR');
  }

  async function genererRapport() {
    let rapport;
    const btn = document.getElementById('btn-generer-rapport');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Calcul...'; }

    try {
      if (state.activeFilter === 'X') {
        rapport = await window.api.cloture.rapportX();
      } else if (state.activeFilter === 'date') {
        const date = document.getElementById('cloture-date')?.value || state.selectedDate;
        rapport = await window.api.cloture.rapportParDate(date);
      } else {
        const vendeur = document.getElementById('cloture-vendeur')?.value || '';
        const debut = document.getElementById('cloture-vendeur-debut')?.value || '';
        const fin = document.getElementById('cloture-vendeur-fin')?.value || '';
        rapport = await window.api.cloture.rapportParVendeur({ vendeur, debut, fin });
      }

      state.rapport = rapport;
      renderRapport(rapport);
    } catch (err) {
      Toast.error('Erreur lors du calcul: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Générer'; }
    }
  }

  function renderRapport(r) {
    const L = 44;
    const sep = '─'.repeat(L);
    const sep2 = '═'.repeat(L);
    const ctr = s => { const p = Math.max(0, (L - s.length) / 2 | 0); return ' '.repeat(p) + s; };
    const fmtN = (n) => Math.round(n || 0).toLocaleString('fr-FR').replace(/[\s\u202f\u00a0]/g, ' ');
    const right = (lbl, val) => {
      const v = `${fmtN(val)} ${state.devise}`;
      const maxL = Math.max(0, L - v.length);
      const l = `  ${lbl}`.padEnd(maxL).slice(0, maxL);
      return l + v;
    };

    const typeLabel = { X: 'RAPPORT X', date: 'RAPPORT PAR DATE', vendeur: 'RAPPORT PAR VENDEUR' }[state.activeFilter] || 'RAPPORT';
    const debut = r.dateDebut ? new Date(r.dateDebut).toLocaleString('fr-FR') : '-';
    const fin = r.dateFin ? new Date(r.dateFin).toLocaleString('fr-FR') : '-';
    const userActuel = Session.getUser();

    const lignes = [
      sep2,
      ctr(typeLabel),
      ctr(new Date().toLocaleString('fr-FR')),
      sep2, '',
      `  Période   : ${debut}`,
      `  ↳ au      : ${fin}`,
      `  Généré par: ${userActuel?.nom || 'Admin'}`,
    ];

    if (state.activeFilter === 'vendeur') {
      const vId = document.getElementById('cloture-vendeur')?.value;
      lignes.push(`  Cible     : ${vId || 'Tous'}`);
    }

    const formatList = (arr, isOffert = false) => {
      if (!arr) return '';
      if (typeof arr === 'string') return arr;
      if (arr.length === 0) return '  (Aucun)';
      return arr.map(d => {
        const q = `  ${Math.round(d.qte)}x  `;
        if (isOffert) return `${q}${d.nom.slice(0, L - 10)}`;
        const m = `${fmtN(d.montant)} ${state.devise}`;
        const spacesLeft = Math.max(0, L - q.length - m.length);
        const line1 = `${q}${d.nom.padEnd(spacesLeft).slice(0, spacesLeft)}${m}`;
        if (d.remisePct !== null && d.remisePct !== undefined) {
          const pctLine = `     \u21b3 Remise: ${d.remisePct}%`;
          return `${line1}\n${pctLine}`;
        }
        return line1;
      }).join('\n');
    };

    lignes.push(
      `  Tickets   : ${r.nbTickets || 0}`,
      `  Articles  : ${Math.round(r.nbArticles || 0)}`,
      '', sep2, ctr('TOTAUX PAR MODE DE PAIEMENT'), sep2,
      right('Espèces (CASH):', r.totalCash),
      right('Mvola:', r.totalMvola),
      right('Orange Money:', r.totalOrange),
      right('Airtel Money:', r.totalAirtel),
      right('Carte bancaire:', r.totalCarte),
      right('Autres:', r.totalAutre),
      sep,
      right('TOTAL VENTE:', r.totalTTC),
      right('TOTAL EN CAISSE:', r.totalCash),
      '', sep2, ctr('VENTES PAR CATÉGORIE(Ar)'), sep2,
      formatList(r.categoriesDetail) || '  Aucune catégorie',
      '', sep2, ctr('VENTES PAR ARTICLE(Ar)'), sep2,
      formatList(r.articlesDetail) || '  Aucun article'
    );

    if (r.offertsDetail && r.offertsDetail.length > 0) {
      lignes.push('', sep2, ctr('ARTICLES OFFERTS'), sep2, formatList(r.offertsDetail, true));
    }
    if (r.remisesDetail && r.remisesDetail.length > 0) {
      lignes.push('', sep2, ctr('REMISES(Ar)'), sep2, formatList(r.remisesDetail));
    }

    lignes.push('', sep, ctr('FIN DE RAPPORT'), sep);

    const texte = lignes.join('\n');
    const pre = document.getElementById('rapport-texte');
    if (pre) pre.textContent = texte;

    // Stats rapides
    const statsEl = document.getElementById('rapport-stats');
    if (statsEl) {
      statsEl.innerHTML = [
        { label: 'Total Vente', value: `${fmtN(r.totalTTC)} ${state.devise}`, color: 'var(--accent-light)' },
        { label: 'Tickets', value: r.nbTickets || 0, color: '#f39c12' },
        { label: 'Espèces', value: `${fmtN(r.totalCash)} ${state.devise}`, color: '#2ecc71' },
        { label: 'Mvola', value: `${fmtN(r.totalMvola)} ${state.devise}`, color: '#3498db' },
      ].map(s => `
        <div class="stat-card" style="min-width:120px;padding:8px 12px">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value" style="font-size:15px;color:${s.color}">${s.value}</div>
        </div>`).join('');
    }

    // Mettre à jour volet droit
    const cashEl = document.getElementById('cr-cash');
    if (cashEl) cashEl.textContent = `${fmtN(r.totalCash)} ${state.devise}`;
    updateSaisie(r.totalCash || 0);
  }

  function updateSaisie(totalCash) {
    const compte = parseFloat(document.getElementById('cr-compte')?.value) || 0;
    const prelev = parseFloat(document.getElementById('cr-prelevement')?.value) || 0;
    const reste = totalCash - prelev;

    const fmtN = n => Math.round(n).toLocaleString('fr-FR');

    document.getElementById('cr-especes-display').textContent = `${fmtN(totalCash)} ${state.devise}`;
    document.getElementById('cr-compte-display').textContent = `${fmtN(compte)} ${state.devise}`;
    document.getElementById('cr-prelevement-display').textContent = `${fmtN(prelev)} ${state.devise}`;

    const resteEl = document.getElementById('cr-reste');
    if (resteEl) {
      resteEl.textContent = `${fmtN(reste)} ${state.devise}`;
      resteEl.className = reste >= 0 ? 'ecart-positif' : 'ecart-negatif';
    }
  }

  async function faireClotureZ() {
    if (!state.rapport) { Toast.warn('Générez d\'abord un rapport'); return; }
    
    if (state.activeFilter !== 'X') {
      Toast.warn('Attention : Vous devez utiliser le filtre "Par clôture" pour faire une clôture Z complète.');
      document.getElementById('filter-X').click();
      return;
    }

    const ok = await new Promise(r => Modal.confirm(
      '⚠️ Clôture Z définitive',
      'Cette opération est IRRÉVERSIBLE. Elle marque la fin de cette période et réinitialise les compteurs. Confirmer ?',
      r
    ));
    if (!ok) return;

    const totalCash = state.rapport.totalCash || 0;
    const compte = parseFloat(document.getElementById('cr-compte')?.value) || 0;
    const prelev = parseFloat(document.getElementById('cr-prelevement')?.value) || 0;
    const user = Session.getUser();

    const res = await window.api.cloture.faireClotureZ({
      ...state.rapport,
      totalCompte: compte,
      prelevement: prelev,
      vendeurNom: user?.nom || 'Admin',
    });

    if (res.success) {
      Toast.success(`Clôture Z enregistrée (${res.numero})`);
      // Imprimer
      const printRes = await window.api.printer.printCloture({
        ...state.rapport,
        type_cloture: 'Z',
        numero_rapport: res.numero,
        date_cloture: new Date().toISOString(),
        totalCompte: compte,
        prelevement: prelev,
        vendeur_nom: user?.nom,
      });
      if (!printRes.success) Toast.warn('Impression échouée — mais clôture enregistrée');

      // Remise à 0 des valeurs saisies après succès de clôture
      document.getElementById('cr-compte').value = 0;
      document.getElementById('cr-prelevement').value = 0;

      await genererRapport();
    } else {
      Toast.error(res.message);
    }
  }

  async function imprimerRapport() {
    if (!state.rapport) { Toast.warn('Aucun rapport à imprimer'); return; }
    const user = Session.getUser();
    const res = await window.api.printer.printCloture({
      ...state.rapport,
      type_cloture: state.activeFilter === 'X' ? 'X' : 'Personnalisé',
      numero_rapport: `RPT-${Date.now()}`,
      date_cloture: new Date().toISOString(),
      vendeur_nom: user?.nom,
    });
    if (res.success) Toast.success('Impression envoyée');
    else Toast.warn('Impression échouée');
  }

  function bindEvents() {
    document.getElementById('cloture-retour')?.addEventListener('click', () => Router.go('dashboard'));
    document.getElementById('btn-generer-rapport')?.addEventListener('click', genererRapport);
    document.getElementById('btn-imprimer-rapport')?.addEventListener('click', imprimerRapport);
    document.getElementById('btn-faire-z')?.addEventListener('click', faireClotureZ);

    // Filtres
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.dataset.filter;
        document.getElementById('filter-options-date').style.display = state.activeFilter === 'date' ? '' : 'none';
        document.getElementById('filter-options-vendeur').style.display = state.activeFilter === 'vendeur' ? '' : 'none';
      });
    });

    // Saisie caisse
    ['cr-compte', 'cr-prelevement'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        updateSaisie(state.rapport?.totalCash || 0);
      });
    });
  }

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'cloture') {
      if (!document.querySelector('.cloture-body')) render();
      else { genererRapport(); updateDateTime(); }
    }
  });

})();
