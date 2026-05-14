/* ═══════════════════════════════════════════════════════════════════
   ClinoCaisse — App Router + Theme Manager + Licence Mensuelle
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

// ── SESSION ─────────────────────────────────────────────────────────────
window.Session = {
  user: null,
  setUser(u) { this.user = u; },
  getUser()  { return this.user; },
  isLoggedIn() { return !!this.user; },
  hasPerm(perm) { return this.user && (this.user.role === 'admin' || this.user[perm] === 1); },
  clear()    { this.user = null; },
};

// ── ROUTER ───────────────────────────────────────────────────────────────
window.Router = {
  current: 'login',
  history: [],

  go(viewId) {
    const views = document.querySelectorAll('.view');
    views.forEach(v => v.classList.remove('active'));

    const target = document.getElementById(`view-${viewId}`);
    if (!target) return;

    this.history.push(this.current);
    this.current = viewId;
    target.classList.add('active');

    document.dispatchEvent(new CustomEvent('view:activate', { detail: { view: viewId } }));
  },

  back() {
    const prev = this.history.pop();
    if (prev) this.go(prev);
  },
};

// ── THEME MANAGER ────────────────────────────────────────────────────────
window.ThemeManager = {
  current: 'default',

  themes: [
    { id: 'default',    label: 'Default',     accent: '#4a9fd4', bg: '#1a2d45' },
    { id: 'vulcan',     label: 'Vulcan',      accent: '#cc2222', bg: '#1e0a0a' },
    { id: 'sienne',     label: 'Sienne',      accent: '#c87530', bg: '#3d2010' },
    { id: 'lilas',      label: 'Lilas',       accent: '#a060d0', bg: '#3a2a50' },
    { id: 'mauve',      label: 'Mauve',       accent: '#c050a8', bg: '#4a2040' },
    { id: 'mouse_grey', label: 'Mouse Grey',  accent: '#70a0a0', bg: '#2a3d3d' },
    { id: 'light_blue', label: 'Light Blue',  accent: '#4090e0', bg: '#0e2d5a' },
    { id: 'candies',    label: 'Candies',     accent: '#c04040', bg: '#3e1a1a' },
    { id: 'ocean',      label: 'Ocean',       accent: '#30b888', bg: '#10382a' },
    { id: 'sunset',     label: 'Sunset',      accent: '#e06030', bg: '#3e1408' },
    { id: 'forest',     label: 'Forest',      accent: '#4a9a4a', bg: '#182818' },
    { id: 'midnight',   label: 'Midnight',    accent: '#6060d0', bg: '#0a0a20' },
    { id: 'coffee',     label: 'Coffee',      accent: '#9a6038', bg: '#221408' },
    { id: 'coral',      label: 'Coral',       accent: '#e05030', bg: '#3e1808' },
    { id: 'royal',      label: 'Royal',       accent: '#c09020', bg: '#200a28' },
  ],

  apply(themeId) {
    const valid = this.themes.find(t => t.id === themeId);
    if (!valid) return;
    this.current = themeId;
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('cc_theme', themeId);
  },

  async loadForUser(userId) {
    try {
      const saved = await window.api.theme.get(userId);
      this.apply(saved || localStorage.getItem('cc_theme') || 'default');
    } catch {
      this.apply(localStorage.getItem('cc_theme') || 'default');
    }
  },

  async saveForUser(userId, themeId) {
    this.apply(themeId);
    if (userId) await window.api.theme.save(userId, themeId);
  },
};

// ── LICENCE MANAGER (RENDERER) ────────────────────────────────────────────
window.LicenseWatcher = (() => {
  let _timerInterval   = null;   // Tick toutes les secondes
  let _warnShown       = false;  // Alerte 5 min déjà affichée ?
  let _logoutWarnShown = false;  // Alerte "déco dans 1 min" déjà affichée ?
  let _logoutTimer     = null;   // Timer de déconnexion forcée
  let _realtimeBound   = false;  // Listener Supabase bindé ?

  // Durées (doivent correspondre à license.js backend)
  const WARN_MS        = 5 * 60 * 1000;  // 5 min (TEST)
  const LOGOUT_WARN_MS = 1 * 60 * 1000;  // 1 min

  function _stopAll() {
    if (_timerInterval)  { clearInterval(_timerInterval);  _timerInterval   = null; }
    if (_logoutTimer)    { clearTimeout(_logoutTimer);     _logoutTimer     = null; }
    _warnShown       = false;
    _logoutWarnShown = false;
  }

  function _hideBanner() {
    const banner = document.getElementById('license-banner');
    if (banner) banner.style.display = 'none';
  }

  function _showBanner(text, urgent = false) {
    let banner = document.getElementById('license-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'license-banner';
      banner.style.cssText = [
        'display:flex', 'align-items:center', 'justify-content:center', 'gap:12px',
        'padding:9px 16px', 'font-size:13px', 'font-weight:700',
        'cursor:pointer', 'flex-shrink:0', 'z-index:9999',
        'transition:background 0.4s',
        'position:relative'
      ].join(';');
      const app = document.getElementById('app');
      if (app) app.prepend(banner);
    }

    if (urgent) {
      banner.style.background = '#c0392b';
      banner.style.color      = '#fff';
      banner.style.animation  = 'license-pulse 1s ease-in-out infinite';
    } else {
      banner.style.background = '#e67e22';
      banner.style.color      = '#fff';
      banner.style.animation  = 'none';
    }

    banner.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>${text}</span>
      <span style="font-size:11px;opacity:0.85;margin-left:4px">— Cliquez ici pour activer</span>
    `;
    banner.style.display = 'flex';

    // Clic → page activation
    banner.onclick = () => {
      if (Router.current !== 'activation') Router.go('activation');
    };
  }

  async function _forceLogout() {
    _stopAll();
    _hideBanner();
    // Déconnecter l'utilisateur
    try { await window.api.auth.logout(); } catch {}
    Session.clear();
    Router.go('login');
    // Aller directement à la page activation
    setTimeout(() => Router.go('activation'), 300);
  }

  async function _tick() {
    let status;
    try {
      status = await window.api.license.checkRealtime();
    } catch {
      return; // Erreur IPC → on ne coupe pas
    }

    // ── Licence valide ──────────────────────────────────────────────────
    if (status.valid && status.status === 'activated_monthly') {
      const rem = status.remainingMs;

      // Mettre à jour le badge dashboard
      document.dispatchEvent(new CustomEvent('license:tick', { detail: status }));

      // Cas 1 : Temps presque écoulé → alerte urgente + timer déco
      if (rem <= 0) {
        if (!_logoutWarnShown) {
          _logoutWarnShown = true;
          _showBanner('⛔ Licence expirée — déconnexion dans 1 minute. Contactez l\'administrateur pour le code du mois.', true);

          _logoutTimer = setTimeout(() => {
            _forceLogout();
          }, LOGOUT_WARN_MS);
        }
        return;
      }

      // Cas 2 : Alerte 5 min
      if (rem <= WARN_MS && !_warnShown) {
        _warnShown = true;
        const mins = Math.ceil(rem / 60000);
        _showBanner(`⚠️ Licence expire dans ${mins} minute${mins > 1 ? 's' : ''} — Contactez votre administrateur !`, true);
        return;
      }

      // Cas 3 : Tout va bien — cacher bannière si elle était visible
      if (rem > WARN_MS) {
        _hideBanner();
        _warnShown = false;
        _logoutWarnShown = false;
        if (_logoutTimer) { clearTimeout(_logoutTimer); _logoutTimer = null; }
      }
      return;
    }

    // ── Licence expirée ou jamais activée ─────────────────────────────
    if (!status.valid) {
      _stopAll();
      _forceLogout();
    }
  }

  function start(initialStatus) {
    _stopAll();

    if (!initialStatus.valid) {
      // Déjà expiré dès le départ → aller direct activation
      setTimeout(() => Router.go('activation'), 200);
      return;
    }

    // Tick toutes les secondes pour un compte à rebours précis
    _timerInterval = setInterval(_tick, 1000);

    // Tick immédiat pour mise à jour de l'UI
    _tick();

    // ── Realtime Supabase ─────────────────────────────────────────────
    // Si une autre instance met à jour license.monthly_expires_at,
    // on le détecte immédiatement via le callback onDataChanged
    if (!_realtimeBound && window.api?.events?.onDataChanged) {
      _realtimeBound = true;
      window.api.events.onDataChanged(async () => {
        // Re-check immédiat
        await _tick();
      });
    }
  }

  function stop() { _stopAll(); _hideBanner(); }

  return { start, stop };
})();

// ── BOOT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Injecter l'animation CSS de pulsation pour la bannière
  const style = document.createElement('style');
  style.textContent = `
    @keyframes license-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.75; }
    }
  `;
  document.head.appendChild(style);

  // Restaurer thème
  const savedTheme = localStorage.getItem('cc_theme') || 'default';
  ThemeManager.apply(savedTheme);

  // 1. Vérifier la licence mensuelle
  const license = await window.api.license.status();

  if (!license.valid) {
    // Jamais activé ou expiré → page activation directement
    Router.go('activation');
    return;
  }

  // Licence valide → démarrer le watcher
  LicenseWatcher.start(license);

  // 2. Vérifier session existante
  const session = await window.api.auth.getSession();
  if (session) {
    Session.setUser(session);
    await ThemeManager.loadForUser(session.id);
    Router.go('dashboard');
  } else {
    Router.go('login');
  }
});
