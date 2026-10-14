/* Sous-application : Clients et ventes (fiches clients, devis, factures, paiements reçus, relances avec l'IA). */
WS.register({ id: "crm", icon: "crm", render: function (root, c) {
  var h = c.h, info = c.S.info, mgr = c.can("manager"), tab = "customers", customers = [];
  var DST = { draft: ["Brouillon", ""], sent: ["Envoyé", "mid"], accepted: ["Accepté", "good"], refused: ["Refusé", "bad"], paid: ["Payée", "good"], cancelled: ["Annulée", "bad"] };
  var tabs = h("div", { class: "ws-tabs" }), body = h("div", {});

  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Clients et ventes" }), h("p", { class: "muted", text: mgr ? "Vos clients, vos devis, vos factures et ce qu'il reste à encaisser." : "Vos clients." })),
    h("div", { class: "row" },
      mgr ? h("button", { class: "btn signal small", type: "button", text: "Proposition avec l'IA", onclick: proposal }) : null,
      mgr ? h("button", { class: "btn small", type: "button", text: "Nouveau devis", onclick: function () { newDoc("quote"); } }) : null,
      mgr ? h("button", { class: "btn small", type: "button", text: "Nouvelle facture", onclick: function () { newDoc("invoice"); } }) : null,
      h("button", { class: "btn primary small", type: "button", text: "Ajouter un client", onclick: function () { editCustomer(); } }))));
  root.appendChild(tabs);
  root.appendChild(body);

  function pill(t) { return t && t[0] ? h("span", { class: "pill " + t[1], text: t[0] }) : null; }
  function drawTabs() {
    c.clear(tabs);
    (mgr ? [["customers", "Clients"], ["quote", "Devis"], ["invoice", "Factures"], ["mail", "E-mails"]] : [["customers", "Clients"]]).forEach(function (t) {
      tabs.appendChild(h("button", { type: "button", class: "tab" + (tab === t[0] ? " on" : ""), text: t[1], onclick: function () { tab = t[0]; load(); } }));
    });
  }

  function load() {
    drawTabs(); c.clear(body); body.appendChild(c.loading());
    c.oapi("GET", "/crm/customers").then(function (j) {
      customers = j.customers;
      if (tab === "customers") return showCustomers();
      if (tab === "mail") return showMail();
      return c.oapi("GET", "/crm/documents?kind=" + tab).then(showDocs);
    }).catch(c.fail);
  }

  function showCustomers() {
    c.clear(body);
    var card = h("div", { class: "ws-card" }, h("h2", { text: "Clients" }));
    if (!customers.length) card.appendChild(c.empty("Aucun client. Ajoutez le premier : son historique de ventes se construira ici."));
    customers.forEach(function (cu) {
      card.appendChild(h("div", { class: "line" },
        h("span", {}, h("b", { text: cu.name }), cu.stage === "prospect" ? h("span", { class: "pill mid", text: "Prospect" }) : null, h("small", { text: " " + [cu.phone, cu.email].filter(Boolean).join(" · ") + (cu.source ? " · via " + cu.source : "") }), cu.owed ? h("small", { class: "late", text: "  doit " + c.money(cu.owed) }) : null),
        h("span", { class: "row" },
          mgr && cu.email ? h("button", { class: "link", type: "button", text: "E-mail", onclick: function () { composeMail(cu, {}); } }) : null,
          mgr ? h("button", { class: "link", type: "button", text: "Fiche", onclick: function () { sheet(cu); } }) : null,
          h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editCustomer(cu); } }),
          mgr ? h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer « " + cu.name + " » et tous ses devis et factures ?", function () { c.oapi("DELETE", "/crm/customers/" + cu.id).then(load).catch(c.fail); }); } }) : null)));
    });
    body.appendChild(card);
  }

  function showDocs(j) {
    c.clear(body);
    var s = j.summary;
    body.appendChild(h("div", { class: "kpis" },
      h("div", { class: "stat" }, h("b", { text: c.money(s.owed) }), h("span", { text: "à encaisser" })),
      h("div", { class: "stat" + (s.overdueCount ? " bad" : "") }, h("b", { text: c.money(s.overdue) }), h("span", { text: s.overdueCount + " facture(s) en retard" })),
      h("div", { class: "stat" }, h("b", { text: c.money(s.invoicedMonth) }), h("span", { text: "facturé ce mois" })),
      h("div", { class: "stat" }, h("b", { class: "ok", text: c.money(s.paidMonth) }), h("span", { text: "encaissé ce mois" }))));
    var card = h("div", { class: "ws-card" }, h("h2", { text: tab === "quote" ? "Devis" : "Factures" }));
    if (!j.documents.length) card.appendChild(c.empty(tab === "quote" ? "Aucun devis." : "Aucune facture."));
    j.documents.forEach(function (d) { card.appendChild(docRow(d)); });
    body.appendChild(card);
  }

  function docRow(d) {
    var st = DST[d.status] || ["", ""];
    var a = [];
    if (d.status === "draft") a.push(["Marquer envoyé", function () { setDoc(d, { status: "sent" }); }]);
    if (d.kind === "invoice" && d.status === "sent") a.push(["Paiement reçu", function () { pay(d); }]);
    if (d.overdue) a.push(["Relancer avec l'IA", function () { remind(d); }]);
    if (d.kind === "quote" && d.status === "sent") { a.push(["Accepté", function () { setDoc(d, { status: "accepted" }); }]); a.push(["Refusé", function () { setDoc(d, { status: "refused" }); }]); }
    if (d.kind === "quote" && d.status === "accepted") a.push(["Créer la facture", function () { c.oapi("POST", "/crm/documents/" + d.id + "/convert", {}).then(function () { tab = "invoice"; load(); }).catch(c.fail); }]);
    a.push(["Envoyer par e-mail", function () { var cu = customers.filter(function (x) { return x.id === d.customerId; })[0]; if (!cu || !cu.email) return c.toast("Ajoutez d'abord l'adresse e-mail de ce client sur sa fiche (Clients → Modifier).", "bad"); composeMail(cu, { subject: (d.kind === "quote" ? "Votre devis " : "Votre facture ") + d.number, body: "Bonjour " + cu.name.split(" ")[0] + ",\n\nVeuillez trouver ci-dessous " + (d.kind === "quote" ? "votre devis" : "votre facture") + ".\n\n" + docText(d) + "\n\nCordialement." }); }]);
    a.push(["Copier le texte", function () { c.copy(docText(d), "Texte copié : collez-le dans WhatsApp ou un e-mail."); }]);
    if (d.kind === "invoice" && d.status !== "paid" && d.status !== "cancelled" && d.status !== "draft") a.push(["Annuler", function () { c.confirm("Annuler cette facture ?", function () { setDoc(d, { status: "cancelled" }); }); }]);
    if (d.status === "draft" || (c.can("admin") && !d.paid)) a.push(["Supprimer", function () { c.confirm("Supprimer " + d.number + " ?", function () { c.oapi("DELETE", "/crm/documents/" + d.id).then(load).catch(c.fail); }); }]);
    return h("div", { class: "line" },
      h("span", {}, h("b", { text: d.number }), " ", h("span", {}, d.customer || ""), " ", pill(d.overdue ? ["En retard", "bad"] : st),
        h("small", { text: " " + c.money(d.total) + (d.kind === "invoice" && d.paid ? " · payé " + c.money(d.paid) : "") + (d.due ? " · échéance " + c.dateFr(d.due) : "") })),
      h("span", { class: "row" }, a.map(function (x) { return h("button", { class: "link", type: "button", text: x[0], onclick: x[1] }); })));
  }

  function docText(d) {
    var t = (d.kind === "quote" ? "Devis " : "Facture ") + d.number + (d.customer ? " — " + d.customer : "") + "\n";
    d.lines.forEach(function (l) { t += "• " + l.label + " : " + l.quantity + " × " + Number(l.price).toLocaleString("fr-FR") + "\n"; });
    t += "Total : " + c.money(d.total);
    if (d.kind === "invoice") { if (d.paid) t += "\nDéjà payé : " + c.money(d.paid) + " — Reste : " + c.money(d.balance); if (d.due) t += "\nÀ payer avant le " + c.dateFr(d.due); }
    return t + "\n" + info.org.name;
  }

  function setDoc(d, p) { c.oapi("PUT", "/crm/documents/" + d.id, p).then(load).catch(c.fail); }

  function pay(d) {
    c.modal("Paiement reçu : " + d.number, function (b, close) {
      b.appendChild(h("p", { class: "muted small", text: "Reste à payer : " + c.money(d.balance) + ". Le paiement sera aussi inscrit comme une entrée « Ventes » dans votre budget." }));
      b.appendChild(c.form([{ k: "amount", label: "Montant reçu (" + info.org.currency + ")", required: true, value: d.balance }], "Enregistrer le paiement", function (v) {
        return c.oapi("POST", "/crm/documents/" + d.id + "/payments", { amount: v.amount }).then(function () { close(); load(); });
      }));
    });
  }

  function remind(d) {
    c.propose("payment-reminder", { documentId: d.id }, { title: "Message de relance", apply: false, render: function (p, v) {
      v.appendChild(h("textarea", { rows: 6, "aria-label": "Message de relance", value: p.message || "" }));
      var cu = customers.filter(function (x) { return x.id === d.customerId; })[0];
      v.appendChild(h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn primary small", type: "button", text: "Copier le message", onclick: function () { c.copy(v.querySelector("textarea").value, "Message copié : collez-le dans WhatsApp."); } }),
        cu && cu.email ? h("button", { class: "btn small", type: "button", text: "Envoyer par e-mail", onclick: function () { composeMail(cu, { subject: "Rappel : facture " + d.number, body: v.querySelector("textarea").value }); } }) : null));
      if (p.note) v.appendChild(h("p", { class: "muted small", text: "Note pour vous : " + p.note }));
    } });
  }

  function editCustomer(cu) {
    cu = cu || {};
    c.modal(cu.id ? "Modifier le client" : "Nouveau client", function (b, close) {
      b.appendChild(c.form([{ k: "name", label: "Nom", required: true, value: cu.name }, { k: "phone", label: "Téléphone / WhatsApp", value: cu.phone }, { k: "email", label: "E-mail", value: cu.email }, { k: "notes", label: "Notes", type: "textarea", rows: 3, value: cu.notes, hint: "Préférences, habitudes de paiement…" }],
        "Enregistrer", function (v) { return c.oapi(cu.id ? "PUT" : "POST", "/crm/customers" + (cu.id ? "/" + cu.id : ""), v).then(function () { close(); load(); }); }));
    });
  }

  function sheet(cu) {
    c.modal(cu.name, function (b) {
      var box = h("div", {}, c.loading()); b.appendChild(box);
      c.oapi("GET", "/crm/customers/" + cu.id).then(function (j) {
        c.clear(box);
        box.appendChild(h("p", { class: "muted small", text: [j.customer.phone, j.customer.email].filter(Boolean).join(" · ") || "Pas de coordonnées." }));
        if (j.customer.notes) box.appendChild(h("p", { text: j.customer.notes }));
        box.appendChild(h("h3", { text: "Historique" }));
        if (!j.documents.length) box.appendChild(c.empty("Aucun devis ni facture."));
        j.documents.forEach(function (d) { box.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: d.number }), " ", pill(d.overdue ? ["En retard", "bad"] : DST[d.status])), h("small", { text: c.money(d.total) + (d.kind === "invoice" ? " · reste " + c.money(d.balance) : "") }))); });
      }).catch(function (e) { box.textContent = e.message; });
    });
  }

  function newDoc(kind) {
    c.oapi("GET", "/crm/customers").then(function (j) { customers = j.customers; openDoc(kind); }).catch(c.fail);
  }
  function openDoc(kind) {
    var first = customers.length === 0;
    c.modal(kind === "quote" ? "Nouveau devis" : "Nouvelle facture", function (b, close) {
      if (first) { b.appendChild(c.empty("Ajoutez d'abord un client.")); return; }
      b.appendChild(c.form([
        { k: "customerId", label: "Client", type: "select", options: customers.map(function (x) { return [String(x.id), x.name]; }) },
        { k: "lines", label: "Lignes (une par ligne)", type: "textarea", rows: 5, required: true, placeholder: "Pagne ; 2 ; 15000\nLivraison ; 1 ; 2000", hint: "Format : libellé ; quantité ; prix unitaire. Le total est calculé pour vous." },
        { k: "due", label: kind === "quote" ? "Valable jusqu'au (facultatif)" : "À payer avant le", type: "date" }
      ], "Créer (brouillon)", function (v) {
        var lines = v.lines.split("\n").map(function (l) { var p = l.split(";"); return p.length >= 2 && l.trim() ? { label: p[0].trim(), quantity: p.length >= 3 ? p[1].trim() : "1", price: (p.length >= 3 ? p[2] : p[1]).trim() } : null; }).filter(Boolean);
        return c.oapi("POST", "/crm/documents", { kind: kind, customerId: v.customerId, lines: lines, due: v.due || null }).then(function () { close(); tab = kind; load(); });
      }));
    });
  }

  // ----- E-mails aux clients (l'IA rédige, vous relisez et vous envoyez) -----
  function composeMail(cu, init) {
    var files = []; // { id, name }
    c.modal("E-mail à " + cu.name, function (b, close) {
      var subj = h("input", { type: "text", value: init.subject || "", placeholder: "Objet du message", "aria-label": "Objet" });
      var msg = h("textarea", { rows: 9, "aria-label": "Message", placeholder: "Votre message…", value: init.body || "" });
      var list = h("div", { class: "row" }), err = h("p", { class: "ws-err", role: "alert" });
      var pick = h("input", { type: "file", accept: "image/png,image/jpeg,image/gif,image/webp,application/pdf", multiple: true, "aria-label": "Ajouter des images ou un PDF" });
      function drawFiles() { c.clear(list); files.forEach(function (f, i) { list.appendChild(h("span", { class: "pill good" }, f.name + " ", h("button", { class: "link", type: "button", "aria-label": "Retirer " + f.name, text: "×", onclick: function () { files.splice(i, 1); drawFiles(); } }))); }); }
      pick.addEventListener("change", function () {
        err.textContent = "";
        Array.prototype.slice.call(pick.files).forEach(function (file) {
          if (files.length >= 3) { err.textContent = "3 pièces jointes au maximum."; return; }
          var rd = new FileReader();
          rd.onload = function () {
            var data = String(rd.result).split(",")[1] || "";
            c.oapi("POST", "/mail/files", { name: file.name, data: data }).then(function (r) { if (files.length < 3) { files.push({ id: r.id, name: r.name }); drawFiles(); } }).catch(function (e) { err.textContent = e.message; });
          };
          rd.readAsDataURL(file);
        });
        pick.value = "";
      });
      var send = h("button", { class: "btn primary", type: "button", text: "Envoyer à " + cu.email, onclick: function () {
        err.textContent = ""; send.disabled = true;
        c.oapi("POST", "/mail/send", { customerId: cu.id, subject: subj.value, body: msg.value, fileIds: files.map(function (f) { return f.id; }) })
          .then(function (r) { close(); c.toast("E-mail envoyé (" + r.sentToday + " sur " + r.limitPerDay + " aujourd'hui)."); if (tab === "mail") load(); })
          .catch(function (e) { err.textContent = e.message; send.disabled = false; if (e.status === 401) c.fail(e); });
      } });
      b.appendChild(h("label", { class: "fld" }, h("span", { text: "Objet" }), subj));
      b.appendChild(h("label", { class: "fld" }, h("span", { text: "Message" }), msg));
      b.appendChild(h("label", { class: "fld" }, h("span", { text: "Images ou PDF à joindre (3 au maximum, 2 Mo chacun)" }), pick, h("small", { text: "Pour une vidéo, collez plutôt un lien (YouTube, Drive…) dans le message." })));
      b.appendChild(list); b.appendChild(err);
      b.appendChild(h("div", { class: "row", style: "margin-top:12px" }, send, h("button", { class: "btn", type: "button", text: "Annuler", onclick: close })));
      b.appendChild(h("p", { class: "muted small", text: "Rien ne part sans votre clic. Le message est envoyé avec le nom de votre organisation ; le client peut vous répondre directement." }));
    }, { wide: true });
  }

  function showMail() {
    c.clear(body);
    c.oapi("GET", "/mail").then(function (j) {
      c.clear(body);
      body.appendChild(h("div", { class: "kpis" },
        h("div", { class: "stat" + (j.enabled ? "" : " bad") }, h("b", { text: j.enabled ? "Activé" : "Non activé" }), h("span", { text: "envoi d'e-mails" })),
        h("div", { class: "stat" }, h("b", { text: j.sentToday + " / " + j.limitPerDay }), h("span", { text: "e-mails aujourd'hui" })),
        h("div", { class: "stat" }, h("b", { text: String(j.files.length) }), h("span", { text: "fichiers prêts à joindre" }))));
      if (!j.enabled) body.appendChild(h("p", { class: "ws-err", text: "L'envoi d'e-mails n'est pas encore activé sur ce serveur : l'administrateur de la plateforme doit renseigner le serveur d'envoi." }));
      var oc = h("div", { class: "ws-card" }, h("h2", { text: "E-mails envoyés" }));
      if (!j.outbox.length) oc.appendChild(c.empty("Aucun e-mail envoyé. Ouvrez un devis, une facture ou une fiche client pour écrire à un client."));
      j.outbox.forEach(function (o) { oc.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: o.subject }), h("small", { text: " à " + o.toEmail + (o.attachments.length ? " · " + o.attachments.length + " pièce(s) jointe(s)" : "") + (o.sender ? " · par " + o.sender : "") })), h("span", { class: "row" }, h("span", { class: "pill " + (o.status === "sent" ? "good" : "bad"), text: o.status === "sent" ? "Envoyé" : "Échec" }), h("small", { text: c.dateFr(o.at) })))); });
      body.appendChild(oc);
      var fc = h("div", { class: "ws-card" }, h("h2", { text: "Fichiers joints (images, PDF)" }));
      if (!j.files.length) fc.appendChild(c.empty("Les fichiers que vous joignez à un e-mail apparaissent ici."));
      j.files.forEach(function (f) { fc.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: f.name }), h("small", { text: " " + Math.round(f.size / 1024) + " Ko" })), h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer " + f.name + " ?", function () { c.oapi("DELETE", "/mail/files/" + f.id).then(showMail).catch(c.fail); }); } }))); });
      body.appendChild(fc);
    }).catch(c.fail);
  }

  // ----- Proposition commerciale rédigée par l'IA (offre, appel d'offres, prospection, relance de devis) -----
  function proposal() {
    c.modal("Proposition avec l'IA", function (b, close) {
      b.appendChild(h("p", { class: "muted small", text: "Décrivez le besoin ou le marché visé. L'IA rédige un message prêt à envoyer, avec des crochets [comme ceci] là où il manque une information. Elle n'invente ni prix ni référence." }));
      b.appendChild(c.form([
        { k: "kind", label: "Type de message", type: "select", options: [["proposal", "Offre commerciale"], ["tender", "Réponse à un appel d'offres ou à une demande de devis"], ["prospecting", "Prospection (premier contact)"], ["followup", "Relance d'un devis sans réponse"]] },
        { k: "customerId", label: "Client concerné (facultatif)", type: "select", options: [["", "Aucun client précis"]].concat(customers.map(function (x) { return [String(x.id), x.name]; })) },
        { k: "need", label: "Le besoin du client ou le marché visé", type: "textarea", rows: 5, required: true, placeholder: "Ex : il veut 200 chemises pour son équipe avant fin novembre" }
      ], "Rédiger avec l'IA", function (v) {
        close();
        var cu = v.customerId ? customers.filter(function (x) { return String(x.id) === v.customerId; })[0] : null;
        c.propose("sales-proposal", { kind: v.kind, customerId: v.customerId || null, need: v.need }, { title: "Message proposé par l'IA", apply: false, render: function (p, view) {
          var subj = h("input", { type: "text", value: p.subject || "", "aria-label": "Objet" });
          var msg = h("textarea", { rows: 10, "aria-label": "Message", value: p.message || "" });
          view.appendChild(h("label", { class: "fld" }, h("span", { text: "Objet" }), subj));
          view.appendChild(h("label", { class: "fld" }, h("span", { text: "Message (modifiable)" }), msg));
          if (p.note) view.appendChild(h("p", { class: "muted small", text: "À vérifier avant l'envoi : " + p.note }));
          view.appendChild(h("div", { class: "row", style: "margin-top:10px" },
            h("button", { class: "btn primary small", type: "button", text: "Copier le message", onclick: function () { c.copy(msg.value, "Message copié."); } }),
            cu && cu.email ? h("button", { class: "btn small", type: "button", text: "Envoyer par e-mail", onclick: function () { composeMail(cu, { subject: subj.value, body: msg.value }); } }) : null));
          if (cu && !cu.email) view.appendChild(h("p", { class: "muted small", text: "Pour l'envoyer par e-mail, ajoutez l'adresse de " + cu.name + " sur sa fiche." }));
        } });
        return Promise.resolve();
      }));
    });
  }

  load();
} });
