// Chackmate's addresses: every menu, submenu and sub-screen has its own link, so the browser's
// Back and Forward buttons (and a mouse's side buttons) step through the game, a refresh stays on
// the same screen and a link opens exactly the screen it names.
//
// Links are English words that never change with the language ("/learn/forks"), and hold nothing
// about the player: no names, codes or game moves.
//
// Two ways to show them:
//   path  "https://example.com/learn/forks"  when the game is the top page on a web server that
//         sends the game for every game address (services/game-server does: GAME_ROUTES).
//   hash  "...chackmate.html#/learn/forks"   everywhere else: inside a frame (the claude.ai
//         preview), opened as a file, or served from a folder by a plain static server.
//
// This file only turns screens into links and back. app.js decides what each one opens.
const ChackmateRouter = (function () {
  // The first word of every game address. The server serves the game for each of them.
  const TOP = ['home', 'play', 'journey', 'learn', 'trainers', 'puzzles', 'training', 'collection', 'club', 'profile', 'store', 'season', 'settings'];
  const slug = (s) => String(s == null ? '' : s).toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  // the last part of a content id: "lesson.c03.l04.forks" -> "forks", "opening.ruy-lopez" -> "ruy-lopez"
  const tail = (id) => String(id).split('.').pop();

  function clean(path) {
    let p = String(path || '').split(/[?#]/)[0];
    try { p = decodeURIComponent(p); } catch (e) { /* keep as typed */ }
    return p.toLowerCase().split('/').filter(Boolean);
  }

  // ctx: the content the links are made of (see app.js routeContext and test/router.test.js)
  //   lessons [{ id }], trainers [id], eras [id], variants [id], openings [{ id, side }],
  //   minis [id], opponents [{ name, level }], cats [id], themes [id], settings [id], profile [id]
  function routes(ctx) {
    const lessonBySlug = {}, lessonSlug = {}, lessonParts = {};
    for (const l of ctx.lessons) { const s = slug(tail(l.id)); lessonBySlug[s] = l.id; lessonSlug[l.id] = s; if (l.parts) lessonParts[l.id] = l.parts; }
    const openingBySlug = {};
    for (const o of ctx.openings) openingBySlug[slug(tail(o.id))] = o.id;
    const oppBySlug = {};
    for (const o of ctx.opponents) oppBySlug[slug(o.name)] = o.level;
    const oppSlug = (lv) => { const o = ctx.opponents.find((x) => x.level === lv); return o ? slug(o.name) : null; };
    const themeBySlug = {};
    for (const th of ctx.themes) themeBySlug[slug(th)] = th;
    const has = (list, id) => list.indexOf(id) >= 0;
    const SET_SLUG = { lang: 'language' }, SET_ID = { language: 'lang' };
    const DAYS = { 7: '7-days', 30: '30-days', 0: 'all-time' }, DAYS_OF = { '7-days': 7, '30-days': 30, 'all-time': 0 };

    // A screen (go(name, arg) in app.js) -> its address. Screens whose arg cannot be written in a
    // link (a game review, a custom puzzle list) get the nearest address that can.
    function toPath(name, arg) {
      const a = arg && typeof arg === 'object' ? arg : {};
      switch (name) {
        case 'home': return '/home';
        case 'play': return '/play';
        case 'game': return '/play/game';
        case 'review': return '/play/review';
        case 'minis': return '/play/mini-games';
        case 'mini': return a.id ? '/play/mini-games/' + slug(a.id) : '/play/mini-games';
        case 'variants': return '/play/variations';
        case 'variant': return arg ? '/play/variations/' + slug(arg) : '/play/variations';
        case 'xiangqi': return '/play/variations/xiangqi/game';
        case 'xqlesson': return '/play/variations/xiangqi/lesson';
        case 'journey': return '/journey';
        case 'era': return arg ? '/journey/' + slug(arg) : '/journey';
        case 'learn': return '/learn';
        case 'trainers': return '/trainers';
        case 'trainer': return '/trainers/' + slug(arg);
        case 'puzzles': return '/puzzles';
        case 'training': return '/training';
        case 'progress': return '/training/progress' + (DAYS[arg] && arg !== 30 ? '/' + DAYS[arg] : '');
        case 'dojo': return '/training/endgames';
        case 'openings': return '/training/openings' + (arg === 'black' ? '/black' : '');
        case 'drill': return '/training/openings/' + slug(tail(arg));
        case 'collection': return '/collection' + (arg && has(ctx.cats, arg) ? '/' + arg : '');
        case 'club': return '/club';
        case 'profile': return '/profile' + (arg && has(ctx.profile, arg) ? '/' + arg : '');
        case 'season': return '/season';
        case 'store':
          if (arg === 'coins') return '/store/coins';
          if (typeof arg === 'string' && arg.startsWith('pass.')) return '/store/pass/' + slug(arg.slice(5));
          return '/store';
        case 'lesson':
          if (typeof arg === 'string') return lessonSlug[arg] ? '/learn/' + lessonSlug[arg] : '/learn';
          if (a.trainer) return '/trainers/' + slug(a.trainer);
          if (a.placement) return '/learn/placement-test';
          if (a.variant) return '/play/variations/' + slug(a.variant) + '/lesson';
          if (a.journey) return '/journey/' + slug(a.journey.era) + '/stage-' + (a.journey.stage + 1);
          if (a.id && a.back === 'trainers') return '/trainers/' + lessonSlug[a.id] + '/lesson';
          // a lesson in parts (the three phases of chess): each part has its own page
          if (a.id && a.part && (lessonParts[a.id] || []).includes(a.part)) return '/learn/' + lessonSlug[a.id] + '/' + a.part;
          if (a.id && lessonSlug[a.id]) return '/learn/' + lessonSlug[a.id];
          return '/learn';
        case 'puzzle':
          if (a.journey) return '/journey/' + slug(a.journey.era) + '/stage-' + (a.journey.stage + 1);
          if (a.daily) return '/puzzles/daily';
          if (a.mate) return '/puzzles/mate-in-' + a.mate;
          if (a.theme) return '/puzzles/' + slug(a.theme);
          if (a.rated) return '/puzzles/rated';
          return '/puzzles';
        default: return '/home';
      }
    }
    // Pop-ups that are menus of their own.
    function modalPath(kind, arg) {
      switch (kind) {
        case 'friend': return '/play/friend';
        case 'world': return '/play/world';
        case 'custom': return '/play/custom';
        case 'opponent': { const s = oppSlug(arg); return s ? '/play/opponents/' + s : '/play'; }
        case 'settings': return '/settings' + (arg && arg !== 'play' ? '/' + (SET_SLUG[arg] || arg) : '');
        default: return null;
      }
    }

    // An address -> what it opens: { name, arg } a screen; { name, arg, modal: { kind, arg } } a
    // screen with a menu open over it; { action } something that starts (Quick Play). `spec` is
    // set where app.js has to build the real arg (a puzzle list, a lesson that needs a check).
    // Unknown addresses give null, and the game opens Home.
    function fromPath(path) {
      const p = clean(path);
      const [a, b, c, d] = p;
      const screen = (name, arg, extra) => Object.assign({ name, arg }, extra || {});
      if (!a || a === 'home') return p.length <= 1 ? screen('home') : null;
      switch (a) {
        case 'play':
          if (!b) return screen('play');
          if (p.length === 2 && (b === 'friend' || b === 'world' || b === 'custom')) return screen('play', undefined, { modal: { kind: b } });
          if (b === 'quick' && !c) return { action: 'quick' };
          if (b === 'opponents' && c && !d && c in oppBySlug) return screen('play', undefined, { modal: { kind: 'opponent', arg: oppBySlug[c] } });
          if (b === 'opponents' && !c) return screen('play');
          if (b === 'game' && !c) return screen('game');
          if (b === 'review' && !c) return screen('review');
          if (b === 'mini-games') {
            if (!c) return screen('minis');
            return has(ctx.minis, c) && !d ? screen('mini', { id: c }) : null;
          }
          if (b === 'variations') {
            if (!c) return screen('variants');
            if (!has(ctx.variants, c) || p.length > 4) return null;
            if (!d) return screen('variant', c);
            if (d === 'lesson') return c === 'xiangqi' ? screen('xqlesson') : screen('lesson', { variant: c });
            if (d === 'game' && c === 'xiangqi') return screen('xiangqi');
            return null;
          }
          return null;
        case 'journey':
          if (!b) return screen('journey');
          if (!has(ctx.eras, b) || p.length > 3) return null;
          if (!c) return screen('era', b);
          { const m = /^stage-(\d{1,2})$/.exec(c); return m && +m[1] > 0 ? screen('era', b, { spec: { stage: +m[1] - 1 } }) : null; }
        case 'learn':
          if (!b) return screen('learn');
          if (p.length === 3 && lessonBySlug[b] && (lessonParts[lessonBySlug[b]] || []).includes(c)) return screen('lesson', { id: lessonBySlug[b], part: c });
          if (p.length > 2) return null;
          if (b === 'placement-test') return screen('lesson', { placement: true, from: 'learn' });
          return lessonBySlug[b] ? screen('lesson', lessonBySlug[b]) : null;
        case 'trainers':
          if (!b) return screen('trainers');
          if (!has(ctx.trainers, b) || p.length > 3) return null;
          if (!c) return screen('lesson', { trainer: b });
          if (c === 'lesson' && lessonBySlug[b]) return screen('lesson', { id: lessonBySlug[b], back: 'trainers' });
          return null;
        case 'puzzles':
          if (!b) return screen('puzzles');
          if (p.length > 2) return null;
          if (b === 'daily') return screen('puzzle', undefined, { spec: { daily: true } });
          if (b === 'rated') return screen('puzzle', undefined, { spec: { rated: true } });
          { const m = /^mate-in-([1-5])$/.exec(b); if (m) return screen('puzzle', undefined, { spec: { mate: +m[1] } }); }
          return themeBySlug[b] ? screen('puzzle', undefined, { spec: { theme: themeBySlug[b] } }) : null;
        case 'training':
          if (!b) return screen('training');
          if (b === 'progress') { if (!c) return screen('progress'); return c in DAYS_OF && !d ? screen('progress', DAYS_OF[c]) : null; }
          if (b === 'endgames') return c ? null : screen('dojo');
          if (b === 'openings') {
            if (!c) return screen('openings', 'white');
            if (d) return null;
            if (c === 'white' || c === 'black') return screen('openings', c);
            return openingBySlug[c] ? screen('drill', openingBySlug[c]) : null;
          }
          return null;
        case 'collection':
          if (!b) return screen('collection');
          return has(ctx.cats, b) && !c ? screen('collection', b) : null;
        case 'profile':
          if (!b) return screen('profile');
          return has(ctx.profile, b) && !c ? screen('profile', b) : null;
        case 'store':
          if (!b) return screen('store');
          if (b === 'coins' && !c) return screen('store', 'coins');
          if (b === 'pass' && c && !d) return screen('store', 'pass.' + c);
          return null;
        case 'club': return b ? null : screen('club');
        case 'season': return b ? null : screen('season');
        case 'settings': {
          if (p.length > 2) return null;
          const sec = b ? (SET_ID[b] || b) : 'play';
          return has(ctx.settings, sec) ? screen('home', undefined, { modal: { kind: 'settings', arg: sec }, over: true }) : null;
        }
        default: return null;
      }
    }
    return { toPath, modalPath, fromPath };
  }

  // Which way to write links here. `win` is the window (or a stand-in in the tests).
  function mode(win) {
    const loc = win.location;
    let framed = true;
    try { framed = win.self !== win.top; } catch (e) { framed = true; }
    if (framed || !/^https?:$/.test(loc.protocol)) return 'hash';
    const first = clean(loc.pathname)[0];
    // A real game address (or the bare site root on a host that serves only the game). A file
    // path such as /dist/chackmate.html means a plain static server: links go after the #.
    if (!first || TOP.indexOf(first) >= 0) return 'path';
    return 'hash';
  }
  // The game address in the bar now, whichever way links are written.
  function current(win, how) {
    if (how === 'path') return win.location.pathname;
    const h = win.location.hash || '';
    return h.startsWith('#/') ? h.slice(1) : '';
  }
  function href(win, how, path) {
    if (how === 'path') return path + win.location.search;
    return win.location.pathname + win.location.search + '#' + path;
  }

  return { TOP, slug, tail, routes, mode, current, href };
})();
if (typeof module !== 'undefined') module.exports = ChackmateRouter;
