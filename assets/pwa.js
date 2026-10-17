/* Installation sur téléphone / ordinateur (PWA) : enregistre le service worker et propose le bouton « Installer l'application ». */
(function () {
"use strict";
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
}
var deferred = null;
function dismissed() { try { return localStorage.getItem("mi_pwa_no") === "1"; } catch (e) { return false; } }
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault(); deferred = e;
  if (dismissed() || document.getElementById("pwa-install")) return;
  var b = document.createElement("div"); b.id = "pwa-install"; b.setAttribute("role", "region"); b.setAttribute("aria-label", "Installer l'application");
  b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:60;background:#0b1322;color:#fff;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.35);max-width:460px;margin:0 auto";
  var t = document.createElement("span"); t.style.flex = "1"; t.textContent = "Installez MANAGER-IA sur votre écran d'accueil pour y accéder en un clic.";
  var yes = document.createElement("button"); yes.type = "button"; yes.className = "btn primary small"; yes.textContent = "Installer";
  var no = document.createElement("button"); no.type = "button"; no.className = "btn small"; no.textContent = "Plus tard";
  yes.addEventListener("click", function () { b.remove(); deferred.prompt(); deferred = null; });
  no.addEventListener("click", function () { b.remove(); try { localStorage.setItem("mi_pwa_no", "1"); } catch (e) {} });
  b.appendChild(t); b.appendChild(yes); b.appendChild(no); document.body.appendChild(b);
});
})();
