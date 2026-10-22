/* Fiche d'un chantier : phases, dépenses, pointage, rapports, incidents et réserves, situations de travaux. */
import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { BillingForm, ExpenseForm, IssueForm, PayForm, PhaseForm, ReportForm, TimesheetForm } from './Forms.jsx';
import { Bar, CAT_FR, KIND_FR, Pill, STATUS_FR, STATUS_TONE, qty } from './common.jsx';

export default function Site({ id, back, onChange, edit }) {
  const { oapi, can, money, dateFr, modal, confirm, fail, info, toast } = useWs();
  const [tab, setTab] = useState('phases');
  const st = useLoad(() => oapi('GET', '/construction/sites/' + id), []);
  const reload = () => { st.reload(); onChange(); };
  const del = (path, text) => confirm(text, () => { oapi('DELETE', '/construction' + path).then(reload).catch(fail); });
  const m = can('manager');

  return (
    <Loaded state={st}>{(j) => {
      const s = j.site;
      const lead = m || s.foremanId === info.me.userId;
      const tabs = [['phases', 'Phases'], ...(m ? [['expenses', 'Dépenses']] : []), ['time', 'Pointage'], ['reports', 'Rapports'], ['issues', 'Incidents et réserves' + (s.openIssues ? ' (' + s.openIssues + ')' : '')], ...(m ? [['billings', 'Situations']] : [])];
      const open = (title, C, props) => modal(title, (close) => <C siteId={id} close={close} done={reload} {...props} />);
      return (
        <>
          <p><button className="link" type="button" onClick={back}>← Tous les chantiers</button></p>
          <div className="ws-head">
            <div><h1>{s.name}</h1><p className="muted">{[s.client, s.location].filter(Boolean).join(' · ') + (s.startDate || s.endDate ? ' · ' + (s.startDate ? dateFr(s.startDate) : '?') + ' → ' + (s.endDate ? dateFr(s.endDate) : '?') : '')}</p></div>
            <div className="row">
              <Pill t={[STATUS_FR[s.status], STATUS_TONE[s.status]]} />
              {m ? <button className="btn small" type="button" onClick={() => edit(s, reload)}>Modifier</button> : null}
            </div>
          </div>
          <div className="kpis">
            <div className="stat"><b>{s.progress + ' %'}</b><span>avancement global</span></div>
            <div className={'stat' + (s.late ? ' bad' : '')}><b>{s.late ? String(s.latePhases || 1) : '0'}</b><span>{s.latePhases ? 'phase(s) en retard' : s.late ? 'date de fin dépassée' : 'retard'}</span></div>
            {s.budget !== undefined ? <div className={'stat' + (s.overrun === 'over' ? ' bad' : '')}><b>{money(s.spent)}</b><span>{'dépensé sur ' + money(s.costBudget || s.budget)}</span></div> : <div className="stat"><b>{String(j.personHours)}</b><span>heures-personnes pointées</span></div>}
            {s.budget !== undefined ? <div className={'stat' + (s.forecastMargin < 0 ? ' bad' : '')}><b>{money(s.forecastMargin)}</b><span>marge prévisionnelle</span></div> : <div className={'stat' + (s.openIssues ? ' bad' : '')}><b>{String(s.openIssues)}</b><span>point(s) ouvert(s)</span></div>}
          </div>
          <Bar value={s.progress} bad={s.late} />
          {s.overrun === 'over' ? <p className="ws-err" role="alert">Attention : les dépenses dépassent le budget prévu.</p> : s.overrun === 'near' ? <p className="muted small">Les dépenses approchent du budget prévu (plus de 90 %).</p> : null}
          {s.budget !== undefined ? <p className="muted small">{'Marge prévisionnelle = marché (' + money(s.budget) + ') − dépenses − reste à faire estimé (' + money(s.remainingEstimate) + '). C\'est une estimation, à vérifier.'}</p> : null}
          <div className="ws-tabs">
            {tabs.map((t) => <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => setTab(t[0])}>{t[1]}</button>)}
          </div>

          {tab === 'phases' ? (
            <div className="ws-card">
              <h2>Phases et lots</h2>
              {lead ? <p><button className="btn small" type="button" onClick={() => open('Nouvelle phase', PhaseForm)}>Ajouter une phase</button></p> : null}
              {!j.phases.length ? <Empty text="Aucune phase. Découpez le chantier en lots pour suivre l'avancement." /> : null}
              {j.phases.map((p) => (
                <div className="line" key={p.id}>
                  <span style={{ flex: '1 1 220px' }}>
                    <b>{p.name}</b>{' '}{p.late ? <span className="pill bad">En retard</span> : p.progress >= 100 ? <span className="pill good">Terminée</span> : null}
                    <small>{' ' + p.progress + ' % · poids ' + qty(p.weight) + (p.plannedEnd ? ' · fin prévue le ' + dateFr(p.plannedEnd) : '') + (p.actualEnd ? ' · terminée le ' + dateFr(p.actualEnd) : '')}</small>
                    <Bar value={p.progress} bad={p.late} />
                  </span>
                  {lead ? (
                    <span className="row">
                      <button className="link" type="button" onClick={() => open('Modifier la phase', PhaseForm, { phase: p })}>Modifier</button>
                      <button className="link" type="button" onClick={() => del('/phases/' + p.id, 'Supprimer la phase « ' + p.name + ' » ?')}>Supprimer</button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'expenses' && m ? (
            <div className="ws-card">
              <h2>Dépenses du chantier</h2>
              <p><button className="btn small" type="button" onClick={() => open('Nouvelle dépense', ExpenseForm)}>Ajouter une dépense</button></p>
              {j.byCategory.map((c) => <div className="line" key={c.category}><span>{c.label}</span><b>{money(c.total)}</b></div>)}
              <div className="line"><span><b>Total</b></span><b>{money(s.spent) + ' / ' + money(s.costBudget || s.budget)}</b></div>
              <h3>Détail</h3>
              {!j.expenses.length ? <Empty text="Aucune dépense enregistrée." /> : null}
              {j.expenses.map((e) => (
                <div className="line" key={e.id}>
                  <span><b>{money(e.amount)}</b><small>{' ' + CAT_FR[e.category] + (e.label ? ' · ' + e.label : '') + ' · ' + dateFr(e.date)}</small>{e.inBudget ? <span className="pill good">Au budget</span> : null}</span>
                  <span className="row">
                    {!e.inBudget ? <button className="link" type="button" onClick={() => confirm('Inscrire cette dépense (' + money(e.amount) + ') au budget de votre organisation ?', () => { oapi('POST', '/construction/expenses/' + e.id + '/to-budget', { confirm: true }).then(() => { toast('Dépense inscrite au budget.'); reload(); }).catch(fail); }, 'Inscrire au budget')}>Inscrire au budget</button> : null}
                    {!e.inBudget ? <button className="link" type="button" onClick={() => open('Modifier la dépense', ExpenseForm, { expense: e })}>Modifier</button> : null}
                    <button className="link" type="button" onClick={() => del('/expenses/' + e.id, 'Supprimer cette dépense ?' + (e.inBudget ? ' L\'écriture déjà inscrite au budget reste : supprimez-la aussi dans Budget.' : ''))}>Supprimer</button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'time' ? (
            <div className="ws-card">
              <h2>Pointage journalier</h2>
              <p><button className="btn small" type="button" onClick={() => open('Pointage', TimesheetForm)}>Pointer</button></p>
              {!j.timesheets.length ? <Empty text="Aucun pointage. Notez chaque jour combien de personnes ont travaillé, et combien d'heures." /> : null}
              {j.timesheets.map((t) => (
                <div className="line" key={t.id}>
                  <span><b>{dateFr(t.date) + ' · ' + (t.worker || 'Équipe')}</b><small>{' ' + t.headcount + ' personne(s) × ' + qty(t.hours) + ' h = ' + qty(t.personHours) + ' h' + (t.notes ? ' · ' + t.notes : '')}</small></span>
                  {lead || t.own ? <button className="link" type="button" onClick={() => del('/timesheets/' + t.id, 'Supprimer ce pointage ?')}>Supprimer</button> : null}
                </div>
              ))}
              <p className="muted small">{'Total pointé sur ce chantier : ' + qty(j.personHours) + ' heures-personnes.'}</p>
            </div>
          ) : null}

          {tab === 'reports' ? (
            <div className="ws-card">
              <h2>Rapports journaliers</h2>
              <p><button className="btn small" type="button" onClick={() => open('Rapport du jour', ReportForm)}>Nouveau rapport</button></p>
              {!j.reports.length ? <Empty text="Aucun rapport. Notez la météo, les travaux faits et les incidents de la journée." /> : null}
              {j.reports.map((r) => (
                <div className="line" key={r.id}>
                  <span style={{ flex: '1 1 240px' }}><b>{dateFr(r.date)}</b><small>{[r.weather, r.headcount ? r.headcount + ' personne(s)' : '', r.by].filter(Boolean).map((x) => ' · ' + x).join('')}</small><br />{r.work}{r.incidents ? <><br /><small>{'Incidents : ' + r.incidents}</small></> : null}</span>
                  {lead || r.own ? (
                    <span className="row">
                      <button className="link" type="button" onClick={() => open('Modifier le rapport', ReportForm, { report: r })}>Modifier</button>
                      <button className="link" type="button" onClick={() => del('/reports/' + r.id, 'Supprimer ce rapport ?')}>Supprimer</button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'issues' ? (
            <div className="ws-card">
              <h2>Incidents, sécurité et réserves</h2>
              <p><button className="btn small" type="button" onClick={() => open('Signaler un point', IssueForm)}>Signaler</button></p>
              {!j.issues.length ? <Empty text="Aucun incident ni réserve." /> : null}
              {j.issues.map((i) => (
                <div className="line" key={i.id}>
                  <span><b>{i.title}</b>{' '}<span className={'pill ' + (i.status === 'open' ? 'mid' : 'good')}>{i.status === 'open' ? 'À traiter' : 'Levé'}</span><small>{' ' + KIND_FR[i.kind] + ' · ' + dateFr(i.date) + (i.resolvedAt ? ' · levé le ' + dateFr(i.resolvedAt) : '') + (i.description ? ' · ' + i.description : '')}</small></span>
                  {lead || i.own ? (
                    <span className="row">
                      <button className="link" type="button" onClick={() => { oapi('PUT', '/construction/issues/' + i.id, { status: i.status === 'open' ? 'resolved' : 'open' }).then(reload).catch(fail); }}>{i.status === 'open' ? 'Marquer levé' : 'Rouvrir'}</button>
                      <button className="link" type="button" onClick={() => del('/issues/' + i.id, 'Supprimer ce point ?')}>Supprimer</button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'billings' && m ? (
            <div className="ws-card">
              <h2>Situations de travaux et acomptes</h2>
              <p><button className="btn small" type="button" onClick={() => open('Nouvelle situation', BillingForm)}>Ajouter une situation</button></p>
              <div className="line"><span>Facturé / payé / reste dû</span><b>{money(s.billed) + ' / ' + money(s.paid) + ' / ' + money(s.toPay)}</b></div>
              <div className="line"><span>Reste à facturer sur le marché</span><b>{money(Math.max(s.budget - s.billed, 0))}</b></div>
              {!j.billings.length ? <Empty text="Aucune situation facturée au client." /> : null}
              {j.billings.map((b) => (
                <div className="line" key={b.id}>
                  <span><b>{b.label + ' : ' + money(b.amount)}</b>{' '}{b.left === 0 ? <span className="pill good">Payée</span> : b.late ? <span className="pill bad">En retard</span> : b.paid ? <span className="pill mid">Partielle</span> : <span className="pill mid">À encaisser</span>}
                    <small>{' ' + dateFr(b.billedAt) + (b.dueDate ? ' · échéance ' + dateFr(b.dueDate) : '') + ' · reçu ' + money(b.paid) + ' · reste ' + money(b.left)}</small></span>
                  <span className="row">
                    {b.left > 0 ? <button className="link" type="button" onClick={() => open('Paiement reçu', PayForm, { billing: b })}>Paiement reçu</button> : null}
                    <button className="link" type="button" onClick={() => open('Modifier la situation', BillingForm, { billing: b })}>Modifier</button>
                    <button className="link" type="button" onClick={() => del('/billings/' + b.id, 'Supprimer « ' + b.label + ' » ?')}>Supprimer</button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      );
    }}
    </Loaded>
  );
}
