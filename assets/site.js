/* Page de présentation : thème, menu, apparition douce, histoire au défilement, glissière, onglets, vidéo, agrandissement, formulaire de contact. */
(function () {
"use strict";
var root = document.documentElement, CFG = window.MI_CONFIG || {};
var $ = function (id) { return document.getElementById(id); };
var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Thème clair / sombre (mémorisé si possible) */
try { var saved = localStorage.getItem("mi_theme"); if (saved) root.setAttribute("data-theme", saved); } catch (e) {}
function isDark() { var t = root.getAttribute("data-theme"); if (t) return t === "dark"; return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); }
$("theme").addEventListener("click", function () { var n = isDark() ? "light" : "dark"; root.setAttribute("data-theme", n); try { localStorage.setItem("mi_theme", n); } catch (e) {} });

/* Menu mobile + ombre de la barre */
var nav = $("nav"), burger = $("burger"), bar = document.querySelector(".s-nav");
burger.addEventListener("click", function () { var o = nav.classList.toggle("open"); burger.setAttribute("aria-expanded", String(o)); });
nav.addEventListener("click", function (e) { if (e.target.tagName === "A") { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); } });
function onScroll() { bar.classList.toggle("stuck", window.scrollY > 8); }
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

/* Apparition douce */
if ("IntersectionObserver" in window && !reduce) {
  root.classList.add("js");
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".rv").forEach(function (n) { io.observe(n); });
}

/* Histoire : l'aperçu change quand l'étape visible change (écran large) */
var steps = document.querySelectorAll(".s-step"), frames = document.querySelectorAll(".s-frame img");
function setStep(i) {
  steps.forEach(function (s, k) { s.classList.toggle("on", k === i); });
  frames.forEach(function (f, k) { f.classList.toggle("on", k === i); });
}
if (steps.length && "IntersectionObserver" in window) {
  setStep(0);
  var so = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) setStep(Number(e.target.getAttribute("data-i"))); }); }, { rootMargin: "-42% 0px -42% 0px", threshold: 0 });
  steps.forEach(function (s) { so.observe(s); });
} else { steps.forEach(function (s) { s.classList.add("on"); }); }

/* Glissière horizontale : flèches, glisser à la souris, points */
var rail = $("rail"), prev = $("prev"), next = $("next"), dots = $("dots");
if (rail) {
  var slides = rail.querySelectorAll(".s-slide");
  slides.forEach(function () { dots.appendChild(document.createElement("i")); });
  var step = function () { var s = slides[0]; return s ? s.getBoundingClientRect().width + 20 : 400; };
  function upd() {
    var max = rail.scrollWidth - rail.clientWidth - 2;
    prev.disabled = rail.scrollLeft <= 2; next.disabled = rail.scrollLeft >= max;
    var idx = Math.round(rail.scrollLeft / step()); var d = dots.children;
    for (var i = 0; i < d.length; i++) d[i].className = i === idx ? "on" : "";
  }
  prev.addEventListener("click", function () { rail.scrollBy({ left: -step(), behavior: reduce ? "auto" : "smooth" }); });
  next.addEventListener("click", function () { rail.scrollBy({ left: step(), behavior: reduce ? "auto" : "smooth" }); });
  rail.addEventListener("scroll", function () { window.requestAnimationFrame(upd); }, { passive: true });
  rail.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") { e.preventDefault(); next.click(); } if (e.key === "ArrowLeft") { e.preventDefault(); prev.click(); } });
  var down = false, sx = 0, sl = 0, moved = false;
  rail.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; });
  window.addEventListener("pointermove", function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; rail.classList.add("drag"); } rail.scrollLeft = sl - dx; });
  window.addEventListener("pointerup", function () { if (down) { down = false; rail.classList.remove("drag"); } });
  rail.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  window.addEventListener("resize", upd); upd();
}

/* Onglets « pour qui » (clavier : flèches) */
var tabs = Array.prototype.slice.call(document.querySelectorAll(".s-tab")), panels = Array.prototype.slice.call(document.querySelectorAll(".s-panel"));
function pick(i, focus) {
  tabs.forEach(function (t, k) { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
  panels.forEach(function (p, k) { p.classList.toggle("on", k === i); p.hidden = k !== i; });
  if (focus) tabs[i].focus();
}
tabs.forEach(function (t, i) {
  t.addEventListener("click", function () { pick(i); });
  t.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); pick((i + 1) % tabs.length, true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); pick((i + tabs.length - 1) % tabs.length, true); }
  });
});

/* Fenêtres : vidéo et aperçu agrandi */
var lastFocus = null, onKey = null;
function openModal(content) {
  lastFocus = document.activeElement;
  var m = document.createElement("div"); m.className = "s-modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
  var box = document.createElement("div"); box.className = "box";
  var x = document.createElement("button"); x.type = "button"; x.className = "x"; x.setAttribute("aria-label", "Fermer"); x.textContent = "×";
  box.appendChild(x); box.appendChild(content); m.appendChild(box); document.body.appendChild(m); document.body.style.overflow = "hidden";
  function close() { var v = m.querySelector("video"); if (v) v.pause(); m.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  x.addEventListener("click", close);
  m.addEventListener("click", function (e) { if (e.target === m) close(); });
  onKey = function (e) { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey); x.focus();
  return m;
}
$("playBtn").addEventListener("click", function () {
  var v = document.createElement("video"); v.controls = true; v.autoplay = true; v.playsInline = true; v.poster = "video/poster.jpg"; v.setAttribute("aria-label", "Vidéo de présentation de MANAGER-IA");
  var s = document.createElement("source"); s.src = "video/manager-ia.mp4"; s.type = "video/mp4"; v.appendChild(s);
  openModal(v);
});
function zoom(img) {
  var wrap = document.createElement("div"); wrap.className = "s-zoom";
  var im = document.createElement("img"); im.src = img.currentSrc || img.src; im.alt = img.getAttribute("alt") || "";
  wrap.appendChild(im); openModal(wrap);
}
document.querySelectorAll(".s-slide .th").forEach(function (t) { t.setAttribute("data-zoom", ""); });
document.querySelectorAll("[data-zoom]").forEach(function (el) {
  el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
  var im = el.querySelector("img"); el.setAttribute("aria-label", "Agrandir l'aperçu : " + (im ? im.getAttribute("alt") || "" : ""));
  el.addEventListener("click", function () { if (im) zoom(im); });
  el.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && im) { e.preventDefault(); zoom(im); } });
});

/* Formulaire de contact : enregistré par le serveur s'il est branché, sinon ouvre WhatsApp avec le message */
var form = $("contactForm");
form.addEventListener("submit", function (e) {
  e.preventDefault();
  var name = $("cName").value.trim(), contact = $("cContact").value.trim(), msg = $("cMsg").value.trim(), err = $("cErr");
  err.textContent = "";
  if (!name || !msg) { err.textContent = "Indiquez votre nom et votre message."; return; }
  if (typeof CFG.API_BASE !== "string") {
    window.open("https://wa.me/237653621388?text=" + encodeURIComponent("Bonjour MANAGER-IA, je suis " + name + (contact ? " (" + contact + ")" : "") + ". " + msg), "_blank", "noopener");
    return;
  }
  var b = $("cSend"); b.disabled = true;
  fetch((CFG.API_BASE || "") + "/api/contact", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, contact: contact, what: "Contact depuis l'accueil", message: msg }) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Envoi impossible, réessayez."); }); })
    .then(function () { form.reset(); $("cOk").hidden = false; })
    .catch(function (x) { err.textContent = x.message; })
    .then(function () { b.disabled = false; });
});
})();
