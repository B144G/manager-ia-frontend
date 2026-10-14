/* Sous-application : Fonctionnement (procédures : comment l'activité tourne, étape par étape). */
WS.register({ id: "processes", icon: "processes", render: function (root, c) {
  var h = c.h;
  var body = h("div", {});
  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Fonctionnement" }), h("p", { class: "muted", text: "Les procédures de votre activité, pour que tout tourne même en votre absence." })),
    c.can("admin") ? h("div", { class: "row" },
      h("button", { class: "btn signal small", type: "button", text: "Rédiger avec l'IA", onclick: aiDraft }),
      h("button", { class: "btn primary small", type: "button", text: "Nouvelle procédure", onclick: function () { edit(); } })) : null));
  root.appendChild(body);

  function load() {
    c.clear(body); body.appendChild(c.loading());
    c.oapi("GET", "/structure/processes").then(function (j) {
      c.clear(body);
      if (!j.processes.length) { body.appendChild(c.empty(c.can("admin") ? "Aucune procédure. Demandez à l'IA d'en rédiger une (accueil client, ouverture de la boutique, gestion du stock…)." : "Aucune procédure pour l'instant.")); return; }
      var groups = {};
      j.processes.forEach(function (p) { (groups[p.category || "Général"] = groups[p.category || "Général"] || []).push(p); });
      Object.keys(groups).forEach(function (cat) {
        var card = h("div", { class: "ws-card" }, h("h2", { text: cat }));
        groups[cat].forEach(function (p) {
          card.appendChild(h("details", { class: "proc" }, h("summary", {}, p.title, h("small", { text: " · " + p.steps.length + " étapes" })),
            h("ol", {}, p.steps.map(function (s) { return h("li", { text: s }); })),
            c.can("admin") ? h("div", { class: "row" }, h("button", { class: "btn small", type: "button", text: "Modifier", onclick: function () { edit(p); } }),
              h("button", { class: "btn small", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer cette procédure ?", function () { c.oapi("DELETE", "/structure/processes/" + p.id).then(load).catch(c.fail); }); } })) : null));
        });
        body.appendChild(card);
      });
    }).catch(c.fail);
  }

  function edit(p) {
    p = p || {};
    c.modal(p.id ? "Modifier la procédure" : "Nouvelle procédure", function (b, close) {
      b.appendChild(c.form([
        { k: "title", label: "Titre", required: true, value: p.title }, { k: "category", label: "Catégorie", value: p.category, placeholder: "Ventes, Accueil, Stock…" },
        { k: "steps", label: "Étapes (une par ligne)", type: "textarea", rows: 8, required: true, value: (p.steps || []).join("\n") }
      ], "Enregistrer", function (v) {
        var body = { title: v.title, category: v.category, steps: v.steps.split("\n").map(function (s) { return s.trim(); }).filter(Boolean) };
        return c.oapi(p.id ? "PUT" : "POST", "/structure/processes" + (p.id ? "/" + p.id : ""), body).then(function () { close(); load(); });
      }));
    });
  }

  function aiDraft() {
    c.modal("Procédure rédigée par l'IA", function (b, close) {
      b.appendChild(c.form([{ k: "topic", label: "Quelle procédure ?", required: true, placeholder: "Ex : accueillir et encaisser un client en boutique" }], "Rédiger", function (v) {
        close();
        c.propose("process-draft", { topic: v.topic }, { title: "Procédure proposée", applyText: "Enregistrer cette procédure", render: function (p, view) {
          view.appendChild(h("h3", { text: p.title })); if (p.category) view.appendChild(h("p", { class: "muted small", text: p.category }));
          view.appendChild(h("ol", {}, (p.steps || []).map(function (s) { return h("li", { text: s }); })));
        }, done: load });
      }));
    });
  }
  load();
} });
