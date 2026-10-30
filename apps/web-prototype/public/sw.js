// Chackmate service worker: lets the installed app open offline and shows daily reminders.
// The game is one HTML file, so caching it (plus the icons) is enough to play offline.
// Pages load network-first, so a new release shows up on the next launch with a connection.
const CACHE = 'chacklate-v1';
const VOICE = 'chacklate-voice-v1';   // recorded voice clips, kept once heard so lessons talk offline too
const SHELL = ['/play', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== VOICE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  if (/^\/voice\/[a-z]+\/[0-9a-f]{8}\.mp3$/.test(url.pathname)) {
    e.respondWith(caches.open(VOICE).then((c) => c.match(url.pathname).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) c.put(url.pathname, res.clone());
      return res;
    }))));
    return;
  }
  // Guide lines and item pitches can be recorded again, so like the pages they load from the network first.
  if (!SHELL.includes(url.pathname) && url.pathname !== '/voice/index.json' && !/^\/(guide|pitch(\/site)?)\/[a-z0-9.-]+\.mp3$/.test(url.pathname)) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(url.pathname, copy)); }
    return res;
  }).catch(() => caches.match(url.pathname)));
});

self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Chackmate', {
    body: m.body || '', tag: m.tag || 'chacklate', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: m.url || '/play' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/play';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => new URL(c.url).pathname === '/play');
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
