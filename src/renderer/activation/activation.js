'use strict';

/**
 * Module d'activation ClinoCaisse (mensuelle + définitive)
 */
(function ActivationModule() {

  let _statusPollInterval = null;

  async function init() {
    const view = document.getElementById('view-activation');
    if (!view) return;

    const response = await fetch('activation/activation.html');
    view.innerHTML = await response.text();

    if (!document.getElementById('activation-css')) {
      const link = document.createElement('link');
      link.id   = 'activation-css';
      link.rel  = 'stylesheet';
      link.href = 'activation/activation.css';
      document.head.appendChild(link);
    }

    setupEvents();
    await refreshStatus();
  }

  // ── Mise à jour du statut affiché ─────────────────────────────────────
  async function refreshStatus() {
    let status;
    try { status = await window.api.license.status(); }
    catch (e) { return; }

    const msgEl      = document.getElementById('act-status-msg');
    const statusCard = document.getElementById('act-status-card');
    const badgeEl    = document.getElementById('act-status-badge');
    const expireEl   = document.getElementById('act-expire-date');
    const expireRow  = document.getElementById('act-expire-row');
    const remainEl   = document.getElementById('act-remain');
    const remainRow  = document.getElementById('act-remain-row');
    const retourBtn  = document.getElementById('btn-act-retour');

    const sectNormal = document.getElementById('act-section-normal');
    const sectFuture = document.getElementById('act-section-future');

    // ── Bouton Retour ─────────────────────────────────────────────────
    if (retourBtn) {
      if (status.valid) {
        retourBtn.style.display = 'inline-flex';
        retourBtn.onclick = () => {
          const session = window.Session?.getUser();
          window.Router.go(session ? 'dashboard' : 'login');
        };
      } else {
        retourBtn.style.display = 'none';
      }
    }

    // ── Message et statut ─────────────────────────────────────────────
    if (statusCard) statusCard.style.display = 'none';

    if (status.status === 'activated') {
      // Activation définitive
      if (msgEl) { msgEl.className = 'act-status-ok'; msgEl.textContent = '✅ Licence définitive active — application illimitée'; }
      if (statusCard) statusCard.style.display = 'block';
      if (sectNormal) sectNormal.style.display = 'block'; // On laisse normal au cas où on veut relancer (?) ou plutôt masquer ?
      if (sectFuture) sectFuture.style.display = 'none';
      if (badgeEl)  { badgeEl.className = 'act-badge act-badge--active'; badgeEl.textContent = 'DÉFINITIVE'; }
      if (expireEl)  expireEl.textContent = 'Illimitée';
      if (remainEl)  remainEl.textContent = '♾ Sans limite';

    } else if (status.status === 'activated_monthly') {
      const rem = status.remainingMs;
      const WARN_MS = status.warnAt || 5 * 60 * 1000;
      const user = window.Session?.getUser();
      const isAdmin = user && user.role === 'admin';

      if (rem > WARN_MS) {
        if (msgEl) { msgEl.className = 'act-status-ok'; msgEl.textContent = '✅ Licence mensuelle active'; }
        if (sectNormal) sectNormal.style.display = 'block';
        
        // Seuls les admins voient la pré-activation
        if (sectFuture) {
          if (isAdmin) {
            sectFuture.style.display = 'block';
            _updateFutureSlotsUI(status.futureSlotsActivated);
          } else {
            sectFuture.style.display = 'none';
          }
        }
      } else {
        if (msgEl) { msgEl.className = 'act-status-warn'; msgEl.textContent = `⚠️ Expire bientôt — ${status.remainingText}`; }
        if (sectNormal) sectNormal.style.display = 'block';
        if (sectFuture) sectFuture.style.display = 'none';
      }
      
      if (statusCard) statusCard.style.display = 'block';
      if (badgeEl) {
        badgeEl.className = 'act-badge ' + (rem > WARN_MS ? 'act-badge--active' : 'act-badge--warn');
        badgeEl.textContent = rem > WARN_MS ? 'MENSUELLE' : 'BIENTÔT EXPIRÉE';
      }
      if (expireEl)  expireEl.textContent  = status.expiresAtFormatted || '—';
      if (remainEl)  remainEl.textContent  = status.remainingText || '—';
      if (expireRow) expireRow.style.display = '';
      if (remainRow) remainRow.style.display = '';

    } else if (status.status === 'expired') {
      if (msgEl) { msgEl.className = 'act-status-err'; msgEl.textContent = '❌ Licence expirée — Entrez le code du mois courant'; }
      if (sectNormal) sectNormal.style.display = 'block';
      if (sectFuture) sectFuture.style.display = 'none';

    } else {
      if (msgEl) { msgEl.className = 'act-status-err'; msgEl.textContent = '🔒 Aucune licence active — Entrez votre code d\'activation'; }
      if (sectNormal) sectNormal.style.display = 'block';
      if (sectFuture) sectFuture.style.display = 'none';
    }
  }

  function _updateFutureSlotsUI(slots) {
    if (!slots) return;
    
    // Slot 1
    const s1 = document.getElementById('act-future-1-status');
    const i1 = document.getElementById('act-future-1');
    const b1 = document.getElementById('btn-act-future-1');
    if (s1 && i1 && b1) {
      if (slots.slot1) {
        s1.textContent = '✅ Enregistrée'; s1.style.color = '#34d399';
        i1.value = '•••••••••••••••••••••'; i1.disabled = true; b1.disabled = true;
      } else {
        s1.textContent = 'En attente'; s1.style.color = '';
        i1.value = ''; i1.disabled = false; b1.disabled = false;
      }
    }

    // Slot 2
    const d2 = document.getElementById('act-future-slot-2');
    const s2 = document.getElementById('act-future-2-status');
    const i2 = document.getElementById('act-future-2');
    const b2 = document.getElementById('btn-act-future-2');
    if (d2 && s2 && i2 && b2) {
      if (slots.slot2) {
        s2.textContent = '✅ Enregistrée'; s2.style.color = '#34d399';
        i2.value = '•••••••••••••••••••••'; i2.disabled = true; b2.disabled = true;
        d2.style.opacity = '1';
      } else {
        if (slots.slot1) {
          s2.textContent = 'En attente'; s2.style.color = '';
          i2.value = ''; i2.disabled = false; b2.disabled = false;
          d2.style.opacity = '1';
        } else {
          s2.textContent = '🔒 Nécessite mois +1'; s2.style.color = 'rgba(255,255,255,0.3)';
          i2.value = ''; i2.disabled = true; b2.disabled = true;
          d2.style.opacity = '0.5';
        }
      }
    }

    // Slot 3
    const d3 = document.getElementById('act-future-slot-3');
    const s3 = document.getElementById('act-future-3-status');
    const i3 = document.getElementById('act-future-3');
    const b3 = document.getElementById('btn-act-future-3');
    if (d3 && s3 && i3 && b3) {
      if (slots.slot3) {
        s3.textContent = '✅ Enregistrée'; s3.style.color = '#34d399';
        i3.value = '•••••••••••••••••••••'; i3.disabled = true; b3.disabled = true;
        d3.style.opacity = '1';
      } else {
        if (slots.slot2) {
          s3.textContent = 'En attente'; s3.style.color = '';
          i3.value = ''; i3.disabled = false; b3.disabled = false;
          d3.style.opacity = '1';
        } else {
          s3.textContent = '🔒 Nécessite mois +2'; s3.style.color = 'rgba(255,255,255,0.3)';
          i3.value = ''; i3.disabled = true; b3.disabled = true;
          d3.style.opacity = '0.5';
        }
      }
    }
  }

  // ── Binding des événements ────────────────────────────────────────────
  function setupEvents() {
    const btnActivate = document.getElementById('btn-act-current');
    const input       = document.getElementById('act-key-current');

    btnActivate?.addEventListener('click', async () => {
      const key = input?.value.trim();
      if (!key) { window.Toast?.warn('Veuillez entrer une clé.'); return; }

      btnActivate.disabled    = true;
      btnActivate.textContent = '⌛ Vérification…';

      const res = await window.api.license.activate(key);

      if (res.success) {
        window.Toast?.success(res.message);
        if (input) input.value = '';
        setTimeout(() => window.location.reload(), 1400);
      } else {
        window.Toast?.error(res.message);
        btnActivate.disabled    = false;
        btnActivate.textContent = 'Activer';
      }
    });

    // Enter dans l'input
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnActivate?.click();
    });

    // Boutons de pré-activation
    [1, 2, 3].forEach(offset => {
      const btn = document.getElementById(`btn-act-future-${offset}`);
      const inp = document.getElementById(`act-future-${offset}`);
      
      btn?.addEventListener('click', async () => {
        const key = inp?.value.trim();
        if (!key) { window.Toast?.warn(`Clé vide pour le mois +${offset}`); return; }

        btn.disabled = true;
        btn.textContent = '⌛';

        const res = await window.api.license.activate(key);
        if (res.success) {
          window.Toast?.success(res.message);
          setTimeout(() => window.location.reload(), 1200);
        } else {
          window.Toast?.error(res.message);
          btn.disabled = false;
          btn.textContent = 'OK';
        }
      });

      inp?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btn?.click();
      });
    });

    // Sync cloud
    document.getElementById('btn-sync-cloud')?.addEventListener('click', _handleSync);
  }

  async function _handleSync() {
    const btn = document.getElementById('btn-sync-cloud');
    let config = await window.api.sync.getConfig();

    if (!config.url || !config.key) {
      const urlInput = document.getElementById('cloud-url')?.value.trim();
      const keyInput = document.getElementById('cloud-key')?.value.trim();
      if (!urlInput || !keyInput) {
        window.Toast?.warn('Veuillez renseigner l\'URL et la Clé Supabase.');
        return;
      }
      btn.disabled  = true;
      btn.innerHTML = '<span>⌛</span> Configuration…';
      const confRes = await window.api.sync.configure(urlInput, keyInput);
      if (!confRes.success) {
        window.Toast?.error(confRes.message);
        btn.disabled  = false;
        btn.innerHTML = '<span>☁️</span> Enregistrer et Synchroniser';
        return;
      }
      await new Promise(r => setTimeout(r, 800));
    }

    btn.disabled  = true;
    btn.innerHTML = '<span>⌛</span> Synchronisation…';
    const res = await window.api.license.sync();
    if (res.success) {
      window.Toast?.success(res.message);
      setTimeout(() => window.location.reload(), 1400);
    } else {
      window.Toast?.info(res.message);
      btn.disabled  = false;
      btn.innerHTML = '<span>☁️</span> Enregistrer et Synchroniser';
    }
  }

  // ── Écoute de l'activation de la vue ─────────────────────────────────
  document.addEventListener('view:activate', (e) => {
    if (e.detail.view === 'activation') {
      if (_statusPollInterval) clearInterval(_statusPollInterval);
      init().then(() => {
        _statusPollInterval = setInterval(async () => {
          if (window.Router.current === 'activation') await refreshStatus();
          else clearInterval(_statusPollInterval);
        }, 5000);
      });
    }
  });

})();
