const CACHE_NAME = "gachihaeu-pwa-v2";
const OFFLINE_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

function readBuildAssetUrls(html) {
  const urls = new Set();
  const pattern = /["'](\/assets\/[^"'<>\s]+)["']/g;
  for (const match of html.matchAll(pattern)) urls.add(match[1]);
  return [...urls];
}

async function warmBuildAssets(response) {
  if (!response.ok) return;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return;

  const urls = readBuildAssetUrls(await response.text());
  if (urls.length === 0) return;
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(urls.map((url) => cache.add(url)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)),
      fetch("/", { cache: "no-store" })
        .then((response) => warmBuildAssets(response))
        .catch(() => undefined),
    ]),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    const network = fetch(request);
    event.waitUntil(
      network
        .then((response) => warmBuildAssets(response.clone()))
        .catch(() => undefined),
    );
    event.respondWith(
      network.catch(() => caches.match("/offline.html")),
    );
    return;
  }

  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
        return cached || network;
      }),
    );
  }
});
