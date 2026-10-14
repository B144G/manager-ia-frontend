/* Sous-application : Ressources humaines (employés, congés à valider, planning de la semaine). Réservée aux responsables et plus. */
WS.register({ id: "hr", icon: "hr", render: function (root, c) {
  var h = c.h, info = c.S.info, branches = info.branches, tab = "staff", week = null, emps = [];
  var LEAVE = { annual: "Congé annuel", sick: "Maladie", other: "Autre" };
  var LST = { pending: ["À traiter", "mid"], approved: ["Accepté", "good"], refused: ["Refusé", "bad"] };
  var DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  var tabs = h("div", { class: "ws-tabs" }), body = h("div", {});

  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Ressources humaines" }), h("p", { class: "muted", text: "Votre équipe, ses congés et son planning." })),
    h("div", { class: "row" },
      h("button", { class: "btn small", type: "button", text: "Demander un congé", onclick: function () { editLeave(); } }),
      h("button", { class: "btn primary small", type: "button", text: "Ajouter un employé", onclick: function () { editEmp(); } }))));
  root.appendChild(tabs);
  root.appendChild(body);

  function pill(t) { return h("span", { class: "pill " + t[1], text: t[0] }); }
  function drawTabs(pending) {
    c.clear(tabs);
    [["staff", "Employés"], ["leaves", "Congés" + (pending ? " (" + pending + ")" : "")], ["plan", "Planning"]].forEach(function (t) {
      tabs.appendChild(h("button", { type: "button", class: "tab" + (tab === t[0] ? " on" : ""), text: t[1], onclick: function () { tab = t[0]; load(); } }));
    });
  }

  function load() {
    c.clear(body); body.appendChild(c.loading());
    c.oapi("GET", "/hr").then(function (j) {
      emps = j.employees;
      drawTabs(j.summary.pendingLeaves);
      if (tab === "staff") return showStaff(j);
      if (tab === "leaves") return showLeaves();
      return showPlan();
    }).catch(c.fail);
  }

  function showStaff(j) {
    c.clear(body);
    var s = j.summary;
    body.appendChild(h("div", { class: "kpis" },
      h("div", { class: "stat" }, h("b", { text: String(s.active) }), h("span", { text: "en poste" })),
      h("div", { class: "stat" }, h("b", { text: String(s.onLeave) }), h("span", { text: "en congé aujourd'hui" })),
      h("div", { class: "stat" + (s.pendingLeaves ? " bad" : "") }, h("b", { text: String(s.pendingLeaves) }), h("span", { text: "demande(s) de congé" })),
      s.payroll !== undefined ? h("div", { class: "stat" }, h("b", { text: c.money(s.payroll) }), h("span", { text: "masse salariale / mois" })) : h("div", { class: "stat" }, h("b", { text: String(j.employees.length) }), h("span", { text: "fiches" }))));
    var card = h("div", { class: "ws-card" }, h("h2", { text: "Employés" }));
    if (!j.employees.length) card.appendChild(c.empty("Aucun employé. Ajoutez votre équipe pour faire un planning et suivre les congés."));
    j.employees.forEach(function (e) {
      card.appendChild(h("div", { class: "line" },
        h("span", {}, h("b", { text: e.name }), e.status === "left" ? h("span", { class: "pill bad", text: "Parti" }) : null,
          h("small", { text: " " + [e.job, e.phone, e.hiredAt ? "depuis le " + c.dateFr(e.hiredAt) : "", e.salary ? c.money(e.salary) + "/mois" : ""].filter(Boolean).join(" · ") })),
        h("span", { class: "row" },
          h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editEmp(e); } }),
          c.can("admin") ? h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer la fiche de " + e.name + " ? Ses congés et horaires seront aussi supprimés.", function () { c.oapi("DELETE", "/hr/employees/" + e.id).then(load).catch(c.fail); }); } }) : null)));
    });
    body.appendChild(card);
    body.appendChild(h("p", { class: "muted small", text: c.can("admin") ? "Les salaires ne sont visibles que par les administrateurs et le propriétaire." : "Les salaires sont réservés aux administrateurs et au propriétaire." }));
  }

  function editEmp(e) {
    e = e || {};
    c.modal(e.id ? "Modifier l'employé" : "Nouvel employé", function (b, close) {
      var f = [{ k: "name", label: "Nom", required: true, value: e.name }, { k: "job", label: "Poste", value: e.job }, { k: "phone", label: "Téléphone", value: e.phone }, { k: "hiredAt", label: "Date d'embauche", type: "date", value: e.hiredAt || "" }];
      if (c.can("admin")) f.push({ k: "salary", label: "Salaire mensuel (" + info.org.currency + ")", value: e.salary || "" });
      if (e.id) f.push({ k: "status", label: "Situation", type: "select", options: [["active", "En poste"], ["left", "Parti"]], value: e.status });
      else if (branches.length) f.push({ k: "branchId", label: "Antenne", type: "select", options: [["", "Toute l'organisation"]].concat(branches.map(function (x) { return [String(x.id), x.name]; })) });
      b.appendChild(c.form(f, "Enregistrer", function (v) {
        var p = { name: v.name, job: v.job, phone: v.phone, hiredAt: v.hiredAt || null };
        if (c.can("admin")) p.salary = v.salary;
        if (e.id) p.status = v.status; else if (v.branchId) p.branchId = v.branchId;
        return c.oapi(e.id ? "PUT" : "POST", "/hr/employees" + (e.id ? "/" + e.id : ""), p).then(function () { close(); load(); });
      }));
    });
  }

  // ----- Congés -----
  function showLeaves() {
    c.clear(body); body.appendChild(c.loading());
    c.oapi("GET", "/hr/leaves").then(function (j) {
      c.clear(body);
      var card = h("div", { class: "ws-card" }, h("h2", { text: "Demandes de congé" }));
      if (!j.leaves.length) card.appendChild(c.empty("Aucune demande de congé."));
      j.leaves.forEach(function (l) {
        card.appendChild(h("div", { class: "line" },
          h("span", {}, h("b", { text: l.employee }), " ", pill(LST[l.status]), h("small", { text: " " + LEAVE[l.kind] + " · du " + c.dateFr(l.start) + " au " + c.dateFr(l.end) + " (" + l.days + " j)" + (l.note ? " · " + l.note : "") })),
          h("span", { class: "row" },
            l.status === "pending" ? h("button", { class: "link", type: "button", text: "Accepter", onclick: function () { decide(l, "approved"); } }) : null,
            l.status === "pending" ? h("button", { class: "link", type: "button", text: "Refuser", onclick: function () { decide(l, "refused"); } }) : null,
            h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer cette demande ?", function () { c.oapi("DELETE", "/hr/leaves/" + l.id).then(load).catch(c.fail); }); } }))));
      });
      body.appendChild(card);
      body.appendChild(h("p", { class: "muted small", text: "Avant d'accepter, regardez le planning : l'IA peut vous dire qui d'autre sera absent." }));
    }).catch(c.fail);
  }
  function decide(l, decision) { c.oapi("PUT", "/hr/leaves/" + l.id + "/decision", { decision: decision }).then(load).catch(c.fail); }

  function editLeave() {
    var active = emps.filter(function (e) { return e.status === "active"; });
    c.modal("Demande de congé", function (b, close) {
      if (!active.length) { b.appendChild(c.empty("Ajoutez d'abord un employé.")); return; }
      b.appendChild(c.form([
        { k: "employeeId", label: "Employé", type: "select", options: active.map(function (e) { return [String(e.id), e.name]; }) },
        { k: "kind", label: "Type", type: "select", options: Object.keys(LEAVE).map(function (k) { return [k, LEAVE[k]]; }) },
        { k: "start", label: "Premier jour", type: "date", required: true }, { k: "end", label: "Dernier jour", type: "date", required: true },
        { k: "note", label: "Précision", value: "" }
      ], "Enregistrer la demande", function (v) { return c.oapi("POST", "/hr/leaves", v).then(function () { close(); tab = "leaves"; load(); }); }));
    });
  }

  // ----- Planning -----
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); }

  function showPlan() {
    c.clear(body); body.appendChild(c.loading());
    c.oapi("GET", "/hr/planning" + (week ? "?week=" + week : "")).then(function (j) {
      week = j.start; c.clear(body);
      var nav = h("div", { class: "row plan-nav" },
        h("button", { class: "btn small", type: "button", text: "← Semaine précédente", onclick: function () { week = addDays(week, -7); showPlan(); } }),
        h("b", { text: "Du " + c.dateFr(j.start) + " au " + c.dateFr(j.end) }),
        h("button", { class: "btn small", type: "button", text: "Semaine suivante →", onclick: function () { week = addDays(week, 7); showPlan(); } }));
      var card = h("div", { class: "ws-card" }, nav);
      if (!j.employees.length) { card.appendChild(c.empty("Ajoutez des employés pour construire le planning.")); body.appendChild(card); return; }
      var grid = h("div", { class: "plan" });
      grid.appendChild(h("div", { class: "pc ph", text: "" }));
      for (var i = 0; i < 7; i++) grid.appendChild(h("div", { class: "pc ph", text: DAYS[i] + " " + addDays(j.start, i).slice(8) }));
      j.employees.forEach(function (e) {
        grid.appendChild(h("div", { class: "pc pn" }, h("b", { text: e.name }), e.job ? h("small", { text: e.job }) : null));
        for (var k = 0; k < 7; k++) (function (day) {
          var cell = h("div", { class: "pc" });
          var off = j.leaves.some(function (l) { return l.employeeId === e.id && l.start <= day && l.end >= day; });
          if (off) cell.appendChild(h("span", { class: "pill mid", text: "Congé" }));
          j.shifts.filter(function (s) { return s.employeeId === e.id && s.day === day; }).forEach(function (s) {
            cell.appendChild(h("button", { class: "shift", type: "button", title: "Supprimer cet horaire", text: s.start + "–" + s.end, onclick: function () { c.confirm("Supprimer l'horaire de " + e.name + " (" + s.start + "–" + s.end + ") ?", function () { c.oapi("DELETE", "/hr/shifts/" + s.id).then(showPlan).catch(c.fail); }); } }));
          });
          if (!off) cell.appendChild(h("button", { class: "shift add", type: "button", text: "+", "aria-label": "Ajouter un horaire pour " + e.name, onclick: function () { addShift(e, day); } }));
          grid.appendChild(cell);
        })(addDays(j.start, k));
      });
      card.appendChild(h("div", { class: "plan-wrap" }, grid));
      body.appendChild(card);
      body.appendChild(h("p", { class: "muted small", text: "« + » ajoute un horaire. Un horaire existant se supprime en cliquant dessus. Impossible de planifier une personne en congé accepté." }));
    }).catch(c.fail);
  }

  function addShift(e, day) {
    c.modal("Horaire de " + e.name + " · " + c.dateFr(day), function (b, close) {
      b.appendChild(c.form([{ k: "start", label: "Début", type: "time", value: "08:00", required: true }, { k: "end", label: "Fin", type: "time", value: "16:00", required: true }, { k: "note", label: "Précision (facultatif)" }],
        "Ajouter", function (v) { return c.oapi("POST", "/hr/shifts", { employeeId: e.id, day: day, start: v.start, end: v.end, note: v.note }).then(function () { close(); showPlan(); }); }));
    });
  }

  load();
} });
