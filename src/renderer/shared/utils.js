/* ═══════════════════════════════════════════════════════════════════
   ClinoCaisse — Shared Utilities
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

window.Utils = {

  // ── FORMATAGE ─────────────────────────────────────────────────────────
  formatMontant(val, devise = 'Ar') {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + devise;
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatDateOnly(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  },

  formatTime(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  todayISO() {
    return new Date().toISOString().slice(0, 10);
  },

  // ── PARSING ───────────────────────────────────────────────────────────
  parseFloat(str) {
    if (!str) return 0;
    return parseFloat(String(str).replace(',', '.')) || 0;
  },

  parseInt(str) {
    return parseInt(str) || 0;
  },

  // ── DOM HELPERS ───────────────────────────────────────────────────────
  el(id) { return document.getElementById(id); },

  qs(selector, parent = document) { return parent.querySelector(selector); },
  qsa(selector, parent = document) { return [...parent.querySelectorAll(selector)]; },

  setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  },

  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  show(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  },

  hide(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  },

  enable(id) {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  },

  disable(id) {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  },

  // ── DEBOUNCE ──────────────────────────────────────────────────────────
  debounce(fn, delay = 300) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // ── CONFIRM DIALOG ────────────────────────────────────────────────────
  async confirm(message, title = 'Confirmation') {
    return new Promise(resolve => {
      Modal.confirm(title, message, resolve);
    });
  },

  // ── IMAGE ─────────────────────────────────────────────────────────────
  blobToBase64(blob) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  },

  fileToBuffer(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(file);
    });
  },

  // ── DEVISE ────────────────────────────────────────────────────────────
  getDevise() {
    return localStorage.getItem('cc_devise') || 'Ar';
  },

  // ── SANITIZE ─────────────────────────────────────────────────────────
  esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  // ── GENERATE ID ───────────────────────────────────────────────────────
  uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  },

  // ── PERMISSIONS CHECK ─────────────────────────────────────────────────
  checkPerm(perm) {
    if (!Session.hasPerm(perm)) {
      Toast.error(`Accès refusé : permission "${perm}" requise`);
      return false;
    }
    return true;
  },
};

// Charger la devise depuis les paramètres au démarrage
(async () => {
  try {
    const devise = await window.api.parametres.get('caisse.devise');
    if (devise) localStorage.setItem('cc_devise', devise);
  } catch {}
})();
