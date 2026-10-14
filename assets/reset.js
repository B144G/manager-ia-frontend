/* Page « nouveau mot de passe » : le jeton vient du lien reçu (reinitialiser.html?t=...). */
(function () {
"use strict";
var CFG = window.MI_CONFIG || {}, $ = function (id) { return document.getElementById(id); };
var token = new URLSearchParams(location.search).get("t") || "";
try { var th = localStorage.getItem("mi_theme"); if (th) document.documentElement.setAttribute("data-theme", th); } catch (e) {}
if (typeof CFG.API_BASE !== "string" || !/^[a-f0-9]{64}$/.test(token)) { $("vForm").hidden = true; $("vOff").hidden = false; return; }
try { history.replaceState(null, "", location.pathname); } catch (e) {} // retire le jeton de la barre d'adresse
$("f").addEventListener("submit", function (e) {
  e.preventDefault();
  var err = $("err"), btn = $("go"), a = $("p1").value, b = $("p2").value;
  err.textContent = "";
  if (a.length < 6) { err.textContent = "Le mot de passe doit contenir au moins 6 caractères."; return; }
  if (a !== b) { err.textContent = "Les deux mots de passe ne sont pas identiques."; return; }
  btn.disabled = true;
  fetch((CFG.API_BASE || "") + "/api/password/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token, pass: a }) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Une erreur est survenue. Réessayez."); }); })
    .then(function () { $("vForm").hidden = true; $("vDone").hidden = false; })
    .catch(function (x) { err.textContent = x.message; btn.disabled = false; });
});
})();
