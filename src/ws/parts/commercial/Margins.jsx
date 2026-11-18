import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { HBars } from '../../charts/lazy.jsx';
import { Alert, Badge, Card, ChartFrame, Field, Loading, Segmented, Stat, Table, useLoad } from '../../ui.jsx';
import { DateRange } from './Funnel.jsx';
import { Failed, MapSelect, daysAgo, pct, qs, useCp } from './common.jsx';
import { useL3 } from './labels3.jsx';

/* Marges par document, client et produit (avec la part du chiffre d'affaires dont le coût est connu) et alertes sous le seuil. */

function MarginTotals({ d, threshold }) {
  const t = useT();
  const { money } = useWs();
  return (
    <>
      <div className="ui-stats">
        <Stat label={t("Chiffre d'affaires HT")} value={money(d.revenue)} icon="coins" />
        <Stat label={t('Marge')} value={d.margin === null ? '—' : money(d.margin)} icon="percent" tone="ok" />
        <Stat label={t('Taux de marge')} value={d.pct === null ? '—' : pct(d.pct)} sub={t('Seuil : {p}', { p: pct(threshold) })} icon="gauge" tone={d.pct !== null && d.pct < threshold ? 'danger' : 'ok'} />
        <Stat label={t('Couverture du coût')} value={pct(d.coverage)} sub={t('Part du chiffre d’affaires dont le coût est connu')} icon="database" tone={d.coverage < 60 ? 'warn' : 'brand'} />
      </div>
      {d.coverage < 100 ? <Alert tone="warn">{t("Le taux de marge ne porte que sur les articles dont le coût est connu. Renseignez les coûts dans « Articles et coûts ».")}</Alert> : null}
    </>
  );
}

function Summary() {
  const t = useT();
  const { api, tick } = useCp();
  const { money } = useWs();
  const [r, setR] = useState({ from: daysAgo(90), to: new Date().toISOString().slice(0, 10) });
  const st = useLoad(() => api('GET', '/margins/summary' + qs(r)), [r, tick]);
  const cols = (label) => [
    { key: 'name', label, render: (x) => <b>{x.name}</b> }, { key: 'revenue', label: t("Chiffre d'affaires"), align: 'r', render: (x) => money(x.revenue) }, { key: 'margin', label: t('Marge'), align: 'r', render: (x) => money(x.margin) },
    { key: 'pct', label: t('Taux'), align: 'r', render: (x) => (x.pct === null ? '—' : <Badge tone={x.pct < st.data.threshold ? 'danger' : 'ok'}>{pct(x.pct)}</Badge>) }, { key: 'coverage', label: t('Couverture'), align: 'r', render: (x) => pct(x.coverage) },
  ];
  return (
    <Card title={t('Marges par client et par produit')}>
      <DateRange value={r} onChange={setR} />
      {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : (
        <>
          <MarginTotals d={st.data.total} threshold={st.data.threshold} />
          <ChartFrame title={t('Marge par produit')} summary={st.data.products.slice(0, 8).map((p) => `${p.name} : ${p.pct === null ? '—' : pct(p.pct)}`).join(' ; ')} height={Math.max(180, Math.min(8, st.data.products.length) * 34)}>
            <HBars data={st.data.products.filter((p) => p.pct !== null).slice(0, 8).map((p) => ({ name: p.name, value: p.pct }))} fmt={(v) => v + ' %'} valueLabel={t('Taux de marge')} height={Math.max(180, Math.min(8, st.data.products.length) * 34)} /></ChartFrame>
          <h3>{t('Par produit')}</h3><Table caption={t('Par produit')} rowKey="name" columns={cols(t('Produit'))} rows={st.data.products} empty={t('Aucune vente sur la période.')} />
          <h3>{t('Par client')}</h3><Table caption={t('Par client')} rowKey="id" columns={cols(t('Client'))} rows={st.data.customers} empty={t('Aucune vente sur la période.')} />
        </>
      )}
    </Card>
  );
}

function Documents() {
  const t = useT();
  const L3 = useL3();
  const { api, tick } = useCp();
  const { money, dateFr } = useWs();
  const [kind, setKind] = useState('invoice');
  const st = useLoad(() => api('GET', '/margins/documents?kind=' + kind), [kind, tick]);
  return (
    <Card title={t('Marge par document')} actions={<Field label={t('Type')}>{(p) => <MapSelect {...p} map={L3.docKind} value={kind} onChange={setKind} />}</Field>}>
      {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : (
        <>
          <MarginTotals d={st.data.totals} threshold={st.data.threshold} />
          <Table caption={t('Marge par document')} columns={[
            { key: 'number', label: t('Numéro'), render: (d) => <b>{d.number}</b> }, { key: 'customer', label: t('Client') }, { key: 'issued', label: t('Date'), render: (d) => dateFr(d.issued) },
            { key: 'revenue', label: t('CA HT'), align: 'r', render: (d) => money(d.revenue) }, { key: 'margin', label: t('Marge'), align: 'r', render: (d) => (d.margin === null ? '—' : money(d.margin)) },
            { key: 'marginPct', label: t('Taux'), align: 'r', render: (d) => (d.marginPct === null ? '—' : <Badge tone={d.below ? 'danger' : 'ok'}>{pct(d.marginPct)}</Badge>) }, { key: 'coverage', label: t('Couverture'), align: 'r', render: (d) => pct(d.coverage) },
          ]} rows={st.data.documents} empty={t('Aucun document sur la période.')} />
        </>
      )}
    </Card>
  );
}

function Alerts() {
  const t = useT();
  const L3 = useL3();
  const { api, tick } = useCp();
  const { money } = useWs();
  const st = useLoad(() => api('GET', '/margins/alerts'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  return (
    <Card title={t('Alertes de marge')} subtitle={t('Devis et commandes en cours dont la marge est sous le seuil de {p}.', { p: pct(st.data.threshold) })}>
      <Table caption={t('Alertes de marge')} columns={[
        { key: 'number', label: t('Numéro'), render: (a) => <b>{a.number}</b> }, { key: 'kind', label: t('Type'), render: (a) => L3.docKind[a.kind] || a.kind }, { key: 'customer', label: t('Client') },
        { key: 'revenue', label: t('CA HT'), align: 'r', render: (a) => money(a.revenue) }, { key: 'marginPct', label: t('Taux'), align: 'r', render: (a) => <Badge tone="danger">{pct(a.marginPct)}</Badge> }, { key: 'coverage', label: t('Couverture'), align: 'r', render: (a) => pct(a.coverage) },
      ]} rows={st.data.alerts} empty={t('Aucune alerte : toutes les marges sont au-dessus du seuil.')} />
    </Card>
  );
}

export default function Margins() {
  const t = useT();
  const [view, setView] = useState('summary');
  return (
    <div className="cp-stack">
      <Segmented label={t('Vue')} value={view} onChange={setView} items={[{ id: 'summary', label: t('Clients et produits') }, { id: 'docs', label: t('Documents') }, { id: 'alerts', label: t('Alertes') }]} />
      {view === 'summary' ? <Summary /> : view === 'docs' ? <Documents /> : <Alerts />}
    </div>
  );
}
