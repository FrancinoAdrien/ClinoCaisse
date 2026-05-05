'use strict';

(function LivraisonModule() {
  let currentTab = 'en_attente';
  let items = [];
  let realtimeBound = false;
  let searchQuery = '';
  let filterDateDebut = '';
  let filterDateFin = '';

  const STATUTS = [
    { id: 'en_attente', label: 'En attente' },
    { id: 'en_cours', label: 'En cours' },
    { id: 'termine', label: 'Terminé' },
    { id: 'annule', label: 'Annulées' },
  ];

  function operateurCourant() {
    const u = Session.getUser();
    if (!u) return null;
    return [u.nom, u.prenom].filter(Boolean).join(' ').trim() || u.nom || null;
  }

  function isPendingVente(row) {
    return !row.vente_uuid || String(row.vente_uuid).trim() === '';
  }

  function formatMoney(n, devise) {
    return `${Math.round(n || 0).toLocaleString('fr-FR')} ${devise || 'Ar'}`;
  }

  function formatDateFr(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString('fr-FR');
    } catch {
      return iso;
    }
  }

  function buildBonPreviewFromDetail(det, devise, en) {
    const t = packTicketFromDetail(det, devise);
    const L = 40;
    const s2 = '═'.repeat(L);
    const s1 = '─'.repeat(L);
    const ctr = str => { const p = Math.max(0, (L - str.length) / 2 | 0); return ' '.repeat(p) + str; };
    const rgt = (label, val) => `${label.padEnd(L - val.length - 1)}${val}`;
    const dev = devise || 'Ar';
    const liv = t.livraison || {};
    const lines = [
      s2,
      en.nom ? ctr(en.nom.toUpperCase()) : null,
      en.adresse ? ctr(en.adresse) : null,
      en.ville ? ctr(en.ville) : null,
      en.tel ? ctr('Tél: ' + en.tel) : null,
      en.email ? ctr('Email: ' + en.email) : null,
      en.nif ? ctr('NIF: ' + en.nif) : null,
      en.stat ? ctr('STAT: ' + en.stat) : null,
      s2, '',
      ctr('BON DE COMMANDE'),
      '',
      `Bon N° : ${t.numero_bon || t.numero_ticket}`,
      `Date   : ${new Date(t.date_vente).toLocaleString('fr-FR')}`,
      `Vendeur: ${t.nom_caissier || '-'}`,
      '', s1,
      ctr('LIVRAISON'),
    ];
    if (liv.adresse) lines.push(`Adresse : ${liv.adresse}`);
    if (liv.lieu) lines.push(`Lieu    : ${liv.lieu}`);
    if (liv.date_prevue) {
      lines.push(`Livr. le: ${liv.date_prevue}${liv.heure_prevue ? ' à ' + liv.heure_prevue : ''}`);
    }
    if (liv.client_nom) lines.push(`Client  : ${liv.client_nom}`);
    if (liv.contact_tel) lines.push(`Tél.    : ${liv.contact_tel}`);
    lines.push(s1, '');
    lines.push(`${'Qté'.padEnd(4)} ${'Désignation'.padEnd(L - 17).slice(0, L - 17)} ${'Montant'.padStart(11)}`);
    lines.push(s1);
    for (const l of (t.lignes || [])) {
      const mt = l.est_offert
        ? '(OFFERT)'.padStart(11)
        : `${String(Math.round(l.total_ttc || 0)).padStart(9)} ${dev}`;
      const sub = l.remise > 0 ? `\n${''.padEnd(5)}↳ Remise: ${l.remise}%` : '';
      lines.push(`${String(Math.round(l.quantite)).padEnd(4)} ${(l.produit_nom || '').padEnd(L - 17).slice(0, L - 17)} ${mt}${sub}`);
    }
    lines.push(s1, '');
    if (t.remise_totale > 0) lines.push(rgt('Remises  :', `-${Math.round(t.remise_totale)} ${dev}`));
    lines.push(rgt('TOTAL    :', `${Math.round(t.total_ttc || 0).toLocaleString('fr-FR')} ${dev}`));
    lines.push(rgt('Mode     :', t.mode_paiement || 'CASH'));
    if ((t.montant_paye || 0) > 0) lines.push(rgt('Payé     :', `${Math.round(t.montant_paye).toLocaleString('fr-FR')} ${dev}`));
    if ((t.monnaie_rendue || 0) > 0) lines.push(rgt('Rendu    :', `${Math.round(t.monnaie_rendue).toLocaleString('fr-FR')} ${dev}`));
    lines.push('', s2);
    if (en.slogan) lines.push(ctr(en.slogan));
    if (en.slogan) lines.push(s2);
    lines.push('', s1, ctr('Signature du client'), '', '_'.repeat(32), '', '_'.repeat(32));
    return lines.filter(l => l !== null && l !== undefined && l !== '').join('\n');
  }

  function packTicketFromDetail(det, devise) {
    const v = det.vente;
    const l = det.livraison;
    const bruts = (v.lignes || []).reduce((s, x) => s + (x.prix_unitaire || 0) * (x.quantite || 0), 0);
    const remiseTotale = Math.max(0, bruts - (v.total_ttc || 0));
    return {
      numero_ticket: v.numero_ticket,
      numero_bon: l.numero_bon || undefined,
      date_vente: v.date_vente,
      nom_caissier: v.nom_caissier,
      total_ttc: v.total_ttc,
      remise_totale: v.remise_totale != null ? v.remise_totale : remiseTotale,
      mode_paiement: v.mode_paiement,
      montant_paye: v.montant_paye,
      monnaie_rendue: v.monnaie_rendue,
      devise: devise || 'Ar',
      lignes: (v.lignes || []).map(x => ({
        produit_nom: x.produit_nom,
        quantite: x.quantite,
        total_ttc: x.total_ttc,
        remise: x.remise || 0,
        est_offert: x.est_offert,
      })),
      livraison: {
        adresse: l.adresse,
        lieu: l.lieu,
        date_prevue: l.date_prevue,
        heure_prevue: l.heure_prevue,
        client_nom: l.client_nom,
        contact_tel: l.contact_tel,
      },
      estBonLivraison: true,
    };
  }

  async function openBonModal(row) {
    const det = await window.api.livraisons.getBonDetail(row.uuid || row.id);
    if (!det) {
      Toast.error('Bon introuvable');
      return;
    }
    const params = await window.api.parametres.getAll().catch(() => ({}));
    const devise = params['caisse.devise'] || localStorage.getItem('cc_devise') || 'Ar';
    const en = {
      nom: params['entreprise.nom'] || '',
      adresse: params['entreprise.adresse'] || '',
      ville: params['entreprise.ville'] || '',
      tel: params['entreprise.telephone'] || '',
      email: params['entreprise.email'] || '',
      nif: params['entreprise.nif'] || '',
      stat: params['entreprise.stat'] || '',
      slogan: params['entreprise.slogan'] || '',
      logo_url: params['entreprise.logo_url'] || '',
    };
    const lignes = buildBonPreviewFromDetail(det, devise, en);
    const pack = packTicketFromDetail(det, devise);
    const copies = parseInt(params['impression.copies_ticket'] || '1', 10) || 1;
    const visId = 'liv-bon-' + Date.now();
    Modal.open({
      id: visId,
      title: `Bon ${pack.numero_ticket}`,
      width: '540px',
      content: `
        <div class="ticket-preview-paper" style="display: flex; justify-content: center;">
          <div style="display: inline-block; text-align: left;">
            ${en.logo_url ? `<div style="display:block; width:100%; text-align:center; margin-bottom:10px; line-height:1;"><img src="${Utils.esc(en.logo_url)}" style="max-height:60px; max-width: 150px; object-fit: contain; display:block; margin:0 auto;"></div>` : ''}
            <pre style="margin:0; padding:0; font-family:'Courier New', Courier, monospace; font-size:13px; line-height:1.2; font-weight:900; white-space:pre;">${Utils.esc(lignes)}</pre>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close="${visId}">Fermer</button>
        <button class="btn btn-primary" id="liv-modal-print">Imprimer</button>
      `,
    });
    setTimeout(() => {
      document.getElementById('liv-modal-print')?.addEventListener('click', async () => {
        await window.api.printer.printBonLivraison({ ...pack, copies });
        Toast.success('Bon envoyé à l\'imprimante');
        Modal.close(visId);
      });
    }, 20);
  }

  async function onStatutChange(row, newStatut) {
    const res = await window.api.livraisons.updateStatut(row.uuid || row.id, newStatut, operateurCourant());
    if (!res.success) {
      Toast.error(res.message || 'Mise à jour impossible');
      await loadList();
      return;
    }
    if (res.finalized && res.numero_ticket) {
      Toast.success(`Vente enregistrée : ${res.numero_ticket} (clôture & journal)`);
    } else {
      Toast.success('Statut mis à jour');
    }
    await loadList();
  }

  async function annulerLivraison(row) {
    const ok = await new Promise(r => Modal.confirm('Annuler la livraison',
      `Annuler le bon ${row.numero_bon || row.uuid} ? Aucune vente n’a été enregistrée pour cette commande.`, r));
    if (!ok) return;
    const res = await window.api.livraisons.annuler(row.uuid || row.id, operateurCourant());
    if (!res.success) { Toast.error(res.message || 'Échec'); return; }
    Toast.success('Livraison annulée');
    await loadList();
  }

  function openDecalerModal(row) {
    const mId = 'liv-dec-' + Date.now();
    const dDef = row.date_prevue || '';
    const hDef = row.heure_prevue || '';
    Modal.open({
      id: mId,
      title: 'Décaler la livraison',
      width: '420px',
      content: `
        <p style="margin:0 0 12px;font-size:13px;opacity:0.85">Bon <strong>${Utils.esc(row.numero_bon || '')}</strong></p>
        <div class="livraison-form-grid" style="grid-template-columns:1fr 1fr">
          <div class="lv-field">
            <label>Nouvelle date *</label>
            <input type="date" id="liv-dec-date" value="${Utils.esc(dDef)}" />
          </div>
          <div class="lv-field">
            <label>Nouvelle heure *</label>
            <input type="time" id="liv-dec-heure" value="${Utils.esc(hDef)}" />
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close="${mId}">Annuler</button>
        <button class="btn btn-primary" id="liv-dec-ok">Enregistrer</button>
      `,
    });
    setTimeout(() => {
      document.getElementById('liv-dec-ok')?.addEventListener('click', async () => {
        const date_prevue = document.getElementById('liv-dec-date')?.value || '';
        const heure_prevue = document.getElementById('liv-dec-heure')?.value || '';
        if (!date_prevue || !heure_prevue) {
          Toast.warn('Indiquez date et heure');
          return;
        }
        const res = await window.api.livraisons.decaler(row.uuid || row.id, { date_prevue, heure_prevue }, operateurCourant());
        if (!res.success) { Toast.error(res.message || 'Échec'); return; }
        Toast.success('Livraison décalée');
        Modal.close(mId);
        await loadList();
      });
    }, 20);
  }

  async function loadList() {
    try {
      items = await window.api.livraisons.getAll() || [];
    } catch {
      items = [];
    }
    renderTabContent();
    updateTabCounts();
  }

  function updateTabCounts() {
    STATUTS.forEach(s => {
      const n = items.filter(i => i.statut === s.id).length;
      const el = document.getElementById(`liv-count-${s.id}`);
      if (el) el.textContent = String(n);
    });
  }

  function renderTabContent() {
    const container = document.getElementById('livraison-tab-inner');
    if (!container) return;

    const filtered = items.filter(i => {
      if (i.statut !== currentTab) return false;
      if (!searchQuery) return true;
      const nom = (i.client_nom || '').toLowerCase();
      const bon = (i.numero_bon || '').toLowerCase();
      const ticket = (i.numero_ticket || '').toLowerCase();
      const lieu = (i.lieu || '').toLowerCase();
      const adresse = (i.adresse || '').toLowerCase();
      
      const matchText = !searchQuery || nom.includes(searchQuery) || bon.includes(searchQuery) || ticket.includes(searchQuery) || lieu.includes(searchQuery) || adresse.includes(searchQuery);
      if (!matchText) return false;
      
      let dateAComparer = i.date_prevue;
      if (!dateAComparer) {
        dateAComparer = i.date_vente ? i.date_vente.slice(0, 10) : new Date(i.last_modified_at || Date.now()).toISOString().slice(0, 10);
      }
      if (filterDateDebut && dateAComparer < filterDateDebut) return false;
      if (filterDateFin && dateAComparer > filterDateFin) return false;
      
      return true;
    });
    const devise = localStorage.getItem('cc_devise') || 'Ar';

    if (!filtered.length) {
      container.innerHTML = `<div class="livraison-empty">Aucune livraison trouvée.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="livraison-grid">
        ${filtered.map(row => {
          const nom = row.client_nom ? Utils.esc(row.client_nom) : '<span style="opacity:0.55">Sans nom</span>';
          const addr = Utils.esc((row.adresse || '').slice(0, 120)) + ((row.adresse || '').length > 120 ? '…' : '');
          const when = row.date_prevue
            ? `${Utils.esc(row.date_prevue)}${row.heure_prevue ? ' · ' + Utils.esc(row.heure_prevue) : ''}`
            : '—';
          const refBon = row.numero_ticket || row.numero_bon || '—';
          const dateAffiche = row.date_vente
            ? formatDateFr(row.date_vente)
            : (row.last_modified_at ? new Date(row.last_modified_at).toLocaleString('fr-FR') : '—');
          const pending = isPendingVente(row);
          const figee = row.statut === 'termine' || row.statut === 'annule';
          const statutsSel = STATUTS.filter(s => s.id !== 'annule');
          const extraBtns = (!figee && pending)
            ? `<button type="button" class="btn-liv-secondaire" data-decaler="${Utils.esc(row.uuid)}">Décaler</button>
               <button type="button" class="btn-liv-danger" data-annuler="${Utils.esc(row.uuid)}">Annuler</button>`
            : '';
          const pendingNote = (pending && row.statut !== 'annule')
            ? '<div style="font-size:11px;opacity:0.75;margin-top:6px">Vente non encore en caisse — finalisation à « Terminé ».</div>'
            : '';
          let statutBloc;
          if (row.statut === 'annule') {
            statutBloc = '<div><label>Statut</label><div class="liv-statut-lecture">Annulée</div></div>';
          } else if (row.statut === 'termine') {
            statutBloc = '<div><label>Statut</label><div class="liv-statut-lecture">Terminée</div></div>';
          } else {
            statutBloc = `
                <label>Statut</label>
                <select class="liv-statut-select" data-uuid="${Utils.esc(row.uuid)}" data-id="${row.id}">
                  ${statutsSel.map(s => `<option value="${s.id}" ${row.statut === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
                </select>`;
          }
          return `
            <div class="livraison-card" data-liv-uuid="${Utils.esc(row.uuid)}">
              <div class="livraison-card-header">
                <span class="livraison-card-num">${Utils.esc(refBon)}</span>
                <span style="font-size:12px;opacity:0.75">${dateAffiche}</span>
              </div>
              <div class="livraison-card-meta">
                <strong>${nom}</strong><br/>
                ${addr}<br/>
                <strong>Lieu :</strong> ${Utils.esc(row.lieu || '—')}<br/>
                <strong>Prévu :</strong> ${when}<br/>
                <strong>Total :</strong> ${formatMoney(row.total_ttc, devise)}
                ${row.caissier_vente ? `<br/><strong>Saisie :</strong> ${Utils.esc(row.caissier_vente)}` : ''}
                ${pendingNote}
              </div>
              <div class="livraison-card-actions">
                ${statutBloc}
                <button type="button" class="btn-liv-voir-bon" data-bon-uuid="${Utils.esc(row.uuid)}">Voir le bon</button>
                ${extraBtns}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.liv-statut-select').forEach(sel => {
      sel.addEventListener('change', async e => {
        const uuid = e.target.dataset.uuid;
        const row = items.find(i => i.uuid === uuid);
        if (row) await onStatutChange(row, e.target.value);
      });
    });
    container.querySelectorAll('[data-bon-uuid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uuid = btn.getAttribute('data-bon-uuid');
        const row = items.find(i => i.uuid === uuid);
        if (row) await openBonModal(row);
      });
    });
    container.querySelectorAll('[data-annuler]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uuid = btn.getAttribute('data-annuler');
        const row = items.find(i => i.uuid === uuid);
        if (row) await annulerLivraison(row);
      });
    });
    container.querySelectorAll('[data-decaler]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uuid = btn.getAttribute('data-decaler');
        const row = items.find(i => i.uuid === uuid);
        if (row) openDecalerModal(row);
      });
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.livraison-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderTabContent();
  }

  function render() {
    const container = document.getElementById('view-livraison');
    container.innerHTML = `
      <div id="livraison-topbar">
        <div class="livraison-topbar-logo">
          <div class="livraison-logo-icon">🚚</div>
          <div>
            <div style="font-size:18px;font-weight:800;color:var(--text)">Livraisons</div>
            <div style="font-size:11px;opacity:0.5;font-weight:400;color:var(--text)">Bons de commande et suivi</div>
          </div>
        </div>
        <div style="flex:1; display:flex; justify-content:center; padding:0 20px;">
          <div style="position:relative; width:100%; max-width:500px;">
            <input type="text" id="liv-search" value="${Utils.esc(searchQuery)}" placeholder="Rechercher par nom, adresse, lieu, n° ticket/bon..." style="width:100%; padding:8px 12px 8px 36px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,0.05); color:var(--text); font-size:13px;" />
            <svg style="position:absolute; left:12px; top:50%; transform:translateY(-50%); opacity:0.5; pointer-events:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
        </div>
        <button type="button" class="btn-topbar-back" id="livraison-btn-back" style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.06);color:var(--text);cursor:pointer;font-size:13px;font-weight:600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Dashboard
        </button>
      </div>
      <div id="livraison-tabs" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex;">
          ${STATUTS.map(s => `
            <button type="button" class="livraison-tab${currentTab === s.id ? ' active' : ''}" data-tab="${s.id}" id="tab-liv-${s.id}">
              ${s.label}
              <span class="liv-tab-count" id="liv-count-${s.id}">0</span>
            </button>
          `).join('')}
        </div>
        <div style="display:flex; gap:10px; align-items:center; padding-right:20px;">
          <input type="date" id="liv-search-debut" value="${Utils.esc(filterDateDebut)}" style="padding:6px 10px; border-radius:6px; border:1px solid var(--border); background:rgba(255,255,255,0.05); color:var(--text); font-size:12px; cursor:pointer;" />
          <span style="font-size:12px; opacity:0.6;">à</span>
          <input type="date" id="liv-search-fin" value="${Utils.esc(filterDateFin)}" style="padding:6px 10px; border-radius:6px; border:1px solid var(--border); background:rgba(255,255,255,0.05); color:var(--text); font-size:12px; cursor:pointer;" />
        </div>
      </div>
      <p style="margin:0 20px 8px;font-size:12px;opacity:0.65">La vente n’est comptabilisée (clôture, journal « Vente ») qu’après passage au statut <strong>Terminé</strong>. Toutes les actions enregistrent l’opérateur dans le journal.</p>
      <div id="livraison-content">
        <div id="livraison-tab-inner"></div>
      </div>
    `;

    document.getElementById('livraison-btn-back')?.addEventListener('click', () => Router.go('dashboard'));
    document.querySelectorAll('.livraison-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    document.getElementById('liv-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTabContent();
    });
    
    document.getElementById('liv-search-debut')?.addEventListener('change', (e) => {
      filterDateDebut = e.target.value;
      renderTabContent();
    });

    document.getElementById('liv-search-fin')?.addEventListener('change', (e) => {
      filterDateFin = e.target.value;
      renderTabContent();
    });

    if (!realtimeBound && window.api?.events?.onDataChanged) {
      realtimeBound = true;
      window.api.events.onDataChanged((payload) => {
        if (payload?.scope && payload.scope !== 'livraisons') return;
        const v = document.getElementById('view-livraison');
        if (v?.classList.contains('active')) loadList();
      });
    }

    loadList();
  }

  document.addEventListener('view:activate', e => {
    if (e.detail.view === 'livraison') {
      if (!document.getElementById('livraison-topbar')) render();
      else loadList();
    }
  });
})();
