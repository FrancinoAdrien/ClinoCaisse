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
          <div class="params-nav-item" data-section="rh">RH</div>
          <div class="params-nav-item" data-section="systeme">Système</div>
          <div class="params-nav-item params-nav-admin" data-section="cloud" id="nav-cloud" style="display:none">
            ☁ Cloud
          </div>
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

          <!-- RH -->
          <div class="params-section" id="section-rh">
            <h2>Ressources Humaines</h2>
            <div class="params-form-card">
              <h3>Salaires</h3>
              <div class="form-group">
                <label>Jour du mois pour le paiement (1-31)</label>
                <input type="number" class="input" id="p-rh-jour" value="1" min="1" max="31" />
                <p style="font-size:12px;opacity:0.7;margin-top:4px">Définit le jour où les salaires sont attendus par défaut.</p>
              </div>
            </div>
            <div class="params-save-bar">
              <button class="btn btn-success" id="btn-save-rh">Enregistrer</button>
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

          <!-- CLOUD (Admin seulement) -->
          <div class="params-section" id="section-cloud">
            <h2>☁ Synchronisation Cloud (Supabase)</h2>

            <div class="params-form-card">
              <h3>Connexion Supabase</h3>
              <div class="form-group" style="margin-bottom:12px">
                <label>URL de la Base de Données</label>
                <input type="url" class="input" id="p-sync-url"
                  placeholder="https://xxxxxxxxxxxx.supabase.co" />
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <label>Clé API (anon ou service_role)</label>
                <input type="password" class="input" id="p-sync-key"
                  placeholder="eyJh..." />
              </div>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <button class="btn btn-success" id="btn-sync-save">Enregistrer &amp; Connecter</button>
                <button class="btn btn-primary" id="btn-sync-test">🔌 Tester la connexion</button>
                <span id="sync-status-badge" style="font-size:13px;padding:4px 10px;border-radius:20px;background:var(--surface-2)">Non configuré</span>
              </div>
            </div>

            <div class="params-form-card">
              <h3>Actions manuelles</h3>
              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
                <button class="btn btn-primary btn-sm" id="btn-sync-push">⬆ Push (envoyer)</button>
                <button class="btn btn-primary btn-sm" id="btn-sync-pull">⬇ Pull (recevoir)</button>
                <button class="btn btn-success btn-sm" id="btn-sync-fullpull">📥 Pull Total (Cloud → App)</button>
                <button class="btn btn-warning btn-sm" id="btn-sync-tables">🗳 Envoyer les tables</button>
                <button class="btn btn-ghost btn-sm" id="btn-sync-fullpush">🔄 Forcer l’envoi total</button>
                <button class="btn btn-ghost btn-sm" id="btn-sync-backup">💾 Backup SQLite local</button>
              </div>
              <div id="sync-info" style="font-size:12px;color:var(--text-muted);display:flex;flex-direction:column;gap:4px">
                <div>En attente de synchronisation : <strong id="sync-pending">—</strong></div>
                <div>Dernière synchronisation : <strong id="sync-last">—</strong></div>
              </div>
            </div>

            <div class="params-form-card" style="background:rgba(255,165,0,0.07);border-color:rgba(255,165,0,0.3)">
              <h3 style="color:#f39c12">&#9888; Comment créer votre Supabase</h3>
              <ol style="font-size:12.5px;color:var(--text-muted);padding-left:18px;line-height:1.9">
                <li>Aller sur <strong>supabase.com</strong> → Créer un compte gratuit</li>
                <li>Créer un nouveau projet, choisir une région proche</li>
                <li>Dans <em>Settings → API</em> : copier l’<strong>URL</strong> et la clé <strong>anon public</strong></li>
                <li>Coller ces deux valeurs dans les champs ci-dessus</li>
                <li>Cliquer <strong>« Enregistrer & Connecter »</strong></li>
                <li><strong>IMPORTANT</strong> : Si c'est un nouveau projet, vous devez autoriser l'exécution de scripts une seule fois (Suivez le guide si une erreur s'affiche).</li>
                <li>Utiliser le bouton <strong>« Envoyer les tables »</strong> pour initialiser la structure du cloud</li>
              </ol>
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

    // RH
    setValue('p-rh-jour', state.params['rh.jour_paiement'] || '1');

    await loadPrinters();

    // Afficher l'onglet Cloud si admin
    const user = Session.getUser();
    const navCloud = document.getElementById('nav-cloud');
    if (navCloud) navCloud.style.display = (user && user.role === 'admin') ? '' : 'none';

    // Charger les clés sync si admin
    if (user && user.role === 'admin') {
      try {
        const cfg = await window.api.sync.getConfig();
        setValue('p-sync-url', cfg.url || '');
        setValue('p-sync-key', cfg.key || '');
        await loadSyncStatus();
      } catch {}
    }
  }

  async function loadPrinters() {
    const { supported, system } = await window.api.printer.getList();
    state.printerList = { supported, system };
    renderPrinterList(supported);
  }

  async function loadSyncStatus() {
    try {
      const status = await window.api.sync.getStatus();
      const pendingEl = document.getElementById('sync-pending');
      const lastEl    = document.getElementById('sync-last');
      const badge     = document.getElementById('sync-status-badge');
      if (pendingEl) pendingEl.textContent = status.pending || 0;
      if (lastEl)    lastEl.textContent    = status.lastSyncAt || 'Jamais';
      if (badge && status.configured && badge.textContent === 'Non configuré') {
        badge.textContent       = '✅ Connecté';
        badge.style.background  = 'rgba(46,204,113,0.15)';
        badge.style.color       = '#2ecc71';
      }
    } catch {}
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

    // Save RH
    document.getElementById('btn-save-rh')?.addEventListener('click', async () => {
      const res = await window.api.parametres.setBulk({
        'rh.jour_paiement': getValue('p-rh-jour'),
      });
      res.success ? Toast.success('Paramètres RH enregistrés') : Toast.error(res.message);
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

    // ── CLOUD SYNC ───────────────────────────────────────────────────────────
    function setSyncBadge(msg, ok) {
      const badge = document.getElementById('sync-status-badge');
      if (!badge) return;
      badge.textContent = msg;
      badge.style.background = ok ? 'rgba(46,204,113,0.15)' : ok === false ? 'rgba(231,76,60,0.15)' : 'var(--surface-2)';
      badge.style.color = ok ? '#2ecc71' : ok === false ? '#e74c3c' : 'var(--text-muted)';
    }

    // Enregistrer & Connecter
    document.getElementById('btn-sync-save')?.addEventListener('click', async () => {
      const url = getValue('p-sync-url').trim();
      const key = getValue('p-sync-key').trim();
      if (!url || !key) { Toast.error('Veuillez remplir l\'URL et la clé API.'); return; }
      setSyncBadge('Connexion en cours...', null);
      const btn = document.getElementById('btn-sync-save');
      if (btn) btn.disabled = true;
      const res = await window.api.sync.configure(url, key);
      if (btn) btn.disabled = false;
      if (res.success) {
        setSyncBadge('✅ Connecté', true);
        Toast.success('☁ Connexion Supabase établie !');
        
        // Déclencher le premier Pull Total automatiquement si la base est neuve
        const status = await window.api.sync.getStatus();
        if (status.pending === 0 && !status.lastSyncAt) {
          Toast.info('📦 Récupération initiale des données Cloud...');
          await window.api.sync.fullPull();
        }
        
        await loadSyncStatus();
      } else {
        setSyncBadge('❌ Échec', false);
        Toast.error(res.message || 'Échec de la connexion');
      }
    });

    // Tester
    document.getElementById('btn-sync-test')?.addEventListener('click', async () => {
      setSyncBadge('Test en cours...', null);
      const res = await window.api.sync.test();
      setSyncBadge(res.success ? '✅ Connecté' : '❌ Échec', res.success);
      res.success ? Toast.success(res.message) : Toast.error(res.message);
    });

    // Push
    document.getElementById('btn-sync-push')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-sync-push');
      if (btn) btn.disabled = true;
      const res = await window.api.sync.push();
      if (btn) btn.disabled = false;
      if (res.success) { Toast.success(`⬆ ${res.pushed} enregistrement(s) envoyé(s)`); await loadSyncStatus(); }
      else Toast.error(res.message || 'Échec du push');
    });

    // Pull
    document.getElementById('btn-sync-pull')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-sync-pull');
      if (btn) btn.disabled = true;
      const res = await window.api.sync.pull();
      if (btn) btn.disabled = false;
      if (res.success) { Toast.success(`⬇ ${res.pulled} enregistrement(s) récupéré(s)`); await loadSyncStatus(); }
      else Toast.error(res.message || 'Échec du pull');
    });

    // Pull Total
    document.getElementById('btn-sync-fullpull')?.addEventListener('click', async () => {
      const ok = await new Promise(r => Modal.confirm(
        '📥 Récupération Totale',
        'Cela va forcer la récupération de TOUTES les données présentes sur le Cloud. Continuer ?',
        r
      ));
      if (!ok) return;
      
      const btn = document.getElementById('btn-sync-fullpull');
      if (btn) btn.disabled = true;
      const res = await window.api.sync.fullPull();
      if (btn) btn.disabled = false;
      
      if (res.success) {
        Toast.success(`✅ ${res.pulled} enregistrements récupérés du Cloud.`);
        await loadSyncStatus();
      } else {
        Toast.error(res.message || 'Échec de la récupération');
      }
    });

    // Full Push
    document.getElementById('btn-sync-fullpush')?.addEventListener('click', async () => {
      const ok = await new Promise(r => Modal.confirm(
        'Forcer l\'envoi total',
        'Cela va reset et renvoyer TOUTES les données locales vers le cloud. Continuer ?',
        r
      ));
      if (!ok) return;
      const btn = document.getElementById('btn-sync-fullpush');
      if (btn) btn.disabled = true;
      const res = await window.api.sync.fullPush();
      if (btn) btn.disabled = false;
      if (res.success) { Toast.success(`🔄 Envoi total : ${res.pushed} enregistrements`); await loadSyncStatus(); }
      else Toast.error(res.message || 'Échec');
    });

    // Backup
    document.getElementById('btn-sync-backup')?.addEventListener('click', async () => {
      const res = await window.api.sync.backupLocal();
      res.success ? Toast.success('💾 ' + res.message) : (res.message !== 'Annulé' && Toast.error(res.message));
    });

    // Envoyer les tables
    document.getElementById('btn-sync-tables')?.addEventListener('click', async () => {
      const ok = await new Promise(r => Modal.confirm(
        'Envoyer la structure',
        'Cela va exécuter le script SQL sur Supabase pour créer ou mettre à jour les tables. Continuer ?',
        r
      ));
      if (!ok) return;

      const btn = document.getElementById('btn-sync-tables');
      if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours…'; }
      
      const res = await window.api.sync.sendTables();
      
      if (btn) { btn.disabled = false; btn.textContent = '🗳 Envoyer les tables'; }
      
      if (res.success) {
        Toast.success('✅ ' + res.message);
      } else if (res.code === 'MISSING_RPC') {
        showRpcHelpModal();
      } else {
        Toast.error('❌ ' + (res.message || 'Erreur lors de l\'envoi du schéma'));
      }
    });

    function showRpcHelpModal() {
      const sql = `CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)\nRETURNS void AS $$\nBEGIN\n  EXECUTE sql;\nEND;\n$$ LANGUAGE plpgsql SECURITY DEFINER;`;
      
      const modal = Modal.open({
        title: '🛠 Action requise sur Supabase',
        content: `
          <div style="font-size:14px;color:var(--text);line-height:1.5">
            <p>Pour autoriser l'application à créer les tables, vous devez exécuter une commande de configuration une seule fois dans votre tableau de bord Supabase.</p>
            <ol style="margin:15px 0;padding-left:20px">
              <li>Ouvrez votre projet sur <strong>Supabase.com</strong></li>
              <li>Allez dans le <strong>SQL Editor</strong> (icône &gt;_)</li>
              <li>Cliquez sur <strong>+ New Query</strong></li>
              <li>Collez le code ci-dessous :</li>
            </ol>
            <pre style="background:var(--surface-3);padding:15px;border-radius:8px;font-family:monospace;font-size:12px;margin:10px 0;overflow-x:auto;border:1px solid var(--border)">${sql}</pre>
            <button class="btn btn-primary btn-sm" id="btn-copy-rpc" style="margin-bottom:15px">📋 Copier le code</button>
            <p style="font-size:13px;opacity:0.7">Une fois terminé, cliquez sur <strong>Run</strong> dans Supabase, puis revenez ici pour récliquer sur « Envoyer les tables ».</p>
          </div>
          <div class="modal-footer" style="margin-top:20px;padding-top:15px;border-top:1px solid var(--border)">
            <button class="btn btn-ghost" id="btn-close-rpc-modal">Fermer</button>
          </div>
        `
      });

      document.getElementById('btn-close-rpc-modal')?.addEventListener('click', () => Modal.closeAll());
      document.getElementById('btn-copy-rpc')?.addEventListener('click', () => {
        navigator.clipboard.writeText(sql);
        Toast.success('Code copié !');
      });
    }
  }

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'parametres') {
      if (!document.querySelector('.params-body')) render();
      else loadParams();
    }
  });

})();
