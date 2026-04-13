'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'clinocaisse.db');

const db = new Database(DB_PATH, {
  // verbose: console.log  // décommenter pour debug
});

// Performances SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');



module.exports = db;
