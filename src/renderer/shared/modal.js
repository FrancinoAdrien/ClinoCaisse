'use strict';

window.Modal = {
  _container: null,
  _stack: [],

  _getContainer() {
    if (!this._container) this._container = document.getElementById('modal-container');
    return this._container;
  },

  // ── MODAL GÉNÉRIQUE ────────────────────────────────────────────────
  open({ id, title, width = '480px', content = '', footer = '', onClose } = {}) {
    const modalId = id || ('modal-' + Date.now() + '-' + Math.floor(Math.random()*1000));
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = `overlay-${modalId}`;

    overlay.innerHTML = `
      <div class="modal" style="width:${width}; max-width: 95vw;">
        <div class="modal-header">
          <h3>${Utils.esc(title)}</h3>
          <button class="modal-close" data-close="${modalId}">✕</button>
        </div>
        <div class="modal-body" id="modal-body-${modalId}">
          ${content}
        </div>
        ${footer ? `<div class="modal-footer" id="modal-footer-${modalId}">${footer}</div>` : ''}
      </div>
    `;

    this._getContainer().appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close(modalId);
    });

    // Close buttons with data-close attribute
    overlay.querySelectorAll(`[data-close="${modalId}"]`).forEach(btn => {
      btn.addEventListener('click', () => this.close(modalId));
    });

    this._stack.push({ id: modalId, onClose });
    document.addEventListener('keydown', this._escHandler.bind(this));

    return modalId;
  },

  close(id) {
    const targetId = id || this._stack[this._stack.length - 1]?.id;
    const overlay = document.getElementById(`overlay-${targetId}`);
    if (!overlay) return;

    overlay.classList.remove('open');
    const idx = this._stack.findIndex(e => e.id === targetId);
    if (idx >= 0) {
      const entry = this._stack.splice(idx, 1)[0];
      if (entry?.onClose) entry.onClose();
    }

    setTimeout(() => overlay.remove(), 250);
  },

  closeAll() {
    const ids = this._stack.map(e => e.id);
    ids.forEach(id => this.close(id));
  },

  _escHandler(e) {
    if (e.key === 'Escape' && this._stack.length > 0) {
      this.close(this._stack[this._stack.length - 1].id);
    }
  },

  // ── CONFIRM DIALOG ─────────────────────────────────────────────────
  confirm(title, message, callback) {
    // Pré-générer l'ID pour pouvoir le référencer dans le footer
    const uid = 'confirm-' + Date.now();
    const modalId = this.open({
      id: uid,
      title,
      width: '420px',
      content: `<p style="line-height:1.7; opacity:0.9;">${Utils.esc(message)}</p>`,
      footer: `
        <button class="btn btn-ghost" id="${uid}-cancel">Annuler</button>
        <button class="btn btn-danger" id="${uid}-ok">Confirmer</button>
      `,
    });

    // Bind après insertion dans le DOM
    setTimeout(() => {
      document.getElementById(`${uid}-ok`)?.addEventListener('click', () => {
        this.close(modalId);
        callback(true);
      });
      document.getElementById(`${uid}-cancel`)?.addEventListener('click', () => {
        this.close(modalId);
        callback(false);
      });
    }, 20);
  },

  // ── PROMPT DIALOG ──────────────────────────────────────────────────
  prompt(title, message, defaultVal = '', callback) {
    const uid = 'prompt-' + Date.now();
    const modalId = this.open({
      id: uid,
      title,
      width: '440px',
      content: `
        <p style="margin-bottom:14px; opacity:0.9;">${Utils.esc(message)}</p>
        <input class="input" id="${uid}-input" value="${Utils.esc(String(defaultVal))}" type="text" />
      `,
      footer: `
        <button class="btn btn-ghost" id="${uid}-cancel">Annuler</button>
        <button class="btn btn-primary" id="${uid}-ok">OK</button>
      `,
    });

    setTimeout(() => {
      const input = document.getElementById(`${uid}-input`);
      input?.focus();
      input?.select();

      const doOk = () => {
        const val = input?.value ?? '';
        this.close(modalId);
        callback(val);
      };

      document.getElementById(`${uid}-ok`)?.addEventListener('click', doOk);
      document.getElementById(`${uid}-cancel`)?.addEventListener('click', () => {
        this.close(modalId);
        callback(null);
      });
      input?.addEventListener('keydown', e => { if (e.key === 'Enter') doOk(); });
    }, 20);
  },

  // ── ALERT ─────────────────────────────────────────────────────────
  alert(title, message, type = 'info') {
    const icon = { info:'ℹ️', success:'✅', error:'❌', warn:'⚠️' }[type] || 'ℹ️';
    const uid = 'alert-' + Date.now();
    const modalId = this.open({
      id: uid,
      title,
      width: '420px',
      content: `
        <div style="display:flex;gap:14px;align-items:flex-start">
          <span style="font-size:30px;line-height:1">${icon}</span>
          <p style="line-height:1.7;opacity:0.9;flex:1">${Utils.esc(message)}</p>
        </div>
      `,
      footer: `<button class="btn btn-primary" id="${uid}-ok">OK</button>`,
    });
    setTimeout(() => {
      document.getElementById(`${uid}-ok`)?.addEventListener('click', () => this.close(modalId));
    }, 20);
  },

  // ── BODY ACCESSOR ─────────────────────────────────────────────────
  getBody(id) {
    return document.getElementById(`modal-body-${id}`);
  },
};
