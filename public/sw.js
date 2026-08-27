// Simple service worker for PWA - cache static assets only, no offline for data
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());
self.addEventListener('fetch', (e) => {
  // Only cache GET for static assets, passthrough for API/auth
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  // Network first for pages
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
