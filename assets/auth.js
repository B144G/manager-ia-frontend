/* Pages de connexion et d'inscription : après l'identification, on arrive dans le tableau de bord (app.html). */
(function () {
"use strict";
var CFG = window.MI_CONFIG || {};
var DASHBOARD = "app.html";
var mode = document.body.getAttribute("data-mode");
var $ = function (id) { return document.getElementById(id); };

try { var th = localStorage.getItem("mi_theme"); if (th) document.documentElement.setAttribute("data-theme", th); } catch (e) {}

if (typeof CFG.API_BASE !== "string") { $("vForm").hidden = true; $("vOff").hidden = false; return; }

function rq(method, path, body) {
  return fetch((CFG.API_BASE || "") + path, { method: method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || "Une erreur est survenue. Réessayez."); e.status = r.status; throw e; } return j; }); });
}

$("eye").addEventListener("click", function () {
  var p = $("pass"), show = p.type === "password";
  p.type = show ? "text" : "password";
  this.textContent = show ? "Masquer" : "Afficher";
  this.setAttribute("aria-pressed", String(show));
  this.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
});

$("f").addEventListener("submit", function (e) {
  e.preventDefault();
  var err = $("err"), btn = $("go");
  err.textContent = "";
  var contact = $("contact").value.trim(), pass = $("pass").value, name = mode === "register" ? $("name").value.trim() : "";
  if ((mode === "register" && !name) || !contact || !pass) { err.textContent = mode === "register" ? "Remplissez tous les champs." : "Entrez votre e-mail ou téléphone et votre mot de passe."; return; }
  btn.disabled = true;
  rq("POST", mode === "register" ? "/api/register" : "/api/login", mode === "register" ? { name: name, contact: contact, pass: pass } : { contact: contact, pass: pass })
    .then(function (j) { if (j && j.verify) { btn.disabled = false; askCode(contact, j); } else location.replace(DASHBOARD); })
    .catch(function (x) { err.textContent = x.message; btn.disabled = false; });
});

// Inscription : étape du code reçu par e-mail (valable 1 minute).
var tick = null, pending = "";
function askCode(contact, j) {
  pending = contact; $("vForm").hidden = true; $("vCode").hidden = false;
  $("codeTo").textContent = j.contact || contact; $("code").value = ""; $("cerr").textContent = "";
  countdown(j.expiresIn || 60, j.resendIn || 20); $("code").focus();
}
function countdown(life, wait) {
  clearInterval(tick);
  var t0 = Date.now(), rs = $("resend");
  rs.disabled = true;
  function step() {
    var el = Math.floor((Date.now() - t0) / 1000), left = life - el;
    $("timer").textContent = left > 0 ? "Code valable encore " + left + " s" : "Code expiré : demandez-en un nouveau.";
    rs.disabled = el < wait;
    rs.textContent = el < wait ? "Renvoyer le code (" + (wait - el) + " s)" : "Renvoyer le code";
    if (left <= 0 && el >= wait) clearInterval(tick);
  }
  step(); tick = setInterval(step, 500);
}
if ($("fc")) {
  $("code").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 6); });
  $("fc").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("cerr"), btn = $("cgo"), code = $("code").value;
    err.textContent = "";
    if (code.length !== 6) { err.textContent = "Entrez le code à 6 chiffres."; return; }
    btn.disabled = true;
    rq("POST", "/api/register/verify", { contact: pending, code: code })
      .then(function () { clearInterval(tick); location.replace(DASHBOARD); })
      .catch(function (x) { err.textContent = x.message; btn.disabled = false; });
  });
  $("resend").addEventListener("click", function () {
    $("cerr").textContent = "";
    rq("POST", "/api/register/resend", { contact: pending })
      .then(function (j) { countdown(j.expiresIn || 60, j.resendIn || 20); $("code").value = ""; $("code").focus(); })
      .catch(function (x) { $("cerr").textContent = x.message; });
  });
  $("cback").addEventListener("click", function (e) { e.preventDefault(); clearInterval(tick); $("vCode").hidden = true; $("vForm").hidden = false; });
  // Si les e-mails sont actifs, le champ demande une adresse e-mail.
  rq("GET", "/api/register/info").then(function (j) { if (j.verify) { var l = $("contact").previousElementSibling; if (l) l.textContent = "Adresse e-mail"; $("contact").placeholder = "vous@exemple.com"; var s = document.querySelector(".au-sub"); if (s) s.textContent = "C'est gratuit. Un code de vérification vous est envoyé par e-mail."; } }).catch(function () {});
}

// Mot de passe oublié (page de connexion seulement)
if ($("forgotLink")) {
  var show = function (forgot) { $("vForm").hidden = forgot; $("vForgot").hidden = !forgot; if (forgot) $("fcontact").focus(); };
  $("forgotLink").addEventListener("click", function (e) { e.preventDefault(); show(true); });
  $("backLogin").addEventListener("click", function (e) { e.preventDefault(); show(false); });
  $("ff").addEventListener("submit", function (e) {
    e.preventDefault();
    var c = $("fcontact").value.trim(), err = $("ferr"), ok = $("fok"), btn = $("fgo");
    err.textContent = ""; ok.hidden = true;
    if (!c) { err.textContent = "Entrez votre e-mail ou votre téléphone."; return; }
    btn.disabled = true;
    rq("POST", "/api/password/forgot", { contact: c }).then(function (j) { ok.textContent = j.message; ok.hidden = false; }).catch(function (x) { err.textContent = x.message; }).then(function () { btn.disabled = false; });
  });
}

// Déjà connecté : direction le tableau de bord.
rq("GET", "/api/me").then(function () { if (!new URLSearchParams(location.search).get("stay")) location.replace(DASHBOARD); }).catch(function () {});
})();
