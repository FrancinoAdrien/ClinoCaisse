'use strict';

// ── LOGIN MODULE ─────────────────────────────────────────────────────────

(function LoginModule() {

  const VIEW = 'view-login';
  let pinCode = '';
  let shaking = false;

  function render() {
    const container = document.getElementById(VIEW);
    container.innerHTML = `
      <div class="login-particles" id="login-particles"></div>

      <div class="login-card">
        <div class="login-logo">
          <div class="logo-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2"/>
              <path d="M22 10H2M7 6V4M12 6V4M17 6V4"/>
              <circle cx="12" cy="15" r="2"/>
            </svg>
          </div>
          <h1>CLINOCAISSE</h1>
          <p>Entrez votre code PIN</p>
        </div>

        <div class="pin-display" id="pin-display"></div>
        <div class="pin-error" id="pin-error"></div>

        <div class="pin-keyboard">
          ${[1,2,3,4,5,6,7,8,9].map(n => `
            <button class="pin-btn" data-num="${n}">${n}</button>
          `).join('')}
          <button class="pin-btn btn-clear" id="pin-clear">C</button>
          <button class="pin-btn" data-num="0">0</button>
          <button class="pin-btn btn-delete" id="pin-delete">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
              <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
            </svg>
          </button>
        </div>

        <div class="login-version">ClinoCaisse v1.0 — ClinoKeys © 2026</div>
      </div>
    `;

    bindEvents();
    createParticles();
    renderPinDisplay();
  }

  function createParticles() {
    const container = document.getElementById('login-particles');
    if (!container) return;
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        width: ${2 + Math.random() * 4}px;
        height: ${2 + Math.random() * 4}px;
        animation-duration: ${5 + Math.random() * 10}s;
        animation-delay: ${Math.random() * 8}s;
        opacity: ${0.2 + Math.random() * 0.5};
      `;
      container.appendChild(p);
    }
  }

  function renderPinDisplay() {
    const disp = document.getElementById('pin-display');
    if (!disp) return;
    disp.innerHTML = [0,1,2,3].map(i => `
      <div class="pin-dot ${i < pinCode.length ? 'filled' : ''}"></div>
    `).join('');
  }

  function setError(msg) {
    const el = document.getElementById('pin-error');
    if (el) el.textContent = msg;
  }

  function shakeCard() {
    if (shaking) return;
    shaking = true;
    const card = document.querySelector('.login-card');
    card?.classList.add('shake');
    setTimeout(() => { card?.classList.remove('shake'); shaking = false; }, 400);
  }

  function addDigit(d) {
    if (pinCode.length >= 4) return;
    pinCode += d;
    renderPinDisplay();
    setError('');
    if (pinCode.length === 4) handleLogin();
  }

  function deleteDigit() {
    if (pinCode.length > 0) {
      pinCode = pinCode.slice(0, -1);
      renderPinDisplay();
    }
  }

  function clearPin() {
    pinCode = '';
    renderPinDisplay();
    setError('');
  }

  async function handleLogin() {
    const pin = pinCode;
    pinCode = '';
    renderPinDisplay();

    const result = await window.api.auth.login(pin);
    if (result.success) {
      Session.setUser(result.user);
      await ThemeManager.loadForUser(result.user.id);
      Router.go('dashboard');
    } else {
      setError(result.message || 'PIN incorrect');
      shakeCard();
    }
  }

  function bindEvents() {
    // Boutons numéros
    document.querySelectorAll('.pin-btn[data-num]').forEach(btn => {
      btn.addEventListener('click', () => addDigit(btn.dataset.num));
    });

    document.getElementById('pin-clear')?.addEventListener('click', clearPin);
    document.getElementById('pin-delete')?.addEventListener('click', deleteDigit);

    // Clavier physique
    document.addEventListener('keydown', handleKeyboard);
  }

  function handleKeyboard(e) {
    if (Router.current !== 'login') return;
    if (e.key >= '0' && e.key <= '9') addDigit(e.key);
    if (e.key === 'Backspace')         deleteDigit();
    if (e.key === 'Escape')            clearPin();
  }

  // Init au chargement de la vue
  document.addEventListener('DOMContentLoaded', () => {
    render();
  });

  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'login') {
      clearPin();
      setError('');
    }
  });

})();
