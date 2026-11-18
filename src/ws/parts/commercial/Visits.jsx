import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Card, EmptyState, Field, Loading, Segmented, Table, useLoad } from '../../ui.jsx';
import { Failed, MemberSelect, ZoneSelect, qs, useCp, useForm } from './common.jsx';
import { useL3 } from './labels3.jsx';

/* Visites terrain, tournées (regroupées par ville) et agenda du commercial. */

const iso = (d) => d.toISOString().slice(0, 10);
const plus = (n) => iso(new Date(Date.now() + n * 86400000));

function VisitForm({ tours, pre, close, onSaved }) {
  const t = useT();
  const { api, me, members } = useCp();
  const accounts = useLoad(() => api('GET', '/accounts?limit=500'), []);
  const f = useForm({ customerId: '', date: pre ? pre.date : iso(new Date()), time: '', purpose: '', userId: '', tourId: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.customerId) throw new Error(t('Rattachez la visite à un compte ou à un prospect.'));
      await api('POST', '/visits', { customerId: Number(f.v.customerId), date: f.v.date, time: f.v.time || undefined, purpose: f.v.purpose, userId: f.v.userId || undefined, tourId: f.v.tourId || undefined }); close(); onSaved();
    }); }}>
      <div className="cp-grid">
        <Field label={t('Compte à visiter')}>{(p) => <select {...p} value={f.v.customerId} onChange={f.set('customerId')}><option value="">{t('Choisir…')}</option>{accounts.data ? accounts.data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.city ? ' — ' + a.city : ''}</option>) : null}</select>}</Field>
        <Field label={t('Date')}>{(p) => <input {...p} type="date" value={f.v.date} onChange={f.set('date')} />}</Field>
        <Field label={t('Heure')}>{(p) => <input {...p} type="time" value={f.v.time} onChange={f.set('time')} />}</Field>
        {!me.scopeOwn && members.length ? <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} onlySales value={f.v.userId} onChange={f.set('userId')} none={t('Moi')} />}</Field> : null}
        <Field label={t('Tournée')}>{(p) => <select {...p} value={f.v.tourId} onChange={f.set('tourId')}><option value="">{t('Aucune')}</option>{tours.map((x) => <option key={x.id} value={x.id}>{x.date} — {x.name || x.user}</option>)}</select>}</Field>
      </div>
      <Field label={t('Objet de la visite')}>{(p) => <input {...p} type="text" maxLength={200} value={f.v.purpose} onChange={f.set('purpose')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Planifier')}</Button></div>
    </form>
  );
}

function TourForm({ close, onSaved }) {
  const t = useT();
  const { api, me } = useCp();
  const f = useForm({ name: '', date: iso(new Date()), zoneId: '', userId: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => { await api('POST', '/tours', { name: f.v.name, date: f.v.date, zoneId: f.v.zoneId || undefined, userId: f.v.userId || undefined }); close(); onSaved(); }); }}>
      <div className="cp-grid">
        <Field label={t('Nom de la tournée')}>{(p) => <input {...p} type="text" maxLength={80} value={f.v.name} onChange={f.set('name')} />}</Field>
        <Field label={t('Date')}>{(p) => <input {...p} type="date" value={f.v.date} onChange={f.set('date')} />}</Field>
        <Field label={t('Zone')}>{(p) => <ZoneSelect {...p} value={f.v.zoneId} onChange={f.set('zoneId')} none={t('Aucune')} />}</Field>
        {!me.scopeOwn ? <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} onlySales value={f.v.userId} onChange={f.set('userId')} none={t('Moi')} />}</Field> : null}
      </div>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Créer la tournée')}</Button></div>
    </form>
  );
}

function OutcomeForm({ v, status, close, onSaved }) {
  const t = useT();
  const { api } = useCp();
  const f = useForm({ outcome: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => { await api('PUT', '/visits/' + v.id, { status, outcome: f.v.outcome }); close(); onSaved(); }); }}>
      <Field label={t('Compte rendu de la visite')}>{(p) => <textarea {...p} rows={3} maxLength={500} value={f.v.outcome} onChange={f.set('outcome')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function VisitsView() {
  const t = useT();
  const L3 = useL3();
  const { api, has, fail, tick, bump, openAccount } = useCp();
  const { modal, dateFr } = useWs();
  const [r, setR] = useState({ from: iso(new Date()), to: plus(14) });
  const st = useLoad(() => api('GET', '/visits' + qs(r)), [r, tick]);
  const tours = useLoad(() => api('GET', '/tours' + qs(r)), [r, tick]);
  const reload = () => { st.reload(); tours.reload(); bump(); };
  const opt = (id) => api('POST', '/tours/' + id + '/optimize', {}).then(reload, fail);
  return (
    <div className="cp-stack">
      <Card title={t('Visites')} actions={has('activity') ? <><Button icon="plus" onClick={() => modal(t('Nouvelle tournée'), (close) => <TourForm close={close} onSaved={reload} />)}>{t('Nouvelle tournée')}</Button><Button variant="primary" icon="plus" onClick={() => modal(t('Planifier une visite'), (close) => <VisitForm tours={tours.data ? tours.data.tours : []} close={close} onSaved={reload} />, { wide: true })}>{t('Planifier une visite')}</Button></> : null}>
        <div className="cp-filters">
          <Field label={t('Du')}>{(p) => <input {...p} type="date" value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} />}</Field>
          <Field label={t('Au')}>{(p) => <input {...p} type="date" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} />}</Field>
        </div>
        {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : <Table caption={t('Visites')} columns={[
          { key: 'date', label: t('Date'), render: (v) => dateFr(v.date) + (v.time ? ' ' + v.time : '') }, { key: 'order', label: '#', align: 'r', render: (v) => (v.tourId ? v.order : '') },
          { key: 'customer', label: t('Compte'), render: (v) => (v.customerId ? <button type="button" className="cp-link" onClick={() => openAccount(v.customerId)}><b>{v.customer}</b></button> : v.lead) },
          { key: 'city', label: t('Ville') }, { key: 'user', label: t('Commercial') }, { key: 'purpose', label: t('Objet') },
          { key: 'status', label: t('État'), render: (v) => <Badge tone={v.status === 'done' ? 'ok' : v.status === 'planned' ? 'info' : 'neutral'}>{L3.visit[v.status]}</Badge> },
          { key: 'act', label: '', render: (v) => (has('activity') && v.status === 'planned' ? <span className="row"><Button size="sm" variant="primary" onClick={() => modal(t('Visite faite'), (close) => <OutcomeForm v={v} status="done" close={close} onSaved={reload} />)}>{t('Faite')}</Button><Button size="sm" onClick={() => api('PUT', '/visits/' + v.id, { status: 'missed' }).then(reload, fail)}>{t('Manquée')}</Button><Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer')} onClick={() => api('DELETE', '/visits/' + v.id).then(reload, fail)} /></span> : null) },
        ]} rows={st.data.visits} empty={t('Aucune visite sur la période.')} />}
      </Card>
      <Card title={t('Tournées')} subtitle={t("« Optimiser » regroupe les visites par ville puis par heure pour éviter les allers-retours (aucune carte n'est utilisée).")}>
        {!tours.data ? <Loading /> : !tours.data.tours.length ? <EmptyState icon="route" title={t('Aucune tournée sur la période.')} /> : (
          <Table caption={t('Tournées')} columns={[{ key: 'date', label: t('Date'), render: (x) => dateFr(x.date) }, { key: 'name', label: t('Tournée'), render: (x) => <b>{x.name || '—'}</b> }, { key: 'user', label: t('Commercial') }, { key: 'stops', label: t('Étapes'), align: 'r', render: (x) => `${x.done} / ${x.stops}` },
            { key: 'act', label: '', render: (x) => (has('activity') ? <Button size="sm" onClick={() => opt(x.id)}>{t('Optimiser')}</Button> : null) }]} rows={tours.data.tours} />
        )}
      </Card>
    </div>
  );
}

function AgendaView() {
  const t = useT();
  const L3 = useL3();
  const { api, tick, me } = useCp();
  const { dateFr } = useWs();
  const [f, setF] = useState({ from: iso(new Date()), to: plus(7), userId: '' });
  const st = useLoad(() => api('GET', '/agenda' + qs(f)), [f, tick]);
  const days = st.data ? [...new Set(st.data.items.map((i) => i.date))] : [];
  return (
    <Card title={t('Agenda')} subtitle={t('Visites, tâches et rendez-vous des comptes suivis.')}>
      <div className="cp-filters">
        <Field label={t('Du')}>{(p) => <input {...p} type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />}</Field>
        <Field label={t('Au')}>{(p) => <input {...p} type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />}</Field>
        {!me.scopeOwn ? <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} onlySales value={f.userId} onChange={(v) => setF({ ...f, userId: v })} none={t('Moi')} />}</Field> : null}
      </div>
      {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : !days.length ? <EmptyState icon="calendar" title={t('Rien de prévu sur la période.')} /> : days.map((d) => (
        <section key={d} className="cp-day"><h3>{dateFr(d)}</h3>
          <ul className="cp-list">{st.data.items.filter((i) => i.date === d).map((i) => <li key={i.type + i.id} className="cp-item"><b>{i.time || '—'}</b><span className="grow">{i.title}</span><Badge>{L3.agenda[i.type]}</Badge></li>)}</ul>
        </section>
      ))}
    </Card>
  );
}

export default function Visits() {
  const t = useT();
  const [view, setView] = useState('visits');
  return (
    <div className="cp-stack">
      <Segmented label={t('Vue')} value={view} onChange={setView} items={[{ id: 'visits', label: t('Visites et tournées') }, { id: 'agenda', label: t('Agenda') }]} />
      {view === 'visits' ? <VisitsView /> : <AgendaView />}
    </div>
  );
}
