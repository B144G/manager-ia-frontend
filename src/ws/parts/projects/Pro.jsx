import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BarChart, Gantt, Gauge, LineChart, RiskMatrix } from '../bp/Charts.jsx';
import { BTN, downloadCsv } from '../finance/util.jsx';

/* Projets · pilotage : portefeuille (feu tricolore), valeur acquise et courbe en S, burn-down, Gantt avec chemin critique et plan de
   référence, prévisions de fin et de coût, risques et problèmes, charge par personne et par semaine. Les montants ne sont montrés
   qu'aux responsables (le serveur ne les envoie pas aux autres). Tous les calculs sont faits par le serveur. */

const RAG = { green: 'Vert : dans les clous', amber: 'Orange : à surveiller', red: 'Rouge : en difficulté', grey: 'Gris : terminé ou sans tâche' };
const RAG_SHORT = { green: 'Vert', amber: 'Orange', red: 'Rouge', grey: 'Gris' };
const REASON = { spi: 'Retard sur le planning (SPI)', cpi: 'Coût au-dessus de la valeur produite (CPI)', overBudget: 'Budget dépassé', eac: 'Coût final prévu au-dessus du budget', late: "Fin prévue après l'échéance", pastDue: 'Échéance dépassée', overdueTasks: 'Tâches en retard', highRisks: 'Risque élevé ouvert' };
const RKIND = { risk: 'Risque', issue: 'Problème' };
const RSTATUS = { open: 'Ouvert', mitigating: 'En traitement', closed: 'Clos' };
const LEVEL = { high: 'Élevé', medium: 'Moyen', low: 'Faible' };
const num = (v, d = 2) => (v === null || v === undefined ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString(getLocale(), { maximumFractionDigits: d }));

function Rag({ rag }) { const t = useT(); return <span className={'bp-st ' + rag} title={t(RAG[rag])}>{t(RAG_SHORT[rag])}</span>; }
function Kpi({ label, value, sub, tone }) { return <div className={'bp-kpi' + (tone ? ' ' + tone : '')}><small>{label}</small><b className="bp-num">{value}</b>{sub ? <span>{sub}</span> : null}</div>; }
const toneIdx = (v) => (v === null || v === undefined ? '' : v < 0.8 ? 'bad' : v < 0.95 ? 'warn' : 'good');

/* ---------- Portefeuille ---------- */
export function Portfolio({ open }) {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const [all, setAll] = useState(false);
  const st = useLoad(() => oapi('GET', '/projects/portfolio' + (all ? '?all=1' : '')), [all]);
  const exportCsv = (d) => {
    const head = [t('Projet'), t('Santé'), t('Échéance'), t('Fin prévue'), t('Jours de retard'), t('Tâches'), t('Terminées'), t('En retard'), t('Avancement %'), t('Prévu %'), 'SPI', t('Risques élevés')].concat(d.canSeeCosts ? [t('Budget (BAC)'), 'PV', 'EV', 'AC', 'CPI', 'EAC', 'VAC'] : []);
    downloadCsv('portefeuille-projets.csv', [head].concat(d.items.map((x) => [x.name, t(RAG_SHORT[x.rag]), x.due || '', x.endForecast || '', x.lateDays, x.tasks, x.done, x.overdue, x.percentComplete, x.percentPlanned, x.spi ?? '', x.highRisks].concat(d.canSeeCosts ? [x.bac ?? '', x.pv ?? '', x.ev ?? '', x.ac ?? '', x.cpi ?? '', x.eac ?? '', x.vac ?? ''] : []))));
  };
  return (
    <div className="bp">
      <Loaded state={st}>{(d) => {
        const T = d.totals;
        const shown = d.items.slice(0, 12);
        return (
          <>
            <div className="ws-card">
              <div className="bp-head">
                <h2>{t('Portefeuille de projets')}</h2>
                <div className="row-l">
                  <label><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} style={{ width: 20, height: 20 }} />{t('Inclure les projets terminés')}</label>
                  <button className="btn small" type="button" style={BTN} onClick={() => exportCsv(d)}>{t('Exporter (CSV)')}</button>
                </div>
              </div>
              <div className="bp-kpis">
                <Kpi label={t('Projets suivis')} value={String(T.projects)} sub={t('{g} vert · {a} orange · {r} rouge', { g: T.green, a: T.amber, r: T.red })} tone={T.red ? 'bad' : T.amber ? 'warn' : 'good'} />
                <Kpi label={t('Avancement moyen')} value={T.avgComplete === null ? '—' : num(T.avgComplete, 1) + ' %'} sub={t('{n} projet(s) en retard', { n: T.late })} tone={T.late ? 'warn' : ''} />
                <Kpi label={t('Tâches en retard')} value={String(T.overdueTasks)} sub={t('{n} risque(s) élevé(s) ouvert(s)', { n: T.highRisks })} tone={T.overdueTasks || T.highRisks ? 'warn' : ''} />
                {d.canSeeCosts ? <Kpi label={t('SPI / CPI du portefeuille')} value={num(T.spi) + ' / ' + num(T.cpi)} sub={t('{n} projet(s) chiffré(s)', { n: T.costed })} tone={toneIdx(Math.min(T.spi ?? 1, T.cpi ?? 1))} /> : null}
                {d.canSeeCosts ? <Kpi label={t('Budget total (BAC)')} value={money(T.bac)} sub={t('coût réel {ac} · coût final prévu {eac}', { ac: money(T.ac), eac: money(T.eac) })} tone={T.eac > T.bac ? 'bad' : ''} /> : null}
              </div>
              {shown.length ? (
                <BarChart title={t('Avancement acquis et prévu à date, par projet (%)')} labels={shown.map((x) => (x.name.length > 14 ? x.name.slice(0, 13) + '…' : x.name))} fmt={(v) => num(v, 1) + ' %'} height={220}
                  bars={[{ key: 'pl', label: t('Prévu à date'), values: shown.map((x) => x.percentPlanned), color: 'plan' }, { key: 'ev', label: t('Acquis'), values: shown.map((x) => x.percentComplete), color: 's1' }]}
                  onPick={(i) => open(shown[i].id)} />
              ) : null}
            </div>
            <div className="ws-card">
              {!d.items.length ? <Empty text={t('Aucun projet en cours.')} /> : (
                <div className="bp-scroll">
                  <table className="bp-table">
                    <thead><tr><th>{t('Projet')}</th><th>{t('Santé')}</th><th>{t('Avancement')}</th><th>SPI</th>{d.canSeeCosts ? <><th>CPI</th><th>{t('Budget')}</th><th>{t('Coût final prévu')}</th></> : null}<th>{t('Fin prévue')}</th><th>{t('Retard')}</th></tr></thead>
                    <tbody>
                      {d.items.map((x) => (
                        <tr key={x.id}>
                          <td><button className="link" type="button" onClick={() => open(x.id)}>{x.name}</button><br /><small className="muted">{x.reasons.map((r) => t(REASON[r])).join(' · ') || t('Rien à signaler')}</small></td>
                          <td><Rag rag={x.rag} /></td>
                          <td className="bp-num">{num(x.percentComplete, 1) + ' %'}<br /><small className="muted">{t('prévu {p} %', { p: num(x.percentPlanned, 1) })}</small></td>
                          <td className="bp-num">{num(x.spi)}</td>
                          {d.canSeeCosts ? <><td className="bp-num">{num(x.cpi)}</td><td className="bp-num">{x.bac === undefined ? '—' : money(x.bac)}</td><td className="bp-num">{x.eac === undefined || x.eac === null ? '—' : money(x.eac)}</td></> : null}
                          <td>{x.endForecast ? dateFr(x.endForecast) : '—'}</td>
                          <td className="bp-num" style={{ color: x.lateDays ? 'var(--pink)' : undefined }}>{x.lateDays ? t('{n} j', { n: x.lateDays }) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="small muted">{t('Rouge : SPI ou CPI sous 0,8, budget dépassé, fin prévue plus de 14 jours après l\'échéance ou échéance passée. Orange : indices sous 0,95, retard prévu, tâches en retard ou risque élevé.')}</p>
            </div>
          </>
        );
      }}</Loaded>
    </div>
  );
}

/* ---------- Charge prévue par personne et par semaine ---------- */
export function WorkloadPlan() {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const [cap, setCap] = useState('40');
  const [weeks, setWeeks] = useState(8);
  const [q, setQ] = useState('40');
  const st = useLoad(() => oapi('GET', `/projects/workload/plan?weeks=${weeks}&capacity=${encodeURIComponent(q)}`), [weeks, q]);
  const lvl = (p) => (p === null ? 'l0' : p > 100 ? 'over' : p >= 70 ? 'l3' : p >= 35 ? 'l2' : p > 0 ? 'l1' : 'l0');
  return (
    <div className="ws-card bp">
      <div className="bp-head">
        <h2>{t('Charge prévue par semaine')}</h2>
        <div className="row-l">
          <label>{t('Capacité (h / semaine)')}<input inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} onBlur={() => setQ(cap || '40')} aria-label={t('Capacité (h / semaine)')} style={{ width: 64 }} /></label>
          <label>{t('Semaines')}<select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} aria-label={t('Semaines')}>{[4, 8, 12].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
      </div>
      <Loaded state={st}>{(d) => (
        <>
          {!d.rows.length ? <Empty text={t('Aucune tâche ouverte avec une estimation.')} /> : (
            <div className="bp-scroll">
              <table className="bp-table bp-heat">
                <thead><tr><th>{t('Personne')}</th>{d.weeks.map((w) => <th key={w}>{dateFr(w)}</th>)}<th>{t('Total')}</th></tr></thead>
                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.userId === null ? 'none' : r.userId}>
                      <td>{r.userId === null ? <i>{t('Non assignées')}</i> : r.name}<br /><small className="muted">{t('{n} tâche(s)', { n: r.tasks }) + (r.peak > 100 ? ' · ' + t('surcharge') : '')}</small></td>
                      {r.hours.map((h, i) => <td key={i} className={'h bp-num ' + lvl(r.load[i])} title={r.load[i] === null ? '' : t('{h} h, {p} % de la capacité', { h: num(h, 1), p: r.load[i] })}>{h ? num(h, 1) : '·'}{r.load[i] > 100 ? ' !' : ''}</td>)}
                      <td className="bp-num"><b>{num(r.total, 1)}</b>{r.beyond ? <small className="muted">{' + ' + num(r.beyond, 1)}</small> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted">{t("Reste à faire (estimation - temps saisi) réparti également entre le début et l'échéance de chaque tâche ; une tâche en retard compte sur cette semaine. Cases marquées « ! » : au-dessus de la capacité.")}{d.unestimated ? ' ' + t('{n} tâche(s) ouverte(s) sans estimation ne sont pas comptées.', { n: d.unestimated }) : ''}</p>
        </>
      )}</Loaded>
    </div>
  );
}

/* ---------- Un projet : valeur acquise, courbes, Gantt, prévisions ---------- */
function alertText(t, a, money) {
  switch (a.code) {
    case 'spi': return [t('Retard sur le planning'), t('SPI {v} : {p} % du travail prévu à date est fait.', { v: num(a.value), p: Math.round(a.value * 100) })];
    case 'cpi': return [t('Coût au-dessus de la valeur produite'), t('CPI {v} : chaque franc dépensé produit {v} franc de travail prévu.', { v: num(a.value) })];
    case 'eac': return [t('Coût final prévu au-dessus du budget'), t('Dépassement prévu : {v}.', { v: money(a.value) })];
    case 'tcpi': return [t('Fin dans le budget difficile'), t('TCPI {v} : il faudrait être {p} % plus efficace que prévu sur le reste.', { v: num(a.value), p: Math.round((a.value - 1) * 100) })];
    case 'budgetExhausted': return [t('Budget épuisé'), t('Le coût réel atteint le budget alors que le travail n\'est pas fini.')];
    case 'late': return [t("Fin prévue après l'échéance"), t('{n} jour(s) de retard prévu(s).', { n: a.value })];
    case 'overdueTasks': return [t('Tâches en retard'), t('{n} tâche(s) ouverte(s) ont dépassé leur échéance.', { n: a.value })];
    case 'highRisks': return [t('Risque élevé ouvert'), t('{n} risque(s) noté(s) 15 ou plus.', { n: a.value })];
    case 'noBaseline': return [t('Pas de plan de référence'), t('Figez le plan pour mesurer les écarts quand les dates bougent.')];
    default: return [a.code, ''];
  }
}

export function ProjectPilot({ id, rev }) {
  const t = useT();
  const { oapi, money, dateFr, can, confirm, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/projects/' + id + '/pro'), [id, rev]);
  const baseline = (del) => {
    const go = () => oapi(del ? 'DELETE' : 'POST', '/projects/' + id + '/baseline', del ? undefined : {}).then(() => { toast(del ? t('Plan de référence supprimé.') : t('Plan de référence enregistré.')); st.reload(); }).catch(fail);
    if (del) confirm(t('Supprimer le plan de référence ? La valeur planifiée suivra de nouveau le plan actuel.'), go); else go();
  };
  return (
    <div className="bp">
      <Loaded state={st}>{(a) => {
        const m = a.metrics; const f = a.forecast;
        const money_ = a.canSeeCosts && m.mode === 'money';
        const eff = m.mode !== 'money';
        const unitFmt = (v) => (eff ? num(v, 1) + (m.unit === 'hours' ? ' h' : '') : money(v));
        const labels = a.series.map((s) => dateFr(s.date));
        const ti = a.series.findIndex((s) => s.date === a.today);
        const ends = [[t('Planning (dépendances)'), f.endByPlan], [t('Planning acquis (SPI)'), f.endByEarnedSchedule], [t('Vitesse des 28 derniers jours'), f.endByVelocity]];
        return (
          <>
            <div className="ws-card">
              <div className="bp-head">
                <h2>{t('Pilotage du projet')} <Rag rag={a.health.rag} /></h2>
                {can('manager') ? (
                  <div className="row-l">
                    <button className="btn small" type="button" style={BTN} onClick={() => baseline(false)}>{a.baseline ? t('Refiger le plan de référence') : t('Figer le plan de référence')}</button>
                    {a.baseline ? <button className="link" type="button" style={BTN} onClick={() => baseline(true)}>{t('Supprimer le plan de référence')}</button> : null}
                  </div>
                ) : null}
              </div>
              <p className="small muted">{(a.baseline ? t('Plan de référence du {d}.', { d: dateFr(a.baseline.takenAt.slice(0, 10)) }) + ' ' : '') + t('Du {a} au {b} · {n} tâche(s), {d} terminée(s), {o} en retard.', { a: dateFr(a.project.start), b: dateFr(a.project.end), n: a.counts.tasks, d: a.counts.done, o: a.counts.overdue })}</p>
              {a.alerts.map((x) => { const [h, s] = alertText(t, x, money); return <div key={x.code} className={'bp-alert' + (['budgetExhausted', 'eac'].includes(x.code) || (x.code === 'spi' && x.value < 0.8) || (x.code === 'cpi' && x.value < 0.8) ? ' bad' : x.code === 'noBaseline' ? ' info' : '')}><div><b>{h}</b><span>{s}</span></div></div>; })}
            </div>
            {!a.counts.tasks ? <Empty text={t('Ajoutez des tâches avec des dates et des estimations pour suivre le projet.')} /> : (
              <>
                <div className="bp-kpis">
                  <Kpi label={t('Avancement acquis')} value={num(m.percentComplete, 1) + ' %'} sub={t('prévu à date : {p} %', { p: num(m.percentPlanned, 1) })} tone={toneIdx(m.spi)} />
                  <Kpi label={t('SPI (délais)')} value={num(m.spi)} sub={f.earnedSchedule ? t('SPI(t) {v} · {es} j gagnés sur {at}', { v: num(f.earnedSchedule.spiT), es: num(f.earnedSchedule.es, 1), at: f.earnedSchedule.at }) : t('travail fait / travail prévu')} tone={toneIdx(m.spi)} />
                  {money_ ? <Kpi label={t('CPI (coûts)')} value={num(m.cpi)} sub={t('valeur produite / coût réel')} tone={toneIdx(m.cpi)} /> : null}
                  {money_ ? <Kpi label={t('Budget (BAC)')} value={money(m.bac)} sub={t('coût réel (AC) : {v} · {p} %', { v: money(m.ac), p: num(m.percentSpent, 1) })} /> : null}
                  {money_ ? <Kpi label={t('Coût final prévu (EAC)')} value={money(m.eac)} sub={t('reste à dépenser (ETC) : {v}', { v: money(m.etc) })} tone={m.eac > m.bac ? 'bad' : 'good'} /> : null}
                  {money_ ? <Kpi label={t('Écart final (VAC)')} value={money(m.vac)} sub={m.tcpi === null ? t('TCPI : budget déjà consommé') : t('TCPI (efficacité à tenir) : {v}', { v: num(m.tcpi) })} tone={m.vac < 0 ? 'bad' : 'good'} /> : null}
                  <Kpi label={t('Fin prévue')} value={f.finished ? dateFr(f.finishedAt) : f.endByEarnedSchedule ? dateFr(f.endByEarnedSchedule) : f.endByPlan ? dateFr(f.endByPlan) : '—'} sub={f.finished ? t('projet terminé') : f.dueDate ? t('échéance : {d}', { d: dateFr(f.dueDate) }) : t("pas d'échéance")} tone={Math.max(f.lateDaysPlan, f.lateDaysEarnedSchedule) > 0 ? 'bad' : 'good'} />
                </div>
                <div className="bp-grid2 bp-sec">
                  <div className="ws-card">
                    <h2>{t('Courbe en S (valeur acquise)')}</h2>
                    <LineChart
                      title={t('Valeur planifiée, valeur acquise et coût réel cumulés')} labels={labels} marker={ti >= 0 ? ti : null}
                      fmt={money_ ? money : eff ? unitFmt : (v) => num(v, 1) + ' %'}
                      series={money_
                        ? [{ key: 'pv', label: t('Planifié (PV)'), values: a.series.map((s) => s.pv), color: 'plan', dashed: true }, { key: 'ev', label: t('Acquis (EV)'), values: a.series.map((s) => s.ev), color: 's1' }, { key: 'ac', label: t('Coût réel (AC)'), values: a.series.map((s) => s.ac), color: 's2' }]
                        : eff ? [{ key: 'pv', label: t('Planifié'), values: a.series.map((s) => s.pv), color: 'plan', dashed: true }, { key: 'ev', label: t('Acquis'), values: a.series.map((s) => s.ev), color: 's1' }]
                          : [{ key: 'pv', label: t('Planifié (%)'), values: a.series.map((s) => s.pvPct), color: 'plan', dashed: true }, { key: 'ev', label: t('Acquis (%)'), values: a.series.map((s) => s.evPct), color: 's1' }]}
                    />
                  </div>
                  <div className="ws-card">
                    <h2>{t('Burn-down et burn-up')}</h2>
                    <LineChart
                      title={t('Reste à faire réel et idéal, travail terminé')} labels={labels} marker={ti >= 0 ? ti : null} fmt={(v) => num(v, 1) + (f.effortUnit === 'hours' ? ' h' : '')}
                      series={[{ key: 'ideal', label: t('Reste idéal'), values: a.series.map((s) => s.idealRemaining), color: 'plan', dashed: true }, { key: 'rem', label: t('Reste réel'), values: a.series.map((s) => s.remaining), color: 's1' }, { key: 'done', label: t('Terminé'), values: a.series.map((s) => s.completed), color: 's3' }]}
                    />
                    <p className="small muted">{f.effortUnit === 'hours' ? t('En heures estimées.') : t('En nombre de tâches (aucune estimation).')}</p>
                  </div>
                </div>
                <div className="ws-card">
                  <h2>{t('Planning (Gantt) et chemin critique')}</h2>
                  <Gantt title={t('Planning des tâches')} today={a.today} dateFr={dateFr}
                    rows={a.gantt.slice().sort((x, y) => (x.start || '9') < (y.start || '9') ? -1 : 1).map((g) => ({ ...g, sub: [g.assignee, g.float !== null && !g.critical && g.status !== 'done' ? t('marge {n} j', { n: g.float }) : null, g.critical ? t('critique') : null, g.progress + ' %'].filter(Boolean).join(' · '), done: g.status === 'done' }))}
                    milestones={a.milestones} />
                  <p className="small muted">{t('◆ et contour : tâches du chemin critique (aucune marge : un jour de retard décale la fin du projet). Remplissage : avancement. Trait gris : plan de référence.')}</p>
                </div>
                <div className="bp-grid2 bp-sec">
                  <div className="ws-card">
                    <h2>{t('Prévisions')}</h2>
                    <table className="bp-table"><thead><tr><th>{t('Méthode')}</th><th>{t('Fin prévue')}</th><th>{t('Retard')}</th></tr></thead>
                      <tbody>{ends.map(([l, d]) => <tr key={l}><td>{l}</td><td>{d ? dateFr(d) : '—'}</td><td className="bp-num">{d && f.dueDate && d > f.dueDate ? t('{n} j', { n: Math.round((Date.parse(d) - Date.parse(f.dueDate)) / 86400000) }) : '—'}</td></tr>)}</tbody></table>
                    {money_ ? (
                      <table className="bp-table" style={{ marginTop: 10 }}><thead><tr><th>{t('Coût final')}</th><th>{t('Montant')}</th></tr></thead>
                        <tbody>
                          {[[t('EAC = BAC / CPI'), f.eac], [t('EAC atypique = AC + (BAC - EV)'), f.eacAtypical], [t('EAC composite (CPI × SPI)'), f.eacComposite], [t('Par le bas : AC + heures restantes × coût horaire'), f.eacBottomUp]].map(([l, v]) => <tr key={l}><td>{l}</td><td className="bp-num" style={{ color: v > m.bac ? 'var(--pink)' : undefined }}>{v === null || v === undefined ? '—' : money(v)}</td></tr>)}
                        </tbody></table>
                    ) : null}
                    <p className="small muted">{t('Reste à faire : {r} · vitesse : {v} par jour.', { r: num(f.remainingEffort, 1) + (f.effortUnit === 'hours' ? ' h' : ''), v: num(f.velocityPerDay) })}</p>
                  </div>
                  <div className="ws-card" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
                    <h2>{t('Jauges')}</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      <Gauge value={m.percentComplete} label={t('Travail acquis')} sub={t('prévu : {p} %', { p: num(m.percentPlanned, 1) })} tone={toneIdx(m.spi) === 'good' ? '' : toneIdx(m.spi)} />
                      {money_ ? <Gauge value={m.percentSpent} label={t('Budget consommé')} sub={t('coût réel / budget')} tone={m.percentSpent > m.percentComplete + 10 ? 'bad' : m.percentSpent > m.percentComplete ? 'warn' : ''} /> : null}
                    </div>
                    {money_ && a.costs && Object.keys(a.costs.bySource).length ? (
                      <BarChart title={t('Coûts par origine')} height={170} fmt={money} labels={Object.keys(a.costs.bySource).map((k) => t({ manual: 'Saisies', purchase: 'Achats', stock: 'Stock', time: 'Temps' }[k] || k))} bars={[{ key: 'c', label: t('Coût'), values: Object.values(a.costs.bySource), color: 's2' }]} />
                    ) : null}
                  </div>
                </div>
                <details className="ws-card small"><summary>{t('Comment ces chiffres sont calculés')}</summary>{Object.values(a.method).map((x) => <p key={x} className="muted">{'• ' + tsrv(x)}</p>)}</details>
              </>
            )}
          </>
        );
      }}</Loaded>
    </div>
  );
}

/* ---------- Risques et problèmes ---------- */
export function RiskRegister({ id, members }) {
  const t = useT();
  const { oapi, modal, confirm, fail, can, info, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/projects/' + id + '/risks'), [id]);
  const pro = useLoad(() => oapi('GET', '/projects/' + id + '/pro'), [id, st.data]);
  const scale = (label) => [['1', '1 · ' + t(label === 'p' ? 'Rare' : 'Négligeable')], ['2', '2'], ['3', '3 · ' + t(label === 'p' ? 'Possible' : 'Notable')], ['4', '4'], ['5', '5 · ' + t(label === 'p' ? 'Presque sûr' : 'Très grave')]];
  const edit = (r0) => {
    const r = r0 || {};
    modal(r.id ? t('Modifier') : t('Signaler un risque ou un problème'), (close) => (
      <Form
        fields={[
          { k: 'kind', label: t('Type'), type: 'select', options: [['risk', t('Risque (peut arriver)')], ['issue', t('Problème (déjà là)')]], value: r.kind || 'risk' },
          { k: 'title', label: t('En quelques mots'), required: true, value: r.title },
          { k: 'probability', label: t('Probabilité'), type: 'select', options: scale('p'), value: String(r.probability || 3) },
          { k: 'impact', label: t('Impact'), type: 'select', options: scale('i'), value: String(r.impact || 3) },
          { k: 'mitigation', label: t('Parade ou action prévue'), type: 'textarea', rows: 2, value: r.mitigation },
          { k: 'ownerId', label: t('Responsable'), type: 'select', options: [['', t('Personne')]].concat(members.map((x) => [String(x.userId), x.name])), value: r.ownerId ? String(r.ownerId) : '' },
          { k: 'due', label: t('À traiter avant le'), type: 'date', value: r.due || '' },
          ...(r.id ? [{ k: 'status', label: t('Statut'), type: 'select', options: Object.entries(RSTATUS).map(([k, v]) => [k, t(v)]), value: r.status }] : []),
        ]}
        submitText={t('Enregistrer')}
        onSubmit={(v) => oapi(r.id ? 'PUT' : 'POST', r.id ? '/projects/risks/' + r.id : '/projects/' + id + '/risks', { kind: v.kind, title: v.title, probability: Number(v.probability), impact: Number(v.impact), mitigation: v.mitigation, ownerId: v.ownerId || null, due: v.due || null, ...(r.id ? { status: v.status } : {}) }).then(() => { close(); st.reload(); })}
      />
    ));
  };
  const mine = (r) => can('manager') || r.createdBy === info.me.userId;
  return (
    <div className="bp">
      <div className="bp-grid2 bp-sec">
        <div className="ws-card">
          <div className="bp-head"><h2>{t('Risques et problèmes')}</h2><button className="btn primary small" type="button" style={BTN} onClick={() => edit()}>{t('Signaler')}</button></div>
          <Loaded state={st}>{(d) => (!d.items.length ? <Empty text={t('Aucun risque noté. Pensez aux délais des fournisseurs, aux absences, à la météo, aux autorisations…')} /> : (
            <div className="bp-scroll">
              <table className="bp-table">
                <thead><tr><th>{t('Risque')}</th><th>{t('Note')}</th><th>{t('Statut')}</th><th>{''}</th></tr></thead>
                <tbody>{d.items.map((r) => (
                  <tr key={r.id} style={{ opacity: r.status === 'closed' ? 0.6 : 1 }}>
                    <td><b>{r.title}</b><br /><small className="muted">{[t(RKIND[r.kind]), r.owner, r.due ? dateFr(r.due) : null, r.mitigation].filter(Boolean).join(' · ')}</small></td>
                    <td><span className={'bp-st ' + (r.level === 'high' ? 'red' : r.level === 'medium' ? 'amber' : 'green')}>{r.score + ' · ' + t(LEVEL[r.level])}</span><br /><small className="muted">{t('P{p} × I{i}', { p: r.probability, i: r.impact })}</small></td>
                    <td>{t(RSTATUS[r.status])}</td>
                    <td>{mine(r) ? <><button className="link" type="button" onClick={() => edit(r)}>{t('Modifier')}</button>{' '}<button className="link" type="button" onClick={() => confirm(t('Supprimer ce risque ?'), () => oapi('DELETE', '/projects/risks/' + r.id).then(st.reload).catch(fail))}>{t('Supprimer')}</button></> : null}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}</Loaded>
        </div>
        <div className="ws-card">
          <h2>{t('Matrice des risques ouverts')}</h2>
          <Loaded state={pro}>{(a) => (
            <>
              <RiskMatrix matrix={a.riskSummary.matrix} />
              <p className="small">{t('{o} ouvert(s) : {h} élevé(s), {m} moyen(s), {l} faible(s) · {i} problème(s) · exposition {e}', { o: a.riskSummary.open, h: a.riskSummary.high, m: a.riskSummary.medium, l: a.riskSummary.low, i: a.riskSummary.issues, e: a.riskSummary.exposure })}</p>
            </>
          )}</Loaded>
        </div>
      </div>
    </div>
  );
}
