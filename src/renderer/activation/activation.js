'use strict';

/**
 * Module d'activation de la licence
 */
(function() {
    
    async function init() {
        const view = document.getElementById('view-activation');
        if (!view) return;

        // Charger le HTML s'il n'est pas déjà là
        const response = await fetch('activation/activation.html');
        view.innerHTML = await response.text();

        // Injecter le CSS s'il n'est pas déjà présent
        if (!document.getElementById('activation-css')) {
            const link = document.createElement('link');
            link.id = 'activation-css';
            link.rel = 'stylesheet';
            link.href = 'activation/activation.css';
            document.head.appendChild(link);
        }

        setupEvents();
        updateStatus();
    }

    async function updateStatus() {
        const status = await window.api.license.status();
        const trialInfo = document.getElementById('trial-info');
        const btnRetour = document.getElementById('btn-activation-retour');

        if (status.status === 'expired') {
            if (trialInfo) trialInfo.textContent = 'Période d\'essai expirée';
            if (btnRetour) btnRetour.style.display = 'none';
        } else if (status.status === 'trial') {
            if (trialInfo) trialInfo.textContent = `Période d'essai en cours`;
            if (btnRetour) {
                btnRetour.style.display = 'inline-block';
                btnRetour.onclick = () => {
                    const session = window.Session?.getUser();
                    window.Router.go(session ? 'dashboard' : 'login');
                };
            }
        }
    }

    function setupEvents() {
        const btnActivate = document.getElementById('btn-activate');
        const btnSync = document.getElementById('btn-sync-cloud');
        const input = document.getElementById('license-key');

        btnActivate?.addEventListener('click', async () => {
            const key = input.value.trim();
            if (!key) {
                window.Toast.warn('Veuillez entrer une clé');
                return;
            }

            btnActivate.disabled = true;
            btnActivate.textContent = 'Vérification...';

            const res = await window.api.license.activate(key);
            if (res.success) {
                window.Toast.success(res.message);
                // Rediriger vers l'app
                setTimeout(() => window.location.reload(), 1500);
            } else {
                window.Toast.error(res.message);
                btnActivate.disabled = false;
                btnActivate.textContent = 'Valider la clé';
            }
        });

        btnSync?.addEventListener('click', async () => {
            let config = await window.api.sync.getConfig();
            
            // Si le cloud n'est pas configuré, on lit les champs directement
            if (!config.url || !config.key) {
                const urlInput = document.getElementById('cloud-url')?.value.trim();
                const keyInput = document.getElementById('cloud-key')?.value.trim();
                
                if (!urlInput || !keyInput) {
                    window.Toast.warn('Veuillez renseigner l\'URL et la Clé Supabase, ou la clé journalière.');
                    return;
                }
                
                btnSync.disabled = true;
                btnSync.innerHTML = '<span class="icon">⌛</span> Configuration...';
                
                const confRes = await window.api.sync.configure(urlInput, keyInput);
                if (!confRes.success) {
                    window.Toast.error(confRes.message);
                    btnSync.disabled = false;
                    btnSync.innerHTML = '<span class="icon">☁️</span> Enregistrer et Synchroniser';
                    return;
                }
                // Attendre l'initialisation du syncEngine
                await new Promise(r => setTimeout(r, 800));
            }

            btnSync.disabled = true;
            btnSync.innerHTML = '<span class="icon">⌛</span> Synchronisation...';

            const res = await window.api.license.sync();
            if (res.success) {
                window.Toast.success(res.message);
                setTimeout(() => window.location.reload(), 1500);
            } else {
                window.Toast.info(res.message);
                btnSync.disabled = false;
                btnSync.innerHTML = '<span class="icon">☁️</span> Enregistrer et Synchroniser';
            }
        });
    }

    // Écouter l'activation de la vue
    document.addEventListener('view:activate', (e) => {
        if (e.detail.view === 'activation') {
            init();
        }
    });

})();
