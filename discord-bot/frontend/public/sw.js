const CACHE_NAME = 'discord-saas-v1';
const ASSETS_TO_CACHE = ['/', '/dashboard/overview', '/dashboard/plugins'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Discord SaaS Alert', body: 'New notification received.' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=192&auto=format&fit=crop&q=80',
    })
  );
});
