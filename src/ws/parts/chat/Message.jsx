import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Icon } from '../../../lib/fa.jsx';
import { useWs } from '../../WsContext.jsx';
import { Button } from '../../ui.jsx';
import { fmtDur, fmtSize, fmtTime, renderText } from './text.jsx';
import { decryptBytes } from './crypto.js';
import { ObjectCard } from './ObjectUI.jsx';

const FILE_ICON = { image: 'c-image', pdf: 'c-pdf', word: 'c-word', excel: 'c-excel', presentation: 'c-ppt', video: 'c-film', audio: 'c-audio', text: 'c-file', encrypted: 'c-lock' };

/** Fichier : aperçu (image, PDF, vidéo, audio), téléchargement. Pour une conversation chiffrée, les octets sont déchiffrés ici, dans le navigateur. */
export function FileCard({ m, api, e2e, plainName }) {
  const t = useT();
  const { modal, fail } = useWs();
  const f = m.file;
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!f) return <p className="ci-muted">{t('Fichier supprimé')}</p>;
  if (f.removed) return <p className="ci-muted">{t('Fichier supprimé')}</p>;
  const name = e2e ? (plainName || t('Fichier chiffré')) : f.name;
  const load = async () => {
    const raw = await api.fetchBytes(f.id);
    if (!e2e) return new Blob([raw], { type: f.mime });
    const clear = await decryptBytes(e2e.key, raw);
    return new Blob([clear], { type: e2e.mime(name) });
  };
  const download = async () => {
    setBusy(true);
    try { const b = await load(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } catch (e) { fail(e.message === 'Fichier introuvable.' ? e : new Error(t('Ce fichier ne peut pas être lu sur cet appareil.'))); } finally { setBusy(false); }
  };
  const preview = async () => {
    setBusy(true);
    try {
      const b = await load(); const u = URL.createObjectURL(b); setUrl(u);
      if (f.category === 'pdf' || (e2e && /\.pdf$/i.test(name))) modal(name, () => <iframe className="ci-pdf" title={name} src={u} sandbox="" />, { wide: true, onclose: () => URL.revokeObjectURL(u) });
    } catch { fail(new Error(t('Ce fichier ne peut pas être lu sur cet appareil.'))); } finally { setBusy(false); }
  };
  const kind = e2e ? ((/\.(png|jpe?g|gif|webp)$/i.test(name) && 'image') || (/\.pdf$/i.test(name) && 'pdf') || 'encrypted') : f.category;
  return (
    <div className="ci-file">
      {url && kind === 'image' && <img className="ci-img" src={url} alt={name} />}
      {url && kind === 'video' && <video className="ci-vid" src={url} controls preload="metadata" />}
      {url && kind === 'audio' && <audio src={url} controls preload="metadata" />}
      <div className="ci-file-row">
        <span className="ci-file-ico"><Icon name={FILE_ICON[kind] || 'c-file'} /></span>
        <span className="ci-file-meta"><b>{name}</b><small>{fmtSize(f.size)}{f.folder ? ` · ${f.folder}` : ''}</small></span>
        <span className="ci-file-act">
          {['image', 'pdf', 'video', 'audio'].includes(kind) && !url && <Button size="sm" variant="ghost" onClick={preview} loading={busy} icon="eye" label={t('Aperçu')} iconOnly />}
          <Button size="sm" variant="ghost" onClick={download} loading={busy} icon="download" label={t('Télécharger')} iconOnly />
        </span>
      </div>
    </div>
  );
}

function Voice({ m, api, e2e }) {
  const t = useT();
  const [url, setUrl] = useState(null); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const load = async () => {
    setBusy(true);
    try {
      const raw = await api.fetchBytes(m.file.id);
      const bytes = e2e ? await decryptBytes(e2e.key, raw) : raw;
      setUrl(URL.createObjectURL(new Blob([bytes], { type: e2e ? 'audio/webm' : m.file.mime })));
    } catch { setErr(t('Ce message vocal ne peut pas être lu sur cet appareil.')); } finally { setBusy(false); }
  };
  if (!m.file || m.file.removed) return <p className="ci-muted">{t('Fichier supprimé')}</p>;
  return (
    <div className="ci-voice">
      {url ? <audio src={url} controls autoPlay preload="auto" /> : <Button size="sm" onClick={load} loading={busy} icon="c-play" label={t('Écouter')}>{t('Écouter')} · {fmtDur((m.file.durationMs || 0) / 1000)}</Button>}
      {err && <small className="ci-err">{err}</small>}
      {m.meta.transcript && <p className="ci-transcript"><Icon name="c-lang" /> {m.meta.transcript}</p>}
    </div>
  );
}

function Poll({ m, vote, close, meId }) {
  const t = useT();
  const p = m.poll; if (!p) return null;
  const mine = new Set(p.options.filter((o) => o.mine).map((o) => o.id));
  const toggle = (o) => {
    if (p.closed) return;
    const next = new Set(p.multiple ? mine : []);
    if (mine.has(o.id)) next.delete(o.id); else next.add(o.id);
    vote(p.id, [...next]);
  };
  const max = Math.max(1, ...p.options.map((o) => o.votes));
  return (
    <div className="ci-poll">
      <b>{p.question}</b>
      {p.options.map((o) => (
        <button key={o.id} type="button" className={'ci-opt' + (o.mine ? ' on' : '')} disabled={p.closed} onClick={() => toggle(o)} aria-pressed={o.mine}>
          <span className="ci-opt-bar" style={{ width: `${Math.round((o.votes / max) * 100)}%` }} aria-hidden="true" />
          <span className="ci-opt-l">{o.mine ? '✓ ' : ''}{o.label}</span><span className="ci-opt-n">{o.votes}</span>
        </button>
      ))}
      <small className="ci-muted">{t('{n} participant(s)', { n: p.total })}{p.anonymous ? ` · ${t('anonyme')}` : ''}{p.multiple ? ` · ${t('plusieurs choix')}` : ''}{p.closed ? ` · ${t('terminé')}` : ''}</small>
      {!p.closed && (m.senderId === meId) && <Button size="sm" variant="ghost" onClick={() => close(p.id)} label={t('Terminer le sondage')}>{t('Terminer le sondage')}</Button>}
    </div>
  );
}

function CallCard({ m, join }) {
  const t = useT();
  const k = m.meta.kind === 'video' ? t('Appel vidéo') : t('Appel audio');
  const st = { ringing: t('Appel en cours…'), active: t('En cours'), ended: t('Terminé'), missed: t('Manqué'), declined: t('Refusé'), cancelled: t('Annulé') }[m.meta.status] || '';
  return (
    <div className="ci-callcard">
      <span className="ci-callico"><Icon name={m.meta.kind === 'video' ? 'c-video' : 'c-phone'} /></span>
      <span><b>{k}</b><small>{st}{m.meta.durationSec ? ` · ${fmtDur(m.meta.durationSec)}` : ''}</small></span>
      {['ringing', 'active'].includes(m.meta.status) && <Button size="sm" onClick={() => join(m.meta.callId, m.meta.kind)} icon="c-phone" label={t('Rejoindre')}>{t('Rejoindre')}</Button>}
    </div>
  );
}

export function SystemLine({ m }) {
  const t = useT();
  const e = m.meta || {}; const a = e.actorName || '';
  const txt = {
    created: t('{a} a créé le groupe « {name} »', { a, name: e.name }),
    renamed: t('{a} a renommé le groupe en « {name} »', { a, name: e.name }),
    added: t('{a} a ajouté {names}', { a, names: (e.names || []).join(', ') }),
    removed: t('{a} a retiré {name} du groupe', { a, name: e.name }),
    left: t('{name} a quitté le groupe', { name: e.name }),
    promoted: t('{name} est maintenant administrateur du groupe', { name: e.name }),
    demoted: t("{name} n'est plus administrateur du groupe", { name: e.name }),
    ai_on: t("{a} a invité l'assistante {ai} dans la conversation", { a, ai: e.aiName || '' }),
    ai_off: t("{a} a retiré l'assistante de la conversation", { a }),
    obj_meeting_convened: t('Réunion convoquée le {date} à {time}', { date: e.date || '', time: e.time || '' }),
    obj_meeting_agenda: t("Ordre du jour mis à jour"),
    obj_meeting_decision: t('Décision(s) enregistrée(s)'),
    obj_meeting_action: t('Action(s) ajoutée(s)'),
    obj_meeting_submitted: t('Compte rendu soumis à validation'),
    obj_meeting_validated: t('Compte rendu validé (les tâches sont créées dans Projets et tâches)'),
    obj_meeting_returned: t('Compte rendu renvoyé pour correction'),
    obj_meeting_started: t('Séance ouverte'),
    obj_meeting_ended: t('Séance levée'),
    obj_meeting_no_quorum: t('Séance déclarée sans quorum'),
    obj_meeting_vote_open: t('Vote ouvert'),
    obj_meeting_vote_close: t('Vote clos'),
    obj_meeting_pv_locked: t('Procès-verbal verrouillé : signatures demandées'),
    obj_meeting_pv_signed: t('Procès-verbal signé'),
  }[e.event] || '';
  const items = Array.isArray(e.items) ? e.items : e.agenda || [];
  return txt ? <div className="ci-sys"><span>{txt}{items.length > 0 && <ul className="ci-sys-list">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>}</span></div> : null;
}

/** Une bulle de message. Les actions (répondre, épingler…) arrivent par `act`. */
export default function Message({ m, text, names, meId, api, e2e, plainName, act, group, showName, isAdmin, convE2ee }) {
  const t = useT();
  const [menu, setMenu] = useState(false);
  const [tr, setTr] = useState(null);
  const ref = useRef(null);
  useEffect(() => { if (!menu) return undefined; const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); }; document.addEventListener('mousedown', f); document.addEventListener('touchstart', f); return () => { document.removeEventListener('mousedown', f); document.removeEventListener('touchstart', f); }; }, [menu]);
  if (m.kind === 'system') return <SystemLine m={m} />;
  const mine = m.mine;
  const body = m.deleted ? <i className="ci-muted">{t('Message supprimé')}</i> : null;
  const ticks = mine && !m.deleted ? (m.read ? <span className="ci-tick read" title={t('Lu')}><Icon name="c-checks" /></span> : m.delivered ? <span className="ci-tick" title={t('Distribué')}><Icon name="c-checks" /></span> : <span className="ci-tick" title={t('Envoyé')}><Icon name="c-check" /></span>) : null;
  const readInfo = mine && group && m.readBy && m.readBy.length ? t('Lu par {n}', { n: m.readBy.length }) : '';
  const isText = m.kind === 'text' || m.kind === 'ai' || m.kind === 'location';
  const items = [];
  if (!m.deleted) {
    items.push(['c-reply', t('Répondre'), () => act.reply(m)]);
    if (isText && text) items.push(['copy', t('Copier'), () => act.copy(text)]);
    if (mine && m.kind === 'text') items.push(['pen', t('Modifier'), () => act.edit(m)]);
    if (!m.privateToMe) items.push(['c-pin', m.pinned ? t('Désépingler') : t('Épingler'), () => act.pin(m)]);
    items.push(['bell', t('Me rappeler'), () => act.remind(m)]);
    if (!['poll', 'call', 'object', 'meeting'].includes(m.kind)) items.push(['c-tasks', t('Créer une tâche'), () => act.task(m, text)]);
    if (!convE2ee && (m.kind === 'text' || (m.kind === 'voice' && m.meta.transcript))) items.push(['c-lang', t('Traduire'), async () => { const r = await act.translate(m, 'fr'); setTr(r); }]);
    if (!convE2ee && m.kind === 'voice' && !m.meta.transcript) items.push(['c-lang', t('Transcrire'), () => act.transcribe(m)]);
    if (m.kind === 'ai' && m.privateToMe && !(m.meta.companyData || []).length) items.push(['share', t('Partager avec la conversation'), () => act.share(m)]);
    if (m.kind === 'file' && !convE2ee && m.file && !m.file.removed) items.push(['c-folder', t('Enregistrer dans la Bibliothèque'), () => act.saveLib(m)]);
    if (mine || isAdmin) items.push(['trash', t('Supprimer'), () => act.del(m)]);
  }
  const cls = 'ci-msg' + (mine ? ' mine' : ' theirs') + (m.kind === 'ai' ? ' ai' : '') + (m.urgent ? ' urgent' : '') + (m.pinned ? ' pinned' : '') + (m.privateToMe ? ' priv' : '');
  return (
    <div className={cls} id={`ci-m-${m.id}`}>
      <div className="ci-bubble">
        {showName && !mine && <b className="ci-from">{m.senderName}</b>}
        {m.urgent && !m.deleted && <span className="ci-urg"><Icon name="c-bolt" /> {t('Urgent')}</span>}
        {m.privateToMe && <span className="ci-privnote"><Icon name="c-eye" /> {t('Note privée : visible par vous seul')}</span>}
        {m.replyTo && !m.deleted && (
          <button type="button" className="ci-quote" onClick={() => act.jump(m.replyTo.id)}>
            <b>{m.replyTo.senderName}</b><span>{m.replyTo.deleted ? t('Message supprimé') : (act.quoteText ? act.quoteText(m.replyTo) : m.replyTo.snippet)}</span>
          </button>
        )}
        {body}
        {!m.deleted && m.kind === 'text' && <p className="ci-text">{renderText(text, names)}</p>}
        {!m.deleted && m.kind === 'ai' && <p className="ci-text">{renderText(m.body, names)}</p>}
        {!m.deleted && m.kind === 'ai' && m.meta.action === 'extract' && (m.meta.tasks || []).map((tk, i) => (
          <div key={i} className="ci-extract"><span>{tk.title}{tk.assignee ? ` — ${tk.assignee}` : ''}{tk.due ? ` · ${tk.due}` : ''}</span><Button size="sm" onClick={() => act.taskFrom(m, tk)} icon="c-tasks" label={t('Créer la tâche')}>{t('Créer la tâche')}</Button></div>
        ))}
        {!m.deleted && m.kind === 'file' && <><FileCard m={m} api={api} e2e={e2e} plainName={plainName} />{!e2e && m.body && m.body !== m.file?.name && <p className="ci-text">{renderText(m.body, names)}</p>}</>}
        {!m.deleted && m.kind === 'voice' && <Voice m={m} api={api} e2e={e2e} />}
        {!m.deleted && m.kind === 'location' && (
          <div className="ci-loc"><Icon name="c-pos" /> <div><b>{t('Position partagée')}</b>{m.body && <small>{m.body}</small>}
            <a href={`https://www.openstreetmap.org/?mlat=${m.meta.lat}&mlon=${m.meta.lng}#map=17/${m.meta.lat}/${m.meta.lng}`} target="_blank" rel="noopener noreferrer">{t('Ouvrir sur la carte')}</a></div></div>
        )}
        {!m.deleted && m.kind === 'poll' && <Poll m={m} vote={act.vote} close={act.closePoll} meId={meId} />}
        {!m.deleted && m.kind === 'call' && <CallCard m={m} join={act.joinCall} />}
        {!m.deleted && m.kind === 'object' && <ObjectCard obj={m.object} onOpen={act.openObject} />}
        {!m.deleted && m.kind === 'meeting' && (
          <div className="ci-callcard"><span className="ci-callico"><Icon name="calendar-check" /></span><span><b>{m.meta.title}</b><small>{m.meta.date} · {m.meta.time}</small></span>
            <Button size="sm" variant="ghost" onClick={() => act.openMeeting(m.meta.meetingId)} label={t('Ouvrir')}>{t('Ouvrir')}</Button></div>
        )}
        {m.task && <div className="ci-taskchip"><Icon name="c-tasks" /> {t('Tâche créée')} : {m.task.title}</div>}
        {tr && (tr.ok ? <p className="ci-translation"><Icon name="c-lang" /> {tr.text}</p> : <p className="ci-err">{tr.message}</p>)}
        <span className="ci-meta">
          {m.pinned && <Icon name="c-pin" />} {m.editedAt && <i>{t('modifié')}</i>} <time>{fmtTime(m.createdAt)}</time> {ticks} {readInfo && <small>{readInfo}</small>}
        </span>
      </div>
      {!m.deleted && (
        <div className="ci-menu" ref={ref}>
          <button type="button" className="ci-menu-btn" aria-label={t('Actions sur le message')} aria-expanded={menu} onClick={() => setMenu((v) => !v)}><Icon name="c-more" /></button>
          {menu && <ul className="ci-menu-pop" role="menu">{items.map(([ic, label, fn]) => <li key={label}><button type="button" role="menuitem" onClick={() => { setMenu(false); fn(); }}><Icon name={ic} /> {label}</button></li>)}</ul>}
        </div>
      )}
    </div>
  );
}
void useMemo;
