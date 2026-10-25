'use strict';
// Store, orders and entitlements. The server is the only place that decides what a player owns:
// clients read entitlements from /api/me and never send them.
//
// Payment providers plug in behind one small interface. Two ship here:
//   dev       purchases complete on a confirm tap, no money moves. For local testing only.
//   external  checkout redirects to a hosted payment page (Razorpay, Stripe, a store bridge...) and the
//             provider calls /api/store/webhook, signed with HMAC-SHA256 over the raw body.
// With no provider configured the store lists products but checkout is closed.
const crypto = require('node:crypto');
const audit = require('./audit');
const CATALOG = require('../../../packages/content/store.json');

const DAY = 86400e3;

function create(db, opts) {
  opts = opts || {};
  const mode = opts.mode || 'off';               // off | dev | external
  const secret = opts.secret || '';
  const checkoutUrl = opts.checkoutUrl || '';    // e.g. https://pay.example.com/checkout?order={order}
  const now = opts.now || Date.now;
  const product = (id) => CATALOG.products.find((p) => p.id === id) || null;

  // What a player owns right now.
  function entitlements(userId) {
    const t = now();
    const rows = db.all('SELECT * FROM entitlements WHERE user_id = ? AND revoked IS NULL AND (expires IS NULL OR expires > ?)', userId, t);
    const prem = rows.filter((r) => r.key === 'premium');
    return {
      premium: prem.length > 0,
      premiumUntil: !prem.length ? null : prem.some((r) => r.expires === null) ? 'lifetime' : Math.max(...prem.map((r) => r.expires)),
      passes: [...new Set(rows.filter((r) => r.key.startsWith('pass:')).map((r) => r.key.slice(5)))],
    };
  }

  function grant(userId, key, days, source, orderId, note) {
    const t = now();
    let expires = null;
    if (days) {
      // Time stacks: a renewal starts when the current period ends.
      const cur = db.get('SELECT MAX(expires) e FROM entitlements WHERE user_id = ? AND key = ? AND revoked IS NULL', userId, key);
      expires = Math.max(t, cur && cur.e ? cur.e : 0) + days * DAY;
    }
    const r = db.run('INSERT INTO entitlements (user_id, key, source, order_id, granted, expires, note) VALUES (?, ?, ?, ?, ?, ?, ?)', userId, key, source, orderId || null, t, expires, note || null);
    return Number(r.lastInsertRowid);
  }

  function publicProducts() {
    return CATALOG.products.map((p) => ({ id: p.id, name: p.name, kind: p.kind, period: p.period || null, badge: p.badge || null, price: p.price, onSale: mode !== 'off' && (!!p.price || mode === 'dev') }));
  }

  function checkout(user, productId) {
    const p = product(productId);
    if (!p) return [404, { error: 'No such product.' }];
    if (user.guest) return [403, { error: 'Create an account first, so your purchase is safe on every device.' }];
    if (mode === 'off') return [503, { error: 'The store opens at launch.' }];
    if (!p.price && mode !== 'dev') return [409, { error: 'This product is not on sale yet.' }];
    if (p.id.startsWith('pass.') && entitlements(user.id).premium) return [409, { error: 'Premium already includes the season pass.' }];
    if (p.id === 'premium.lifetime' && entitlements(user.id).premiumUntil === 'lifetime') return [409, { error: 'You already own Premium Lifetime.' }];
    const id = 'ord_' + crypto.randomBytes(9).toString('base64url');
    const t = now();
    db.run('INSERT INTO orders (id, user_id, product, amount, currency, provider, status, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, user.id, p.id, p.price ? p.price.amount : 0, p.price ? p.price.currency : CATALOG.currency, mode, 'created', t, t);
    const action = mode === 'dev' ? { type: 'dev-confirm' } : { type: 'redirect', url: checkoutUrl.replace('{order}', encodeURIComponent(id)) };
    return [200, { order: id, product: p.id, action }];
  }

  // Marks an order paid and grants what it buys. Safe to call twice.
  function fulfil(orderId, ref) {
    const o = db.get('SELECT * FROM orders WHERE id = ?', orderId);
    if (!o) return null;
    if (o.status === 'paid') return o;
    if (o.status !== 'created') return null;
    const p = product(o.product);
    db.tx(() => {
      db.run("UPDATE orders SET status = 'paid', provider_ref = ?, updated = ? WHERE id = ?", ref || null, now(), o.id);
      for (const g of p.grants) grant(o.user_id, g.key, g.days || 0, 'purchase', o.id);
    });
    audit.append(db, 'system', 'order.paid', o.id, { user: o.user_id, product: o.product, amount: o.amount, ref: ref || null });
    return db.get('SELECT * FROM orders WHERE id = ?', o.id);
  }

  function refund(orderId, actor, note) {
    const o = db.get('SELECT * FROM orders WHERE id = ?', orderId);
    if (!o || o.status !== 'paid') return null;
    db.tx(() => {
      db.run("UPDATE orders SET status = 'refunded', updated = ? WHERE id = ?", now(), o.id);
      db.run('UPDATE entitlements SET revoked = ? WHERE order_id = ? AND revoked IS NULL', now(), o.id);
    });
    audit.append(db, actor || 'system', 'order.refunded', o.id, { user: o.user_id, note: note || null });
    return true;
  }

  function devComplete(user, orderId) {
    if (mode !== 'dev') return [404, { error: 'Not found.' }];
    const o = db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', String(orderId || ''), user.id);
    if (!o) return [404, { error: 'No such order.' }];
    fulfil(o.id, 'dev');
    return [200, { ok: true, entitlements: entitlements(user.id) }];
  }

  function verifySignature(raw, sig) {
    if (!secret || typeof sig !== 'string') return false;
    const want = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(want), b = Buffer.from(sig.replace(/^sha256=/, ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // Provider callback: { order, event: 'paid' | 'refunded' | 'failed', ref }.
  function webhook(raw, sig) {
    if (mode !== 'external') return [404, { error: 'Not found.' }];
    if (!verifySignature(raw, sig)) return [401, { error: 'Bad signature.' }];
    let ev; try { ev = JSON.parse(raw); } catch { return [400, { error: 'Bad JSON.' }]; }
    const o = db.get('SELECT * FROM orders WHERE id = ?', String(ev.order || ''));
    if (!o) return [404, { error: 'No such order.' }];
    if (ev.event === 'paid') fulfil(o.id, ev.ref);
    else if (ev.event === 'refunded') refund(o.id, 'provider', ev.ref);
    else if (ev.event === 'failed' && o.status === 'created') db.run("UPDATE orders SET status = 'failed', updated = ? WHERE id = ?", now(), o.id);
    return [200, { ok: true }];
  }

  return { mode, entitlements, grant, publicProducts, checkout, fulfil, refund, devComplete, webhook, verifySignature, perks: CATALOG.perks, product };
}

module.exports = { create };
