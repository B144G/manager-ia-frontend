import { useEffect, useState } from 'react';
import { rq } from '../../../lib/api.js';
import { Icon } from '../../../lib/fa.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Button } from '../../ui/index.jsx';
import { useWs } from '../../WsContext.jsx';
import { Msg, Note, PasswordInput } from '../../../privacy/kit.jsx';
import { useFlash } from '../../../privacy/util.jsx';
import '../../../privacy/icons.js';

/* Transférer la propriété d'une organisation / la supprimer. Le serveur contrôle tout (propriétaire, nom exact, mot de passe, règle de l'organisation principale) : ces fenêtres expliquent et guident. */
const W = (id, path) => `/api/ws/orgs/${id}${path}`;
const COUNT_LABEL = {
  customers: 'Clients', products: 'Articles de stock', entries: 'Écritures comptables', documents: 'Devis, factures et autres documents', employees: 'Salariés', projects: 'Projets', tasks: 'Tâches', tickets: 'Demandes clients',
  messages: 'Messages de discussion', files: 'Fichiers déposés', branches: 'Antennes',
};

/** Ouvre les fenêtres de transfert et de suppression. `done(kind, org)` est appelé après un succès. */
export function useOrgActions(done) {
  const { modal, toast, boot, orgId, loadOrg } = useWs();
  const t = useT();
  const transfer = (org) => modal(t('Transférer la propriété de « {name} »', { name: org.name }), (close) => <TransferBody org={org} close={close} onDone={() => { toast(t('Propriété transférée.')); if (org.id === orgId) loadOrg(orgId, 'entreprise', true); if (done) done('transfer', org); }} />, { wide: true });
  const remove = (org) => modal(t('Supprimer « {name} »', { name: org.name }), (close) => <DeleteBody org={org} close={close} onTransfer={() => { close(); transfer(org); }} onDone={(j) => { toast(j.companyDeleted ? t('Organisation supprimée, avec son entreprise.') : t('Organisation supprimée.')); if (done) done('delete', org); if (org.id === orgId) { window.history.replaceState(null, '', '/app'); boot(); } }} />, { wide: true });
  return { transfer, remove };
}

function TransferBody({ org, close, onDone }) {
  const t = useT();
  const { fail } = useWs();
  const [members, setMembers] = useState(null);
  const [to, setTo] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false);
  const { flash, bad, clear } = useFlash();
  useEffect(() => { rq('GET', W(org.id, '/members')).then((j) => setMembers(j.members.filter((m) => m.role !== 'owner')), (e) => { fail(e); close(); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!members) return <p className="ws-empty" role="status">{t('Chargement…')}</p>;
  if (!members.length) return <Note tone="warn">{t('Personne d’autre ne fait partie de cette organisation. Invitez d’abord la personne à qui transférer la propriété (page Équipe).')}</Note>;
  const submit = async (e) => {
    e.preventDefault(); clear(); setBusy(true);
    try { await rq('POST', W(org.id, '/ownership-transfer'), { userId: Number(to || members[0].userId), confirm: name }); close(); onDone(); } catch (er) { bad(new Error(tsrv(er.message))); }
    setBusy(false);
  };
  return (
    <form className="pv-form" style={{ maxWidth: 'none' }} noValidate onSubmit={submit}>
      <Note tone="warn"><b>{t('Ce qui change')}</b>
        <p>{t('La personne choisie devient propriétaire : elle seule pourra supprimer l’organisation ou la transférer à son tour. Vous devenez administrateur et gardez l’accès à l’organisation.')}</p>
        <p>{t('Son offre doit pouvoir porter l’organisation (personnes, antennes, organisations). Si l’organisation est la principale de l’entreprise, la gestion de l’entreprise et de ses organisations liées la suit.')}</p></Note>
      <label className="pv-field" htmlFor="tr_to"><span>{t('Nouveau propriétaire')}</span>
        <select id="tr_to" className="pv-in" value={to || String(members[0].userId)} onChange={(e) => setTo(e.target.value)}>{members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select></label>
      <label className="pv-field" htmlFor="tr_name"><span>{t('Pour confirmer, écrivez le nom exact de l’organisation')}</span><input id="tr_name" className="pv-in" autoComplete="off" placeholder={org.name} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="pv-act"><Button variant="primary" type="submit" icon="pv-swap" loading={busy} disabled={name !== org.name}>{t('Transférer la propriété')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
      <Msg f={flash} />
    </form>
  );
}

function DeleteBody({ org, close, onDone, onTransfer }) {
  const t = useT();
  const { fail } = useWs();
  const [imp, setImp] = useState(null);
  const [name, setName] = useState(''); const [pass, setPass] = useState(''); const [busy, setBusy] = useState(false);
  const { flash, bad, clear } = useFlash();
  useEffect(() => { rq('GET', W(org.id, '/deletion-impact')).then(setImp, (e) => { fail(e); close(); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!imp) return <p className="ws-empty" role="status">{t('Chargement…')}</p>;
  if (imp.blocked) {
    return (
      <div className="pv-form" style={{ maxWidth: 'none' }}>
        <Note tone="danger"><b>{t('Cette organisation ne peut pas être supprimée maintenant')}</b>
          <p>{t('« {name} » est l’organisation principale de votre entreprise : elle porte l’abonnement, la direction générale et les organisations liées. Tant que des organisations y sont liées, la supprimer les laisserait sans entreprise.', { name: org.name })}</p></Note>
        <p>{t('Organisations liées :')}</p>
        <ul>{imp.linked.map((l) => <li key={l.id}>{l.name}</li>)}</ul>
        <p className="muted">{t('Deux solutions : transférer la propriété de l’organisation principale à une personne de confiance, ou supprimer d’abord chaque organisation liée (depuis le tableau des organisations, par son propriétaire).')}</p>
        <div className="pv-act"><Button variant="primary" icon="pv-swap" onClick={onTransfer}>{t('Transférer la propriété')}</Button><Button variant="ghost" onClick={close}>{t('Fermer')}</Button></div>
      </div>
    );
  }
  const rows = Object.entries(COUNT_LABEL).map(([k, l]) => [k, l, imp.counts[k]]).filter((r) => r[2] > 0);
  const submit = async (e) => {
    e.preventDefault(); clear(); setBusy(true);
    try { const j = await rq('DELETE', W(org.id, ''), { confirm: name, password: pass }); close(); onDone(j); } catch (er) { bad(new Error(tsrv(er.message))); }
    setBusy(false);
  };
  return (
    <form className="pv-form" style={{ maxWidth: 'none' }} noValidate onSubmit={submit}>
      <Note tone="danger" icon="pv-warn"><b>{t('Cette action est irréversible.')}</b> <span>{t('Tout ce qui suit sera effacé définitivement, sans possibilité de le récupérer. Pensez à exporter vos données avant (Confidentialité › Organisation).')}</span></Note>
      <div>
        <p style={{ margin: '0 0 var(--sp-2)', fontWeight: 600 }}>{t('Ce qui sera effacé avec « {name} »', { name: org.name })}</p>
        <ul className="og-impact">
          {rows.map(([k, l, n]) => <li key={k}><span>{t(l)}</span><b>{n.toLocaleString()}</b></li>)}
          {imp.counts.whatsapp ? <li><span>{t('Session WhatsApp (déconnectée)')}</span><b>1</b></li> : null}
          <li><span>{t('Comptabilité, équipe, discussions et réglages')}</span><b>{t('tout')}</b></li>
        </ul>
        {imp.peopleLosingAccess ? <p className="muted small" style={{ marginTop: 'var(--sp-2)' }}>{t('{n} personne(s) perdront l’accès à cette organisation.', { n: imp.peopleLosingAccess })}</p> : null}
      </div>
      {imp.lastOfCompany ? <Note tone="warn">{t('C’est la dernière organisation de votre entreprise : l’entreprise elle-même (structure, direction générale, personnes et liens d’association) est supprimée avec elle.')}</Note> : <Note>{t('Les autres organisations de l’entreprise ne sont pas touchées.')}</Note>}
      <label className="pv-field" htmlFor="del_name"><span>{t('Pour confirmer, écrivez le nom exact de l’organisation')}</span><input id="del_name" className="pv-in" autoComplete="off" placeholder={org.name} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <PasswordInput id="del_pass" label={t('Votre mot de passe')} value={pass} onChange={setPass} />
      <div className="pv-act"><Button variant="danger" type="submit" icon="pv-trash" loading={busy} disabled={name !== org.name || !pass}>{t('Supprimer définitivement')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
      <Msg f={flash} />
    </form>
  );
}

/** Zone « Danger » de l'organisation courante (propriétaire seulement). */
export function DangerZone({ org, done }) {
  const t = useT();
  const { transfer, remove } = useOrgActions(done);
  return (
    <section className="org-danger" aria-labelledby="org-danger-h">
      <h2 id="org-danger-h"><Icon name="pv-warn" />{t('Zone de danger')}</h2>
      <div className="pv-rows">
        <div className="pv-row"><div><b>{t('Transférer la propriété')}</b><small>{t('Une autre personne de l’équipe devient propriétaire ; vous devenez administrateur.')}</small></div><Button onClick={() => transfer(org)}>{t('Transférer…')}</Button></div>
        <div className="pv-row"><div><b>{t('Supprimer cette organisation')}</b><small>{t('Efface définitivement les clients, le stock, la comptabilité, l’équipe, les discussions et les fichiers. Mot de passe et nom exact demandés.')}</small></div><Button variant="danger-outline" icon="pv-trash" onClick={() => remove(org)}>{t('Supprimer…')}</Button></div>
      </div>
    </section>
  );
}
