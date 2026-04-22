'use strict';

(function DashboardModule() {

  let clockInterval = null;

  function render() {
    const container = document.getElementById('view-dashboard');
    container.innerHTML = `
      <!-- Topbar -->
      <div id="dashboard-topbar">
        <div class="dash-logo" id="dash-logo-container">
          <div id="dash-logo-img">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/>
              <line x1="12" y1="12" x2="12" y2="17"/><line x1="9" y1="14.5" x2="15" y2="14.5"/>
            </svg>
          </div>
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

        <div class="dash-main-row">
          <div class="dash-grid dash-grid-metro">

          <!-- Caisse Lounge (tuile grande 2×2) -->
          <button class="module-btn tile-metro tile-metro-large tile--caisse" id="btn-caisse" data-perm="perm_caisse">
            <svg class="mod-icon" width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2"/>
              <path d="M22 10H2M7 6V4M12 6V4M17 6V4"/>
              <circle cx="12" cy="15" r="2"/>
              <path d="M8 15h-2M18 15h-2"/>
            </svg>
            <span class="mod-label">Caisse Lounge</span>
          </button>

          <!-- Journal d'Activité (tuile grande 2×2) -->
          <button class="module-btn tile-metro tile-metro-large tile--journal" id="btn-journal" data-perm="perm_depenses">
            <svg class="mod-icon" width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span class="mod-label">Journal</span>
          </button>

          <!-- Cuisine / Bar (tuile moyenne haute 1×2) -->
          <button class="module-btn tile-metro tile-metro-medium-v tile--cuisine" id="btn-cuisine" data-perm="perm_caisse">
            <svg class="mod-icon" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
            <span class="mod-label mod-label-sm">Cuisine & Bar</span>
          </button>

          <!-- Réservations (tuile moyenne haute 1×2) -->
          <button class="module-btn tile-metro tile-metro-medium-v tile--reservations" id="btn-reservations" data-perm="perm_reserv">
            <svg class="mod-icon" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="mod-label mod-label-sm">Réservations</span>
          </button>

          <!-- Stock (tuile large horizontale) -->
          <button class="module-btn tile-metro tile-metro-wide-h tile--stock" id="btn-stock" data-perm="perm_stock">
            <svg class="mod-icon" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 7l-8-4-8 4m16 0v10l-8 4-8-4V7"/>
              <path d="M12 3v18M4 7l8 4 8-4"/>
            </svg>
            <span class="mod-label mod-label-sm">Gestion des Stocks</span>
          </button>

          <!-- Finances (petite) -->
          <button class="module-btn tile-metro tile-metro-small tile--finances" id="btn-finances" data-perm="perm_depenses">
            <svg class="mod-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <span class="mod-label mod-label-xs">Finances</span>
          </button>

          <!-- Employés RH (petite) -->
          <button class="module-btn tile-metro tile-metro-small tile--rh" id="btn-rh" data-perm="perm_ressources">
            <svg class="mod-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="mod-label mod-label-xs">Employés</span>
          </button>

          <!-- Utilisateurs (petite) -->
          <button class="module-btn tile-metro tile-metro-small tile--users" id="btn-users" data-perm="perm_utilisateur">
            <svg class="mod-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="7" r="3"/>
              <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
              <circle cx="17" cy="8" r="2.5"/>
              <path d="M15 20c0-2.5 1.8-4.5 4-5"/>
            </svg>
            <span class="mod-label mod-label-xs">Utilisateurs</span>
          </button>

          <!-- Paramètres (petite) -->
          <button class="module-btn tile-metro tile-metro-small tile--param" id="btn-param" data-perm="perm_parametres">
            <svg class="mod-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span class="mod-label mod-label-xs">Paramètres</span>
          </button>
          
          <!-- Clôture (petite) -->
          <button class="module-btn tile-metro tile-metro-small tile--cloture" id="btn-cloture" data-perm="perm_cloture">
            <svg class="mod-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M7 17l3-4 3 3 2-3 2 1"/>
              <line x1="7" y1="7" x2="17" y2="7" stroke-dasharray="1.5 1"/>
            </svg>
            <span class="mod-label mod-label-xs">Clôture</span>
          </button>

          <!-- Analytique — admin (petite) -->
          <button class="module-btn tile-metro tile-metro-small tile--analytique module-btn-admin" id="btn-analytique" style="display:none">
            <svg class="mod-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="12" width="4" height="10" rx="1"/>
              <rect x="9" y="7" width="4" height="15" rx="1"/>
              <rect x="16" y="2" width="4" height="20" rx="1"/>
            </svg>
            <span class="mod-label mod-label-xs">Analytique</span>
          </button>

          <!-- Horloge (tuile large horizontale) -->
          <div id="dash-clock" class="tile-metro tile-metro-wide-h tile--clock">
            <div class="clock-time" id="clock-time">00:00:00</div>
            <div class="clock-date" id="clock-date">-</div>
          </div>
          </div><!-- /.dash-grid -->

          <!-- Panneau latéral droit : bouton Terrain -->
          <div class="dash-side-panel">
            <button class="module-btn dash-terrain-btn" id="btn-terrain" data-perm="perm_reserv" style="display:none">
              <svg class="mod-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span class="mod-label mod-label-xs">Terrain</span>
            </button>
          </div>

        </div><!-- /.dash-main-row -->

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

    const content = document.getElementById('dashboard-content');
    if (content) content.classList.toggle('dashboard--admin', user.role === 'admin');

    const btnAna = document.getElementById('btn-analytique');
    if (btnAna) {
      btnAna.style.display = user.role === 'admin' ? '' : 'none';
    }

    // Gérer les permissions sur les boutons
    document.querySelectorAll('.module-btn[data-perm]').forEach(btn => {
      btn.style.position = 'relative'; // Pour le placement absolu du cadenas
      const perm = btn.dataset.perm;
      
      if (user.role !== 'admin' && user[perm] !== 1) {
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
      
      const topLogo = document.getElementById('dash-logo-img');

      if (params['entreprise.logo_url']) {
        const url = params['entreprise.logo_url'];
        if (topLogo) {
          topLogo.innerHTML = `<img src="${Utils.esc(url)}" style="width:32px; height:32px; object-fit:contain; filter:drop-shadow(0 0 8px rgba(255,255,255,0.2))">`;
        }
      }
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
      'btn-caisse':       { view: 'caisse',       perm: 'perm_caisse' },
      'btn-users':        { view: 'utilisateurs', perm: 'perm_utilisateur' },
      'btn-stock':        { view: 'stock',        perm: 'perm_stock' },
      'btn-cloture':      { view: 'cloture',      perm: 'perm_cloture' },
      'btn-param':        { view: 'parametres',   perm: 'perm_parametres' },
      'btn-journal':      { view: 'journal',      perm: 'perm_cloture' },
      'btn-cuisine':      { view: 'cuisine',      perm: 'perm_caisse' },
      'btn-reservations': { view: 'reservations', perm: 'perm_reserv' },
      'btn-finances':     { view: 'finances',     perm: 'perm_depenses' },
      'btn-rh':           { view: 'rh',           perm: 'perm_ressources' },
      'btn-terrain':      { view: 'terrain',      perm: 'perm_reserv' },
    };

    Object.entries(navMap).forEach(([btnId, { view, perm }]) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        if (!Utils.checkPerm(perm)) return;
        Router.go(view);
      });
    });

    // Bouton analytique (admin uniquement, pas de perm classique)
    document.getElementById('btn-analytique')?.addEventListener('click', () => {
      const u = Session.getUser();
      if (!u || u.role !== 'admin') return;
      Router.go('analytique');
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
