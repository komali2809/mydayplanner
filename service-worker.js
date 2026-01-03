const CACHE = 'dayplanner-cache-v1';
const ASSETS = [
  '/', '/index.html', '/dashboard.html', '/home.html', '/recycle.html',
  '/settings.html', '/todo.html', '/style.css', '/script.js',
  '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});

// Optional: receive message to show a system notification
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, tag } = event.data.payload || {};
    self.registration.showNotification(title || 'Reminder', {
      body: body || '',
      icon: '/icon-192.png',
      tag: tag || 'dp-reminder',
      data: { url: url || '/' }
    });
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});
