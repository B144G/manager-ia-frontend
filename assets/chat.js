/* Page publique « discuter avec nous » : l'assistant commercial d'une organisation parle au prospect (texte ou voix).
   Lien à partager dans une publicité : chat.html?o=<jeton>&c=<nom de la campagne>. DOM construit sans innerHTML. */
(function () {
  "use strict";
  var P = new URLSearchParams(location.search), token = P.get("o") || "", campaign = (P.get("c") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  var CFG = window.MI_CONFIG || {}, BASE = typeof CFG.API_BASE === "string" ? CFG.API_BASE : null;
  var $ = function (id) { return document.getElementById(id); };
  var log = $("log"), form = $("form"), msg = $("msg"), send = $("send"), mic = $("mic"), off = $("off");
  var key = "mi_chat_" + token, session = "", busy = false, voiceOn = false;
  try { session = localStorage.getItem(key) || ""; } catch (e) { session = ""; }

  function bubble(cls, text) { var d = document.createElement("div"); d.className = "b " + cls; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function stop(text) { off.textContent = text; off.hidden = false; form.hidden = true; $("note").hidden = true; }
  function api(path, body) {
    return fetch(BASE + "/api/ws/public/chat/" + encodeURIComponent(token) + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || "Une erreur est survenue. Réessayez."); e.status = r.status; throw e; } return j; }); });
  }

  if (BASE === null || !token) { stop("Ce lien n'est pas valide ou le service n'est pas encore branché."); return; }
  api("/info").then(function (i) {
    $("org").textContent = i.name; $("av").textContent = (i.name || "?").trim().charAt(0).toUpperCase(); document.title = "Discuter avec " + i.name;
    if (!i.enabled) { stop("Ce service n'est pas disponible pour le moment. Merci de contacter directement l'entreprise."); return; }
    bubble("bot", i.welcome); voiceOn = Boolean(i.voice); initMic(); msg.focus();
  }).catch(function (e) { stop(e.message || "Service indisponible."); });

  function reply(j) {
    if (j.sessionId) { session = j.sessionId; try { localStorage.setItem(key, session); } catch (e) { /* ignoré */ } }
    bubble("bot", j.reply);
    if (j.order) { var o = document.createElement("div"); o.className = "order"; o.textContent = "Commande " + j.order.number + " enregistrée"; log.appendChild(o); }
    log.scrollTop = log.scrollHeight;
  }
  function run(promise, wait) {
    busy = true; send.disabled = true;
    promise.then(function (j) { wait.remove(); reply(j); }).catch(function (e) { wait.className = "b bot err"; wait.textContent = e.message; })
      .then(function () { busy = false; send.disabled = false; msg.focus(); });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var t = msg.value.trim();
    if (!t || busy) return;
    msg.value = ""; msg.style.height = "auto";
    bubble("me", t);
    run(api("/message", { sessionId: session, message: t, campaign: campaign }), bubble("bot wait", "…"));
  });
  msg.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); form.requestSubmit(); } });
  msg.addEventListener("input", function () { msg.style.height = "auto"; msg.style.height = Math.min(msg.scrollHeight, 120) + "px"; });

  /* ---------- Voix : enregistrement envoyé au serveur (transcrit en texte), sinon dictée du navigateur ---------- */
  function initMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var canRecord = voiceOn && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder;
    if (!canRecord && !SR) return;
    mic.hidden = false;
    if (canRecord) recorder(); else dictation(SR);
  }
  function recorder() {
    var rec = null, chunks = [], timer = null;
    mic.addEventListener("click", function () {
      if (busy) return;
      if (rec && rec.state === "recording") { rec.stop(); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        chunks = []; rec = new MediaRecorder(stream);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          clearTimeout(timer); mic.classList.remove("rec"); stream.getTracks().forEach(function (t) { t.stop(); });
          var blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          if (blob.size < 800) { bubble("bot err", "Je n'ai rien entendu. Appuyez sur le micro et parlez un peu plus longtemps."); return; }
          var me = bubble("me voice", "Message vocal…"), wait = bubble("bot wait", "…");
          var fr = new FileReader();
          fr.onload = function () {
            busy = true; send.disabled = true;
            api("/voice", { sessionId: session, campaign: campaign, audio: String(fr.result).split(",")[1] || "" })
              .then(function (j) { me.textContent = "🎤 " + (j.transcript || "Message vocal"); wait.remove(); reply(j); })
              .catch(function (e) { me.remove(); wait.className = "b bot err"; wait.textContent = e.message; })
              .then(function () { busy = false; send.disabled = false; });
          };
          fr.readAsDataURL(blob);
        };
        rec.start(); mic.classList.add("rec"); timer = setTimeout(function () { if (rec.state === "recording") rec.stop(); }, 60000);
      }).catch(function () { bubble("bot err", "Le micro n'est pas autorisé. Autorisez-le dans votre navigateur, ou écrivez votre message."); });
    });
  }
  function dictation(SR) {
    var r = null;
    mic.addEventListener("click", function () {
      if (r) { r.stop(); return; }
      r = new SR(); r.lang = "fr-FR"; r.interimResults = false;
      r.onresult = function (e) { var t = ""; for (var i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; msg.value = (msg.value + " " + t).trim(); msg.dispatchEvent(new Event("input")); };
      r.onend = function () { r = null; mic.classList.remove("rec"); msg.focus(); };
      r.onerror = function () { r = null; mic.classList.remove("rec"); };
      mic.classList.add("rec"); r.start();
    });
  }
})();
