const SHELL_CACHE = 'brds-v3-app-shell-1';
const CONTENT_CACHE = 'brds-v3-versioned-content-2';
const SHELL_URLS = ['/', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => (key.startsWith('brds-v3-app-shell-') && key !== SHELL_CACHE) || (key.startsWith('brds-v3-versioned-content-') && key !== CONTENT_CACHE))
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return;
  if (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // Refresh the offline entry point after a release, retaining hashed assets
        // used by existing offline attempts until a later explicit cleanup.
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put('/index.html', response.clone());
        }
        if (response.ok) return response;
        return (await caches.match('/index.html')) || response;
      } catch {
        return (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/content/')) {
    if (url.searchParams.has('h')) {
      event.respondWith((async () => {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CONTENT_CACHE);
          await cache.put(url.pathname, response.clone());
        }
        return response;
      })());
      return;
    }
    // Versioned paths are immutable; hash verification still occurs in the content repository.
    event.respondWith(caches.open(CONTENT_CACHE).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.open(SHELL_CACHE).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
  }
});
