// The beaten king's fall (src/fall3d.js): a real rigid body on the board. It must never sink into
// the board, must come to rest within the time the result card waits, must teeter back up when
// pushed too gently and go over when pushed enough, and must report its knocks for the sounds.
'use strict';
const assert = require('assert');
const F = require('../src/fall3d.js')();

// a turned king: a lathe profile (height, radius) with a cross on top
function king(scale) {
  const prof = [[0, 0.36], [0.08, 0.36], [0.14, 0.3], [0.3, 0.2], [0.9, 0.14], [1.0, 0.24], [1.08, 0.2], [1.3, 0.26], [1.38, 0.12]];
  const v = [];
  for (const [y, r] of prof) for (let a = 0; a < 32; a++) v.push(Math.cos(a / 32 * Math.PI * 2) * r * scale, y * scale, Math.sin(a / 32 * Math.PI * 2) * r * scale);
  for (let y = 1.38; y <= 1.62; y += 0.02) for (const [dx, dz] of [[0.03, 0.03], [-0.03, 0.03], [0.03, -0.03], [-0.03, -0.03]]) v.push(dx * scale, y * scale, dz * scale);
  for (let x = -0.12; x <= 0.12; x += 0.02) for (const dz of [-0.03, 0.03]) v.push(x * scale, 1.5 * scale, dz * scale), v.push(x * scale, 1.56 * scale, dz * scale);
  return F.shape(v);
}
const lowestOver = (sh, tr) => {
  let lo = Infinity;
  for (let t = 0; t <= tr.dur; t += 1 / 60) { const p = F.pose(tr, t); lo = Math.min(lo, p.p[1] + F.lowest(sh, p.q)); }
  return lo;
};
const upright = (tr) => F.rot(F.mat(F.last(tr).q), [0, 1, 0])[1];

for (const scale of [1, 1.25]) {
  const sh = king(scale);
  assert(sh.com[1] > 0.2 * sh.h && sh.com[1] < 0.5 * sh.h, 'the weight sits low in the piece');
  // dropped from the spotlight, turning over
  for (const [ux, uz] of [[1, 0], [0, 1], [-0.7, 0.7]]) {
    const ax = [uz, 0, -ux];
    const tr = F.simulate(sh, { p: [0, 1.5, 0], q: F.qyaw(0.3), v: [ux * 0.6, -0.5, uz * 0.6], w: [ax[0] * 2.4, 0.6, ax[2] * 2.4] }, { maxT: 5 });
    assert(tr.dur < 5, 'comes to rest in time (' + tr.dur.toFixed(2) + ' s)');
    assert(lowestOver(sh, tr) > -0.01, 'never sinks into the board');
    assert(tr.firstHit > 0.2 && tr.firstHit < 0.8, 'lands after a short drop');
    assert(tr.events.some((e) => e.kind === 'land') && tr.events.length >= 3, 'its knocks are heard');
    assert(Math.abs(upright(tr)) < 0.5, 'ends lying on its side');
  }
  // pushed too gently he teeters and rocks back; pushed enough he goes over
  const back = F.simulate(sh, F.tip(sh, [0, 0, 0], F.qyaw(0), [1, 0], 0.9));
  assert(upright(back) > 0.99, 'a gentle push rocks back upright');
  const over = F.simulate(sh, F.tip(sh, [0, 0, 0], F.qyaw(0), [1, 0], 1.1));
  assert(upright(over) < 0.5, 'a firm push tips him over');
  assert(lowestOver(sh, over) > -0.01, 'tipping never sinks into the board');
  // a fall that lands on another piece is scored worse than one that does not
  const toward = F.clash(sh, over, [{ x: 1, z: 0, r: 0.36, h: 1.7 }], 4.25);
  const away = F.clash(sh, over, [{ x: -1, z: 0, r: 0.36, h: 1.7 }], 4.25);
  assert(toward > away, 'falling onto a neighbour is avoided');
}
console.log('fall ok: drops, tips, rests on the board, scores clashes');
