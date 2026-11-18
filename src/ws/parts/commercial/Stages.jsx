import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Card, Field, Loading, Table, useLoad } from '../../ui.jsx';
import { Failed, MapSelect, num, useCp, useForm, useL } from './common.jsx';

/* Étapes du pipeline (nom, probabilité, type, score BANT minimal, jours avant stagnation) et motifs de gain et de perte. Réservé à qui définit les règles. */

function StageForm({ pre, close, onSaved }) {
  const t = useT();
  const L = useL();
  const { api } = useCp();
  const f = useForm({ name: pre ? pre.name : '', kind: pre ? pre.kind : 'open', probability: pre ? String(pre.probability) : '20', minBant: pre ? String(pre.minBant) : '0', stagnantDays: pre ? String(pre.stagnantDays) : '14' });
  const open = f.v.kind === 'open';
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.name.trim()) throw new Error(t("Nommez l'étape."));
      const body = { name: f.v.name, kind: f.v.kind, probability: num(f.v.probability), minBant: num(f.v.minBant), stagnantDays: num(f.v.stagnantDays) };
      if (pre) await api('PUT', '/pipeline/stages/' + pre.id, body); else await api('POST', '/pipeline/stages', body);
      close(); onSaved();
    }); }}>
      <div className="cp-grid">
        <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={60} value={f.v.name} onChange={f.set('name')} />}</Field>
        <Field label={t("Type d'étape")}>{(p) => <MapSelect {...p} map={L.stageKind} value={f.v.kind} onChange={f.set('kind')} />}</Field>
        {open ? <>
          <Field label={t('Probabilité (%)')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.probability} onChange={f.set('probability')} />}</Field>
          <Field label={t('Score BANT minimal')} hint={t("Pour entrer dans l'étape (0 = aucune exigence).")}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.minBant} onChange={f.set('minBant')} />}</Field>
          <Field label={t('Jours avant stagnation')} hint={t('0 = jamais')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.stagnantDays} onChange={f.set('stagnantDays')} />}</Field>
        </> : null}
      </div>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function ReasonForm({ close, onSaved }) {
  const t = useT();
  const { api } = useCp();
  const f = useForm({ kind: 'loss', label: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.label.trim()) throw new Error(t('Écrivez le motif.'));
      await api('POST', '/pipeline/reasons', f.v); close(); onSaved();
    }); }}>
      <Field label={t('Type de motif')}>{(p) => <select {...p} value={f.v.kind} onChange={f.set('kind')}><option value="loss">{t('Perte')}</option><option value="win">{t('Gain')}</option></select>}</Field>
      <Field label={t('Motif')} required>{(p) => <input {...p} type="text" maxLength={80} value={f.v.label} onChange={f.set('label')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Ajouter')}</Button></div>
    </form>
  );
}

export default function Stages() {
  const t = useT();
  const L = useL();
  const { api, fail, bump } = useCp();
  const { modal, confirm } = useWs();
  const st = useLoad(() => api('GET', '/pipeline/stages'), []);
  const rs = useLoad(() => api('GET', '/pipeline/reasons'), []);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data || !rs.data) return <Loading />;
  const stages = st.data.stages;
  const done = () => { st.reload(); bump(); };
  const swap = (i, d) => {
    const ids = stages.map((s) => s.id); const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    api('PUT', '/pipeline/stages-order', { ids }).then(done, fail);
  };
  const form = (pre) => modal(pre ? t("Modifier l'étape") : t('Nouvelle étape'), (close) => <StageForm pre={pre} close={close} onSaved={done} />);
  const cols = [
    { key: 'name', label: t('Étape'), render: (s) => <b>{s.name}</b> },
    { key: 'kind', label: t('Type'), render: (s) => <Badge tone={s.kind === 'won' ? 'ok' : s.kind === 'lost' ? 'danger' : 'brand'}>{L.stageKind[s.kind]}</Badge> },
    { key: 'probability', label: t('Probabilité'), align: 'r', render: (s) => s.probability + ' %' },
    { key: 'minBant', label: t('BANT minimal'), align: 'r', render: (s) => (s.kind === 'open' ? s.minBant : '—') },
    { key: 'stagnantDays', label: t('Stagnation (jours)'), align: 'r', render: (s) => (s.kind === 'open' && s.stagnantDays ? s.stagnantDays : '—') },
    { key: 'act', label: t('Actions'), render: (s) => {
      const i = stages.indexOf(s);
      return (
        <span className="row">
          <Button size="sm" variant="ghost" iconOnly icon="up" label={t('Monter {nom}', { nom: s.name })} disabled={i === 0} onClick={() => swap(i, -1)} />
          <Button size="sm" variant="ghost" iconOnly icon="down" label={t('Descendre {nom}', { nom: s.name })} disabled={i === stages.length - 1} onClick={() => swap(i, 1)} />
          <Button size="sm" onClick={() => form(s)}>{t('Modifier')}</Button>
          <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer {nom}', { nom: s.name })} onClick={() => confirm(t('Supprimer cette étape ?'), () => api('DELETE', '/pipeline/stages/' + s.id).then(done, fail))} />
        </span>
      );
    } },
  ];
  const reasonList = (kind, title) => (
    <Card title={title}>
      {rs.data.reasons.filter((r) => r.kind === kind).map((r) => (
        <div className="line" key={r.id}><span>{r.label}</span><Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer {nom}', { nom: r.label })} onClick={() => api('DELETE', '/pipeline/reasons/' + r.id).then(rs.reload, fail)} /></div>
      ))}
    </Card>
  );
  return (
    <div className="cp-stack">
      <Card title={t('Étapes du pipeline')} subtitle={t("L'ordre des lignes est l'ordre des colonnes du Kanban.")} actions={<Button variant="primary" icon="plus" onClick={() => form(null)}>{t('Nouvelle étape')}</Button>}>
        <Table caption={t('Étapes du pipeline')} columns={cols} rows={stages} />
      </Card>
      <div className="cp-two">
        {reasonList('loss', t('Motifs de perte'))}
        {reasonList('win', t('Motifs de gain'))}
      </div>
      <div className="row"><Button icon="plus" onClick={() => modal(t('Nouveau motif'), (close) => <ReasonForm close={close} onSaved={rs.reload} />)}>{t('Nouveau motif')}</Button></div>
    </div>
  );
}
