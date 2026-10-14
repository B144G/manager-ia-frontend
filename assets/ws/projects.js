/* Sous-application : Projets et tâches (liste des projets, tableau des tâches, plan par l'IA). */
WS.register({ id: "projects", icon: "projects", render: function (root, c) {
  var h = c.h, members = [], branches = c.S.info.branches;
  var TS = { todo: "À faire", doing: "En cours", done: "Terminé" };
  var PR = { low: "Basse", normal: "Normale", high: "Haute" };
  var view = h("div", {});
  root.appendChild(view);
  c.oapi("GET", "/members").then(function (j) { members = j.members; }, function () {});

  function memberOpts(blank) { return [["", blank || "Personne"]].concat(members.map(function (m) { return [String(m.userId), m.name]; })); }
  function branchOpts() { return [["", "Toute l'organisation"]].concat(branches.map(function (b) { return [String(b.id), b.name]; })); }

  /* ----- Liste des projets ----- */
  function showList() {
    c.clear(view);
    view.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Projets et tâches" }), h("p", { class: "muted", text: "Découpez vos objectifs en tâches et suivez l'avancement." })),
      h("div", { class: "row" },
        c.can("manager") ? h("button", { class: "btn signal small", type: "button", text: "Plan avec l'IA", onclick: aiPlan }) : null,
        c.can("manager") ? h("button", { class: "btn primary small", type: "button", text: "Nouveau projet", onclick: newProject }) : null,
        h("button", { class: "btn small", type: "button", text: "Nouvelle tâche", onclick: function () { newTask(null); } }))));
    var grid = h("div", { class: "ws-grid" }, c.loading());
    view.appendChild(grid);
    var loose = h("div", { class: "ws-card" }, h("h2", { text: "Tâches sans projet et mes tâches" }));
    view.appendChild(loose);
    c.oapi("GET", "/projects").then(function (j) {
      c.clear(grid);
      if (!j.projects.length) grid.appendChild(c.empty(c.can("manager") ? "Aucun projet. Décrivez un objectif à l'IA (« Plan avec l'IA ») ou créez un projet." : "Aucun projet pour l'instant."));
      j.projects.forEach(function (p) {
        var pct = p.tasks ? Math.round(100 * p.done / p.tasks) : 0;
        grid.appendChild(h("button", { type: "button", class: "ws-card pcard" + (p.status === "done" ? " done" : ""), onclick: function () { showProject(p.id); } },
          h("b", { text: p.name }), h("small", { text: p.done + "/" + p.tasks + " tâches" + (p.overdue ? " · " + p.overdue + " en retard" : "") + (p.due ? " · pour le " + c.dateFr(p.due) : "") }),
          h("div", { class: "meter" }, h("i", { style: "width:" + pct + "%" }))));
      });
    }).catch(c.fail);
    c.oapi("GET", "/projects/tasks").then(function (j) {
      var mine = j.tasks.filter(function (t) { return t.status !== "done" && (!t.projectId || t.assigneeId === c.S.info.me.userId); });
      if (!mine.length) loose.appendChild(c.empty("Rien à afficher."));
      mine.slice(0, 20).forEach(function (t) { loose.appendChild(taskLine(t, showList)); });
    }).catch(function () {});
  }

  function newProject() {
    c.modal("Nouveau projet", function (b, close) {
      b.appendChild(c.form([
        { k: "name", label: "Nom du projet", required: true },
        { k: "description", label: "Description", type: "textarea", rows: 3 },
        { k: "due", label: "Échéance", type: "date" },
      ].concat(branches.length ? [{ k: "branchId", label: "Antenne concernée", type: "select", options: branchOpts() }] : []), "Créer", function (v) {
        return c.oapi("POST", "/projects", { name: v.name, description: v.description, due: v.due || null, branchId: v.branchId || null }).then(function (j) { close(); showProject(j.id); });
      }));
    });
  }

  function aiPlan() {
    c.modal("Plan de projet avec l'IA", function (b, close) {
      b.appendChild(c.form([{ k: "goal", label: "Quel objectif voulez-vous atteindre ?", type: "textarea", rows: 4, required: true, placeholder: "Ex : ouvrir une deuxième boutique à Douala avant décembre" }], "Demander un plan", function (v) {
        close();
        c.propose("project-plan", { goal: v.goal }, { title: "Plan proposé", applyText: "Créer le projet et ses tâches", render: function (p, view2) {
          view2.appendChild(h("h3", { text: p.name || "Projet" }));
          if (p.description) view2.appendChild(h("p", { text: p.description }));
          (p.tasks || []).forEach(function (t, i) { view2.appendChild(h("div", { class: "line" }, h("span", { text: (i + 1) + ". " + t.title }), h("small", { text: (PR[t.priority] || "Normale") + (t.dueInDays != null ? " · dans " + t.dueInDays + " j" : "") }))); });
        }, done: function (r) { showProject(r.id); } });
      }));
    });
  }

  /* ----- Un projet ----- */
  function showProject(id) {
    c.clear(view);
    var board = h("div", { class: "kan" }, c.loading());
    var head = h("div", { class: "ws-head" });
    view.appendChild(h("button", { class: "link", type: "button", text: "← Tous les projets", onclick: showList }));
    view.appendChild(head); view.appendChild(board);
    c.oapi("GET", "/projects/" + id).then(function (j) {
      var p = j.project;
      c.clear(head);
      head.appendChild(h("div", {}, h("h1", { text: p.name }), h("p", { class: "muted", text: (p.description || "") + (p.due ? " Échéance : " + c.dateFr(p.due) : "") })));
      head.appendChild(h("div", { class: "row" },
        h("button", { class: "btn primary small", type: "button", text: "Ajouter une tâche", onclick: function () { newTask(p.id, function () { showProject(id); }); } }),
        c.can("manager") ? h("button", { class: "btn small", type: "button", text: p.status === "done" ? "Rouvrir" : "Marquer terminé", onclick: function () { c.oapi("PUT", "/projects/" + id, { status: p.status === "done" ? "active" : "done" }).then(function () { showProject(id); }).catch(c.fail); } }) : null,
        c.can("manager") ? h("button", { class: "btn small", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer ce projet et toutes ses tâches ?", function () { c.oapi("DELETE", "/projects/" + id).then(showList).catch(c.fail); }); } }) : null));
      c.clear(board);
      ["todo", "doing", "done"].forEach(function (s) {
        var col = h("div", { class: "kcol" }, h("h3", { text: TS[s] }));
        var ts = j.tasks.filter(function (t) { return t.status === s; });
        if (!ts.length) col.appendChild(c.empty("—"));
        ts.forEach(function (t) { col.appendChild(taskCard(t, function () { showProject(id); })); });
        board.appendChild(col);
      });
    }).catch(c.fail);
  }

  function setStatus(t, s, again) { c.oapi("PUT", "/projects/tasks/" + t.id, { status: s }).then(again).catch(c.fail); }

  function taskCard(t, again) {
    var late = t.due && t.status !== "done" && t.due < c.today();
    var next = { todo: "doing", doing: "done", done: "todo" }[t.status];
    var nextLabel = { todo: "Démarrer", doing: "Terminer", done: "Rouvrir" }[t.status];
    return h("div", { class: "task p-" + t.priority },
      h("b", { text: t.title }), t.description ? h("p", { class: "small muted", text: t.description }) : null,
      h("small", { class: late ? "late" : "", text: (t.assignee ? t.assignee + " · " : "Non assignée · ") + (t.due ? c.dateFr(t.due) : "sans date") + " · " + PR[t.priority] }),
      h("div", { class: "row" },
        h("button", { class: "btn small", type: "button", text: nextLabel, onclick: function () { setStatus(t, next, again); } }),
        h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editTask(t, again); } })));
  }

  function taskLine(t, again) {
    var late = t.due && t.due < c.today();
    return h("div", { class: "line" }, h("span", {}, t.title, t.project ? h("small", { text: " · " + t.project }) : null),
      h("span", { class: "row" }, h("small", { class: late ? "late" : "", text: t.due ? c.dateFr(t.due) : "" }),
        h("button", { class: "btn small", type: "button", text: "Terminer", onclick: function () { setStatus(t, "done", again); } })));
  }

  function taskFields(t) {
    t = t || {};
    return [
      { k: "title", label: "Tâche", required: true, value: t.title },
      { k: "description", label: "Détail", type: "textarea", rows: 2, value: t.description },
      { k: "assigneeId", label: "Assignée à", type: "select", options: memberOpts("Non assignée"), value: t.assigneeId ? String(t.assigneeId) : "" },
      { k: "priority", label: "Priorité", type: "select", options: [["normal", "Normale"], ["high", "Haute"], ["low", "Basse"]], value: t.priority || "normal" },
      { k: "due", label: "Pour le", type: "date", value: t.due || "" }
    ];
  }
  function newTask(projectId, again) {
    c.modal("Nouvelle tâche", function (b, close) {
      b.appendChild(c.form(taskFields(), "Ajouter", function (v) {
        return c.oapi("POST", "/projects/tasks", { projectId: projectId, title: v.title, description: v.description, assigneeId: v.assigneeId || null, priority: v.priority, due: v.due || null }).then(function () { close(); (again || showList)(); });
      }));
    });
  }
  function editTask(t, again) {
    c.modal("Modifier la tâche", function (b, close) {
      b.appendChild(c.form(taskFields(t), "Enregistrer", function (v) {
        return c.oapi("PUT", "/projects/tasks/" + t.id, { title: v.title, description: v.description, assigneeId: v.assigneeId || null, priority: v.priority, due: v.due || null }).then(function () { close(); again(); });
      }, h("button", { class: "btn", type: "button", text: "Supprimer", onclick: function () { c.oapi("DELETE", "/projects/tasks/" + t.id).then(function () { close(); again(); }).catch(c.fail); } })));
    });
  }

  showList();
} });
