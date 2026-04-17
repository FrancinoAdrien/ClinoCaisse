'use strict';

(function RHModule() {

  let currentTab = 'employes';

  function render() {
    const container = document.getElementById('view-rh');
    if (!container) return;
    container.innerHTML = `
      <div class="module-topbar">
        <button class="back-btn" id="rh-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Retour
        </button>
        <span class="module-topbar-title">Employés & Salaires</span>
        <div class="fin-tabs">
          <button class="fin-tab active" data-tab="employes">Employés</button>
          <button class="fin-tab" data-tab="salaires">Paiements</button>
        </div>
        <div style="flex:1"></div>
        <button class="mod-action-btn" id="rh-add-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter
        </button>
      </div>

      <div class="module-body">
        <div class="fin-stats-row">
          <div class="gros-stat-card">
            <div class="gros-stat-label">Employés actifs</div>
            <div class="gros-stat-value" id="rh-stat-employes">—</div>
          </div>
          <div class="gros-stat-card">
            <div class="gros-stat-label">Masse salariale</div>
            <div class="gros-stat-value" id="rh-stat-masse">—</div>
          </div>
          <div class="gros-stat-card">
            <div class="gros-stat-label">Avances ce mois</div>
            <div class="gros-stat-value gros-stat-danger" id="rh-stat-avances">—</div>
          </div>
          <div class="gros-stat-card">
            <div class="gros-stat-label">Reste à payer (mois)</div>
            <div class="gros-stat-value gros-stat-info" id="rh-stat-reste">—</div>
          </div>
        </div>

        <div class="fin-content-panel">
          <div id="rh-list-employes" class="fin-list"></div>
          <div id="rh-list-salaires" class="fin-list" style="display:none"></div>
        </div>
      </div>
    `;

    bindEvents();
    loadStats();
    switchTab('employes');
  }

  function bindEvents() {
    document.getElementById('rh-back')?.addEventListener('click', () => Router.go('dashboard'));
    document.getElementById('rh-add-btn')?.addEventListener('click', () => {
      currentTab === 'employes' ? showEmployeModal() : showPaiementModal();
    });
    document.querySelectorAll('#view-rh .fin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#view-rh .fin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        switchTab(tab.dataset.tab);
      });
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    document.getElementById('rh-list-employes').style.display = tab === 'employes' ? '' : 'none';
    document.getElementById('rh-list-salaires').style.display = tab === 'salaires' ? '' : 'none';
    if (tab === 'employes') loadEmployes();
    else loadSalaires();
  }

  async function loadStats() {
    try {
      const stats = await window.api.rh.getStats();
      document.getElementById('rh-stat-employes').textContent = stats.nb_employes;
      document.getElementById('rh-stat-masse').textContent = Utils.formatMontant(stats.masse_salariale);
      document.getElementById('rh-stat-avances').textContent = Utils.formatMontant(stats.avances_mois);
      document.getElementById('rh-stat-reste').textContent = Utils.formatMontant(stats.reste_a_payer_mois);
    } catch(e) { console.error(e); }
  }

  async function loadEmployes() {
    try {
      const items = await window.api.rh.getEmployes();
      const el = document.getElementById('rh-list-employes');
      if (!el) return;
      if (items.length === 0) { el.innerHTML = '<div class="empty-state">Aucun employé enregistré</div>'; return; }
      el.innerHTML = items.map(e => `
        <div class="rh-emp-row ${e.actif ? '' : 'rh-emp-inactive'}">
          <div class="rh-emp-avatar">${e.nom?.[0]?.toUpperCase() || '?'}</div>
          <div class="rh-emp-info">
            <div class="rh-emp-nom">${Utils.esc(e.nom)} ${e.actif ? '' : '<span class="badge badge-danger">Inactif</span>'}</div>
            <div class="rh-emp-poste">${Utils.esc(e.poste)}</div>
          </div>
          <div class="rh-emp-salaire">${Utils.formatMontant(e.salaire_base)}<span class="rh-emp-period">/mois</span></div>
          <div class="rh-emp-actions">
            <button class="mod-action-btn mod-action-btn-ghost rh-btn-edit" data-uuid="${e.uuid}" title="Modifier">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="mod-action-btn mod-action-btn-secondary rh-btn-pay" data-uuid="${e.uuid}" data-nom="${Utils.esc(e.nom)}" ${!e.actif ? 'disabled' : ''}>
              Payer
            </button>
          </div>
        </div>
      `).join('');

      // Event delegation - no inline handlers (CSP compliant)
      el.querySelectorAll('.rh-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => showEditEmployeModal(btn.dataset.uuid));
      });
      el.querySelectorAll('.rh-btn-pay').forEach(btn => {
        btn.addEventListener('click', async () => {
          const net = await window.api.rh.getEmployeeNetSalary(btn.dataset.uuid).catch(() => null);
          showPaiementModal(btn.dataset.uuid, btn.dataset.nom, net);
        });
      });
    } catch(e) { console.error(e); }
  }

  async function loadSalaires() {
    try {
      const items = await window.api.rh.getSalaires(50);
      const el = document.getElementById('rh-list-salaires');
      if (!el) return;
      if (items.length === 0) { el.innerHTML = '<div class="empty-state">Aucun paiement enregistré</div>'; return; }
      el.innerHTML = items.map(p => `
        <div class="fin-row">
          <div class="fin-row-cat">${Utils.esc(p.type_paiement)}</div>
          <div class="fin-row-desc">${Utils.esc(p.emp_nom)}</div>
          <div class="fin-row-right">
            <span class="fin-row-date">${p.date_paiement ? new Date(p.date_paiement).toLocaleDateString('fr-FR') : '—'}</span>
            <span class="fin-row-amount">${Utils.formatMontant(p.montant)}</span>
            <button class="mod-action-btn mod-action-btn-ghost mod-action-btn-xs rh-btn-cancel" data-uuid="${p.uuid}" style="color:var(--danger);margin-left:8px" title="Annuler">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      `).join('');

      // Event delegation - CSP compliant
      el.querySelectorAll('.rh-btn-cancel').forEach(btn => {
        btn.addEventListener('click', () => cancelPaiement(btn.dataset.uuid));
      });
    } catch(e) { console.error(e); }
  }

  function showEmployeModal() {
    const mid = Modal.open({
      title: 'Nouvel employé',
      content: `
        <div class="form-group"><label>Nom *</label><input type="text" id="emp-nom" class="form-input" /></div>
        <div class="form-group">
          <label>Poste</label>
          <select id="emp-poste" class="form-input">
            <option>Caissier</option><option>Serveur</option><option>Cuisinier</option>
            <option>Barman</option><option>Magasinier</option><option>Livreur</option>
            <option>Vendeur grossiste</option><option>Comptable</option><option>Gérant</option><option>Autre</option>
          </select>
        </div>
        <div class="form-group"><label>Salaire de base (Ar/mois)</label><input type="number" id="emp-salaire" class="form-input" value="0" /></div>
        <div class="form-group"><label>Date d'embauche</label><input type="date" id="emp-date" class="form-input" value="${new Date().toISOString().slice(0,10)}" /></div>
      `,
      footer: `
        <button class="mod-action-btn mod-action-btn-secondary" id="emp-cancel">Annuler</button>
        <button class="mod-action-btn" id="emp-save">Enregistrer</button>
      `
    });

    setTimeout(() => {
      document.getElementById('emp-cancel')?.addEventListener('click', () => Modal.close(mid));
      document.getElementById('emp-save')?.addEventListener('click', async () => {
        const nom = document.getElementById('emp-nom')?.value?.trim();
        if (!nom) { Toast.error('Nom obligatoire'); return; }
        try {
          const uuid = Utils.uid();
          await window.api.rh.addEmploye({
            uuid, 
            nom, 
            poste: document.getElementById('emp-poste')?.value,
            salaire_base: parseFloat(document.getElementById('emp-salaire')?.value || '0'),
            date_embauche: document.getElementById('emp-date')?.value
          });
          Toast.success(`Employé "${nom}" ajouté !`);
          Modal.close(mid);
          loadEmployes();
          loadStats();
        } catch(e) { Toast.error('Erreur: ' + e.message); }
      });
    }, 50);
  }

  async function showPaiementModal(preUUID = '', preNom = '', suggestedAmount = null) {
    try {
      const employes = await window.api.rh.getEmployes();
      const mid = Modal.open({
        title: 'Enregistrer un paiement',
        content: `
          <div class="form-group">
            <label>Employé *</label>
            <select id="pay-emp" class="form-input">
              ${employes.map(e => `<option value="${e.uuid}" ${e.uuid===preUUID?'selected':''}>${e.nom} — ${e.poste}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select id="pay-type" class="form-input">
              <option value="Salaire" ${suggestedAmount !== null ? 'selected' : '' }>Salaire du mois</option>
              <option value="Avance" ${suggestedAmount === null ? 'selected' : '' }>Avance sur salaire</option>
              <option value="Prime">Prime</option>
            </select>
          </div>
          <div class="form-group">
            <label>Montant * ${suggestedAmount !== null ? `<span style="font-weight:normal;opacity:0.7">(Net calculé: ${Utils.formatMontant(suggestedAmount)})</span>` : ''}</label>
            <input type="number" id="pay-montant" class="form-input" placeholder="0" value="${suggestedAmount !== null ? suggestedAmount : ''}" />
          </div>
          <div class="form-group"><label>Date</label><input type="date" id="pay-date" class="form-input" value="${new Date().toISOString().slice(0,10)}" /></div>
        `,
        footer: `
          <button class="mod-action-btn mod-action-btn-secondary" id="pay-cancel">Annuler</button>
          <button class="mod-action-btn" id="pay-save">Valider paiement</button>
        `
      });

      setTimeout(() => {
        document.getElementById('pay-cancel')?.addEventListener('click', () => Modal.close(mid));
        document.getElementById('pay-save')?.addEventListener('click', async () => {
          const empUUID = document.getElementById('pay-emp')?.value;
          const montant = parseFloat(document.getElementById('pay-montant')?.value || '0');
          if (!empUUID || !montant || montant <= 0) { Toast.error('Employé et montant obligatoires'); return; }
          try {
            const uuid = Utils.uid();
            const user = Session.getUser();
            await window.api.rh.addPaiement({
              uuid, 
              employe_uuid: empUUID, 
              type_paiement: document.getElementById('pay-type')?.value, 
              montant,
              date_paiement: document.getElementById('pay-date')?.value, 
              operateur: user?.nom || ''
            });
            Toast.success('Paiement enregistré !');
            Modal.close(mid);
            loadSalaires();
            loadStats();
          } catch(e) { Toast.error('Erreur: ' + e.message); }
        });
      }, 50);
    } catch(e) { Toast.error('Erreur: ' + e.message); }
  }

  async function showEditEmployeModal(uuid) {
    try {
      const employes = await window.api.rh.getEmployes();
      const e = employes.find(emp => emp.uuid === uuid);
      if (!e) return;

      const mid = Modal.open({
        title: 'Modifier employé',
        content: `
          <div class="form-group"><label>Nom *</label><input type="text" id="edit-emp-nom" class="form-input" value="${Utils.esc(e.nom)}" /></div>
          <div class="form-group">
            <label>Poste</label>
            <select id="edit-emp-poste" class="form-input">
              ${['Caissier','Serveur','Cuisinier','Barman','Magasinier','Livreur','Vendeur grossiste','Comptable','Gérant','Autre']
                .map(p => `<option ${e.poste===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Salaire de base (Ar/mois)</label><input type="number" id="edit-emp-salaire" class="form-input" value="${e.salaire_base}" /></div>
          <div class="form-group"><label>Date d'embauche</label><input type="date" id="edit-emp-date" class="form-input" value="${e.date_embauche}" /></div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="edit-emp-actif" ${e.actif?'checked':''} />
              Employé en activité (non renvoyé)
            </label>
          </div>
        `,
        footer: `
          <button class="mod-action-btn mod-action-btn-secondary" id="edit-emp-cancel">Annuler</button>
          <button class="mod-action-btn" id="edit-emp-save">Enregistrer</button>
        `
      });

      setTimeout(() => {
        document.getElementById('edit-emp-cancel')?.addEventListener('click', () => Modal.close(mid));
        document.getElementById('edit-emp-save')?.addEventListener('click', async () => {
          const nom = document.getElementById('edit-emp-nom')?.value?.trim();
          if (!nom) { Toast.error('Nom obligatoire'); return; }
          try {
            await window.api.rh.updateEmploye({
              uuid: e.uuid, 
              nom, 
              poste: document.getElementById('edit-emp-poste')?.value,
              salaire_base: parseFloat(document.getElementById('edit-emp-salaire')?.value || '0'),
              date_embauche: document.getElementById('edit-emp-date')?.value,
              actif: document.getElementById('edit-emp-actif')?.checked ? 1 : 0
            });
            Toast.success('Modifications enregistrées');
            Modal.close(mid);
            loadEmployes();
            loadStats();
          } catch(err) { Toast.error('Erreur: ' + err.message); }
        });
      }, 50);
    } catch(err) { console.error(err); }
  }

  async function cancelPaiement(uuid) {
    const ok = await new Promise(r => Modal.confirm('Annulation', 'Voulez-vous vraiment annuler ce paiement ?', r));
    if (!ok) return;
    try {
      await window.api.rh.deletePaiement(uuid);
      Toast.success('Paiement annulé');
      loadSalaires();
      loadStats();
    } catch(e) { Toast.error('Erreur: ' + e.message); }
  }

  window.RHModule = {
    showPaiementFor: async (uuid, nom) => {
      try {
        const net = await window.api.rh.getEmployeeNetSalary(uuid);
        showPaiementModal(uuid, nom, net);
      } catch(e) { showPaiementModal(uuid, nom); }
    },
    editEmploye: (uuid) => showEditEmployeModal(uuid),
    cancelPaiement: (uuid) => cancelPaiement(uuid)
  };
  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'rh') render();
  });
})();
