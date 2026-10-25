'use strict';
// Fair play signals. Every finished rated game is analysed in a worker thread; per-player engine
// agreement is stored, and a player whose recent games agree with the engine far more than people
// do lands in the moderators' report queue. Nothing here bans anyone: a person decides.
//
// The thresholds are starting points. Tune them on real games before launch: strong players match
// the engine more, and this engine is weaker than the ones cheaters use, so agreement understates it.
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const DEFAULTS = {
  depth: 6, timeMs: 1500, skipPlies: 16,
  game: { minMoves: 15, match: 0.85, acpl: 12 },      // one game looks engine-like
  recent: { games: 10, minMoves: 80, match: 0.75, acpl: 15, flagged: 3 },
  reportEveryMs: 7 * 86400e3,
};
const SYSTEM = 0;  // reports.reporter for automatic reports

function create(db, opts) {
  opts = opts || {};
  const T = Object.assign({}, DEFAULTS, opts.thresholds || {});
  T.game = Object.assign({}, DEFAULTS.game, (opts.thresholds || {}).game);
  T.recent = Object.assign({}, DEFAULTS.recent, (opts.thresholds || {}).recent);
  const now = opts.now || Date.now;
  const log = opts.log || (() => {});
  let worker = null, busy = false;
  const queue = [], waiters = [];

  function startWorker() {
    worker = new Worker(path.join(__dirname, 'fairplay-worker.js'));
    worker.unref();
    worker.on('message', (m) => {
      const job = queue.shift();
      busy = false;
      if (m.error) log('fairplay analysis failed', job && job.id, m.error);
      else if (job) record(job.id, job.white, job.black, m.result);
      next();
    });
    worker.on('error', (e) => { log('fairplay worker died', e.message); worker = null; busy = false; queue.shift(); next(); });
  }
  function next() {
    if (busy) return;
    if (!queue.length) { while (waiters.length) waiters.shift()(); return; }
    if (!worker) startWorker();
    busy = true;
    const j = queue[0];
    worker.postMessage({ id: j.id, moves: j.moves, opts: { depth: T.depth, timeMs: T.timeMs, skipPlies: T.skipPlies } });
  }

  // Called by the lobby when a game ends.
  function enqueue(game) {
    if (!game.rated || !game.moves || game.moves.length < T.skipPlies + 10) return false;
    queue.push(game);
    next();
    return true;
  }
  const idle = () => (queue.length || busy ? new Promise((r) => waiters.push(r)) : Promise.resolve());

  function record(gameId, white, black, result) {
    const t = now();
    for (const [uid, color] of [[white, 'w'], [black, 'b']]) {
      const r = result[color];
      if (!r || !r.moves) continue;
      const flagged = r.moves >= T.game.minMoves && r.match >= T.game.match && r.acpl <= T.game.acpl ? 1 : 0;
      db.run('INSERT OR REPLACE INTO fairplay (game_id, user_id, color, moves, match, acpl, flagged, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', gameId, uid, color, r.moves, r.match, r.acpl, flagged, t);
      review(uid, gameId);
    }
  }

  function summary(uid) {
    const rows = db.all('SELECT * FROM fairplay WHERE user_id = ? ORDER BY created DESC LIMIT ?', uid, T.recent.games);
    const moves = rows.reduce((a, r) => a + r.moves, 0);
    return {
      games: rows.length, moves, flagged: rows.filter((r) => r.flagged).length,
      match: moves ? rows.reduce((a, r) => a + r.match * r.moves, 0) / moves : 0,
      acpl: moves ? rows.reduce((a, r) => a + r.acpl * r.moves, 0) / moves : 0,
    };
  }
  function suspicious(s) {
    return s.flagged >= T.recent.flagged || (s.moves >= T.recent.minMoves && s.match >= T.recent.match && s.acpl <= T.recent.acpl);
  }

  function review(uid, gameId) {
    const s = summary(uid);
    if (!suspicious(s)) return;
    if (db.get('SELECT id FROM reports WHERE reporter = ? AND target = ? AND created > ?', SYSTEM, uid, now() - T.reportEveryMs)) return;
    const reason = 'Fair play: ' + Math.round(s.match * 100) + '% engine agreement, ' + Math.round(s.acpl) + ' average centipawn loss over ' + s.moves + ' moves in the last ' + s.games + ' rated games (' + s.flagged + ' engine-like).';
    db.run('INSERT INTO reports (reporter, target, game_id, reason, created) VALUES (?, ?, ?, ?, ?)', SYSTEM, uid, gameId, reason, now());
    log('fairplay report', uid, reason);
  }

  function stop() { if (worker) worker.terminate(); worker = null; }

  return { enqueue, record, summary, suspicious, idle, stop, thresholds: T };
}

module.exports = { create, DEFAULTS, SYSTEM };
