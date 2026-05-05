'use strict';
const { exec } = require('child_process');
const os = require('os');

// Liste d'imprimantes supportées (thermal & standard)
const SUPPORTED_PRINTERS = [
  { id: 'XPrinter XP80C', label: 'XPrinter XP-80C (Thermique)', width: 80, isDefault: true },
  { id: 'XPrinter XP58', label: 'XPrinter XP-58 (Thermique 58mm)', width: 58 },
  { id: 'XPrinter XP76', label: 'XPrinter XP-76 (Thermique 76mm)', width: 76 },
  { id: 'Epson TM-T88', label: 'Epson TM-T88 (Thermique)', width: 80 },
  { id: 'Epson TM-T20', label: 'Epson TM-T20 (Thermique)', width: 80 },
  { id: 'Epson TM-U220', label: 'Epson TM-U220 (Matricielle)', width: 80 },
  { id: 'Star TSP100', label: 'Star TSP100 (Thermique)', width: 80 },
  { id: 'Star TSP700', label: 'Star TSP700 (Thermique)', width: 80 },
  { id: 'Bixolon SRP-350', label: 'Bixolon SRP-350 (Thermique)', width: 80 },
  { id: 'Bixolon SRP-275', label: 'Bixolon SRP-275 (Matricielle)', width: 80 },
  { id: 'Citizen CT-S310', label: 'Citizen CT-S310 (Thermique)', width: 80 },
  { id: 'Citizen CT-S4000', label: 'Citizen CT-S4000 (Thermique)', width: 80 },
  { id: 'Sam4s Ellix 30', label: 'Sam4s Ellix 30 (Thermique)', width: 80 },
  { id: 'Posiflex PP-8800', label: 'Posiflex PP-8800 (Thermique)', width: 80 },
  { id: 'Generic Text Printer', label: 'Imprimante générique texte', width: 80 },
];

// ── FORMATER UN TICKET DE CAISSE ─────────────────────────────────────────
function formatTicket(data, largeurMm = 80) {
  const w = parseInt(largeurMm) || 80;
  const L = w <= 58 ? 32 : (w <= 76 ? 32 : 34);
  const sep = '─'.repeat(L);
  const sep2 = '═'.repeat(L);
  const devise = data.devise || 'Ar';
  const formatMoney = (v) => Math.round(v || 0).toLocaleString('fr-FR').replace(/\s/g, ' ');
  const center = (s) => { const p = Math.max(0, Math.floor((L - s.length) / 2)); return ' '.repeat(p) + s; };
  const right = (label, val) => {
    const l = `  ${label}`;
    return l.padEnd(Math.max(l.length, L - val.length)) + val;
  };
  const lines = [];

  // ── EN-TÊTE ENTREPRISE ────────────────────────────────────────────
  lines.push(sep2);
  if (data.entrepriseNom) lines.push(center(data.entrepriseNom.toUpperCase()));
  if (data.entrepriseAdresse) lines.push(center(data.entrepriseAdresse));
  if (data.entrepriseVille) lines.push(center(data.entrepriseVille));
  if (data.entrepriseTel) lines.push(center('Tél: ' + data.entrepriseTel));
  if (data.entrepriseEmail) lines.push(center('Email: ' + data.entrepriseEmail));
  if (data.entrepriseNif) lines.push(center('NIF: ' + data.entrepriseNif));
  if (data.entrepriseStat) lines.push(center('STAT: ' + data.entrepriseStat));
  lines.push(sep2);
  lines.push('');

  // ── INFOS TICKET ──────────────────────────────────────────────────
  lines.push(`Ticket : ${data.numero_ticket || '-'}`);
  lines.push(`Date   : ${new Date(data.date_vente || Date.now()).toLocaleString('fr-FR')}`);
  lines.push(`Vendeur: ${data.nom_caissier || '-'}`);
  lines.push('');
  lines.push(sep);

  // ── ARTICLES ──────────────────────────────────────────────────────
  const colQ = 4;
  const colP = L <= 35 ? 11 : 14;
  const colD = Math.max(8, L - colQ - colP - 2);
  lines.push(`${'Qté'.padEnd(colQ)} ${'Désignation'.padEnd(colD)} ${'Montant'.padStart(colP)}`);
  lines.push(sep);

  for (const l of (data.lignes || [])) {
    const qte = String(Math.round(l.quantite || 1)).padEnd(colQ).slice(0, colQ);
    const nom = (l.produit_nom || '').padEnd(colD).slice(0, colD);
    const mtStr = l.est_offert ? '(OFFERT)' : `${formatMoney(l.total_ttc)} ${devise}`;
    const mt = mtStr.padStart(colP).slice(0, colP);
    lines.push(`${qte} ${nom} ${mt}`);
    if (l.remise > 0) lines.push(`${''.padEnd(colQ + 1)}↳ Remise: ${l.remise}%`);
  }

  // ── TOTAUX ────────────────────────────────────────────────────────
  lines.push(sep);
  lines.push('');

  const totalTTC = Math.round(data.total_ttc || 0);
  const montantP = Math.round(data.montant_paye || 0);
  const monnaie = Math.round(data.monnaie_rendue || 0);

  // Afficher remises si présentes
  if ((data.remise_totale || 0) > 0) {
    lines.push(right('Remises :', `-${formatMoney(data.remise_totale)} ${devise}`));
  }
  lines.push(right('TOTAL  :', `${formatMoney(totalTTC)} ${devise}`));
  lines.push(right('Mode   :', data.mode_paiement || 'CASH'));
  if (montantP > 0) {
    lines.push(right('Payé   :', `${formatMoney(montantP)} ${devise}`));
    lines.push(right('Rendu  :', `${formatMoney(monnaie)} ${devise}`));
  }

  // ── PIED DE TICKET ────────────────────────────────────────────────
  lines.push('');
  lines.push(sep2);
  if (data.slogan) {
    lines.push(center(data.slogan));
    lines.push(sep2);
  }
  lines.push(''); lines.push(''); lines.push('');
  return lines.join('\n');
}

// ── BON DE COMMANDE LIVRAISON (même corps que ticket + bloc livraison + signature) ──
function formatBonLivraison(data, largeurMm = 80) {
  const w = parseInt(largeurMm) || 80;
  const L = w <= 58 ? 32 : (w <= 76 ? 32 : 34);
  const sep = '─'.repeat(L);
  const sep2 = '═'.repeat(L);
  const devise = data.devise || 'Ar';
  const formatMoney = (v) => Math.round(v || 0).toLocaleString('fr-FR').replace(/\s/g, ' ');
  const center = (s) => { const p = Math.max(0, Math.floor((L - s.length) / 2)); return ' '.repeat(p) + s; };
  const right = (label, val) => {
    const l = `  ${label}`;
    return l.padEnd(Math.max(l.length, L - val.length)) + val;
  };
  const lines = [];
  const liv = data.livraison || {};

  lines.push(sep2);
  if (data.entrepriseNom) lines.push(center(data.entrepriseNom.toUpperCase()));
  if (data.entrepriseAdresse) lines.push(center(data.entrepriseAdresse));
  if (data.entrepriseVille) lines.push(center(data.entrepriseVille));
  if (data.entrepriseTel) lines.push(center('Tél: ' + data.entrepriseTel));
  if (data.entrepriseEmail) lines.push(center('Email: ' + data.entrepriseEmail));
  if (data.entrepriseNif) lines.push(center('NIF: ' + data.entrepriseNif));
  if (data.entrepriseStat) lines.push(center('STAT: ' + data.entrepriseStat));
  lines.push(sep2);
  lines.push('');
  lines.push(center('BON DE COMMANDE'));
  lines.push('');

  lines.push(`Bon N° : ${data.numero_bon || data.numero_ticket || '-'}`);
  lines.push(`Date   : ${new Date(data.date_vente || Date.now()).toLocaleString('fr-FR')}`);
  lines.push(`Vendeur: ${data.nom_caissier || '-'}`);
  lines.push('');
  lines.push(sep);
  lines.push(center('LIVRAISON'));
  if (liv.adresse) lines.push(`Adresse : ${liv.adresse}`);
  if (liv.lieu) lines.push(`Lieu    : ${liv.lieu}`);
  if (liv.date_prevue) lines.push(`Livr. le: ${liv.date_prevue}${liv.heure_prevue ? ' à ' + liv.heure_prevue : ''}`);
  else if (liv.heure_prevue) lines.push(`Heure   : ${liv.heure_prevue}`);
  if (liv.client_nom) lines.push(`Client  : ${liv.client_nom}`);
  if (liv.contact_tel) lines.push(`Tél.    : ${liv.contact_tel}`);
  lines.push(sep);
  lines.push('');

  const colQ = 4;
  const colP = L <= 35 ? 11 : 14;
  const colD = Math.max(8, L - colQ - colP - 2);
  lines.push(`${'Qté'.padEnd(colQ)} ${'Désignation'.padEnd(colD)} ${'Montant'.padStart(colP)}`);
  lines.push(sep);

  for (const l of (data.lignes || [])) {
    const qte = String(Math.round(l.quantite || 1)).padEnd(colQ).slice(0, colQ);
    const nom = (l.produit_nom || '').padEnd(colD).slice(0, colD);
    const mtStr = l.est_offert ? '(OFFERT)' : `${formatMoney(l.total_ttc)} ${devise}`;
    const mt = mtStr.padStart(colP).slice(0, colP);
    lines.push(`${qte} ${nom} ${mt}`);
    if (l.remise > 0) lines.push(`${''.padEnd(colQ + 1)}↳ Remise: ${l.remise}%`);
  }

  lines.push(sep);
  lines.push('');

  const totalTTC = Math.round(data.total_ttc || 0);
  const montantP = Math.round(data.montant_paye || 0);
  const monnaie = Math.round(data.monnaie_rendue || 0);

  if ((data.remise_totale || 0) > 0) {
    lines.push(right('Remises :', `-${formatMoney(data.remise_totale)} ${devise}`));
  }
  lines.push(right('TOTAL  :', `${formatMoney(totalTTC)} ${devise}`));
  lines.push(right('Mode   :', data.mode_paiement || 'CASH'));
  if (montantP > 0) {
    lines.push(right('Payé   :', `${formatMoney(montantP)} ${devise}`));
    lines.push(right('Rendu  :', `${formatMoney(monnaie)} ${devise}`));
  }

  lines.push('');
  lines.push(sep2);
  if (data.slogan) {
    lines.push(center(data.slogan));
    lines.push(sep2);
  }
  lines.push('');
  lines.push(sep);
  lines.push(center('Signature du client'));
  lines.push('');
  lines.push('_'.repeat(Math.min(L, 32)));
  lines.push('');
  lines.push('_'.repeat(Math.min(L, 32)));
  lines.push(''); lines.push(''); lines.push('');
  return lines.join('\n');
}

// ── FORMATER UN RAPPORT DE CLÔTURE ────────────────────────────────────────
function formatCloture(data, largeurMm = 80) {
  const w = parseInt(largeurMm) || 80;
  const L = w <= 58 ? 32 : (w <= 76 ? 32 : 34);
  const sep = '*'.repeat(L);
  const center = (s) => { const p = Math.max(0, Math.floor((L - s.length) / 2)); return ' '.repeat(p) + s; };
  const lines = [];

  lines.push(sep);
  lines.push(center('RAPPORT DE CLÔTURE ' + (data.type_cloture || 'X')));
  if (data.entrepriseNom) lines.push(center(data.entrepriseNom));
  lines.push(sep);
  lines.push('');
  lines.push(`N° Rapport: ${data.numero_rapport || '-'}`);
  lines.push(`Date      : ${new Date(data.date_cloture || Date.now()).toLocaleString('fr-FR')}`);
  lines.push(`Vendeur   : ${data.vendeur_nom || 'Tous'}`);
  lines.push('');
  lines.push(`Tickets   : ${data.nbTickets || 0}`);
  lines.push(`Articles  : ${data.nbArticles || 0}`);
  lines.push('');
  lines.push(sep);
  lines.push('TOTAUX PAR MODE DE PAIEMENT');
  lines.push(sep);
  const formatMoney = (v) => Math.round(v || 0).toLocaleString('fr-FR').replace(/\s/g, ' ');
  const fmt = (label, val) => {
    const l = `  ${label}`;
    const v = `${formatMoney(val)} Ar`;
    return l.padEnd(Math.max(l.length, L - v.length)) + v;
  };
  lines.push(fmt('Espèces (CASH):', data.totalCash));
  lines.push(fmt('Mvola:', data.totalMvola));
  lines.push(fmt('Orange Money:', data.totalOrange));
  lines.push(fmt('Airtel Money:', data.totalAirtel));
  lines.push(fmt('Carte:', data.totalCarte));
  lines.push(fmt('Autres:', data.totalAutre));
  lines.push('─'.repeat(L));
  lines.push(fmt('TOTAL VENTE:', data.totalTTC));
  lines.push(fmt('TOTAL EN CAISSE:', data.totalCash));
  lines.push('');
  lines.push(sep);
  lines.push('FOND DE CAISSE');
  lines.push(sep);
  lines.push(fmt('Total en caisse:', data.totalCash));
  lines.push(fmt('Total compté:', data.totalCompte || 0));
  lines.push(fmt('Prélèvement:', data.prelevement || 0));
  lines.push(fmt('RESTE EN CAISSE:', (data.totalCash || 0) - (data.prelevement || 0)));
  lines.push('');
  const formatList = (arr, isOffert = false) => {
    if (!arr) return '';
    if (typeof arr === 'string') return arr;
    if (arr.length === 0) return '  (Aucune)';
    return arr.map(d => {
      const q = `  ${Math.round(d.qte)}x  `;
      if (isOffert) return `${q}${d.nom.slice(0, L - 10)}`;
      const m = `${formatMoney(d.montant)} Ar`;
      const spacesLeft = Math.max(0, L - q.length - m.length);
      const line1 = `${q}${d.nom.padEnd(spacesLeft).slice(0, spacesLeft)}${m}`;
      if (d.remisePct !== null && d.remisePct !== undefined) {
        return `${line1}\n     \u21b3 Remise: ${d.remisePct}%`;
      }
      return line1;
    }).join('\n');
  };

  if (data.categoriesDetail && data.categoriesDetail.length > 0) {
    lines.push(sep);
    lines.push('VENTES PAR CATÉGORIE');
    lines.push(sep);
    lines.push(formatList(data.categoriesDetail));
    lines.push('');
  }
  if (data.articlesDetail && data.articlesDetail.length > 0) {
    lines.push(sep);
    lines.push('VENTES PAR ARTICLE');
    lines.push(sep);
    lines.push(formatList(data.articlesDetail));
    lines.push('');
  }
  if (data.offertsDetail && data.offertsDetail.length > 0) {
    lines.push(sep);
    lines.push('ARTICLES OFFERTS');
    lines.push(sep);
    lines.push(formatList(data.offertsDetail, true));
    lines.push('');
  }
  if (data.remisesDetail && data.remisesDetail.length > 0) {
    lines.push(sep);
    lines.push('REMISES ACCORDÉES');
    lines.push(sep);
    lines.push(formatList(data.remisesDetail));
    lines.push('');
  }
  lines.push(sep);
  lines.push(center('FIN DE RAPPORT'));
  lines.push(sep);
  lines.push(''); lines.push(''); lines.push('');
  return lines.join('\n');
}

// ── IMPRIMER VIA COMMANDE SYSTÈME ─────────────────────────────────────────
async function printText(text, requestedPrinterName) {
  let targetPrinters = [];
  try {
    const { BrowserWindow } = require('electron');
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const printers = await wins[0].webContents.getPrintersAsync();
      
      const realPrinters = printers.filter(p => 
        !p.name.toLowerCase().includes('pdf') && 
        !p.name.toLowerCase().includes('onenote') && 
        !p.name.toLowerCase().includes('fax') &&
        !p.name.toLowerCase().includes('xps') &&
        !p.name.toLowerCase().includes('anydesk')
      );

      if (realPrinters.length > 0) {
        if (requestedPrinterName && realPrinters.find(p => p.name === requestedPrinterName)) {
          targetPrinters = [requestedPrinterName];
        } else {
          targetPrinters = realPrinters.map(p => p.name);
        }
      }
    }
  } catch (e) { }

  if (targetPrinters.length === 0) {
    const { dialog } = require('electron');
    dialog.showErrorBox(
      "Imprimante introuvable",
      "Aucune imprimante physique n'est actuellement détectée par Windows.\n\nVérifiez que l'imprimante est allumée, branchée, et enregistrée."
    );
    return { success: false, message: "Aucune imprimante physique n'est connectée" };
  }

  return new Promise((resolve) => {
    const { BrowserWindow } = require('electron');
    const cleanText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false }
    });

    const html = `
      <html>
        <head>
          <style>
            @page { margin: 0; }
            body { 
              margin: 0; 
              padding: 0;
              font-family: 'Courier New', Courier, monospace; 
              font-size: 13px; 
              color: black;
              background: white;
            }
            pre { 
              margin: 0; 
              line-height: 1.2; 
              font-weight: 900;
            }
          </style>
        </head>
        <body>
          <pre>${cleanText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </body>
      </html>
    `;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    win.webContents.on('did-finish-load', async () => {
      let printedSuccessfully = false;
      let errors = [];

      for (const printer of targetPrinters) {
        if (printedSuccessfully) break; // Seulement la première imprimante qui marche

        await new Promise((resume) => {
          try {
            win.webContents.print({
              silent: true,
              printBackground: true,
              deviceName: printer,
              margins: { marginType: 'none' },
            }, (success, errorType) => {
              if (success) {
                printedSuccessfully = true;
              } else {
                errors.push(errorType || "Erreur inconnue");
              }
              resume();
            });
          } catch (err) {
            errors.push(err.message);
            resume();
          }
        });
      }

      setTimeout(() => { try { win.close(); } catch {} }, 1000);

      if (!printedSuccessfully && errors.length > 0) {
        resolve({ success: false, message: errors.join(' | ') });
      } else {
        resolve({ success: true });
      }
    });
  });
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildTicketHtml(ticketText, logoUrl) {
  const safeLogo = escapeHtml(logoUrl || '');
  const safeText = escapeHtml(ticketText).replace(/\n/g, '<br/>');
  return `
    <html>
      <head>
        <style>
          @page { margin: 0; }
          body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Courier New', Courier, monospace; }
          .wrap { padding: 0; }
          .logo { text-align: center; margin: 0 0 6px 0; }
          .logo img { max-width: 160px; max-height: 72px; object-fit: contain; }
          .ticket { font-size: 13px; line-height: 1.2; font-weight: 900; white-space: nowrap; }
        </style>
      </head>
      <body>
        <div class="wrap">
          ${safeLogo ? `<div class="logo"><img src="${safeLogo}" alt="Logo" /></div>` : ''}
          <div class="ticket">${safeText}</div>
        </div>
      </body>
    </html>
  `;
}

async function printHtml(html, requestedPrinterName) {
  let targetPrinters = [];
  try {
    const { BrowserWindow } = require('electron');
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const printers = await wins[0].webContents.getPrintersAsync();
      const realPrinters = printers.filter(p =>
        !p.name.toLowerCase().includes('pdf') &&
        !p.name.toLowerCase().includes('onenote') &&
        !p.name.toLowerCase().includes('fax') &&
        !p.name.toLowerCase().includes('xps') &&
        !p.name.toLowerCase().includes('anydesk')
      );
      if (realPrinters.length > 0) {
        if (requestedPrinterName && realPrinters.find(p => p.name === requestedPrinterName)) targetPrinters = [requestedPrinterName];
        else targetPrinters = realPrinters.map(p => p.name);
      }
    }
  } catch {}
  if (targetPrinters.length === 0) return { success: false, message: "Aucune imprimante physique n'est connectée" };

  return new Promise((resolve) => {
    const { BrowserWindow } = require('electron');
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    win.webContents.on('did-finish-load', async () => {
      let printedSuccessfully = false;
      let errors = [];
      for (const printer of targetPrinters) {
        if (printedSuccessfully) break;
        await new Promise((resume) => {
          win.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: printer,
            margins: { marginType: 'none' },
          }, (success, errorType) => {
            if (success) printedSuccessfully = true;
            else errors.push(errorType || "Erreur inconnue");
            resume();
          });
        });
      }
      setTimeout(() => { try { win.close(); } catch {} }, 1000);
      resolve(printedSuccessfully ? { success: true } : { success: false, message: errors.join(' | ') });
    });
  });
}

  module.exports = function (ipcMain, db) {

    // ── LISTE DES IMPRIMANTES ─────────────────────────────────────────────
    ipcMain.handle('printer:getList', async () => {
      let systemPrinters = [];
      try {
        // Essayer de lister les imprimantes système
        const { BrowserWindow } = require('electron');
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
          const printers = await wins[0].webContents.getPrintersAsync();
          systemPrinters = printers.map(p => p.name);
        }
      } catch { }
      return {
        supported: SUPPORTED_PRINTERS,
        system: systemPrinters,
      };
    });

    // ── IMPRIMER UN TICKET ────────────────────────────────────────────────
    ipcMain.handle('printer:printTicket', async (e, data) => {
      const rows = db.prepare("SELECT cle, valeur FROM parametres WHERE cle LIKE 'impression.%' OR cle LIKE 'entreprise.%' OR cle = 'caisse.devise'").all();
      const p = {};
      rows.forEach(r => p[r.cle] = r.valeur);

      const printerName = p['impression.imprimante'] || 'XPrinter XP80C';
      const largeur = p['impression.largeur'] || '80';
      const copies = data.copies || parseInt(p['impression.copies_ticket'] || '1');

      const ticketData = {
        ...data,
        // Retirer la table du ticket
        table_numero: undefined,
        // Infos entreprise complètes
        entrepriseNom: p['entreprise.nom'] || '',
        entrepriseAdresse: p['entreprise.adresse'] || '',
        entrepriseVille: p['entreprise.ville'] || '',
        entrepriseTel: p['entreprise.telephone'] || '',
        entrepriseEmail: p['entreprise.email'] || '',
        entrepriseNif: p['entreprise.nif'] || '',
        entrepriseStat: p['entreprise.stat'] || '',
        slogan: p['entreprise.slogan'] || '',
        logoUrl: p['entreprise.logo_url'] || '',
        devise: p['caisse.devise'] || 'Ar',
      };

      const text = formatTicket(ticketData, largeur);
      const html = buildTicketHtml(text, ticketData.logoUrl);
      let success = false;
      for (let i = 0; i < copies; i++) {
        const r = ticketData.logoUrl ? await printHtml(html, printerName) : await printText(text, printerName);
        if (r.success) success = true;
      }
      return { success, text };
    });

    // ── IMPRIMER UN BON DE COMMANDE LIVRAISON ─────────────────────────────
    ipcMain.handle('printer:printBonLivraison', async (e, data) => {
      const rows = db.prepare("SELECT cle, valeur FROM parametres WHERE cle LIKE 'impression.%' OR cle LIKE 'entreprise.%' OR cle = 'caisse.devise'").all();
      const p = {};
      rows.forEach(r => p[r.cle] = r.valeur);

      const printerName = p['impression.imprimante'] || 'XPrinter XP80C';
      const largeur = p['impression.largeur'] || '80';
      const copies = data.copies || parseInt(p['impression.copies_ticket'] || '1');

      const ticketData = {
        ...data,
        table_numero: undefined,
        entrepriseNom: p['entreprise.nom'] || '',
        entrepriseAdresse: p['entreprise.adresse'] || '',
        entrepriseVille: p['entreprise.ville'] || '',
        entrepriseTel: p['entreprise.telephone'] || '',
        entrepriseEmail: p['entreprise.email'] || '',
        entrepriseNif: p['entreprise.nif'] || '',
        entrepriseStat: p['entreprise.stat'] || '',
        slogan: p['entreprise.slogan'] || '',
        logoUrl: p['entreprise.logo_url'] || '',
        devise: p['caisse.devise'] || 'Ar',
      };

      const text = formatBonLivraison(ticketData, largeur);
      const html = buildTicketHtml(text, ticketData.logoUrl);
      let success = false;
      for (let i = 0; i < copies; i++) {
        const r = ticketData.logoUrl ? await printHtml(html, printerName) : await printText(text, printerName);
        if (r.success) success = true;
      }
      return { success, text };
    });

    // ── IMPRIMER UNE CLÔTURE ──────────────────────────────────────────────
    ipcMain.handle('printer:printCloture', async (e, data) => {
      const params = db.prepare("SELECT cle, valeur FROM parametres WHERE cle LIKE 'impression.%' OR cle LIKE 'entreprise.%'").all();
      const p = {};
      params.forEach(r => p[r.cle] = r.valeur);

      const printerName = p['impression.imprimante'] || 'XPrinter XP80C';
      const largeur = p['impression.largeur'] || '80';
      const copies = parseInt(p['impression.copies_cloture'] || '2');

      const clotureData = { ...data, entrepriseNom: p['entreprise.nom'] };
      const text = formatCloture(clotureData, largeur);

      for (let i = 0; i < copies; i++) {
        await printText(text, printerName);
      }
      return { success: true, text };
    });

    // ── IMPRIMER UN BON DE COMMANDE (ADDITION) ──────────────────────────────
    ipcMain.handle('printer:printBon', async (e, data) => {
      const params = db.prepare("SELECT cle, valeur FROM parametres WHERE cle LIKE 'impression.%' OR cle LIKE 'entreprise.%' OR cle = 'caisse.devise'").all();
      const p = {};
      params.forEach(r => p[r.cle] = r.valeur);

      const printerName = p['impression.imprimante'] || 'XPrinter XP80C';
      const w = parseInt(p['impression.largeur'] || '80');
      const L = w <= 58 ? 32 : (w <= 76 ? 32 : 34);
      const center = (s) => { const pad = Math.max(0, (L - s.length) / 2 | 0); return ' '.repeat(pad) + s; };
      const devise = p['caisse.devise'] || 'Ar';
      const formatMoney = (v) => Math.round(v || 0).toLocaleString('fr-FR').replace(/\s/g, ' ');

      // Helper: aligner label+valeur sur toute la ligne (comme right() dans tickket)
      const right = (label, val) => {
        const l = `  ${label}`;
        return l.padEnd(Math.max(l.length, L - val.length)) + val;
      };

      const nom = p['entreprise.nom'] || '';
      const adr = p['entreprise.adresse'] || '';
      const ville = p['entreprise.ville'] || '';
      const tel = p['entreprise.telephone'] || '';
      const email = p['entreprise.email'] || '';
      const nif = p['entreprise.nif'] || '';
      const stat = p['entreprise.stat'] || '';
      const slogan = p['entreprise.slogan'] || '';

      const lines = [];
      lines.push('═'.repeat(L));
      if (nom) lines.push(center(nom.toUpperCase()));
      if (adr) lines.push(center(adr));
      if (ville) lines.push(center(ville));
      if (tel) lines.push(center('Tél: ' + tel));
      if (email) lines.push(center('Email: ' + email));
      if (nif) lines.push(center('NIF: ' + nif));
      if (stat) lines.push(center('STAT: ' + stat));

      lines.push('═'.repeat(L));
      lines.push(center('ADDITION'));
      lines.push(center(`TABLE ${data.numero_table || data.nom_table || ''}`.trim()));
      lines.push('═'.repeat(L));
      lines.push('');
      lines.push(`Date   : ${new Date().toLocaleString('fr-FR')}`);
      lines.push(`Serveur: ${data.nom_caissier || '-'}`);
      lines.push('');
      lines.push('─'.repeat(L));
      lines.push('');

      // Colonnes articles
      const colQ = 4;
      const colP = 11;
      const colD = Math.max(6, L - colQ - colP - 4); // 4 = spaces + devise

      for (const l of (data.lignes || [])) {
        const qte = String(Math.round(l.quantite || 1)).padEnd(colQ).slice(0, colQ);
        const prodNom = l.produit_nom || '';
        if (l.est_offert) {
          lines.push(`  ${qte} ${prodNom.padEnd(colD).slice(0, colD)} (OFFERT)`);
        } else {
          const mtStr = `${formatMoney(l.total_ttc)} ${devise}`;
          const nomPad = prodNom.padEnd(L - 2 - colQ - 1 - mtStr.length).slice(0, L - 2 - colQ - 1 - mtStr.length);
          lines.push(`  ${qte} ${nomPad}${mtStr}`);
          if (l.remise > 0) lines.push(`       \u21b3 Remise: ${Math.round(l.remise)}%`);
        }
      }

      lines.push('─'.repeat(L));

      // Total aligné droite
      const totalStr = `${formatMoney(data.montant_total)} ${devise}`;
      lines.push(right('TOTAL', totalStr));
      lines.push('═'.repeat(L));

      if (slogan) {
        lines.push(center(slogan));
        lines.push('═'.repeat(L));
      }

      lines.push(''); lines.push(''); lines.push('');

      const text = lines.join('\n');
      await printText(text, printerName);
      return { success: true, text };
    });

    // ── TEST IMPRESSION ────────────────────────────────────────────────────
    ipcMain.handle('printer:test', async (e, printerName) => {
      const text = [
        '═'.repeat(32),
        '       TEST D\'IMPRESSION',
        '       ClinoCaisse',
        '═'.repeat(32),
        `  Imprimante: ${printerName}`,
        `  Date: ${new Date().toLocaleString('fr-FR')}`,
        '  *** Impression OK ***',
        '═'.repeat(32),
        '', '', '',
      ].join('\n');

      return await printText(text, printerName);
    });
  };
