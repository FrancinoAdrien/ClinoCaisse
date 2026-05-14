'use strict';

const crypto = require('crypto');

/**
 * ═══════════════════════════════════════════════════════════════
 * LicenseManager — ClinoCaisse Licence Mensuelle
 * ═══════════════════════════════════════════════════════════════
 *
 * Structure de la clé mensuelle :
 *   [dateEncryptée][jourEncrypté][IA12][D3ll!][astroEncrypté][dateActivation]
 *
 * Exemple (14 mai 2026, Mercredi, 1ère activation le 14) :
 *   IA0S2O26M3dIA12D3ll!6ew142026
 *
 * Tolérance : ±2 jours (si on est le 14, les clés des jours 12,13,15,16 fonctionnent)
 * Pré-activation : jusqu'à 3 mois à l'avance (calculé comme si on était le 15 du mois)
 */
const LicenseManager = {

  // ── CONFIGURATION ──────────────────────────────────────────────────────────

  // DURÉES EN MILLISECONDES
  // ⚠️  MODE TEST : 10 min, alerte 5 min, délai déco 1 min
  // Pour passer en PRODUCTION, remplacer par :
  MONTHLY_DURATION_MS : 30 * 24 * 60 * 60 * 1000,   // (30 jours)
  WARN_DURATION_MS    : 2  * 24 * 60 * 60 * 1000,   // (2 jours)
  LOGOUT_WARN_MS      : 60 * 1000,                // (1 min)
  
  // ── POUR DES TESTS UNIQUEMENT  (à commenter en production) ──
  // MONTHLY_DURATION_MS : 10 * 60 * 1000,        // 10 minutes (TEST)
  // WARN_DURATION_MS    :  5 * 60 * 1000,        //  5 minutes (TEST) — alerte
  // LOGOUT_WARN_MS      :  1 * 60 * 1000,        //  1 minute — délai avant déco

  // ── CRYPTAGE DES CHIFFRES ─────────────────────────────────────────────────
  DIGIT_MAP: {
    '1': 'I', '2': '2', '3': 'E', '4': 'A', '5': 'S',
    '6': '6', '7': '7', '8': '8', '9': '9', '0': 'O'
  },

  // ── CRYPTAGE DES JOURS ────────────────────────────────────────────────────
  DAY_MAP: {
    'Lundi':    'Lui',
    'Mardi':    'M4r',
    'Mercredi': 'M3d',
    'Jeudi':    'J3d',
    'Vendredi': 'V3d',
    'Samedi':   '54d',
    'Dimanche': 'D1c'
  },

  DAY_NAMES: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],

  // ── CODES ASTRO PAR MOIS ──────────────────────────────────────────────────
  // Source : astro.txt
  ASTRO_MAP: {
    1:  'V3r',   // Janvier   → Verseau
    2:  'P0i',   // Février   → Poissons
    3:  '8eI',   // Mars      → Bélier
    4:  '74n',   // Avril     → Taureau
    5:  '6ew',   // Mai       → Gémeaux
    6:  'C4u',   // Juin      → Cancer
    7:  'IiO',   // Juillet   → Lion
    8:  'Vie',   // Août      → Vierge
    9:  '84i',   // Septembre → Balance
    10: '5co',   // Octobre   → Scorpion
    11: '546',   // Novembre  → Sagittaire
    12: 'C4p'    // Décembre  → Capricorne
  },

  // ── SÉCURITÉ AES ──────────────────────────────────────────────────────────
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
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.SECRET_KEY, iv);
      let decrypted = decipher.update(parts[1], 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      return null;
    }
  },

  // ── GÉNÉRATION DE CLÉ ────────────────────────────────────────────────────

  /**
   * Encrypte une date (objet Date) en string chiffres → lettres
   * Format interne : DDMMYYYY
   */
  _encryptDate(dateObj) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = String(dateObj.getFullYear());
    const dateStr = d + m + y;
    let encrypted = '';
    for (const ch of dateStr) {
      encrypted += this.DIGIT_MAP[ch] || ch;
    }
    return encrypted;
  },

  /**
   * Encrypte le nom du jour de semaine
   */
  _encryptDay(dateObj) {
    const dayName = this.DAY_NAMES[dateObj.getDay()];
    return this.DAY_MAP[dayName] || dayName;
  },

  /**
   * Génère la clé mensuelle pour une date donnée.
   *
   * @param {Date}   dateObj          - Date pour le composant "date du jour" (tolérance ±2)
   * @param {Date}   firstActivation  - Date de la 1ère activation du mois courant
   * @returns {string} La clé complète
   */
  generateKey(dateObj = new Date(), firstActivation = null) {
    const refDate = firstActivation || dateObj;
    const month   = refDate.getMonth() + 1;
    const astro   = this.ASTRO_MAP[month] || '???';

    // Composant dateActivation : DDyyyy (jour de la 1ère activation + année)
    const firstDay  = String(refDate.getDate()).padStart(2, '0');
    const firstYear = String(refDate.getFullYear());
    const dateActivation = firstDay + firstYear;

    const encDate = this._encryptDate(dateObj);
    const encDay  = this._encryptDay(dateObj);

    return `${encDate}${encDay}IA12D3ll!${astro}${dateActivation}`;
  },

  /**
   * Génère toutes les clés valides aujourd'hui (today ±2 jours)
   * avec la même date de première activation.
   *
   * @param {Date|null} firstActivation - Date de la 1ère activation (null = aujourd'hui)
   * @returns {string[]} Liste des 5 clés valides
   */
  generateValidKeys(firstActivation = null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ref = firstActivation
      ? new Date(firstActivation)
      : new Date(today);
    ref.setHours(0, 0, 0, 0);

    const keys = [];
    for (let delta = -2; delta <= 2; delta++) {
      const d = new Date(today);
      d.setDate(d.getDate() + delta);
      keys.push(this.generateKey(d, ref));
    }
    return keys;
  },

  /**
   * Génère la clé pour un mois futur (simulation : on se place au 15 du mois cible).
   * Le mois +1 utilise le 15 du mois suivant comme date de 1ère activation simulée.
   *
   * @param {number} monthOffset - 1, 2 ou 3
   * @param {Date}   firstActivationOfFutureMonth - Quand ce mois futur aura sa 1ère activation (le 15)
   * @returns {string[]} 5 clés valides (±2 jours autour du 15)
   */
  generateFutureKeys(monthOffset, baseDate = new Date()) {
    // La date "aujourd'hui simulée" = le 15 du mois futur
    const futureMonth = new Date(baseDate);
    futureMonth.setDate(1);
    futureMonth.setMonth(futureMonth.getMonth() + monthOffset);

    // firstActivation = le 15 de ce mois futur
    const firstActivation = new Date(futureMonth);
    firstActivation.setDate(15);
    firstActivation.setHours(0, 0, 0, 0);

    const keys = [];
    for (let delta = -2; delta <= 2; delta++) {
      const d = new Date(firstActivation);
      d.setDate(d.getDate() + delta);
      keys.push(this.generateKey(d, firstActivation));
    }
    return keys;
  },

  // ── HELPERS DB ────────────────────────────────────────────────────────────

  _setParam(db, key, value) {
    const enc = this.encrypt(value);
    db.prepare(`
      INSERT OR REPLACE INTO parametres
        (uuid, cle, valeur, date_maj, last_modified_at, sync_status)
      VALUES (
        COALESCE((SELECT uuid FROM parametres WHERE cle = ?), lower(hex(randomblob(16)))),
        ?, ?, datetime('now'), ?, 1
      )
    `).run(key, key, enc, Date.now());
  },

  _getParam(db, key) {
    const row = db.prepare("SELECT valeur FROM parametres WHERE cle = ?").get(key);
    if (!row || !row.valeur) return null;
    // Compatibilité: si déjà en clair '1' ou '0'
    if (row.valeur === '1' || row.valeur === '0') return row.valeur;
    return this.decrypt(row.valeur);
  },

  _deleteParam(db, key) {
    db.prepare("DELETE FROM parametres WHERE cle = ?").run(key);
  },

  // ── STATUT LICENCE ───────────────────────────────────────────────────────

  /**
   * Récupère le statut complet de la licence mensuelle.
   * @returns {{
   *   status: 'activated_monthly'|'expired'|'never_activated',
   *   valid: boolean,
   *   remainingMs: number,
   *   expiresAt: string,
   *   warnAt: number,
   *   futureSlotsActivated: {slot1: boolean, slot2: boolean, slot3: boolean}
   * }}
   */
  getStatus(db) {
    try {
      // ── 0. ACTIVATION DÉFINITIVE (ancien système, rétro-compatible) ─────────
      const activatedRow = db.prepare("SELECT valeur FROM parametres WHERE cle = 'license.activated'").get();
      if (activatedRow) {
        const val = activatedRow.valeur;
        let isPermanent = false;
        if (val === '1') isPermanent = true;
        else if (val !== '0') {
          const dec = this.decrypt(val);
          isPermanent = (dec === '1412');
        }
        if (isPermanent) {
          return { status: 'activated', valid: true, permanent: true,
                   remainingText: 'Définitive', expiresAtFormatted: 'Illimitée',
                   futureSlotsActivated: { slot1: false, slot2: false, slot3: false } };
        }
      }

      // ── 1. Licence mensuelle ───────────────────────────────────────
      const expiresAtStr   = this._getParam(db, 'license.monthly_expires_at');
      const activatedAtStr = this._getParam(db, 'license.monthly_activated_at');

      if (!expiresAtStr || !activatedAtStr) {
        const f1 = this._getParam(db, 'license.future_1');
        const f2 = this._getParam(db, 'license.future_2');
        const f3 = this._getParam(db, 'license.future_3');
        return {
          status: 'never_activated',
          valid: false,
          remainingMs: 0,
          expiresAt: null,
          warnAt: this.WARN_DURATION_MS,
          futureSlotsActivated: { slot1: !!f1, slot2: !!f2, slot3: !!f3 }
        };
      }

      let expiresAt = new Date(expiresAtStr);
      const now     = Date.now();

      // ── Auto-promotion si le mois courant est expiré et qu'un slot est prêt ──
      while (expiresAt.getTime() <= now) {
        const futureKey = this._getParam(db, 'license.future_1');
        if (!futureKey) break;

        this._promoteFutureSlot(db);
        expiresAt = new Date(this._getParam(db, 'license.monthly_expires_at'));
      }

      const futureSlotsActivated = {
        slot1: !!this._getParam(db, 'license.future_1'),
        slot2: !!this._getParam(db, 'license.future_2'),
        slot3: !!this._getParam(db, 'license.future_3'),
      };

      if (expiresAt.getTime() <= now) {
        return {
          status: 'expired',
          valid: false,
          remainingMs: 0,
          expiresAt: expiresAt.toISOString(),
          warnAt: this.WARN_DURATION_MS,
          futureSlotsActivated
        };
      }

      // ── Expiration totale (inclut les slots futurs pré-enregistrés) ──
      let futureCount = 0;
      if (futureSlotsActivated.slot1) futureCount++;
      if (futureSlotsActivated.slot2) futureCount++;
      if (futureSlotsActivated.slot3) futureCount++;

      const totalExpiresAtMs = expiresAt.getTime() + (futureCount * this.MONTHLY_DURATION_MS);
      const totalExpiresAt   = new Date(totalExpiresAtMs);
      const remainingMs      = Math.max(0, totalExpiresAtMs - now);

      return {
        status: 'activated_monthly',
        valid: true,
        remainingMs,
        expiresAt: totalExpiresAt.toISOString(),
        expiresAtFormatted: this._formatDate(totalExpiresAt),
        remainingText: this._formatMs(remainingMs),
        warnAt: this.WARN_DURATION_MS,
        futureSlotsActivated
      };
    } catch (err) {
      console.error('[LicenseManager] getStatus error:', err);
      return { status: 'error', valid: false, message: err.message };
    }
  },

  /**
   * Promouvoir les slots futurs d'un cran (slot1 devient actif, slot2→slot1, slot3→slot2)
   */
  _promoteFutureSlot(db) {
    const slot1Data = this._getParam(db, 'license.future_1');
    if (!slot1Data) return;

    try {
      const oldExpiresAtStr = this._getParam(db, 'license.monthly_expires_at');
      const oldExpiresAt = oldExpiresAtStr ? new Date(oldExpiresAtStr).getTime() : Date.now();

      // On prolonge simplement l'expiration de la durée d'un mois cumulatif
      const newActivatedAt = oldExpiresAt;
      const newExpiresAt   = oldExpiresAt + this.MONTHLY_DURATION_MS;

      this._setParam(db, 'license.monthly_activated_at', new Date(newActivatedAt).toISOString());
      this._setParam(db, 'license.monthly_expires_at',   new Date(newExpiresAt).toISOString());

      // Décaler les slots
      const slot2 = this._getParam(db, 'license.future_2');
      const slot2meta = this._getParam(db, 'license.future_2_meta');
      const slot3 = this._getParam(db, 'license.future_3');
      const slot3meta = this._getParam(db, 'license.future_3_meta');

      if (slot2) {
        this._setParam(db, 'license.future_1', slot2);
        if (slot2meta) this._setParam(db, 'license.future_1_meta', slot2meta);
      } else {
        this._deleteParam(db, 'license.future_1');
        this._deleteParam(db, 'license.future_1_meta');
      }

      if (slot3) {
        this._setParam(db, 'license.future_2', slot3);
        if (slot3meta) this._setParam(db, 'license.future_2_meta', slot3meta);
      } else {
        this._deleteParam(db, 'license.future_2');
        this._deleteParam(db, 'license.future_2_meta');
      }

      this._deleteParam(db, 'license.future_3');
      this._deleteParam(db, 'license.future_3_meta');
    } catch (e) {
      console.error('[LicenseManager] _promoteFutureSlot error:', e);
    }
  },

  // ── ACTIVATION ───────────────────────────────────────────────────────────

  /**
   * Valide et active une clé mensuelle (mois courant OU futur).
   *
   * @param {object} db
   * @param {string} key - Clé saisie par l'utilisateur
   * @returns {{ success: boolean, message: string, slot?: string }}
   */
  activate(db, key) {
    if (!key || !key.trim()) {
      return { success: false, message: 'Clé vide.' };
    }

    const keyTrimmed = key.trim();

    // ── 0. Vérification clé définitive (ancien système) ─────────────
    // La clé définitive = [dateEncryptée][jourEncrypté]IA12D3ll! (sans astro ni dateActivation)
    const permanentValidKeys = this._generatePermanentKeys();
    if (permanentValidKeys.includes(keyTrimmed)) {
      // Activer définitivement
      const enc = this.encrypt('1412');
      db.prepare(`INSERT OR REPLACE INTO parametres (uuid, cle, valeur, date_maj, last_modified_at, sync_status)
        VALUES (COALESCE((SELECT uuid FROM parametres WHERE cle = 'license.activated'), lower(hex(randomblob(16)))),
        'license.activated', ?, datetime('now'), ?, 1)`).run(enc, Date.now());
      return { success: true, message: 'Application activée définitivement !', slot: 'permanent' };
    }

    // ── 1. Activation mois courant (today ±2) ───────────────────
    const firstActivationStr = this._getParam(db, 'license.monthly_activated_at');
    const firstActivation    = firstActivationStr ? new Date(firstActivationStr) : null;

    const currentValidKeys = this.generateValidKeys(firstActivation);
    if (currentValidKeys.includes(keyTrimmed)) {
      return this._activateCurrent(db, keyTrimmed);
    }

    // ── 2. Clé futur +1, +2, +3 ─────────────────────────
    for (let offset = 1; offset <= 3; offset++) {
      const futureKeys = this.generateFutureKeys(offset);
      if (futureKeys.includes(keyTrimmed)) {
        return this._activateFuture(db, keyTrimmed, offset);
      }
    }

    return { success: false, message: 'Clé d\'activation invalide.' };
  },

  /**
   * Génère les clés définitives valides (today ±2, format court sans astro)
   */
  _generatePermanentKeys() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const keys = [];
    for (let delta = -2; delta <= 2; delta++) {
      const d = new Date(today);
      d.setDate(d.getDate() + delta);
      // Format définitif : [dateEncryptée][jourEncrypté]IA12D3ll!
      const encDate = this._encryptDate(d);
      const encDay  = this._encryptDay(d);
      keys.push(`${encDate}${encDay}IA12D3ll!`);
    }
    return keys;
  },

  _activateCurrent(db, key) {
    const now = new Date();

    const existingFirst = this._getParam(db, 'license.monthly_activated_at');
    const activatedAt   = existingFirst ? new Date(existingFirst) : now;

    const oldExpiresAtStr = this._getParam(db, 'license.monthly_expires_at');
    const oldExpiresAt    = oldExpiresAtStr ? new Date(oldExpiresAtStr).getTime() : 0;

    let newExpiresAtTime;
    if (oldExpiresAt === 0 || now.getTime() > oldExpiresAt) {
      // Si première activation OU activé en retard (après expiration)
      newExpiresAtTime = now.getTime() + this.MONTHLY_DURATION_MS;
    } else {
      // Si activé en avance ou exactement le jour même : on ajoute 1 mois à l'ancienne expiration
      newExpiresAtTime = oldExpiresAt + this.MONTHLY_DURATION_MS;
    }
    const expiresAt = new Date(newExpiresAtTime);

    this._setParam(db, 'license.monthly_activated_at', activatedAt.toISOString());
    this._setParam(db, 'license.monthly_expires_at',   expiresAt.toISOString());
    this._setParam(db, 'license.monthly_first_day',    String(activatedAt.getDate()));

    return {
      success: true,
      message: `Licence mensuelle activée ! Expire le ${this._formatDate(expiresAt)}.`,
      slot: 'current'
    };
  },

  /**
   * Pré-enregistre une clé pour un mois futur (slot 1, 2 ou 3)
   */
  _activateFuture(db, key, offset) {
    // Vérifier que le slot précédent est rempli (slot 2 nécessite slot 1, etc.)
    if (offset >= 2) {
      const prevSlot = this._getParam(db, `license.future_${offset - 1}`);
      if (!prevSlot) {
        return {
          success: false,
          message: `Vous devez d'abord entrer la clé du mois +${offset - 1} avant de saisir celle du mois +${offset}.`
        };
      }
    }

    // Calculer la date simulée (15 du mois futur)
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(1);
    futureDate.setMonth(futureDate.getMonth() + offset);
    futureDate.setDate(15);

    const meta = JSON.stringify({
      activatedAt: futureDate.toISOString(),
      firstDay: 15,
      offset
    });

    this._setParam(db, `license.future_${offset}`, key);
    this._setParam(db, `license.future_${offset}_meta`, meta);

    const monthNames = ['janvier','février','mars','avril','mai','juin',
                        'juillet','août','septembre','octobre','novembre','décembre'];
    const futureMonthName = monthNames[futureDate.getMonth()];

    return {
      success: true,
      message: `Clé du mois de ${futureMonthName} pré-enregistrée (slot +${offset}) !`,
      slot: `future_${offset}`
    };
  },

  // ── FORMATAGE ─────────────────────────────────────────────────────────────

  _formatMs(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const days    = Math.floor(totalSeconds / 86400);
    const hours   = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (days > 0) return `${days}j ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  },

  _formatDate(date) {
    const d = new Date(date);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  // ── UTILITAIRE ADMIN : GÉNÉRATION CLÉS ──────────────────────────────────

  /**
   * Génère la clé du jour courant pour affichage admin
   */
  generateTodayKey(db) {
    const firstStr = this._getParam(db, 'license.monthly_activated_at');
    const first    = firstStr ? new Date(firstStr) : new Date();
    return this.generateKey(new Date(), first);
  }
};

module.exports = LicenseManager;
