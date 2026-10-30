// Online play without the game server: friend codes and worldwide matchmaking over the
// published page's live room (the `room` capability, the same link Jong Club's code tables
// use). net.js stays in charge whenever a Chackmate game server is connected; this file only
// takes over when none is, so the backend can be swapped for the server in India at launch
// without touching the game screens.
//
// Each player keeps the whole game in their room presence (absolute state: the moves so far,
// both clocks, a result), and each side checks the other's moves with the shared engine.
// Nothing typed is ever sent: names are made up, and the only messages are preset reactions.
(function () {
  'use strict';
  const A = () => window.ChacklateApp;
  const server = window.ChacklateNet || null;
  const serverOn = () => !!(server && server.available());

  // Every online game is timed, ten minutes a side at most.
  const TIME_CONTROLS = ['3+2', '5+0', '5+3', '10+0'];
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const FIRST_MOVE_MS = 30000;   // each side has this long for its first move, or the game is called off
  const AWAY_MS = 60000;         // an opponent who leaves for this long loses the game
  const FLAG_GRACE_MS = 3000;    // how far past zero an opponent's clock runs here before we call it
  const LATENCY_MS = 2000;       // the most an opponent's own clock report may give back for the network
  const ADJ = ['Brave', 'Clever', 'Happy', 'Swift', 'Quiet', 'Lucky', 'Bright', 'Gentle', 'Bold', 'Merry', 'Sunny', 'Witty', 'Calm', 'Jolly', 'Kind', 'Nimble'];
  const ANIMAL = ['Otter', 'Panda', 'Falcon', 'Koala', 'Tiger', 'Dolphin', 'Fox', 'Owl', 'Rabbit', 'Lynx', 'Turtle', 'Robin', 'Badger', 'Heron', 'Bear', 'Yak'];

  // link: 'connecting' until the page's live room answers, then 'ready', or 'unavailable' for good.
  let link = 'connecting', linkWaiters = [];
  let lobby = null, ready = false, game = null, seek = null, hosting = null, waitModal = null, ticker = null;

  // ---------------------------------------------------------------- the link
  async function connect() {
    let c = null;
    // The page's runtime arrives a moment after load, or never when the file is opened on its own.
    for (let i = 0; i < 20 && !c; i++) {
      const g = window.claude;
      if (g && typeof g.use === 'function') c = g;
      else await new Promise((r) => setTimeout(r, 500));
    }
    if (!c) return setLink('unavailable');
    try { lobby = await c.use('room'); } catch (e) { lobby = null; }
    if (!lobby) return setLink('unavailable');
    lobby.onConnection((on) => {
      const was = ready; ready = on;
      if (on) setLink('ready');
      if (was !== on && A() && ['home', 'play'].includes(A().state.screen) && !serverOn() && !document.querySelector('.modal')) A().go(A().state.screen);
    }, () => { ready = false; setLink('unavailable'); });
    // A room that never says it is connected is as good as none.
    setTimeout(() => { if (link === 'connecting') setLink('unavailable'); }, 15000);
    lobby.onPeers(() => { if (seek) matchmake(); });
    clearInterval(ticker);
    ticker = setInterval(tick, 250);
  }

  function setLink(v) {
    if (link === v || (link === 'ready' && v === 'unavailable' && ready)) return;
    link = v;
    const w = linkWaiters; linkWaiters = [];
    if (v !== 'connecting') for (const f of w) f(v === 'ready');
  }
  // Resolves true once the room is connected, false when it cannot be.
  function whenReady() { return ready ? Promise.resolve(true) : link === 'unavailable' ? Promise.resolve(false) : new Promise((r) => linkWaiters.push(r)); }
  // Online buttons always work: while the room is still connecting they wait for it, with a note.
  async function needLink(go) {
    if (ready) return go();
    showWait('<div class="seek-orb" aria-hidden="true"><i></i><i></i><i></i></div><h2 style="text-align:center">Connecting…</h2><p class="sub" style="text-align:center">Getting online play ready. This takes a moment.</p>' +
      '<div class="row" style="justify-content:center"><button class="btn" data-close>Cancel</button></div>');
    const m = waitModal;
    const ok = await whenReady();
    if (waitModal !== m) return;   // cancelled
    closeWait(true);
    if (ok) return go();
    A().modal('<h2>Online play is not available here</h2><p class="sub">Codes and world games work in the Chackmate game opened from its claude.ai link, signed in. ' +
      'Opened as a downloaded file, or before the Chackmate server is live, the page cannot reach other players. You can still take turns on this device.</p>' +
      '<div class="row"><button class="btn primary" data-close>OK</button></div>');
  }

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function myPeer(room) { const p = room.peers().find((x) => x.isMe && x.sameTab); return p ? p.peer : null; }
  // A made-up player name, so nobody can tell who a child is from it.
  function nickname() {
    const st = A().state;
    if (!st.settings.netName) { st.settings.netName = ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + ANIMAL[Math.floor(Math.random() * ANIMAL.length)]; A().save(); }
    return st.settings.netName;
  }
  const clean = (s, n) => String(s == null ? '' : s).replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, n || 24) || 'Player';
  const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  const parseTc = (tc) => { const [m, s] = tc.split('+').map(Number); return { base: m * 60000, inc: s * 1000 }; };

  // ---------------------------------------------------------------- worldwide matchmaking
  // Seekers wait in the lobby with their time control in presence. Every page sorts the
  // seekers the same way and pairs them two by two; a pair meets in a room named after both.
  function quickMatch(tc) {
    if (!ready) { needLink(() => quickMatch(tc)); return true; }
    tc = TIME_CONTROLS.includes(tc) ? tc : '5+3';
    cancelAll();
    seek = { tc, since: Date.now(), tried: new Set() };
    lobby.presence({ seek: { tc, at: Date.now() }, app: 'chackmate' }).catch(() => {});
    showWait('<div class="seek-orb" aria-hidden="true"><i></i><i></i><i></i></div><h2 style="text-align:center">Finding a player</h2>' +
      '<p class="sub" style="text-align:center">' + tc + ' · players from around the world · <span id="sk-t">0:00</span></p>' +
      '<div class="row" style="justify-content:center"><button class="btn" id="sk-ai">Play the computer instead</button><button class="btn" data-close>Cancel</button></div>',
    (m) => {
      m.timer = setInterval(() => { const s = Math.floor((Date.now() - seek.since) / 1000), el = m.querySelector('#sk-t'); if (el && seek) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 1000);
      m.querySelector('#sk-ai').onclick = () => { m.close(); A().quickPlayOffline(); };
    });
    matchmake();
    return true;
  }
  function matchmake() {
    if (!seek || seek.pairing || !lobby) return;
    const me = myPeer(lobby);
    if (!me) return;
    const list = lobby.peers().filter((p) => p.kind === 'viewer' && p.presence && p.presence.seek && p.presence.seek.tc === seek.tc && !seek.tried.has(p.peer) || (p.isMe && p.sameTab))
      .map((p) => p.peer).sort();
    const i = list.indexOf(me), j = i ^ 1;
    if (i < 0 || j >= list.length) return;
    const other = list[j];
    const code = 'W' + (hash([me, other].sort().join('|')).toString(36).toUpperCase() + 'XXXXX').slice(0, 5);
    seek.pairing = other;
    meet(code, seek.tc, me < other, other, true);
  }

  // ---------------------------------------------------------------- friend codes
  function createFriend(tc) {
    if (!ready) return needLink(() => createFriend(tc));
    tc = TIME_CONTROLS.includes(tc) ? tc : '5+3';
    cancelAll();
    const code = newCode();
    meet(code, tc, true, null, false);
  }
  function joinFriend(code) {
    if (!ready) return needLink(() => joinFriend(code));
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    cancelAll();
    meet(code, null, false, null, false);
  }

  // Opens the game room and waits for the other player. The host picks colours and starts.
  async function meet(code, tc, host, expect, world) {
    let room;
    try { room = await lobby.join('cm-' + code.toLowerCase()); } catch (e) { room = null; }
    if (!room) { if (world) { if (seek) { seek.tried.add(expect); seek.pairing = null; } return; } return A().toast('Could not open the game room. Try again.', 'bad'); }
    const me = myPeer(room) || myPeer(lobby);
    const h = { code, tc, host, expect, world, room, me, since: Date.now(), unsub: null };
    hosting = h;
    room.presence({ role: host ? 'host' : 'guest', name: nickname(), tc: tc || null }).catch(() => {});
    if (!world && host) {
      showWait('<h2>Share this code</h2><p class="sub">Your friend opens Chackmate, taps Play a Friend and enters the code. ' + tc + ', both players on the clock.</p>' +
        '<div class="friend-code">' + code + '</div>' +
        '<div class="row"><button class="btn" id="fc-copy">' + A().icon('copy') + ' Copy</button><button class="btn" data-close>Cancel</button></div>',
      (m) => { m.querySelector('#fc-copy').onclick = () => { try { navigator.clipboard.writeText(code); A().toast('Code copied.'); } catch (e) { /* clipboard blocked */ } }; });
    } else if (!world) {
      showWait('<div class="seek-orb" aria-hidden="true"><i></i><i></i><i></i></div><h2 style="text-align:center">Joining ' + code + '</h2><p class="sub" style="text-align:center">Waiting for your friend\'s game…</p>' +
        '<div class="row" style="justify-content:center"><button class="btn" data-close>Cancel</button></div>');
    }
    h.unsub = room.onPeers(() => lookAtRoom(h));
    lookAtRoom(h);
    // A worldwide partner who never turns up is skipped; a friend's code with nobody behind it is reported.
    if (world || !host) setTimeout(() => {
      if (hosting !== h || game) return;
      if (world) { hosting = null; if (h.unsub) h.unsub(); room.leave().catch(() => {}); if (seek) { seek.tried.add(expect); seek.pairing = null; matchmake(); } return; }
      cancelAll(); A().toast('No game is waiting with the code ' + code + '. Check it with your friend.', 'bad');
    }, world ? 8000 : 12000);
  }

  function lookAtRoom(h) {
    if (hosting !== h || game) return;
    const peers = h.room.peers().filter((p) => !(p.isMe && p.sameTab) && p.kind === 'viewer');
    if (h.host) {
      const guest = peers.find((p) => p.presence && p.presence.role === 'guest' && (!h.expect || p.peer === h.expect));
      if (!guest) return;
      const meWhite = Math.random() < 0.5;
      const start = { id: h.code + '-' + Date.now().toString(36), tc: h.tc, white: meWhite ? h.me : guest.peer, black: meWhite ? guest.peer : h.me };
      h.room.presence({ start }).catch(() => {});
      begin(h, start, guest);
      return;
    }
    const host = peers.find((p) => p.presence && p.presence.role === 'host');
    const s = host && host.presence.start;
    if (s && typeof s === 'object' && TIME_CONTROLS.includes(s.tc) && (s.white === h.me || s.black === h.me) && typeof s.id === 'string') begin(h, { id: s.id.slice(0, 40), tc: s.tc, white: s.white, black: s.black }, host);
    else if (host && s && !(s.white === h.me || s.black === h.me)) { cancelAll(); A().toast('That game has already started. Ask your friend for a new code.', 'bad'); }
  }

  function begin(h, start, opp) {
    closeWait(true);
    if (h.world) lobby.presence({ seek: null }).catch(() => {});
    seek = null; hosting = null;
    if (h.unsub) h.unsub();
    const color = start.white === h.me ? 'white' : 'black';
    const { base, inc } = parseTc(start.tc);
    game = {
      id: start.id, room: h.room, me: h.me, opp: opp.peer, color, mine: color === 'white' ? 'w' : 'b', tc: start.tc, inc, world: h.world,
      moves: [], clock: { w: base, b: base }, turnAt: performance.now(), startedAt: performance.now(), seen: {}, oppAway: 0, emoteN: 0, lastEmote: 0, ended: false,
    };
    game.unsub = h.room.onPeers(() => fromOpponent());
    h.room.presence({ game: game.id, moves: '', clock: game.clock, end: null, drawOffer: null, drawAccept: null, emote: null }).catch(() => {});
    A().startOnline({ id: game.id, color, tc: start.tc, opponent: { name: clean(opp.presence && opp.presence.name), label: h.world ? 'Player from around the world' : 'Your friend' }, moves: [], clock: clockMsg() });
    fromOpponent();
  }

  // ---------------------------------------------------------------- the game
  const toMove = () => (game.moves.length % 2 === 0 ? 'w' : 'b');
  const running = () => game.moves.length >= 2;
  // The app's clocks count down from `at` for the side to move, once both sides have moved.
  function clockMsg() { return { w: Math.max(0, game.clock.w), b: Math.max(0, game.clock.b), at: game.turnAt }; }
  function left(side) { return game.clock[side] - (running() && toMove() === side ? performance.now() - game.turnAt : 0); }

  // A move went in (ours or theirs): stop the mover's clock and start the other one.
  function pressed(reported) {
    const now = performance.now(), side = game.moves.length % 2 === 1 ? 'w' : 'b';
    if (game.moves.length > 2) {
      let t = game.clock[side] - (now - game.turnAt);
      if (reported !== undefined) t = Math.max(t, Math.min(reported, t + LATENCY_MS));
      game.clock[side] = t + game.inc;
    }
    game.turnAt = now;
  }
  function publish() {
    game.room.presence({ moves: game.moves.join(' '), clock: { w: Math.round(game.clock.w), b: Math.round(game.clock.b) } }).catch(() => {});
  }

  function onMyMove(uci) {
    const G = A().state.game;
    if (!game || game.ended || !G) return;
    game.moves = G.g.uciMoves();
    pressed();
    publish();
    A().onlineStatus({ clock: clockMsg() });
    if (G.g.outcome) boardOver(G.g.outcome);
  }

  function oppPeer() { return game.room.peers().find((p) => p.peer === game.opp); }
  function fromOpponent() {
    if (!game || game.ended) return;
    const p = oppPeer();
    const app = A();
    if (!p) { if (!game.oppAway) { game.oppAway = Date.now(); app.onlineStatus({ opponentAway: true }); } return; }
    if (game.oppAway) { game.oppAway = 0; app.onlineStatus({ opponentAway: false }); }
    const s = p.presence || {};
    if (s.game !== game.id) return;
    // Their move: exactly one more than we have, theirs to make, and legal.
    const theirs = typeof s.moves === 'string' && s.moves ? s.moves.split(' ') : [];
    if (theirs.length === game.moves.length + 1 && toMove() !== game.mine && theirs.slice(0, -1).join(' ') === game.moves.join(' ')) {
      const uci = theirs[theirs.length - 1];
      const g = new app.E.Game();
      for (const u of game.moves) g.playText(u);
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) && g.playText(uci)) {
        game.moves = theirs;
        const side = game.mine === 'w' ? 'b' : 'w';
        pressed(s.clock && Number.isFinite(s.clock[side]) ? s.clock[side] : undefined);
        app.onlineMove(uci, clockMsg());
        const G = app.state.game;
        if (G && G.g.outcome) return boardOver(G.g.outcome);
      }
    }
    // Reactions: preset ids only, a fresh number each time.
    if (s.emote && typeof s.emote === 'object' && s.emote.n !== game.seen.emote && EMOTE_IDS.includes(s.emote.id)) {
      game.seen.emote = s.emote.n;
      app.onlineEmote(s.emote.id, false);
    }
    // A draw offer for the position on the board now.
    if (Number.isInteger(s.drawOffer) && s.drawOffer === game.moves.length && game.seen.drawOffer !== s.drawOffer) {
      game.seen.drawOffer = s.drawOffer;
      if (game.myDrawOffer === game.moves.length) return finish('1/2-1/2', 'agreement', true);
      app.drawOffered();
    }
    if (Number.isInteger(s.drawAccept) && game.myDrawOffer === s.drawAccept && s.drawAccept === game.moves.length) return finish('1/2-1/2', 'agreement', true);
    // Their result counts only when it goes against them, or it is a draw the board allows.
    const e = s.end;
    if (e && typeof e === 'object') {
      const theyLose = game.mine === 'w' ? '1-0' : '0-1';
      const g = new app.E.Game(); for (const u of game.moves) g.playText(u);
      if (e.result === theyLose && ['resignation', 'timeout', 'aborted'].includes(e.reason)) finish(e.result, e.reason, true);
      else if (e.result === '1/2-1/2' && (e.reason === 'aborted' || e.reason === 'timeout-insufficient' || (e.reason === g.claimable()))) finish(e.result, e.reason, true);
    }
  }

  function tick() {
    if (!game || game.ended || game.over) return;
    const now = performance.now();
    const side = toMove();
    if (!running()) {
      if (now - game.turnAt > FIRST_MOVE_MS + (side === game.mine ? 0 : FLAG_GRACE_MS)) finish('1/2-1/2', 'aborted', false);
      return;
    }
    if (left(side) <= (side === game.mine ? 0 : -FLAG_GRACE_MS)) {
      const g = new (A().E.Game)(); for (const u of game.moves) g.playText(u);
      g.timeout(side === 'w' ? A().E.WHITE : A().E.BLACK);
      game.clock[side] = 0;
      return finish(g.outcome.result, g.outcome.reason, false);
    }
    if (game.oppAway && Date.now() - game.oppAway > AWAY_MS) finish(game.mine === 'w' ? '1-0' : '0-1', 'abandoned', false);
  }

  // Mate, stalemate and the like: both sides see it on the board; let the last move land first.
  function boardOver(o) { if (game.over) return; game.over = true; const g = game; setTimeout(() => { if (game === g) finish(o.result, o.reason, false); }, 1200); }

  function finish(result, reason, fromThem) {
    if (!game || game.ended) return;
    game.ended = true;
    if (!fromThem) game.room.presence({ end: { result, reason } }).catch(() => {});
    A().onlineEnd(result, reason, null);
    const g = game;
    // Stay a little so the other side hears the result, then free the room.
    setTimeout(() => { if (g.unsub) g.unsub(); g.room.leave().catch(() => {}); }, 8000);
  }

  function send(m) {
    if (!game) return;
    if (m.type === 'move') return onMyMove(m.uci);
    if (game.ended) return;
    const G = A().state.game;
    switch (m.type) {
      case 'resign': return finish(game.mine === 'w' ? '0-1' : '1-0', game.moves.length < 2 ? 'aborted' : 'resignation', false);
      case 'draw-offer': game.myDrawOffer = game.moves.length; game.room.presence({ drawOffer: game.moves.length }).catch(() => {}); return;
      case 'draw-accept': game.room.presence({ drawAccept: game.moves.length }).catch(() => {}); return finish('1/2-1/2', 'agreement', false);
      case 'claim': if (G && G.g.outcome) finish(G.g.outcome.result, G.g.outcome.reason, false); return;
      case 'emote': {
        if (!EMOTE_IDS.includes(m.id) || Date.now() - game.lastEmote < 1500) return;
        game.lastEmote = Date.now();
        game.room.presence({ emote: { id: m.id, n: ++game.emoteN } }).catch(() => {});
        A().onlineEmote(m.id, true);
        return;
      }
      case 'sync': return;
    }
  }

  // ---------------------------------------------------------------- waiting modals
  function showWait(html, wire) {
    closeWait();
    const m = A().modal(html, { sticky: true, onClose() { clearInterval(m.timer); if (waitModal === m) waitModal = null; if (!m.matched) cancelAll(); } });
    waitModal = m;
    if (wire) wire(m);
  }
  function closeWait(matched) { if (waitModal) { const m = waitModal; m.matched = !!matched; waitModal = null; m.close(); } }
  function cancelAll() {
    if (seek) { seek = null; if (lobby) lobby.presence({ seek: null }).catch(() => {}); }
    if (hosting) { const h = hosting; hosting = null; if (h.unsub) h.unsub(); h.room.leave().catch(() => {}); }
    closeWait(true);
  }
  // A reload or a new game drops a finished or abandoned room.
  window.addEventListener('pagehide', () => { if (game && !game.ended) send({ type: 'resign' }); });

  // ---------------------------------------------------------------- one face for the app
  const EMOTE_IDS = ['hello', 'luck', 'nice', 'wow', 'think', 'gg'];
  const relay = {
    available: () => ready,
    quickMatch, createFriend, joinFriend, send,
    report() { A().toast('Thanks. Reports reach a moderator once the Chackmate game server is live.'); },
  };
  // The server when it is connected, the room when it is not.
  const pick = () => (serverOn() ? server : relay);
  window.ChacklateNet = Object.assign({}, server || {}, {
    available: () => serverOn() || ready,
    mode: () => (serverOn() ? 'server' : ready ? 'room' : 'offline'),
    // 'ready', 'connecting' or 'unavailable': whether codes and world games can work on this page.
    link: () => (serverOn() ? 'ready' : link),
    timeControls: TIME_CONTROLS,
    quickMatch(tc) { const p = pick(); return p ? p.quickMatch(tc) : false; },
    createFriend(tc) { const p = pick(); if (p) p.createFriend(tc); },
    joinFriend(code) { const p = pick(); if (p) p.joinFriend(code); },
    send(m) { if (game && !game.ended || (game && m.type === 'move')) return relay.send(m); if (server) server.send(m); },
    report(reason, id) { if (game && game.id === id) return relay.report(); if (server) server.report(reason, id); },
    connect() { if (server && server.connect) server.connect(); if (!lobby) connect(); },
  });
  Object.defineProperty(window.ChacklateNet, '_relay', { value: { state: () => ({ ready, game, seek, hosting }), lobbyRef: () => lobby } });
})();
