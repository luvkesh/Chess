'use strict';
// Glicko-2 (Glickman, 2013), one game at a time. Ratings use the Glicko scale (1500 / 350 / 0.06).
const SCALE = 173.7178;
const TAU = 0.5;
const EPS = 0.000001;

function defaults() { return { rating: 1500, rd: 350, vol: 0.06 }; }

// Raises RD for time without games (one rating period per `periods`).
function decay(p, periods) {
  const phi = p.rd / SCALE;
  const next = Math.sqrt(phi * phi + periods * p.vol * p.vol) * SCALE;
  return Object.assign({}, p, { rd: Math.min(350, next) });
}

// score: 1 win, 0.5 draw, 0 loss for `p` against `o`.
function update(p, o, score) {
  const mu = (p.rating - 1500) / SCALE, phi = p.rd / SCALE;
  const muJ = (o.rating - 1500) / SCALE, phiJ = o.rd / SCALE;
  const g = 1 / Math.sqrt(1 + (3 * phiJ * phiJ) / (Math.PI * Math.PI));
  const E = 1 / (1 + Math.exp(-g * (mu - muJ)));
  const v = 1 / (g * g * E * (1 - E));
  const delta = v * g * (score - E);

  const a = Math.log(p.vol * p.vol);
  const f = (x) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * Math.pow(phi * phi + v + ex, 2)) - (x - a) / (TAU * TAU);
  };
  let A = a, B;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(a - k * TAU) < 0) k++; B = a - k * TAU; }
  let fA = f(A), fB = f(B);
  while (Math.abs(B - A) > EPS) {
    const C = A + ((A - B) * fA) / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * g * (score - E);
  return { rating: muNew * SCALE + 1500, rd: Math.max(30, phiNew * SCALE), vol };
}

module.exports = { defaults, decay, update };
