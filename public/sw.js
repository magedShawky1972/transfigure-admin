// Service Worker for Push Notifications and Version Management
const CACHE_NAME = 'edara-cache-v1.2.6';

self.addEventListener('install', function(event) {
  console.log('Service Worker installing, version:', CACHE_NAME);
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  // Clear all caches on install
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('Clearing cache on install:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker activating, version:', CACHE_NAME);
  event.waitUntil(
    Promise.all([
      // Take control of all clients immediately
      clients.claim(),
      // Clear all old caches
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ]).then(function() {
      // Notify all clients to reload
      return clients.matchAll({ type: 'window' }).then(function(clientList) {
        clientList.forEach(function(client) {
          client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_NAME });
        });
      });
    })
  );
});

// Listen for messages from the main app
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('Clearing all caches...');
    event.waitUntil(
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            return caches.delete(cacheName);
          })
        );
      }).then(function() {
        // Notify all clients to reload
        return clients.matchAll({ type: 'window' }).then(function(clientList) {
          clientList.forEach(function(client) {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        });
      })
    );
  }
});

self.addEventListener('push', function(event) {
  console.log('Push notification received:', event);
  
  if (!event.data) {
    console.log('No data in push event');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push data:', data);

    const title = data.title || 'Notification';
    const options = {
      body: data.body || '',
      icon: '/edara-logo-192.png',
      badge: '/edara-logo-192.png',
      data: data.data || {},
      tag: data.data?.tag || 'default',
      requireInteraction: true,
      vibrate: [200, 100, 200]
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('Error processing push notification:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
