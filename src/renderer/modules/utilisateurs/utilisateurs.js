'use strict';

(function UtilisateursModule() {

  let state = {
    utilisateurs: [],
    mode: 'actifs',
    selectedUser: null,
    editId: null,
  };

  function render() {
    const container = document.getElementById('view-utilisateurs');
    container.innerHTML = `
      <div class="caisse-topbar">
        <button class="btn btn-ghost btn-sm" id="users-retour">← Retour</button>
        <span class="caisse-topbar-title">👥 Gestion des Utilisateurs</span>
        <div style="flex:1"></div>
        <button class="btn btn-sm" id="btn-filtrer-actifs"
          style="background:rgba(74,159,212,0.15);border:1px solid var(--accent);color:var(--text);border-radius:6px;padding:5px 12px;cursor:pointer">
          ✅ Actifs
        </button>
        <button class="btn btn-ghost btn-sm" id="btn-filtrer-inactifs">🚫 Inactifs</button>
      </div>

      <div class="users-body">
        <!-- Formulaire -->
        <div class="users-form-card">
          <div class="users-form-title">📝 Formulaire utilisateur
            <span id="form-mode-badge" class="badge badge-info" style="font-size:11px">Nouveau</span>
          </div>

          <input type="hidden" id="user-id" />

          <div class="form-row" style="margin-bottom:12px">
            <div class="form-group">
              <label>Nom *</label>
              <input type="text" class="input" id="user-nom" placeholder="Dupont" />
            </div>
            <div class="form-group">
              <label>Prénom</label>
              <input type="text" class="input" id="user-prenom" placeholder="Jean" />
            </div>
            <div class="form-group" style="max-width:140px">
              <label>PIN (4 chiffres) *</label>
              <input type="password" class="input" id="user-pin" maxlength="4" placeholder="••••" />
            </div>
            <div class="form-group" style="max-width:160px">
              <label>Rôle *</label>
              <select class="input" id="user-role">
                <option value="employe">Employé</option>
                <option value="gerant">Gérant</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label>🔐 Permissions d'accès</label>
            <p id="admin-perm-hint" class="admin-perm-hint" style="display:none;font-size:12px;opacity:0.85;margin:6px 0 0">
              Rôle Administrateur : tous les droits sont actifs (même accueil que le tableau de bord principal, y compris Analytique).
            </p>
            <div class="perms-grid">
              <label class="checkbox-label"><input type="checkbox" id="perm-caisse" /> 🛒 Caisse</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-utilisateur" /> 👥 Utilisateurs</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-parametres" /> ⚙️ Paramètres</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-cloture" /> 🔒 Clôture caisse</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-stock" /> 📦 Gestion stock</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-remises" /> 🏷️ Remises / Offert</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-grossiste" /> Grossiste</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-depenses" /> Finances / dépenses</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-ressources" /> RH / salaires</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-achats" /> Achats fourn.</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-reserv" /> Réservations</label>
            </div>
          </div>

          <div style="display:flex;gap:10px;align-items:center">
            <button class="btn btn-success" id="btn-ajouter-user">➕ Ajouter</button>
            <button class="btn btn-primary" id="btn-modifier-user">✏️ Modifier</button>
            <button class="btn btn-danger"  id="btn-desactiver-user">🚫 Désactiver</button>
            <button class="btn" id="btn-reactiver-user" style="background:rgba(243,156,18,0.2);border:1px solid #f39c12;color:var(--text)">✅ Réactiver</button>
            <button class="btn btn-ghost"   id="btn-reset-form">🆕 Nouveau</button>
            <span id="users-msg" style="font-size:13px;color:#e74c3c;margin-left:8px"></span>
          </div>
        </div>

        <!-- Tableau -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div class="users-table-title" id="users-table-title">👤 Utilisateurs actifs</div>
        </div>
        <div class="users-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Nom</th><th>Prénom</th><th>PIN</th><th>Rôle</th>
                <th>Caisse</th><th>Util.</th><th>Param.</th>
                <th>Clôt.</th><th>Stock</th><th>Rem.</th>
                <th>Gros.</th><th>Fin.</th><th>RH</th><th>Ach.</th><th>Rés.</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody id="users-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    bindEvents();
    syncRolePermUi();
    loadUsers();
  }

  async function loadUsers() {
    const users = await window.api.utilisateurs.getAll();
    state.utilisateurs = users;
    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    const toShow = state.mode === 'actifs'
      ? state.utilisateurs.filter(u => u.actif === 1)
      : state.utilisateurs.filter(u => u.actif === 0);

    const titleEl = document.getElementById('users-table-title');
    if (titleEl) titleEl.textContent = state.mode === 'actifs' ? '👤 Utilisateurs actifs' : '🚫 Utilisateurs inactifs';

    const perm = v => v ? `<span style="color:#2ecc71;font-size:16px">✓</span>` : `<span style="opacity:0.3">–</span>`;
    const roleClass = { admin:'admin', gerant:'gerant', employe:'employe', vendeur:'employe' };
    const roleLabel = { admin:'Administrateur', gerant:'Gérant', employe:'Employé', vendeur:'Employé' };

    tbody.innerHTML = toShow.map(u => `
      <tr class="users-row" data-id="${u.id}" style="cursor:pointer">
        <td style="opacity:0.6">${u.id}</td>
        <td><strong>${Utils.esc(u.nom)}</strong></td>
        <td>${Utils.esc(u.prenom || '')}</td>
        <td style="font-family:monospace;letter-spacing:4px">••••</td>
        <td><span class="role-badge ${roleClass[u.role]||'employe'}">${Utils.esc(roleLabel[u.role] || u.role)}</span></td>
        <td style="text-align:center">${perm(u.perm_caisse)}</td>
        <td style="text-align:center">${perm(u.perm_utilisateur)}</td>
        <td style="text-align:center">${perm(u.perm_parametres)}</td>
        <td style="text-align:center">${perm(u.perm_cloture)}</td>
        <td style="text-align:center">${perm(u.perm_stock)}</td>
        <td style="text-align:center">${perm(u.perm_remises)}</td>
        <td style="text-align:center">${perm(u.perm_grossiste)}</td>
        <td style="text-align:center">${perm(u.perm_depenses)}</td>
        <td style="text-align:center">${perm(u.perm_ressources)}</td>
        <td style="text-align:center">${perm(u.perm_achats)}</td>
        <td style="text-align:center">${perm(u.perm_reserv)}</td>
        <td><span class="badge ${u.actif ? 'badge-success' : 'badge-danger'}">${u.actif ? 'Actif' : 'Inactif'}</span></td>
      </tr>
    `).join('') || `<tr><td colspan="17" style="text-align:center;padding:30px;opacity:0.5">Aucun utilisateur</td></tr>`;

    tbody.querySelectorAll('.users-row').forEach(row => {
      row.addEventListener('click', () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        const user = state.utilisateurs.find(u => u.id === parseInt(row.dataset.id));
        if (user) remplirFormulaire(user);
      });
    });
  }

  const PERM_IDS = ['perm-caisse', 'perm-utilisateur', 'perm-parametres', 'perm-cloture', 'perm-stock', 'perm-remises',
    'perm-grossiste', 'perm-depenses', 'perm-ressources', 'perm-achats', 'perm-reserv'];

  function syncRolePermUi() {
    const roleEl = document.getElementById('user-role');
    const hint = document.getElementById('admin-perm-hint');
    if (!roleEl) return;
    const isAdmin = roleEl.value === 'admin';
    if (hint) hint.style.display = isAdmin ? '' : 'none';
    PERM_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = isAdmin;
      if (isAdmin) el.checked = true;
    });
  }

  function remplirFormulaire(user) {
    state.editId = user.id;
    document.getElementById('user-id').value = user.id;
    document.getElementById('user-nom').value = user.nom;
    document.getElementById('user-prenom').value = user.prenom || '';
    document.getElementById('user-pin').value = '';
    document.getElementById('user-role').value = user.role;
    const isAdmin = user.role === 'admin';
    document.getElementById('perm-caisse').checked = isAdmin || !!user.perm_caisse;
    document.getElementById('perm-utilisateur').checked = isAdmin || !!user.perm_utilisateur;
    document.getElementById('perm-parametres').checked = isAdmin || !!user.perm_parametres;
    document.getElementById('perm-cloture').checked = isAdmin || !!user.perm_cloture;
    document.getElementById('perm-stock').checked = isAdmin || !!user.perm_stock;
    document.getElementById('perm-remises').checked = isAdmin || !!user.perm_remises;
    document.getElementById('perm-grossiste').checked = isAdmin || !!user.perm_grossiste;
    document.getElementById('perm-depenses').checked = isAdmin || !!user.perm_depenses;
    document.getElementById('perm-ressources').checked = isAdmin || !!user.perm_ressources;
    document.getElementById('perm-achats').checked = isAdmin || !!user.perm_achats;
    document.getElementById('perm-reserv').checked = isAdmin || !!user.perm_reserv;
    syncRolePermUi();

    const badge = document.getElementById('form-mode-badge');
    if (badge) { badge.textContent = 'Modification'; badge.className = 'badge badge-warning'; }
    document.getElementById('users-msg').textContent = '';
  }

  function resetFormulaire() {
    state.editId = null;
    ['user-id','user-nom','user-prenom','user-pin'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('user-role').value = 'employe';
    ['caisse','utilisateur','parametres','cloture','stock','remises','grossiste','depenses','ressources','achats','reserv'].forEach(p => {
      const el = document.getElementById(`perm-${p}`);
      if (el) el.checked = false;
    });
    syncRolePermUi();
    const badge = document.getElementById('form-mode-badge');
    if (badge) { badge.textContent = 'Nouveau'; badge.className = 'badge badge-info'; }
    document.getElementById('users-msg').textContent = '';
    document.querySelectorAll('.users-row').forEach(r => r.classList.remove('selected'));
  }

  function getFormData() {
    return {
      nom: document.getElementById('user-nom').value.trim(),
      prenom: document.getElementById('user-prenom').value.trim(),
      pin: document.getElementById('user-pin').value.trim(),
      role: document.getElementById('user-role').value,
      perm_caisse: document.getElementById('perm-caisse').checked,
      perm_utilisateur: document.getElementById('perm-utilisateur').checked,
      perm_parametres: document.getElementById('perm-parametres').checked,
      perm_cloture: document.getElementById('perm-cloture').checked,
      perm_stock: document.getElementById('perm-stock').checked,
      perm_remises: document.getElementById('perm-remises').checked,
      perm_grossiste: document.getElementById('perm-grossiste').checked,
      perm_depenses: document.getElementById('perm-depenses').checked,
      perm_ressources: document.getElementById('perm-ressources').checked,
      perm_achats: document.getElementById('perm-achats').checked,
      perm_reserv: document.getElementById('perm-reserv').checked,
    };
  }

  function setMsg(msg, color = '#e74c3c') {
    const el = document.getElementById('users-msg');
    if (el) { el.textContent = msg; el.style.color = color; }
  }

  function bindEvents() {
    document.getElementById('users-retour')?.addEventListener('click', () => Router.go('dashboard'));
    document.getElementById('btn-reset-form')?.addEventListener('click', resetFormulaire);

    document.getElementById('btn-filtrer-actifs')?.addEventListener('click', () => {
      state.mode = 'actifs'; renderTable();
    });
    document.getElementById('btn-filtrer-inactifs')?.addEventListener('click', () => {
      state.mode = 'inactifs'; renderTable();
    });

    document.getElementById('btn-ajouter-user')?.addEventListener('click', async () => {
      const data = getFormData();
      if (!data.nom) { setMsg('Nom requis'); return; }
      if (!data.pin) { setMsg('PIN requis'); return; }
      const res = await window.api.utilisateurs.create(data);
      if (res.success) { Toast.success('Utilisateur créé'); resetFormulaire(); await loadUsers(); }
      else setMsg(res.message);
    });

    document.getElementById('btn-modifier-user')?.addEventListener('click', async () => {
      if (!state.editId) { setMsg('Sélectionnez un utilisateur'); return; }
      const data = getFormData();
      if (!data.nom) { setMsg('Nom requis'); return; }
      if (!data.pin) delete data.pin; // ne pas modifier le PIN si vide
      const res = await window.api.utilisateurs.update(state.editId, data);
      if (res.success) { Toast.success('Utilisateur modifié'); resetFormulaire(); await loadUsers(); }
      else setMsg(res.message);
    });

    document.getElementById('btn-desactiver-user')?.addEventListener('click', async () => {
      if (!state.editId) { setMsg('Sélectionnez un utilisateur'); return; }
      const ok = await new Promise(r => Modal.confirm('Désactiver', 'Désactiver cet utilisateur ?', r));
      if (!ok) return;
      const res = await window.api.utilisateurs.desactiver(state.editId);
      if (res.success) { Toast.success('Utilisateur désactivé'); resetFormulaire(); await loadUsers(); }
      else setMsg(res.message);
    });

    document.getElementById('btn-reactiver-user')?.addEventListener('click', async () => {
      if (!state.editId) { setMsg('Sélectionnez un utilisateur'); return; }
      const res = await window.api.utilisateurs.reactiver(state.editId);
      if (res.success) { Toast.success('Utilisateur réactivé'); resetFormulaire(); await loadUsers(); }
      else setMsg(res.message);
    });

    document.getElementById('user-role')?.addEventListener('change', syncRolePermUi);
  }

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'utilisateurs') {
      if (!document.querySelector('.users-body')) render();
      else loadUsers();
    }
  });

})();
