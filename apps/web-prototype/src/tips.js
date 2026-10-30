// Tooltips in the Jong Club style, shared by the game and the website.
// Any element with data-tip gets a gold-edged bubble after a short hover, on keyboard focus,
// and on a long press on touch screens (the press then does not count as a tap). A title
// attribute is moved to data-tip, so the browser's plain tooltip never shows as well. Icon-only
// buttons fall back to their aria-label, and `resolve(el)` can supply text for any element (it
// wins over a title and is asked again each time, so a tip can follow a setting's current value).
// Text written "Heading|details" shows the heading in small gold caps. `icon` is a small drawn
// (i) button for touch screens: a tap on it opens the tip of the row it sits in.
const ChacklateTips = (function () {
  const HOVER_MS = 260, PRESS_MS = 480, PRESS_SHOW_MS = 3200, SLOP = 10;
  const CSS =
    '.ck-tip{position:fixed;left:0;top:0;z-index:9999;max-width:min(300px,calc(100vw - 16px));padding:8px 14px 9px;' +
    'font:500 13px/1.42 var(--body,Jost,system-ui,sans-serif);color:#f7ede0;text-align:center;' +
    'background:linear-gradient(180deg,rgba(255,255,255,.05),transparent 40%),radial-gradient(120% 140% at 50% 0%,#3a1a12,#1a0d09 70%);' +
    'border:1px solid #c9963e;outline:1px solid rgba(232,194,122,.35);outline-offset:2px;' +
    'clip-path:polygon(6px 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0 calc(100% - 6px),0 6px);' +
    'box-shadow:0 10px 28px rgba(0,0,0,.5);pointer-events:none;opacity:0;transition:opacity .12s ease;text-wrap:pretty;white-space:pre-line}' +
    '.ck-tip.on{opacity:1}' +
    '.ck-tip::before{content:"";position:absolute;inset:3px;border:1px solid rgba(232,194,122,.28);clip-path:inherit;pointer-events:none}' +
    '.ck-tip b{display:block;font:600 11px/1.3 var(--caps,var(--body,sans-serif));letter-spacing:.16em;text-transform:uppercase;color:#e8c27a;margin-bottom:3px}' +
    '[data-tip]{-webkit-touch-callout:none}' +
    '.ck-i{display:inline-grid;place-items:center;width:30px;height:30px;margin:-6px -4px -6px 2px;padding:0;border:0;background:none;color:#e8c27a;opacity:.8;vertical-align:middle;cursor:pointer;flex:none}' +
    '.ck-i svg{width:17px;height:17px}' +
    '.toggle>.ck-i{margin-right:auto}' +
    '@media (hover:hover) and (pointer:fine){.ck-i{display:none}}' +
    '@media (prefers-reduced-motion:reduce){.ck-tip{transition:none}}';
  let bubble = null, cur = null, timer = 0, press = null, swallow = false, byFocus = false, downOpen = null, resolve = null, touched = -1e9;
  // Browsers send mouse events after a touch too; those must not open or close a tip.
  const mouse = (e) => e.pointerType !== 'touch' && !press && performance.now() - touched > 1000;

  function node() {
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.className = 'ck-tip';
    bubble.setAttribute('role', 'tooltip');
    bubble.hidden = true;
    document.body.appendChild(bubble);
    return bubble;
  }
  // The nearest element (from t upwards) that has a tip.
  function find(t) {
    for (let a = t && t.nodeType === 1 ? t : t && t.parentElement; a && a !== document.body; a = a.parentElement) {
      if (a.hasAttribute('data-no-tips')) return null;
      if (a.classList.contains('ck-i')) continue;
      let tip = (resolve && resolve(a)) || a.getAttribute('data-tip');
      if (tip === null) tip = a.getAttribute('title') || (a.tagName === 'BUTTON' && !a.textContent.trim() ? a.getAttribute('aria-label') : null);
      if (tip) a.setAttribute('data-tip', tip);
      a.removeAttribute('title');
      if (tip) return a;
    }
    return null;
  }
  function place(x, y, below) {
    const b = node(), r = b.getBoundingClientRect(), m = 8;
    let left = x - r.width / 2, top = below ? y + 12 : y - r.height - 12;
    if (top < m) top = y + 16;
    left = Math.max(m, Math.min(window.innerWidth - r.width - m, left));
    top = Math.max(m, Math.min(window.innerHeight - r.height - m, top));
    b.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
  }
  function show(el) {
    const text = el.getAttribute('data-tip');
    if (!text || !el.isConnected) return;
    const b = node();
    const k = text.indexOf('|');
    b.replaceChildren();
    if (k > 0) { const h = document.createElement('b'); h.textContent = text.slice(0, k); b.append(h, text.slice(k + 1)); }
    else b.textContent = text;
    b.hidden = false;
    const r = el.getBoundingClientRect();
    place(r.left + r.width / 2, r.top, false);
    if (r.top < b.offsetHeight + 24) place(r.left + r.width / 2, r.bottom, true);
    b.classList.add('on');
  }
  function hide() {
    clearTimeout(timer);
    cur = null;
    byFocus = false;
    if (bubble) { bubble.classList.remove('on'); bubble.hidden = true; }
  }

  function init(opts) {
    resolve = opts && opts.resolve || null;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    document.addEventListener('pointerover', (e) => {
      if (!mouse(e)) return;
      const el = find(e.target);
      if (el === cur) return;
      hide();
      if (el) { cur = el; timer = setTimeout(() => cur === el && show(el), HOVER_MS); }
    });
    document.addEventListener('pointerout', (e) => {
      if (mouse(e) && cur && !cur.contains(e.relatedTarget)) hide();
    });
    // Touch: hold a control to read its tip; letting go after that does not press it.
    document.addEventListener('pointerdown', (e) => {
      downOpen = bubble && !bubble.hidden ? cur : null;
      hide();
      swallow = false;
      if (e.pointerType !== 'touch') return;
      touched = performance.now();
      const el = find(e.target);
      if (!el) return;
      press = { el, id: e.pointerId, x: e.clientX, y: e.clientY, shown: false };
      timer = setTimeout(() => { if (press && press.el === el) { press.shown = true; cur = el; show(el); } }, PRESS_MS);
    }, true);
    document.addEventListener('pointermove', (e) => {
      if (press && e.pointerId === press.id && !press.shown && Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) { clearTimeout(timer); press = null; }
    }, true);
    const release = (e) => {
      if (!press || e.pointerId !== press.id) return;
      touched = performance.now();
      if (press.shown) { swallow = true; const el = press.el; timer = setTimeout(() => cur === el && hide(), PRESS_SHOW_MS); }
      else clearTimeout(timer);
      press = null;
    };
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    document.addEventListener('click', (e) => {
      if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); return; }
      const i = e.target.closest && e.target.closest('.ck-i');
      if (!i) return;
      // The (i) only opens or closes its row's tip; it never ticks the row's box.
      e.preventDefault(); e.stopPropagation();
      const el = find(i.parentElement), open = el && (downOpen === el || (cur === el && !bubble.hidden));
      hide();
      if (el && !open) { cur = el; show(el); timer = setTimeout(() => cur === el && hide(), PRESS_SHOW_MS + 1800); }
    }, true);
    document.addEventListener('contextmenu', (e) => { if (press || swallow) e.preventDefault(); }, true);
    document.addEventListener('focusin', (e) => {
      const el = find(e.target);
      if (el && e.target.matches(':focus-visible')) { hide(); cur = el; byFocus = true; show(el); }
    });
    document.addEventListener('focusout', () => { if (byFocus) hide(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
    // Scrolling moves the control away from its bubble; a tip still waiting to open stays.
    window.addEventListener('scroll', () => { if (bubble && !bubble.hidden) hide(); }, true);
  }
  const icon = '<button type="button" class="ck-i" aria-label="What does this do?"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5v.01"/></svg></button>';
  return { init, hide, icon };
})();

if (typeof module !== 'undefined') module.exports = ChacklateTips;
