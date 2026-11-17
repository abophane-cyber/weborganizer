// Service worker : met l'application en cache pour un affichage hors connexion.
// Stratégie "réseau d'abord" : les mises à jour du site arrivent dès qu'on est en ligne.
const CACHE = 'weborganizer-v2';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/main.js', './js/app-config.js', './js/util.js', './js/db.js', './js/store.js',
  './js/media.js', './js/folder.js', './js/sync.js', './js/zip.js', './js/icons.js', './js/icon-library.js',
  './js/chrome-profiles.js', './js/board.js', './js/modal.js', './js/actions.js',
  './js/background.js', './js/transfer.js', './js/settings.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    // cache: 'no-cache' : revalide auprès du serveur (réponse 304 légère) pour que
    // les mises à jour publiées soient prises en compte immédiatement.
    fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
