/* Sous-application : Tableau de bord (structure de la maquette validée). Données réelles : alertes et score de santé
   calculés par le serveur, budget (responsables et plus), projets, tâches et demandes de validation. */
WS.register({ id: "dashboard", icon: "dashboard", render: function (root, c) {
  var h = c.h, NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, kids) { var e = document.createElementNS(NS, tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); (kids || []).forEach(function (x) { e.appendChild(x); }); return e; }
  function go(mod) { location.hash = "#/" + c.S.orgId + "/" + mod; }
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

  function ago(iso) {
    if (!iso) return "";
    var d = new Date(iso), m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return "à l'instant"; if (m < 60) return "il y a " + m + " min";
    var hh = Math.round(m / 60); if (hh < 24) return "il y a " + hh + " h";
    var j = Math.round(hh / 24); if (j === 1) return "hier"; if (j < 7) return "il y a " + j + " j";
    return c.dateFr(iso);
  }
  function when(due) { // « aujourd'hui », « demain », jour de la semaine, ou date
    var t = new Date(c.today() + "T00:00:00"), d = new Date(due + "T00:00:00"), n = Math.round((d - t) / 86400000);
    if (n < 0) return "en retard (" + c.dateFr(due) + ")"; if (n === 0) return "aujourd'hui"; if (n === 1) return "demain"; if (n < 7) return JOURS[d.getDay()]; return c.dateFr(due);
  }

  var now = new Date();
  root.appendChild(h("div", { class: "dh" }, h("h1", { text: "Bonjour " + c.firstName() }),
    h("p", { class: "muted", text: "Voici l'état de votre entreprise ce " + JOURS[now.getDay()] + " " + now.getDate() + " " + MOIS[now.getMonth()] + " " + now.getFullYear() + "." })));
  var body = h("div", {}, c.loading());
  root.appendChild(body);

  c.oapi("GET", "/dashboard").then(function (j) {
    c.S.dash = j; c.clear(body);
    var s = j.stats, hl = j.health, al = j.alerts, money = !!s.budget;
    var important = al.filter(function (a) { return a.level !== "info"; });

    /* ---- Point de situation (carte bleue) + Santé de l'entreprise ---- */
    var prio = h("ul", { class: "prio" });
    if (!important.length) prio.appendChild(h("li", { class: "ok" }, "Aucune alerte importante : tout est sous contrôle."));
    important.slice(0, 3).forEach(function (a) { prio.appendChild(h("li", { class: a.level }, a.title + " : " + a.text)); });
    var brief = h("section", { class: "brief" },
      h("div", { class: "brief-h" }, c.icon("ai"), h("b", { text: "Point de situation de MANAGER-IA" }), h("small", { text: "Aujourd'hui, " + now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })),
      prio,
      h("div", { class: "row" },
        h("button", { class: "bt white", type: "button", text: "Voir le détail", onclick: function () { go("alerts"); } }),
        h("button", { class: "bt ghost", type: "button", text: "Poser une question", onclick: function () { c.askAI("Fais le point sur mon organisation et dis-moi quoi faire en premier."); } })));

    var R = 48, C2 = 2 * Math.PI * R, tone = hl.score >= 80 ? "good" : hl.score >= 60 ? "mid" : "bad";
    var ring = sv("svg", { viewBox: "0 0 120 120", width: "120", height: "120", role: "img", "aria-label": "Score de santé " + hl.score + " sur 100" }, [
      sv("circle", { cx: "60", cy: "60", r: String(R), fill: "none", "stroke-width": "12", class: "ring-bg" }),
      sv("circle", { cx: "60", cy: "60", r: String(R), fill: "none", "stroke-width": "12", "stroke-linecap": "round", class: "ring " + tone, "stroke-dasharray": (C2 * hl.score / 100).toFixed(1) + " " + C2.toFixed(1), transform: "rotate(-90 60 60)" })]);
    body.appendChild(h("div", { class: "g2" }, brief,
      h("section", { class: "dc health" }, h("h2", { text: "Santé de l'entreprise" }),
        h("div", { class: "hrow" }, h("div", { class: "ringbox" }, ring, h("div", { class: "rv" }, h("b", { text: String(hl.score) }), h("small", { text: "sur 100" }))),
          h("div", { class: "hside" }, h("span", { class: "pill " + tone, text: hl.label }), h("p", { class: "muted", text: hl.summary }))))));

    /* ---- Quatre chiffres clés ---- */
    function delta(cur, prev, label) {
      if (!prev) return { text: label, cls: "" };
      var pct = Math.round(100 * (cur - prev) / Math.abs(prev));
      return { text: (pct >= 0 ? "▲ " : "▼ ") + Math.abs(pct) + " % " + label, cls: pct >= 0 ? "up" : "down" };
    }
    function kpi(title, value, sub, color, mod) {
      return h("button", { type: "button", class: "kpi " + color, onclick: function () { go(mod); } }, h("small", { text: title }), h("b", { text: value }), h("span", { class: "sub " + (sub.cls || ""), text: sub.text }));
    }
    var k = h("div", { class: "kpis4" });
    if (money) {
      var sr = j.series || [], cur = sr[sr.length - 1] || { income: 0, expense: 0 }, prev = sr[sr.length - 2] || { income: 0, expense: 0 };
      var pm = prev.month ? MOIS[Number(prev.month.slice(5)) - 1] : "";
      k.appendChild(kpi("Chiffre d'affaires du mois", c.money(s.budget.income), delta(cur.income, prev.income, "vs " + pm), "blue", "budget"));
      k.appendChild(kpi("Solde de trésorerie", c.money(s.budget.balance), delta(cur.income - cur.expense, prev.income - prev.expense, "vs " + pm), "green", "budget"));
    } else {
      k.appendChild(kpi("Projets en cours", String(s.projects.active), { text: "visibles par vous", cls: "" }, "blue", "projects"));
      k.appendChild(kpi("Mes tâches ouvertes", String(s.tasks.mine), { text: "assignées à vous", cls: "" }, "green", "projects"));
    }
    k.appendChild(kpi("Demandes clients à traiter", String(s.tickets.open), { text: s.tickets.urgent ? "dont " + s.tickets.urgent + " urgente" + (s.tickets.urgent > 1 ? "s" : "") : "aucune urgente", cls: s.tickets.urgent ? "down" : "up" }, "red", "support"));
    k.appendChild(kpi("Tâches en retard", String(s.tasks.overdue), { text: "sur " + s.tasks.todo + " tâche" + (s.tasks.todo > 1 ? "s" : "") + " ouverte" + (s.tasks.todo > 1 ? "s" : ""), cls: s.tasks.overdue ? "warn" : "up" }, "amber", "projects"));
    body.appendChild(k);

    /* ---- Entrées et sorties + Alertes ---- */
    var alertsCard = h("section", { class: "dc" }, h("div", { class: "ch" }, h("h2", { text: "Alertes de MANAGER-IA" }), h("button", { class: "link", type: "button", text: "Voir tout", onclick: function () { go("alerts"); } })));
    if (!al.length) alertsCard.appendChild(c.empty("Aucune alerte : tout va bien."));
    al.slice(0, 4).forEach(function (a) {
      alertsCard.appendChild(h("button", { type: "button", class: "al " + a.level, onclick: function () { go(a.module); } }, h("b", { text: a.title }), h("em", { text: ago(a.at) }), h("span", { text: a.text })));
    });
    if (j.series) {
      var cur2 = c.S.info.org.currency, max = 1; j.series.forEach(function (m) { max = Math.max(max, m.income, m.expense); });
      var unit = max >= 1000000 ? 1000000 : 1000, top = Math.max(1, Math.ceil(max / unit)), W = 640, H = 240, base = 200, sc = 160 / (top * unit), kids = [];
      var step = top > 6 ? Math.ceil(top / 6) : 1;
      for (var g = 0; g <= top; g += step) { var y = base - g * unit * sc; kids.push(sv("line", { x1: "40", y1: String(y), x2: String(W), y2: String(y), class: "grid" })); var tx = sv("text", { x: "32", y: String(y + 4), "text-anchor": "end", class: "ax" }); tx.textContent = String(g); kids.push(tx); }
      var MN = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
      j.series.forEach(function (m, i) {
        var x = 62 + i * 96;
        kids.push(sv("rect", { x: String(x), y: String(base - m.income * sc), width: "32", height: String(Math.max(m.income * sc, 0)), rx: "6", class: "b-in" }));
        kids.push(sv("rect", { x: String(x + 40), y: String(base - m.expense * sc), width: "32", height: String(Math.max(m.expense * sc, 0)), rx: "6", class: "b-out" }));
        var t = sv("text", { x: String(x + 36), y: String(base + 22), "text-anchor": "middle", class: "ax" }); t.textContent = MN[Number(m.month.slice(5)) - 1]; kids.push(t);
      });
      body.appendChild(h("div", { class: "g3" },
        h("section", { class: "dc" }, h("div", { class: "ch" }, h("h2", { text: "Entrées et sorties" }), h("small", { class: "muted", text: "6 derniers mois, en " + (unit === 1000000 ? "millions" : "milliers") + " de " + cur2 })),
          h("div", { class: "legend" }, h("i", { class: "li" }), "Entrées", h("i", { class: "lo" }), "Sorties"),
          sv("svg", { viewBox: "0 0 " + W + " " + H, class: "chart", role: "img", "aria-label": "Entrées et sorties des six derniers mois" }, kids)),
        alertsCard));
    } else body.appendChild(alertsCard);

    /* ---- Décisions à prendre + Projets en cours + Mes tâches ---- */
    var dec = h("section", { class: "dc" }, h("div", { class: "ch" }, h("h2", { text: "Décisions à prendre" }), h("small", { class: "muted", text: j.decisions.length + " en attente" })));
    if (!j.decisions.length) dec.appendChild(c.empty(j.canDecide ? "Aucune décision en attente." : "Vous n'avez aucune demande en attente."));
    j.decisions.forEach(function (d) {
      var row = h("div", { class: "dec" }, h("div", { class: "dt" }, h("b", { text: d.title }), h("small", { text: (d.amount ? c.money(d.amount) + " · " : "") + (d.detail || ("demandé par " + (d.requester || "un membre"))) })));
      if (j.canDecide) row.appendChild(h("div", { class: "row nowrap" }, h("button", { class: "dv", type: "button", text: "Valider", onclick: function () { decide(d, "approved"); } }), h("button", { class: "dr", type: "button", text: "Refuser", onclick: function () { decide(d, "rejected"); } })));
      else row.appendChild(h("span", { class: "pill mid", text: "En attente" }));
      dec.appendChild(row);
    });
    dec.appendChild(h("button", { class: "link soft", type: "button", text: "+ Soumettre une demande de validation", onclick: newDecision }));

    var proj = h("section", { class: "dc" }, h("div", { class: "ch" }, h("h2", { text: "Projets en cours" })));
    if (!j.projects.length) proj.appendChild(c.empty("Aucun projet en cours."));
    j.projects.slice(0, 3).forEach(function (p) {
      var col = p.percent >= 80 ? "ok" : p.percent < 50 ? "amber" : "blue";
      proj.appendChild(h("div", { class: "pr" }, h("div", { class: "line" }, h("span", { text: p.name }), h("b", { text: p.percent + " %" })), h("div", { class: "meter " + col }, h("i", { style: "width:" + p.percent + "%" }))));
    });

    var tk = h("section", { class: "dc" }, h("div", { class: "ch" }, h("h2", { text: "Mes tâches" })));
    if (!j.myTasks.length) tk.appendChild(c.empty("Aucune tâche ne vous est assignée."));
    j.myTasks.slice(0, 3).forEach(function (t) {
      var n = t.due ? Math.round((new Date(t.due + "T00:00:00") - new Date(c.today() + "T00:00:00")) / 86400000) : 9, tone2 = n <= 0 ? "red" : n === 1 ? "amber" : "blue";
      tk.appendChild(h("div", { class: "tkl" }, h("span", { class: "box " + tone2 }), h("div", {}, h("b", { text: t.title }), h("small", { class: tone2, text: t.due ? when(t.due) : "sans date" }))));
    });
    body.appendChild(h("div", { class: "g4" }, dec, proj, tk));
  }).catch(c.fail);

  function decide(d, status) {
    c.oapi("PUT", "/decisions/" + d.id, { status: status }).then(function () { c.toast(status === "approved" ? "Décision validée." : "Décision refusée."); c.refresh(); }).catch(c.fail);
  }
  function newDecision() {
    c.modal("Nouvelle demande de validation", function (b, close) {
      b.appendChild(h("p", { class: "muted small", text: "Soumettez une dépense, une embauche ou toute décision qui demande l'accord d'un responsable." }));
      b.appendChild(c.form([{ k: "title", label: "Que voulez-vous faire valider ?", required: true, placeholder: "Ex : acheter 20 mètres de tissu" }, { k: "amount", label: "Montant (" + c.S.info.org.currency + ", facultatif)" }, { k: "detail", label: "Précisions", type: "textarea", rows: 3 }], "Envoyer pour validation", function (v) {
        return c.oapi("POST", "/decisions", { title: v.title, amount: v.amount || null, detail: v.detail }).then(function () { close(); c.toast("Demande envoyée."); c.refresh(); });
      }));
    });
  }
} });
