// Driver App service worker (DEC-15 baseline: installable web app). Scope: the /driver/ folder only.
// It keeps the app's own screens and static files available without a connection. It NEVER caches data or sign-in
// calls (Supabase, any other origin): trip data always comes from the server, and the trip actions waiting to be sent
// live in the page's own outbox (localStorage), not here.
const CACHE = "cl-driver-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./manifest.webmanifest", "./icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("cl-driver-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // Supabase and every other origin: network only
  if (req.mode === "navigate") {
    // the app page: network first, the cached copy when offline
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./"))),
    );
    return;
  }
  if (url.pathname.includes("/_next/static/") || url.pathname.includes("/driver/")) {
    // versioned static files: cache first
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
  }
});
