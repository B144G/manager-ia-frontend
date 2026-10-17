/* Noyau de l'espace de travail : appels serveur, connexion, choix de l'organisation, menu des sous-applications,
   panneau de l'IA et petits outils d'interface (fenêtres, formulaires, messages). Toute donnée affichée passe par
   textContent (jamais innerHTML) : un nom ou un message de client ne peut pas injecter de code. */
(function () {
"use strict";
var CFG = window.MI_CONFIG || {};
var REMOTE = typeof CFG.API_BASE === "string";
var S = { user: null, orgs: [], orgId: null, info: null, route: null };
var MODS = {};          // sous-applications enregistrées : { id, icon, render(root, ctx) }
var $app = document.getElementById("app");

/* ---------- Construire des éléments ---------- */
function h(tag, attrs) {
  var e = document.createElement(tag), val;
  for (var k in (attrs || {})) {
    var v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "value") val = v;
    else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  (function add(list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) add(c);
      else e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    }
  })(Array.prototype.slice.call(arguments, 2));
  if (val !== undefined) e.value = val;
  return e;
}
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

/* ---------- Serveur ---------- */
function rq(method, path, body) {
  return fetch((CFG.API_BASE || "") + path, { method: method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || "Une erreur est survenue. Réessayez."); e.status = r.status; throw e; }
        return j;
      });
    });
}
function api(method, path, body) { return rq(method, "/api/ws" + path, body); }
function oapi(method, path, body) { return api(method, "/orgs/" + S.orgId + path, body); }

/* ---------- Messages et fenêtres ---------- */
function toast(msg, bad) {
  var t = h("div", { class: "toast" + (bad ? " bad" : ""), text: msg });
  document.getElementById("toasts").appendChild(t);
  setTimeout(function () { t.remove(); }, bad ? 6000 : 3200);
}
function fail(e) { if (e && e.status === 401) { S.user = null; showAuth(); return; } toast((e && e.message) || "Erreur", true); }

function modal(title, build, opts) {
  var back = h("div", { class: "ws-modal", role: "dialog", "aria-modal": "true", "aria-label": title });
  var box = h("div", { class: "ws-box" + (opts && opts.wide ? " wide" : "") });
  function close() { if (!back.parentNode) return; back.remove(); document.removeEventListener("keydown", esc); if (opts && opts.onclose) opts.onclose(); }
  function esc(ev) { if (ev.key === "Escape") close(); }
  document.addEventListener("keydown", esc);
  back.addEventListener("mousedown", function (ev) { if (ev.target === back) close(); });
  box.appendChild(h("div", { class: "ws-box-h" }, h("h2", { text: title }), h("button", { class: "x", type: "button", "aria-label": "Fermer", onclick: close, text: "×" })));
  var body = h("div", { class: "ws-box-b" });
  box.appendChild(body);
  back.appendChild(box);
  document.body.appendChild(back);
  build(body, close);
  var first = body.querySelector("input,textarea,select");
  if (first) first.focus();
  return close;
}

/* Petit formulaire : fields = [{k, label, type, options, value, hint, required}] */
function form(fields, submitText, onSubmit, extra) {
  var els = {};
  var f = h("form", { class: "ws-form", novalidate: true });
  fields.forEach(function (d) {
    var el;
    if (d.type === "select") el = h("select", { id: "f_" + d.k }, (d.options || []).map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
    else if (d.type === "textarea") el = h("textarea", { id: "f_" + d.k, rows: d.rows || 4, placeholder: d.placeholder || "" });
    else el = h("input", { id: "f_" + d.k, type: d.type || "text", placeholder: d.placeholder || "", autocomplete: "off" });
    if (d.value !== undefined && d.value !== null) el.value = d.value;
    els[d.k] = el;
    f.appendChild(h("label", { class: "fld", for: "f_" + d.k }, h("span", { text: d.label }), el, d.hint ? h("small", { text: d.hint }) : null));
  });
  var err = h("p", { class: "ws-err", role: "alert" });
  var btn = h("button", { class: "btn primary", type: "submit", text: submitText });
  f.appendChild(err);
  f.appendChild(h("div", { class: "row" }, btn, extra || null));
  f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var vals = {};
    for (var k in els) vals[k] = els[k].value;
    err.textContent = "";
    for (var i = 0; i < fields.length; i++) if (fields[i].required && !String(vals[fields[i].k]).trim()) { err.textContent = "Remplissez : " + fields[i].label.toLowerCase() + "."; return; }
    btn.disabled = true;
    Promise.resolve(onSubmit(vals)).catch(function (e) { err.textContent = e.message || "Erreur"; if (e.status === 401) fail(e); }).then(function () { btn.disabled = false; });
  });
  return f;
}

function confirmBox(text, onYes, yesText) {
  modal("Confirmer", function (b, close) {
    b.appendChild(h("p", { text: text }));
    b.appendChild(h("div", { class: "row", style: "margin-top:16px" },
      h("button", { class: "btn primary", type: "button", text: yesText || "Oui, continuer", onclick: function () { close(); onYes(); } }),
      h("button", { class: "btn", type: "button", text: "Annuler", onclick: close })));
  });
}

/* ---------- Outils d'affichage ---------- */
function money(n) { return Number(n || 0).toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0") + "\u00a0" + (S.info ? S.info.org.currency : "FCFA"); } /* espace insécable classique : toutes les polices la savent afficher */
function dateFr(d) { if (!d) return ""; var p = String(d).slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : d; }
function today() { return new Date().toISOString().slice(0, 10); }
var RANK = { member: 1, manager: 2, admin: 3, owner: 4 };
function can(min) { return S.info && RANK[S.info.me.role] >= RANK[min]; }
function memberName(id, list) { for (var i = 0; i < (list || []).length; i++) if (list[i].userId === id) return list[i].name; return ""; }
function empty(text) { return h("p", { class: "ws-empty", text: text }); }
function loading() { return h("p", { class: "ws-empty", text: "Chargement…" }); }
function copy(text, label) {
  var done = function () { toast(label || "Copié."); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copiez :", text); });
  else window.prompt("Copiez :", text);
}

var ICONS = {
  dashboard: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
  support: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  projects: "M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h9",
  budget: "M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2",
  stock: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  crm: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  hr: "M3 5h18v14H3zM8 11a2 2 0 100-4 2 2 0 000 4zM5 16a3 3 0 016 0M14 9h5M14 13h4",
  sales: "M4 5h16v11H9l-5 4zM9 9l2 2 4-4",
  structure: "M12 3v5M5 14v-3h14v3M5 14v4M12 14v4M19 14v4M9 3h6v5H9zM2 18h6v3H2zM9 18h6v3H9zM16 18h6v3h-6z",
  processes: "M4 6h16M4 12h10M4 18h7M17 15l2 2 3-4",
  team: "M16 11a4 4 0 10-8 0M4 21a8 8 0 0116 0M20 8a3 3 0 010 6",
  out: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  alerts: "M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 004 0",
  ai: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"
};
function icon(k) {
  var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true");
  var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", ICONS[k] || ICONS.dashboard); s.appendChild(p);
  return s;
}

/* ---------- Connexion : page dédiée (connexion.html), qui nous ramène ici après l'identification ---------- */
function screen(inner) { clear($app); $app.appendChild(h("div", { class: "ws-center" }, h("a", { class: "logo", href: "index.html" }, "MANAGER", h("b", { text: "-IA" })), inner)); }
function showAuth() { location.replace("connexion.html"); }

/* ---------- Choix / création d'organisation ---------- */
function showOnboarding(joinCode) {
  var card = h("div", { class: "ws-card" });
  card.appendChild(h("h1", { text: "Bienvenue" + (S.user ? ", " + S.user.name.split(" ")[0] : "") }));
  card.appendChild(h("p", { class: "muted", text: "Créez votre organisation (entreprise, boutique, association, équipe…) ou rejoignez celle d'un collègue avec un code d'invitation." }));
  var cols = h("div", { class: "ws-cols" });
  var create = h("div", { class: "ws-sub" }, h("h2", { text: "Créer mon organisation" }), form([
    { k: "name", label: "Nom", required: true, placeholder: "Boutique Awa" },
    { k: "sector", label: "Secteur d'activité", placeholder: "Commerce, restauration, services…" },
    { k: "description", label: "Décrivez votre activité", type: "textarea", rows: 3, hint: "L'IA s'en sert pour mieux vous conseiller." },
    { k: "currency", label: "Monnaie", value: "FCFA" }
  ], "Créer", function (v) {
    return api("POST", "/orgs", v).then(function (j) { S.orgId = j.id; location.hash = "#/" + j.id + "/dashboard"; return boot(); });
  }));
  var join = h("div", { class: "ws-sub" }, h("h2", { text: "Rejoindre avec un code" }), form([{ k: "code", label: "Code d'invitation", required: true, value: joinCode || "" }], "Rejoindre", function (v) {
    return api("POST", "/orgs/join", v).then(function (j) { S.orgId = j.id; location.hash = "#/" + j.id + "/dashboard"; return boot(); });
  }));
  cols.appendChild(create); cols.appendChild(join);
  card.appendChild(cols);
  card.appendChild(h("p", { class: "small" }, h("button", { class: "link", type: "button", text: "Me déconnecter", onclick: logout })));
  screen(card);
}

function logout() { rq("POST", "/api/logout").catch(function () {}).then(function () { location.href = "index.html"; }); }

/* ---------- Coque de l'application ---------- */
var aiOpen = false;

function parseHash() {
  var m = /^#\/(\d+)(?:\/([a-z]+))?/.exec(location.hash || "");
  return m ? { org: Number(m[1]), mod: m[2] || "dashboard" } : null;
}

function boot() {
  var jm = /^#join=([A-Za-z0-9]+)/.exec(location.hash || "");
  return api("GET", "/orgs").then(function (j) {
    S.orgs = j.orgs;
    var r = parseHash();
    if (jm) { location.hash = ""; return showOnboarding(jm[1]); }
    if (!S.orgs.length) return showOnboarding();
    var pick = (r && S.orgs.filter(function (o) { return o.id === r.org; })[0]) || S.orgs.filter(function (o) { return o.id === S.orgId; })[0] || S.orgs[0];
    return loadOrg(pick.id, r && r.org === pick.id ? r.mod : "dashboard");
  }).catch(fail);
}

function loadOrg(id, mod) {
  return api("GET", "/orgs/" + id).then(function (info) {
    S.orgId = id; S.info = info;
    location.hash = "#/" + id + "/" + mod;
    drawShell();
  }).catch(fail);
}

function titleOf(m) { return m.title; }

function firstName() { return S.user ? S.user.name.split(" ")[0] : ""; }
function initials(n) { return (n || "?").split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(""); }

function drawShell() {
  clear($app);
  var cur = (parseHash() || {}).mod || "dashboard";
  var mods = S.info.modules.filter(function (m) { return MODS[m.id]; });
  if (!mods.some(function (m) { return m.id === cur; })) cur = "dashboard";
  S.route = cur;

  var orgSel = h("select", { class: "org-sel", "aria-label": "Organisation", onchange: function (ev) { var v = ev.target.value; if (v === "new") { ev.target.value = S.orgId; showOnboarding(); } else loadOrg(Number(v), "dashboard"); } },
    S.orgs.map(function (o) { return h("option", { value: o.id, text: o.name }); }), h("option", { value: "new", text: "+ Nouvelle organisation / rejoindre" }));
  orgSel.value = S.orgId;

  function link(m) {
    var badge = h("span", { class: "nbadge", hidden: true, "data-badge": m.id });
    return h("a", { href: "#/" + S.orgId + "/" + m.id, class: m.id === cur ? "on" : "", "aria-current": m.id === cur ? "page" : null }, icon(MODS[m.id].icon || m.id), h("span", { class: "nl", text: titleOf(m) }), badge);
  }
  var main = mods.filter(function (m) { return m.id !== "alerts"; }), alertMod = mods.filter(function (m) { return m.id === "alerts"; });
  var nav = h("nav", { class: "ws-nav", "aria-label": "Sous-applications" }, main.map(link), alertMod.length ? [h("hr"), alertMod.map(link)] : null);

  var side = h("aside", { class: "ws-side" },
    h("a", { class: "logo", href: "index.html" }, "MANAGER", h("b", { text: "-IA" })),
    h("div", { class: "ws-org" }, h("span", { class: "av", text: initials(S.info.org.name) }), h("div", {}, orgSel, h("small", { text: (S.info.org.sector ? S.info.org.sector + " · " : "") + S.info.limits.membersUsed + " personne" + (S.info.limits.membersUsed > 1 ? "s" : "") }))),
    h("div", { class: "ws-label", text: "MON ESPACE" }), nav,
    h("div", { class: "ws-me" }, h("span", { class: "av gold", text: initials(S.user && S.user.name) }), h("div", {}, h("b", { text: S.user ? S.user.name : "" }), h("small", { text: S.info.me.roleLabel })),
      h("button", { type: "button", class: "out", title: "Me déconnecter", "aria-label": "Me déconnecter", onclick: logout }, icon("out"))));

  var askIn = h("input", { type: "text", placeholder: window.innerWidth < 640 ? "Demandez à MANAGER-IA…" : "Demandez à MANAGER-IA : « Quels sont les problèmes urgents aujourd'hui ? »", "aria-label": "Demandez à MANAGER-IA", autocomplete: "off" });
  var ask = h("form", { class: "ws-ask", onsubmit: function (ev) { ev.preventDefault(); var q = askIn.value.trim(); if (q) { askIn.value = ""; askAI(q); } } }, icon("ai"), askIn);
  var bell = h("a", { class: "bell", href: "#/" + S.orgId + "/alerts", "aria-label": "Alertes" }, icon("alerts"), h("i", { class: "dot", hidden: true, "data-badge": "bell" }));
  var top = h("header", { class: "ws-top2" }, ask, h("span", { class: "grow" }), bell,
    h("div", { class: "ws-user" }, h("span", { class: "av", text: initials(S.user && S.user.name) }), h("div", {}, h("b", { text: S.user ? S.user.name : "" }), h("small", { text: S.info.me.roleLabel }))));

  var mainEl = h("main", { class: "ws-main", id: "ws-main" });
  var ai = h("div", { class: "ws-ai", id: "ws-ai", hidden: !aiOpen });
  var fab = h("button", { class: "ws-fab", type: "button", id: "aiBtn", onclick: function () { toggleAI(); } }, icon("ai"), h("span", { text: "Assistant IA" }));
  var shell = h("div", { class: "ws-shell" }, side, h("div", { class: "ws-col" }, top, mainEl), ai, fab);
  $app.appendChild(shell); S.shell = shell; fit();
  S.main = mainEl;
  renderModule(cur);
  if (aiOpen) drawAI();
  refreshBadges();
  var onLink = shell.querySelector(".ws-nav a.on");
  if (onLink && window.innerWidth < 640 && onLink.scrollIntoView) onLink.scrollIntoView({ inline: "center", block: "nearest" });
}

/* Mise en page : la structure de la maquette (menu, barre du haut, blocs) est gardée identique sur les écrans de 640 à 1400 px
   de large : elle est simplement réduite pour tenir. Sous 640 px, une version pour téléphone prend le relais. */
function fit() {
  var w = window.innerWidth, z = w >= 640 && w < 1400 ? w / 1400 : 1;
  document.documentElement.style.setProperty("--z", String(z));
  if (S.shell) S.shell.style.zoom = z === 1 ? "" : String(z);
}
window.addEventListener("resize", fit);

/** Pastilles du menu (demandes clients, alertes) : une seule requête légère. */
function refreshBadges() {
  oapi("GET", "/dashboard").then(function (j) {
    S.dash = j;
    var set = function (k, n) { document.querySelectorAll('[data-badge="' + k + '"]').forEach(function (e) { e.hidden = !n; if (e.tagName !== "I") e.textContent = String(n); }); };
    set("support", j.stats.tickets.open); set("alerts", j.alerts.filter(function (a) { return a.level !== "info"; }).length); set("bell", j.alerts.filter(function (a) { return a.level === "high"; }).length);
  }).catch(function () {});
}

function renderModule(id) {
  clear(S.main);
  var m = MODS[id];
  var root = h("div", { class: "ws-mod" });
  S.main.appendChild(root);
  S.main.scrollTop = 0; window.scrollTo(0, 0);
  S.refresh = function () { renderModule(id); };
  try { m.render(root, ctx); } catch (e) { root.appendChild(empty("Cette partie n'a pas pu s'afficher : " + e.message)); }
  if (aiOpen) drawAI();
}

window.addEventListener("hashchange", function () {
  var r = parseHash();
  if (!S.user || !r) return;
  if (r.org !== S.orgId) return loadOrg(r.org, r.mod);
  if (r.mod !== S.route && S.info) drawShell();
});

/* ---------- Panneau de l'IA ---------- */
var SUGGEST = {
  general: ["Fais le point sur mon organisation", "Que dois-je faire en premier aujourd'hui ?", "Où perds-je du temps ou de l'argent ?"],
  dashboard: ["Fais le point sur mon organisation", "Que dois-je faire en premier aujourd'hui ?"],
  support: ["Quelles demandes traiter en premier ?", "Quels problèmes reviennent chez les clients ?", "Comment répondre plus vite ?"],
  projects: ["Quelles tâches sont en retard et que faire ?", "Comment répartir le travail dans l'équipe ?"],
  budget: ["Où partent mes dépenses ?", "Quelles limites mensuelles me conseilles-tu ?"],
  stock: ["Quels articles risquent la rupture ?", "Quelles commandes passer en premier ?", "Quel fournisseur choisir ?"],
  crm: ["Quelles factures relancer en premier ?", "Qui sont mes meilleurs clients ?", "Comment encaisser plus vite ?"],
  hr: ["Qui est absent cette semaine ?", "Comment organiser le planning ?", "Dois-je accepter cette demande de congé ?"],
  sales: ["Quelle campagne marche le mieux ?", "Que dois-je faire des prospects non convertis ?", "Que manque-t-il à mon catalogue ?"],
  structure: ["Quels postes me manquent ?", "Y a-t-il des zones floues dans mon organisation ?"],
  processes: ["Quelles procédures devrais-je écrire en premier ?", "Comment rendre mon équipe autonome ?"],
  team: ["Comment organiser mes antennes ?", "Quels rôles donner à chacun ?"]
};
function aiModule() { return S.route && S.route !== "dashboard" ? S.route : "general"; }
var pendingAsk = null;
function askAI(text) { pendingAsk = text; aiOpen = true; document.body.classList.add("ai-open"); var p = document.getElementById("ws-ai"); if (p) p.hidden = false; drawAI(); }
function toggleAI() { aiOpen = !aiOpen; var p = document.getElementById("ws-ai"); if (p) p.hidden = !aiOpen; document.body.classList.toggle("ai-open", aiOpen); if (aiOpen) drawAI(); }

/* Dictée vocale (navigateurs qui la proposent : Chrome, Edge, Safari récents) : la parole est transformée en texte dans le champ. */
function dictate(target, btn) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  if (btn._r) { btn._r.stop(); return; }
  var r = new SR(); r.lang = "fr-FR"; r.interimResults = false; btn._r = r; btn.textContent = "Écoute… (toucher pour arrêter)";
  r.onresult = function (e) { var t = ""; for (var i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; target.value = (target.value + " " + t).trim(); };
  r.onend = r.onerror = function () { btn._r = null; btn.textContent = "Parler"; target.focus(); };
  r.start();
}

function drawAI() {
  var p = document.getElementById("ws-ai");
  if (!p) return;
  document.body.classList.add("ai-open");
  p.hidden = false;
  clear(p);
  var mod = aiModule();
  var def = S.info.modules.filter(function (m) { return m.id === mod; })[0];
  var log = h("div", { class: "ai-log", "aria-live": "polite" });
  var info = h("p", { class: "ai-info" });
  var input = h("textarea", { rows: 2, placeholder: "Posez votre question ou demandez de l'aide…", "aria-label": "Message pour l'IA" });
  var send = h("button", { class: "btn primary small", type: "button", text: "Envoyer" });
  var busy = false;

  function bubble(role, text) { var b = h("div", { class: "bub " + role, text: text }); log.appendChild(b); log.scrollTop = log.scrollHeight; return b; }
  function go(text) {
    text = (text || input.value).trim();
    if (!text || busy) return;
    busy = true; send.disabled = true; input.value = "";
    bubble("user", text);
    var wait = bubble("assistant wait", "L'IA réfléchit…");
    oapi("POST", "/ai/chat", { module: mod, message: text }).then(function (j) {
      wait.className = "bub assistant"; wait.textContent = j.text; info.textContent = j.remaining + " message(s) IA restant(s) avant le renouvellement";
    }).catch(function (e) { wait.className = "bub assistant err"; wait.textContent = e.message; if (e.status === 401) fail(e); })
      .then(function () { busy = false; send.disabled = false; log.scrollTop = log.scrollHeight; });
  }
  send.onclick = function () { go(); };
  input.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); go(); } });

  p.appendChild(h("div", { class: "ai-h" },
    h("div", {}, h("b", { text: "Assistant IA" }), h("small", { text: mod === "general" ? "Toute l'organisation" : "Module : " + (def ? def.title : mod) })),
    h("button", { class: "x", type: "button", "aria-label": "Fermer l'assistant", text: "×", onclick: toggleAI })));
  p.appendChild(log);
  p.appendChild(h("div", { class: "ai-chips" }, (SUGGEST[mod] || SUGGEST.general).map(function (t) { return h("button", { type: "button", class: "chip", text: t, onclick: function () { go(t); } }); })));
  var micBtn = (window.SpeechRecognition || window.webkitSpeechRecognition) ? h("button", { class: "btn small", type: "button", text: "Parler", title: "Dicter votre message à la voix", onclick: function () { dictate(input, micBtn); } }) : null;
  p.appendChild(h("div", { class: "ai-in" }, input, h("div", { class: "row" }, send, micBtn,
    h("button", { class: "btn small", type: "button", text: "Effacer", onclick: function () { oapi("DELETE", "/ai/history?module=" + mod).then(function () { clear(log); bubble("assistant", "Discussion effacée."); }).catch(fail); } })), info));

  oapi("GET", "/ai/history?module=" + mod).then(function (j) {
    if (pendingAsk) { var q = pendingAsk; pendingAsk = null; setTimeout(function () { go(q); }, 0); }
    if (!j.enabled) bubble("assistant err", "L'IA n'est pas encore activée sur ce serveur (clé manquante). Le reste de l'application fonctionne.");
    else if (!j.messages.length) bubble("assistant", "Bonjour ! Je connais votre organisation. Demandez-moi un point de situation, de l'aide pour répondre à un client, planifier un projet, ou analyser votre budget.");
    j.messages.forEach(function (m) { bubble(m.role, m.content); });
    info.textContent = j.remaining + " message(s) IA restant(s) avant le renouvellement";
  }).catch(function (e) { bubble("assistant err", e.message); });
}

/* Proposition de l'IA validée par la personne : l'IA ne modifie jamais rien toute seule. */
function propose(kind, input, o) {
  modal(o.title, function (b, close) {
    var box = h("div", {}, loading());
    b.appendChild(box);
    oapi("POST", "/ai/propose", { kind: kind, input: input }).then(function (j) {
      clear(box);
      box.appendChild(h("p", { class: "muted small", text: "Proposition de l'IA. Relisez-la : rien n'est enregistré tant que vous n'avez pas validé." }));
      var view = h("div", { class: "ws-prop" });
      box.appendChild(view);
      o.render(j.proposal, view);
      var row = h("div", { class: "row", style: "margin-top:16px" });
      if (o.apply !== false) row.appendChild(h("button", { class: "btn primary", type: "button", text: o.applyText || "Appliquer", onclick: function (ev) {
        ev.target.disabled = true;
        oapi("POST", "/ai/apply", { kind: kind, proposal: j.proposal }).then(function (r) { close(); toast("C'est fait."); if (o.done) o.done(r); }).catch(function (e) { ev.target.disabled = false; fail(e); });
      } }));
      row.appendChild(h("button", { class: "btn", type: "button", text: o.apply === false ? "Fermer" : "Annuler", onclick: close }));
      box.appendChild(row);
      if (o.after) o.after(j.proposal, close);
    }).catch(function (e) { clear(box); box.appendChild(h("p", { class: "ws-err", text: e.message })); box.appendChild(h("button", { class: "btn", type: "button", text: "Fermer", onclick: close })); });
  }, { wide: true });
}

/* ---------- Démarrage ---------- */
var ctx = { S: S, h: h, clear: clear, api: api, oapi: oapi, toast: toast, fail: fail, modal: modal, form: form, confirm: confirmBox, money: money, dateFr: dateFr, today: today, can: can, empty: empty, loading: loading, icon: icon, copy: copy, propose: propose, memberName: memberName, refresh: function () { S.refresh && S.refresh(); }, askAI: askAI, openAI: function () { if (!aiOpen) toggleAI(); else drawAI(); }, reloadOrg: function () { return loadOrg(S.orgId, S.route); }, rq: rq, refreshBadges: refreshBadges, firstName: firstName, initials: initials };

window.WS = {
  register: function (def) { MODS[def.id] = def; },
  start: function () {
    if (!REMOTE) {
      return screen(h("div", { class: "ws-card narrow" }, h("h1", { text: "Serveur non branché" }),
        h("p", { text: "L'espace de travail a besoin du serveur MANAGER-IA (comptes, données, IA). Ouvrez config.js et réglez API_BASE : \"\" si le site est servi par le serveur, ou l'adresse du serveur sinon. Voir le README." }),
        h("a", { class: "btn", href: "index.html", text: "Retour au site" })));
    }
    rq("GET", "/api/me").then(function (j) { S.user = j.user; boot(); }, function () { showAuth(); });
  }
};
})();
