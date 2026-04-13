'use strict';

(function DashboardModule() {

  let clockInterval = null;

  function render() {
    const container = document.getElementById('view-dashboard');
    container.innerHTML = `
      <!-- Topbar -->
      <div id="dashboard-topbar">
        <div class="dash-logo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/>
            <line x1="12" y1="12" x2="12" y2="17"/><line x1="9" y1="14.5" x2="15" y2="14.5"/>
          </svg>
          <span id="dash-poste-name">Poste n°1</span>
        </div>

        <button id="btn-theme-selector">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
            <circle cx="15" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="16" cy="14" r="1.5" fill="currentColor"/>
            <circle cx="10" cy="16" r="1.5" fill="currentColor"/>
          </svg>
          Thème
        </button>

        <div style="flex:1"></div>

        <div class="dash-user-info" id="dash-user-btn" title="Cliquer pour se déconnecter">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          <span class="dash-user-name" id="dash-user-name">-</span>
        </div>
      </div>

      <!-- Contenu -->
      <div id="dashboard-content">
        <div class="dash-title">Accueil</div>

        <div class="dash-grid">

          <!-- Caisse (rowspan 2) -->
          <button class="module-btn" id="btn-caisse" data-perm="perm_caisse">
            <svg class="mod-icon" width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2"/>
              <path d="M22 10H2M7 6V4M12 6V4M17 6V4"/>
              <circle cx="12" cy="15" r="2"/>
              <path d="M8 15h-2M18 15h-2"/>
            </svg>
            <span class="mod-label">Caisse</span>
          </button>

          <!-- Utilisateurs -->
          <button class="module-btn" id="btn-users" data-perm="perm_utilisateur">
            <svg class="mod-icon" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="7" r="3"/>
              <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
              <circle cx="17" cy="8" r="2.5"/>
              <path d="M15 20c0-2.5 1.8-4.5 4-5"/>
            </svg>
            <span class="mod-label mod-label-sm">Utilisateurs</span>
          </button>

          <!-- Stock -->
          <button class="module-btn" id="btn-stock" data-perm="perm_stock">
            <svg class="mod-icon" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 7l-8-4-8 4m16 0v10l-8 4-8-4V7"/>
              <path d="M12 3v18M4 7l8 4 8-4"/>
            </svg>
            <span class="mod-label mod-label-sm">Gestion stock</span>
          </button>

          <!-- Clôture -->
          <button class="module-btn" id="btn-cloture" data-perm="perm_cloture">
            <svg class="mod-icon" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M7 17l3-4 3 3 2-3 2 1"/>
              <line x1="7" y1="7" x2="17" y2="7" stroke-dasharray="1.5 1"/>
            </svg>
            <span class="mod-label mod-label-sm">Clôture de caisse</span>
          </button>

          <!-- Paramètres -->
          <button class="module-btn" id="btn-param" data-perm="perm_parametres">
            <svg class="mod-icon" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span class="mod-label mod-label-sm">Paramètres</span>
          </button>

          <!-- Horloge -->
          <div id="dash-clock">
            <div class="clock-time" id="clock-time">00:00:00</div>
            <div class="clock-date" id="clock-date">-</div>
          </div>
        </div>

        <div class="dash-security-msg">
          Obligation de conservation de vos données : effectuez régulièrement un backup externe de votre base de données.
        </div>
      </div>

      <!-- Footer -->
      <div id="dashboard-footer">
        <span>Copyright © 2026 ClinoKeys</span>
        <span id="dash-version">Version 1.0.0</span>
      </div>
    `;

    bindEvents();
    updateUserInfo();
    updateClock();
    loadParams();
  }

  function updateUserInfo() {
    const user = Session.getUser();
    if (!user) return;
    const nameEl = document.getElementById('dash-user-name');
    if (nameEl) nameEl.textContent = `${user.nom}${user.prenom ? ' ' + user.prenom : ''}`;

    // Gérer les permissions sur les boutons
    document.querySelectorAll('.module-btn[data-perm]').forEach(btn => {
      btn.style.position = 'relative'; // Pour le placement absolu du cadenas
      const perm = btn.dataset.perm;
      
      if (user[perm] !== 1) {
        btn.style.opacity   = '0.4';
        btn.style.cursor    = 'not-allowed';
        btn.title           = 'Accès non autorisé';
        // Ajouter petit cadenas s'il n'y est pas encore
        if (!btn.querySelector('.lock-overlay')) {
          btn.innerHTML += `
            <svg class="lock-overlay" style="position:absolute;top:12px;right:12px;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          `;
        }
      } else {
        // Réinitialiser si l'utilisateur a de nouveau la permission (changement de compte)
        btn.style.opacity   = '1';
        btn.style.cursor    = 'pointer';
        btn.title           = '';
        const lock = btn.querySelector('.lock-overlay');
        if (lock) lock.remove();
      }
    });
  }

  async function loadParams() {
    try {
      const params = await window.api.parametres.getAll();
      const poste = document.getElementById('dash-poste-name');
      if (poste && params['caisse.nom_poste']) poste.textContent = params['caisse.nom_poste'];
      const ver = document.getElementById('dash-version');
      if (ver && params['caisse.version']) ver.textContent = 'Version ' + params['caisse.version'];
      if (params['caisse.devise']) localStorage.setItem('cc_devise', params['caisse.devise']);
    } catch {}
  }

  function updateClock() {
    const updateFn = () => {
      const now  = new Date();
      const timeEl = document.getElementById('clock-time');
      const dateEl = document.getElementById('clock-date');
      if (timeEl) {
        const h = String(now.getHours()).padStart(2,'0');
        const m = String(now.getMinutes()).padStart(2,'0');
        const s = String(now.getSeconds()).padStart(2,'0');
        timeEl.innerHTML = `${h}<span class="clock-colon">:</span>${m}<span class="clock-colon">:</span>${s}`;
      }
      if (dateEl) {
        const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
        dateEl.textContent = `${days[now.getDay()]} ${now.toLocaleDateString('fr-FR')}`;
      }
    };
    updateFn();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(updateFn, 1000);
  }

  function bindEvents() {
    const navMap = {
      'btn-caisse':  { view: 'caisse',       perm: 'perm_caisse' },
      'btn-users':   { view: 'utilisateurs', perm: 'perm_utilisateur' },
      'btn-stock':   { view: 'stock',        perm: 'perm_stock' },
      'btn-cloture': { view: 'cloture',      perm: 'perm_cloture' },
      'btn-param':   { view: 'parametres',   perm: 'perm_parametres' },
    };

    Object.entries(navMap).forEach(([btnId, { view, perm }]) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        if (!Utils.checkPerm(perm)) return;
        Router.go(view);
      });
    });

    document.getElementById('btn-theme-selector')?.addEventListener('click', () => {
      if (typeof ThemeSelectorModule !== 'undefined') ThemeSelectorModule.open();
    });

    document.getElementById('dash-user-btn')?.addEventListener('click', async () => {
      const confirmed = await new Promise(r => Modal.confirm('Déconnexion', 'Voulez-vous vous déconnecter ?', r));
      if (!confirmed) return;
      if (clockInterval) clearInterval(clockInterval);
      await window.api.auth.logout();
      Session.clear();
      Router.go('login');
    });
  }

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'dashboard') {
      if (!document.getElementById('dashboard-topbar')) render();
      else { updateUserInfo(); updateClock(); loadParams(); }
    }
    if (e.detail.view !== 'dashboard' && e.detail.view !== 'login') {
      if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
    }
  });

  window.openThemeSelector = function() {
    if (typeof ThemeSelectorModule !== 'undefined') ThemeSelectorModule.open();
  };

})();
