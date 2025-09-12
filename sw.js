const CACHE_NAME = 'mock-test-pro-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const RUNTIME_CACHE = 'runtime-v1.0.0';

// Essential files that must be cached
const ESSENTIAL_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Optional files - won't fail if they don't exist
const OPTIONAL_CACHE = [
  '/icon-72x72.png',
  '/icon-96x96.png',
  '/icon-128x128.png',
  '/icon-144x144.png',
  '/icon-152x152.png',
  '/icon-192x192.png',
  '/icon-384x384.png',
  '/icon-512x512.png',
  '/icon-1024x1024.png'
];

// Install event - cache resources with proper error handling
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache essential files
      caches.open(STATIC_CACHE)
        .then(cache => {
          console.log('[SW] Caching essential files');
          return cache.addAll(ESSENTIAL_CACHE);
        }),
      
      // Cache optional files (don't fail if missing)
      caches.open(STATIC_CACHE)
        .then(cache => {
          console.log('[SW] Caching optional files');
          return Promise.allSettled(
            OPTIONAL_CACHE.map(url => 
              cache.add(url).catch(error => {
                console.warn(`[SW] Failed to cache ${url}:`, error);
                return null;
              })
            )
          );
        })
    ])
    .then(() => {
      console.log('[SW] All files cached successfully');
      self.skipWaiting();
    })
    .catch(error => {
      console.error('[SW] Failed to cache essential files:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  const cacheWhitelist = [STATIC_CACHE, RUNTIME_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event with improved strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests except for known CDNs
  if (!url.origin === location.origin && !isTrustedOrigin(url.origin)) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different request types
  if (request.destination === 'document') {
    // HTML pages - cache first, then network
    event.respondWith(handleDocumentRequest(request));
  } else if (request.destination === 'script' || request.destination === 'style') {
    // JS/CSS - cache first
    event.respondWith(handleStaticAssetRequest(request));
  } else if (request.destination === 'image') {
    // Images - cache first
    event.respondWith(handleImageRequest(request));
  } else {
    // Other requests - network first
    event.respondWith(handleOtherRequest(request));
  }
});

// Handle document (HTML) requests
async function handleDocumentRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving HTML from cache:', request.url);
      return cachedResponse;
    }

    // Try network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Document request failed:', error);
    
    // Return cached index.html as fallback
    const cache = await caches.open(STATIC_CACHE);
    const fallback = await cache.match('/index.html');
    return fallback || new Response('Offline', { status: 503 });
  }
}

// Handle static assets (JS/CSS)
async function handleStaticAssetRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Static asset request failed:', error);
    throw error;
  }
}

// Handle image requests
async function handleImageRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Image request failed:', error);
    // Return placeholder or throw error
    throw error;
  }
}

// Handle other requests (API, etc.)
async function handleOtherRequest(request) {
  try {
    // Try network first for API requests
    const networkResponse = await fetch(request);
    
    // Cache successful GET responses
    if (networkResponse.status === 200 && request.method === 'GET') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network request failed:', error);
    
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache as fallback:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// Helper function to check trusted origins
function isTrustedOrigin(origin) {
  const trustedOrigins = [
    'https://www.gstatic.com',
    'https://firebase.googleapis.com',
    'https://firestore.googleapis.com'
  ];
  return trustedOrigins.includes(origin);
}

// Background sync for saving test data
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'save-test-data') {
    event.waitUntil(syncTestData());
  }
  
  if (event.tag === 'submit-quiz') {
    event.waitUntil(syncQuizSubmission());
  }
});

// Push notification handler
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  let notificationData = {
    title: 'Mock Test Pro',
    body: 'You have a new notification!',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'open-app',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Open app or focus existing tab
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise, open new tab
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Message handler for communication with main app
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (event.data && event.data.type === 'CACHE_QUIZ_DATA') {
    cacheQuizData(event.data.payload);
  }
});

// Cache quiz data for offline use
async function cacheQuizData(quizData) {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put('/quiz-data', new Response(JSON.stringify(quizData)));
    console.log('[SW] Quiz data cached for offline use');
  } catch (error) {
    console.error('[SW] Failed to cache quiz data:', error);
  }
}

// Helper function to sync test data
async function syncTestData() {
  try {
    console.log('[SW] Syncing test data...');
    
    // Get offline stored data
    const offlineData = await getOfflineData('test-results');
    
    if (offlineData.length > 0) {
      // Send to server/Firebase
      for (const data of offlineData) {
        await sendToServer(data);
      }
      
      // Clear offline storage after successful sync
      await clearOfflineData('test-results');
      console.log('[SW] Test data sync completed');
    }
  } catch (error) {
    console.error('[SW] Test data sync failed:', error);
    throw error;
  }
}

// Helper function to sync quiz submissions
async function syncQuizSubmission() {
  try {
    console.log('[SW] Syncing quiz submissions...');
    
    const submissions = await getOfflineData('quiz-submissions');
    
    for (const submission of submissions) {
      await sendToServer(submission);
    }
    
    await clearOfflineData('quiz-submissions');
    console.log('[SW] Quiz submissions sync completed');
  } catch (error) {
    console.error('[SW] Quiz submission sync failed:', error);
    throw error;
  }
}

// Helper functions for offline data management
async function getOfflineData(key) {
  return JSON.parse(localStorage.getItem(key) || '[]');
}

async function clearOfflineData(key) {
  localStorage.removeItem(key);
}

async function sendToServer(data) {
  // Implement your server/Firebase sending logic here
  console.log('[SW] Sending data to server:', data);
  // This would be your actual API call
  return Promise.resolve();
}

console.log('[SW] Service Worker loaded successfully');