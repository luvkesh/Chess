// Online client: connects to the Chacklate game server over WebSocket. The server is the referee
// (move legality, clocks, results, ratings); this file only relays and draws the account panel.
// When no server is reachable everything else in the app keeps working offline.
(function () {
  'use strict';
  const A = () => window.ChacklateApp;
  let sock = null, ready = false, retry = 0, retryTimer = null, me = null, ratings = null, seekingModal = null, friendModal = null, progressTimer = null;

  function base() {
    const s = A() && A().state.settings.server;
    if (s) return s.replace(/\/+$/, '').replace(/^ws/, 'http');
    if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
    return '';
  }
  const wsUrl = () => base().replace(/^http/, 'ws') + '/ws';

  function connect() {
    clearTimeout(retryTimer);
    if (sock) { sock.onclose = null; try { sock.close(); } catch (e) { /* already closed */ } sock = null; }
    ready = false;
    if (!base() || typeof WebSocket === 'undefined') return;
    try { sock = new WebSocket(wsUrl()); } catch (e) { return schedule(); }
    sock.onopen = () => { retry = 0; sock.send(JSON.stringify({ type: 'hello', token: account().token || '' })); };
    sock.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } onMessage(m); };
    sock.onclose = () => {
      const was = ready; ready = false; sock = null;
      if (was && A()) { A().toast('Reconnecting to the game server…'); A().onlineStatus({ offline: true }); }
      schedule();
    };
  }
  function schedule() { retryTimer = setTimeout(connect, Math.min(30000, 1000 * Math.pow(2, retry++))); }

  function account() { const st = A() && A().state; return (st && st.account) || {}; }
  function setAccount(a) { const st = A().state; st.account = Object.assign({}, st.account || {}, a); A().save(); }

  function send(m) { if (sock && ready) sock.send(JSON.stringify(m)); }

  function onMessage(m) {
    const app = A();
    if (!app) return;
    switch (m.type) {
      case 'welcome': {
        ready = true; me = m.user; ratings = m.ratings;
        setAccount({ token: m.token, name: me.name, guest: me.guest, id: me.id });
        // Adopt the server copy of progress when it is further along (a second device, a cleared browser).
        if (m.progress && m.progress.xp > app.state.progress.xp) { app.state.progress = app.PG.migrate(m.progress); app.save(); if (app.state.screen !== 'game') app.go(app.state.screen); }
        else syncProgress();
        if (m.entitlements) app.setEntitlements(m.entitlements);
        refreshPanel();
        if (['home', 'store', 'season'].includes(app.state.screen)) app.go(app.state.screen);
        if (app.state.game && app.state.game.kind === 'online') send({ type: 'sync' });
        return;
      }
      case 'seeking': return showSeeking(m.tc);
      case 'idle': closeSeeking(); return;
      case 'friend-code': return showCode(m.code, m.tc);
      case 'start':
        closeSeeking();
        if (friendModal) { friendModal.close(); friendModal = null; }
        app.startOnline({ id: m.id, color: m.color, tc: m.tc, opponent: m.opponent, moves: m.moves, clock: m.clock, rating: m.rating, rated: m.rated });
        if (m.away) app.onlineStatus({ opponentAway: true });
        return;
      case 'move': return app.onlineMove(m.uci, m.clock);
      case 'ack': return app.onlineStatus({ clock: Object.assign({}, m.clock, { at: performance.now() }) });
      case 'sync': return app.onlineSync(m.moves, m.clock);
      case 'status': return app.onlineStatus({ opponentAway: m.opponentAway, offline: false });
      case 'draw-offer': return app.drawOffered();
      case 'end':
        if (m.rating) { const g = app.state.game; const pool = poolFor(g && g.online ? g.online.tc : '5+3'); if (ratings && ratings[pool]) { ratings[pool].rating = m.rating.after; ratings[pool].games++; } }
        return app.onlineEnd(m.result, m.reason, m.rating);
      case 'reported': return app.toast('Thanks. A moderator will review the game.');
      case 'banned':
        setAccount({ token: '' });
        app.toast('This account is suspended: ' + m.reason, 'bad');
        return;
      case 'error': return app.toast(m.message, 'bad');
    }
  }

  function poolFor(tc) { const [mm, s] = String(tc).split('+').map(Number); const est = mm * 60 + 40 * s; return est < 180 ? 'bullet' : est < 480 ? 'blitz' : 'rapid'; }

  function showSeeking(tc) {
    const app = A();
    if (seekingModal) return;
    const started = Date.now();
    seekingModal = app.modal('<div class="seek-orb" aria-hidden="true"><i></i><i></i><i></i></div><h2 style="text-align:center">Finding an opponent</h2>' +
      '<p class="sub" style="text-align:center">' + app.esc(tc) + ' · rated · <span id="sk-t">0:00</span></p>' +
      '<div class="row" style="justify-content:center"><button class="btn" id="sk-ai">Play the computer instead</button><button class="btn" data-close>Cancel</button></div>',
    { sticky: true, onClose() { clearInterval(seekingModal && seekingModal.timer); if (seekingModal && !seekingModal.matched) send({ type: 'cancel' }); seekingModal = null; } });
    seekingModal.timer = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000), el = seekingModal && seekingModal.querySelector('#sk-t');
      if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }, 1000);
    seekingModal.querySelector('#sk-ai').onclick = () => { seekingModal.close(); app.quickPlayOffline(); };
  }
  function closeSeeking() { if (seekingModal) { seekingModal.matched = true; seekingModal.close(); } }

  function showCode(code, tc) {
    const app = A();
    friendModal = app.modal('<h2>Share this code</h2><p class="sub">Your friend opens Chacklate Chess, taps Play a Friend and enters the code. ' + app.esc(tc) + ', unrated. The code lasts 10 minutes.</p>' +
      '<div class="friend-code">' + app.esc(code) + '</div>' +
      '<div class="row"><button class="btn" id="fc-copy">' + app.icon('copy') + ' Copy</button><button class="btn" data-close>Cancel</button></div>',
    { sticky: true, onClose() { friendModal = null; } });
    friendModal.querySelector('#fc-copy').onclick = () => { try { navigator.clipboard.writeText(code); app.toast('Code copied.'); } catch (e) { /* clipboard blocked */ } };
  }

  // ---------------------------------------------------------------- HTTP API
  async function api(path, body) {
    const res = await fetch(base() + path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, account().token ? { Authorization: 'Bearer ' + account().token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'The server said no (' + res.status + ').');
    return out;
  }

  let panel = null, board = 'blitz';
  function refreshPanel() { if (panel && document.body.contains(panel)) renderAccount(panel); }

  function renderAccount(el) {
    panel = el;
    const app = A(), esc = app.esc;
    if (!base()) { el.innerHTML = '<p style="color:var(--muted)">Online play needs the game server. Open the game from your server\'s address, or set it under Settings.</p>'; return; }
    if (!ready || !me) { el.innerHTML = '<p style="color:var(--muted)">Connecting to ' + esc(base()) + '…</p>'; return; }
    const r = ratings || {};
    const rating = (p) => r[p] ? '<div class="mini glass"><div class="eyebrow">' + p + '</div><b>' + r[p].rating + (r[p].games < 5 ? '?' : '') + '</b><small style="color:var(--muted)">' + r[p].games + ' games</small></div>' : '';
    el.innerHTML =
      '<div class="acct-row">' + app.avatarHtml('sm') + '<div style="flex:1"><b>' + esc(me.name) + '</b><div style="color:var(--muted);font-size:13px">' + (me.guest ? 'Guest account on this device' : 'Signed in') + '</div></div>' +
      (me.guest ? '' : '<button class="btn small" id="ac-out">Sign out</button>') + '</div>' +
      '<div class="today" style="margin:12px 0">' + rating('bullet') + rating('blitz') + rating('rapid') + '</div>' +
      (me.guest ?
        '<form id="ac-form" class="acct-form"><p style="color:var(--muted);margin:0 0 8px">Pick a name to keep your rating, appear on leaderboards and play on any device.</p>' +
        '<div class="field"><label for="ac-name">Name</label><input class="text-in" id="ac-name" autocomplete="username" maxlength="20" required></div>' +
        '<div class="field"><label for="ac-pw">Password</label><input class="text-in" id="ac-pw" type="password" autocomplete="new-password" minlength="8" required></div>' +
        '<p class="err" id="ac-err"></p><div class="row" style="justify-content:flex-start"><button class="btn primary" id="ac-reg">Create account</button><button class="btn" id="ac-login" type="button">I have an account</button></div></form>' : '') +
      '<h3 class="section-title">Leaderboard</h3><div class="seg" id="lb-pool">' + ['bullet', 'blitz', 'rapid'].map((p) => '<label><input type="radio" name="lbp" value="' + p + '"' + (p === board ? ' checked' : '') + '><span>' + p + '</span></label>').join('') + '</div>' +
      '<ol class="leaderboard" id="lb"><li style="color:var(--muted)">Loading…</li></ol>';
    const out = el.querySelector('#ac-out');
    if (out) out.onclick = async () => { try { await api('/api/logout', {}); } catch (e) { /* signed out locally either way */ } setAccount({ token: '', guest: true }); app.setEntitlements(null); app.save(); connect(); };
    const form = el.querySelector('#ac-form');
    if (form) {
      const submit = async (path) => {
        const err = el.querySelector('#ac-err');
        err.textContent = '';
        try {
          const res = await api(path, { name: el.querySelector('#ac-name').value.trim(), password: el.querySelector('#ac-pw').value });
          setAccount({ token: res.token, name: res.user.name, guest: false });
          app.state.settings.name = res.user.name; app.save();
          app.toast('Welcome, ' + res.user.name + '.');
          connect();
        } catch (e) { err.textContent = e.message; }
      };
      form.onsubmit = (e) => { e.preventDefault(); submit('/api/register'); };
      el.querySelector('#ac-login').onclick = () => submit('/api/login');
    }
    el.querySelector('#lb-pool').onchange = (e) => { board = e.target.value; loadBoard(el); };
    loadBoard(el);
  }

  async function loadBoard(el) {
    const list = el.querySelector('#lb');
    try {
      const res = await api('/api/leaderboard?pool=' + board);
      const esc = A().esc;
      list.innerHTML = res.rows.length
        ? res.rows.map((r) => '<li' + (me && r.name === me.name ? ' class="me"' : '') + '><span class="rk">' + r.rank + '</span><span class="nm">' + esc(r.name) + '</span><span class="rt">' + r.rating + '</span></li>').join('')
        : '<li style="color:var(--muted)">No ranked players yet. Five rated games puts you on the board.</li>';
    } catch (e) { list.innerHTML = '<li style="color:var(--muted)">' + A().esc(e.message) + '</li>'; }
  }

  function syncProgress() {
    clearTimeout(progressTimer);
    progressTimer = setTimeout(() => { if (A()) send({ type: 'progress', data: A().state.progress }); }, 1500);
  }

  window.ChacklateNet = {
    available: () => ready,
    api,
    connect,
    send,
    syncProgress,
    renderAccount,
    quickMatch(tc) { if (!ready) return false; send({ type: 'seek', tc: tc || '5+3' }); return true; },
    createFriend(tc) { send({ type: 'friend-create', tc }); },
    joinFriend(code) { send({ type: 'friend-join', code }); },
    report(reason, game) { send({ type: 'report', reason, game }); },
  };
})();
