// Service worker for Exsellsior. Caches the app shell so the app opens offline
// and the browser can offer the install prompt.
// When any shell file changes, raise CACHE so users get the new files.
const CACHE = "exsellsior-shell-v7";
const SHELL = [
  "./",
  "./index.html",
  "./version.js",
  "./manifest.webmanifest",
  "./logo.svg",
  "./icons/favicon.svg",
  "./icons/favicon-32x32.png",
  "./icons/favicon-16x16.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./fonts/inter-400.woff2",
  "./fonts/inter-500.woff2",
  "./fonts/inter-600.woff2",
  "./fonts/plus-jakarta-sans-600.woff2",
  "./fonts/plus-jakarta-sans-700.woff2"
];

self.addEventListener("install", event => {
  // addAll is all-or-nothing: one missing file stops the whole install
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Always try the network first for the latest-version file, so update checks stay accurate
  if (url.pathname.endsWith("/version.js")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request)));
    return;
  }

  const isPage = event.request.mode === "navigate";

  event.respondWith((async () => {
    // For page loads, ignore the query string so index.html?x=1 still matches the cached page
    const hit = await caches.match(event.request, { ignoreSearch: isPage });
    if (hit) return hit;

    try {
      const response = await fetch(event.request);
      // Only cache good, same-origin responses. Errors and redirects are never stored.
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
      }
      return response;
    } catch (error) {
      // Offline page load: fall back to the cached app
      if (isPage) {
        const shell = await caches.match("./index.html");
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
