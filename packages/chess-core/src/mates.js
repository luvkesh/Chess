// Exact "mate in n" prover for puzzle generation and the content tests. No evaluation and no
// pruning beyond what is sound: attack(pos, n) is true only when the side to move forces
// checkmate within n of its own moves against every defence. A node budget keeps a hard
// position from stalling a run; when it runs out the answer is "unknown" (an exception).
'use strict';

function ChacklateMates(E) {
  class Budget extends Error {}
  let nodes = 0, limit = Infinity;
  const cache = new Map();
  const key = (pos, n, who) => pos.hl + ':' + pos.hh + ':' + n + who;

  function tick() { if (++nodes > limit) throw new Budget('budget'); }

  // Checks first, then captures by victim value, then the rest.
  function ordered(pos, moves, checksOnly) {
    const scored = [];
    for (const m of moves) {
      if (!pos.make(m)) continue;
      const chk = pos.inCheck();
      pos.unmake();
      if (checksOnly && !chk) continue;
      const cap = E.mFlags(m) & E.F_CAP ? 10 : 0;
      scored.push([m, (chk ? 100 : 0) + cap + (E.mPromo(m) ? 50 : 0)]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    return scored.map((x) => x[0]);
  }

  function isMate(pos) { return pos.inCheck() && pos.legalMoves().length === 0; }

  // Side to move mates within n moves?
  function attack(pos, n) {
    tick();
    const k = key(pos, n, 'a');
    if (cache.has(k)) return cache.get(k);
    let res = false;
    // With one move left only a check can mate; with more, any move might.
    const moves = ordered(pos, pos.legalMoves(), n === 1);
    for (const m of moves) {
      pos.make(m);
      const r = isMate(pos) || (n > 1 && defend(pos, n - 1));
      pos.unmake();
      if (r) { res = true; break; }
    }
    cache.set(k, res);
    return res;
  }
  // Side to move (the defender) is mated within n more attacker moves whatever it plays?
  function defend(pos, n) {
    tick();
    const k = key(pos, n, 'd');
    if (cache.has(k)) return cache.get(k);
    const replies = pos.legalMoves();
    if (!replies.length) { cache.set(k, pos.inCheck()); return pos.inCheck(); }
    let res = true;
    // King moves and captures first: they are the likeliest refutations.
    const order = replies.slice().sort((a, b) => score(pos, b) - score(pos, a));
    for (const r of order) {
      pos.make(r);
      const ok = attack(pos, n);
      pos.unmake();
      if (!ok) { res = false; break; }
    }
    cache.set(k, res);
    return res;
  }
  function score(pos, m) {
    let s = 0;
    if (E.mFlags(m) & E.F_CAP) s += 20;
    if (Math.abs(E.pieceAt(pos, E.mFrom(m))) === E.K) s += 10;
    return s;
  }

  function run(fn, budget) {
    nodes = 0; limit = budget || Infinity;
    if (cache.size > 2e6) cache.clear();
    try { return fn(); } catch (e) { if (e instanceof Budget) return null; throw e; }
  }

  // The shortest forced mate (moves) up to max, or 0 when there is none, null when unknown.
  function shortest(pos, max, budget) {
    return run(() => { for (let n = 1; n <= max; n++) if (attack(pos, n)) return n; return 0; }, budget);
  }
  // Every first move that mates within n. null when unknown.
  function matingMoves(pos, n, budget) {
    return run(() => {
      const out = [];
      for (const m of pos.legalMoves()) {
        pos.make(m);
        const r = isMate(pos) || (n > 1 && defend(pos, n - 1));
        pos.unmake();
        if (r) out.push(E.uci(m));
      }
      return out;
    }, budget);
  }
  // After the attacker's move: the defence that lasts longest (moves the attacker still needs).
  function longestDefence(pos, n, budget) {
    return run(() => {
      let best = null, bestN = -1;
      for (const r of pos.legalMoves()) {
        pos.make(r);
        let k = 1;
        while (k <= n && !attack(pos, k)) k++;
        pos.unmake();
        if (k > n) return { move: E.uci(r), need: Infinity };
        if (k > bestN) { bestN = k; best = r; }
      }
      return best === null ? null : { move: E.uci(best), need: bestN };
    }, budget);
  }
  return { attack: (pos, n, budget) => run(() => attack(pos, n), budget), defends: (pos, n, budget) => run(() => defend(pos, n), budget), shortest, matingMoves, longestDefence, isMate, clear: () => cache.clear() };
}

if (typeof module !== 'undefined') module.exports = ChacklateMates;
