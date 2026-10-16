// Service worker Rukun (WebApp).
// - Aset statis Next.js dan ikon di-cache setelah dipakai (cache-first).
// - Halaman selalu diambil dari jaringan; bila offline, tampilkan /offline.
// - Data pengguna tidak pernah di-cache di sini.
const VERSION = "rukun-v2";
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/icon.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || /^\/(icon|apple-touch-icon)/.test(url.pathname)) {
    e.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
