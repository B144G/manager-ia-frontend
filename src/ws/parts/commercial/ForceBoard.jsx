import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Bars } from '../../charts/lazy.jsx';
import { Badge, Button, Card, ChartFrame, Field, Loading, Stat, Table, useLoad } from '../../ui.jsx';
import { Failed, Meter, num, pct, useCp, useForm, useL } from './common.jsx';
import { useL2 } from './labels2.jsx';

/* Force de vente : classement du mois, objectifs avec décomposition (par mois et par commercial). */

const thisMonth = () => new Date().toISOString().slice(0, 7);

export function Ranking() {
  const t = useT();
  const L = useL();
  const { api, tick } = useCp();
  const { money } = useWs();
  const [month, setMonth] = useState(thisMonth());
  const st = useLoad(() => api('GET', '/force/overview?month=' + month), [month, tick]);
  const d = st.data;
  const cols = [
    { key: 'rank', label: '#', align: 'r' }, { key: 'name', label: t('Commercial'), render: (r) => <><b>{r.name}</b> <span className="muted small">{L.cRole[r.role]}</span></> },
    { key: 'revenue', label: t("Chiffre d'affaires"), align: 'r', render: (r) => money(r.revenue) }, { key: 'target', label: t('Objectif'), align: 'r', render: (r) => (r.target ? money(r.target) : '—') },
    { key: 'attainment', label: t('Atteinte'), render: (r) => (r.attainment === null ? '—' : <span className="cp-bscore"><Meter value={Math.min(r.attainment, 100)} label={pct(r.attainment)} /><Badge tone={r.attainment >= 100 ? 'ok' : r.attainment >= 70 ? 'warn' : 'danger'}>{pct(r.attainment)}</Badge></span>) },
    { key: 'oppsWon', label: t('Affaires gagnées'), align: 'r', render: (r) => `${r.oppsWon} (${money(r.oppsWonAmount)})` }, { key: 'winRate', label: t('Taux de gain'), align: 'r', render: (r) => (r.winRate === null ? '—' : pct(r.winRate)) },
    { key: 'act', label: t('Activités'), align: 'r', render: (r) => r.activities.total }, { key: 'pipe', label: t('Pipeline pondéré'), align: 'r', render: (r) => money(r.pipelineWeighted) },
  ];
  return (
    <Card title={t('Classement de la force de vente')} actions={<Field label={t('Mois')}>{(p) => <input {...p} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>}>
      {st.error ? <Failed e={st.error} /> : !d ? <Loading /> : (
        <>
          <div className="ui-stats">
            <Stat label={t("Chiffre d'affaires")} value={money(d.totals.revenue)} icon="coins" /><Stat label={t('Objectif')} value={d.totals.target ? money(d.totals.target) : '—'} icon="bullseye" />
            <Stat label={t('Atteinte')} value={d.totals.attainment === null ? '—' : pct(d.totals.attainment)} icon="gauge" tone="ok" /><Stat label={t('Affaires gagnées')} value={d.totals.oppsWon} icon="handshake" /><Stat label={t('Activités')} value={d.totals.activities} icon="phone" />
          </div>
          <ChartFrame title={t('Chiffre d’affaires et objectif par commercial')} summary={d.team.map((r) => `${r.name} : ${money(r.revenue)} / ${money(r.target)}`).join(' ; ') || t('Aucune donnée')} height={240} legend={[{ label: t('Objectif'), color: 'var(--c3)' }, { label: t('Réalisé'), color: 'var(--c1)' }]}>
            <Bars data={d.team.map((r) => ({ x: r.name, target: r.target, revenue: r.revenue }))} series={[{ key: 'target', label: t('Objectif'), color: 'var(--c3)' }, { key: 'revenue', label: t('Réalisé'), color: 'var(--c1)' }]} fmt={money} height={240} /></ChartFrame>
          <Table caption={t('Classement de la force de vente')} rowKey="userId" columns={cols} rows={d.team} empty={t('Aucun commercial désigné.')} />
        </>
      )}
    </Card>
  );
}

function DecomposeForm() {
  const t = useT();
  const L2 = useL2();
  const { api, members, bump } = useCp();
  const { money, toast } = useWs();
  const f = useForm({ total: '', metric: 'revenue', from: thisMonth(), months: '3' });
  const [users, setUsers] = useState(() => new Set());
  const [out, setOut] = useState(null);
  const periods = () => { const [y, m] = f.v.from.split('-').map(Number); return Array.from({ length: Math.min(12, Math.max(1, num(f.v.months))) }, (_, i) => { const x = y * 12 + (m - 1) + i; return `${Math.floor(x / 12)}-${String((x % 12) + 1).padStart(2, '0')}`; }); };
  const sales = members.filter((m) => m.crole && m.crole !== 'sales_assistant');
  const toggle = (id) => setUsers((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Card title={t('Décomposer un objectif')} subtitle={t("Un objectif total est réparti à parts égales entre les mois, puis entre les commerciaux choisis, sans perdre un franc.")}>
      <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
        if (num(f.v.total) <= 0) throw new Error(t('Objectif total invalide.'));
        const r = await api('POST', '/targets/decompose', { total: num(f.v.total), metric: f.v.metric, periods: periods(), userIds: [...users] });
        setOut(r.rows); toast(t('Objectifs enregistrés.')); bump();
      }); }}>
        <div className="cp-grid">
          <Field label={t('Objectif total')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.total} onChange={f.set('total')} />}</Field>
          <Field label={t('Indicateur')}>{(p) => <select {...p} value={f.v.metric} onChange={f.set('metric')}>{Object.entries(L2.metric).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Field>
          <Field label={t('Premier mois')}>{(p) => <input {...p} type="month" value={f.v.from} onChange={f.set('from')} />}</Field>
          <Field label={t('Nombre de mois')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.months} onChange={f.set('months')} />}</Field>
        </div>
        <fieldset className="cp-fs cp-pick"><legend>{t('Répartir entre')}</legend>
          {sales.map((m) => <label className="cp-check" key={m.userId}><input type="checkbox" checked={users.has(m.userId)} onChange={() => toggle(m.userId)} /> {m.name}</label>)}
          {!sales.length ? <p className="muted small">{t("Aucun commercial désigné.")}</p> : null}
        </fieldset>
        <p className="ws-err" role="alert">{f.err}</p>
        <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Décomposer et enregistrer')}</Button></div>
      </form>
      {out ? <Table caption={t('Objectifs créés')} rowKey="k" columns={[{ key: 'period', label: t('Mois') }, { key: 'who', label: t('Pour'), render: (r) => (r.userId ? (members.find((m) => m.userId === r.userId) || {}).name : t("Toute l'organisation")) }, { key: 'value', label: t('Objectif'), align: 'r', render: (r) => (f.v.metric === 'revenue' || f.v.metric === 'margin' ? money(r.value) : r.value) }]} rows={out.map((r, i) => ({ ...r, k: i }))} /> : null}
    </Card>
  );
}
export function Objectives() { return <DecomposeForm />; }
