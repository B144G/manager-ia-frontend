/* Service worker de MANAGER-IA : garde les fichiers du site (styles, scripts, images) pour un démarrage rapide et affiche une page claire
   quand il n'y a pas de connexion. Il ne garde JAMAIS de données de l'entreprise : aucune requête vers l'API n'est interceptée ni mise en cache. */
var CACHE = "mia-shell-v1";
var SHELL = ["offline.html", "assets/style.css", "assets/ws.css", "favicon.svg", "assets/icons/icon-192.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.indexOf("/api/") === 0 || url.pathname.indexOf("/admin") === 0) return; // données : toujours le réseau
  if (req.mode === "navigate") { e.respondWith(fetch(req).catch(function () { return caches.match("offline.html"); })); return; }
  if (/\.(css|js|png|svg|jpg|webp|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (r) { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
