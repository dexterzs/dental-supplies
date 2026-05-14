const CACHE_NAME = 'dental-supplies-v6';

// Build cache URLs relative to the SW scope (works on GitHub Pages and any subdirectory)
function getScope() {
  return self.registration.scope || self.location.href.replace(/\/sw\.js.*$/, '/');
}

function getAssetURLs() {
  const scope = getScope();
  return [
    scope,
    scope + 'index.html',
    scope + 'lib/react.production.min.js',
    scope + 'lib/react-dom.production.min.js',
    scope + 'lib/babel.min.js',
    scope + 'lib/tailwindcss.js',
  ];
}

// Listen for skip-waiting message from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install: pre-cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        getAssetURLs().map((url) =>
          cache.add(url).catch((err) => {
            console.warn('SW: failed to cache', url, err.message);
          })
        )
      );
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML (always fresh), cache-first for libs (rarely change)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isPage = url.pathname.endsWith('/') || url.pathname.endsWith('.html');

  if (isPage) {
    // Network-first for pages: always try to get latest, fall back to cache
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for lib files (JS libraries never change)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
