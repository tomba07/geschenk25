const CACHE_NAME = 'geschenk-pwa-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icon.png',
  '/favicons/icon-512x512.png',
  '/favicons/android-icon-192x192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith('geschenk-pwa-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  // Refresh stable URLs online; retain the last successful copy for offline use.
  // Hashed build assets use the browser's HTTP cache instead.
  if (!APP_SHELL.includes(url.pathname)) return;

  const response = fetch(request, { cache: 'no-cache' });
  event.waitUntil(response.then(async (result) => {
    if (result.ok) {
      const copy = result.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, copy);
    }
  }).catch(() => {}));
  event.respondWith(response.catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(request)) || Response.error();
  }));
});

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Geschenk',
    body: 'You have a new update.',
    url: '/',
  };

  const data = event.data ? event.data.json() : fallback;
  const title = data.title || fallback.title;
  const options = {
    body: data.body || fallback.body,
    icon: '/favicons/android-icon-192x192.png',
    badge: '/favicons/favicon-96x96.png',
    data: {
      url: data.url || fallback.url,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url === targetUrl) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
