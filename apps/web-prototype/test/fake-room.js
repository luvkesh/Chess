// A stand-in for the published page's `room` capability, for tests: pages in one browser
// share a BroadcastChannel and see each other's presence, like viewers of one artifact.
// Loaded with page.addInitScript before the game.
(function () {
  const ch = new BroadcastChannel('chackmate-fake-room');
  const me = 'p' + Math.random().toString(36).slice(2, 10);
  const rooms = new Map();
  function makeRoom(name) {
    const r = { name, mine: {}, others: new Map(), fns: new Set(), conn: new Set(), left: false };
    const snapshot = () => Object.freeze([{ peer: me, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: r.mine, updatedAt: Date.now() },
      ...[...r.others].map(([peer, presence]) => ({ peer, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence, updatedAt: Date.now() }))]);
    const fire = () => setTimeout(() => { if (!r.left) for (const f of [...r.fns]) f({ peers: snapshot(), joined: [], left: [], updated: [] }); }, 0);
    r.fire = fire;
    const api = {
      name,
      presence(patch) {
        const n = Object.assign({}, r.mine);
        for (const [k, v] of Object.entries(patch)) { if (v === null) delete n[k]; else n[k] = JSON.parse(JSON.stringify(v)); }
        r.mine = Object.freeze(n);
        ch.postMessage({ t: 'state', room: name, peer: me, presence: r.mine });
        fire();
        return Promise.resolve();
      },
      peers: snapshot,
      onPeers(fn) { r.fns.add(fn); fire(); return () => r.fns.delete(fn); },
      connected: () => true,
      onConnection(fn) { setTimeout(() => fn(true), 0); return () => {}; },
      leave() { r.left = true; rooms.delete(name); ch.postMessage({ t: 'bye', room: name, peer: me }); return Promise.resolve(); },
      emit() { return Promise.resolve(); },
      on() { return () => {}; },
    };
    r.api = api;
    rooms.set(name, r);
    ch.postMessage({ t: 'hello', room: name, peer: me });
    return r;
  }
  ch.onmessage = (e) => {
    const m = e.data, r = rooms.get(m.room);
    if (!r || m.peer === me) return;
    if (m.t === 'hello') { ch.postMessage({ t: 'state', room: m.room, peer: me, presence: r.mine }); if (!r.others.has(m.peer)) { r.others.set(m.peer, {}); r.fire(); } }
    else if (m.t === 'state') { r.others.set(m.peer, m.presence); r.fire(); }
    else if (m.t === 'bye') { r.others.delete(m.peer); r.fire(); }
  };
  addEventListener('pagehide', () => { for (const name of rooms.keys()) ch.postMessage({ t: 'bye', room: name, peer: me }); });
  const lobby = makeRoom('lobby').api;
  lobby.join = (name) => Promise.resolve((rooms.get(name) || makeRoom(name)).api);
  window.claude = { use: (n) => Promise.resolve(n === 'room' ? lobby : null) };
  window.__fakePeer = me;
})();
