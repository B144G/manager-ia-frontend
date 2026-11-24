import { useEffect, useMemo, useState } from 'react';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { Failed } from './Failed.jsx';
import { Card, ChartFrame, EmptyState, Field, Segmented, Skeleton, Stat } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { Bars, Combo, Donut, HBars, SERIES } from '../../charts/lazy.jsx';
import { TYPE_IDS, iso, parseDay, todayLocal, useLabels, useMtg } from './common.jsx';
import '../../../styles/ws-meetings-adv-a.css';

/* Statistiques des réunions : taux de décision, présence, ponctualité, durée, tâches issues des réunions, par type / service / site / urgence, courbe mensuelle. */

const URGENCIES = ['normal', 'urgent', 'critical'];

function presetRange(id) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (id === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
  if (id === 'quarter') { const q = Math.floor(m / 3) * 3; return [iso(new Date(y, q, 1)), iso(new Date(y, q + 3, 0))]; }
  if (id === 'year') return [`${y}-01-01`, `${y}-12-31`];
  const s = new Date(y, m - 11, 1);
  return [iso(s), todayLocal()];
}
const pctTxt = (v) => (v === null || v === undefined ? '—' : v + ' %');
const minTxt = (v) => (v === null || v === undefined ? '—' : v + ' min');

export default function Stats() {
  const t = useT();
  const L = useLabels();
  const { oapi } = useMtg();
  const [preset, setPreset] = useState('year');
  const [from, setFrom] = useState(() => presetRange('year')[0]);
  const [to, setTo] = useState(() => presetRange('year')[1]);
  const [type, setType] = useState('');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [urgency, setUrgency] = useState('');
  const [services, setServices] = useState({});

  const branches = useLoad(() => oapi('GET', '/branches').catch(() => ({ branches: [] })), []);
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  if (type) q.set('type', type);
  if (branchId) q.set('branchId', branchId);
  if (departmentId) q.set('departmentId', departmentId);
  if (urgency) q.set('urgency', urgency);
  const st = useLoad(() => oapi('GET', '/meetings/stats?' + q.toString()), [from, to, type, branchId, departmentId, urgency]);
  const d = st.data;

  const siteOpts = useMemo(() => {
    const map = new Map(((branches.data && branches.data.branches) || []).map((b) => [String(b.id), b.name]));
    if (d) for (const s of d.bySite) if (!map.has(String(s.id))) map.set(String(s.id), s.name);
    return [...map.entries()];
  }, [branches.data, d]);
  useEffect(() => {
    if (!d || !d.byService.length) return;
    setServices((cur) => { const n = { ...cur }; let ch = false; for (const s of d.byService) if (n[s.id] !== s.name) { n[s.id] = s.name; ch = true; } return ch ? n : cur; });
  }, [d]);
  const serviceOpts = Object.entries(services);

  const pick = (id) => { setPreset(id); const [a, b] = presetRange(id); setFrom(a); setTo(b); };
  const urgLabel = { normal: t('Normale'), urgent: t('Urgente'), critical: t('Critique') };
  const resLabel = { adopted: t('Adoptées'), rejected: t('Rejetées'), postponed: t('Reportées'), no_quorum: t('Sans quorum'), pending: t('En attente') };
  const resColor = { adopted: 'var(--ok)', rejected: 'var(--danger)', postponed: 'var(--warn)', no_quorum: 'var(--c8)', pending: 'var(--c5)' };

  const filters = (
    <Card title={t('Période et filtres')}>
      <div className="mtg-adv-filters">
        <Segmented label={t('Période')} value={preset} onChange={pick} items={[{ id: 'month', label: t('Ce mois') }, { id: 'quarter', label: t('Ce trimestre') }, { id: 'year', label: t('Cette année') }, { id: '12m', label: t('12 derniers mois') }]} />
        <div className="mtg-grid2">
          <Field label={t('Du')}>{(p) => <input {...p} type="date" value={from} max={to || undefined} onChange={(e) => { setPreset('custom'); setFrom(e.target.value); }} />}</Field>
          <Field label={t('Au')}>{(p) => <input {...p} type="date" value={to} min={from || undefined} onChange={(e) => { setPreset('custom'); setTo(e.target.value); }} />}</Field>
        </div>
        <div className="mtg-grid2">
          <Field label={t('Type de réunion')}>{(p) => <select {...p} value={type} onChange={(e) => setType(e.target.value)}><option value="">{t('Tous les types')}</option>{TYPE_IDS.map((x) => <option key={x} value={x}>{L.types[x]}</option>)}</select>}</Field>
          <Field label={t('Site')}>{(p) => <select {...p} value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">{t('Tous les sites')}</option>{siteOpts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}</Field>
          <Field label={t('Service')}>{(p) => <select {...p} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">{t('Tous les services')}</option>{serviceOpts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}</Field>
          <Field label={t("Niveau d'urgence")}>{(p) => <select {...p} value={urgency} onChange={(e) => setUrgency(e.target.value)}><option value="">{t('Tous les niveaux')}</option>{URGENCIES.map((x) => <option key={x} value={x}>{urgLabel[x]}</option>)}</select>}</Field>
        </div>
      </div>
    </Card>
  );

  if (st.error) return <div className="mtg">{filters}<Failed e={st.error} /></div>;
  if (!d) return <div className="mtg">{filters}<Skeleton lines={8} /></div>;

  const locale = getLocale();
  const monthLabel = (m) => parseDay(m + '-01').toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  const R = d.resolutions;
  const resData = ['adopted', 'rejected', 'postponed', 'no_quorum', 'pending'].filter((k) => R[k] > 0).map((k) => ({ name: resLabel[k], value: R[k], color: resColor[k] }));
  const typeData = d.byType.map((x) => ({ name: L.types[x.type] || x.type, value: x.count }));
  const serviceData = d.byService.map((x) => ({ name: x.name, value: x.count }));
  const siteData = d.bySite.map((x) => ({ name: x.name, value: x.count }));
  const urgData = d.byUrgency.map((x) => ({ name: urgLabel[x.urgency] || x.urgency, value: x.count, color: x.urgency === 'critical' ? 'var(--danger)' : x.urgency === 'urgent' ? 'var(--warn)' : 'var(--c2)' }));
  const tk = d.tasks;
  const taskData = [
    { name: t('Faites à temps'), value: Math.max(0, tk.done - tk.doneLate), color: 'var(--ok)' },
    { name: t('Faites en retard'), value: tk.doneLate, color: 'var(--c3)' },
    { name: t('Ouvertes'), value: Math.max(0, tk.open - tk.late), color: 'var(--c5)' },
    { name: t('En retard'), value: tk.late, color: 'var(--danger)' },
  ];
  const trend = d.trend.map((x) => ({ x: monthLabel(x.month), [t('Réunions')]: x.meetings, [t('Présence (%)')]: x.attendance, [t('Taux de décision (%)')]: x.decisionRate }));
  const trendTxt = d.trend.map((x) => t('{month} : {n} réunion(s), présence {a}, décisions {r}', { month: x.month, n: x.meetings, a: pctTxt(x.attendance), r: pctTxt(x.decisionRate) })).join(' ; ');
  const noData = d.meetings.total === 0;
  const list = (rows) => rows.map((r) => `${r.name} : ${r.value}`).join(', ');

  return (
    <div className="mtg">
      {filters}
      {noData ? <EmptyState icon="chart-pie" title={t('Aucune réunion sur cette période')}>{t('Élargissez la période ou changez de filtre pour voir les statistiques.')}</EmptyState> : null}

      <div className="mtg-stats">
        <Stat icon="calendar-check" label={t('Réunions')} value={d.meetings.total} sub={t('{n} tenue(s), {m} prévue(s), {c} annulée(s)', { n: d.meetings.held, m: d.meetings.planned, c: d.meetings.cancelled })} />
        <Stat icon="gavel" tone="brand" label={t('Taux de décision')} value={pctTxt(R.decisionRate)} sub={t('{n} résolution(s) adoptée(s)', { n: R.adopted })} />
        <Stat icon="user-group" tone="ok" label={t('Taux de présence')} value={pctTxt(d.attendance.rate)} sub={t('{n} présent(s), {m} absent(s)', { n: d.attendance.present, m: d.attendance.absent })} />
        <Stat icon="clock" tone={d.attendance.lateCount ? 'warn' : 'ok'} label={t('Ponctualité')} value={pctTxt(d.attendance.punctualityRate)} sub={d.attendance.lateCount ? t('{n} retard(s), {m} min en moyenne', { n: d.attendance.lateCount, m: d.attendance.avgLateMin }) : t('Aucun retard relevé')} />
        <Stat icon="hourglass-half" label={t('Durée moyenne réelle')} value={minTxt(d.duration.avgRealMin)} sub={t('prévue : {d}', { d: minTxt(d.duration.avgPlannedMin) })} />
        <Stat icon="list-check" tone={tk.late ? 'danger' : 'ok'} label={t('Tâches issues des réunions')} value={`${tk.done} / ${tk.total}`} sub={t('{n} en retard', { n: tk.late })} />
      </div>

      <div className="mtg-grid2">
        <Card>
          <ChartFrame title={t('Résolutions')} summary={resData.length ? t('Résolutions : {list}. Taux de décision : {r}.', { list: list(resData), r: pctTxt(R.decisionRate) }) : t('Aucune résolution sur la période.')} height={240}
            legend={resData.map((x) => ({ label: `${x.name} (${x.value})`, color: x.color }))}>
            {resData.length ? <Donut data={resData} center={pctTxt(R.decisionRate)} sub={t('taux de décision')} /> : <EmptyState icon="gavel" title={t('Aucune résolution')} />}
          </ChartFrame>
        </Card>
        <Card>
          <ChartFrame title={t('Réunions par type')} summary={typeData.length ? list(typeData) : t('Aucune réunion sur la période.')} height={240}
            legend={typeData.map((x, i) => ({ label: `${x.name} (${x.value})`, color: SERIES[i % SERIES.length] }))}>
            {typeData.length ? <Donut data={typeData} center={typeData.reduce((n, x) => n + x.value, 0)} sub={t('réunions')} /> : <EmptyState icon="chart-pie" title={t('Aucune réunion')} />}
          </ChartFrame>
        </Card>
      </div>

      <div className="mtg-grid2">
        <Card>
          <ChartFrame title={t('Par service')} summary={serviceData.length ? list(serviceData) : t('Aucune réunion rattachée à un service.')} height={Math.max(180, 56 + serviceData.length * 34)}>
            {serviceData.length ? <HBars data={serviceData} valueLabel={t('Réunions')} /> : <EmptyState icon="building" title={t('Aucune réunion rattachée à un service')} />}
          </ChartFrame>
        </Card>
        <Card>
          <ChartFrame title={t('Par site')} summary={siteData.length ? list(siteData) : t('Aucune réunion rattachée à un site.')} height={Math.max(180, 56 + siteData.length * 34)}>
            {siteData.length ? <HBars data={siteData} valueLabel={t('Réunions')} /> : <EmptyState icon="location-dot" title={t('Aucune réunion rattachée à un site')} />}
          </ChartFrame>
        </Card>
      </div>

      <div className="mtg-grid2">
        <Card>
          <ChartFrame title={t("Par niveau d'urgence")} summary={urgData.length ? list(urgData) : t('Aucune réunion sur la période.')} height={Math.max(160, 56 + urgData.length * 34)}>
            {urgData.length ? <HBars data={urgData} valueLabel={t('Réunions')} /> : <EmptyState icon="bolt" title={t('Aucune réunion')} />}
          </ChartFrame>
        </Card>
        <Card>
          <ChartFrame title={t('Tâches issues des réunions')} summary={t('Tâches : {list}.', { list: list(taskData) })} height={220}>
            {tk.total ? <HBars data={taskData} valueLabel={t('Tâches')} /> : <EmptyState icon="list-check" title={t('Aucune tâche issue des réunions')} />}
          </ChartFrame>
        </Card>
      </div>

      <div className="mtg-grid2">
        <Card>
          <ChartFrame title={t('Réunions par mois')} summary={trend.length ? trendTxt : t('Aucune donnée mensuelle.')} height={240}>
            {trend.length ? <Bars data={trend} xKey="x" series={[{ key: t('Réunions'), label: t('Réunions'), color: SERIES[0] }]} /> : <EmptyState icon="chart-line" title={t('Aucune donnée mensuelle')} />}
          </ChartFrame>
        </Card>
        <Card>
          <ChartFrame title={t('Présence et décisions par mois')} summary={trend.length ? trendTxt : t('Aucune donnée mensuelle.')} height={240}
            legend={[{ label: t('Présence (%)'), color: SERIES[1] }, { label: t('Taux de décision (%)'), color: SERIES[2] }]}>
            {trend.length ? <Combo data={trend} xKey="x" fmt={(v) => v + ' %'} series={[
              { key: t('Présence (%)'), label: t('Présence (%)'), type: 'line', color: SERIES[1], dots: true },
              { key: t('Taux de décision (%)'), label: t('Taux de décision (%)'), type: 'line', color: SERIES[2], dots: true }]} /> : <EmptyState icon="chart-line" title={t('Aucune donnée mensuelle')} />}
          </ChartFrame>
        </Card>
      </div>
    </div>
  );
}
