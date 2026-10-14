/* Sous-application : Stock et achats (articles, entrées/sorties, fournisseurs et prix, commandes à valider, propositions de l'IA). */
WS.register({ id: "stock", icon: "stock", render: function (root, c) {
  var h = c.h, info = c.S.info, branches = info.branches, mgr = c.can("manager");
  var STATE = { out: ["Rupture", "bad"], low: ["Sous le seuil", "mid"], ok: ["", ""] };
  var ORDER = { pending: ["À valider", "mid"], ordered: ["Commandée", "good"], received: ["Reçue", "good"], cancelled: ["Annulée", "bad"] };
  var body = h("div", {});

  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Stock et achats" }), h("p", { class: "muted", text: "Vos articles, vos fournisseurs et vos commandes, avec des alertes avant la rupture." })),
    h("div", { class: "row" },
      mgr ? h("button", { class: "btn signal small", type: "button", text: "Commandes avec l'IA", onclick: aiOrders }) : null,
      mgr ? h("button", { class: "btn small", type: "button", text: "Commander ce qui manque", onclick: reorder }) : null,
      mgr ? h("button", { class: "btn small", type: "button", text: "Fournisseurs", onclick: suppliers }) : null,
      mgr ? h("button", { class: "btn primary small", type: "button", text: "Ajouter un article", onclick: function () { editItem(); } }) : null)));
  root.appendChild(body);

  function pill(t) { return t && t[0] ? h("span", { class: "pill " + t[1], text: t[0] }) : null; }
  function qty(n) { return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 3 }); }

  function load() {
    c.clear(body); body.appendChild(c.loading());
    Promise.all([c.oapi("GET", "/stock"), c.oapi("GET", "/stock/orders")]).then(function (res) {
      var j = res[0], orders = res[1].orders;
      c.clear(body);
      var s = j.summary;
      body.appendChild(h("div", { class: "kpis" },
        h("div", { class: "stat" }, h("b", { text: String(s.count) }), h("span", { text: "articles" })),
        h("div", { class: "stat" + (s.low ? " bad" : "") }, h("b", { text: String(s.low) }), h("span", { text: "sous le seuil" })),
        h("div", { class: "stat" + (s.out ? " bad" : "") }, h("b", { text: String(s.out) }), h("span", { text: "en rupture" })),
        s.value !== undefined ? h("div", { class: "stat" }, h("b", { text: c.money(s.value) }), h("span", { text: "valeur du stock" })) : h("div", { class: "stat" }, h("b", { text: String(j.pendingOrders) }), h("span", { text: "commande(s) à valider" }))));

      var card = h("div", { class: "ws-card" }, h("h2", { text: "Articles" }));
      if (!j.items.length) card.appendChild(c.empty(mgr ? "Aucun article. Ajoutez le premier, ou demandez à l'IA comment démarrer." : "Aucun article pour le moment."));
      j.items.forEach(function (it) {
        card.appendChild(h("div", { class: "line" },
          h("span", {}, h("b", { text: it.name }), " ", pill(STATE[it.state]),
            h("small", { text: " " + qty(it.quantity) + " " + it.unit + (it.minQuantity ? " · seuil " + qty(it.minQuantity) : "") + (mgr && it.best ? " · meilleur prix " + c.money(it.best.unitPrice) + " (" + it.best.supplier + ")" : "") })),
          h("span", { class: "row" },
            h("button", { class: "link", type: "button", text: "Entrée", onclick: function () { move(it, "in"); } }),
            h("button", { class: "link", type: "button", text: "Sortie", onclick: function () { move(it, "out"); } }),
            h("button", { class: "link", type: "button", text: "Historique", onclick: function () { history(it); } }),
            mgr ? h("button", { class: "link", type: "button", text: "Prix", onclick: function () { prices(it); } }) : null,
            mgr ? h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editItem(it); } }) : null,
            mgr ? h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer « " + it.name + " » ?", function () { c.oapi("DELETE", "/stock/items/" + it.id).then(load).catch(c.fail); }); } }) : null)));
      });
      body.appendChild(card);

      var oc = h("div", { class: "ws-card" }, h("h2", { text: "Commandes" }));
      if (!orders.length) oc.appendChild(c.empty("Aucune commande."));
      orders.forEach(function (o) {
        oc.appendChild(h("div", { class: "line" },
          h("span", {}, h("b", { text: o.item + " × " + qty(o.quantity) }), " ", pill(ORDER[o.status]), h("small", { text: " " + (o.supplier || "fournisseur à choisir") + (o.unitPrice ? " · " + c.money(o.total) : "") + " · " + c.dateFr(o.at) })),
          mgr ? h("span", { class: "row" },
            o.status === "pending" ? h("button", { class: "link", type: "button", text: "Valider", onclick: function () { setStatus(o, "ordered"); } }) : null,
            o.status === "ordered" ? h("button", { class: "link", type: "button", text: "Marquer reçue", onclick: function () { setStatus(o, "received"); } }) : null,
            o.status === "pending" || o.status === "ordered" ? h("button", { class: "link", type: "button", text: "Annuler", onclick: function () { c.confirm("Annuler cette commande ?", function () { setStatus(o, "cancelled"); }); } }) : null) : null));
      });
      body.appendChild(oc);
      body.appendChild(h("p", { class: "muted small", text: "Une commande est d'abord « à valider » : l'IA et l'équipe proposent, un responsable décide. À la réception, le stock augmente et la dépense est inscrite au budget." }));
    }).catch(c.fail);
  }

  function setStatus(o, status) { c.oapi("PUT", "/stock/orders/" + o.id + "/status", { status: status }).then(function () { c.refreshBadges && c.refreshBadges(); load(); }).catch(c.fail); }

  function move(it, kind) {
    c.modal((kind === "in" ? "Entrée : " : "Sortie : ") + it.name, function (b, close) {
      b.appendChild(c.form([
        { k: "quantity", label: "Quantité (" + it.unit + ")", required: true, placeholder: "10", hint: "En stock : " + qty(it.quantity) + " " + it.unit },
        { k: "reason", label: "Motif", placeholder: kind === "in" ? "Livraison, retour…" : "Vente, perte, usage…" }
      ], "Enregistrer", function (v) { return c.oapi("POST", "/stock/items/" + it.id + "/move", { kind: kind, quantity: v.quantity, reason: v.reason }).then(function () { close(); load(); }); }));
    });
  }

  function history(it) {
    c.modal("Historique : " + it.name, function (b) {
      var box = h("div", {}, c.loading()); b.appendChild(box);
      c.oapi("GET", "/stock/items/" + it.id + "/moves").then(function (j) {
        c.clear(box);
        if (!j.moves.length) box.appendChild(c.empty("Aucun mouvement."));
        j.moves.forEach(function (m) { box.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { class: m.delta > 0 ? "ok" : "", text: (m.delta > 0 ? "+" : "−") + qty(Math.abs(m.delta)) }), h("small", { text: " " + m.reason + (m.name ? " · " + m.name : "") })), h("small", { text: c.dateFr(m.at) }))); });
      }).catch(function (e) { box.textContent = e.message; });
    });
  }

  function editItem(it) {
    it = it || {};
    c.modal(it.id ? "Modifier l'article" : "Nouvel article", function (b, close) {
      var f = [{ k: "name", label: "Nom", required: true, value: it.name }, { k: "unit", label: "Unité", value: it.unit || "pièce", placeholder: "pièce, kg, litre, carton…" }];
      if (!it.id) f.push({ k: "quantity", label: "Quantité en stock", value: "0" });
      f.push({ k: "minQuantity", label: "Seuil d'alerte", value: it.minQuantity || "0", hint: "Sous cette quantité, MANAGER-IA vous alerte et propose de commander. 0 = pas d'alerte." });
      f.push({ k: "unitCost", label: "Coût d'achat habituel (" + info.org.currency + ")", value: it.unitCost || "" });
      if (branches.length && !it.id) f.push({ k: "branchId", label: "Antenne", type: "select", options: [["", "Toute l'organisation"]].concat(branches.map(function (x) { return [String(x.id), x.name]; })) });
      b.appendChild(c.form(f, "Enregistrer", function (v) {
        var p = { name: v.name, unit: v.unit, minQuantity: v.minQuantity, unitCost: v.unitCost };
        if (!it.id) { p.quantity = v.quantity; if (v.branchId) p.branchId = v.branchId; }
        return c.oapi(it.id ? "PUT" : "POST", "/stock/items" + (it.id ? "/" + it.id : ""), p).then(function () { close(); load(); });
      }));
    });
  }

  // ----- Fournisseurs et prix -----
  function suppliers() {
    c.modal("Fournisseurs", function (b, close) {
      var box = h("div", {}, c.loading());
      b.appendChild(box);
      b.appendChild(h("button", { class: "btn primary small", type: "button", text: "Ajouter un fournisseur", onclick: function () { editSupplier(null, draw); } }));
      function draw() {
        c.oapi("GET", "/stock/suppliers").then(function (j) {
          c.clear(box);
          if (!j.suppliers.length) box.appendChild(c.empty("Aucun fournisseur."));
          j.suppliers.forEach(function (s) {
            box.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: s.name }), s.contact ? h("small", { text: " " + s.contact }) : null),
              h("span", { class: "row" }, h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editSupplier(s, draw); } }),
                h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer " + s.name + " ?", function () { c.oapi("DELETE", "/stock/suppliers/" + s.id).then(draw).catch(c.fail); }); } }))));
          });
        }).catch(c.fail);
      }
      draw();
    });
  }
  function editSupplier(s, done) {
    s = s || {};
    c.modal(s.id ? "Modifier le fournisseur" : "Nouveau fournisseur", function (b, close) {
      b.appendChild(c.form([{ k: "name", label: "Nom", required: true, value: s.name }, { k: "contact", label: "Contact (téléphone, WhatsApp)", value: s.contact }, { k: "notes", label: "Notes", type: "textarea", rows: 3, value: s.notes, hint: "Fiabilité, conditions de paiement, jours de livraison…" }],
        "Enregistrer", function (v) { return c.oapi(s.id ? "PUT" : "POST", "/stock/suppliers" + (s.id ? "/" + s.id : ""), v).then(function () { close(); done(); }); }));
    });
  }

  function prices(it) {
    Promise.all([c.oapi("GET", "/stock/suppliers"), c.oapi("GET", "/stock/items/" + it.id + "/prices")]).then(function (res) {
      var sup = res[0].suppliers, cur = {};
      res[1].prices.forEach(function (p) { cur[p.supplierId] = p; });
      c.modal("Prix : " + it.name, function (b, close) {
        if (!sup.length) { b.appendChild(c.empty("Ajoutez d'abord un fournisseur (bouton « Fournisseurs »).")); return; }
        var f = [];
        sup.forEach(function (s) {
          f.push({ k: "p" + s.id, label: s.name + " : prix unitaire (" + info.org.currency + ")", value: cur[s.id] ? cur[s.id].unitPrice : "", hint: "Laissez vide si ce fournisseur ne vend pas cet article." });
          f.push({ k: "d" + s.id, label: s.name + " : délai de livraison (jours)", value: cur[s.id] && cur[s.id].leadDays != null ? cur[s.id].leadDays : "" });
        });
        b.appendChild(c.form(f, "Enregistrer", function (v) {
          var list = [];
          sup.forEach(function (s) { if (String(v["p" + s.id]).trim()) list.push({ supplierId: s.id, unitPrice: v["p" + s.id], leadDays: v["d" + s.id] }); });
          return c.oapi("PUT", "/stock/items/" + it.id + "/prices", { prices: list }).then(function () { close(); load(); });
        }));
      });
    }).catch(c.fail);
  }

  // ----- Commandes -----
  function reorder() {
    c.oapi("GET", "/stock/reorder").then(function (j) {
      c.modal("Commander ce qui manque", function (b, close) {
        if (!j.suggestions.length) { b.appendChild(c.empty("Rien à commander : aucun article n'est sous son seuil, ou tout est déjà commandé.")); return; }
        b.appendChild(h("p", { class: "muted small", text: "Quantité conseillée : de quoi revenir à environ le double du seuil. Les commandes créées seront « à valider »." }));
        j.suggestions.forEach(function (s) {
          b.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: s.name + " × " + qty(s.toOrder) + " " + s.unit }), h("small", { text: " (en stock : " + qty(s.quantity) + ", seuil " + qty(s.minQuantity) + ")" })),
            h("small", { text: s.best ? s.best.supplier + " · " + c.money(s.best.unitPrice) : "aucun prix connu" })));
        });
        b.appendChild(h("div", { class: "row", style: "margin-top:16px" },
          h("button", { class: "btn primary", type: "button", text: "Créer les commandes à valider", onclick: function (ev) {
            ev.target.disabled = true;
            c.oapi("POST", "/stock/orders", { orders: j.suggestions.map(function (s) { return { itemId: s.itemId, quantity: s.toOrder, supplierId: s.best ? s.best.supplierId : null }; }) }).then(function () { close(); c.toast ? c.toast("Commandes créées.") : 0; load(); }).catch(function (e) { ev.target.disabled = false; c.fail(e); });
          } }),
          h("button", { class: "btn", type: "button", text: "Fermer", onclick: close })));
      });
    }).catch(c.fail);
  }

  function aiOrders() {
    c.propose("reorder", {}, { title: "Commandes proposées par l'IA", applyText: "Créer les commandes à valider", done: load, render: function (p, v) {
      var list = p.orders || [];
      if (!list.length) v.appendChild(c.empty("L'IA ne voit rien à commander pour le moment."));
      list.forEach(function (o) { v.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: o.item + " × " + o.quantity }), o.why ? h("small", { text: " " + o.why }) : null), h("small", { text: o.supplier || "fournisseur à choisir" }))); });
      (p.advice || []).forEach(function (a) { v.appendChild(h("p", { class: "muted small", text: "• " + a })); });
    } });
  }

  load();
} });
