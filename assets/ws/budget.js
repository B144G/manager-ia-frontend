/* Sous-application : Budget (entrées, sorties, limites par catégorie, conseils de l'IA). Réservée aux responsables et plus. */
WS.register({ id: "budget", icon: "budget", render: function (root, c) {
  var h = c.h, month = new Date().toISOString().slice(0, 7), branches = c.S.info.branches;
  var body = h("div", {});
  var monthIn = h("input", { type: "month", value: month, "aria-label": "Mois", onchange: function (e) { if (e.target.value) { month = e.target.value; load(); } } });

  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Budget" }), h("p", { class: "muted", text: "Vos entrées et sorties d'argent, mois par mois." })),
    h("div", { class: "row" }, monthIn,
      c.can("admin") ? h("button", { class: "btn signal small", type: "button", text: "Limites avec l'IA", onclick: aiPlan }) : null,
      c.can("admin") ? h("button", { class: "btn small", type: "button", text: "Limites", onclick: editPlans }) : null,
      h("button", { class: "btn primary small", type: "button", text: "Ajouter une ligne", onclick: function () { addEntry(); } }))));
  root.appendChild(body);

  function load() {
    c.clear(body); body.appendChild(c.loading());
    c.oapi("GET", "/budget?month=" + month).then(function (j) {
      c.clear(body);
      body.appendChild(h("div", { class: "kpis" },
        h("div", { class: "stat" }, h("b", { class: "ok", text: c.money(j.income) }), h("span", { text: "entrées" })),
        h("div", { class: "stat" }, h("b", { text: c.money(j.expense) }), h("span", { text: "sorties" })),
        h("div", { class: "stat" + (j.balance < 0 ? " bad" : "") }, h("b", { text: c.money(j.balance) }), h("span", { text: "solde du mois" }))));

      var cats = h("div", { class: "ws-card" }, h("h2", { text: "Dépenses par catégorie" }));
      if (!j.categories.length) cats.appendChild(c.empty("Aucune dépense ce mois-ci."));
      j.categories.forEach(function (k) {
        var pct = k.limit ? Math.min(100, Math.round(100 * k.spent / k.limit)) : 0;
        cats.appendChild(h("div", { class: "cat" }, h("div", { class: "line" }, h("span", { text: k.category }), h("small", { class: k.limit && k.spent > k.limit ? "late" : "", text: c.money(k.spent) + (k.limit ? " / " + c.money(k.limit) : " (pas de limite)") })),
          k.limit ? h("div", { class: "meter" + (k.spent > k.limit ? " over" : "") }, h("i", { style: "width:" + pct + "%" })) : null));
      });
      body.appendChild(cats);

      var tbl = h("div", { class: "ws-card" }, h("h2", { text: "Lignes du mois" }));
      if (!j.entries.length) tbl.appendChild(c.empty("Aucune ligne."));
      j.entries.forEach(function (e) {
        tbl.appendChild(h("div", { class: "line" },
          h("span", {}, h("b", { class: e.kind === "income" ? "ok" : "", text: (e.kind === "income" ? "+ " : "− ") + c.money(e.amount) }), " ", e.category, e.label ? h("small", { text: " · " + e.label }) : null),
          h("span", { class: "row" }, h("small", { text: c.dateFr(e.date) }),
            h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { addEntry(e); } }),
            h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer cette ligne ?", function () { c.oapi("DELETE", "/budget/entries/" + e.id).then(load).catch(c.fail); }); } }))));
      });
      body.appendChild(tbl);
      body.appendChild(h("p", { class: "muted small", text: "Les conseils de l'IA sont des repères de gestion, pas des conseils comptables ou fiscaux." }));
    }).catch(c.fail);
  }

  function addEntry(e) {
    e = e || {};
    c.modal(e.id ? "Modifier la ligne" : "Nouvelle ligne", function (b, close) {
      var f = [
        { k: "kind", label: "Type", type: "select", options: [["expense", "Sortie (dépense)"], ["income", "Entrée (recette)"]], value: e.kind || "expense" },
        { k: "category", label: "Catégorie", required: true, value: e.category, placeholder: "Loyer, Salaires, Ventes, Transport…" },
        { k: "amount", label: "Montant (" + c.S.info.org.currency + ")", required: true, value: e.amount, placeholder: "25000" },
        { k: "label", label: "Détail", value: e.label },
        { k: "date", label: "Date", type: "date", value: e.date || c.today() }
      ];
      if (branches.length && !e.id) f.push({ k: "branchId", label: "Antenne", type: "select", options: [["", "Toute l'organisation"]].concat(branches.map(function (x) { return [String(x.id), x.name]; })) });
      b.appendChild(c.form(f, "Enregistrer", function (v) {
        var payload = { kind: v.kind, category: v.category, amount: v.amount, label: v.label, date: v.date };
        if (v.branchId) payload.branchId = v.branchId;
        return c.oapi(e.id ? "PUT" : "POST", "/budget/entries" + (e.id ? "/" + e.id : ""), payload).then(function () { close(); load(); });
      }));
    });
  }

  function editPlans() {
    c.oapi("GET", "/budget?month=" + month).then(function (j) {
      var text = Object.keys(j.plans).map(function (k) { return k + " : " + j.plans[k]; }).join("\n");
      c.modal("Limites mensuelles par catégorie", function (b, close) {
        b.appendChild(c.form([{ k: "t", label: "Une ligne par catégorie", type: "textarea", rows: 8, value: text, hint: "Format : Catégorie : montant (ex : Loyer : 60000). Remplace les limites actuelles." }], "Enregistrer", function (v) {
          var plans = v.t.split("\n").map(function (l) { var m = /^(.+?)\s*:\s*([\d\s.,]+)$/.exec(l.trim()); return m ? { category: m[1].trim(), monthlyLimit: m[2] } : null; }).filter(Boolean);
          return c.oapi("PUT", "/budget/plans", { plans: plans }).then(function () { close(); load(); });
        }));
      });
    }).catch(c.fail);
  }

  function aiPlan() {
    c.propose("budget-plan", {}, { title: "Limites proposées par l'IA", applyText: "Remplacer mes limites", render: function (p, v) {
      if (!(p.plans || []).length) v.appendChild(c.empty("L'IA n'a pas assez de données pour proposer des limites."));
      (p.plans || []).forEach(function (x) { v.appendChild(h("div", { class: "line" }, h("span", { text: x.category }), h("b", { text: c.money(x.monthlyLimit) + " / mois" }))); });
      (p.advice || []).forEach(function (a) { v.appendChild(h("p", { class: "small", text: "• " + a })); });
    }, done: load });
  }
  load();
} });
