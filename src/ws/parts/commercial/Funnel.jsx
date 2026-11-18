import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { HBars } from '../../charts/lazy.jsx';
import { Card, ChartFrame, Field, Loading, Stat, Table, useLoad } from '../../ui.jsx';
import { Failed, daysAgo, pct, useCp } from './common.jsx';

/* Entonnoir du pipeline : passage d'une étape à l'autre, taux de gain, cycle de vente, durées et motifs. */

export function DateRange({ value, onChange }) {
  const t = useT();
  return (
    <div className="cp-filters">
      <Field label={t('Du')}>{(p) => <input {...p} type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} />}</Field>
      <Field label={t('Au')}>{(p) => <input {...p} type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} />}</Field>
    </div>
  );
}

export default function Funnel() {
  const t = useT();
  const { api, tick } = useCp();
  const { money } = useWs();
  const [r, setR] = useState({ from: daysAgo(365), to: new Date().toISOString().slice(0, 10) });
  const st = useLoad(() => api('GET', '/pipeline/funnel?from=' + r.from + '&to=' + r.to), [r, tick]);
  const d = st.data;
  const reasonCols = (label) => [
    { key: 'reason', label }, { key: 'count', label: t('Nombre'), align: 'r' }, { key: 'amount', label: t('Montant'), align: 'r', render: (x) => money(x.amount) },
  ];
  return (
    <div className="cp-stack">
      <Card title={t('Entonnoir de conversion')} subtitle={t('Opportunités créées sur la période choisie.')}>
        <DateRange value={r} onChange={setR} />
        {st.error ? <Failed e={st.error} /> : !d ? <Loading /> : (
          <>
            <div className="ui-stats">
              <Stat label={t('Opportunités créées')} value={d.created} icon="bullseye" />
              <Stat label={t('Taux de gain')} value={pct(d.winRate)} sub={t('{g} gagnées, {l} perdues', { g: d.won, l: d.lost })} icon="trend-up" tone="ok" />
              <Stat label={t('Montant gagné')} value={money(d.wonAmount)} icon="coins" tone="ok" />
              <Stat label={t('Montant perdu')} value={money(d.lostAmount)} icon="trend-down" tone="danger" />
              <Stat label={t('Cycle de vente moyen')} value={t('{n} j', { n: d.avgCycleDays })} icon="clock" />
            </div>
            <ChartFrame title={t("Opportunités ayant atteint chaque étape")} summary={d.steps.map((s) => `${s.stage} : ${s.count} (${pct(s.rateFromPrev)})`).join(' ; ')} height={Math.max(180, d.steps.length * 46)}>
              <HBars data={d.steps.map((s) => ({ name: s.stage, value: s.count }))} valueLabel={t('Opportunités')} height={Math.max(180, d.steps.length * 46)} />
            </ChartFrame>
            <Table caption={t('Passage entre les étapes')} rowKey="stageId" columns={[
              { key: 'stage', label: t('Étape') }, { key: 'count', label: t('Atteint'), align: 'r' },
              { key: 'rateFromPrev', label: t("Depuis l'étape précédente"), align: 'r', render: (s) => pct(s.rateFromPrev) },
              { key: 'rateFromStart', label: t('Depuis le début'), align: 'r', render: (s) => pct(s.rateFromStart) },
              { key: 'avg', label: t('Durée moyenne'), align: 'r', render: (s) => { const a = d.avgDaysByStage.find((x) => x.stageId === s.stageId); return a ? t('{n} j', { n: a.avgDays }) : '—'; } },
            ]} rows={d.steps} />
          </>
        )}
      </Card>
      {d ? (
        <div className="cp-two">
          <Card title={t('Motifs de perte')}><Table caption={t('Motifs de perte')} rowKey="reason" columns={reasonCols(t('Motif'))} rows={d.lossReasons} empty={t('Aucune perte sur la période.')} /></Card>
          <Card title={t('Motifs de gain')}><Table caption={t('Motifs de gain')} rowKey="reason" columns={reasonCols(t('Motif'))} rows={d.winReasons} empty={t('Aucun gain sur la période.')} /></Card>
        </div>
      ) : null}
    </div>
  );
}
