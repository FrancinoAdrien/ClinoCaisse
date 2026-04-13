/* ═══════════════════════════════════════════════════════════════════
   ClinoCaisse — Toast Notifications
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

window.Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.getElementById('toast-container');
    }
    return this._container;
  },

  show(message, type = 'info', duration = 3500) {
    const container = this._getContainer();
    if (!container) return;

    const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${Utils.esc(message)}</span>`;

    container.appendChild(el);

    const remove = () => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    };

    const timer = setTimeout(remove, duration);
    el.addEventListener('click', () => { clearTimeout(timer); remove(); });

    return el;
  },

  success(msg, dur)  { return this.show(msg, 'success', dur); },
  error(msg, dur)    { return this.show(msg, 'error', dur || 5000); },
  warn(msg, dur)     { return this.show(msg, 'warn', dur); },
  info(msg, dur)     { return this.show(msg, 'info', dur); },
};
