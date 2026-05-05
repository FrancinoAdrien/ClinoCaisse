'use strict';
const fs = require('fs');
const { dialog } = require('electron');


// ═══════════════════════════════════════════════════════════════════════════
//  Journal d'Activité — IPC Handler + Helper partagé
//  Ce module expose :
//    - logAction(db, data)  : helper statique pour tous les autres IPC handlers
//    - journal:getAll       : récuperer les entrées (avec filtres)
//    - journal:clear        : vider le journal (admin seulement, optionnel)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Insère une entrée dans le journal d'activité.
 * Appelé directement depuis les autres IPC handlers (pas via IPC).
 *
 * @param {object} db - Instance better-sqlite3
 * @param {object} data
 *   @param {string} data.categorie   - 'AUTH' | 'VENTE' | 'STOCK' | 'PRODUIT' | 'FINANCE' | 'RH' | 'CLOTURE' | 'UTILISATEUR' | 'RESERVATION' | 'TERRAIN' | 'LIVRAISON' | 'PARAMETRE'
 *   @param {string} data.action      - Description courte de l'action
 *   @param {string} [data.detail]    - Détail supplémentaire
 *   @param {string} [data.operateur] - Nom de l'utilisateur
 *   @param {number} [data.montant]   - Montant associé (si applicable)
 *   @param {string} [data.icone]     - Emoji icône
 *   @param {object} [data.meta]      - Données brutes JSON supplémentaires
 */
function logAction(db, data) {
  try {
    const { randomUUID } = require('crypto');
    
    let operateur = data.operateur;
    if (!operateur) {
      try {
        const { getSession } = require('./auth.ipc');
        const session = getSession();
        if (session && session.nom) {
          operateur = session.prenom ? `${session.nom} ${session.prenom}` : session.nom;
        } else {
          operateur = 'Système';
        }
      } catch (e) {
        operateur = 'Système';
      }
    }

    db.prepare(`
      INSERT INTO journal_activite (uuid, categorie, action, detail, operateur, montant, icone, meta_json, last_modified_at, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      randomUUID(),
      data.categorie || 'SYSTEME',
      data.action    || '',
      data.detail    || null,
      operateur      || null,
      data.montant   != null ? data.montant : null,
      data.icone     || null,
      data.meta      ? JSON.stringify(data.meta) : null,
      Date.now()
    );
  } catch (err) {
    // On ne propage jamais une erreur de journalisation
    console.warn('[Journal] Erreur lors de l\'écriture:', err.message);
  }
}

module.exports = function(ipcMain, db) {

  // ── HELPER DE RECHERCHE ───────────────────────────────────────────────
  function fetchJournalData(params = {}, limit = 500, offset = 0) {
    const { categorie, dateDebut, dateFin, search } = params;
    let where = [];
    const binds = [];

    if (categorie && categorie !== 'TOUS') {
      where.push('categorie = ?');
      binds.push(categorie);
    }
    if (dateDebut) {
      where.push("date(date_action) >= date(?)");
      binds.push(dateDebut);
    }
    if (dateFin) {
      where.push("date(date_action) <= date(?)");
      binds.push(dateFin);
    }
    if (search) {
      where.push("(action LIKE ? OR detail LIKE ? OR operateur LIKE ?)");
      const like = `%${search}%`;
      binds.push(like, like, like);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT * FROM journal_activite
      ${whereClause}
      ORDER BY date_action DESC
      LIMIT ? OFFSET ?
    `).all(...binds, limit, offset);

    const total = db.prepare(`
      SELECT COUNT(*) as n FROM journal_activite ${whereClause}
    `).get(...binds).n;

    return { rows, total };
  }

  // ── GET ALL (avec filtres) ──────────────────────────────────────────────
  ipcMain.handle('journal:getAll', (e, params = {}) => {
    try {
      const { limit = 500, offset = 0 } = params;
      return fetchJournalData(params, limit, offset);
    } catch (err) {
      console.error('[Journal] Erreur getAll:', err.message);
      return { rows: [], total: 0 };
    }
  });

  // ── STATS RAPIDES ───────────────────────────────────────────────────────
  ipcMain.handle('journal:getStats', () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const monthStart = new Date().toISOString().slice(0, 7) + '-01';

      const aujourd_hui = db.prepare(
        "SELECT COUNT(*) as n FROM journal_activite WHERE date(date_action) = date(?)"
      ).get(today).n;

      const semaine = db.prepare(
        "SELECT COUNT(*) as n FROM journal_activite WHERE date(date_action) >= date(?)"
      ).get(weekAgo).n;

      const mois = db.prepare(
        "SELECT COUNT(*) as n FROM journal_activite WHERE date(date_action) >= date(?)"
      ).get(monthStart).n;

      const parCategorie = db.prepare(`
        SELECT categorie, COUNT(*) as n
        FROM journal_activite
        WHERE date(date_action) >= date(?)
        GROUP BY categorie
        ORDER BY n DESC
      `).all(monthStart);

      return { aujourd_hui, semaine, mois, parCategorie };
    } catch (err) {
      console.error('[Journal] Erreur getStats:', err.message);
      return { aujourd_hui: 0, semaine: 0, mois: 0, parCategorie: [] };
    }
  });

  // ── LOG MANUEL (depuis renderer) ────────────────────────────────────────
  ipcMain.handle('journal:log', (e, data) => {
    logAction(db, data);
    return { success: true };
  });

  // ── EXPORT EXCEL ────────────────────────────────────────────────────────
  ipcMain.handle('journal:exportExcel', async (e, params = {}) => {
    try {
      const ExcelJS = require('exceljs');
      const { categorie, dateDebut, dateFin, search } = params;

      // 1. Récupérer toutes les données sans limite
      const result = fetchJournalData(params, 999999, 0);
      const rows = result.rows || [];

      if (rows.length === 0) return { success: false, message: 'Aucune donnée à exporter.' };

      // 2. Créer le classeur Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ClinoCaisse';
      workbook.lastModifiedBy = 'ClinoCaisse';
      workbook.created = new Date();
      workbook.modified = new Date();

      const sheet = workbook.addWorksheet('Journal_Activite');

      // 3. Définir les colonnes
      sheet.columns = [
        { header: 'Date', key: 'date', width: 22 },
        { header: 'Catégorie', key: 'cat', width: 20 },
        { header: 'Action', key: 'action', width: 35 },
        { header: 'Détail', key: 'detail', width: 50 },
        { header: 'Opérateur', key: 'op', width: 20 },
        { header: 'Montant (Ar)', key: 'montant', width: 18 }
      ];

      // Styliser l'en-tête
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A9FD4' } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // 4. Ajouter les données
      rows.forEach(row => {
        sheet.addRow({
          date: row.date_action || '',
          cat: row.categorie || '',
          action: row.action || '',
          detail: row.detail || '',
          op: row.operateur || '',
          montant: row.montant || 0
        });
      });

      // 5. Demander où sauvegarder
      const dateStr = new Date().toISOString().slice(0, 10);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exporter le Journal (Excel)',
        defaultPath: `Journal_Activite_${dateStr}.xlsx`,
        filters: [{ name: 'Fichier Excel', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) return { success: false, message: 'Export annulé.' };

      // 6. Écrire le fichier
      const buffer = await workbook.xlsx.writeBuffer();
      fs.writeFileSync(filePath, buffer);

      return { success: true, path: filePath };
    } catch (err) {
      console.error('[Journal] Erreur Export Excel:', err);
      return { success: false, message: err.message };
    }
  });

  // ── EXPORT WORD ────────────────────────────────────────────────────────
  ipcMain.handle('journal:exportWord', async (e, params = {}) => {
    try {
      const docx = require('docx');
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, BorderStyle } = docx;

      // 1. Récupérer toutes les données
      const result = fetchJournalData(params, 999999, 0);
      const rows = result.rows || [];

      if (rows.length === 0) return { success: false, message: 'Aucune donnée à exporter.' };

      // 2. Construire l'en-tête du tableau
      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ shading: { fill: '4A9FD4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true, color: 'FFFFFF' })] })] }),
          new TableCell({ shading: { fill: '4A9FD4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Catégorie', bold: true, color: 'FFFFFF' })] })] }),
          new TableCell({ shading: { fill: '4A9FD4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Action', bold: true, color: 'FFFFFF' })] })] }),
          new TableCell({ shading: { fill: '4A9FD4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Détail', bold: true, color: 'FFFFFF' })] })] }),
          new TableCell({ shading: { fill: '4A9FD4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Opérateur', bold: true, color: 'FFFFFF' })] })] }),
          new TableCell({ shading: { fill: '4A9FD4' }, children: [new Paragraph({ children: [new TextRun({ text: 'Montant', bold: true, color: 'FFFFFF' })] })] }),
        ],
      });

      // 3. Lignes du tableau
      const tableRows = [headerRow];
      rows.forEach(r => {
        tableRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(r.date_action || '')] }),
            new TableCell({ children: [new Paragraph(r.categorie || '')] }),
            new TableCell({ children: [new Paragraph(r.action || '')] }),
            new TableCell({ children: [new Paragraph(r.detail || '')] }),
            new TableCell({ children: [new Paragraph(r.operateur || '')] }),
            new TableCell({ children: [new Paragraph(r.montant ? r.montant.toString() : '0')] }),
          ]
        }));
      });

      const table = new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      });

      // 4. Générer le document
      const doc = new Document({
        creator: 'ClinoCaisse',
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: 'Journal d\'Activité',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: `Généré le : ${new Date().toLocaleString('fr-FR')}` }),
            new Paragraph({ text: '' }), // Espace
            table
          ]
        }]
      });

      // 5. Sauvegarder
      const dateStr = new Date().toISOString().slice(0, 10);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exporter le Journal (Word)',
        defaultPath: `Journal_Activite_${dateStr}.docx`,
        filters: [{ name: 'Document Word', extensions: ['docx'] }]
      });

      if (canceled || !filePath) return { success: false, message: 'Export annulé.' };

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);

      return { success: true, path: filePath };
    } catch (err) {
      console.error('[Journal] Erreur Export Word:', err);
      return { success: false, message: err.message };
    }
  });

};

// Export du helper pour usage inter-modules
module.exports.logAction = logAction;
