import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Combo, Donut, HBars } from '../../charts/lazy.jsx';
import { Badge, Card, ChartFrame, Loading, Stat, Table, useLoad } from '../../ui.jsx';
import { DateRange } from './Funnel.jsx';
import { Failed, GRADE_COLOR, Grade, daysAgo, fmtDT, pct, useCp, useL } from './common.jsx';

/* Tableau de bord de la prospection : entonnoir, conversion par source, répartition des notes A à D, créations par semaine. */

export default function ProspectDash() {
  const t = useT();
  const L = useL();
  const { api, tick, go, openLead } = useCp();
  const [r, setR] = useState({ from: daysAgo(90), to: new Date().toISOString().slice(0, 10) });
  const st = useLoad(() => api('GET', '/prospection/dashboard?from=' + r.from + '&to=' + r.to), [r, tick]);
  const d = st.data;
  if (st.error) return <Failed e={st.error} />;
  const funnel = d ? d.funnel.map((s) => ({ name: L.leadStatus[s.stage], value: s.count })) : [];
  const bySrc = d ? d.bySource.map((s) => ({ name: L.source[s.source], value: s.conversionRate })) : [];
  const grades = d ? d.byGrade.map((g) => ({ name: g.grade, value: g.count, color: GRADE_COLOR[g.grade] })) : [];
  const weekly = d ? d.weekly.map((w) => ({ x: w.week.slice(5), created: w.created, converted: w.converted })) : [];
  const srcCols = [
    { key: 'source', label: t('Source'), render: (s) => <>{L.source[s.source]}{d.bestSource && d.bestSource.source === s.source ? <> <Badge tone="ok">{t('Meilleure source')}</Badge></> : null}</> },
    { key: 'leads', label: t('Prospects'), align: 'r' }, { key: 'qualified', label: t('Qualifiés'), align: 'r' }, { key: 'converted', label: t('Convertis'), align: 'r' },
    { key: 'lost', label: t('Perdus'), align: 'r' }, { key: 'conversionRate', label: t('Taux de conversion'), align: 'r', render: (s) => pct(s.conversionRate) }, { key: 'avgScore', label: t('Score moyen'), align: 'r' },
  ];
  const staleCols = [
    { key: 'name', label: t('Prospect'), render: (l) => <button type="button" className="cp-link" onClick={() => openLead(l.id)}><b>{l.name}</b></button> },
    { key: 'g', label: t('Note'), render: (l) => <Grade grade={l.grade} score={l.score} /> }, { key: 'owner', label: t('Commercial') },
    { key: 'last', label: t('Dernier contact'), render: (l) => (l.lastContactAt ? fmtDT(l.lastContactAt) : t('Jamais')) },
  ];
  return (
    <div className="cp-stack">
      <Card title={t('Prospection')} subtitle={t('Prospects créés sur la période choisie.')}>
        <DateRange value={r} onChange={setR} />
        {!d ? <Loading /> : (
          <div className="ui-stats">
            <Stat label={t('Prospects créés')} value={d.total} icon="user-plus" />
            <Stat label={t('Prospects ouverts')} value={d.openTotal} sub={t('{n} sans commercial', { n: d.unassigned })} icon="users" onClick={() => go('leads')} />
            <Stat label={t('Taux de conversion')} value={pct(d.conversionRate)} sub={t('{n} converti(s)', { n: d.converted })} icon="trend-up" tone="ok" />
            <Stat label={t('Score moyen')} value={d.avgScore} icon="star" />
            <Stat label={t('À relancer')} value={d.staleCount} icon="hourglass" tone={d.staleCount ? 'warn' : 'ok'} />
          </div>
        )}
      </Card>
      {d ? (
        <>
          <div className="cp-two">
            <Card><ChartFrame title={t('Entonnoir de prospection')} summary={funnel.map((s) => `${s.name} : ${s.value}`).join(' ; ')} height={220}><HBars data={funnel} valueLabel={t('Prospects')} height={220} /></ChartFrame></Card>
            <Card><ChartFrame title={t('Conversion par source (%)')} summary={bySrc.map((s) => `${s.name} : ${s.value} %`).join(' ; ') || t('Aucune donnée')} height={220}><HBars data={bySrc} valueLabel={t('Conversion (%)')} fmt={(v) => v + ' %'} height={220} /></ChartFrame></Card>
          </div>
          <div className="cp-two">
            <Card><ChartFrame title={t('Prospects ouverts par note')} summary={grades.map((g) => `${g.name} : ${g.value}`).join(' ; ')} height={220}><Donut data={grades} center={d.openTotal} sub={t('prospects')} /></ChartFrame></Card>
            <Card><ChartFrame title={t('Créations par semaine')} summary={weekly.map((w) => `${w.x} : ${w.created}`).join(' ; ') || t('Aucune donnée')} height={220}
              legend={[{ label: t('Créés'), color: 'var(--c1)' }, { label: t('Convertis'), color: 'var(--c2)' }]}>
              <Combo data={weekly} series={[{ key: 'created', label: t('Créés'), type: 'bar' }, { key: 'converted', label: t('Convertis'), type: 'line', color: 'var(--c2)' }]} height={220} /></ChartFrame></Card>
          </div>
          <Card title={t('Résultats par source')}><Table caption={t('Résultats par source')} rowKey="source" columns={srcCols} rows={d.bySource} empty={t('Aucun prospect sur la période.')} /></Card>
          <Card title={t('Prospects à relancer')} subtitle={t('Sans contact depuis le délai fixé dans les réglages.')}><Table caption={t('Prospects à relancer')} columns={staleCols} rows={d.stale} empty={t('Aucun prospect à relancer.')} /></Card>
        </>
      ) : null}
    </div>
  );
}
