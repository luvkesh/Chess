'use strict';
// Children's safety: age bands, safe player names, parental consent, parent accounts and the
// controls a parent sets. Chackmate is made for children, so the safe choice is the default:
//   - anyone under 18 (a child under India's DPDP Act; under 13 is a child under COPPA) needs a
//     parent's consent before the account can play online, sync progress or get reminders;
//   - under-18s pick a generated name (BraveOtter42) and cannot type one, so names never carry
//     real names, contact details or rude words;
//   - under-18s and guests are matched only with each other, never with adult accounts;
//   - purchases from an under-18 account need the parent's PIN, and reminders need the parent's yes.
const crypto = require('node:crypto');
const auth = require('./auth');
const audit = require('./audit');

const HOUR = 3600e3;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

// ------------------------------------------------------------------ names
const ADJ = ['Brave', 'Bright', 'Calm', 'Clever', 'Cosy', 'Daring', 'Eager', 'Gentle', 'Happy', 'Jolly', 'Kind', 'Lucky', 'Merry', 'Mighty', 'Nimble',
  'Noble', 'Plucky', 'Proud', 'Quick', 'Quiet', 'Royal', 'Shiny', 'Silver', 'Golden', 'Sunny', 'Swift', 'Tidy', 'Witty', 'Zesty', 'Cocoa', 'Minty', 'Starry'];
const NOUN = ['Otter', 'Panda', 'Falcon', 'Tiger', 'Koala', 'Dolphin', 'Owl', 'Fox', 'Badger', 'Penguin', 'Rabbit', 'Hedgehog', 'Lion', 'Robin', 'Turtle',
  'Pony', 'Squirrel', 'Peacock', 'Elephant', 'Parrot', 'Rook', 'Knight', 'Bishop', 'Pawn', 'Comet', 'Rocket', 'Truffle', 'Toffee', 'Mango', 'Maple', 'Pebble', 'Acorn'];
const GENERATED = new RegExp('^(' + ADJ.join('|') + ')(' + NOUN.join('|') + ')([1-9][0-9])$');
function suggestNames(n, taken) {
  const out = new Set();
  let guard = 0;
  while (out.size < n && guard++ < 500) {
    const name = ADJ[crypto.randomInt(ADJ.length)] + NOUN[crypto.randomInt(NOUN.length)] + crypto.randomInt(10, 100);
    if (!taken || !taken(name)) out.add(name);
  }
  return [...out];
}
const isGeneratedName = (name) => typeof name === 'string' && GENERATED.test(name);

// Typed names (adults only) are checked after undoing common letter swaps (3 for e, 0 for o...).
const ROOTS = ['fuck', 'shit', 'cunt', 'bitch', 'bastard', 'dick', 'cock', 'pussy', 'penis', 'vagina', 'sex', 'porn', 'nude', 'boob', 'tits', 'arse', 'asshole',
  'slut', 'whore', 'rape', 'nazi', 'hitler', 'nigg', 'fag', 'retard', 'suicide', 'cocaine', 'chutiya', 'madarchod', 'bhenchod', 'behenchod',
  'gaand', 'randi', 'lund', 'bsdk', 'mc', 'bc'];
const SHORT = new Set(['mc', 'bc']);
function rude(name) {
  const k = String(name).toLowerCase().replace(/[4@]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't').replace(/[_-]/g, '');
  return ROOTS.some((r) => (SHORT.has(r) ? new RegExp('(^|[^a-z])' + r + '([^a-z]|$)').test(name.toLowerCase().replace(/[_-]/g, ' ')) : k.includes(r)));
}
// Rejects names that could carry contact details: long digit runs (phone numbers) or web addresses.
function contactLike(name) { return /\d{5,}/.test(name) || /(www|http|gmail|insta|snap|whatsapp|telegram|discord|tiktok|youtube)/i.test(name); }
function typedNameProblem(name) {
  const bad = auth.validName(name);
  if (bad) return bad;
  if (rude(name)) return 'Please choose a friendlier name.';
  if (contactLike(name)) return 'Names cannot include phone numbers, web addresses or social media handles.';
  return null;
}

// ------------------------------------------------------------------ ages
// Only the birth month and year are kept, and only to work out the age band.
function ageOn(year, month, now) {
  const d = new Date(now);
  let age = d.getUTCFullYear() - year;
  if (d.getUTCMonth() + 1 < month) age--;
  return age;
}
function bandFor(year, month, now) {
  const a = ageOn(year, month, now);
  return a < 13 ? 'child' : a < 18 ? 'teen' : 'adult';
}
function validBirth(year, month, now) {
  const y = Number(year), m = Number(month), thisYear = new Date(now).getUTCFullYear();
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12 || y < thisYear - 110 || y > thisYear) return null;
  if (ageOn(y, m, now) < 4) return null;
  return { year: y, month: m };
}

const DEFAULT_CONTROLS = { online: true, rated: true, openPool: false, reminders: false, purchases: 'pin', dailyMinutes: 0 };
function controlsOf(u) {
  let c = {};
  try { c = u.controls ? JSON.parse(u.controls) : {}; } catch (e) { c = {}; }
  return Object.assign({}, DEFAULT_CONTROLS, c);
}
function cleanControls(c, prev) {
  const out = Object.assign({}, prev || DEFAULT_CONTROLS);
  if (!c || typeof c !== 'object') return out;
  for (const k of ['online', 'rated', 'openPool', 'reminders']) if (typeof c[k] === 'boolean') out[k] = c[k];
  if (['pin', 'off'].includes(c.purchases)) out.purchases = c.purchases;
  if (Number.isInteger(c.dailyMinutes) && c.dailyMinutes >= 0 && c.dailyMinutes <= 600) out.dailyMinutes = c.dailyMinutes;
  return out;
}

// ------------------------------------------------------------------ policy, used by the lobby and APIs
// Who a player is, for safety purposes: 'adult', 'minor' (under 18, with or without consent) or 'guest'.
// Accounts made before ages were asked count as minors until an age is given.
const kindOf = (u) => (u.guest ? 'guest' : u.age_band === 'adult' ? 'adult' : 'minor');
const consented = (u) => kindOf(u) !== 'minor' || !!u.consent;
const policy = {
  // null when the player may play online, otherwise the reason.
  online(u) {
    if (kindOf(u) !== 'minor') return null;
    if (!u.age_band) return 'Tell us your age in Settings › Account before playing online.';
    if (!u.consent) return 'A parent needs to say yes before you can play online. We emailed them a link.';
    return controlsOf(u).online ? null : 'A parent has turned online play off for this account.';
  },
  rated(u) { return kindOf(u) !== 'minor' || controlsOf(u).rated; },
  // Matchmaking pool: under-18s and guests only ever meet each other.
  pool(u) {
    const k = kindOf(u);
    if (k === 'adult') return 'open';
    if (k === 'minor' && u.age_band === 'teen' && u.consent && controlsOf(u).openPool) return 'open';
    return 'kids';
  },
  reminders(u) { return kindOf(u) !== 'minor' || (!!u.consent && controlsOf(u).reminders); },
  syncProgress(u) { return consented(u); },
  publicProfile(u) { return kindOf(u) === 'adult'; },
  // What the game needs to know to show the right screens.
  info(u) {
    const c = controlsOf(u);
    return { kind: kindOf(u), band: u.age_band || null, consent: kindOf(u) === 'minor' ? !!u.consent : null, online: policy.online(u), pool: policy.pool(u),
      reminders: policy.reminders(u), purchases: kindOf(u) === 'minor' ? c.purchases : 'open', dailyMinutes: kindOf(u) === 'minor' ? c.dailyMinutes : 0 };
  },
};

function create(db, lobby, opts) {
  const mail = opts.mailer;
  const publicUrl = (opts.publicUrl || 'http://localhost:8080').replace(/\/+$/, '');
  const now = opts.now || Date.now;
  const limit = auth.limiter(10, 15 * 60000);

  function issue(userId, kind, ttl) {
    const t = crypto.randomBytes(32).toString('base64url');
    db.run('DELETE FROM account_tokens WHERE user_id = ? AND kind = ?', userId, kind);
    db.run('INSERT INTO account_tokens (hash, user_id, kind, expires) VALUES (?, ?, ?, ?)', sha(t), userId, kind, now() + ttl);
    return t;
  }
  function peek(t, kind) {
    if (typeof t !== 'string' || t.length < 20) return null;
    const row = db.get('SELECT * FROM account_tokens WHERE hash = ? AND kind = ?', sha(t), kind);
    return row && row.expires > now() ? row : null;
  }

  async function requestConsent(u, parentEmail) {
    const t = issue(u.id, 'consent', 7 * 24 * HOUR);
    const link = publicUrl + '/parent#consent=' + t;
    const who = u.age_band === 'child' ? 'Your child' : 'Your teenager';
    await mail.send({ to: parentEmail, subject: who + ' would like to play Chackmate online',
      text: 'Hello,\n\n' + who + ' made a Chackmate account called ' + u.name + ' and gave this email address for a parent or guardian.\n\n' +
        'Before they can play online, we need your permission. The link below tells you exactly what we keep (very little: the player name, a password, the birth month and year, and game history) and lets you choose what they can do.\n\n' +
        link + '\n\nThe link works for 7 days. If you do not know what this is about, ignore this email and the account stays offline-only. Nothing else is sent to you unless you sign up as their parent.',
      html: '<p>Hello,</p><p>' + who + ' made a Chackmate account called <b>' + u.name + '</b> and gave this email address for a parent or guardian.</p>' +
        '<p>Before they can play online, we need your permission. The page tells you exactly what we keep (very little: the player name, a password, the birth month and year, and game history) and lets you choose what they can do.</p>' +
        '<p><a href="' + link + '">Review and give permission</a></p><p>The link works for 7 days. If you do not know what this is about, ignore this email and the account stays offline-only.</p>' });
  }

  // Parent sessions are separate from player sessions, so a parent never appears in games.
  function parentFor(req) {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Parent ') ? h.slice(7) : '';
    if (!t) return null;
    const row = db.get('SELECT p.* FROM parent_sessions s JOIN parents p ON p.id = s.parent_id WHERE s.token = ?', t);
    if (row) db.run('UPDATE parent_sessions SET seen = ? WHERE token = ?', now(), t);
    return row || null;
  }
  function parentSession(parentId) {
    const t = auth.token();
    db.run('INSERT INTO parent_sessions (token, parent_id, created, seen) VALUES (?, ?, ?, ?)', t, parentId, now(), now());
    return t;
  }
  const validPin = (p) => typeof p === 'string' && /^\d{4,6}$/.test(p);

  function activity(u) {
    let progress = null;
    try { progress = u.progress ? JSON.parse(u.progress) : null; } catch (e) { progress = null; }
    const games = db.get('SELECT COUNT(*) n, MAX(started) last FROM games WHERE white = ? OR black = ?', u.id, u.id);
    const week = db.get('SELECT COUNT(*) n FROM games WHERE (white = ? OR black = ?) AND started > ?', u.id, u.id, now() - 7 * 24 * HOUR);
    const lessons = progress && progress.lessons ? Object.values(progress.lessons).filter((l) => l && l.done).length : 0;
    return { onlineGames: games.n, onlineGamesThisWeek: week.n, lastOnline: games.last || null, lessonsDone: lessons, level: progress && progress.xp != null ? progress.xp : null, ratings: lobby.ratings(u.id) };
  }
  const childView = (u) => ({ id: u.id, name: u.name, band: u.age_band, consent: u.consent, controls: controlsOf(u), activity: activity(u), created: u.created });
  function child(parent, id) { return db.get('SELECT * FROM users WHERE id = ? AND parent_id = ? AND deleted IS NULL', Number(id), parent.id); }

  function deleteChild(u, actor) {
    const label = 'Deleted player ' + u.id;
    db.tx(() => {
      db.run('UPDATE users SET name = ?, name_key = NULL, pass = NULL, email = NULL, email_key = NULL, email_verified = 0, progress = NULL, guest = 1, deleted = ?, parent_id = NULL, birth_ym = NULL, controls = NULL, consent = NULL, country = NULL, city = NULL, loc_src = NULL WHERE id = ?', label, now(), u.id);
      for (const t of ['sessions', 'push_subs', 'account_tokens', 'fairplay', 'ratings']) db.run('DELETE FROM ' + t + ' WHERE user_id = ?', u.id);
      db.run('DELETE FROM friends WHERE user_id = ? OR friend_id = ?', u.id, u.id);
    });
    lobby.kick(u.id, 'This account was deleted.', 'deleted');
    audit.append(db, actor, 'account.deleted', u.id, null);
  }

  // Accounts nobody has used for two years are deleted, as the privacy policy promises, unless
  // they hold a purchase that is still running. Parent accounts go once no child is linked and
  // the parent has not signed in for two years. Runs once a day from the server.
  const INACTIVE = 730 * 24 * HOUR;
  function purgeInactive() {
    const cut = now() - INACTIVE;
    const idle = db.all('SELECT * FROM users WHERE deleted IS NULL AND seen < ? AND NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.user_id = users.id AND e.revoked IS NULL AND (e.expires IS NULL OR e.expires > ?))', cut, now());
    for (const u of idle) deleteChild(u, 'system:inactive');
    const parents = db.all('SELECT p.id FROM parents p WHERE p.created < ? AND NOT EXISTS (SELECT 1 FROM users u WHERE u.parent_id = p.id AND u.deleted IS NULL) AND NOT EXISTS (SELECT 1 FROM parent_sessions s WHERE s.parent_id = p.id AND s.seen >= ?)', cut, cut);
    for (const p of parents) { db.run('DELETE FROM parent_sessions WHERE parent_id = ?', p.id); db.run('DELETE FROM parents WHERE id = ?', p.id); }
    return { players: idle.length, parents: parents.length };
  }

  // Returns [status, body] or null when the path is not a family route.
  async function handle(req, p, body, ip, user) {
    if (p === '/api/names') return [200, { names: suggestNames(6, (n) => !!db.get('SELECT id FROM users WHERE name_key = ?', n.toLowerCase())) }];

    // A player under 18 (or a legacy account) tells us their age, and a parent email if needed.
    if (p === '/api/account/age' && req.method === 'POST') {
      if (!user || user.guest) return [401, { error: 'Not signed in.' }];
      if (user.age_band && user.age_band !== 'adult' && user.consent) return [400, { error: 'Your parent manages this account.' }];
      const b = validBirth(body.birthYear, body.birthMonth, now());
      if (!b) return [400, { error: 'Choose your birth month and year.' }];
      const band = bandFor(b.year, b.month, now());
      if (band !== 'adult' && !isGeneratedName(user.name)) {
        // Under-18s keep only generated names, so an older typed name is swapped for one they pick.
        const nn = String(body.name || '');
        if (!isGeneratedName(nn)) return [409, { error: 'Pick a new player name first.', needName: true, names: suggestNames(6) }];
        if (db.get('SELECT id FROM users WHERE name_key = ? AND id != ?', nn.toLowerCase(), user.id)) return [409, { error: 'That name was just taken. Pick another.', needName: true, names: suggestNames(6) }];
        db.run('UPDATE users SET name = ?, name_key = ? WHERE id = ?', nn, nn.toLowerCase(), user.id);
      }
      db.run('UPDATE users SET birth_ym = ?, age_band = ? WHERE id = ?', b.year + '-' + String(b.month).padStart(2, '0'), band, user.id);
      if (band !== 'adult') {
        const pe = String(body.parentEmail || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pe)) return [400, { error: 'Ask a parent for their email address.' }];
        if (!limit('consent:' + user.id)) return [429, { error: 'Too many attempts. Try again later.' }];
        await requestConsent(db.get('SELECT * FROM users WHERE id = ?', user.id), pe);
      }
      return [200, { ok: true, band, consentNeeded: band !== 'adult' }];
    }
    if (p === '/api/account/consent/resend' && req.method === 'POST') {
      if (!user || user.guest || kindOf(user) !== 'minor' || user.consent) return [400, { error: 'Nothing to send.' }];
      const pe = String(body.parentEmail || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pe)) return [400, { error: 'Ask a parent for their email address.' }];
      if (!limit('consent:' + user.id)) return [429, { error: 'Too many attempts. Try again later.' }];
      await requestConsent(user, pe);
      return [200, { ok: true }];
    }

    if (!p.startsWith('/api/parent/')) return null;

    if (p === '/api/parent/consent-info') {
      const row = peek(body.token || '', 'consent');
      if (!row) return [400, { error: 'This link has expired or was already used. Your child can send a new one from the game.' }];
      const u = db.get('SELECT * FROM users WHERE id = ?', row.user_id);
      return [200, { name: u.name, band: u.age_band, defaults: DEFAULT_CONTROLS }];
    }
    // The parent says yes: creates (or signs in to) their parent account and links the child.
    if (p === '/api/parent/consent' && req.method === 'POST') {
      if (!limit('pc:' + ip)) return [429, { error: 'Too many attempts. Try again in 15 minutes.' }];
      const row = peek(body.token || '', 'consent');
      if (!row) return [400, { error: 'This link has expired or was already used.' }];
      if (body.agree !== true) return [400, { error: 'Tick the box to confirm you are the parent or guardian.' }];
      const email = String(body.email || '').trim(), key = email.toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return [400, { error: 'Enter your email address.' }];
      let parent = db.get('SELECT * FROM parents WHERE email_key = ?', key);
      if (parent) {
        if (!auth.checkPassword(body.password, parent.pass)) return [401, { error: 'You already have a parent account. Enter its password.' }];
      } else {
        const bad = auth.validPassword(body.password);
        if (bad) return [400, { error: bad }];
        if (!validPin(body.pin)) return [400, { error: 'Choose a 4 to 6 digit PIN for approving purchases.' }];
        const r = db.run('INSERT INTO parents (email, email_key, pass, pin, created) VALUES (?, ?, ?, ?, ?)', email, key, auth.hashPassword(body.password), auth.hashPassword(body.pin), now());
        parent = db.get('SELECT * FROM parents WHERE id = ?', Number(r.lastInsertRowid));
      }
      const u = db.get('SELECT * FROM users WHERE id = ?', row.user_id);
      db.run('DELETE FROM account_tokens WHERE hash = ?', row.hash);
      db.run('UPDATE users SET parent_id = ?, consent = ?, controls = ? WHERE id = ?', parent.id, now(), JSON.stringify(cleanControls(body.controls)), u.id);
      audit.append(db, 'parent:' + parent.id, 'consent.given', u.id, null);
      lobby.refresh(u.id);
      return [200, { ok: true, token: parentSession(parent.id), child: childView(db.get('SELECT * FROM users WHERE id = ?', u.id)) }];
    }
    if (p === '/api/parent/login' && req.method === 'POST') {
      if (!limit('pl:' + ip)) return [429, { error: 'Too many attempts. Try again in 15 minutes.' }];
      const parent = db.get('SELECT * FROM parents WHERE email_key = ?', String(body.email || '').trim().toLowerCase());
      if (!parent || !auth.checkPassword(body.password, parent.pass)) return [401, { error: 'Wrong email or password.' }];
      return [200, { token: parentSession(parent.id) }];
    }
    const parent = parentFor(req);
    if (!parent) return [401, { error: 'Sign in as a parent.' }];
    if (p === '/api/parent/logout' && req.method === 'POST') {
      db.run('DELETE FROM parent_sessions WHERE token = ?', (req.headers.authorization || '').slice(7));
      return [200, { ok: true }];
    }
    if (p === '/api/parent/me') {
      return [200, { email: parent.email, children: db.all('SELECT * FROM users WHERE parent_id = ? AND deleted IS NULL ORDER BY created', parent.id).map(childView) }];
    }
    if (p === '/api/parent/controls' && req.method === 'POST') {
      const u = child(parent, body.child);
      if (!u) return [404, { error: 'No such child on your account.' }];
      const c = cleanControls(body.controls, controlsOf(u));
      db.run('UPDATE users SET controls = ? WHERE id = ?', JSON.stringify(c), u.id);
      if (!c.reminders) db.run('DELETE FROM push_subs WHERE user_id = ?', u.id);
      audit.append(db, 'parent:' + parent.id, 'controls.changed', u.id, JSON.stringify(c));
      lobby.refresh(u.id);
      return [200, { ok: true, controls: c }];
    }
    if (p === '/api/parent/pin' && req.method === 'POST') {
      if (!auth.checkPassword(body.password, parent.pass)) return [401, { error: 'Your password is not right.' }];
      if (!validPin(body.pin)) return [400, { error: 'PINs are 4 to 6 digits.' }];
      db.run('UPDATE parents SET pin = ? WHERE id = ?', auth.hashPassword(body.pin), parent.id);
      return [200, { ok: true }];
    }
    if (p === '/api/parent/export') {
      const u = child(parent, body.child);
      if (!u) return [404, { error: 'No such child on your account.' }];
      return [200, Object.assign({ exported: new Date(now()).toISOString(), birthMonth: u.birth_ym }, childView(u), {
        games: db.all('SELECT g.id, g.tc, g.rated, g.moves, g.result, g.reason, g.started, w.name white, b.name black FROM games g JOIN users w ON w.id = g.white JOIN users b ON b.id = g.black WHERE g.white = ? OR g.black = ?', u.id, u.id),
        progress: u.progress ? JSON.parse(u.progress) : null,
        orders: db.all('SELECT id, product, amount, currency, status, created FROM orders WHERE user_id = ?', u.id),
        notifications: db.all('SELECT hour, tz, created FROM push_subs WHERE user_id = ?', u.id),
        country: u.country || null,
        friends: db.all('SELECT u.name, f.since FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ?', u.id),
      })];
    }
    if (p === '/api/parent/delete' && req.method === 'POST') {
      if (!auth.checkPassword(body.password, parent.pass)) return [401, { error: 'Your password is not right.' }];
      const u = child(parent, body.child);
      if (!u) return [404, { error: 'No such child on your account.' }];
      deleteChild(u, 'parent:' + parent.id);
      return [200, { ok: true }];
    }
    // Withdraws consent and removes the parent account; children's accounts are deleted with it.
    if (p === '/api/parent/close' && req.method === 'POST') {
      if (!auth.checkPassword(body.password, parent.pass)) return [401, { error: 'Your password is not right.' }];
      for (const u of db.all('SELECT * FROM users WHERE parent_id = ? AND deleted IS NULL', parent.id)) deleteChild(u, 'parent:' + parent.id);
      db.run('DELETE FROM parent_sessions WHERE parent_id = ?', parent.id);
      db.run('DELETE FROM parents WHERE id = ?', parent.id);
      return [200, { ok: true }];
    }
    return [404, { error: 'Not found.' }];
  }

  // Purchases from an under-18 account need the parent's PIN (and the parent can switch them off).
  // Five wrong PINs lock purchases on that account for 15 minutes, so a child cannot guess it.
  const pinMisses = new Map();
  function purchaseCheck(u, pin) {
    if (kindOf(u) !== 'minor') return null;
    if (!u.consent || !u.parent_id) return 'A parent needs to set up this account before anything can be bought.';
    if (controlsOf(u).purchases === 'off') return 'A parent has turned purchases off for this account.';
    const miss = pinMisses.get(u.id);
    if (miss && miss.n >= 5 && Date.now() - miss.at < 15 * 60e3) return 'Too many wrong PINs. Try again in 15 minutes.';
    const parent = db.get('SELECT * FROM parents WHERE id = ?', u.parent_id);
    if (!parent || !auth.checkPassword(String(pin || ''), parent.pin)) {
      if (pin) pinMisses.set(u.id, { n: (miss && Date.now() - miss.at < 15 * 60e3 ? miss.n : 0) + 1, at: Date.now() });
      return 'Ask a parent to enter their PIN.';
    }
    pinMisses.delete(u.id);
    return null;
  }

  return { handle, purchaseCheck, requestConsent, purgeInactive };
}

module.exports = { create, policy, kindOf, controlsOf, bandFor, validBirth, suggestNames, isGeneratedName, typedNameProblem, rude, DEFAULT_CONTROLS };
