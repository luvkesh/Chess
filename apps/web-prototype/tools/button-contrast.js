// Checks that every button style keeps readable text in every state (rest, hover, focus, active).
// Builds sample buttons inside each panel the game puts buttons in, forces each state through
// DevTools, and measures text contrast against the worst-case background stop.
// Usage: node tools/button-contrast.js [page.html] (default: dist/chackmate.html). Needs Playwright.
const path = require('path');
const { chromium } = require('playwright');

const page = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'chackmate.html'));
const MIN = 4.5;

// [panel classes, button markup] pairs. Panels are the containers that restyle buttons.
const PANELS = ['', 'parch', 'actionbar', 'product', 'choices', 'row', 'glass', 'emote-pop glass'];
const BUTTONS = ['btn', 'btn primary', 'btn gold', 'btn ruby', 'btn outline', 'btn ghost', 'btn warn', 'btn small', 'btn small gold', 'btn small ghost', 'btn primary small'];
const EXTRA = [
  ['', '<button class="round">R</button>'], ['', '<button class="backbtn">Back</button>'], ['', '<button class="prem-btn"><span>Premium</span></button>'],
  ['links', '<button>Play</button>'], ['links', '<button aria-current="page">Play</button>'],
  ['tabs', '<button>Tab</button>'], ['tabs', '<button aria-selected="true">Tab</button>'],
  ['cats', '<button>Cat</button>'], ['cats', '<button aria-selected="true">Cat</button>'],
  ['parch', '<div class="opts"><button>Option</button></div>'], ['promo glass', '<button><span>Queen</span></button>'],
  ['subnav', '<button>Sub</button>'], ['subnav', '<button aria-current="page">Sub</button>'],
];
const STATES = [[], ['hover'], ['focus', 'focus-visible'], ['hover', 'active'], ['hover', 'focus', 'focus-visible']];

(async () => {
  const browser = await chromium.launch({ args: ['--disable-3d-apis'] });
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.addInitScript(() => { window.__SHOT = true; });
  await p.goto('file://' + page);
  await p.waitForTimeout(800);
  const cases = [];
  for (const panel of PANELS) for (const b of BUTTONS) cases.push([panel, '<button class="' + b + '">Next</button>']);
  cases.push(...EXTRA);
  await p.evaluate((cases) => {
    const st = document.createElement('style');
    st.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.appendChild(st);
    const host = document.createElement('div');
    host.id = '__audit';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:#0d0806;padding:8px';
    cases.forEach(([panel, html], i) => {
      const wrap = document.createElement('div');
      wrap.className = panel;
      wrap.style.cssText = 'position:static;transform:none;display:flex;margin:4px;max-width:none';
      wrap.innerHTML = html;
      const b = wrap.querySelector('button');
      b.dataset.audit = i;
      b.dataset.label = (panel ? '.' + panel.replace(/ /g, '.') + ' ' : '') + html.replace(/>[^<]*</g, '><').slice(0, 70);
      host.appendChild(wrap);
    });
    document.body.appendChild(host);
  }, cases);

  const cdp = await p.context().newCDPSession(p);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-audit]' });
  const fails = [];
  for (const forced of STATES) {
    for (const nodeId of nodeIds) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: forced });
    const rows = await p.evaluate(() => {
      const parse = (s) => (s.match(/rgba?\([^)]*\)/g) || []).map((c) => { const n = c.match(/[\d.]+/g).map(Number); return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1]; });
      const over = (top, under) => top.map((v, i) => (i < 3 ? v * top[3] + under[i] * (1 - top[3]) : 1));
      // Every opaque background stop an element can show, painted over its ancestors.
      const bgs = (el) => {
        if (!el || el === document.documentElement) return [[13, 8, 6, 1]];
        const cs = getComputedStyle(el); const under = bgs(el.parentElement);
        let out = under.map((u) => over(parse(cs.backgroundColor)[0] || [0, 0, 0, 0], u));
        const stops = parse(cs.backgroundImage);
        if (stops.length) out = stops.flatMap((s) => out.map((u) => over(s, u)));
        return out;
      };
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      return [...document.querySelectorAll('[data-audit]')].map((b) => {
        const t = b.querySelector('span') || b;
        const under = bgs(b);
        const fg = parse(getComputedStyle(t).color)[0];
        const worst = Math.min(...under.map((u) => ratio(over(fg, u), u)));
        return { label: b.dataset.label, worst: Math.round(worst * 100) / 100 };
      });
    });
    for (const r of rows) if (r.worst < MIN) fails.push((forced.join('+') || 'rest').padEnd(22) + String(r.worst).padStart(6) + '  ' + r.label);
  }
  await browser.close();
  if (fails.length) { console.log(fails.length + ' button states under ' + MIN + ':1\n' + fails.join('\n')); process.exit(1); }
  console.log('All button states read at ' + MIN + ':1 or better (' + nodeIds.length + ' buttons x ' + STATES.length + ' states).');
})();
