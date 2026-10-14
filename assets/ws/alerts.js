/* Sous-application : Alertes (toutes les alertes calculées par MANAGER-IA, avec l'action associée). */
WS.register({ id: "alerts", icon: "alerts", render: function (root, c) {
  var h = c.h, LV = { high: "Urgent", medium: "À surveiller", info: "Conseil" };
  root.appendChild(h("div", { class: "ws-head" }, h("div", {}, h("h1", { text: "Alertes" }), h("p", { class: "muted", text: "Ce que MANAGER-IA a repéré dans votre organisation, de la plus urgente à la moins urgente." })),
    h("button", { class: "btn signal small", type: "button", text: "Analyse détaillée par l'IA", onclick: function (ev) {
      ev.target.disabled = true; out.textContent = "L'IA analyse vos données…";
      c.oapi("POST", "/ai/briefing").then(function (r) { out.textContent = r.text; }).catch(function (e) { out.textContent = e.message; if (e.status === 401) c.fail(e); }).then(function () { ev.target.disabled = false; });
    } })));
  var out = h("p", { class: "ai-out dc", style: "padding:14px 18px;margin-bottom:14px" });
  root.appendChild(out);
  var box = h("div", {}, c.loading());
  root.appendChild(box);
  c.oapi("GET", "/dashboard/alerts").then(function (j) {
    c.clear(box);
    if (!j.alerts.length) { box.appendChild(h("div", { class: "dc" }, c.empty("Aucune alerte : tout va bien. MANAGER-IA continue de surveiller."))); return; }
    j.alerts.forEach(function (a) {
      box.appendChild(h("div", { class: "alrow " + a.level },
        h("div", { class: "alt" }, h("span", { class: "pill " + (a.level === "high" ? "bad" : a.level === "medium" ? "mid" : "good"), text: LV[a.level] }), h("b", { text: a.title }), h("p", { text: a.text })),
        h("div", { class: "row" },
          h("button", { class: "btn small", type: "button", text: "Ouvrir", onclick: function () { location.hash = "#/" + c.S.orgId + "/" + a.module; } }),
          h("button", { class: "btn signal small", type: "button", text: "Que faire ?", onclick: function () { c.askAI("Alerte : " + a.title + " — " + a.text + ". Explique-moi pourquoi et que dois-je faire, concrètement ?"); } }))));
    });
  }).catch(c.fail);
} });
