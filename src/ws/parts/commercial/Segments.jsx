import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Combo, Donut, HBars, SERIES } from '../../charts/lazy.jsx';
import { Badge, Button, Card, ChartFrame, EmptyState, Field, Loading, Stat, Table, useLoad } from '../../ui.jsx';
import { Failed, isoOf, pct, qs, useCp, useForm, useL } from './common.jsx';

/* Segmentation de la clientèle : RFM (récence, fréquence, montant), ABC (Pareto), secteur, ville, potentiel, et segments personnalisés. */

function MembersTable({ rows }) {
  const t = useT();
  const L = useL();
  const { openAccount } = useCp();
  const { money, dateFr } = useWs();
  return <Table caption={t('Membres du segment')} columns={[
    { key: 'name', label: t('Compte'), render: (m) => <button type="button" className="cp-link" onClick={() => openAccount(m.id)}><b>{m.name}</b></button> },
    { key: 'segment', label: t('Segment'), render: (m) => (m.segment ? L.rfm[m.segment] : '—') }, { key: 'abc', label: t('Classe'), render: (m) => m.abc || '—' },
    { key: 'orders', label: t('Commandes'), align: 'r' }, { key: 'revenue', label: t("Chiffre d'affaires"), align: 'r', render: (m) => money(m.revenue) },
    { key: 'lastPurchase', label: t('Dernier achat'), render: (m) => (m.lastPurchase ? dateFr(m.lastPurchase) : '—') },
  ]} rows={rows} empty={t('Aucun compte dans ce segment.')} />;
}

function MembersView({ path }) {
  const t = useT();
  const { api } = useCp();
  const { money } = useWs();
  const st = useLoad(() => api('GET', path), [path]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  return <div><p className="small muted">{t('{n} compte(s) · {m}', { n: st.data.count || st.data.members.length, m: money(st.data.revenue !== undefined ? st.data.revenue : st.data.segment.revenue) })}</p><MembersTable rows={st.data.members} /></div>;
}

function TasksForm({ body, defaultTitle, close }) {
  const t = useT();
  const { api } = useCp();
  const { toast } = useWs();
  const f = useForm({ title: defaultTitle, dueAt: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.title.trim()) throw new Error(t('Indiquez la tâche à créer.'));
      const r = await api('POST', '/segments/tasks', { ...body, title: f.v.title, dueAt: isoOf(f.v.dueAt) || undefined });
      toast(t('{n} tâche(s) créée(s).', { n: r.created }) + (r.skipped ? ' ' + t('{n} compte(s) non traités (limite de 50).', { n: r.skipped }) : '')); close();
    }); }}>
      <p>{t('Une tâche est créée pour chaque compte du segment (50 au plus), au nom du commercial qui le suit.')}</p>
      <Field label={t('Tâche')} required>{(p) => <input {...p} type="text" maxLength={160} value={f.v.title} onChange={f.set('title')} />}</Field>
      <Field label={t('Échéance')} hint={t('Par défaut : dans 3 jours.')}>{(p) => <input {...p} type="datetime-local" value={f.v.dueAt} onChange={f.set('dueAt')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Créer les tâches')}</Button></div>
    </form>
  );
}

export default function Segments() {
  const t = useT();
  const L = useL();
  const { api, has, tick, openAccount } = useCp();
  const { money, modal } = useWs();
  const st = useLoad(() => api('GET', '/segments/overview'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const d = st.data;
  const members = (title, type, key) => modal(title, () => <MembersView path={'/segments/members' + qs({ type, key })} />, { wide: true });
  const none = t('Non renseigné');
  const group = (title, list, type) => (
    <Card><ChartFrame title={title} summary={list.slice(0, 8).map((g) => `${g.key || none} : ${money(g.revenue)}`).join(' ; ')} height={Math.max(160, Math.min(8, list.length) * 34)}>
      <HBars data={list.slice(0, 8).map((g) => ({ name: g.key || none, value: g.revenue }))} fmt={money} valueLabel={t("Chiffre d'affaires")} height={Math.max(160, Math.min(8, list.length) * 34)} /></ChartFrame>
      <div className="cp-chips">{list.slice(0, 8).map((g) => <button type="button" key={g.key} className="cp-chip" onClick={() => members(g.key || none, type, g.key)}>{g.key || none} <b>{g.count}</b></button>)}</div>
    </Card>
  );
  const max = Math.max(1, ...d.matrix.flat().map((c) => c.count));
  const donut = d.rfm.filter((s) => s.revenue > 0).map((s) => ({ name: L.rfm[s.key], value: s.revenue, color: SERIES[d.rfm.indexOf(s)] }));
  const segCols = [
    { key: 'key', label: t('Segment'), render: (s) => <button type="button" className="cp-link" onClick={() => members(L.rfm[s.key], 'rfm', s.key)}><b>{L.rfm[s.key]}</b></button> },
    { key: 'count', label: t('Clients'), align: 'r' }, { key: 'revenue', label: t("Chiffre d'affaires"), align: 'r', render: (s) => money(s.revenue) },
    { key: 'share', label: t('Part'), align: 'r', render: (s) => pct(s.share) }, { key: 'avgRecencyDays', label: t('Récence moyenne'), align: 'r', render: (s) => t('{n} j', { n: s.avgRecencyDays }) },
    { key: 'actions', label: t('Actions suggérées'), render: (s) => <span className="cp-tags">{s.actions.map((a) => <Badge key={a} tone="info">{L.action[a] || a}</Badge>)}</span> },
    { key: 'task', label: '', render: (s) => (has('write') && s.count ? <Button size="sm" onClick={() => modal(t('Créer les tâches'), (close) => <TasksForm body={{ rfm: s.key }} defaultTitle={L.action[s.actions[0]] || ''} close={close} />)}>{t('Créer les tâches')}</Button> : null) },
  ];
  return (
    <div className="cp-stack">
      <Card title={t('Segmentation de la clientèle')} subtitle={t('Achats facturés des {n} derniers mois, nets des avoirs.', { n: d.windowMonths })}>
        <div className="ui-stats">
          <Stat label={t('Comptes')} value={d.customers} icon="address-book" />
          <Stat label={t('Clients acheteurs')} value={d.buyers} icon="users" />
          <Stat label={t('Sans achat')} value={d.nonBuyers} icon="user" onClick={d.nonBuyers ? () => members(t('Sans achat'), 'nonbuyers', '') : undefined} />
          <Stat label={t("Chiffre d'affaires")} value={money(d.revenue)} icon="coins" tone="ok" />
        </div>
      </Card>
      {!d.buyers ? <EmptyState icon="chart-pie" title={t('Pas encore de ventes facturées à analyser.')} /> : (
        <>
          <div className="cp-two">
            <Card><ChartFrame title={t("Chiffre d'affaires par segment")} summary={donut.map((x) => `${x.name} : ${money(x.value)}`).join(' ; ')} height={260}><Donut data={donut} fmt={money} center={money(d.revenue)} sub={t('au total')} /></ChartFrame></Card>
            <Card title={t('Matrice récence × fréquence')} subtitle={t('Nombre de clients par case (5 = le meilleur).')}>
              <div className="cp-matrix" role="table" aria-label={t('Matrice récence × fréquence')}>
                {d.matrix.map((row, i) => (
                  <div role="row" className="cp-mrow" key={i}>
                    <span className="cp-maxis" role="rowheader">{t('F{n}', { n: 5 - i })}</span>
                    {row.map((c) => <span role="cell" key={c.r} className="cp-mcell" title={t('Récence {r}, fréquence {f} : {n} client(s)', { r: c.r, f: c.f, n: c.count })} style={{ background: `color-mix(in srgb, var(--accent) ${Math.round((c.count / max) * 80)}%, var(--surface))`, color: c.count / max > 0.55 ? 'var(--on-accent)' : 'var(--text)' }}>{c.count}</span>)}
                  </div>
                ))}
                <div role="row" className="cp-mrow"><span className="cp-maxis" />{[1, 2, 3, 4, 5].map((r) => <span key={r} role="columnheader" className="cp-maxis">{t('R{n}', { n: r })}</span>)}</div>
              </div>
            </Card>
          </div>
          <Card title={t('Segments RFM')} subtitle={t('Cliquez sur un segment pour voir ses comptes. Les actions suggérées peuvent devenir des tâches.')}>
            <Table caption={t('Segments RFM')} rowKey="key" columns={segCols} rows={d.rfm} />
          </Card>
          <div className="cp-two">
            <Card><ChartFrame title={t('Courbe de Pareto (ABC)')} summary={d.abc.map((a) => `${a.class} : ${a.count} ${t('clients')}, ${pct(a.share)}`).join(' ; ')} height={240}
              legend={[{ label: t('Part cumulée du chiffre d’affaires (%)'), color: 'var(--c1)' }]}>
              <Combo data={d.curve.map((c) => ({ x: c.rank, cum: c.cumShare }))} series={[{ key: 'cum', label: t('Part cumulée (%)'), type: 'area' }]} fmt={(v) => v + ' %'} height={240} refs={[{ y: 80, label: '80 %' }, { y: 95, label: '95 %' }]} /></ChartFrame></Card>
            <Card title={t('Classes ABC')}>
              <Table caption={t('Classes ABC')} rowKey="class" columns={[
                { key: 'class', label: t('Classe'), render: (a) => <Badge tone={a.class === 'A' ? 'ok' : a.class === 'B' ? 'info' : 'neutral'}>{a.class}</Badge> },
                { key: 'count', label: t('Clients'), align: 'r' }, { key: 'customersShare', label: t('Part des clients'), align: 'r', render: (a) => pct(a.customersShare) },
                { key: 'revenue', label: t("Chiffre d'affaires"), align: 'r', render: (a) => money(a.revenue) }, { key: 'share', label: t('Part du CA'), align: 'r', render: (a) => pct(a.share) },
                { key: 'm', label: '', render: (a) => (a.count ? <Button size="sm" onClick={() => members(t('Classe {c}', { c: a.class }), 'abc', a.class)}>{t('Voir')}</Button> : null) },
              ]} rows={d.abc} />
            </Card>
          </div>
          <div className="cp-two">
            {group(t('Par secteur'), d.sector, 'sector')}
            {group(t('Par ville'), d.city, 'city')}
          </div>
          {group(t('Par potentiel'), d.potential.map((g) => ({ ...g, key: g.key })), 'potential')}
          <Card title={t('Dix premiers clients')}>
            <Table caption={t('Dix premiers clients')} columns={[
              { key: 'name', label: t('Compte'), render: (m) => <button type="button" className="cp-link" onClick={() => openAccount(m.id)}><b>{m.name}</b></button> },
              { key: 'segment', label: t('Segment'), render: (m) => L.rfm[m.segment] }, { key: 'orders', label: t('Commandes'), align: 'r' }, { key: 'revenue', label: t("Chiffre d'affaires"), align: 'r', render: (m) => money(m.revenue) },
            ]} rows={d.top} />
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------- Segments personnalisés ---------- */
const NUMERIC = ['revenue', 'orders', 'recencyDays', 'avgBasket', 'r', 'f', 'm', 'ownerId'];
function SegmentForm({ pre, fields, ops, close, onSaved }) {
  const t = useT();
  const L = useL();
  const { api } = useCp();
  const f = useForm({ name: pre ? pre.name : '' });
  const [rules, setRules] = useState(pre ? pre.rules.map((r) => ({ ...r, value: Array.isArray(r.value) ? r.value.join(', ') : String(r.value) })) : [{ field: 'revenue', op: 'gte', value: '' }]);
  const set = (i, patch) => setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.name.trim()) throw new Error(t('Nommez le segment.'));
      if (rules.some((r) => String(r.value).trim() === '')) throw new Error(t('Chaque règle a une valeur.'));
      const body = { name: f.v.name, rules: rules.map((r) => ({ field: r.field, op: r.op, value: NUMERIC.includes(r.field) && !['in', 'contains'].includes(r.op) ? Number(String(r.value).replace(',', '.')) || 0 : r.op === 'in' ? String(r.value).split(',').map((x) => x.trim()).filter(Boolean) : String(r.value) })) };
      if (pre) await api('PUT', '/segments/custom/' + pre.id, body); else await api('POST', '/segments/custom', body);
      close(); onSaved();
    }); }}>
      <Field label={t('Nom du segment')} required>{(p) => <input {...p} type="text" maxLength={80} value={f.v.name} onChange={f.set('name')} />}</Field>
      <p className="small muted">{t('Un compte fait partie du segment si toutes les règles sont vraies.')}</p>
      {rules.map((r, i) => (
        <div className="cp-rule" key={i}>
          <Field label={t('Champ')}>{(p) => <select {...p} value={r.field} onChange={(e) => set(i, { field: e.target.value })}>{fields.map((x) => <option key={x} value={x}>{L.ruleField[x] || x}</option>)}</select>}</Field>
          <Field label={t('Condition')}>{(p) => <select {...p} value={r.op} onChange={(e) => set(i, { op: e.target.value })}>{ops.map((x) => <option key={x} value={x}>{L.ruleOp[x] || x}</option>)}</select>}</Field>
          <Field label={t('Valeur')}>{(p) => <input {...p} type="text" maxLength={120} value={r.value} onChange={(e) => set(i, { value: e.target.value })} />}</Field>
          {rules.length > 1 ? <Button size="sm" variant="ghost" onClick={() => setRules(rules.filter((_, k) => k !== i))}>{t('Retirer')}</Button> : null}
        </div>
      ))}
      {rules.length < 8 ? <Button size="sm" icon="plus" onClick={() => setRules([...rules, { field: 'city', op: 'eq', value: '' }])}>{t('Ajouter une règle')}</Button> : null}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

export function CustomSegments() {
  const t = useT();
  const { api, fail, has, tick } = useCp();
  const { money, modal, confirm } = useWs();
  const st = useLoad(() => api('GET', '/segments/custom'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const form = (pre) => modal(pre ? t('Modifier le segment') : t('Nouveau segment'), (close) => <SegmentForm pre={pre} fields={st.data.fields} ops={st.data.ops} close={close} onSaved={st.reload} />, { wide: true });
  return (
    <Card title={t('Segments personnalisés')} subtitle={t('Vos propres groupes de clients, définis par des règles.')} actions={has('write') ? <Button variant="primary" icon="plus" onClick={() => form(null)}>{t('Nouveau segment')}</Button> : null}>
      {!st.data.segments.length ? <EmptyState icon="layer-group" title={t('Aucun segment personnalisé.')} /> : st.data.segments.map((s) => (
        <div className="cp-cad" key={s.id}>
          <div className="row"><b className="grow">{s.name}</b><Badge>{t('{n} compte(s)', { n: s.count })}</Badge><Badge tone="ok">{money(s.revenue)}</Badge></div>
          <div className="row">
            <Button size="sm" onClick={() => modal(s.name, () => <MembersView path={'/segments/custom/' + s.id + '/members'} />, { wide: true })}>{t('Voir les comptes')}</Button>
            {has('write') ? <>
              <Button size="sm" onClick={() => modal(t('Créer les tâches'), (close) => <TasksForm body={{ customId: s.id }} defaultTitle={s.name} close={close} />)}>{t('Créer les tâches')}</Button>
              <Button size="sm" onClick={() => form(s)}>{t('Modifier')}</Button>
              <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer {nom}', { nom: s.name })} onClick={() => confirm(t('Supprimer ce segment ?'), () => api('DELETE', '/segments/custom/' + s.id).then(st.reload, fail))} />
            </> : null}
          </div>
        </div>
      ))}
    </Card>
  );
}
