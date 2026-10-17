/* Sous-application : Assistant commercial (lien de publicité → l'IA répond aux prospects, les enregistre et prend les commandes). */
function CFG_BASE() { return (window.MI_CONFIG && typeof window.MI_CONFIG.API_BASE === "string") ? window.MI_CONFIG.API_BASE : ""; }
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
    [["orders", "Commandes"], ["chats", "Conversations"], ["catalog", "Catalogue"], ["appts", "Rendez-vous" + (data && data.stats && data.stats.appointments ? " (" + data.stats.appointments + ")" : "")], ["campaigns", "Campagnes"], ["followup", "Relances"]].concat(admin ? [["whatsapp", "Canaux"]] : []).forEach(function (t) {
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
      if (tab === "orders") orders(area); else if (tab === "chats") chats(area); else if (tab === "catalog") catalog(area); else if (tab === "whatsapp") whatsapp(area); else if (tab === "followup") followup(area); else if (tab === "appts") appts(area); else campaigns(area);
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
          h("span", {}, h("b", { text: x.customer || (x.contact ? "+" + x.contact : "Visiteur") }), x.temperature ? pill(TEMP[x.temperature]) : null, x.stage === "prospect" ? pill(["Prospect", "mid"]) : x.stage === "client" ? pill(["Client", "good"]) : null, x.channel !== "web" ? pill([{ whatsapp: "WhatsApp", messenger: "Messenger", instagram: "Instagram" }[x.channel] || x.channel, "good"]) : null, x.status === "handoff" && !x.assigneeId ? pill(["À reprendre", "bad"]) : null, x.assignee ? pill(["→ " + x.assignee, ""]) : null,
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
        var taRef = { el: null };
        if (j.appointments && j.appointments.length) {
          box.appendChild(h("div", { class: "ws-card", style: "margin:8px 0" }, h("b", { text: "Rendez-vous demandé" }), j.appointments.map(function (a) { var ST = { pending: "à confirmer", confirmed: "confirmé", cancelled: "annulé", done: "terminé" }; return h("p", { style: "margin:4px 0 0", text: c.dateFr(a.date) + " à " + a.time.replace(":", "h") + (a.purpose ? " · " + a.purpose : "") + " · " + ST[a.status] }); })));
        }
        if (j.brief) {
          var bf = j.brief, cu = bf.customer || {};
          var cust = [cu.name, cu.phone, cu.email, cu.address].filter(Boolean).join(" · ");
          box.appendChild(h("div", { class: "ws-card", style: "margin:8px 0;border-color:var(--accent)" },
            h("div", { class: "row", style: "justify-content:space-between" }, h("b", { text: "Dossier préparé par l'IA interne" }), h("small", { class: "muted", text: "à relire avant d'agir" })),
            h("p", { style: "margin:6px 0", text: bf.summary }),
            cust ? h("p", { class: "muted small", style: "margin:4px 0", text: "Fiche client trouvée : " + cust }) : null,
            bf.nextSteps && bf.nextSteps.length ? h("ul", { style: "margin:6px 0 6px 18px;padding:0" }, bf.nextSteps.map(function (x) { return h("li", { text: x }); })) : null,
            bf.draftReply ? h("p", { class: "small", style: "background:var(--surface2);border-radius:10px;padding:8px 10px;margin:6px 0", text: "Réponse proposée : « " + bf.draftReply + " »" }) : null,
            h("div", { class: "row" },
              bf.draftReply && j.channel !== "web" ? h("button", { class: "btn small", type: "button", text: "Utiliser comme réponse", onclick: function () { if (taRef.el) { taRef.el.value = bf.draftReply; taRef.el.focus(); } } }) : null,
              h("button", { class: "btn small", type: "button", text: "Appliquer à la fiche client", onclick: function () { c.oapi("POST", prefix + "/chats/" + x.id + "/apply-brief", {}).then(function (r) { c.toast(r.done.length ? "Fiche client complétée : " + r.done.join(", ") + "." : "La fiche client était déjà à jour."); }).catch(c.fail); } }),
              prefix === "/sales" ? h("button", { class: "btn small", type: "button", text: "Mettre à jour le dossier", onclick: function () { c.oapi("POST", "/sales/chats/" + x.id + "/brief", {}).then(function () { c.toast("Dossier mis à jour."); done(); }).catch(c.fail); } }) : null)));
        } else if (j.status === "handoff" && prefix === "/sales") {
          box.appendChild(h("div", { class: "row", style: "margin:8px 0" }, h("button", { class: "btn small", type: "button", text: "Préparer le dossier avec l'IA", onclick: function () { c.oapi("POST", "/sales/chats/" + x.id + "/brief", {}).then(function () { c.toast("Dossier prêt."); done(); }).catch(c.fail); } })));
        }
        if (canAssign) {
          var sel = h("select", { "aria-label": "Attribuer à" }, [h("option", { value: "", text: "Non attribuée" })].concat((team || []).map(function (m) { return h("option", { value: String(m.userId), text: m.name + (m.title ? " (" + m.title + ")" : "") }); })));
          sel.value = j.assigneeId ? String(j.assigneeId) : "";
          box.appendChild(h("div", { class: "row", style: "margin:8px 0" }, h("span", { class: "muted small", text: "Attribuer à :" }), sel, h("button", { class: "btn small", type: "button", text: "Enregistrer", onclick: function () { c.oapi("PUT", "/sales/chats/" + x.id + "/assign", { userId: sel.value ? Number(sel.value) : null }).then(function () { c.toast(sel.value ? "Conversation attribuée : la personne est prévenue." : "Conversation libérée."); done(); }).catch(c.fail); } })));
        }
        j.messages.forEach(function (m) {
          var att = /^\[(image|document) #(\d+)\]\s*([\s\S]*)$/.exec(m.content), who = m.role === "user" ? "" : m.role === "staff" ? "Vous : " : "Assistant : ";
          if (!att) { box.appendChild(h("div", { class: "bub " + (m.role === "user" ? "user" : "assistant"), text: who + m.content })); return; }
          var url = (CFG_BASE() + "/api/ws/orgs/" + c.S.orgId + prefix + "/chats/" + x.id + "/media/" + att[2]);
          box.appendChild(h("div", { class: "bub " + (m.role === "user" ? "user" : "assistant") }, who,
            att[1] === "image" ? h("a", { href: url, target: "_blank", rel: "noopener" }, h("img", { src: url, alt: "Photo envoyée par le client", style: "display:block;max-width:240px;max-height:240px;border-radius:8px;margin:4px 0" })) : h("a", { href: url, target: "_blank", rel: "noopener", text: "Ouvrir le document (PDF) envoyé par le client" }),
            att[3] ? h("span", { text: att[3] }) : null));
        });
        if (j.channel !== "web") {
          var ta = taRef.el = h("textarea", { rows: 3, placeholder: "Votre réponse au client…", "aria-label": "Votre réponse", maxlength: 1000 }), err = h("p", { class: "ws-err", role: "alert" });
          var send = h("button", { class: "btn primary small", type: "button", text: "Envoyer le message", onclick: function () {
            send.disabled = true; err.textContent = "";
            c.oapi("POST", prefix + "/chats/" + x.id + "/reply", { text: ta.value }).then(function () { c.toast("Message envoyé. L'IA ne répond plus à cette personne."); done(); }).catch(function (e) { err.textContent = e.message; send.disabled = false; });
          } });
          box.appendChild(h("div", { style: "margin-top:14px" }, ta, err, h("div", { class: "row", style: "margin-top:8px" }, send,
            j.status === "handoff" ? h("button", { class: "btn small", type: "button", text: "Rendre à l'IA", onclick: function () { c.oapi("PUT", prefix + "/chats/" + x.id + "/status", { status: "open" }).then(function () { c.toast("L'IA répondra de nouveau à cette personne."); done(); }).catch(c.fail); } }) : null,
            prefix === "/sales-mine" ? h("button", { class: "btn small", type: "button", text: "Rendre à l'équipe", onclick: function () { c.oapi("POST", prefix + "/chats/" + x.id + "/release", {}).then(function () { c.toast("Conversation rendue à l'équipe."); done(); }).catch(c.fail); } }) : null)));
          box.appendChild(h("div", { class: "row", style: "margin-top:8px" }, j.channel !== "whatsapp" ? null : h("button", { class: "btn small", type: "button", text: "Envoyer un modèle (plus de 24 h)", onclick: function () { sendTemplateTo(prefix, x, done); } }), j.channel === "web" || prefix !== "/sales" ? null : h("button", { class: "btn small", type: "button", text: "Envoyer une photo ou une vidéo", onclick: function () { sendMediaTo(x, done); } })));
          box.appendChild(h("p", { class: "muted small", text: "Quand vous répondez, l'IA se tait pour cette personne. Meta n'autorise l'écriture libre que dans les 24 h qui suivent son dernier message." }));
        }
      }).catch(function (e) { box.textContent = e.message; });
    }, { wide: true });
  }

  /* Relances WhatsApp : modèles approuvés par Meta, prospects silencieux, factures impayées. */
  function sendTemplateTo(prefix, x, done) {
    c.oapi("GET", "/sales/wa").then(function (w) {
      c.modal("Envoyer un modèle WhatsApp", function (b, close) {
        if (!w.templates.length) { b.appendChild(c.empty("Aucun modèle enregistré. Ajoutez-en dans l'onglet Relances (un modèle doit d'abord être approuvé par Meta).")); return; }
        var sel = h("select", { "aria-label": "Modèle" }, w.templates.map(function (t) { return h("option", { value: String(t.id), text: t.name + " (" + t.language + ")" }); }));
        var prev = h("p", { class: "muted small" }), ins = h("div", {}), err = h("p", { class: "ws-err", role: "alert" }), inputs = [];
        function draw() {
          var t = w.templates.filter(function (y) { return String(y.id) === sel.value; })[0]; c.clear(ins); inputs = [];
          prev.textContent = t.preview ? "Texte : " + t.preview : "";
          for (var i = 0; i < t.params; i++) { var inp = h("input", { type: "text", placeholder: "Variable {{" + (i + 1) + "}}", "aria-label": "Variable " + (i + 1), maxlength: 300 }); inputs.push(inp); ins.appendChild(h("div", { style: "margin:6px 0" }, inp)); }
        }
        sel.addEventListener("change", draw); draw();
        var go = h("button", { class: "btn primary small", type: "button", text: "Envoyer", onclick: function () {
          go.disabled = true; err.textContent = "";
          c.oapi("POST", "/sales/wa/chats/" + x.id + "/template", { templateId: Number(sel.value), params: inputs.map(function (i) { return i.value.trim(); }) })
            .then(function () { c.toast("Modèle envoyé."); close(); done(); }).catch(function (e) { err.textContent = e.message; go.disabled = false; });
        } });
        b.appendChild(sel); b.appendChild(prev); b.appendChild(ins); b.appendChild(err); b.appendChild(h("div", { class: "row", style: "margin-top:8px" }, go));
      });
    }).catch(c.fail);
  }

  function followup(area) {
    c.clear(area); area.appendChild(c.loading());
    c.oapi("GET", "/sales/wa").then(function (w) {
      c.clear(area);
      if (!w.connected) area.appendChild(h("div", { class: "ws-card" }, h("h2", { text: "WhatsApp n'est pas connecté" }), h("p", { text: "Connectez d'abord le numéro de l'entreprise (onglet Canaux) : les relances partent de ce numéro." })));
      var tcard = h("div", { class: "ws-card" }, h("h2", { text: "Modèles de messages (approuvés par Meta)" }),
        h("p", { class: "muted small", text: "WhatsApp interdit d'écrire librement à quelqu'un plus de 24 h après son dernier message : il faut un modèle, créé et approuvé dans le gestionnaire WhatsApp de Meta (en général quelques minutes à quelques heures). Enregistrez ici son nom exact." }));
      if (!w.templates.length) tcard.appendChild(c.empty("Aucun modèle enregistré."));
      w.templates.forEach(function (t) {
        tcard.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: t.name }), h("small", { text: " " + (w.purposes[t.purpose] ? w.purposes[t.purpose].label : t.purpose) + " · " + t.language + " · " + t.params + " variable(s)" + (t.preview ? " · " + t.preview : "") })),
          admin ? h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer le modèle « " + t.name + " » de MANAGER-IA ? (Il reste dans Meta.)", function () { c.oapi("DELETE", "/sales/wa/templates/" + t.id).then(function () { followup(area); }).catch(c.fail); }); } }) : null));
      });
      if (admin) tcard.appendChild(h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn small", type: "button", text: "Ajouter un modèle", onclick: function () { addTemplate(w, function () { followup(area); }); } })));
      area.appendChild(tcard);

      var rc = h("div", { class: "ws-card" }, h("h2", { text: "Prospects à relancer (" + w.silent.length + ")" }), h("p", { class: "muted small", text: "Des prospects qui vous ont écrit il y a plus de 24 h (et moins de 7 jours) sans commander. Chacun n'est relancé qu'une fois. Ceux qui ont répondu STOP sont exclus." }));
      w.silent.slice(0, 8).forEach(function (l) { rc.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: l.name || "+" + l.contact }), h("small", { text: " dernier message le " + c.dateFr(String(l.lastAt).slice(0, 10)) })))); });
      if (admin) rc.appendChild(h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn primary small", type: "button", disabled: !w.silent.length || !w.connected, text: "Relancer maintenant", onclick: function () { runSend("relance"); } })));
      area.appendChild(rc);

      var ic = h("div", { class: "ws-card" }, h("h2", { text: "Factures impayées (" + w.overdue.length + ")" }), h("p", { class: "muted small", text: "Factures échues avec un numéro de téléphone. Un rappel au plus par semaine et par facture." }));
      w.overdue.slice(0, 8).forEach(function (i) { ic.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: i.number + " · " + i.customer }), h("small", { text: " reste " + c.money(i.left) + " · échue le " + c.dateFr(i.due) })))); });
      if (admin) ic.appendChild(h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn primary small", type: "button", disabled: !w.overdue.length || !w.connected, text: "Envoyer les rappels", onclick: function () { runSend("impaye"); } })));
      area.appendChild(ic);

      if (admin) area.appendChild(h("div", { class: "ws-card" }, h("h2", { text: "Relances automatiques" }),
        h("p", { text: w.autoFollowup ? "Activées : chaque heure, MANAGER-IA relance les prospects silencieux et rappelle les factures échues (20 messages au plus par passage)." : "Désactivées : vous envoyez les relances vous-même avec les boutons ci-dessus." }),
        h("button", { class: "btn small", type: "button", text: w.autoFollowup ? "Désactiver" : "Activer", onclick: function () { c.oapi("PUT", "/sales/wa/auto", { enabled: !w.autoFollowup }).then(function () { followup(area); }).catch(c.fail); } }),
        h("p", { class: "muted small", text: "Envoyés sur 24 h : " + w.sentToday + " sur " + w.dayCap + " autorisés. Personnes désabonnées (STOP) : " + w.optouts + ". Les messages par modèle sont facturés par Meta selon son tarif." })));

      if (w.log.length) { var lc = h("div", { class: "ws-card" }, h("h2", { text: "Derniers envois" })); w.log.slice(0, 10).forEach(function (l) { lc.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: "+" + l.phone }), h("small", { text: " " + l.template + " · " + c.dateFr(String(l.at).slice(0, 10)) + (l.error ? " · " + l.error : "") })), pill([l.status === "sent" ? "Envoyé" : "Échec", l.status === "sent" ? "good" : "bad"]))); }); area.appendChild(lc); }
    }).catch(c.fail);
    function runSend(kind) {
      c.oapi("POST", "/sales/wa/send", { kind: kind }).then(function (r) { c.toast(r.sent + " message(s) envoyé(s)" + (r.failed ? ", " + r.failed + " en échec : " + r.error : "") + "."); followup(area); }).catch(c.fail);
    }
  }

  function addTemplate(w, done) {
    c.modal("Ajouter un modèle WhatsApp", function (b, close) {
      var ex = h("p", { class: "muted small" });
      var f = c.form([
        { k: "purpose", label: "Usage", type: "select", options: Object.keys(w.purposes).map(function (k) { return [k, w.purposes[k].label]; }), value: "relance" },
        { k: "name", label: "Nom exact dans Meta (minuscules, chiffres, _)", required: true, hint: "Exemple : relance_prospect" },
        { k: "language", label: "Langue", value: "fr", hint: "Exactement comme dans Meta (fr, fr_FR, en…)" },
        { k: "preview", label: "Texte du modèle (pour l'affichage)", hint: "Recopiez le texte approuvé, avec {{1}}, {{2}}…" }
      ], "Enregistrer", function (v) { return c.oapi("POST", "/sales/wa/templates", v).then(function () { close(); done(); }); });
      b.appendChild(f); b.appendChild(ex);
      var sel = f.querySelector("select"), prev = f.querySelector("textarea,input[type=text]:last-of-type");
      function hint() { var p = w.purposes[sel.value]; ex.textContent = (p.hint ? "Variables : " + p.hint + ". " : "") + (p.example ? "Texte conseillé à créer dans Meta : « " + p.example + " »" : ""); }
      sel.addEventListener("change", hint); hint();
    });
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
            h("span", {}, h("b", { text: x.customer || (x.contact ? "+" + x.contact : "Visiteur") }), x.temperature ? pill(TEMP[x.temperature]) : null, x.channel !== "web" ? pill([{ whatsapp: "WhatsApp", messenger: "Messenger", instagram: "Instagram" }[x.channel] || x.channel, "good"]) : null,
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
            h("button", { class: "link", type: "button", text: "Photos et vidéos" + (it.photos || it.videos ? " (" + (it.photos + it.videos) + ")" : ""), onclick: function () { itemMedia(it); } }),
            h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editItem(it); } }),
            h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer « " + it.name + " » ?", function () { c.oapi("DELETE", "/sales/catalog/" + it.id).then(load).catch(c.fail); }); } }))));
      });
      area.appendChild(card);
    }).catch(c.fail);
  }
  /* Photos et vidéos d'un article : l'IA les envoie sur WhatsApp quand un client en demande. */
  function itemMedia(it) {
    var url = function (path) { return CFG_BASE() + "/api/ws/orgs/" + c.S.orgId + "/sales/catalog/" + it.id + path; };
    c.modal("Photos et vidéos : " + it.name, function (b) {
      var grid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin:10px 0" }), msg = h("p", { class: "muted small", role: "status" });
      function refresh() {
        c.clear(grid);
        c.oapi("GET", "/sales/catalog/" + it.id + "/media").then(function (j) {
          if (!j.media.length) grid.appendChild(c.empty("Aucun fichier pour le moment."));
          j.media.forEach(function (m) {
            var box = h("div", { style: "position:relative;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface2)" },
              m.kind === "image" ? h("img", { src: url("/media/" + m.id + "/file"), alt: "Photo de " + it.name, style: "display:block;width:100%;height:110px;object-fit:cover" }) : h("video", { src: url("/media/" + m.id + "/file"), controls: true, preload: "metadata", style: "display:block;width:100%;height:110px;object-fit:cover;background:#000" }),
              h("button", { type: "button", class: "link", "aria-label": "Supprimer ce fichier", text: "Supprimer", style: "display:block;margin:4px auto", onclick: function () { c.confirm("Supprimer ce fichier ?", function () { c.oapi("DELETE", "/sales/catalog/" + it.id + "/media/" + m.id).then(refresh).catch(c.fail); }); } }));
            grid.appendChild(box);
          });
        }).catch(c.fail);
      }
      var inp = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,video/mp4", multiple: true, "aria-label": "Ajouter des photos ou des vidéos" });
      inp.addEventListener("change", function () {
        var files = Array.prototype.slice.call(inp.files || []); inp.value = ""; var i = 0;
        (function next() {
          if (i >= files.length) { msg.textContent = "Terminé."; refresh(); load(); return; }
          var f = files[i++]; msg.textContent = "Envoi de « " + f.name + " » (" + i + "/" + files.length + ")…";
          fetch(url("/media?name=" + encodeURIComponent(f.name.slice(0, 60))), { method: "POST", credentials: "include", headers: { "Content-Type": "application/octet-stream" }, body: f })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Envoi impossible."); }); })
            .then(next).catch(function (e) { msg.textContent = f.name + " : " + e.message; refresh(); });
        })();
      });
      b.appendChild(h("p", { class: "muted small", text: "Photos JPEG, PNG ou WebP (3 Mo au plus) et vidéos MP4 (16 Mo au plus, limite de WhatsApp). Jusqu'à 8 fichiers par article. Quand un client demande à voir l'article sur WhatsApp, l'IA envoie jusqu'à 3 photos et 1 vidéo, avec le nom et le prix en légende." }));
      b.appendChild(inp); b.appendChild(msg); b.appendChild(grid); refresh();
    }, { wide: true, onclose: load });
  }
  function sendMediaTo(x, done) {
    c.oapi("GET", "/sales/catalog").then(function (j) {
      var items = j.items.filter(function (i) { return i.active && (i.photos || i.videos); });
      c.modal("Envoyer une photo ou une vidéo", function (b, close) {
        if (!items.length) { b.appendChild(c.empty("Aucun article n'a de photo ou de vidéo. Ajoutez-en dans l'onglet Catalogue.")); return; }
        var sel = h("select", { "aria-label": "Article" }, items.map(function (i) { return h("option", { value: String(i.id), text: i.name + " (" + i.photos + " photo(s), " + i.videos + " vidéo(s))" }); }));
        var kind = h("select", { "aria-label": "Type" }, [h("option", { value: "all", text: "Photos et vidéo" }), h("option", { value: "image", text: "Photos seulement" }), h("option", { value: "video", text: "Vidéo seulement" })]);
        var err = h("p", { class: "ws-err", role: "alert" });
        var go = h("button", { class: "btn primary small", type: "button", text: "Envoyer", onclick: function () { go.disabled = true; err.textContent = ""; c.oapi("POST", "/sales/chats/" + x.id + "/send-media", { itemId: Number(sel.value), kind: kind.value }).then(function () { c.toast("Envoyé au client."); close(); done(); }).catch(function (e) { err.textContent = e.message; go.disabled = false; }); } });
        b.appendChild(sel); b.appendChild(h("div", { style: "margin:8px 0" }, kind)); b.appendChild(err); b.appendChild(go);
      });
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
      var sep = h("div", {}); area.appendChild(sep); metaChannels(sep);
    }).catch(c.fail);
  }

  function metaChannels(area) {
    c.oapi("GET", "/sales/meta").then(function (w) {
      var base = (window.MI_CONFIG && typeof MI_CONFIG.API_BASE === "string" && MI_CONFIG.API_BASE ? MI_CONFIG.API_BASE : location.origin);
      area.appendChild(h("div", { class: "ws-card" }, h("h2", { text: "Messenger et Instagram" }),
        h("p", {}, w.connected ? pill(["Connecté", "good"]) : pill(["Non connecté", "bad"])),
        h("p", { class: "muted", text: "Le même assistant répond aux messages privés reçus sur votre Page Facebook (Messenger) et sur votre compte Instagram professionnel lié. Il fait la même chose que sur WhatsApp : il lit les messages vocaux, les photos et les PDF, répond par écrit et en vocal, envoie les photos et vidéos du catalogue, prend les commandes et vous passe la main quand il le faut. Pour envoyer des fichiers et des voix, le serveur doit connaître son adresse publique HTTPS (API_PUBLIC_URL)." }),
        h("ol", { class: "ws-steps" },
          h("li", { text: "Dans votre application Meta (developers.facebook.com), ajoutez le produit Messenger et liez votre Page. Pour Instagram, liez le compte professionnel à la Page." }),
          h("li", { text: "Générez un jeton d'accès de Page permanent. Copiez-le, avec l'identifiant de la Page, l'identifiant du compte Instagram (facultatif) et le secret de l'application." }),
          h("li", { text: "Collez ci-dessous, puis dans Meta (Webhooks) l'adresse et le jeton de vérification affichés. Abonnez les champs « messages » (Page) et « messages » (Instagram)." }))));
      var card = h("div", { class: "ws-card" }, h("h2", { text: "Identifiants Messenger / Instagram" }));
      card.appendChild(c.form([
        { k: "pageId", label: "Identifiant de la Page Facebook", value: w.pageId, hint: "Chiffres seulement." },
        { k: "instagramId", label: "Identifiant du compte Instagram professionnel (facultatif)", value: w.instagramId },
        { k: "token", label: "Jeton d'accès de la Page" + (w.tokenSet ? " (déjà enregistré)" : ""), type: "password", placeholder: w.tokenSet ? "Laisser vide pour garder le jeton actuel" : "EAAG…" },
        { k: "appSecret", label: "Secret de l'application" + (w.secretSet ? " (déjà enregistré)" : ""), type: "password", placeholder: w.secretSet ? "Laisser vide pour garder le secret actuel" : "" }
      ], "Enregistrer", function (v) { return c.oapi("PUT", "/sales/meta", { pageId: v.pageId, instagramId: v.instagramId, token: v.token, appSecret: v.appSecret }).then(function () { c.toast("Réglages enregistrés."); tabMeta(area); }); }));
      area.appendChild(card);
      if (w.verifyToken) {
        var hk = h("div", { class: "ws-card" }, h("h2", { text: "À coller dans Meta (Webhooks)" })), msg = h("p", { class: "muted small" });
        [["Adresse du webhook (URL de rappel)", base + w.webhookPath], ["Jeton de vérification", w.verifyToken]].forEach(function (p) {
          hk.appendChild(h("label", { class: "fld" }, h("span", { text: p[0] }), h("input", { type: "text", readonly: true, value: p[1], onfocus: function (e) { e.target.select(); } })));
          hk.appendChild(h("div", { class: "row" }, h("button", { class: "btn small", type: "button", text: "Copier", onclick: function () { c.copy(p[1], "Copié."); } })));
        });
        hk.appendChild(h("div", { class: "row", style: "margin-top:14px" },
          h("button", { class: "btn primary small", type: "button", text: "Tester la connexion", onclick: function () { msg.textContent = "Test en cours…"; c.oapi("POST", "/sales/meta/test", {}).then(function (r) { msg.textContent = "Connexion réussie" + (r.name ? " : Page « " + r.name + " »" : "") + "."; }).catch(function (e) { msg.textContent = e.message; }); } }),
          h("button", { class: "btn small", type: "button", text: "Déconnecter", onclick: function () { c.confirm("Déconnecter Messenger / Instagram ? L'assistant cessera d'y répondre.", function () { c.oapi("DELETE", "/sales/meta").then(function () { tabMeta(area); }).catch(c.fail); }); } })));
        hk.appendChild(msg); area.appendChild(hk);
      }
    }).catch(c.fail);
  }
  function tabMeta(area) { c.clear(area); metaChannels(area); }

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

  /* Rendez-vous pris par l'assistant (ou ajoutés par l'équipe) */
  function appts(area) {
    var ST = { pending: ["À confirmer", "mid"], confirmed: ["Confirmé", "good"], cancelled: ["Annulé", "bad"], done: ["Terminé", ""] };
    var filter = "open";
    c.clear(area); var bar = h("div", { class: "ws-tabs" }), list = h("div", {});
    [["open", "À venir"], ["done", "Terminés"], ["cancelled", "Annulés"]].forEach(function (f) { bar.appendChild(h("button", { type: "button", class: "tab" + (filter === f[0] ? " on" : ""), text: f[1], onclick: function () { filter = f[0]; appts(area); } })); });
    var card = h("div", { class: "ws-card" }, h("div", { class: "row", style: "justify-content:space-between" }, h("h2", { text: "Rendez-vous" }), h("button", { class: "btn primary small", type: "button", text: "Ajouter un rendez-vous", onclick: function () { editAppt(null, function () { appts(area); }); } })),
      h("p", { class: "muted small", text: "Les rendez-vous pris par l'assistant arrivent ici « à confirmer ». Un créneau déjà pris ne peut pas être réservé deux fois (60 minutes par rendez-vous, de 6 h à 21 h)." }), bar, list);
    area.appendChild(card); list.appendChild(c.loading());
    if (admin) calendarCard(area);
    c.oapi("GET", "/sales/appointments" + (filter === "open" ? "" : "?status=" + filter)).then(function (j) {
      c.clear(list);
      if (!j.appointments.length) list.appendChild(c.empty(filter === "open" ? "Aucun rendez-vous à venir." : "Rien à afficher."));
      j.appointments.forEach(function (a) {
        var st = ST[a.status] || ["", ""];
        list.appendChild(h("div", { class: "line", style: "display:block" },
          h("div", { class: "row" }, h("b", { text: a.label }), pill(st), a.channel ? pill([{ whatsapp: "WhatsApp", messenger: "Messenger", instagram: "Instagram", web: "Page web" }[a.channel] || a.channel, ""]) : null, h("span", { class: "grow" }),
            a.status === "pending" ? h("button", { class: "link", type: "button", text: "Confirmer", onclick: function () { upd(a, { status: "confirmed", notify: true }, "Rendez-vous confirmé" + (a.channel ? " : le client est prévenu." : ".")); } }) : null,
            a.status === "confirmed" ? h("button", { class: "link", type: "button", text: "Terminé", onclick: function () { upd(a, { status: "done" }, "Rendez-vous terminé."); } }) : null,
            h("button", { class: "link", type: "button", text: "Agenda (.ics)", title: "Télécharger ce rendez-vous pour l'ajouter à Google Agenda, Outlook ou Apple Calendrier", onclick: function () { fetch(CFG_BASE() + "/api/ws/orgs/" + c.S.orgId + "/sales/appointments/" + a.id + "/ics", { credentials: "include" }).then(function (r) { if (!r.ok) throw new Error("Téléchargement impossible."); return r.blob(); }).then(function (bl) { var l = document.createElement("a"); l.href = URL.createObjectURL(bl); l.download = "rendez-vous-" + a.date + ".ics"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(l.href); }, 2000); }).catch(c.fail); } }),
            a.status === "pending" || a.status === "confirmed" ? h("button", { class: "link", type: "button", text: "Déplacer", onclick: function () { editAppt(a, function () { appts(area); }); } }) : null,
            a.status === "pending" || a.status === "confirmed" ? h("button", { class: "link", type: "button", text: "Annuler", onclick: function () { c.confirm("Annuler ce rendez-vous ? Le client sera prévenu s'il vous a écrit il y a moins de 24 h.", function () { upd(a, { status: "cancelled", notify: true }, "Rendez-vous annulé."); }); } }) : null),
          h("small", { class: "muted", text: [a.customer, a.phone, a.purpose, a.place].filter(Boolean).join(" · ") })));
      });
    }).catch(c.fail);
    function upd(a, body, msg) { c.oapi("PUT", "/sales/appointments/" + a.id, body).then(function (r) { c.toast(msg + (body.notify && !r.notified && a.channel ? " (le client n'a pas pu être prévenu : plus de 24 h ou canal déconnecté)" : "")); appts(area); load(); }).catch(c.fail); }
  }
  /* Lien d'abonnement à l'agenda (Google Agenda, Outlook, Apple Calendrier) */
  function calendarCard(area) {
    var box = h("div", { class: "ws-card" }); area.appendChild(box);
    function draw(j) {
      c.clear(box); box.appendChild(h("h2", { text: "Agenda sur votre téléphone ou votre ordinateur" }));
      var base = (window.MI_CONFIG && typeof MI_CONFIG.API_BASE === "string" && MI_CONFIG.API_BASE ? MI_CONFIG.API_BASE : location.origin);
      if (!j.configured) { box.appendChild(h("p", { class: "muted", text: "Obtenez un lien secret : en l'ajoutant à Google Agenda (Autres agendas > À partir de l'URL), Outlook ou Apple Calendrier, vos rendez-vous s'y affichent tout seuls, avec un rappel une heure avant." })); }
      else {
        var url = base + j.path;
        box.appendChild(h("p", { class: "muted small", text: "Ajoutez ce lien dans votre agenda (Google Agenda : Autres agendas > À partir de l'URL). Lecture seule : un rendez-vous modifié ici apparaît dans votre agenda après quelques heures (Google actualise lui-même, parfois jusqu'à 24 h). Ne partagez pas ce lien : toute personne qui l'a peut voir les rendez-vous." }));
        box.appendChild(h("input", { type: "text", readonly: true, value: url, "aria-label": "Lien de l'agenda", onfocus: function (e) { e.target.select(); } }));
        if (!/^https:\/\/|^http:\/\/localhost/.test(url)) box.appendChild(h("p", { class: "ws-err", text: "Pour que Google puisse lire ce lien, le serveur doit être en ligne en HTTPS (API_PUBLIC_URL)." }));
      }
      box.appendChild(h("div", { class: "row", style: "margin-top:8px" },
        j.configured ? h("button", { class: "btn small", type: "button", text: "Copier le lien", onclick: function () { c.copy(base + j.path, "Lien copié."); } }) : null,
        h("button", { class: "btn small", type: "button", text: j.configured ? "Créer un nouveau lien (l'ancien s'arrête)" : "Créer mon lien d'agenda", onclick: function () { c.oapi("POST", "/sales/calendar/regenerate", {}).then(function (r) { draw({ configured: true, path: r.path }); }).catch(c.fail); } })));
    }
    c.oapi("GET", "/sales/calendar").then(draw).catch(c.fail);
  }

  function editAppt(a, done) {
    c.modal(a ? "Déplacer le rendez-vous" : "Nouveau rendez-vous", function (b, close) {
      var f = [{ k: "date", label: "Jour", type: "date", required: true, value: a ? a.date : "" }, { k: "time", label: "Heure", type: "time", required: true, value: a ? a.time : "10:00" }, { k: "purpose", label: "Objet", value: a ? a.purpose : "" }, { k: "place", label: "Lieu", value: a ? a.place : "" }];
      b.appendChild(c.form(f, "Enregistrer", function (v) { return c.oapi(a ? "PUT" : "POST", "/sales/appointments" + (a ? "/" + a.id : ""), { date: v.date, time: v.time, purpose: v.purpose, place: v.place }).then(function () { close(); done(); }); }));
    });
  }

  function settings() {
    var s = data.settings;
    c.modal("Réglages de l'assistant public", function (b, close) {
      b.appendChild(c.form([
        { k: "on", label: "Assistant public", type: "select", options: [["1", "Activé : il répond aux prospects"], ["0", "Désactivé"]], value: s.chatEnabled ? "1" : "0" },
        { k: "auto", label: "Quand l'IA passe la main", type: "select", options: [["0", "Vous attribuez la conversation vous-même"], ["1", "Attribuer automatiquement au commercial le moins occupé"]], value: s.autoAssign ? "1" : "0", hint: "Sont commerciaux les membres dont le poste contient « commercial », « vente », « vendeur » ou « sales ». Modifiez le poste dans Équipe et antennes." },
        { k: "hOrder", label: "Après une commande enregistrée par l'IA", type: "select", options: [["1", "Un conseiller prend le relais (et l'IA interne prépare son dossier)"], ["0", "L'IA continue seule"]], value: s.handoffOrder === false ? "0" : "1", hint: "La commande reste « à valider » dans tous les cas." },
        { k: "hAppt", label: "Après un rendez-vous pris par l'IA", type: "select", options: [["1", "Un conseiller prend le relais (et l'IA interne prépare son dossier)"], ["0", "L'IA continue seule"]], value: s.handoffAppt === false ? "0" : "1" },
        { k: "rem", label: "Rappel automatique la veille d'un rendez-vous confirmé", type: "select", options: [["1", "Oui : le client est rappelé à partir de 16 h"], ["0", "Non"]], value: s.apptReminder === false ? "0" : "1", hint: "Dans les 24 h après son dernier message : texte libre. Après, WhatsApp exige un modèle approuvé par Meta de type « Rappel de rendez-vous » (onglet Relances). Messenger et Instagram : seulement dans les 24 h." },
        { k: "delay", label: "Délai avant la réponse de l'IA (WhatsApp, Messenger, Instagram)", type: "select", options: [["0", "Tout de suite"], ["30", "30 secondes"], ["60", "1 minute"], ["90", "1 minute 30"], ["120", "2 minutes"], ["150", "2 minutes 30"], ["180", "3 minutes"]], value: String(s.replyDelay || 0), hint: "L'IA attend ce temps avant de répondre. Si le client écrit plusieurs messages pendant l'attente, elle les lit ensemble et fait une seule réponse. Si un conseiller reprend la conversation, elle ne répond pas." },
        { k: "voice", label: "Réponse en message vocal", type: "select", options: [["mirror", "Quand le client m'envoie un vocal (conseillé)"], ["always", "Toujours"], ["off", "Jamais"]], value: s.voiceReply || "mirror", hint: s.ttsAvailable ? "La réponse écrite part toujours ; la voix s'y ajoute. Chaque message vocal compte comme un message IA de plus." : "Indisponible : le service de voix n'est pas configuré sur le serveur (TTS_API_KEY)." },
        { k: "info", label: "Informations pratiques pour répondre aux clients", type: "textarea", rows: 8, value: s.salesInfo, placeholder: "Horaires, adresse, livraison (zones et prix), moyens de paiement, délais, conditions de retour…", hint: "L'assistant n'invente rien : il utilise ce texte et votre catalogue. Plus c'est précis, mieux il répond." }
      ], "Enregistrer", function (v) { return c.oapi("PUT", "/sales/settings", { chatEnabled: v.on === "1", salesInfo: v.info, autoAssign: v.auto === "1", replyDelay: Number(v.delay), voiceReply: v.voice, handoffOrder: v.hOrder === "1", handoffAppt: v.hAppt === "1", apptReminder: v.rem === "1" }).then(function () { close(); load(); }); }));
      b.appendChild(h("p", { class: "muted small", text: "Chaque message traité par l'IA est compté dans le quota de messages IA de votre organisation. Messages vocaux : " + (s.voice ? "activés (transcrits en texte)." : "dictée du navigateur seulement (la transcription par le serveur n'est pas activée).") }));
    });
  }

  load();
} });
