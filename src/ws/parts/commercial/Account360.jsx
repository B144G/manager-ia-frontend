import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Drawer, EmptyState, Field, Icon, Loading, Stat, Tabs, useLoad } from '../../ui.jsx';
import { AccountForm } from './Accounts.jsx';
import { OppForm } from './OppDetail.jsx';
import { ActivityForm, ActivityList, FilesPanel, NotesPanel, TasksPanel } from './Panels.jsx';
import { Failed, Facts, Tag, fmtDT, useCp, useForm, useL } from './common.jsx';

/* Fiche d'un compte : vue à 360° (historique de tout ce qui s'est passé), contacts, tâches, notes, pièces jointes, activités, opportunités. */

function Timeline({ id }) {
  const t = useT();
  const L = useL();
  const { api, tick } = useCp();
  const { money } = useWs();
  const st = useLoad(() => api('GET', '/accounts/' + id + '/timeline?limit=300'), [id, tick]);
  const [type, setType] = useState('');
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <Failed e={st.error} />;
  const { events, counts } = st.data;
  const list = type ? events.filter((e) => e.type === type) : events;
  const meta = (k) => L.tl[k] || [k, 'file-lines'];
  return (
    <div>
      <div className="cp-chips" role="group" aria-label={t("Filtrer l'historique")}>
        <button type="button" className="cp-chip" aria-pressed={!type} onClick={() => setType('')}>{t('Tout')} <b>{events.length}</b></button>
        {Object.entries(counts).map(([k, n]) => <button key={k} type="button" className="cp-chip" aria-pressed={type === k} onClick={() => setType(k)}><Icon name={meta(k)[1]} /> {meta(k)[0]} <b>{n}</b></button>)}
      </div>
      {!list.length ? <EmptyState icon="history" title={t('Rien dans l’historique pour l’instant.')} /> : (
        <ol className="cp-timeline">
          {list.map((e, i) => (
            <li key={e.type + (e.ref || '') + i}>
              <span className="cp-tl-ico"><Icon name={meta(e.type)[1]} /></span>
              <div>
                <b>{meta(e.type)[0]}</b>{e.status ? <> <Badge>{e.status}</Badge></> : null}
                <div>{e.title}</div>
                <div className="small muted">{fmtDT(e.at)}{e.amount ? ' · ' + money(e.amount) : ''}{e.by ? ' · ' + e.by : ''}{e.outcome ? ' · ' + e.outcome : ''}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ContactForm({ customerId, pre, close, onSaved }) {
  const t = useT();
  const { api } = useCp();
  const f = useForm({ name: pre ? pre.name : '', jobTitle: pre ? pre.jobTitle : '', phone: pre ? pre.phone : '', email: pre ? pre.email : '', isPrimary: pre ? pre.isPrimary : false, isDecider: pre ? pre.isDecider : false, notes: pre ? pre.notes : '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.name.trim()) throw new Error(t('Indiquez le nom du contact.'));
      if (pre) await api('PUT', '/contacts/' + pre.id, f.v); else await api('POST', '/accounts/' + customerId + '/contacts', f.v);
      close(); onSaved();
    }); }}>
      <div className="cp-grid">
        <Field label={t('Nom')} required>{(p) => <input {...p} type="text" maxLength={100} value={f.v.name} onChange={f.set('name')} />}</Field>
        <Field label={t('Fonction')}>{(p) => <input {...p} type="text" maxLength={100} value={f.v.jobTitle} onChange={f.set('jobTitle')} />}</Field>
        <Field label={t('Téléphone')}>{(p) => <input {...p} type="tel" maxLength={40} value={f.v.phone} onChange={f.set('phone')} />}</Field>
        <Field label={t('E-mail')}>{(p) => <input {...p} type="email" maxLength={120} value={f.v.email} onChange={f.set('email')} />}</Field>
      </div>
      <label className="cp-check"><input type="checkbox" checked={f.v.isPrimary} onChange={f.set('isPrimary')} /> {t('Contact principal')}</label>
      <label className="cp-check"><input type="checkbox" checked={f.v.isDecider} onChange={f.set('isDecider')} /> {t('Décideur')}</label>
      <Field label={t('Notes')}>{(p) => <input {...p} type="text" maxLength={500} value={f.v.notes} onChange={f.set('notes')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function Contacts({ id, contacts, reload }) {
  const t = useT();
  const { api, fail, has } = useCp();
  const { modal, confirm } = useWs();
  const form = (pre) => modal(pre ? t('Modifier le contact') : t('Nouveau contact'), (close) => <ContactForm customerId={id} pre={pre} close={close} onSaved={reload} />);
  return (
    <div>
      {has('write') ? <div className="row"><Button size="sm" icon="plus" onClick={() => form(null)}>{t('Nouveau contact')}</Button></div> : null}
      {!contacts.length ? <EmptyState icon="user" title={t('Aucun contact.')} /> : (
        <ul className="cp-list">{contacts.map((c) => (
          <li key={c.id} className="cp-item">
            <Icon name="user" />
            <div className="grow"><b>{c.name}</b> {c.isPrimary ? <Badge tone="brand">{t('Principal')}</Badge> : null} {c.isDecider ? <Badge tone="ok">{t('Décideur')}</Badge> : null}
              <div className="small muted">{[c.jobTitle, c.phone, c.email].filter(Boolean).join(' · ')}</div></div>
            {has('write') ? <><Button size="sm" onClick={() => form(c)}>{t('Modifier')}</Button>
              <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer')} onClick={() => confirm(t('Supprimer ce contact ?'), () => api('DELETE', '/contacts/' + c.id).then(reload, fail))} /></> : null}
          </li>))}</ul>
      )}
    </div>
  );
}

export default function Account360({ id, onClose }) {
  const t = useT();
  const L = useL();
  const { api, has, openOpp, bump, tick } = useCp();
  const { money, dateFr, modal } = useWs();
  const st = useLoad(() => api('GET', '/accounts/' + id), [id, tick]);
  const [tab, setTab] = useState('360');
  const refs = { customerId: id };
  const a = st.data && st.data.account;
  const reloadAll = () => { st.reload(); bump(); };
  const tabs = [
    { id: '360', label: t('Vue 360°') }, { id: 'contacts', label: t('Contacts'), count: st.data ? st.data.contacts.length : 0 }, { id: 'tasks', label: t('Tâches') }, { id: 'notes', label: t('Notes') },
    { id: 'files', label: t('Pièces jointes') }, { id: 'acts', label: t('Activités') }, { id: 'opps', label: t('Opportunités'), count: st.data ? st.data.opportunities.filter((o) => o.status === 'open').length : 0 },
  ];
  return (
    <Drawer title={a ? a.name : t('Compte')} onClose={onClose} wide>
      {st.loading && !a ? <Loading /> : st.error ? <Failed e={st.error} /> : (
        <>
          <div className="row">
            <Tag map={L.stage} k={a.stage} /><Badge>{L.kind[a.kind]}</Badge>{a.potential ? <Badge tone="info">{t('Potentiel : {p}', { p: L.potential[a.potential] })}</Badge> : null}
            {has('write') ? <Button size="sm" icon="edit" onClick={() => modal(t('Modifier le compte'), (close) => <AccountForm pre={a} close={close} onSaved={reloadAll} />, { wide: true })}>{t('Modifier')}</Button> : null}
          </div>
          <Facts items={[[t('Téléphone'), a.phone], [t('E-mail'), a.email], [t('Ville'), a.city], [t('Secteur'), a.sector], [t('Commercial'), a.owner], [t('Adresse'), a.address], [t('NIU'), a.niu], [t('Notes'), a.notes]]} />
          <div className="ui-stats">
            <Stat label={t("Chiffre d'affaires")} value={money(a.revenue)} icon="coins" />
            <Stat label={t('Factures')} value={a.invoices} icon="receipt" />
            <Stat label={t('Reste à payer')} value={money(a.owed)} icon="money" tone={a.owed > 0 ? 'warn' : 'ok'} />
            <Stat label={t('Dernier achat')} value={a.lastPurchase ? dateFr(a.lastPurchase) : '—'} icon="calendar" />
          </div>
          <Tabs items={tabs} value={tab} onChange={setTab} label={t('Fiche du compte')} />
          {tab === '360' ? <Timeline id={id} /> : null}
          {tab === 'contacts' ? <Contacts id={id} contacts={st.data.contacts} reload={reloadAll} /> : null}
          {tab === 'tasks' ? <TasksPanel refs={refs} /> : null}
          {tab === 'notes' ? <NotesPanel refs={refs} /> : null}
          {tab === 'files' ? <FilesPanel refs={refs} /> : null}
          {tab === 'acts' ? <AccountActivities id={id} refs={refs} /> : null}
          {tab === 'opps' ? (
            <div>
              {has('write') ? <div className="row"><Button size="sm" icon="plus" onClick={() => modal(t('Nouvelle opportunité'), (close) => <OppForm customerId={id} close={close} onSaved={(oid) => { reloadAll(); openOpp(oid); }} />, { wide: true })}>{t('Nouvelle opportunité')}</Button></div> : null}
              {!st.data.opportunities.length ? <EmptyState icon="bullseye" title={t('Aucune opportunité.')} /> : (
                <ul className="cp-list">{st.data.opportunities.map((o) => (
                  <li key={o.id} className="cp-item">
                    <div className="grow"><button type="button" className="cp-link" onClick={() => openOpp(o.id)}><b>{o.name}</b></button><div className="small muted">{o.stage} · {o.probability} %</div></div>
                    <b>{money(o.amount)}</b><Tag map={L.oppStatus} k={o.status} />
                  </li>))}</ul>
              )}
            </div>
          ) : null}
        </>
      )}
    </Drawer>
  );
}

/** Activités d'un compte : saisie + celles de l'historique (appel, visite, rendez-vous, message, e-mail). */
function AccountActivities({ id, refs }) {
  const { api, tick, bump } = useCp();
  const st = useLoad(() => api('GET', '/accounts/' + id + '/timeline?limit=400'), [id, tick]);
  const KINDS = ['call', 'visit', 'meeting', 'message', 'email'];
  const items = st.data ? st.data.events.filter((e) => KINDS.includes(e.type) && e.ref).map((e) => ({ id: e.ref, kind: e.type, outcome: e.outcome, note: e.title, at: e.at, by: e.by })) : [];
  return (
    <div>
      <ActivityForm refs={refs} onSaved={() => { st.reload(); bump(); }} />
      {st.error ? <Failed e={st.error} /> : <ActivityList items={items} />}
    </div>
  );
}
