// Languages, the way Jong Club runs them: every string a player reads goes through t(key, vars).
// The strings live in packages/content/i18n/, one file per area (home, play, store, settings,
// tips...), each key holding every language side by side so a gap is easy to spot;
// test/i18n.test.js fails when any language misses a key. The file name is the key's first part:
// t("home.play") reads "play" from home.json. {name} in a string is filled from vars.
// Lessons and the narrator stay in English for now.
const ChacklateI18n = (function () {
  'use strict';
  // dir: 'rtl' languages flip the page. script picks the fonts; non-Latin scripts drop
  // letter-spacing and all caps (see html[data-script] in shell.html).
  const LANGS = [
    { id: 'en', name: 'English', native: 'English', dir: 'ltr', script: 'latin', locale: 'en-IN' },
    { id: 'hi', name: 'Hindi', native: 'हिन्दी', dir: 'ltr', script: 'deva', locale: 'hi-IN' },
  ];
  const STRINGS = typeof CHACKLATE_STRINGS !== 'undefined' ? CHACKLATE_STRINGS : {};
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
  function t(key, vars) {
    const e = entry(key);
    if (!e) return key;
    return fill(e[lang.id] !== undefined ? e[lang.id] : e.en, vars);
  }
  const has = (key) => !!entry(key);

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
    }
    listeners.forEach((f) => f(lang.id));
    return lang.id;
  }
  // Numbers and dates in the language's own style (Hindi keeps the digits children learn at school).
  const num = (n) => Number(n).toLocaleString(lang.locale);
  const date = (d, o) => d.toLocaleDateString(lang.locale, o);

  return {
    LANGS, t, has, set, guess, num, date,
    get lang() { return lang.id; },
    onChange(f) { listeners.push(f); },
    strings: STRINGS,
  };
})();
if (typeof module !== 'undefined') module.exports = ChacklateI18n;
