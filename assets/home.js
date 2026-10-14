/* Page d'accueil : thème, menu mobile, apparition douce au défilement, formulaire de contact. */
(function () {
"use strict";
var root = document.documentElement;
var CFG = window.MI_CONFIG || {};

/* Thème clair / sombre (mémorisé si le navigateur le permet) */
try { var saved = localStorage.getItem("mi_theme"); if (saved) root.setAttribute("data-theme", saved); } catch (e) {}
function isDark() { var t = root.getAttribute("data-theme"); if (t) return t === "dark"; return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches; }
document.getElementById("theme").addEventListener("click", function () {
  var n = isDark() ? "light" : "dark";
  root.setAttribute("data-theme", n);
  try { localStorage.setItem("mi_theme", n); } catch (e) {}
});

/* Menu mobile */
var nav = document.getElementById("nav"), burger = document.getElementById("burger");
burger.addEventListener("click", function () {
  var open = nav.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
});
nav.addEventListener("click", function (e) { if (e.target.tagName === "A") { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); } });

/* Apparition douce */
if ("IntersectionObserver" in window && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
  root.classList.add("js-rv");
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });
  document.querySelectorAll(".rv").forEach(function (n) { io.observe(n); });
}

/* Formulaire de contact : enregistré par le serveur s'il est branché, sinon ouvre WhatsApp avec le message */
var form = document.getElementById("contactForm");
form.addEventListener("submit", function (e) {
  e.preventDefault();
  var name = document.getElementById("cName").value.trim(), contact = document.getElementById("cContact").value.trim(), msg = document.getElementById("cMsg").value.trim();
  var err = document.getElementById("cErr"); err.textContent = "";
  if (!name || !msg) { err.textContent = "Indiquez votre nom et votre message."; return; }
  if (typeof CFG.API_BASE !== "string") {
    window.open("https://wa.me/237653621388?text=" + encodeURIComponent("Bonjour MANAGER-IA, je suis " + name + (contact ? " (" + contact + ")" : "") + ". " + msg), "_blank", "noopener");
    return;
  }
  var b = document.getElementById("cSend"); b.disabled = true;
  fetch((CFG.API_BASE || "") + "/api/contact", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, contact: contact, what: "Contact depuis l'accueil", message: msg }) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Envoi impossible, réessayez."); }); })
    .then(function () { form.reset(); document.getElementById("cOk").hidden = false; })
    .catch(function (x) { err.textContent = x.message; })
    .then(function () { b.disabled = false; });
});
})();
