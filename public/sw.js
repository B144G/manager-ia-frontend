/* Service worker de MANAGER-IA : garde les fichiers du site (styles, scripts, images) pour un démarrage rapide et affiche une page claire
   quand il n'y a pas de connexion. Il ne garde JAMAIS de données de l'entreprise : aucune requête vers l'API n'est interceptée ni mise en cache.
   Règles de sécurité : il ne doit jamais empêcher le site de s'ouvrir.
   - pages : RÉSEAU D'ABORD (toujours la version la plus récente) ; la page « hors connexion » n'apparaît que si le réseau est réellement coupé ;
   - fichiers (scripts, styles, images) : réseau d'abord avec cache de secours (jamais l'inverse : un vieux fichier en cache ne bloque pas une mise à jour) ;
   - toute erreur du cache est ignorée : en cas de doute, on laisse le navigateur faire sa requête normale ;
   - changer CACHE_VERSION supprime les anciens caches à l'activation. */
var CACHE_VERSION = 3;
var CACHE = "mia-shell-v" + CACHE_VERSION;
var SHELL = ["/offline.html", "/favicon.svg", "/assets/icons/icon-192.png"];

self.addEventListener("install", function (e) {
  // si le cache est inutilisable (stockage plein, mode privé), l'installation continue quand même
  e.waitUntil(
    (self.caches ? caches.open(CACHE).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }) : Promise.resolve())
      .catch(function () {}).then(function () { return self.skipWaiting(); })
  );
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    (self.caches ? caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf("mia-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); }) : Promise.resolve())
      .catch(function () {}).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener("message", function (e) { if (e.data === "skipWaiting") self.skipWaiting(); });

function offlinePage() {
  return caches.match("/offline.html").then(function (r) { return r || new Response("<meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><p style='font:16px system-ui;padding:24px'>Pas de connexion. Vérifiez votre Internet puis rechargez la page.</p>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }); });
}
self.addEventListener("fetch", function (e) {
  var req = e.request, url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.indexOf("/api/") === 0 || url.pathname.indexOf("/webhooks") === 0) return; // données : toujours le réseau
  if (req.mode === "navigate") { e.respondWith(fetch(req).catch(function () { return offlinePage(); })); return; }
  if (/\.(css|js|png|svg|jpg|jpeg|webp|woff2?)$/.test(url.pathname) && url.pathname !== "/sw.js") {
    e.respondWith(
      fetch(req).then(function (r) {
        if (r && r.ok && r.type === "basic") { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {}); }
        return r;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || Response.error(); });
      })
    );
  }
});
