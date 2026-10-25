'use strict';
// SQLite storage through node:sqlite (Node 22.5+). One file; WAL mode.
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT UNIQUE,              -- lower-cased name; NULL for guests
  pass TEXT,                         -- scrypt$salt$hash; NULL for guests
  guest INTEGER NOT NULL DEFAULT 1,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  banned TEXT,                       -- reason, or NULL
  muted INTEGER NOT NULL DEFAULT 0,
  progress TEXT                      -- client progress blob (JSON)
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ratings (
  user_id INTEGER NOT NULL REFERENCES users(id),
  pool TEXT NOT NULL,                -- bullet | blitz | rapid
  rating REAL NOT NULL, rd REAL NOT NULL, vol REAL NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL,
  PRIMARY KEY (user_id, pool)
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  white INTEGER NOT NULL, black INTEGER NOT NULL,
  tc TEXT NOT NULL, rated INTEGER NOT NULL,
  moves TEXT NOT NULL DEFAULT '',
  result TEXT, reason TEXT,
  started INTEGER NOT NULL, ended INTEGER,
  white_before REAL, white_after REAL, black_before REAL, black_after REAL
);
CREATE INDEX IF NOT EXISTS games_white ON games(white);
CREATE INDEX IF NOT EXISTS games_black ON games(black);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  reporter INTEGER NOT NULL, target INTEGER NOT NULL, game_id TEXT,
  reason TEXT NOT NULL, created INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'  -- open | actioned | dismissed
);
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  pass TEXT NOT NULL,
  role TEXT NOT NULL,                -- support | moderator | admin
  created INTEGER NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS staff_sessions (
  token TEXT PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,               -- staff email or 'system'
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  prev TEXT NOT NULL,
  hash TEXT NOT NULL                 -- sha256(prev | at | actor | action | target | detail)
);
`;

function open(file) {
  const db = new DatabaseSync(file || ':memory:');
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  const cache = new Map();
  // Prepared statements are cached by SQL text.
  const q = (sql) => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  return {
    raw: db,
    get: (sql, ...a) => q(sql).get(...a),
    all: (sql, ...a) => q(sql).all(...a),
    run: (sql, ...a) => q(sql).run(...a),
    tx(fn) {
      db.exec('BEGIN');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    close: () => db.close(),
  };
}

module.exports = { open };
