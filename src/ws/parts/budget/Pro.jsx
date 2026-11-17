import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { BarChart, Gauge, LineChart } from '../bp/Charts.jsx';
import { BTN, downloadCsv } from '../finance/util.jsx';

/* Budget · pilotage (administrateurs) : indicateurs, graphiques mensuels prévu / réalisé / engagé / prévision, atterrissage de fin
   d'année avec fourchette, écarts par catégorie et alertes, scénarios, prévision de trésorerie, détail jusqu'à la source, export CSV.
   Tous les chiffres sont calculés par le serveur (formules documentées dans bp-calc.js) : l'écran ne fait qu'afficher. */

export const monthShort = (i) => new Date(Date.UTC(2020, i, 1)).toLocaleDateString(getLocale(), { month: 'short', timeZone: 'UTC' });
const STATUS = { ok: 'Conforme', watch: 'À surveiller', risk: 'Risque de dépassement', over: 'Dépassé', unplanned: 'Non prévu' };
const STATUS_IN = { ok: 'Conforme', watch: 'En retard sur le prévu', risk: 'Risque de manque à gagner' };
const METHOD = { seasonal: "Saisonnalité de l'an passé", trend: 'Tendance linéaire', runRate: 'Rythme des 3 derniers mois', plan: 'Prévu (pas encore de mois clos)' };
const CONF = { high: 'Confiance élevée', medium: 'Confiance moyenne', low: 'Confiance faible' };
const pct = (v) => (v === null || v === undefined ? '—' : (v > 0 ? '+' : '') + Number(v).toLocaleString(getLocale(), { maximumFractionDigits: 1 }) + ' %');

function StatusChip({ line }) {
  const t = useT();
  const label = line.kind === 'income' ? (STATUS_IN[line.status] || STATUS[line.status]) : STATUS[line.status];
  return <span className={'bp-st ' + line.status}>{t(label)}</span>;
}

function Kpi({ label, value, sub, tone }) {
  return <div className={'bp-kpi' + (tone ? ' ' + tone : '')}><small>{label}</small><b className="bp-num">{value}</b>{sub ? <span>{sub}</span> : null}</div>;
}

/** Détail d'une catégorie (et d'un mois) : écritures comptables, saisies hors compta, engagements. */
function Drill({ year, line, month }) {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', `/budget/pro/drill?year=${year}&kind=${line.kind}&category=${encodeURIComponent(line.category)}${month ? '&month=' + month : ''}`), [year, line.category, month]);
  const labels = Array.from({ length: 12 }, (_, i) => monthShort(i));
  return (
    <div className="bp">
      <BarChart
        title={t('{cat} : prévu, réalisé et engagé par mois', { cat: line.category })}
        labels={labels} fmt={money}
        bars={[{ key: 'a', label: t('Réalisé'), values: line.actual, color: 's1', stack: 'r' }, ...(line.kind === 'expense' ? [{ key: 'c', label: t('Engagé'), values: line.committedByMonth, color: 's2', stack: 'r' }] : [])]}
        lines={[{ key: 'p', label: t('Prévu'), values: line.planned, color: 'plan', dashed: true }, ...(line.prevYear ? [{ key: 'n1', label: t('Année précédente'), values: line.prevYear, color: 's3' }] : [])]}
        height={220}
      />
      <p className="small muted">{t('Atterrissage : {v} ({m}, {c}) · fourchette {lo} – {hi}', { v: money(line.landing), m: t(METHOD[line.method]), c: t(CONF[line.confidence]).toLowerCase(), lo: money(line.low), hi: money(line.high) })}</p>
      <Loaded state={st}>{(d) => (
        <>
          <h3>{t('Écritures comptables')} <small className="muted">{money(d.totals.ledger)}</small></h3>
          {!d.ledger.length ? <Empty text={t('Aucune écriture.')} /> : (
            <div className="bp-scroll"><table className="bp-table"><thead><tr><th>{t('Écriture')}</th><th>{t('Date')}</th><th>{t('Compte')}</th><th>{t('Montant')}</th></tr></thead>
              <tbody>{d.ledger.slice(0, 200).map((x, i) => <tr key={x.entryId + '-' + i}><td>{x.number}<br /><small className="muted">{x.label}</small></td><td>{dateFr(x.date)}</td><td>{x.account}</td><td className="bp-num">{money(x.amount)}</td></tr>)}</tbody></table></div>
          )}
          <h3>{t('Saisies du budget hors compta')} <small className="muted">{money(d.totals.manual)}</small></h3>
          {!d.manual.length ? <Empty text={t('Aucune saisie hors compta.')} /> : d.manual.map((x) => <div className="line" key={x.id}><span>{x.label || line.category}<small>{' · ' + dateFr(x.date)}</small></span><b className="bp-num">{money(x.amount)}</b></div>)}
          {line.kind === 'expense' ? (
            <>
              <h3>{t('Engagements (commandes non facturées)')} <small className="muted">{money(d.totals.commitments)}</small></h3>
              {!d.commitments.length ? <Empty text={t('Aucun engagement.')} /> : d.commitments.map((x) => <div className="line" key={x.source + x.id}><span>{tsrv(x.label)}<small>{(x.party ? ' · ' + x.party : '') + (x.date ? ' · ' + dateFr(x.date) : '')}</small></span><b className="bp-num">{money(x.amount)}</b></div>)}
            </>
          ) : null}
        </>
      )}</Loaded>
    </div>
  );
}

/** Détail d'un mois : chaque catégorie, prévu / réalisé / engagé. */
function MonthBox({ d, i, open }) {
  const t = useT();
  const { money } = useWs();
  const rows = d.categories.filter((l) => l.planned[i] || l.actual[i] || l.committedByMonth[i]);
  if (!rows.length) return <Empty text={t('Rien ce mois-ci.')} />;
  return (
    <div className="bp-scroll"><table className="bp-table">
      <thead><tr><th>{t('Catégorie')}</th><th>{t('Prévu')}</th><th>{t('Réalisé')}</th><th>{t('Engagé')}</th><th>{t('Écart')}</th></tr></thead>
      <tbody>{rows.map((l) => <tr key={l.kind + l.category}><td><button className="link" type="button" onClick={() => open(l, i + 1)}>{(l.kind === 'income' ? '+ ' : '') + l.category}</button></td><td className="bp-num">{money(l.planned[i])}</td><td className="bp-num">{money(l.actual[i])}</td><td className="bp-num">{money(l.committedByMonth[i])}</td><td className="bp-num">{money(l.actual[i] - l.planned[i])}</td></tr>)}</tbody>
    </table></div>
  );
}

function Cashflow() {
  const t = useT();
  const { oapi, money } = useWs();
  const [months, setMonths] = useState(6);
  const st = useLoad(() => oapi('GET', '/budget/cashflow?months=' + months), [months]);
  return (
    <div className="ws-card">
      <div className="bp-head">
        <h2>{t('Prévision de trésorerie')}</h2>
        <label className="row-l"><span className="small muted">{t('Horizon')}</span>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label={t('Horizon')} style={{ fontSize: 16 }}>{[3, 6, 12].map((n) => <option key={n} value={n}>{t('{n} mois', { n })}</option>)}</select>
        </label>
      </div>
      <Loaded state={st}>{(c) => {
        const labels = c.months.map((m) => monthShort(Number(m.month.slice(5)) - 1) + ' ' + m.month.slice(2, 4));
        return (
          <>
            {c.alert ? <div className="bp-alert bad" role="alert"><div><b>{t('Trésorerie négative prévue en {m}', { m: c.alert.month })}</b><span>{t('Solde de fin de mois : {v}', { v: money(c.alert.closing) })}</span></div></div> : null}
            <div className="bp-grid2">
              <BarChart title={t('Encaissements et décaissements prévus')} labels={labels} fmt={money} bars={[{ key: 'in', label: t('Encaissements'), values: c.months.map((m) => m.inflows), color: 's3' }, { key: 'out', label: t('Décaissements'), values: c.months.map((m) => m.outflows), color: 's2' }]} height={220} />
              <LineChart title={t('Solde de trésorerie prévu en fin de mois')} labels={labels} fmt={money} series={[{ key: 'cl', label: t('Solde de fin de mois'), values: c.months.map((m) => m.closing), color: 's1', area: true }]} height={220} />
            </div>
            <p className="small muted">{t('Départ : {v}', { v: money(c.opening) }) + (c.openingKnown ? '' : ' · ' + t('aucune écriture de trésorerie : départ à zéro'))}</p>
            <details className="small muted"><summary>{t('Hypothèses')}</summary>{c.assumptions.map((a) => <p key={a}>{'• ' + tsrv(a)}</p>)}</details>
          </>
        );
      }}</Loaded>
    </div>
  );
}

export default function BudgetPro() {
  const t = useT();
  const { oapi, money, modal, toast } = useWs();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [opt, setOpt] = useState('10');
  const [pes, setPes] = useState('10');
  const [kindView, setKindView] = useState('expense');
  const [q, setQ] = useState({ o: '10', p: '10' });
  const st = useLoad(() => oapi('GET', `/budget/pro?year=${year}&optimistic=${encodeURIComponent(q.o)}&pessimistic=${encodeURIComponent(q.p)}`), [year, q.o, q.p]);
  const labels = Array.from({ length: 12 }, (_, i) => monthShort(i));
  const years = [0, -1, -2, 1].map((n) => String(new Date().getFullYear() + n));

  const openDrill = (d, line, month) => modal(month ? `${line.category} · ${labels[month - 1]} ${d.year}` : `${line.category} · ${d.year}`, () => <Drill year={d.year} line={line} month={month} />, { wide: true });
  const openMonth = (d, i) => modal(t('{m} {y} : détail par catégorie', { m: labels[i], y: d.year }), (close) => <MonthBox d={d} i={i} open={(l, m) => { close(); openDrill(d, l, m); }} />, { wide: true });

  const exportCsv = (d) => {
    const head = [t('Type'), t('Catégorie'), t('Prévu année'), t('Prévu à date'), t('Réalisé à date'), t('Écart à date'), t('Écart à date %'), t('Engagé'), t('Reste'), t('Atterrissage'), t('Fourchette basse'), t('Fourchette haute'), t("Écart prévu fin d'année"), t('Statut'), t('Méthode')].concat(labels.map((m) => t('Réalisé') + ' ' + m));
    downloadCsv(`budget-pilotage-${d.year}.csv`, [head].concat(d.categories.map((l) => [l.kind === 'expense' ? t('Dépense') : t('Recette'), l.category, l.plannedTotal, l.ytdPlanned, l.ytdActual, l.ytdVariance, l.ytdVariancePct ?? '', l.committed, l.remaining, l.landing, l.low, l.high, l.projectedVariance, t(l.kind === 'income' ? (STATUS_IN[l.status] || STATUS[l.status]) : STATUS[l.status]), t(METHOD[l.method])].concat(l.actual))));
    toast(t('Export prêt.'));
  };

  return (
    <div className="bp">
      <div className="ws-card">
        <div className="bp-head">
          <h2>{t('Pilotage du budget')}</h2>
          <div className="row-l">
            <label>{t('Année')}<select value={year} onChange={(e) => setYear(e.target.value)} aria-label={t('Année')}>{years.sort().map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
            <label title={t('Le reste à prévoir baisse de ce pourcentage (dépenses) ou monte (recettes).')}>{t('Optimiste −%')}<input inputMode="numeric" value={opt} onChange={(e) => setOpt(e.target.value)} aria-label={t('Scénario optimiste (%)')} style={{ width: 64 }} /></label>
            <label>{t('Pessimiste +%')}<input inputMode="numeric" value={pes} onChange={(e) => setPes(e.target.value)} aria-label={t('Scénario pessimiste (%)')} style={{ width: 64 }} /></label>
            <button className="btn small" type="button" style={BTN} onClick={() => setQ({ o: opt || '0', p: pes || '0' })}>{t('Recalculer')}</button>
            {st.data ? <button className="btn small" type="button" style={BTN} onClick={() => exportCsv(st.data)}>{t('Exporter (CSV)')}</button> : null}
          </div>
        </div>
        <p className="muted small">{t("Prévu, réalisé (lu dans la comptabilité et les saisies hors compta), engagé (commandes validées non facturées) et prévision de fin d'année.")}</p>
      </div>
      <Loaded state={st}>{(d) => {
        const k = d.kpis;
        const side = d.monthly[kindView];
        const fc = side.forecast;
        const over = k.expenseLandingVariance > 0;
        const lines = d.categories.filter((l) => l.kind === kindView);
        return (
          <>
            {!d.hasPlan ? <div className="bp-alert info"><div><b>{t("Aucun budget prévu pour {y}", { y: d.year })}</b><span>{t("Saisissez le budget annuel (onglet « Budget annuel ») pour comparer le prévu et le réalisé.")}</span></div></div> : null}
            <div className="bp-kpis">
              <Kpi label={t('Dépenses prévues (année)')} value={money(k.expensePlanned)} sub={t('à date : {v}', { v: money(k.expenseYtdPlanned) })} />
              <Kpi label={t('Réalisé à date')} value={money(k.expenseYtdActual)} sub={t('écart {v} ({p})', { v: money(k.expenseYtdVariance), p: pct(k.expenseYtdVariancePct) })} tone={k.expenseYtdVariance > 0 ? 'warn' : 'good'} />
              <Kpi label={t('Engagé')} value={money(k.committed)} sub={t('commandes validées non facturées')} />
              <Kpi label={t('Reste disponible')} value={money(k.expenseRemaining)} sub={t('prévu - réalisé - engagé')} tone={k.expenseRemaining < 0 ? 'bad' : ''} />
              <Kpi label={t('Rythme mensuel')} value={k.burnRate === null ? '—' : money(k.burnRate)} sub={k.burnRate3 === null ? t('aucun mois clos') : t('3 derniers mois : {v}', { v: money(k.burnRate3) })} />
              <Kpi label={t("Atterrissage fin d'année")} value={money(k.expenseLanding)} sub={t('fourchette {lo} – {hi}', { lo: money(k.expenseLow), hi: money(k.expenseHigh) })} tone={over ? 'bad' : 'good'} />
              <Kpi label={t('Écart prévu en fin d\'année')} value={money(k.expenseLandingVariance)} sub={pct(k.expenseLandingVariancePct)} tone={over ? 'bad' : 'good'} />
              <Kpi label={t('Résultat attendu')} value={money(k.resultLanding)} sub={t('prévu : {v}', { v: money(k.resultPlanned) })} tone={k.resultLanding < 0 ? 'bad' : ''} />
            </div>

            <div className="bp-grid2 bp-sec">
              <div className="ws-card" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <h2>{t('Consommation du budget')}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <Gauge value={k.expenseConsumedPct} label={t('Dépenses : réalisé + engagé')} sub={t('sur le prévu de l\'année')} tone={k.expenseConsumedPct > 100 ? 'bad' : k.expenseConsumedPct > (d.currentMonth / 12) * 100 + 10 ? 'warn' : ''} />
                  <Gauge value={k.incomePlanned ? Math.round(k.incomeActual * 100 / k.incomePlanned) : null} label={t('Recettes encaissées')} sub={t('sur le prévu de l\'année')} />
                </div>
                <p className="small muted">{t("Temps écoulé : {p} % de l'année ({n} mois clos).", { p: Math.round(d.closedMonths * 100 / 12), n: d.closedMonths })}</p>
              </div>
              <div className="ws-card">
                <h2>{t('Alertes')}</h2>
                {!d.alerts.length ? <Empty text={t('Aucun écart à signaler.')} /> : d.alerts.slice(0, 6).map((a) => (
                  <div key={a.kind + a.category} className={'bp-alert' + (a.code === 'over' || a.code === 'unplanned' ? ' bad' : '')}>
                    <div>
                      <b>{a.category + ' · ' + t(a.kind === 'income' ? (STATUS_IN[a.code] || STATUS[a.code]) : STATUS[a.code])}</b>
                      <span>{a.code === 'over' ? t('Réalisé + engagé dépasse le prévu de {v}.', { v: money(a.variance) })
                        : a.code === 'unplanned' ? t('{v} dépensés sans budget prévu.', { v: money(a.actual + a.committed) })
                          : a.code === 'risk' ? (a.kind === 'income' ? t('Atterrissage {l} : {v} sous le prévu.', { l: money(a.landing), v: money(-a.variance) }) : t('Atterrissage {l} : {v} au-dessus du prévu.', { l: money(a.landing), v: money(a.variance) }))
                            : t('Écart à date : {p}.', { p: pct(a.ytdVariancePct) })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ws-card">
              <div className="bp-head">
                <h2>{t('Mois par mois')}</h2>
                <div className="bp-seg" role="tablist">{[['expense', 'Dépenses'], ['income', 'Recettes']].map((x) => <button key={x[0]} type="button" role="tab" aria-selected={kindView === x[0]} className={'tab' + (kindView === x[0] ? ' on' : '')} onClick={() => setKindView(x[0])}>{t(x[1])}</button>)}</div>
              </div>
              <BarChart
                title={kindView === 'expense' ? t('Dépenses par mois : réalisé et engagé face au prévu et à la prévision') : t('Recettes par mois : réalisé face au prévu et à la prévision')}
                labels={labels} fmt={money} onPick={(i) => openMonth(d, i)}
                bars={[{ key: 'a', label: t('Réalisé'), values: side.actual, color: 's1', stack: 'r' }, ...(kindView === 'expense' ? [{ key: 'c', label: t('Engagé'), values: side.committed, color: 's2', stack: 'r' }] : [])]}
                lines={[{ key: 'p', label: t('Prévu'), values: side.planned, color: 'plan', dashed: true }, { key: 'f', label: t('Prévision'), values: fc, color: 's3', dashed: true }]}
              />
              <p className="small muted">{t('Touchez un mois pour voir le détail par catégorie.')}</p>
              <h3>{t('Cumul sur l\'année')}</h3>
              <LineChart
                title={t('Cumul prévu, réalisé et prévision jusqu\'à la fin de l\'année')}
                labels={labels} fmt={money} marker={d.currentMonth ? d.currentMonth - 1 : null}
                series={[{ key: 'cp', label: t('Prévu cumulé'), values: side.cumPlanned, color: 'plan', dashed: true }, { key: 'ca', label: t('Réalisé cumulé'), values: side.cumActual, color: 's1', area: true }, { key: 'cf', label: t('Prévision cumulée'), values: side.cumForecast.map((v, i) => (i >= Math.max(d.closedMonths - 1, 0) ? v : null)), color: 's3', dashed: true }]}
                band={(() => {
                  // Fourchette dessinée : elle s'ouvre du dernier mois clos jusqu'à la fourchette de fin d'année calculée par le serveur (∝ √mois).
                  const c = d.closedMonths; const h = 12 - c;
                  if (!h || side.high === side.low) return undefined;
                  const share = (i) => (i < c - 1 || (c === 0 && i < 0) ? null : Math.sqrt(Math.max(i + 1 - c, 0) / h));
                  return { label: t('Fourchette à 80 %'), low: side.cumForecast.map((v, i) => (share(i) === null ? null : Math.round(v - (side.landing - side.low) * share(i)))), high: side.cumForecast.map((v, i) => (share(i) === null ? null : Math.round(v + (side.high - side.landing) * share(i)))) };
                })()}
              />
            </div>

            <div className="ws-card">
              <h2>{kindView === 'expense' ? t('Écarts par catégorie de dépense') : t('Écarts par catégorie de recette')}</h2>
              {!lines.length ? <Empty text={t('Aucune catégorie.')} /> : (
                <div className="bp-scroll">
                  <table className="bp-table">
                    <thead><tr><th>{t('Catégorie')}</th><th>{t('Prévu')}</th><th>{t('Réalisé à date')}</th><th>{t('Écart à date')}</th>{kindView === 'expense' ? <th>{t('Engagé')}</th> : null}<th>{t('Reste')}</th><th>{t('Atterrissage')}</th><th>{t('Écart fin d\'année')}</th><th>{t('Statut')}</th></tr></thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.category}>
                          <td><button className="link" type="button" onClick={() => openDrill(d, l)} title={t('Voir le détail')}>{l.category}</button><br /><small className="muted">{t(METHOD[l.method]) + ' · ' + t(CONF[l.confidence]).toLowerCase()}</small></td>
                          <td className="bp-num">{money(l.plannedTotal)}</td>
                          <td className="bp-num">{money(l.ytdActual)}</td>
                          <td className="bp-num">{money(l.ytdVariance)}<br /><small className="muted">{pct(l.ytdVariancePct)}</small></td>
                          {kindView === 'expense' ? <td className="bp-num">{money(l.committed)}</td> : null}
                          <td className="bp-num">{money(l.remaining)}</td>
                          <td className="bp-num">{money(l.landing)}<br /><small className="muted">{money(l.low) + ' – ' + money(l.high)}</small></td>
                          <td className="bp-num">{money(l.projectedVariance)}<br /><small className="muted">{pct(l.projectedVariancePct)}</small></td>
                          <td><StatusChip line={l} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bp-grid2 bp-sec">
              <div className="ws-card">
                <h2>{t('Plus gros dépassements')}</h2>
                {!d.topOverruns.length ? <Empty text={t('Aucun dépassement prévu.')} /> : (
                  <BarChart title={t('Dépassement prévu par catégorie')} labels={d.topOverruns.map((x) => x.category)} fmt={money} height={200}
                    bars={[{ key: 'o', label: t('Dépassement prévu'), values: d.topOverruns.map((x) => x.overrun), color: 's2' }]}
                    onPick={(i) => { const l = d.categories.find((c) => c.kind === 'expense' && c.category === d.topOverruns[i].category); if (l) openDrill(d, l); }} />
                )}
              </div>
              <div className="ws-card">
                <h2>{t('Scénarios de fin d\'année')}</h2>
                <div className="bp-scroll">
                  <table className="bp-table">
                    <thead><tr><th>{t('Scénario')}</th><th>{t('Recettes')}</th><th>{t('Dépenses')}</th><th>{t('Résultat')}</th></tr></thead>
                    <tbody>
                      {[['plan', t('Prévu')], ['optimistic', t('Optimiste ({p} %)', { p: d.scenarios.optimisticPct })], ['central', t('Central')], ['pessimistic', t('Pessimiste ({p} %)', { p: d.scenarios.pessimisticPct })]].map(([key, label]) => (
                        <tr key={key}><td>{label}</td><td className="bp-num">{money(d.scenarios[key].income)}</td><td className="bp-num">{money(d.scenarios[key].expense)}</td><td className="bp-num" style={{ color: d.scenarios[key].result < 0 ? 'var(--pink)' : undefined, fontWeight: 700 }}>{money(d.scenarios[key].result)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small muted">{t('Seule la part encore à prévoir est ajustée : le réalisé et l\'engagé ne changent pas.')}</p>
              </div>
            </div>

            <Cashflow />

            <details className="ws-card small">
              <summary>{t('Comment ces chiffres sont calculés')}</summary>
              {Object.values(d.method).map((m) => <p key={m} className="muted">{'• ' + tsrv(m)}</p>)}
              <p className="muted">{tsrv(d.notice)}</p>
            </details>
          </>
        );
      }}</Loaded>
    </div>
  );
}
