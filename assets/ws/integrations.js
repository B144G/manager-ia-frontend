/* Sous-application : Intégrations (clés d'API et webhooks) pour relier MANAGER-IA à Zapier, Make, n8n ou votre site. Administrateurs. */
WS.register({ id: "integrations", icon: "processes", render: function (root, c) {
  var h = c.h, body = h("div", {});
  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Intégrations" }), h("p", { class: "muted", text: "Reliez MANAGER-IA à vos autres outils : Zapier, Make, n8n, votre site web…" }))));
  root.appendChild(body);
  var base = (window.MI_CONFIG && typeof MI_CONFIG.API_BASE === "string" && MI_CONFIG.API_BASE ? MI_CONFIG.API_BASE : location.origin);

  function load() { c.clear(body); body.appendChild(c.loading()); c.oapi("GET", "/integrations").then(show).catch(c.fail); }
  function fr(i) { return i ? c.dateFr(String(i).slice(0, 10)) : "jamais"; }
  function secretModal(title, intro, value) {
    c.modal(title, function (b) {
      b.appendChild(h("p", { text: intro }));
      b.appendChild(h("input", { type: "text", readonly: true, value: value, "aria-label": title, onfocus: function (e) { e.target.select(); } }));
      b.appendChild(h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn primary small", type: "button", text: "Copier", onclick: function () { c.copy(value, "Copié."); } })));
    });
  }

  function show(d) {
    c.clear(body);
    var kc = h("div", { class: "ws-card" }, h("h2", { text: "Clés d'API" }),
      h("p", { class: "muted small", text: "Une clé permet à un outil externe de lire (et, si vous l'autorisez, d'ajouter) des clients dans votre organisation. Ne la partagez avec personne ; supprimez-la si vous la perdez." }));
    if (!d.keys.length) kc.appendChild(c.empty("Aucune clé."));
    d.keys.forEach(function (k) {
      kc.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: k.name }), h("small", { text: " " + k.prefix + "… · " + (k.scope === "write" ? "lecture et écriture" : "lecture seule") + " · utilisée : " + fr(k.lastUsed) })),
        h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer la clé « " + k.name + " » ? Les outils qui l'utilisent cesseront de fonctionner.", function () { c.oapi("DELETE", "/integrations/keys/" + k.id).then(load).catch(c.fail); }); } })));
    });
    kc.appendChild(h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn small", type: "button", text: "Créer une clé", onclick: function () {
      c.modal("Nouvelle clé d'API", function (b, close) {
        b.appendChild(c.form([{ k: "name", label: "Nom (ex. Zapier)", required: true }, { k: "scope", label: "Droits", type: "select", options: [["read", "Lecture seule"], ["write", "Lecture et écriture (ajouter des clients)"]] }], "Créer", function (v) {
          return c.oapi("POST", "/integrations/keys", v).then(function (r) { close(); load(); secretModal("Votre clé d'API", r.note, r.key); });
        }));
      });
    } })));
    body.appendChild(kc);

    var wc = h("div", { class: "ws-card" }, h("h2", { text: "Webhooks (MANAGER-IA vous prévient)" }),
      h("p", { class: "muted small", text: "Quand un événement arrive, MANAGER-IA envoie un message à l'adresse que vous indiquez. Avec Zapier ou Make, choisissez le déclencheur « Webhook » (Catch Hook) et collez son adresse ici." }));
    if (!d.webhooks.length) wc.appendChild(c.empty("Aucun webhook."));
    d.webhooks.forEach(function (w) {
      wc.appendChild(h("div", { class: "line", style: "display:block" },
        h("div", { class: "row" }, h("b", { text: w.url.replace(/^(https?:\/\/[^\/]+).*$/, "$1/…") }), h("span", { class: "pill " + (w.active ? "good" : "bad"), text: w.active ? "Actif" : "Désactivé" }), h("span", { class: "grow" }),
          h("button", { class: "link", type: "button", text: "Tester", onclick: function () { c.oapi("POST", "/integrations/webhooks/" + w.id + "/test", {}).then(function (r) { c.toast(r.ok ? "Test reçu (réponse " + r.status + ")." : "Échec : " + r.status, !r.ok); load(); }).catch(c.fail); } }),
          !w.active ? h("button", { class: "link", type: "button", text: "Réactiver", onclick: function () { c.oapi("PUT", "/integrations/webhooks/" + w.id, { active: true }).then(load).catch(c.fail); } }) : null,
          h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer ce webhook ?", function () { c.oapi("DELETE", "/integrations/webhooks/" + w.id).then(load).catch(c.fail); }); } })),
        h("small", { class: "muted", text: w.events.map(function (e) { return d.events[e] || e; }).join(" · ") + (w.lastStatus ? " · dernier envoi : " + w.lastStatus : "") })));
    });
    wc.appendChild(h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn small", type: "button", text: "Ajouter un webhook", onclick: addHook.bind(null, d) })));
    body.appendChild(wc);

    body.appendChild(h("div", { class: "ws-card" }, h("h2", { text: "Pour les développeurs" }),
      h("p", { class: "muted small", text: "API à utiliser avec une clé : GET /api/v1/customers, POST /api/v1/customers (nom + téléphone ou e-mail), GET /api/v1/orders, GET /api/v1/invoices?status=sent. 120 requêtes par minute et par clé. Chaque webhook est signé : vérifiez l'en-tête X-MIA-Signature (HMAC-SHA256 du corps avec votre secret)." }),
      h("input", { type: "text", readonly: true, "aria-label": "Exemple", value: "curl -H \"Authorization: Bearer mia_…\" " + base + "/api/v1/customers", onfocus: function (e) { e.target.select(); } })));
  }

  function addHook(d) {
    c.modal("Ajouter un webhook", function (b, close) {
      var boxes = {}, ev = h("div", {});
      Object.keys(d.events).filter(function (k) { return k !== "test"; }).forEach(function (k) {
        var cb = h("input", { type: "checkbox", id: "ev_" + k, checked: true }); boxes[k] = cb;
        ev.appendChild(h("label", { class: "row", for: "ev_" + k, style: "margin:4px 0" }, cb, h("span", { text: d.events[k] })));
      });
      var f = c.form([{ k: "url", label: "Adresse (https://…)", required: true, placeholder: "https://hooks.zapier.com/hooks/catch/…" }], "Ajouter", function (v) {
        var events = Object.keys(boxes).filter(function (k) { return boxes[k].checked; });
        return c.oapi("POST", "/integrations/webhooks", { url: v.url, events: events }).then(function (r) { close(); load(); secretModal("Secret de signature", r.note, r.secret); });
      });
      b.appendChild(h("p", { class: "muted small", text: "Événements à envoyer :" })); b.appendChild(ev); b.appendChild(f);
    });
  }
  load();
} });
