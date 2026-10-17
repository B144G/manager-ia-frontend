/* Sous-application : Comptabilité (plan OHADA de base, journal, balance, résultat, bilan, TVA). Administrateurs et propriétaire.
   Les écritures ne se modifient pas : une erreur se corrige par une écriture inverse. Outil d'aide : à faire valider par un expert-comptable. */
WS.register({ id: "accounting", icon: "budget", render: function (root, c) {
  var h = c.h, tab = "home", year = String(new Date().getFullYear()), journal = "", accounts = null, over = null;
  var tabs = h("div", { class: "ws-tabs" }), body = h("div", {});
  var JN = {};
  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Comptabilité" }), h("p", { class: "muted", text: "Vos écritures, votre balance, votre résultat et votre TVA. Outil d'aide : à faire valider par un expert-comptable." })),
    h("div", { class: "row" },
      h("button", { class: "btn small", type: "button", text: "Décrire une opération (IA)", onclick: suggest }),
      h("button", { class: "btn primary small", type: "button", text: "Nouvelle écriture", onclick: function () { editEntry(); } }))));
  root.appendChild(tabs); root.appendChild(body);

  function drawTabs() {
    c.clear(tabs);
    [["home", "Aperçu"], ["journal", "Journal"], ["balance", "Balance"], ["results", "Résultat et bilan"], ["settings", "Réglages"]].forEach(function (t) {
      tabs.appendChild(h("button", { type: "button", class: "tab" + (tab === t[0] ? " on" : ""), text: t[1], onclick: function () { tab = t[0]; load(); } }));
    });
  }
  function yearBar() {
    var sel = h("select", { "aria-label": "Année", onchange: function (e) { year = e.target.value; load(); } }), y = new Date().getFullYear();
    for (var i = y; i >= y - 4; i--) sel.appendChild(h("option", { value: String(i), text: String(i) }));
    sel.value = year; return h("div", { class: "row", style: "margin-bottom:8px" }, h("span", { class: "muted small", text: "Exercice :" }), sel);
  }
  function getAccounts() { return accounts ? Promise.resolve(accounts) : c.oapi("GET", "/accounting/accounts").then(function (j) { accounts = j.accounts; return accounts; }); }
  function load() {
    drawTabs(); c.clear(body); body.appendChild(c.loading());
    c.oapi("GET", "/accounting").then(function (o) {
      over = o; JN = o.journals;
      if (tab === "home") home(o); else if (tab === "journal") journalTab(); else if (tab === "balance") balanceTab(); else if (tab === "results") resultsTab(); else settings(o);
    }).catch(c.fail);
  }

  function entryCard(e, canUndo) {
    var tot = e.lines.reduce(function (a, l) { return a + l.debit; }, 0);
    var card = h("div", { class: "line", style: "display:block" },
      h("div", { class: "row" }, h("b", { text: e.number }), h("span", { class: "muted small", text: c.dateFr(e.date) + " · " + (JN[e.journal] || e.journal) }), h("span", { class: "grow" }), h("b", { text: c.money(tot) }),
        canUndo && !e.reversedOf ? h("button", { class: "link", type: "button", text: "Annuler", onclick: function () { c.confirm("Annuler l'écriture " + e.number + " par une écriture inverse ? (Elle reste visible dans le journal.)", function () { c.oapi("POST", "/accounting/entries/" + e.id + "/reverse", {}).then(function () { c.toast("Écriture annulée."); load(); }).catch(c.fail); }); } }) : null),
      h("div", { text: e.label }),
      e.lines.map(function (l) { return h("div", { class: "muted small", style: "display:flex;gap:12px" }, h("span", { style: "min-width:60px", text: l.account }), h("span", { style: "flex:1", text: l.memo || "" }), h("span", { style: "min-width:90px;text-align:right", text: l.debit ? c.money(l.debit) : "" }), h("span", { style: "min-width:90px;text-align:right", text: l.credit ? c.money(l.credit) : "" })); }));
    return card;
  }

  function home(o) {
    c.clear(body);
    var k = o.kpi;
    body.appendChild(h("div", { class: "kpis" },
      h("div", { class: "stat" }, h("b", { text: c.money(k.ventes) }), h("span", { text: "ventes de l'année (HT)" })),
      h("div", { class: "stat" }, h("b", { text: c.money(k.achats) }), h("span", { text: "achats de l'année" })),
      h("div", { class: "stat" + (k.resultat < 0 ? " bad" : "") }, h("b", { class: k.resultat >= 0 ? "ok" : "", text: c.money(k.resultat) }), h("span", { text: "résultat de l'année" })),
      h("div", { class: "stat" }, h("b", { text: c.money(k.clients) }), h("span", { text: "clients vous doivent" })),
      h("div", { class: "stat" }, h("b", { text: c.money(k.fournisseurs) }), h("span", { text: "vous devez aux fournisseurs" })),
      h("div", { class: "stat" }, h("b", { text: c.money(k.tresorerie) }), h("span", { text: "trésorerie (caisse, banque)" }))));
    var n = o.toPost.invoices + o.toPost.payments + o.toPost.purchases;
    var gen = h("div", { class: "ws-card" }, h("h2", { text: "Écritures automatiques" }),
      h("p", { text: n ? n + " opération(s) de votre activité ne sont pas encore dans la comptabilité : " + o.toPost.invoices + " facture(s), " + o.toPost.payments + " paiement(s) reçu(s), " + o.toPost.purchases + " achat(s) reçu(s)." : "Tout est à jour : vos factures, paiements reçus et achats reçus sont comptabilisés." }),
      h("button", { class: "btn primary small", type: "button", disabled: !n, text: "Comptabiliser maintenant", onclick: function () {
        c.oapi("POST", "/accounting/generate", {}).then(function (r) { c.toast(r.invoices + " facture(s), " + r.payments + " paiement(s), " + r.purchases + " achat(s) comptabilisés." + (r.skipped.length ? " Ignorés : " + r.skipped.length + " (période clôturée)." : "")); load(); }).catch(c.fail); } }),
      h("p", { class: "muted small", text: "Facture → ventes (HT) + TVA collectée ; paiement → caisse/banque ; achat reçu → achats + fournisseurs. Chaque opération n'est comptabilisée qu'une fois." }));
    body.appendChild(gen);
    var rc = h("div", { class: "ws-card" }, h("h2", { text: "Dernières écritures (" + o.count + " au total)" }));
    if (!o.entries.length) rc.appendChild(c.empty("Aucune écriture. Cliquez sur « Comptabiliser maintenant » ou « Nouvelle écriture »."));
    o.entries.forEach(function (e) { rc.appendChild(entryCard(e, true)); });
    body.appendChild(rc);
    body.appendChild(h("p", { class: "muted small", text: o.disclaimer }));
  }

  function journalTab() {
    c.clear(body);
    var sel = h("select", { "aria-label": "Journal", onchange: function (e) { journal = e.target.value; journalTab(); } }, h("option", { value: "", text: "Tous les journaux" }));
    Object.keys(JN).forEach(function (k) { sel.appendChild(h("option", { value: k, text: JN[k] + " (" + k + ")" })); });
    sel.value = journal;
    var q = h("input", { type: "search", placeholder: "Rechercher (libellé, pièce, numéro)", "aria-label": "Rechercher" });
    var list = h("div", {});
    function run() {
      c.clear(list); list.appendChild(c.loading());
      c.oapi("GET", "/accounting/entries?from=" + year + "-01-01&to=" + year + "-12-31" + (journal ? "&journal=" + journal : "") + (q.value.trim() ? "&q=" + encodeURIComponent(q.value.trim()) : "")).then(function (j) {
        c.clear(list); if (!j.entries.length) list.appendChild(c.empty("Aucune écriture."));
        j.entries.forEach(function (e) { list.appendChild(entryCard(e, true)); });
      }).catch(c.fail);
    }
    q.addEventListener("change", run);
    body.appendChild(h("div", { class: "ws-card" }, h("div", { class: "row" }, yearBar(), sel, q, h("button", { class: "btn small", type: "button", text: "Exporter pour Excel", onclick: exportCsv })), list));
    run();
  }
  function exportCsv() {
    fetch(((window.MI_CONFIG || {}).API_BASE || "") + "/api/ws/orgs/" + c.S.orgId + "/accounting/export.csv?year=" + year, { credentials: "include" }).then(function (r) { if (!r.ok) throw new Error("Export impossible."); return r.blob(); })
      .then(function (b) { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "journal-" + year + ".csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); }).catch(c.fail);
  }

  function balanceTab() {
    c.clear(body); body.appendChild(c.loading());
    c.oapi("GET", "/accounting/balance?year=" + year).then(function (j) {
      c.clear(body);
      var card = h("div", { class: "ws-card" }, yearBar(), h("h2", { text: "Balance générale " + year }));
      if (!j.rows.length) card.appendChild(c.empty("Aucune écriture sur cet exercice."));
      j.rows.forEach(function (r) {
        card.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: r.account }), h("small", { text: " " + r.label })),
          h("span", { class: "row" }, h("small", { text: "Débit " + c.money(r.debit) + " · Crédit " + c.money(r.credit) }), h("b", { text: (r.balance >= 0 ? "D " : "C ") + c.money(Math.abs(r.balance)) }),
            h("button", { class: "link", type: "button", text: "Grand livre", onclick: function () { ledger(r.account); } }))));
      });
      card.appendChild(h("div", { class: "line" }, h("b", { text: "Totaux" }), h("b", { text: "Débit " + c.money(j.totalDebit) + " · Crédit " + c.money(j.totalCredit) + (j.totalDebit === j.totalCredit ? " ✓ équilibrée" : " ✗ déséquilibrée") })));
      body.appendChild(card);
    }).catch(c.fail);
  }
  function ledger(account) {
    c.modal("Grand livre du compte " + account, function (b) {
      var box = h("div", {}, c.loading()); b.appendChild(box);
      c.oapi("GET", "/accounting/ledger?account=" + account + "&year=" + year).then(function (j) {
        c.clear(box); box.appendChild(h("p", { class: "muted", text: j.label }));
        if (!j.lines.length) box.appendChild(c.empty("Aucun mouvement."));
        j.lines.forEach(function (l) { box.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: c.dateFr(l.date) }), h("small", { text: " " + l.number + " · " + l.label })), h("span", { text: (l.debit ? "D " + c.money(l.debit) : "C " + c.money(l.credit)) + " → solde " + c.money(l.running) }))); });
        box.appendChild(h("p", { text: "Solde : " + c.money(j.balance) + (j.balance >= 0 ? " (débiteur)" : " (créditeur)") }));
      }).catch(function (e) { box.textContent = e.message; });
    }, { wide: true });
  }

  function resultsTab() {
    c.clear(body); body.appendChild(c.loading());
    Promise.all([c.oapi("GET", "/accounting/statements?year=" + year), c.oapi("GET", "/accounting/vat?year=" + year)]).then(function (rs) {
      var s = rs[0], v = rs[1]; c.clear(body); body.appendChild(yearBar());
      var r = s.resultat;
      var cr = h("div", { class: "ws-card" }, h("h2", { text: "Compte de résultat " + year }),
        h("p", { text: "Ventes " + c.money(r.ventes) + " − achats " + c.money(r.achats) + " = marge brute " + c.money(r.margeBrute) }));
      r.produits.forEach(function (x) { cr.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: x.account }), h("small", { text: " " + x.label })), h("span", { text: c.money(x.amount) }))); });
      cr.appendChild(h("div", { class: "line" }, h("b", { text: "Total des produits" }), h("b", { text: c.money(r.totalProduits) })));
      r.charges.forEach(function (x) { cr.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: x.account }), h("small", { text: " " + x.label })), h("span", { text: c.money(x.amount) }))); });
      cr.appendChild(h("div", { class: "line" }, h("b", { text: "Total des charges" }), h("b", { text: c.money(r.totalCharges) })));
      cr.appendChild(h("div", { class: "line" }, h("b", { text: r.resultat >= 0 ? "Bénéfice" : "Perte" }), h("b", { class: r.resultat >= 0 ? "ok" : "", text: c.money(Math.abs(r.resultat)) })));
      body.appendChild(cr);
      var b = s.bilan, bc = h("div", { class: "ws-card" }, h("h2", { text: "Bilan simplifié au 31/12/" + year }),
        h("p", { class: "muted small", text: "Immobilisations " + c.money(b.resume.immobilisations) + " · stocks " + c.money(b.resume.stocks) + " · créances et tiers " + c.money(b.resume.creances) + " · trésorerie " + c.money(b.resume.tresorerie) + " · capitaux propres (avec résultat) " + c.money(b.resume.capitauxPropres) }));
      bc.appendChild(h("h3", { text: "Actif" })); b.actif.forEach(function (x) { bc.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: x.account }), h("small", { text: " " + x.label })), h("span", { text: c.money(x.amount) }))); });
      bc.appendChild(h("div", { class: "line" }, h("b", { text: "Total actif" }), h("b", { text: c.money(b.totalActif) })));
      bc.appendChild(h("h3", { text: "Passif" })); b.passif.forEach(function (x) { bc.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: x.account }), h("small", { text: " " + x.label })), h("span", { text: c.money(x.amount) }))); });
      bc.appendChild(h("div", { class: "line" }, h("span", {}, h("b", { text: "Résultat de l'exercice" })), h("span", { text: c.money(b.resultat) })));
      bc.appendChild(h("div", { class: "line" }, h("b", { text: "Total passif" }), h("b", { text: c.money(b.totalPassif) + (b.equilibre ? " ✓" : " ✗") })));
      body.appendChild(bc);
      body.appendChild(h("div", { class: "ws-card" }, h("h2", { text: "TVA " + year + " (taux " + v.rate + " %)" }),
        h("p", { text: "TVA collectée : " + c.money(v.collected) + " · TVA récupérable : " + c.money(v.deductible) }),
        h("p", { text: v.due ? "TVA à reverser : " + c.money(v.due) : v.credit ? "Crédit de TVA : " + c.money(v.credit) : "Rien à reverser." }),
        h("p", { class: "muted small", text: "Estimation d'après vos écritures. La déclaration officielle se fait auprès de l'administration fiscale." })));
    }).catch(c.fail);
  }

  function settings(o) {
    c.clear(body); var s = o.settings;
    var f = c.form([
      { k: "vatRate", label: "Taux de TVA (%)", value: String(s.vatRate), hint: "19,25 au Cameroun (TVA + centimes additionnels). Mettez 0 si vous n'êtes pas assujetti." },
      { k: "payAccount", label: "Encaissements des clients", type: "select", options: [["571", "Caisse (571)"], ["521", "Banque (521)"], ["589", "Mobile money (589)"]], value: s.payAccount },
      { k: "purchaseVat", label: "Les prix d'achat saisis dans Stock incluent la TVA", type: "select", options: [["0", "Non : montants pris tels quels"], ["1", "Oui : la TVA récupérable est séparée"]], value: s.purchaseVat ? "1" : "0" },
      { k: "lockedUntil", label: "Période clôturée jusqu'au", type: "date", value: s.lockedUntil || "", hint: "Aucune écriture ne peut plus être ajoutée jusqu'à cette date. Une clôture ne peut pas être rouverte." }
    ], "Enregistrer", function (v) { return c.oapi("PUT", "/accounting/settings", { vatRate: Number(String(v.vatRate).replace(",", ".")), payAccount: v.payAccount, purchaseVat: v.purchaseVat === "1", lockedUntil: v.lockedUntil || null }).then(function () { c.toast("Réglages enregistrés."); load(); }); });
    body.appendChild(h("div", { class: "ws-card" }, h("h2", { text: "Réglages de la comptabilité" }), f));
    var ac = h("div", { class: "ws-card" }, h("h2", { text: "Plan comptable" }), h("p", { class: "muted small", text: "Plan de base inspiré du SYSCOHADA révisé. Ajoutez vos propres comptes (3 à 8 chiffres) si besoin." }),
      h("button", { class: "btn small", type: "button", text: "Ajouter un compte", onclick: function () {
        c.modal("Nouveau compte", function (b, close) { b.appendChild(c.form([{ k: "code", label: "Numéro (ex. 6221)", required: true }, { k: "label", label: "Nom du compte", required: true }], "Ajouter", function (v) { return c.oapi("POST", "/accounting/accounts", v).then(function () { accounts = null; close(); c.toast("Compte ajouté."); }); })); }); } }));
    body.appendChild(ac);
  }

  /* Saisie d'une écriture à la main (ou préremplie par l'IA) */
  function editEntry(pre) {
    getAccounts().then(function (accs) {
      c.modal("Nouvelle écriture", function (b, close) {
        var dl = h("datalist", { id: "acc-list" }, accs.map(function (a) { return h("option", { value: a.code, label: a.label }); }));
        var jsel = h("select", { "aria-label": "Journal" }, Object.keys(JN).map(function (k) { return h("option", { value: k, text: JN[k] }); })); jsel.value = (pre && pre.journal) || "OD";
        var dt = h("input", { type: "date", value: (pre && pre.date) || c.today(), "aria-label": "Date" });
        var lb = h("input", { type: "text", value: (pre && pre.label) || "", placeholder: "Libellé", maxlength: 200, "aria-label": "Libellé" });
        var pc = h("input", { type: "text", placeholder: "Pièce (facultatif)", maxlength: 60, "aria-label": "Pièce" });
        var rows = h("div", {}), tot = h("p", { class: "muted", role: "status" }), err = h("p", { class: "ws-err", role: "alert" }), lines = [];
        function names(code) { var a = accs.filter(function (x) { return x.code === code; })[0]; return a ? a.label : ""; }
        function recalc() {
          var d = 0, cr = 0; lines.forEach(function (l) { d += Number(l.d.value) || 0; cr += Number(l.c.value) || 0; l.n.textContent = names(l.a.value.trim()); });
          tot.textContent = "Débit " + c.money(d) + " · Crédit " + c.money(cr) + (d === cr && d > 0 ? " ✓ équilibrée" : d !== cr ? " — écart " + c.money(Math.abs(d - cr)) : "");
        }
        function addLine(v) {
          v = v || {}; var l = { a: h("input", { type: "text", list: "acc-list", placeholder: "Compte", value: v.account || "", "aria-label": "Compte", style: "width:90px" }), n: h("small", { class: "muted", style: "flex:1" }),
            d: h("input", { type: "number", min: "0", step: "1", placeholder: "Débit", value: v.debit || "", "aria-label": "Débit", style: "width:110px" }), c: h("input", { type: "number", min: "0", step: "1", placeholder: "Crédit", value: v.credit || "", "aria-label": "Crédit", style: "width:110px" }) };
          [l.a, l.d, l.c].forEach(function (x) { x.addEventListener("input", recalc); }); lines.push(l);
          rows.appendChild(h("div", { class: "row", style: "margin:4px 0" }, l.a, l.n, l.d, l.c)); recalc();
        }
        ((pre && pre.lines) || [{}, {}]).forEach(addLine);
        var go = h("button", { class: "btn primary small", type: "button", text: "Enregistrer l'écriture", onclick: function () {
          err.textContent = ""; go.disabled = true;
          c.oapi("POST", "/accounting/entries", { journal: jsel.value, date: dt.value, label: lb.value, piece: pc.value, lines: lines.filter(function (l) { return l.a.value.trim(); }).map(function (l) { return { account: l.a.value.trim(), debit: Number(l.d.value) || 0, credit: Number(l.c.value) || 0 }; }) })
            .then(function (r) { close(); c.toast("Écriture " + r.number + " enregistrée."); load(); }).catch(function (e) { err.textContent = e.message; go.disabled = false; });
        } });
        b.appendChild(dl); b.appendChild(h("div", { class: "row" }, jsel, dt)); b.appendChild(h("div", { style: "margin:6px 0" }, lb, pc)); b.appendChild(rows);
        b.appendChild(h("div", { class: "row" }, h("button", { class: "btn small", type: "button", text: "+ Ajouter une ligne", onclick: function () { addLine(); } }))); b.appendChild(tot); b.appendChild(err);
        b.appendChild(h("div", { class: "row", style: "margin-top:8px" }, go)); b.appendChild(h("p", { class: "muted small", text: "Une écriture enregistrée ne se modifie plus : si vous vous trompez, annulez-la par une écriture inverse." }));
      }, { wide: true });
    }).catch(c.fail);
  }

  /* « J'ai payé le loyer 150 000 en espèces » → l'IA propose, vous relisez et enregistrez */
  function suggest() {
    getAccounts().then(function () {
      c.modal("Décrire une opération", function (b, close) {
        b.appendChild(c.form([{ k: "text", label: "Que s'est-il passé ?", type: "textarea", rows: 3, required: true, placeholder: "Ex. J'ai payé le loyer d'octobre 150 000 en espèces", hint: "L'assistant propose une écriture. Vous la relisez avant de l'enregistrer. Compte comme un message IA." }],
          "Proposer une écriture", function (v) { return c.oapi("POST", "/accounting/suggest", { text: v.text }).then(function (r) { close(); editEntry(r.proposal); }); }));
      });
    });
  }

  load();
} });
