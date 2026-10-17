/* Agrandir un aperçu de l'application : clic, touche Entrée ou Espace sur l'image ; Échap ou clic à côté pour fermer. Sur téléphone, on peut faire défiler l'image agrandie. */
(function () {
"use strict";
var imgs = document.querySelectorAll(".hm-feat img");
if (!imgs.length) return;
var last = null;
function close(box) { box.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); if (last) last.focus(); }
var onKey = function () {};
function open(src, alt) {
  var box = document.createElement("div");
  box.className = "lb"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", alt);
  var btn = document.createElement("button"); btn.type = "button"; btn.className = "lb-x"; btn.setAttribute("aria-label", "Fermer l'aperçu"); btn.textContent = "×";
  var wrap = document.createElement("div"); wrap.className = "lb-scroll";
  var im = document.createElement("img"); im.src = src; im.alt = alt;
  wrap.appendChild(im); box.appendChild(btn); box.appendChild(wrap);
  box.addEventListener("click", function (e) { if (e.target === box || e.target === wrap) close(box); });
  btn.addEventListener("click", function () { close(box); });
  onKey = function (e) { if (e.key === "Escape") close(box); };
  document.addEventListener("keydown", onKey);
  document.body.appendChild(box); document.body.style.overflow = "hidden"; btn.focus();
}
imgs.forEach(function (im) {
  im.setAttribute("tabindex", "0"); im.setAttribute("role", "button"); im.style.cursor = "zoom-in";
  im.setAttribute("aria-label", "Agrandir l'aperçu : " + (im.getAttribute("alt") || ""));
  im.addEventListener("click", function () { last = im; open(im.currentSrc || im.src, im.getAttribute("alt") || ""); });
  im.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); last = im; open(im.currentSrc || im.src, im.getAttribute("alt") || ""); } });
});
})();
