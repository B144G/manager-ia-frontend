/* Fiche d'un chantier : phases, dépenses, pointage, rapports, incidents et réserves, situations de travaux. */
import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { BillingForm, ExpenseForm, IssueForm, PayForm, PhaseForm, ReportForm, TimesheetForm } from './Forms.jsx';
import { Bar, CAT_FR, KIND_FR, Pill, STATUS_FR, STATUS_TONE, qty } from './common.jsx';

export default function Site({ id, back, onChange, edit }) {
  const t = useT();
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
      const tabs = [['phases', t('Phases')], ...(m ? [['expenses', t('Dépenses')]] : []), ['time', t('Pointage')], ['reports', t('Rapports')], ['issues', s.openIssues ? t('Incidents et réserves ({n})', { n: s.openIssues }) : t('Incidents et réserves')], ...(m ? [['billings', t('Situations')]] : [])];
      const open = (title, C, props) => modal(title, (close) => <C siteId={id} close={close} done={reload} {...props} />);
      return (
        <>
          <p><button className="link" type="button" onClick={back}>{t('← Tous les chantiers')}</button></p>
          <div className="ws-head">
            <div><h1>{s.name}</h1><p className="muted">{[s.client, s.location].filter(Boolean).join(' · ') + (s.startDate || s.endDate ? ' · ' + (s.startDate ? dateFr(s.startDate) : '?') + ' → ' + (s.endDate ? dateFr(s.endDate) : '?') : '')}</p></div>
            <div className="row">
              <Pill s={[STATUS_FR[s.status], STATUS_TONE[s.status]]} />
              {m ? <button className="btn small" type="button" onClick={() => edit(s, reload)}>{t('Modifier')}</button> : null}
            </div>
          </div>
          <div className="kpis">
            <div className="stat"><b>{s.progress + ' %'}</b><span>{t('avancement global')}</span></div>
            <div className={'stat' + (s.late ? ' bad' : '')}><b>{s.late ? String(s.latePhases || 1) : '0'}</b><span>{s.latePhases ? t('phase(s) en retard') : s.late ? t('date de fin dépassée') : t('retard')}</span></div>
            {s.budget !== undefined ? <div className={'stat' + (s.overrun === 'over' ? ' bad' : '')}><b>{money(s.spent)}</b><span>{t('dépensé sur {amount}', { amount: money(s.costBudget || s.budget) })}</span></div> : <div className="stat"><b>{String(j.personHours)}</b><span>{t('heures-personnes pointées')}</span></div>}
            {s.budget !== undefined ? <div className={'stat' + (s.forecastMargin < 0 ? ' bad' : '')}><b>{money(s.forecastMargin)}</b><span>{t('marge prévisionnelle')}</span></div> : <div className={'stat' + (s.openIssues ? ' bad' : '')}><b>{String(s.openIssues)}</b><span>{t('point(s) ouvert(s)')}</span></div>}
          </div>
          <Bar value={s.progress} bad={s.late} />
          {s.overrun === 'over' ? <p className="ws-err" role="alert">{t('Attention : les dépenses dépassent le budget prévu.')}</p> : s.overrun === 'near' ? <p className="muted small">{t('Les dépenses approchent du budget prévu (plus de 90 %).')}</p> : null}
          {s.budget !== undefined ? <p className="muted small">{t("Marge prévisionnelle = marché ({budget}) − dépenses − reste à faire estimé ({remaining}). C'est une estimation, à vérifier.", { budget: money(s.budget), remaining: money(s.remainingEstimate) })}</p> : null}
          <div className="ws-tabs">
            {tabs.map((x) => <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} onClick={() => setTab(x[0])}>{x[1]}</button>)}
          </div>

          {tab === 'phases' ? (
            <div className="ws-card">
              <h2>{t('Phases et lots')}</h2>
              {lead ? <p><button className="btn small" type="button" onClick={() => open(t('Nouvelle phase'), PhaseForm)}>{t('Ajouter une phase')}</button></p> : null}
              {!j.phases.length ? <Empty text={t("Aucune phase. Découpez le chantier en lots pour suivre l'avancement.")} /> : null}
              {j.phases.map((p) => (
                <div className="line" key={p.id}>
                  <span style={{ flex: '1 1 220px' }}>
                    <b>{p.name}</b>{' '}{p.late ? <span className="pill bad">{t('En retard')}</span> : p.progress >= 100 ? <span className="pill good">{t('Terminée')}</span> : null}
                    <small>{' ' + t('{n} % · poids {weight}', { n: p.progress, weight: qty(p.weight) }) + (p.plannedEnd ? ' · ' + t('fin prévue le {date}', { date: dateFr(p.plannedEnd) }) : '') + (p.actualEnd ? ' · ' + t('terminée le {date}', { date: dateFr(p.actualEnd) }) : '')}</small>
                    <Bar value={p.progress} bad={p.late} />
                  </span>
                  {lead ? (
                    <span className="row">
                      <button className="link" type="button" onClick={() => open(t('Modifier la phase'), PhaseForm, { phase: p })}>{t('Modifier')}</button>
                      <button className="link" type="button" onClick={() => del('/phases/' + p.id, t('Supprimer la phase « {name} » ?', { name: p.name }))}>{t('Supprimer')}</button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'expenses' && m ? (
            <div className="ws-card">
              <h2>{t('Dépenses du chantier')}</h2>
              <p><button className="btn small" type="button" onClick={() => open(t('Nouvelle dépense'), ExpenseForm)}>{t('Ajouter une dépense')}</button></p>
              {j.byCategory.map((c) => <div className="line" key={c.category}><span>{t(c.label)}</span><b>{money(c.total)}</b></div>)}
              <div className="line"><span><b>{t('Total')}</b></span><b>{money(s.spent) + ' / ' + money(s.costBudget || s.budget)}</b></div>
              <h3>{t('Détail')}</h3>
              {!j.expenses.length ? <Empty text={t('Aucune dépense enregistrée.')} /> : null}
              {j.expenses.map((e) => (
                <div className="line" key={e.id}>
                  <span><b>{money(e.amount)}</b><small>{' ' + t(CAT_FR[e.category]) + (e.label ? ' · ' + e.label : '') + ' · ' + dateFr(e.date)}</small>{e.inBudget ? <span className="pill good">{t('Au budget')}</span> : null}</span>
                  <span className="row">
                    {!e.inBudget ? <button className="link" type="button" onClick={() => confirm(t('Inscrire cette dépense ({amount}) au budget de votre organisation ?', { amount: money(e.amount) }), () => { oapi('POST', '/construction/expenses/' + e.id + '/to-budget', { confirm: true }).then(() => { toast(t('Dépense inscrite au budget.')); reload(); }).catch(fail); }, t('Inscrire au budget'))}>{t('Inscrire au budget')}</button> : null}
                    {!e.inBudget ? <button className="link" type="button" onClick={() => open(t('Modifier la dépense'), ExpenseForm, { expense: e })}>{t('Modifier')}</button> : null}
                    <button className="link" type="button" onClick={() => del('/expenses/' + e.id, e.inBudget ? t("Supprimer cette dépense ? L'écriture déjà inscrite au budget reste : supprimez-la aussi dans Budget.") : t('Supprimer cette dépense ?'))}>{t('Supprimer')}</button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'time' ? (
            <div className="ws-card">
              <h2>{t('Pointage journalier')}</h2>
              <p><button className="btn small" type="button" onClick={() => open(t('Pointage'), TimesheetForm)}>{t('Pointer')}</button></p>
              {!j.timesheets.length ? <Empty text={t("Aucun pointage. Notez chaque jour combien de personnes ont travaillé, et combien d'heures.")} /> : null}
              {j.timesheets.map((ts) => (
                <div className="line" key={ts.id}>
                  <span><b>{dateFr(ts.date) + ' · ' + (ts.worker || t('Équipe'))}</b><small>{' ' + t('{n} personne(s) × {hours} h = {total} h', { n: ts.headcount, hours: qty(ts.hours), total: qty(ts.personHours) }) + (ts.notes ? ' · ' + ts.notes : '')}</small></span>
                  {lead || ts.own ? <button className="link" type="button" onClick={() => del('/timesheets/' + ts.id, t('Supprimer ce pointage ?'))}>{t('Supprimer')}</button> : null}
                </div>
              ))}
              <p className="muted small">{t('Total pointé sur ce chantier : {n} heures-personnes.', { n: qty(j.personHours) })}</p>
            </div>
          ) : null}

          {tab === 'reports' ? (
            <div className="ws-card">
              <h2>{t('Rapports journaliers')}</h2>
              <p><button className="btn small" type="button" onClick={() => open(t('Rapport du jour'), ReportForm)}>{t('Nouveau rapport')}</button></p>
              {!j.reports.length ? <Empty text={t('Aucun rapport. Notez la météo, les travaux faits et les incidents de la journée.')} /> : null}
              {j.reports.map((r) => (
                <div className="line" key={r.id}>
                  <span style={{ flex: '1 1 240px' }}><b>{dateFr(r.date)}</b><small>{[r.weather, r.headcount ? t('{n} personne(s)', { n: r.headcount }) : '', r.by].filter(Boolean).map((x) => ' · ' + x).join('')}</small><br />{r.work}{r.incidents ? <><br /><small>{t('Incidents : {text}', { text: r.incidents })}</small></> : null}</span>
                  {lead || r.own ? (
                    <span className="row">
                      <button className="link" type="button" onClick={() => open(t('Modifier le rapport'), ReportForm, { report: r })}>{t('Modifier')}</button>
                      <button className="link" type="button" onClick={() => del('/reports/' + r.id, t('Supprimer ce rapport ?'))}>{t('Supprimer')}</button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'issues' ? (
            <div className="ws-card">
              <h2>{t('Incidents, sécurité et réserves')}</h2>
              <p><button className="btn small" type="button" onClick={() => open(t('Signaler un point'), IssueForm)}>{t('Signaler')}</button></p>
              {!j.issues.length ? <Empty text={t('Aucun incident ni réserve.')} /> : null}
              {j.issues.map((i) => (
                <div className="line" key={i.id}>
                  <span><b>{i.title}</b>{' '}<span className={'pill ' + (i.status === 'open' ? 'mid' : 'good')}>{i.status === 'open' ? t('À traiter') : t('Levé')}</span><small>{' ' + t(KIND_FR[i.kind]) + ' · ' + dateFr(i.date) + (i.resolvedAt ? ' · ' + t('levé le {date}', { date: dateFr(i.resolvedAt) }) : '') + (i.description ? ' · ' + i.description : '')}</small></span>
                  {lead || i.own ? (
                    <span className="row">
                      <button className="link" type="button" onClick={() => { oapi('PUT', '/construction/issues/' + i.id, { status: i.status === 'open' ? 'resolved' : 'open' }).then(reload).catch(fail); }}>{i.status === 'open' ? t('Marquer levé') : t('Rouvrir')}</button>
                      <button className="link" type="button" onClick={() => del('/issues/' + i.id, t('Supprimer ce point ?'))}>{t('Supprimer')}</button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'billings' && m ? (
            <div className="ws-card">
              <h2>{t('Situations de travaux et acomptes')}</h2>
              <p><button className="btn small" type="button" onClick={() => open(t('Nouvelle situation'), BillingForm)}>{t('Ajouter une situation')}</button></p>
              <div className="line"><span>{t('Facturé / payé / reste dû')}</span><b>{money(s.billed) + ' / ' + money(s.paid) + ' / ' + money(s.toPay)}</b></div>
              <div className="line"><span>{t('Reste à facturer sur le marché')}</span><b>{money(Math.max(s.budget - s.billed, 0))}</b></div>
              {!j.billings.length ? <Empty text={t('Aucune situation facturée au client.')} /> : null}
              {j.billings.map((b) => (
                <div className="line" key={b.id}>
                  <span><b>{b.label + ' : ' + money(b.amount)}</b>{' '}{b.left === 0 ? <span className="pill good">{t('Payée')}</span> : b.late ? <span className="pill bad">{t('En retard')}</span> : b.paid ? <span className="pill mid">{t('Partielle')}</span> : <span className="pill mid">{t('À encaisser')}</span>}
                    <small>{' ' + dateFr(b.billedAt) + (b.dueDate ? ' · ' + t('échéance {date}', { date: dateFr(b.dueDate) }) : '') + ' · ' + t('reçu {amount}', { amount: money(b.paid) }) + ' · ' + t('reste {amount}', { amount: money(b.left) })}</small></span>
                  <span className="row">
                    {b.left > 0 ? <button className="link" type="button" onClick={() => open(t('Paiement reçu'), PayForm, { billing: b })}>{t('Paiement reçu')}</button> : null}
                    <button className="link" type="button" onClick={() => open(t('Modifier la situation'), BillingForm, { billing: b })}>{t('Modifier')}</button>
                    <button className="link" type="button" onClick={() => del('/billings/' + b.id, t('Supprimer « {name} » ?', { name: b.label }))}>{t('Supprimer')}</button>
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
