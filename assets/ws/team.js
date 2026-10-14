/* Sous-application : Équipe et antennes (rôles, invitations, extensions de l'organisation). */
WS.register({ id: "team", icon: "team", render: function (root, c) {
  var h = c.h, info = c.S.info, me = info.me;
  var ROLES = [["member", "Membre"], ["manager", "Responsable"], ["admin", "Administrateur"]];
  var RL = { owner: "Propriétaire", admin: "Administrateur", manager: "Responsable", member: "Membre" };
  var teamBox = h("div", { class: "ws-card" }, c.loading()), brBox = h("div", { class: "ws-card" }), invBox = h("div", { class: "ws-card" });

  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Équipe et antennes" }), h("p", { class: "muted", text: info.limits.membersUsed + " personne(s) sur " + info.limits.members + " permises par l'offre " + info.org.plan + ". IA : " + info.limits.aiUsed.toLocaleString("fr-FR") + " message(s) utilisé(s) sur " + info.limits.aiMonth.toLocaleString("fr-FR") + " (pour toute l'organisation), renouvelés le " + c.dateFr(info.limits.aiResetAt) + "." })),
    c.can("admin") ? h("button", { class: "btn primary small", type: "button", text: "Inviter quelqu'un", onclick: invite }) : null));
  root.appendChild(h("div", { class: "ws-cols" }, h("div", {}, teamBox), h("div", {}, brBox, c.can("admin") ? invBox : null)));

  function branchName(id) { var b = info.branches.filter(function (x) { return x.id === id; })[0]; return b ? b.name : ""; }
  function branchOpts() { return [["", "Toute l'organisation"]].concat(info.branches.map(function (b) { return [String(b.id), b.name]; })); }

  function loadTeam() {
    c.oapi("GET", "/members").then(function (j) {
      c.clear(teamBox); teamBox.appendChild(h("h2", { text: "Équipe" }));
      j.members.forEach(function (m) {
        teamBox.appendChild(h("div", { class: "line" },
          h("span", {}, h("b", { text: m.name + (m.userId === me.userId ? " (vous)" : "") }), h("small", { text: " " + RL[m.role] + (m.title ? " · " + m.title : "") + (m.branchId ? " · " + branchName(m.branchId) : "") + (m.contact ? " · " + m.contact : "") })),
          h("span", { class: "row" },
            c.can("admin") && m.role !== "owner" ? h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editMember(m); } }) : null,
            m.userId === me.userId && m.role !== "owner" ? h("button", { class: "link", type: "button", text: "Quitter", onclick: function () { c.confirm("Quitter cette organisation ?", function () { c.oapi("DELETE", "/members/" + m.userId).then(function () { location.hash = ""; location.reload(); }).catch(c.fail); }); } }) : null,
            c.can("admin") && m.role !== "owner" && m.userId !== me.userId ? h("button", { class: "link", type: "button", text: "Retirer", onclick: function () { c.confirm("Retirer " + m.name + " de l'organisation ?", function () { c.oapi("DELETE", "/members/" + m.userId).then(loadTeam).catch(c.fail); }); } }) : null)));
      });
    }).catch(c.fail);
  }

  function editMember(m) {
    c.modal("Modifier " + m.name, function (b, close) {
      b.appendChild(c.form([
        { k: "role", label: "Rôle", type: "select", options: ROLES.filter(function (r) { return r[0] !== "admin" || me.role === "owner"; }), value: m.role, hint: "Membre : tâches et demandes. Responsable : + projets et budget. Administrateur : + équipe, organisation, procédures." },
        { k: "title", label: "Poste", value: m.title }, { k: "branchId", label: "Antenne", type: "select", options: branchOpts(), value: m.branchId ? String(m.branchId) : "", hint: "Une personne rattachée à une antenne ne voit que les données de cette antenne et les données communes." }
      ], "Enregistrer", function (v) { return c.oapi("PUT", "/members/" + m.userId, { role: v.role, title: v.title, branchId: v.branchId || null }).then(function () { close(); loadTeam(); }); }));
    });
  }

  function loadBranches() {
    c.clear(brBox); brBox.appendChild(h("h2", { text: "Antennes" }));
    brBox.appendChild(h("p", { class: "muted small", text: "Une antenne est une succursale, un point de vente ou une extension de votre organisation." }));
    if (!info.branches.length) brBox.appendChild(c.empty("Aucune antenne : toute l'activité est centrale."));
    info.branches.forEach(function (b) {
      brBox.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: b.name }), b.location ? h("small", { text: " " + b.location }) : null),
        c.can("admin") ? h("span", { class: "row" }, h("button", { class: "link", type: "button", text: "Modifier", onclick: function () { editBranch(b); } }),
          h("button", { class: "link", type: "button", text: "Supprimer", onclick: function () { c.confirm("Supprimer l'antenne « " + b.name + " » ? Ses données restent, rattachées à toute l'organisation.", function () { c.oapi("DELETE", "/branches/" + b.id).then(c.reloadOrg).catch(c.fail); }); } })) : null));
    });
    if (c.can("admin")) brBox.appendChild(h("button", { class: "btn small", type: "button", text: "Ajouter une antenne", onclick: function () { editBranch(); } }));
  }
  function editBranch(b) {
    b = b || {};
    c.modal(b.id ? "Modifier l'antenne" : "Nouvelle antenne", function (bx, close) {
      bx.appendChild(c.form([{ k: "name", label: "Nom", required: true, value: b.name }, { k: "location", label: "Lieu", value: b.location }], "Enregistrer", function (v) {
        return c.oapi(b.id ? "PUT" : "POST", "/branches" + (b.id ? "/" + b.id : ""), v).then(function () { close(); c.reloadOrg(); });
      }));
    });
  }

  function loadInvites() {
    c.clear(invBox); invBox.appendChild(h("h2", { text: "Invitations en cours" }));
    c.oapi("GET", "/invites").then(function (j) {
      if (!j.invites.length) invBox.appendChild(c.empty("Aucune invitation active."));
      j.invites.forEach(function (i) {
        var link = location.origin + location.pathname + "#join=" + i.code;
        invBox.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { class: "mono", text: i.code }), h("small", { text: " " + RL[i.role] + (i.branchId ? " · " + branchName(i.branchId) : "") + " · jusqu'au " + c.dateFr(i.expiresAt) })),
          h("span", { class: "row" }, h("button", { class: "link", type: "button", text: "Copier le lien", onclick: function () { c.copy(link, "Lien d'invitation copié."); } }),
            h("button", { class: "link", type: "button", text: "Annuler", onclick: function () { c.oapi("DELETE", "/invites/" + i.code).then(loadInvites).catch(c.fail); } }))));
      });
    }).catch(function () {});
  }

  function invite() {
    c.modal("Inviter quelqu'un", function (b, close) {
      b.appendChild(c.form([
        { k: "role", label: "Rôle", type: "select", options: ROLES.filter(function (r) { return r[0] !== "admin" || me.role === "owner"; }) },
        { k: "title", label: "Poste (facultatif)" }, { k: "branchId", label: "Antenne", type: "select", options: branchOpts() }
      ], "Créer l'invitation", function (v) {
        return c.oapi("POST", "/invites", { role: v.role, title: v.title, branchId: v.branchId || null }).then(function (j) {
          var link = location.origin + location.pathname + "#join=" + j.code;
          c.clear(b);
          b.appendChild(h("p", { text: "Envoyez ce lien à la personne (elle devra créer un compte ou se connecter). Il ne marche qu'une fois, pendant 7 jours." }));
          b.appendChild(h("input", { value: link, readonly: true, onfocus: function (e) { e.target.select(); } }));
          b.appendChild(h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn primary small", type: "button", text: "Copier le lien", onclick: function () { c.copy(link, "Lien copié."); } }), h("button", { class: "btn small", type: "button", text: "Fermer", onclick: function () { close(); loadInvites(); } })));
        });
      }));
    });
  }

  loadTeam(); loadBranches(); if (c.can("admin")) loadInvites();
} });
