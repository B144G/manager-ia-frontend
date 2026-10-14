/* Sous-application : Service client (boîte de demandes + réponses, brouillon IA, formulaire public). */
WS.register({ id: "support", icon: "support", render: function (root, c) {
  var h = c.h, filter = "open", sel = null, members = [];
  var STAT = { open: "À traiter", pending: "En attente", resolved: "Résolue" };
  var PRIO = { low: "Basse", normal: "Normale", high: "Urgente" };
  var list = h("div", { class: "tk-list" }), detail = h("div", { class: "tk-detail" });
  var tabs = h("div", { class: "ws-tabs" });
  function none() { c.clear(detail); detail.appendChild(c.empty("Choisissez une demande.")); }
  none();

  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Service client" }), h("p", { class: "muted", text: "Toutes les demandes de vos clients au même endroit." })),
    h("div", { class: "row" },
      c.can("admin") ? h("button", { class: "btn small", type: "button", text: "Formulaire client", onclick: showForm }) : null,
      h("button", { class: "btn primary small", type: "button", text: "Nouvelle demande", onclick: newTicket }))));
  root.appendChild(tabs);
  root.appendChild(h("div", { class: "tk" }, list, detail));

  c.oapi("GET", "/members").then(function (j) { members = j.members; }, function () {});

  function showForm() {
    var url = location.origin + location.pathname.replace(/[^/]*$/, "") + "form.html?o=" + c.S.info.intakeToken;
    c.modal("Formulaire pour vos clients", function (b) {
      b.appendChild(h("p", { text: "Partagez ce lien (WhatsApp, Facebook, votre site…). Chaque message envoyé devient une demande ici." }));
      b.appendChild(h("input", { value: url, readonly: true, onfocus: function (e) { e.target.select(); } }));
      b.appendChild(h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn primary small", type: "button", text: "Copier le lien", onclick: function () { c.copy(url, "Lien copié."); } }),
        h("a", { class: "btn small", href: url, target: "_blank", rel: "noopener", text: "Voir le formulaire" })));
    });
  }

  function newTicket() {
    c.modal("Nouvelle demande", function (b, close) {
      b.appendChild(c.form([
        { k: "customerName", label: "Nom du client", required: true },
        { k: "customerContact", label: "Contact du client" },
        { k: "channel", label: "Canal", type: "select", options: [["manuel", "Saisie manuelle"], ["whatsapp", "WhatsApp"], ["messenger", "Messenger"], ["instagram", "Instagram"], ["email", "E-mail"], ["telephone", "Téléphone"]] },
        { k: "subject", label: "Sujet", required: true },
        { k: "message", label: "Message du client", type: "textarea" },
        { k: "priority", label: "Priorité", type: "select", options: [["normal", "Normale"], ["high", "Urgente"], ["low", "Basse"]] }
      ], "Enregistrer", function (v) { return c.oapi("POST", "/support", v).then(function (j) { close(); filter = "open"; sel = j.id; load(); }); }));
    });
  }

  function load() {
    c.oapi("GET", "/support" + (filter === "all" ? "" : "?status=" + filter)).then(function (j) {
      c.clear(tabs);
      [["open", "À traiter"], ["pending", "En attente"], ["resolved", "Résolues"], ["all", "Toutes"]].forEach(function (t) {
        var n = t[0] === "all" ? "" : " (" + (j.counts[t[0]] || 0) + ")";
        tabs.appendChild(h("button", { type: "button", class: "tab" + (filter === t[0] ? " on" : ""), text: t[1] + n, onclick: function () { filter = t[0]; sel = null; none(); load(); } }));
      });
      c.clear(list);
      if (!j.tickets.length) list.appendChild(c.empty("Aucune demande ici."));
      j.tickets.forEach(function (t) {
        list.appendChild(h("button", { type: "button", class: "tk-item" + (t.id === sel ? " on" : "") + (t.priority === "high" ? " hot" : ""), onclick: function () { sel = t.id; load(); } },
          h("b", { text: t.customerName }), h("span", { text: t.subject }), h("small", { text: STAT[t.status] + " · " + t.channel + " · " + c.dateFr(t.updatedAt) })));
      });
      if (sel) open(sel);
    }).catch(c.fail);
  }

  function open(id) {
    c.oapi("GET", "/support/" + id).then(function (j) {
      var t = j.ticket;
      c.clear(detail);
      var msgs = h("div", { class: "tk-msgs" });
      j.messages.forEach(function (m) {
        msgs.appendChild(h("div", { class: "msg " + m.author }, h("small", { text: (m.author === "customer" ? t.customerName : (m.who || "Équipe")) + " · " + c.dateFr(m.at) }), h("p", { text: m.content })));
      });
      var reply = h("textarea", { rows: 4, placeholder: "Votre réponse au client…", "aria-label": "Votre réponse" });
      var statusSel = h("select", { "aria-label": "Statut", onchange: save }, ["open", "pending", "resolved"].map(function (s) { return h("option", { value: s, text: STAT[s] }); }));
      var prioSel = h("select", { "aria-label": "Priorité", onchange: save }, ["low", "normal", "high"].map(function (s) { return h("option", { value: s, text: PRIO[s] }); }));
      var whoSel = h("select", { "aria-label": "Responsable" , onchange: save }, [h("option", { value: "", text: "Non assignée" })].concat(members.map(function (m) { return h("option", { value: m.userId, text: m.name }); })));
      statusSel.value = t.status; prioSel.value = t.priority; whoSel.value = t.assigneeId || "";
      function save() { c.oapi("PUT", "/support/" + id, { status: statusSel.value, priority: prioSel.value, assigneeId: whoSel.value || null }).then(function () { c.toast("Enregistré."); load(); }).catch(c.fail); }

      detail.appendChild(h("div", { class: "tk-top" }, h("h2", { text: t.subject }), h("p", { class: "muted small", text: t.customerName + (t.customerContact ? " · " + t.customerContact : "") + " · via " + t.channel })));
      detail.appendChild(h("div", { class: "row wrap" }, statusSel, prioSel, whoSel,
        c.can("manager") ? h("button", { class: "btn small", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer cette demande ?", function () { c.oapi("DELETE", "/support/" + id).then(function () { sel = null; none(); load(); }).catch(c.fail); }); } }) : null));
      detail.appendChild(msgs);
      detail.appendChild(reply);
      detail.appendChild(h("div", { class: "row" },
        h("button", { class: "btn primary small", type: "button", text: "Enregistrer la réponse", onclick: function (ev) {
          if (!reply.value.trim()) return;
          ev.target.disabled = true;
          c.oapi("POST", "/support/" + id + "/messages", { content: reply.value }).then(function () { c.toast("Réponse enregistrée. Envoyez-la aussi au client sur son canal."); load(); }).catch(function (e) { ev.target.disabled = false; c.fail(e); });
        } }),
        h("button", { class: "btn signal small", type: "button", text: "Brouillon par l'IA", onclick: function () {
          c.propose("ticket-reply", { ticketId: id }, { title: "Brouillon de réponse", apply: false, render: function (p, v) {
            v.appendChild(h("p", { class: "ai-out", text: p.reply || "" }));
            if (p.note) v.appendChild(h("p", { class: "muted small", text: "Note pour l'équipe : " + p.note }));
          }, after: function (p, close) {
            document.querySelector(".ws-prop").appendChild(h("button", { class: "btn primary small", type: "button", text: "Utiliser ce texte", style: "margin-top:12px", onclick: function () { reply.value = p.reply || ""; close(); reply.focus(); } }));
          } });
        } })));
    }).catch(c.fail);
  }
  load();
} });
