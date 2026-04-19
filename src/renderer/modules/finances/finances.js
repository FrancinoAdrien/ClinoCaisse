'use strict';

(function FinancesModule() {

  let currentTab = 'mouvements';
  let currentUser = null;

  function render() {
    currentUser = Session.getUser();
    const isAdmin = currentUser?.role === 'admin';
    const container = document.getElementById('view-finances');
    if (!container) return;

    container.innerHTML = `
      <div class="module-topbar">
        <button class="back-btn" id="fin-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Retour
        </button>
        <span class="module-topbar-title">Finances</span>
        <div class="fin-tabs">
          <button class="fin-tab" data-tab="mouvements">Mouvements</button>
          <button class="fin-tab" data-tab="recettes">Recettes</button>
          <button class="fin-tab" data-tab="depenses">Dépenses</button>
          <button class="fin-tab" data-tab="dettes">Dettes</button>
          ${isAdmin ? '<button class="fin-tab" data-tab="capital">Capital</button>' : ''}
        </div>
        <div style="flex:1"></div>
        <button class="mod-action-btn" id="fin-add-btn" style="display:none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span id="fin-add-label">Ajouter</span>
        </button>
      </div>

      <div class="module-body">
        <div class="fin-stats-row" id="fin-stats-row">
          <div class="gros-stat-card">
            <div class="gros-stat-label">Capital</div>
            <div class="gros-stat-value gros-stat-info" id="fin-stat-capital">—</div>
          </div>
          <div class="gros-stat-card">
            <div class="gros-stat-label">Recettes (mois)</div>
            <div class="gros-stat-value gros-stat-success" id="fin-stat-recettes">—</div>
          </div>
          <div class="gros-stat-card">
            <div class="gros-stat-label">Bénéfices (mois)</div>
            <div class="gros-stat-value gros-stat-accent" id="fin-stat-benefice">—</div>
          </div>
          <div class="gros-stat-card">
            <div class="gros-stat-label">Dépenses (mois)</div>
            <div class="gros-stat-value" id="fin-stat-depenses">—</div>
          </div>
          <div class="gros-stat-card">
            <div class="gros-stat-label">Dettes totales</div>
            <div class="gros-stat-value gros-stat-danger" id="fin-stat-dettes">—</div>
          </div>
          <div class="gros-stat-card">
            <div class="gros-stat-label">Créances à encaisser</div>
            <div class="gros-stat-value gros-stat-warn" id="fin-stat-creances">—</div>
          </div>
        </div>

        <div class="fin-content-panel">
          <!-- MOUVEMENTS -->
          <div id="fin-panel-mouvements" class="fin-list"></div>
          <!-- RECETTES -->
          <div id="fin-panel-recettes" class="fin-list" style="display:none"></div>
          <!-- DÉPENSES -->
          <div id="fin-panel-depenses" class="fin-list" style="display:none"></div>
          <!-- DETTES -->
          <div id="fin-panel-dettes" class="fin-list" style="display:none"></div>
          <!-- CAPITAL (admin) -->
          <div id="fin-panel-capital" class="fin-list" style="display:none">
            <div class="fin-capital-panel">
              <div class="fin-capital-display">
                <div class="gros-stat-label">Capital actuel</div>
                <div class="fin-capital-value" id="fin-capital-value">—</div>
              </div>
              <div style="margin-top:24px;display:flex;gap:12px;max-width:400px">
                <button class="mod-action-btn" id="fin-btn-ajout-cap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Ajouter au capital
                </button>
                <button class="mod-action-btn mod-action-btn-secondary" id="fin-btn-retrait-cap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/></svg>
                  Retirer du capital
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    loadStats();
    switchTab('mouvements');
  }

  function bindEvents() {
    document.getElementById('fin-back')?.addEventListener('click', () => Router.go('dashboard'));

    document.querySelectorAll('.fin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.fin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        switchTab(tab.dataset.tab);
      });
    });

    document.getElementById('fin-add-btn')?.addEventListener('click', () => {
      if (currentTab === 'depenses') showCommanderModal();
      else if (currentTab === 'recettes') showCreanceModal();
      else if (currentTab === 'dettes') showCommanderModal();
    });

    document.getElementById('fin-btn-ajout-cap')?.addEventListener('click', () => showFluxModal('ajout_capital'));
    document.getElementById('fin-btn-retrait-cap')?.addEventListener('click', () => showFluxModal('retrait_capital'));
  }

  function switchTab(tab) {
    currentTab = tab;
    const panels = ['mouvements', 'recettes', 'depenses', 'dettes', 'capital'];
    panels.forEach(p => {
      const el = document.getElementById(`fin-panel-${p}`);
      if (el) el.style.display = p === tab ? '' : 'none';
    });

    // Show/hide add button
    const addBtn = document.getElementById('fin-add-btn');
    const addLabel = document.getElementById('fin-add-label');
    if (addBtn) {
      if (tab === 'depenses' || tab === 'dettes') {
        addBtn.style.display = '';
        if (addLabel) addLabel.textContent = 'Commander';
      } else if (tab === 'recettes') {
        addBtn.style.display = '';
        if (addLabel) addLabel.textContent = 'Créance';
      } else {
        addBtn.style.display = 'none';
      }
    }

    if (tab === 'mouvements') loadMouvements();
    else if (tab === 'recettes') loadRecettes();
    else if (tab === 'depenses') loadDepenses();
    else if (tab === 'dettes') loadDettes();
    else if (tab === 'capital') loadCapital();
  }

  async function loadStats() {
    try {
      const stats = await window.api.finances.getStats();
      document.getElementById('fin-stat-capital').textContent    = Utils.formatMontant(stats.capital);
      document.getElementById('fin-stat-recettes').textContent   = Utils.formatMontant(stats.recettes_mois);
      document.getElementById('fin-stat-benefice').textContent   = Utils.formatMontant(stats.benefice_mois);
      document.getElementById('fin-stat-depenses').textContent   = Utils.formatMontant(stats.depenses_mois);
      document.getElementById('fin-stat-dettes').textContent     = Utils.formatMontant(stats.dettes_total);
      document.getElementById('fin-stat-creances').textContent   = Utils.formatMontant(stats.creances_total);
    } catch(e) { console.error(e); }
  }

  async function loadCapital() {
    try {
      const capital = await window.api.finances.getCapital();
      const el = document.getElementById('fin-capital-value');
      if (el) el.textContent = Utils.formatMontant(capital);
    } catch(e) { console.error(e); }
  }

  function showFluxModal(type) {
    const isAjout = type === 'ajout_capital';
    const title = isAjout ? 'Ajouter au capital' : 'Retirer du capital';
    const btnText = isAjout ? 'Ajouter' : 'Retirer';

    const mid = Modal.open({
      title: title,
      content: `
        <div class="form-group">
          <label>Montant (Ar) *</label>
          <input type="number" id="flux-montant" class="form-input" placeholder="0" min="1" step="100" />
        </div>
        <div class="form-group">
          <label>Motif / Origine *</label>
          <input type="text" id="flux-motif" class="form-input" placeholder="Ex: Investissement, Retrait propriétaire..." />
        </div>
      `,
      footer: `
        <button class="mod-action-btn mod-action-btn-secondary" id="flux-cancel">Annuler</button>
        <button class="mod-action-btn" id="flux-save">${btnText}</button>
      `
    });

    setTimeout(() => {
      document.getElementById('flux-cancel')?.addEventListener('click', () => Modal.close(mid));
      document.getElementById('flux-save')?.addEventListener('click', async () => {
        const montant = parseFloat(document.getElementById('flux-montant')?.value || '0');
        const motif = document.getElementById('flux-motif')?.value?.trim();

        if (!montant || montant <= 0) { Toast.error('Montant invalide'); return; }
        if (!motif) { Toast.error('Veuillez indiquer un motif'); return; }

        try {
          const btn = document.getElementById('flux-save');
          if (btn) btn.disabled = true;

          const res = await window.api.finances.addFlux({
            type_flux: type,
            montant,
            motif,
            operateur: currentUser?.nom || 'Admin'
          });

          if (res.success !== false) {
            Toast.success('Capital mis à jour !');
            Modal.close(mid);
            loadStats();
            if (currentTab === 'capital') loadCapital();
            if (currentTab === 'mouvements') loadMouvements();
            if (currentTab === 'recettes') loadRecettes();
          } else {
            Toast.error('Erreur: ' + res.message);
            if (btn) btn.disabled = false;
          }
        } catch (e) {
          Toast.error(e.message);
        }
      });
    }, 50);
  }

  async function loadMouvements() {
    const el = document.getElementById('fin-panel-mouvements');
    if (!el) return;
    try {
      const items = await window.api.finances.getMouvements(100);
      if (items.length === 0) { el.innerHTML = '<div class="empty-state">Aucun mouvement</div>'; return; }
      el.innerHTML = items.map(m => {
        let badgeChar = m.sens === 'entree' ? '▲' : '▼';
        let badgeClass = m.sens === 'entree' ? 'fin-badge-entree' : 'fin-badge-sortie';
        let amountClass = m.sens === 'entree' ? 'text-success' : 'text-danger';
        let amountPrefix = m.sens === 'entree' ? '+' : '-';

        if (m.sens === 'perte') {
          badgeChar = '×';
          badgeClass = 'fin-badge-perte';
          amountClass = 'text-neutral'; // Or something subtle
          amountPrefix = '';
        }

        return `
          <div class="fin-row fin-mvt-row ${m.sens}">
            <div class="fin-mvt-badge ${badgeClass}">
              ${badgeChar}
            </div>
            <div class="fin-row-cat">${Utils.esc(m.libelle)}</div>
            <div class="fin-row-desc" style="opacity:0.7">${Utils.esc(m.detail || '')}</div>
            <div class="fin-row-right">
              <span class="fin-row-date">${m.date_op ? new Date(m.date_op).toLocaleDateString('fr-FR') + ' ' + new Date(m.date_op).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '—'}</span>
              <span class="fin-row-amount ${amountClass}">
                ${amountPrefix}${Utils.formatMontant(m.montant)}
              </span>
            </div>
          </div>
        `;
      }).join('');
    } catch(e) { console.error(e); el.innerHTML = '<div class="empty-state">Erreur de chargement</div>'; }
  }

  async function loadRecettes() {
    const el = document.getElementById('fin-panel-recettes');
    if (!el) return;
    try {
      const [ventes, creances] = await Promise.all([
        window.api.finances.getRecettes(50),
        window.api.finances.getCreances()
      ]);

      let html = '';

      // Section: Créances clients en attente (incluant celles issues de grossiste)
      const creancesEnAttente = creances.filter(c => c.statut === 'en_attente');
      if (creancesEnAttente.length > 0) {
        html += `<div class="fin-section-header">Créances à encaisser (${creancesEnAttente.length})</div>`;
        html += creancesEnAttente.map(c => `
          <div class="fin-row">
            <div class="fin-row-cat" style="color:var(--warning)">⏳ Créance</div>
            <div class="fin-row-desc">
              <strong>${Utils.esc(c.client_nom)}</strong>
              ${c.description ? ' — ' + Utils.esc(c.description) : ''}
            </div>
            <div class="fin-row-right">
              <span class="fin-row-date">${c.date_echeance ? 'Échéance: ' + new Date(c.date_echeance).toLocaleDateString('fr-FR') : c.date_creation ? new Date(c.date_creation).toLocaleDateString('fr-FR') : '—'}</span>
              <span class="fin-row-amount text-warning">${Utils.formatMontant(c.montant)}</span>
              <button class="mod-action-btn mod-action-btn-secondary fin-btn-encaisser" data-uuid="${c.uuid}" style="margin-left:8px;padding:4px 10px;font-size:12px">Encaisser</button>
            </div>
          </div>
        `).join('');
      } else {
        html += `<div class="fin-section-header">Créances à encaisser</div>`;
        html += '<div class="empty-state" style="padding:12px">Aucune créance en attente</div>';
      }

      // Section: Ventes récentes (BAR + GROSSISTE)
      html += `<div class="fin-section-header" style="margin-top:16px">Ventes enregistrées</div>`;
      if (ventes.length === 0) {
        html += '<div class="empty-state">Aucune vente enregistrée</div>';
      } else {
        html += ventes.map(v => {
          const paye = v.montant_paye != null ? v.montant_paye : v.total_ttc;
          const dette = Math.max(0, (v.total_ttc || 0) - (paye || 0));
          const isGros = v.type_vente === 'GROSSISTE';
          const modeIcon = isGros
            ? (v.mode_paiement === 'CREDIT' ? '🔴' : v.mode_paiement === 'PARTIEL' ? '🟡' : '🟢')
            : '🧾';
          return `
            <div class="fin-row">
              <div class="fin-row-cat">
                ${modeIcon} ${Utils.esc(v.type_vente || 'BAR')}
              </div>
              <div class="fin-row-desc">
                ${Utils.esc(v.nom_caissier || '—')} · ${Utils.esc(v.mode_paiement || 'CASH')}
                ${v.numero_ticket ? ' · ' + Utils.esc(v.numero_ticket) : ''}
              </div>
              <div class="fin-row-right">
                <span class="fin-row-date">${v.date_vente ? new Date(v.date_vente).toLocaleDateString('fr-FR') : '—'}</span>
                <span class="fin-row-amount text-success">+${Utils.formatMontant(paye)}</span>
                ${dette > 0 ? `<span style="font-size:11px;color:var(--danger);margin-left:4px">(dette: ${Utils.formatMontant(dette)})</span>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }

      el.innerHTML = html;

      // Bind encaisser buttons (CSP compliant)
      el.querySelectorAll('.fin-btn-encaisser').forEach(btn => {
        btn.addEventListener('click', async () => {
          const res = await window.api.finances.encaisserCreance(btn.dataset.uuid);
          if (res?.success !== false) {
            Toast.success('Créance encaissée ! Capital mis à jour.');
          }
          loadStats();
          loadRecettes();
        });
      });
    } catch(e) { console.error(e); el.innerHTML = '<div class="empty-state">Erreur de chargement</div>'; }
  }

  async function loadDepenses() {
    const el = document.getElementById('fin-panel-depenses');
    if (!el) return;
    try {
      const items = await window.api.finances.getDepenses(100);
      if (items.length === 0) { el.innerHTML = '<div class="empty-state">Aucune dépense enregistrée</div>'; return; }
      el.innerHTML = items.map(d => `
        <div class="fin-row">
          <div class="fin-row-cat ${d.statut === 'commande' ? 'text-warning' : ''}">
            ${d.statut === 'commande' ? '📦 Commandé' : '✓ Payé'} · ${Utils.esc(d.categorie || '—')}
          </div>
          <div class="fin-row-desc">${Utils.esc(d.description || '')}${d.fournisseur_nom ? ' · ' + Utils.esc(d.fournisseur_nom) : ''}</div>
          <div class="fin-row-right">
            <span class="fin-row-date">${d.date_depense ? new Date(d.date_depense).toLocaleDateString('fr-FR') : '—'}</span>
            <span class="fin-row-amount text-danger">-${Utils.formatMontant(d.montant)}</span>
          </div>
        </div>
      `).join('');
    } catch(e) { console.error(e); el.innerHTML = '<div class="empty-state">Erreur de chargement</div>'; }
  }

  async function loadDettes() {
    const el = document.getElementById('fin-panel-dettes');
    if (!el) return;
    try {
      const items = await window.api.finances.getDettes();
      if (items.length === 0) { el.innerHTML = '<div class="empty-state">Aucune dette fournisseur</div>'; return; }
      el.innerHTML = items.map(d => `
        <div class="fin-row" data-dette-uuid="${d.uuid}">
          <div class="fin-row-cat">📦 ${Utils.esc(d.categorie || '—')}</div>
          <div class="fin-row-desc">${Utils.esc(d.description || '')}${d.fournisseur_nom ? ' · Fourni par: ' + Utils.esc(d.fournisseur_nom) : ''}</div>
          <div class="fin-row-right">
            <span class="fin-row-date">${d.date_depense ? new Date(d.date_depense).toLocaleDateString('fr-FR') : '—'}</span>
            <span class="fin-row-amount text-danger">${Utils.formatMontant(d.montant)}</span>
            <button class="mod-action-btn mod-action-btn-secondary fin-btn-payer" data-uuid="${d.uuid}" style="margin-left:8px;padding:4px 10px;font-size:12px">Payer</button>
          </div>
        </div>
      `).join('');

      // Bind payer buttons (CSP compliant)
      el.querySelectorAll('.fin-btn-payer').forEach(btn => {
        btn.addEventListener('click', async () => {
          await window.api.finances.payerDepense(btn.dataset.uuid);
          Toast.success('Dépense marquée comme payée !');
          loadStats();
          loadDettes();
        });
      });
    } catch(e) { console.error(e); el.innerHTML = '<div class="empty-state">Erreur de chargement</div>'; }
  }

  function showCommanderModal() {
    const cats = ['Achats stock', 'Fournitures', 'Équipement', 'Loyer', 'Électricité', 'Transport', 'Services', 'Autre'];
    const mid = Modal.open({
      title: 'Commander / Enregistrer une dépense',
      content: `
        <div class="form-group">
          <label>Catégorie</label>
          <select id="cmd-cat" class="form-input">${cats.map(c => `<option>${c}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Fournisseur / Prestataire</label><input type="text" id="cmd-four" class="form-input" placeholder="Nom (optionnel)" /></div>
        <div class="form-group"><label>Description</label><input type="text" id="cmd-desc" class="form-input" placeholder="Détail de la commande" /></div>
        <div class="form-group"><label>Montant *</label><input type="number" id="cmd-montant" class="form-input" placeholder="0" min="0" step="100" /></div>
        <div class="form-group"><label>Date</label><input type="date" id="cmd-date" class="form-input" value="${new Date().toISOString().slice(0,10)}" /></div>
        <div class="form-group">
          <label>Statut</label>
          <select id="cmd-statut" class="form-input">
            <option value="commande">📦 Commander (créer une dette)</option>
            <option value="payee">✓ Payer immédiatement</option>
          </select>
        </div>
      `,
      footer: `
        <button class="mod-action-btn mod-action-btn-secondary" id="cmd-cancel">Annuler</button>
        <button class="mod-action-btn" id="cmd-save">Enregistrer</button>
      `
    });

    setTimeout(() => {
      document.getElementById('cmd-cancel')?.addEventListener('click', () => Modal.close(mid));
      document.getElementById('cmd-save')?.addEventListener('click', async () => {
        const montant = parseFloat(document.getElementById('cmd-montant')?.value || '0');
        if (!montant || montant <= 0) { Toast.error('Montant obligatoire'); return; }
        const statut = document.getElementById('cmd-statut')?.value;
        const user = Session.getUser();
        try {
          const uuid = Utils.uid();
          if (statut === 'commande') {
            await window.api.finances.commander({
              uuid,
              categorie: document.getElementById('cmd-cat')?.value,
              fournisseur_nom: document.getElementById('cmd-four')?.value?.trim() || '',
              description: document.getElementById('cmd-desc')?.value?.trim() || '',
              montant,
              date_depense: document.getElementById('cmd-date')?.value,
              operateur: user?.nom || 'Connecté'
            });
            Toast.success('Commande enregistrée (dette créée) !');
          } else {
            await window.api.finances.addDepense({
              uuid,
              categorie: document.getElementById('cmd-cat')?.value,
              description: (document.getElementById('cmd-desc')?.value?.trim() || ''),
              montant,
              date_depense: document.getElementById('cmd-date')?.value,
              operateur: user?.nom || 'Connecté'
            });
            Toast.success('Dépense enregistrée !');
          }
          Modal.close(mid);
          loadStats();
          if (statut === 'commande') loadDettes(); else loadDepenses();
        } catch(e) { Toast.error('Erreur: ' + e.message); }
      });
    }, 50);
  }

  function showCreanceModal() {
    const mid = Modal.open({
      title: 'Nouvelle créance client',
      content: `
        <div class="form-group"><label>Client *</label><input type="text" id="cr-nom" class="form-input" placeholder="Nom du client" /></div>
        <div class="form-group"><label>Description</label><input type="text" id="cr-desc" class="form-input" placeholder="Motif de la créance" /></div>
        <div class="form-group"><label>Montant *</label><input type="number" id="cr-montant" class="form-input" placeholder="0" /></div>
        <div class="form-group"><label>Date d'échéance</label><input type="date" id="cr-echeance" class="form-input" /></div>
      `,
      footer: `
        <button class="mod-action-btn mod-action-btn-secondary" id="cr-cancel">Annuler</button>
        <button class="mod-action-btn" id="cr-save">Enregistrer</button>
      `
    });

    setTimeout(() => {
      document.getElementById('cr-cancel')?.addEventListener('click', () => Modal.close(mid));
      document.getElementById('cr-save')?.addEventListener('click', async () => {
        const nom = document.getElementById('cr-nom')?.value?.trim();
        const montant = parseFloat(document.getElementById('cr-montant')?.value || '0');
        if (!nom) { Toast.error('Nom du client obligatoire'); return; }
        if (!montant || montant <= 0) { Toast.error('Montant obligatoire'); return; }
        try {
          const user = Session.getUser();
          await window.api.finances.addCreance({
            uuid: Utils.uid(), client_nom: nom,
            description: document.getElementById('cr-desc')?.value?.trim() || '',
            montant,
            date_echeance: document.getElementById('cr-echeance')?.value || '',
            operateur: user?.nom || 'Connecté'
          });
          Toast.success('Créance enregistrée !');
          Modal.close(mid);
          loadStats();
          loadRecettes();
        } catch(e) { Toast.error('Erreur: ' + e.message); }
      });
    }, 50);
  }

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'finances') render();
  });
})();
