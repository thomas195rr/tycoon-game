/* Offline cache so the game opens from the home screen without a connection.
   Network first (updates arrive), cached copy when offline. Saves live in the browser (localStorage + IndexedDB), not here. */
const CACHE = 'tycoon-app';
const FILES = ['./', './index.html', './manifest.json', './css/style.css', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './js/core.js', './js/config.js', './js/config-businesses.js', './js/config-businesses2.js', './js/config-extras.js', './js/world.js', './js/pricing.js', './js/work.js',
  './js/property.js', './js/staff.js', './js/equipment.js', './js/finance.js', './js/business.js', './js/models.js', './js/models2.js', './js/managers.js',
  './js/realestate.js', './js/invest.js', './js/engine.js', './js/ui/ui-core.js', './js/ui/ui-home.js', './js/ui/ui-market.js', './js/ui/ui-biz.js',
  './js/ui/ui-models.js', './js/ui/ui-money.js', './js/ui/ui-misc.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match('./index.html'))));
});
