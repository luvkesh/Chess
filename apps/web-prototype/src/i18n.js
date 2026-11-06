// Languages, the way Jong Club runs them: every string a player reads goes through t(key, vars).
// The strings live in packages/content/i18n/, one file per area (home, play, store, settings,
// tips...), each key holding every language side by side so a gap is easy to spot;
// test/i18n.test.js fails when any language misses a key. The file name is the key's first part:
// t("home.play") reads "play" from home.json. {name} in a string is filled from vars.
//
// Longer content (lessons, era stories, openings, rules, set stories, Rooky's pitches) keeps its
// English in the content files; packages/content/i18n/text/<lang>.json translates it, keyed by the
// English. text(en) looks a sentence up, and watch() translates any such text the page shows, so
// a screen that writes content straight from the content files still reads in the player's
// language. tools/i18n-text.js lists every content string; the test fails when one is missing.
const ChacklateI18n = (function () {
  'use strict';
  // dir: 'rtl' languages flip the page. script picks the fonts; non-Latin scripts drop
  // letter-spacing and all caps (see html[data-script] in shell.html). The ten most spoken
  // languages in the world. Digits stay the ones on the board's edge (a1 to h8) in every language.
  const ALL = [
    { id: 'en', name: 'English', native: 'English', dir: 'ltr', script: 'latin', locale: 'en-IN', speech: 'en-IN' },
    { id: 'zh', name: 'Chinese', native: '中文', dir: 'ltr', script: 'hans', locale: 'zh-CN', speech: 'zh-CN' },
    { id: 'hi', name: 'Hindi', native: 'हिन्दी', dir: 'ltr', script: 'deva', locale: 'hi-IN', speech: 'hi-IN' },
    { id: 'es', name: 'Spanish', native: 'Español', dir: 'ltr', script: 'latin', locale: 'es-ES', speech: 'es-ES' },
    { id: 'fr', name: 'French', native: 'Français', dir: 'ltr', script: 'latin', locale: 'fr-FR', speech: 'fr-FR' },
    { id: 'ar', name: 'Arabic', native: 'العربية', dir: 'rtl', script: 'arab', locale: 'ar-u-nu-latn', speech: 'ar-SA' },
    { id: 'bn', name: 'Bengali', native: 'বাংলা', dir: 'ltr', script: 'beng', locale: 'bn-u-nu-latn', speech: 'bn-IN' },
    { id: 'pt', name: 'Portuguese', native: 'Português', dir: 'ltr', script: 'latin', locale: 'pt-BR', speech: 'pt-BR' },
    { id: 'ru', name: 'Russian', native: 'Русский', dir: 'ltr', script: 'cyrl', locale: 'ru-RU', speech: 'ru-RU' },
    { id: 'ur', name: 'Urdu', native: 'اردو', dir: 'rtl', script: 'arab', locale: 'ur-u-nu-latn', speech: 'ur-PK' },
  ];
  // The languages on offer: a language joins once every string and content text is translated
  // (test/i18n.test.js checks each one listed here).
  const READY = ['en', 'hi'];
  const LANGS = ALL.filter((l) => READY.includes(l.id));
  const STRINGS = typeof CHACKLATE_STRINGS !== 'undefined' ? CHACKLATE_STRINGS : {};
  const TEXT = typeof CHACKLATE_TEXT !== 'undefined' ? CHACKLATE_TEXT : {};
  const FONTS = typeof CHACKLATE_SCRIPT_FONTS !== 'undefined' ? CHACKLATE_SCRIPT_FONTS : {};
  let lang = LANGS[0];
  const listeners = [];

  function entry(key) {
    const i = key.indexOf('.');
    const area = STRINGS[key.slice(0, i)];
    return area ? area[key.slice(i + 1)] : undefined;
  }
  function fill(s, vars) {
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k])) : s;
  }
  // A missing key shows the key itself, so it is found on screen; the test catches it first.
  // Words filled into a string (a lesson title, a set's tagline) often come straight from the
  // content files in English, so each one is looked up too; names and numbers pass unchanged.
  function t(key, vars) {
    const e = entry(key);
    if (!e) return key;
    if (vars && lang.id !== 'en') {
      const v = {};
      for (const k in vars) v[k] = typeof vars[k] === 'string' ? text(vars[k]) : vars[k];
      vars = v;
    }
    return fill(e[lang.id] !== undefined ? e[lang.id] : e.en, vars);
  }
  const has = (key) => !!entry(key);

  // English -> this language, from the content tables and every UI string (a content file often
  // repeats a UI line word for word). Built once per language, on first use.
  const tables = {};
  function table(id) {
    if (tables[id]) return tables[id];
    const m = new Map();
    for (const area of Object.values(STRINGS)) for (const e of Object.values(area)) if (e && e.en && e[id] && !/\{\w+\}/.test(e.en)) m.set(e.en, e[id]);
    for (const [en, s] of Object.entries(TEXT[id] || {})) m.set(en, s);
    return (tables[id] = m);
  }
  // A content string in the chosen language: the whole text, else sentence by sentence, else each
  // side of a " · " or ": " join. null when some part has no translation.
  function look(s, m) {
    if (m.has(s)) return m.get(s);
    const sn = /^(.+?[.!?])\s+(\S.*)$/.exec(s);
    if (sn) { const a = look(sn[1], m), b = a === null ? null : look(sn[2], m); if (a !== null && b !== null) return a + (lang.script === 'hans' ? '' : ' ') + b; }
    const j = /^(.+?)( · |: )(.+)$/.exec(s);
    if (j) { const a = look(j[1], m), b = a === null ? null : look(j[3], m); if (a !== null && b !== null) return a + j[2] + b; }
    return null;
  }
  function text(en, vars) {
    if (en === undefined || en === null) return en;
    let s = String(en);
    if (lang.id !== 'en' && /[A-Za-z]/.test(s)) {
      const k = s.replace(/\s+/g, ' ').trim();
      const w = look(k, table(lang.id));
      if (w !== null) s = w;
    }
    return fill(s, vars);
  }

  // Translates the content text a page writes straight from the content files, as it appears.
  // A text node or label that is exactly a known English string is swapped; anything else (the
  // UI, already translated by t(), names, numbers) is left alone. Marked [data-no-i18n] or
  // translate="no" is never touched.
  const ATTRS = ['aria-label', 'title', 'data-tip', 'placeholder'];
  let observer = null;
  function swapText(n) {
    const el = n.parentElement;
    if (!el || el.closest('script,style,[data-no-i18n],[translate="no"],input,textarea')) return;
    const s = n.data;
    if (!/[A-Za-z]{2}/.test(s)) return;
    const k = s.replace(/\s+/g, ' ').trim();
    const w = look(k, table(lang.id));
    if (w !== null && w !== k) n.data = s.replace(/\S[\s\S]*\S|\S/, w);
  }
  function swapAttrs(el) {
    if (el.closest('[data-no-i18n],[translate="no"]')) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v || !/[A-Za-z]{2}/.test(v)) continue;
      const w = look(v.replace(/\s+/g, ' ').trim(), table(lang.id));
      if (w !== null && w !== v) el.setAttribute(a, w);
    }
  }
  function sweep(root) {
    if (lang.id === 'en' || !root) return;
    if (root.nodeType === 3) return swapText(root);
    if (root.nodeType !== 1) return;
    if (root.hasAttribute && ATTRS.some((a) => root.hasAttribute(a))) swapAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) swapText(n); else if (ATTRS.some((a) => n.hasAttribute(a))) swapAttrs(n); }
  }
  function watch(root) {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver((ms) => {
      if (lang.id === 'en') return;
      for (const m of ms) {
        if (m.type === 'childList') m.addedNodes.forEach(sweep);
        else if (m.type === 'characterData') swapText(m.target);
        else if (m.type === 'attributes') swapAttrs(m.target);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    sweep(root);
  }

  // First run: the browser's language if we have it, else English.
  function guess(list) {
    for (const tag of list || []) {
      const id = String(tag || '').toLowerCase().split('-')[0];
      if (LANGS.some((l) => l.id === id)) return id;
    }
    return 'en';
  }
  const loaded = {};
  function loadFonts(script) {
    if (loaded[script] || !FONTS[script] || typeof document === 'undefined') return;
    loaded[script] = true;
    const st = document.createElement('style');
    st.dataset.script = script;
    st.textContent = FONTS[script];
    document.head.appendChild(st);
  }
  function set(id) {
    lang = LANGS.find((l) => l.id === id) || LANGS[0];
    if (typeof document !== 'undefined') {
      const h = document.documentElement;
      h.lang = lang.id;
      h.dir = lang.dir;
      h.dataset.script = lang.script;
      loadFonts(lang.script);
      // The page's own markup: data-t sets the text, data-t-aria the aria-label.
      document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
      document.querySelectorAll('[data-t-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
    }
    listeners.forEach((f) => f(lang.id));
    if (typeof document !== 'undefined' && observer) sweep(document.body);
    return lang.id;
  }
  // Numbers and dates in the language's own style, with the digits children see on the board.
  const num = (n) => Number(n).toLocaleString(lang.locale);
  const date = (d, o) => d.toLocaleDateString(lang.locale, o);

  return {
    LANGS, ALL, t, has, set, guess, num, date, text, watch,
    get lang() { return lang.id; },
    get info() { return lang; },
    // The full stop that ends a sentence in this language's script.
    get stop() { return { deva: '।', beng: '।', hans: '。' }[lang.script] || (lang.id === 'ur' ? '۔' : '.'); },
    onChange(f) { listeners.push(f); },
    strings: STRINGS,
  };
})();
if (typeof module !== 'undefined') module.exports = ChacklateI18n;
