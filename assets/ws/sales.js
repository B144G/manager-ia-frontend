/* Sous-application : Assistant commercial (lien de publicité → l'IA répond aux prospects, les enregistre et prend les commandes). */
WS.register({ id: "sales", icon: "sales", render: function (root, c) {
  var h = c.h, admin = c.can("admin"), tab = "orders", data = null, filter = "all";
  var TEMP = { chaud: ["Chaud", "bad"], tiede: ["Tiède", "mid"], froid: ["Froid", "good"] };
  if (!c.can("manager")) return mineView();
  var OST = { pending: ["À valider", "mid"], confirmed: ["Confirmée", "good"], cancelled: ["Refusée", "bad"], invoiced: ["Facturée", "good"] };
  var tabs = h("div", { class: "ws-tabs" }), body = h("div", {});

  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Assistant commercial" }), h("p", { class: "muted", text: "Après une publicité, l'IA répond à vos prospects, les enregistre et prend leurs commandes." })),
    h("div", { class: "row" },
      admin ? h("button", { class: "btn small", type: "button", text: "Réglages", onclick: settings }) : null,
      admin ? h("button", { class: "btn primary small", type: "button", text: "Lien à partager", onclick: shareLink }) : null)));
  root.appendChild(h("div", {}, tabs, body));

  function pill(t) { return h("span", { class: "pill " + t[1], text: t[0] }); }
  function drawTabs() {
    c.clear(tabs);
    [["orders", "Commandes"], ["chats", "Conversations"], ["catalog", "Catalogue"], ["campaigns", "Campagnes"]].concat(admin ? [["whatsapp", "WhatsApp"]] : []).forEach(function (t) {
      tabs.appendChild(h("button", { type: "button", class: "tab" + (tab === t[0] ? " on" : ""), text: t[1], onclick: function () { tab = t[0]; load(); } }));
    });
  }

  function load() {
    drawTabs(); c.clear(body); body.appendChild(c.loading());
    c.oapi("GET", "/sales").then(function (j) {
      data = j; c.clear(body);
      var s = j.stats;
      body.appendChild(h("div", { class: "kpis" },
        h("div", { class: "stat" }, h("b", { text: String(s.chats7) }), h("span", { text: "conversations (7 jours)" })),
        h("div", { class: "stat" }, h("b", { text: String(s.prospects) }), h("span", { text: "prospects à convertir" })),
        h("div", { class: "stat" + (s.pendingOrders ? " bad" : "") }, h("b", { text: String(s.pendingOrders) }), h("span", { text: "commande(s) à valider" })),
        h("div", { class: "stat" }, h("b", { class: "ok", text: c.money(s.ordered) }), h("span", { text: "commandé au total" }))));
      if (!j.settings.chatEnabled) body.appendChild(h("div", { class: "ws-card" }, h("h2", { text: "L'assistant public est désactivé" }),
        h("p", { text: s.catalog ? "Activez-le dans les réglages pour qu'il réponde à vos prospects." : "Étape 1 : ajoutez vos articles et leurs prix dans l'onglet Catalogue. Étape 2 : activez l'assistant dans les réglages. Étape 3 : partagez le lien dans votre publicité." })));
      if (s.waiting) body.appendChild(h("p", { class: "ws-err", text: s.waiting + " conversation(s) attendent un conseiller (voir le Service client)." }));
      var area = h("div", {}); body.appendChild(area);
      if (tab === "orders") orders(area); else if (tab === "chats") chats(area); else if (tab === "catalog") catalog(area); else if (tab === "whatsapp") whatsapp(area); else campaigns(area);
    }).catch(c.fail);
  }

  function orders(area) {
    c.oapi("GET", "/sales/orders").then(function (j) {
      var card = h("div", { class: "ws-card" }, h("h2", { text: "Commandes de vos clients" }));
      if (!j.orders.length) card.appendChild(c.empty("Aucune commande pour le moment. Elles apparaîtront ici dès qu'un prospect commande avec l'assistant."));
      j.orders.forEach(function (o) {
        card.appendChild(h("div", { class: "line" },
          h("span", {}, h("b", { text: o.number + " · " + o.customer }), " ", pill(OST[o.status] || ["", ""]),
            h("small", { text: " " + o.lines.map(function (l) { return l.label + " × " + l.quantity; }).join(", ") + " · " + c.money(o.total) + (o.phone ? " · " + o.phone : "") + (o.note ? " · " + o.note : "") })),
          h("span", { class: "row" },
            o.status === "pending" ? h("button", { class: "link", type: "button", text: "Confirmer", onclick: function () { setStatus(o, "confirmed"); } }) : null,
            o.status === "pending" ? h("button", { class: "link", type: "button", text: "Refuser", onclick: function () { c.confirm("Refuser la commande " + o.number + " ?", function () { setStatus(o, "cancelled"); }); } }) : null,
            o.status === "confirmed" ? h("button", { class: "link", type: "button", text: "Créer la facture", onclick: function () { c.oapi("POST", "/sales/orders/" + o.id + "/invoice", {}).then(function () { c.toast("Facture créée (voir Clients et ventes)."); load(); }).catch(c.fail); } }) : null,
            o.phone ? h("button", { class: "link", type: "button", text: "Copier le numéro", onclick: function () { c.copy(o.phone, "Numéro copié."); } }) : null)));
      });
      area.appendChild(card);
      area.appendChild(h("p", { class: "muted small", text: "Vérifiez le stock et le paiement, contactez le client, puis confirmez. Les prix viennent toujours de votre catalogue, jamais de l'IA." }));
    }).catch(c.fail);
  }
  function setStatus(o, s) { c.oapi("PUT", "/sales/orders/" + o.id + "/status", { status: s }).then(function () { load(); }).catch(c.fail); }

  function chats(area) {
    Promise.all([c.oapi("GET", "/sales/chats"), c.oapi("GET", "/members")]).then(function (res) {
      var j = res[0], team = res[1].members, me = c.S.info.me.userId;
      var card = h("div", { class: "ws-card" }, h("h2", { text: "Conversations avec les prospects" }));
      var bar = h("div", { class: "ws-tabs" });
      [["all", "Toutes"], ["free", "Non attribuées"], ["mine", "Les miennes"], ["hot", "Chaudes"]].forEach(function (f) { bar.appendChild(h("button", { type: "button", class: "tab" + (filter === f[0] ? " on" : ""), text: f[1], onclick: function () { filter = f[0]; c.clear(area); chats(area); } })); });
      card.appendChild(bar);
      var list = j.chats.filter(function (x) { return filter === "all" || (filter === "free" && !x.assigneeId) || (filter === "mine" && x.assigneeId === me) || (filter === "hot" && x.temperature === "chaud"); });
      if (!list.length) card.appendChild(c.empty(j.chats.length ? "Aucune conversation dans cette liste." : "Aucune conversation. Partagez le lien de l'assistant dans votre publicité."));
      list.forEach(function (x) {
        card.appendChild(h("div", { class: "line" },
          h("span", {}, h("b", { text: x.customer || (x.contact ? "+" + x.contact : "Visiteur") }), x.temperature ? pill(TEMP[x.temperature]) : null, x.stage === "prospect" ? pill(["Prospect", "mid"]) : x.stage === "client" ? pill(["Client", "good"]) : null, x.channel === "whatsapp" ? pill(["WhatsApp", "good"]) : null, x.status === "handoff" && !x.assigneeId ? pill(["À reprendre", "bad"]) : null, x.assignee ? pill(["→ " + x.assignee, ""]) : null,
            h("small", { text: " " + (x.campaign ? "campagne « " + x.campaign + " » · " : "") + c.dateFr(x.at) + " · " + x.messages + " messages" + (x.lastText ? " · « " + x.lastText.slice(0, 70) + (x.lastText.length > 70 ? "…" : "") + " »" : "") })),
          h("button", { class: "link", type: "button", text: "Lire", onclick: function () { readChat("/sales", x, team, true); } })));
      });
      area.appendChild(card);
    }).catch(c.fail);
  }
  /* Lecture d'une conversation : fiche prospect, attribution (responsables), réponse humaine (WhatsApp). prefix = "/sales" (équipe) ou "/sales-mine" (mes conversations). */
  function readChat(prefix, x, team, canAssign, after) {
    c.modal("Conversation" + (x.customer ? " avec " + x.customer : x.contact ? " avec +" + x.contact : ""), function (b, close) {
      var box = h("div", {}, c.loading()); b.appendChild(box);
      var done = function () { close(); (after || load)(); };
      c.oapi("GET", prefix + "/chats/" + x.id).then(function (j) {
        c.clear(box);
        if (j.campaign) box.appendChild(h("p", { class: "muted small", text: "Campagne : " + j.campaign }));
        if (j.summary) box.appendChild(h("div", { class: "ws-card", style: "background:var(--pale,#f1f5fd);margin:8px 0" }, h("b", { text: "Fiche prospect" }), h("p", { style: "white-space:pre-line;margin:6px 0 0", text: j.summary })));
        if (canAssign) {
          var sel = h("select", { "aria-label": "Attribuer à" }, [h("option", { value: "", text: "Non attribuée" })].concat((team || []).map(function (m) { return h("option", { value: String(m.userId), text: m.name + (m.title ? " (" + m.title + ")" : "") }); })));
          sel.value = j.assigneeId ? String(j.assigneeId) : "";
          box.appendChild(h("div", { class: "row", style: "margin:8px 0" }, h("span", { class: "muted small", text: "Attribuer à :" }), sel, h("button", { class: "btn small", type: "button", text: "Enregistrer", onclick: function () { c.oapi("PUT", "/sales/chats/" + x.id + "/assign", { userId: sel.value ? Number(sel.value) : null }).then(function () { c.toast(sel.value ? "Conversation attribuée : la personne est prévenue." : "Conversation libérée."); done(); }).catch(c.fail); } })));
        }
        j.messages.forEach(function (m) { box.appendChild(h("div", { class: "bub " + (m.role === "user" ? "user" : "assistant"), text: (m.role === "user" ? "" : m.role === "staff" ? "Vous : " : "Assistant : ") + m.content })); });
        if (j.channel === "whatsapp") {
          var ta = h("textarea", { rows: 3, placeholder: "Votre réponse au client sur WhatsApp…", "aria-label": "Votre réponse", maxlength: 1000 }), err = h("p", { class: "ws-err", role: "alert" });
          var send = h("button", { class: "btn primary small", type: "button", text: "Envoyer sur WhatsApp", onclick: function () {
            send.disabled = true; err.textContent = "";
            c.oapi("POST", prefix + "/chats/" + x.id + "/reply", { text: ta.value }).then(function () { c.toast("Message envoyé sur WhatsApp. L'IA ne répond plus à cette personne."); done(); }).catch(function (e) { err.textContent = e.message; send.disabled = false; });
          } });
          box.appendChild(h("div", { style: "margin-top:14px" }, ta, err, h("div", { class: "row", style: "margin-top:8px" }, send,
            j.status === "handoff" ? h("button", { class: "btn small", type: "button", text: "Rendre à l'IA", onclick: function () { c.oapi("PUT", prefix + "/chats/" + x.id + "/status", { status: "open" }).then(function () { c.toast("L'IA répondra de nouveau à cette personne."); done(); }).catch(c.fail); } }) : null,
            prefix === "/sales-mine" ? h("button", { class: "btn small", type: "button", text: "Rendre à l'équipe", onclick: function () { c.oapi("POST", prefix + "/chats/" + x.id + "/release", {}).then(function () { c.toast("Conversation rendue à l'équipe."); done(); }).catch(c.fail); } }) : null)));
          box.appendChild(h("p", { class: "muted small", text: "Quand vous répondez, l'IA se tait pour cette personne. WhatsApp n'autorise l'écriture libre que dans les 24 h qui suivent son dernier message." }));
        }
      }).catch(function (e) { box.textContent = e.message; });
    }, { wide: true });
  }

  /* Vue d'un simple membre (commercial) : seulement les conversations qui lui sont attribuées. */
  function mineView() {
    root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Mes conversations" }), h("p", { class: "muted", text: "Les clients que votre responsable vous a attribués. Lisez la fiche du prospect, puis répondez-lui." }))));
    var box = h("div", {}); root.appendChild(box);
    function loadMine() {
      c.clear(box); box.appendChild(c.loading());
      c.oapi("GET", "/sales-mine/chats").then(function (j) {
        c.clear(box);
        var card = h("div", { class: "ws-card" }, h("h2", { text: "À traiter" }));
        if (!j.chats.length) card.appendChild(c.empty("Aucune conversation ne vous est attribuée pour le moment."));
        j.chats.forEach(function (x) {
          card.appendChild(h("div", { class: "line" },
            h("span", {}, h("b", { text: x.customer || (x.contact ? "+" + x.contact : "Visiteur") }), x.temperature ? pill(TEMP[x.temperature]) : null, x.channel === "whatsapp" ? pill(["WhatsApp", "good"]) : null,
              h("small", { text: " " + (x.campaign ? "campagne « " + x.campaign + " » · " : "") + c.dateFr(x.at) + (x.lastText ? " · « " + x.lastText.slice(0, 70) + (x.lastText.length > 70 ? "…" : "") + " »" : "") })),
            h("button", { class: "link", type: "button", text: "Ouvrir", onclick: function () { readChat("/sales-mine", x, null, false, loadMine); } })));
        });
        box.appendChild(card);
      }).catch(c.fail);
    }
    loadMine();
  }

  function catalog(area) {
    c.oapi("GET", "/sales/catalog").then(function (j) {
      var card = h("div", { class: "ws-card" }, h("div", { class: "row", style: "justify-content:space-between" }, h("h2", { text: "Catalogue" }), h("button", { class: "btn primary small", type: "button", text: "Ajouter un article", onclick: function () { editItem(); } })));
      card.appendChild(h("p", { class: "muted small", text: "L'assistant ne donne que ces prix. Plus vos noms sont clairs, mieux il comprend les clients." }));
      if (!j.items.length) card.appendChild(c.empty("Aucun article. Ajoutez vos produits ou services avec leur prix."));
      j.items.forEach(function (it) {
        card.appendChild(h("div", { class: "line" },
          h("span", {}, h("b", { text: it.name }), it.active ? null : pill(["Masqué", ""]), h("small", { text: " " + c.money(it.price) + (it.unit ? " / " + it.unit : "") + (it.description ? " · " + it.description : "") })),
          h("span", { class: "row" },
            h("button", { class: "link", type: "button", text: it.active ? "Masquer" : "Afficher", onclick: function () { c.oapi("PUT", "/sales/catalog/" + it.id, { active: !it.active }).then(load).catch(c.fail); } }),
            h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editItem(it); } }),
            h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer « " + it.name + " » ?", function () { c.oapi("DELETE", "/sales/catalog/" + it.id).then(load).catch(c.fail); }); } }))));
      });
      area.appendChild(card);
    }).catch(c.fail);
  }
  function editItem(it) {
    it = it || {};
    c.modal(it.id ? "Modifier l'article" : "Nouvel article", function (b, close) {
      b.appendChild(c.form([{ k: "name", label: "Nom", required: true, value: it.name, placeholder: "Robe wax Aïcha" }, { k: "price", label: "Prix (" + c.S.info.org.currency + ")", required: true, value: it.price }, { k: "unit", label: "Unité (facultatif)", value: it.unit, placeholder: "pièce, kg, heure…" }, { k: "description", label: "Description courte", value: it.description, placeholder: "Tailles, couleurs, délai…" }],
        "Enregistrer", function (v) { return c.oapi(it.id ? "PUT" : "POST", "/sales/catalog" + (it.id ? "/" + it.id : ""), v).then(function () { close(); load(); }); }));
    });
  }

  function campaigns(area) {
    c.oapi("GET", "/sales/campaigns").then(function (j) {
      var card = h("div", { class: "ws-card" }, h("h2", { text: "Résultats par campagne" }));
      card.appendChild(h("p", { class: "muted small", text: "Ajoutez un nom de campagne au lien (bouton « Lien à partager ») pour savoir quelle publicité rapporte des clients." }));
      if (!j.campaigns.length) card.appendChild(c.empty("Pas encore de conversation."));
      j.campaigns.forEach(function (x) {
        card.appendChild(h("div", { class: "line" }, h("b", { text: x.campaign }), h("small", { text: x.chats + " conversation(s) · " + x.prospects + " prospect(s) enregistré(s) · " + x.ordered + " commande(s) · " + c.money(x.amount) })));
      });
      area.appendChild(card);
    }).catch(c.fail);
  }

  // ---------- QR codes (bibliothèque locale, aucune requête externe) ----------
  function qrCanvas(text, px) {
    var q = qrcode(0, "M"); q.addData(text); q.make();
    var n = q.getModuleCount(), m = 4, cell = Math.max(3, Math.floor(px / (n + 2 * m))), size = (n + 2 * m) * cell;
    var cv = document.createElement("canvas"); cv.width = cv.height = size;
    var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, size, size); g.fillStyle = "#000";
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
    cv.style.cssText = "width:200px;height:200px;max-width:100%;image-rendering:pixelated;border:1px solid var(--line);border-radius:8px";
    cv.setAttribute("role", "img");
    return cv;
  }
  function qrBlock(label, text, file) {
    var cv = qrCanvas(text, 800); cv.setAttribute("aria-label", "QR code : " + label);
    return h("div", { class: "ws-qr" }, h("b", { text: label }), cv, h("div", { class: "row" },
      h("button", { class: "btn small", type: "button", text: "Télécharger l'image", onclick: function () { cv.toBlob(function (bl) { var a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = file + ".png"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); }); } }),
      h("button", { class: "btn small", type: "button", text: "Copier le lien", onclick: function () { c.copy(text, "Lien copié."); } })));
  }

  // ---------- WhatsApp de l'entreprise (API officielle de Meta) ----------
  function whatsapp(area) {
    c.oapi("GET", "/sales/whatsapp").then(function (w) {
      var base = (window.MI_CONFIG && typeof MI_CONFIG.API_BASE === "string" && MI_CONFIG.API_BASE ? MI_CONFIG.API_BASE : location.origin);
      var hook = base + w.webhookPath;
      var st = h("div", { class: "ws-card" }, h("h2", { text: "WhatsApp de votre entreprise" }),
        h("p", {}, w.connected ? pill(["Connecté", "good"]) : pill(["Non connecté", "bad"]), h("span", { text: w.number ? "  +" + w.number : "" })),
        h("p", { class: "muted", text: "Quand un prospect écrit sur votre numéro WhatsApp (par exemple après une publicité « Cliquer pour envoyer un message »), l'assistant lui répond, l'enregistre et prend sa commande, comme sur la page web. Vous pouvez reprendre la conversation à tout moment." }));
      area.appendChild(st);
      var steps = h("div", { class: "ws-card" }, h("h2", { text: "Comment le connecter" }),
        h("ol", { class: "ws-steps" },
          h("li", { text: "Créez un compte Meta Business et une application de type « Entreprise » sur developers.facebook.com, puis ajoutez le produit WhatsApp." }),
          h("li", { text: "Ajoutez votre numéro WhatsApp Business. Il ne doit pas rester utilisé dans l'application WhatsApp normale." }),
          h("li", { text: "Copiez ci-dessous l'identifiant du numéro (Phone number ID), un jeton d'accès permanent et le secret de l'application." }),
          h("li", { text: "Dans Meta (WhatsApp > Configuration), collez l'adresse du webhook et le jeton de vérification affichés plus bas, puis abonnez le champ « messages »." }),
          h("li", { text: "Cliquez sur « Tester la connexion », puis écrivez un message à votre numéro pour essayer." })));
      area.appendChild(steps);
      var card = h("div", { class: "ws-card" }, h("h2", { text: "Vos identifiants" }));
      card.appendChild(c.form([
        { k: "phoneId", label: "Identifiant du numéro (Phone number ID)", value: w.phoneId, placeholder: "109876543210", hint: "Chiffres seulement." },
        { k: "number", label: "Numéro WhatsApp avec l'indicatif du pays", value: w.number, placeholder: "237677112233", hint: "Sert au lien et au QR code WhatsApp." },
        { k: "token", label: "Jeton d'accès permanent" + (w.tokenSet ? " (déjà enregistré)" : ""), type: "password", placeholder: w.tokenSet ? "Laisser vide pour garder le jeton actuel" : "EAAG…", hint: "Il est chiffré et ne s'affiche plus jamais." },
        { k: "appSecret", label: "Secret de l'application" + (w.secretSet ? " (déjà enregistré)" : ""), type: "password", placeholder: w.secretSet ? "Laisser vide pour garder le secret actuel" : "", hint: "Sert à vérifier que les messages viennent bien de Meta." }
      ], "Enregistrer", function (v) { return c.oapi("PUT", "/sales/whatsapp", { phoneId: v.phoneId, number: v.number, token: v.token, appSecret: v.appSecret }).then(function () { c.toast("Réglages enregistrés."); load(); }); }));
      area.appendChild(card);
      if (w.verifyToken) {
        var hk = h("div", { class: "ws-card" }, h("h2", { text: "À coller dans Meta" }));
        [["Adresse du webhook (URL de rappel)", hook], ["Jeton de vérification", w.verifyToken]].forEach(function (p) {
          hk.appendChild(h("label", { class: "fld" }, h("span", { text: p[0] }), h("input", { type: "text", readonly: true, value: p[1], onfocus: function (e) { e.target.select(); } })));
          hk.appendChild(h("div", { class: "row" }, h("button", { class: "btn small", type: "button", text: "Copier", onclick: function () { c.copy(p[1], "Copié."); } })));
        });
        var msg = h("p", { class: "muted small", text: "" });
        hk.appendChild(h("div", { class: "row", style: "margin-top:14px" },
          h("button", { class: "btn primary small", type: "button", text: "Tester la connexion", onclick: function () { msg.textContent = "Test en cours…"; c.oapi("POST", "/sales/whatsapp/test", {}).then(function (r) { msg.textContent = "Connexion réussie : " + r.name + " (" + r.number + ")."; }).catch(function (e) { msg.textContent = e.message; }); } }),
          h("button", { class: "btn small", type: "button", text: "Déconnecter WhatsApp", onclick: function () { c.confirm("Déconnecter WhatsApp ? L'assistant cessera de répondre sur ce numéro.", function () { c.oapi("DELETE", "/sales/whatsapp").then(function () { c.toast("WhatsApp déconnecté."); load(); }).catch(c.fail); }, "Oui, déconnecter"); } })));
        hk.appendChild(msg);
        area.appendChild(hk);
      }
    }).catch(c.fail);
  }

  function shareLink() {
    var token = data && data.settings.token;
    c.modal("Lien à partager dans vos publicités", function (b) {
      if (!token) { b.appendChild(c.empty("Réservé aux administrateurs.")); return; }
      var camp = h("input", { type: "text", placeholder: "ex : facebook-octobre", "aria-label": "Nom de la campagne", maxlength: 40 });
      var out = h("input", { type: "text", readonly: true, "aria-label": "Lien", onfocus: function (e) { e.target.select(); } });
      function upd() { var base = location.origin + location.pathname.replace(/[^/]*$/, "") + "chat.html?o=" + token; var cn = camp.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40); out.value = base + (cn ? "&c=" + cn : ""); }
      camp.addEventListener("input", upd); upd();
      b.appendChild(h("p", { text: "Mettez ce lien dans votre publicité (Facebook, Instagram, TikTok, WhatsApp, affiche avec QR code). Chaque personne qui clique discute avec votre assistant." }));
      b.appendChild(h("label", { class: "fld" }, h("span", { text: "Nom de la campagne (facultatif)" }), camp, h("small", { text: "Lettres, chiffres, tiret. Il apparaît dans les résultats par campagne." })));
      b.appendChild(h("label", { class: "fld" }, h("span", { text: "Lien" }), out));
      b.appendChild(h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn primary small", type: "button", text: "Copier le lien", onclick: function () { c.copy(out.value, "Lien copié."); } }), h("a", { class: "btn small", href: out.value, target: "_blank", rel: "noopener", text: "Essayer", onclick: function (e) { e.target.href = out.value; } })));
      var qrs = h("div", { class: "ws-qrs" });
      function drawQr() {
        c.clear(qrs);
        var cn = camp.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
        qrs.appendChild(qrBlock("Page de discussion", out.value, "qr-discussion" + (cn ? "-" + cn : "")));
        if (data.settings.waNumber) qrs.appendChild(qrBlock("Écrire sur WhatsApp", "https://wa.me/" + data.settings.waNumber + "?text=" + encodeURIComponent("Bonjour, je viens de voir votre publicité" + (cn ? " #" + cn : "")), "qr-whatsapp" + (cn ? "-" + cn : "")));
      }
      camp.addEventListener("input", drawQr); drawQr();
      b.appendChild(qrs);
      b.appendChild(h("p", { class: "muted small", text: data.settings.waNumber ? "Imprimez ces QR codes sur vos affiches, cartes et factures : le client scanne et discute tout de suite (WhatsApp ou page web)." : "Enregistrez votre numéro WhatsApp dans l'onglet WhatsApp pour obtenir aussi un QR code qui ouvre WhatsApp." }));
    });
  }

  function settings() {
    var s = data.settings;
    c.modal("Réglages de l'assistant public", function (b, close) {
      b.appendChild(c.form([
        { k: "on", label: "Assistant public", type: "select", options: [["1", "Activé : il répond aux prospects"], ["0", "Désactivé"]], value: s.chatEnabled ? "1" : "0" },
        { k: "auto", label: "Quand l'IA passe la main", type: "select", options: [["0", "Vous attribuez la conversation vous-même"], ["1", "Attribuer automatiquement au commercial le moins occupé"]], value: s.autoAssign ? "1" : "0", hint: "Sont commerciaux les membres dont le poste contient « commercial », « vente », « vendeur » ou « sales ». Modifiez le poste dans Équipe et antennes." },
        { k: "info", label: "Informations pratiques pour répondre aux clients", type: "textarea", rows: 8, value: s.salesInfo, placeholder: "Horaires, adresse, livraison (zones et prix), moyens de paiement, délais, conditions de retour…", hint: "L'assistant n'invente rien : il utilise ce texte et votre catalogue. Plus c'est précis, mieux il répond." }
      ], "Enregistrer", function (v) { return c.oapi("PUT", "/sales/settings", { chatEnabled: v.on === "1", salesInfo: v.info, autoAssign: v.auto === "1" }).then(function () { close(); load(); }); }));
      b.appendChild(h("p", { class: "muted small", text: "Chaque message traité par l'IA est compté dans le quota de messages IA de votre organisation. Messages vocaux : " + (s.voice ? "activés (transcrits en texte)." : "dictée du navigateur seulement (la transcription par le serveur n'est pas activée).") }));
    });
  }

  load();
} });
