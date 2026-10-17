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

function finishLogin(j) {
  var enroll = j.webauthn === "register";
  showPasskey(j.options, j.challengeId, enroll, "/api/webauthn/login/verify");
}

function enrollPasskey() {
  return rq("POST", "/api/webauthn/register/options").then(function (j) {
    showPasskey(j.options, j.challengeId, true, "/api/webauthn/register/verify");
  });
}

function showPasskey(options, challengeId, enroll, verifyPath) {
  var panel = $("vPasskey"), button = $("passkeyGo"), error = $("passkeyErr");
  $("vForm").hidden = true;
  if ($("vCode")) $("vCode").hidden = true;
  panel.hidden = false;
  button.disabled = false;
  button.onclick = function () {
    error.textContent = "";
    button.disabled = true;
    var proof;
    try { proof = enroll ? window.MIWebAuthn.register(options) : window.MIWebAuthn.authenticate(options); }
    catch (e) { error.textContent = e.message; button.disabled = false; return; }
    Promise.resolve(proof).then(function (response) {
      return rq("POST", verifyPath, { challengeId: challengeId, enroll: verifyPath === "/api/webauthn/login/verify" && enroll, response: response });
    }).then(function () { location.replace(DASHBOARD); }).catch(function (e) { error.textContent = e.message; button.disabled = false; });
  };
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
    .then(function (j) {
      if (j && j.verify) { btn.disabled = false; askCode(contact, j); return; }
      if (j && j.webauthn) return finishLogin(j);
      location.replace(DASHBOARD);
    })
    .catch(function (x) { err.textContent = x.message; btn.disabled = false; });
});

// Inscription : code e-mail valable 30 secondes, puis enregistrement de la clé d'accès.
var tick = null, pending = "", pendingLogin = false;
if (mode === "register") {
  rq("GET", "/api/register/info").then(function (j) {
    if (!j.emailReady) {
      var notice = $("signupNotice");
      notice.textContent = "L'inscription est temporairement indisponible : le serveur doit d'abord être configuré pour envoyer des e-mails (SMTP).";
      notice.hidden = false;
      $("go").disabled = true;
    }
  }).catch(function () {});
}
function askCode(contact, j) {
  pending = contact; pendingLogin = j.loginVerify === true; $("vForm").hidden = true; $("vCode").hidden = false;
  $("codeTo").textContent = j.contact || contact; $("code").value = ""; $("cerr").textContent = "";
  $("vCode").querySelector("h1").textContent = pendingLogin ? "Confirmez votre adresse e-mail" : "Vérifiez votre e-mail";
  $("cgo").textContent = pendingLogin ? "Continuer vers la clé biométrique" : "Valider et accéder à mon espace";
  countdown(j.expiresIn || 30, j.resendIn || 20); $("code").focus();
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
    (pendingLogin ? rq("POST", "/api/login/verify-email", { contact: pending, code: code }).then(finishLogin) : rq("POST", "/api/register/verify", { contact: pending, code: code }).then(function () { clearInterval(tick); return enrollPasskey(); }))
      .then(function () { clearInterval(tick); })
      .catch(function (x) { err.textContent = x.message; btn.disabled = false; });
  });
  $("resend").addEventListener("click", function () {
    $("cerr").textContent = "";
    rq("POST", "/api/register/resend", { contact: pending })
      .then(function (j) { countdown(j.expiresIn || 30, j.resendIn || 20); $("code").value = ""; $("code").focus(); })
      .catch(function (x) { $("cerr").textContent = x.message; });
  });
  $("cback").addEventListener("click", function (e) { e.preventDefault(); clearInterval(tick); $("vCode").hidden = true; $("vForm").hidden = false; });
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
