// Chackmate app: the menus, the Journey Through Time, games against the animal
// opponents, the coach, lessons, puzzles, training, the collection and progression, wired to
// the 3D table, the engine workers and (when a server is reachable) online play.
(function () {
  'use strict';
  const E = ChacklateEngine();
  // The coach speaks the player's language (its sentences: i18n/coach.json). Rebuilt when that changes.
  const coachStrings = () => { const out = {}; const c = ChacklateI18n.strings.coach || {}; for (const k in c) out[k] = c[k][ChacklateI18n.lang] || c[k].en; return out; };
  let C = ChacklateCoach(E);
  const CATALOG = CHACKLATE_CATALOG, LESSONS = CHACKLATE_LESSONS, PUZZLES = CHACKLATE_PUZZLES;
  const OPENINGS = CHACKLATE_OPENINGS.openings, ENDGAMES = CHACKLATE_ENDGAMES.endgames;
  const STORE = CHACKLATE_STORE, CAMPAIGN = CHACKLATE_CAMPAIGN;
  const PG = ChacklateProgress(CATALOG, { seasons: CHACKLATE_SEASONS, missions: CHACKLATE_MISSIONS, campaign: CAMPAIGN });
  const AU = ChacklateAudio();
  const ART = ChacklateArt;
  const I18N = ChacklateI18n, t = I18N.t;
  const { WHITE, BLACK, LEVELS } = E;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // A plain end date rather than a countdown: no ticking clocks aimed at children.
  const seasonEnd = (s) => ChacklateI18n.date(new Date(s.ends + 'T00:00:00'), { day: 'numeric', month: 'short' });
  const STORE_KEY = 'chacklate-chess:v2';
  const VALUE = [0, 1, 3, 3, 5, 9, 0];
  const TYPE = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };
  const PIECE_NAME = new Proxy({}, { get: (o, k) => t('common.piece.' + k) });
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const REASON_TEXT = new Proxy({}, { get: (o, k) => (I18N.has('play.reason.' + k) ? t('play.reason.' + k) : undefined) });
  const I = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    learn: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    improve: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    collection: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 6 3-6M12 9v12"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    hint: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    draw: '<path d="M7 12h10M7 8h10M7 16h10"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    flip: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    cam: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    first: '<path d="M18 18l-6-6 6-6M6 6v12"/>', prev: '<path d="M15 18l-6-6 6-6"/>', next: '<path d="M9 18l6-6-6-6"/>', last: '<path d="M6 18l6-6-6-6M18 6v12"/>',
    play: '<path d="M6 4l14 8-14 8z"/>', speaker: '<path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    speakerOff: '<path d="M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>', replay: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>', down: '<path d="M6 9l6 6 6-6"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14.5c1 1.4 2.3 2 4 2s3-.6 4-2M9 9.5h.01M15 9.5h.01"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>', users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c1-4 3.5-6 7-6s6 2 7 6M16 4a4 4 0 0 1 0 8M22 21c-.6-2.6-2-4.4-4-5.3"/>',
    star: '<path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z"/>', trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H3a4 4 0 0 0 4 4M17 6h4a4 4 0 0 1-4 4"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>', crown: '<path d="M3 18h18M4 18L3 7l5 4 4-7 4 7 5-4-1 11"/>', target: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', season: '<path d="M12 2c3 4 6 6 6 11a6 6 0 0 1-12 0c0-5 3-7 6-11z"/><path d="M12 22v-6"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', check: '<path d="M20 6L9 17l-5-5"/>', refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15"/>',
    journey: '<path d="M6 2h12M6 22h12"/><path d="M7 2c0 5 5 6.5 5 10S7 17 7 22M17 2c0 5-5 6.5-5 10s5 5 5 10"/><path d="M9.5 19.5h5"/>',
    puzzle: '<path d="M4 8h3.5a2.5 2.5 0 1 1 5 0H16v3.5a2.5 2.5 0 1 1 0 5V20H4v-3.5a2.5 2.5 0 1 0 0-5z"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    musicOff: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M2 2l20 20"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    pawn: '<circle cx="12" cy="6.5" r="3"/><path d="M9.6 10h4.8M10.5 10l-1.5 8h6l-1.5-8M6.5 21h11l-1.5-3h-8z"/>',
    frame: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6"/>',
    sparkle: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    wave: '<path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0c1.5-2.4 3.2-3 5-2"/><path d="M2 17.5c2.5-3 5-3 7.5 0"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-6 1-9z"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1h-3"/><path d="M7 4a2 2 0 0 0-2 2v12a2 2 0 0 1-2 2h11a2 2 0 0 0 2-2V6a2 2 0 0 1 2-2"/><path d="M9 9h5M9 13h5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>',
    medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 3l2.5 6.2M15.5 3L13 9.2"/><path d="M12 12.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z"/>',
    swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8"/>',
  };
  const icon = (k, cls) => '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[k] || '') + '</svg>';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const netOn = () => !!(window.ChacklateNet && ChacklateNet.available());

  // ------------------------------------------------------------ characters
  // Eight animal opponents (one per engine level), Rooky the coach, and a champion in
  // every era of the journey. Portraits are drawn by art.js.
  const OPP = CAMPAIGN.opponents, COACH = CAMPAIGN.coach;
  const persona = (lv) => OPP[lv] || OPP[0];
  const species = (p) => (p.full || '').replace(p.name, '').trim().replace(/^the /, '');
  const face = (who, o) => ART.portraitUri(who.animal, Object.assign({ from: who.colors[0], to: who.colors[1] }, o || {}));
  const faceImg = (who, cls) => '<img class="portrait ' + (cls || '') + '" src="' + face(who) + '" alt="' + esc(who.full || who.name) + '">';
  const eraById = (id) => CAMPAIGN.eras.find((e) => e.id === id) || null;
  const eraCoach = (e) => Object.assign({}, e.coach, { colors: e.colors, era: e.id });
  // Who sits across the board in a computer game: an opponent, or an era's champion.
  const rival = (G) => (G.setup.rival || persona(G.setup.level));
  const whoKey = (who) => 'content.' + (who.era ? 'coach.' : 'opp.') + who.id + '.';
  const sayLine = (who, kind) => (who[kind] ? tx(whoKey(who) + kind, who[kind]) : t('play.say.' + kind));
  const fullName = (who) => tx(whoKey(who) + 'full', who.full || who.name);
  const oppFull = fullName;
  const oppBlurb = (o) => tx(whoKey(o) + 'blurb', o.blurb);
  const speciesName = (o) => tx(whoKey(o) + 'species', 'the ' + species(o));
  const bandName = (lv) => (LEVELS[lv].band === 'Strongest' ? t('play.strongest') : LEVELS[lv].band);
  const eraText = (e, f) => tx('content.era.' + e.id + '.' + f, e[f]);
  const eraName = (e) => eraText(e, 'name'), eraWhen = (e) => eraText(e, 'when');
  const stageTitle = (e, k) => tx('content.era.' + e.id + '.stage' + k, e.stages[k].title);

  // ------------------------------------------------------------ persistence
  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } })() || {};
  const state = {
    settings: Object.assign({ quality: 'high', animations: !reducedMotion, sfx: true, sfxVol: 0.8, music: true, musicVol: 0.35, narration: true, guide: true, voiceCoach: 'mira', voiceCalls: 'mira', announce: false, coach: 'normal', captureScenes: true,
      legal: true, turnBoard: true, view: 'player', evalBar: false, server: '', name: 'You', lang: I18N.guess(navigator.languages || [navigator.language]) }, saved.settings || {}),
    setup: Object.assign({ mode: 'ai', color: 'white', level: 1, tc: 'none', fen: '', personal: false }, saved.setup || {}),
    progress: PG.migrate(saved.progress),
    screen: 'home',
    screenArg: undefined,
    game: null,
    account: saved.account || null,
  };
  // Premium comes from the account's entitlements on the server. The device-only preview switch
  // (for testing without a server) sits on top of that.
  if (state.settings.previewPremium === undefined) state.settings.previewPremium = !!state.progress.premium;
  function setEntitlements(ent) {
    if (state.account || ent) state.account = Object.assign({}, state.account || {}, { ent: ent || null });
    const e = ent || {};
    state.progress.premium = !!(state.settings.previewPremium || e.premium);
    state.progress.passes = e.passes || [];
  }
  setEntitlements(state.account && state.account.ent);
  // Languages: Hindi brings Priya for the game calls (check, results); the coach voice stays as chosen.
  const CALLS_DEFAULT = 'mira';
  const callsFor = (lang, cur) => (cur === 'off' ? cur : lang === 'hi' ? 'priya' : AU.voices().some((v) => v.id === cur && v.lang === 'en') ? cur : CALLS_DEFAULT);
  if (!(saved.settings && saved.settings.lang)) state.settings.voiceCalls = callsFor(state.settings.lang, state.settings.voiceCalls);
  I18N.set(state.settings.lang);
  if (I18N.lang !== 'en') C = ChacklateCoach(E, coachStrings());
  const myName = () => (state.settings.name === 'You' ? t('common.you') : state.settings.name);
  // Names and lines from the content files (eras, the animal friends, missions) are English there;
  // i18n/content.json holds the other languages, and the test keeps its English in step.
  const tx = (key, en) => (I18N.lang !== 'en' && I18N.has(key) ? t(key) : en);
  const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const levelTitle = (lv) => tx('content.title.' + slug(lv.title), lv.title);
  const achName = (a) => tx('content.ach.' + a.id + '.name', a.name), achDesc = (a) => tx('content.ach.' + a.id + '.desc', a.desc);
  const missionText = (m) => tx('content.mission.' + m.id, m.text);
  const seasonName = (s) => tx('content.season.' + s.id + '.name', s.name);
  // What unlocks an item, as progress.js words it, in the player's language.
  function unlockText(item) {
    const u = item.unlock;
    if (u.type === 'level') return t('collection.unlock.level', { n: u.level });
    if (u.type === 'achievement') { const a = PG.ACHIEVEMENTS.find((x) => x.id === u.achievement); return t('collection.unlock.achievement', { name: a ? achName(a) : u.achievement }); }
    if (u.type === 'premium') return t('common.premium');
    if (u.type === 'season') { const s = PG.SEASONS.seasons.find((x) => x.id === u.season); return t('collection.unlock.season', { name: s ? seasonName(s) : t('season.eyebrow'), n: u.tier }) + (u.track === 'pass' ? ' · ' + t('season.pass') : ''); }
    if (u.type === 'journey') { const e = eraById(u.era); return t('collection.unlock.journey', { era: e ? eraName(e) : u.era }) + (e && e.access === 'premium' ? ' · ' + t('common.premium') : ''); }
    return t('collection.unlock.free');
  }
  PG.setSeason(state.progress);
  function save() {
    try {
      const g = state.game && state.game.kind !== 'online' && !state.game.g.outcome ? state.game : null;
      localStorage.setItem(STORE_KEY, JSON.stringify({ settings: state.settings, setup: state.setup, progress: state.progress, account: state.account,
        game: g ? { start: g.g.startFen, moves: g.g.uciMoves(), human: g.human, kind: g.kind, setup: g.setup, clock: g.clock ? { w: g.clock.w, b: g.clock.b, inc: g.clock.inc } : null } : null }));
    } catch (e) { /* storage unavailable: everything still works for this visit */ }
    if (window.ChacklateNet) ChacklateNet.syncProgress();
  }

  // ------------------------------------------------------------ children's safety
  // The server says what this account may do (see services/game-server/src/family.js); null
  // means no server, which is offline play with nothing to buy or share.
  let safety = null;
  function setSafety(s) {
    safety = s || null;
    if (safety && !safety.reminders && state.settings.reminder && state.settings.reminder.on) { state.settings.reminder = Object.assign({}, state.settings.reminder, { on: false }); save(); }
    checkPlayTime();
    if (['store', 'home'].includes(state.screen) && !document.querySelector('.modal')) go(state.screen);
  }
  const isMinor = () => !!(safety && safety.kind === 'minor');

  // Parent gate: a sum written in words, which a young child cannot read and an adult answers in
  // a second. It sits in front of the store, purchases and turning reminders on, as Apple's Kids
  // category and Google's Families policy ask. A pass lasts ten minutes.
  const WORDS = (n) => t('store.gate.n' + n);
  let gatePassed = 0;
  function parentGate(why) {
    if (Date.now() - gatePassed < 10 * 60e3) return Promise.resolve(true);
    return new Promise((resolve) => {
      const a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
      let done = false;
      const m = modal('<div class="eyebrow">' + t('store.gate.eyebrow') + '</div><h2>' + t('store.gate.title') + '</h2><p class="sub">' + esc(why) + '</p>' +
        '<form id="pg"><div class="field"><label for="pg-a">' + t('store.gate.question', { a: WORDS(a), b: WORDS(b) }) + '</label><input class="text-in" id="pg-a" inputmode="numeric" autocomplete="off" maxlength="3" required></div>' +
        '<div class="row"><button class="btn" type="button" data-close>' + t('common.cancel') + '</button><button class="btn primary" type="submit">' + t('common.continue') + '</button></div></form>',
      { onClose() { if (!done) resolve(false); } });
      m.querySelector('#pg').onsubmit = (e) => {
        e.preventDefault();
        done = true; m.close();
        if (+m.querySelector('#pg-a').value === a * b) { gatePassed = Date.now(); resolve(true); }
        else { toast(t('store.gate.wrong'), 'bad'); resolve(false); }
      };
    });
  }
  function askPin() {
    return new Promise((resolve) => {
      let done = false;
      const m = modal('<div class="eyebrow">' + t('store.pin.eyebrow') + '</div><h2>' + t('store.pin.title') + '</h2><p class="sub">' + t('store.pin.sub') + '</p>' +
        '<form id="pp"><div class="field"><label for="pp-pin">' + t('store.pin.label') + '</label><input class="text-in" id="pp-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" required></div>' +
        '<div class="row"><button class="btn" type="button" data-close>' + t('common.cancel') + '</button><button class="btn gold" type="submit">' + t('store.pin.approve') + '</button></div></form>',
      { onClose() { if (!done) resolve(null); } });
      m.querySelector('#pp').onsubmit = (e) => { e.preventDefault(); done = true; const v = m.querySelector('#pp-pin').value; m.close(); resolve(v); };
    });
  }

  // Daily time limit a parent can set. Counts minutes with the page visible, per local day.
  const PLAY_KEY = 'chacklate-chess:playtime';
  const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function playTime() {
    let pt = null; try { pt = JSON.parse(localStorage.getItem(PLAY_KEY) || 'null'); } catch (e) { pt = null; }
    return pt && pt.day === localDay() ? pt : { day: localDay(), ms: 0, extra: 0 };
  }
  let breakModal = null;
  function checkPlayTime() {
    const lim = safety && safety.dailyMinutes;
    if (!lim) { if (breakModal) { breakModal.close(); breakModal = null; } return; }
    const pt = playTime();
    if (pt.ms < (lim + pt.extra) * 60e3 || breakModal) return;
    if (state.game && state.game.kind === 'online' && !state.game.g.outcome) return; // let the game finish
    breakModal = modal('<div class="result-hero">' + faceImg(COACH) + '<span class="result-badge">' + t('home.break.badge') + '</span><h2 class="result-title">' + t('home.break.title') + '</h2>' +
      '<p class="sub">' + t('home.break.sub', { n: lim }) + '</p>' +
      '<div class="row" style="justify-content:center"><button class="btn" id="br-more">' + t('home.break.more') + '</button></div></div>', { sticky: true, onClose() { breakModal = null; } });
    breakModal.querySelector('#br-more').onclick = async () => {
      const m = breakModal; m.style.visibility = 'hidden';
      if (await parentGate(t('home.break.gate'))) {
        const t2 = playTime(); t2.extra += 15; try { localStorage.setItem(PLAY_KEY, JSON.stringify(t2)); } catch (e) { /* not stored */ }
        breakModal = null; m.close();
      } else m.style.visibility = '';
    };
  }
  setInterval(() => {
    if (document.hidden || !(safety && safety.dailyMinutes)) return;
    const pt = playTime(); pt.ms += 30e3;
    try { localStorage.setItem(PLAY_KEY, JSON.stringify(pt)); } catch (e) { /* not stored */ }
    checkPlayTime();
  }, 30e3);

  // ------------------------------------------------------------ engine workers
  // Two workers: one plays and hints, one analyses (reviews, coach) so a long
  // review never delays the computer's move.
  function makeWorker() {
    try {
      const src = 'const E=(' + ChacklateEngine.toString() + ')();const C=(' + ChacklateCoach.toString() + ')(E,' + JSON.stringify(coachStrings()) + ');' +
        'onmessage=function(e){var d=e.data;try{var p=E.positionFrom(d.fen,d.moves);var r;' +
        'if(d.type==="search"){var s=E.search(p,d.opts);r={uci:s.move?E.uci(s.move):null,score:s.score,depth:s.depth};}' +
        'else if(d.type==="analyse"){var a=C.engineAnalyser({timeMs:d.timeMs||200})(p);r={cp:a.cp,mate:a.mate,best:a.best?E.uci(a.best):null,bestSan:a.best?p.san(a.best,p.legalMoves()):null};}' +
        'else if(d.type==="review"){r={review:C.review(d.fen,d.moves,{timeMs:d.timeMs||150},function(i,n){postMessage({id:d.id,progress:i/n});})};}' +
        'else if(d.type==="threat"){r={threat:C.threat(p,{timeMs:d.timeMs||250})};}' +
        'else if(d.type==="hint"){var b=E.search(p,{timeMs:d.timeMs||900});r={hint:b.move?C.hintLadder(p,b.move):null,uci:b.move?E.uci(b.move):null};}' +
        'else if(d.type==="line"){r={line:C.line(p,d.plies||5,d.timeMs||150)};}' +
        'r.id=d.id;postMessage(r);}catch(err){postMessage({id:d.id,error:String(err)});}};';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      const pending = new Map();
      w.onmessage = (e) => {
        const d = e.data, cb = pending.get(d.id);
        if (!cb) return;
        if (d.progress !== undefined) { if (cb.progress) cb.progress(d.progress); return; }
        pending.delete(d.id); cb.done(d);
      };
      w.onerror = () => { for (const cb of pending.values()) cb.done({ error: 'worker' }); pending.clear(); };
      return { w, pending };
    } catch (e) { return null; }
  }
  const workers = { play: makeWorker(), analysis: makeWorker() };
  // A new language: the coach and its workers start again with the new sentences.
  function coachLanguage() {
    C = ChacklateCoach(E, coachStrings());
    for (const k of Object.keys(workers)) {
      const old = workers[k];
      workers[k] = makeWorker();
      if (old) { for (const cb of old.pending.values()) cb.done({ error: 'worker' }); old.w.terminate(); }
    }
  }
  let reqId = 0;
  // Runs a job on a worker; falls back to the page if workers are unavailable.
  function job(which, msg, done, progress) {
    const id = ++reqId;
    const wk = workers[which];
    const m = Object.assign({ id }, msg);
    if (wk) { wk.pending.set(id, { done, progress }); wk.w.postMessage(m); }
    else setTimeout(() => {
      try {
        const p = E.positionFrom(m.fen, m.moves);
        let r;
        if (m.type === 'search') { const s = E.search(p, m.opts); r = { uci: s.move ? E.uci(s.move) : null, score: s.score }; }
        else if (m.type === 'analyse') { const a = C.engineAnalyser({ timeMs: m.timeMs || 200 })(p); r = { cp: a.cp, mate: a.mate, best: a.best ? E.uci(a.best) : null }; }
        else if (m.type === 'review') r = { review: C.review(m.fen, m.moves, { timeMs: Math.min(80, m.timeMs || 80) }) };
        else if (m.type === 'threat') r = { threat: C.threat(p, { timeMs: 150 }) };
        else if (m.type === 'hint') { const b = E.search(p, { timeMs: 500 }); r = { hint: b.move ? C.hintLadder(p, b.move) : null, uci: b.move ? E.uci(b.move) : null }; }
        else if (m.type === 'line') r = { line: C.line(p, m.plies || 5, 100) };
        r.id = id; done(r);
      } catch (err) { done({ id, error: String(err) }); }
    }, 30);
    return id;
  }

  // ------------------------------------------------------------------ tooltips
  // Hover (or hold on a touch screen) to read what a control does, in words a child knows.
  // Icon-only buttons fall back to their aria-label; everything else unclear is written here.
  const SETTINGS_TIP = 'Settings|Sound, music, graphics, voices and coaching.';
  const TIPS = {
    'nv-set': SETTINGS_TIP, 'g-settings': SETTINGS_TIP, 'rv-set': SETTINGS_TIP, 'ls-set': SETTINGS_TIP, 'dr-set': SETTINGS_TIP, 'pz-set': SETTINGS_TIP,
    'nv-music': 'Music|Turn the background music on or off.', 'g-music': 'Music|Turn the background music on or off.',
    'ls-voice': 'Narration|Hear Rooky read the lesson out loud.',
    'g-undo': 'Undo|Take back your last move and try a different one.',
    'g-hint': 'Hint|Rooky shows you a good move to think about.',
    'g-threat': 'Threat|See what your opponent would love to do next, so you can stop it.',
    'g-flip': 'Flip|Turn the board around to see it from the other side.',
    'g-view': 'Camera|Switch between looking down from above and sitting at the table.',
    'g-draw': 'Draw|Ask to end the game as a tie, with no winner.',
    'g-resign': 'Resign|Give up this game. Your opponent wins.',
    'g-emote': 'React|Send a friendly picture to the other player. There is no chat.',
    'g-claim': 'Claim a draw|The rules say this game can end as a tie right now. Tap to end it.',
    'g-copy': 'PGN|Copy every move of this game as text, to save it or share it with a grown-up.',
    'g-review': 'Review with Rooky|Rooky goes through your game and shows your best moves and your mistakes.',
    'rv-turn': 'Turning point|Jump to the move where the game changed the most.',
    'rv-best': 'Best line|Show the moves Rooky would have played here.',
    'rv-practice': 'Play from here|Start a new game from this exact position.',
    'pz-hint': 'Hint|Get a little clue.', 'ls-hint': 'Hint|Get a little clue.', 'dr-hint': 'Hint|See the next move of this opening.',
    'pz-sol': 'Solution|Show the answer to this puzzle.',
    'dr-reset': 'Restart|Go back to the start of this opening.',
    'l-review': 'Reviews|Quick refreshers of lessons you learned a while ago, so you never forget them.',
    'fr-create': 'Make a game|Get a 6-letter code. Your friend types it in to join you.',
    'fr-join': 'Join|Type the code your friend gave you, then join their game.',
    'fr-local': 'Take turns here|Play on this one device and pass it back and forth.',
    'w-go': 'Find a player|We look for someone, anywhere in the world, who picked the same clock.',
    'mu-eq': 'Equip|Use this in your games from now on.', 'pk-eq': 'Equip|Use this in your games from now on.',
    'st-restore': 'Restore purchases|Bring back things a grown-up already bought, for example on a new device.',
    's-reset': 'Reset progress|Start again from the beginning. Your stars, levels and rewards on this device are cleared.',
    'br-more': 'Only for grown-ups|Allow 15 more minutes of play today.',
    // settings switches (the tip sits on the whole row)
    's-anim': 'Pieces glide, sparkle and celebrate. Turn this off for a calmer, faster game.',
    's-cine': 'Short movie scenes when a piece is captured or a king castles.',
    's-sfxv': 'Slide to make sound effects louder or quieter. The switch turns them off.',
    's-musv': 'Slide to make the music louder or quieter. The switch turns it off.',
    's-narr': 'Rooky reads the stories and lessons out loud.',
    's-vcoach': 'The voice that reads lessons and stories.',
    's-vcalls': 'The voice that says “check”, game results and puzzle results.',
    's-announce': 'Hear every move said out loud, like “Knight to f3”.',
    's-coach': 'How often Rooky talks to you during a game.',
    's-eval': 'A bar beside the board that shows who is ahead. More white means White is doing better.',
    's-legal': 'Dots show every square the piece you picked can move to.',
    's-turn': 'When two players share a device, the board turns so each player sees it from their side.',
  };
  // The choice chips in the game setup windows, by radio name and value.
  const CHIP_TIPS = {
    'color:white': 'White|You make the first move.',
    'color:black': 'Black|Your opponent makes the first move.',
    'color:random': 'Surprise me|We pick White or Black for you.',
    'mode:ai': 'Play one of the animal friends on this device.',
    'mode:local': 'Two players share this device and take turns.',
    'q:high': 'The most beautiful tables. Uses more battery.',
    'q:low': 'Simpler pictures that run faster on older phones and tablets.',
  };
  // "3+2" means 3 minutes each, plus 2 seconds back on your clock after every move you make.
  function clockTip(tc) {
    if (!tc || tc === 'none') return 'No clock|Take as long as you like to think about every move.';
    const [m, inc] = tc.split('+').map(Number);
    const mins = m + (m === 1 ? ' minute' : ' minutes');
    return mins + (inc ? ' + ' + inc + ' seconds' : '') + '|Each player gets ' + mins + ' for the whole game. ' +
      (inc ? 'Every time you make a move, ' + inc + ' bonus seconds are added to your clock.' : 'No bonus time is added, so keep an eye on your clock!') +
      ' If your time runs out, you usually lose.';
  }
  function tipFor(el) {
    if (el.id && TIPS[el.id]) return TIPS[el.id];
    if (el.tagName === 'LABEL') {
      const r = el.querySelector('input[type=radio]');
      if (r) return /^(tc|wtc|frtc)$/.test(r.name) ? clockTip(r.value) : CHIP_TIPS[r.name + ':' + r.value] || null;
      if (el.classList.contains('toggle')) { const c = el.querySelector('input, select'); return c && TIPS[c.id] || null; }
    }
    if (el.classList.contains('clock') && el.dataset.side) {
      const inc = state.game ? +(String(state.game.setup.tc || '').split('+')[1] || 0) : 0;
      return 'Clock|Time left for this player. It only counts down on their turn.' + (inc ? ' They get ' + inc + ' bonus seconds after each move.' : '');
    }
    return null;
  }
  ChacklateTips.init({ resolve: tipFor });

  // ------------------------------------------------------------------ the 3D table
  const canvas = $('board');
  let view = null;
  const ctlHooks = { onSquare() {}, canDrag() { return false; }, onDrop() { return false; } };
  try {
    view = ChacklateScene(canvas, {
      onSquare: (sq, how) => ctlHooks.onSquare(sq, how),
      canDrag: (sq) => ctlHooks.canDrag(sq),
      onDrop: (f, t) => ctlHooks.onDrop(f, t),
      onContextLost() { $('nogl').hidden = false; },
      onContextRestored() { $('nogl').hidden = true; },
      onPerf: (level) => document.body.classList.toggle('lite', level >= 2),
      // the equipped look is built first, not the default one and then this one
      look: { room: PG.equipped(state.progress, 'room').data.room, board: PG.equipped(state.progress, 'board').data.board, set: PG.equipped(state.progress, 'pieces').data.set },
    });
  } catch (e) { console.error(e); view = null; }
  if (!view) { $('nogl').hidden = false; view = nullView(); }
  else if (view.perf) document.body.classList.toggle('lite', view.perf() >= 2);
  if (window.__SHOT) window.__view = view;   // screenshot tooling drives the table directly
  function nullView() {
    const noop = () => {};
    let sets = null;
    return { setBoard: noop, setHighlights: noop, setArrows: noop, setTheme: noop, setRoom: noop, setFx: noop, setCaptureEffects: noop, setQuality: noop, setAnimations: noop,
      setAttract: noop, setInsets: noop, setView: noop, setPaused: noop, intro: noop, celebrate: noop, setClock: noop, showcase: noop, setFullDetail: noop, setFocus: noop, stage: () => null, cancelDrag: noop, requestRender: noop, resize: noop,
      animateMove(info, done) { done(); }, snapshot: () => Promise.resolve(null), boards: () => ({}), rooms: () => ({}),
      sets() { if (!sets) { try { sets = ChacklatePieces(window.THREE, ChacklateKit(window.THREE)).list(); } catch (e) { sets = []; } } return sets; } };
  }
  function setHooks(h) { ctlHooks.onSquare = h.onSquare || (() => {}); ctlHooks.canDrag = h.canDrag || (() => false); ctlHooks.onDrop = h.onDrop || (() => false); }
  const setInfo = (id) => view.sets().find((s) => s.id === id) || null;

  function piecesOf(pos) {
    const out = [];
    for (let sq = 0; sq < 64; sq++) { const p = E.pieceAt(pos, sq); if (p) out.push([sq, p]); }
    return out;
  }
  function kingSquare(pos, side) {
    for (let sq = 0; sq < 64; sq++) if (E.pieceAt(pos, sq) === E.K * side) return sq;
    return -1;
  }
  const sqIndex = (name) => { const s = E.parseSq(name); return s < 0 ? -1 : E.to64(s); };
  const sqName = (sq64) => 'abcdefgh'[sq64 & 7] + (1 + (sq64 >> 3));

  // Cosmetics: whatever is equipped (or previewed) dresses the table. A journey game sets
  // its era's board, pieces and room for the length of the game.
  let preview = null, lookOverride = null, clockSkin = null;
  function applyLook() {
    const pick = (cat) => (preview && preview.category === cat ? preview : PG.equipped(state.progress, cat));
    const o = (preview ? null : lookOverride) || {};
    view.setTheme(o.board ? { board: o.board } : pick('board').data, o.set ? { set: o.set } : pick('pieces').data);
    const room = o.room ? { room: o.room } : pick('room').data;
    view.setRoom(room);
    AU.setMood(room.room);
    view.setFx({ capture: pick('capture').data, victory: pick('victory').data, trail: pick('trail').data });
    AU.setPack(pick('sound').data.pack);
    clockSkin = pick('clock').data;
  }
  function setLook(o) { lookOverride = o || null; applyLook(); }
  const equippedSet = () => (lookOverride && lookOverride.set) || PG.equipped(state.progress, 'pieces').data.set;
  function applySettings() {
    const s = state.settings;
    view.setQuality(s.quality);
    view.setAnimations(s.animations && !window.__SHOT);
    document.body.classList.toggle('lowfx', s.quality === 'low');
    AU.setSfx(s.sfx, s.sfxVol);
    AU.setMusic(s.music, s.musicVol);
    AU.setVoices({ coach: s.voiceCoach, calls: s.voiceCalls, announce: s.announce });
    applyLook();
  }

  // ------------------------------------------------------------------ menu art
  // 3D renders of real pieces for cards and the collection, drawn by the scene into images.
  // Each starts as a drawn medal and swaps to the render once it is ready.
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  // shown: [width, height] to show it at, when that differs from the size it is drawn at
  function snap(spec, w, h, fallback, cls, shown) {
    return '<img class="snap' + (cls ? ' ' + cls : '') + '" alt="" width="' + (shown ? shown[0] : w) + '" height="' + (shown ? shown[1] : h) + '" src="' + (fallback || BLANK) + '" data-snap="' + esc(JSON.stringify([spec, w, h])) + '">';
  }
  let snapObserver = null;
  function hydrate(root, lazy) {
    const imgs = [...(root || $('screens')).querySelectorAll('img[data-snap]')];
    const run = (img) => {
      if (!img.dataset.snap) return;
      const [spec, w, h] = JSON.parse(img.dataset.snap);
      delete img.dataset.snap;
      // small menu-card art doesn't need the full sculpt (and building it slows the first screen)
      if (w <= 240 && !spec.detail) spec.detail = 'play';
      const k = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
      view.snapshot(spec, Math.round(w * k), Math.round(h * k), () => img.isConnected).then((url) => {
        if (!url || !img.isConnected) return;
        // if the browser cannot show the picture, keep the drawn medal rather than a broken image
        const before = img.src;
        img.onerror = () => { img.onerror = null; img.src = before; };
        img.src = url; img.classList.add('in');
      });
    };
    if (!lazy || !('IntersectionObserver' in window)) { imgs.forEach(run); return; }
    if (snapObserver) snapObserver.disconnect();
    snapObserver = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { snapObserver.unobserve(en.target); run(en.target); } }), { rootMargin: '240px' });
    imgs.forEach((img) => snapObserver.observe(img));
  }
  // Little arrangements on a velvet plinth with a gold rim.
  const VIGN = {
    duo: (set) => ({ kind: 'vignette', felt: '#4a0f20', items: [{ set, type: 'k', side: 'w', x: -0.42, z: 0.06, rot: 0.35 }, { set, type: 'q', side: 'b', x: 0.44, z: -0.12, rot: -0.5 }] }),
    fork: (set) => ({ kind: 'vignette', felt: '#173a2a', sheen: '#6aa88a', items: [{ set, type: 'n', side: 'w', x: 0.04, z: 0.5, rot: -1.15 }, { set, type: 'k', side: 'b', x: -0.62, z: -0.4, rot: 0.3 }, { set, type: 'r', side: 'b', x: 0.66, z: -0.36, rot: -0.2 }] }),
    trio: (set, felt, sheen) => ({ kind: 'vignette', felt: felt || '#5c1428', sheen: sheen || '#b86a80', items: [{ set, type: 'q', side: 'b', x: -0.66, z: -0.2, rot: 0.45 }, { set, type: 'k', side: 'w', x: 0.02, z: 0.04, rot: 0.1 }, { set, type: 'n', side: 'w', x: 0.68, z: 0.2, rot: -1.25 }] }),
    endgame: (set) => ({ kind: 'vignette', felt: '#2a2440', sheen: '#9a8cc8', items: [{ set, type: 'k', side: 'w', x: -0.5, z: 0.05, rot: 0.3 }, { set, type: 'p', side: 'w', x: 0.12, z: 0.42 }, { set, type: 'k', side: 'b', x: 0.6, z: -0.42, rot: -0.4 }] }),
    opening: (set) => ({ kind: 'vignette', felt: '#14304a', sheen: '#7a9cc8', items: [{ set, type: 'p', side: 'w', x: -0.62, z: 0.3 }, { set, type: 'b', side: 'w', x: -0.05, z: -0.05, rot: 0.6 }, { set, type: 'n', side: 'w', x: 0.6, z: 0.24, rot: -1.2 }] }),
    review: (set) => ({ kind: 'vignette', felt: '#3a2414', sheen: '#c8a47a', items: [{ set, type: 'q', side: 'w', x: -0.4, z: 0.1, rot: 0.2 }, { set, type: 'k', side: 'b', x: 0.46, z: -0.08, tilt: 1.2, y: 0.36, rot: 0.6 }] }),
  };
  const medal = (art, from, to, o) => ART.medalUri(art, Object.assign({ from, to }, o || {}));
  const eraFelt = (e) => [ART.dim(e.colors[1], 0.15), e.colors[0]];
  function porthole(e, coach) {
    return '<span class="porthole"><img src="' + ART.bannerUri(e.landmark, { from: e.colors[0], to: e.colors[1] }) + '" alt=""></span>' +
      (coach === false ? '' : '<img class="portrait mini" src="' + face(eraCoach(e)) + '" alt="">');
  }
  // A glass card in the Jong Club manner: art, a gold caps title, a line, a round arrow.
  function lux(o) {
    return '<button class="lux h' + (o.feature ? ' feature' : '') + (o.locked ? ' locked' : '') + '" id="' + o.id + '"' + (o.disabled ? ' disabled' : '') + '>' +
      (o.tag ? '<span class="tag">' + o.tag + '</span>' : '') +
      '<div class="art">' + o.art + '</div><h3>' + esc(o.title) + '</h3><p>' + esc(o.text) + '</p><span class="go">' + icon(o.locked ? 'lock' : 'arrow') + '</span></button>';
  }
  const sec = (ic, title, extra) => '<h2 class="sec">' + icon(ic) + '<span>' + esc(title) + '</span>' + (extra ? '<small>' + extra + '</small>' : '') + '</h2>';
  const pageHead = (eyebrow, title, text, aside) => '<header class="ph"><div><div class="eyebrow">' + esc(eyebrow) + '</div><h1>' + esc(title) + '</h1>' + (text ? '<p>' + text + '</p>' : '') + '</div>' + (aside ? '<div class="aside">' + aside + '</div>' : '') + '</header>';
  const meter = (n, total, label) => '<div class="meter">' + icon('collection') + '<b><em>' + n + '</em> / ' + total + ' ' + esc(label) + '</b><div class="bar"><i style="width:' + Math.round(n / Math.max(1, total) * 100) + '%"></i></div></div>';

  // ------------------------------------------------------------------ toasts
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast glass' + (kind ? ' ' + kind : '');
    el.innerHTML = msg;
    $('toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'ach' ? 3600 : 2400);
  }
  // Show XP, level-ups, achievements and unlocks from a progress result.
  function celebrate(res, quiet) {
    if (!res) return;
    res.achievements.forEach((a, i) => setTimeout(() => {
      AU.play('achievement');
      toast('<i>★</i><div><small>' + t('home.toast.achievement') + '</small><b>' + esc(achName(a)) + '</b> · +' + t('common.xp', { n: a.xp }) + '</div>', 'ach');
    }, 600 + i * 900));
    const lag = 600 + res.achievements.length * 900;
    (res.missions || []).forEach((m, i) => setTimeout(() => {
      AU.play('achievement');
      toast('<i>✓</i><div><small>' + t('home.toast.mission') + '</small><b>' + esc(missionText(m)) + '</b> · +' + t('common.xp', { n: m.xp }) + '</div>', 'ach');
    }, lag + i * 900));
    if (res.missionsAll) setTimeout(() => toast(t('home.toast.allMissions', { n: CHACKLATE_MISSIONS.allDoneXp })), lag + (res.missions || []).length * 900);
    if (res.seasonTier && !res.levelUp) setTimeout(() => toast(t('home.toast.tier', { n: res.seasonTier })), lag + 300);
    if (res.levelUp) setTimeout(() => levelUpModal(res.levelUp, res.unlocked), lag + (res.missions || []).length * 900);
    else if (res.unlocked.length && !quiet) toast(t('home.toast.unlocked', { list: res.unlocked.map((u) => esc(u.name)).join(', ') }));
    save();
    renderNav();
  }

  // ------------------------------------------------------------------ modals
  function modal(html, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML = '<div class="card' + (opts.cls ? ' ' + opts.cls : '') + '">' + (opts.x ? '<button class="round sm x" data-close aria-label="' + t('common.close') + '">' + icon('x') + '</button>' : '') + html + '</div>';
    $('modals').appendChild(wrap);
    AU.play('open');
    const close = () => { wrap.remove(); if (opts.onClose) opts.onClose(); };
    wrap.addEventListener('click', (e) => {
      if ((e.target === wrap && !opts.sticky) || e.target.closest('[data-close]')) close();
    });
    const f = wrap.querySelector('[autofocus], .btn.primary, button:not(.x), input');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 30);
    wrap.close = close;
    return wrap;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.modal')].pop();
      if (open) open.close();
      else if (peeking) endPeek();
      else if (current && current.escape) current.escape();
    } else if (!document.querySelector('.modal') && current && current.key && !/input|textarea|select/i.test((e.target.tagName || ''))) current.key(e);
  });

  // ------------------------------------------------------------------ the audio guide
  // Built like the website's guided tour: one card in the corner. On every screen it says, in one or
  // two short sentences, what to do next. On an era page the era's friend says it; everywhere else
  // Rooky does. The card has Hear that again, the voice on or off, and hide (it tucks into the
  // portrait). The voice switch is the same one as story and lesson narration, so one tap quiets
  // every spoken line. Lines are recorded (packages/content/guide.json, public/guide/).
  const GUIDE = CHACKLATE_GUIDE;
  const GUIDE_WHO = { rooky: COACH };
  for (const e of CAMPAIGN.eras) GUIDE_WHO[e.coach.id] = eraCoach(e);
  const GUIDE_AGAIN = 120000;   // a screen's line is said again only after two minutes
  const guideSt = { key: null, said: {}, idle: null, run: 0 };
  function guideCard() {
    let el = $('guide');
    if (el.dataset.ready) return el;
    el.dataset.ready = '1';
    el.innerHTML = '<button class="narrator" id="gd-show" tabindex="-1" aria-label="' + t('common.guide.show') + '" title="' + t('common.guide.show') + '"><img alt=""></button>' +
      '<div class="gd-body"><div class="gd-head"><p class="eyebrow" id="gd-who"></p>' +
      '<button class="gd-btn" id="gd-again" aria-label="' + t('common.guide.again') + '" title="' + t('common.guide.again') + '">' + icon('replay') + '</button>' +
      '<button class="gd-btn" id="gd-voice"></button>' +
      '<button class="gd-btn" id="gd-hide" aria-label="' + t('common.guide.hide') + '" title="' + t('common.guide.hide') + '">' + icon('down') + '</button></div>' +
      '<p class="gd-text" id="gd-text"></p><p class="gd-extra" id="gd-extra"></p></div>';
    $('gd-again').onclick = () => { AU.unlock(); if (guideSt.key) { if (!state.settings.narration) setVoice(true, true); guideSay(guideSt.key, { force: true }); } };
    $('gd-voice').onclick = () => { AU.unlock(); setVoice(!state.settings.narration); };
    $('gd-hide').onclick = (e) => { e.stopPropagation(); state.settings.guide = false; save(); guideTuck(); };
    $('gd-show').onclick = () => { if (!state.settings.guide) { state.settings.guide = true; save(); guideTuck(); } };
    AU.onTalk((on) => el.classList.toggle('speaking', on));
    return el;
  }
  function guideTuck() {
    const el = guideCard();
    el.classList.toggle('tucked', !state.settings.guide);
    $('gd-show').tabIndex = state.settings.guide ? -1 : 0;
    applyInsets();
  }
  function voiceIcon(btn, who) {
    const on = !!state.settings.narration;
    btn.innerHTML = icon(on ? 'speaker' : 'speakerOff');
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', t(on ? 'common.voice.turnOff' : 'common.voice.turnOn'));
    btn.title = on ? t('common.voice.onTip') : t('common.voice.offTip', { who });
  }
  // The one voice switch: the guide, stories and lessons. Every button that shows it follows along.
  function setVoice(on, quiet) {
    state.settings.narration = !!on; save();
    if (!on) AU.hush();
    document.querySelectorAll('[data-voice]').forEach((b) => voiceIcon(b, b.dataset.voice));
    const el = guideCard();
    voiceIcon($('gd-voice'), (GUIDE_WHO[(GUIDE.lines[guideSt.key] || {}).who] || COACH).name);
    if (guideSt.key) guideShow(guideSt.key);
    if (on && !quiet && guideSt.key && !document.querySelector('.modal')) guideSay(guideSt.key, { force: true });
    return el;
  }
  function guideShow(key) {
    const line = GUIDE.lines[key], who = GUIDE_WHO[line.who] || COACH;
    const el = guideCard();
    el.hidden = false;
    $('gd-who').textContent = who.full || who.name;
    const img = el.querySelector('#gd-show img'); const src = face(who);
    if (img.getAttribute('src') !== src) img.src = src;
    // the caption is in the player's language; the recorded voice stays English for now
    $('gd-text').textContent = t('guide.' + key);
    $('gd-extra').textContent = !state.settings.narration ? t('common.guide.tapSpeaker', { who: who.name }) : AU.canTalk() ? '' : t('common.guide.tapAnywhere', { who: who.name });
    voiceIcon($('gd-voice'), who.name);
    if (guideSt.key !== key) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    guideSt.key = key;
    if (KIND[state.screen] === 'hud' && el.offsetHeight !== guideSt.h) { guideSt.h = el.offsetHeight; applyInsets(); }
  }
  // Show a line and say it. opts.force says it even if it was said a moment ago; opts.delay waits
  // first (to let a sound or a game call finish); opts.then runs once it has been said.
  function guideSay(key, opts) {
    opts = opts || {};
    if (!GUIDE.lines[key]) { if (opts.then) opts.then(); return; }
    const run = ++guideSt.run, screen = state.screen;
    const go = () => {
      if (run !== guideSt.run || state.screen !== screen) return;
      guideShow(key);
      const fresh = opts.force || !guideSt.said[key] || Date.now() - guideSt.said[key] > GUIDE_AGAIN;
      if (state.settings.narration && fresh && !AU.canTalk()) guideSt.pending = key;
      if (!state.settings.narration || !fresh || !AU.canTalk()) { if (opts.then) opts.then(); return; }
      guideSt.pending = null;
      guideSt.said[key] = Date.now();
      AU.guide(key, GUIDE.lines[key].text).then(() => { if (run === guideSt.run && opts.then) opts.then(); });
    };
    if (opts.delay) setTimeout(go, opts.delay); else go();
  }
  const guideFresh = (key) => !!state.settings.narration && (!guideSt.said[key] || Date.now() - guideSt.said[key] > GUIDE_AGAIN);
  // Browsers keep quiet until the first tap, so a line shown before then is said after it, unless
  // that tap moved on to another screen with its own line.
  document.addEventListener('click', (e) => {
    const key = guideSt.pending;
    if (!key) return;
    AU.unlock();
    // the first tap on the speaker means "let me hear it", not "be quiet"
    if (e.target.closest && e.target.closest('#gd-voice')) e.stopPropagation();
    setTimeout(() => { if (guideSt.pending === key && guideSt.key === key) guideSay(key, { force: true }); guideSt.pending = null; }, 0);
  }, true);
  // A nudge when nothing happens for a while: once for each wait, cleared by the next move or screen.
  function guideIdle(key, ms) {
    clearTimeout(guideSt.idle);
    if (key) guideSt.idle = setTimeout(() => { if (!document.querySelector('.modal')) guideSay(key, { force: true }); }, ms || 30000);
  }
  // The line for a menu screen. Era, lesson, puzzle and game screens choose their own as things change.
  function guideScreen(name) {
    if (['era', 'lesson', 'puzzle', 'game', 'drill'].includes(name)) return;
    let key = name;
    if (name === 'home') {
      const resume = saved.game && saved.game.moves && saved.game.moves.length && !state.game;
      key = resume ? 'home.resume' : state.progress.xp ? 'home' : 'home.first';
    }
    if (GUIDE.lines[key]) guideSay(key);
  }
  function eraGuideKey(e) {
    const info = PG.journeyInfo(state.progress, e.id), champ = e.stages.length - 1;
    if (info.done) return 'era.' + e.id + '.done';
    if (e.stages.every((s, k) => k === champ || info.stages[k])) return 'era.' + e.id + '.champion';
    return 'era.' + e.id + '.' + e.stages[info.next].kind;
  }

  // ------------------------------------------------------------------ navigation
  // Pages float over the blurred room; the home hero shows the room itself; game screens
  // (the HUD) hide the menus and hand the whole screen to the table.
  const NAV = [['home', 'home'], ['play', 'play'], ['journey', 'journey'], ['learn', 'learn'],
    ['puzzles', 'puzzle'], ['training', 'improve'], ['collection', 'collection'], ['profile', 'profile']];
  const navName = (k) => t('common.nav.' + k);
  const TABS = ['home', 'play', 'journey', 'learn', 'collection'];
  const SECTION = { era: 'journey', season: 'home', store: 'home', dojo: 'training', openings: 'training' };
  const TAB_OF = { puzzles: 'learn', training: 'learn', dojo: 'learn', openings: 'learn' };
  const KIND = { home: 'hero', game: 'hud', review: 'hud', lesson: 'hud', puzzle: 'hud', drill: 'hud' };
  const SCREENS = {};
  let current = null;   // the active screen controller
  function renderNav() {
    const secId = SECTION[state.screen] || state.screen;
    const lv = PG.levelFor(state.progress.xp);
    $('topnav').innerHTML = '<button class="brand" data-nav="home" aria-label="' + t('common.nav.brand') + '"><img src="' + ART.crestUri() + '" alt=""><span>Chackmate</span></button>' +
      '<nav class="links" aria-label="Main">' + NAV.map(([k]) => '<button data-nav="' + k + '"' + (k === secId ? ' aria-current="page"' : '') + '>' + navName(k) + '</button>').join('') + '</nav>' +
      '<div class="tools">' + (state.progress.premium ? '' : '<button class="prem-btn" data-nav="store" aria-label="' + t('common.premium') + '">' + icon('crown') + '<span>' + t('common.premium') + '</span></button>') +
      '<button class="round" id="nv-music" aria-pressed="' + !!state.settings.music + '" aria-label="' + t('settings.music') + '" title="' + t('settings.music') + '">' + icon(state.settings.music ? 'music' : 'musicOff') + '</button>' +
      '<button class="round" id="nv-set" aria-label="' + t('settings.title') + '" title="' + t('settings.title') + '">' + icon('gear') + '</button>' +
      '<button class="mepill" data-nav="profile" aria-label="' + t('common.nav.yourProfile') + '">' + avatarHtml('sm') + '<span class="who"><b>' + esc(myName()) + '</b><small>' + t('common.level', { n: lv.level }) + '</small></span></button></div>';
    const tab = TAB_OF[secId] || secId;
    $('tabbar').innerHTML = TABS.map((k) => { const n = NAV.find((x) => x[0] === k); return '<button data-nav="' + k + '"' + (k === tab ? ' aria-current="page"' : '') + '>' + icon(n[1]) + '<span>' + navName(k) + '</span></button>'; }).join('');
    document.querySelectorAll('#topnav [data-nav], #tabbar [data-nav]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); go(b.dataset.nav); }; });
    $('nv-music').onclick = () => { state.settings.music = !state.settings.music; AU.unlock(); applySettings(); save(); renderNav(); };
    $('nv-set').onclick = () => { AU.play('tap'); settingsModal(); };
  }
  function go(name, arg) {
    if (name === 'improve') name = 'puzzles';
    if (arg === undefined && name === state.screen) {
      // A refresh of the screen on show (after a sync, say). Game screens keep their state.
      if (KIND[name] === 'hud') { renderNav(); return; }
      arg = state.screenArg;
    }
    if (peeking) endPeek(true);
    if (current && current.leave) current.leave();
    AU.hush();
    guideIdle(null);
    view.setArrows([]);
    setHooks({});
    preview = null; lookOverride = null; applyLook();
    state.screen = name; state.screenArg = arg;
    const kind = KIND[name] || 'page';
    document.body.classList.toggle('paged', kind === 'page');
    document.body.classList.toggle('ingame', kind === 'hud');
    document.body.classList.toggle('heroic', kind === 'hero');
    view.setPaused(kind === 'page');
    renderNav();
    current = SCREENS[name](arg) || {};
    guideScreen(name);
    applyInsets();
    const scr = $('screens').querySelector('.screen');
    if (scr) scr.classList.add('enter');
  }
  function mount(html) { $('screens').innerHTML = '<div class="screen">' + html + '</div>'; }
  // Tell the camera which parts of the screen the menus cover, so the board is framed in
  // the space that is left.
  function applyInsets() {
    const kind = KIND[state.screen] || 'page';
    const W = innerWidth, H = innerHeight;
    const ins = { top: 0, right: 0, bottom: 0, left: 0 };
    const rect = (sel) => { const el = document.querySelector('#screens ' + sel); return el && el.offsetParent !== null ? el.getBoundingClientRect() : null; };
    if (kind === 'hero') { const m = document.querySelector('#screens .motto'); ins.top = m ? m.getBoundingClientRect().bottom - 4 : $('topnav').getBoundingClientRect().bottom; }
    else if (kind === 'hud') {
      const side = rect('.side') || rect('.lesson');
      const bar = rect('.actionbar');
      const sheet = side && side.top > H * 0.4 && side.width > W * 0.6;   // phone: a sheet along the bottom
      let top = 0;
      document.querySelectorAll('#screens .hud-top > *, #screens .player-card').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && r.bottom < H * 0.5 && (sheet || r.left < W * 0.5)) top = Math.max(top, r.bottom);
      });
      ins.top = top + 8;
      // The guide card: above the sheet on phones, top left elsewhere. The board makes room for it.
      const gd = $('guide'), gdOn = gd && !gd.hidden && !gd.classList.contains('tucked');
      document.body.style.setProperty('--sheet-top', (sheet ? H - side.top + 8 : 0) + 'px');
      if (sheet) ins.bottom = H - side.top + 8 + (gdOn ? gd.offsetHeight + 8 : 0);
      else {
        if (side) ins.right = W - side.left + 12;
        ins.bottom = bar ? H - bar.top + 10 : 16;
        const eb = rect('.evalbar');
        ins.left = eb ? eb.right + 10 : 10;
        if (gdOn) ins.top = Math.max(ins.top, gd.getBoundingClientRect().bottom + 8);
      }
    }
    view.setInsets(ins, kind !== 'hud');
  }
  window.addEventListener('resize', () => { applyInsets(); });

  function avatarHtml(cls, avatarId, frameId) {
    const a = (avatarId && PG.item(avatarId)) || PG.equipped(state.progress, 'avatar') || PG.item(CATALOG.defaults.avatar);
    const f = (frameId && PG.item(frameId)) || (avatarId ? null : PG.equipped(state.progress, 'frame')) || PG.item(CATALOG.defaults.frame);
    const ring = !!(f && f.data.ring !== 'transparent');
    return '<div class="avatar ' + (cls || '') + (ring ? ' ringed" style="--ring:' + f.data.ring : '') + '"><img src="' + medal(a.data.art, a.data.from, a.data.to, { ring: !ring }) + '" alt=""></div>';
  }

  // A calm table behind the menus: the start position, slowly circling.
  function idleBoard() {
    const pos = new E.Pos(); pos.load(E.START_FEN);
    view.setBoard(piecesOf(pos), null);
    view.setHighlights({});
    view.setClock(null);
    view.setAttract(true);
  }

  // "Try it on the table": the menus step aside and the room shows the item for real.
  // A set is seen from just above its own back rank, a board from a little closer than in
  // play, and the rest (clocks, effects, sounds) from the player's seat, a step nearer.
  const PEEK_FOCUS = {
    pieces: { pitch: 0.62, zoom: 0.6, lookY: 0.45, lookZ: 1.4 },
    piecesTall: { pitch: 0.62, zoom: 0.7, lookY: 0.45, lookZ: 1.2 },   // a phone held upright: all eight files still fit
    board: { pitch: 0.95, zoom: 0.72, lookZ: 0.6 },
    move: { pitch: 0.7, zoom: 0.62, lookY: 0.3, lookZ: 0.2 },   // capture effects and trails, close to the move
    other: { zoom: 0.8 },
  };
  // Capture effects and trails only show on a move, so the preview plays one again and again:
  // a knight hops in to take a pawn, or the queen sweeps across the board. The next round
  // starts a second after the last one ends, however long its capture scene runs.
  function peekDemo(it) {
    const capture = it.category === 'capture';
    const [from, to, piece] = capture ? ['f3', 'e5', 2] : ['d1', 'h5', 5];
    const live = () => peeking && peeking.it === it;
    const play = () => {
      if (!live()) return;
      const start = [[sqIndex('e1'), 6], [sqIndex('e8'), -6], [sqIndex(from), piece]];
      if (capture) start.push([sqIndex(to), -1]);
      view.setBoard(start, null);
      peeking.timers.push(setTimeout(() => {
        if (!live()) return;
        view.animateMove({ from: sqIndex(from), to: sqIndex(to), capturedSq: capture ? sqIndex(to) : -1, mover: piece },
          () => { if (live()) peeking.timers.push(setTimeout(play, 1000)); }, { skipHint: false });
      }, 450));
    };
    play();
    peeking.demo = true;
  }
  let peeking = null;
  function peek(it) {
    if (peeking) endPeek(true);   // one item on the table at a time
    peeking = { it, timers: [] };
    preview = it; applyLook();
    document.body.classList.add('peeking');
    view.setPaused(false);
    view.setInsets({ top: $('topnav').getBoundingClientRect().bottom, bottom: 110 }, true);
    // full resolution while the item is on show, and a camera that starts close to it
    view.setFullDetail(true);
    if (it.category === 'room') { view.setAttract(true); view.setFocus({ zoom: 0.8 }); }
    else {
      const moving = it.category === 'capture' || it.category === 'trail';
      view.setAttract(false); view.setView('white', 'player');
      view.setFocus((it.category === 'pieces' && innerWidth / innerHeight < 0.8 && PEEK_FOCUS.piecesTall) || PEEK_FOCUS[moving ? 'move' : it.category] || PEEK_FOCUS.other);
    }
    if (it.category === 'capture' || it.category === 'trail') peekDemo(it);
    if (it.category === 'victory') {
      const win = () => view.celebrate('win', -1, null, sqIndex('e1'));
      peeking.timers.push(setTimeout(win, 500), setInterval(win, 4200));
    }
    if (it.category === 'sound') AU.play('capture');
    const un = PG.isUnlocked(state.progress, it), on = state.progress.equipped[it.category] === it.id;
    const bar = document.createElement('div');
    bar.className = 'peekbar glass';
    bar.innerHTML = '<div><small>' + t(un ? 'collection.trying' : 'collection.preview') + '</small><b>' + esc(it.name) + '</b></div>' +
      (un ? (on ? '<span class="pill gold">' + icon('check') + ' ' + t('collection.equipped') + '</span>' : '<button class="btn primary small" id="pk-eq">' + t('collection.equip') + '</button>') : '<span class="pill lock">' + icon('lock') + ' ' + esc(unlockText(it)) + '</span>') +
      '<button class="btn small" id="pk-back">' + icon('back') + ' ' + t('common.back') + '</button>';
    document.body.appendChild(bar);
    peeking.bar = bar;
    bar.querySelector('#pk-back').onclick = () => endPeek();
    const eq = bar.querySelector('#pk-eq');
    if (eq) eq.onclick = () => { PG.equip(state.progress, it); save(); toast(t('collection.equippedToast', { name: esc(it.name) })); endPeek(); };
  }
  function endPeek(silent) {
    if (!peeking) return;
    peeking.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    peeking.bar.remove();
    const demo = peeking.demo;
    peeking = null;
    if (demo) idleBoard();
    document.body.classList.remove('peeking');
    view.setFullDetail(false);
    preview = null; applyLook();
    if (silent) return;
    view.setAttract(true);
    view.setPaused((KIND[state.screen] || 'page') === 'page');
    applyInsets();
    if (current && current.refresh) current.refresh();
    renderNav();
  }

  // ---------------------------------------------------------------- home
  function nextLesson() {
    return LESSONS.lessons.find((l) => !state.progress.lessons[l.id] && lessonOpen(l)) || null;
  }
  const lessonOpen = (l) => LESSONS.chapters.find((c) => c.n === l.chapter).access === 'free' || state.progress.premium;
  function dailyPuzzle() {
    if (!PUZZLES.length) return null;
    const d = PG.today();
    let h = 0; for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const pool = PUZZLES.filter((p) => p.rating <= 1600);
    return (pool.length ? pool : PUZZLES)[h % (pool.length || PUZZLES.length)];
  }
  const dailyDone = () => state.progress.daily.date === PG.today() && state.progress.daily.done;
  const nextEra = () => CAMPAIGN.eras.find((e) => !PG.journeyInfo(state.progress, e.id).done) || null;
  const duoArt = () => '<span class="duo"><img src="' + medal('piece:n', '#a3294f', '#5c1328') + '" alt=""><img src="' + medal('piece:r', '#2f6f6a', '#173b39') + '" alt=""><i>' + icon('users') + '</i></span>';
  const worldArt = () => '<span class="duo"><img src="' + medal('piece:k', '#2f6f6a', '#173b39') + '" alt=""><img src="' + medal('piece:q', '#b8862b', '#5c3d0c') + '" alt=""><i>' + icon('globe') + '</i></span>';
  function wireLinks() {
    document.querySelectorAll('#screens [data-nav]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); go(b.dataset.nav); }; });
    const ms = $('a-missions'); if (ms) ms.onclick = () => { AU.play('tap'); missionsModal(); };
    const ss = $('a-season'); if (ss) ss.onclick = () => { AU.play('tap'); go('season'); };
  }
  SCREENS.home = function () {
    idleBoard();
    const resume = saved.game && saved.game.moves && saved.game.moves.length && !state.game;
    const online = netOn();
    const nl = nextLesson();
    const daily = dailyPuzzle();
    const ne = nextEra();
    const set = equippedSet();
    mount('<section class="hero" aria-label="' + t('common.nav.home') + '">' +
      '<img class="crest" src="' + ART.crestUri() + '" alt="">' +
      '<h1 class="wordmark">Chackmate</h1>' +
      '<p class="tagline">' + t('home.tagline') + '</p>' +
      '<p class="motto">' + t('home.motto') + '</p>' +
      '<div class="lux-row">' +
      lux({ id: 'h-quick', feature: true, art: snap(VIGN.duo(set), 240, 150, medal('piece:k', '#a3294f', '#4a0c1e')), title: t(resume ? 'home.resume' : 'home.quick'),
        text: resume ? t('home.resumeText', { n: saved.game.moves.length }) : t(online ? 'home.quickOnline' : 'home.quickOffline') }) +
      lux({ id: 'h-journey', art: porthole(ne || CAMPAIGN.eras[CAMPAIGN.eras.length - 1]), title: t('home.journey'), text: ne ? t('home.journeyNext', { era: eraName(ne), when: eraWhen(ne) }) : t('home.journeyDone') }) +
      lux({ id: 'h-learn', art: faceImg(COACH), title: t('home.learn'), text: nl ? t('home.learnNext', { lesson: nl.title }) : t('home.learnDone') }) +
      lux({ id: 'h-daily', art: snap(VIGN.fork(set), 240, 150, medal('piece:n', '#1f5a3e', '#0b2418')), title: t('home.daily'), text: !daily ? t('home.dailyNone') : dailyDone() ? t('home.dailyDone') : t('home.dailyText', { n: daily.rating }) }) +
      lux({ id: 'h-friend', art: duoArt(), title: t('play.friend'), text: t('play.friendText') }) +
      '</div>' +
      '<div class="home-foot">' + missionsStrip() + seasonStrip() + '</div>' +
      '</section>');
    hydrate();
    wireLinks();
    $('h-quick').onclick = () => { AU.unlock(); AU.play('tap'); if (resume) resumeSaved(); else quickPlay(); };
    $('h-journey').onclick = () => { AU.unlock(); AU.play('tap'); if (ne && PG.eraOpen(state.progress, ne.id)) go('era', ne.id); else go('journey'); };
    $('h-learn').onclick = () => { AU.unlock(); AU.play('tap'); if (nl) go('lesson', nl.id); else go('learn'); };
    $('h-daily').onclick = () => { AU.unlock(); AU.play('tap'); if (daily) go('puzzle', { list: [daily], daily: true, title: t('learn.dailyPuzzle') }); else go('puzzles'); };
    $('h-friend').onclick = () => { AU.unlock(); AU.play('tap'); friendModal(); };
    return { leave() { view.setAttract(false); } };
  };

  // ---------------------------------------------------------------- missions and season
  function missionsStrip() {
    const list = PG.missionList(state.progress, undefined, { online: netOn() });
    if (!list.length) return '';
    const done = list.filter((m) => m.done).length;
    return '<button class="strip glass" id="a-missions"><span class="sg' + (done === list.length ? ' gold' : '') + '">' + icon('target') + '</span><span style="flex:1"><small>' + t('home.missions.today') + '</small><b>' + (done === list.length ? t('home.missions.allDone') : t('home.missions.progress', { n: done, of: list.length })) + '</b>' +
      '<span class="bar"><i style="width:' + Math.round(done / list.length * 100) + '%"></i></span></span><span class="go">' + icon('arrow') + '</span></button>';
  }
  function seasonStrip() {
    const s = state.progress.season && PG.seasonInfo(state.progress, state.progress.season);
    if (!s) return '';
    return '<button class="strip glass" id="a-season"><span class="sg">' + icon('season') + '</span><span style="flex:1"><small>' + t('home.season.strip', { n: s.season.number, date: seasonEnd(s.season) }) + '</small><b>' + esc(seasonName(s.season)) + ' · ' + t('home.season.tier', { n: s.tier }) + '</b>' +
      '<span class="bar"><i style="width:' + Math.round(s.into / s.need * 100) + '%"></i></span></span><span class="go">' + icon('arrow') + '</span></button>';
  }
  function missionsCard() {
    const list = PG.missionList(state.progress, undefined, { online: netOn() });
    if (!list.length) return '<p class="sub">' + t('home.missions.none') + '</p>';
    return '<div class="missions">' + list.map((m) => '<div class="mission' + (m.done ? ' done' : '') + '"><i>' + (m.done ? icon('check') : icon('target')) + '</i><div><b>' + esc(missionText(m)) + '</b><div class="bar"><i style="width:' + Math.round(m.n / m.goal * 100) + '%"></i></div></div><small>' + (m.done ? t('home.missions.done') : m.n + '/' + m.goal) + '<br><span>+' + t('common.xp', { n: m.xp }) + '</span></small></div>').join('') + '</div>';
  }
  function missionsModal() {
    modal('<div class="eyebrow">' + t('home.missions.eyebrow') + '</div><h2>' + t('home.missions.title') + '</h2><p class="sub">' + t('home.missions.sub', { n: CHACKLATE_MISSIONS.allDoneXp }) + '</p>' + missionsCard() +
      '<div class="row"><button class="btn primary" data-close>' + t('common.letsGo') + '</button></div>', { x: true });
  }

  // ---------------------------------------------------------------- play
  function personaCard(o) {
    const P = state.progress, lv = LEVELS[o.level];
    const locked = lv.premium && !P.premium;
    const rec = P.stats.byLevel[o.level];
    const beaten = rec && rec.w > 0;
    return '<button class="persona' + (locked ? ' locked' : '') + (beaten ? ' beaten' : '') + '" data-opp="' + o.level + '" style="--tint:' + o.colors[0] + '">' +
      (locked ? '<span class="tag pill lock">' + icon('lock') + ' ' + t('common.premium') + '</span>' : beaten ? '<span class="tag pill gold">' + icon('crown') + ' ' + t('play.beaten') + '</span>' : '') +
      faceImg(o) + '<span class="lvl">' + t('common.level', { n: o.level + 1 }) + ' · ' + esc(bandName(o.level)) + '</span><h3>' + esc(o.name) + '</h3><span class="species">' + esc(speciesName(o)) + '</span>' +
      '<p>' + esc(oppBlurb(o)) + '</p><span class="rec">' + (rec && rec.w + rec.d + rec.l ? '<span class="pill ok">' + t('play.won', { n: rec.w }) + '</span><span class="pill">' + t('play.drawn', { n: rec.d }) + '</span><span class="pill">' + t('play.lost', { n: rec.l }) + '</span>' : '<span class="pill">' + t('play.notPlayed') + '</span>') + '</span></button>';
  }
  SCREENS.play = function () {
    idleBoard();
    const P = state.progress;
    const set = equippedSet();
    const online = netOn();
    const best = persona(PG.personalLevel(P, P.premium ? 7 : 3));
    mount('<div class="page"><div class="page-in">' +
      pageHead(t('common.nav.play'), t('play.title'), t('play.sub'), '<span class="pill gold">' + icon('star') + ' ' + t('play.bestMatch', { name: esc(oppFull(best)) }) + '</span>') +
      sec('play', t('play.start')) +
      '<div class="lux-row four">' +
      lux({ id: 'p-quick', feature: true, art: snap(VIGN.duo(set), 240, 150, medal('piece:k', '#a3294f', '#4a0c1e')), title: t('home.quick'), text: online ? t('play.quickOnline', { name: best.name }) : t('play.quickOffline', { name: best.name }) }) +
      lux({ id: 'p-friend', art: duoArt(), title: t('play.friend'), text: t('play.friendText') }) +
      lux({ id: 'p-world', art: worldArt(), title: t('play.world'), text: t('play.worldText') }) +
      lux({ id: 'p-custom', art: snap(VIGN.trio(set, '#2a1810', '#ffd9a8'), 240, 150, medal('piece:q', '#5b4a8a', '#2c2248')), title: t('play.custom'), text: t('play.customText') }) +
      '</div>' +
      sec('users', t('play.choose'), t('play.friends', { n: OPP.length })) +
      '<div class="personas">' + OPP.map(personaCard).join('') + '</div>' +
      '</div></div>');
    hydrate();
    wireLinks();
    $('p-quick').onclick = () => { AU.unlock(); AU.play('tap'); quickPlay(); };
    $('p-friend').onclick = () => { AU.unlock(); AU.play('tap'); friendModal(); };
    $('p-world').onclick = () => { AU.unlock(); AU.play('tap'); worldModal(); };
    $('p-custom').onclick = () => { AU.unlock(); AU.play('tap'); newGameModal(); };
    document.querySelectorAll('[data-opp]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); opponentModal(+b.dataset.opp); }; });
    return {};
  };
  const CLOCKS = [['none', 'play.clock.none'], ['3+2', '3 + 2'], ['5+0', 'play.clock.5'], ['10+5', '10 + 5'], ['15+10', '15 + 10'], ['30+0', 'play.clock.30']];
  const clockName = (l) => (I18N.has(l) ? t(l) : l);
  function opponentModal(level) {
    const o = persona(level), lv = LEVELS[level];
    if (lv.premium && !state.progress.premium) { premiumModal(t('play.premiumOpp', { name: oppFull(o) }), o); return; }
    const s = state.setup;
    const m = modal('<div class="setup-hero">' + faceImg(o, 'big') + '<div><div class="eyebrow">' + t('common.level', { n: level + 1 }) + ' · ' + esc(bandName(level)) + '</div><h2>' + esc(oppFull(o)) + '</h2><p class="quote">“' + esc(sayLine(o, 'hello')) + '”</p></div></div>' +
      '<form id="os"><div class="field"><div class="label">' + t('play.playAs') + '</div><div class="seg">' + ['white', 'black', 'random'].map((v) => '<label><input type="radio" name="color" value="' + v + '"' + ((s.color || 'white') === v ? ' checked' : '') + '><span>' + t('play.color.' + v) + '</span></label>').join('') + '</div></div>' +
      '<div class="field"><div class="label">' + t('play.clock') + '</div><div class="seg">' + CLOCKS.map(([v, l]) => '<label><input type="radio" name="tc" value="' + v + '"' + ((s.tc || 'none') === v ? ' checked' : '') + '><span>' + clockName(l) + '</span></label>').join('') + '</div></div>' +
      '<div class="row"><button type="button" class="btn" data-close>' + t('common.notNow') + '</button><button class="btn primary">' + icon('play') + ' ' + t('play.playName', { name: esc(o.name) }) + '</button></div></form>', { x: true });
    const form = m.querySelector('#os');
    form.onsubmit = (e) => { e.preventDefault(); m.close(); AU.unlock(); startGame({ mode: 'ai', color: form.color.value, level, tc: form.tc.value, fen: '' }); };
  }
  // Premium things a child taps are explained, and the store itself sits behind the parent gate.
  function premiumModal(why, who) {
    const m = modal('<div class="result-hero">' + (who ? faceImg(who) : '<img class="portrait" src="' + medal('emblem:crown', '#ffd27a', '#b8862b') + '" alt="">') +
      '<span class="result-badge">' + t('common.premium') + '</span><h2 class="result-title">' + t('store.more.title') + '</h2><p class="sub">' + esc(why) + ' ' + t('store.more.sub') + '</p>' +
      '<div class="row" style="justify-content:center"><button class="btn" data-close>' + t('common.ok') + '</button><button class="btn primary" id="pm-store">' + icon('crown') + ' ' + t('store.more.ask') + '</button></div></div>');
    m.querySelector('#pm-store').onclick = () => { m.close(); go('store'); };
  }
  function quickPlay() {
    if (netOn()) { ChacklateNet.quickMatch('5+3'); return; }
    quickPlayOffline();
  }
  function quickPlayOffline() {
    const lv = PG.personalLevel(state.progress, state.progress.premium ? 7 : 3);
    toast(t('play.quickToast', { name: esc(oppFull(persona(lv))) }));
    startGame({ mode: 'ai', color: 'random', level: lv, tc: 'none', fen: '', personal: true });
  }

  // ---------------------------------------------------------------- the Journey Through Time
  // Nine eras in order. Each has a story, a lesson, a trial and a champion; beating the
  // champion brings that era's chess set, board, room and portrait home.
  const STAGE = { tale: 'scroll', lesson: 'learn', puzzles: 'puzzle', endgame: 'crown', champion: 'swords' };
  const eraRewards = (e) => CATALOG.items.filter((it) => it.unlock.type === 'journey' && it.unlock.era === e.id);
  function eraCard(e, i) {
    const info = PG.journeyInfo(state.progress, e.id);
    const set = setInfo(e.set);
    const why = info.open ? '' : info.premium && !state.progress.premium ? t('common.premium') : t('journey.finishFirst', { era: eraName(CAMPAIGN.eras[i - 1]) });
    return '<button class="era' + (info.open ? '' : ' locked') + (info.done ? ' done' : '') + '" data-era="' + e.id + '">' +
      '<span class="banner"><img src="' + ART.bannerUri(e.landmark, { from: e.colors[0], to: e.colors[1] }) + '" alt=""><span class="num">' + t('journey.era', { n: ROMAN[i] }) + '</span><span class="when pill">' + esc(eraWhen(e)) + '</span></span>' +
      '<img class="coach portrait" src="' + face(eraCoach(e)) + '" alt="">' +
      '<span class="body"><h3>' + esc(eraName(e)) + '</h3><span class="t">' + esc(fullName(eraCoach(e))) + ' · ' + esc(eraText(e, 'place')) + '</span></span>' +
      '<span class="foot"><span class="stagedots">' + info.stages.map((d) => '<i' + (d ? ' class="on"' : '') + '></i>').join('') + '</span>' +
      '<span class="reward">' + (info.done ? icon('check') + ' ' + t('journey.yours', { set: '<b>' + esc(set ? set.name : '') + '</b>' }) : why ? icon('lock') + ' ' + esc(why) : t('journey.prize', { set: '<b>' + esc(set ? set.name : '') + '</b>' })) + '</span>' +
      '<span class="go">' + icon(info.open ? 'arrow' : 'lock') + '</span></span></button>';
  }
  SCREENS.journey = function () {
    idleBoard();
    const P = state.progress;
    const done = CAMPAIGN.eras.filter((e) => PG.journeyInfo(P, e.id).done).length;
    mount('<div class="page"><div class="page-in">' +
      pageHead(t('journey.eyebrow'), t('journey.title'), t('journey.sub'), meter(done, CAMPAIGN.eras.length, t('journey.complete'))) +
      '<div class="eras">' + CAMPAIGN.eras.map(eraCard).join('') + '</div>' +
      '<p class="fine">' + t('journey.fine') + '</p>' +
      '</div></div>');
    wireLinks();
    document.querySelectorAll('[data-era]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); openEra(b.dataset.era); }; });
    return {};
  };
  function openEra(id) {
    const info = PG.journeyInfo(state.progress, id);
    if (info.open) return go('era', id);
    const e = info.era, i = CAMPAIGN.eras.indexOf(e);
    if (info.premium && !state.progress.premium) return premiumModal(t('journey.premium', { era: eraName(e) }), eraCoach(e));
    toast(t('journey.finishToast', { prev: esc(eraName(CAMPAIGN.eras[i - 1])), era: esc(eraName(e)) }));
  }
  function rewardRow(it) {
    const d = it.data || {};
    // the item's own picture, the same one its Collection card shows (and shares the cache with)
    const art = it.category === 'avatar' ? '<img src="' + medal(d.art, d.from, d.to) + '" alt="">' : '<span class="thumb">' + itemArt(it) + '</span>';
    return '<li>' + art + '<span><b>' + esc(it.name) + '</b><small>' + esc(catName(it.category)) + '</small></span></li>';
  }
  const catName = (id) => t('collection.one.' + id);
  SCREENS.era = function (id) {
    const e = eraById(id) || CAMPAIGN.eras[0];
    const P = state.progress;
    if (!PG.eraOpen(P, e.id)) { setTimeout(() => go('journey'), 0); return {}; }
    idleBoard();
    setLook({ set: e.set, board: e.board, room: e.room });
    const info = PG.journeyInfo(P, e.id);
    const co = eraCoach(e), set = setInfo(e.set) || { name: e.set, story: '' };
    const i = CAMPAIGN.eras.indexOf(e);
    const champ = e.stages.length - 1;
    const ready = e.stages.every((s, k) => k === champ || info.stages[k]);
    const quote = info.done ? sayLine(co, 'win') : ready ? sayLine(co, 'hello') : info.count ? t('journey.soFar') : t('journey.welcome', { era: eraName(e), name: co.name });
    const [felt, sheen] = eraFelt(e);
    mount('<div class="page"><div class="page-in">' +
      '<button class="backlink" data-nav="journey">' + icon('back') + ' ' + t('journey.allEras') + '</button>' +
      '<section class="era-hero"><img class="bg" src="' + ART.bannerUri(e.landmark, { from: e.colors[0], to: e.colors[1] }) + '" alt="">' +
      '<div class="in">' + faceImg(co, 'coach-big') + '<div><div class="eyebrow">' + t('journey.era', { n: ROMAN[i] }) + ' · ' + esc(eraWhen(e)) + ' · ' + esc(eraText(e, 'place')) + '</div><h1>' + esc(eraText(e, 'title')) + '</h1>' +
      '<p class="quote"><b>' + esc(fullName(co)) + '</b>“' + esc(quote) + '”</p></div></div></section>' +
      '<div class="era-layout"><div class="stages">' + e.stages.map((s, k) => {
        const done = info.stages[k], locked = k === champ && !ready && !done;
        const next = !done && !locked && (k === champ ? ready : info.next === k);
        const desc = { tale: t('journey.taleDesc', { name: co.name }), lesson: (s.objectives || []).join('. ') + '.', puzzles: s.intro, endgame: s.intro, champion: t('journey.champDesc', { name: co.name, set: set.name }) }[s.kind];
        return '<button class="stage' + (done ? ' done' : '') + (next ? ' next' : '') + '" data-stage="' + k + '"' + (locked ? ' disabled' : '') + '>' +
          '<span class="badge-ic">' + (s.kind === 'champion' ? '<img src="' + face(co) + '" alt="">' : icon(STAGE[s.kind])) + '</span>' +
          '<span><span class="k">' + t('journey.stageN', { n: k + 1 }) + ' · ' + t('journey.stage.' + s.kind) + '</span><h4>' + esc(stageTitle(e, k)) + '</h4><small>' + esc(locked ? t('journey.lockedDesc', { name: co.name }) : desc) + '</small></span>' +
          (done ? '<span class="pill ok">' + icon('check') + ' ' + t('home.missions.done') + '</span>' : '<span class="go">' + icon(locked ? 'lock' : 'arrow') + '</span>') + '</button>';
      }).join('') + '</div>' +
      '<aside class="reward-card glass"><div class="eyebrow">' + t(info.done ? 'journey.keep' : 'journey.thePrize') + '</div>' +
      '<div class="vign">' + snap(VIGN.trio(e.set, felt, sheen), 320, 200, medal('piece:k', e.colors[0], e.colors[1])) + '</div>' +
      '<h3>' + esc(set.name) + '</h3><p class="muted">' + esc(set.story) + '</p>' +
      '<ul class="reward-list">' + eraRewards(e).map(rewardRow).join('') + '</ul></aside></div>' +
      '</div></div>');
    hydrate();
    wireLinks();
    document.querySelectorAll('[data-stage]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); runStage(e, +b.dataset.stage); }; });
    guideSay(eraGuideKey(e));
    return {};
  };
  function runStage(e, k) {
    const s = e.stages[k];
    const journey = { era: e.id, stage: k };
    if (s.kind === 'tale') return taleModal(e, k);
    if (s.kind === 'lesson') return go('lesson', { journey });
    if (s.kind === 'puzzles') return go('puzzle', { list: stagePuzzles(s), title: stageTitle(e, k), intro: s.intro, journey });
    if (s.kind === 'endgame') return startDojo(s.endgame.id, journey);
    if (s.kind === 'champion') return startGame({ mode: 'ai', color: s.color || 'white', level: s.level, tc: 'none', fen: '', rival: eraCoach(e), look: { set: e.set, board: e.board, room: e.room }, journey });
  }
  // Each era names its own puzzles, none of which a Learn lesson or another era uses.
  const stagePuzzles = (s) => s.puzzles.map((id) => PUZZLES.find((p) => p.id === id)).filter(Boolean);
  // Marks a stage done and shows what it brought. Finishing the champion completes the era.
  function stageDone(journey) {
    const e = eraById(journey.era);
    const res = PG.journeyStage(state.progress, journey.era, journey.stage, Date.now());
    save();
    if (res.eraDone) setTimeout(() => eraDoneModal(e, res), 400);
    else celebrate(res);
    return res;
  }
  function eraDoneModal(e, res) {
    const co = eraCoach(e), set = setInfo(e.set) || { name: e.set };
    const [felt, sheen] = eraFelt(e);
    AU.play('levelUp');
    AU.event('lesson.passed');
    const m = modal('<div class="result-hero">' +
      '<div class="vign">' + snap(VIGN.trio(e.set, felt, sheen), 360, 220, medal('piece:k', e.colors[0], e.colors[1])) + '</div>' +
      '<span class="result-badge win">' + t('journey.eraDone', { n: ROMAN[CAMPAIGN.eras.indexOf(e)] }) + '</span><h2 class="result-title">' + esc(set.name) + '</h2>' +
      '<p class="quote"><b>' + esc(fullName(co)) + '</b>“' + esc(sayLine(co, 'win')) + '”</p>' +
      '<ul class="reward-list">' + eraRewards(e).map(rewardRow).join('') + '</ul>' +
      '<div class="row" style="justify-content:center"><button class="btn" id="ed-map">' + icon('journey') + ' ' + t('journey.map') + '</button><button class="btn primary" id="ed-use">' + icon('check') + ' ' + t('journey.useSet') + '</button></div></div>', { cls: 'narrow' });
    hydrate(m);
    m.querySelector('#ed-map').onclick = () => { m.close(); go('journey'); };
    m.querySelector('#ed-use').onclick = () => {
      eraRewards(e).filter((it) => ['pieces', 'board', 'room'].includes(it.category)).forEach((it) => PG.equip(state.progress, it));
      save(); applyLook(); m.close(); toast(t('journey.setToast', { set: esc(set.name) })); go('collection', 'pieces');
    };
    celebrate(res, true);
  }
  // The story: parchment pages read aloud, then one question.
  function taleModal(e, k) {
    const s = e.stages[k], co = eraCoach(e);
    let page = 0, solved = !!PG.journeyInfo(state.progress, e.id).stages[k];
    const m = modal('<div class="parch"><div class="head"><img src="' + face(co) + '" alt=""><div><div class="k">' + esc(eraName(e)) + ' · ' + esc(eraWhen(e)) + '</div><h2>' + esc(stageTitle(e, k)) + '</h2></div>' +
      '<div class="tl-tools"><button class="tl-btn" id="tl-again" aria-label="' + t('common.guide.again') + '" title="' + t('common.guide.again') + '">' + icon('replay') + '</button><button class="tl-btn" id="tl-voice" data-voice="' + esc(co.name) + '"></button></div></div>' +
      '<div id="tl-body"></div><div class="nav"><span class="pdots" id="tl-dots"></span><span class="grow"></span><button class="btn" id="tl-prev">' + icon('prev') + ' ' + t('common.back') + '</button><button class="btn primary" id="tl-next">' + t('common.next') + '</button></div></div>',
    { cls: 'tale', onClose() { AU.hush(); } });
    const body = m.querySelector('#tl-body'), next = m.querySelector('#tl-next'), prev = m.querySelector('#tl-prev');
    const line = () => (page < s.pages.length ? s.pages[page] : s.quiz.q);
    voiceIcon(m.querySelector('#tl-voice'), co.name);
    m.querySelector('#tl-voice').onclick = () => { AU.unlock(); setVoice(!state.settings.narration, true); if (state.settings.narration) AU.say(line()); };
    m.querySelector('#tl-again').onclick = () => { AU.unlock(); if (!state.settings.narration) setVoice(true, true); AU.say(line()); };
    function render() {
      m.querySelector('#tl-dots').innerHTML = s.pages.concat([0]).map((_, j) => '<i' + (j <= page ? ' class="on"' : '') + '></i>').join('');
      prev.disabled = page === 0;
      AU.hush();
      if (page < s.pages.length) {
        body.innerHTML = '<p class="text">' + esc(s.pages[page]) + '</p>';
        next.hidden = false; next.textContent = t(page === s.pages.length - 1 ? 'journey.question' : 'common.next');
        if (state.settings.narration) AU.say(s.pages[page]);
        return;
      }
      body.innerHTML = '<p class="text q">' + esc(s.quiz.q) + '</p><div class="opts">' + s.quiz.options.map((o, j) => '<button data-o="' + j + '">' + esc(o) + '</button>').join('') + '</div><div id="tl-ex"></div>';
      next.hidden = !solved; next.textContent = t('common.finish');
      if (state.settings.narration) AU.say(s.quiz.q);
      body.querySelectorAll('[data-o]').forEach((b) => {
        b.onclick = () => {
          const right = +b.dataset.o === s.quiz.answer;
          b.classList.add(right ? 'right' : 'wrong');
          b.disabled = true;
          AU.play(right ? 'correct' : 'wrong');
          body.querySelector('#tl-ex').innerHTML = '<p class="explain">' + '<b>' + t(right ? 'journey.yes' : 'journey.notQuite') + '</b> ' + esc(right ? s.quiz.explain : t('journey.tryAgain')) + '</p>';
          if (!right) return;
          body.querySelectorAll('[data-o]').forEach((x) => { x.disabled = true; });
          next.hidden = false;
          if (!solved) { solved = true; m.dataset.won = '1'; }
        };
      });
    }
    prev.onclick = () => { if (page > 0) { page--; AU.play('tap'); render(); } };
    next.onclick = () => {
      AU.play('tap');
      if (page < s.pages.length) { page++; render(); return; }
      m.close();
      if (m.dataset.won) { stageDone({ era: e.id, stage: k }); if (state.screen === 'era') go('era', e.id); }
    };
    render();
  }

  // ---------------------------------------------------------------- learn, puzzles, training
  const subnav = (cur) => '<nav class="subnav" aria-label="' + t('learn.nav') + '">' + ['learn', 'puzzles', 'training'].map((k) => '<button data-nav="' + k + '"' + (k === cur ? ' aria-current="page"' : '') + '>' + t('learn.sub.' + k) + '</button>').join('') + '</nav>';
  const stars = (n) => '<span class="stars" aria-label="' + t('learn.stars', { n }) + '">' + [1, 2, 3].map((k) => k <= n ? '★' : '<span class="off">★</span>').join('') + '</span>';
  const locked = (item) => item.access === 'premium' && !state.progress.premium;
  SCREENS.learn = function () {
    idleBoard();
    const P = state.progress;
    const nl = nextLesson();
    const due = PG.dueReviews(P);
    const total = LESSONS.lessons.length, done = LESSONS.lessons.filter((l) => P.lessons[l.id]).length;
    mount('<div class="page"><div class="page-in">' + subnav('learn') +
      pageHead(t('learn.eyebrow'), t('learn.title'), t('learn.sub', { n: done, of: total }),
        due.length ? '<button class="btn outline" id="l-review">' + icon('refresh') + ' ' + t(due.length > 1 ? 'learn.reviewsDue' : 'learn.reviewDue', { n: due.length }) + '</button>' : '') +
      '<div class="bar path-bar"><i style="width:' + Math.round(done / total * 100) + '%"></i></div>' +
      (nl ? '<button class="tile wide" id="l-next"><span class="ic face">' + faceImg(COACH) + '</span><span><span class="eyebrow">' + t('learn.now', { n: nl.chapter }) + '</span><b>' + esc(nl.title) + '</b><small>' + esc(nl.objectives.join(' · ')) + '</small></span><span class="go">' + icon('arrow') + '</span></button>' : '') +
      '<div class="chapters">' + LESSONS.chapters.map((ch) => {
        const ls = LESSONS.lessons.filter((l) => l.chapter === ch.n);
        const n = ls.filter((l) => P.lessons[l.id]).length;
        const lock = ch.access !== 'free' && !P.premium;
        return '<section class="chapter glass"><header><span class="cn">' + ch.n + '</span><div><h3>' + esc(ch.title) + (lock ? ' <span class="pill lock">' + icon('lock') + ' ' + t('common.premium') + '</span>' : '') + '</h3><div class="meta">' + t('learn.chapterDone', { n, of: ls.length }) + '</div></div>' +
          '<div class="bar"><i style="width:' + Math.round(n / ls.length * 100) + '%"></i></div></header><div class="lessons">' +
          ls.map((l) => {
            const r = P.lessons[l.id];
            return '<button class="node' + (r ? ' done' : '') + (nl && nl.id === l.id ? ' next' : '') + '" data-lesson="' + l.id + '"' + (lock ? ' disabled' : '') + '><span><b>' + esc(l.title) + '</b><small>' + esc(l.objectives[0]) + '</small></span>' +
              (r ? stars(r.stars) : '<small>' + t('learn.min', { n: l.minutes }) + '</small>') + '</button>';
          }).join('') + '</div></section>';
      }).join('') + '</div></div></div>');
    wireLinks();
    document.querySelectorAll('[data-lesson]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); go('lesson', b.dataset.lesson); }; });
    if ($('l-next')) $('l-next').onclick = () => { AU.unlock(); AU.play('tap'); go('lesson', nl.id); };
    if ($('l-review')) $('l-review').onclick = () => { AU.unlock(); go('lesson', due[0]); };
    return {};
  };

  const THEMES = [['fork', 'piece:n'], ['pin', 'piece:b'], ['skewer', 'piece:r'], ['discoveredAttack', 'piece:q'], ['hangingPiece', 'piece:p'], ['mate', 'piece:k']];
  const themeName = (th) => (I18N.has('learn.theme.' + th) ? t('learn.theme.' + th) : th);
  const themePuzzles = (th) => PUZZLES.filter((p) => th === 'mate' ? p.themes.some((x) => x.startsWith('mateIn')) : p.themes.includes(th));
  SCREENS.puzzles = function () {
    idleBoard();
    const P = state.progress, set = equippedSet();
    const daily = dailyPuzzle();
    const plan = trainingPlan();
    mount('<div class="page"><div class="page-in">' + subnav('puzzles') +
      pageHead(t('learn.sub.puzzles'), t('learn.sub.puzzles'), t('learn.puzzlesSub'), '<div class="meter">' + icon('star') + '<b>' + t('learn.rating', { n: '<em>' + P.stats.puzzles.rating + '</em>' }) + '</b><span class="faint">' + t('learn.solved', { n: P.stats.puzzles.solved }) + '</span></div>') +
      sec('play', t('learn.startSolving')) +
      '<div class="lux-row three">' +
      lux({ id: 'z-daily', feature: !dailyDone(), art: snap(VIGN.fork(set), 240, 150, medal('piece:n', '#1f5a3e', '#0b2418')), title: t('home.daily'), text: !daily ? t('home.dailyNone') : dailyDone() ? t('home.dailyDone') : t('learn.dailyText', { n: daily.rating }) }) +
      lux({ id: 'z-rated', art: snap(VIGN.duo(set), 240, 150, medal('piece:q', '#5b4a8a', '#2c2248')), title: t('learn.trainer'), text: t('learn.trainerText', { n: PUZZLES.length }) }) +
      lux({ id: 'z-plan', art: faceImg(COACH), title: t('learn.plan'), text: plan.summary }) +
      '</div>' +
      sec('puzzle', t('learn.themes')) +
      '<div class="cards">' + THEMES.map(([th, art]) => { const c = themePuzzles(th).length; return '<button class="tile" data-theme="' + th + '"' + (c ? '' : ' disabled') + '><span class="ic"><img src="' + medal(art, '#a3294f', '#4a0c1e', { ring: false }) + '" alt=""></span><b>' + themeName(th) + '</b><small>' + esc(t('learn.themeText.' + th)) + ' ' + t('learn.nPuzzles', { n: c }) + '</small><span class="go">' + icon('arrow') + '</span></button>'; }).join('') + '</div>' +
      '</div></div>');
    hydrate();
    wireLinks();
    $('z-daily').onclick = () => { AU.unlock(); if (daily) go('puzzle', { list: [daily], daily: true, title: t('learn.dailyPuzzle') }); };
    $('z-rated').onclick = () => { AU.unlock(); go('puzzle', { rated: true, title: t('learn.trainerTitle') }); };
    $('z-plan').onclick = () => { AU.unlock(); go('puzzle', { theme: plan.theme, rated: true, title: t('learn.planTitle', { name: plan.name }) }); };
    document.querySelectorAll('[data-theme]').forEach((b) => { b.onclick = () => { AU.unlock(); go('puzzle', { theme: b.dataset.theme, rated: true, title: b.querySelector('b').textContent }); }; });
    return {};
  };
  // Personalised plan: the motif that has cost you the most in reviewed games and puzzles.
  function trainingPlan() {
    const counts = state.progress.seen.motifs || {};
    const order = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!order.length) return { theme: null, name: t('learn.mix'), summary: t('learn.planNone') };
    const [th] = order[0];
    return { theme: th, name: themeName(th), summary: t('learn.planText', { theme: themeName(th).toLowerCase() }) };
  }
  function noteMotif(theme) { const m = state.progress.seen.motifs || (state.progress.seen.motifs = {}); m[theme] = (m[theme] || 0) + 1; }

  function gameRow(h, i) {
    const who = h.mode === 'ai' ? persona(h.level) : null;
    return '<button class="row-item" data-game="' + i + '"><span class="res ' + h.result + '">' + (h.result === '-' ? '-' : t('learn.result.' + h.result)) + '</span>' +
      '<span class="gr">' + (who ? '<img class="portrait mini" src="' + face(who) + '" alt="">' : '') + '<span><b>' + (who ? t('learn.vs', { name: esc(oppFull(who)) }) : t(h.mode === 'online' ? 'learn.online' : 'learn.local')) + '</b><small>' +
      esc(REASON_TEXT[h.reason] || h.reason || '') + ' · ' + t('learn.moves', { n: Math.ceil(h.plies / 2) }) + ' · ' + esc(I18N.date(new Date(h.date))) + '</small></span></span><span class="pill">' + icon('eye') + ' ' + t('learn.review') + '</span></button>';
  }
  function wireGames(list) {
    document.querySelectorAll('[data-game]').forEach((b) => {
      b.onclick = () => {
        const h = list[+b.dataset.game];
        if (h.ucis && h.ucis.length) go('review', { start: h.start || E.START_FEN, ucis: h.ucis, side: h.color || WHITE, title: h.mode === 'ai' ? t('learn.vs', { name: persona(h.level).name }) : t(h.mode === 'online' ? 'learn.online' : 'learn.local'), level: h.level });
      };
    });
  }
  SCREENS.training = function () {
    idleBoard();
    const P = state.progress, set = equippedSet();
    const mastered = Object.values(P.openings).filter((r) => r.mastered).length;
    const dojoStars = ENDGAMES.reduce((a, d) => a + (P.dojo[d.id] ? P.dojo[d.id].stars : 0), 0);
    mount('<div class="page"><div class="page-in">' + subnav('training') +
      pageHead(t('learn.sub.training'), t('learn.sub.training'), t('learn.trainingSub')) +
      sec('play', t('learn.train')) +
      '<div class="lux-row three">' +
      lux({ id: 't-open', art: snap(VIGN.opening(set), 240, 150, medal('piece:b', '#2f4f8a', '#14243e')), title: t('learn.lab'), text: t('learn.labText', { n: OPENINGS.length, m: mastered }) }) +
      lux({ id: 't-dojo', art: snap(VIGN.endgame(set), 240, 150, medal('piece:k', '#5b4a8a', '#2c2248')), title: t('learn.dojo'), text: t('learn.dojoText', { n: ENDGAMES.length, s: dojoStars, of: ENDGAMES.length * 3 }) }) +
      lux({ id: 't-review', art: snap(VIGN.review(set), 240, 150, medal('piece:q', '#8a5a2a', '#3a1e0e')), title: t('learn.reviews'), text: t(P.history.length ? 'learn.reviewsText' : 'learn.reviewsNone') }) +
      '</div>' +
      sec('refresh', t('learn.recent')) +
      '<div class="list">' + (P.history.length ? P.history.slice(0, 6).map(gameRow).join('') : '<p class="muted">' + t('learn.recentNone') + '</p>') + '</div>' +
      '</div></div>');
    hydrate();
    wireLinks();
    wireGames(P.history);
    $('t-open').onclick = () => { AU.unlock(); AU.play('tap'); go('openings'); };
    $('t-dojo').onclick = () => { AU.unlock(); AU.play('tap'); go('dojo'); };
    $('t-review').onclick = () => { AU.play('tap'); go('profile', 'games'); };
    return {};
  };

  // Endgame dojo: play known endgames against full-strength defence, scored against a par.
  SCREENS.dojo = function () {
    idleBoard();
    const P = state.progress;
    const goalText = (g) => t('learn.goal.' + g);
    mount('<div class="page"><div class="page-in">' +
      '<button class="backlink" data-nav="training">' + icon('back') + ' ' + t('learn.sub.training') + '</button>' +
      pageHead(t('learn.sub.training'), t('learn.dojoTitle'), t('learn.dojoSub')) +
      '<div class="list">' + ENDGAMES.map((d) => {
        const r = P.dojo[d.id];
        return '<button class="row-item" data-eg="' + d.id + '"' + (locked(d) ? ' disabled' : '') + '><span class="sg">' + icon(d.goal === 'draw' ? 'draw' : d.goal === 'promote' ? 'pawn' : 'crown') + '</span><span><b>' + esc(d.name) + '</b><br><small>' + esc(d.level) + ' · ' + goalText(d.goal) + (d.goal === 'draw' ? ' ' + t('learn.forMoves', { n: d.par }) : ' · ' + t('learn.par', { n: d.par })) + (r && r.best ? ' · ' + t('learn.best', { n: r.best }) : '') + '</small></span>' +
          (locked(d) ? '<span class="pill lock">' + icon('lock') + ' ' + t('common.premium') + '</span>' : stars(r ? r.stars : 0)) + '</button>';
      }).join('') + '</div></div></div>');
    wireLinks();
    document.querySelectorAll('[data-eg]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); startDojo(b.dataset.eg); }; });
    return {};
  };
  // The dojo's endgames, plus the ones that live only inside an era.
  const endgameById = (id) => ENDGAMES.find((x) => x.id === id) || CAMPAIGN.eras.flatMap((e) => e.stages).map((s) => s.endgame).find((d) => d && d.id === id);
  function startDojo(id, journey) {
    const d = endgameById(id);
    const side = E.positionFrom(d.fen, []).side;
    startGame({ mode: 'ai', color: side === WHITE ? 'white' : 'black', level: 7, tc: 'none', fen: d.fen, dojo: id, journey: journey || null, look: journey ? eraLook(journey.era) : null });
    coachSay(d.tip, [[t('common.gotIt'), 'dismiss']]);
  }
  const eraLook = (id) => { const e = eraById(id); return e ? { set: e.set, board: e.board, room: e.room } : null; };
  // Called after every move of a dojo game. Returns true once the attempt is decided.
  function dojoCheck(G, info) {
    const d = endgameById(G.setup.dojo);
    if (!d || G.dojoDone) return false;
    const g = G.g, me = G.human, o = g.outcome;
    const firstMine = E.positionFrom(g.startFen, []).side === me;
    const mine = g.moves.filter((_, i) => (i % 2 === 0) === firstMine).length;
    let ok = null, why = '';
    if (o) {
      const w = o.result === '1-0' ? WHITE : o.result === '0-1' ? BLACK : 0;
      ok = w === me || (!w && d.goal === 'draw');
      why = ok ? t(w ? 'learn.dj.mate' : 'learn.dj.drawn') : w ? t('learn.dj.mated') : t('learn.dj.slip', { reason: REASON_TEXT[o.reason] || t('learn.dj.draw') });
    } else if (info && info.captured && Math.sign(info.captured) === me && Math.abs(info.captured) === E.P && d.goal === 'promote') { ok = false; why = t('learn.dj.pawnLost'); }
    else if (info && info.promo && Math.sign(info.mover) === me && d.goal === 'promote') {
      ok = !C.isHanging(g.pos, E.to88(info.to));
      why = t(ok ? 'learn.dj.promoted' : 'learn.dj.queenHangs');
    } else if (info && info.promo && Math.sign(info.mover) === -me) { ok = false; why = t('learn.dj.theyPromoted'); }
    else if (d.goal === 'draw' && mine >= d.par && g.pos.side === me) { ok = true; why = t('learn.dj.held', { n: d.par }); }
    if (ok === null) return false;
    G.dojoDone = true;
    if (!o) g.finish(ok === (me === WHITE) ? '1-0' : '0-1', 'dojo');
    const res = PG.dojoFinished(state.progress, d, ok, mine);
    save(); renderHud();
    AU.play(ok ? 'win' : 'loss');
    if (ok) { view.celebrate('win', -1, null, -1); AU.event('dojo.won'); }
    const j = G.setup.journey, e = j && eraById(j.era);
    const next = ENDGAMES[ENDGAMES.indexOf(d) + 1];
    const m = modal('<div class="result-hero">' + faceImg(e ? eraCoach(e) : COACH) + '<span class="result-badge' + (ok ? ' win' : ' loss') + '">' + (e ? esc(eraName(e)) : t('learn.dojoTitle')) + '</span><h2 class="result-title">' + t(ok ? 'learn.dj.goal' : 'learn.dj.notThisTime') + '</h2>' +
      '<p class="sub">' + esc(why) + ' ' + (ok && d.goal !== 'draw' ? t('learn.dj.score', { n: mine, par: d.par }) : '') + '</p>' + (ok ? '<p class="big-stars">' + stars(res.stars) + '</p>' : '<p class="sub">' + esc(d.tip) + '</p>') +
      '<div class="row" style="justify-content:center">' + (e ? '<button class="btn" id="dj-era">' + icon('journey') + ' ' + t('learn.dj.backTo', { era: esc(eraName(e)) }) + '</button>' : '<button class="btn" id="dj-list">' + t('learn.dj.all') + '</button>') +
      '<button class="btn' + (ok ? '' : ' primary') + '" id="dj-again">' + t('common.tryAgain') + '</button>' +
      (!e && ok && next && !locked(next) ? '<button class="btn primary" id="dj-next">' + t('learn.dj.next', { name: esc(next.name) }) + '</button>' : '') + '</div></div>');
    const on = (id, fn) => { const b = m.querySelector(id); if (b) b.onclick = () => { m.close(); fn(); }; };
    on('#dj-list', () => go('dojo'));
    on('#dj-era', () => go('era', e.id));
    on('#dj-again', () => startDojo(d.id, j));
    on('#dj-next', () => startDojo(next.id));
    celebrate(res);
    if (ok && j) stageDone(j);
    return true;
  }

  // Opening lab: pick a line and drill it until it is automatic.
  SCREENS.openings = function (tab) {
    idleBoard();
    const P = state.progress;
    let side = tab || 'white';
    mount('<div class="page"><div class="page-in">' +
      '<button class="backlink" data-nav="training">' + icon('back') + ' ' + t('learn.sub.training') + '</button>' +
      pageHead(t('learn.sub.training'), t('learn.labTitle'), t('learn.labSub')) +
      '<div class="tabs" role="tablist"><button role="tab" data-side="white">' + icon('pawn') + ' ' + t('learn.asWhite') + '</button><button role="tab" data-side="black">' + icon('pawn') + ' ' + t('learn.asBlack') + '</button></div>' +
      '<div class="list" id="ol"></div></div></div>');
    wireLinks();
    const draw = () => {
      document.querySelectorAll('[data-side]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.side === side)));
      $('ol').innerHTML = OPENINGS.filter((o) => o.side === side).map((o) => {
        const r = P.openings[o.id];
        return '<button class="row-item" data-op="' + o.id + '"' + (locked(o) ? ' disabled' : '') + '><span class="pill">' + esc(o.eco) + '</span><span><b>' + esc(o.name) + '</b><br><small>' + esc(o.summary) + '</small></span>' +
          (locked(o) ? '<span class="pill lock">' + icon('lock') + ' ' + t('common.premium') + '</span>' : r && r.mastered ? '<span class="pill gold">' + icon('check') + ' ' + t('learn.mastered') + '</span>' : '<small>' + (r ? t('learn.clean', { n: r.clean }) : t('learn.moves', { n: o.moves.length / 2 | 0 })) + '</small>') + '</button>';
      }).join('');
      document.querySelectorAll('[data-op]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); go('drill', b.dataset.op); }; });
    };
    document.querySelectorAll('[data-side]').forEach((b) => { b.onclick = () => { side = b.dataset.side; AU.play('tap'); draw(); }; });
    draw();
    return {};
  };

  // ---------------------------------------------------------------- collection
  const CAT_ORDER = ['pieces', 'board', 'room', 'avatar', 'frame', 'capture', 'victory', 'trail', 'clock', 'sound'];
  const CAT_ICON = { pieces: 'pawn', board: 'grid', room: 'home', avatar: 'profile', frame: 'frame', capture: 'sparkle', victory: 'trophy', trail: 'wave', clock: 'clock', sound: 'speaker' };
  const rarity = (it) => (I18N.has('collection.rarity.' + it.rarity) ? t('collection.rarity.' + it.rarity) : it.rarity);
  const eraOfRoom = (r) => CAMPAIGN.eras.find((e) => e.room === r) || null;
  function soundArt(pack) {
    const h = { wood: [5, 9, 6, 11, 7, 4, 8, 10, 6, 4], soft: [3, 5, 4, 6, 5, 3, 4, 5, 3, 2], marble: [8, 12, 7, 13, 9, 6, 11, 12, 8, 5], glass: [6, 10, 13, 8, 12, 9, 13, 7, 10, 6] }[pack] || [5, 8, 6, 9, 7, 5, 8, 9, 6, 4];
    const bars = h.map((v, i) => '<rect x="' + (38 + i * 13) + '" y="' + (80 - v * 3.6) + '" width="7" height="' + (v * 7.2) + '" rx="3.5" fill="url(#g)"/>').join('');
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#e8c27a"/><stop offset="1" stop-color="#8a5a1e"/></linearGradient></defs>' + bars + '</svg>');
  }
  // Every chess set has a signature colour (lapis for the Pharaoh's set, cinnabar for the Ming):
  // its pedestal is covered in it and its card glows with it.
  const setTint = (id) => { const s = setInfo(id); return (s && s.tint) || '#50341f'; };
  const tintStyle = (it) => (it.category === 'pieces' ? ' style="--tint:' + ART.lit(setTint(it.data.set), 0.1) + '"' : '');
  // The picture for an item: real renders for sets, boards and rooms, drawn art for the rest.
  // The 3D scene for a set, board or room: the card picture, and the live model on its card.
  function itemSpec(it) {
    const d = it.data || {};
    if (it.category === 'pieces') { const t = setTint(d.set); return Object.assign(VIGN.trio(d.set, ART.dim(t, 0.3), ART.lit(t, 0.55)), { r: 1.32 }); }
    if (it.category === 'board') return { kind: 'board', board: d.board };
    if (it.category === 'room' && view.rooms()[d.room]) return { kind: 'room', room: d.room };
    return null;
  }
  // The grid's pictures use the pieces' table detail: at card size it looks the same, and the
  // full sculpt took several times as long to build and draw. big: the museum card's picture;
  // cardPic: show the grid card's picture there (already drawn, while the live model loads).
  function itemArt(it, big, cardPic) {
    const d = it.data || {};
    const W = big && !cardPic ? 520 : 260, H = big && !cardPic ? 360 : 180, shown = big && cardPic ? [520, 360] : null;
    const spec = itemSpec(it);
    if (spec && !(big && !cardPic)) spec.detail = 'play';
    if (it.category === 'pieces') return snap(spec, W, H, medal('piece:k', '#8a5a2a', '#2a1408'), 'fit', shown);
    if (it.category === 'board') return snap(spec, W, H, medal('emblem:crown', '#5c3a1e', '#1e120a'), 'cover', shown);
    if (it.category === 'room') {
      const e = eraOfRoom(d.room);
      const fallback = e ? ART.bannerUri(e.landmark, { from: e.colors[0], to: e.colors[1] }) : BLANK;
      return spec ? snap(spec, W, H, fallback, 'cover', shown) : '<img class="cover" src="' + fallback + '" alt="">';
    }
    if (it.category === 'avatar') return '<img class="port" src="' + medal(d.art, d.from, d.to) + '" alt="">';
    if (it.category === 'frame') return avatarHtml(big ? 'xl' : 'lg', PG.equipped(state.progress, 'avatar').id, it.id);
    if (it.category === 'capture' || it.category === 'victory') return '<img class="cover" src="' + ART.fxUri(d.kind, d.colors) + '" alt="">';
    if (it.category === 'trail') return '<img class="cover" src="' + ART.fxUri(it.data ? 'trail' : 'none', d.colors) + '" alt="">';
    if (it.category === 'clock') return '<img class="cover" src="' + ART.clockUri(d) + '" alt="">';
    return '<img class="cover" src="' + soundArt(d.pack) + '" alt="">';
  }
  SCREENS.collection = function (cat) {
    idleBoard();
    const P = state.progress;
    let active = CAT_ORDER.includes(cat) ? cat : 'pieces', q = '', filter = 'all';
    const owned = () => CATALOG.items.filter((i) => PG.isUnlocked(P, i)).length;
    mount('<div class="page"><div class="page-in">' +
      pageHead(t('common.nav.collection'), t('collection.title'), t('collection.sub'), '<span id="c-meter">' + meter(owned(), CATALOG.items.length, t('collection.collected')) + '</span>') +
      '<div class="cats glass" role="tablist">' + CAT_ORDER.map((c) => '<button role="tab" data-cat="' + c + '">' + icon(CAT_ICON[c]) + '<span>' + t('collection.cat.' + c) + '</span></button>').join('') + '</div>' +
      '<div class="col-tools"><label class="search">' + icon('search') + '<input id="c-q" type="search" placeholder="' + t('collection.search') + '" autocomplete="off" aria-label="' + t('collection.search') + '"></label>' +
      '<div class="seg" id="c-f">' + ['all', 'owned', 'locked'].map((v, k) => '<label><input type="radio" name="cf" value="' + v + '"' + (k ? '' : ' checked') + '><span>' + t('collection.filter.' + v) + '</span></label>').join('') + '</div></div>' +
      '<div class="items" id="items"></div>' +
      '</div></div>');
    wireLinks();
    function render() {
      document.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === active)));
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const items = CATALOG.items.filter((i) => (words.length ? true : i.category === active) &&
        words.every((w) => (i.name + ' ' + i.desc + ' ' + i.category + ' ' + catName(i.category)).toLowerCase().includes(w)) &&
        (filter === 'all' || (filter === 'owned') === PG.isUnlocked(P, i)));
      $('items').innerHTML = items.length ? items.map((it) => {
        const un = PG.isUnlocked(P, it), on = P.equipped[it.category] === it.id;
        return '<div class="item' + (on ? ' on' : '') + (un ? '' : ' locked') + '" data-item="' + it.id + '"><button class="sw" aria-label="' + esc(it.name) + '"' + tintStyle(it) + '>' + itemArt(it) + '</button>' +
          '<span class="rar ' + it.rarity + '">' + rarity(it) + '</span>' +
          '<div class="ib"><b>' + esc(it.name) + '</b><span class="d">' + esc(it.desc) + '</span><span class="st">' +
          (un ? '<span>' + (on ? icon('check') + ' ' + t('collection.equipped') : t('collection.filter.owned')) + '</span>' : '<span class="lk">' + icon('lock') + ' ' + esc(unlockText(it)) + '</span>') +
          '<button class="round sm eye" data-peek="' + it.id + '" aria-label="' + t('collection.tryName', { name: esc(it.name) }) + '" title="' + t('collection.try') + '">' + icon('eye') + '</button></span></div></div>';
      }).join('') : '<p class="muted">' + t('collection.none') + '</p>';
      hydrate($('items'), true);
      $('items').querySelectorAll('.item').forEach((el) => {
        el.onclick = (e) => {
          const it = PG.item(el.dataset.item);
          AU.play('tap');
          if (e.target.closest('[data-peek]')) peek(it); else itemModal(it, render, items);
        };
      });
      $('c-meter').innerHTML = meter(owned(), CATALOG.items.length, t('collection.collected'));
    }
    document.querySelectorAll('[data-cat]').forEach((b) => { b.onclick = () => { active = b.dataset.cat; q = ''; $('c-q').value = ''; AU.play('tap'); render(); }; });
    $('c-q').oninput = (e) => { q = e.target.value; render(); };
    $('c-f').onchange = (e) => { filter = e.target.value; render(); };
    render();
    return { refresh: render };
  };
  // The museum card: the story of a set and of each of its pieces, or an item's details.
  // list: the items on show, so the arrows, the arrow keys and a swipe step through them.
  function itemModal(it, after, list) {
    const P = state.progress;
    list = list && list.includes(it) ? list : [it];
    let at = list.indexOf(it), live = null;
    const many = list.length > 1;
    const m = modal('<div class="museum"><div class="stagecol"><div class="stagebox" id="mu-stage"></div>' +
      (many ? '<button class="round mu-nav prev" aria-label="' + t('collection.prevItem') + '">' + icon('prev') + '</button><button class="round mu-nav next" aria-label="' + t('collection.nextItem') + '">' + icon('next') + '</button><span class="mu-count" id="mu-count"></span>' : '') +
      '</div><div id="mu-info"></div></div>', { cls: 'wide', x: true, onClose: () => { document.removeEventListener('keydown', keys, true); if (live) live.stop(); } });
    const stageEl = m.querySelector('#mu-stage'), info = m.querySelector('#mu-info');
    function fill(it, dir) {
      const un = PG.isUnlocked(P, it), on = P.equipped[it.category] === it.id;
      const d = it.data || {};
      const set = it.category === 'pieces' ? setInfo(d.set) : null;
      info.innerHTML = '<div class="eyebrow">' + esc(catName(it.category)) + '</div><h2>' + esc(it.name) + '</h2>' +
        '<div class="facts"><span class="rar ' + it.rarity + '">' + rarity(it) + '</span>' + (set ? '<span class="pill gold">' + esc(set.era) + '</span><span class="pill">' + esc(set.year) + '</span>' : '') + '</div>' +
        '<p class="lore">' + esc(set ? set.story : it.desc) + '</p>' +
        (set ? '<div class="pieces">' + ['k', 'q', 'b', 'n', 'r', 'p'].map((pt) => '<button data-pt="' + pt + '" aria-pressed="false" title="' + PIECE_NAME[pt] + '">' + snap({ kind: 'piece', set: d.set, type: pt, side: 'w' }, 84, 104, ART.pieceUri(pt)) + '</button>').join('') + '</div>' +
          '<p class="plore" id="mu-lore">' + t('collection.tapPiece') + '</p>' : '') +
        '<p class="fine">' + (un ? (on ? icon('check') + ' ' + t('collection.equippedDot') : t('collection.yours')) : icon('lock') + ' ' + t('collection.toUnlock', { how: esc(unlockText(it)) })) + '</p>' +
        '<div class="row" style="justify-content:flex-start">' + (un && !on ? '<button class="btn primary" id="mu-eq">' + icon('check') + ' ' + t('collection.equip') + '</button>' : '') +
        '<button class="btn outline" id="mu-try">' + icon('eye') + ' ' + t('collection.try') + '</button></div>';
      if (dir) { info.classList.remove('in-l', 'in-r'); void info.offsetWidth; info.classList.add(dir < 0 ? 'in-l' : 'in-r'); }
      if (many) m.querySelector('#mu-count').textContent = t('collection.count', { n: at + 1, of: list.length });
      // The picture is only a placeholder: the item itself turns on the stage in real 3D.
      if (live) { live.stop(); live = null; }
      stageEl.setAttribute('style', tintStyle(it).replace(/^ style="|"$/g, ''));
      const spec = itemSpec(it), staged = !!(spec && view.stage);
      stageEl.innerHTML = itemArt(it, true, staged);
      hydrate(m);
      live = spec && view.stage ? view.stage(stageEl, spec, 520 / 360) : null;
      if (live) stageEl.insertAdjacentHTML('beforeend', '<span class="hint3d">' + icon('rotate') + ' ' + t('collection.drag') + '</span>');
      info.querySelectorAll('[data-pt]').forEach((b) => {
        b.onclick = () => {
          const pt = b.dataset.pt;
          AU.play('select');
          info.querySelectorAll('[data-pt]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          info.querySelector('#mu-lore').innerHTML = '<b>' + t('collection.thePiece', { piece: PIECE_NAME[pt] }) + '</b> ' + esc(set.lore[pt]);
          const one = { kind: 'piece', set: d.set, type: pt, side: pt === 'q' || pt === 'b' ? 'b' : 'w' };
          if (live) { live.show(one, 360 / 400); return; }
          stageEl.innerHTML = snap(one, 360, 400, ART.pieceUri(pt), 'fit');
          hydrate(stageEl);
        };
      });
      const eq = info.querySelector('#mu-eq');
      if (eq) eq.onclick = () => { PG.equip(P, it); save(); applyLook(); AU.play('select'); toast(t('collection.equippedToast', { name: esc(it.name) })); m.close(); renderNav(); if (after) after(); };
      info.querySelector('#mu-try').onclick = () => { m.close(); peek(it); };
    }
    function step(dir) {
      if (!many) return;
      at = (at + dir + list.length) % list.length;
      AU.play('tap');
      fill(list[at], dir);
    }
    function keys(e) {
      if ([...document.querySelectorAll('.modal')].pop() !== m || /input|textarea|select/i.test(e.target.tagName || '')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); step(e.key === 'ArrowLeft' ? -1 : 1); }
    }
    if (many) {
      m.querySelector('.mu-nav.prev').onclick = () => step(-1);
      m.querySelector('.mu-nav.next').onclick = () => step(1);
      document.addEventListener('keydown', keys, true);
      // A sideways swipe anywhere but the 3D stage (where a drag turns the model) moves on.
      let sw = null;
      const card = m.querySelector('.card');
      card.addEventListener('pointerdown', (e) => { sw = e.target.closest('canvas, .pieces') ? null : { x: e.clientX, y: e.clientY }; });
      card.addEventListener('pointerup', (e) => {
        if (!sw) return;
        const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
        sw = null;
      });
      card.addEventListener('pointercancel', () => { sw = null; });
    }
    fill(it, 0);
  }

  // ---------------------------------------------------------------- profile
  SCREENS.profile = function (section) {
    idleBoard();
    const P = state.progress, st = P.stats, lv = PG.levelFor(P.xp);
    const acc = st.accuracy.length ? Math.round(st.accuracy.reduce((a, b) => a + b, 0) / st.accuracy.length) + '%' : '–';
    const eras = CAMPAIGN.eras.filter((e) => PG.journeyInfo(P, e.id).done).length;
    const rate = st.games ? Math.round(st.wins / st.games * 100) + '%' : '–';
    const got = Object.keys(P.achievements).length;
    const stat = (ic, label, v) => '<div class="stat"><span class="ic">' + icon(ic) + '</span><span><small>' + label + '</small><b>' + v + '</b></span></div>';
    mount('<div class="page"><div class="page-in">' +
      '<section class="pbanner glass"><button class="pav" id="pf-av" aria-label="' + t('profile.changePic') + '">' + avatarHtml('xl') + '<span class="round sm">' + icon('edit') + '</span></button>' +
      '<div class="who"><div class="eyebrow">' + esc(levelTitle(lv)) + ' · ' + t('common.level', { n: lv.level }) + '</div><h1>' + esc(myName()) + ' <button class="round sm" id="pf-name" aria-label="' + t('profile.changeName') + '">' + icon('edit') + '</button></h1>' +
      '<div class="xp"><div class="bar"><i style="width:' + Math.round(lv.into / lv.need * 100) + '%"></i></div><small>' + t('profile.xpTo', { n: lv.into, of: lv.need, level: lv.level + 1 }) + '</small></div>' +
      '<div class="chips">' + (P.streak.count > 1 ? '<span class="pill gold">' + icon('flame') + ' ' + t('profile.streak', { n: P.streak.count }) + '</span>' : '') +
      '<span class="pill">' + icon('journey') + ' ' + t('profile.eras', { n: eras, of: CAMPAIGN.eras.length }) + '</span>' + (P.premium ? '<span class="pill gold">' + icon('crown') + ' ' + t('common.premium') + '</span>' : '') + '</div></div></section>' +
      '<section class="stats glass"><div class="stat big"><span class="ic">' + icon('star') + '</span><small>' + t('profile.stat.rating') + '</small><b>' + st.puzzles.rating + '</b></div>' +
      stat('swords', t('profile.stat.games'), st.games) + stat('trophy', t('profile.stat.wins'), st.wins) + stat('percent', t('profile.stat.rate'), rate) + stat('flame', t('profile.stat.streak'), P.streak.count) +
      stat('learn', t('profile.stat.lessons'), Object.keys(P.lessons).length) + stat('puzzle', t('profile.stat.puzzles'), st.puzzles.solved) + stat('chart', t('profile.stat.accuracy'), acc) + stat('collection', t('profile.stat.collected'), CATALOG.items.filter((i) => PG.isUnlocked(P, i)).length) +
      '</section>' +
      sec('medal', t('profile.achievements'), t('collection.count', { n: got, of: PG.ACHIEVEMENTS.length })) +
      '<div class="ach">' + PG.ACHIEVEMENTS.map((a) => '<div class="badge' + (P.achievements[a.id] ? ' got' : '') + '"><i>' + (P.achievements[a.id] ? '★' : '☆') + '</i><div><b>' + esc(achName(a)) + '</b><small>' + esc(achDesc(a)) + '</small></div></div>').join('') + '</div>' +
      '<h2 class="sec" id="games">' + icon('refresh') + '<span>' + t('learn.recent') + '</span></h2>' +
      '<div class="list">' + (P.history.length ? P.history.map(gameRow).join('') : '<p class="muted">' + t('profile.noGames') + '</p>') + '</div>' +
      '<h2 class="sec" id="acct">' + icon('globe') + '<span>' + t('profile.account') + '</span></h2><div class="panel glass" id="pf-account"></div>' +
      sec('crown', t('common.premium')) + '<div class="panel glass">' + premiumLine() +
      '<label class="toggle">' + t('profile.preview') + ' <input type="checkbox" id="pf-prem"' + (state.settings.previewPremium ? ' checked' : '') + '></label></div>' +
      '</div></div>');
    wireLinks();
    wireGames(P.history);
    $('pf-av').onclick = () => { AU.play('tap'); go('collection', 'avatar'); };
    $('pf-name').onclick = () => {
      const m = modal('<div class="eyebrow">' + t('common.nav.profile') + '</div><h2>' + t('profile.nameTitle') + '</h2><form id="nm"><div class="field"><label for="nm-v">' + t('profile.nameLabel') + '</label><input class="text-in" id="nm-v" maxlength="20" value="' + esc(myName()) + '" autofocus></div>' +
        '<p class="fine">' + t('profile.nameFine') + '</p><div class="row"><button type="button" class="btn" data-close>' + t('common.cancel') + '</button><button class="btn primary">' + t('common.save') + '</button></div></form>');
      m.querySelector('#nm').onsubmit = (e) => { e.preventDefault(); const v = m.querySelector('#nm-v').value.trim().slice(0, 20); if (v) { state.settings.name = v; save(); m.close(); toast(t('profile.nameSaved')); go('profile'); } };
    };
    $('pf-prem').onchange = (e) => { state.settings.previewPremium = e.target.checked; setEntitlements(state.account && state.account.ent); save(); toast(t(e.target.checked ? 'profile.previewOn' : 'profile.previewOff')); go('profile'); };
    $('pf-store').onclick = () => go('store');
    if (window.ChacklateNet) ChacklateNet.renderAccount($('pf-account')); else $('pf-account').innerHTML = '<p class="muted">' + t('profile.noOnline') + '</p>';
    if (section === 'games') setTimeout(() => $('games').scrollIntoView({ behavior: 'smooth' }), 120);
    if (section === 'account') setTimeout(() => $('acct').scrollIntoView({ behavior: 'smooth' }), 120);
    return {};
  };
  function premiumLine() {
    const e = (state.account && state.account.ent) || {};
    const what = e.premium ? (e.premiumUntil === 'lifetime' ? t('store.lifetime') : t('store.until', { date: I18N.date(new Date(e.premiumUntil)) })) : t((e.passes || []).length ? 'store.freePass' : 'store.free');
    return '<div class="acct-row"><span class="sg gold">' + icon('crown') + '</span><span style="flex:1"><b>' + esc(what) + '</b><br><small class="muted">' + t('store.belong') + '</small></span><button class="btn small gold" id="pf-store">' + t('store.store') + '</button></div>';
  }

  // ---------------------------------------------------------------- season
  function seasonSwatch(it) {
    const d = it.data || {};
    if (it.category === 'avatar') return '<img src="' + medal(d.art, d.from, d.to) + '" alt="">';
    if (it.category === 'pieces' || it.category === 'board' || it.category === 'room' || it.category === 'sound') return itemArt(it);
    if (it.category === 'frame') return '<span class="ringdot" style="background:' + d.ring + '"></span>';
    if (it.category === 'clock') return '<img src="' + ART.clockUri(d) + '" alt="">';
    if (it.category === 'capture' || it.category === 'victory') return '<img src="' + ART.fxUri(d.kind, d.colors) + '" alt="">';
    if (it.category === 'trail') return '<img src="' + ART.fxUri(it.data ? 'trail' : 'none', d.colors) + '" alt="">';
    return icon(CAT_ICON[it.category] || 'star');
  }
  SCREENS.season = function () {
    idleBoard();
    const P = state.progress;
    const id = P.season || (PG.SEASONS.seasons[PG.SEASONS.seasons.length - 1] || {}).id;
    const s = id && PG.seasonInfo(P, id);
    if (!s) { mount('<div class="page"><div class="page-in">' + pageHead(t('season.eyebrow'), t('season.title'), t('season.soon')) + '</div></div>'); return {}; }
    const at = (tier, track) => s.items.find((i) => i.unlock.tier === tier && i.unlock.track === track);
    const cell = (it, track, reached) => {
      if (!it) return '<div class="tcell empty"></div>';
      const un = PG.isUnlocked(P, it);
      return '<button class="tcell' + (un ? ' got' : '') + (track === 'pass' ? ' pass' : '') + '" data-item="' + it.id + '"><span class="sw">' + seasonSwatch(it) + '</span><span><b>' + esc(it.name) + '</b><small>' +
        esc(catName(it.category)) + ' · ' + (un ? t('season.unlocked') : reached && track === 'pass' ? t('season.needsPass') : t('home.season.tier', { n: it.unlock.tier })) + '</small></span></button>';
    };
    const rows = [];
    for (let n = 1; n <= s.season.tiers; n++) {
      const f = at(n, 'free'), p = at(n, 'pass');
      if (!f && !p) continue;
      const reached = s.tier >= n;
      rows.push('<div class="tier' + (reached ? ' reached' : '') + (s.tier + 1 === n ? ' next' : '') + '"><div class="tn">' + n + '</div>' + cell(f, 'free', reached) + cell(p, 'pass', reached) + '</div>');
    }
    mount('<div class="page"><div class="page-in">' +
      pageHead(t('home.season.strip', { n: s.season.number, date: seasonEnd(s.season) }), seasonName(s.season), esc(tx('content.season.' + s.season.id + '.blurb', s.season.blurb)), '<div class="meter">' + icon('season') + '<b>' + t('home.season.tier', { n: '<em>' + s.tier + '</em>' }) + ' / ' + s.season.tiers + '</b><div class="bar"><i style="width:' + Math.round(s.into / s.need * 100) + '%"></i></div></div>') +
      (s.pass ? '<p class="pill gold">' + icon('crown') + ' ' + t(P.premium ? 'season.passIncluded' : 'season.passOwned') + '</p>'
        : '<div class="pass-cta"><div><b>' + t('season.pass') + '</b><small>' + t('season.passText', { n: s.items.filter((i) => i.unlock.track === 'pass').length }) + '</small></div><button class="btn gold" id="se-buy">' + t('store.more.ask') + '</button></div>') +
      '<div class="panel glass"><div class="tier head"><div class="tn"></div><div class="eyebrow">' + t('season.free') + '</div><div class="eyebrow">' + t('season.pass') + '</div></div>' + rows.join('') + '</div>' +
      '<p class="fine">' + t('season.fine') + '</p></div></div>');
    hydrate(null, true);
    wireLinks();
    const b = $('se-buy'); if (b) b.onclick = () => go('store', 'pass.' + id);
    document.querySelectorAll('[data-item]').forEach((el) => { el.onclick = () => { AU.play('tap'); itemModal(PG.item(el.dataset.item)); }; });
    return {};
  };

  // ---------------------------------------------------------------- store
  const money = (p) => !p ? t('store.priceLater') : new Intl.NumberFormat(I18N.lang === 'hi' ? 'hi-IN' : 'en-IN', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.amount / 100);
  SCREENS.store = function (focus) {
    idleBoard();
    const P = state.progress;
    let remote = null;
    function render() {
      if (Date.now() - gatePassed >= 10 * 60e3) {
        $('st-body').innerHTML = '<div class="gate"><img class="portrait" src="' + face(COACH) + '" alt=""><div><b>' + t('store.grownups') + '</b><p class="muted">' + t('store.askParent') + '</p></div><button class="btn primary" id="st-gate">' + icon('lock') + ' ' + t('store.parentOpen') + '</button></div>';
        $('st-gate').onclick = async () => { if (await parentGate(t('store.gateWhy'))) render(); };
        return;
      }
      if (safety && safety.kind === 'minor' && safety.purchases === 'off') {
        $('st-body').innerHTML = '<p class="sub">' + t('store.off') + '</p>';
        return;
      }
      const ent = (state.account && state.account.ent) || {};
      const online = netOn();
      const products = STORE.products.map((p) => Object.assign({}, p, remote ? remote.products.find((r) => r.id === p.id) : { onSale: false }));
      const owned = (p) => p.id.startsWith('pass.') ? PG.hasPass(P, p.id.slice(5)) : p.id === 'premium.lifetime' ? ent.premiumUntil === 'lifetime' : false;
      const status = ent.premium ? (ent.premiumUntil === 'lifetime' ? t('store.lifetime') : t('store.until', { date: I18N.date(new Date(ent.premiumUntil)) })) : t(state.settings.previewPremium ? 'store.previewStatus' : 'store.freeStatus');
      $('st-body').innerHTML =
        '<div class="hero-card"><span class="sg big gold">' + icon('crown') + '</span><span style="flex:1"><span class="eyebrow">' + t('store.yourPlan') + '</span><b class="plan">' + esc(status) + '</b></span></div>' +
        '<ul class="perks">' + STORE.perks.map((p, k) => '<li>' + icon('check') + esc(t('store.perk' + k)) + '</li>').join('') + '</ul>' +
        '<div class="products">' + products.map((p) => '<div class="product' + (p.id === focus ? ' focus' : '') + '">' + (p.badge ? '<span class="pbadge">' + esc(tx('store.badge.' + p.id, p.badge)) + '</span>' : '') +
          '<span class="eyebrow plain">' + esc(p.kind === 'subscription' ? t('store.every.' + p.period) : t('store.once')) + '</span><b>' + esc(tx('store.name.' + p.id, p.name)) + '</b><div class="price">' + money(p.price) + '</div>' +
          (owned(p) ? '<span class="pill gold">' + t('collection.filter.owned') + '</span>' : '<button class="btn ' + (p.id === 'premium.yearly' || p.id === focus ? 'gold' : '') + '" data-buy="' + p.id + '"' + (p.onSale ? '' : ' disabled') + '>' + t(p.onSale ? 'store.buy' : 'store.atLaunch') + '</button>') + '</div>').join('') + '</div>' +
        '<p class="fine">' + t(!online ? 'store.fine.offline' : remote && remote.mode === 'dev' ? 'store.fine.dev' : remote && remote.mode === 'off' ? 'store.fine.off' : 'store.fine.live') +
        ' ' + t('store.fine.restore') + '</p>' +
        '<div class="row" style="justify-content:flex-start"><button class="btn small" id="st-restore">' + icon('refresh') + ' ' + t('store.restore') + '</button></div>';
      document.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => buy(b.dataset.buy); });
      $('st-restore').onclick = restore;
    }
    async function restore() {
      if (!netOn()) return toast(t('store.connect'), 'bad');
      try { const me = await ChacklateNet.api('/api/me'); setEntitlements(me.entitlements); save(); toast(t(me.entitlements.premium || me.entitlements.passes.length ? 'store.restored' : 'store.nothing')); go('store', focus); }
      catch (e) { toast(esc(e.message), 'bad'); }
    }
    async function buy(id) {
      const acct = state.account || {};
      if (!acct.token || acct.guest) {
        const m = modal('<h2>' + t('store.acct.title') + '</h2><p class="sub">' + t('store.acct.sub') + '</p><div class="row"><button class="btn" data-close>' + t('common.notNow') + '</button><button class="btn primary" id="ca-go">' + t('store.acct.create') + '</button></div>');
        m.querySelector('#ca-go').onclick = () => { m.close(); go('profile', 'account'); };
        return;
      }
      if (!await parentGate(t('store.gateBuy'))) return;
      let pin;
      if (isMinor()) { pin = await askPin(); if (pin === null) return; }
      try {
        const o = await ChacklateNet.api('/api/store/checkout', { product: id, pin });
        const p = STORE.products.find((x) => x.id === id);
        if (o.action.type === 'dev-confirm') {
          const m = modal('<h2>' + t('store.test.title') + '</h2><p class="sub">' + esc(tx('store.name.' + p.id, p.name)) + (p.period ? ' (' + t('store.every.' + p.period) + ')' : '') + '. ' + t('store.test.sub') + '</p><div class="row"><button class="btn" data-close>' + t('common.cancel') + '</button><button class="btn gold" id="tp-ok">' + t('common.confirm') + '</button></div>');
          m.querySelector('#tp-ok').onclick = async () => {
            m.close();
            try { const r = await ChacklateNet.api('/api/store/dev/complete', { order: o.order }); thanks(p, r.entitlements); } catch (e) { toast(esc(e.message), 'bad'); }
          };
        } else if (o.action.type === 'redirect' && o.action.url) {
          window.open(o.action.url, '_blank', 'noopener');
          const m = modal('<h2>' + t('store.pay.title') + '</h2><p class="sub">' + t('store.pay.sub') + '</p><div class="row"><button class="btn" data-close>' + t('common.close') + '</button><button class="btn primary" id="pp-check">' + t('store.pay.paid') + '</button></div>');
          m.querySelector('#pp-check').onclick = async () => { const me = await ChacklateNet.api('/api/me'); if (me.entitlements.premium || me.entitlements.passes.length) { m.close(); thanks(p, me.entitlements); } else toast(t('store.pay.wait')); };
        }
      } catch (e) { toast(esc(e.message), 'bad'); }
    }
    function thanks(p, ent) {
      setEntitlements(ent); save();
      AU.play('levelUp');
      const pass = p.id.startsWith('pass.');
      modal('<div class="result-hero"><img class="portrait" src="' + medal('emblem:crown', '#ffd27a', '#b8862b') + '" alt=""><span class="result-badge win">' + t('store.thanks') + '</span><h2 class="result-title">' + t(pass ? 'store.passUnlocked' : 'store.welcome') + '</h2>' +
        '<p class="sub">' + t(pass ? 'store.passText' : 'store.welcomeText') + '</p>' +
        '<div class="row" style="justify-content:center"><button class="btn primary" data-close>' + t('common.letsPlay') + '</button></div></div>', { onClose() { go(pass ? 'season' : 'home'); } });
    }
    mount('<div class="page"><div class="page-in">' + pageHead(t('store.store'), t('store.title'), t('store.sub')) +
      '<div class="panel glass" id="st-body"></div></div></div>');
    wireLinks();
    render();
    if (netOn()) ChacklateNet.api('/api/store').then((r) => { remote = r; if (state.screen === 'store') render(); }).catch(() => {});
    return {};
  };

  // ---------------------------------------------------------------- settings
  function voiceSection(s) {
    const vs = AU.voices();
    const opt = (v, cur) => '<option value="' + v.id + '"' + (cur === v.id ? ' selected' : '') + '>' + esc(v.name) + ' · ' + esc(tx('settings.voiceBlurb.' + v.id, v.blurb)) + '</option>';
    return '<div class="label set-h">' + t('settings.voices') + '</div>' +
      '<label class="toggle">' + t('settings.narration') + ' <input type="checkbox" id="s-narr"' + (s.narration ? ' checked' : '') + '></label>' +
      '<label class="toggle">' + t('settings.guideCard') + ' <input type="checkbox" id="s-guide"' + (s.guide ? ' checked' : '') + '></label>' +
      '<label class="toggle">' + t('settings.coachVoice') + ' <select id="s-vcoach">' + vs.filter((v) => v.lessons).map((v) => opt(v, s.voiceCoach)).join('') + '<option value="device"' + (s.voiceCoach === 'device' ? ' selected' : '') + '>' + t('settings.deviceVoice') + '</option></select></label>' +
      '<label class="toggle">' + t('settings.calls') + ' <select id="s-vcalls">' + vs.map((v) => opt(v, s.voiceCalls)).join('') + '<option value="off"' + (s.voiceCalls === 'off' ? ' selected' : '') + '>' + t('settings.off') + '</option></select></label>' +
      '<label class="toggle">' + t('settings.announce') + ' <input type="checkbox" id="s-announce"' + (s.announce ? ' checked' : '') + '></label>';
  }
  function settingsModal() {
    const s = state.settings;
    const m = modal('<div class="eyebrow">' + t('settings.title') + '</div><h2>' + t('settings.title') + '</h2><p class="sub">' + t('settings.sub') + '</p>' +
      '<div class="label set-h">' + t('settings.language') + '</div>' +
      '<label class="toggle">' + t('settings.languageLabel') + ' <select id="s-lang">' + I18N.LANGS.map((l) => '<option value="' + l.id + '" lang="' + l.id + '"' + (s.lang === l.id ? ' selected' : '') + '>' + esc(l.native === l.name ? l.native : l.native + ' · ' + l.name) + '</option>').join('') + '</select></label>' +
      '<div class="label set-h">' + t('settings.graphics') + '</div><div class="seg"><label><input type="radio" name="q" value="high"' + (s.quality === 'high' ? ' checked' : '') + '><span>' + t('settings.high') + '</span></label><label><input type="radio" name="q" value="low"' + (s.quality === 'low' ? ' checked' : '') + '><span>' + t('settings.low') + '</span></label></div>' +
      '<label class="toggle">' + t('settings.anim') + ' <input type="checkbox" id="s-anim"' + (s.animations ? ' checked' : '') + '></label>' +
      '<label class="toggle">' + t('settings.cine') + ' <input type="checkbox" id="s-cine"' + (s.captureScenes ? ' checked' : '') + '></label>' +
      '<div class="label set-h">' + t('settings.sound') + '</div>' +
      '<label class="toggle">' + t('settings.sfx') + ' <input type="range" id="s-sfxv" min="0" max="1" step="0.05" value="' + s.sfxVol + '" aria-label="' + t('settings.sfxVol') + '"><input type="checkbox" id="s-sfx"' + (s.sfx ? ' checked' : '') + ' aria-label="' + t('settings.sfxOn') + '"></label>' +
      '<label class="toggle">' + t('settings.music') + ' <input type="range" id="s-musv" min="0" max="1" step="0.05" value="' + s.musicVol + '" aria-label="' + t('settings.musicVol') + '"><input type="checkbox" id="s-mus"' + (s.music ? ' checked' : '') + ' aria-label="' + t('settings.musicOn') + '"></label>' +
      voiceSection(s) +
      '<div class="label set-h">' + t('settings.coaching') + '</div>' +
      '<label class="toggle">' + t('settings.comments') + ' <select id="s-coach">' + ['off', 'quiet', 'normal', 'chatty'].map((v) => '<option value="' + v + '"' + (s.coach === v ? ' selected' : '') + '>' + t('settings.coach.' + v) + '</option>').join('') + '</select></label>' +
      '<label class="toggle">' + t('settings.eval') + ' <input type="checkbox" id="s-eval"' + (s.evalBar ? ' checked' : '') + '></label>' +
      '<label class="toggle">' + t('settings.legal') + ' <input type="checkbox" id="s-legal"' + (s.legal ? ' checked' : '') + '></label>' +
      '<label class="toggle">' + t('settings.turn') + ' <input type="checkbox" id="s-turn"' + (s.turnBoard ? ' checked' : '') + '></label>' +
      appSection() +
      '<div class="field" style="margin-top:14px"><label for="s-server">' + t('settings.server') + '</label><input class="text-in" id="s-server" placeholder="' + t('settings.serverHint') + '" value="' + esc(s.server) + '"></div>' +
      '<div class="row"><button class="btn warn" id="s-reset">' + t('settings.reset') + '</button><button class="btn primary" data-close>' + t('common.done') + '</button></div>', { x: true });
    const on = (id, ev, fn) => m.querySelector(id).addEventListener(ev, fn);
    m.querySelectorAll('input[name=q]').forEach((r) => r.addEventListener('change', () => { s.quality = r.value; applySettings(); save(); }));
    // A new language: Hindi brings Priya for the game calls; the coach voice stays. The menus redraw.
    on('#s-lang', 'change', (e) => { s.lang = I18N.set(e.target.value); coachLanguage(); s.voiceCalls = callsFor(s.lang, s.voiceCalls); applySettings(); save(); m.close(); relocalise(); settingsModal(); });
    on('#s-anim', 'change', (e) => { s.animations = e.target.checked; applySettings(); save(); });
    on('#s-cine', 'change', (e) => { s.captureScenes = e.target.checked; save(); });
    on('#s-sfx', 'change', (e) => { s.sfx = e.target.checked; applySettings(); save(); });
    on('#s-sfxv', 'input', (e) => { s.sfxVol = +e.target.value; applySettings(); AU.play('move'); save(); });
    on('#s-mus', 'change', (e) => { s.music = e.target.checked; AU.unlock(); applySettings(); save(); renderNav(); });
    on('#s-musv', 'input', (e) => { s.musicVol = +e.target.value; applySettings(); save(); });
    on('#s-narr', 'change', (e) => { setVoice(e.target.checked, true); });
    on('#s-guide', 'change', (e) => { s.guide = e.target.checked; save(); guideTuck(); });
    on('#s-vcoach', 'change', (e) => { s.voiceCoach = e.target.value; applySettings(); save(); AU.unlock(); AU.preview(s.voiceCoach); });
    on('#s-vcalls', 'change', (e) => { s.voiceCalls = e.target.value; applySettings(); save(); AU.unlock(); if (s.voiceCalls !== 'off') AU.preview(s.voiceCalls); });
    on('#s-announce', 'change', (e) => { s.announce = e.target.checked; applySettings(); save(); if (s.announce) { AU.unlock(); AU.announce('Nf3'); } });
    on('#s-coach', 'change', (e) => { s.coach = e.target.value; save(); });
    on('#s-eval', 'change', (e) => { s.evalBar = e.target.checked; save(); renderEval(); applyInsets(); });
    on('#s-legal', 'change', (e) => { s.legal = e.target.checked; save(); refreshHighlights(); });
    on('#s-turn', 'change', (e) => { s.turnBoard = e.target.checked; save(); });
    on('#s-server', 'change', (e) => { s.server = e.target.value.trim(); save(); if (window.ChacklateNet) ChacklateNet.connect(); });
    wireAppSection(m);
    on('#s-reset', 'click', () => { if (confirm(t('settings.resetConfirm'))) { state.progress = PG.fresh(); save(); m.close(); applyLook(); go('home'); } });
  }

  // Redraw everything a player reads in the new language. A game, lesson or puzzle in progress
  // keeps going: only its panels are drawn again.
  function relocalise() {
    renderNav();
    if (KIND[state.screen] === 'hud') { if (current && current.refresh) current.refresh(); if (state.game && state.screen === 'game') { renderTitle(); renderCards(); renderHud(); renderCoach(); } }
    else go(state.screen, state.screenArg);
    if (guideSt.key) guideShow(guideSt.key);
  }

  // ---------------------------------------------------------------- installable app and reminders
  let installPrompt = null, swReg = null;
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
  window.addEventListener('appinstalled', () => { installPrompt = null; toast(t('settings.installed')); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('/sw.js').then((r) => { swReg = r; }).catch(() => { /* not served by the game server: no offline shell */ });
  }
  const pushReady = () => !!(swReg && 'PushManager' in window && window.Notification && netOn());
  function appSection() {
    const s = state.settings, r = s.reminder || { on: false, hour: 19 };
    const hours = Array.from({ length: 24 }, (_, h) => '<option value="' + h + '"' + (r.hour === h ? ' selected' : '') + '>' + String(h).padStart(2, '0') + ':00</option>').join('');
    return '<div class="label set-h">' + t('settings.app') + '</div>' +
      (standalone() ? '<p class="sub" style="margin:0 0 8px">' + t('settings.app.installed') + '</p>'
        : installPrompt ? '<button class="btn" id="s-install" type="button">' + icon('play') + ' ' + t('settings.app.install') + '</button>'
        : isIOS() ? '<p class="sub" style="margin:0 0 8px">' + t('settings.app.ios') + '</p>'
        : '<p class="sub" style="margin:0 0 8px">' + t('settings.app.browser') + '</p>') +
      (safety && !safety.reminders ? '<label class="toggle">' + t('settings.reminder') + ' <small class="faint">' + t('settings.reminder.parent') + '</small><input type="checkbox" disabled></label>' :
      '<label class="toggle">' + t('settings.reminder') + (pushReady() ? '' : ' <small class="faint">' + t('settings.reminder.needs') + '</small>') +
      ' <select id="s-rem-h"' + (pushReady() ? '' : ' disabled') + '>' + hours + '</select><input type="checkbox" id="s-rem"' + (r.on ? ' checked' : '') + (pushReady() ? '' : ' disabled') + '></label>');
  }
  function wireAppSection(m) {
    const ib = m.querySelector('#s-install');
    if (ib) ib.onclick = async () => { const p = installPrompt; installPrompt = null; p.prompt(); try { await p.userChoice; } catch (e) { /* dismissed */ } m.close(); };
    const box = m.querySelector('#s-rem'), hr = m.querySelector('#s-rem-h');
    const apply = async () => {
      const want = { on: box.checked, hour: +hr.value };
      if (want.on && !await parentGate(t('settings.reminder.gate'))) { box.checked = false; return; }
      try { await setReminder(want); state.settings.reminder = want; save(); toast(want.on ? t('settings.reminder.set', { time: String(want.hour).padStart(2, '0') + ':00' }) : t('settings.reminder.off')); }
      catch (e) { box.checked = false; state.settings.reminder = { on: false, hour: want.hour }; save(); toast(esc(e.message), 'bad'); }
    };
    if (box) { box.onchange = apply; hr.onchange = () => { if (box.checked) apply(); }; }
  }
  async function setReminder(r) {
    const sub = await swReg.pushManager.getSubscription();
    if (!r.on) {
      if (sub) { try { await ChacklateNet.api('/api/push/unsubscribe', { endpoint: sub.endpoint }); } catch (e) { /* removed locally anyway */ } await sub.unsubscribe(); }
      return;
    }
    if (await Notification.requestPermission() !== 'granted') throw new Error(t('settings.reminder.blocked'));
    const { publicKey } = await ChacklateNet.api('/api/push/key');
    const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const s = sub || await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await ChacklateNet.api('/api/push/subscribe', { subscription: s.toJSON(), hour: r.hour, tz: -new Date().getTimezoneOffset() });
  }

  function levelUpModal(level, unlocked) {
    AU.play('levelUp');
    const lv = PG.levelFor(state.progress.xp);
    const m = modal('<div class="result-hero">' + avatarHtml('xl') + '<span class="result-badge win">' + t('home.levelUp') + '</span><h2 class="result-title">' + t('common.level', { n: level }) + '</h2><p class="sub">' + t('home.youAreNow', { title: esc(levelTitle(lv)) }) + '</p>' +
      (unlocked.length ? '<div class="eyebrow">' + t('season.unlocked') + '</div><div class="unlocks">' + unlocked.map((u) => '<span class="pill gold">' + esc(u.name) + '</span>').join('') + '</div>' : '') +
      '<div class="row" style="justify-content:center;margin-top:18px">' + (unlocked.length ? '<button class="btn" id="lu-col">' + t('home.seeCollection') + '</button>' : '') + '<button class="btn primary" data-close>' + t('common.continue') + '</button></div></div>');
    if (KIND[state.screen] === 'hud') view.celebrate('win', -1, null, -1);
    const b = m.querySelector('#lu-col'); if (b) b.onclick = () => { m.close(); go('collection', unlocked[0].category); };
  }

  // ---------------------------------------------------------------- game
  // One controller for every game at the table: the animal friends, the era champions, the
  // endgame dojo, pass-and-play and online games.
  function parseTc(tc) {
    if (!tc || tc === 'none') return null;
    const [m, s] = tc.split('+').map(Number);
    return { w: m * 60000, b: m * 60000, inc: s * 1000, since: 0 };
  }
  // The spoken call for a finished game, a key into voice.json events.
  function resultCall(reason, winner, youWon, youLost) {
    if (!winner) return { stalemate: 'stalemate', threefold: 'draw.repetition', fivefold: 'draw.repetition', fifty: 'draw.fifty', seventyfive: 'draw.fifty',
      insufficient: 'draw.material', 'timeout-insufficient': 'draw.material', agreement: 'draw.agreed' }[reason] || 'draw.agreed';
    if (reason === 'resignation') return youLost ? 'resign.loss' : 'resign.win';
    if (reason === 'timeout') return youLost ? 'time.loss' : 'time.win';
    return youLost ? 'mate.loss' : youWon ? 'mate.win' : 'mate.loss';
  }

  function startGame(setup, restore) {
    // Only ordinary games become the defaults for the next one; dojo, journey and online
    // games keep their own setup.
    if (!setup.dojo && !setup.journey && setup.mode !== 'online') state.setup = Object.assign({}, setup);
    const kind = setup.mode;
    let g;
    try { g = new E.Game(setup.fen || E.START_FEN); } catch (e) { g = new E.Game(); }
    const human = restore && restore.human ? restore.human : setup.color === 'black' ? BLACK : setup.color === 'random' ? (Math.random() < 0.5 ? WHITE : BLACK) : WHITE;
    const game = { kind, setup: Object.assign({}, setup), g, human, clock: parseTc(setup.tc), selected: -1, hint: null, hintStep: 0, busy: false, thinking: false, request: 0,
      viewSide: kind === 'local' ? 'white' : human === WHITE ? 'white' : 'black', coachMsg: null, evals: {}, threat: null, resultShown: false, review: null,
      online: setup.online || null, takebacks: 0, drawOffered: false };
    if (setup.online && !restore) setTimeout(() => AU.event('online.found'), 400);
    if (restore) {
      for (const u of restore.moves || []) if (!g.playText(u)) break;
      if (restore.clock && game.clock) Object.assign(game.clock, restore.clock, { since: 0 });
      if (kind === 'local' && state.settings.turnBoard) game.viewSide = g.pos.side === WHITE ? 'white' : 'black';
    }
    state.game = game;
    go('game', game);
    view.setView(game.viewSide, state.settings.view, true);
    if (!g.moves.length) view.intro();
    save();
    // The opponent says hello across the table.
    if (kind === 'ai' && !setup.dojo && !g.moves.length) { const who = rival(game); coachSay(sayLine(who, 'hello'), [[t('play.say.hello'), 'dismiss']], null, who); }
    if (!setup.dojo && !g.moves.length) guideSay(kind === 'local' || human === WHITE ? 'game.white' : 'game.black', { delay: 600 });
    gameNudge(game);
    if (!g.outcome) maybeComputer();
    preAnalyse();
  }
  function resumeSaved() {
    const s = saved.game;
    saved.game = null;
    startGame(Object.assign({}, s.setup || state.setup, { fen: s.start === E.START_FEN ? '' : s.start }), { moves: s.moves, human: s.human, clock: s.clock });
  }

  SCREENS.game = function () {
    const G = state.game;
    view.setAttract(false);
    setLook(G.setup.look || null);
    const online = G.kind === 'online', local = G.kind === 'local';
    const j = G.setup.journey, era = j && eraById(j.era);
    const dojo = G.setup.dojo && endgameById(G.setup.dojo);
    mount(
      '<div class="hud-top"><button class="backbtn" id="g-home">' + icon('back') + '<span>' + esc(era ? eraName(era) : t(dojo ? 'play.hud.endgames' : 'common.nav.home')) + '</span></button>' +
      '<div class="title" id="g-mode"></div><div class="status-chip glass" id="g-chip" role="status"></div><span class="spacer"></span>' +
      '<button class="round" id="g-music" aria-label="' + t('settings.music') + '" aria-pressed="' + !!state.settings.music + '" title="' + t('settings.music') + '">' + icon(state.settings.music ? 'music' : 'musicOff') + '</button>' +
      '<button class="round" id="g-settings" aria-label="' + t('settings.title') + '" title="' + t('settings.title') + '">' + icon('gear') + '</button></div>' +
      '<div class="player-card glass top" id="p-top"></div><div class="player-card glass bottom" id="p-bottom"></div>' +
      '<div class="evalbar" id="evalbar" hidden><i id="evalfill" style="height:50%"></i></div>' +
      '<aside class="side glass" id="side"><header><b id="side-title">' + esc(dojo ? dojo.name : t('play.hud.moves')) + '</b><button class="btn small ghost" id="g-copy" title="' + t('play.hud.copyPgn') + '">PGN</button></header>' +
      '<div id="coach-slot"></div><div class="moves-wrap" id="moves-wrap"><ol class="moves" id="moves" aria-label="' + t('play.hud.played') + '"></ol></div>' +
      '<form id="move-form" class="move-form" autocomplete="off"><label class="sr" for="move-input">' + t('play.hud.type') + '</label><input id="move-input" class="text-in" placeholder="' + t('play.hud.typeHint') + '" spellcheck="false" autocapitalize="off"><button class="btn small">' + t('common.nav.play') + '</button></form></aside>' +
      '<div class="actionbar glass" id="actionbar">' +
      (online ? '' : '<button class="btn" id="g-undo">' + icon('undo') + '<span class="lbl">' + t('play.btn.undo') + '</span></button>') +
      (online ? '' : '<button class="btn" id="g-hint">' + icon('hint') + '<span class="lbl">' + t('play.btn.hint') + '</span></button>') +
      (online ? '' : '<button class="btn" id="g-threat">' + icon('eye') + '<span class="lbl">' + t('play.btn.threat') + '</span></button>') +
      '<span class="sep"></span>' +
      '<button class="btn" id="g-flip">' + icon('flip') + '<span class="lbl">' + t('play.btn.flip') + '</span></button>' +
      '<button class="btn" id="g-view">' + icon('cam') + '<span class="lbl" id="g-view-lbl">' + t('play.btn.topView') + '</span></button>' +
      '<span class="sep"></span>' +
      (online ? '<button class="btn" id="g-emote" aria-haspopup="true">' + icon('smile') + '<span class="lbl">' + t('play.btn.react') + '</span></button>' : '') +
      (local || dojo ? '' : '<button class="btn" id="g-draw">' + icon('draw') + '<span class="lbl">' + t('play.btn.draw') + '</span></button>') +
      '<button class="btn" id="g-resign">' + icon('flag') + '<span class="lbl">' + t('play.btn.resign') + '</span></button>' +
      '<button class="btn primary" id="g-claim" hidden>' + t('play.btn.claim') + '</button>' +
      '<button class="btn primary" id="g-review" hidden>' + icon('star') + '<span>' + t('play.btn.review') + '</span></button>' +
      '<button class="btn" id="g-new" hidden>' + icon('play') + '<span>' + t('play.btn.new') + '</span></button>' +
      '</div>');
    $('g-home').onclick = () => { AU.play('tap'); if (era) go('era', era.id); else if (dojo) go('dojo'); else go('home'); };
    $('g-music').onclick = () => {
      state.settings.music = !state.settings.music; AU.unlock(); applySettings(); save();
      $('g-music').innerHTML = icon(state.settings.music ? 'music' : 'musicOff'); $('g-music').setAttribute('aria-pressed', String(!!state.settings.music));
    };
    $('g-settings').onclick = () => settingsModal();
    $('g-copy').onclick = () => copy(pgn(), 'PGN');
    if ($('g-undo')) $('g-undo').onclick = undo;
    if ($('g-hint')) $('g-hint').onclick = hint;
    if ($('g-threat')) $('g-threat').onclick = showThreat;
    $('g-flip').onclick = () => { AU.play('tap'); G.viewSide = G.viewSide === 'white' ? 'black' : 'white'; view.setView(G.viewSide, state.settings.view); renderCards(); renderHud(); };
    $('g-view').onclick = () => { AU.play('tap'); state.settings.view = state.settings.view === 'top' ? 'player' : 'top'; view.setView(G.viewSide, state.settings.view); save(); renderHud(); };
    if ($('g-draw')) $('g-draw').onclick = offerDraw;
    if ($('g-emote')) $('g-emote').onclick = emotePicker;
    $('g-resign').onclick = resign;
    $('g-claim').onclick = () => { if (G.g.claimDraw()) { G.request++; if (online) ChacklateNet.send({ type: 'claim' }); endGame(); } };
    $('g-review').onclick = () => go('review', { start: G.g.startFen, ucis: G.g.uciMoves(), side: local ? WHITE : G.human, title: titleFor(G), review: G.review, level: G.kind === 'ai' ? G.setup.level : undefined, rival: G.kind === 'ai' ? rival(G) : null });
    $('g-new').onclick = () => newGameModal();
    $('move-form').onsubmit = (e) => {
      e.preventDefault();
      const input = $('move-input'), text = input.value.trim();
      if (!text || !humanTurn()) return;
      const m = G.g.pos.parseMove(text, G.g.legal);
      if (m === null || m === undefined) { toast(t('play.notLegal', { move: esc(text) })); AU.play('illegal'); return; }
      input.value = '';
      playMove(m, true);
    };
    setHooks({
      onSquare: onSquare,
      canDrag: (sq) => humanTurn() && E.pieceAt(G.g.pos, sq) && Math.sign(E.pieceAt(G.g.pos, sq)) === G.g.pos.side,
      onDrop: (from, to) => {
        if (!humanTurn() || !G.g.targets(from).includes(to)) { if (from !== to) AU.play('illegal'); return false; }
        attempt(from, to, true);
        return true;
      },
    });
    view.setBoard(piecesOf(G.g.pos), capturedFor(G.g));
    renderTitle();
    renderCards();
    refreshHighlights();
    renderHud();
    return {
      leave() { view.setClock(null); save(); },
      escape() { if (G.selected >= 0) { G.selected = -1; refreshHighlights(); } },
      key(e) { if (e.key === 'f') $('g-flip').click(); },
    };
  };
  function titleFor(G) {
    if (G.setup.dojo) { const d = endgameById(G.setup.dojo); return t(G.setup.journey ? 'common.nav.journey' : 'learn.dojoTitle') + (d ? ' · ' + d.name : ''); }
    if (G.kind === 'ai') return t('learn.vs', { name: rival(G).name });
    if (G.kind === 'online') return t('play.onlineTitle', { tc: G.online && G.online.tc || G.setup.tc || '' });
    return t('learn.local');
  }
  function renderTitle() {
    const G = state.game, el = $('g-mode');
    if (!G || !el) return;
    const who = G.kind === 'ai' && !G.setup.dojo ? rival(G) : null;
    const art = who ? face(who) : G.setup.dojo ? medal('piece:k', '#5b4a8a', '#2c2248') : G.kind === 'online' ? medal('emblem:crown', '#2f6f6a', '#173b39') : medal('piece:n', '#a3294f', '#5c1328');
    el.innerHTML = '<img class="portrait" src="' + art + '" alt=""><span>' + esc(titleFor(G)) + (G.setup.tc && G.setup.tc !== 'none' && G.kind !== 'online' ? ' · ' + esc(G.setup.tc) : '') + '</span>';
  }

  function capturedFor(g) {
    const out = { byWhite: [], byBlack: [] };
    g.captured.forEach((p) => { if (p) (p < 0 ? out.byWhite : out.byBlack).push(p); });
    return out;
  }
  function humanTurn() {
    const G = state.game;
    if (!G || G.g.outcome || G.busy || G.thinking) return false;
    if (G.kind === 'local') return true;
    return G.g.pos.side === G.human;
  }
  function sideName(G, side) {
    if (G.kind === 'ai') return side === G.human ? myName() : rival(G).name;
    if (G.kind === 'online') return side === G.human ? myName() : (G.online && G.online.opponent ? G.online.opponent.name : t('play.opponent'));
    return t(side === WHITE ? 'play.color.white' : 'play.color.black');
  }
  // Little drawn pieces for the captured row: ivory for White's, ebony with gold for Black's.
  const CAP_INK = { w: { fill: '#f6ecd9', stroke: '#8a7458', ink: '#5a4630' }, b: { fill: '#2b1c14', stroke: '#d9b46a', ink: '#d9b46a' } };
  const capImg = (pt, color) => '<img src="' + ART.pieceUri(pt, CAP_INK[color]) + '" alt="' + t(color === 'w' ? 'play.capWhite' : 'play.capBlack', { piece: PIECE_NAME[pt].toLowerCase() }) + '">';

  // The two players' cards: portrait, name, who they are, the pieces they have taken and
  // their clock. The parts that change each move are filled in by renderHud.
  function renderCards() {
    const G = state.game;
    if (!G || state.screen !== 'game') return;
    const bottomSide = G.viewSide === 'black' ? BLACK : WHITE;
    for (const [id, side] of [['p-bottom', bottomSide], ['p-top', -bottomSide]]) {
      const el = $(id);
      const you = G.kind !== 'local' && side === G.human;
      const ai = G.kind === 'ai' && side !== G.human;
      const opp = G.kind === 'online' && side !== G.human && G.online && G.online.opponent;
      const who = ai ? rival(G) : null;
      let pp, sub;
      if (you) { pp = avatarHtml('sm'); sub = t('common.level', { n: PG.levelFor(state.progress.xp).level }) + (G.online && G.online.rating ? ' · ' + t('play.rating', { n: G.online.rating }) : ''); }
      else if (who) { pp = '<img class="portrait" src="' + face(who) + '" alt="">'; sub = G.setup.dojo ? t('play.fullStrength') : who.era ? t('play.championOf', { era: eraName(eraById(who.era) || { name: '' }) }) : t('common.level', { n: G.setup.level + 1 }) + ' · ' + bandName(G.setup.level); }
      else if (opp) { pp = avatarHtml('sm', opp.avatar, opp.frame); sub = opp.label || t('play.rating', { n: opp.rating || '?' }); }
      else { pp = '<img src="' + (side === WHITE ? medal('piece:k', '#f4e6cc', '#a08a6a') : medal('piece:k', '#4a2c1d', '#140b07')) + '" alt="">'; sub = t(side === WHITE ? 'play.lightPieces' : 'play.darkPieces'); }
      el.innerHTML = '<div class="pp">' + pp + '</div><div class="who"><div class="name">' + esc(sideName(G, side)) + '</div><div class="sub"><span class="tl">' + esc(sub) + '</span></div>' +
        '<div class="taken"><span class="caps"></span><span class="adv"></span></div></div>' +
        '<div class="clock skin-' + (clockSkin ? clockSkin.css : 'classic') + '" data-side="' + side + '"' + (G.clock || G.kind === 'online' ? '' : ' hidden') + '></div>';
      el.dataset.side = side;
    }
    renderClocks();
  }

  function refreshHighlights() {
    const G = state.game;
    if (!G || state.screen !== 'game') return;
    const g = G.g;
    const h = { selected: G.selected, targets: [], captures: [], lastFrom: -1, lastTo: -1, check: -1, hintFrom: -1, hintTo: -1, marks: [] };
    if (g.moves.length) { const last = g.moves[g.moves.length - 1]; h.lastFrom = E.mFrom(last); h.lastTo = E.mTo(last); }
    if (g.pos.inCheck()) h.check = kingSquare(g.pos, g.pos.side);
    if (G.selected >= 0 && state.settings.legal) {
      for (const t of g.targets(G.selected)) {
        const victim = E.pieceAt(g.pos, t);
        const isEp = !victim && Math.abs(E.pieceAt(g.pos, G.selected)) === E.P && (t & 7) !== (G.selected & 7);
        (victim || isEp ? h.captures : h.targets).push(t);
      }
    }
    if (G.hint && G.hintStep >= 2) h.hintFrom = sqIndex(G.hint.from);
    if (G.hint && G.hintStep >= 3) h.hintTo = sqIndex(G.hint.to);
    view.setHighlights(h);
    const arrows = [];
    if (G.hint && G.hintStep >= 3) arrows.push({ from: sqIndex(G.hint.from), to: sqIndex(G.hint.to), color: '#2fd8ff' });
    if (G.threat && G.threat.facts) arrows.push({ from: sqIndex(G.threat.facts.from), to: sqIndex(G.threat.facts.to), color: '#ff5a50' });
    if (G.coachArrow) arrows.push(G.coachArrow);
    view.setArrows(arrows);
  }

  function onSquare(sq) {
    const G = state.game;
    if (!humanTurn()) return;
    const g = G.g;
    const piece = E.pieceAt(g.pos, sq);
    if (G.selected >= 0 && G.selected !== sq && g.targets(G.selected).includes(sq)) { attempt(G.selected, sq); return; }
    if (piece && Math.sign(piece) === g.pos.side) {
      if (G.selected !== sq) AU.play('select');
      G.selected = sq;
      if (!g.targets(sq).length) toast(t('play.noMoves'));
    } else { if (G.selected >= 0 && piece === 0) AU.play('illegal'); G.selected = -1; }
    refreshHighlights();
  }
  function attempt(from, to, dropped) {
    const G = state.game, g = G.g;
    if (g.needsPromotion(from, to)) {
      choosePromotion(g.pos.side, (kind) => {
        const m = kind ? g.find(from, to, kind) : null;
        if (m !== null) playMove(m, true); else view.setBoard(piecesOf(g.pos), capturedFor(g));
      });
      return;
    }
    const m = g.find(from, to, 0);
    if (m !== null) playMove(m, true, dropped);
  }

  // Lessons, drills and puzzles keep moving: their captures skip the capture scene.
  const quickMove = (info, done) => view.animateMove(info, done, { cinema: false });

  function playMove(m, byHuman, dropped) {
    const G = state.game, g = G.g;
    const moverKey = g.pos.side === WHITE ? 'w' : 'b';
    const before = { fen: g.startFen, moves: g.uciMoves(), side: g.pos.side };
    const info = g.play(m);
    if (!info) return;
    if (byHuman) guideIdle(null);
    if (G.kind === 'online' && byHuman) ChacklateNet.send({ type: 'move', uci: E.uci(m), ply: g.moves.length - 1 });
    if (G.kind !== 'online') pressClock(moverKey);
    G.request++;
    G.selected = -1; G.hint = null; G.hintStep = 0; G.threat = null; G.coachArrow = null;
    // The opponent's hello makes way once the game is under way.
    if (G.coachMsg && G.coachMsg.who && !G.coachMsg.cls) G.coachMsg = null;
    G.busy = true;
    const quick = G.clock && G.clock[moverKey] < 10000;   // effects off under 10 s, per the art bible
    // Captures and castling play a short scene, except online, where the server's clock keeps running.
    const cinema = !!(info.captured || info.rook) && !quick && state.settings.captureScenes && G.kind !== 'online';
    const sound = info.check && !g.outcome ? 'check' : info.promo ? 'promote' : cinema ? 'move' : info.rook ? 'castle' : info.captured ? 'capture' : 'move';
    setTimeout(() => AU.play(sound), dropped ? 0 : 140);
    if (!g.outcome) setTimeout(() => AU.announce(info.san).then((said) => { if (!said && info.check) AU.event('check'); }), dropped ? 120 : 260);
    renderHud();
    G.cinema = view.animateMove(info, () => {
      G.busy = false;
      if (G.cinema) { G.cinema = false; if (G.clock) G.clock.since = performance.now(); }
      if (state.game !== G) return;
      view.setBoard(piecesOf(g.pos), capturedFor(g));
      if (G.kind === 'local' && state.settings.turnBoard && !g.outcome) {
        G.viewSide = g.pos.side === WHITE ? 'white' : 'black';
        view.setView(G.viewSide, state.settings.view);
        renderCards();
      }
      refreshHighlights();
      renderHud();
      save();
      if (G.setup.dojo && dojoCheck(G, info)) return;
      if (g.outcome) endGame();
      else { maybeComputer(); gameNudge(G); }
    }, { quick, cinema, onImpact: () => AU.play(info.rook ? 'castle' : 'capture') });
    // the clocks wait while a capture scene plays (local games; see clockRunning)
    if (G.cinema && G.clock) G.clock.since = 0;
    refreshHighlights();
    if (byHuman && G.kind === 'ai') liveCoach(before, info);
    if (!g.outcome) preAnalyse();
  }

  // ----- clocks (local games; online clocks come from the server)
  function clockRunning(G) { return G.clock && !G.g.outcome && G.g.moves.length > 0 && G.kind !== 'online' && !(G.cinema && view.capturePlaying()); }
  function pressClock(moverKey) {
    const G = state.game, c = G.clock;
    if (!c) return;
    const now = performance.now();
    if (G.g.moves.length > 1 && c.since) c[moverKey] = Math.max(0, c[moverKey] - (now - c.since));
    if (G.g.moves.length > 1) c[moverKey] += c.inc;
    c.since = now;
  }
  let lowTick = 0;
  setInterval(() => {
    const G = state.game;
    if (!G || state.screen !== 'game' || !G.clock) return;
    if (clockRunning(G)) {
      const now = performance.now();
      const k = G.g.pos.side === WHITE ? 'w' : 'b';
      if (G.clock.since) G.clock[k] = Math.max(0, G.clock[k] - (now - G.clock.since));
      G.clock.since = now;
      if (G.clock[k] <= 0) { G.request++; G.thinking = false; G.g.timeout(G.g.pos.side); endGame(); }
      else if (G.clock[k] < 10000 && (G.kind === 'local' || G.g.pos.side === G.human) && Date.now() - lowTick > 1000) { lowTick = Date.now(); AU.play('low'); if (!G.lowCalled && G.kind !== 'local') { G.lowCalled = true; AU.event('time.low'); } }
    }
    renderClocks();
  }, 100);
  const fmt = (ms) => { const s = Math.max(0, ms) / 1000; if (s < 10) return s.toFixed(1); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); };

  // ----- the computer
  // The guide helps on the child's turn: a word when their king is in check (the first two times in
  // a game), and the hint button when they have been thinking a long while.
  function gameNudge(G) {
    if (state.game !== G || G.g.outcome || G.kind === 'online' || G.setup.dojo || G.g.pos.side !== G.human && G.kind !== 'local') return;
    if (G.g.pos.inCheck() && (G.checkTips = (G.checkTips || 0) + 1) <= 2) guideSay('game.check', { force: true, delay: 1100 });
    if (G.kind === 'ai') guideIdle('game.idle', 40000);
  }
  function maybeComputer() {
    const G = state.game, g = G.g;
    if (G.kind !== 'ai' || g.outcome || g.pos.side === G.human || G.busy) return;
    const level = LEVELS[G.setup.level];
    let timeMs = level.timeMs;
    if (G.clock) { const left = G.clock[g.pos.side === WHITE ? 'w' : 'b']; timeMs = Math.max(120, Math.min(timeMs, left / 30 + G.clock.inc * 0.6)); }
    G.thinking = true;
    renderHud();
    const started = performance.now();
    const id = ++G.request;
    job('play', { type: 'search', fen: g.startFen, moves: g.uciMoves(), opts: Object.assign({}, level, { timeMs }) }, (r) => {
      if (id !== G.request || state.game !== G) return;
      const delay = Math.max(0, 420 - (performance.now() - started));
      setTimeout(() => {
        if (id !== G.request || state.game !== G) return;
        G.thinking = false;
        const m = r.uci ? g.pos.parseMove(r.uci, g.legal) : null;
        if (m !== null && m !== undefined) playMove(m, false); else renderHud();
      }, delay);
    });
  }

  // ----- the coach (computer games only; never during online play)
  function preAnalyse() {
    const G = state.game;
    if (!G || G.kind === 'online' || G.g.outcome) return;
    const key = G.g.moves.length;
    if (G.evals[key]) return;
    job('analysis', { type: 'analyse', fen: G.g.startFen, moves: G.g.uciMoves(), timeMs: 260 }, (r) => {
      if (r.error || state.game !== G) return;
      G.evals[key] = r;
      renderEval();
    });
  }
  function renderEval() {
    const G = state.game; if (!G) return;
    const bar = $('evalbar'); if (!bar) return;
    const show = state.settings.evalBar && G.kind !== 'online';
    bar.hidden = !show;
    const e = G.evals[G.g.moves.length];
    if (!show || !e) return;
    const white = e.cp * G.g.pos.side;
    $('evalfill').style.height = Math.round(C.winProb(white) * 100) + '%';
    const sideWord = (w) => t(w ? 'play.color.white' : 'play.color.black');
    bar.dataset.tip = t('play.eval.title') + '|' + (e.mate ? t('play.eval.mate', { side: sideWord(e.mate * G.g.pos.side > 0), n: Math.abs(e.mate) })
      : Math.abs(white) < 30 ? t('play.eval.even') : t('play.eval.ahead', { side: sideWord(white > 0), n: (Math.abs(white) / 100).toFixed(1) })) + ' ' + t('play.eval.more');
  }
  function liveCoach(before, info) {
    const G = state.game;
    if (state.settings.coach === 'off') return;
    const ply = G.g.moves.length - 1;
    const wait = (cb, tries) => {
      if (state.game !== G) return;
      const e = G.evals[ply];
      if (e) cb(e); else if (tries > 0) setTimeout(() => wait(cb, tries - 1), 150);
    };
    wait((pre) => {
      job('analysis', { type: 'analyse', fen: G.g.startFen, moves: G.g.uciMoves().slice(0, ply + 1), timeMs: 260 }, (post) => {
        if (post.error || state.game !== G || G.g.moves.length < ply + 1) return;
        G.evals[ply + 1] = G.evals[ply + 1] || post;
        renderEval();
        const isBest = pre.best === info.uci || pre.best === E.uci(info.move);
        const loss = isBest ? 0 : Math.max(0, C.winProb(pre.cp) - C.winProb(-post.cp));
        const pos = E.positionFrom(before.fen, before.moves);
        const m = pos.parseMove(E.uci(info.move));
        const f = C.facts(pos, m);
        const cls = C.classify(loss, isBest, f, -post.cp);
        let text = '', actions = [];
        const lvl = state.settings.coach;
        if (cls === 'blunder' || (cls === 'mistake' && lvl !== 'quiet')) {
          pos.make(m);
          const refut = post.best ? C.facts(pos, pos.parseMove(post.best)) : null;
          pos.unmake();
          const bestM = pre.best ? pos.parseMove(pre.best) : null;
          const ex = C.explain({ cls, side: before.side, san: info.san, facts: f, refutation: refut, bestSan: pre.bestSan || (bestM ? pos.san(bestM, pos.legalMoves()) : ''), bestFacts: bestM ? C.facts(pos, bestM) : null, mateAgainst: post.mate > 0 ? post.mate : 0, missedMate: 0 });
          text = t(cls === 'blunder' ? 'play.coach.careful' : 'play.coach.hmm') + ' ' + ex;
          // The computer may have answered already, and then the reply is on the board.
          const replied = G.g.moves.length > ply + 1;
          actions = replied ? [[t('play.coach.takeBack'), 'takeback'], [t('play.coach.playOn'), 'dismiss']] : [[t('play.coach.takeBack'), 'takeback'], [t('play.coach.showReply'), 'reply'], [t('play.coach.playOn'), 'dismiss']];
          if (refut && !replied) G.coachArrow = { from: sqIndex(refut.from), to: sqIndex(refut.to), color: '#ff5a50' };
        } else if (cls === 'brilliant' && lvl !== 'quiet') { text = t('play.coach.brilliant') + ' ' + (C.describe(f) || t('play.coach.bold')); actions = [[t('play.coach.thanks'), 'dismiss']]; }
        else if (lvl === 'chatty' && (cls === 'best' || cls === 'excellent')) { const d = C.describe(f); text = t(cls === 'best' ? 'play.coach.top' : 'play.coach.nice') + ' ' + (d || ''); actions = [[t('play.coach.thanks'), 'dismiss']]; }
        else if (lvl === 'chatty' && cls === 'inaccuracy') { text = pre.bestSan ? t('play.coach.playable', { san: pre.bestSan }) : t('play.coach.playableOther'); actions = [[t('common.ok'), 'dismiss']]; }
        if (!text) return;
        G.coachArrow = G.coachArrow && cls !== 'blunder' && cls !== 'mistake' ? null : G.coachArrow;
        coachSay(text, actions, cls);
        refreshHighlights();
      });
    }, 20);
  }
  // A message in the side panel from Rooky, or from whoever is across the table.
  function coachSay(text, actions, cls, who) {
    const G = state.game;
    G.coachMsg = { text, actions, cls, who: who || null };
    AU.play('coach');
    renderCoach();
  }
  function renderCoach() {
    const G = state.game, slot = $('coach-slot');
    if (!slot || !G) return;
    if (!G.coachMsg) { slot.innerHTML = ''; applyInsets(); return; }
    const m = G.coachMsg, who = m.who || COACH;
    slot.innerHTML = '<div class="coach' + (m.who ? ' rival' : '') + '"><div class="face"><img class="portrait" src="' + face(who) + '" alt=""></div><div><b>' + esc(m.who ? fullName(who) : t('play.coach.rooky')) + (m.cls ? ' · <span class="cls ' + m.cls + '">' + C.LABEL[m.cls] + '</span>' : '') + '</b><p>' + esc(m.text) + '</p>' +
      '<div class="row">' + (m.actions || []).map(([label, a]) => '<button class="btn small' + (a === 'takeback' ? ' primary' : '') + '" data-coach="' + a + '">' + esc(label) + '</button>').join('') + '</div></div></div>';
    slot.querySelectorAll('[data-coach]').forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.coach;
        if (a === 'takeback') { G.takebacks++; undo(); }
        if (a === 'reply') { refreshHighlights(); return; }
        G.coachMsg = null; G.coachArrow = null; renderCoach(); refreshHighlights();
      };
    });
    applyInsets();
  }

  function undo() {
    const G = state.game, g = G.g;
    if (G.kind === 'online' || !g.moves.length || g.ended || G.busy) return;
    G.request++; G.thinking = false;
    if (G.kind === 'ai') { g.undo(); if (g.moves.length && g.pos.side !== G.human) g.undo(); } else g.undo();
    G.selected = -1; G.hint = null; G.hintStep = 0; G.threat = null; G.coachMsg = null; G.coachArrow = null; G.resultShown = false;
    AU.play('tap');
    view.setBoard(piecesOf(g.pos), capturedFor(g));
    if (G.kind === 'local' && state.settings.turnBoard) { G.viewSide = g.pos.side === WHITE ? 'white' : 'black'; view.setView(G.viewSide, state.settings.view); renderCards(); }
    refreshHighlights(); renderHud(); renderCoach(); save();
    maybeComputer(); preAnalyse();
  }
  // Hint ladder: the idea, then the piece, then the move.
  function hint() {
    const G = state.game;
    if (!humanTurn()) return;
    if (G.hint && G.hintStep < 3) { G.hintStep++; showHintStep(); return; }
    $('g-hint').disabled = true;
    const id = ++G.request;
    job('play', { type: 'hint', fen: G.g.startFen, moves: G.g.uciMoves(), timeMs: 900 }, (r) => {
      if (id !== G.request || state.game !== G || !r.hint) { renderHud(); return; }
      G.hint = r.hint; G.hintStep = 1;
      showHintStep(); renderHud();
    });
  }
  function showHintStep() {
    const G = state.game, h = G.hint;
    const text = G.hintStep === 1 ? h.theme : G.hintStep === 2 ? t('play.coach.lookAt', { piece: h.piece }) : t('play.coach.try', { san: h.san }) + ' ' + (h.text || '');
    coachSay(text, G.hintStep < 3 ? [[t('play.coach.anotherHint'), 'more'], [t('common.gotIt'), 'dismiss']] : [[t('common.gotIt'), 'dismiss']]);
    const slot = $('coach-slot'), more = slot && slot.querySelector('[data-coach="more"]');
    if (more) more.onclick = () => { G.hintStep++; showHintStep(); };
    refreshHighlights();
  }
  function showThreat() {
    const G = state.game;
    if (!humanTurn()) return;
    if (G.g.pos.inCheck()) { coachSay(t('play.coach.inCheck'), [[t('common.ok'), 'dismiss']]); return; }
    job('analysis', { type: 'threat', fen: G.g.startFen, moves: G.g.uciMoves(), timeMs: 300 }, (r) => {
      if (state.game !== G || !r.threat) return;
      G.threat = r.threat.serious ? r.threat : null;
      coachSay(r.threat.serious ? r.threat.text : t('play.coach.noDanger') + ' ' + r.threat.text, [[t('common.ok'), 'dismiss']]);
      refreshHighlights();
    });
  }
  // Online reactions: a short preset list, never typed text.
  const EMOTES = { hello: '👋', luck: '🍀', nice: '👍', wow: '😮', think: '🤔', gg: '🤝' };
  const emoteText = (k) => t('play.emote.' + k);
  function emotePicker() {
    const old = document.querySelector('.emote-pop');
    if (old) { old.remove(); return; }
    const pop = document.createElement('div');
    pop.className = 'emote-pop glass'; pop.setAttribute('role', 'menu');
    pop.innerHTML = Object.keys(EMOTES).map((k) => '<button class="btn small" role="menuitem" data-emote="' + k + '"><span aria-hidden="true">' + EMOTES[k] + '</span> ' + emoteText(k) + '</button>').join('');
    // Fixed above the action bar, which scrolls sideways on phones and would clip it.
    const r = $('g-emote').getBoundingClientRect();
    pop.style.left = Math.min(window.innerWidth - 150, Math.max(150, r.left + r.width / 2)) + 'px';
    pop.style.bottom = (window.innerHeight - r.top + 10) + 'px';
    document.body.appendChild(pop);
    const away = (e) => { if (!pop.contains(e.target) && e.target.closest('#g-emote') === null) { pop.remove(); document.removeEventListener('pointerdown', away, true); } };
    document.addEventListener('pointerdown', away, true);
    pop.onclick = (e) => { const b = e.target.closest('[data-emote]'); if (!b) return; pop.remove(); document.removeEventListener('pointerdown', away, true); AU.play('tap'); ChacklateNet.send({ type: 'emote', id: b.dataset.emote }); };
  }
  function showEmote(id, mine) {
    const G = state.game, em = EMOTES[id];
    if (!G || !em || state.screen !== 'game') return;
    const side = mine ? G.human : -G.human;
    const card = document.querySelector('.player-card[data-side="' + side + '"]');
    if (!card) return;
    const old = card.querySelector('.emote-bubble'); if (old) old.remove();
    const b = document.createElement('div');
    b.className = 'emote-bubble'; b.setAttribute('role', 'status');
    b.innerHTML = '<span aria-hidden="true">' + em + '</span> ' + esc(emoteText(id));
    card.appendChild(b);
    if (!mine) AU.play('tap');
    setTimeout(() => b.remove(), 3500);
  }
  function offerDraw() {
    const G = state.game;
    if (G.g.outcome) return;
    if (G.kind === 'online') { ChacklateNet.send({ type: 'draw-offer' }); toast(t('play.drawOffered')); return; }
    // The computer accepts only when it is clearly not better.
    const e = G.evals[G.g.moves.length];
    const aiView = e ? e.cp * (G.g.pos.side === G.human ? -1 : 1) : 0;
    if (G.g.moves.length >= 20 && aiView <= 30) { G.g.agreeDraw(); G.request++; endGame(); }
    else { const who = rival(G); coachSay(t(G.g.moves.length < 20 ? 'play.drawEarly' : 'play.drawNo'), [[t('common.ok'), 'dismiss']], null, who); AU.play('illegal'); }
  }
  let resignArmed = 0;
  function resign() {
    const G = state.game;
    if (G.g.outcome) return;
    const btn = $('g-resign');
    if (Date.now() - resignArmed > 3000) {
      resignArmed = Date.now();
      btn.classList.add('warn'); btn.querySelector('.lbl').textContent = t('play.sure');
      setTimeout(() => { if (Date.now() - resignArmed >= 3000 && btn.isConnected) { btn.classList.remove('warn'); btn.querySelector('.lbl').textContent = t('play.btn.resign'); } }, 3100);
      return;
    }
    resignArmed = 0;
    G.request++; G.thinking = false;
    if (G.kind === 'online') { ChacklateNet.send({ type: 'resign' }); return; }
    G.g.resign(G.kind === 'ai' ? G.human : G.g.pos.side);
    endGame();
  }

  // ----- the end of a game
  function endGame() {
    const G = state.game, g = G.g;
    G.selected = -1; G.hint = null; G.thinking = false;
    refreshHighlights(); renderHud();
    // Online results come from the server (with the rating change); wait briefly for it.
    if (G.kind === 'online' && !G.online.ended) {
      clearTimeout(G.online.endWait);
      G.online.endWait = setTimeout(() => { G.online.ended = true; endGame(); }, 2500);
      return;
    }
    if (G.setup.dojo) { if (!G.dojoDone) dojoCheck(G, null); return; }
    if (G.resultShown) return;
    G.resultShown = true;
    guideIdle(null);
    const o = g.outcome;
    const winner = o.result === '1-0' ? WHITE : o.result === '0-1' ? BLACK : 0;
    const pos = g.pos;
    if (winner) view.celebrate('win', kingSquare(pos, -winner), null, kingSquare(pos, winner));
    else view.celebrate('draw', -1, [kingSquare(pos, WHITE), kingSquare(pos, BLACK)]);
    const vsSomeone = G.kind !== 'local';
    const youWon = vsSomeone && winner === G.human, youLost = vsSomeone && winner === -G.human;
    AU.play(winner ? (youLost ? 'loss' : 'win') : 'draw');
    setTimeout(() => AU.event(resultCall(o.reason, winner, youWon, youLost)), 700);
    // Progress
    let res = null;
    if (G.kind !== 'local' || g.moves.length >= 10) {
      res = PG.gameFinished(state.progress, {
        mode: G.kind === 'online' ? 'online' : G.kind, online: G.kind === 'online', level: G.setup.level, won: youWon, drawn: !winner, lost: youLost, reason: o.reason,
        plies: g.moves.length, sans: g.sans, firstIsMine: G.kind === 'local' ? true : (E.positionFrom(g.startFen, []).side === G.human), startFen: g.startFen, ucis: g.uciMoves(),
        enPassant: g.moves.some((m, i) => (E.mFlags(m) & E.F_EP) && (G.kind === 'local' || (i % 2 === 0) === (E.positionFrom(g.startFen, []).side === G.human))),
        pgn: pgn(), color: G.human,
      });
    }
    // Beating an era's champion completes that stage of the journey.
    const j = G.setup.journey, era = j && eraById(j.era);
    const jr = era && youWon ? PG.journeyStage(state.progress, j.era, j.stage, Date.now()) : null;
    save();
    const who = G.kind === 'ai' ? rival(G) : null;
    const opp = G.kind === 'online' && G.online && G.online.opponent;
    const badge = jr ? t('play.end.champion') : REASON_TEXT[o.reason] || t('play.end.over');
    let title;
    if (!winner) title = t('play.end.draw');
    else if (who) title = youWon ? t('play.end.youBeat', { name: who.name }) : t('play.end.wins', { name: who.name });
    else if (G.kind === 'online') title = t(youWon ? 'play.end.victory' : 'play.end.defeat');
    else title = t(winner === WHITE ? 'play.end.whiteWins' : 'play.end.blackWins');
    const art = who ? '<img class="portrait big" src="' + face(who) + '" alt="">' : opp ? avatarHtml('xl', opp.avatar, opp.frame) : vsSomeone ? avatarHtml('xl') : '<img class="portrait big" src="' + ART.crestUri() + '" alt="">';
    const lv = PG.levelFor(state.progress.xp);
    const html = '<div class="result-hero">' + art +
      '<span class="result-badge' + (youWon ? ' win' : youLost ? ' loss' : '') + '">' + esc(badge) + '</span>' +
      '<h2 class="result-title">' + esc(title) + '</h2>' +
      (who ? '<p class="quote"><b>' + esc(fullName(who)) + '</b>“' + esc(sayLine(who, youWon ? 'win' : youLost ? 'lose' : 'draw')) + '”</p>' : '') +
      '<p class="sub">' + esc(resultSub(G, o, winner)) + '</p>' +
      (res ? '<div class="xpline"><div class="top"><span>' + t('common.level', { n: lv.level }) + ' · ' + esc(levelTitle(lv)) + '</span><b>+' + t('common.xp', { n: res.xp }) + '</b></div><div class="bar"><i id="xpfill" style="width:0%"></i></div></div>' : '') +
      (G.online && G.online.ratingDelta !== undefined ? '<p class="sub">' + t('play.end.rating', { n: '<b>' + G.online.rating + '</b>', delta: (G.online.ratingDelta >= 0 ? '+' : '') + G.online.ratingDelta }) + '</p>' : '') +
      '<div class="row" style="justify-content:center"><button class="btn" data-close>' + t('play.end.look') + '</button>' +
      (era ? '<button class="btn" id="r-era">' + icon('journey') + ' ' + esc(eraName(era)) + '</button>' : '<button class="btn" id="r-home">' + icon('home') + ' ' + t('common.nav.home') + '</button>') +
      (G.kind === 'online' ? '<button class="btn" id="r-report">' + t('play.end.report') + '</button>' : jr ? '' : '<button class="btn' + (era ? ' primary' : '') + '" id="r-rematch">' + icon('refresh') + ' ' + t(era ? 'common.tryAgain' : 'play.end.rematch') + '</button>') +
      (jr ? '<button class="btn primary" id="r-prize">' + icon('trophy') + ' ' + (jr.eraDone ? t('play.end.prize') : t('learn.dj.backTo', { era: esc(eraName(era)) })) + '</button>'
        : !era && g.moves.length >= 4 ? '<button class="btn primary" id="r-review">' + icon('star') + ' ' + t('play.btn.review') + '</button>' : '') + '</div></div>';
    let prizeShown = false;
    setTimeout(() => {
      if (state.game !== G || state.screen !== 'game') return;
      const mdl = modal(html, { cls: 'narrow', onClose() { if (jr && jr.eraDone && !prizeShown) { prizeShown = true; setTimeout(() => eraDoneModal(era, jr), 250); } } });
      setTimeout(() => { const f = $('xpfill'); if (f) f.style.width = Math.round((lv.into / lv.need) * 100) + '%'; }, 120);
      const on = (id, fn) => { const b = mdl.querySelector(id); if (b) b.onclick = fn; };
      on('#r-review', () => { mdl.close(); $('g-review').click(); });
      on('#r-home', () => { mdl.close(); go('home'); });
      on('#r-era', () => { mdl.close(); go('era', era.id); });
      on('#r-report', (e) => { e.currentTarget.disabled = true; ChacklateNet.report('Reported from the result screen', G.online && G.online.id); });
      on('#r-rematch', () => { mdl.close(); const s = Object.assign({}, G.setup); if (s.mode === 'ai' && !era && s.color !== 'random') s.color = s.color === 'white' ? 'black' : 'white'; startGame(s); });
      on('#r-prize', () => { mdl.close(); if (!jr.eraDone) go('era', era.id); });
      celebrate(res);
      if (jr && !jr.eraDone) celebrate(jr, true);
      if (!era && mdl.querySelector('#r-review')) guideSay('game.over', { delay: 2200 });
    }, state.settings.animations ? 1500 : 200);
  }
  function resultSub(G, o, winner) {
    const g = G.g;
    const loser = winner ? sideName(G, -winner) : '';
    const mine = G.kind !== 'local' && loser === myName();
    const n = Math.ceil(g.moves.length / 2);
    if (o.reason === 'checkmate') return winner ? t('play.why.checkmate', { name: sideName(G, winner), n }) : '';
    if (o.reason === 'resignation') return mine ? t('play.why.youResigned') : t('play.why.resigned', { name: loser });
    if (o.reason === 'timeout') return mine ? t('play.why.yourClock') : t('play.why.clock', { name: loser });
    return I18N.has('play.why.' + o.reason) ? t('play.why.' + o.reason) : '';
  }

  // ----- the HUD
  function renderHud() {
    const G = state.game;
    if (!G || state.screen !== 'game') return;
    const g = G.g;
    const taken = { [WHITE]: [], [BLACK]: [] };
    g.captured.forEach((p) => { if (p) taken[-Math.sign(p)].push(Math.abs(p)); });
    let diff = 0;
    for (let sq = 0; sq < 64; sq++) { const p = E.pieceAt(g.pos, sq); if (p) diff += Math.sign(p) * VALUE[Math.abs(p)]; }
    for (const id of ['p-bottom', 'p-top']) {
      const el = $(id), side = +el.dataset.side;
      const list = taken[side].slice().sort((a, b) => VALUE[b] - VALUE[a] || b - a);
      const adv = diff * side;
      const key = list.join('') + '|' + adv;
      if (el.dataset.taken !== key) {
        el.dataset.taken = key;
        el.querySelector('.caps').innerHTML = list.map((k) => capImg(TYPE[k], side === WHITE ? 'b' : 'w')).join('');
        el.querySelector('.adv').textContent = adv > 0 ? '+' + adv : '';
      }
      el.classList.toggle('to-move', !g.outcome && g.pos.side === side);
    }
    // status chip
    const chip = $('g-chip');
    chip.className = 'status-chip glass';
    let text;
    if (g.outcome) { const o = g.outcome; text = t(o.result === '1/2-1/2' ? 'play.chip.draw' : o.result === '1-0' ? 'play.chip.whiteWins' : 'play.chip.blackWins') + ' · ' + (REASON_TEXT[o.reason] || ''); }
    else if (G.thinking) { text = t('play.chip.thinking', { name: rival(G).name }); chip.classList.add('thinking'); }
    else if (G.kind === 'online' && g.pos.side !== G.human) text = t(G.online && G.online.opponentAway ? 'play.chip.reconnecting' : 'play.chip.theirMove');
    else {
      text = G.kind === 'local' ? t(g.pos.side === WHITE ? 'play.chip.whiteToMove' : 'play.chip.blackToMove') : t('play.chip.yourMove');
      if (g.pos.inCheck()) { text = t('play.chip.check') + ' ' + text; chip.classList.add('check'); }
    }
    chip.textContent = text;
    // buttons
    const done = !!g.outcome;
    const set = (id, dis) => { const b = $(id); if (b) b.disabled = dis; };
    set('g-undo', !g.moves.length || done || G.busy || G.kind === 'online' || !!G.setup.dojo);
    set('g-hint', !humanTurn());
    set('g-threat', !humanTurn());
    set('g-draw', done);
    $('g-resign').hidden = done;
    if ($('g-draw')) $('g-draw').hidden = done;
    const claim = !done && g.claimable();
    $('g-claim').hidden = !claim || !humanTurn();
    if (claim) $('g-claim').textContent = t(claim === 'threefold' ? 'play.btn.claim3' : 'play.btn.claim50');
    $('g-review').hidden = !done || g.moves.length < 4;
    $('g-new').hidden = !done || G.kind === 'online' || !!G.setup.journey || !!G.setup.dojo;
    $('g-view-lbl').textContent = t(state.settings.view === 'top' ? 'play.btn.3dView' : 'play.btn.topView');
    $('move-input').disabled = !humanTurn();
    renderMoves();
    renderClocks();
    renderEval();
    renderCoach();
  }
  function renderClocks() {
    const G = state.game;
    if (!G || state.screen !== 'game') return;
    const c = G.kind === 'online' && G.online ? G.online.clockNow() : G.clock;
    document.querySelectorAll('.clock[data-side]').forEach((el) => {
      if (!c) return;
      const side = +el.dataset.side;
      const ms = c[side === WHITE ? 'w' : 'b'];
      el.textContent = fmt(ms);
      const running = !G.g.outcome && G.g.moves.length > 0 && G.g.pos.side === side;
      el.classList.toggle('running', running && ms >= 20000);
      el.classList.toggle('low', running && ms < 20000);
    });
    if (c && state.settings.quality === 'high') view.setClock({ whiteMs: c.w, blackMs: c.b, active: G.g.outcome || !G.g.moves.length ? null : G.g.pos.side === WHITE ? 'w' : 'b', running: !G.g.outcome }, clockSkin);
    else view.setClock(null);
  }
  function renderMoves() {
    const G = state.game, g = G.g;
    const ol = $('moves');
    if (!g.sans.length) { ol.innerHTML = '<li><span class="empty">' + t('play.noMovesYet') + '</span></li>'; return; }
    ol.innerHTML = moveRows(g.startFen, g.sans, g.sans.length - 1);
    const wrap = $('moves-wrap'); wrap.scrollTop = wrap.scrollHeight;
  }
  function moveRows(startFen, sans, cur, badges) {
    const start = new E.Pos(); start.load(startFen);
    let num = start.full, white = start.side === WHITE;
    const rows = [];
    let row = null;
    const cell = (i) => i < 0 ? '' : '<span class="m' + (i === cur ? ' cur' : '') + '" data-ply="' + i + '">' + esc(sans[i]) + (badges && badges[i] ? badges[i] : '') + '</span>';
    sans.forEach((san, i) => {
      if (white || !row) { row = { n: num, w: white ? i : -1, b: -1 }; rows.push(row); if (!white) { row.b = i; num++; } }
      else { row.b = i; num++; }
      white = !white;
    });
    return rows.map((r) => '<li><span class="n">' + r.n + '.</span>' + (r.w < 0 ? '<span class="m">…</span>' : cell(r.w)) + (r.b < 0 ? '<span></span>' : cell(r.b)) + '</li>').join('');
  }
  function pgn() {
    const G = state.game; if (!G) return '';
    const d = new Date();
    const date = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
    const name = (side) => sideName(G, side) + (G.kind === 'ai' && side !== G.human ? ' (Chackmate)' : '');
    return G.g.pgn({ Date: date, White: name(WHITE), Black: name(BLACK), Event: G.kind === 'online' ? 'Online game' : G.setup.journey ? 'Journey Through Time' : 'Casual game',
      TimeControl: !G.setup.tc || G.setup.tc === 'none' ? '-' : G.setup.tc.split('+').map((x, i) => (i ? x : x * 60)).join('+') });
  }
  function copy(text, label) {
    const fallback = () => { const m = modal('<h2>' + t('play.copy.title', { what: esc(label) }) + '</h2><p class="sub">' + t('play.copy.sub') + '</p><textarea class="share" readonly>' + esc(text) + '</textarea><div class="row"><button class="btn primary" data-close>' + t('common.done') + '</button></div>'); setTimeout(() => m.querySelector('textarea').select(), 40); };
    try { navigator.clipboard.writeText(text).then(() => toast(t('play.copy.done', { what: esc(label) })), fallback); } catch (e) { fallback(); }
  }

  function choosePromotion(side, cb) {
    const names = { 5: PIECE_NAME.q, 4: PIECE_NAME.r, 3: PIECE_NAME.b, 2: PIECE_NAME.n };
    const ink = side === WHITE ? ['#f6ead2', '#a68a62'] : ['#4a2c1d', '#140b07'];
    let picked = false;
    const m = modal('<div class="eyebrow">' + t('play.promo.eyebrow') + '</div><h2>' + t('play.promo.title') + '</h2><p class="sub">' + t('play.promo.sub') + '</p><div class="promo">' +
      [5, 4, 3, 2].map((k) => '<button data-k="' + k + '"><img src="' + medal('piece:' + TYPE[k], ink[0], ink[1]) + '" alt=""><span>' + names[k] + '</span></button>').join('') + '</div><div class="row"><button class="btn" data-close>' + t('common.cancel') + '</button></div>',
    { onClose() { if (!picked) cb(0); } });
    m.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { picked = true; m.close(); AU.play('promote'); cb(+b.dataset.k); }; });
  }

  // ----- new games
  function newGameModal() {
    const s = state.setup;
    const prem = state.progress.premium;
    const m = modal('<form id="ng"><div class="eyebrow">' + t('play.ng.eyebrow') + '</div><h2>' + t('play.ng.title') + '</h2><p class="sub">' + t('play.ng.sub') + '</p>' +
      '<div class="field"><div class="label">' + t('play.opponent') + '</div><div class="seg"><label><input type="radio" name="mode" value="ai"' + (s.mode !== 'local' ? ' checked' : '') + '><span>' + t('play.ng.ai') + '</span></label><label><input type="radio" name="mode" value="local"' + (s.mode === 'local' ? ' checked' : '') + '><span>' + t('play.ng.local') + '</span></label></div></div>' +
      '<div class="field" id="f-color"><div class="label">' + t('play.playAs') + '</div><div class="seg">' + ['white', 'black', 'random'].map((c) => '<label><input type="radio" name="color" value="' + c + '"' + (s.color === c ? ' checked' : '') + '><span>' + t('play.color.' + c) + '</span></label>').join('') + '</div></div>' +
      '<div class="field" id="f-level"><div class="label">' + t('play.ng.who') + '</div><div class="levels">' + LEVELS.map((lv, i) => { const o = persona(i); return '<label><input type="radio" name="level" value="' + i + '"' + (s.level === i ? ' checked' : '') + (lv.premium && !prem ? ' disabled' : '') + '><span class="lv"><img class="portrait" src="' + face(o) + '" alt=""><span><i>' + esc(bandName(i)) + (lv.premium && !prem ? ' · ' + t('common.premium') : '') + '</i><b>' + esc(o.name) + '</b><small>' + esc(speciesName(o)) + '</small></span></span></label>'; }).join('') + '</div></div>' +
      '<div class="field"><div class="label">' + t('play.clock') + '</div><div class="seg">' + [['none', 'play.clock.none'], ['1+0', 'play.clock.1'], ['3+2', '3 + 2'], ['5+0', 'play.clock.5'], ['10+5', '10 + 5'], ['15+10', '15 + 10'], ['30+0', 'play.clock.30']].map(([v, l]) => '<label><input type="radio" name="tc" value="' + v + '"' + (s.tc === v ? ' checked' : '') + '><span>' + clockName(l) + '</span></label>').join('') + '</div></div>' +
      '<div class="field"><label for="ng-fen">' + t('play.ng.fen') + '</label><input class="text-in" id="ng-fen" placeholder="' + t('play.ng.fenHint') + '" spellcheck="false" value="' + esc(s.fen || '') + '"><p class="err" id="ng-err"></p></div>' +
      '<div class="row"><button type="button" class="btn" data-close>' + t('common.cancel') + '</button><button class="btn primary">' + icon('play') + ' ' + t('play.ng.start') + '</button></div></form>', { cls: 'wide', x: true });
    const form = m.querySelector('#ng');
    const sync = () => { const ai = form.mode.value === 'ai'; m.querySelector('#f-color').hidden = !ai; m.querySelector('#f-level').hidden = !ai; };
    form.onchange = sync; sync();
    form.onsubmit = (e) => {
      e.preventDefault();
      const fen = m.querySelector('#ng-fen').value.trim();
      if (fen) { const err = new E.Pos().load(fen); if (err) { m.querySelector('#ng-err').textContent = err; return; } }
      const lv = +(form.level.value || 1);
      m.close();
      AU.unlock();
      startGame({ mode: form.mode.value, color: form.color.value || 'white', level: LEVELS[lv].premium && !prem ? 1 : lv, tc: form.tc.value, fen });
    };
  }
  // Online clocks: every game is timed, with ten minutes a side at most.
  const ONLINE_TCS = [['3+2', '3 + 2'], ['5+0', 'play.clock.5'], ['5+3', '5 + 3'], ['10+0', 'play.clock.10']];
  function worldModal() {
    const m = modal('<div class="setup-hero">' + worldArt() + '<div><div class="eyebrow">' + t('play.world') + '</div><h2>' + t('play.w.title') + '</h2>' +
      '<p class="sub">' + t('play.w.sub') + '</p></div></div>' +
      '<div class="field"><div class="label">' + t('play.w.clock') + '</div><div class="seg">' + ONLINE_TCS.map(([v, l]) => '<label><input type="radio" name="wtc" value="' + v + '"' + (v === '5+3' ? ' checked' : '') + '><span>' + clockName(l) + '</span></label>').join('') + '</div></div>' +
      '<div class="row"><button class="btn" data-close>' + t('common.cancel') + '</button><button class="btn primary" id="w-go">' + icon('globe') + ' ' + t('play.w.title') + '</button></div>', { x: true });
    m.querySelector('#w-go').onclick = () => { const tc = m.querySelector('input[name=wtc]:checked').value; m.close(); ChacklateNet.quickMatch(tc); };
  }
  // Play a friend on another device: create a table and share its code, or join one with a code.
  // The online part is always offered; ChacklateNet waits for the connection or explains why there is none.
  function friendModal() {
    const link = window.ChacklateNet && ChacklateNet.link ? ChacklateNet.link() : 'unavailable';
    const status = link === 'ready' ? '' : '<p class="fine">' + t(link === 'connecting' ? 'play.fr.connecting' : 'play.fr.unreachable') + '</p>';
    const m = modal('<div class="setup-hero">' + duoArt() + '<div><div class="eyebrow">' + t('play.friend') + '</div><h2>' + t('play.fr.title') + '</h2><p class="sub">' + t('play.fr.sub') + '</p></div></div>' +
      '<div class="friend-pick"><section class="glass"><h3>' + icon('users') + ' ' + t('play.fr.create') + '</h3><p class="fine">' + t('play.fr.createSub') + '</p>' +
      '<div class="label">' + t('play.fr.clock') + '</div><div class="seg" id="fr-tc">' + ONLINE_TCS.map(([v, l]) => '<label><input type="radio" name="frtc" value="' + v + '"' + (v === '5+3' ? ' checked' : '') + '><span>' + clockName(l) + '</span></label>').join('') + '</div>' +
      '<button class="btn primary" id="fr-create">' + icon('users') + ' ' + t('play.fr.createBtn') + '</button></section>' +
      '<section class="glass"><h3>' + icon('play') + ' ' + t('play.fr.join') + '</h3><label class="fine" for="fr-code">' + t('play.fr.joinSub') + '</label>' +
      '<div style="display:flex;gap:8px"><input class="text-in code" id="fr-code" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters"><button class="btn primary" id="fr-join">' + t('play.fr.joinBtn') + '</button></div><p class="err" id="fr-err"></p></section></div>' +
      status +
      '<div class="row"><button class="btn" data-close>' + t('common.cancel') + '</button><button class="btn" id="fr-local">' + icon('users') + ' ' + t('play.fr.local') + '</button></div>', { x: true });
    m.querySelector('#fr-local').onclick = () => { m.close(); startGame({ mode: 'local', color: 'white', level: 0, tc: 'none', fen: '' }); };
    m.querySelector('#fr-create').onclick = () => { const tc = m.querySelector('input[name=frtc]:checked').value; m.close(); ChacklateNet.createFriend(tc); };
    const join = () => {
      const code = m.querySelector('#fr-code').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) { m.querySelector('#fr-err').textContent = t('play.fr.badCode'); return; }
      m.close(); ChacklateNet.joinFriend(code);
    };
    m.querySelector('#fr-join').onclick = join;
    m.querySelector('#fr-code').onkeydown = (e) => { if (e.key === 'Enter') join(); };
  }

  // ---------------------------------------------------------------- review
  SCREENS.review = function (arg) {
    view.setAttract(false);
    const start = arg.start, ucis = arg.ucis;
    const R = { ply: ucis.length - 1, data: arg.review || null, side: arg.side || WHITE, line: null };
    const sans = [];
    { const p = E.positionFrom(start, []); for (const u of ucis) { const m = p.parseMove(u); sans.push(p.san(m, p.legalMoves())); p.make(m); } }
    const fromGame = state.game && state.game.g.outcome && state.game.g.startFen === start && state.game.g.moves.length === ucis.length;
    if (fromGame) setLook(state.game.setup.look || null);
    mount('<div class="hud-top"><button class="backbtn" id="rv-back">' + icon('back') + '<span>' + t(fromGame ? 'learn.rv.backGame' : 'common.back') + '</span></button>' +
      '<div class="title"><img class="portrait" src="' + face(COACH) + '" alt=""><span>' + t('learn.rv.title', { name: esc(arg.title || '') }) + '</span></div><span class="spacer"></span>' +
      '<button class="round" id="rv-set" aria-label="' + t('settings.title') + '" title="' + t('settings.title') + '">' + icon('gear') + '</button></div>' +
      '<aside class="side glass wide" id="side"><header><b>' + t('learn.rv.head') + '</b><span class="pill" id="rv-depth"></span></header>' +
      '<div id="rv-body" class="rv-body"><div class="progress-ring">' + faceImg(COACH) + '<div>' + t('learn.rv.looking') + '</div><div class="bar" style="width:180px"><i id="rv-prog" style="width:0%"></i></div></div></div></aside>' +
      '<div class="actionbar glass"><button class="btn" id="rv-first" aria-label="' + t('learn.rv.first') + '">' + icon('first') + '</button><button class="btn" id="rv-prev" aria-label="' + t('learn.rv.prev') + '">' + icon('prev') + '</button>' +
      '<button class="btn" id="rv-next" aria-label="' + t('learn.rv.next') + '">' + icon('next') + '</button><button class="btn" id="rv-last" aria-label="' + t('learn.rv.last') + '">' + icon('last') + '</button><span class="sep"></span>' +
      '<button class="btn" id="rv-turn">' + icon('star') + '<span class="lbl">' + t('learn.rv.turning') + '</span></button><button class="btn" id="rv-best">' + icon('hint') + '<span class="lbl">' + t('learn.rv.bestLine') + '</span></button>' +
      '<button class="btn primary" id="rv-practice">' + icon('play') + '<span class="lbl">' + t('learn.rv.fromHere') + '</span></button></div>');
    $('rv-back').onclick = () => { AU.play('tap'); if (fromGame) go('game'); else go('training'); };
    $('rv-set').onclick = () => settingsModal();
    const deep = state.progress.premium;
    $('rv-depth').textContent = t(deep ? 'learn.rv.deep' : 'learn.rv.standard');
    const show = () => {
      const p = E.positionFrom(start, ucis.slice(0, R.ply + 1));
      const cap = { byWhite: [], byBlack: [] };
      { const q = E.positionFrom(start, []); for (const u of ucis.slice(0, R.ply + 1)) { const m = q.parseMove(u); const fl = E.mFlags(m); if (fl & E.F_CAP) { const to = (m >> 7) & 127; const v = fl & E.F_EP ? -E.P * q.side : q.b[to]; (v < 0 ? cap.byWhite : cap.byBlack).push(v); } q.make(m); } }
      view.setBoard(piecesOf(p), cap);
      const h = { lastFrom: -1, lastTo: -1, check: p.inCheck() ? kingSquare(p, p.side) : -1 };
      const arrows = [];
      if (R.ply >= 0) { const u = ucis[R.ply]; h.lastFrom = sqIndex(u.slice(0, 2)); h.lastTo = sqIndex(u.slice(2, 4)); }
      if (R.data && R.ply >= 0) {
        const pl = R.data.plies[R.ply];
        if (pl && pl.best && !pl.isBest && ['inaccuracy', 'mistake', 'blunder'].includes(pl.cls)) arrows.push({ from: sqIndex(pl.best.slice(0, 2)), to: sqIndex(pl.best.slice(2, 4)), color: '#7fd6a4' });
        if (pl && pl.refutation && ['mistake', 'blunder'].includes(pl.cls)) arrows.push({ from: sqIndex(pl.refutation.from), to: sqIndex(pl.refutation.to), color: '#ff5a50', alpha: 0.7 });
      }
      view.setHighlights(h); view.setArrows(arrows);
      renderSide();
    };
    const step = (d) => { R.ply = Math.max(-1, Math.min(ucis.length - 1, R.ply + d)); R.line = null; AU.play('move'); show(); };
    $('rv-first').onclick = () => { R.ply = -1; show(); };
    $('rv-prev').onclick = () => step(-1);
    $('rv-next').onclick = () => step(1);
    $('rv-last').onclick = () => { R.ply = ucis.length - 1; show(); };
    $('rv-turn').onclick = () => { if (R.data && R.data.summary.turning >= 0) { R.ply = R.data.summary.turning; show(); } };
    $('rv-best').onclick = () => {
      job('analysis', { type: 'line', fen: start, moves: ucis.slice(0, R.ply + 1), plies: 5, timeMs: 180 }, (r) => { if (r.line && state.screen === 'review') { R.line = r.line; renderSide(); } });
    };
    $('rv-practice').onclick = () => {
      const p = E.positionFrom(start, ucis.slice(0, R.ply + 1));
      if (!p.legalMoves().length) return;
      const lv = arg.level !== undefined ? arg.level : Math.min(state.progress.premium ? 7 : 3, Math.max(2, state.setup.level || 2));
      startGame({ mode: 'ai', color: p.side === WHITE ? 'white' : 'black', level: LEVELS[lv].premium && !state.progress.premium ? 3 : lv, tc: 'none', fen: p.fen() });
    };
    function renderSide() {
      if (!R.data) return;
      const d = R.data, s = d.summary;
      const badges = d.plies.map((p) => p.cls === 'good' ? '' : '<span class="cls ' + p.cls + '" title="' + C.LABEL[p.cls] + '">' + (C.SYMBOL[p.cls] || '') + '</span>');
      const pl = R.ply >= 0 ? d.plies[R.ply] : null;
      const cnt = (o, k) => (o[k] || 0);
      const acc = (side, label) => { const c = s.counts[side]; return '<div class="acc' + (side === R.side ? ' me' : '') + '"><small>' + label + '</small><b>' + (s.accuracy[side] === null ? '–' : s.accuracy[side] + '%') + '</b><span>' + t('learn.rv.counts', { b: cnt(c, 'blunder'), m: cnt(c, 'mistake') }) + '</span></div>'; };
      $('rv-body').innerHTML = '<svg class="graph" id="rv-graph" viewBox="0 0 300 110" preserveAspectRatio="none" aria-label="' + t('learn.rv.graph') + '"></svg>' +
        '<div class="sum">' + acc(WHITE, t('learn.rv.whiteAcc')) + acc(BLACK, t('learn.rv.blackAcc')) + '</div>' +
        '<div class="comment" aria-live="polite">' + (pl ? '<div class="tagline2"><b>' + esc((pl.side === WHITE ? Math.floor(R.ply / 2) + 1 + '. ' : Math.floor(R.ply / 2) + 1 + '… ') + pl.san) + '</b><span class="cls ' + pl.cls + '">' + C.LABEL[pl.cls] + '</span>' +
          (s.turning === R.ply ? '<span class="pill ruby">' + t('learn.rv.turning') + '</span>' : '') + '</div>' + esc(pl.text) : '<span class="muted">' + t('learn.rv.step') + '</span>') +
        (R.line ? '<div class="bestline">' + t('learn.rv.bestLineIs', { line: esc(R.line.join(' ')) }) + '</div>' : '') + '</div>' +
        '<div class="moves-wrap" id="rv-moves"><ol class="moves">' + moveRows(start, sans, R.ply, badges) + '</ol></div>';
      // the graph of who was winning
      const ev = d.evals.map((e) => C.winProb(e.cp));
      const n = ev.length, X = (i) => (i / Math.max(1, n - 1)) * 300, Y = (v) => 108 - v * 106;
      let path = 'M0 ' + Y(ev[0]);
      ev.forEach((v, i) => { path += ' L' + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); });
      const area = path + ' L300 110 L0 110 Z';
      const marks = d.plies.map((p, i) => ['mistake', 'blunder', 'brilliant'].includes(p.cls) ? '<circle cx="' + X(i + 1).toFixed(1) + '" cy="' + Y(ev[i + 1]).toFixed(1) + '" r="3.2" fill="' + (p.cls === 'blunder' ? '#e5484d' : p.cls === 'brilliant' ? '#1fb5c9' : '#f08a4b') + '"/>' : '').join('');
      $('rv-graph').innerHTML = '<defs><linearGradient id="rvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6e4"/><stop offset="1" stop-color="#d9c6a8"/></linearGradient></defs><rect width="300" height="110" fill="#1b1410"/><path d="' + area + '" fill="url(#rvg)" opacity="0.92"/><line x1="0" y1="55" x2="300" y2="55" stroke="rgba(255,235,215,.25)" stroke-dasharray="3 3"/>' +
        marks + '<line x1="' + X(R.ply + 1).toFixed(1) + '" y1="0" x2="' + X(R.ply + 1).toFixed(1) + '" y2="110" stroke="#e3b25a" stroke-width="1.5"/>';
      $('rv-graph').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); R.ply = Math.max(-1, Math.min(ucis.length - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)) - 1)); show(); };
      $('rv-moves').querySelectorAll('[data-ply]').forEach((el) => { el.onclick = () => { R.ply = +el.dataset.ply; show(); }; });
      const cur = $('rv-moves').querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
    }
    view.setView(R.side === BLACK ? 'black' : 'white', state.settings.view, true);
    show();
    if (!R.data) {
      job('analysis', { type: 'review', fen: start, moves: ucis, timeMs: deep ? 450 : 160 }, (r) => {
        if (state.screen !== 'review') return;
        if (r.error || !r.review) { $('rv-body').innerHTML = '<div class="progress-ring">' + faceImg(COACH) + '<div>' + t('learn.rv.failed') + '</div></div>'; return; }
        R.data = r.review;
        if (fromGame) state.game.review = r.review;
        const res = PG.reviewFinished(state.progress, r.review, R.side, ucis.length, Date.now());
        celebrate(res);
        if (r.review.summary.key.length) R.ply = r.review.summary.key[0];
        AU.play('correct');
        show();
      }, (p) => { const el = $('rv-prog'); if (el) el.style.width = Math.round(p * 100) + '%'; });
    }
    return { key(e) { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); } };
  };

  // ---------------------------------------------------------------- lessons
  // The lesson player: Rooky's narrated steps, then exercises checked by the chess core.
  // Opened from the learning path (an id) or from an era of the journey ({ id, journey }).
  SCREENS.lesson = function (arg) {
    const id = typeof arg === 'string' ? arg : arg && arg.id;
    const journey = (arg && arg.journey) || null, era = journey && eraById(journey.era);
    // An era's lesson is written into its stage and is never part of Learn.
    const own = era && era.stages[journey.stage] && era.stages[journey.stage].steps ? era.stages[journey.stage] : null;
    const L = own || LESSONS.lessons.find((l) => l.id === id);
    const guide = own ? eraCoach(era) : COACH;
    if (!L) { setTimeout(() => go('learn'), 0); return {}; }
    view.setAttract(false);
    if (era) setLook(eraLook(era.id));
    const ex = [];
    for (const x of L.exercises) {
      if (x.type === 'puzzles') {
        const pool = PUZZLES.filter((p) => x.theme === 'mate' ? p.themes.some((t) => t.startsWith('mateIn')) : p.themes.includes(x.theme)).sort((a, b) => a.rating - b.rating).slice(0, x.count);
        pool.forEach((p) => ex.push({ type: 'puzzle', prompt: x.prompt, puzzle: p }));
      } else ex.push(x);
    }
    const S = { phase: 'steps', i: 0, results: [], tries: 0, found: [], hintN: 0, pos: null, done: false };
    mount('<div class="hud-top"><button class="backbtn" id="ls-back">' + icon('back') + '<span>' + esc(era ? era.name : 'Learn') + '</span></button>' +
      '<div class="title"><img class="portrait" src="' + face(guide) + '" alt=""><span>' + (own ? esc(era.name) : 'Chapter ' + L.chapter) + ' · ' + esc(L.title) + '</span></div><span class="spacer"></span>' +
      '<button class="round" id="ls-again" aria-label="Hear that again" title="Hear that again">' + icon('replay') + '</button><button class="round" id="ls-voice" data-voice="' + esc(guide.name) + '"></button>' +
      '<button class="round" id="ls-set" aria-label="Settings" title="Settings">' + icon('gear') + '</button></div>' +
      '<aside class="lesson glass"><header>' + faceImg(guide) + '<div><div class="eyebrow" id="ls-phase"></div><h3>' + esc(L.title) + '</h3></div></header><div class="content" id="ls-content"></div>' +
      '<footer><div class="dots" id="ls-dots"></div><div class="grow"></div><button class="btn" id="ls-prev" aria-label="Back">' + icon('prev') + '</button><button class="btn primary" id="ls-next">Next</button></footer></aside>');
    const leaveTo = () => (era ? go('era', era.id) : go('learn'));
    $('ls-back').onclick = () => { AU.play('tap'); leaveTo(); };
    $('ls-set').onclick = () => settingsModal();
    voiceIcon($('ls-voice'), guide.name);
    $('ls-voice').onclick = () => { AU.unlock(); setVoice(!state.settings.narration, true); if (state.settings.narration) speak(true); };
    $('ls-again').onclick = () => { AU.unlock(); if (!state.settings.narration) setVoice(true, true); speak(true); };
    $('ls-prev').onclick = () => { if (S.phase === 'steps' && S.i > 0) { S.i--; renderStep(); } };
    $('ls-next').onclick = () => next();
    // The guide's line comes first (how a lesson works, then how to answer), then the step itself.
    const guided = {};
    const speak = (now) => {
      const t = S.phase === 'steps' ? L.steps[S.i].say : S.phase === 'ex' ? ex[S.i] && ex[S.i].prompt : null;
      const say = () => { if (t && state.settings.narration) AU.say(t); };
      const g = S.phase === 'steps' ? 'lesson.steps' : S.phase === 'ex' ? 'lesson.ex' : null;
      if (S.phase === 'ex' && !now) guideIdle('lesson.idle', 40000);
      if (!now && g && !guided[g]) { guided[g] = true; guideSay(g, { force: true, then: say }); } else say();
    };
    function setPos(fen, playMoves, cb) {
      const p = new E.Pos(); p.load(fen);
      S.pos = p;
      view.setBoard(piecesOf(p), null);
      view.setView(p.side === BLACK && S.phase === 'ex' ? 'black' : 'white', state.settings.view === 'top' ? 'top' : 'player');
      if (playMoves && playMoves.length) {
        let k = 0;
        const stepPlay = () => {
          if (state.screen !== 'lesson' || k >= playMoves.length) { if (cb) cb(); return; }
          const g = new E.Game(S.pos.fen());
          const info = g.playText(playMoves[k++]);
          if (!info) return;
          quickMove(info, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: info.from, lastTo: info.to }); AU.play(info.captured ? 'capture' : 'move'); setTimeout(stepPlay, 650); });
        };
        setTimeout(stepPlay, 700);
      } else if (cb) cb();
    }
    function dots() {
      const total = L.steps.length + ex.length;
      let html = '';
      for (let k = 0; k < total; k++) {
        const isEx = k >= L.steps.length, ei = k - L.steps.length;
        const cur = (S.phase === 'steps' && k === S.i) || (S.phase === 'ex' && isEx && ei === S.i);
        const r = isEx ? S.results[ei] : null;
        html += '<i class="' + (r === true ? 'ok' : r === false ? 'bad' : cur || (S.phase === 'ex' && !isEx) || (S.phase === 'done') ? 'on' : '') + '"></i>';
      }
      $('ls-dots').innerHTML = html;
    }
    function renderStep() {
      const st = L.steps[S.i];
      $('ls-phase').textContent = 'Lesson · ' + (S.i + 1) + ' of ' + L.steps.length;
      $('ls-content').innerHTML = '<p class="say">' + esc(st.say) + '</p>' + (S.i === 0 ? '<div class="objectives"><small>In this lesson</small>' + L.objectives.map((o) => '<span>' + icon('check') + esc(o) + '</span>').join('') + '</div>' : '');
      $('ls-prev').disabled = S.i === 0;
      $('ls-next').textContent = S.i === L.steps.length - 1 ? 'Start the exercises' : 'Next';
      setHooks({});
      view.setHighlights({ spots: (st.marks || []).map((m) => ({ sq: sqIndex(m) })) });
      view.setArrows((st.arrows || []).map((a) => ({ from: sqIndex(a[0]), to: sqIndex(a[1]), color: '#2fd8ff' })));
      setPos(st.fen, st.play);
      dots(); speak();
    }
    function renderEx() {
      const x = ex[S.i];
      S.tries = 0; S.found = []; S.hintN = 0; S.selected = -1; S.answered = false;
      $('ls-phase').textContent = 'Exercise · ' + (S.i + 1) + ' of ' + ex.length;
      $('ls-prev').disabled = true;
      $('ls-next').textContent = 'Skip';
      view.setArrows([]); view.setHighlights({});
      if (x.type === 'choice') {
        $('ls-content').innerHTML = '<p class="prompt">' + esc(x.prompt) + '</p><div class="choices">' + x.options.map((o, k) => '<button class="btn" data-opt="' + k + '">' + esc(o) + '</button>').join('') + '</div><div id="ls-fb"></div>';
        document.querySelectorAll('[data-opt]').forEach((b) => {
          b.onclick = () => {
            if (S.answered) return;
            const ok = +b.dataset.opt === x.answer, why = x.explain ? ' ' + x.explain : '';
            if (ok) answer(true, 'Correct.' + why);
            else { S.answered = true; if (S.results[S.i] === undefined) S.results[S.i] = false; AU.play('wrong'); fb('bad', 'Not quite. The answer is: ' + x.options[x.answer] + '.' + why); $('ls-next').textContent = S.i === ex.length - 1 ? 'Finish' : 'Next'; dots(); }
            b.classList.add(ok ? 'right' : 'wrong');
          };
        });
        setHooks({});
        if (x.fen) setPos(x.fen);
        dots(); speak();
        return;
      }
      const fen = x.type === 'puzzle' ? x.puzzle.fen : x.fen;
      const prompt = x.type === 'puzzle' ? x.prompt + ' (' + (E.positionFrom(fen, [x.puzzle.moves[0]]).side === WHITE ? 'White' : 'Black') + ' to move)' : x.prompt;
      $('ls-content').innerHTML = '<p class="prompt">' + esc(prompt) + '</p>' + (x.type === 'targets' ? '<div class="pill" id="ls-count"></div>' : '') +
        '<div style="margin-top:12px"><button class="btn small" id="ls-hint">' + icon('hint') + ' Hint</button></div><div id="ls-fb"></div>';
      $('ls-hint').onclick = () => {
        const hints = x.type === 'puzzle' ? ['Look for forcing moves: checks, captures and threats.', 'Look at your ' + C.NAME[Math.abs(E.pieceAt(S.pos, sqIndex(x.puzzle.moves[S.pz * 2 + 1].slice(0, 2))))] + '.'] : x.hints || [];
        if (S.hintN < hints.length) { fb('hint', hints[S.hintN]); S.hintN++; }
        else if (x.type === 'puzzle' || x.answers) { const u = x.type === 'puzzle' ? x.puzzle.moves[S.pz * 2 + 1] : x.answers[0]; if (u.length >= 4) view.setArrows([{ from: sqIndex(u.slice(0, 2)), to: sqIndex(u.slice(2, 4)), color: '#2fd8ff' }]); S.tries++; }
        AU.play('coach');
      };
      if (x.type === 'puzzle') {
        S.pz = 0;
        setPos(fen, [x.puzzle.moves[0]], () => { view.setView(S.pos.side === WHITE ? 'white' : 'black', 'player'); });
      } else setPos(fen);
      if (x.type === 'targets') updateCount();
      setHooks({
        onSquare: (sq) => exSquare(sq),
        canDrag: (sq) => ['move', 'mate', 'anyLegal', 'puzzle'].includes(x.type) && !S.answered && S.pos && E.pieceAt(S.pos, sq) && Math.sign(E.pieceAt(S.pos, sq)) === S.pos.side,
        onDrop: (from, to) => { const g = new E.Game(S.pos.fen()); if (!g.targets(from).includes(to)) return false; exMove(from, to); return true; },
      });
      dots(); speak();
    }
    function updateCount() {
      const x = ex[S.i];
      const g = new E.Game(S.pos.fen());
      const all = g.targets(sqIndex(x.from));
      const c = $('ls-count'); if (c) c.textContent = S.found.length + ' of ' + all.length + ' found';
      view.setHighlights({ selected: sqIndex(x.from), spots: S.found.map((s) => ({ sq: s, color: '#3ee07a', pulse: false })) });
      return all;
    }
    function fb(kind, text) { const el = $('ls-fb'); if (el) el.innerHTML = '<div class="feedback ' + kind + '">' + esc(text) + '</div>'; }
    function exSquare(sq) {
      const x = ex[S.i];
      if (S.answered) return;
      if (x.type === 'square') {
        const ok = x.answers.map(sqIndex).includes(sq);
        view.setHighlights({ spots: [{ sq, color: ok ? '#3ee07a' : '#ff4a40', pulse: false }] });
        if (ok) answer(S.tries === 0, 'Yes, that is ' + sqName(sq) + '.');
        else { S.tries++; AU.play('wrong'); fb('bad', 'That is ' + sqName(sq) + '. Try again.'); }
        return;
      }
      if (x.type === 'targets') {
        const all = updateCount();
        if (all.includes(sq)) { if (!S.found.includes(sq)) { S.found.push(sq); AU.play('select'); } }
        else if (sq !== sqIndex(x.from)) { S.tries++; AU.play('wrong'); fb('bad', sqName(sq) + ' cannot be reached from ' + x.from + '.'); }
        const left = updateCount();
        if (S.found.length === left.length) answer(S.tries === 0, 'All ' + left.length + ' squares found.');
        return;
      }
      // move-style exercises: select, then the target
      const p = E.pieceAt(S.pos, sq);
      const g = new E.Game(S.pos.fen());
      if (S.selected >= 0 && g.targets(S.selected).includes(sq)) { exMove(S.selected, sq); return; }
      if (p && Math.sign(p) === S.pos.side) {
        S.selected = sq; AU.play('select');
        const t = g.targets(sq);
        view.setHighlights({ selected: sq, targets: t.filter((s) => !E.pieceAt(S.pos, s)), captures: t.filter((s) => E.pieceAt(S.pos, s)) });
      }
    }
    function exMove(from, to) {
      const x = ex[S.i];
      const g = new E.Game(S.pos.fen());
      const go2 = (promo) => {
        const m = g.find(from, to, promo || 0);
        if (m === null) return;
        const u = E.uci(m);
        let ok = false, msg = '';
        if (x.type === 'anyLegal') { ok = true; msg = 'Good: the king is safe.'; }
        else if (x.type === 'move') { ok = x.answers.includes(u); msg = ok ? 'Well played.' : (x.wrong && x.wrong[u]) || 'Not the move we are looking for. Try again.'; }
        else if (x.type === 'mate') { const t = new E.Game(S.pos.fen()); t.play(m); ok = t.outcome && t.outcome.reason === 'checkmate'; msg = ok ? 'Checkmate!' : (x.wrong && x.wrong[u]) || (t.outcome && t.outcome.reason === 'stalemate' ? 'That is stalemate, only a draw.' : 'That is not checkmate. Try again.'); }
        else if (x.type === 'puzzle') {
          const want = x.puzzle.moves[S.pz * 2 + 1];
          const t = new E.Game(S.pos.fen()); t.play(m);
          ok = u === want || (t.outcome && t.outcome.reason === 'checkmate');
          msg = ok ? 'Correct!' : 'Not the best move. Try again.';
          if (ok && S.pz * 2 + 2 < x.puzzle.moves.length) {
            const info = g.play(m);
            AU.play(info.captured ? 'capture' : 'move');
            quickMove(info, () => {
              S.pos = g.pos; view.setBoard(piecesOf(g.pos), null);
              const reply = g.playText(x.puzzle.moves[S.pz * 2 + 2]);
              S.pz++;
              fb('ok', 'Good. Keep going.');
              setTimeout(() => quickMove(reply, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: reply.from, lastTo: reply.to }); AU.play('move'); }), 350);
            });
            return;
          }
        }
        if (ok) {
          const info = g.play(m);
          AU.play(info.captured ? 'capture' : info.check ? 'check' : 'move');
          quickMove(info, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: info.from, lastTo: info.to, check: g.pos.inCheck() ? kingSquare(g.pos, g.pos.side) : -1 }); });
          answer(S.tries === 0, msg);
        } else {
          S.tries++; AU.play('wrong'); fb('bad', msg); view.setBoard(piecesOf(S.pos), null); view.setHighlights({});
        }
        S.selected = -1;
      };
      if (g.needsPromotion(from, to)) choosePromotion(S.pos.side, (k) => { if (k) go2(k); else view.setBoard(piecesOf(S.pos), null); }); else go2(0);
    }
    function answer(firstTry, msg) {
      S.answered = true;
      guideIdle(null);
      if (S.results[S.i] === undefined) S.results[S.i] = firstTry;
      AU.play('correct');
      fb('ok', msg + (firstTry ? '' : ' (Solved after a retry.)'));
      $('ls-next').textContent = S.i === ex.length - 1 ? 'Finish' : 'Next';
      dots();
    }
    function next() {
      AU.play('tap');
      if (S.phase === 'steps') { if (S.i < L.steps.length - 1) { S.i++; renderStep(); } else { S.phase = 'ex'; S.i = 0; if (ex.length) renderEx(); else finish(); } return; }
      if (S.phase === 'ex') {
        if (S.results[S.i] === undefined) S.results[S.i] = false;   // skipped
        if (S.i < ex.length - 1) { S.i++; renderEx(); } else finish();
        return;
      }
      leaveTo();
    }
    function finish() {
      S.phase = 'done';
      setHooks({});
      const first = S.results.filter((r) => r === true).length;
      const pct = Math.round((first / Math.max(1, ex.length)) * 100);
      let res;
      if (own) res = Object.assign(stageDone(journey), { stars: pct >= 99.9 ? 3 : pct >= 80 ? 2 : 1 });
      else {
        const wasDue = PG.dueReviews(state.progress).includes(L.id);
        res = PG.lessonFinished(state.progress, L, first, ex.length, LESSONS.lessons);
        if (wasDue) PG.reviewDone(state.progress, L.id);
      }
      $('ls-phase').textContent = 'Lesson complete';
      $('ls-content').innerHTML = '<div class="done-card"><p class="big-stars">' + stars(res.stars) + '</p>' +
        '<p class="prompt">' + (pct >= 80 ? 'Mastered!' : 'Lesson complete') + '</p><p class="say">' + first + ' of ' + ex.length + ' right first time (' + pct + '%). ' + (own ? (pct >= 80 ? 'Well done! ' : 'Play it again any time to beat your score. ') + esc(guide.name) + ' is waiting for you back in ' + esc(era.name) + '.' : pct >= 80 ? 'Rooky will ask you to practise it again tomorrow, next week and next month, so you never forget it.' : 'Score 80% to master it. Try again any time.') + '</p>' +
        (res.xp ? '<span class="pill gold">+' + res.xp + ' XP</span>' : '') + '</div>';
      $('ls-next').textContent = era ? 'Back to ' + era.name : 'Back to Learn';
      const nx = LESSONS.lessons[LESSONS.lessons.indexOf(L) + 1];
      if (!era && nx && lessonOpen(nx)) { $('ls-prev').disabled = false; $('ls-prev').textContent = 'Next lesson'; $('ls-prev').onclick = () => go('lesson', nx.id); }
      else $('ls-prev').hidden = true;
      AU.play('win');
      AU.event('lesson.passed');
      guideIdle(null);
      guideSay('lesson.done', { delay: 2200 });
      view.celebrate('win', -1, null, -1);
      dots();
      if (!own) { celebrate(res); if (journey) stageDone(journey); }
    }
    renderStep();
    return { leave() { AU.hush(); }, key(e) { if (e.key === 'ArrowRight' || e.key === 'Enter') next(); } };
  };

  // ---------------------------------------------------------------- drills
  // The opening lab: play a line move by move until it is automatic.
  SCREENS.drill = function (id) {
    const o = OPENINGS.find((x) => x.id === id);
    if (!o) { setTimeout(() => go('openings'), 0); return {}; }
    const me = o.side === 'white' ? WHITE : BLACK;
    const S = { g: new E.Game(), i: 0, misses: 0, selected: -1, done: false, busy: false };
    view.setAttract(false);
    mount('<div class="hud-top"><button class="backbtn" id="dr-back">' + icon('back') + '<span>' + t('learn.labTitle') + '</span></button>' +
      '<div class="title"><img class="portrait" src="' + face(COACH) + '" alt=""><span>' + esc(o.eco) + ' · ' + esc(o.name) + '</span></div><span class="spacer"></span>' +
      '<button class="round" id="dr-set" aria-label="' + t('settings.title') + '" title="' + t('settings.title') + '">' + icon('gear') + '</button></div>' +
      '<aside class="lesson glass"><header>' + faceImg(COACH) + '<div><div class="eyebrow">' + t(o.side === 'white' ? 'learn.dr.white' : 'learn.dr.black') + '</div><h3>' + esc(o.name) + '</h3></div></header><div class="content">' +
      '<p class="say">' + esc(o.summary) + '</p><ul class="ideas">' + o.ideas.map((idea) => '<li>' + esc(idea) + '</li>').join('') + '</ul><div class="drill-moves" id="dr-moves"></div><div id="dr-fb"></div></div>' +
      '<footer><button class="btn" id="dr-hint">' + icon('hint') + ' ' + t('play.btn.hint') + '</button><button class="btn" id="dr-reset">' + icon('refresh') + ' ' + t('learn.dr.restart') + '</button><div class="grow"></div><button class="btn primary" id="dr-play" hidden>' + icon('play') + ' ' + t('learn.rv.fromHere') + '</button></footer></aside>');
    $('dr-back').onclick = () => { AU.play('tap'); go('openings', o.side); };
    $('dr-set').onclick = () => settingsModal();
    const fb = (kind, t) => { $('dr-fb').innerHTML = t ? '<div class="feedback ' + kind + '">' + esc(t) + '</div>' : ''; };
    const san = (k) => { const g = new E.Game(); for (let j = 0; j < k; j++) g.playText(o.moves[j]); return g.sans[k - 1]; };
    function moveList() {
      let h = '';
      S.g.sans.forEach((x, k) => { if (k % 2 === 0) h += '<span class="n">' + (k / 2 + 1) + '.</span>'; h += '<span class="m' + (k === S.g.sans.length - 1 ? ' last' : '') + '">' + esc(x) + '</span>'; });
      $('dr-moves').innerHTML = h || '<span class="n">' + t('learn.dr.yourMove') + '</span>';
    }
    function show(info) {
      view.setBoard(piecesOf(S.g.pos), null);
      view.setHighlights(info ? { lastFrom: info.from, lastTo: info.to } : {});
      moveList();
    }
    function advance() {
      if (S.i >= o.moves.length) return finish();
      if (S.g.pos.side === me) return;
      S.busy = true;
      setTimeout(() => {
        if (state.screen !== 'drill') return;
        const info = S.g.playText(o.moves[S.i]);
        const note = o.notes[S.i];
        S.i++;
        quickMove(info, () => { S.busy = false; show(info); AU.play(info.captured ? 'capture' : 'move'); if (note) fb('hint', t('learn.dr.theyPlay', { san: info.san, note })); advance(); });
      }, 450);
    }
    function finish() {
      if (S.done) return;
      S.done = true;
      const res = PG.openingFinished(state.progress, o.id, S.misses === 0);
      save();
      const rec = state.progress.openings[o.id];
      fb('ok', (S.misses ? t(S.misses > 1 ? 'learn.dr.slips' : 'learn.dr.slip', { n: S.misses }) : t('learn.dr.clean')) + (rec.mastered ? (res.mastered ? ' ' + t('learn.dr.mastered') : '') : ' ' + t('learn.dr.runs', { n: rec.clean })));
      AU.play('correct');
      if (res.mastered) view.celebrate('win', -1, null, -1);
      $('dr-play').hidden = false;
      celebrate(res);
    }
    function tryMove(from, to, promo) {
      if (S.done || S.busy) return false;
      const m = S.g.find(from, to, promo || 0);
      if (m === null) return false;
      const want = o.moves[S.i];
      if (E.uci(m) !== want) {
        S.misses++;
        AU.play('wrong');
        fb('bad', t('learn.dr.inLine', { san: san(S.i + 1) }) + (o.notes[S.i] ? ' ' + o.notes[S.i] : ''));
        view.setArrows([{ from: sqIndex(want.slice(0, 2)), to: sqIndex(want.slice(2, 4)), color: '#2fd8ff' }]);
        show(null);
        return true;
      }
      view.setArrows([]);
      const info = S.g.play(m);
      S.i++;
      AU.play(info.captured ? 'capture' : info.rook ? 'castle' : 'move');
      if (o.notes[S.i - 1]) fb('ok', info.san + ': ' + o.notes[S.i - 1]); else fb('ok', info.san + '. Good.');
      quickMove(info, () => { show(info); advance(); });
      return true;
    }
    setHooks({
      onSquare(sq) {
        if (S.done || S.busy || S.g.pos.side !== me) return;
        const g = S.g;
        if (S.selected >= 0 && g.targets(S.selected).includes(sq)) { const f = S.selected; S.selected = -1; tryMove(f, sq); return; }
        const p = E.pieceAt(g.pos, sq);
        if (p && Math.sign(p) === me) { S.selected = sq; AU.play('select'); const t = g.targets(sq); view.setHighlights({ selected: sq, targets: t.filter((x) => !E.pieceAt(g.pos, x)), captures: t.filter((x) => E.pieceAt(g.pos, x)) }); }
      },
      canDrag: (sq) => !S.done && !S.busy && S.g.pos.side === me && E.pieceAt(S.g.pos, sq) && Math.sign(E.pieceAt(S.g.pos, sq)) === me,
      onDrop(from, to) { return S.g.targets(from).includes(to) ? tryMove(from, to) : false; },
    });
    $('dr-hint').onclick = () => {
      if (S.done || S.g.pos.side !== me) return;
      S.misses++;
      const want = o.moves[S.i];
      view.setArrows([{ from: sqIndex(want.slice(0, 2)), to: sqIndex(want.slice(2, 4)), color: '#2fd8ff' }]);
      fb('hint', t('learn.dr.play', { san: san(S.i + 1) }) + (o.notes[S.i] ? ' ' + o.notes[S.i] : ''));
      AU.play('coach');
    };
    $('dr-reset').onclick = () => { AU.play('tap'); go('drill', id); };
    $('dr-play').onclick = () => {
      const lv = PG.personalLevel(state.progress, state.progress.premium ? 7 : 3);
      startGame({ mode: 'ai', color: o.side, level: lv, tc: 'none', fen: S.g.pos.fen() });
    };
    view.setView(o.side, 'player');
    show(null);
    fb('', '');
    advance();
    return { leave() { view.setArrows([]); } };
  };

  // ---------------------------------------------------------------- puzzles
  // The puzzle player. arg: { list, title, intro, journey, daily, rated, theme }. A journey
  // trial asks for every puzzle in its list to be solved, with hints but no solutions.
  SCREENS.puzzle = function (arg) {
    arg = arg || {};
    const P = state.progress;
    const j = arg.journey || null, era = j && eraById(j.era);
    const guide = era ? eraCoach(era) : COACH;
    view.setAttract(false);
    if (era) setLook(eraLook(era.id));
    const S = { cur: null, step: 0, pos: null, failed: false, solved: false, selected: -1, idx: -1 };
    const list = arg.list || null;
    const pickNext = () => {
      if (list) return list[++S.idx] || null;
      let pool = PUZZLES.filter((p) => !arg.theme || (arg.theme === 'mate' ? p.themes.some((t) => t.startsWith('mateIn')) : p.themes.includes(arg.theme)));
      const unseen = pool.filter((p) => !P.stats.puzzles.seen.includes(p.id));
      if (unseen.length) pool = unseen;
      if (!pool.length) return null;
      const r = P.stats.puzzles.rating;
      pool.sort((a, b) => Math.abs(a.rating - r) - Math.abs(b.rating - r));
      return pool[Math.floor(Math.random() * Math.min(5, pool.length))];
    };
    mount('<div class="hud-top"><button class="backbtn" id="pz-back">' + icon('back') + '<span>' + esc(era ? eraName(era) : t('learn.sub.puzzles')) + '</span></button>' +
      '<div class="title"><img class="portrait" src="' + face(guide) + '" alt=""><span>' + esc(arg.title || t('learn.sub.puzzles')) + '</span></div><span class="spacer"></span>' +
      '<div class="pill glass" id="pz-rating"></div><button class="round" id="pz-set" aria-label="' + t('settings.title') + '" title="' + t('settings.title') + '">' + icon('gear') + '</button></div>' +
      '<aside class="lesson glass"><header>' + faceImg(guide) + '<div><div class="eyebrow" id="pz-eyebrow">' + t('learn.pz.puzzle') + '</div><h3 id="pz-title">' + t('learn.pz.find') + '</h3></div></header><div class="content" id="pz-content"></div>' +
      '<footer><div class="dots" id="pz-dots"></div><button class="btn" id="pz-hint">' + icon('hint') + ' ' + t('play.btn.hint') + '</button>' + (j ? '' : '<button class="btn" id="pz-sol">' + icon('eye') + ' ' + t('learn.pz.solution') + '</button>') +
      '<div class="grow"></div><button class="btn primary" id="pz-next" hidden>' + t('learn.pz.next') + '</button></footer></aside>');
    $('pz-back').onclick = () => { AU.play('tap'); if (era) go('era', era.id); else go('puzzles'); };
    $('pz-set').onclick = () => settingsModal();
    const ratingPill = (delta) => { $('pz-rating').innerHTML = icon('star') + ' ' + t('play.rating', { n: '<b>' + P.stats.puzzles.rating + '</b>' }) + (delta ? ' <span class="' + (delta > 0 ? 'up' : 'down') + '">' + (delta > 0 ? '+' : '') + delta + '</span>' : ''); };
    ratingPill();
    const dots = () => { if (list && list.length > 1) $('pz-dots').innerHTML = list.map((_, k) => '<i class="' + (k < S.idx || (k === S.idx && S.solved) ? 'ok' : k === S.idx ? 'on' : '') + '"></i>').join(''); };
    function load() {
      const pz = pickNext();
      if (!pz) { $('pz-content').innerHTML = '<p class="say">' + t('learn.pz.noMore') + '</p>'; $('pz-next').hidden = true; return; }
      S.cur = pz; S.step = 0; S.failed = false; S.solved = false; S.selected = -1; S.hints = 0;
      const pre = E.positionFrom(pz.fen, []);
      S.pos = pre;
      const solverSide = -pre.side;
      view.setBoard(piecesOf(pre), null);
      view.setHighlights({}); view.setArrows([]);
      view.setView(solverSide === WHITE ? 'white' : 'black', 'player');
      $('pz-eyebrow').textContent = (list && list.length > 1 ? t('learn.pz.nOf', { n: S.idx + 1, of: list.length }) + ' · ' : arg.daily ? t('learn.dailyPuzzle') + ' · ' : '') + t('learn.pz.rated', { n: pz.rating });
      $('pz-title').textContent = t(solverSide === WHITE ? 'learn.pz.whiteFind' : 'learn.pz.blackFind');
      $('pz-content').innerHTML = '<p class="say">' + esc(arg.intro && S.idx <= 0 ? arg.intro : t('learn.pz.intro')) + '</p><div id="pz-fb"></div>';
      $('pz-next').hidden = true; $('pz-hint').disabled = false; if ($('pz-sol')) $('pz-sol').disabled = false;
      dots();
      // Animate the opponent's move that sets up the puzzle.
      setTimeout(() => {
        if (state.screen !== 'puzzle' || S.cur !== pz) return;
        const g = new E.Game(pz.fen);
        const info = g.playText(pz.moves[0]);
        quickMove(info, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: info.from, lastTo: info.to, check: g.pos.inCheck() ? kingSquare(g.pos, g.pos.side) : -1 }); AU.play(info.captured ? 'capture' : 'move'); if (S.idx <= 0) guideSay('puzzle.start', { delay: 400 }); guideIdle('puzzle.idle', 35000); });
      }, 600);
    }
    function fb(kind, t) { const el = $('pz-fb'); if (el) el.innerHTML = '<div class="feedback ' + kind + '">' + esc(t) + '</div>'; }
    function finish(solved) {
      if (S.solved) return;
      S.solved = true;
      guideIdle(null);
      const res = PG.puzzleFinished(P, S.cur, solved && !S.failed, { daily: arg.daily });
      if (!solved || S.failed) for (const t of S.cur.themes) noteMotif(t.startsWith('mateIn') ? 'mate' : t);
      ratingPill(res.ratingDelta);
      $('pz-hint').disabled = true; if ($('pz-sol')) $('pz-sol').disabled = true;
      celebrate(res);
      if (solved && !S.failed) { AU.play('correct'); view.celebrate('win', -1, null, -1); }
      dots();
      const last = list && S.idx >= list.length - 1;
      $('pz-content').insertAdjacentHTML('beforeend', '<div class="themes">' + S.cur.themes.map((th) => '<span class="pill">' + esc(themeName(th)) + '</span>').join('') + '</div>' + (arg.daily ? '<p class="say" style="margin-top:10px">' + t('learn.pz.tomorrow') + '</p>' : ''));
      if (j && last) {
        fb('ok', t('learn.pz.trial', { name: guide.name }));
        $('pz-next').textContent = t('learn.dj.backTo', { era: eraName(era) });
        $('pz-next').hidden = false;
        $('pz-next').onclick = () => { AU.play('tap'); go('era', era.id); };
        stageDone(j);
        return;
      }
      $('pz-next').textContent = t('learn.pz.next');
      $('pz-next').hidden = !!arg.daily || (list && last);
      if (solved && !$('pz-next').hidden) guideSay('puzzle.solved', { delay: 1800 });
    }
    function tryMove(from, to, promo) {
      const g = new E.Game(S.pos.fen());
      const m = g.find(from, to, promo || 0);
      if (m === null) return false;
      const want = S.cur.moves[S.step * 2 + 1];
      const t = new E.Game(S.pos.fen()); t.play(m);
      const ok = E.uci(m) === want || (t.outcome && t.outcome.reason === 'checkmate');
      if (!ok) {
        S.failed = true; AU.play('wrong'); if (guideFresh('puzzle.wrong')) guideSay('puzzle.wrong', { delay: 300 }); else AU.event('puzzle.wrong'); guideIdle('puzzle.idle', 35000); fb('bad', t('learn.pz.wrong'));
        view.setBoard(piecesOf(S.pos), null);
        return true;
      }
      const info = g.play(m);
      AU.play(info.captured ? 'capture' : info.check ? 'check' : 'move');
      quickMove(info, () => {
        S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: info.from, lastTo: info.to });
        if (S.step * 2 + 2 >= S.cur.moves.length || (t.outcome && t.outcome.reason === 'checkmate')) { fb('ok', t(S.failed ? 'learn.pz.solvedMiss' : 'learn.pz.solved')); AU.event(S.failed ? 'puzzle.solved' : 'puzzle.great'); finish(true); return; }
        const reply = g.playText(S.cur.moves[S.step * 2 + 2]);
        S.step++;
        fb('ok', t('learn.pz.keepGoing'));
        setTimeout(() => quickMove(reply, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: reply.from, lastTo: reply.to }); AU.play(reply.captured ? 'capture' : 'move'); }), 380);
      });
      return true;
    }
    setHooks({
      onSquare(sq) {
        if (!S.pos || S.solved) return;
        const g = new E.Game(S.pos.fen());
        if (S.selected >= 0 && g.targets(S.selected).includes(sq)) { const f = S.selected; S.selected = -1; if (g.needsPromotion(f, sq)) choosePromotion(S.pos.side, (k) => k && tryMove(f, sq, k)); else tryMove(f, sq); return; }
        const p = E.pieceAt(S.pos, sq);
        if (p && Math.sign(p) === S.pos.side) { S.selected = sq; AU.play('select'); const t = g.targets(sq); view.setHighlights({ selected: sq, targets: t.filter((s) => !E.pieceAt(S.pos, s)), captures: t.filter((s) => E.pieceAt(S.pos, s)) }); }
      },
      canDrag: (sq) => S.pos && !S.solved && E.pieceAt(S.pos, sq) && Math.sign(E.pieceAt(S.pos, sq)) === S.pos.side,
      onDrop(from, to) {
        const g = new E.Game(S.pos.fen());
        if (!g.targets(from).includes(to)) return false;
        if (g.needsPromotion(from, to)) { choosePromotion(S.pos.side, (k) => { if (k) tryMove(from, to, k); else view.setBoard(piecesOf(S.pos), null); }); return true; }
        return tryMove(from, to);
      },
    });
    $('pz-hint').onclick = () => {
      if (!S.cur || S.solved) return;
      S.failed = true; S.hints++;
      guideIdle(null);
      const u = S.cur.moves[S.step * 2 + 1];
      if (S.hints === 1) { const th = S.cur.themes[0]; fb('hint', I18N.has('learn.pzh.' + th) ? t('learn.pzh.' + th) : t(th.startsWith('mateIn') ? 'learn.pzh.mate' : 'learn.pzh.forcing')); }
      else if (S.hints === 2 || !j) { view.setHighlights({ selected: sqIndex(u.slice(0, 2)) }); fb('hint', t('learn.pzh.piece', { sq: u.slice(0, 2) })); }
      else { view.setArrows([{ from: sqIndex(u.slice(0, 2)), to: sqIndex(u.slice(2, 4)), color: '#2fd8ff' }]); fb('hint', t('learn.pzh.arrow')); }
      AU.play('coach');
    };
    if ($('pz-sol')) $('pz-sol').onclick = () => {
      if (!S.cur || S.solved) return;
      S.failed = true;
      const u = S.cur.moves[S.step * 2 + 1];
      view.setArrows([{ from: sqIndex(u.slice(0, 2)), to: sqIndex(u.slice(2, 4)), color: '#2fd8ff' }]);
      const g = new E.Game(S.pos.fen()); const m = g.pos.parseMove(u, g.legal);
      fb('hint', t('learn.pz.theSolution', { san: g.pos.san(m, g.legal) }) + ' ' + (C.describe(C.facts(g.pos, m)) || ''));
      finish(false);
    };
    $('pz-next').onclick = () => { AU.play('tap'); load(); };
    load();
    return {};
  };

  // ---------------------------------------------------------------- shared API for the online client
  window.ChacklateApp = {
    E, state, toast, modal, esc, icon, save, go, avatarHtml, PG, AU, celebrate, quickPlayOffline, setEntitlements, setSafety, parentGate,
    // Taps a square by name ("e4"), the same as clicking it on the board. Used by automated tests.
    tap(name) { ctlHooks.onSquare(sqIndex(name)); },
    startOnline(info) {
      // info: { id, color: 'white'|'black', tc, opponent, moves, clock, rating }
      startGame({ mode: 'online', color: info.color, level: 0, tc: info.tc, fen: '', online: null }, { moves: info.moves || [], human: info.color === 'white' ? WHITE : BLACK });
      const G = state.game;
      G.online = { id: info.id, tc: info.tc, opponent: info.opponent, rating: info.rating, clock: info.clock || { w: 0, b: 0, at: performance.now() },
        clockNow() { const c = this.clock; if (!c) return null; const out = { w: c.w, b: c.b }; if (!G.g.outcome && G.g.moves.length >= 2) { const k = G.g.pos.side === WHITE ? 'w' : 'b'; out[k] = Math.max(0, c[k] - (performance.now() - c.at)); } return out; } };
      renderTitle(); renderCards(); renderHud();
    },
    onlineMove(uci, clock) {
      const G = state.game; if (!G || G.kind !== 'online') return;
      if (clock) G.online.clock = Object.assign({}, clock, { at: performance.now() });
      const m = G.g.pos.parseMove(uci, G.g.legal);
      if (m === null || m === undefined) return;
      playMove(m, false);
    },
    onlineSync(moves, clock) {
      const G = state.game; if (!G || G.kind !== 'online') return;
      if (clock) G.online.clock = Object.assign({}, clock, { at: performance.now() });
      const mine = G.g.uciMoves();
      if (mine.join(' ') === moves.join(' ')) { renderHud(); return; }
      const g = new E.Game(); for (const u of moves) g.playText(u);
      G.g = g; G.busy = false;
      view.setBoard(piecesOf(g.pos), capturedFor(g)); refreshHighlights(); renderHud();
    },
    onlineEnd(result, reason, rating) {
      const G = state.game; if (!G || G.kind !== 'online') return;
      if (rating) { G.online.rating = rating.after; G.online.ratingDelta = rating.after - rating.before; }
      G.online.ended = true; clearTimeout(G.online.endWait);
      if (!G.g.outcome) G.g.finish(result, reason);
      endGame();
    },
    onlineEmote(id, mine) { showEmote(id, mine); },
    onlineStatus(s) { const G = state.game; if (!G || G.kind !== 'online') return; Object.assign(G.online, s); renderHud(); },
    drawOffered() {
      const G = state.game; if (!G) return;
      AU.event('draw.offer');
      coachSay(t('play.offer'), [[t('play.accept'), 'accept-draw'], [t('play.decline'), 'dismiss']]);
      const b = document.querySelector('[data-coach="accept-draw"]');
      if (b) b.onclick = () => { ChacklateNet.send({ type: 'draw-accept' }); G.coachMsg = null; renderCoach(); };
    },
  };

  // ---------------------------------------------------------------- boot
  (function grain() {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'); const d = g.createImageData(128, 128);
      for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0);
      $('grain').style.backgroundImage = 'url(' + c.toDataURL() + ')';
    } catch (e) { /* decorative only */ }
  })();
  $('splash').insertAdjacentHTML('afterbegin', '<img src="' + ART.crestUri() + '" alt="">');
  // the tab icon is the crest too, also when the page is opened as a file with no server behind it
  for (const l of document.querySelectorAll('link[rel="icon"]')) l.href = ART.crestUri();
  applySettings();
  window.addEventListener('pagehide', save);
  document.addEventListener('pointerdown', () => AU.unlock(), { once: true });
  if (window.__SHOT) window.__go = go;
  go('home');
  // The hero frames the table under the wordmark, which settles once the fonts are in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => applyInsets());
  // App shortcuts from the installed icon's menu, and links from emails.
  if (location.hash === '#quick') setTimeout(() => quickPlay(), 300);
  else if (location.hash.startsWith('#reset=') && window.ChacklateNet) ChacklateNet.resetModal(location.hash.slice(7));
  else if (location.hash === '#email-verified') toast(t('profile.emailOk'));
  else if (location.hash === '#email-invalid') toast(t('profile.emailBad'), 'bad');
  else if (location.hash === '#daily' && dailyPuzzle()) go('puzzle', { list: [dailyPuzzle()], daily: true, title: t('learn.dailyPuzzle') });
  else if (location.hash === '#journey') go('journey');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  setTimeout(() => $('splash').classList.add('gone'), window.__SHOT ? 0 : 900);
  if (window.ChacklateNet) ChacklateNet.connect();
})();
