import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Budget (entrées, sorties, limites par catégorie, conseils de l'IA). Réservée aux responsables et plus. */

export default function Budget() {
  const { oapi, can, money, dateFr, today, modal, confirm, propose, fail, info } = useWs();
  const branches = info.branches;
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const st = useLoad(() => oapi('GET', '/budget?month=' + month), [month]);
  const load = st.reload;

  const addEntry = (e0) => {
    const e = e0 || {};
    modal(e.id ? 'Modifier la ligne' : 'Nouvelle ligne', (close) => {
      const f = [
        { k: 'kind', label: 'Type', type: 'select', options: [['expense', 'Sortie (dépense)'], ['income', 'Entrée (recette)']], value: e.kind || 'expense' },
        { k: 'category', label: 'Catégorie', required: true, value: e.category, placeholder: 'Loyer, Salaires, Ventes, Transport…' },
        { k: 'amount', label: 'Montant (' + info.org.currency + ')', required: true, value: e.amount, placeholder: '25000' },
        { k: 'label', label: 'Détail', value: e.label },
        { k: 'date', label: 'Date', type: 'date', value: e.date || today() },
      ];
      if (branches.length && !e.id) f.push({ k: 'branchId', label: 'Antenne', type: 'select', options: [['', 'Toute l\'organisation']].concat(branches.map((x) => [String(x.id), x.name])) });
      return (
        <Form
          fields={f}
          submitText="Enregistrer"
          onSubmit={(v) => {
            const payload = { kind: v.kind, category: v.category, amount: v.amount, label: v.label, date: v.date };
            if (v.branchId) payload.branchId = v.branchId;
            return oapi(e.id ? 'PUT' : 'POST', '/budget/entries' + (e.id ? '/' + e.id : ''), payload).then(() => { close(); load(); });
          }}
        />
      );
    });
  };

  const editPlans = () => {
    oapi('GET', '/budget?month=' + month).then((j) => {
      const text = Object.keys(j.plans).map((k) => k + ' : ' + j.plans[k]).join('\n');
      modal('Limites mensuelles par catégorie', (close) => (
        <Form
          fields={[{ k: 't', label: 'Une ligne par catégorie', type: 'textarea', rows: 8, value: text, hint: 'Format : Catégorie : montant (ex : Loyer : 60000). Remplace les limites actuelles.' }]}
          submitText="Enregistrer"
          onSubmit={(v) => {
            const plans = v.t.split('\n').map((l) => { const m = /^(.+?)\s*:\s*([\d\s.,]+)$/.exec(l.trim()); return m ? { category: m[1].trim(), monthlyLimit: m[2] } : null; }).filter(Boolean);
            return oapi('PUT', '/budget/plans', { plans }).then(() => { close(); load(); });
          }}
        />
      ));
    }).catch(fail);
  };

  const aiPlan = () => {
    propose('budget-plan', {}, {
      title: 'Limites proposées par l\'IA',
      applyText: 'Remplacer mes limites',
      render: (p) => (
        <>
          {!(p.plans || []).length ? <Empty text="L'IA n'a pas assez de données pour proposer des limites." /> : null}
          {(p.plans || []).map((x, i) => <div className="line" key={i}><span>{x.category}</span><b>{money(x.monthlyLimit) + ' / mois'}</b></div>)}
          {(p.advice || []).map((a, i) => <p className="small" key={i}>{'• ' + a}</p>)}
        </>
      ),
      done: load,
    });
  };

  const j = st.data;
  return (
    <>
      <div className="ws-head">
        <div><h1>Budget</h1><p className="muted">Vos entrées et sorties d'argent, mois par mois.</p></div>
        <div className="row">
          <input type="month" value={month} aria-label="Mois" onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} />
          {can('admin') ? <button className="btn signal small" type="button" onClick={aiPlan}>Limites avec l'IA</button> : null}
          {can('admin') ? <button className="btn small" type="button" onClick={editPlans}>Limites</button> : null}
          <button className="btn primary small" type="button" onClick={() => addEntry()}>Ajouter une ligne</button>
        </div>
      </div>
      <div>
        {st.loading ? <Loading /> : null}
        {!st.loading && st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
        {!st.loading && j ? (
          <>
            <div className="kpis">
              <div className="stat"><b className="ok">{money(j.income)}</b><span>entrées</span></div>
              <div className="stat"><b>{money(j.expense)}</b><span>sorties</span></div>
              <div className={'stat' + (j.balance < 0 ? ' bad' : '')}><b>{money(j.balance)}</b><span>solde du mois</span></div>
            </div>
            <div className="ws-card">
              <h2>Dépenses par catégorie</h2>
              {!j.categories.length ? <Empty text="Aucune dépense ce mois-ci." /> : null}
              {j.categories.map((k) => {
                const pct = k.limit ? Math.min(100, Math.round(100 * k.spent / k.limit)) : 0;
                return (
                  <div className="cat" key={k.category}>
                    <div className="line">
                      <span>{k.category}</span>
                      <small className={k.limit && k.spent > k.limit ? 'late' : ''}>{money(k.spent) + (k.limit ? ' / ' + money(k.limit) : ' (pas de limite)')}</small>
                    </div>
                    {k.limit ? <div className={'meter' + (k.spent > k.limit ? ' over' : '')}><i style={{ width: pct + '%' }} /></div> : null}
                  </div>
                );
              })}
            </div>
            <div className="ws-card">
              <h2>Lignes du mois</h2>
              {!j.entries.length ? <Empty text="Aucune ligne." /> : null}
              {j.entries.map((e) => (
                <div className="line" key={e.id}>
                  <span><b className={e.kind === 'income' ? 'ok' : ''}>{(e.kind === 'income' ? '+ ' : '− ') + money(e.amount)}</b>{' '}{e.category}{e.label ? <small>{' · ' + e.label}</small> : null}</span>
                  <span className="row">
                    <small>{dateFr(e.date)}</small>
                    <button className="link" type="button" onClick={() => addEntry(e)}>Modifier</button>
                    <button className="link" type="button" onClick={() => confirm('Supprimer cette ligne ?', () => { oapi('DELETE', '/budget/entries/' + e.id).then(load).catch(fail); })}>Supprimer</button>
                  </span>
                </div>
              ))}
            </div>
            <p className="muted small">Les conseils de l'IA sont des repères de gestion, pas des conseils comptables ou fiscaux.</p>
          </>
        ) : null}
      </div>
    </>
  );
}
