import { useMemo, useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, Field, Icon, Segmented } from '../../ui/index.jsx';

/* Réunions : constantes, libellés traduits et petits outils communs aux écrans. Les droits sont décidés par le serveur ; ces écrans les reflètent. */

export const TYPE_IDS = ['direction', 'team', 'site', 'client', 'committee', 'other'];
export const ROLE_IDS = ['member', 'manager', 'admin'];
export const ROLE_IDS_Q = ['member', 'manager', 'admin', 'owner'];
export const URGENCY_IDS = ['normal', 'urgent', 'critical'];
export const MAJORITY_IDS = ['simple', 'qualified', 'unanimity'];
export const VOTE_MODE_IDS = ['named', 'secret', 'hand'];

export function useLabels() {
  const t = useT();
  return useMemo(() => ({
    types: { direction: t('Direction'), team: t('Équipe'), site: t('Chantier'), client: t('Client'), committee: t('Comité'), other: t('Autre') },
    roles: { member: t('Membres'), manager: t('Responsables'), admin: t('Administrateurs') },
    role1: { member: t('Membre'), manager: t('Responsable'), admin: t('Administrateur') },
    status: { planned: t('Prévue'), held: t('Tenue'), cancelled: t('Annulée'), no_quorum: t('Sans quorum') },
    minutes: { none: t('Pas de compte rendu'), draft: t('Brouillon'), submitted: t('À valider'), validated: t('Validé') },
    resp: { pending: t('Sans réponse'), present: t('Présent'), absent: t('Absent'), excused: t('Excusé') },
    freq: { weekly: t('Chaque semaine'), biweekly: t('Toutes les 2 semaines'), monthly: t('Chaque mois'), quarterly: t('Chaque trimestre') },
    urgency: { normal: t('Normale'), urgent: t('Urgente'), critical: t('Critique') },
    resStatus: { pending: t('En attente'), adopted: t('Adoptée'), rejected: t('Rejetée'), postponed: t('Reportée'), no_quorum: t('Sans quorum') },
    majority: { simple: t('Majorité simple'), qualified: t('Majorité qualifiée'), unanimity: t('Unanimité') },
    voteMode: { named: t('Nominatif'), secret: t('Secret'), hand: t('À main levée') },
    choice: { for: t('Pour'), against: t('Contre'), abstain: t('Abstention') },
    agendaKind: { info: t('Information'), discuss: t('Discussion'), decide: t('Décision') },
    role: { organizer: t('Organisateur'), secretary: t('Secrétaire de séance'), chair: t('Président de séance'), assignee: t('Responsable'), carrier: t('Porteur') },
    roles4: { member: t('Membre'), manager: t('Responsable'), admin: t('Administrateur'), owner: t('Propriétaire') },
    action: { open: t('À faire'), done: t('Faite'), cancelled: t('Annulée') },
    link: { meet: 'Google Meet', zoom: 'Zoom', teams: 'Teams', jitsi: 'Jitsi Meet', whatsapp: 'WhatsApp', other: t('Lien') },
  }), [t]);
}
export const REMINDERS = [0, 15, 30, 60, 120, 1440, 2880];
export function useReminderLabel() {
  const t = useT();
  return (m) => (m === 0 ? t('Aucun rappel') : m < 60 ? t('{n} min avant', { n: m }) : m < 1440 ? t('{n} h avant', { n: m / 60 }) : t('{n} jour(s) avant', { n: m / 1440 }));
}

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
export const todayLocal = () => iso(new Date());
export const fmtDay = (s, o = { weekday: 'long', day: 'numeric', month: 'long' }) => (s ? parseDay(s).toLocaleDateString(getLocale(), o) : '');
export const fmtShort = (s) => fmtDay(s, { weekday: 'short', day: 'numeric', month: 'short' });
export const mondayOf = (s) => { const d = parseDay(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };

export function DateTile({ date }) {
  const d = parseDay(date);
  return <span className="mtg-date" aria-hidden="true"><b>{d.getDate()}</b><small>{d.toLocaleDateString(getLocale(), { month: 'short' })}</small></span>;
}
export function TypeDot({ type }) { return <span className={'mtg-dot t-' + type} aria-hidden="true" />; }

export function StatusBadges({ m }) {
  const t = useT();
  const L = useLabels();
  const mt = { none: null, draft: 'warn', submitted: 'info', validated: 'ok' }[m.minutesStatus];
  return (
    <>
      <Badge tone={m.status === 'cancelled' || m.status === 'no_quorum' ? 'danger' : m.status === 'held' ? 'ok' : 'brand'}>{L.status[m.status]}</Badge>
      {m.urgency && m.urgency !== 'normal' ? <Badge tone={m.urgency === 'critical' ? 'danger' : 'warn'}><Icon name="bolt" />{L.urgency[m.urgency]}</Badge> : null}
      {m.archivedAt ? <Badge tone="outline"><Icon name="folder-open" />{t('Archivée')}</Badge> : null}
      {mt ? <Badge tone={mt}>{L.minutes[m.minutesStatus]}</Badge> : null}
      {m.confidential ? <Badge tone="outline"><Icon name="lock" />{t('Confidentielle')}</Badge> : null}
    </>
  );
}

/** Téléchargement d'un fichier du module (PDF, CSV, agenda) avec le cookie de connexion. */
export function useDownload() {
  const t = useT();
  const { orgId, fail } = useMtg();
  return (path, name) => fetch(API_BASE + '/api/ws/orgs/' + orgId + '/meetings' + path, { credentials: 'include' })
    .then(async (r) => { if (!r.ok) { let m = t('Téléchargement impossible.'); try { m = (await r.json()).error || m; } catch { /* corps non JSON */ } throw new Error(m); } return r.blob(); })
    .then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }).catch(fail);
}

/** Membres de l'organisation (noms), pour les listes de choix. */
export function useMembers() {
  const { oapi } = useWs();
  return oapi('GET', '/members');
}

/** Fenêtre de réponse à une convocation : présent, absent ou excusé (motif obligatoire hors « présent »). */
export function RespondForm({ close, onDone, meetingId, participantId, title }) {
  const t = useT();
  const { oapi, toast, fail } = useMtg();
  const [response, setResponse] = useState('present');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = (ev) => {
    ev.preventDefault();
    if (response !== 'present' && !reason.trim()) { setErr(t('Indiquez le motif.')); return; }
    setBusy(true);
    oapi('POST', `/meetings/${meetingId}/respond`, { response, reason: reason.trim(), participantId }).then(() => { toast(t('Réponse enregistrée.')); close(); onDone(); }).catch((e) => { setBusy(false); if (e && e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  return (
    <form className="ws-form" onSubmit={send} noValidate>
      {title ? <p className="mtg-muted">{title}</p> : null}
      <Segmented label={t('Votre réponse')} value={response} onChange={setResponse} items={[{ id: 'present', label: t('Présent') }, { id: 'excused', label: t('Excusé') }, { id: 'absent', label: t('Absent') }]} />
      {response !== 'present' ? <Field label={t('Motif')} required error={err}>{(p) => <input {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}</Field> : null}
      <div className="mtg-row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </form>
  );
}

/** Fenêtre qui demande un motif (annulation, renvoi, nouvelle version…). */
export function ReasonForm({ close, label, submit, onDone, danger, optional }) {
  const t = useT();
  const { fail } = useMtg();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = (ev) => {
    ev.preventDefault();
    if (!optional && !reason.trim()) { setErr(t('Indiquez le motif.')); return; }
    setBusy(true);
    Promise.resolve(submit(reason.trim())).then(() => { close(); onDone && onDone(); }).catch((e) => { setBusy(false); if (e && e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  return (
    <form className="ws-form" onSubmit={send} noValidate>
      <Field label={label} required={!optional} error={err}>{(p) => <textarea {...p} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}</Field>
      <div className="mtg-row"><Button variant={danger ? 'danger' : 'primary'} type="submit" loading={busy}>{t('Confirmer')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </form>
  );
}

/** useWs() dont les erreurs affichées (toast) sont traduites si le serveur les a fabriquées en français. */
export function useMtg() {
  const ws = useWs();
  return { ...ws, fail: (e) => ws.fail(e && e.message ? Object.assign(new Error(tsrv(e.message)), { status: e.status, code: e.code }) : e) };
}
