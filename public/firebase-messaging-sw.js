importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Suppress verbose Workbox "broker" cache logs in production (FP ok, skipping etc.)
self.__WB_DISABLE_DEV_LOGS = true;

const CACHE_NAME = 'trentosmart-cache-v3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico'
];

const firebaseConfig = {
  apiKey: "AIzaSyCK0TPCAL3DCkZcbi5mm05Owu_wwr-Pnyo",
  authDomain: "transmart-c8c7b.firebaseapp.com",
  projectId: "transmart-c8c7b",
  storageBucket: "transmart-c8c7b.firebasestorage.app",
  messagingSenderId: "928911803916",
  appId: "1:928911803916:web:bd2f00673587c1c2039029",
  measurementId: "G-MZJ9HQCFDN"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Transmart';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Install: pre-cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: CRITICAL FIX
// Do NOT intercept:
//   1. Navigation requests (React Router pages like /register, /login, /driver)
//   2. Client-side routes (paths without extensions like /history, /passenger)
//   3. API calls (Railway/backend)
//   4. Cross-origin requests (Cloudinary, Firebase, Google)
// Only cache same-origin static assets.
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip navigation requests — let React Router handle them
    if (request.mode === 'navigate') return;

    // Skip client-side routes (paths without extensions, except root /)
    const path = url.pathname;
    if (path !== '/' && !path.includes('.')) return;

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip cross-origin requests (API, Cloudinary, Firebase CDN)
    if (url.origin !== self.location.origin) return;

    // Skip API calls
    if (url.pathname.startsWith('/api/')) return;

    // For same-origin static assets: network-first, fallback to cache
    event.respondWith(
        fetch(request)
            .then(response => {
                // Cache successful responses for static assets
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(async () => {
                const cachedResponse = await caches.match(request);
                return cachedResponse || new Response('Offline and not cached', { status: 503, statusText: 'Service Unavailable' });
            })
    );
});
