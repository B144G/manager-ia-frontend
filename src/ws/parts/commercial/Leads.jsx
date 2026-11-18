import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, Drawer, Field, Loading, Table, Tabs, useLoad } from '../../ui.jsx';
import { ActivityForm, BantCard, FilesPanel, NotesPanel, TasksPanel } from './Panels.jsx';
import { Failed, Facts, Grade, MapSelect, MemberSelect, Meter, Tag, ZoneSelect, fmtDT, num, qs, useCp, useForm, useL } from './common.jsx';

/* Prospects : liste triée par score, création avec détection de doublon, fiche (score expliqué, BANT, qualification, conversion, perte, réattribution). */

function LeadForm({ pre, close, onSaved }) {
  const t = useT();
  const L = useL();
  const { api, raw, has, openLead } = useCp();
  const { toast } = useWs();
  const f = useForm({ name: pre ? pre.name : '', company: pre ? pre.company : '', phone: pre ? pre.phone : '', email: pre ? pre.email : '', source: pre ? pre.source : 'other', campaign: pre ? pre.campaign : '', product: pre ? pre.product : '', city: pre ? pre.city : '', temperature: pre ? pre.temperature : '', budgetEst: pre && pre.budgetEst ? String(pre.budgetEst) : '', zoneId: pre && pre.zoneId ? String(pre.zoneId) : '', ownerId: '', notes: pre ? pre.notes : '' });
  const [dups, setDups] = useState(null);
  const body = (force) => ({ name: f.v.name, company: f.v.company, phone: f.v.phone, email: f.v.email, source: f.v.source, campaign: f.v.campaign, product: f.v.product, city: f.v.city, temperature: f.v.temperature, budgetEst: num(f.v.budgetEst), zoneId: f.v.zoneId || null, notes: f.v.notes, ...(pre ? {} : { ownerId: f.v.ownerId || undefined }), ...(force ? { force: true } : {}) });
  const save = (force) => f.run(async () => {
    if (!f.v.name.trim()) throw new Error(t('Indiquez le nom du prospect.'));
    if (pre) { await api('PUT', '/leads/' + pre.id, body()); toast(t('Prospect enregistré.')); close(); onSaved(pre.id); return; }
    const r = await raw('POST', '/leads', body(force));
    if (r.status === 409 && r.data.duplicates) { setDups(r.data.duplicates); return; }
    if (!r.ok) throw Object.assign(new Error(r.data.error || t('Erreur')), { status: r.status });
    toast(t('Prospect créé.')); close(); onSaved(r.data.id);
  });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); save(false); }}>
      {dups ? (
        <Alert tone="warn" title={t('Ce prospect existe déjà')}>
          <ul className="cp-list">{dups.map((d) => <li key={d.id} className="row"><span className="grow">{d.name}</span><Button size="sm" onClick={() => { close(); openLead(d.id); }}>{t('Ouvrir la fiche')}</Button></li>)}</ul>
          <Button size="sm" variant="danger-outline" loading={f.busy} onClick={() => save(true)}>{t('Créer quand même')}</Button>
        </Alert>
      ) : null}
      <div className="cp-grid">
        <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={100} value={f.v.name} onChange={f.set('name')} />}</Field>
        <Field label={t('Entreprise')}>{(p) => <input {...p} type="text" maxLength={100} value={f.v.company} onChange={f.set('company')} />}</Field>
        <Field label={t('Téléphone')}>{(p) => <input {...p} type="tel" maxLength={40} value={f.v.phone} onChange={f.set('phone')} />}</Field>
        <Field label={t('E-mail')}>{(p) => <input {...p} type="email" maxLength={120} value={f.v.email} onChange={f.set('email')} />}</Field>
        <Field label={t('Source')}>{(p) => <MapSelect {...p} map={L.source} value={f.v.source} onChange={f.set('source')} />}</Field>
        <Field label={t('Campagne')}>{(p) => <input {...p} type="text" maxLength={80} value={f.v.campaign} onChange={f.set('campaign')} />}</Field>
        <Field label={t('Produit recherché')}>{(p) => <input {...p} type="text" maxLength={120} value={f.v.product} onChange={f.set('product')} />}</Field>
        <Field label={t('Ville')}>{(p) => <input {...p} type="text" maxLength={80} value={f.v.city} onChange={f.set('city')} />}</Field>
        <Field label={t('Intérêt')}>{(p) => <MapSelect {...p} map={L.temp} value={f.v.temperature} onChange={f.set('temperature')} none={t('Non précisée')} />}</Field>
        <Field label={t('Budget estimé')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.budgetEst} onChange={f.set('budgetEst')} />}</Field>
        <Field label={t('Zone')}>{(p) => <ZoneSelect {...p} value={f.v.zoneId} onChange={f.set('zoneId')} none={t('Automatique (selon la ville)')} />}</Field>
        {!pre && has('rules') ? <Field label={t('Commercial')} hint={t('Vide : attribution automatique.')}>{(p) => <MemberSelect {...p} value={f.v.ownerId} onChange={f.set('ownerId')} none={t('Automatique')} />}</Field> : null}
      </div>
      <Field label={t('Notes')}>{(p) => <textarea {...p} rows={3} maxLength={800} value={f.v.notes} onChange={f.set('notes')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function ConvertForm({ lead, close, onDone }) {
  const t = useT();
  const { api, openAccount, openOpp } = useCp();
  const { toast } = useWs();
  const f = useForm({ createOpp: true, oppName: '', amount: lead.budgetEst ? String(lead.budgetEst) : '', closeDate: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      const r = await api('POST', '/leads/' + lead.id + '/convert', { createOpp: f.v.createOpp, oppName: f.v.oppName || undefined, amount: num(f.v.amount), closeDate: f.v.closeDate || undefined });
      toast(t('Prospect converti en compte.')); close(); onDone(); if (r.oppId) openOpp(r.oppId); else openAccount(r.customerId);
    }); }}>
      <p>{t('Le prospect devient un compte (une fiche existante peut être réutilisée) et, si vous le souhaitez, une opportunité est créée dans la première étape du pipeline.')}</p>
      <label className="cp-check"><input type="checkbox" checked={f.v.createOpp} onChange={f.set('createOpp')} /> {t('Créer une opportunité')}</label>
      {f.v.createOpp ? (
        <div className="cp-grid">
          <Field label={t("Nom de l'opportunité")}>{(p) => <input {...p} type="text" maxLength={120} value={f.v.oppName} onChange={f.set('oppName')} />}</Field>
          <Field label={t('Montant')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.amount} onChange={f.set('amount')} />}</Field>
          <Field label={t('Clôture prévue')}>{(p) => <input {...p} type="date" value={f.v.closeDate} onChange={f.set('closeDate')} />}</Field>
        </div>
      ) : null}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Convertir')}</Button></div>
    </form>
  );
}

function LoseForm({ lead, status, close, onDone }) {
  const t = useT();
  const { api } = useCp();
  const f = useForm({ reason: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.reason.trim()) throw new Error(t('Indiquez le motif (perdu ou écarté).'));
      await api('PUT', '/leads/' + lead.id, { status, lostReason: f.v.reason }); close(); onDone();
    }); }}>
      <Field label={status === 'lost' ? t('Motif de la perte') : t('Motif pour écarter ce prospect')} required>{(p) => <textarea {...p} rows={3} maxLength={200} value={f.v.reason} onChange={f.set('reason')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="danger" type="submit" loading={f.busy}>{t('Confirmer')}</Button></div>
    </form>
  );
}

function StartCadence({ lead, close, onDone }) {
  const t = useT();
  const { api } = useCp();
  const { toast } = useWs();
  const st = useLoad(() => api('GET', '/cadences'), []);
  const f = useForm({ id: '' });
  const list = st.data ? st.data.cadences.filter((c) => c.active && c.target === 'lead') : [];
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.id) throw new Error(t('Choisissez une cadence.'));
      const r = await api('POST', '/cadences/' + f.v.id + '/start', { leadId: lead.id });
      if (!r.started.length) throw new Error(t('Cette relance est déjà en cours ou le prospect est clos.'));
      toast(t('Relance démarrée.')); close(); onDone();
    }); }}>
      {!st.data ? <Loading /> : !list.length ? <p className="muted">{t("Aucune cadence disponible pour les prospects.")}</p> : (
        <Field label={t('Cadence')}>{(p) => <select {...p} value={f.v.id} onChange={f.set('id')}><option value="">{t('Choisir…')}</option>{list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</Field>
      )}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy} disabled={!list.length}>{t('Démarrer')}</Button></div>
    </form>
  );
}

const PART_MAX = { profile: 27, source: 18, intent: 20, budget: 5, engagement: 10, recency: 10, bant: 15 };

export function LeadDetail({ id, onClose }) {
  const t = useT();
  const L = useL();
  const { api, fail, has, tick, bump, openAccount, memberName } = useCp();
  const { modal, toast, dateFr } = useWs();
  const st = useLoad(() => api('GET', '/leads/' + id), [id, tick]);
  const [tab, setTab] = useState('sum');
  const [owner, setOwner] = useState('');
  const l = st.data && st.data.lead;
  useEffect(() => { if (l) setOwner(l.ownerId ? String(l.ownerId) : ''); }, [l]);
  const reload = () => { st.reload(); bump(); };
  const PARTS = { profile: t('Fiche complète'), source: t('Source'), intent: t('Intérêt'), budget: t('Budget'), engagement: t('Échanges'), recency: t('Dernier contact'), bant: t('BANT') };
  const open = l && ['new', 'contacted', 'qualified'].includes(l.status);
  const qualify = () => api('PUT', '/leads/' + id, { status: 'qualified' }).then(() => { toast(t('Prospect qualifié.')); reload(); }, fail);
  const tabs = [{ id: 'sum', label: t('Résumé') }, { id: 'bant', label: t('BANT') }, { id: 'tasks', label: t('Tâches') }, { id: 'acts', label: t('Activités') }, { id: 'files', label: t('Pièces jointes') }, { id: 'notes', label: t('Notes') }];
  const refs = { leadId: id };
  return (
    <Drawer title={l ? l.name : t('Prospect')} onClose={onClose} wide>
      {st.loading && !l ? <Loading /> : st.error ? <Failed e={st.error} /> : (
        <>
          <div className="row"><Grade grade={l.grade} score={l.score} /><Tag map={L.leadStatus} k={l.status} /><Badge>{L.source[l.source]}</Badge>{l.temperature ? <Badge tone="info">{L.temp[l.temperature]}</Badge> : null}</div>
          {open ? (
            <div className="row cp-actions">
              {has('write') ? <>
                <Button size="sm" onClick={() => modal(t('Modifier le prospect'), (close) => <LeadForm pre={l} close={close} onSaved={reload} />, { wide: true })}>{t('Modifier')}</Button>
                {l.status !== 'qualified' ? <Button size="sm" onClick={qualify}>{t('Qualifier')}</Button> : null}
                <Button size="sm" variant="primary" onClick={() => modal(t('Convertir en compte'), (close) => <ConvertForm lead={l} close={close} onDone={reload} />, { wide: true })}>{t('Convertir')}</Button>
                <Button size="sm" variant="danger-outline" onClick={() => modal(t('Prospect perdu'), (close) => <LoseForm lead={l} status="lost" close={close} onDone={reload} />)}>{t('Perdu')}</Button>
                <Button size="sm" variant="ghost" onClick={() => modal(t('Écarter le prospect'), (close) => <LoseForm lead={l} status="disqualified" close={close} onDone={reload} />)}>{t('Écarter')}</Button>
              </> : null}
              {has('activity') ? <Button size="sm" icon="paper-plane" onClick={() => modal(t('Démarrer une relance'), (close) => <StartCadence lead={l} close={close} onDone={reload} />)}>{t('Démarrer une relance')}</Button> : null}
            </div>
          ) : null}
          {l.status === 'converted' && l.customerId ? <Alert tone="ok">{t('Converti le {d}.', { d: dateFr(l.convertedAt) })} <button type="button" className="cp-link" onClick={() => openAccount(l.customerId)}>{t('Ouvrir le compte')}</button></Alert> : null}
          {l.lostReason ? <Alert tone="warn">{t('Motif : {m}', { m: l.lostReason })}</Alert> : null}
          <Tabs items={tabs} value={tab} onChange={setTab} label={t('Fiche du prospect')} />
          {tab === 'sum' ? (
            <>
              <Facts items={[[t('Entreprise'), l.company], [t('Téléphone'), l.phone], [t('E-mail'), l.email], [t('Ville'), l.city], [t('Produit'), l.product], [t('Campagne'), l.campaign], [t('Budget estimé'), l.budgetEst ? l.budgetEst.toLocaleString() : ''], [t('Commercial'), l.owner || memberName(l.ownerId)], [t('Dernier contact'), l.lastContactAt ? fmtDT(l.lastContactAt) : t('Jamais')], [t('Notes'), l.notes]]} />
              {has('rules') && open ? (
                <div className="row">
                  <Field label={t('Réattribuer à')}>{(p) => <MemberSelect {...p} value={owner} onChange={setOwner} none={t('Aucun')} />}</Field>
                  <Button size="sm" disabled={String(l.ownerId || '') === owner} onClick={() => api('PUT', '/leads/' + id, { ownerId: owner || null }).then(() => { toast(t('Prospect réattribué.')); reload(); }, fail)}>{t('Réattribuer')}</Button>
                  <Button size="sm" onClick={() => api('POST', '/leads/' + id + '/assign').then(() => { toast(t('Attribution automatique faite.')); reload(); }, fail)}>{t('Attribuer automatiquement')}</Button>
                </div>
              ) : null}
              <Card flat title={t('Comment le score est calculé')} subtitle={t('Score {n} / 100', { n: l.score })}>
                {Object.entries(PART_MAX).map(([k, max]) => (
                  <div className="cp-part" key={k}><span>{PARTS[k]}</span><Meter value={(l.scoreParts || {})[k] || 0} max={max} label={`${PARTS[k]} : ${(l.scoreParts || {})[k] || 0} / ${max}`} /><b>{(l.scoreParts || {})[k] || 0} / {max}</b></div>
                ))}
              </Card>
              {st.data.cadences.length ? (
                <Card flat title={t('Relances')}>
                  {st.data.cadences.map((c) => <div className="line" key={c.id}><span>{c.cadence} — {t('étape {i} / {n}', { i: Math.min(c.stepIdx + 1, c.steps), n: c.steps })}</span><span><Tag map={L.runState} k={c.state} />{c.stopReason ? ' ' + (L.stopReason[c.stopReason] || c.stopReason) : ''}</span></div>)}
                </Card>
              ) : null}
            </>
          ) : null}
          {tab === 'bant' ? <BantCard kind="lead" id={id} onChange={reload} /> : null}
          {tab === 'tasks' ? <TasksPanel refs={refs} /> : null}
          {tab === 'acts' ? <ActivityForm refs={refs} onSaved={reload} /> : null}
          {tab === 'files' ? <FilesPanel refs={refs} /> : null}
          {tab === 'notes' ? <NotesPanel refs={refs} /> : null}
        </>
      )}
    </Drawer>
  );
}

export default function Leads() {
  const t = useT();
  const L = useL();
  const { api, has, tick, bump, openLead, screen, fail } = useCp();
  const { modal, toast } = useWs();
  const [f, setF] = useState({ status: screen.params.status || '', source: '', ownerId: '', q: '' });
  const [q, setQ] = useState('');
  useEffect(() => { const id = setTimeout(() => setF((s) => (s.q === q ? s : { ...s, q })), 300); return () => clearTimeout(id); }, [q]);
  const st = useLoad(() => api('GET', '/leads' + qs({ ...f, limit: 300 })), [f, tick]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const add = () => modal(t('Nouveau prospect'), (close) => <LeadForm close={close} onSaved={(id) => { bump(); openLead(id); }} />, { wide: true });
  const sync = () => api('POST', '/leads-sync-whatsapp').then((r) => { toast(r.created ? t('{n} prospect(s) importé(s) depuis WhatsApp.', { n: r.created }) : t('Aucune nouvelle conversation à importer.')); if (r.created) bump(); }, fail);
  const cols = [
    { key: 'g', label: t('Note'), render: (l) => <Grade grade={l.grade} score={l.score} /> },
    { key: 'name', label: t('Prospect'), render: (l) => <button type="button" className="cp-link" onClick={() => openLead(l.id)}><b>{l.name}</b>{l.company ? <span className="muted"> · {l.company}</span> : null}</button> },
    { key: 'source', label: t('Source'), render: (l) => L.source[l.source] || l.source },
    { key: 'status', label: t('Statut'), render: (l) => <Tag map={L.leadStatus} k={l.status} /> },
    { key: 'owner', label: t('Commercial'), render: (l) => l.owner || <span className="muted">{t('Non attribué')}</span> },
    { key: 'product', label: t('Produit / ville'), render: (l) => [l.product, l.city].filter(Boolean).join(' · ') },
    { key: 'last', label: t('Dernier contact'), render: (l) => (l.lastContactAt ? fmtDT(l.lastContactAt) : '—') },
  ];
  return (
    <Card title={t('Prospects')} subtitle={st.data ? t('{n} prospect(s), du meilleur score au plus faible', { n: st.data.total }) : ''}
      actions={<>{has('write') ? <Button icon="whatsapp" onClick={sync}>{t('Importer les conversations WhatsApp')}</Button> : null}{has('write') ? <Button variant="primary" icon="plus" onClick={add}>{t('Nouveau prospect')}</Button> : null}</>}>
      <div className="cp-filters">
        <Field label={t('Recherche')}>{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Nom, entreprise, téléphone…')} />}</Field>
        <Field label={t('Statut')}>{(p) => <MapSelect {...p} map={L.leadStatus} value={f.status} onChange={set('status')} none={t('Ouverts (nouveau, contacté, qualifié)')} />}</Field>
        <Field label={t('Source')}>{(p) => <MapSelect {...p} map={L.source} value={f.source} onChange={set('source')} none={t('Toutes')} />}</Field>
        <Field label={t('Commercial')}>{(p) => <MemberSelect {...p} value={f.ownerId} onChange={set('ownerId')} none={t('Tous')} />}</Field>
      </div>
      {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : <Table caption={t('Prospects')} columns={cols} rows={st.data.leads} empty={t('Aucun prospect ne correspond.')} />}
    </Card>
  );
}
