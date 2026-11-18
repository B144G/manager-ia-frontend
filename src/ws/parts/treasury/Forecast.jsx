import { useMemo, useState } from 'react';
import { useLang, useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Button, Card, ChartFrame, EmptyState, Form, Loaded, Segmented, Stat, Table, useLoad } from '../../ui.jsx';
import { Combo } from '../../charts/lazy.jsx';
import { Lines } from './charts.jsx';
import { useGroups, useSources } from './common.jsx';

/* Trésorerie · prévision glissante (13 semaines / 12 mois), calendrier jour par jour, éléments prévus, scénarios « et si ». */

export function ForecastScreen() {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const groups = useGroups(); const sources = useSources();
  const [view, setView] = useState('weeks');
  const st = useLoad(() => oapi('GET', '/treasury/forecast'), []);
  return (
    <Loaded state={st}>{(f) => {
      const rows = view === 'weeks' ? f.weeks : f.months;
      const data = rows.map((r) => ({ x: r.label, inflows: r.in, outflows: -r.out, closing: r.closing }));
      const groupKeys = Object.keys(groups).filter((g) => rows.some((r) => r.byGroup[g]));
      return (
        <>
          {f.overdraft ? <Alert tone="danger">{t('Découvert prévu le {date} ({amount}), dans {days} jours.', { date: dateFr(f.overdraft.date), amount: money(f.overdraft.balance), days: f.overdraft.daysAway })}</Alert> : f.belowMin ? <Alert tone="warn">{t('Le solde passera sous votre minimum le {date} ({amount}).', { date: dateFr(f.belowMin.date), amount: money(f.belowMin.balance) })}</Alert> : <Alert tone="ok">{t('Aucun découvert prévu sur les 12 prochains mois.')}</Alert>}
          <div className="kpis4" style={{ marginTop: 12 }}>
            <Stat icon="coins" label={t('Trésorerie de départ')} value={money(f.opening)} sub={dateFr(f.from)} />
            <Stat icon="arrow-trend-down" tone={f.low13.balance < 0 ? 'danger' : 'brand'} label={t('Point bas à 13 semaines')} value={money(f.low13.balance)} sub={dateFr(f.low13.date)} />
            <Stat icon="chart-line" label={t('Solde dans 13 semaines')} value={money(f.closing13)} sub={t('Entrées {a} · sorties {b}', { a: money(f.totals13.in), b: money(f.totals13.out) })} />
            <Stat icon="calendar" label={t('Solde dans 12 mois')} value={money(f.closing12m)} />
          </div>
          <div className="row" style={{ margin: '4px 0 12px' }}>
            <Segmented label={t('Horizon')} value={view} onChange={setView} items={[{ id: 'weeks', label: t('13 semaines') }, { id: 'months', label: t('12 mois') }]} />
          </div>
          <Card>
            <ChartFrame title={view === 'weeks' ? t('Prévision à 13 semaines glissantes') : t('Prévision à 12 mois glissants')} subtitle={t('Mise à jour automatique à partir des factures, commandes, paie, emprunts et impôts')} height={300}
              summary={rows.map((r) => r.label + ' ' + money(r.closing)).join(', ')}
              legend={[{ label: t('Encaissements'), color: 'var(--ok)' }, { label: t('Décaissements'), color: 'var(--danger)' }, { label: t('Solde de fin de période'), color: 'var(--c1)' }]}>
              <Combo data={data} fmt={money} zeroLine height={300} series={[{ key: 'inflows', label: t('Encaissements'), type: 'bar', color: 'var(--ok)' }, { key: 'outflows', label: t('Décaissements'), type: 'bar', color: 'var(--danger)' }, { key: 'closing', label: t('Solde de fin de période'), type: 'line', color: 'var(--c1)' }]}
                refs={f.minBalance ? [{ y: f.minBalance, label: t('Solde minimal'), tone: 'danger' }] : []} />
            </ChartFrame>
          </Card>
          <Card title={t('Tableau de la prévision')} subtitle={t('Par nature de flux (positif = encaissement, négatif = décaissement)')} flush>
            <Table caption={t('Prévision')} columns={[
              { key: 'label', label: view === 'weeks' ? t('Semaine') : t('Mois'), render: (r) => (view === 'weeks' ? `${r.label} · ${dateFr(r.from)}` : r.label) },
              { key: 'opening', label: t('Solde début'), align: 'r', render: (r) => money(r.opening) },
              ...groupKeys.map((g) => ({ key: g, label: groups[g], align: 'r', render: (r) => (r.byGroup[g] ? money(r.byGroup[g]) : '—') })),
              { key: 'net', label: t('Variation'), align: 'r', render: (r) => <b style={{ color: r.net < 0 ? 'var(--danger)' : 'var(--ok)' }}>{money(r.net)}</b> },
              { key: 'closing', label: t('Solde fin'), align: 'r', render: (r) => <b style={{ color: r.closing < 0 ? 'var(--danger)' : undefined }}>{money(r.closing)}</b> },
            ]} rows={rows.map((r) => ({ ...r, id: r.label }))} />
          </Card>
          <Card title={t('Sources prises en compte')} subtitle={t('Chaque ligne vient d\'un document réel de votre entreprise ou d\'un élément prévu que vous avez saisi.')}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{Object.entries(f.sources).filter(([k, v]) => typeof v === 'number').map(([k, v]) => <Badge key={k} tone="outline">{(sources[k] || k) + ' : ' + v}</Badge>)}</div>
            <p className="small muted" style={{ marginTop: 8 }}>{t('Prochains flux détaillés ci-dessous (90 jours).')}</p>
            <Table caption={t('Flux détaillés')} columns={[{ key: 'date', label: t('Date'), render: (r) => dateFr(r.date) }, { key: 'label', label: t('Libellé') }, { key: 'group', label: t('Nature'), render: (r) => groups[r.group] || r.group }, { key: 'src', label: t('Source'), render: (r) => sources[r.source] || r.source }, { key: 'amount', label: t('Montant'), align: 'r', render: (r) => <span style={{ color: r.amount < 0 ? 'var(--danger)' : 'var(--ok)' }}>{money(r.amount)}</span> }]} rows={f.flowsList.slice(0, 60).map((r, i) => ({ ...r, id: i }))} empty={t('Aucun flux prévu.')} />
          </Card>
        </>
      );
    }}</Loaded>
  );
}

export function CalendarScreen() {
  const t = useT(); const lang = useLang();
  const { oapi, money, dateFr } = useWs();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [sel, setSel] = useState(null);
  const st = useLoad(() => oapi('GET', '/treasury/calendar?month=' + month), [month]);
  const shift = (n) => { const [y, m] = month.split('-').map(Number); setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)); setSel(null); };
  const title = useMemo(() => new Intl.DateTimeFormat(lang || 'fr', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T00:00:00Z')), [month, lang]);
  const dow = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang || 'fr', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 5, 1 + i)))), [lang]);
  return (
    <>
      <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <div className="row"><Button iconOnly icon="left" label={t('Mois précédent')} onClick={() => shift(-1)} /><b style={{ minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>{title}</b><Button iconOnly icon="right" label={t('Mois suivant')} onClick={() => shift(1)} /></div>
      </div>
      <Loaded state={st}>{(c) => {
        const first = new Date(month + '-01T00:00:00Z').getUTCDay(); const pad = (first + 6) % 7;
        const byDate = Object.fromEntries(c.days.map((d) => [d.date, d]));
        const cells = Array.from({ length: pad }, () => null).concat(c.days.map((d) => d.date));
        const detail = sel && byDate[sel];
        const curve = c.days.map((d) => ({ x: d.date.slice(8), balance: d.balance, inflows: d.in, outflows: -d.out }));
        if (!c.days.length) return <EmptyState title={t('Pas de prévision pour ce mois.')}>{c.note === 'past' ? t('La prévision commence aujourd\'hui : consultez les écarts pour les mois passés.') : t('La prévision couvre les 12 prochains mois.')}</EmptyState>;
        return (
          <>
            <Card title={t('Calendrier des encaissements et décaissements')} subtitle={t('Chaque jour : flux prévus et solde en fin de journée. Cliquez sur un jour pour le détail.')}>
              <div role="grid" aria-label={title} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                {dow.map((d) => <div key={d} className="muted small" style={{ textAlign: 'center', textTransform: 'capitalize' }}>{d}</div>)}
                {cells.map((date, i) => {
                  if (!date) return <div key={'p' + i} />;
                  const d = byDate[date];
                  return (
                    <button key={date} type="button" onClick={() => setSel(date)} aria-pressed={sel === date} style={{ textAlign: 'left', padding: 6, minHeight: 74, borderRadius: 8, border: '1px solid ' + (sel === date ? 'var(--accent)' : d.balance < 0 ? 'var(--danger)' : 'var(--border)'), background: d.balance < 0 ? 'color-mix(in srgb, var(--danger) 8%, var(--surface))' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', display: 'grid', alignContent: 'space-between', font: 'inherit' }}>
                      <span className="small" style={{ fontWeight: 600 }}>{Number(date.slice(8))}</span>
                      <span style={{ fontSize: 11, lineHeight: 1.25 }}>
                        {d.in ? <span style={{ color: 'var(--ok)', display: 'block' }}>+{Math.round(d.in / 1000)} k</span> : null}
                        {d.out ? <span style={{ color: 'var(--danger)', display: 'block' }}>−{Math.round(d.out / 1000)} k</span> : null}
                        <span className="muted" style={{ display: 'block' }}>{Math.round(d.balance / 1000)} k</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
            {detail ? <Card title={dateFr(detail.date)} subtitle={t('Solde en fin de journée : {amount}', { amount: money(detail.balance) })}>
              <Table caption={t('Détail du jour')} columns={[{ key: 'label', label: t('Libellé') }, { key: 'amount', label: t('Montant'), align: 'r', render: (r) => <span style={{ color: r.amount < 0 ? 'var(--danger)' : 'var(--ok)' }}>{money(r.amount)}</span> }]} rows={detail.items.map((x, i) => ({ ...x, id: i }))} empty={t('Aucun flux ce jour-là.')} />
            </Card> : null}
            <Card>
              <ChartFrame title={t('Solde jour par jour')} subtitle={title} height={260} summary={c.days.map((d) => d.date + ' ' + money(d.balance)).join(', ')} legend={[{ label: t('Solde en fin de journée'), color: 'var(--c1)' }, { label: t('Encaissements'), color: 'var(--ok)' }, { label: t('Décaissements'), color: 'var(--danger)' }]}>
                <Combo data={curve} fmt={money} zeroLine height={260} series={[{ key: 'inflows', label: t('Encaissements'), type: 'bar', color: 'var(--ok)' }, { key: 'outflows', label: t('Décaissements'), type: 'bar', color: 'var(--danger)' }, { key: 'balance', label: t('Solde en fin de journée'), type: 'line', color: 'var(--c1)' }]} refs={c.minBalance ? [{ y: c.minBalance, label: t('Solde minimal'), tone: 'danger' }] : []} />
              </ChartFrame>
            </Card>
            <Card title={t('Tableau jour par jour')} flush>
              <Table caption={t('Solde par jour')} columns={[{ key: 'date', label: t('Date'), render: (d) => dateFr(d.date) }, { key: 'in', label: t('Encaissements'), align: 'r', render: (d) => (d.in ? money(d.in) : '—') }, { key: 'out', label: t('Décaissements'), align: 'r', render: (d) => (d.out ? money(-d.out) : '—') }, { key: 'balance', label: t('Solde fin de journée'), align: 'r', render: (d) => <b style={{ color: d.balance < 0 ? 'var(--danger)' : undefined }}>{money(d.balance)}</b> }]} rows={c.days.map((d) => ({ ...d, id: d.date }))} />
            </Card>
          </>
        );
      }}</Loaded>
    </>
  );
}

export function PlanScreen({ me }) {
  const t = useT();
  const { oapi, money, dateFr, modal, confirm, today } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/plan'), []);
  const rec = { none: t('Une fois'), weekly: t('Chaque semaine'), monthly: t('Chaque mois'), quarterly: t('Chaque trimestre'), yearly: t('Chaque année') };
  const cat = { customer: t('Clients'), advance_in: t('Acompte client'), other_income: t('Autre encaissement'), interest_in: t('Intérêts reçus'), loan_in: t('Emprunt reçu'), capital_in: t('Apport en capital'), asset_sale: t('Cession d\'immobilisation'), supplier: t('Fournisseurs'), advance_out: t('Acompte fournisseur'), salary: t('Salaires'), social: t('Cotisations sociales'), tax: t('Impôts et taxes'), vat: t('TVA reversée'), rent: t('Loyers'), fees: t('Frais bancaires'), other_expense: t('Autre décaissement'), loan_repay: t('Remboursement d\'emprunt'), interest_out: t('Intérêts payés'), dividends: t('Dividendes'), capex: t('Investissement') };
  const form = (j, p = {}) => modal(p.id ? t('Modifier l\'élément prévu') : t('Nouvel élément prévu'), (close) => (
    <Form submitText={t('Enregistrer')} onSubmit={(v) => oapi(p.id ? 'PUT' : 'POST', '/treasury/plan' + (p.id ? '/' + p.id : ''), { direction: v.direction, category: v.category, label: v.label, amount: v.amount, startDate: v.startDate, recurrence: v.recurrence, endDate: v.endDate || undefined }).then(() => { close(); st.reload(); })}
      fields={[
        { k: 'direction', label: t('Sens'), type: 'select', value: p.direction || 'out', options: [['out', t('Décaissement')], ['in', t('Encaissement')]] },
        { k: 'category', label: t('Nature'), type: 'select', value: p.category || 'rent', options: j.categories.map((c) => [c.key, cat[c.key] + (c.dir === 'in' ? ' (+)' : ' (−)')]), hint: t('La nature doit correspondre au sens choisi.') },
        { k: 'label', label: t('Libellé'), required: true, value: p.label, placeholder: t('Loyer, impôt, remboursement de prêt…') },
        { k: 'amount', label: t('Montant'), required: true, value: p.amount },
        { k: 'startDate', label: t('Première date'), type: 'date', value: p.startDate || today() },
        { k: 'recurrence', label: t('Répétition'), type: 'select', value: p.recurrence || 'none', options: Object.entries(rec) },
        { k: 'endDate', label: t('Dernière date (facultatif)'), type: 'date', value: p.endDate || '' },
      ]} />
  ));
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Alert tone="info">{t('Ici vous ajoutez ce que les documents ne savent pas encore : loyer, impôt, apport, futur prêt… La prévision les intègre aussitôt.')}</Alert>
        {me.canConfigure ? <div className="row" style={{ margin: '12px 0' }}><Button variant="primary" icon="plus" onClick={() => form(j)}>{t('Ajouter un élément prévu')}</Button></div> : null}
        <Card title={t('Éléments prévus')} flush>
          <Table caption={t('Éléments prévus')} empty={t('Aucun élément prévu.')} columns={[
            { key: 'label', label: t('Libellé') }, { key: 'category', label: t('Nature'), render: (p) => cat[p.category] || p.category },
            { key: 'amount', label: t('Montant'), align: 'r', render: (p) => <span style={{ color: p.direction === 'out' ? 'var(--danger)' : 'var(--ok)' }}>{money(p.direction === 'out' ? -p.amount : p.amount)}</span> },
            { key: 'start', label: t('À partir du'), render: (p) => dateFr(p.startDate) }, { key: 'rec', label: t('Répétition'), render: (p) => rec[p.recurrence] },
            { key: 'active', label: t('État'), render: (p) => <Badge tone={p.active ? 'ok' : 'outline'}>{p.active ? t('Actif') : t('Suspendu')}</Badge> },
            ...(me.canConfigure ? [{ key: 'act', label: '', render: (p) => <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}><Button size="sm" iconOnly icon="edit" label={t('Modifier')} onClick={() => form(j, p)} /><Button size="sm" onClick={() => oapi('PUT', '/treasury/plan/' + p.id, { active: !p.active }).then(st.reload)}>{p.active ? t('Suspendre') : t('Reprendre')}</Button><Button size="sm" iconOnly icon="trash" label={t('Supprimer')} onClick={() => confirm(t('Supprimer cet élément ?'), () => oapi('DELETE', '/treasury/plan/' + p.id).then(st.reload))} /></span> }] : []),
          ]} rows={j.items} />
        </Card>
      </>
    )}</Loaded>
  );
}

const PARAM_FIELDS = (t, d) => [
  { k: 'name', label: t('Nom du scénario'), required: true, value: d.name },
  { k: 'salesPct', label: t('Ventes futures (± %)'), value: String(d.salesPct || 0), hint: t('−20 = ventes réduites d\'un cinquième.') },
  { k: 'delayDays', label: t('Retard de paiement des clients (jours)'), value: String(d.delayDays || 0) },
  { k: 'collectionLossPct', label: t('Impayés supplémentaires (% des créances)'), value: String(d.collectionLossPct || 0) },
  { k: 'costPct', label: t('Coûts d\'achat (± %)'), value: String(d.costPct || 0) },
  { k: 'wagePct', label: t('Masse salariale (± %)'), value: String(d.wagePct || 0) },
  { k: 'supplierDelayDays', label: t('Paiement des fournisseurs repoussé de (jours)'), value: String(d.supplierDelayDays || 0) },
  { k: 'capexDate', label: t('Investissement : date'), type: 'date', value: (d.capex && d.capex[0] && d.capex[0].date) || '' },
  { k: 'capexAmount', label: t('Investissement : montant'), value: (d.capex && d.capex[0] && String(d.capex[0].amount)) || '' },
  { k: 'loanAmount', label: t('Nouveau prêt : montant'), value: (d.loan && String(d.loan.amount)) || '' },
  { k: 'loanDate', label: t('Nouveau prêt : date de déblocage'), type: 'date', value: (d.loan && d.loan.date) || '' },
  { k: 'loanMonths', label: t('Nouveau prêt : durée (mois)'), value: (d.loan && String(d.loan.months)) || '24' },
  { k: 'loanRate', label: t('Nouveau prêt : taux annuel (%)'), value: (d.loan && String(d.loan.ratePct)) || '9' },
];
const toParams = (v) => ({
  salesPct: v.salesPct, delayDays: v.delayDays, collectionLossPct: v.collectionLossPct, costPct: v.costPct, wagePct: v.wagePct, supplierDelayDays: v.supplierDelayDays,
  capex: v.capexDate && v.capexAmount ? [{ date: v.capexDate, amount: v.capexAmount, label: 'Investissement' }] : [],
  loan: v.loanAmount && v.loanDate ? { amount: v.loanAmount, date: v.loanDate, months: v.loanMonths, ratePct: v.loanRate } : null,
});

export function ScenariosScreen({ me }) {
  const t = useT();
  const { oapi, money, dateFr, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/scenarios'), []);
  const [picked, setPicked] = useState([]);
  const [cmp, setCmp] = useState(null);
  const run = (body) => oapi('POST', '/treasury/scenarios/compare', body).then(setCmp).catch(fail);
  const form = (s) => modal(s && s.id ? t('Modifier le scénario') : t('Nouveau scénario'), (close) => (
    <Form submitText={t('Enregistrer')} fields={PARAM_FIELDS(t, s ? { name: s.name, ...s.params } : { name: '' })}
      onSubmit={(v) => oapi(s && s.id ? 'PUT' : 'POST', '/treasury/scenarios' + (s && s.id ? '/' + s.id : ''), { name: v.name, params: toParams(v) }).then(() => { close(); st.reload(); })} />
  ), { wide: true });
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-5)));
  const names = { Pessimiste: t('Pessimiste'), Central: t('Central'), Optimiste: t('Optimiste') };
  const COLORS = ['var(--c5)', 'var(--c1)', 'var(--ok)', 'var(--c3)', 'var(--c6)', 'var(--c7)'];
  return (
    <Loaded state={st}>{(j) => {
      const series = cmp ? cmp.results.map((r, i) => ({ key: 's' + i, label: names[r.name] || r.name, color: COLORS[i % COLORS.length], dashed: r.name === 'Central' ? false : false })) : [];
      const data = cmp ? cmp.results[0].weeks.map((w, wi) => Object.fromEntries([['x', w.label], ...cmp.results.map((r, i) => ['s' + i, r.weeks[wi].closing])])) : [];
      return (
        <>
          <Alert tone="info">{t('Un scénario applique des hypothèses à la prévision (ventes, retards, coûts, investissement, prêt) sans toucher à vos données. Comparez-les côte à côte.')}</Alert>
          <div className="row" style={{ margin: '12px 0' }}>
            <Button icon="scale-balanced" onClick={() => run({})}>{t('Comparer pessimiste / central / optimiste')}</Button>
            {me.canConfigure ? <Button variant="primary" icon="plus" onClick={() => form(null)}>{t('Nouveau scénario')}</Button> : null}
          </div>
          <Card title={t('Scénarios enregistrés')} subtitle={t('Cochez jusqu\'à 5 scénarios à comparer au scénario central.')}>
            <Table caption={t('Scénarios')} empty={t('Aucun scénario enregistré : partez des modèles ci-dessous.')} columns={[
              { key: 'pick', label: '', render: (s) => <input type="checkbox" aria-label={t('Comparer {name}', { name: s.name })} checked={picked.includes(s.id)} onChange={() => toggle(s.id)} style={{ width: 22, height: 22 }} /> },
              { key: 'name', label: t('Scénario') },
              { key: 'sum', label: t('Hypothèses'), render: (s) => [s.params.salesPct ? t('Ventes {p} %', { p: s.params.salesPct }) : '', s.params.delayDays ? t('Clients +{d} j', { d: s.params.delayDays }) : '', s.params.costPct ? t('Coûts {p} %', { p: s.params.costPct }) : '', s.params.capex.length ? t('Investissement') : '', s.params.loan ? t('Nouveau prêt') : ''].filter(Boolean).join(' · ') || '—' },
              ...(me.canConfigure ? [{ key: 'act', label: '', render: (s) => <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}><Button size="sm" iconOnly icon="edit" label={t('Modifier')} onClick={() => form(s)} /><Button size="sm" iconOnly icon="trash" label={t('Supprimer')} onClick={() => confirm(t('Supprimer ce scénario ?'), () => oapi('DELETE', '/treasury/scenarios/' + s.id).then(st.reload))} /></span> }] : []),
            ]} rows={j.scenarios} />
            <div className="row" style={{ marginTop: 10 }}><Button variant="primary" disabled={!picked.length} onClick={() => run({ ids: picked })}>{t('Comparer la sélection')}</Button></div>
          </Card>
          {me.canConfigure ? <Card title={t('Modèles prêts à l\'emploi')}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{j.presets.map((p) => <Button key={p.name} size="sm" onClick={() => run({ name: p.name, params: p.params })}>{p.name}</Button>)}</div>
            <p className="small muted" style={{ marginTop: 8 }}>{t('Un modèle se teste tout de suite ; pour le garder, créez un scénario avec les mêmes valeurs.')}</p>
          </Card> : null}
          {cmp ? (
            <>
              <Card>
                <ChartFrame title={t('Solde prévu par semaine selon le scénario')} subtitle={t('Les mêmes données, avec des hypothèses différentes')} height={300} summary={cmp.results.map((r) => r.name + ' ' + money(r.closing13)).join(', ')} legend={series.map((s) => ({ label: s.label, color: s.color }))}>
                  <Lines data={data} series={series} fmt={money} height={300} />
                </ChartFrame>
              </Card>
              <Card title={t('Comparaison')} flush>
                <Table caption={t('Comparaison des scénarios')} columns={[
                  { key: 'name', label: t('Scénario'), render: (r) => names[r.name] || r.name },
                  { key: 'c13', label: t('Solde à 13 semaines'), align: 'r', render: (r) => money(r.closing13) },
                  { key: 'c12', label: t('Solde à 12 mois'), align: 'r', render: (r) => money(r.closing12m) },
                  { key: 'low', label: t('Point bas'), align: 'r', render: (r) => `${money(r.low.balance)} · ${dateFr(r.low.date)}` },
                  { key: 'od', label: t('Découvert prévu'), render: (r) => (r.overdraft ? <Badge tone="danger">{dateFr(r.overdraft.date)}</Badge> : <Badge tone="ok">{t('Aucun')}</Badge>) },
                ]} rows={cmp.results.map((r, i) => ({ ...r, id: i }))} />
              </Card>
            </>
          ) : <Card><EmptyState icon="scale-balanced" title={t('Choisissez une comparaison')}>{t('Lancez la comparaison standard ou cochez vos scénarios.')}</EmptyState></Card>}
        </>
      );
    }}</Loaded>
  );
}
