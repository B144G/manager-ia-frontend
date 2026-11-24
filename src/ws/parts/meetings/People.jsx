import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Failed } from './Failed.jsx';
import { Alert, Badge, Button, Card, EmptyState, Field, Icon, Segmented, Skeleton, Stat, Tabs } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { fmtShort, useMtg } from './common.jsx';
import '../../../styles/ws-meetings-adv-a.css';

/* Suivi des personnes : performances (engagements, présence, ponctualité, résolutions, rôles) et historique des responsabilités.
   Le serveur décide de la portée : un simple membre ne voit que son propre suivi. Aucun message n'est envoyé sans action humaine. */

const yearStart = () => `${new Date().getFullYear()}-01-01`;
const yearEnd = () => `${new Date().getFullYear()}-12-31`;
const pct = (v) => (v === null || v === undefined ? '—' : v + ' %');

export default function People({ openMeeting }) {
  const t = useT();
  const [tab, setTab] = useState('perf');
  return (
    <div className="mtg">
      <Tabs label={t('Suivi des personnes')} value={tab} onChange={setTab} items={[{ id: 'perf', label: t('Performances'), icon: 'chart-line' }, { id: 'hist', label: t('Historique des responsabilités'), icon: 'clock-rotate-left' }]} />
      {tab === 'perf' ? <Performance openMeeting={openMeeting} /> : <History openMeeting={openMeeting} />}
    </div>
  );
}

function usePeopleList(enabled) {
  const { oapi } = useMtg();
  const mem = useLoad(() => (enabled ? oapi('GET', '/members') : Promise.resolve({ members: [] })), [enabled]);
  return (mem.data && mem.data.members) || [];
}

function PersonSelect({ value, onChange, members, label }) {
  const t = useT();
  return (
    <Field label={label}>{(p) => (
      <select {...p} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("Toute l'équipe")}</option>
        {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </select>
    )}</Field>
  );
}

function Performance({ openMeeting }) {
  const t = useT();
  const { oapi, toast, fail, modal } = useMtg();
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(yearEnd);
  const [userId, setUserId] = useState('');
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  if (userId) q.set('userId', userId);
  const st = useLoad(() => oapi('GET', '/meetings/performance?' + q.toString()), [from, to, userId]);
  const late = useLoad(() => oapi('GET', '/meetings/commitments/late' + (userId ? '?userId=' + userId : '')), [userId]);
  const d = st.data;
  const team = d && d.scope === 'team';
  const members = usePeopleList(Boolean(team));
  const [ai, setAi] = useState({ busy: false, items: null, error: '', info: '' });

  const remind = () => modal(t("Relancer l'équipe"), (close) => <RemindConfirm close={close} onDone={late.reload} />);
  const draft = () => {
    setAi({ busy: true, items: null, error: '', info: '' });
    oapi('POST', '/meetings/ai/commitments', {}).then((j) => setAi({ busy: false, items: j.reminders || [], error: '', info: '' }))
      .catch((e) => {
        if (e && e.status === 401) { fail(e); setAi({ busy: false, items: null, error: '', info: '' }); return; }
        if (e && e.status === 503) setAi({ busy: false, items: null, error: '', info: t("MABAH n'est pas encore activée sur ce serveur. Vous pouvez relancer l'équipe avec le bouton « Relancer l'équipe », ou écrire les messages vous-même.") });
        else setAi({ busy: false, items: null, error: tsrv((e && e.message) || 'Erreur'), info: '' });
      });
  };
  const copy = (txt) => {
    const done = () => toast(t('Message copié.'));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => toast(t('Copie impossible : sélectionnez le texte à la main.'), true));
    else toast(t('Copie impossible : sélectionnez le texte à la main.'), true);
  };

  const filters = (
    <Card title={d && d.scope === 'person' ? t('Votre suivi') : t('Performances des personnes')} subtitle={d && d.scope === 'person' ? t('Vous ne voyez que votre propre suivi. Les personnes qui convoquent ou valident voient celui de l\'équipe.') : t('Engagements pris en réunion, présence, ponctualité et résolutions portées, sur la période choisie.')}>
      <div className="mtg-grid2">
        <Field label={t('Du')}>{(p) => <input {...p} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label={t('Au')}>{(p) => <input {...p} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />}</Field>
        {team ? <PersonSelect label={t('Personne')} value={userId} onChange={setUserId} members={members} /> : null}
      </div>
    </Card>
  );
  if (st.error) return <div className="mtg">{filters}<Failed e={st.error} /></div>;
  if (!d) return <div className="mtg">{filters}<Skeleton lines={6} /></div>;

  const rows = d.people;
  const lateList = (late.data && late.data.commitments) || [];
  const one = d.scope === 'person' ? rows[0] : null;
  return (
    <div className="mtg">
      {filters}
      {one ? (
        <div className="mtg-stats">
          <Stat icon="list-check" tone="ok" label={t('Engagements tenus')} value={`${one.commitments.done} / ${one.commitments.total}`} sub={t('réalisation : {r}', { r: pct(one.commitments.completionRate) })} />
          <Stat icon="triangle-exclamation" tone={one.commitments.late ? 'danger' : 'ok'} label={t('Engagements en retard')} value={one.commitments.late} />
          <Stat icon="user-group" label={t('Présence')} value={pct(one.attendance.presenceRate)} sub={t('{n} réunion(s) sur {m}', { n: one.attendance.present, m: one.attendance.convoked })} />
          <Stat icon="clock" tone={one.attendance.late ? 'warn' : 'ok'} label={t('Ponctualité')} value={pct(one.attendance.punctualityRate)} sub={t('{n} retard(s)', { n: one.attendance.late })} />
        </div>
      ) : null}

      {rows.length ? (
        <div className="mtg-ptable-wrap">
          <table className="mtg-ptable">
            <caption className="sr-only">{t('Performances des personnes')}</caption>
            <thead><tr>
              <th scope="col">{t('Personne')}</th><th scope="col">{t('Engagements pris')}</th><th scope="col">{t('Tenus')}</th><th scope="col">{t('En retard')}</th><th scope="col">{t('Réalisation')}</th>
              <th scope="col">{t('Présence')}</th><th scope="col">{t('Retards en réunion')}</th><th scope="col">{t('Ponctualité')}</th><th scope="col">{t('Résolutions portées')}</th><th scope="col">{t('Rôles')}</th>
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.userId}>
                <th scope="row" data-label={t('Personne')}>{r.name || t('Personne inconnue')}</th>
                <td data-label={t('Engagements pris')}>{r.commitments.total}</td>
                <td data-label={t('Tenus')}>{r.commitments.done}</td>
                <td data-label={t('En retard')}>{r.commitments.late ? <Badge tone="danger">{r.commitments.late}</Badge> : 0}</td>
                <td data-label={t('Réalisation')}>{pct(r.commitments.completionRate)}</td>
                <td data-label={t('Présence')}>{pct(r.attendance.presenceRate)} <small className="mtg-muted">({r.attendance.present}/{r.attendance.convoked})</small></td>
                <td data-label={t('Retards en réunion')}>{r.attendance.late}{r.attendance.late ? <small className="mtg-muted"> · {t('{n} min en moyenne', { n: r.attendance.avgLateMin })}</small> : null}</td>
                <td data-label={t('Ponctualité')}>{pct(r.attendance.punctualityRate)}</td>
                <td data-label={t('Résolutions portées')}>{r.resolutions.carried}{r.resolutions.carried ? <small className="mtg-muted"> · {t('{n} adoptée(s)', { n: r.resolutions.adopted })}</small> : null}</td>
                <td data-label={t('Rôles')}>{t('Organisateur : {a} · Président : {b} · Secrétaire : {c}', { a: r.roles.organizer, b: r.roles.chair, c: r.roles.secretary })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <EmptyState icon="user-group" title={t('Aucune donnée sur cette période')}>{t('Les engagements, présences et résolutions apparaîtront ici dès que des réunions auront eu lieu.')}</EmptyState>}

      <Card title={t('Engagements non tenus')} subtitle={t('Actions décidées en réunion dont l\'échéance est dépassée.')}
        actions={team ? <div className="mtg-row"><Button icon="bell" onClick={remind} disabled={!lateList.length}>{t("Relancer l'équipe")}</Button><Button icon="wand-magic-sparkles" onClick={draft} loading={ai.busy} disabled={!lateList.length}>{t('Rédiger les relances avec MABAH')}</Button></div> : null}>
        {late.error ? <Failed e={late.error} /> : null}
        {late.loading && !late.data ? <Skeleton lines={3} /> : null}
        {late.data && !lateList.length ? <EmptyState icon="circle-check" title={t('Aucun engagement en retard')}>{t('Tous les engagements échus ont été tenus.')}</EmptyState> : null}
        <ul className="mtg-list">{lateList.map((a) => (
          <li key={a.id}><button type="button" className="mtg-item" onClick={() => openMeeting(a.meetingId)}>
            <span className="mtg-dot" style={{ background: 'var(--danger)' }} aria-hidden="true" />
            <span><b>{a.text}</b><small>{a.assignee || t('Responsable à définir')} · {a.meetingTitle} · {t('échéance {date}', { date: fmtShort(a.due) })}</small></span>
            <Badge tone="danger">{t('{n} jour(s) de retard', { n: a.daysLate })}</Badge>
          </button></li>
        ))}</ul>
        {team ? <p className="mtg-muted">{t("« Relancer l'équipe » envoie une notice dans l'application (et un e-mail si le serveur d'e-mails est configuré). MABAH ne propose que des brouillons : rien n'est envoyé sans vous.")}</p> : null}
      </Card>

      {ai.info ? <Alert tone="info" title={t('MABAH indisponible')}>{ai.info}</Alert> : null}
      {ai.error ? <Alert tone="danger">{ai.error}</Alert> : null}
      {ai.items ? (
        <Card className="mtg-ai" title={t('Relances proposées par MABAH')} subtitle={t("Brouillons à relire et à corriger. Copiez-les puis envoyez-les vous-même : rien n'est envoyé automatiquement.")}>
          {ai.items.length ? <ul className="mtg-list">{ai.items.map((r, i) => (
            <li key={i} className="mtg-adv-msg">
              <b>{r.assignee || t('Responsable à définir')}</b>
              <p className="mtg-pre">{r.message}</p>
              <div className="mtg-row"><Button size="sm" icon="copy" onClick={() => copy(r.message)}>{t('Copier le message')}</Button></div>
            </li>
          ))}</ul> : <EmptyState icon="wand-magic-sparkles" title={t('Aucune relance proposée')} />}
        </Card>
      ) : null}
    </div>
  );
}

function RemindConfirm({ close, onDone }) {
  const t = useT();
  const { oapi, toast, fail } = useMtg();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = () => {
    setBusy(true);
    oapi('POST', '/meetings/commitments/remind', {}).then((j) => { toast(t('{n} personne(s) relancée(s).', { n: j.people })); close(); onDone(); })
      .catch((e) => { setBusy(false); if (e && e.status === 401) fail(e); setErr(tsrv((e && e.message) || 'Erreur')); });
  };
  return (
    <div className="ws-form">
      <p>{t("Chaque personne qui a des engagements en retard reçoit une notice dans l'application, et un e-mail si le serveur d'e-mails est configuré. Aucun message WhatsApp n'est envoyé.")}</p>
      {err ? <Alert tone="danger">{err}</Alert> : null}
      <div className="mtg-row"><Button variant="primary" icon="bell" onClick={go} loading={busy}>{t('Envoyer la relance')}</Button><Button variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </div>
  );
}

function History({ openMeeting }) {
  const t = useT();
  const { oapi } = useMtg();
  const [userId, setUserId] = useState('');
  const [qIn, setQIn] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const p = new URLSearchParams();
  if (userId) p.set('userId', userId);
  if (q) p.set('q', q);
  if (kind) p.set('kind', kind);
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  const st = useLoad(() => oapi('GET', '/meetings/responsibilities?' + p.toString()), [userId, q, kind, from, to]);
  const d = st.data;
  const team = d && d.scope === 'team';
  const members = usePeopleList(Boolean(team));
  const ROLE = { organizer: t('Organisateur'), chair: t('Président de séance'), secretary: t('Secrétaire'), assignee: t('Responsable de l\'action'), carrier: t('Porteur de la résolution') };
  const KIND = { role: t('Rôle de séance'), action: t('Action'), resolution: t('Résolution') };
  const STATE = { open: [t('À faire'), 'brand'], done: [t('Faite'), 'ok'], late: [t('En retard'), 'danger'], cancelled: [t('Annulée'), 'neutral'], pending: [t('En attente'), 'info'], adopted: [t('Adoptée'), 'ok'], rejected: [t('Rejetée'), 'danger'], postponed: [t('Reportée'), 'warn'], no_quorum: [t('Sans quorum'), 'neutral'] };
  const fmtAt = (s) => (s ? fmtShort(String(s).slice(0, 10)) : '');
  const submit = (ev) => { ev.preventDefault(); setQ(qIn.trim()); };
  const clear = () => { setQIn(''); setQ(''); setKind(''); setFrom(''); setTo(''); setUserId(''); };
  return (
    <div className="mtg">
      <Card title={t('Historique des responsabilités')} subtitle={t('Qui a été responsable de quoi, et à quelle date : rôles de séance, actions et résolutions.')}>
        <form className="mtg-adv-filters" onSubmit={submit} role="search">
          <div className="mtg-grid2">
            {team ? <PersonSelect label={t('Personne')} value={userId} onChange={setUserId} members={members} /> : null}
            <Field label={t('Sujet')}>{(f) => <input {...f} type="search" value={qIn} placeholder={t('Un mot du sujet ou de la réunion')} maxLength={100} onChange={(e) => setQIn(e.target.value)} />}</Field>
            <Field label={t('Du')}>{(f) => <input {...f} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />}</Field>
            <Field label={t('Au')}>{(f) => <input {...f} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />}</Field>
          </div>
          <Segmented label={t('Nature')} value={kind} onChange={setKind} items={[{ id: '', label: t('Toutes') }, { id: 'role', label: KIND.role }, { id: 'action', label: KIND.action }, { id: 'resolution', label: KIND.resolution }]} />
          <div className="mtg-row"><Button variant="primary" type="submit" icon="magnifying-glass">{t('Rechercher')}</Button><Button type="button" variant="ghost" onClick={clear}>{t('Réinitialiser')}</Button></div>
        </form>
      </Card>
      {st.error ? <Failed e={st.error} /> : null}
      {st.loading && !d ? <Skeleton lines={6} /> : null}
      {d ? (
        <>
          <Card title={t('Responsables actuels')} subtitle={t('Dernière désignation connue pour chaque sujet.')}>
            {d.current.length ? <ul className="mtg-list">{d.current.map((e) => (
              <li key={e.id} className="mtg-adv-cur"><b>{e.person || t('Personne inconnue')}</b><span>{ROLE[e.role] || e.role} · {e.subject}</span>{e.meetingId ? <button type="button" className="mtg-adv-link" onClick={() => openMeeting(e.meetingId)}>{e.meetingTitle}</button> : null}</li>
            ))}</ul> : <EmptyState icon="user" title={t('Aucun responsable actuel')}>{t('Aucune désignation ne correspond à ces filtres.')}</EmptyState>}
          </Card>
          <Card title={t('Frise chronologique')}>
            {d.events.length ? <ol className="mtg-timeline">{d.events.map((e) => {
              const st2 = e.state ? STATE[e.state] : null;
              const gone = e.event === 'unassigned';
              return (
                <li key={e.id} className={gone ? 'gone' : ''}>
                  <span className="mtg-tl-dot" aria-hidden="true"><Icon name={gone ? 'user-minus' : 'user-plus'} /></span>
                  <div className="mtg-tl-body">
                    <div className="mtg-tl-h"><b>{e.person || t('Personne inconnue')}</b> <Badge tone={gone ? 'neutral' : 'ok'}>{gone ? t('Déchargé') : t('Désigné')}</Badge> <Badge tone="outline">{ROLE[e.role] || e.role}</Badge>{st2 ? <Badge tone={st2[1]}>{st2[0]}</Badge> : null}</div>
                    <p className="mtg-tl-sub">{e.number ? e.number + ' — ' : ''}{e.subject}</p>
                    <small className="mtg-muted">{fmtAt(e.at)}{e.by ? ' · ' + t('par {name}', { name: e.by }) : ''}</small>
                    {e.meetingId ? <button type="button" className="mtg-adv-link" onClick={() => openMeeting(e.meetingId)}>{e.meetingTitle}{e.meetingDate ? ' (' + fmtShort(e.meetingDate) + ')' : ''}</button> : null}
                  </div>
                </li>
              );
            })}</ol> : <EmptyState icon="clock-rotate-left" title={t('Aucun événement')}>{t('Aucune désignation ne correspond à ces filtres.')}</EmptyState>}
          </Card>
        </>
      ) : null}
    </div>
  );
}

