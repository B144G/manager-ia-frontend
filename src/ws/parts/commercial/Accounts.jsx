import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Button, Card, Field, Table, useLoad } from '../../ui.jsx';
import { Failed, MapSelect, MemberSelect, Tag, ZoneSelect, qs, useCp, useForm, useL } from './common.jsx';

/* Comptes : liste filtrable, création avec détection des doublons (409 → ouvrir la fiche existante ou créer quand même). */

export function AccountForm({ pre, close, onSaved }) {
  const t = useT();
  const L = useL();
  const { api, raw, has, openAccount } = useCp();
  const { toast } = useWs();
  const f = useForm({
    name: pre ? pre.name : '', kind: pre ? pre.kind : 'company', stage: pre ? pre.stage : 'client', phone: pre ? pre.phone : '', email: pre ? pre.email : '', sector: pre ? pre.sector : '', city: pre ? pre.city : '',
    address: pre ? pre.address : '', niu: pre ? pre.niu : '', potential: pre ? pre.potential : '', source: pre ? pre.source : '', ownerId: pre && pre.ownerId ? String(pre.ownerId) : '', zoneId: pre && pre.zoneId ? String(pre.zoneId) : '', notes: pre ? pre.notes : '',
  });
  const [dups, setDups] = useState(null);
  const body = (force) => ({ ...f.v, ownerId: f.v.ownerId || null, zoneId: f.v.zoneId || null, ...(force ? { force: true } : {}) });
  const save = (force) => f.run(async () => {
    if (!f.v.name.trim()) throw new Error(t('Indiquez le nom du compte.'));
    if (pre) { await api('PUT', '/accounts/' + pre.id, body()); toast(t('Fiche enregistrée.')); close(); onSaved(pre.id); return; }
    const r = await raw('POST', '/accounts', body(force));
    if (r.status === 409 && r.data.duplicates) { setDups(r.data.duplicates); return; }
    if (!r.ok) throw Object.assign(new Error(r.data.error || t('Erreur')), { status: r.status });
    toast(t('Compte créé.')); close(); onSaved(r.data.id);
  });
  const canOwner = has('rules') || !pre;
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); save(false); }}>
      {dups ? (
        <Alert tone="warn" title={t('Des fiches semblables existent déjà')}>
          <ul className="cp-list">{dups.map((d) => <li key={d.id} className="row"><span className="grow">{d.name}{d.phone ? ' · ' + d.phone : ''}{d.email ? ' · ' + d.email : ''}</span><Button size="sm" onClick={() => { close(); openAccount(d.id); }}>{t('Ouvrir la fiche')}</Button></li>)}</ul>
          <Button size="sm" variant="danger-outline" loading={f.busy} onClick={() => save(true)}>{t('Créer quand même')}</Button>
        </Alert>
      ) : null}
      <div className="cp-grid">
        <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={100} value={f.v.name} onChange={f.set('name')} />}</Field>
        <Field label={t('Type de compte')}>{(p) => <MapSelect {...p} map={L.kind} value={f.v.kind} onChange={f.set('kind')} />}</Field>
        <Field label={t('Statut')}>{(p) => <MapSelect {...p} map={L.stage} value={f.v.stage} onChange={f.set('stage')} />}</Field>
        <Field label={t('Téléphone')}>{(p) => <input {...p} type="tel" maxLength={40} value={f.v.phone} onChange={f.set('phone')} />}</Field>
        <Field label={t('E-mail')}>{(p) => <input {...p} type="email" maxLength={120} value={f.v.email} onChange={f.set('email')} />}</Field>
        <Field label={t('Secteur')}>{(p) => <input {...p} type="text" maxLength={80} value={f.v.sector} onChange={f.set('sector')} />}</Field>
        <Field label={t('Ville')}>{(p) => <input {...p} type="text" maxLength={80} value={f.v.city} onChange={f.set('city')} />}</Field>
        <Field label={t('Adresse')}>{(p) => <input {...p} type="text" maxLength={300} value={f.v.address} onChange={f.set('address')} />}</Field>
        <Field label={t('NIU')}>{(p) => <input {...p} type="text" maxLength={40} value={f.v.niu} onChange={f.set('niu')} />}</Field>
        <Field label={t('Potentiel')}>{(p) => <MapSelect {...p} map={L.potential} value={f.v.potential} onChange={f.set('potential')} none={t('Non précisé')} />}</Field>
        <Field label={t('Origine')}>{(p) => <input {...p} type="text" maxLength={60} value={f.v.source} onChange={f.set('source')} />}</Field>
        <Field label={t('Zone')}>{(p) => <ZoneSelect {...p} value={f.v.zoneId} onChange={f.set('zoneId')} none={t('Aucune')} />}</Field>
        {canOwner ? <Field label={t('Commercial qui suit le compte')}>{(p) => <MemberSelect {...p} value={f.v.ownerId} onChange={f.set('ownerId')} none={t('Aucun')} />}</Field> : null}
      </div>
      <Field label={t('Notes')}>{(p) => <textarea {...p} rows={3} maxLength={800} value={f.v.notes} onChange={f.set('notes')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

export default function Accounts() {
  const t = useT();
  const L = useL();
  const { api, has, tick, openAccount, screen } = useCp();
  const { modal, money } = useWs();
  const [f, setF] = useState({ q: '', kind: '', stage: screen.params.stage || '', potential: '', ownerId: '' });
  const [q, setQ] = useState('');
  useEffect(() => { const id = setTimeout(() => setF((s) => (s.q === q ? s : { ...s, q })), 300); return () => clearTimeout(id); }, [q]);
  const st = useLoad(() => api('GET', '/accounts' + qs({ ...f, limit: 300 })), [f, tick]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const add = () => modal(t('Nouveau compte'), (close) => <AccountForm close={close} onSaved={(id) => { st.reload(); openAccount(id); }} />, { wide: true });
  const cols = [
    { key: 'name', label: t('Nom'), render: (a) => <button type="button" className="cp-link" onClick={(e) => { e.stopPropagation(); openAccount(a.id); }}><b>{a.name}</b></button> },
    { key: 'kind', label: t('Type'), render: (a) => L.kind[a.kind] },
    { key: 'stage', label: t('Statut'), render: (a) => <Tag map={{ client: L.stage.client, prospect: L.stage.prospect }} k={a.stage} /> },
    { key: 'city', label: t('Ville') },
    { key: 'owner', label: t('Commercial') },
    { key: 'revenue', label: t("Chiffre d'affaires"), align: 'r', render: (a) => money(a.revenue) },
    { key: 'openOpps', label: t('Opportunités'), align: 'r' },
    { key: 'openTasks', label: t('Tâches'), align: 'r' },
  ];
  return (
    <Card title={t('Comptes')} subtitle={st.data ? t('{n} compte(s)', { n: st.data.total }) : ''} actions={has('write') ? <Button variant="primary" icon="plus" onClick={add}>{t('Nouveau compte')}</Button> : null}>
      <div className="cp-filters">
        <Field label={t('Recherche')}>{(p) => <input {...p} type="search" placeholder={t('Nom, téléphone, e-mail, ville…')} value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
        <Field label={t('Type')}>{(p) => <MapSelect {...p} map={L.kind} value={f.kind} onChange={set('kind')} none={t('Tous')} />}</Field>
        <Field label={t('Statut')}>{(p) => <MapSelect {...p} map={L.stage} value={f.stage} onChange={set('stage')} none={t('Tous')} />}</Field>
        <Field label={t('Potentiel')}>{(p) => <MapSelect {...p} map={L.potential} value={f.potential} onChange={set('potential')} none={t('Tous')} />}</Field>
        <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} value={f.ownerId} onChange={set('ownerId')} none={t('Tous')} />}</Field>
      </div>
      {st.error ? <Failed e={st.error} /> : st.data ? <Table caption={t('Comptes')} columns={cols} rows={st.data.accounts} onRowClick={(a) => openAccount(a.id)} empty={t('Aucun compte ne correspond.')} /> : <p role="status">{t('Chargement…')}</p>}
    </Card>
  );
}
