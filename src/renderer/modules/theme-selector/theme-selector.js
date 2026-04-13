'use strict';

window.ThemeSelectorModule = (function() {

  let overlayEl = null;
  let selectedTheme = ThemeManager.current;

  const THEME_DATA = {
    default:    { topbar: '#0d1e30', bg: '#1a2d45', btn1: '#c86a00', btn2: '#2e5f85', btn3: '#2fa0a0' },
    vulcan:     { topbar: '#0f0000', bg: '#1e0a0a', btn1: '#aa1010', btn2: '#1e4a7a', btn3: '#0a7a6a' },
    sienne:     { topbar: '#1e0e05', bg: '#3d2010', btn1: '#9a4a10', btn2: '#7a4a20', btn3: '#6a3010' },
    lilas:      { topbar: '#20103a', bg: '#3a2a50', btn1: '#7a50a0', btn2: '#6a3880', btn3: '#8a60a8' },
    mauve:      { topbar: '#280e22', bg: '#4a2040', btn1: '#8a3a7a', btn2: '#6a2a5a', btn3: '#9a4a88' },
    mouse_grey: { topbar: '#142828', bg: '#2a3d3d', btn1: '#4a6060', btn2: '#385050', btn3: '#587070' },
    light_blue: { topbar: '#051428', bg: '#0e2d5a', btn1: '#2060b0', btn2: '#0e3a6e', btn3: '#2e60a8' },
    candies:    { topbar: '#1c0c0c', bg: '#3e1a1a', btn1: '#7a3a20', btn2: '#283a20', btn3: '#7a5010' },
    ocean:      { topbar: '#061e14', bg: '#10382a', btn1: '#1e6a50', btn2: '#103c2a', btn3: '#287a60' },
    sunset:     { topbar: '#1c0a04', bg: '#3e1408', btn1: '#8a3a18', btn2: '#642e08', btn3: '#9a4a20' },
    forest:     { topbar: '#0c1a0c', bg: '#182818', btn1: '#2a4a2a', btn2: '#1a3a1a', btn3: '#3a5a3a' },
    midnight:   { topbar: '#030310', bg: '#0a0a20', btn1: '#181840', btn2: '#202050', btn3: '#2e2e62' },
    coffee:     { topbar: '#100a04', bg: '#221408', btn1: '#4a2a18', btn2: '#38200e', btn3: '#5a3820' },
    coral:      { topbar: '#1e0c04', bg: '#3e1808', btn1: '#8a3a18', btn2: '#682808', btn3: '#9a4820' },
    royal:      { topbar: '#100414', bg: '#200a28', btn1: '#7a4a00', btn2: '#5a2800', btn3: '#8a5810' },
  };

  function createOverlay() {
    const div = document.createElement('div');
    div.className = 'theme-selector-overlay';
    div.id = 'theme-selector-overlay';
    div.innerHTML = `
      <div class="theme-selector-panel">

        <div class="ts-header">
          <h2>🎨 Sélection du Thème</h2>
          <button class="ts-close" id="ts-close">✕</button>
        </div>

        <div class="ts-body">
          <p class="ts-subtitle">Choisissez un thème qui s'appliquera à toute l'application.</p>

          <!-- Preview live -->
          <div class="ts-live-preview">
            <h4>Aperçu en direct</h4>
            <div class="live-mock" id="live-mock">
              <div class="live-mock-topbar" id="lm-topbar">💰 ClinoCaisse</div>
              <div class="live-mock-body">
                <div class="live-mock-btn" id="lm-btn1">Caisse</div>
                <div class="live-mock-btn" id="lm-btn2">Stock</div>
                <div class="live-mock-btn" id="lm-btn3">Clôture</div>
              </div>
            </div>
          </div>

          <!-- Grille des thèmes -->
          <div class="theme-grid" id="theme-grid">
            ${ThemeManager.themes.map(t => renderThemeCard(t)).join('')}
          </div>

        </div>

        <div class="ts-footer">
          <div class="ts-selected-name" id="ts-selected-label">Thème : <strong>${ThemeManager.themes.find(t=>t.id===ThemeManager.current)?.label || 'Default'}</strong></div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost" id="ts-cancel">Annuler</button>
            <button class="btn btn-success" id="ts-apply" style="min-width:140px">✅ Appliquer</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    overlayEl = div;

    bindEvents();
    updateLivePreview(ThemeManager.current);
    markSelected(ThemeManager.current);
    selectedTheme = ThemeManager.current;
  }

  function renderThemeCard(t) {
    const d = THEME_DATA[t.id] || THEME_DATA.default;
    return `
      <div class="theme-card" data-theme="${t.id}" title="${t.label}">
        <div class="tc-preview">
          <div class="tc-topbar-sim" style="background:${d.topbar}"></div>
          <div class="tc-body-sim" style="background:${d.bg}">
            <div class="tc-btn-sim" style="background:${d.btn1}"></div>
            <div class="tc-btn-sim" style="background:${d.btn2}"></div>
            <div class="tc-btn-sim" style="background:${d.btn3}"></div>
          </div>
        </div>
        <div class="tc-info">
          <div class="tc-name">${t.label}</div>
          <div class="tc-accent">
            <div class="tc-dot" style="background:${t.accent}"></div>
            <span>${t.accent}</span>
          </div>
        </div>
      </div>`;
  }

  function markSelected(themeId) {
    overlayEl?.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.theme === themeId);
    });
    const theme = ThemeManager.themes.find(t => t.id === themeId);
    const label = overlayEl?.querySelector('#ts-selected-label');
    if (label && theme) label.innerHTML = `Thème : <strong>${theme.label}</strong>`;
  }

  function updateLivePreview(themeId) {
    const d = THEME_DATA[themeId] || THEME_DATA.default;
    const topbar = overlayEl?.querySelector('#lm-topbar');
    const btn1   = overlayEl?.querySelector('#lm-btn1');
    const btn2   = overlayEl?.querySelector('#lm-btn2');
    const btn3   = overlayEl?.querySelector('#lm-btn3');
    const body   = overlayEl?.querySelector('.live-mock-body');
    if (topbar) topbar.style.background = `linear-gradient(to right, ${d.topbar}, ${d.bg}, ${d.topbar})`;
    if (body)   body.style.background   = d.bg;
    if (btn1)   btn1.style.background   = d.btn1;
    if (btn2)   btn2.style.background   = d.btn2;
    if (btn3)   btn3.style.background   = d.btn3;
  }

  function bindEvents() {
    // Fermer
    overlayEl.querySelector('#ts-close')?.addEventListener('click', close);
    overlayEl.querySelector('#ts-cancel')?.addEventListener('click', close);
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    // Sélection thème
    overlayEl.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedTheme = card.dataset.theme;
        markSelected(selectedTheme);
        updateLivePreview(selectedTheme);
        // Preview live sur l'appli
        ThemeManager.apply(selectedTheme);
      });
    });

    // Appliquer
    overlayEl.querySelector('#ts-apply')?.addEventListener('click', async () => {
      const user = Session.getUser();
      await ThemeManager.saveForUser(user?.id, selectedTheme);
      Toast.success(`Thème "${ThemeManager.themes.find(t=>t.id===selectedTheme)?.label}" appliqué`);
      close();
    });
  }

  function open() {
    if (!overlayEl) createOverlay();
    else {
      markSelected(ThemeManager.current);
      selectedTheme = ThemeManager.current;
      updateLivePreview(ThemeManager.current);
    }
    requestAnimationFrame(() => overlayEl.classList.add('open'));
  }

  function close() {
    if (!overlayEl) return;
    // Si annulé, restaurer le thème précédent
    overlayEl.classList.remove('open');
  }

  return { open, close };

})();
