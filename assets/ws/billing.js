/* Sous-application : Abonnement (offre actuelle, quotas, choix d'une offre, paiement MTN / Orange, historique). Réservée au propriétaire. */
WS.register({ id: "billing", icon: "budget", render: function (root, c) {
  var h = c.h, body = h("div", {}), poll = null;
  var ST = { pending: ["En attente", "mid"], awaiting_validation: ["À valider", "mid"], paid: ["Payé", "good"], failed: ["Échoué", "bad"] };
  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Abonnement" }), h("p", { class: "muted", text: "Votre offre, vos quotas et vos paiements." }))));
  root.appendChild(body);
  window.addEventListener("hashchange", function () { if (poll) { clearInterval(poll); poll = null; } }, { once: true });

  function fr(iso) { return iso ? c.dateFr(String(iso).slice(0, 10)) : ""; }
  function load() {
    c.clear(body); body.appendChild(c.loading());
    c.rq("GET", "/api/billing").then(show).catch(c.fail);
  }

  function show(b) {
    c.clear(body);
    var paid = b.plan !== "Gratuit";
    var head = h("div", { class: "ws-card" }, h("h2", { text: "Offre actuelle : " + b.plan }),
      h("p", { text: paid ? "Active jusqu'au " + fr(b.expiresAt) + " (" + b.daysLeft + " jour" + (b.daysLeft > 1 ? "s" : "") + " restant" + (b.daysLeft > 1 ? "s" : "") + ")." : "Offre gratuite : essayez MANAGER-IA, puis passez à une offre payante quand vous êtes prêt." }),
      paid && b.daysLeft <= 7 ? h("p", { class: "pill mid", text: "Votre abonnement se termine bientôt : renouvelez pour ne pas perdre vos quotas." }) : null,
      paid ? h("p", { class: "muted small", text: "Le changement d'offre n'est possible qu'à la fin de l'abonnement. Vous pouvez renouveler votre offre à tout moment : les jours s'ajoutent." }) : null);
    body.appendChild(head);

    if (b.orgs.length) {
      var q = h("div", { class: "ws-card" }, h("h2", { text: "Messages IA du mois" }));
      b.orgs.forEach(function (o) {
        var pct = Math.min(100, Math.round(100 * o.aiUsed / Math.max(1, o.aiMax)));
        q.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: o.name }), h("small", { text: " " + o.aiUsed + " sur " + o.aiMax + " · se renouvelle le " + fr(o.periodEnd) })),
          h("span", { class: "pill " + (pct >= 90 ? "bad" : pct >= 70 ? "mid" : "good"), text: pct + " %" })));
      });
      body.appendChild(q);
    }

    var grid = h("div", { class: "kpis" });
    b.plans.forEach(function (p) {
      var l = p.limits;
      grid.appendChild(h("div", { class: "stat" + (p.current ? " good" : "") },
        h("b", { text: p.name }), h("span", { text: c.money(p.priceXAF) + " / " + b.durationDays + " jours" }),
        h("small", { text: l.aiMonth + " messages IA · " + l.members + " personnes · " + l.orgs + " organisation" + (l.orgs > 1 ? "s" : "") }),
        h("button", { class: "btn small" + (p.current ? "" : " primary"), type: "button", disabled: !p.available, title: p.reason || null,
          text: p.current ? "Renouveler" : "Choisir", onclick: function () { pay(p, b); } }),
        !p.available ? h("small", { class: "muted", text: "Disponible à la fin de votre abonnement." }) : null));
    });
    body.appendChild(h("div", { class: "ws-card" }, h("h2", { text: "Choisir ou renouveler une offre" }), grid));

    var hist = h("div", { class: "ws-card" }, h("h2", { text: "Historique des paiements" }));
    if (!b.history.length) hist.appendChild(c.empty("Aucun paiement pour le moment."));
    b.history.forEach(function (p) {
      var st = ST[p.status] || [p.status, "mid"];
      hist.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: p.plan + " · " + c.money(p.amountXAF) }), h("small", { text: " " + fr(p.createdAt) + " · " + (p.operator === "orange" ? "Orange Money" : "MTN Mobile Money") + " · réf. " + p.reference })),
        h("span", { class: "pill " + st[1], text: st[0] })));
    });
    body.appendChild(hist);
  }

  function pay(p, b) {
    c.modal((p.current ? "Renouveler " : "Passer à ") + p.name, function (bx, close) {
      bx.appendChild(h("p", { text: c.money(p.priceXAF) + " pour " + b.durationDays + " jours." }));
      bx.appendChild(c.form([
        { k: "operator", label: "Opérateur", type: "select", options: [["mtn", "MTN Mobile Money"], ["orange", "Orange Money"]] },
        { k: "phone", label: "Numéro qui paie (ex. 6XXXXXXXX)", required: true }
      ], "Payer", function (v) {
        return c.rq("POST", "/api/payments/initiate", { plan: p.id, operator: v.operator, phone: v.phone }).then(function (r) { close(); instructions(r); });
      }));
    });
  }

  function instructions(r) {
    c.modal("Finalisez votre paiement", function (bx, close) {
      bx.appendChild(h("p", { text: r.instructions }));
      var msg = h("p", { class: "muted", role: "status" });
      if (r.mode === "push") {
        msg.textContent = "En attente de votre confirmation sur le téléphone…";
        var tries = 0;
        poll = setInterval(function () {
          tries++;
          c.rq("GET", "/api/payments/" + r.reference).then(function (s) {
            if (s.status === "paid") { clearInterval(poll); poll = null; close(); c.toast("Paiement reçu : votre offre est active."); c.reloadOrg(); }
            else if (s.status === "failed") { clearInterval(poll); poll = null; msg.textContent = "Le paiement a échoué ou a été refusé. Fermez et réessayez."; }
          }).catch(function () {});
          if (tries > 45) { clearInterval(poll); poll = null; msg.textContent = "Toujours en attente. Si vous avez confirmé, l'offre s'activera toute seule : revenez sur cette page plus tard."; }
        }, 4000);
        bx.appendChild(msg);
      } else {
        bx.appendChild(c.form([{ k: "transactionId", label: "ID de transaction reçu par SMS", required: true }], "J'ai payé : envoyer l'ID", function (v) {
          return c.rq("POST", "/api/payments/confirm-manual", { reference: r.reference, transactionId: v.transactionId }).then(function () { close(); c.toast("Merci : nous validons votre paiement et activons votre offre."); load(); });
        }));
      }
    }, { onclose: function () { if (poll) { clearInterval(poll); poll = null; } load(); } });
  }

  load();
} });
