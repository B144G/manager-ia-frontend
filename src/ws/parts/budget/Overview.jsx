import { useMemo, useState } from 'react';
import { useLang, useT } from '../../../lib/i18n.jsx';
import { monthShort } from '../../../lib/format.js';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Button, Card, ChartFrame, EmptyState, Icon, Loaded, Segmented, Stat, useLoad } from '../../ui.jsx';
import { Bars, Combo, Donut, HBars, SERIES, compact } from '../../charts/lazy.jsx';

/* Budget · vue d'ensemble (administrateurs) : prévu / réalisé (courbes cumulées), écarts par catégorie, répartition des dépenses,
   trésorerie prévisionnelle, comparaison mensuelle recettes / dépenses, alertes visuelles. Données : /budget/annual, /budget/cashflow, /budget/requests. */

const cum = (a) => { let s = 0; return a.map((v) => (s += v)); };
const sum = (a) => a.reduce((x, y) => x + y, 0);

export function CashChart({ months, money, t }) {
  const M = useMonths();
  const data = months.map((m) => ({ x: M[Number(m.month.slice(5, 7)) - 1], inflows: m.inflows, outflows: -m.outflows, closing: m.closing }));
  return (
    <ChartFrame title={t('Trésorerie prévisionnelle')} subtitle={t('Encaissements, décaissements et solde en fin de mois')} height={280}
      summary={months.map((m) => m.month + ' ' + money(m.closing)).join(', ')}
      legend={[{ label: t('Encaissements'), color: 'var(--ok)' }, { label: t('Décaissements'), color: 'var(--danger)' }, { label: t('Solde fin de mois'), color: 'var(--c1)' }]}>
      <Combo data={data} fmt={money} zeroLine height={280} series={[{ key: 'inflows', label: t('Encaissements'), type: 'bar', color: 'var(--ok)' }, { key: 'outflows', label: t('Décaissements'), type: 'bar', color: 'var(--danger)' }, { key: 'closing', label: t('Solde fin de mois'), type: 'line', color: 'var(--c1)', dots: true }]} />
    </ChartFrame>
  );
}

export default function Overview({ goTab }) {
  const t = useT();
  const { oapi, money } = useWs();
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [kind, setKind] = useState('expense');
  const an = useLoad(() => oapi('GET', '/budget/annual?year=' + year), [year]);
  const cash = useLoad(() => oapi('GET', '/budget/cashflow?months=6'), []);
  const req = useLoad(() => oapi('GET', '/budget/requests?status=pending'), []);
  return (
    <>
      <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <div className="row"><Button iconOnly icon="left" label={t('Année précédente')} onClick={() => setYear(String(Number(year) - 1))} /><b className="num" style={{ minWidth: 48, textAlign: 'center' }}>{year}</b><Button iconOnly icon="right" label={t('Année suivante')} onClick={() => setYear(String(Number(year) + 1))} /></div>
        <Segmented label={t('Afficher')} value={kind} onChange={setKind} items={[{ id: 'expense', label: t('Dépenses'), icon: 'trend-down' }, { id: 'income', label: t('Recettes'), icon: 'trend-up' }]} />
      </div>
      <Loaded state={an}>{(a) => <Annual a={a} kind={kind} cash={cash} pending={req.data ? req.data.requests.length : 0} goTab={goTab} money={money} t={t} />}</Loaded>
    </>
  );
}

function useMonths() { const lang = useLang(); return useMemo(() => Array.from({ length: 12 }, (_, i) => monthShort(lang, i)), [lang]); }

function Annual({ a, kind, cash, pending, goTab, money, t }) {
  const M = useMonths();
  const lines = a.lines;
  const T = a.totals;
  const cm = a.currentMonth || 12;
  const sel = lines.filter((l) => l.kind === kind);
  const planM = Array.from({ length: 12 }, (_, i) => sum(sel.map((l) => l.planned[i])));
  const realM = Array.from({ length: 12 }, (_, i) => sum(sel.map((l) => l.realized[i])));
  const pc = cum(planM), rc = cum(realM);
  const curve = M.map((x, i) => ({ x, plan: a.hasPlan ? pc[i] : null, real: i < cm ? rc[i] : null }));
  const result = T.incomeRealized - T.expenseRealized;
  const over = lines.filter((l) => l.overBudget);
  // écarts : dépenses (réalisé − prévu), > 0 = dépassement
  const gaps = lines.filter((l) => l.kind === kind && l.plannedTotal > 0).map((l) => ({ name: l.category, value: l.ytdRealized - l.ytdPlanned, color: (kind === 'expense' ? l.ytdRealized - l.ytdPlanned > 0 : l.ytdRealized - l.ytdPlanned < 0) ? 'var(--danger)' : 'var(--ok)' }))
    .sort((x, y) => Math.abs(y.value) - Math.abs(x.value)).slice(0, 8);
  const split = useMemo(() => {
    const e = lines.filter((l) => l.kind === 'expense' && l.realizedTotal > 0).sort((x, y) => y.realizedTotal - x.realizedTotal);
    const top = e.slice(0, 6).map((l) => ({ name: l.category, value: l.realizedTotal }));
    const rest = sum(e.slice(6).map((l) => l.realizedTotal));
    return rest ? top.concat([{ name: t('Autres'), value: rest }]) : top;
  }, [lines, t]);
  const monthly = M.map((x, i) => ({ x, inc: sum(lines.filter((l) => l.kind === 'income').map((l) => l.realized[i])), exp: sum(lines.filter((l) => l.kind === 'expense').map((l) => l.realized[i])) })).slice(0, Math.max(cm, 1));
  const pct = (r, p) => (p ? Math.round(100 * r / p) : null);
  const expPct = pct(T.expenseRealized, T.expensePlanned), incPct = pct(T.incomeRealized, T.incomePlanned);
  const cs = cash.data;
  return (
    <>
      <div className="bd-flags" aria-live="polite">
        {!a.hasPlan ? <Alert tone="info" title={t("Pas encore de budget annuel pour {y}", { y: a.year })}><Button size="sm" variant="soft" onClick={() => goTab('annual')}>{t('Saisir le budget annuel')}</Button></Alert> : null}
        {over.length ? <Alert tone="danger" title={t('{n} ligne(s) dépassent leur budget', { n: over.length })}>{over.slice(0, 4).map((l) => l.category).join(', ')}{over.length > 4 ? '…' : ''}</Alert> : null}
        {cs && cs.alert ? <Alert tone="danger" title={t('Trésorerie négative prévue')}>{t('Solde estimé à {amount} fin {month}.', { amount: money(cs.alert.closing), month: M[Number(cs.alert.month.slice(5, 7)) - 1] })} <Button size="sm" variant="ghost" onClick={() => goTab('cash')}>{t('Voir le détail')}</Button></Alert> : null}
        {pending ? <Alert tone="warn" title={t('{n} dépense(s) attendent votre validation', { n: pending })}><Button size="sm" variant="ghost" onClick={() => goTab('approvals')}>{t('Valider')}</Button></Alert> : null}
        {a.commitments && a.commitments.total > 0 ? <Alert tone="info" title={t('Engagements en cours : {amount}', { amount: money(a.commitments.total) })}>{t('Commandes et dettes fournisseurs pas encore payées.')}</Alert> : null}
      </div>
      <div className="ui-stats">
        <Stat icon="trend-up" label={t('Recettes réalisées')} value={money(T.incomeRealized)} sub={incPct === null ? t('pas de prévision') : t('{n} % du prévu ({amount})', { n: incPct, amount: money(T.incomePlanned) })} subTone={incPct !== null && incPct >= 100 ? 'up' : undefined} tone="ok" />
        <Stat icon="trend-down" label={t('Dépenses réalisées')} value={money(T.expenseRealized)} sub={expPct === null ? t('pas de prévision') : t('{n} % du prévu ({amount})', { n: expPct, amount: money(T.expensePlanned) })} subTone={expPct !== null && expPct > 100 ? 'down' : undefined} tone={expPct > 100 ? 'danger' : 'warn'} />
        <Stat icon="scale-balanced" label={t('Résultat')} value={money(result)} sub={result >= 0 ? t('excédent') : t('déficit')} subTone={result >= 0 ? 'up' : 'down'} tone={result >= 0 ? 'ok' : 'danger'} />
        {cs ? <Stat icon="bank" label={t("Trésorerie aujourd'hui")} value={money(cs.opening)} sub={cs.alert ? t('négative en {m}', { m: M[Number(cs.alert.month.slice(5, 7)) - 1] }) : t('stable sur 6 mois')} subTone={cs.alert ? 'down' : 'up'} tone={cs.alert ? 'danger' : 'ok'} /> : null}
      </div>
      <div className="pd-grid two">
        <ChartFrame title={kind === 'expense' ? t('Dépenses cumulées : prévu et réalisé') : t('Recettes cumulées : prévu et réalisé')} subtitle={t('Le réalisé vient de la comptabilité')} height={280}
          summary={t('Prévu {a}, réalisé {b}', { a: money(sum(planM)), b: money(sum(realM)) })}
          legend={[{ label: t('Prévu'), color: 'var(--chart-plan)' }, { label: t('Réalisé'), color: 'var(--c1)' }]}>
          <Combo data={curve} fmt={money} height={280} series={[{ key: 'plan', label: t('Prévu'), type: 'line', color: 'var(--chart-plan)', dashed: true }, { key: 'real', label: t('Réalisé'), type: 'area', color: 'var(--c1)' }]} />
        </ChartFrame>
        <ChartFrame title={t('Écarts par catégorie')} subtitle={kind === 'expense' ? t("Réalisé − prévu depuis janvier ; rouge = dépassement") : t('Réalisé − prévu depuis janvier ; rouge = en retard sur le prévu')} height={280}
          summary={gaps.map((g) => g.name + ' ' + money(g.value)).join(', ')}>
          {gaps.length ? <HBars data={gaps} fmt={money} valueLabel={t('Écart')} height={280} /> : <EmptyState icon="scale-balanced" title={t('Aucun budget par catégorie')}>{t("Saisissez le budget annuel pour mesurer les écarts.")}</EmptyState>}
        </ChartFrame>
      </div>
      <div className="pd-grid two">
        <ChartFrame title={t('Répartition des dépenses')} subtitle={t('Réalisé depuis janvier')} height={280} summary={split.map((s) => s.name + ' ' + money(s.value)).join(', ')} legend={split.map((s, i) => ({ label: s.name, color: SERIES[i % SERIES.length] }))}>
          {split.length ? <Donut data={split} fmt={money} center={compact(T.expenseRealized)} sub={t('dépensés')} /> : <EmptyState icon="pie" title={t('Aucune dépense')} />}
        </ChartFrame>
        <ChartFrame title={t('Recettes et dépenses par mois')} subtitle={t('Comparatif mensuel réalisé')} height={280} legend={[{ label: t('Recettes'), color: 'var(--ok)' }, { label: t('Dépenses'), color: 'var(--c4)' }]} summary={monthly.map((m) => m.x + ' ' + money(m.inc) + ' / ' + money(m.exp)).join(', ')}>
          <Bars data={monthly} fmt={money} height={280} series={[{ key: 'inc', label: t('Recettes'), color: 'var(--ok)' }, { key: 'exp', label: t('Dépenses'), color: 'var(--c4)' }]} />
        </ChartFrame>
      </div>
      {cs ? <CashChart months={cs.months} money={money} t={t} /> : null}
      <Card title={t('Lignes du budget')} subtitle={t('Prévu, réalisé et écart par catégorie, depuis janvier')} className="pl-mine">
        <div className="ui-table-wrap"><table className="ui-table">
          <thead><tr><th scope="col">{t('Catégorie')}</th><th scope="col" className="r">{t('Prévu (année)')}</th><th scope="col" className="r">{t('Réalisé')}</th><th scope="col" className="r">{t('Écart')}</th><th scope="col">{t('Consommation')}</th></tr></thead>
          <tbody>{lines.filter((l) => l.kind === kind).map((l) => {
            const p = l.plannedTotal ? Math.round(100 * l.realizedTotal / l.plannedTotal) : null;
            const bad = l.overBudget || (kind === 'expense' ? l.gap > 0 && l.plannedTotal > 0 : false);
            return (
              <tr key={l.category}><td><b>{l.category}</b>{l.committed ? <><br /><small className="muted">{t('dont engagé : {a}', { a: money(l.committed) })}</small></> : null}</td>
                <td className="r num">{money(l.plannedTotal)}</td><td className="r num">{money(l.realizedTotal)}</td>
                <td className={'r num ' + (bad ? 'late' : l.favorable ? 'ok' : '')}>{(l.gap > 0 ? '+' : '') + money(l.gap)}{l.gapPct !== null ? <small> ({l.gapPct > 0 ? '+' : ''}{l.gapPct} %)</small> : null}</td>
                <td style={{ minWidth: 140 }}>{p === null ? <Badge>{t('pas de prévision')}</Badge> : <div className={'meter' + (p > 100 ? ' over' : p > 85 ? ' amber' : '')} role="img" aria-label={p + ' %'}><i style={{ width: Math.min(p, 100) + '%' }} /></div>}</td></tr>
            );
          })}</tbody>
        </table></div>
        {!lines.some((l) => l.kind === kind) ? <EmptyState icon="table" title={t('Aucune ligne')} /> : null}
      </Card>
      <p className="muted small" style={{ marginTop: 12 }}><Icon name="info" /> {t(a.source.note)}</p>
    </>
  );
}
