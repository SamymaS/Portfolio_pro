/* ================================================================
   sw.js — Service Worker (PWA)
   Stratégie : network-first pour la navigation (HTML toujours frais),
   cache-first pour les assets statiques (perf + offline).
   ================================================================ */
const VERSION = 'v14';
const CACHE = 'sb-portfolio-' + VERSION;

// Ressources de base pré-cachées à l'installation
const PRECACHE = [
  '/',
  '/index.html',
  '/site.css',
  '/site.js',
  '/avatar.js',
  '/vendor/three-r186b.min.js',
  '/assets/mougi/skin.png',
  '/assets/mougi/icon-96.png',
  '/vendor/gsap.min.js',
  '/vendor/ScrollTrigger.min.js',
  '/vendor/lenis.min.js',
  '/achievements.css',
  '/achievements.js',
  '/games/core.js',
  '/fonts/tiny5.woff2',
  '/fonts/jetbrains-mono.woff2',
  '/fonts/geist.woff2',
  '/manifest.webmanifest',
  '/404.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {}) // ne bloque pas l'install si une ressource échoue
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Ne gère que les GET same-origin (laisse passer CDN, EmailJS, fonts…)
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigation / documents HTML : network-first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Assets statiques : cache-first, avec mise à jour en arrière-plan
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
