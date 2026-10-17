(function () {
  var token = new URLSearchParams(location.search).get("o") || "";
  var cfg = window.MI_CONFIG || {}, f = document.getElementById("f"), err = document.getElementById("err");
  if (typeof cfg.API_BASE !== "string") err.textContent = "Ce formulaire n'est pas encore branché au serveur.";
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    err.textContent = "";
    var v = function (id) { return document.getElementById(id).value.trim(); };
    if (!v("name") || !v("message")) { err.textContent = "Indiquez votre nom et votre message."; return; }
    var b = document.getElementById("go"); b.disabled = true;
    fetch((cfg.API_BASE || "") + "/api/ws/public/intake/" + encodeURIComponent(token), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: v("name"), contact: v("contact"), subject: v("subject"), message: v("message") }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Envoi impossible, réessayez."); }); })
      .then(function () { f.hidden = true; document.getElementById("ok").hidden = false; })
      .catch(function (e) { err.textContent = e.message; b.disabled = false; });
  });
})();
