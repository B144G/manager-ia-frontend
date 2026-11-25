import { useState } from 'react';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, Card, EmptyState, Loaded, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import { AUDIT } from './audit.js';
import { NewSpace } from './Spaces.jsx';

const day = (iso) => { try { return new Date(iso).toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; } };
export const TYPE_LABEL = { client: 'Client', fournisseur: 'Fournisseur', sous_traitant: 'Sous-traitant', transporteur: 'Transporteur', distributeur: 'Distributeur', cabinet_comptable: 'Cabinet comptable', strategique: 'Partenaire stratégique' };
const STATUS = { invited: 'Invitation envoyée', awaiting: 'En attente de confirmation', active: 'Actif', revoked: 'Révoqué', declined: 'Refusé', cancelled: 'Annulé', expired: 'Expiré' };
const typeOpts = () => Object.keys(TYPE_LABEL);

/* Partenaires : invitation à usage unique, confirmation des deux côtés, types, durée, révocation, journal visible des deux côtés. */
export default function Partners({ onSpace }) {
  const { oapi, modal, confirm, fail, toast, orgId } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/partners'), [orgId]);
  const run = (p, msg) => p.then(() => { if (msg) toast(msg); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Card title={t('Partenaires')} subtitle={t("{n} partenaire(s) possible(s) avec votre abonnement ({per} par type).", { n: j.limits.partners, per: j.limits.perType })}
          actions={j.canManage ? <><Button variant="primary" icon="plus" onClick={() => modal(t('Inviter un partenaire'), (close) => <Invite types={typeOpts()} done={(r) => { close(); st.reload(); modal(t('Code de partenariat'), () => <Code r={r} />); }} />)}>{t('Inviter un partenaire')}</Button>
            <Button icon="link" onClick={() => modal(t("J'ai un code de partenariat"), (close) => <Join done={() => { close(); st.reload(); }} />)}>{t("J'ai un code")}</Button></> : null}>
          {j.partners.length === 0 ? <EmptyState icon="handshake" title={t("Aucun partenaire pour l'instant")}>{t("Invitez un client, un fournisseur, un transporteur… Le partenariat n'est actif qu'après confirmation des deux côtés, et il ne partage que ce que vous choisissez.")}</EmptyState> : (
            <ul className="ent-list">{j.partners.map((p) => (
              <li className="ent-person" key={p.id}>
                <div className="ent-person-h"><div><b>{p.partner ? p.partner.company : (p.label || t('Invitation'))}</b>
                  <div className="muted small">{t('Vous : {mine} · Eux : {theirs}', { mine: p.myType ? tsrv(TYPE_LABEL[p.myType]) : '—', theirs: p.theirType ? tsrv(TYPE_LABEL[p.theirType]) : '—' })}{p.endsAt ? ' · ' + t("jusqu'au {date}", { date: day(p.endsAt) }) : ''}</div></div>
                  <Badge tone={p.status === 'active' ? 'ok' : p.status === 'awaiting' || p.status === 'invited' ? 'warn' : 'neutral'}>{tsrv(STATUS[p.status])}</Badge></div>
                {p.theirContact && p.theirContact.name ? <div className="muted small">{t('Contact : {c}', { c: [p.theirContact.name, p.theirContact.email, p.theirContact.phone].filter(Boolean).join(' · ') })}</div> : null}
                {j.canManage ? (
                  <div className="ent-actions">
                    {p.needsMyConfirmation ? <><Button size="sm" variant="primary" icon="circle-check" onClick={() => run(oapi('POST', `/partners/${p.id}/confirm`), t('Partenariat confirmé : un canal a été créé.'))}>{t('Confirmer')}</Button>
                      <Button size="sm" onClick={() => confirm(t('Refuser ce partenariat ?'), () => run(oapi('POST', `/partners/${p.id}/decline`)), t('Refuser'))}>{t('Refuser')}</Button></> : null}
                    {p.status === 'invited' && p.mine === 'a' ? <Button size="sm" variant="ghost" icon="trash" onClick={() => run(oapi('DELETE', `/partners/${p.id}`), t('Invitation annulée.'))}>{t("Annuler l'invitation")}</Button> : null}
                    {p.status === 'active' ? <Button size="sm" icon="plus" onClick={() => modal(t('Nouvel espace partagé'), (close) => <NewSpace partnerId={p.id} done={(id) => { close(); if (onSpace) onSpace(id); }} />, { wide: true })}>{t('Nouvel espace partagé')}</Button> : null}
                    {['active', 'awaiting'].includes(p.status) ? <Button size="sm" variant="ghost" icon="ban" onClick={() => modal(t('Mettre fin au partenariat'), (close) => <Revoke id={p.id} done={() => { close(); st.reload(); }} />)}>{t('Mettre fin')}</Button> : null}
                    <Button size="sm" variant="ghost" icon="history" onClick={() => modal(t('Journal du partenariat'), () => <Log id={p.id} />)}>{t('Journal')}</Button>
                  </div>
                ) : <div className="ent-actions"><Button size="sm" variant="ghost" icon="history" onClick={() => modal(t('Journal du partenariat'), () => <Log id={p.id} />)}>{t('Journal')}</Button></div>}
              </li>
            ))}</ul>
          )}
        </Card>
      </>
    )}</Loaded>
  );
}

function Invite({ types, done }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const [v, setV] = useState({ type: 'client', label: '', days: '7', durationDays: '', name: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); setBusy(true); oapi('POST', '/partners/invite', { type: v.type, label: v.label, days: Number(v.days), durationDays: v.durationDays ? Number(v.durationDays) : null, contact: { name: v.name, email: v.email, phone: v.phone } }).then(done).catch(fail).finally(() => setBusy(false)); }}>
      <label className="fld"><span>{t('Ce partenaire est pour vous un…')}</span><select value={v.type} onChange={(e) => set('type', e.target.value)}>{types.map((k) => <option key={k} value={k}>{tsrv(TYPE_LABEL[k])}</option>)}</select></label>
      <label className="fld"><span>{t('Nom du partenaire')} <small>({t('facultatif')})</small></span><input value={v.label} onChange={(e) => set('label', e.target.value)} /></label>
      <div className="ent-two">
        <label className="fld"><span>{t("Validité de l'invitation")}</span><select value={v.days} onChange={(e) => set('days', e.target.value)}><option value="3">{t('3 jours')}</option><option value="7">{t('7 jours')}</option><option value="14">{t('14 jours')}</option><option value="30">{t('30 jours')}</option></select></label>
        <label className="fld"><span>{t('Durée du partenariat')}</span><select value={v.durationDays} onChange={(e) => set('durationDays', e.target.value)}><option value="">{t('Sans limite')}</option><option value="90">{t('3 mois')}</option><option value="180">{t('6 mois')}</option><option value="365">{t('1 an')}</option><option value="730">{t('2 ans')}</option></select></label>
      </div>
      <fieldset className="ent-legal"><legend>{t('Votre contact pour ce partenariat')} <small>({t('facultatif')})</small></legend>
        <label className="fld"><span>{t('Nom')}</span><input value={v.name} onChange={(e) => set('name', e.target.value)} /></label>
        <div className="ent-two"><label className="fld"><span>{t('E-mail')}</span><input type="email" value={v.email} onChange={(e) => set('email', e.target.value)} /></label><label className="fld"><span>{t('Téléphone')}</span><input value={v.phone} onChange={(e) => set('phone', e.target.value)} /></label></div></fieldset>
      <div className="row"><Button variant="primary" type="submit" loading={busy}>{t("Créer l'invitation")}</Button></div>
    </form>
  );
}
function Code({ r }) {
  const { copy } = useWs();
  const t = useT();
  return (
    <div className="ws-form">
      <p><b>{t('Copiez ce code maintenant : il ne sera plus affiché.')}</b></p>
      <div className="ent-code"><code>{r.code}</code><Button size="sm" icon="copy" onClick={() => copy(r.code, t('Code de partenariat copié.'))}>{t('Copier le code')}</Button></div>
      <p className="muted">{t("Transmettez-le à votre partenaire : il le saisit dans « J'ai un code » (administrateur de son entreprise). Il expire le {date}, ne sert qu'une fois, et vous devrez confirmer.", { date: day(r.expiresAt) })}</p>
    </div>
  );
}
function Join({ done }) {
  const { oapi, fail, toast } = useWs();
  const t = useT();
  const [code, setCode] = useState(''); const [pv, setPv] = useState(null); const [type, setType] = useState('client'); const [busy, setBusy] = useState(false);
  const preview = (e) => { e.preventDefault(); setBusy(true); oapi('POST', '/partners/preview', { code }).then(setPv).catch(fail).finally(() => setBusy(false)); };
  if (!pv) return (
    <form className="ws-form" noValidate onSubmit={preview}>
      <label className="fld"><span>{t('Code de partenariat')}</span><input value={code} autoFocus autoCapitalize="characters" onChange={(e) => setCode(e.target.value)} placeholder="PART-XXXXXX-…" /></label>
      <div className="row"><Button variant="primary" type="submit" loading={busy}>{t('Vérifier le code')}</Button></div>
    </form>
  );
  return (
    <div className="ws-form">
      <p><b>{pv.company}</b> {t('vous invite à devenir partenaire : ils vous voient comme leur {type}.', { type: tsrv(TYPE_LABEL[pv.theirView] || '').toLowerCase() })}</p>
      <label className="fld"><span>{t('Ce partenaire est pour vous un…')}</span><select value={type} onChange={(e) => setType(e.target.value)}>{typeOpts().map((k) => <option key={k} value={k}>{tsrv(TYPE_LABEL[k])}</option>)}</select></label>
      <p className="muted small">{t("Le partenariat sera actif quand {company} aura confirmé. Rien n'est partagé sans votre accord, objet par objet.", { company: pv.company })}</p>
      <div className="row"><Button variant="primary" loading={busy} onClick={() => { setBusy(true); oapi('POST', '/partners/join', { code, type }).then(() => { toast(t('Demande envoyée : en attente de confirmation.')); done(); }).catch(fail).finally(() => setBusy(false)); }}>{t('Accepter le partenariat')}</Button></div>
    </div>
  );
}
function Revoke({ id, done }) {
  const { oapi, fail, toast } = useWs();
  const t = useT();
  const [reason, setReason] = useState('');
  return (
    <div className="ws-form">
      <p>{t("Les espaces partagés passent en lecture seule et l'accès aux documents et réunions partagés est coupé tout de suite. L'historique des discussions reste lisible.")}</p>
      <label className="fld"><span>{t('Motif')} <small>({t('facultatif')})</small></span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="row"><Button variant="primary" onClick={() => oapi('POST', `/partners/${id}/revoke`, { reason }).then(() => { toast(t('Partenariat terminé.')); done(); }).catch(fail)}>{t('Mettre fin au partenariat')}</Button></div>
    </div>
  );
}
function Log({ id }) {
  const { oapi } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', `/partners/${id}`), [id]);
  return <Loaded state={st}>{(j) => <ul className="ent-log">{j.log.length === 0 ? <li className="muted">{t('Aucun événement.')}</li> : j.log.map((l, i) => <li key={i}><b>{tsrv(AUDIT[l.action] || l.action)}</b> <span className="muted">{l.detail} · {l.name || ''} · {l.org || ''} · {day(l.at)}</span></li>)}</ul>}</Loaded>;
}
