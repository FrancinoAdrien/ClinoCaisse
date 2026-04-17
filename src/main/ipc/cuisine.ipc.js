'use strict';

module.exports = function(ipcMain, db) {

  ipcMain.handle('cuisine:getLignes', () => {
    // 1. Lignes des ventes validées
    const ventesLignes = db.prepare(`
      SELECT lv.id, lv.uuid, lv.produit_nom, lv.quantite, lv.statut_cuisine,
             v.numero_ticket, v.table_numero, v.date_vente, v.id AS vente_id, v.note
      FROM lignes_vente lv
      INNER JOIN ventes v ON v.id = lv.vente_id
      WHERE v.statut = 'valide'
        AND lv.statut_cuisine IS NOT NULL
        AND lv.statut_cuisine != 'servi'
      ORDER BY datetime(v.date_vente) ASC, lv.id ASC
    `).all().map(l => ({ ...l, id: `V:${l.id}` }));

    // 2. Lignes des tables en cours (sauvegardées mais non payées)
    const tableTickets = db.prepare("SELECT * FROM tickets_table WHERE statut = 'en_cours'").all();
    const tableLignes = [];
    tableTickets.forEach(t => {
      let lignesArray = [];
      try { lignesArray = JSON.parse(t.lignes_json || '[]'); } catch (e) { console.error('JSON parse error in tickets_table:', e); }
      
      lignesArray.forEach((l, idx) => {
        // On n'affiche que si l'utilisateur a coché la "patch" cuisine
        if (l.envoi_cuisine && l.statut_cuisine && l.statut_cuisine !== 'servi') {
          tableLignes.push({
            id: `T:${t.id}:${idx}`,
            produit_nom: l.produit_nom,
            quantite: l.quantite,
            statut_cuisine: l.statut_cuisine,
            numero_ticket: t.nom_table || `Table ${t.numero_table}`,
            table_numero: t.numero_table,
            date_vente: t.date_modification || t.date_creation,
            is_table_active: true
          });
        }
      });
    });

    // Fusionner et trier par date
    return [...ventesLignes, ...tableLignes].sort((a,b) => {
      const dbA = a.date_vente ? new Date(a.date_vente) : new Date(0);
      const dbB = b.date_vente ? new Date(b.date_vente) : new Date(0);
      return dbA - dbB;
    });
  });

  ipcMain.handle('cuisine:setStatut', (e, idStr, statut) => {
    try {
      const allowed = ['en_attente', 'en_preparation', 'pret', 'servi'];
      if (!allowed.includes(statut)) return { success: false, message: 'Statut inconnu' };
      
      const idStrSafe = String(idStr);
      const parts = idStrSafe.split(':');
      
      // Cas 1: Ligne de vente finalisée
      if (parts[0] === 'V') {
        const ligneId = parseInt(parts[1], 10);
        db.prepare(`
          UPDATE lignes_vente SET statut_cuisine = ?, last_modified_at = ?, sync_status = 0 WHERE id = ?
        `).run(statut, Date.now(), ligneId);
        return { success: true };
      } 
      
      // Cas 2: Ligne de table active (JSON)
      if (parts[0] === 'T') {
        const ticketId = parseInt(parts[1], 10);
        const itemIdx = parseInt(parts[2], 10);
        
        const ticket = db.prepare('SELECT lignes_json FROM tickets_table WHERE id = ?').get(ticketId);
        if (!ticket) return { success: false, message: 'Table introuvable' };
        
        let lignes = JSON.parse(ticket.lignes_json || '[]');
        if (lignes[itemIdx]) {
          lignes[itemIdx].statut_cuisine = statut;
          db.prepare(`
            UPDATE tickets_table SET lignes_json = ?, date_modification = datetime('now') WHERE id = ?
          `).run(JSON.stringify(lignes), ticketId);
          return { success: true };
        }
        return { success: false, message: 'Article introuvable sur la table' };
      }

      // Fallback compatibilité (si ID est purement numérique)
      if (!isNaN(parseInt(idStrSafe, 10))) {
        db.prepare(`
          UPDATE lignes_vente SET statut_cuisine = ?, last_modified_at = ?, sync_status = 0 WHERE id = ?
        `).run(statut, Date.now(), parseInt(idStrSafe, 10));
        return { success: true };
      }

      return { success: false, message: 'ID invalide: ' + idStr };
    } catch (err) {
      console.error('cuisine:setStatut error:', err);
      return { success: false, message: err.message };
    }
  });
};
