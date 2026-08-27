const CACHE_NAME = "vehicle-scorecard-app-shell-v12-0";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./core.js",
  "./inspection.js",
  "./intelligence.js",
  "./ui.js",
  "./ui-base.js",
  "./guided-intake.js",
  "./guided-intake.css",
  "./navigation-v12.js",
  "./value-readiness.css",
  "./experience-v12.css",
  "./experience-v12b.js",
  "./logo-mark.svg",
  "./manifest.webmanifest",
  "./version.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

async function refreshCoreCache() {
  const cache = await caches.open(CACHE_NAME);
  for (const asset of CORE_ASSETS) {
    try {
      const response = await fetch(asset, { cache: "reload" });
      if (response.ok) await cache.put(asset, response.clone());
    } catch (error) {
      console.warn("Pre-cache skipped:", asset, error);
    }
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(refreshCoreCache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("vehicle-scorecard") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        throw new Error("Offline asset unavailable");
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
