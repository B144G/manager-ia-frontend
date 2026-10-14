/* Assistant IA intégré au site : bulle flottante, présente sur l'accueil et la page de connexion.
   Il appelle le serveur (/api/assistant) quand il est branché ; sinon il répond avec des repères simples et oriente vers WhatsApp. */
(function () {
"use strict";
var CFG = window.MI_CONFIG || {}, REMOTE = typeof CFG.API_BASE === "string";
var WA = "https://wa.me/237653621388";
var msgs = [], busy = false, built = false, box, log, input;

var FALLBACK = [
  [/prix|tarif|co[uû]t|abonnement|payer|paiement/, "Offres : Gratuit pour essayer, Pro à 50 000 FCFA par mois, Pro Max à 75 000 FCFA, Méga Pro à 100 000 FCFA et Illimité à 150 000 FCFA par mois. Paiement par MTN Mobile Money ou Orange Money."],
  [/compte|inscri|connexion|connecter|mot de passe|commencer/, "Cliquez sur « Commencer gratuitement » : vous arrivez sur la page de connexion. Si vous n'avez pas de compte, « Créer un compte » est sous le formulaire. Ensuite vous arrivez dans votre tableau de bord."],
  [/gestion|projet|budget|client|[eé]quipe|organisation|agent|fonction/, "L'agent IA de gestion d'activité contient : service client, projets et tâches, budget, organisation, fonctionnement, équipe et antennes. Il connaît vos données et vous conseille ; vous validez ses propositions."]
];
function fallback(q) {
  q = q.toLowerCase();
  for (var i = 0; i < FALLBACK.length; i++) if (FALLBACK[i][0].test(q)) return FALLBACK[i][1];
  return "Je n'ai pas la réponse à cette question pour l'instant. Écrivez à l'équipe sur WhatsApp : " + WA;
}

function el(tag, attrs, text) {
  var e = document.createElement(tag);
  for (var k in (attrs || {})) { if (k === "class") e.className = attrs[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
  if (text) e.textContent = text;
  return e;
}
function add(cls, text) { var m = el("div", { class: "m " + cls }, text); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }

function ask(q) {
  q = (q || input.value).trim();
  if (!q || busy) return;
  input.value = ""; add("u", q); msgs.push({ role: "user", content: q });
  busy = true;
  var wait = add("a", "…");
  var done = function (t) { wait.textContent = t; msgs.push({ role: "assistant", content: t }); busy = false; log.scrollTop = log.scrollHeight; };
  if (!REMOTE) return done(fallback(q));
  fetch((CFG.API_BASE || "") + "/api/assistant", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: msgs.slice(-12) }) })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "x"); return j; }); })
    .then(function (j) { done(j.text); })
    .catch(function () { done(fallback(q)); });
}

function build() {
  built = true;
  log = el("div", { id: "sa-log", "aria-live": "polite" });
  input = el("input", { type: "text", placeholder: "Posez votre question…", "aria-label": "Votre question", autocomplete: "off" });
  var chips = el("div", { id: "sa-chips" });
  ["Comment commencer ?", "Que fait l'agent IA ?", "Quels sont les prix ?"].forEach(function (t) { chips.appendChild(el("button", { type: "button", onclick: function () { ask(t); } }, t)); });
  var form = el("form", { onsubmit: function (e) { e.preventDefault(); ask(); } });
  form.appendChild(input); form.appendChild(el("button", { class: "btn primary small", type: "submit" }, "Envoyer"));
  var head = el("header");
  var title = el("div"); title.appendChild(el("b", {}, "Assistant MANAGER-IA")); title.appendChild(el("small", {}, "Je vous guide sur le site"));
  head.appendChild(title); head.appendChild(el("button", { class: "x", type: "button", "aria-label": "Fermer l'assistant", onclick: toggle }, "×"));
  box = el("div", { id: "sa", role: "dialog", "aria-label": "Assistant MANAGER-IA", hidden: "" });
  box.appendChild(head); box.appendChild(log); box.appendChild(chips); box.appendChild(form);
  document.body.appendChild(box);
  add("a", "Bonjour ! Je suis l'assistant de MANAGER-IA. Je peux vous expliquer le site, vous aider à créer votre compte et à prendre en main votre tableau de bord. Que voulez-vous savoir ?");
}
function toggle() {
  if (!built) build();
  box.hidden = !box.hidden;
  document.getElementById("sa-btn").setAttribute("aria-expanded", String(!box.hidden));
  if (!box.hidden) input.focus();
}
function init() {
  var b = el("button", { id: "sa-btn", type: "button", "aria-expanded": "false", onclick: toggle }, "Assistant IA");
  document.body.appendChild(b);
  var openers = document.querySelectorAll("[data-open-assistant]");
  for (var i = 0; i < openers.length; i++) openers[i].addEventListener("click", function () { if (!built || box.hidden) toggle(); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
