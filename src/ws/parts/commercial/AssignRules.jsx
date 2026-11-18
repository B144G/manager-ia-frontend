import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Card, Field, Loading, Table, useLoad } from '../../ui.jsx';
import { Failed, MapSelect, ZoneSelect, num, useCp, useForm, useL } from './common.jsx';

/* Règles d'attribution des prospects : la première règle active qui correspond (par priorité) choisit le commercial, le moins chargé ou à tour de rôle. */

function RuleForm({ pre, close, onSaved }) {
  const t = useT();
  const L = useL();
  const { api, members } = useCp();
  const f = useForm({ name: pre ? pre.name : '', priority: pre ? String(pre.priority) : '100', zoneId: pre && pre.zoneId ? String(pre.zoneId) : '', product: pre ? pre.product : '', source: pre ? pre.source : '', minScore: pre ? String(pre.minScore) : '0', strategy: pre ? pre.strategy : 'load', active: pre ? pre.active : true });
  const sales = members.filter((m) => m.crole);
  const [sel, setSel] = useStateSet(pre ? pre.assignees : []);
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.name.trim()) throw new Error(t('Nommez la règle.'));
      const body = { name: f.v.name, priority: num(f.v.priority), zoneId: f.v.zoneId || null, product: f.v.product, source: f.v.source, minScore: num(f.v.minScore), strategy: f.v.strategy, active: f.v.active, assignees: [...sel] };
      if (pre) await api('PUT', '/assign-rules/' + pre.id, body); else await api('POST', '/assign-rules', body);
      close(); onSaved();
    }); }}>
      <div className="cp-grid">
        <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={80} value={f.v.name} onChange={f.set('name')} />}</Field>
        <Field label={t('Priorité')} hint={t('Le plus petit nombre passe en premier.')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.priority} onChange={f.set('priority')} />}</Field>
        <Field label={t('Zone')}>{(p) => <ZoneSelect {...p} value={f.v.zoneId} onChange={f.set('zoneId')} none={t('Toutes')} />}</Field>
        <Field label={t('Produit contient')}>{(p) => <input {...p} type="text" maxLength={80} value={f.v.product} onChange={f.set('product')} />}</Field>
        <Field label={t('Source')}>{(p) => <MapSelect {...p} map={L.source} value={f.v.source} onChange={f.set('source')} none={t('Toutes')} />}</Field>
        <Field label={t('Score minimal')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.minScore} onChange={f.set('minScore')} />}</Field>
        <Field label={t('Répartition')}>{(p) => <MapSelect {...p} map={L.strategy} value={f.v.strategy} onChange={f.set('strategy')} />}</Field>
      </div>
      <fieldset className="cp-fs cp-pick"><legend>{t('Commerciaux concernés')}</legend>
        <p className="small muted">{t('Aucun choix : les commerciaux de la zone, sinon toute l’équipe commerciale.')}</p>
        {sales.map((m) => <label className="cp-check" key={m.userId}><input type="checkbox" checked={sel.has(m.userId)} onChange={() => setSel(m.userId)} /> {m.name}</label>)}
      </fieldset>
      <label className="cp-check"><input type="checkbox" checked={f.v.active} onChange={f.set('active')} /> {t('Règle active')}</label>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

/** Ensemble de nombres modifiable : [set, toggle]. */
function useStateSet(initial) {
  const [s, setS] = useState(() => new Set(initial));
  return [s, (v) => setS((cur) => { const n = new Set(cur); if (n.has(v)) n.delete(v); else n.add(v); return n; })];
}

export default function AssignRules() {
  const t = useT();
  const L = useL();
  const { api, fail, zones, members, memberName } = useCp();
  const { modal, confirm, toast } = useWs();
  const st = useLoad(() => api('GET', '/assign-rules'), []);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const zoneName = (id) => (zones.find((z) => z.id === id) || {}).name || '';
  const form = (pre) => modal(pre ? t('Modifier la règle') : t('Nouvelle règle'), (close) => <RuleForm pre={pre} close={close} onSaved={st.reload} />, { wide: true });
  const cols = [
    { key: 'priority', label: t('Priorité'), align: 'r' },
    { key: 'name', label: t('Règle'), render: (r) => <><b>{r.name}</b> {r.active ? null : <Badge>{t('Inactive')}</Badge>}</> },
    { key: 'when', label: t('Si'), render: (r) => [r.zoneId && zoneName(r.zoneId), r.product && t('produit « {p} »', { p: r.product }), r.source && L.source[r.source], r.minScore && t('score ≥ {n}', { n: r.minScore })].filter(Boolean).join(' · ') || t('Toujours') },
    { key: 'who', label: t('Alors'), render: (r) => (r.assignees.length ? r.assignees.map(memberName).join(', ') : t('Équipe commerciale')) + ' — ' + L.strategy[r.strategy] },
    { key: 'act', label: t('Actions'), render: (r) => (
      <span className="row"><Button size="sm" onClick={() => form(r)}>{t('Modifier')}</Button>
        <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer {nom}', { nom: r.name })} onClick={() => confirm(t('Supprimer cette règle ?'), () => api('DELETE', '/assign-rules/' + r.id).then(st.reload, fail))} /></span>) },
  ];
  const load = new Map(st.data.load.map((l) => [l.userId, l.open]));
  const team = members.filter((m) => m.crole);
  return (
    <div className="cp-stack">
      <Card title={t("Règles d'attribution")} subtitle={t("Sans règle qui correspond, le prospect va au commercial le moins chargé (de sa zone si possible).")}
        actions={<><Button onClick={() => api('POST', '/leads/rescore', {}).then((r) => toast(t('{n} prospect(s) recalculé(s).', { n: r.count })), fail)}>{t('Recalculer les scores')}</Button><Button variant="primary" icon="plus" onClick={() => form(null)}>{t('Nouvelle règle')}</Button></>}>
        <Table caption={t("Règles d'attribution")} columns={cols} rows={st.data.rules} empty={t("Aucune règle : l'attribution se fait selon la charge.")} />
      </Card>
      <Card title={t('Charge actuelle')} subtitle={t('Prospects et opportunités ouverts par commercial.')}>
        {team.length ? team.map((m) => <div className="line" key={m.userId}><span>{m.name} <span className="muted small">· {L.cRole[m.crole]}</span></span><b>{load.get(m.userId) || 0}</b></div>) : <p className="muted">{t("Aucun commercial désigné pour l'instant.")}</p>}
      </Card>
    </div>
  );
}
