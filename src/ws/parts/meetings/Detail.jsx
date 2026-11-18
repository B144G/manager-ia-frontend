import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Failed } from './Failed.jsx';
import { Alert, Badge, Button, Card, EmptyState, Field, Icon, Skeleton, Tabs } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { Minutes, Run } from './Minutes.jsx';
import { RespondForm, StatusBadges, TypeDot, fmtDay, useDownload, useLabels, useReminderLabel, useMtg } from './common.jsx';

/* Fiche d'une réunion : convocation et réponses, déroulé, compte rendu, journal. Les boutons montrés suivent les droits renvoyés par le serveur
   (rights) ; le serveur refuse de toute façon ce qui n'est pas permis. */

function CancelForm({ close, meeting, onDone }) {
  const t = useT();
  const { oapi, fail, toast } = useMtg();
  const [reason, setReason] = useState('');
  const [series, setSeries] = useState(false);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = (ev) => {
    ev.preventDefault();
    if (!reason.trim()) { setErr(t("Indiquez le motif de l'annulation.")); return; }
    setBusy(true);
    oapi('POST', `/meetings/${meeting.id}/cancel`, { reason, series, notify }).then(() => { toast(t('Réunion annulée.')); close(); onDone(); }).catch((e) => { setBusy(false); if (e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  return (
    <form className="ws-form" onSubmit={send} noValidate>
      <Field label={t("Motif de l'annulation")} required error={err}>{(p) => <textarea {...p} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}</Field>
      {meeting.seriesId ? <label className="mtg-check"><input type="checkbox" checked={series} onChange={(e) => setSeries(e.target.checked)} />{t('Annuler aussi les réunions suivantes de la série')}</label> : null}
      <label className="mtg-check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />{t('Prévenir les participants par e-mail')}</label>
      <div className="mtg-row"><Button variant="danger" type="submit" loading={busy}>{t("Annuler la réunion")}</Button><Button type="button" variant="ghost" onClick={close}>{t('Retour')}</Button></div>
    </form>
  );
}

function InviteBox({ close, meeting, onDone }) {
  const t = useT();
  const { oapi, fail } = useMtg();
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState(null);
  const go = (all) => { setBusy(all ? 'all' : 'new'); oapi('POST', `/meetings/${meeting.id}/invite`, { all }).then((r) => { setRes(r); onDone(); }).catch((e) => { fail(e); }).finally(() => setBusy('')); };
  return (
    <div className="ws-form">
      <p>{t("Chaque membre reçoit une notice dans l'application et un e-mail avec l'agenda à ajouter à son calendrier ; les invités externes reçoivent l'e-mail. Les invités sans e-mail se préviennent avec le message WhatsApp.")}</p>
      {res ? (
        <Alert tone="ok" title={t('Invitations envoyées')}>
          {t('{n} notice(s) dans l\'application, {m} e-mail(s) envoyé(s).', { n: res.notices, m: res.email.sent })}
          {!res.email.enabled ? ' ' + t("L'envoi d'e-mails n'est pas configuré sur ce serveur.") : ''}
          {res.email.capped ? ' ' + t("La limite quotidienne d'e-mails de votre offre est atteinte.") : ''}
          {res.email.failed ? ' ' + t('{n} e-mail(s) en échec.', { n: res.email.failed }) : ''}
          {res.whatsappOnly ? ' ' + t('{n} invité(s) à prévenir par WhatsApp.', { n: res.whatsappOnly }) : ''}
        </Alert>
      ) : null}
      <div className="mtg-row"><Button variant="primary" icon="paper-plane" loading={busy === 'new'} onClick={() => go(false)}>{t('Inviter ceux qui ne l\'ont pas été')}</Button><Button loading={busy === 'all'} onClick={() => go(true)}>{t('Renvoyer à tous')}</Button><Button variant="ghost" onClick={close}>{t('Fermer')}</Button></div>
    </div>
  );
}

function WhatsApp({ close, meeting }) {
  const t = useT();
  const { oapi, copy } = useMtg();
  const st = useLoad(() => oapi('GET', `/meetings/${meeting.id}/whatsapp`), []);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Skeleton lines={5} />;
  const j = st.data;
  return (
    <div className="ws-form">
      <p className="mtg-muted">{t("Message prêt à copier. Brij-IA ne l'envoie pas lui-même : copiez-le dans WhatsApp, ou ouvrez le lien d'une personne pour lui écrire directement.")}</p>
      <textarea rows={9} readOnly value={j.text} aria-label={t('Message WhatsApp')} />
      <div className="mtg-row"><Button variant="primary" icon="copy" onClick={() => copy(j.text, t('Message copié.'))}>{t('Copier le message')}</Button></div>
      {j.targets.length ? <><b>{t('Écrire à une personne')}</b><ul className="mtg-list">{j.targets.map((x) => <li key={x.participantId}><a className="ui-btn block" href={x.url} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{x.name}</a></li>)}</ul></> : <p className="mtg-muted">{t("Aucun participant n'a de numéro de téléphone.")}</p>}
      <div><Button variant="ghost" onClick={close}>{t('Fermer')}</Button></div>
    </div>
  );
}

function AddPeople({ close, detail, members, meeting, onDone }) {
  const t = useT();
  const { oapi, fail, toast } = useMtg();
  const have = new Set(detail.participants.filter((p) => p.userId).map((p) => p.userId));
  const [sel, setSel] = useState(new Set());
  const [g, setG] = useState({ name: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = (ev) => {
    ev.preventDefault(); setErr('');
    const list = [...[...sel].map((userId) => ({ userId })), ...(g.name.trim() ? [g] : [])];
    if (!list.length) { setErr(t('Choisissez au moins une personne.')); return; }
    setBusy(true);
    oapi('POST', `/meetings/${meeting.id}/participants`, { participants: list }).then(() => { toast(t('Participants ajoutés.')); close(); onDone(); }).catch((e) => { setBusy(false); if (e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  return (
    <form className="ws-form" onSubmit={save} noValidate>
      <div className="mtg-picks">{members.filter((m) => !have.has(m.userId)).map((m) => <label key={m.userId}><input type="checkbox" checked={sel.has(m.userId)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(m.userId)) n.delete(m.userId); else n.add(m.userId); return n; })} />{m.name}</label>)}</div>
      <b>{t('Invité externe')}</b>
      <Field label={t('Nom')}>{(p) => <input {...p} value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} maxLength={100} />}</Field>
      <div className="mtg-grid2">
        <Field label={t('E-mail')}>{(p) => <input {...p} type="email" inputMode="email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} />}</Field>
        <Field label={t('Téléphone')}>{(p) => <input {...p} type="tel" inputMode="tel" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} />}</Field>
      </div>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      <div className="mtg-row"><Button variant="primary" type="submit" loading={busy}>{t('Ajouter')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </form>
  );
}

function Info({ j, reload, members }) {
  const t = useT();
  const L = useLabels();
  const remLabel = useReminderLabel();
  const nav = useNavigate();
  const { oapi, modal, confirm, toast, fail, orgId } = useMtg();
  const m = j.meeting;
  const r = j.rights;
  const organizer = (members.find((x) => x.userId === m.organizerId) || {}).name;
  const respond = (p) => modal(t('Répondre à la convocation'), (close) => <RespondForm close={close} meetingId={m.id} participantId={p ? p.id : undefined} title={p ? p.name : undefined} onDone={reload} />);
  const removeP = (p) => confirm(t('Retirer {name} de la réunion ?', { name: p.name }), () => oapi('DELETE', `/meetings/${m.id}/participants/${p.id}`).then(() => { toast(t('Participant retiré.')); reload(); }).catch(fail));
  const mine = j.participants.find((p) => p.id === j.mine);
  const rmDoc = (a) => oapi('DELETE', `/meetings/${m.id}/attachments/${a.id}`).then(reload).catch(fail);
  return (
    <div className="mtg">
      {m.status === 'cancelled' ? <Alert tone="danger" title={t('Réunion annulée')}>{m.cancelReason}</Alert> : null}
      <Card title={t('Informations')}>
        <div className="mtg-facts">
          <div className="mtg-fact"><TypeDot type={m.type} /><span>{L.types[m.type]}{organizer ? ' · ' + t('organisée par {name}', { name: organizer }) : ''}</span></div>
          <div className="mtg-fact"><Icon name="calendar-days" /><span>{fmtDay(m.date)} · {m.time}–{m.endTime} ({t('{n} min', { n: m.durationMin })})</span></div>
          {m.place ? <div className="mtg-fact"><Icon name="location-dot" /><span>{m.place}</span></div> : null}
          {m.link ? <div className="mtg-fact"><Icon name="link" /><span><a href={m.link} target="_blank" rel="noopener noreferrer">{L.link[m.linkKind] || t('Lien')} — {t('Rejoindre')}</a></span></div> : null}
          <div className="mtg-fact"><Icon name="bell" /><span>{remLabel(m.reminderMin)}</span></div>
          {m.seriesFreq ? <div className="mtg-fact"><Icon name="arrows-rotate" /><span>{L.freq[m.seriesFreq]}</span></div> : null}
        </div>
        {m.objective ? <p className="mtg-pre" style={{ marginTop: 12 }}>{m.objective}</p> : null}
      </Card>

      {r.respond ? (
        <Alert tone={mine && mine.response === 'pending' ? 'warn' : 'info'} title={t('Votre réponse : {r}', { r: mine ? L.resp[mine.response] : '' })}>
          <div className="mtg-row" style={{ marginTop: 6 }}><Button size="sm" variant="primary" onClick={() => respond(null)}>{t('Répondre')}</Button>{mine && mine.reason ? <span className="mtg-muted">{mine.reason}</span> : null}</div>
        </Alert>
      ) : null}

      <Card title={t('Participants ({n})', { n: j.participants.length })} actions={r.manage ? <Button size="sm" icon="user-plus" onClick={() => modal(t('Ajouter des participants'), (close) => <AddPeople close={close} detail={j} members={members} meeting={m} onDone={reload} />)}>{t('Ajouter')}</Button> : null}>
        <ul className="mtg-list">{j.participants.map((p) => (
          <li className="mtg-person" key={p.id}>
            <span><b>{p.name}</b> {p.kind === 'guest' ? <Badge tone="outline">{t('Invité')}</Badge> : null}{!p.required ? <Badge tone="outline">{t('Facultatif')}</Badge> : null}
              <small>{[p.email, p.phone].filter(Boolean).join(' · ')}{p.reason ? (p.email || p.phone ? ' · ' : '') + p.reason : ''}</small></span>
            <span className="mtg-row">
              <Badge tone={p.response === 'present' ? 'ok' : p.response === 'pending' ? 'warn' : 'neutral'}>{L.resp[p.response]}</Badge>
              {r.manage && p.kind === 'guest' && m.status !== 'cancelled' ? <Button size="sm" variant="ghost" onClick={() => respond(p)}>{t('Réponse reçue')}</Button> : null}
              {r.manage && p.userId !== m.organizerId ? <Button size="sm" variant="ghost" iconOnly label={t('Retirer')} icon="xmark" onClick={() => removeP(p)} /> : null}
            </span>
          </li>
        ))}</ul>
      </Card>

      <Card title={t("Ordre du jour")}>
        {j.agenda.length ? <ol className="mtg-pre" style={{ margin: 0, paddingLeft: 20 }}>{j.agenda.map((a) => <li key={a.id}><b>{a.title}</b><span className="mtg-muted">{a.owner ? ' — ' + a.owner : ''}{a.durationMin ? ' · ' + t('{n} min', { n: a.durationMin }) : ''}</span></li>)}</ol> : <p className="mtg-muted">{t("Pas d'ordre du jour.")}</p>}
      </Card>

      <Card title={t('Pièces jointes')}>
        {j.attachments.length ? <ul className="mtg-list">{j.attachments.map((a) => (
          <li className="mtg-person" key={a.id}><span><b>{a.name}</b><small>{t('Dans la Bibliothèque')}</small></span>
            <span className="mtg-row"><Button size="sm" onClick={() => nav(`/app/${orgId}/library`)}>{t('Ouvrir la Bibliothèque')}</Button>{r.manage ? <Button size="sm" variant="ghost" iconOnly label={t('Retirer')} icon="xmark" onClick={() => rmDoc(a)} /> : null}</span></li>
        ))}</ul> : <p className="mtg-muted">{t('Aucune pièce jointe.')}</p>}
      </Card>
    </div>
  );
}

function LogTab({ id }) {
  const t = useT();
  const { oapi } = useMtg();
  const st = useLoad(() => oapi('GET', `/meetings/${id}/log`), [id]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Skeleton lines={5} />;
  const ACT = { convened: t('Convocation'), updated: t('Convocation modifiée'), agenda: t("Ordre du jour"), cancelled: t('Annulation'), held: t('Réunion tenue'), response: t('Réponse'), participants: t('Participants'), invited: t('Invitations'),
    update_sent: t('Convocation renvoyée'), cancel_sent: t("Annulation envoyée"), whatsapp: t('Message WhatsApp'), attachment: t('Pièce jointe'), notes: t('Notes'), decision: t('Décision'), action: t('Action'), action_status: t("Statut d'action"),
    submitted: t('Soumission'), validated: t('Validation'), returned: t('Renvoi'), reopened: t('Nouvelle version'), diffused: t('Diffusion'), pdf: t('Export PDF'), reminder: t('Rappel'), deleted: t('Suppression') };
  if (!st.data.log.length) return <EmptyState icon="clock" title={t('Journal vide')} />;
  return (
    <Card title={t('Qui a fait quoi')} subtitle={t('Journal de traçabilité de la réunion : convocation, modifications, publication, validation, réouverture.')}>
      <ul className="mtg-list">{st.data.log.map((l) => (
        <li className="mtg-person" key={l.id}><span><b>{ACT[l.action] || l.action}</b><small>{l.detail}</small></span><small className="mtg-muted">{l.who}<br />{new Date(l.at).toLocaleString(document.documentElement.lang || 'fr')}</small></li>
      ))}</ul>
    </Card>
  );
}

export default function Detail({ id, back, edit, members }) {
  const t = useT();
  const { oapi, modal, confirm, toast, fail } = useMtg();
  const dl = useDownload();
  const [tab, setTab] = useState('info');
  const st = useLoad(() => oapi('GET', `/meetings/${id}`), [id]);
  const j = st.data;
  if (st.error) return <><Failed e={st.error} /><div style={{ marginTop: 12 }}><Button onClick={back}>{t('Retour au calendrier')}</Button></div></>;
  if (!j) return <Skeleton lines={8} />;
  const m = j.meeting;
  const r = j.rights;
  const remove = () => confirm(t('Supprimer cette réunion ? Cette action est définitive.'), () => oapi('DELETE', `/meetings/${m.id}`).then(() => { toast(t('Réunion supprimée.')); back(); }).catch(fail));
  const tabs = [
    { id: 'info', label: t('Convocation') },
    { id: 'run', label: t('Déroulé') },
    { id: 'minutes', label: t('Compte rendu'), count: m.minutesStatus === 'submitted' && r.decide ? 1 : 0 },
    { id: 'log', label: t('Journal') },
  ];
  return (
    <div className="mtg">
      <div className="mtg-head">
        <div className="mtg-row"><Button size="sm" variant="ghost" icon="chevron-left" onClick={back}>{t('Retour')}</Button></div>
        <h2>{m.title}</h2>
        <div className="mtg-row"><StatusBadges m={m} /></div>
        <div className="mtg-row">
          {r.manage ? <Button size="sm" icon="pen" onClick={() => edit(m.id)}>{t('Modifier')}</Button> : null}
          {r.manage && m.status !== 'cancelled' ? <Button size="sm" icon="paper-plane" onClick={() => modal(t('Envoyer les invitations'), (close) => <InviteBox close={close} meeting={m} onDone={st.reload} />)}>{t('Inviter')}</Button> : null}
          {r.manage && m.status !== 'cancelled' ? <Button size="sm" icon="whatsapp" onClick={() => modal(t('Message WhatsApp'), (close) => <WhatsApp close={close} meeting={m} />)}>WhatsApp</Button> : null}
          <Button size="sm" icon="calendar-check" onClick={() => dl(`/${m.id}/ics`, 'reunion.ics')}>{t('Ajouter à mon agenda')}</Button>
          {r.cancel ? <Button size="sm" variant="danger-outline" onClick={() => modal(t('Annuler la réunion'), (close) => <CancelForm close={close} meeting={m} onDone={st.reload} />)}>{t('Annuler la réunion')}</Button> : null}
          {r.remove ? <Button size="sm" variant="ghost" icon="trash" onClick={remove}>{t('Supprimer')}</Button> : null}
        </div>
      </div>
      <Tabs items={tabs} value={tab} onChange={setTab} label={t('Sections de la réunion')} />
      {tab === 'info' ? <Info j={j} reload={st.reload} members={members} /> : null}
      {tab === 'run' ? <Run key={m.minutesStatus + m.minutesVersion + (r.write ? 'w' : 'r')} j={j} reload={st.reload} /> : null}
      {tab === 'minutes' ? <Minutes j={j} reload={st.reload} members={members} goRun={() => setTab('run')} /> : null}
      {tab === 'log' ? <LogTab id={m.id} /> : null}
    </div>
  );
}
