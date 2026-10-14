/* Sous-application : Organisation (fiche de l'organisation, organigramme des postes, complétion par l'IA). */
WS.register({ id: "structure", icon: "structure", render: function (root, c) {
  var h = c.h, members = [], positions = [];
  var org = c.S.info.org;
  var chart = h("div", { class: "ws-card" }, c.loading());

  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Organisation" }), h("p", { class: "muted", text: "Qui fait quoi, et qui rend compte à qui." })),
    c.can("admin") ? h("div", { class: "row" },
      h("button", { class: "btn signal small", type: "button", text: "Compléter avec l'IA", onclick: aiComplete }),
      h("button", { class: "btn primary small", type: "button", text: "Ajouter un poste", onclick: function () { editPos(); } })) : null));

  var profile = h("div", { class: "ws-card" }, h("h2", { text: org.name }),
    h("p", { class: "muted", text: [org.sector, org.currency].filter(Boolean).join(" · ") }),
    h("p", { text: org.description || "Aucune présentation. Décrivez votre activité : l'IA s'en sert pour mieux vous conseiller." }),
    c.can("admin") ? h("button", { class: "btn small", type: "button", text: "Modifier la fiche", onclick: editOrg }) : null);
  root.appendChild(profile);
  root.appendChild(chart);
  c.oapi("GET", "/members").then(function (j) { members = j.members; }, function () {});

  function editOrg() {
    c.modal("Fiche de l'organisation", function (b, close) {
      b.appendChild(c.form([
        { k: "name", label: "Nom", required: true, value: org.name }, { k: "sector", label: "Secteur", value: org.sector },
        { k: "description", label: "Description de l'activité", type: "textarea", rows: 4, value: org.description }, { k: "currency", label: "Monnaie", value: org.currency }
      ], "Enregistrer", function (v) { return c.oapi("PUT", "", v).then(function () { close(); c.reloadOrg(); }); }));
    });
  }

  function load() {
    c.oapi("GET", "/structure/positions").then(function (j) {
      positions = j.positions;
      c.clear(chart);
      chart.appendChild(h("h2", { text: "Organigramme" }));
      if (!positions.length) { chart.appendChild(c.empty(c.can("admin") ? "Aucun poste défini. Ajoutez-en un, ou laissez l'IA proposer une structure." : "Aucun poste défini pour l'instant.")); return; }
      var ids = {}; positions.forEach(function (p) { ids[p.id] = true; });
      function node(p) {
        var kids = positions.filter(function (x) { return x.parentId === p.id; });
        var li = h("li", {}, h("div", { class: "pos" + (p.holder ? "" : " free") },
          h("b", { text: p.title }), h("small", { text: p.holder ? p.holder : "Poste libre" }), p.description ? h("p", { class: "small muted", text: p.description }) : null,
          c.can("admin") ? h("span", { class: "row" }, h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editPos(p); } }),
            h("button", { class: "link", type: "button", text: "+ sous ce poste", onclick: function () { editPos(null, p.id); } })) : null));
        if (kids.length) li.appendChild(h("ul", {}, kids.map(node)));
        return li;
      }
      var roots = positions.filter(function (p) { return !p.parentId || !ids[p.parentId]; });
      chart.appendChild(h("ul", { class: "tree" }, roots.map(node)));
    }).catch(c.fail);
  }

  function editPos(p, parent) {
    p = p || {};
    var parents = [["", "Aucun (sommet)"]].concat(positions.filter(function (x) { return x.id !== p.id; }).map(function (x) { return [String(x.id), x.title]; }));
    c.modal(p.id ? "Modifier le poste" : "Nouveau poste", function (b, close) {
      b.appendChild(c.form([
        { k: "title", label: "Intitulé du poste", required: true, value: p.title },
        { k: "description", label: "Responsabilités", type: "textarea", rows: 3, value: p.description },
        { k: "parentId", label: "Rend compte à", type: "select", options: parents, value: String(p.parentId || parent || "") },
        { k: "holderId", label: "Tenu par", type: "select", options: [["", "Poste libre"]].concat(members.map(function (m) { return [String(m.userId), m.name]; })), value: p.holderId ? String(p.holderId) : "" }
      ], "Enregistrer", function (v) {
        var body = { title: v.title, description: v.description, parentId: v.parentId || null, holderId: v.holderId || null };
        return c.oapi(p.id ? "PUT" : "POST", "/structure/positions" + (p.id ? "/" + p.id : ""), body).then(function () { close(); load(); });
      }, p.id ? h("button", { class: "btn", type: "button", text: "Supprimer", onclick: function () { c.oapi("DELETE", "/structure/positions/" + p.id).then(function () { close(); load(); }).catch(c.fail); } }) : null));
    });
  }

  function aiComplete() {
    c.modal("Compléter l'organigramme avec l'IA", function (b, close) {
      b.appendChild(c.form([{ k: "context", label: "Précisions (facultatif)", type: "textarea", rows: 3, placeholder: "Ex : nous prévoyons d'ouvrir 2 antennes l'an prochain" }], "Demander une proposition", function (v) {
        close();
        c.propose("org-structure", { context: v.context }, { title: "Postes proposés", applyText: "Ajouter ces postes", render: function (p, view) {
          (p.positions || []).forEach(function (x) { view.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: x.title }), h("small", { text: " — " + (x.description || "") })), h("small", { text: x.reportsTo ? "→ " + x.reportsTo : "sommet" }))); });
        }, done: load });
      }));
    });
  }
  load();
} });
