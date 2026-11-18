import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Combo } from '../../charts/lazy.jsx';
import { Badge, Button, Card, ChartFrame, Field, Loading, Segmented, Stat, Table, useLoad } from '../../ui.jsx';
import { Failed, MapSelect, MemberSelect, fmtDT, useCp, useForm } from './common.jsx';
import { useL3 } from './labels3.jsx';

/* Satisfaction : NPS (saisie, tendance) et réclamations clients. */

function AccountSelect({ id, value, onChange }) {
  const t = useT();
  const { api } = useCp();
  const st = useLoad(() => api('GET', '/accounts?limit=500'), []);
  return <select id={id} value={value} onChange={(e) => onChange(e)}><option value="">{t('Choisir…')}</option>{st.data ? st.data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>) : null}</select>;
}

function NpsView() {
  const t = useT();
  const { api, has, tick, bump } = useCp();
  const { toast } = useWs();
  const st = useLoad(() => api('GET', '/nps'), [tick]);
  const f = useForm({ customerId: '', score: '9', comment: '' });
  const save = (e) => { e.preventDefault(); f.run(async () => {
    if (!f.v.customerId) throw new Error(t('Choisissez le client.'));
    await api('POST', '/nps', { customerId: Number(f.v.customerId), score: Number(f.v.score), comment: f.v.comment }); toast(t('Réponse enregistrée.')); f.setV({ ...f.v, comment: '' }); st.reload(); bump();
  }); };
  const d = st.data;
  return (
    <div className="cp-stack">
      <Card title={t('Satisfaction (NPS)')} subtitle={t('Note de 0 à 10 : promoteurs 9-10, passifs 7-8, détracteurs 0-6. NPS = % de promoteurs − % de détracteurs.')}>
        {st.error ? <Failed e={st.error} /> : !d ? <Loading /> : (
          <>
            <div className="ui-stats">
              <Stat label="NPS" value={d.nps === null ? '—' : d.nps} icon="star" tone={d.nps !== null && d.nps < 0 ? 'danger' : 'ok'} />
              <Stat label={t('Promoteurs')} value={d.promoters} icon="heart" tone="ok" /><Stat label={t('Passifs')} value={d.passives} icon="minus" /><Stat label={t('Détracteurs')} value={d.detractors} icon="triangle-exclamation" tone={d.detractors ? 'warn' : 'ok'} />
            </div>
            {d.trend.length ? <ChartFrame title={t('Évolution du NPS')} summary={d.trend.map((x) => `${x.month} : ${x.nps}`).join(' ; ')} height={220}><Combo data={d.trend.map((x) => ({ x: x.month, nps: x.nps }))} series={[{ key: 'nps', label: 'NPS', type: 'line' }]} height={220} zeroLine /></ChartFrame> : null}
          </>
        )}
      </Card>
      {has('write') ? (
        <Card title={t('Saisir une réponse')}>
          <form className="ws-form" noValidate onSubmit={save}>
            <div className="cp-grid">
              <Field label={t('Client')}>{(p) => <AccountSelect id={p.id} value={f.v.customerId} onChange={f.set('customerId')} />}</Field>
              <Field label={t('Note (0 à 10)')}>{(p) => <select {...p} value={f.v.score} onChange={f.set('score')}>{Array.from({ length: 11 }, (_, i) => 10 - i).map((n) => <option key={n} value={n}>{n}</option>)}</select>}</Field>
            </div>
            <Field label={t('Commentaire')}>{(p) => <input {...p} type="text" maxLength={500} value={f.v.comment} onChange={f.set('comment')} />}</Field>
            <p className="ws-err" role="alert">{f.err}</p>
            <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
          </form>
        </Card>
      ) : null}
      {d ? <Card title={t('Dernières réponses')}><Table caption={t('Dernières réponses')} columns={[{ key: 'at', label: t('Date'), render: (r) => fmtDT(r.at) }, { key: 'customer', label: t('Client') }, { key: 'score', label: t('Note'), align: 'r', render: (r) => <Badge tone={r.score >= 9 ? 'ok' : r.score >= 7 ? 'neutral' : 'danger'}>{r.score}</Badge> }, { key: 'comment', label: t('Commentaire') }]} rows={d.responses} empty={t('Aucune réponse.')} /></Card> : null}
    </div>
  );
}

function ComplaintForm({ pre, close, onSaved }) {
  const t = useT();
  const L3 = useL3();
  const { api } = useCp();
  const f = useForm({ customerId: '', subject: pre ? pre.subject : '', severity: pre ? pre.severity : 'normal', ownerId: '', status: pre ? pre.status : 'open', resolution: pre ? pre.resolution : '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (pre) { await api('PUT', '/complaints/' + pre.id, { status: f.v.status, severity: f.v.severity, resolution: f.v.resolution }); }
      else { if (!f.v.customerId) throw new Error(t('Choisissez le client.')); if (!f.v.subject.trim()) throw new Error(t('Décrivez la réclamation.')); await api('POST', '/complaints', { customerId: Number(f.v.customerId), subject: f.v.subject, severity: f.v.severity, ownerId: f.v.ownerId || undefined }); }
      close(); onSaved();
    }); }}>
      {!pre ? <Field label={t('Client')}>{(p) => <AccountSelect id={p.id} value={f.v.customerId} onChange={f.set('customerId')} />}</Field> : <p><b>{pre.customer}</b> — {pre.subject}</p>}
      {!pre ? <Field label={t('Réclamation')} required>{(p) => <input {...p} type="text" maxLength={200} value={f.v.subject} onChange={f.set('subject')} />}</Field> : null}
      <div className="cp-grid">
        <Field label={t('Gravité')}>{(p) => <MapSelect {...p} map={L3.severity} value={f.v.severity} onChange={f.set('severity')} />}</Field>
        {pre ? <Field label={t('État')}>{(p) => <MapSelect {...p} map={L3.complaint} value={f.v.status} onChange={f.set('status')} />}</Field> : <Field label={t('Responsable')}>{(p) => <MemberSelect {...p} value={f.v.ownerId} onChange={f.set('ownerId')} none={t('Commercial du compte')} />}</Field>}
      </div>
      {pre ? <Field label={t('Solution apportée')}>{(p) => <textarea {...p} rows={3} maxLength={500} value={f.v.resolution} onChange={f.set('resolution')} />}</Field> : null}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function ComplaintsView() {
  const t = useT();
  const L3 = useL3();
  const { api, has, tick } = useCp();
  const { modal, dateFr } = useWs();
  const [status, setStatus] = useState('');
  const st = useLoad(() => api('GET', '/complaints' + (status ? '?status=' + status : '')), [status, tick]);
  const form = (pre) => modal(pre ? t('Traiter la réclamation') : t('Nouvelle réclamation'), (close) => <ComplaintForm pre={pre} close={close} onSaved={st.reload} />);
  return (
    <Card title={t('Réclamations')} actions={<>{has('write') ? <Button variant="primary" icon="plus" onClick={() => form(null)}>{t('Nouvelle réclamation')}</Button> : null}</>}>
      <div className="cp-filters"><Field label={t('État')}>{(p) => <MapSelect {...p} map={L3.complaint} value={status} onChange={setStatus} none={t('Tous')} />}</Field></div>
      {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : <Table caption={t('Réclamations')} columns={[
        { key: 'customer', label: t('Client'), render: (c) => <b>{c.customer}</b> }, { key: 'subject', label: t('Réclamation') }, { key: 'severity', label: t('Gravité'), render: (c) => <Badge tone={c.severity === 'high' ? 'danger' : 'neutral'}>{L3.severity[c.severity]}</Badge> },
        { key: 'status', label: t('État'), render: (c) => <Badge tone={c.status === 'resolved' ? 'ok' : 'warn'}>{L3.complaint[c.status]}</Badge> }, { key: 'owner', label: t('Responsable') }, { key: 'openedAt', label: t('Ouverte le'), render: (c) => dateFr(c.openedAt) },
        { key: 'act', label: '', render: (c) => (has('write') ? <Button size="sm" onClick={() => form(c)}>{t('Traiter')}</Button> : null) },
      ]} rows={st.data.complaints} empty={t('Aucune réclamation.')} />}
    </Card>
  );
}

export default function Satisfaction() {
  const t = useT();
  const [view, setView] = useState('nps');
  return (
    <div className="cp-stack">
      <Segmented label={t('Vue')} value={view} onChange={setView} items={[{ id: 'nps', label: 'NPS' }, { id: 'complaints', label: t('Réclamations') }]} />
      {view === 'nps' ? <NpsView /> : <ComplaintsView />}
    </div>
  );
}
