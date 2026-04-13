/* ═══════════════════════════════════════════════════════════════════
   ClinoCaisse — App Router + Theme Manager
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

// ── SESSION ─────────────────────────────────────────────────────────────
window.Session = {
  user: null,
  setUser(u) { this.user = u; },
  getUser() { return this.user; },
  isLoggedIn() { return !!this.user; },
  hasPerm(perm) { return this.user && this.user[perm] === 1; },
  clear() { this.user = null; },
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

    // Déclencher l'init du module
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

// ── BOOT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Restaurer thème depuis localStorage
  const savedTheme = localStorage.getItem('cc_theme') || 'default';
  ThemeManager.apply(savedTheme);

  // Vérifier session existante
  const session = await window.api.auth.getSession();
  if (session) {
    Session.setUser(session);
    await ThemeManager.loadForUser(session.id);
    Router.go('dashboard');
  } else {
    Router.go('login');
  }
});
