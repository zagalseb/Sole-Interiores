const CACHE_NAME = 'sole-crm-v2';
const ASSETS = [
  '/Sole-Interiores/',
  '/Sole-Interiores/index.html',
  '/Sole-Interiores/css/style.css',
  '/Sole-Interiores/js/supabase.js',
  '/Sole-Interiores/js/app.js',
  '/Sole-Interiores/js/router.js',
  '/Sole-Interiores/js/ui.js',
  '/Sole-Interiores/pages/dashboard.js',
  '/Sole-Interiores/pages/clientes.js',
  '/Sole-Interiores/pages/proveedores.js',
  '/Sole-Interiores/pages/proyectos.js',
  '/Sole-Interiores/manifest.json',
  '/Sole-Interiores/icons/icon-192.png',
  '/Sole-Interiores/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
