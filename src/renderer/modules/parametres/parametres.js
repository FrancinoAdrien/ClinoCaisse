'use strict';

(function ParametresModule() {

  let state = {
    params: {},
    activeSection: 'entreprise',
    printerList: { supported: [], system: [] },
    selectedPrinter: 'XPrinter XP80C',
  };

  function render() {
    const container = document.getElementById('view-parametres');
    container.innerHTML = `
      <div class="caisse-topbar">
        <button class="btn btn-ghost btn-sm" id="params-retour">← Retour</button>
        <span class="caisse-topbar-title">Paramètres</span>
      </div>

      <div class="params-body">
        <!-- Nav gauche -->
        <nav class="params-nav">
          <div class="params-nav-item active" data-section="entreprise">Entreprise</div>
          <div class="params-nav-item" data-section="impression">Impression</div>
          <div class="params-nav-item" data-section="caisse">Caisse</div>
          <div class="params-nav-item" data-section="systeme">Système</div>
        </nav>

        <!-- Contenu -->
        <div class="params-content">

          <!-- ENTREPRISE -->
          <div class="params-section active" id="section-entreprise">
            <h2>Informations de l'entreprise</h2>
            <div class="params-form-card">
              <h3>Identité</h3>
              <div class="form-group" style="margin-bottom:12px">
                <label>Nom de l'établissement</label>
                <input type="text" class="input" id="p-nom" placeholder="Mon Restaurant" />
              </div>
              <div class="form-row" style="margin-bottom:12px">
                <div class="form-group">
                  <label>NIF</label>
                  <input type="text" class="input" id="p-nif" placeholder="NIF de l'entreprise" />
                </div>
                <div class="form-group">
                  <label>STAT</label>
                  <input type="text" class="input" id="p-stat" placeholder="N° statistique" />
                </div>
              </div>
              <div class="form-row" style="margin-bottom:12px">
                <div class="form-group" style="flex:2">
                  <label>Adresse</label>
                  <input type="text" class="input" id="p-adresse" placeholder="123 Rue Example" />
                </div>
                <div class="form-group" style="flex:1">
                  <label>Ville</label>
                  <input type="text" class="input" id="p-ville" placeholder="Antananarivo" />
                </div>
              </div>
              <div class="form-row" style="margin-bottom:12px">
                <div class="form-group">
                  <label>Téléphone</label>
                  <input type="text" class="input" id="p-tel" placeholder="+261 XX XXX XX XX" />
                </div>
                <div class="form-group">
                  <label>Email</label>
                  <input type="email" class="input" id="p-email" placeholder="contact@exemple.com" />
                </div>
              </div>
              <div class="form-group">
                <label>Message pied de ticket (slogan)</label>
                <input type="text" class="input" id="p-slogan" placeholder="Merci de votre visite !" />
              </div>
            </div>
            <div class="params-save-bar">
              <button class="btn btn-success" id="btn-save-entreprise">Enregistrer</button>
            </div>
          </div>

          <!-- IMPRESSION -->
          <div class="params-section" id="section-impression">
            <h2>Configuration de l'impression</h2>

            <div class="params-form-card">
              <h3>Imprimante par défaut</h3>
              <div id="printer-list-supported" style="margin-bottom:12px"></div>

              <div class="form-row" style="margin-top:12px">
                <div class="form-group">
                  <label>Largeur ticket (mm)</label>
                  <select class="input" id="p-largeur">
                    <option value="58">58 mm</option>
                    <option value="76">76 mm</option>
                    <option value="80" selected>80 mm</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Copies ticket de caisse</label>
                  <input type="number" class="input" id="p-copies-ticket" value="1" min="1" max="5" />
                </div>
                <div class="form-group">
                  <label>Copies rapport clôture</label>
                  <input type="number" class="input" id="p-copies-cloture" value="2" min="1" max="5" />
                </div>
              </div>

              <div style="margin-top:12px">
                <label class="checkbox-label">
                  <input type="checkbox" id="p-impression-actif" checked />
                  Impression automatique après chaque vente
                </label>
              </div>
            </div>

            <div class="params-form-card">
              <h3>Test d'impression</h3>
              <div style="display:flex;gap:10px;align-items:center">
                <button class="btn btn-primary" id="btn-test-impression">Imprimer page de test</button>
                <button class="btn btn-ghost btn-sm" id="btn-refresh-printers">Actualiser</button>
                <span id="printer-test-result" style="font-size:13px"></span>
              </div>
            </div>

            <div class="params-save-bar">
              <button class="btn btn-success" id="btn-save-impression">Enregistrer</button>
            </div>
          </div>

          <!-- CAISSE -->
          <div class="params-section" id="section-caisse">
            <h2>Paramètres de caisse</h2>
            <div class="params-form-card">
              <h3>Remises</h3>
              <div class="form-row" style="margin-bottom:12px">
                <div class="form-group">
                  <label>Remise 1 (%)</label>
                  <input type="number" class="input" id="p-remise1" value="10" min="0" max="100" />
                </div>
                <div class="form-group">
                  <label>Remise 2 (%)</label>
                  <input type="number" class="input" id="p-remise2" value="20" min="0" max="100" />
                </div>
              </div>
            </div>
            <div class="params-form-card">
              <h3>Général</h3>
              <div class="form-row">
                <div class="form-group">
                  <label>Devise</label>
                  <input type="text" class="input" id="p-devise" value="Ar" maxlength="10" />
                </div>
                <div class="form-group">
                  <label>Nom du poste</label>
                  <input type="text" class="input" id="p-poste" value="Poste n°1" />
                </div>
              </div>
            </div>
            <div class="params-save-bar">
              <button class="btn btn-success" id="btn-save-caisse">Enregistrer</button>
            </div>
          </div>

          <!-- SYSTÈME -->
          <div class="params-section" id="section-systeme">
            <h2>Informations système</h2>
            <div class="params-form-card">
              <h3>Application</h3>
              <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;color:var(--text)">
                <div class="saisie-caisse-line"><span>Version</span><strong>1.0.0</strong></div>
                <div class="saisie-caisse-line"><span>Développé par</span><strong>ClinoKeys © 2026</strong></div>
                <div class="saisie-caisse-line"><span>Base de données</span><strong id="sys-db-path">-</strong></div>
                <div class="saisie-caisse-line"><span>Electron</span><strong id="sys-electron">-</strong></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    bindEvents();
    loadParams();
  }

  async function loadParams() {
    state.params = await window.api.parametres.getAll();

    // Entreprise
    setValue('p-nom',    state.params['entreprise.nom']       || '');
    setValue('p-nif',    state.params['entreprise.nif']       || '');
    setValue('p-stat',   state.params['entreprise.stat']      || '');
    setValue('p-adresse',state.params['entreprise.adresse']   || '');
    setValue('p-ville',  state.params['entreprise.ville']     || '');
    setValue('p-tel',    state.params['entreprise.telephone'] || '');
    setValue('p-email',  state.params['entreprise.email']     || '');
    setValue('p-slogan', state.params['entreprise.slogan']    || '');

    // Impression
    state.selectedPrinter = state.params['impression.imprimante'] || 'XPrinter XP80C';
    setValue('p-largeur',        state.params['impression.largeur']        || '80');
    setValue('p-copies-ticket',  state.params['impression.copies_ticket']  || '1');
    setValue('p-copies-cloture', state.params['impression.copies_cloture'] || '2');
    const impressionActif = document.getElementById('p-impression-actif');
    if (impressionActif) impressionActif.checked = state.params['impression.actif'] !== '0';

    // Caisse
    setValue('p-remise1', state.params['caisse.remise1']   || '10');
    setValue('p-remise2', state.params['caisse.remise2']   || '20');
    setValue('p-devise',  state.params['caisse.devise']    || 'Ar');
    setValue('p-poste',   state.params['caisse.nom_poste'] || 'Poste n°1');

    await loadPrinters();
  }

  async function loadPrinters() {
    const { supported, system } = await window.api.printer.getList();
    state.printerList = { supported, system };
    renderPrinterList(supported);
  }

  function renderPrinterList(supported) {
    const container = document.getElementById('printer-list-supported');
    if (!container) return;
    container.innerHTML = supported.map(p => `
      <div class="printer-card${state.selectedPrinter === p.id ? ' selected' : ''}"
           data-printer="${Utils.esc(p.id)}">
        <div>
          <div class="printer-name">${Utils.esc(p.label)}</div>
          <div class="printer-sub">Largeur: ${p.width}mm${p.isDefault ? ' — Imprimante par défaut' : ''}</div>
        </div>
        ${p.isDefault ? '<span class="printer-default-badge">DÉFAUT</span>' : ''}
        ${state.selectedPrinter === p.id ? '<span style="color:var(--accent);font-size:18px">✓</span>' : ''}
      </div>
    `).join('');

    container.querySelectorAll('.printer-card').forEach(card => {
      card.addEventListener('click', () => {
        state.selectedPrinter = card.dataset.printer;
        renderPrinterList(supported);
        const printer = supported.find(p => p.id === state.selectedPrinter);
        if (printer) setValue('p-largeur', String(printer.width));
      });
    });
  }

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function getValue(id) {
    return document.getElementById(id)?.value || '';
  }

  function bindEvents() {
    document.getElementById('params-retour')?.addEventListener('click', () => Router.go('dashboard'));

    // Navigation
    document.querySelectorAll('.params-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.params-nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.params-section').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        state.activeSection = item.dataset.section;
        document.getElementById(`section-${state.activeSection}`)?.classList.add('active');
      });
    });

    // Save entreprise
    document.getElementById('btn-save-entreprise')?.addEventListener('click', async () => {
      const res = await window.api.parametres.setBulk({
        'entreprise.nom':       getValue('p-nom'),
        'entreprise.nif':       getValue('p-nif'),
        'entreprise.stat':      getValue('p-stat'),
        'entreprise.adresse':   getValue('p-adresse'),
        'entreprise.ville':     getValue('p-ville'),
        'entreprise.telephone': getValue('p-tel'),
        'entreprise.email':     getValue('p-email'),
        'entreprise.slogan':    getValue('p-slogan'),
      });
      res.success ? Toast.success('Informations entreprise enregistrées') : Toast.error(res.message);
    });

    // Save impression
    document.getElementById('btn-save-impression')?.addEventListener('click', async () => {
      const res = await window.api.parametres.setBulk({
        'impression.imprimante':     state.selectedPrinter,
        'impression.largeur':        getValue('p-largeur'),
        'impression.copies_ticket':  getValue('p-copies-ticket'),
        'impression.copies_cloture': getValue('p-copies-cloture'),
        'impression.actif':          document.getElementById('p-impression-actif')?.checked ? '1' : '0',
      });
      res.success ? Toast.success('Paramètres impression enregistrés') : Toast.error(res.message);
    });

    // Save caisse
    document.getElementById('btn-save-caisse')?.addEventListener('click', async () => {
      const devise = getValue('p-devise') || 'Ar';
      localStorage.setItem('cc_devise', devise);
      const res = await window.api.parametres.setBulk({
        'caisse.remise1':   getValue('p-remise1'),
        'caisse.remise2':   getValue('p-remise2'),
        'caisse.devise':    devise,
        'caisse.nom_poste': getValue('p-poste'),
      });
      res.success ? Toast.success('Paramètres caisse enregistrés') : Toast.error(res.message);
    });

    // Test impression
    document.getElementById('btn-test-impression')?.addEventListener('click', async () => {
      const btn    = document.getElementById('btn-test-impression');
      const result = document.getElementById('printer-test-result');
      btn.disabled = true;
      const res = await window.api.printer.test(state.selectedPrinter);
      btn.disabled = false;
      if (result) {
        result.textContent = res.success ? '✅ Impression réussie' : '❌ ' + (res.message || 'Échec');
        result.style.color = res.success ? '#2ecc71' : '#e74c3c';
      }
    });

    document.getElementById('btn-refresh-printers')?.addEventListener('click', loadPrinters);
  }

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'parametres') {
      if (!document.querySelector('.params-body')) render();
      else loadParams();
    }
  });

})();
