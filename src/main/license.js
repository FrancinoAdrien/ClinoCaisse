'use strict';

const crypto = require('crypto');

/**
 * Logique de gestion de la licence ClinoCaisse
 */
const LicenseManager = {
  // ── CONFIGURATION ──────────────────────────────────────────────────────────
  // DURÉE DU TRIAL EN MILLISECONDES
  // Pour mettre 5 heures : 5 * 60 * 60 * 1000
  TRIAL_DURATION_MS: 5 * 60 * 60 * 1000, 

  // ── GÉNÉRATION DE CLÉ ──────────────────────────────────────────────────────
  
  /**
   * Génère la clé valide pour une date donnée
   * @param {Date} dateObj 
   */
  generateKey(dateObj = new Date()) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = String(dateObj.getFullYear());
    
    const dateStr = d + m + y; // DDMMYYYY
    
    // Encriptage des chiffres
    const digitMap = {
      '1': 'I', '2': '2', '3': 'E', '4': 'A', '5': 'S',
      '6': '6', '7': '7', '8': '8', '9': '9', '0': 'O'
    };
    
    let encryptedDate = '';
    for (const char of dateStr) {
      encryptedDate += digitMap[char] || char;
    }
    
    // Encriptage du jour
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayName = dayNames[dateObj.getDay()];
    
    const dayMap = {
      'Lundi': 'Lui',
      'Mardi': 'M4r',
      'Mercredi': 'M3d',
      'Jeudi': 'J3d',
      'Vendredi': 'V3d',
      'Samedi': '54d',
      'Dimanche': 'D1c'
    };
    
    const encryptedDay = dayMap[dayName] || dayName;
    
    return `${encryptedDate}${encryptedDay}IA12D3ll!`;
  },

  // ── SÉCURITÉ ──────────────────────────────────────────────────────────────
  SECRET_KEY: crypto.createHash('sha256').update('clinocaisse_secure_key_1412_0410').digest(),
  
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.SECRET_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  },

  decrypt(hash) {
    try {
      const parts = hash.split(':');
      if (parts.length !== 2) return null;
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.SECRET_KEY, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      return null;
    }
  },

  _setLicenseValue(db, value) {
    const enc = this.encrypt(value);
    db.prepare("INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status) VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = 'license.activated'), lower(hex(randomblob(16)))), 'license.activated', ?, datetime('now'), ?, 0)")
      .run(enc, Date.now());
  },

  // ── VÉRIFICATION ──────────────────────────────────────────────────────────

  /**
   * Récupère le statut de la licence
   */
  getStatus(db) {
    try {
      // 1. Vérifier si déjà activé définitivement
      const activatedRow = db.prepare("SELECT valeur FROM parametres WHERE cle = 'license.activated'").get();
      let isActivated = false;
      
      if (activatedRow) {
        const val = activatedRow.valeur;
        if (val === '1') {
          isActivated = true;
          this._setLicenseValue(db, '1412');
        } else if (val === '0') {
          isActivated = false;
          this._setLicenseValue(db, '0410');
        } else {
          const decrypted = this.decrypt(val);
          isActivated = (decrypted === '1412');
        }
      }
      
      if (isActivated) {
        return { status: 'activated', valid: true };
      }

      // 2. Vérifier le trial
      let firstLaunchRow = db.prepare("SELECT valeur FROM parametres WHERE cle = 'license.first_launch'").get();
      
      if (!firstLaunchRow || !firstLaunchRow.valeur || isNaN(parseInt(firstLaunchRow.valeur, 10))) {
        // Premier lancement : on enregistre maintenant et on s'assure qu'il se synchronise
        const now = Date.now().toString();
        db.prepare("INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status) VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = 'license.first_launch'), lower(hex(randomblob(16)))), 'license.first_launch', ?, datetime('now'), ?, 0)")
          .run(now, Date.now());
        firstLaunchRow = { valeur: now };
      }

      const firstLaunchTs = parseInt(firstLaunchRow.valeur, 10);
      const elapsed = Date.now() - firstLaunchTs;
      const trialRemaining = Math.max(0, this.TRIAL_DURATION_MS - elapsed);

      if (trialRemaining > 0) {
        return { 
          status: 'trial', 
          valid: true, 
          remainingMs: trialRemaining,
          remainingText: this._formatMs(trialRemaining)
        };
      }

      return { status: 'expired', valid: false };
    } catch (err) {
      console.error('License check error:', err);
      return { status: 'error', valid: false, message: err.message };
    }
  },

  /**
   * Valide une clé saisie
   */
  activate(db, key) {
    const validKey = this.generateKey();
    if (key === validKey) {
      this._setLicenseValue(db, '1412');
      
      // Enregistrer la date et heure d'activation dans license.first_launch
      const nowStr = new Date().toLocaleString('fr-FR');
      db.prepare("INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status) VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = 'license.first_launch'), lower(hex(randomblob(16)))), 'license.first_launch', ?, datetime('now'), ?, 0)")
        .run(nowStr, Date.now());

      return { success: true, message: 'Application activée avec succès !' };
    }
    return { success: false, message: 'Clé d\'activation invalide.' };
  },

  _formatMs(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

module.exports = LicenseManager;
