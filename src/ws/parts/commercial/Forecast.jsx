import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Bars, Combo, HBars } from '../../charts/lazy.jsx';
import { Alert, Badge, Button, Card, ChartFrame, Field, Loading, Segmented, Stat, Table, useLoad } from '../../ui.jsx';
import { Failed, MapSelect, MemberSelect, num, pct, qs, useCp, useForm } from './common.jsx';
import { useL2 } from './labels2.jsx';

/* Prévision des ventes : tendance + pipeline pondéré, trois scénarios, objectif, répartition, écart objectif / réalisé, saisie des objectifs mensuels. */

const thisMonth = () => new Date().toISOString().slice(0, 7);

function ForecastView() {
  const t = useT();
  const { api, tick } = useCp();
  const { money } = useWs();
  const [f, setF] = useState({ months: '6', ownerId: '' });
  const st = useLoad(() => api('GET', '/forecast' + qs(f)), [f, tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const d = st.data;
  const cur = d.months[0];
  const chart = [
    ...d.history.map((h) => ({ x: h.month, actual: h.value })),
    ...d.months.map((m) => ({ x: m.month, pessimistic: m.scenarios.pessimistic, central: m.scenarios.central, optimistic: m.scenarios.optimistic, target: m.target || undefined })),
  ];
  const series = [
    { key: 'actual', label: t('Réalisé'), type: 'bar', color: 'var(--c8)' }, { key: 'pessimistic', label: t('Pessimiste'), type: 'line', color: 'var(--c4)', dashed: true },
    { key: 'central', label: t('Central'), type: 'line', color: 'var(--c1)' }, { key: 'optimistic', label: t('Optimiste'), type: 'line', color: 'var(--c2)', dashed: true }, { key: 'target', label: t('Objectif'), type: 'line', color: 'var(--c3)' },
  ];
  const cols = [
    { key: 'month', label: t('Mois') }, { key: 'realized', label: t('Déjà réalisé'), align: 'r', render: (m) => money(m.realized) },
    { key: 'weighted', label: t('Pipeline pondéré'), align: 'r', render: (m) => money(m.weighted) },
    { key: 'p', label: t('Pessimiste'), align: 'r', render: (m) => money(m.scenarios.pessimistic) }, { key: 'c', label: t('Central'), align: 'r', render: (m) => <b>{money(m.scenarios.central)}</b> },
    { key: 'o', label: t('Optimiste'), align: 'r', render: (m) => money(m.scenarios.optimistic) }, { key: 'trendSes', label: t('Tendance'), align: 'r', render: (m) => money(m.trendSes) },
    { key: 'blended', label: t('Prévision mixte'), align: 'r', render: (m) => money(m.blended) }, { key: 'target', label: t('Objectif'), align: 'r', render: (m) => (m.target ? money(m.target) : '—') },
    { key: 'att', label: t('Atteinte'), align: 'r', render: (m) => (m.attainmentCentral === null ? '—' : <Badge tone={m.attainmentCentral >= 100 ? 'ok' : m.attainmentCentral >= 70 ? 'warn' : 'danger'}>{pct(m.attainmentCentral)}</Badge>) },
  ];
  return (
    <div className="cp-stack">
      <Card title={t('Prévision des ventes')} subtitle={t('Pipeline pondéré par mois de clôture prévue, tendance historique et scénarios.')}>
        <div className="cp-filters">
          <Field label={t('Horizon')}>{(p) => <select {...p} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })}>{[3, 6, 9, 12].map((n) => <option key={n} value={n}>{t('{n} mois', { n })}</option>)}</select>}</Field>
          <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} none={t('Tous')} />}</Field>
        </div>
        <div className="ui-stats">
          <Stat label={t('Atterrissage du mois (central)')} value={money(cur.scenarios.central)} sub={cur.target ? t('{p} de l’objectif', { p: pct(cur.attainmentCentral) }) : t('Pas d’objectif fixé')} icon="target" tone={cur.attainmentCentral !== null && cur.attainmentCentral < 70 ? 'warn' : 'brand'} />
          <Stat label={t('Total central')} value={money(d.total.central)} sub={t('{a} à {b}', { a: money(d.total.pessimistic), b: money(d.total.optimistic) })} icon="chart-line" />
          <Stat label={t('Objectif sur la période')} value={d.total.target ? money(d.total.target) : '—'} icon="bullseye" />
          <Stat label={t('Pipeline ouvert')} value={money(d.pipeline.weighted)} sub={t('{n} opportunité(s) pour {m}', { n: d.pipeline.count, m: money(d.pipeline.amount) })} icon="coins" />
        </div>
        {d.pipeline.undated.count || d.pipeline.overdue.count ? (
          <Alert tone="warn">{d.pipeline.undated.count ? t('{n} opportunité(s) sans date de clôture prévue ne sont pas comptées dans les mois. ', { n: d.pipeline.undated.count }) : ''}{d.pipeline.overdue.count ? t('{n} opportunité(s) ont dépassé leur date de clôture prévue.', { n: d.pipeline.overdue.count }) : ''}</Alert>
        ) : null}
        <ChartFrame title={t('Historique et scénarios')} summary={d.months.map((m) => `${m.month} : ${money(m.scenarios.central)}`).join(' ; ')} height={300}
          legend={series.map((s) => ({ label: s.label, color: s.color }))}><Combo data={chart} series={series} fmt={money} height={300} /></ChartFrame>
        <Table caption={t('Prévision par mois')} rowKey="month" columns={cols} rows={d.months} />
      </Card>
      <Card title={t('Fiabilité de la méthode')} subtitle={t("Rétro-test : pour chaque mois passé, la prévision faite avec les mois précédents est comparée au réalisé.")}>
        <div className="ui-stats">
          <Stat label={t('Erreur moyenne (MAPE)')} value={d.backtest.mape === null ? '—' : pct(d.backtest.mape)} icon="gauge" tone={d.backtest.mape !== null && d.backtest.mape > 30 ? 'warn' : 'ok'} />
          <Stat label={t('Moyenne mobile')} value={money(d.trend.movingAverage)} icon="chart-simple" />
          <Stat label={t('Lissage exponentiel')} value={money(d.trend.ses)} sub={t('{n} mois d’historique', { n: d.trend.months })} icon="chart-line" />
        </div>
        <Table caption={t('Rétro-test')} rowKey="month" columns={[{ key: 'month', label: t('Mois') }, { key: 'actual', label: t('Réalisé'), align: 'r', render: (r) => money(r.actual) }, { key: 'forecast', label: t('Prévu'), align: 'r', render: (r) => money(r.forecast) }, { key: 'errorPct', label: t('Erreur'), align: 'r', render: (r) => (r.errorPct === null ? '—' : pct(r.errorPct)) }]} rows={d.backtest.rows} empty={t("Pas assez d'historique pour un rétro-test.")} />
      </Card>
    </div>
  );
}

function BreakdownView() {
  const t = useT();
  const L2 = useL2();
  const { api, tick } = useCp();
  const { money } = useWs();
  const [by, setBy] = useState('owner');
  const st = useLoad(() => api('GET', '/forecast/breakdown?by=' + by), [by, tick]);
  const none = t('Non renseigné');
  const lab = (r) => r.label || r.key || none;
  return (
    <Card title={t('Pipeline pondéré par axe')} actions={<MapSelectInline value={by} onChange={setBy} map={L2.breakBy} label={t('Axe')} />}>
      {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : (
        <>
          <ChartFrame title={t('Valeur pondérée')} summary={st.data.rows.slice(0, 8).map((r) => `${lab(r)} : ${money(r.weighted)}`).join(' ; ')} height={Math.max(180, Math.min(8, st.data.rows.length) * 36)}>
            <HBars data={st.data.rows.slice(0, 8).map((r) => ({ name: lab(r), value: r.weighted }))} fmt={money} valueLabel={t('Valeur pondérée')} height={Math.max(180, Math.min(8, st.data.rows.length) * 36)} /></ChartFrame>
          <Table caption={t('Pipeline pondéré par axe')} rowKey="key" columns={[
            { key: 'label', label: L2.breakBy[by], render: lab }, { key: 'count', label: t('Opportunités'), align: 'r' }, { key: 'amount', label: t('Montant'), align: 'r', render: (r) => money(r.amount) },
            { key: 'weighted', label: t('Valeur pondérée'), align: 'r', render: (r) => money(r.weighted) }, { key: 'avgProbability', label: t('Probabilité moyenne'), align: 'r', render: (r) => pct(r.avgProbability) }, { key: 'share', label: t('Part'), align: 'r', render: (r) => pct(r.share) },
          ]} rows={st.data.rows} empty={t('Aucune opportunité ouverte.')} />
        </>
      )}
    </Card>
  );
}
function MapSelectInline({ value, onChange, map, label }) {
  return <Field label={label}>{(p) => <MapSelect {...p} map={map} value={value} onChange={onChange} />}</Field>;
}

function VarianceView() {
  const t = useT();
  const { api, tick } = useCp();
  const { money } = useWs();
  const [months, setMonths] = useState('6');
  const st = useLoad(() => api('GET', '/forecast/variance?months=' + months), [months, tick]);
  if (st.error) return <Failed e={st.error} />;
  const d = st.data;
  return (
    <Card title={t('Écart objectif / réalisé')} actions={<Field label={t('Période')}>{(p) => <select {...p} value={months} onChange={(e) => setMonths(e.target.value)}>{[3, 6, 12, 24].map((n) => <option key={n} value={n}>{t('{n} mois', { n })}</option>)}</select>}</Field>}>
      {!d ? <Loading /> : (
        <>
          <div className="ui-stats">
            <Stat label={t('Objectif cumulé')} value={money(d.totals.target)} icon="bullseye" />
            <Stat label={t('Réalisé cumulé')} value={money(d.totals.actual)} icon="coins" tone="ok" />
            <Stat label={t('Écart')} value={money(d.totals.gap)} icon="arrows-up-down" tone={d.totals.gap >= 0 ? 'ok' : 'danger'} />
            <Stat label={t("Taux d'atteinte")} value={d.totals.attainment === null ? '—' : pct(d.totals.attainment)} icon="gauge" />
          </div>
          <ChartFrame title={t('Objectif et réalisé par mois')} summary={d.rows.map((r) => `${r.month} : ${money(r.actual)} / ${money(r.target)}`).join(' ; ')} height={260} legend={[{ label: t('Objectif'), color: 'var(--c3)' }, { label: t('Réalisé'), color: 'var(--c1)' }]}>
            <Bars data={d.rows.map((r) => ({ x: r.month, target: r.target, actual: r.actual }))} series={[{ key: 'target', label: t('Objectif'), color: 'var(--c3)' }, { key: 'actual', label: t('Réalisé'), color: 'var(--c1)' }]} fmt={money} height={260} /></ChartFrame>
          <Table caption={t('Écart par mois')} rowKey="month" columns={[
            { key: 'month', label: t('Mois'), render: (r) => r.month + (r.inProgress ? ' · ' + t('en cours') : '') }, { key: 'target', label: t('Objectif'), align: 'r', render: (r) => money(r.target) },
            { key: 'actual', label: t('Réalisé'), align: 'r', render: (r) => money(r.actual) }, { key: 'gap', label: t('Écart'), align: 'r', render: (r) => <span className={r.gap < 0 ? 'late' : 'ok'}>{money(r.gap)}</span> },
            { key: 'gapPct', label: t('Écart (%)'), align: 'r', render: (r) => (r.gapPct === null ? '—' : pct(r.gapPct)) },
          ]} rows={d.rows} />
        </>
      )}
    </Card>
  );
}

function TargetsView() {
  const t = useT();
  const L2 = useL2();
  const { api, has, fail, tick, bump, memberName } = useCp();
  const { money, toast } = useWs();
  const [from] = useState(thisMonth());
  const st = useLoad(() => api('GET', '/targets?from=' + from), [from, tick]);
  const f = useForm({ period: thisMonth(), metric: 'revenue', userId: '', value: '' });
  const save = (e) => {
    e.preventDefault();
    f.run(async () => {
      if (!/^\d{4}-\d{2}$/.test(f.v.period)) throw new Error(t('Mois invalide (AAAA-MM).'));
      await api('PUT', '/targets', { period: f.v.period, metric: f.v.metric, userId: f.v.userId || undefined, value: num(f.v.value) });
      toast(t('Objectif enregistré.')); st.reload(); bump();
    });
  };
  const del = (r) => api('DELETE', '/targets' + qs({ period: r.period, metric: r.metric, userId: r.userId || '' })).then(() => { st.reload(); bump(); }, fail);
  const fmt = (m, v) => (m === 'revenue' || m === 'margin' ? money(v) : v);
  return (
    <div className="cp-stack">
      {has('targets') ? (
        <Card title={t('Fixer un objectif mensuel')} subtitle={t("Sans commercial choisi, l'objectif est celui de toute l'organisation.")}>
          <form className="ws-form" noValidate onSubmit={save}>
            <div className="cp-grid">
              <Field label={t('Mois')}>{(p) => <input {...p} type="month" value={f.v.period} onChange={f.set('period')} />}</Field>
              <Field label={t('Indicateur')}>{(p) => <MapSelect {...p} map={L2.metric} value={f.v.metric} onChange={f.set('metric')} />}</Field>
              <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} onlySales value={f.v.userId} onChange={f.set('userId')} none={t("Toute l'organisation")} />}</Field>
              <Field label={t('Objectif')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.value} onChange={f.set('value')} />}</Field>
            </div>
            <p className="ws-err" role="alert">{f.err}</p>
            <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
          </form>
        </Card>
      ) : null}
      <Card title={t('Objectifs fixés')}>
        {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : (
          <Table caption={t('Objectifs fixés')} columns={[
            { key: 'period', label: t('Mois') }, { key: 'metric', label: t('Indicateur'), render: (r) => L2.metric[r.metric] || r.metric },
            { key: 'who', label: t('Pour'), render: (r) => (r.userId ? memberName(r.userId) : t("Toute l'organisation")) }, { key: 'value', label: t('Objectif'), align: 'r', render: (r) => fmt(r.metric, r.value) },
            { key: 'act', label: '', render: (r) => (has('targets') ? <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer')} onClick={() => del(r)} /> : null) },
          ]} rows={st.data.targets} empty={t('Aucun objectif fixé.')} />
        )}
      </Card>
    </div>
  );
}

export default function Forecast({ initial = 'forecast' }) {
  const t = useT();
  const [view, setView] = useState(initial);
  return (
    <div className="cp-stack">
      <Segmented label={t('Vue')} value={view} onChange={setView} items={[{ id: 'forecast', label: t('Prévision') }, { id: 'breakdown', label: t('Répartition') }, { id: 'variance', label: t('Écarts') }, { id: 'targets', label: t('Objectifs') }]} />
      {view === 'forecast' ? <ForecastView /> : view === 'breakdown' ? <BreakdownView /> : view === 'variance' ? <VarianceView /> : <TargetsView />}
    </div>
  );
}
