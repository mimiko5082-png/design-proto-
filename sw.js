importScripts("./notification-push.js");
const CACHE_NAME = "basho-manazashi-v45-without-notebook";
const APP_SHELL = [
  "./",
  "./index.html",
  "./basho-styles.css",
  "./basho-app.js",
  "./perspective.js",
  "./place.js",
  "./tanka-catalog.js",
  "./reading-store.js",
  "./reading-garden.js",
  "./haiku-catalog.js",
  "./haiku-store.js",
  "./haiku-service.js",
  "./haiku-cards.js",
  "./photo-sharing.js",
  "./observation-timer.js",
  "./image-config.js",
  "./image-tools.js",
  "./image-service.js",
  "./image-validation.js",
  "./notification-config.js",
  "./notification-settings.js",
  "./notification-service.js",
  "./notification-push.js",
  "./perspective-config.js",
  "./firebase-config.js",
  "./manifest.webmanifest",
  "./assets/kotoba-mist.png",
  "./assets/kotoba-forest.png",
  "./assets/kotoba-lake.png",
  "./assets/kotoba-sunset.png",
  "./assets/kotoba-icon-192.png",
  "./assets/kotoba-icon-512.png",
  "./assets/apple-touch-icon.png"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))));
});

