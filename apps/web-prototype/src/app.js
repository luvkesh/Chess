// Chacklate Chess app: screens, game flow, coach, lessons, puzzles, review,
// collection and progression, wired to the 3D view, the engine workers and
// (when a server is reachable) online play.
(function () {
  'use strict';
  const E = ChacklateEngine();
  const C = ChacklateCoach(E);
  const CATALOG = CHACKLATE_CATALOG, LESSONS = CHACKLATE_LESSONS, PUZZLES = CHACKLATE_PUZZLES;
  const OPENINGS = CHACKLATE_OPENINGS.openings, ENDGAMES = CHACKLATE_ENDGAMES.endgames;
  const STORE = CHACKLATE_STORE;
  const PG = ChacklateProgress(CATALOG, { seasons: CHACKLATE_SEASONS, missions: CHACKLATE_MISSIONS });
  const AU = ChacklateAudio();
  const { WHITE, BLACK, LEVELS } = E;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // A plain end date rather than a countdown: no ticking clocks aimed at children.
  const seasonEnd = (s) => new Date(s.ends + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const STORE_KEY = 'chacklate-chess:v2';
  const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  const WGLYPH = { 1: '♙', 2: '♘', 3: '♗', 4: '♖', 5: '♕', 6: '♔' };
  const VALUE = [0, 1, 3, 3, 5, 9, 0];
  const REASON_TEXT = {
    checkmate: 'Checkmate', resignation: 'Resignation', timeout: 'Time ran out', 'timeout-insufficient': 'Time ran out, but no mate was possible',
    stalemate: 'Stalemate', insufficient: 'Not enough material', threefold: 'Threefold repetition', fivefold: 'Fivefold repetition',
    fifty: 'Fifty-move rule', seventyfive: 'Seventy-five-move rule', agreement: 'Draw agreed', abandoned: 'Opponent left', aborted: 'Game aborted', dojo: 'Endgame dojo',
  };
  const I = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    learn: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    improve: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    collection: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 6 3-6M12 9v12"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    hint: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    draw: '<path d="M7 12h10M7 8h10M7 16h10"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    flip: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    cam: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    first: '<path d="M18 18l-6-6 6-6M6 6v12"/>', prev: '<path d="M15 18l-6-6 6-6"/>', next: '<path d="M9 18l6-6-6-6"/>', last: '<path d="M6 18l6-6-6-6M18 6v12"/>',
    play: '<path d="M6 4l14 8-14 8z"/>', speaker: '<path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>', users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c1-4 3.5-6 7-6s6 2 7 6M16 4a4 4 0 0 1 0 8M22 21c-.6-2.6-2-4.4-4-5.3"/>',
    star: '<path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z"/>', trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H3a4 4 0 0 0 4 4M17 6h4a4 4 0 0 1-4 4"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>', crown: '<path d="M3 18h18M4 18L3 7l5 4 4-7 4 7 5-4-1 11"/>', target: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', season: '<path d="M12 2c3 4 6 6 6 11a6 6 0 0 1-12 0c0-5 3-7 6-11z"/><path d="M12 22v-6"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', check: '<path d="M20 6L9 17l-5-5"/>', refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15"/>',
  };
  const icon = (k, cls) => '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[k] + '</svg>';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------ persistence
  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } })() || {};
  const state = {
    settings: Object.assign({ quality: 'high', animations: !reducedMotion, sfx: true, sfxVol: 0.8, music: true, musicVol: 0.35, narration: true, voiceCoach: 'mira', voiceCalls: 'mira', announce: false, coach: 'normal',
      legal: true, turnBoard: true, view: 'player', evalBar: false, server: '', name: 'You' }, saved.settings || {}),
    setup: Object.assign({ mode: 'ai', color: 'white', level: 1, tc: 'none', fen: '', personal: false }, saved.setup || {}),
    progress: PG.migrate(saved.progress),
    screen: 'home',
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
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  let gatePassed = 0;
  function parentGate(why) {
    if (Date.now() - gatePassed < 10 * 60e3) return Promise.resolve(true);
    return new Promise((resolve) => {
      const a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
      let done = false;
      const m = modal('<div class="eyebrow">For grown-ups</div><h2>Ask a parent</h2><p class="sub">' + esc(why) + '</p>' +
        '<form id="pg"><div class="field"><label for="pg-a">What is ' + WORDS[a] + ' times ' + WORDS[b] + '?</label><input class="text-in" id="pg-a" inputmode="numeric" autocomplete="off" maxlength="3" required></div>' +
        '<div class="row"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Continue</button></div></form>',
      { onClose() { if (!done) resolve(false); } });
      m.querySelector('#pg').onsubmit = (e) => {
        e.preventDefault();
        done = true; m.close();
        if (+m.querySelector('#pg-a').value === a * b) { gatePassed = Date.now(); resolve(true); }
        else { toast('That answer is not right.', 'bad'); resolve(false); }
      };
    });
  }
  function askPin() {
    return new Promise((resolve) => {
      let done = false;
      const m = modal('<div class="eyebrow">Parent PIN</div><h2>A parent needs to approve this</h2><p class="sub">Enter the PIN you chose on the parent page.</p>' +
        '<form id="pp"><div class="field"><label for="pp-pin">PIN</label><input class="text-in" id="pp-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" required></div>' +
        '<div class="row"><button class="btn" type="button" data-close>Cancel</button><button class="btn gold" type="submit">Approve</button></div></form>',
      { onClose() { if (!done) resolve(null); } });
      m.querySelector('#pp').onsubmit = (e) => { e.preventDefault(); done = true; const v = m.querySelector('#pp-pin').value; m.close(); resolve(v); };
    });
  }

  // Daily time limit a parent can set. Counts minutes with the page visible, per local day.
  const PLAY_KEY = 'chacklate-chess:playtime';
  const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function playTime() {
    let t = null; try { t = JSON.parse(localStorage.getItem(PLAY_KEY) || 'null'); } catch (e) { t = null; }
    return t && t.day === localDay() ? t : { day: localDay(), ms: 0, extra: 0 };
  }
  let breakModal = null;
  function checkPlayTime() {
    const lim = safety && safety.dailyMinutes;
    if (!lim) { if (breakModal) { breakModal.close(); breakModal = null; } return; }
    const t = playTime();
    if (t.ms < (lim + t.extra) * 60e3 || breakModal) return;
    if (state.game && state.game.kind === 'online' && !state.game.g.outcome) return; // let the game finish
    breakModal = modal('<div style="text-align:center"><div class="eyebrow">Time for a break</div><h2 class="result-title" style="margin-top:8px">That\'s today\'s chess</h2>' +
      '<p class="sub">Your parent set ' + lim + ' minutes a day. Your progress is saved. See you tomorrow!</p>' +
      '<div class="row" style="justify-content:center"><button class="btn" id="br-more">Grown-up: 15 more minutes</button></div></div>', { sticky: true, onClose() { breakModal = null; } });
    breakModal.querySelector('#br-more').onclick = async () => {
      const m = breakModal; m.style.visibility = 'hidden';
      if (await parentGate('A parent can allow 15 more minutes today.')) {
        const t2 = playTime(); t2.extra += 15; try { localStorage.setItem(PLAY_KEY, JSON.stringify(t2)); } catch (e) { /* not stored */ }
        breakModal = null; m.close();
      } else m.style.visibility = '';
    };
  }
  setInterval(() => {
    if (document.hidden || !(safety && safety.dailyMinutes)) return;
    const t = playTime(); t.ms += 30e3;
    try { localStorage.setItem(PLAY_KEY, JSON.stringify(t)); } catch (e) { /* not stored */ }
    checkPlayTime();
  }, 30e3);

  // ------------------------------------------------------------ engine workers
  // Two workers: one plays and hints, one analyses (reviews, coach) so a long
  // review never delays the computer's move.
  function makeWorker() {
    try {
      const src = 'const E=(' + ChacklateEngine.toString() + ')();const C=(' + ChacklateCoach.toString() + ')(E);' +
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

  // ------------------------------------------------------------------ view
  const canvas = $('board');
  let view = null;
  const ctlHooks = { onSquare() {}, canDrag() { return false; }, onDrop() { return false; } };
  try {
    view = ChacklateRenderer(canvas, {
      onSquare: (sq, how) => ctlHooks.onSquare(sq, how),
      canDrag: (sq) => ctlHooks.canDrag(sq),
      onDrop: (f, t) => ctlHooks.onDrop(f, t),
      onContextLost() { $('nogl').hidden = false; },
    });
  } catch (e) { console.error(e); view = null; }
  if (!view) { $('nogl').hidden = false; view = nullView(); }
  function nullView() {
    const noop = () => {};
    return { setBoard: noop, setHighlights: noop, setArrows: noop, setTheme: noop, setRoom: noop, setFx: noop, setCaptureEffects: noop, setQuality: noop, setAnimations: noop, setShift: noop,
      setAttract: noop, setView: noop, intro: noop, celebrate: noop, setClock: noop, showcase: noop, cancelDrag: noop, requestRender: noop, resize: noop, animateMove(info, done) { done(); } };
  }
  function setHooks(h) { ctlHooks.onSquare = h.onSquare || (() => {}); ctlHooks.canDrag = h.canDrag || (() => false); ctlHooks.onDrop = h.onDrop || (() => false); }

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

  // Cosmetics: whatever is equipped (or being previewed) drives the scene.
  let preview = null;
  function applyLook() {
    const pick = (cat) => (preview && preview.category === cat ? preview : PG.equipped(state.progress, cat));
    view.setTheme(pick('board').data, pick('pieces').data);
    view.setRoom(pick('room').data);
    view.setFx({ capture: pick('capture').data, victory: pick('victory').data, trail: pick('trail').data });
    AU.setPack(pick('sound').data.pack);
    clockSkin = pick('clock').data;
    document.documentElement.style.setProperty('--bg', pick('room').data.fog);
  }
  let clockSkin = null;
  function applySettings() {
    const s = state.settings;
    view.setQuality(s.quality);
    view.setAnimations(s.animations && !window.__SHOT);
    AU.setSfx(s.sfx, s.sfxVol);
    AU.setMusic(s.music, s.musicVol);
    AU.setVoices({ coach: s.voiceCoach, calls: s.voiceCalls, announce: s.announce });
    applyLook();
  }

  // ------------------------------------------------------------ toasts
  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast glass' + (kind ? ' ' + kind : '');
    t.innerHTML = msg;
    $('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, kind === 'ach' ? 3600 : 2300);
  }
  // Show XP, level-ups, achievements and unlocks from a progress result.
  function celebrate(res, quiet) {
    if (!res) return;
    res.achievements.forEach((a, i) => setTimeout(() => {
      AU.play('achievement');
      toast('<i>★</i><div><small>Achievement</small><b>' + esc(a.name) + '</b> · +' + a.xp + ' XP</div>', 'ach');
    }, 600 + i * 900));
    const lag = 600 + res.achievements.length * 900;
    (res.missions || []).forEach((m, i) => setTimeout(() => {
      AU.play('achievement');
      toast('<i>✓</i><div><small>Mission complete</small><b>' + esc(m.text) + '</b> · +' + m.xp + ' XP</div>', 'ach');
    }, lag + i * 900));
    if (res.missionsAll) setTimeout(() => toast('All of today\'s missions done. +' + CHACKLATE_MISSIONS.allDoneXp + ' XP bonus.'), lag + (res.missions || []).length * 900);
    if (res.seasonTier && !res.levelUp) setTimeout(() => toast('Season tier ' + res.seasonTier + ' reached.'), lag + 300);
    if (res.levelUp) setTimeout(() => levelUpModal(res.levelUp, res.unlocked), lag + (res.missions || []).length * 900);
    else if (res.unlocked.length && !quiet) toast('Unlocked: ' + res.unlocked.map((u) => esc(u.name)).join(', '));
    save();
    renderMePill();
  }

  // ------------------------------------------------------------ modals
  function modal(html, opts) {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML = '<div class="card">' + html + '</div>';
    $('modals').appendChild(wrap);
    AU.play('open');
    const close = () => { wrap.remove(); if (opts && opts.onClose) opts.onClose(); };
    wrap.addEventListener('click', (e) => {
      if ((e.target === wrap && !(opts && opts.sticky)) || e.target.closest('[data-close]')) close();
    });
    const f = wrap.querySelector('[autofocus], .btn.primary, button, input');
    if (f) setTimeout(() => f.focus(), 30);
    wrap.close = close;
    return wrap;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.modal')].pop();
      if (open) open.close();
      else if (current && current.escape) current.escape();
    } else if (!document.querySelector('.modal') && current && current.key && !/input|textarea|select/i.test((e.target.tagName || ''))) current.key(e);
  });

  // ------------------------------------------------------------ screens
  let current = null;   // the active screen controller
  function go(name, arg) {
    if (current && current.leave) current.leave();
    AU.hush();
    view.setArrows([]);
    setHooks({});
    preview = null; applyLook();
    state.screen = name;
    const S = SCREENS[name];
    current = S(arg) || {};
    applyShift();
    $('screens').querySelectorAll('.screen').forEach((s) => s.classList.add('enter'));
  }
  // Slide the board clear of the glass panels: right of a left-hand panel on wide screens,
  // up above the bottom sheet on phones.
  function applyShift() {
    if (!current) return;
    const portrait = innerWidth < 760 && innerHeight > innerWidth;
    if (portrait) return view.setShift(0, current.shiftY == null ? 0.26 : current.shiftY, 1);
    if (innerWidth <= 980) return view.setShift(0, 0, 1);
    const right = document.querySelector('#screens .side, #screens .lesson');
    const left = document.querySelector('#screens .sheet, #screens .home');
    if (right) {
      const frac = (innerWidth - right.getBoundingClientRect().left) / innerWidth;
      return view.setShift(-frac, 0.03, 1 + frac * 0.5);
    }
    if (left) return view.setShift(Math.min(0.45, left.getBoundingClientRect().right / innerWidth * 0.85), 0, 1);
    view.setShift(0, 0, 1);
  }
  window.addEventListener('resize', applyShift);
  function mount(html) { $('screens').innerHTML = '<div class="screen">' + html + '</div>'; }

  function avatarHtml(cls, avatarId, frameId) {
    const a = (avatarId ? PG.item(avatarId) : PG.equipped(state.progress, 'avatar')) || PG.item(CATALOG.defaults.avatar);
    const f = (frameId ? PG.item(frameId) : PG.equipped(state.progress, 'frame')) || PG.item(CATALOG.defaults.frame);
    const ring = f && f.data.ring !== 'transparent' ? ' ringed" style="--ring:' + f.data.ring + ';background:linear-gradient(145deg,' + a.data.from + ',' + a.data.to + ')' : '" style="background:linear-gradient(145deg,' + a.data.from + ',' + a.data.to + ')';
    return '<div class="avatar ' + (cls || '') + ring + '">' + esc(a.data.glyph) + '</div>';
  }
  function topbar(opts) {
    const lv = PG.levelFor(state.progress.xp);
    return '<div class="topbar">' +
      (opts && opts.back ? '<button class="btn glass small" id="tb-back">' + icon('back') + '<span>' + esc(opts.back) + '</span></button>' : '') +
      (opts && opts.title ? '<div class="pill gold">' + esc(opts.title) + '</div>' : '') +
      '<div class="spacer"></div>' +
      (state.progress.premium ? '' : '<button class="btn gold small tb-prem" id="tb-store">' + icon('crown') + '<span>Premium</span></button>') +
      '<button class="me-pill glass" id="tb-me" title="Profile">' + avatarHtml('sm') + '<div><div style="font-weight:650;font-size:14px;text-align:left">' + esc(state.settings.name) + '</div>' +
      '<div class="lvl">Level <b>' + lv.level + '</b> · ' + esc(lv.title) + (state.progress.streak.count > 1 ? ' · <span class="streak">' + state.progress.streak.count + '-day streak</span>' : '') + '</div>' +
      '<div class="bar"><i style="width:' + Math.round((lv.into / lv.need) * 100) + '%"></i></div></div></button>' +
      '<button class="btn glass icon" id="tb-settings" title="Settings" aria-label="Settings">' + icon('gear') + '</button></div>';
  }
  function wireTopbar(onBack) {
    const b = $('tb-back'); if (b) b.onclick = () => { AU.play('tap'); onBack(); };
    $('tb-me').onclick = () => { AU.play('tap'); go('profile'); };
    $('tb-settings').onclick = () => { AU.play('tap'); settingsModal(); };
    const st = $('tb-store'); if (st) st.onclick = () => { AU.play('tap'); go('store'); };
  }
  function renderMePill() {
    const old = $('tb-me'); if (!old) return;
    const tmp = document.createElement('div'); tmp.innerHTML = topbar();
    old.replaceWith(tmp.querySelector('#tb-me'));
    $('tb-me').onclick = () => go('profile');
  }
  function navbar(active) {
    const tabs = [['home', 'Home'], ['learn', 'Learn'], ['improve', 'Improve'], ['collection', 'Collection'], ['profile', 'Profile']];
    return '<nav class="nav glass" aria-label="Main">' + tabs.map(([k, t]) => '<button data-nav="' + k + '"' + (k === active ? ' aria-current="page"' : '') + '>' + icon(k) + t + '</button>').join('') + '</nav>';
  }
  function wireNav() {
    document.querySelectorAll('[data-nav]').forEach((b) => { b.onclick = () => { AU.play('tap'); go(b.dataset.nav); }; });
  }

  // A calm board for menu screens: the last position or the start, slowly orbiting.
  function idleBoard() {
    const pos = new E.Pos(); pos.load(E.START_FEN);
    view.setBoard(piecesOf(pos), null);
    view.setHighlights({});
    view.setClock(null);
    view.setAttract(true);
  }

  const SCREENS = {};

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
  SCREENS.home = function () {
    idleBoard();
    const nl = nextLesson();
    const st = state.progress.stats;
    const daily = dailyPuzzle();
    const dailyDone = state.progress.daily.date === PG.today() && state.progress.daily.done;
    const resume = saved.game && saved.game.moves && saved.game.moves.length && !state.game;
    const online = window.ChacklateNet && ChacklateNet.available();
    mount(topbar() +
      '<section class="home" aria-label="Home">' +
      '<div><h1 class="wordmark">Chacklate<small>Chess</small></h1></div>' +
      '<p class="tagline">Beautiful chess with a coach that explains every move. Eight AI personalities, lessons, puzzles and online play.</p>' +
      '<div class="actions">' +
      (resume ? '<button class="action hero" id="a-resume"><div class="glyph">♞</div><div><b>Resume your game</b><span>' + esc(saved.game.moves.length) + ' moves in. Pick up where you left off.</span></div><div class="go">›</div></button>' : '') +
      '<button class="action' + (resume ? '' : ' hero') + '" id="a-quick"><div class="glyph">' + icon('bolt') + '</div><div><b>Quick Play</b><span>' + (online ? 'A casual game online, or the computer if no one is around.' : 'A game against the computer at your level.') + '</span></div><div class="go">›</div></button>' +
      '<button class="action" id="a-learn"><div class="glyph">' + icon('learn') + '</div><div><b>Continue Learning</b><span>' + (nl ? 'Next: ' + esc(nl.title) : 'All free lessons complete. Try the Improve tab.') + '</span></div><div class="go">›</div></button>' +
      '<button class="action" id="a-friend"><div class="glyph">' + icon('users') + '</div><div><b>Play a Friend</b><span>' + (online ? 'Share a 6-letter code, or pass and play on this device.' : 'Pass and play on this device. Online codes need the game server.') + '</span></div><div class="go">›</div></button>' +
      '<button class="action" id="a-improve"><div class="glyph">' + icon('improve') + '</div><div><b>Improve My Chess</b><span>' + (daily && !dailyDone ? 'Today\'s puzzle is waiting.' : 'Puzzles, game reviews and training.') + '</span></div><div class="go">›</div></button>' +
      '</div>' +
      missionsCard() + seasonStrip() +
      '<div class="today">' +
      '<div class="mini glass"><div class="eyebrow">Games</div><b>' + st.games + '</b><small style="color:var(--muted)">' + st.wins + ' won · ' + st.draws + ' drawn</small></div>' +
      '<div class="mini glass"><div class="eyebrow">Puzzle rating</div><b>' + st.puzzles.rating + '</b><small style="color:var(--muted)">' + st.puzzles.solved + ' solved</small></div>' +
      '</div>' +
      '<button class="btn glass" id="a-custom" style="justify-self:start">' + icon('gear') + ' Custom game against the computer</button>' +
      '</section>' + navbar('home'));
    wireTopbar();
    wireNav();
    $('a-quick').onclick = () => { AU.unlock(); AU.play('tap'); quickPlay(); };
    $('a-learn').onclick = () => { AU.unlock(); AU.play('tap'); if (nl) go('lesson', nl.id); else go('learn'); };
    $('a-friend').onclick = () => { AU.unlock(); AU.play('tap'); friendModal(); };
    $('a-improve').onclick = () => { AU.unlock(); AU.play('tap'); go('improve'); };
    $('a-custom').onclick = () => { AU.unlock(); AU.play('tap'); newGameModal(); };
    if (resume) $('a-resume').onclick = () => { AU.unlock(); AU.play('tap'); resumeSaved(); };
    const ss = $('a-season'); if (ss) ss.onclick = () => { AU.play('tap'); go('season'); };
    return { leave() { view.setAttract(false); } };
  };

  // ---------------------------------------------------------------- missions and season
  function missionsCard() {
    const list = PG.missionList(state.progress, undefined, { online: !!(window.ChacklateNet && ChacklateNet.available()) });
    if (!list.length) return '';
    const done = list.filter((m) => m.done).length;
    return '<div class="missions glass"><div class="mh"><div class="eyebrow">Today\'s missions</div><span class="pill' + (done === list.length ? ' gold' : '') + '">' + done + ' / ' + list.length + '</span></div>' +
      list.map((m) => '<div class="mission' + (m.done ? ' done' : '') + '"><i>' + (m.done ? '✓' : icon('target')) + '</i><div><b>' + esc(m.text) + '</b><div class="bar"><i style="width:' + Math.round(m.n / m.goal * 100) + '%"></i></div></div><small>' + (m.done ? 'Done' : m.n + '/' + m.goal) + '<br><span>+' + m.xp + ' XP</span></small></div>').join('') + '</div>';
  }
  function seasonStrip() {
    const s = state.progress.season && PG.seasonInfo(state.progress, state.progress.season);
    if (!s) return '';
    return '<button class="season-strip glass" id="a-season"><div class="sg">' + icon('season') + '</div><div style="flex:1"><div class="eyebrow">Season ' + s.season.number + ' · runs to ' + seasonEnd(s.season) + '</div><b>' + esc(s.season.name) + ' · Tier ' + s.tier + '</b>' +
      '<div class="bar"><i style="width:' + Math.round(s.into / s.need * 100) + '%"></i></div></div><div class="go">›</div></button>';
  }

  // Swatches for cosmetics, shared by the collection and the season track.
  function swatch(it) {
    const d = it.data || {};
    if (it.category === 'board') return 'background:conic-gradient(' + d.light + ' 0 25%,' + d.dark + ' 0 50%,' + d.light + ' 0 75%,' + d.dark + ' 0) 0 0/50% 50%;box-shadow:inset 0 0 0 4px ' + d.frame;
    if (it.category === 'pieces') return 'background:linear-gradient(135deg,' + d.white.color + ' 50%,' + d.black.color + ' 50%)';
    if (it.category === 'room') return 'background:radial-gradient(circle at 50% 70%,' + d.table + ',' + d.top + ' 60%,' + d.fog + ')';
    if (it.category === 'clock') return 'background:' + d.face + ';color:' + d.glow + ';font:700 22px/1 var(--mono)';
    if (it.category === 'avatar') return 'background:linear-gradient(145deg,' + d.from + ',' + d.to + ');color:#fff';
    if (it.category === 'frame') return 'background:' + (d.ring === 'transparent' ? 'rgba(255,235,215,.05)' : d.ring);
    const cols = (d && d.colors) || ['#555', '#333'];
    return 'background:radial-gradient(circle at 30% 40%,' + (cols[0] || '#444') + ' 0 10%,transparent 11%),radial-gradient(circle at 65% 30%,' + (cols[1] || cols[0] || '#444') + ' 0 8%,transparent 9%),radial-gradient(circle at 55% 70%,' + (cols[2] || cols[0] || '#444') + ' 0 12%,transparent 13%),#1a1210';
  }
  const swatchGlyph = (it) => it.category === 'clock' ? '5:00' : it.category === 'avatar' ? esc(it.data.glyph) : it.category === 'sound' ? '♪' : it.category === 'pieces' ? '<span style="color:' + it.data.black.color + ';text-shadow:0 0 6px rgba(255,255,255,.4)">♞</span>' : it.category === 'victory' ? '★' : '';

  SCREENS.season = function () {
    idleBoard();
    const P = state.progress;
    const id = P.season || (PG.SEASONS.seasons[PG.SEASONS.seasons.length - 1] || {}).id;
    const s = id && PG.seasonInfo(P, id);
    if (!s) { mount(topbar({ back: 'Home' }) + '<section class="sheet glass"><header><h2>Seasons</h2><p>The next season starts soon.</p></header></section>'); wireTopbar(() => go('home')); return {}; }
    const at = (tier, track) => s.items.find((i) => i.unlock.tier === tier && i.unlock.track === track);
    const cell = (it, track, reached) => {
      if (!it) return '<div class="tcell empty"></div>';
      const un = PG.isUnlocked(P, it);
      return '<button class="tcell' + (un ? ' got' : '') + (track === 'pass' ? ' pass' : '') + '" data-item="' + it.id + '"><div class="sw" style="' + swatch(it) + '">' + swatchGlyph(it) + '</div><div><b>' + esc(it.name) + '</b><small>' +
        esc(CATALOG.categories.find((c) => c.id === it.category).name.replace(/s$/, '')) + ' · ' + (un ? 'Unlocked' : reached && track === 'pass' ? 'Needs the pass' : 'Tier ' + it.unlock.tier) + '</small></div></button>';
    };
    const rows = [];
    for (let t = 1; t <= s.season.tiers; t++) {
      const f = at(t, 'free'), p = at(t, 'pass');
      if (!f && !p) continue;
      const reached = s.tier >= t;
      rows.push('<div class="tier' + (reached ? ' reached' : '') + (s.tier + 1 === t ? ' next' : '') + '"><div class="tn">' + t + '</div>' + cell(f, 'free', reached) + cell(p, 'pass', reached) + '</div>');
    }
    mount(topbar({ back: 'Home' }) + '<section class="sheet glass"><header><div class="eyebrow">Season ' + s.season.number + ' · runs to ' + seasonEnd(s.season) + '</div><h2>' + esc(s.season.name) + '</h2><p>' + esc(s.season.blurb) + '</p></header><div class="body">' +
      '<div class="hero-card"><div class="sg big">' + icon('season') + '</div><div style="flex:1"><div style="font:400 24px/1.1 var(--display)">Tier ' + s.tier + ' of ' + s.season.tiers + '</div>' +
      '<div style="color:var(--muted);font-size:13px;margin:4px 0 8px">' + (s.tier >= s.season.tiers ? 'Track complete.' : s.into + ' / ' + s.need + ' season XP to tier ' + (s.tier + 1)) + '</div><div class="bar"><i style="width:' + Math.round(s.into / s.need * 100) + '%"></i></div></div></div>' +
      (s.pass ? '<p class="pill gold" style="margin:4px 0 14px">' + icon('crown') + (P.premium ? ' Season Pass included with Premium' : ' Season Pass owned') + '</p>'
        : '<div class="pass-cta"><div><b>Season Pass</b><small>Unlock the gold track: ' + s.items.filter((i) => i.unlock.track === 'pass').length + ' extra rewards, including tiers you have already reached.</small></div><button class="btn gold" id="se-buy">Get the pass</button></div>') +
      '<div class="tier head"><div class="tn"></div><div class="eyebrow">Free track</div><div class="eyebrow" style="color:var(--gold-2)">Season Pass</div></div>' +
      rows.join('') +
      '<p style="color:var(--faint);font-size:12.5px;margin-top:16px">Every XP you earn while the season runs counts: games, puzzles, lessons, drills, the dojo and daily missions. Items you unlock stay yours after the season ends.</p></div></section>' + navbar('home'));
    wireTopbar(() => go('home')); wireNav();
    const b = $('se-buy'); if (b) b.onclick = () => go('store', 'pass.' + id);
    document.querySelectorAll('[data-item]').forEach((el) => { el.onclick = () => { const it = PG.item(el.dataset.item); preview = it; applyLook(); if (it.category === 'capture' || it.category === 'victory') view.celebrate('win', -1, null, sqIndex('e1')); toast((PG.isUnlocked(P, it) ? 'Previewing ' : 'Preview: ') + esc(it.name)); }; });
    return { leave() { preview = null; applyLook(); view.setAttract(false); } };
  };

  // ---------------------------------------------------------------- store
  const money = (p) => !p ? 'Price at launch' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.amount / 100);
  SCREENS.store = function (focus) {
    idleBoard();
    const P = state.progress;
    let remote = null;
    function render() {
      if (Date.now() - gatePassed >= 10 * 60e3) {
        $('st-body').innerHTML = '<p class="sub">The store is for grown-ups. A parent can open it.</p><div class="row" style="justify-content:flex-start"><button class="btn primary" id="st-gate">' + icon('crown') + ' Parent: open the store</button></div>';
        $('st-gate').onclick = async () => { if (await parentGate('Answer to open the store.')) render(); };
        return;
      }
      if (safety && safety.kind === 'minor' && safety.purchases === 'off') {
        $('st-body').innerHTML = '<p class="sub">A parent has turned purchases off for this account. Everything you have earned stays yours.</p>';
        return;
      }
      const ent = (state.account && state.account.ent) || {};
      const online = window.ChacklateNet && ChacklateNet.available();
      const products = STORE.products.map((p) => Object.assign({}, p, remote ? remote.products.find((r) => r.id === p.id) : { onSale: false }));
      const owned = (p) => p.id.startsWith('pass.') ? PG.hasPass(P, p.id.slice(5)) : p.id === 'premium.lifetime' ? ent.premiumUntil === 'lifetime' : false;
      const status = ent.premium ? (ent.premiumUntil === 'lifetime' ? 'Premium Lifetime' : 'Premium until ' + new Date(ent.premiumUntil).toLocaleDateString()) : state.settings.previewPremium ? 'Premium preview on this device' : 'Free';
      $('st-body').innerHTML =
        '<div class="hero-card"><div class="sg big gold">' + icon('crown') + '</div><div style="flex:1"><div class="eyebrow">Your plan</div><div style="font:400 24px/1.1 var(--display)">' + esc(status) + '</div></div></div>' +
        '<ul class="perks">' + STORE.perks.map((t) => '<li>' + icon('check') + esc(t) + '</li>').join('') + '</ul>' +
        '<div class="products">' + products.map((p) => '<div class="product' + (p.id === focus ? ' focus' : '') + '">' + (p.badge ? '<span class="pbadge">' + esc(p.badge) + '</span>' : '') +
          '<div class="eyebrow">' + esc(p.kind === 'subscription' ? 'Every ' + p.period : 'One payment') + '</div><b>' + esc(p.name) + '</b><div class="price">' + money(p.price) + '</div>' +
          (owned(p) ? '<span class="pill gold">Owned</span>' : '<button class="btn ' + (p.id === 'premium.yearly' || p.id === focus ? 'gold' : '') + '" data-buy="' + p.id + '"' + (p.onSale ? '' : ' disabled') + '>' + (p.onSale ? 'Buy' : 'Opens at launch') + '</button>') + '</div>').join('') + '</div>' +
        '<p class="fine">' + (!online ? 'Purchases go through your Chacklate account on the game server, which is not connected.' : remote && remote.mode === 'dev' ? 'Test store: purchases complete without payment. Nothing is charged.' : remote && remote.mode === 'off' ? 'The store opens at launch.' : 'Payments are handled by our payment provider. Subscriptions renew until cancelled.') +
        ' Purchases are tied to your account and restore on any device.</p>' +
        '<div class="row" style="justify-content:flex-start"><button class="btn small" id="st-restore">' + icon('refresh') + ' Restore purchases</button></div>';
      document.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => buy(b.dataset.buy); });
      $('st-restore').onclick = restore;
    }
    async function restore() {
      if (!(window.ChacklateNet && ChacklateNet.available())) return toast('Connect to the game server first.', 'bad');
      try { const me = await ChacklateNet.api('/api/me'); setEntitlements(me.entitlements); save(); toast(me.entitlements.premium || me.entitlements.passes.length ? 'Purchases restored.' : 'No purchases on this account yet.'); go('store', focus); }
      catch (e) { toast(esc(e.message), 'bad'); }
    }
    async function buy(id) {
      const acct = state.account || {};
      if (!acct.token || acct.guest) {
        const m = modal('<h2>Create an account first</h2><p class="sub">Purchases belong to your account, so they are safe if you change phones or clear this browser.</p><div class="row"><button class="btn" data-close>Not now</button><button class="btn primary" id="ca-go">Create account</button></div>');
        m.querySelector('#ca-go').onclick = () => { m.close(); go('profile', 'account'); };
        return;
      }
      if (!await parentGate('A parent needs to approve purchases.')) return;
      let pin;
      if (isMinor()) { pin = await askPin(); if (pin === null) return; }
      try {
        const o = await ChacklateNet.api('/api/store/checkout', { product: id, pin });
        const p = STORE.products.find((x) => x.id === id);
        if (o.action.type === 'dev-confirm') {
          const m = modal('<h2>Test purchase</h2><p class="sub">' + esc(p.name) + (p.period ? ' (' + p.period + ')' : '') + '. This server runs the test store, so no money moves.</p><div class="row"><button class="btn" data-close>Cancel</button><button class="btn gold" id="tp-ok">Confirm</button></div>');
          m.querySelector('#tp-ok').onclick = async () => {
            m.close();
            try { const r = await ChacklateNet.api('/api/store/dev/complete', { order: o.order }); thanks(p, r.entitlements); } catch (e) { toast(esc(e.message), 'bad'); }
          };
        } else if (o.action.type === 'redirect' && o.action.url) {
          window.open(o.action.url, '_blank', 'noopener');
          const m = modal('<h2>Finish paying in the new tab</h2><p class="sub">Come back here when you are done. Your purchase appears as soon as the payment provider confirms it.</p><div class="row"><button class="btn" data-close>Close</button><button class="btn primary" id="pp-check">I have paid</button></div>');
          m.querySelector('#pp-check').onclick = async () => { const me = await ChacklateNet.api('/api/me'); if (me.entitlements.premium || me.entitlements.passes.length) { m.close(); thanks(p, me.entitlements); } else toast('Not confirmed yet. Give it a moment.'); };
        }
      } catch (e) { toast(esc(e.message), 'bad'); }
    }
    function thanks(p, ent) {
      setEntitlements(ent); save();
      AU.play('levelUp'); view.celebrate('win', -1, null, -1);
      const pass = p.id.startsWith('pass.');
      modal('<div style="text-align:center"><span class="result-badge win">Thank you</span><h2 class="result-title" style="margin-top:12px">' + (pass ? 'Season Pass unlocked' : 'Welcome to Premium') + '</h2>' +
        '<p class="sub">' + (pass ? 'Every gold-track reward you have reached is now yours.' : 'Every personality, chapter, opening and endgame is open, and the season pass is included.') + '</p>' +
        '<div class="row" style="justify-content:center"><button class="btn primary" data-close>Let\'s play</button></div></div>', { onClose() { go(pass ? 'season' : 'home'); } });
    }
    mount(topbar({ back: 'Home' }) + '<section class="sheet glass"><header><div class="eyebrow">Store</div><h2>Chacklate Premium</h2><p>The whole game, every season pass, and the finest boards in the house.</p></header><div class="body" id="st-body"></div></section>' + navbar(''));
    wireTopbar(() => go('home')); wireNav();
    render();
    if (window.ChacklateNet && ChacklateNet.available()) ChacklateNet.api('/api/store').then((r) => { remote = r; if (state.screen === 'store') render(); }).catch(() => {});
    return { leave() { view.setAttract(false); } };
  };

  function quickPlay() {
    if (window.ChacklateNet && ChacklateNet.available()) { ChacklateNet.quickMatch('5+3'); return; }
    quickPlayOffline();
  }
  function quickPlayOffline() {
    const lv = PG.personalLevel(state.progress, state.progress.premium ? 7 : 3);
    toast('Personal opponent: ' + esc(LEVELS[lv].name) + ', picked from your recent results.');
    startGame({ mode: 'ai', color: 'random', level: lv, tc: 'none', fen: '', personal: true });
  }

  // ---------------------------------------------------------------- game
  // One controller for computer, pass-and-play and online games.
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
    state.setup = Object.assign({}, setup);
    const kind = setup.mode;
    let g;
    try { g = new E.Game(setup.fen || E.START_FEN); } catch (e) { g = new E.Game(); }
    const human = restore && restore.human ? restore.human : setup.color === 'black' ? BLACK : setup.color === 'random' ? (Math.random() < 0.5 ? WHITE : BLACK) : WHITE;
    const game = { kind, setup: state.setup, g, human, clock: parseTc(setup.tc), selected: -1, hint: null, hintStep: 0, busy: false, thinking: false, request: 0,
      viewSide: kind === 'local' ? 'white' : human === WHITE ? 'white' : 'black', coachMsg: null, evals: {}, threat: null, resultShown: false, review: null,
      online: setup.online || null, takebacks: 0, drawOffered: false };
    if (setup.online && !restore) setTimeout(() => AU.event('online.found'), 400);
    if (restore) {
      for (const u of restore.moves || []) if (!g.playText(u)) break;
      if (restore.clock && game.clock) Object.assign(game.clock, restore.clock, { since: 0 });
      if (kind === 'local' && state.settings.turnBoard) game.viewSide = g.pos.side === WHITE ? 'white' : 'black';
    }
    state.game = game;
    go('game');
    view.setView(game.viewSide, state.settings.view, true);
    if (!restore || !restore.moves || !restore.moves.length) view.intro();
    save();
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
    const ai = G.kind === 'ai', online = G.kind === 'online';
    mount(
      '<div class="topbar"><button class="btn glass small" id="g-home">' + icon('back') + '<span>Home</span></button><div class="pill gold" id="g-mode"></div><div class="spacer"></div>' +
      '<button class="btn glass icon" id="g-settings" title="Settings" aria-label="Settings">' + icon('gear') + '</button></div>' +
      '<div class="status-chip glass" id="g-chip" role="status"></div>' +
      '<div class="player-card glass top" id="p-top"></div><div class="player-card glass bottom" id="p-bottom"></div>' +
      '<div class="evalbar" id="evalbar" hidden><i id="evalfill" style="height:50%"></i></div>' +
      '<aside class="side glass" id="side"><header><b id="side-title">Moves</b><button class="btn small ghost" id="g-copy" title="Copy PGN">PGN</button></header>' +
      '<div id="coach-slot"></div><div class="moves-wrap" id="moves-wrap"><ol class="moves" id="moves" aria-label="Moves played"></ol></div>' +
      '<form id="move-form" style="display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--line)" autocomplete="off"><label class="sr" for="move-input">Type a move</label><input id="move-input" class="text-in" placeholder="Type a move: e4, Nf3, O-O" spellcheck="false" autocapitalize="off" style="padding:8px 10px"><button class="btn small">Play</button></form></aside>' +
      '<div class="actionbar glass" id="actionbar">' +
      (online ? '' : '<button class="btn" id="g-undo">' + icon('undo') + '<span class="lbl">Undo</span></button>') +
      (online ? '' : '<button class="btn" id="g-hint">' + icon('hint') + '<span class="lbl">Hint</span></button>') +
      (online ? '' : '<button class="btn" id="g-threat">' + icon('eye') + '<span class="lbl">Threat</span></button>') +
      '<span class="sep"></span>' +
      '<button class="btn" id="g-flip">' + icon('flip') + '<span class="lbl">Flip</span></button>' +
      '<button class="btn" id="g-view">' + icon('cam') + '<span class="lbl" id="g-view-lbl">Top view</span></button>' +
      '<span class="sep"></span>' +
      (ai || online ? '<button class="btn" id="g-draw">' + icon('draw') + '<span class="lbl">Draw</span></button>' : '') +
      '<button class="btn" id="g-resign">' + icon('flag') + '<span class="lbl">Resign</span></button>' +
      '<button class="btn primary" id="g-claim" hidden>Claim draw</button>' +
      '<button class="btn primary" id="g-review" hidden>' + icon('star') + '<span>Review with coach</span></button>' +
      '<button class="btn" id="g-new" hidden>New game</button>' +
      '</div>');
    $('g-home').onclick = () => { AU.play('tap'); go('home'); };
    $('g-settings').onclick = () => settingsModal();
    $('g-copy').onclick = () => copy(pgn(), 'PGN');
    if ($('g-undo')) $('g-undo').onclick = undo;
    if ($('g-hint')) $('g-hint').onclick = hint;
    if ($('g-threat')) $('g-threat').onclick = showThreat;
    $('g-flip').onclick = () => { AU.play('tap'); G.viewSide = G.viewSide === 'white' ? 'black' : 'white'; view.setView(G.viewSide, state.settings.view); renderHud(); };
    $('g-view').onclick = () => { AU.play('tap'); state.settings.view = state.settings.view === 'top' ? 'player' : 'top'; view.setView(G.viewSide, state.settings.view); save(); renderHud(); };
    if ($('g-draw')) $('g-draw').onclick = offerDraw;
    $('g-resign').onclick = resign;
    $('g-claim').onclick = () => { if (G.g.claimDraw()) { G.request++; if (online) ChacklateNet.send({ type: 'claim' }); endGame(); } };
    $('g-review').onclick = () => go('review', { start: G.g.startFen, ucis: G.g.uciMoves(), side: G.kind === 'local' ? WHITE : G.human, title: titleFor(G), review: G.review });
    $('g-new').onclick = () => newGameModal();
    $('move-form').onsubmit = (e) => {
      e.preventDefault();
      const input = $('move-input'), text = input.value.trim();
      if (!text || !humanTurn()) return;
      const m = G.g.pos.parseMove(text, G.g.legal);
      if (m === null || m === undefined) { toast('"' + esc(text) + '" is not a legal move here.'); AU.play('illegal'); return; }
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
    refreshHighlights();
    renderHud();
    return {
      leave() { view.setClock(null); save(); },
      escape() { if (G.selected >= 0) { G.selected = -1; refreshHighlights(); } },
      key(e) { if (e.key === 'f') $('g-flip').click(); },
    };
  };
  const titleFor = (G) => G.kind === 'ai' ? 'vs ' + LEVELS[G.setup.level].name : G.kind === 'online' ? 'Online · ' + (G.online && G.online.tc || '') : 'Pass and play';

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
    if (G.kind === 'ai') return side === G.human ? state.settings.name : LEVELS[G.setup.level].name;
    if (G.kind === 'online') return side === G.human ? state.settings.name : (G.online && G.online.opponent ? G.online.opponent.name : 'Opponent');
    return side === WHITE ? 'White' : 'Black';
  }

  function refreshHighlights() {
    const G = state.game; if (!G) return;
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
    if (G.hint && G.hintStep >= 3) arrows.push({ from: sqIndex(G.hint.from), to: sqIndex(G.hint.to), color: '#3fe0c8' });
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
      if (!g.targets(sq).length) toast('That piece has no legal moves.');
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

  function playMove(m, byHuman, dropped) {
    const G = state.game, g = G.g;
    const moverKey = g.pos.side === WHITE ? 'w' : 'b';
    const before = { fen: g.startFen, moves: g.uciMoves(), side: g.pos.side };
    const info = g.play(m);
    if (!info) return;
    if (G.kind === 'online' && byHuman) ChacklateNet.send({ type: 'move', uci: E.uci(m), ply: g.moves.length - 1 });
    if (G.kind !== 'online') pressClock(moverKey);
    G.request++;
    G.selected = -1; G.hint = null; G.hintStep = 0; G.threat = null; G.coachArrow = null;
    G.busy = true;
    const quick = G.clock && G.clock[moverKey] < 10000;   // effects off under 10 s, per the art bible
    const sound = info.check && !g.outcome ? 'check' : info.promo ? 'promote' : info.rook ? 'castle' : info.captured ? 'capture' : 'move';
    setTimeout(() => AU.play(sound), dropped ? 0 : 140);
    if (!g.outcome) setTimeout(() => AU.announce(info.san).then((said) => { if (!said && info.check) AU.event('check'); }), dropped ? 120 : 260);
    renderHud();
    view.animateMove(info, () => {
      G.busy = false;
      view.setBoard(piecesOf(g.pos), capturedFor(g));
      if (G.kind === 'local' && state.settings.turnBoard && !g.outcome) {
        G.viewSide = g.pos.side === WHITE ? 'white' : 'black';
        view.setView(G.viewSide, state.settings.view);
      }
      refreshHighlights();
      renderHud();
      save();
      if (G.setup.dojo && dojoCheck(G, info)) return;
      if (g.outcome) endGame();
      else maybeComputer();
    }, { quick });
    refreshHighlights();
    if (byHuman && G.kind === 'ai') liveCoach(before, info);
    if (!g.outcome) preAnalyse();
  }

  // ----- clocks (local games; online clocks come from the server)
  function clockRunning(G) { return G.clock && !G.g.outcome && G.g.moves.length > 0 && G.kind !== 'online'; }
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

  // ----- computer
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

  // ----- coach (computer games only; never during online play)
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
    const sideToMove = G.g.pos.side;
    const white = e.cp * sideToMove;
    const wp = C.winProb(white);
    $('evalfill').style.height = Math.round(wp * 100) + '%';
    bar.title = e.mate ? 'Mate in ' + Math.abs(e.mate) : (white >= 0 ? '+' : '') + (white / 100).toFixed(1);
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
          text = (cls === 'blunder' ? 'Careful! ' : 'Hmm. ') + ex;
          actions = [['Take it back', 'takeback'], ['Show the reply', 'reply'], ['Play on', 'dismiss']];
          if (refut) G.coachArrow = { from: sqIndex(refut.from), to: sqIndex(refut.to), color: '#ff5a50' };
        } else if (cls === 'brilliant' && lvl !== 'quiet') { text = 'Brilliant! ' + (C.describe(f) || 'A bold sacrifice that the engine likes.'); actions = [['Thanks', 'dismiss']]; }
        else if (lvl === 'chatty' && (cls === 'best' || cls === 'excellent')) { const d = C.describe(f); text = (cls === 'best' ? 'Top move. ' : 'Nice. ') + (d || ''); actions = [['Thanks', 'dismiss']]; }
        else if (lvl === 'chatty' && cls === 'inaccuracy') { text = 'Playable, but ' + (pre.bestSan || 'another move') + ' was a little more precise.'; actions = [['OK', 'dismiss']]; }
        if (!text) return;
        G.coachArrow = G.coachArrow && cls !== 'blunder' && cls !== 'mistake' ? null : G.coachArrow;
        coachSay(text, actions, cls);
        refreshHighlights();
      });
    }, 20);
  }
  function coachSay(text, actions, cls) {
    const G = state.game;
    G.coachMsg = { text, actions, cls };
    AU.play('coach');
    renderCoach();
  }
  function renderCoach() {
    const G = state.game, slot = $('coach-slot');
    if (!slot) return;
    if (!G.coachMsg) { slot.innerHTML = ''; return; }
    const m = G.coachMsg;
    slot.innerHTML = '<div class="coach"><div class="face" aria-hidden="true">♛</div><div><b>Praline, your coach' + (m.cls ? ' · <span class="cls ' + m.cls + '">' + C.LABEL[m.cls] + '</span>' : '') + '</b><p>' + esc(m.text) + '</p>' +
      '<div class="row">' + (m.actions || []).map(([t, a]) => '<button class="btn small' + (a === 'takeback' ? ' primary' : '') + '" data-coach="' + a + '">' + esc(t) + '</button>').join('') + '</div></div></div>';
    slot.querySelectorAll('[data-coach]').forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.coach;
        if (a === 'takeback') { G.takebacks++; undo(); }
        if (a === 'reply') { refreshHighlights(); return; }
        G.coachMsg = null; G.coachArrow = null; renderCoach(); refreshHighlights();
      };
    });
  }

  function undo() {
    const G = state.game, g = G.g;
    if (G.kind === 'online' || !g.moves.length || g.ended || G.busy) return;
    G.request++; G.thinking = false;
    if (G.kind === 'ai') { g.undo(); if (g.moves.length && g.pos.side !== G.human) g.undo(); } else g.undo();
    G.selected = -1; G.hint = null; G.hintStep = 0; G.threat = null; G.coachMsg = null; G.coachArrow = null; G.resultShown = false;
    AU.play('tap');
    view.setBoard(piecesOf(g.pos), capturedFor(g));
    if (G.kind === 'local' && state.settings.turnBoard) { G.viewSide = g.pos.side === WHITE ? 'white' : 'black'; view.setView(G.viewSide, state.settings.view); }
    refreshHighlights(); renderHud(); renderCoach(); save();
    maybeComputer(); preAnalyse();
  }
  // Hint ladder: theme, then the piece, then the move.
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
    const text = G.hintStep === 1 ? h.theme : G.hintStep === 2 ? 'Look at your ' + h.piece + '.' : 'Try ' + h.san + '. ' + (h.text || '');
    coachSay(text, G.hintStep < 3 ? [['Another hint', 'more'], ['Got it', 'dismiss']] : [['Got it', 'dismiss']]);
    const slot = $('coach-slot'); const more = slot && slot.querySelector('[data-coach="more"]');
    if (more) more.onclick = () => { G.hintStep++; showHintStep(); };
    refreshHighlights();
  }
  function showThreat() {
    const G = state.game;
    if (!humanTurn()) return;
    if (G.g.pos.inCheck()) { coachSay('You are in check: that is the threat! Move the king, block, or capture the checking piece.', [['OK', 'dismiss']]); return; }
    job('analysis', { type: 'threat', fen: G.g.startFen, moves: G.g.uciMoves(), timeMs: 300 }, (r) => {
      if (state.game !== G || !r.threat) return;
      G.threat = r.threat.serious ? r.threat : null;
      coachSay(r.threat.serious ? r.threat.text : 'No immediate danger. ' + r.threat.text, [['OK', 'dismiss']]);
      refreshHighlights();
    });
  }
  function offerDraw() {
    const G = state.game;
    if (G.g.outcome) return;
    if (G.kind === 'online') { ChacklateNet.send({ type: 'draw-offer' }); toast('Draw offered.'); return; }
    // The computer accepts only when it is clearly not better.
    const e = G.evals[G.g.moves.length];
    const aiView = e ? e.cp * (G.g.pos.side === G.human ? -1 : 1) : 0;
    if (G.g.moves.length >= 20 && aiView <= 30) { G.g.agreeDraw(); G.request++; endGame(); }
    else { toast(esc(LEVELS[G.setup.level].name) + ' declines the draw.'); AU.play('illegal'); }
  }
  let resignArmed = 0;
  function resign() {
    const G = state.game;
    if (G.g.outcome) return;
    const btn = $('g-resign');
    if (Date.now() - resignArmed > 3000) {
      resignArmed = Date.now();
      btn.classList.add('warn'); btn.querySelector('.lbl').textContent = 'Confirm';
      setTimeout(() => { if (Date.now() - resignArmed >= 3000 && btn.isConnected) { btn.classList.remove('warn'); btn.querySelector('.lbl').textContent = 'Resign'; } }, 3100);
      return;
    }
    resignArmed = 0;
    G.request++; G.thinking = false;
    if (G.kind === 'online') { ChacklateNet.send({ type: 'resign' }); return; }
    G.g.resign(G.kind === 'ai' ? G.human : G.g.pos.side);
    endGame();
  }

  // ----- end of game
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
    save();
    const badge = REASON_TEXT[o.reason] || 'Game over';
    let title;
    if (!winner) title = 'Draw';
    else if (G.kind === 'ai') title = youWon ? 'You win' : LEVELS[G.setup.level].name + ' wins';
    else if (G.kind === 'online') title = youWon ? 'Victory' : 'Defeat';
    else title = (winner === WHITE ? 'White' : 'Black') + ' wins';
    const lv = PG.levelFor(state.progress.xp);
    const html = '<span class="result-badge' + (youWon ? ' win' : youLost ? ' loss' : '') + '">' + esc(badge) + '</span>' +
      '<h2 class="result-title">' + esc(title) + '</h2>' +
      '<p class="sub">' + esc(resultSub(G, o, winner)) + '</p>' +
      (res ? '<div class="xpline"><div class="top"><span>Level ' + lv.level + ' · ' + esc(lv.title) + '</span><b>+' + res.xp + ' XP</b></div><div class="bar"><i id="xpfill" style="width:0%"></i></div></div>' : '') +
      (G.online && G.online.ratingDelta !== undefined ? '<p class="sub">Rating: <b>' + G.online.rating + '</b> (' + (G.online.ratingDelta >= 0 ? '+' : '') + G.online.ratingDelta + ')</p>' : '') +
      '<div class="row"><button class="btn" data-close>Look at the board</button><button class="btn" id="r-home">Home</button>' +
      (G.kind === 'online' ? '<button class="btn" id="r-report">Report opponent</button>' : '<button class="btn" id="r-rematch">Rematch</button>') +
      (g.moves.length >= 4 ? '<button class="btn primary" id="r-review">' + icon('star') + ' Review with coach</button>' : '') + '</div>';
    setTimeout(() => {
      if (state.game !== G || state.screen !== 'game') return;
      const mdl = modal(html);
      setTimeout(() => { const f = $('xpfill'); if (f) f.style.width = Math.round((lv.into / lv.need) * 100) + '%'; }, 120);
      const rv = $('r-review'); if (rv) rv.onclick = () => { mdl.close(); $('g-review').click(); };
      const rh = $('r-home'); if (rh) rh.onclick = () => { mdl.close(); go('home'); };
      const rp = $('r-report'); if (rp) rp.onclick = () => { rp.disabled = true; ChacklateNet.report('Reported from the result screen', G.online && G.online.id); };
      const rm = $('r-rematch'); if (rm) rm.onclick = () => { mdl.close(); const s = Object.assign({}, G.setup); if (s.mode === 'ai' && s.color !== 'random') s.color = s.color === 'white' ? 'black' : 'white'; startGame(s); };
      celebrate(res);
    }, state.settings.animations ? 1500 : 200);
  }
  function resultSub(G, o, winner) {
    const g = G.g;
    const loser = winner ? sideName(G, -winner) : '';
    const you = state.settings.name;
    return ({
      checkmate: (winner ? sideName(G, winner) + ' delivered checkmate' : '') + ' in ' + Math.ceil(g.moves.length / 2) + ' moves.',
      resignation: loser + ' resigned.',
      timeout: (loser === you ? 'Your' : loser + "'s") + ' clock ran out.',
      'timeout-insufficient': 'A clock ran out, but the other side could not checkmate, so it is a draw.',
      stalemate: 'The side to move has no legal moves and is not in check.',
      insufficient: 'Neither side has enough pieces left to checkmate.',
      threefold: 'The same position appeared three times.', fivefold: 'The same position appeared five times.',
      fifty: 'Fifty moves passed with no capture or pawn move.', seventyfive: 'Seventy-five moves passed with no capture or pawn move.',
      agreement: 'Both sides agreed to a draw.', abandoned: 'Your opponent left the game.', aborted: 'No first move was made in time.',
    }[o.reason] || '').trim();
  }

  // ----- HUD rendering
  function renderHud() {
    const G = state.game;
    if (!G || state.screen !== 'game') return;
    const g = G.g;
    $('g-mode').textContent = titleFor(G) + (G.setup.tc && G.setup.tc !== 'none' && G.kind !== 'online' ? ' · ' + G.setup.tc : '');
    const bottomSide = G.viewSide === 'black' ? BLACK : WHITE;
    const taken = { [WHITE]: [], [BLACK]: [] };
    g.captured.forEach((p) => { if (p) taken[-Math.sign(p)].push(Math.abs(p)); });
    let diff = 0;
    for (let sq = 0; sq < 64; sq++) { const p = E.pieceAt(g.pos, sq); if (p) diff += Math.sign(p) * VALUE[Math.abs(p)]; }
    for (const [id, side] of [['p-bottom', bottomSide], ['p-top', -bottomSide]]) {
      const el = $(id);
      const you = G.kind !== 'local' && side === G.human;
      const ai = G.kind === 'ai' && side !== G.human;
      const list = taken[side].slice().sort((a, b) => VALUE[b] - VALUE[a] || b - a);
      const adv = diff * side;
      const opp = G.kind === 'online' && side !== G.human && G.online && G.online.opponent;
      const sub = ai ? 'Computer · ' + LEVELS[G.setup.level].band : opp ? 'Rating ' + (opp.rating || '?') : you ? 'Level ' + PG.levelFor(state.progress.xp).level + (G.online && G.online.rating ? ' · Rating ' + G.online.rating : '') : side === WHITE ? 'White' : 'Black';
      el.innerHTML = (you ? avatarHtml('sm') : opp ? avatarHtml('sm', opp.avatar, opp.frame) : '<div class="avatar sm" style="background:linear-gradient(145deg,' + (side === WHITE ? '#f0e3cc,#b9a385' : '#4a2c1d,#1a0f0a') + ');color:' + (side === WHITE ? '#2a1a12' : '#f0e3cc') + '">' + (ai ? '♚' : side === WHITE ? '♔' : '♚') + '</div>') +
        '<div class="who"><div class="name">' + esc(sideName(G, side)) + '</div><div class="sub">' + esc(sub) + ' <span class="caps">' + list.map((k) => side === WHITE ? GLYPH[k] : WGLYPH[k]).join('') + '</span>' + (adv > 0 ? '<span class="adv">+' + adv + '</span>' : '') + '</div></div>' +
        '<div class="clock skin-' + (clockSkin ? clockSkin.css : 'classic') + '" data-side="' + side + '"' + (G.clock || G.kind === 'online' ? '' : ' hidden') + '></div>';
      el.classList.toggle('to-move', !g.outcome && g.pos.side === side);
    }
    // status chip
    const chip = $('g-chip');
    chip.className = 'status-chip glass';
    let text;
    if (g.outcome) { const o = g.outcome; text = (o.result === '1/2-1/2' ? 'Draw' : (o.result === '1-0' ? 'White' : 'Black') + ' wins') + ' · ' + (REASON_TEXT[o.reason] || ''); }
    else if (G.thinking) { text = LEVELS[G.setup.level].name + ' is thinking'; chip.classList.add('thinking'); }
    else if (G.kind === 'online' && g.pos.side !== G.human) text = (G.online && G.online.opponentAway ? 'Opponent reconnecting…' : 'Opponent to move');
    else {
      text = G.kind === 'local' ? (g.pos.side === WHITE ? 'White' : 'Black') + ' to move' : 'Your move';
      if (g.pos.inCheck()) { text = 'Check! ' + text; chip.classList.add('check'); }
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
    if (claim) $('g-claim').textContent = claim === 'threefold' ? 'Claim draw (threefold)' : 'Claim draw (50 moves)';
    $('g-review').hidden = !done || g.moves.length < 4 || G.kind === 'online' && false;
    $('g-new').hidden = !done || G.kind === 'online';
    $('g-view-lbl').textContent = state.settings.view === 'top' ? '3D view' : 'Top view';
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
    if (!g.sans.length) { ol.innerHTML = '<li><span class="empty">No moves yet. Drag a piece, or click it and then a square.</span></li>'; return; }
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
    const name = (side) => sideName(G, side) + (G.kind === 'ai' && side !== G.human ? ' (Chacklate)' : '');
    return G.g.pgn({ Date: date, White: name(WHITE), Black: name(BLACK), Event: G.kind === 'online' ? 'Online game' : 'Casual game',
      TimeControl: !G.setup.tc || G.setup.tc === 'none' ? '-' : G.setup.tc.split('+').map((x, i) => (i ? x : x * 60)).join('+') });
  }
  function copy(text, label) {
    const fallback = () => { const m = modal('<h2>Copy ' + esc(label) + '</h2><p class="sub">Select the text and copy it.</p><textarea class="share" readonly>' + esc(text) + '</textarea><div class="row"><button class="btn primary" data-close>Done</button></div>'); setTimeout(() => m.querySelector('textarea').select(), 40); };
    try { navigator.clipboard.writeText(text).then(() => toast(esc(label) + ' copied.'), fallback); } catch (e) { fallback(); }
  }

  function choosePromotion(side, cb) {
    const names = { 5: 'Queen', 4: 'Rook', 3: 'Bishop', 2: 'Knight' };
    let picked = false;
    const m = modal('<h2>Promote your pawn</h2><p class="sub">Choose the piece your pawn becomes.</p><div class="promo">' +
      [5, 4, 3, 2].map((k) => '<button data-k="' + k + '">' + (side === WHITE ? WGLYPH[k] : GLYPH[k]) + '<span>' + names[k] + '</span></button>').join('') + '</div><div class="row"><button class="btn" data-close>Cancel</button></div>',
      { onClose() { if (!picked) cb(0); } });
    m.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { picked = true; m.close(); cb(+b.dataset.k); }; });
  }

  // ----- new game
  function newGameModal() {
    const s = state.setup;
    const prem = state.progress.premium;
    const m = modal('<form id="ng"><h2>New game</h2><p class="sub">Everything runs on this device. Personalities never change strength during a game.</p>' +
      '<div class="field"><div class="label">Opponent</div><div class="seg"><label><input type="radio" name="mode" value="ai"' + (s.mode !== 'local' ? ' checked' : '') + '><span>Computer</span></label><label><input type="radio" name="mode" value="local"' + (s.mode === 'local' ? ' checked' : '') + '><span>Two players, one device</span></label></div></div>' +
      '<div class="field" id="f-color"><div class="label">Play as</div><div class="seg">' + ['white', 'black', 'random'].map((c) => '<label><input type="radio" name="color" value="' + c + '"' + (s.color === c ? ' checked' : '') + '><span>' + c[0].toUpperCase() + c.slice(1) + '</span></label>').join('') + '</div></div>' +
      '<div class="field" id="f-level"><div class="label">Personality</div><div class="levels">' + LEVELS.map((lv, i) => '<label><input type="radio" name="level" value="' + i + '"' + (s.level === i ? ' checked' : '') + (lv.premium && !prem ? ' disabled' : '') + '><span class="lv"><i>' + esc(lv.band) + (lv.premium ? ' · Premium' : '') + '</i><b>' + esc(lv.name) + '</b><small>' + esc(lv.blurb) + '</small></span></label>').join('') + '</div></div>' +
      '<div class="field"><div class="label">Clock</div><div class="seg">' + [['none', 'No clock'], ['1+0', '1+0'], ['3+2', '3+2'], ['5+0', '5+0'], ['10+5', '10+5'], ['15+10', '15+10'], ['30+0', '30+0']].map(([v, t]) => '<label><input type="radio" name="tc" value="' + v + '"' + (s.tc === v ? ' checked' : '') + '><span>' + t + '</span></label>').join('') + '</div></div>' +
      '<div class="field"><label for="ng-fen">Start from a position (optional FEN)</label><input class="text-in" id="ng-fen" placeholder="Leave empty for the standard start" spellcheck="false" value="' + esc(s.fen || '') + '"><p class="err" id="ng-err"></p></div>' +
      '<div class="row"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Start game</button></div></form>');
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
  function friendModal() {
    const online = window.ChacklateNet && ChacklateNet.available();
    const m = modal('<h2>Play a friend</h2><p class="sub">' + (online ? 'Create a game and share the code, or join with a friend\'s code.' : 'The game server is not reachable, so online codes are unavailable. You can still pass and play on this device.') + '</p>' +
      (online ? '<div class="field"><div class="label">Time control</div><div class="seg" id="fr-tc">' + ['3+2', '5+3', '10+5', '15+10'].map((t, i) => '<label><input type="radio" name="frtc" value="' + t + '"' + (i === 1 ? ' checked' : '') + '><span>' + t + '</span></label>').join('') + '</div></div>' +
        '<div class="row" style="justify-content:flex-start"><button class="btn primary" id="fr-create">Create a game</button></div>' +
        '<div class="field" style="margin-top:18px"><label for="fr-code">Join with a code</label><div style="display:flex;gap:8px"><input class="text-in" id="fr-code" maxlength="6" placeholder="ABC123" style="text-transform:uppercase;font-family:var(--mono);letter-spacing:.2em"><button class="btn" id="fr-join">Join</button></div><p class="err" id="fr-err"></p></div>' : '') +
      '<div class="row"><button class="btn" data-close>Cancel</button><button class="btn' + (online ? '' : ' primary') + '" id="fr-local">Pass and play here</button></div>');
    m.querySelector('#fr-local').onclick = () => { m.close(); startGame({ mode: 'local', color: 'white', level: 0, tc: 'none', fen: '' }); };
    if (online) {
      m.querySelector('#fr-create').onclick = () => { const tc = m.querySelector('input[name=frtc]:checked').value; m.close(); ChacklateNet.createFriend(tc); };
      m.querySelector('#fr-join').onclick = () => {
        const code = m.querySelector('#fr-code').value.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) { m.querySelector('#fr-err').textContent = 'Codes are 6 letters or digits.'; return; }
        m.close(); ChacklateNet.joinFriend(code);
      };
    }
  }

  // ---------------------------------------------------------------- review
  SCREENS.review = function (arg) {
    view.setAttract(false);
    const start = arg.start, ucis = arg.ucis;
    const R = { ply: ucis.length - 1, data: arg.review || null, side: arg.side || WHITE, line: null };
    const sans = [];
    { const p = E.positionFrom(start, []); for (const u of ucis) { const m = p.parseMove(u); sans.push(p.san(m, p.legalMoves())); p.make(m); } }
    mount('<div class="topbar"><button class="btn glass small" id="rv-back">' + icon('back') + '<span>Back</span></button><div class="pill gold">Game review · ' + esc(arg.title || '') + '</div><div class="spacer"></div>' +
      '<button class="btn glass icon" id="rv-set" aria-label="Settings">' + icon('gear') + '</button></div>' +
      '<aside class="side glass" id="side" style="width:360px"><header><b>Coach review</b><span class="pill" id="rv-depth"></span></header>' +
      '<div id="rv-body" style="flex:1;display:flex;flex-direction:column;min-height:0"><div class="progress-ring"><div class="spinner"></div><div>Praline is reviewing your game…</div><div class="bar" style="width:180px"><i id="rv-prog" style="width:0%"></i></div></div></div></aside>' +
      '<div class="actionbar glass"><button class="btn" id="rv-first" aria-label="First move">' + icon('first') + '</button><button class="btn" id="rv-prev" aria-label="Previous move">' + icon('prev') + '</button>' +
      '<button class="btn" id="rv-next" aria-label="Next move">' + icon('next') + '</button><button class="btn" id="rv-last" aria-label="Last move">' + icon('last') + '</button><span class="sep"></span>' +
      '<button class="btn" id="rv-turn">' + icon('star') + '<span class="lbl">Turning point</span></button><button class="btn" id="rv-best">' + icon('hint') + '<span class="lbl">Best line</span></button>' +
      '<button class="btn primary" id="rv-practice">' + icon('play') + '<span class="lbl">Play from here</span></button></div>');
    $('rv-back').onclick = () => { if (state.game && state.game.g.outcome) go('game'); else go('home'); };
    $('rv-set').onclick = () => settingsModal();
    const deep = state.progress.premium;
    $('rv-depth').textContent = deep ? 'Deep review' : 'Standard review';
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
      job('analysis', { type: 'line', fen: start, moves: ucis.slice(0, R.ply + 1), plies: 5, timeMs: 180 }, (r) => { if (r.line) { R.line = r.line; renderSide(); } });
    };
    $('rv-practice').onclick = () => {
      const p = E.positionFrom(start, ucis.slice(0, R.ply + 1));
      if (!p.legalMoves().length) return;
      startGame({ mode: 'ai', color: p.side === WHITE ? 'white' : 'black', level: Math.min(state.progress.premium ? 7 : 3, Math.max(2, state.setup.level || 2)), tc: 'none', fen: p.fen() });
    };
    function renderSide() {
      if (!R.data) return;
      const d = R.data, s = d.summary;
      const badges = d.plies.map((p) => p.cls === 'good' ? '' : '<span class="cls ' + p.cls + '" title="' + C.LABEL[p.cls] + '">' + (C.SYMBOL[p.cls] || '') + '</span>');
      const pl = R.ply >= 0 ? d.plies[R.ply] : null;
      const w = s.counts[WHITE], b = s.counts[BLACK];
      const cnt = (o, k) => (o[k] || 0);
      $('rv-body').innerHTML = '<svg class="graph" id="rv-graph" viewBox="0 0 300 110" preserveAspectRatio="none" aria-label="Evaluation graph"></svg>' +
        '<div class="sum"><div class="acc"><b>' + (s.accuracy[WHITE] === null ? '–' : s.accuracy[WHITE] + '%') + '</b><small>White accuracy</small><div style="font-size:11.5px;color:var(--muted);margin-top:4px">' +
        cnt(w, 'blunder') + ' blunders · ' + cnt(w, 'mistake') + ' mistakes</div></div><div class="acc"><b>' + (s.accuracy[BLACK] === null ? '–' : s.accuracy[BLACK] + '%') + '</b><small>Black accuracy</small><div style="font-size:11.5px;color:var(--muted);margin-top:4px">' +
        cnt(b, 'blunder') + ' blunders · ' + cnt(b, 'mistake') + ' mistakes</div></div></div>' +
        '<div class="comment" aria-live="polite">' + (pl ? '<div class="tagline2"><b>' + esc((pl.side === WHITE ? Math.floor(R.ply / 2) + 1 + '. ' : Math.floor(R.ply / 2) + 1 + '… ') + pl.san) + '</b><span class="cls ' + pl.cls + '">' + C.LABEL[pl.cls] + '</span>' +
          (R.data.summary.turning === R.ply ? '<span class="pill ruby">Turning point</span>' : '') + '</div>' + esc(pl.text) : '<span style="color:var(--muted)">Step through the game with the arrows. Green arrows show the better move, red ones the reply you missed.</span>') +
        (R.line ? '<div style="margin-top:8px;color:var(--teal);font-family:var(--mono);font-size:13px">Best line: ' + esc(R.line.join(' ')) + '</div>' : '') + '</div>' +
        '<div class="moves-wrap" id="rv-moves"><ol class="moves">' + moveRows(start, sans, R.ply, badges) + '</ol></div>';
      // graph
      const ev = d.evals.map((e) => C.winProb(e.cp));
      const n = ev.length, X = (i) => (i / Math.max(1, n - 1)) * 300, Y = (v) => 108 - v * 106;
      let path = 'M0 ' + Y(ev[0]);
      ev.forEach((v, i) => { path += ' L' + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); });
      const area = path + ' L300 110 L0 110 Z';
      const marks = d.plies.map((p, i) => ['mistake', 'blunder', 'brilliant'].includes(p.cls) ? '<circle cx="' + X(i + 1).toFixed(1) + '" cy="' + Y(ev[i + 1]).toFixed(1) + '" r="3.2" fill="' + (p.cls === 'blunder' ? '#e5484d' : p.cls === 'brilliant' ? '#1fb5c9' : '#f08a4b') + '"/>' : '').join('');
      $('rv-graph').innerHTML = '<rect width="300" height="110" fill="#1b1410"/><path d="' + area + '" fill="#efe4d6" opacity="0.92"/><line x1="0" y1="55" x2="300" y2="55" stroke="rgba(255,235,215,.25)" stroke-dasharray="3 3"/>' +
        marks + '<line x1="' + X(R.ply + 1).toFixed(1) + '" y1="0" x2="' + X(R.ply + 1).toFixed(1) + '" y2="110" stroke="#e3b25a" stroke-width="1.5"/>';
      $('rv-graph').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); R.ply = Math.max(-1, Math.min(ucis.length - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)) - 1)); show(); };
      $('rv-moves').querySelectorAll('[data-ply]').forEach((el) => { el.onclick = () => { R.ply = +el.dataset.ply; show(); }; });
      const cur = $('rv-moves').querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
    }
    show();
    if (!R.data) {
      job('analysis', { type: 'review', fen: start, moves: ucis, timeMs: deep ? 450 : 160 }, (r) => {
        if (state.screen !== 'review') return;
        if (r.error || !r.review) { $('rv-body').innerHTML = '<div class="progress-ring">The review could not run on this device.</div>'; return; }
        R.data = r.review;
        if (state.game && state.game.g.startFen === start && state.game.g.moves.length === ucis.length) state.game.review = r.review;
        const res = PG.reviewFinished(state.progress, r.review, R.side, ucis.length, Date.now());
        celebrate(res);
        if (r.review.summary.key.length) R.ply = r.review.summary.key[0];
        AU.play('correct');
        show();
      }, (p) => { const el = $('rv-prog'); if (el) el.style.width = Math.round(p * 100) + '%'; });
    }
    return { key(e) { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); } };
  };

  // ---------------------------------------------------------------- learn
  SCREENS.learn = function () {
    idleBoard();
    const P = state.progress;
    const nl = nextLesson();
    const due = PG.dueReviews(P);
    mount(topbar() + '<section class="sheet glass"><header><div class="eyebrow">Your chess journey</div><h2>Learn</h2><p>' + LESSONS.lessons.length + ' voice-guided lessons with mastery checks. Chapters 1–3 are free.</p></header><div class="body">' +
      (due.length ? '<button class="card-btn feature" id="l-review" style="margin-bottom:14px"><div class="big">↻</div><div><b>' + due.length + ' lesson' + (due.length > 1 ? 's' : '') + ' due for review</b><br><small>Spaced reviews at 1, 7 and 30 days keep skills fresh.</small></div></button>' : '') +
      LESSONS.chapters.map((ch) => {
        const ls = LESSONS.lessons.filter((l) => l.chapter === ch.n);
        const done = ls.filter((l) => P.lessons[l.id]).length;
        const locked = ch.access !== 'free' && !P.premium;
        return '<div class="chapter"><h3>Chapter ' + ch.n + ' · ' + esc(ch.title) + (locked ? ' <span class="pill lock">Premium</span>' : '') + '</h3><div class="meta">' + done + ' of ' + ls.length + ' complete</div><div class="path">' +
          ls.map((l) => {
            const r = P.lessons[l.id];
            const stars = r ? '<span class="stars">' + [1, 2, 3].map((k) => k <= r.stars ? '★' : '<span class="off">★</span>').join('') + '</span>' : '<small>' + l.minutes + ' min</small>';
            return '<button class="node' + (r ? ' done' : '') + (nl && nl.id === l.id ? ' next' : '') + '" data-lesson="' + l.id + '"' + (locked ? ' disabled' : '') + '><div><b>' + esc(l.title) + '</b><small>' + esc(l.objectives[0]) + '</small></div>' + stars + '</button>';
          }).join('') + '</div></div>';
      }).join('') + '</div></section>' + navbar('learn'));
    wireTopbar(); wireNav();
    document.querySelectorAll('[data-lesson]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); go('lesson', b.dataset.lesson); }; });
    if ($('l-review')) $('l-review').onclick = () => go('lesson', due[0]);
    return { leave() { view.setAttract(false); } };
  };

  // Lesson player: narrated steps, then exercises checked by the chess core.
  SCREENS.lesson = function (id) {
    const L = LESSONS.lessons.find((l) => l.id === id);
    view.setAttract(false);
    const ex = [];
    for (const x of L.exercises) {
      if (x.type === 'puzzles') {
        const pool = PUZZLES.filter((p) => x.theme === 'mate' ? p.themes.some((t) => t.startsWith('mateIn')) : p.themes.includes(x.theme)).sort((a, b) => a.rating - b.rating).slice(0, x.count);
        pool.forEach((p) => ex.push({ type: 'puzzle', prompt: x.prompt, puzzle: p }));
      } else ex.push(x);
    }
    const S = { phase: 'steps', i: 0, results: [], tries: 0, found: [], hintN: 0, pos: null, done: false };
    mount('<div class="topbar"><button class="btn glass small" id="ls-back">' + icon('back') + '<span>Learn</span></button><div class="pill gold">Chapter ' + L.chapter + '</div><div class="spacer"></div>' +
      '<button class="btn glass icon" id="ls-voice" title="Narration" aria-label="Narration">' + icon('speaker') + '</button><button class="btn glass icon" id="ls-set" aria-label="Settings">' + icon('gear') + '</button></div>' +
      '<aside class="lesson glass"><header><div class="eyebrow" id="ls-phase"></div><h3>' + esc(L.title) + '</h3></header><div class="content" id="ls-content"></div>' +
      '<footer><div class="dots" id="ls-dots"></div><div class="grow"></div><button class="btn" id="ls-prev">' + icon('prev') + '</button><button class="btn primary" id="ls-next">Next</button></footer></aside>');
    $('ls-back').onclick = () => go('learn');
    $('ls-set').onclick = () => settingsModal();
    $('ls-voice').onclick = () => { state.settings.narration = !state.settings.narration; save(); if (state.settings.narration) speak(); else AU.hush(); toast('Narration ' + (state.settings.narration ? 'on' : 'off')); };
    $('ls-prev').onclick = () => { if (S.phase === 'steps' && S.i > 0) { S.i--; renderStep(); } };
    $('ls-next').onclick = () => next();
    const speak = () => { if (!state.settings.narration) return; const t = S.phase === 'steps' ? L.steps[S.i].say : ex[S.i] && ex[S.i].prompt; if (t) AU.say(t); };
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
          view.animateMove(info, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: info.from, lastTo: info.to }); AU.play(info.captured ? 'capture' : 'move'); setTimeout(stepPlay, 650); });
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
      $('ls-content').innerHTML = '<p class="say">' + esc(st.say) + '</p>' + (S.i === 0 ? '<div class="pill">Objectives: ' + L.objectives.map(esc).join(' · ') + '</div>' : '');
      $('ls-prev').disabled = S.i === 0;
      $('ls-next').textContent = S.i === L.steps.length - 1 ? 'Start exercises' : 'Next';
      setHooks({});
      view.setHighlights({ marks: (st.marks || []).map((m) => ({ sq: sqIndex(m), color: '#e3b25a', alpha: 0.5, shape: 0 })) });
      view.setArrows((st.arrows || []).map((a) => ({ from: sqIndex(a[0]), to: sqIndex(a[1]), color: '#e3b25a' })));
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
        document.querySelectorAll('[data-opt]').forEach((b) => { b.onclick = () => { if (S.answered) return; const ok = +b.dataset.opt === x.answer; const why = x.explain ? ' ' + x.explain : '';
          if (ok) answer(true, 'Correct.' + why);
          else { S.answered = true; if (S.results[S.i] === undefined) S.results[S.i] = false; AU.play('wrong'); fb('bad', 'Not quite. The answer is: ' + x.options[x.answer] + '.' + why); $('ls-next').textContent = S.i === ex.length - 1 ? 'Finish' : 'Next'; dots(); }
          b.classList.add(ok ? 'primary' : 'warn'); }; });
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
        else if (x.type === 'puzzle' || x.answers) { const u = x.type === 'puzzle' ? x.puzzle.moves[S.pz * 2 + 1] : x.answers[0]; if (u.length >= 4) view.setArrows([{ from: sqIndex(u.slice(0, 2)), to: sqIndex(u.slice(2, 4)), color: '#3fe0c8' }]); S.tries++; }
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
      view.setHighlights({ selected: sqIndex(x.from), marks: S.found.map((s) => ({ sq: s, color: '#7fd6a4', alpha: 0.55, shape: 0 })) });
      return all;
    }
    function fb(kind, text) { const el = $('ls-fb'); if (el) el.innerHTML = '<div class="feedback ' + kind + '">' + esc(text) + '</div>'; }
    function exSquare(sq) {
      const x = ex[S.i];
      if (S.answered) return;
      if (x.type === 'square') {
        const ok = x.answers.map(sqIndex).includes(sq);
        view.setHighlights({ marks: [{ sq, color: ok ? '#7fd6a4' : '#ff5a50', alpha: 0.6, shape: 0 }] });
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
      // move-style exercises: select then target
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
            view.animateMove(info, () => {
              S.pos = g.pos; view.setBoard(piecesOf(g.pos), null);
              const reply = g.playText(x.puzzle.moves[S.pz * 2 + 2]);
              S.pz++;
              fb('ok', 'Good. Keep going.');
              setTimeout(() => view.animateMove(reply, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: reply.from, lastTo: reply.to }); AU.play('move'); }), 350);
            });
            return;
          }
        }
        if (ok) {
          const info = g.play(m);
          AU.play(info.captured ? 'capture' : info.check ? 'check' : 'move');
          view.animateMove(info, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: info.from, lastTo: info.to, check: g.pos.inCheck() ? kingSquare(g.pos, g.pos.side) : -1 }); });
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
      if (S.results[S.i] === undefined) S.results[S.i] = firstTry;
      AU.play('correct');
      fb('ok', msg + (firstTry ? '' : ' (Solved after a retry.)'));
      $('ls-next').textContent = S.i === ex.length - 1 ? 'Finish' : 'Next';
      dots();
    }
    function next() {
      AU.play('tap');
      if (S.phase === 'steps') { if (S.i < L.steps.length - 1) { S.i++; renderStep(); } else { S.phase = 'ex'; S.i = 0; renderEx(); } return; }
      if (S.phase === 'ex') {
        if (S.results[S.i] === undefined) S.results[S.i] = false;   // skipped
        if (S.i < ex.length - 1) { S.i++; renderEx(); } else finish();
        return;
      }
      go('learn');
    }
    function finish() {
      S.phase = 'done';
      const first = S.results.filter((r) => r === true).length;
      const wasDue = PG.dueReviews(state.progress).includes(L.id);
      const res = PG.lessonFinished(state.progress, L, first, ex.length, LESSONS.lessons);
      if (wasDue) PG.reviewDone(state.progress, L.id);
      const pct = Math.round((first / Math.max(1, ex.length)) * 100);
      $('ls-phase').textContent = 'Lesson complete';
      $('ls-content').innerHTML = '<div style="text-align:center;padding:10px 0"><div class="stars" style="font-size:40px">' + [1, 2, 3].map((k) => k <= res.stars ? '★' : '<span class="off">★</span>').join('') + '</div>' +
        '<p class="prompt" style="margin-top:10px">' + (pct >= 80 ? 'Mastered!' : 'Lesson complete') + '</p><p class="say">' + first + ' of ' + ex.length + ' right first time (' + pct + '%). ' + (pct >= 80 ? 'Reviews are scheduled in 1, 7 and 30 days.' : 'Score 80% to master it. Try again any time.') + '</p>' +
        '<div class="pill gold">+' + res.xp + ' XP</div></div>';
      $('ls-next').textContent = 'Back to Learn';
      const nx = LESSONS.lessons[LESSONS.lessons.indexOf(L) + 1];
      if (nx && lessonOpen(nx)) { $('ls-prev').disabled = false; $('ls-prev').innerHTML = 'Next lesson'; $('ls-prev').onclick = () => go('lesson', nx.id); }
      AU.play('win');
      AU.event('lesson.passed');
      view.celebrate('win', -1, null, -1);
      dots();
      celebrate(res);
    }
    renderStep();
    return { leave() { AU.hush(); }, key(e) { if (e.key === 'ArrowRight' || e.key === 'Enter') next(); } };
  };

  // ---------------------------------------------------------------- improve
  SCREENS.improve = function () {
    idleBoard();
    const P = state.progress;
    const daily = dailyPuzzle();
    const dailyDone = P.daily.date === PG.today() && P.daily.done;
    const themes = [['fork', 'Forks', '♞'], ['pin', 'Pins', '♝'], ['skewer', 'Skewers', '♜'], ['discoveredAttack', 'Discovered attacks', '♛'], ['hangingPiece', 'Loose pieces', '♟'], ['mate', 'Checkmates', '♚']];
    const plan = trainingPlan();
    mount(topbar() + '<section class="sheet glass"><header><div class="eyebrow">Train</div><h2>Improve my chess</h2><p>Puzzles from engine-verified positions, honest game reviews and a plan built from your own mistakes.</p></header><div class="body">' +
      '<div class="cards">' +
      (daily ? '<button class="card-btn feature" id="i-daily"><div class="big">☀</div><div><b>Daily puzzle' + (dailyDone ? ' · solved' : '') + '</b><br><small>' + (dailyDone ? 'Come back tomorrow for a new one.' : 'Rated ' + daily.rating + '. A fresh puzzle for today.') + '</small></div></button>' : '') +
      '<button class="card-btn" id="i-rated"><div class="big">♞</div><b>Puzzle trainer</b><small>Rating ' + P.stats.puzzles.rating + ' · ' + PUZZLES.length + ' puzzles</small></button>' +
      '<button class="card-btn" id="i-plan"><div class="big">✎</div><b>Your training plan</b><small>' + esc(plan.summary) + '</small></button>' +
      '<button class="card-btn" id="i-lab"><div class="big">♗</div><b>Opening lab</b><small>' + OPENINGS.length + ' openings · ' + Object.values(P.openings).filter((r) => r.mastered).length + ' mastered</small></button>' +
      '<button class="card-btn" id="i-dojo"><div class="big">♚</div><b>Endgame dojo</b><small>' + ENDGAMES.length + ' endgames · ' + Object.values(P.dojo).reduce((a, r) => a + r.stars, 0) + ' of ' + ENDGAMES.length * 3 + ' stars</small></button>' +
      '<button class="card-btn" id="i-games"><div class="big">↺</div><b>Review your games</b><small>' + P.history.length + ' recent games</small></button>' +
      '</div><h3 class="section-title">Puzzle themes</h3><div class="cards">' +
      themes.map(([t, n, g]) => { const c = PUZZLES.filter((p) => t === 'mate' ? p.themes.some((x) => x.startsWith('mateIn')) : p.themes.includes(t)).length; return '<button class="card-btn" data-theme="' + t + '"' + (c ? '' : ' disabled') + '><div class="big">' + g + '</div><b>' + n + '</b><small>' + c + ' puzzles</small></button>'; }).join('') +
      '</div></div></section>' + navbar('improve'));
    wireTopbar(); wireNav();
    if (daily) $('i-daily').onclick = () => { AU.unlock(); go('puzzle', { list: [daily], daily: true, title: 'Daily puzzle' }); };
    $('i-rated').onclick = () => { AU.unlock(); go('puzzle', { rated: true, title: 'Puzzle trainer' }); };
    $('i-plan').onclick = () => { AU.unlock(); go('puzzle', { theme: plan.theme, rated: true, title: 'Training plan: ' + plan.name }); };
    $('i-dojo').onclick = () => { AU.unlock(); go('dojo'); };
    $('i-lab').onclick = () => { AU.unlock(); go('openings'); };
    $('i-games').onclick = () => go('profile', 'games');
    document.querySelectorAll('[data-theme]').forEach((b) => { b.onclick = () => { AU.unlock(); go('puzzle', { theme: b.dataset.theme, rated: true, title: b.querySelector('b').textContent }); }; });
    return { leave() { view.setAttract(false); } };
  };
  // Personalised plan: the motif that has cost you the most in reviewed games and puzzles.
  function trainingPlan() {
    const counts = state.progress.seen.motifs || {};
    const order = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const names = { fork: 'Forks', pin: 'Pins', skewer: 'Skewers', hangingPiece: 'Loose pieces', mate: 'Checkmates', discoveredAttack: 'Discovered attacks' };
    if (!order.length) return { theme: null, name: 'Mixed', summary: 'Play and review a few games; the plan adapts to your mistakes.' };
    const [t] = order[0];
    return { theme: t, name: names[t] || t, summary: 'Focus: ' + (names[t] || t) + ', your most frequent missed pattern.' };
  }
  function noteMotif(theme) { const m = state.progress.seen.motifs || (state.progress.seen.motifs = {}); m[theme] = (m[theme] || 0) + 1; }
  const stars = (n) => '<span class="stars">' + [1, 2, 3].map((k) => k <= n ? '★' : '<span class="off">★</span>').join('') + '</span>';
  const locked = (item) => item.access === 'premium' && !state.progress.premium;

  // Endgame dojo: play known endgames against full-strength defence, scored against a par.
  SCREENS.dojo = function () {
    idleBoard();
    const P = state.progress;
    const goalText = { mate: 'Checkmate', promote: 'Promote safely', draw: 'Hold the draw' };
    mount(topbar({ back: 'Improve' }) + '<section class="sheet glass"><header><div class="eyebrow">Train</div><h2>Endgame dojo</h2><p>Known endgames against the strongest defence. Reach the goal within par for three stars.</p></header><div class="body"><div class="list">' +
      ENDGAMES.map((d) => {
        const r = P.dojo[d.id];
        return '<button class="row-item" data-eg="' + d.id + '"' + (locked(d) ? ' disabled' : '') + '><span style="font-size:24px">' + (d.goal === 'draw' ? '♚' : '♔') + '</span><div><b>' + esc(d.name) + '</b><br><small style="color:var(--muted)">' + esc(d.level) + ' · ' + goalText[d.goal] + (d.goal === 'draw' ? ' for ' + d.par + ' moves' : ' · par ' + d.par) + (r && r.best ? ' · best ' + r.best : '') + '</small></div>' +
          (locked(d) ? '<span class="pill lock">Premium</span>' : stars(r ? r.stars : 0)) + '</button>';
      }).join('') + '</div></div></section>' + navbar('improve'));
    wireTopbar(() => go('improve')); wireNav();
    document.querySelectorAll('[data-eg]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); startDojo(b.dataset.eg); }; });
    return { leave() { view.setAttract(false); } };
  };
  function startDojo(id) {
    const d = ENDGAMES.find((x) => x.id === id);
    const side = E.positionFrom(d.fen, []).side;
    startGame({ mode: 'ai', color: side === WHITE ? 'white' : 'black', level: 7, tc: 'none', fen: d.fen, dojo: id });
    coachSay(d.tip, [['Got it', 'dismiss']]);
  }
  // Called after every move of a dojo game. Returns true once the attempt is decided.
  function dojoCheck(G, info) {
    const d = ENDGAMES.find((x) => x.id === G.setup.dojo);
    if (!d || G.dojoDone) return false;
    const g = G.g, me = G.human, o = g.outcome;
    const firstMine = E.positionFrom(g.startFen, []).side === me;
    const mine = g.moves.filter((_, i) => (i % 2 === 0) === firstMine).length;
    let ok = null, why = '';
    if (o) {
      const w = o.result === '1-0' ? WHITE : o.result === '0-1' ? BLACK : 0;
      ok = w === me || (!w && d.goal === 'draw');
      why = ok ? (w ? 'Checkmate.' : 'The game is drawn.') : w ? 'You were checkmated.' : (REASON_TEXT[o.reason] || 'Draw') + ': that lets the win slip.';
    } else if (info && info.captured && Math.sign(info.captured) === me && Math.abs(info.captured) === E.P && d.goal === 'promote') { ok = false; why = 'Your pawn was captured.'; }
    else if (info && info.promo && Math.sign(info.mover) === me && d.goal === 'promote') {
      ok = !C.isHanging(g.pos, E.to88(info.to));
      why = ok ? 'Promoted, and the new queen is safe.' : 'The new queen can be captured.';
    } else if (info && info.promo && Math.sign(info.mover) === -me) { ok = false; why = 'Your opponent promoted.'; }
    else if (d.goal === 'draw' && mine >= d.par && g.pos.side === me) { ok = true; why = 'You held for ' + d.par + ' moves.'; }
    if (ok === null) return false;
    G.dojoDone = true;
    if (!o) g.finish(ok === (me === WHITE) ? '1-0' : '0-1', 'dojo');
    const res = PG.dojoFinished(state.progress, d, ok, mine);
    save(); renderHud();
    AU.play(ok ? 'win' : 'loss');
    if (ok) { view.celebrate('win', -1, null, -1); AU.event('dojo.won'); }
    const next = ENDGAMES[ENDGAMES.indexOf(d) + 1];
    const m = modal('<span class="result-badge' + (ok ? ' win' : ' loss') + '">Endgame dojo</span><h2 class="result-title">' + (ok ? 'Goal reached' : 'Not this time') + '</h2>' +
      '<p class="sub">' + esc(why) + ' ' + (ok && d.goal !== 'draw' ? mine + ' moves, par ' + d.par + '.' : '') + '</p>' + (ok ? '<p style="font-size:28px;margin:4px 0 10px">' + stars(res.stars) + '</p>' : '<p class="sub">' + esc(d.tip) + '</p>') +
      '<div class="row"><button class="btn" id="dj-list">All endgames</button><button class="btn' + (ok ? '' : ' primary') + '" id="dj-again">Try again</button>' +
      (ok && next && !locked(next) ? '<button class="btn primary" id="dj-next">Next: ' + esc(next.name) + '</button>' : '') + '</div>');
    m.querySelector('#dj-list').onclick = () => { m.close(); go('dojo'); };
    m.querySelector('#dj-again').onclick = () => { m.close(); startDojo(d.id); };
    const n = m.querySelector('#dj-next'); if (n) n.onclick = () => { m.close(); startDojo(next.id); };
    celebrate(res);
    return true;
  }

  // Opening lab: pick a line and drill it until it is automatic.
  SCREENS.openings = function (tab) {
    idleBoard();
    const P = state.progress;
    let side = tab || 'white';
    mount(topbar({ back: 'Improve' }) + '<section class="sheet glass"><header><div class="eyebrow">Train</div><h2>Opening lab</h2><p>Play through each line with the coach. Three clean runs master it; then try it against the computer.</p></header>' +
      '<div class="tabs" role="tablist"><button role="tab" data-side="white">As White</button><button role="tab" data-side="black">As Black</button></div><div class="body"><div class="list" id="ol"></div></div></section>' + navbar('improve'));
    wireTopbar(() => go('improve')); wireNav();
    const draw = () => {
      document.querySelectorAll('[data-side]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.side === side)));
      $('ol').innerHTML = OPENINGS.filter((o) => o.side === side).map((o) => {
        const r = P.openings[o.id];
        return '<button class="row-item" data-op="' + o.id + '"' + (locked(o) ? ' disabled' : '') + '><span class="pill">' + esc(o.eco) + '</span><div><b>' + esc(o.name) + '</b><br><small style="color:var(--muted)">' + esc(o.summary) + '</small></div>' +
          (locked(o) ? '<span class="pill lock">Premium</span>' : r && r.mastered ? '<span class="pill gold">Mastered</span>' : '<small style="color:var(--muted)">' + (r ? r.clean + '/3 clean' : (o.moves.length / 2 | 0) + ' moves') + '</small>') + '</button>';
      }).join('');
      document.querySelectorAll('[data-op]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); go('drill', b.dataset.op); }; });
    };
    document.querySelectorAll('[data-side]').forEach((b) => { b.onclick = () => { side = b.dataset.side; AU.play('tap'); draw(); }; });
    draw();
    return { leave() { view.setAttract(false); } };
  };

  SCREENS.drill = function (id) {
    const o = OPENINGS.find((x) => x.id === id);
    const me = o.side === 'white' ? WHITE : BLACK;
    const S = { g: new E.Game(), i: 0, misses: 0, selected: -1, done: false, busy: false };
    view.setAttract(false);
    mount('<div class="topbar"><button class="btn glass small" id="dr-back">' + icon('back') + '<span>Opening lab</span></button><div class="pill gold">' + esc(o.eco) + ' · ' + esc(o.name) + '</div><div class="spacer"></div>' +
      '<button class="btn glass icon" id="dr-set" aria-label="Settings">' + icon('gear') + '</button></div>' +
      '<aside class="lesson glass"><header><div class="eyebrow">Playing ' + o.side + '</div><h3>' + esc(o.name) + '</h3></header><div class="content">' +
      '<p class="say">' + esc(o.summary) + '</p><ul class="ideas">' + o.ideas.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul><div class="drill-moves" id="dr-moves"></div><div id="dr-fb"></div></div>' +
      '<footer><button class="btn" id="dr-hint">' + icon('hint') + ' Hint</button><button class="btn" id="dr-reset">' + icon('refresh') + ' Restart</button><div class="grow"></div><button class="btn primary" id="dr-play" hidden>Play from here</button></footer></aside>');
    $('dr-back').onclick = () => go('openings', o.side);
    $('dr-set').onclick = () => settingsModal();
    const fb = (kind, t) => { $('dr-fb').innerHTML = t ? '<div class="feedback ' + kind + '">' + esc(t) + '</div>' : ''; };
    const san = (k) => { const g = new E.Game(); for (let j = 0; j < k; j++) g.playText(o.moves[j]); return g.sans[k - 1]; };
    function moveList() {
      let h = '';
      S.g.sans.forEach((x, k) => { if (k % 2 === 0) h += '<span class="n">' + (k / 2 + 1) + '.</span>'; h += '<span class="m' + (k === S.g.sans.length - 1 ? ' last' : '') + '">' + esc(x) + '</span>'; });
      $('dr-moves').innerHTML = h || '<span class="n">Your move.</span>';
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
        const info = S.g.playText(o.moves[S.i]);
        const note = o.notes[S.i];
        S.i++;
        view.animateMove(info, () => { S.busy = false; show(info); AU.play(info.captured ? 'capture' : 'move'); if (note) fb('hint', 'They play ' + info.san + ': ' + note); advance(); });
      }, 450);
    }
    function finish() {
      if (S.done) return;
      S.done = true;
      const res = PG.openingFinished(state.progress, o.id, S.misses === 0);
      save();
      const rec = state.progress.openings[o.id];
      fb('ok', (S.misses ? 'Line complete with ' + S.misses + ' slip' + (S.misses > 1 ? 's' : '') + '. Run it again cleanly.' : 'Clean run! ') + (rec.mastered ? (res.mastered ? ' Opening mastered.' : '') : ' ' + rec.clean + ' of 3 clean runs.'));
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
        fb('bad', 'In this line we play ' + san(S.i + 1) + (o.notes[S.i] ? ': ' + o.notes[S.i] : '.'));
        view.setArrows([{ from: sqIndex(want.slice(0, 2)), to: sqIndex(want.slice(2, 4)), color: '#3fe0c8' }]);
        show(null);
        return true;
      }
      view.setArrows([]);
      const info = S.g.play(m);
      S.i++;
      AU.play(info.captured ? 'capture' : info.rook ? 'castle' : 'move');
      if (o.notes[S.i - 1]) fb('ok', info.san + ': ' + o.notes[S.i - 1]); else fb('ok', info.san + '. Good.');
      view.animateMove(info, () => { show(info); advance(); });
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
      view.setArrows([{ from: sqIndex(want.slice(0, 2)), to: sqIndex(want.slice(2, 4)), color: '#3fe0c8' }]);
      fb('hint', 'Play ' + san(S.i + 1) + (o.notes[S.i] ? ': ' + o.notes[S.i] : '.'));
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

  // Puzzle player.
  SCREENS.puzzle = function (arg) {
    view.setAttract(false);
    const P = state.progress;
    const S = { cur: null, step: 0, pos: null, failed: false, solved: false, streak: 0, selected: -1 };
    const pickNext = () => {
      if (arg.list) return arg.list[S.count = (S.count || 0)] || null;
      let pool = PUZZLES.filter((p) => !arg.theme || (arg.theme === 'mate' ? p.themes.some((t) => t.startsWith('mateIn')) : p.themes.includes(arg.theme)));
      const unseen = pool.filter((p) => !P.stats.puzzles.seen.includes(p.id));
      if (unseen.length) pool = unseen;
      if (!pool.length) return null;
      const r = P.stats.puzzles.rating;
      pool.sort((a, b) => Math.abs(a.rating - r) - Math.abs(b.rating - r));
      return pool[Math.floor(Math.random() * Math.min(5, pool.length))];
    };
    mount('<div class="topbar"><button class="btn glass small" id="pz-back">' + icon('back') + '<span>Improve</span></button><div class="pill gold">' + esc(arg.title || 'Puzzles') + '</div><div class="spacer"></div>' +
      '<div class="pill" id="pz-rating"></div><button class="btn glass icon" id="pz-set" aria-label="Settings">' + icon('gear') + '</button></div>' +
      '<aside class="lesson glass"><header><div class="eyebrow" id="pz-eyebrow">Puzzle</div><h3 id="pz-title">Find the best move</h3></header><div class="content" id="pz-content"></div>' +
      '<footer><button class="btn" id="pz-hint">' + icon('hint') + ' Hint</button><button class="btn" id="pz-sol">Solution</button><div class="grow"></div><button class="btn primary" id="pz-next" hidden>Next puzzle</button></footer></aside>');
    $('pz-back').onclick = () => go('improve');
    $('pz-set').onclick = () => settingsModal();
    const ratingPill = (delta) => { $('pz-rating').innerHTML = 'Puzzle rating <b style="color:var(--ink)">' + P.stats.puzzles.rating + '</b>' + (delta ? ' <span style="color:' + (delta > 0 ? 'var(--ok)' : 'var(--danger)') + '">' + (delta > 0 ? '+' : '') + delta + '</span>' : ''); };
    ratingPill();
    function load() {
      const pz = pickNext();
      if (!pz) { $('pz-content').innerHTML = '<p class="say">No more puzzles here. Great work!</p>'; return; }
      S.cur = pz; S.step = 0; S.failed = false; S.solved = false; S.selected = -1; S.hints = 0;
      const pre = E.positionFrom(pz.fen, []);
      S.pos = pre;
      const solverSide = -pre.side;
      view.setBoard(piecesOf(pre), null);
      view.setHighlights({}); view.setArrows([]);
      view.setView(solverSide === WHITE ? 'white' : 'black', 'player');
      $('pz-eyebrow').textContent = (arg.daily ? 'Daily puzzle · ' : '') + 'Rated ' + pz.rating;
      $('pz-title').textContent = (solverSide === WHITE ? 'White' : 'Black') + ' to move: find the best move';
      $('pz-content').innerHTML = '<p class="say">Your opponent just played a move. Look for checks, captures and threats.</p><div id="pz-fb"></div>';
      $('pz-next').hidden = true; $('pz-hint').disabled = false; $('pz-sol').disabled = false;
      // Animate the opponent's move that sets up the puzzle.
      setTimeout(() => {
        const g = new E.Game(pz.fen);
        const info = g.playText(pz.moves[0]);
        view.animateMove(info, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: info.from, lastTo: info.to, check: g.pos.inCheck() ? kingSquare(g.pos, g.pos.side) : -1 }); AU.play(info.captured ? 'capture' : 'move'); });
      }, 600);
    }
    function fb(kind, t) { const el = $('pz-fb'); if (el) el.innerHTML = '<div class="feedback ' + kind + '">' + esc(t) + '</div>'; }
    function finish(solved) {
      if (S.solved) return;
      S.solved = true;
      const res = PG.puzzleFinished(P, S.cur, solved && !S.failed, { daily: arg.daily });
      if (!solved || S.failed) for (const t of S.cur.themes) noteMotif(t.startsWith('mateIn') ? 'mate' : t);
      ratingPill(res.ratingDelta);
      $('pz-next').hidden = !!arg.daily; $('pz-hint').disabled = true; $('pz-sol').disabled = true;
      celebrate(res);
      if (solved && !S.failed) { AU.play('correct'); view.celebrate('win', -1, null, -1); }
      $('pz-content').insertAdjacentHTML('beforeend', '<div class="pill" style="margin-top:10px">Themes: ' + S.cur.themes.map(esc).join(', ') + '</div>' + (arg.daily ? '<p class="say" style="margin-top:10px">Come back tomorrow for a new daily puzzle.</p>' : ''));
    }
    function tryMove(from, to, promo) {
      const g = new E.Game(S.pos.fen());
      const m = g.find(from, to, promo || 0);
      if (m === null) return false;
      const want = S.cur.moves[S.step * 2 + 1];
      const t = new E.Game(S.pos.fen()); t.play(m);
      const ok = E.uci(m) === want || (t.outcome && t.outcome.reason === 'checkmate');
      if (!ok) {
        S.failed = true; AU.play('wrong'); AU.event('puzzle.wrong'); fb('bad', 'Not quite. That is not the strongest move. Try again.');
        view.setBoard(piecesOf(S.pos), null);
        return true;
      }
      const info = g.play(m);
      AU.play(info.captured ? 'capture' : info.check ? 'check' : 'move');
      view.animateMove(info, () => {
        S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: info.from, lastTo: info.to });
        if (S.step * 2 + 2 >= S.cur.moves.length || (t.outcome && t.outcome.reason === 'checkmate')) { fb('ok', S.failed ? 'Solved, after a miss.' : 'Excellent! Puzzle solved.'); AU.event(S.failed ? 'puzzle.solved' : 'puzzle.great'); finish(true); return; }
        const reply = g.playText(S.cur.moves[S.step * 2 + 2]);
        S.step++;
        fb('ok', 'Good move. Keep going!');
        setTimeout(() => view.animateMove(reply, () => { S.pos = g.pos; view.setBoard(piecesOf(g.pos), null); view.setHighlights({ lastFrom: reply.from, lastTo: reply.to }); AU.play(reply.captured ? 'capture' : 'move'); }), 380);
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
      S.failed = true; S.hints++;
      const u = S.cur.moves[S.step * 2 + 1];
      if (S.hints === 1) { const t = S.cur.themes[0]; fb('hint', { fork: 'Look for a fork.', pin: 'Look for a pin.', skewer: 'Look for a skewer.', discoveredAttack: 'Look for a discovered attack.', hangingPiece: 'Something is undefended.', promotion: 'A pawn wants to promote.', sacrifice: 'Consider a sacrifice.' }[t] || (t.startsWith('mateIn') ? 'There is a forced checkmate.' : 'Look for the most forcing move.')); }
      else { view.setHighlights({ selected: sqIndex(u.slice(0, 2)) }); fb('hint', 'Move the piece on ' + u.slice(0, 2) + '.'); }
      AU.play('coach');
    };
    $('pz-sol').onclick = () => {
      S.failed = true;
      const u = S.cur.moves[S.step * 2 + 1];
      view.setArrows([{ from: sqIndex(u.slice(0, 2)), to: sqIndex(u.slice(2, 4)), color: '#3fe0c8' }]);
      const g = new E.Game(S.pos.fen()); const m = g.pos.parseMove(u, g.legal);
      fb('hint', 'The solution: ' + g.pos.san(m, g.legal) + '. ' + (C.describe(C.facts(g.pos, m)) || ''));
      finish(false);
    };
    $('pz-next').onclick = () => { AU.play('tap'); load(); };
    load();
    return {};
  };

  // ---------------------------------------------------------------- collection
  SCREENS.collection = function (cat) {
    idleBoard();
    view.setAttract(true);
    const P = state.progress;
    let active = cat || 'board';
    mount(topbar() + '<section class="sheet glass"><header><div class="eyebrow">' + CATALOG.items.filter((i) => PG.isUnlocked(P, i)).length + ' of ' + CATALOG.items.length + ' unlocked</div><h2>Collection</h2><p>Tap an item to try it on the board behind. Unlocked items equip instantly.</p></header>' +
      '<div class="tabs" role="tablist">' + CATALOG.categories.map((c) => '<button role="tab" data-cat="' + c.id + '" aria-selected="' + (c.id === active) + '">' + esc(c.name) + '</button>').join('') + '</div>' +
      '<div class="body"><div class="items" id="items"></div><p style="color:var(--faint);font-size:12.5px;margin-top:16px">Tap a locked item to preview it. Season items unlock on the season track; Premium items come with Premium in the Store.</p></div></section>' + navbar('collection'));
    wireTopbar(); wireNav();
    function render() {
      document.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === active)));
      const items = CATALOG.items.filter((i) => i.category === active);
      $('items').innerHTML = items.map((it) => {
        const un = PG.isUnlocked(P, it), on = P.equipped[active] === it.id;
        return '<button class="item' + (on ? ' on' : '') + (un ? '' : ' locked') + '" data-item="' + it.id + '"><div class="sw" style="' + swatch(it) + '">' + swatchGlyph(it) + '</div>' +
          '<div class="rar ' + it.rarity + '">' + it.rarity + '</div><b>' + esc(it.name) + '</b>' + (un ? (on ? '<span class="pill gold">Equipped</span>' : '') : '<span class="lockline">🔒 ' + esc(PG.unlockText(it)) + '</span>') + '</button>';
      }).join('');
      document.querySelectorAll('[data-item]').forEach((b) => {
        b.onclick = () => {
          const it = PG.item(b.dataset.item);
          if (PG.isUnlocked(P, it)) { PG.equip(P, it); preview = null; save(); toast('Equipped ' + esc(it.name)); }
          else { preview = it; toast('Previewing ' + esc(it.name) + '. ' + esc(PG.unlockText(it)) + ' to unlock.'); }
          applyLook();
          if (it.category === 'sound') AU.play('capture');
          if (it.category === 'capture' || it.category === 'victory') view.celebrate('win', -1, null, sqIndex('e1'));
          AU.play('tap');
          render(); renderMePill();
        };
      });
    }
    document.querySelectorAll('[data-cat]').forEach((b) => { b.onclick = () => { active = b.dataset.cat; preview = null; applyLook(); AU.play('tap'); render(); }; });
    render();
    return { leave() { preview = null; applyLook(); view.setAttract(false); } };
  };

  // ---------------------------------------------------------------- profile
  SCREENS.profile = function (section) {
    idleBoard();
    const P = state.progress, st = P.stats, lv = PG.levelFor(P.xp);
    const acc = st.accuracy.length ? Math.round(st.accuracy.reduce((a, b) => a + b, 0) / st.accuracy.length) : null;
    const acct = state.account;
    mount(topbar() + '<section class="sheet glass"><header><div class="eyebrow">Profile</div><h2>' + esc(state.settings.name) + '</h2></header><div class="body">' +
      '<div class="hero-card">' + avatarHtml('lg') + '<div style="flex:1"><div style="font:400 24px/1.1 var(--display)">Level ' + lv.level + ' · ' + esc(lv.title) + '</div>' +
      '<div style="color:var(--muted);font-size:13px;margin:4px 0 8px">' + lv.into + ' / ' + lv.need + ' XP to level ' + (lv.level + 1) + '</div><div class="bar"><i style="width:' + Math.round((lv.into / lv.need) * 100) + '%"></i></div></div></div>' +
      '<div class="field"><label for="pf-name">Display name</label><div style="display:flex;gap:8px"><input class="text-in" id="pf-name" maxlength="20" value="' + esc(state.settings.name) + '"><button class="btn" id="pf-save">Save</button></div></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + st.games + '</b><small>Games</small></div><div class="stat"><b>' + st.wins + '</b><small>Wins</small></div>' +
      '<div class="stat"><b>' + st.puzzles.rating + '</b><small>Puzzle rating</small></div><div class="stat"><b>' + (acc === null ? '–' : acc + '%') + '</b><small>Avg. accuracy</small></div>' +
      '<div class="stat"><b>' + P.streak.count + '</b><small>Day streak</small></div><div class="stat"><b>' + Object.keys(P.lessons).length + '</b><small>Lessons done</small></div></div>' +
      '<h3 class="section-title">Online account</h3><div id="pf-account"></div>' +
      '<h3 class="section-title" id="games">Recent games</h3><div class="list">' + (P.history.length ? P.history.map((h, i) => '<button class="row-item" data-game="' + i + '"><span class="res ' + h.result + '">' + h.result.toUpperCase() + '</span><div><b>' + (h.mode === 'ai' ? 'vs ' + esc(LEVELS[h.level] ? LEVELS[h.level].name : 'Computer') : h.mode === 'online' ? 'Online game' : 'Pass and play') + '</b><br><small style="color:var(--muted)">' + esc(REASON_TEXT[h.reason] || h.reason || '') + ' · ' + Math.ceil(h.plies / 2) + ' moves · ' + esc(new Date(h.date).toLocaleDateString()) + '</small></div><span class="pill">Review</span></button>').join('') : '<p style="color:var(--muted)">No games yet.</p>') + '</div>' +
      '<h3 class="section-title">Achievements · ' + Object.keys(P.achievements).length + ' of ' + PG.ACHIEVEMENTS.length + '</h3><div class="ach">' +
      PG.ACHIEVEMENTS.map((a) => '<div class="badge' + (P.achievements[a.id] ? ' got' : '') + '"><i>' + (P.achievements[a.id] ? '★' : '☆') + '</i><div><b>' + esc(a.name) + '</b><small>' + esc(a.desc) + '</small></div></div>').join('') + '</div>' +
      '<h3 class="section-title">Premium</h3>' + premiumLine() +
      '<div class="toggle"><span>Preview Premium on this device, for testing without a server. Does not change your account.</span><input type="checkbox" id="pf-prem"' + (state.settings.previewPremium ? ' checked' : '') + '></div>' +
      '</div></section>' + navbar('profile'));
    wireTopbar(); wireNav();
    $('pf-save').onclick = () => { const v = $('pf-name').value.trim().slice(0, 20); if (v) { state.settings.name = v; save(); toast('Name saved.'); go('profile'); } };
    $('pf-prem').onchange = (e) => { state.settings.previewPremium = e.target.checked; setEntitlements(state.account && state.account.ent); save(); toast(e.target.checked ? 'Premium preview on.' : 'Premium preview off.'); };
    $('pf-store').onclick = () => go('store');
    document.querySelectorAll('[data-game]').forEach((b) => { b.onclick = () => { const h = P.history[+b.dataset.game]; if (h.ucis && h.ucis.length) go('review', { start: h.start || E.START_FEN, ucis: h.ucis, side: h.color || WHITE, title: h.mode === 'ai' ? 'vs ' + (LEVELS[h.level] || {}).name : h.mode }); }; });
    if (window.ChacklateNet) ChacklateNet.renderAccount($('pf-account')); else $('pf-account').innerHTML = '<p style="color:var(--muted)">Online play is not available in this build.</p>';
    if (section === 'games') setTimeout(() => $('games').scrollIntoView({ behavior: 'smooth' }), 100);
    if (section === 'account') setTimeout(() => $('pf-account').scrollIntoView({ behavior: 'smooth' }), 100);
    return { leave() { view.setAttract(false); } };
  };

  function premiumLine() {
    const e = (state.account && state.account.ent) || {};
    const what = e.premium ? (e.premiumUntil === 'lifetime' ? 'Premium Lifetime' : 'Premium until ' + new Date(e.premiumUntil).toLocaleDateString()) : (e.passes || []).length ? 'Free plan with a Season Pass' : 'Free plan';
    return '<div class="acct-row"><div class="sg gold">' + icon('crown') + '</div><div style="flex:1"><b>' + esc(what) + '</b><div style="color:var(--muted);font-size:13px">Purchases are tied to your online account.</div></div><button class="btn small gold" id="pf-store">Store</button></div>';
  }

  // ---------------------------------------------------------------- settings
  function voiceSection(s) {
    const vs = AU.voices();
    const opt = (v, cur) => '<option value="' + v.id + '"' + (cur === v.id ? ' selected' : '') + '>' + esc(v.name) + ' · ' + esc(v.blurb) + '</option>';
    return '<div class="field"><div class="label">Voices</div>' +
      '<label class="toggle">Lesson narration <input type="checkbox" id="s-narr"' + (s.narration ? ' checked' : '') + '></label>' +
      '<label class="toggle">Coach voice <select id="s-vcoach">' + vs.filter((v) => v.lessons).map((v) => opt(v, s.voiceCoach)).join('') + '<option value="device"' + (s.voiceCoach === 'device' ? ' selected' : '') + '>Device voice</option></select></label>' +
      '<label class="toggle">Game calls (check, results, puzzles) <select id="s-vcalls">' + vs.map((v) => opt(v, s.voiceCalls)).join('') + '<option value="off"' + (s.voiceCalls === 'off' ? ' selected' : '') + '>Off</option></select></label>' +
      '<label class="toggle">Read every move aloud <input type="checkbox" id="s-announce"' + (s.announce ? ' checked' : '') + '></label></div>';
  }

  function settingsModal() {
    const s = state.settings;
    const m = modal('<h2>Settings</h2><p class="sub">Looks, sound and coaching. Nothing here changes the rules.</p>' +
      '<div class="field"><div class="label">Graphics</div><div class="seg"><label><input type="radio" name="q" value="high"' + (s.quality === 'high' ? ' checked' : '') + '><span>High: shadows, reflections, room effects</span></label><label><input type="radio" name="q" value="low"' + (s.quality === 'low' ? ' checked' : '') + '><span>Low: faster, saves battery</span></label></div></div>' +
      '<label class="toggle">Animations and effects <input type="checkbox" id="s-anim"' + (s.animations ? ' checked' : '') + '></label>' +
      '<label class="toggle">Sound effects <input type="range" id="s-sfxv" min="0" max="1" step="0.05" value="' + s.sfxVol + '"><input type="checkbox" id="s-sfx"' + (s.sfx ? ' checked' : '') + '></label>' +
      '<label class="toggle">Music <input type="range" id="s-musv" min="0" max="1" step="0.05" value="' + s.musicVol + '"><input type="checkbox" id="s-mus"' + (s.music ? ' checked' : '') + '></label>' +
      voiceSection(s) +
      '<label class="toggle">Coach comments vs the computer <select id="s-coach">' + [['off', 'Off'], ['quiet', 'Blunders only'], ['normal', 'Mistakes and great moves'], ['chatty', 'Every move']].map(([v, t]) => '<option value="' + v + '"' + (s.coach === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
      '<label class="toggle">Evaluation bar vs the computer <input type="checkbox" id="s-eval"' + (s.evalBar ? ' checked' : '') + '></label>' +
      '<label class="toggle">Show legal moves <input type="checkbox" id="s-legal"' + (s.legal ? ' checked' : '') + '></label>' +
      '<label class="toggle">Turn the board each move (pass and play) <input type="checkbox" id="s-turn"' + (s.turnBoard ? ' checked' : '') + '></label>' +
      appSection() +
      '<div class="field" style="margin-top:14px"><label for="s-server">Game server (for online play)</label><input class="text-in" id="s-server" placeholder="Same address as this page" value="' + esc(s.server) + '"></div>' +
      '<div class="row"><button class="btn warn" id="s-reset">Reset progress</button><button class="btn primary" data-close>Done</button></div>');
    const on = (id, ev, fn) => m.querySelector(id).addEventListener(ev, fn);
    m.querySelectorAll('input[name=q]').forEach((r) => r.addEventListener('change', () => { s.quality = r.value; applySettings(); save(); }));
    on('#s-anim', 'change', (e) => { s.animations = e.target.checked; applySettings(); save(); });
    on('#s-sfx', 'change', (e) => { s.sfx = e.target.checked; applySettings(); save(); });
    on('#s-sfxv', 'input', (e) => { s.sfxVol = +e.target.value; applySettings(); AU.play('move'); save(); });
    on('#s-mus', 'change', (e) => { s.music = e.target.checked; AU.unlock(); applySettings(); save(); });
    on('#s-musv', 'input', (e) => { s.musicVol = +e.target.value; applySettings(); save(); });
    on('#s-narr', 'change', (e) => { s.narration = e.target.checked; if (!s.narration) AU.hush(); save(); });
    on('#s-vcoach', 'change', (e) => { s.voiceCoach = e.target.value; applySettings(); save(); AU.unlock(); AU.preview(s.voiceCoach); });
    on('#s-vcalls', 'change', (e) => { s.voiceCalls = e.target.value; applySettings(); save(); AU.unlock(); if (s.voiceCalls !== 'off') AU.preview(s.voiceCalls); });
    on('#s-announce', 'change', (e) => { s.announce = e.target.checked; applySettings(); save(); if (s.announce) { AU.unlock(); AU.announce('Nf3'); } });
    on('#s-coach', 'change', (e) => { s.coach = e.target.value; save(); });
    on('#s-eval', 'change', (e) => { s.evalBar = e.target.checked; save(); renderEval(); });
    on('#s-legal', 'change', (e) => { s.legal = e.target.checked; save(); refreshHighlights(); });
    on('#s-turn', 'change', (e) => { s.turnBoard = e.target.checked; save(); });
    on('#s-server', 'change', (e) => { s.server = e.target.value.trim(); save(); if (window.ChacklateNet) ChacklateNet.connect(); });
    wireAppSection(m);
    on('#s-reset', 'click', () => { if (confirm('Reset all progress, unlocks and history on this device?')) { state.progress = PG.fresh(); save(); m.close(); applyLook(); go('home'); } });
  }

  // ---------------------------------------------------------------- installable app and reminders
  let installPrompt = null, swReg = null;
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
  window.addEventListener('appinstalled', () => { installPrompt = null; toast('Chacklate Chess is installed.'); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('/sw.js').then((r) => { swReg = r; }).catch(() => { /* not served by the game server: no offline shell */ });
  }
  const pushReady = () => !!(swReg && 'PushManager' in window && window.Notification && window.ChacklateNet && ChacklateNet.available());
  function appSection() {
    const s = state.settings, r = s.reminder || { on: false, hour: 19 };
    const hours = Array.from({ length: 24 }, (_, h) => '<option value="' + h + '"' + (r.hour === h ? ' selected' : '') + '>' + String(h).padStart(2, '0') + ':00</option>').join('');
    return '<div class="field" style="margin-top:14px"><div class="label">App</div>' +
      (standalone() ? '<p class="sub" style="margin:0 0 8px">Running as an installed app.</p>'
        : installPrompt ? '<button class="btn" id="s-install" type="button">' + icon('play') + ' Install Chacklate Chess</button>'
        : isIOS() ? '<p class="sub" style="margin:0 0 8px">To install on iPhone or iPad: tap Share, then Add to Home Screen.</p>'
        : '<p class="sub" style="margin:0 0 8px">Your browser can install this page as an app from its menu when it is opened from the game server.</p>') + '</div>' +
      (safety && !safety.reminders ? '<label class="toggle">Daily reminder <small style="color:var(--faint)">(a parent can allow reminders on the parent page)</small><input type="checkbox" disabled></label>' :
      '<label class="toggle">Daily reminder' + (pushReady() ? '' : ' <small style="color:var(--faint)">(needs the game server and notification support)</small>') +
      ' <select id="s-rem-h"' + (pushReady() ? '' : ' disabled') + '>' + hours + '</select><input type="checkbox" id="s-rem"' + (r.on ? ' checked' : '') + (pushReady() ? '' : ' disabled') + '></label>');
  }
  function wireAppSection(m) {
    const ib = m.querySelector('#s-install');
    if (ib) ib.onclick = async () => { const p = installPrompt; installPrompt = null; p.prompt(); try { await p.userChoice; } catch (e) { /* dismissed */ } m.close(); };
    const box = m.querySelector('#s-rem'), hr = m.querySelector('#s-rem-h');
    const apply = async () => {
      const want = { on: box.checked, hour: +hr.value };
      if (want.on && !await parentGate('A parent can turn on reminders.')) { box.checked = false; return; }
      try { await setReminder(want); state.settings.reminder = want; save(); toast(want.on ? 'Reminder set for ' + String(want.hour).padStart(2, '0') + ':00 on days you have not played.' : 'Reminder off.'); }
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
    if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser settings.');
    const { publicKey } = await ChacklateNet.api('/api/push/key');
    const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const s = sub || await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await ChacklateNet.api('/api/push/subscribe', { subscription: s.toJSON(), hour: r.hour, tz: -new Date().getTimezoneOffset() });
  }

  function levelUpModal(level, unlocked) {
    AU.play('levelUp');
    const lv = PG.levelFor(state.progress.xp);
    const m = modal('<div style="text-align:center"><span class="result-badge win">Level up</span><h2 class="result-title" style="margin-top:12px">Level ' + level + '</h2><p class="sub">You are now ' + esc(lv.title) + '.</p>' +
      (unlocked.length ? '<div class="eyebrow" style="margin-top:12px">Unlocked</div><div class="unlocks" style="justify-content:center">' + unlocked.map((u) => '<span class="pill gold">' + esc(u.name) + '</span>').join('') + '</div>' : '') +
      '<div class="row" style="justify-content:center;margin-top:18px">' + (unlocked.length ? '<button class="btn" id="lu-col">See collection</button>' : '') + '<button class="btn primary" data-close>Continue</button></div></div>');
    view.celebrate('win', -1, null, -1);
    const b = m.querySelector('#lu-col'); if (b) b.onclick = () => { m.close(); go('collection', unlocked[0].category); };
  }

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
      renderHud();
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
    onlineStatus(s) { const G = state.game; if (!G || G.kind !== 'online') return; Object.assign(G.online, s); renderHud(); },
    drawOffered() { const G = state.game; if (!G) return; AU.event('draw.offer'); coachSay('Your opponent offers a draw.', [['Accept', 'accept-draw'], ['Decline', 'dismiss']]); const b = document.querySelector('[data-coach="accept-draw"]'); if (b) b.onclick = () => { ChacklateNet.send({ type: 'draw-accept' }); G.coachMsg = null; renderCoach(); }; },
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
  applySettings();
  window.addEventListener('pagehide', save);
  document.addEventListener('pointerdown', () => AU.unlock(), { once: true });
  go('home');
  // App shortcuts from the installed icon's menu.
  if (location.hash === '#quick') setTimeout(() => quickPlay(), 300);
  else if (location.hash.startsWith('#reset=') && window.ChacklateNet) ChacklateNet.resetModal(location.hash.slice(7));
  else if (location.hash === '#email-verified') toast('Email confirmed. Thank you.');
  else if (location.hash === '#email-invalid') toast('That confirmation link has expired or was already used.', 'bad');
  else if (location.hash === '#daily' && dailyPuzzle()) go('puzzle', { list: [dailyPuzzle()], daily: true, title: 'Daily puzzle' });
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  setTimeout(() => $('splash').classList.add('gone'), window.__SHOT ? 0 : 900);
  if (window.ChacklateNet) ChacklateNet.connect();
})();
