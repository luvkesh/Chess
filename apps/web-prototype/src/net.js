// Online client: connects to the Chackmate game server over WebSocket. The server is the referee
// (move legality, clocks, results, ratings); this file only relays and draws the account panel.
// When no server is reachable everything else in the app keeps working offline.
(function () {
  'use strict';
  const t = (k, v) => ChacklateI18n.t(k, v);
  const A = () => window.ChacklateApp;
  let sock = null, ready = false, retry = 0, retryTimer = null, me = null, acct = null, safety = null, ratings = null, seekingModal = null, friendModal = null, progressTimer = null;

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
      if (was && A()) { A().toast(t('account.reconnecting')); A().onlineStatus({ offline: true }); }
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
        ready = true; me = m.user; ratings = m.ratings; acct = m.account || null; safety = m.safety || null;
        app.setSafety(safety);
        if (window.ChacklateClub) ChacklateClub.fromServer(acct && acct.location);
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
      case 'safety': safety = m.safety; app.setSafety(safety); refreshPanel(); return;
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
      case 'emote': return app.onlineEmote(m.id, false);
      case 'end':
        if (m.rating) { const g = app.state.game; const pool = poolFor(g && g.online ? g.online.tc : '5+3'); if (ratings && ratings[pool]) { ratings[pool].rating = m.rating.after; ratings[pool].games++; } }
        return app.onlineEnd(m.result, m.reason, m.rating);
      case 'reported': return app.toast(t('account.reported'));
      case 'banned':
        setAccount({ token: '' });
        app.toast(t('account.suspended', { reason: m.reason }), 'bad');
        return;
      case 'deleted':
        setAccount({ token: '', guest: true, ent: null }); app.setEntitlements(null); app.save();
        app.toast(t('account.deleted'));
        return;
      case 'error': return app.toast(m.message, 'bad');
    }
  }

  function poolFor(tc) { const [mm, s] = String(tc).split('+').map(Number); const est = mm * 60 + 40 * s; return est < 180 ? 'bullet' : est < 480 ? 'blitz' : 'rapid'; }

  function showSeeking(tc) {
    const app = A();
    if (seekingModal) return;
    const started = Date.now();
    seekingModal = app.modal('<div class="seek-orb" aria-hidden="true"><i></i><i></i><i></i></div><h2 style="text-align:center">' + t('account.seek.title') + '</h2>' +
      '<p class="sub" style="text-align:center">' + app.esc(tc) + ' · ' + t('account.seek.rated') + ' · <span id="sk-t">0:00</span></p>' +
      '<div class="row" style="justify-content:center"><button class="btn" id="sk-ai">' + t('account.seek.ai') + '</button><button class="btn" data-close>' + t('common.cancel') + '</button></div>',
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
    friendModal = app.modal('<h2>' + t('account.code.title') + '</h2><p class="sub">' + t('account.code.how', { tc: app.esc(tc) }) + '</p>' +
      '<div class="friend-code">' + app.esc(code) + '</div>' +
      '<div class="row"><button class="btn" id="fc-copy">' + app.icon('copy') + ' ' + t('account.code.copy') + '</button><button class="btn" data-close>' + t('common.cancel') + '</button></div>',
    { sticky: true, onClose() { friendModal = null; } });
    friendModal.querySelector('#fc-copy').onclick = () => { try { navigator.clipboard.writeText(code); app.toast(t('account.code.copied')); } catch (e) { /* clipboard blocked */ } };
  }

  // ---------------------------------------------------------------- HTTP API
  async function api(path, body) {
    const res = await fetch(base() + path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, account().token ? { Authorization: 'Bearer ' + account().token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || t('account.serverNo', { status: res.status }));
    return out;
  }

  let panel = null;
  function refreshPanel() { if (panel && document.body.contains(panel)) renderAccount(panel); }

  function renderAccount(el) {
    panel = el;
    const app = A(), esc = app.esc;
    if (!base()) { el.innerHTML = '<p style="color:var(--muted)">' + t('account.needServer') + '</p>'; return; }
    if (!ready || !me) { el.innerHTML = '<p style="color:var(--muted)">' + t('account.connecting', { server: esc(base()) }) + '</p>'; return; }
    const r = ratings || {};
    const rating = (p) => r[p] ? '<div class="mini glass"><div class="eyebrow">' + p + '</div><b>' + r[p].rating + (r[p].games < 5 ? '?' : '') + '</b><small style="color:var(--muted)">' + r[p].games + ' games</small></div>' : '';
    el.innerHTML =
      '<div class="acct-row">' + app.avatarHtml('sm') + '<div style="flex:1"><b>' + esc(me.name) + '</b><div style="color:var(--muted);font-size:13px">' + (me.guest ? t('account.guest') : t('account.signedIn')) + '</div></div>' +
      (me.guest ? '' : '<button class="btn small" id="ac-out">' + t('account.signOut') + '</button>') + '</div>' +
      '<div class="today" style="margin:12px 0">' + rating('bullet') + rating('blitz') + rating('rapid') + '</div>' +
      (me.guest ?
        '<div class="acct-form"><p style="color:var(--muted);margin:0 0 8px">' + t('account.why') + '</p>' +
        '<div class="row" style="justify-content:flex-start"><button class="btn primary" id="ac-reg" type="button">' + t('account.create') + '</button><button class="btn" id="ac-login" type="button">' + t('account.haveOne') + '</button><button class="btn ghost small" id="ac-forgot" type="button">' + t('account.forgot') + '</button></div></div>'
        : safetyPanel() + accountTools()) +
      '<div class="row" style="justify-content:flex-start;margin-top:12px"><button class="btn" data-nav="club" type="button">' + app.icon('users') + ' ' + t('account.club') + '</button></div>';
    const out = el.querySelector('#ac-out');
    if (out) out.onclick = async () => { try { await api('/api/logout', {}); } catch (e) { /* signed out locally either way */ } setAccount({ token: '', guest: true }); app.setEntitlements(null); app.save(); connect(); };
    const reg = el.querySelector('#ac-reg');
    if (reg) { reg.onclick = () => signUpModal(); el.querySelector('#ac-login').onclick = () => signInModal(); }
    const age = el.querySelector('#ac-age');
    if (age) age.onclick = () => signUpModal({ ageOnly: true });
    const resend = el.querySelector('#ac-resend');
    if (resend) resend.onclick = () => parentEmailModal();
    wireAccountTools(el);
    el.querySelector('[data-nav="club"]').onclick = () => app.go('club');
  }

  // ---------------------------------------------------------------- account self-service
  function minor() { return safety && safety.kind === 'minor'; }
  // Under-18 accounts show their parent status instead of an email field.
  function safetyPanel() {
    if (!safety || safety.kind !== 'minor') return '';
    const esc = A().esc;
    if (!safety.band) return '<div class="callout">' + t('account.age.need') + ' <button class="btn small" id="ac-age" type="button">' + t('account.age.add') + '</button></div>';
    if (!safety.consent) return '<div class="callout">' + t('account.consent.wait') + ' <button class="btn small" id="ac-resend" type="button">' + t('account.consent.resend') + '</button></div>';
    return '<div class="callout">' + t('account.parent') + ' ' + (safety.online ? esc(safety.online) : t('account.onlineOn')) + '</div>';
  }
  function accountTools() {
    const esc = A().esc, a = acct || {};
    if (minor()) return '<div class="acct-tools"><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn small" id="ac-pw" type="button">' + t('account.pw.change') + '</button><button class="btn small" id="ac-export" type="button">' + t('account.export') + '</button><button class="btn small warn" id="ac-del" type="button">' + t('account.del') + '</button></div></div>';
    return '<div class="acct-tools">' +
      '<div class="field"><label for="ac-email">' + t('account.email') + ' ' + (a.email ? (a.emailVerified ? '<span class="pill gold">' + t('account.email.ok') + '</span>' : '<span class="pill">' + t('account.email.check') + '</span>') : '<span class="pill">' + t('account.email.why') + '</span>') + '</label>' +
      '<div style="display:flex;gap:8px"><input class="text-in" id="ac-email" type="email" autocomplete="email" value="' + esc(a.email || '') + '" placeholder="you@example.com"><button class="btn" id="ac-email-go" type="button">' + (a.email && !a.emailVerified ? t('account.email.resend') : t('common.save')) + '</button></div></div>' +
      '<div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn small" id="ac-pw" type="button">' + t('account.pw.change') + '</button><button class="btn small" id="ac-export" type="button">' + t('account.export') + '</button><button class="btn small warn" id="ac-del" type="button">' + t('account.del') + '</button></div></div>';
  }
  function wireAccountTools(el) {
    const app = A(), q = (s) => el.querySelector(s);
    const forgot = q('#ac-forgot');
    if (forgot) forgot.onclick = () => forgotModal('');
    if (!q('#ac-pw') || q('#ac-pw').tagName !== 'BUTTON') return;
    if (q('#ac-email-go')) q('#ac-email-go').onclick = async () => {
      try { const r = await api('/api/account/email', { email: q('#ac-email').value.trim() }); acct = { email: r.email, emailVerified: false }; app.toast(t('account.email.sent', { email: app.esc(r.email) })); renderAccount(el); }
      catch (e) { app.toast(app.esc(e.message), 'bad'); }
    };
    q('#ac-pw').onclick = () => {
      const m = app.modal('<h2>' + t('account.pw.change') + '</h2><form id="cp"><div class="field"><label for="cp-old">' + t('account.pw.current') + '</label><input class="text-in" id="cp-old" type="password" autocomplete="current-password" required></div>' +
        '<div class="field"><label for="cp-new">' + t('account.pw.new') + '</label><input class="text-in" id="cp-new" type="password" autocomplete="new-password" minlength="8" required></div><p class="err" id="cp-err"></p>' +
        '<div class="row"><button class="btn" type="button" data-close>' + t('common.cancel') + '</button><button class="btn primary">' + t('account.pw.go') + '</button></div></form><p class="sub">' + t('account.pw.others') + '</p>');
      m.querySelector('#cp').onsubmit = async (e) => {
        e.preventDefault();
        try { await api('/api/account/password', { current: m.querySelector('#cp-old').value, password: m.querySelector('#cp-new').value }); m.close(); app.toast(t('account.pw.done')); }
        catch (err) { m.querySelector('#cp-err').textContent = err.message; }
      };
    };
    q('#ac-export').onclick = async () => {
      try {
        const data = await api('/api/account/export');
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'chacklate-' + (me ? me.name : 'account') + '.json'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (e) { app.toast(app.esc(e.message), 'bad'); }
    };
    q('#ac-del').onclick = () => {
      const m = app.modal('<h2>' + t('account.del.title') + '</h2><p class="sub">' + t('account.del.what') + '</p>' +
        '<form id="da"><div class="field"><label for="da-pw">' + t('account.password') + '</label><input class="text-in" id="da-pw" type="password" autocomplete="current-password" required></div><p class="err" id="da-err"></p>' +
        '<div class="row"><button class="btn" type="button" data-close>' + t('account.del.keep') + '</button><button class="btn warn">' + t('account.del.go') + '</button></div></form>');
      m.querySelector('#da').onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api('/api/account/delete', { password: m.querySelector('#da-pw').value });
          m.close();
          app.state.progress = app.PG.fresh(); app.PG.setSeason(app.state.progress);
          setAccount({ token: '', guest: true, ent: null }); app.setEntitlements(null); app.save();
          app.toast(t('account.deleted')); connect(); app.go('home');
        } catch (err) { m.querySelector('#da-err').textContent = err.message; }
      };
    };
  }
  // ---------------------------------------------------------------- sign up and sign in
  const MONTHS = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => t('account.month.' + n));
  function ageOf(y, mo) { const d = new Date(); let a = d.getFullYear() - y; if (d.getMonth() + 1 < mo) a--; return a; }
  // A neutral age question first (no default, no hint about a "right" answer), then the right form for that age.
  function signUpModal(opts) {
    opts = opts || {};
    const app = A(), esc = app.esc, year = new Date().getFullYear();
    const years = []; for (let y = year - 4; y >= year - 100; y--) years.push(y);
    const m = app.modal('<h2>' + (opts.ageOnly ? t('account.age.title') : t('account.create.title')) + '</h2><p class="sub">' + t('account.born') + '</p>' +
      '<div class="row" style="justify-content:flex-start"><select class="text-in" id="su-m" aria-label="' + t('account.birthMonth') + '"><option value="">' + t('account.month') + '</option>' + MONTHS().map((n, i) => '<option value="' + (i + 1) + '">' + n + '</option>').join('') + '</select>' +
      '<select class="text-in" id="su-y" aria-label="' + t('account.birthYear') + '"><option value="">' + t('account.year') + '</option>' + years.map((y) => '<option>' + y + '</option>').join('') + '</select></div>' +
      '<div id="su-rest"></div><p class="err" id="su-err"></p>');
    const q = (s) => m.querySelector(s);
    let picked = null;
    const step2 = async () => {
      const mo = +q('#su-m').value, y = +q('#su-y').value;
      if (!mo || !y) return;
      const kid = ageOf(y, mo) < 18;
      const needName = !opts.ageOnly || kid;
      let names = [];
      if (kid) { try { names = (await api('/api/names')).names; } catch (e) { names = []; } }
      const nameField = !needName ? '' : kid
        ? '<div class="field"><div class="label">' + t('account.pickName') + '</div><div class="chips" id="su-names">' + names.map((n) => '<button type="button" class="chip" data-n="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div><button type="button" class="btn ghost small" id="su-more">' + t('account.moreNames') + '</button>' +
          '<p class="fine">' + t('account.namesWhy') + '</p></div>'
        : '<div class="field"><label for="su-name">' + t('account.name') + '</label><input class="text-in" id="su-name" autocomplete="username" maxlength="20" required></div>';
      q('#su-rest').innerHTML = nameField +
        (opts.ageOnly ? '' : '<div class="field"><label for="su-pw">' + t('account.password') + '</label><input class="text-in" id="su-pw" type="password" autocomplete="new-password" minlength="8" required></div>') +
        (kid ? '<div class="field"><label for="su-pe">' + t('account.parentEmail') + '</label><input class="text-in" id="su-pe" type="email" autocomplete="off" required>' +
          '<p class="fine">' + t('account.parentAsk') + '</p></div>' : '') +
        '<div class="row"><button class="btn" type="button" data-close>' + t('common.cancel') + '</button><button class="btn primary" id="su-go" type="button">' + (opts.ageOnly ? t('common.save') : t('account.create')) + '</button></div>';
      const wire = () => m.querySelectorAll('[data-n]').forEach((b) => { b.onclick = () => { picked = b.dataset.n; m.querySelectorAll('[data-n]').forEach((x) => x.classList.toggle('on', x === b)); }; });
      wire();
      const more = q('#su-more');
      if (more) more.onclick = async () => { try { const r = await api('/api/names'); q('#su-names').innerHTML = r.names.map((n) => '<button type="button" class="chip" data-n="' + esc(n) + '">' + esc(n) + '</button>').join(''); picked = null; wire(); } catch (e) { /* keep the current names */ } };
      q('#su-go').onclick = async () => {
        const err = q('#su-err'); err.textContent = '';
        const name = kid ? picked : q('#su-name') ? q('#su-name').value.trim() : '';
        if (needName && !name) { err.textContent = kid ? t('account.pickFirst') : t('account.chooseName'); return; }
        const body = { birthYear: y, birthMonth: mo, parentEmail: kid ? q('#su-pe').value.trim() : undefined };
        try {
          if (opts.ageOnly) {
            await api('/api/account/age', Object.assign(body, { name })); m.close(); app.toast(kid ? t('account.thanksParent') : t('account.thanks')); connect(); return;
          }
          const res = await api('/api/register', Object.assign(body, { name, password: q('#su-pw').value }));
          setAccount({ token: res.token, name: res.user.name, guest: false });
          app.state.settings.name = res.user.name; app.save();
          m.close();
          app.toast(kid ? t('account.welcomeKid', { name: esc(res.user.name) }) : t('account.welcome', { name: esc(res.user.name) }));
          connect();
        } catch (e) { err.textContent = e.message; }
      };
    };
    q('#su-m').onchange = step2; q('#su-y').onchange = step2;
  }
  function signInModal() {
    const app = A();
    const m = app.modal('<h2>' + t('account.signIn') + '</h2><form id="si"><div class="field"><label for="si-name">' + t('account.name') + '</label><input class="text-in" id="si-name" autocomplete="username" maxlength="20" required></div>' +
      '<div class="field"><label for="si-pw">' + t('account.password') + '</label><input class="text-in" id="si-pw" type="password" autocomplete="current-password" required></div><p class="err" id="si-err"></p>' +
      '<div class="row"><button class="btn" type="button" data-close>' + t('common.cancel') + '</button><button class="btn primary">' + t('account.signIn') + '</button></div></form>');
    m.querySelector('#si').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await api('/api/login', { name: m.querySelector('#si-name').value.trim(), password: m.querySelector('#si-pw').value });
        setAccount({ token: res.token, name: res.user.name, guest: false });
        app.state.settings.name = res.user.name; app.save();
        m.close(); app.toast(t('account.welcomeBack', { name: app.esc(res.user.name) })); connect();
      } catch (err) { m.querySelector('#si-err').textContent = err.message; }
    };
  }
  function parentEmailModal() {
    const app = A();
    const m = app.modal('<h2>' + t('account.askAgain') + '</h2><form id="pe"><div class="field"><label for="pe-e">' + t('account.parentEmail') + '</label><input class="text-in" id="pe-e" type="email" autocomplete="off" required></div><p class="err" id="pe-err"></p>' +
      '<div class="row"><button class="btn" type="button" data-close>' + t('common.cancel') + '</button><button class="btn primary">' + t('account.send') + '</button></div></form>');
    m.querySelector('#pe').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/api/account/consent/resend', { parentEmail: m.querySelector('#pe-e').value.trim() }); m.close(); app.toast(t('account.sentCheck')); }
      catch (err) { m.querySelector('#pe-err').textContent = err.message; }
    };
  }

  function forgotModal(prefill) {
    const app = A();
    const m = app.modal('<h2>' + t('account.reset.title') + '</h2><p class="sub">' + t('account.reset.how') + '</p>' +
      '<form id="fp"><div class="field"><label for="fp-who">' + t('account.reset.who') + '</label><input class="text-in" id="fp-who" value="' + app.esc(prefill || '') + '" required></div>' +
      '<div class="row"><button class="btn" type="button" data-close>' + t('common.cancel') + '</button><button class="btn primary">' + t('account.reset.send') + '</button></div></form>');
    m.querySelector('#fp').onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await api('/api/account/forgot', { who: m.querySelector('#fp-who').value.trim() }); m.close(); app.toast(app.esc(r.message)); }
      catch (err) { app.toast(app.esc(err.message), 'bad'); }
    };
  }
  // The emailed reset link opens /play#reset=<token>.
  function resetModal(token) {
    const app = A();
    const m = app.modal('<h2>' + t('account.reset.new') + '</h2><form id="rp"><div class="field"><label for="rp-new">' + t('account.pw.new') + '</label><input class="text-in" id="rp-new" type="password" autocomplete="new-password" minlength="8" required></div><p class="err" id="rp-err"></p>' +
      '<div class="row"><button class="btn" type="button" data-close>' + t('common.cancel') + '</button><button class="btn primary">' + t('account.reset.go') + '</button></div></form>');
    m.querySelector('#rp').onsubmit = async (e) => {
      e.preventDefault();
      const pw = m.querySelector('#rp-new').value;
      try {
        const r = await api('/api/account/reset', { token, password: pw });
        const res = await api('/api/login', { name: r.name, password: pw });
        setAccount({ token: res.token, name: res.user.name, guest: false });
        app.state.settings.name = res.user.name; app.save();
        m.close(); app.toast(t('account.reset.done', { name: app.esc(res.user.name) })); connect();
      } catch (err) { m.querySelector('#rp-err').textContent = err.message; }
    };
  }

  function syncProgress() {
    clearTimeout(progressTimer);
    progressTimer = setTimeout(() => { if (A()) send({ type: 'progress', data: A().state.progress }); }, 1500);
  }

  window.ChacklateNet = {
    available: () => ready,
    safety: () => safety,
    api,
    resetModal,
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
