import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Combo, Donut, HBars } from '../../charts/lazy.jsx';
import { Alert, Button, Card, ChartFrame, Field, Loading, Stat, Table, useLoad } from '../../ui.jsx';
import { DateRange } from './Funnel.jsx';
import { Failed, MemberSelect, pct, qs, useCp, useDownload, useL } from './common.jsx';
import { useL3 } from './labels3.jsx';

/* Performance : tableau de bord direction / commercial, comparaison de périodes, résumé en phrases, exports PDF / Excel / CSV. */

const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;

/** Phrases lisibles à partir des codes du serveur. */
function useSentences() {
  const t = useT();
  const { money } = useWs();
  return (s) => {
    const p = s.params || {};
    switch (s.code) {
      case 'revenue_up': return t("Le chiffre d'affaires est de {revenue}, en hausse de {pct} % par rapport à la période de comparaison ({previous}).", { revenue: money(p.revenue), pct: p.pct, previous: money(p.previous) });
      case 'revenue_down': return t("Le chiffre d'affaires est de {revenue}, en baisse de {pct} % par rapport à la période de comparaison ({previous}).", { revenue: money(p.revenue), pct: p.pct, previous: money(p.previous) });
      case 'revenue': return t("Le chiffre d'affaires de la période est de {revenue}.", { revenue: money(p.revenue) });
      case 'margin': return t('La marge est de {pct} %, calculée sur {coverage} % du chiffre d’affaires dont le coût est connu.', p);
      case 'target': return t("L'objectif de {target} est atteint à {attainment} %.", { target: money(p.target), attainment: p.attainment });
      case 'lead_conversion': return t('{pct} % des {leads} prospects de la période sont devenus clients.', p);
      case 'win_rate': return t('Sur les affaires clôturées, {won} gagnée(s) et {lost} perdue(s) : un taux de gain de {pct} %.', p);
      case 'cycle': return t("Une affaire gagnée prend en moyenne {days} jours entre sa création et sa signature.", p);
      case 'top_product': return t('Le produit le plus vendu est « {name} », soit {share} % du chiffre d’affaires.', p);
      case 'top_seller': return t('{name} réalise {share} % du chiffre d’affaires.', p);
      case 'pipeline': return t('Il reste {count} affaire(s) en cours, pour {weighted} une fois pondérées par leur probabilité.', { count: p.count, weighted: money(p.weighted) });
      default: return s.code;
    }
  };
}

function Delta({ v }) {
  if (v === null || v === undefined) return null;
  return <span className={v >= 0 ? 'ok' : 'late'}>{v >= 0 ? '▲ +' : '▼ '}{v} %</span>;
}

export default function Analytics() {
  const t = useT();
  const L = useL();
  const L3 = useL3();
  const sentence = useSentences();
  const { api, has, tick } = useCp();
  const { money } = useWs();
  const download = useDownload();
  const [r, setR] = useState({ from: monthStart(), to: new Date().toISOString().slice(0, 10) });
  const [compare, setCompare] = useState('previous');
  const [ownerId, setOwnerId] = useState('');
  const [kind, setKind] = useState('sales');
  const st = useLoad(() => api('GET', '/analytics/overview' + qs({ ...r, compare, ownerId })), [r, compare, ownerId, tick]);
  const d = st.data;
  const none = t('Non renseigné');
  const bars = (list, labelOf) => list.slice(0, 8).map((x) => ({ name: labelOf(x.key) || none, value: x.revenue }));
  const k = d && d.kpis;
  const dl = (format) => download('/reports/export' + qs({ kind, format, from: r.from, to: r.to }), `commercial-${kind}-${r.from}_${r.to}.${format}`);
  return (
    <div className="cp-stack">
      <Card title={t('Performance commerciale')} subtitle={t('Le résumé ci-dessous est écrit pour être lu sans connaissances techniques.')}>
        <DateRange value={r} onChange={setR} />
        <div className="cp-filters">
          <Field label={t('Comparer à')}>{(p) => <select {...p} value={compare} onChange={(e) => setCompare(e.target.value)}><option value="previous">{t('La période précédente')}</option><option value="year">{t("Le même moment l'an dernier")}</option><option value="none">{t('Ne pas comparer')}</option></select>}</Field>
          {has('coach') ? <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} onlySales value={ownerId} onChange={setOwnerId} none={t('Toute l’équipe')} />}</Field> : null}
        </div>
        {st.error ? <Failed e={st.error} /> : !d ? <Loading /> : (
          <>
            <Alert tone="info" title={t('En résumé')}><ul className="cp-sum">{d.summary.map((s, i) => <li key={i}>{sentence(s)}</li>)}</ul></Alert>
            <div className="ui-stats">
              <Stat label={t("Chiffre d'affaires")} value={money(k.revenue)} sub={d.deltas ? <Delta v={d.deltas.revenue} /> : null} icon="coins" />
              <Stat label={t('Marge')} value={k.margin === null || k.marginPct === null ? '—' : money(k.margin)} sub={k.marginPct === null ? t('Coûts inconnus') : pct(k.marginPct)} icon="percent" />
              <Stat label={t('Objectif')} value={k.attainment === null ? '—' : pct(k.attainment)} sub={k.target ? money(k.target) : t('Pas d’objectif fixé')} icon="bullseye" tone={k.attainment !== null && k.attainment < 70 ? 'warn' : 'ok'} />
              <Stat label={t('Factures')} value={k.invoices} sub={d.deltas ? <Delta v={d.deltas.invoices} /> : null} icon="receipt" />
              <Stat label={t('Panier moyen')} value={money(k.avgBasket)} sub={d.deltas ? <Delta v={d.deltas.avgBasket} /> : null} icon="cart-shopping" />
              <Stat label={t('Nouveaux clients')} value={k.newCustomers} sub={d.deltas ? <Delta v={d.deltas.newCustomers} /> : null} icon="user-plus" />
              <Stat label={t('Conversion des prospects')} value={k.leadConversion === null ? '—' : pct(k.leadConversion)} sub={t('{n} prospect(s)', { n: k.leads })} icon="trend-up" />
              <Stat label={t('Taux de gain')} value={k.winRate === null ? '—' : pct(k.winRate)} sub={t('{a} gagnée(s), {b} perdue(s)', { a: k.oppsWon, b: k.oppsLost })} icon="handshake" />
              <Stat label={t('Cycle de vente')} value={k.avgCycleDays === null ? '—' : t('{n} j', { n: k.avgCycleDays })} icon="clock" />
              <Stat label={t('Pipeline pondéré')} value={money(d.pipeline.weighted)} sub={t('{n} affaire(s) pour {m}', { n: d.pipeline.count, m: money(d.pipeline.amount) })} icon="target" />
            </div>
            {d.previousPeriod ? <p className="small muted">{t('Comparaison avec la période du {a} au {b}.', { a: d.previousPeriod.from, b: d.previousPeriod.to })}</p> : null}
            <ChartFrame title={t("Chiffre d'affaires et objectif (12 mois)")} summary={d.series.map((s) => `${s.month} : ${money(s.revenue)}`).join(' ; ')} height={260} legend={[{ label: t("Chiffre d'affaires"), color: 'var(--c1)' }, { label: t('Objectif'), color: 'var(--c3)' }]}>
              <Combo data={d.series.map((s) => ({ x: s.month, revenue: s.revenue, target: s.target || undefined }))} series={[{ key: 'revenue', label: t("Chiffre d'affaires"), type: 'bar' }, { key: 'target', label: t('Objectif'), type: 'line', color: 'var(--c3)' }]} fmt={money} height={260} /></ChartFrame>
          </>
        )}
      </Card>
      {d ? (
        <>
          <div className="cp-two">
            <Card><ChartFrame title={t('Par produit')} summary={bars(d.byProduct, (x) => x).map((x) => `${x.name} : ${money(x.value)}`).join(' ; ') || t('Aucune donnée')} height={260}><HBars data={bars(d.byProduct, (x) => x)} fmt={money} valueLabel={t("Chiffre d'affaires")} height={260} /></ChartFrame></Card>
            <Card><ChartFrame title={t('Par segment de clients')} summary={bars(d.bySegment, (x) => L.rfm[x] || t('Sans achat récent')).map((x) => `${x.name} : ${money(x.value)}`).join(' ; ') || t('Aucune donnée')} height={260}>
              <Donut data={bars(d.bySegment, (x) => L.rfm[x] || t('Sans achat récent'))} fmt={money} center={money(k.revenue)} sub={t('au total')} /></ChartFrame></Card>
          </div>
          <div className="cp-two">
            <Card><ChartFrame title={t('Par zone')} summary={bars(d.byZone, (x) => x).map((x) => `${x.name} : ${money(x.value)}`).join(' ; ') || t('Aucune donnée')} height={220}><HBars data={bars(d.byZone, (x) => x)} fmt={money} valueLabel={t("Chiffre d'affaires")} height={220} /></ChartFrame></Card>
            <Card><ChartFrame title={t('Par commercial')} summary={bars(d.byOwner, (x) => x).map((x) => `${x.name} : ${money(x.value)}`).join(' ; ') || t('Aucune donnée')} height={220}><HBars data={bars(d.byOwner, (x) => x)} fmt={money} valueLabel={t("Chiffre d'affaires")} height={220} /></ChartFrame></Card>
          </div>
          <Card title={t('Dix premiers clients')}>
            <Table caption={t('Dix premiers clients')} rowKey="key" columns={[{ key: 'key', label: t('Client') }, { key: 'revenue', label: t("Chiffre d'affaires"), align: 'r', render: (x) => money(x.revenue) }, { key: 'share', label: t('Part'), align: 'r', render: (x) => pct(x.share) }]} rows={d.topCustomers} empty={t('Aucune vente sur la période.')} />
          </Card>
        </>
      ) : null}
      {has('export') ? (
        <Card title={t('Exporter un rapport')} subtitle={t('Les rapports portent sur la période choisie ci-dessus.')}>
          <div className="cp-filters">
            <Field label={t('Rapport')}>{(p) => <select {...p} value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(L3.report).map(([key, l]) => <option key={key} value={key}>{l}</option>)}</select>}</Field>
          </div>
          <div className="row"><Button icon="file-pdf" onClick={() => dl('pdf')}>PDF</Button><Button icon="table" onClick={() => dl('xlsx')}>Excel</Button><Button icon="download" onClick={() => dl('csv')}>CSV</Button></div>
        </Card>
      ) : null}
    </div>
  );
}
