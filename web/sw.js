// NickApp service worker: app shell cache-first, fonts stale-while-revalidate,
// API calls (POST to Apps Script) never touched. BUILD is stamped by the Pages
// workflow with the commit sha, so every deploy installs a fresh shell cache.
const BUILD = '__BUILD__';
const SHELL = `nickapp-shell-${BUILD}`;
const FONTS = 'nickapp-fonts-v1';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/api.js',
  './js/config.js',
  './js/dates.js',
  './js/db.js',
  './js/demo.js',
  './js/pacing.js',
  './js/photo.js',
  './js/sync.js',
  './js/ui.js',
  './js/screens/entry.js',
  './js/screens/history.js',
  './js/screens/home.js',
  './js/screens/settings.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Navigations carry ?u=…&env=…; every one is served the cached shell.
    const lookup = req.mode === 'navigate' ? caches.match('./index.html') : caches.match(req, { ignoreSearch: true });
    event.respondWith(lookup.then(hit => hit || fetch(req)));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then(async cache => {
        const hit = await cache.match(req);
        const network = fetch(req)
          .then(res => {
            if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
  }
});
