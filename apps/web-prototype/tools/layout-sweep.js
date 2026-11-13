// Layout sweep: opens every menu screen and pop-up at many window sizes and languages in a real
// browser, scrolls each one top to bottom, and reports what a player would see as broken:
//   hscroll    the page scrolls sideways
//   offscreen  text or a control sits partly outside the window
//   clip       text is cut by a box that does not scroll (ellipsis and line clamps are listed apart)
//   overlap    two pieces of text sit on top of each other
//   covered    text sits under something else (a floating button, a badge, the guide)
//   guide      Rooky's round face sits on a button or arrow
//   tap        a control smaller than 24 x 24 px (WCAG 2.5.8)
//   rawkey     a translation key, {placeholder}, "undefined" or "NaN" shows as text
//   img        a picture failed to load
//   tiny       text under 10 px
// Usage: node tools/layout-sweep.js [--sizes=phone,ipad,desk,zoom|all] [--langs=en,ar|all]
//   [--screens=home,play,...] [--shots=dir] [--jobs=4] [page.html]
// Writes layout-sweep.json next to the shots (or in the current folder) and prints a summary of
// every distinct problem with the sizes and languages it shows at. Needs Playwright. Menus need no
// 3D, so the browser runs without WebGL and a whole sweep takes minutes.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const file = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'dist', 'chackmate.html'));

const SIZES = {
  phone: [['320x568', 320, 568, 1], ['360x740', 360, 740, 1], ['390x844', 390, 844, 1], ['430x932', 430, 932, 1],
    ['568x320', 568, 320, 1], ['667x375', 667, 375, 1], ['740x360', 740, 360, 1], ['844x390', 844, 390, 1], ['932x430', 932, 430, 1]],
  ipad: [['768x1024', 768, 1024, 1], ['1024x768i', 1024, 768, 1], ['820x1180', 820, 1180, 1], ['1180x820', 1180, 820, 1], ['1024x1366', 1024, 1366, 1], ['1366x1024', 1366, 1024, 1]],
  desk: [['1024x768', 1024, 768, 0], ['1280x800', 1280, 800, 0], ['1366x768', 1366, 768, 0], ['1440x900', 1440, 900, 0], ['1536x864', 1536, 864, 0], ['1920x1080', 1920, 1080, 0], ['2560x1080', 2560, 1080, 0], ['3440x1440', 3440, 1440, 0]],
  // browser zoom: a 1280 x 800 laptop at 150% and 200%, a 1920 x 1080 one at 175%
  zoom: [['1280@150', 853, 533, 0, 1.5], ['1280@200', 640, 400, 0, 2], ['1920@175', 1097, 617, 0, 1.75]],
};
SIZES.core = [SIZES.phone[0], SIZES.phone[2], SIZES.phone[6], SIZES.ipad[0], SIZES.desk[1], SIZES.desk[2]];
const LANGS = ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur'];
// Menu screens and their arguments; pop-ups are opened from Home through window.__modal.
const SCREENS = ['home', 'play', 'variants', 'variant:chess960', 'minis', 'club', 'journey', 'era:egypt', 'era:ming', 'learn', 'trainers', 'puzzles', 'training', 'progress', 'dojo', 'openings',
  'collection', 'profile', 'season', 'store'];
// Taps: open a screen, then tap each selector in turn and check what it opens (detail cards, the
// resign question, tool tips, the coach's answers). Written tap|screen|selector[|selector...].
const TAPS = ['tap|store|[data-item]', 'tap|store|#st-gate', 'tap|collection|[data-item]', 'tap|minis|[data-mini]',
  'tap|era:egypt|[data-stage]', 'tap|hud:game|#g-resign', 'tap|hud:game|#g-draw', 'tap|hud:game|#g-copy', 'tap|hud:game|#g-settings', 'tap|hud:game|#g-mode', 'tap|hud:game|#g-view',
  'tap|settings:play|.ck-i', 'tap|settings:look|.ck-i', 'tap|play|.ck-i', 'toasts'];
// In-game screens: the table is not drawn without WebGL, but the panels, clocks and bars around it are.
const HUDS = ['hud:game', 'hud:game-clock', 'hud:local', 'hud:lesson', 'hud:puzzle', 'hud:drill', 'hud:mini-tour', 'hud:mini-spotter', 'hud:mini-rush', 'hud:review', 'hud:xiangqi', 'hud:xqlesson', 'hud:rulebook', 'hud:won', 'hud:levelup'];
const MODALS = ['settings', 'settings:play', 'settings:coach', 'settings:sound', 'settings:look', 'settings:lang', 'settings:app', 'gate', 'pin', 'promo', 'eraDone:egypt', 'tale:egypt', 'labs', 'missions', 'profile', 'newGame', 'friend', 'world', 'glossary', 'coach', 'premium', 'opponent:0', 'opponent:3', 'levelUp', 'placement'];

const pick = (v, all) => (!v || v === 'all' ? all : v.split(','));
const sizes = (argv.sizes === 'all' ? ['phone', 'ipad', 'desk', 'zoom'] : (argv.sizes || 'core').split(',')).flatMap((k) => SIZES[k] || [SIZES.phone.concat(SIZES.ipad, SIZES.desk, SIZES.zoom).find((s) => s[0] === k)].filter(Boolean));
const langs = pick(argv.langs || 'en', LANGS);
const targets = pick(argv.screens, SCREENS.concat(HUDS, MODALS.map((m) => 'modal:' + m), TAPS));
const shots = argv.shots ? path.resolve(argv.shots) : null;
const jobs = +argv.jobs || 4;
const name = argv.name || 'Wolfeschlegelstein';   // the longest a name can be is 20 letters
if (shots) fs.mkdirSync(shots, { recursive: true });

// Runs in the page: every visible problem on screen right now.
function probe() {
  const W = innerWidth, H = innerHeight, out = [];
  const short = (el) => {
    if (!el || !el.tagName) return '?';
    let s = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].slice(0, 3).map((c) => '.' + c).join('');
    const p = el.parentElement;
    if (!el.id && p && p !== document.body) s = (p.id ? '#' + p.id : p.tagName.toLowerCase() + [...p.classList].slice(0, 2).map((c) => '.' + c).join('')) + '>' + s;
    return s;
  };
  const txt = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const shown = (el) => el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : el.offsetParent !== null;
  // The top layer: the newest open pop-up, else the page.
  const modals = [...document.querySelectorAll('#modals .modal, .modal, #rulebook')].filter(shown);
  const layer = modals.length ? modals[modals.length - 1] : null;
  const inLayer = (el) => !layer || layer.contains(el);
  // The menu bars stay put while the page scrolls under them: words passing under a bar are not a fault.
  const CHROME = '#topnav, #tabbar';
  const chrome = [...document.querySelectorAll(CHROME)].filter(shown).map((c) => c.getBoundingClientRect());
  const underChrome = (x, y) => chrome.some((c) => x >= c.left && x <= c.right && y >= c.top && y <= c.bottom);
  const rectOf = (el) => {
    const rs = [];
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1) rs.push(q); }
    if (!rs.length) return null;
    // words hidden past the element's own clipped box (an ellipsis) are not painted
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const o = el.getBoundingClientRect();
      for (let i = rs.length - 1; i >= 0; i--) {
        const q = rs[i], l = Math.max(q.left, o.left), r = Math.min(q.right, o.right), t = Math.max(q.top, o.top), b = Math.min(q.bottom, o.bottom);
        if (r - l < 1 || b - t < 1) rs.splice(i, 1); else rs[i] = { left: l, right: r, top: t, bottom: b, width: r - l, height: b - t };
      }
      if (!rs.length) return null;
    }
    return { left: Math.min(...rs.map((r) => r.left)), right: Math.max(...rs.map((r) => r.right)), top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)), rects: rs };
  };
  const se = document.scrollingElement;
  if (se.scrollWidth > W + 1) out.push({ k: 'hscroll', a: 'page', d: se.scrollWidth - W });
  // The box an element is really painted in: the window cut by every ancestor that clips.
  const clipBox = (el) => {
    let b = { left: 0, top: 0, right: W, bottom: H }, scroll = false, cut = null;
    const hard = { left: -1e6, top: -1e6, right: 1e6, bottom: 1e6 };   // cut by boxes that do not scroll
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (p === el && !(cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) continue;   // its own box only hides words when clamped
      if (cs.position === 'fixed') { /* still clips by its own overflow below */ }
      const ox = cs.overflowX, oy = cs.overflowY;
      if (ox !== 'visible' || oy !== 'visible') {
        const r = p.getBoundingClientRect();
        if (/auto|scroll/.test(ox + oy)) scroll = true;
        if (ox !== 'visible' && !/auto|scroll/.test(ox)) { if (r.left > b.left) { b.left = r.left; cut = p; } if (r.right < b.right) { b.right = r.right; cut = p; } hard.left = Math.max(hard.left, r.left); hard.right = Math.min(hard.right, r.right); }
        if (oy !== 'visible' && !/auto|scroll/.test(oy)) { if (r.top > b.top) { b.top = r.top; cut = p; } if (r.bottom < b.bottom) { b.bottom = r.bottom; cut = p; } hard.top = Math.max(hard.top, r.top); hard.bottom = Math.min(hard.bottom, r.bottom); }
        if (/auto|scroll/.test(ox) || /auto|scroll/.test(oy)) {   // past a scroller, the scroller decides
          b = { left: Math.max(b.left, r.left), right: Math.min(b.right, r.right), top: Math.max(b.top, r.top), bottom: Math.min(b.bottom, r.bottom) };
          break;
        }
      }
    }
    return { b, scroll, cut, hard };
  };
  const leaves = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (/^(SCRIPT|STYLE|svg|path|CANVAS|IMG|OPTION|TEMPLATE)$/i.test(el.tagName)) continue;
    if (!inLayer(el) || !shown(el)) continue;
    if (el.closest('#splash, [aria-hidden="true"], .sr, .sr-only, .visually-hidden')) continue;
    const r = rectOf(el); if (!r) continue;
    const cs = getComputedStyle(el);
    if (cs.clipPath === 'inset(50%)' || (r.right - r.left) < 2) continue;   // words kept only for screen readers
    leaves.push({ el, r, cs });
  }
  for (const { el, r, cs } of leaves) {
    const s = el.textContent.trim();
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+){1,4}$/.test(own) && !/\.(com|in|org|html|js|json|mp3)$/.test(own)) out.push({ k: 'rawkey', a: short(el), t: own });
    if (/\{[a-zA-Z]+\}|\bundefined\b|\bNaN\b|\[object/.test(own)) out.push({ k: 'rawkey', a: short(el), t: own.slice(0, 40) });
    if (parseFloat(cs.fontSize) < 10 && own.length > 1) out.push({ k: 'tiny', a: short(el), t: own.slice(0, 30), d: parseFloat(cs.fontSize) });
    const { b, scroll, hard } = clipBox(el);
    const over = Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom);
    const hOver = Math.max(hard.left - r.left, r.right - hard.right, hard.top - r.top, r.bottom - hard.bottom);
    const hVis = Math.min(r.right, hard.right) - Math.max(r.left, hard.left) > 0 && Math.min(r.bottom, hard.bottom) - Math.max(r.top, hard.top) > 0;
    if (scroll && hOver > 2 && hVis) {
      // cut by a box inside a scroller (a card on a scrolling page): scrolling does not bring it back
      let kind = 'clip';
      for (let p = el; p && p !== document.body; p = p.parentElement) { const c = getComputedStyle(p); if (c.textOverflow === 'ellipsis' || c.webkitLineClamp !== 'none' && c.webkitLineClamp) { kind = 'ellipsis'; break; } }
      out.push({ k: kind, a: short(el), t: s.slice(0, 40), d: Math.round(hOver) });
    }
    if (over > 2) {
      // Hidden past the edge of something that scrolls is not lost: the player can scroll to it.
      const vis = Math.min(r.right, b.right) - Math.max(r.left, b.left) > 0 && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 0;
      const offWin = r.left < -2 || r.right > W + 2;
      if (offWin && !scroll) out.push({ k: 'offscreen', a: short(el), t: s.slice(0, 40), d: Math.round(Math.max(-r.left, r.right - W)) });
      else if (!scroll && vis) {
        let kind = 'clip';
        for (let p = el; p && p !== document.body; p = p.parentElement) { const c = getComputedStyle(p); if (c.textOverflow === 'ellipsis' || c.webkitLineClamp !== 'none' && c.webkitLineClamp) { kind = 'ellipsis'; break; } }
        out.push({ k: kind, a: short(el), t: s.slice(0, 40), d: Math.round(over) });
      }
    }
    // an ellipsis that actually cuts
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push({ k: 'ellipsis', a: short(el), t: s.slice(0, 40), d: el.scrollWidth - el.clientWidth });
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 2) out.push({ k: 'ellipsis', a: short(el), t: s.slice(0, 40), d: el.scrollHeight - el.clientHeight });
    // something else painted over the words
    if (r.right > 0 && r.left < W && r.bottom > 0 && r.top < H) {
      const pts = [];
      for (const q of r.rects) for (const fx of [0.2, 0.5, 0.8]) pts.push([q.left + q.width * fx, q.top + q.height * 0.5]);
      let hit = 0, by = null;
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue;
        if (!el.closest(CHROME) && underChrome(x, y)) continue;
        const top = document.elementFromPoint(x, y);
        if (!top || top === el || el.contains(top) || top.contains(el)) continue;
        if (!el.closest(CHROME) && top.closest(CHROME)) continue;   // a bar's soft edge
        if (top.closest('label') && top.closest('label').contains(el)) continue;
        const tc = getComputedStyle(top);
        const clear = (tc.backgroundColor === 'rgba(0, 0, 0, 0)' || tc.backgroundColor === 'transparent') && tc.backgroundImage === 'none' && !top.textContent.trim() && !/IMG|CANVAS|svg|VIDEO/i.test(top.tagName) && !top.querySelector('img,svg,canvas');
        if (clear) continue;
        if (layer && !layer.contains(top) && top.closest('.modal')) continue;
        hit++; by = top;
      }
      if (hit >= 2) out.push({ k: 'covered', a: short(el), b: short(by), t: s.slice(0, 30) });
    }
  }
  // text on text
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const A = leaves[i], B = leaves[j];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    for (const p of A.r.rects) for (const q of B.r.rects) {
      const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      if (w > 3 && h > 3 && w * h > 0.15 * Math.min(p.width * p.height, q.width * q.height)) {
        // only if both are actually painted there
        const x = Math.max(p.left, q.left) + w / 2, y = Math.max(p.top, q.top) + h / 2;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (!!A.el.closest(CHROME) !== !!B.el.closest(CHROME) && underChrome(x, y)) continue;
        const stack = document.elementsFromPoint(x, y);
        const has = (el) => stack.some((s) => s === el || el.contains(s));
        const inside = (el) => { const c = clipBox(el).b; return x >= c.left && x <= c.right && y >= c.top && y <= c.bottom; };
        // words scrolling under a sticky heading are not a fault
        const stick = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === 'sticky') return n; return null; };
        if (stick(A.el) !== stick(B.el)) continue;
        if (has(A.el) && has(B.el) && inside(A.el) && inside(B.el)) { out.push({ k: 'overlap', a: short(A.el), b: short(B.el), t: A.el.textContent.trim().slice(0, 20) + ' / ' + B.el.textContent.trim().slice(0, 20) }); }
      }
    }
  }
  // controls
  for (const el of document.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]), select, [tabindex="0"]')) {
    if (!inLayer(el) || !shown(el)) continue;
    let r = el.getBoundingClientRect();
    if (el.matches('input[type=radio], input[type=checkbox]') && el.closest('label')) r = el.closest('label').getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.bottom < 0 || r.top > H) continue;
    if (Math.min(r.width, r.height) < 24) out.push({ k: 'tap', a: short(el), t: txt(el), d: Math.round(r.width) + 'x' + Math.round(r.height) });
    if ((r.left < -2 || r.right > W + 2) && !el.closest('#guide.edge')) { const { scroll } = clipBox(el); if (!scroll) out.push({ k: 'offscreen', a: short(el), t: txt(el), d: Math.round(Math.max(-r.left, r.right - W)) }); }
  }
  // Rooky's round face floats over the page: it must not sit on a button
  const face = document.querySelector('#guide:not(.off):not(.edge):not([hidden]) #gd-show');
  if (face && shown(face)) {
    const f = face.getBoundingClientRect(), cx = (f.left + f.right) / 2, cy = (f.top + f.bottom) / 2, rad = f.width / 2 - 2;
    for (const el of document.querySelectorAll('#screens button, #screens a[href], #screens input, #screens select, #screens [role=button], .modal button')) {
      if (!inLayer(el) || !shown(el) || face.contains(el)) continue;
      const r0 = el.getBoundingClientRect(), cb = clipBox(el).b;
      const r = { left: Math.max(r0.left, cb.left), right: Math.min(r0.right, cb.right), top: Math.max(r0.top, cb.top), bottom: Math.min(r0.bottom, cb.bottom) };
      r.width = r.right - r.left; r.height = r.bottom - r.top;
      if (r.width < 1 || r.height < 1) continue;
      const nx = Math.max(r.left, Math.min(cx, r.right)), ny = Math.max(r.top, Math.min(cy, r.bottom));
      const d = Math.hypot(nx - cx, ny - cy);
      // a big card that is a button can sit under him; small controls cannot
      if (d < rad - 3 && (r.width < 160 || r.height < 60)) out.push({ k: 'guide', a: short(el), t: txt(el), d: Math.round(rad - d) });
    }
  }
  for (const im of document.querySelectorAll('img')) if (inLayer(im) && shown(im) && im.complete && im.naturalWidth === 0 && im.getAttribute('src')) out.push({ k: 'img', a: short(im), t: (im.getAttribute('src') || '').slice(0, 40) });
  return out;
}

// Scroll every scroller of the top layer from top to bottom and probe each stop.
async function sweepScreen(p) {
  const found = [];
  const scrollers = await p.evaluate(() => {
    const modals = [...document.querySelectorAll('.modal')].filter((m) => m.offsetParent !== null || getComputedStyle(m).position === 'fixed');
    const root = modals.length ? modals[modals.length - 1] : document.getElementById('screens');
    const list = [];
    const cands = [root, ...root.querySelectorAll('*')];
    for (const el of cands) { const cs = getComputedStyle(el); if (/auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 80) list.push(el); }
    if (!list.length && document.scrollingElement.scrollHeight > innerHeight + 4) list.push(document.scrollingElement);
    list.forEach((el, i) => { el.dataset.sweep = i; });
    return list.map((el) => ({ h: el.clientHeight, sh: el.scrollHeight }));
  });
  const main = scrollers.length ? scrollers.reduce((a, b, i) => (b.sh > scrollers[a.i].sh ? { i } : a), { i: 0 }).i : -1;
  const steps = main < 0 ? 1 : Math.min(12, Math.ceil((scrollers[main].sh - scrollers[main].h) / (scrollers[main].h * 0.8)) + 1);
  for (let s = 0; s < steps; s++) {
    if (main >= 0) { await p.evaluate(([i, s]) => { const el = document.querySelector('[data-sweep="' + i + '"]'); if (el) el.scrollTop = s * el.clientHeight * 0.8; else document.scrollingElement.scrollTop = s * innerHeight * 0.8; }, [main, s]); await p.waitForTimeout(80);
      // on phones Rooky slides to the edge while the page scrolls and comes back once it settles
      if (await p.evaluate(() => { const g = document.getElementById('guide'); return !!g && g.classList.contains('edge'); })) await p.waitForTimeout(720); }
    const r = await p.evaluate(probe).catch((e) => [{ k: 'error', a: String(e).slice(0, 80) }]);
    r.forEach((x) => { x.stop = s; });
    found.push(...r);
  }
  return found;
}

async function open(p, target) {
  if (target.startsWith('tap|')) {
    const [, base, ...sels] = target.split('|');
    const err = await open(p, base.startsWith('settings') ? 'modal:' + base : base);
    if (err) return err;
    for (const sel of sels) {
      const e2 = await p.evaluate((sel) => {
        const top = [...document.querySelectorAll('#modals > *')].pop();
        const el = (top && top.querySelector(sel)) || [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length);
        if (!el) return 'nothing to tap: ' + sel;
        el.scrollIntoView({ block: 'center' }); el.click(); return null;
      }, sel);
      if (e2) return e2;
      await p.waitForTimeout(500);
    }
    await p.evaluate(() => { const ng = document.getElementById('nogl'); if (ng) ng.remove(); });
    return null;
  }
  if (target === 'toasts') {
    const err = await open(p, 'home');
    await p.evaluate(() => window.__modal.celebrate({ coins: 120, achievements: [{ id: 'beat-builder', name: 'Beat the Builder', xp: 150 }], unlocked: [], missions: [] }, true));
    await p.waitForTimeout(900);
    return err;
  }
  return p.evaluate(async (target) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelectorAll('#modals > *').forEach((m) => m.remove());
    const [kind, a, b] = target.split(':');
    try {
      if (kind === 'modal') {
        window.__go('home'); await wait(30);
        document.querySelectorAll('#modals > *').forEach((m) => m.remove());
        const M = window.__modal;
        if (a === 'settings') window.__settings(b);
        else if (a === 'premium') M.premium('The Premium coaches are waiting.');
        else if (a === 'opponent') M.opponent(+b);
        else if (a === 'rules') M.rules(b);
        else if (a === 'levelUp') M.levelUp(7, []);
        else if (a === 'placement') M.placement('home');
        else if (a === 'gate') M.gate('Ask a grown-up to open the store.', { always: true });
        else if (a === 'promo') M.promo(1, () => {});
        else if (a === 'eraDone' || a === 'tale') M[a](b, 0);
        else M[a]();
      } else if (kind === 'hud') {
        window.__go('home'); await wait(30);
        const W = 'w';
        if (a === 'game') window.__start({ mode: 'ai', level: 1, color: 'white', tc: 'none', fen: '' });
        else if (a === 'game-clock') window.__start({ mode: 'ai', level: 2, color: 'black', tc: '5+0', fen: '' });
        else if (a === 'local') window.__start({ mode: 'local', tc: '10+5', fen: '' });
        else if (a === 'lesson') { window.__go('learn'); await wait(30); window.__go('lesson', document.querySelector('[data-lesson]').dataset.lesson); }
        else if (a === 'puzzle') { window.__go('puzzles'); await wait(30); document.getElementById('z-rated').click(); }
        else if (a === 'drill') { window.__go('openings'); await wait(30); window.__go('drill', document.querySelector('[data-op]').dataset.op); }
        else if (a.startsWith('mini-')) window.__go('mini', { id: a.slice(5), level: 1 });
        else if (a === 'review') window.__go('review', { start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ucis: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'], side: 1, title: 'Truffle', level: 0, summary: true });
        else if (a === 'xiangqi') window.__modal.xq({ mode: 'ai', color: 'white', level: 0 });
        else if (a === 'xqlesson') window.__go('xqlesson');
        else if (a === 'rulebook' || a === 'won' || a === 'levelup') {
          window.__start({ mode: 'ai', level: 0, color: 'white', tc: 'none', fen: a === 'rulebook' ? '' : '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1' });
          await wait(150); document.querySelectorAll('#modals > *').forEach((m) => m.remove());
          if (a === 'rulebook') document.getElementById('g-rules').click();
          else { window.__hooks.onDrop(0, 56); await wait(3500); const ms = [...document.querySelectorAll('#modals > *')]; if (a === 'won') ms.slice(1).forEach((m) => m.remove()); }
          await wait(300);
          const ng = document.getElementById('nogl'); if (ng) ng.remove();
          document.querySelectorAll('.toast, #toasts > *').forEach((m) => m.remove());
          return null;
        }
        await wait(150);
        // the colour toss and "how to play" cards open first: the panels are what is checked here
        document.querySelectorAll('#modals > *').forEach((m) => m.remove());
      } else window.__go(kind, a);
    } catch (e) { return String(e); }
    await wait(250);
    if (kind !== 'modal' && kind !== 'home') document.querySelectorAll('#modals > *').forEach((m) => m.remove());
    // the placement offer and the daily bonus pop up over first screens: take them away
    if (kind !== 'modal') document.querySelectorAll('#modals > *').forEach((m) => m.remove());
    document.querySelectorAll('.toast, #toasts > *').forEach((m) => m.remove());
    // the notice for devices without 3D (this browser runs without it on purpose)
    const ng = document.getElementById('nogl'); if (ng) ng.remove();
    // Rooky's words show for a few seconds after each new line; check the page as it is after that
    const g = document.getElementById('guide'); if (g) g.classList.remove('open', 'speaking', 'pop');
    return null;
  }, target);
}

async function run() {
  const browser = await chromium.launch({ args: ['--disable-3d-apis'] });
  const combos = [];
  for (const lang of langs) for (const s of sizes) combos.push([lang, s]);
  const results = [];
  let next = 0;
  async function worker() {
    while (next < combos.length) {
      const [lang, [label, w, h, touch, zoom]] = combos[next++];
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: zoom || 1, isMobile: !!touch, hasTouch: !!touch, reducedMotion: 'reduce', locale: lang });
      const p = await ctx.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
      await p.addInitScript(([lang, name]) => {
        window.__SHOT = true;
        try { if (!localStorage.getItem('chacklate-chess:v2')) localStorage.setItem('chacklate-chess:v2', JSON.stringify({ settings: { lang, name, guide: true, music: false, sfx: false } })); } catch (e) { /* first run */ }
      }, [lang, name]);
      await p.goto('file://' + file);
      await p.waitForFunction(() => window.__go && window.__modal, null, { timeout: 30000 });
      await p.evaluate(() => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important;caret-color:transparent!important}'; document.head.appendChild(st); });
      await p.waitForTimeout(400);
      for (const target of targets) {
        const err = await open(p, target);
        if (err) { results.push({ lang, size: label, target, k: 'error', a: err }); continue; }
        const found = await sweepScreen(p);
        found.forEach((f) => results.push(Object.assign({ lang, size: label, target }, f)));
        if (shots && (lang === 'en' || found.some((f) => f.k !== 'tap' && f.k !== 'ellipsis'))) {
          await p.evaluate(() => { for (const el of document.querySelectorAll('[data-sweep]')) el.scrollTop = 0; document.scrollingElement.scrollTop = 0; });
          await p.screenshot({ path: path.join(shots, [target.replace(/:/g, '-'), label.replace('@', 'z'), lang].join('_') + '.jpg'), quality: 70 });
        }
      }
      errors.forEach((e) => results.push({ lang, size: label, target: '-', k: 'pageerror', a: e }));
      process.stdout.write('.');
      await ctx.close();
    }
  }
  await Promise.all(Array.from({ length: jobs }, worker));
  await browser.close();
  return results;
}

run().then((results) => {
  const outFile = path.join(shots || require('os').tmpdir(), 'layout-sweep.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
  // one line per distinct problem
  const groups = new Map();
  for (const r of results) {
    const key = [r.k, r.target, r.a, r.b || ''].join(' | ');
    if (!groups.has(key)) groups.set(key, { r, sizes: new Set(), langs: new Set(), n: 0 });
    const g = groups.get(key); g.sizes.add(r.size); g.langs.add(r.lang); g.n++;
  }
  const order = ['pageerror', 'error', 'hscroll', 'offscreen', 'overlap', 'covered', 'guide', 'clip', 'rawkey', 'img', 'tiny', 'tap', 'ellipsis'];
  const rows = [...groups.values()].sort((a, b) => order.indexOf(a.r.k) - order.indexOf(b.r.k) || a.r.target.localeCompare(b.r.target));
  console.log('\n' + results.length + ' findings, ' + rows.length + ' distinct. Report: ' + outFile);
  for (const g of rows) console.log([g.r.k.padEnd(9), g.r.target.padEnd(18), g.r.a, g.r.b ? '<- ' + g.r.b : '', JSON.stringify(g.r.t || ''), g.r.d !== undefined ? '(' + g.r.d + ')' : '', '@', [...g.sizes].join(','), [...g.langs].join(',')].join(' '));
  if (argv.strict && rows.some((g) => !['tap', 'ellipsis', 'tiny'].includes(g.r.k))) process.exitCode = 1;
});
