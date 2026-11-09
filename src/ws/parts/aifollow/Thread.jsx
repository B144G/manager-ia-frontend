import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { fmtHour, dayLabel, sameDay } from './util.jsx';

const POLL_MS = 4500;

/**
 * Conversation « en direct » : charge les messages déjà reçus (initial), puis interroge le serveur toutes les 4,5 s avec « depuis l'identifiant X »
 * (seulement les nouveaux messages). L'interrogation s'arrête quand l'onglet est caché et reprend dès qu'il redevient visible.
 */
export function useLiveThread(prefix, chatId, initial) {
  const { oapi } = useWs();
  const [s, setS] = useState(() => ({ messages: initial.messages, hasMore: initial.hasMore, status: initial.status, rule: initial.rule, drafts: initial.drafts, assigneeId: initial.assigneeId, person: initial.person, online: true, stamp: 0 }));
  const last = useRef(initial.lastId || 0);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const j = await oapi('GET', prefix + '/chats/' + chatId + '/live?since=' + last.current);
      if (!alive.current) return;
      setS((cur) => {
        const known = new Set(cur.messages.map((m) => m.id));
        const add = j.messages.filter((m) => !known.has(m.id));
        return { ...cur, messages: add.length ? cur.messages.concat(add) : cur.messages, status: j.status, rule: j.rule, drafts: j.drafts, assigneeId: j.assigneeId, person: j.person, online: true, stamp: add.length ? cur.stamp + 1 : cur.stamp };
      });
      last.current = Math.max(last.current, j.lastId || 0);
    } catch { if (alive.current) setS((cur) => ({ ...cur, online: false })); } finally { busy.current = false; }
  }, [oapi, prefix, chatId]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') poll(); };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [poll]);
  const older = useCallback(async () => {
    const first = s.messages[0];
    if (!first) return;
    const j = await oapi('GET', prefix + '/chats/' + chatId + '?before=' + first.id);
    setS((cur) => ({ ...cur, messages: j.messages.concat(cur.messages), hasMore: j.hasMore }));
  }, [oapi, prefix, chatId, s.messages]);
  return { ...s, refresh: poll, older };
}

const TAGS = { 'message vocal': 'Message vocal', relance: 'Relance automatique', rappel: 'Rappel automatique', 'fichier envoyé': 'Fichier envoyé', 'réponse vocale envoyée': 'Réponse vocale envoyée' };

function Content({ m, urlOf, chatId, prefix }) {
  const t = useT();
  let text = m.content;
  let tag = '';
  const att = /^\[(image|document) #(\d+)\]\s*([\s\S]*)$/.exec(text);
  if (att) {
    const url = urlOf(prefix + '/chats/' + chatId + '/media/' + att[2]);
    return (
      <>
        {att[1] === 'image'
          ? <a href={url} target="_blank" rel="noopener"><img src={url} alt={t('Photo envoyée par le client')} style={{ display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 8, margin: '2px 0 4px' }} /></a>
          : <a href={url} target="_blank" rel="noopener">{t('Ouvrir le document (PDF) envoyé par le client')}</a>}
        {att[3] ? <span>{att[3]}</span> : null}
      </>
    );
  }
  const tg = /^\[([^\]]{2,60})\]\s*([\s\S]*)$/.exec(text);
  if (tg) {
    const key = tg[1];
    if (TAGS[key]) { tag = t(TAGS[key]); text = tg[2]; } else if (key.startsWith('modèle ')) { tag = t('Modèle WhatsApp') + ' ' + key.slice(7); text = tg[2]; }
  }
  return <>{tag ? <span className="th-tag">{tag}</span> : null}{text}</>;
}

/** Bulles de la conversation : client à gauche, IA et équipe à droite (avec le nom de la personne), séparateurs de date, heure, destinataire. */
export function Thread({ live, label, contactTo, urlOf, prefix, chatId }) {
  const t = useT();
  const box = useRef(null);
  const stick = useRef(true);
  const [unseen, setUnseen] = useState(0);
  const onScroll = () => { const el = box.current; if (!el) return; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; if (stick.current) setUnseen(0); };
  useLayoutEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, []);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (stick.current) el.scrollTop = el.scrollHeight; else setUnseen((n) => n + 1);
  }, [live.stamp]);
  const down = () => { const el = box.current; if (el) { el.scrollTop = el.scrollHeight; stick.current = true; setUnseen(0); } };
  let prev = null;
  return (
    <div className="th-box">
      <div className="th" ref={box} onScroll={onScroll} role="log" aria-live="polite" aria-label={t('Messages de la conversation')} tabIndex={0}>
        {live.hasMore ? <button className="btn small th-more" type="button" onClick={() => live.older().catch(() => {})}>{t('Voir les messages plus anciens')}</button> : null}
        {!live.messages.length ? <p className="ws-empty">{t('Aucun message pour le moment.')}</p> : null}
        {live.messages.map((m) => {
          const day = !prev || !sameDay(prev, m.at) ? <div className="th-day" key={'d' + m.id}>{dayLabel(m.at)}</div> : null;
          prev = m.at;
          const who = m.role === 'user' ? label : m.role === 'assistant' ? t('IA') + (m.staff ? ' · ' + t('validé par {name}', { name: m.staff }) : '') : (m.staff || t('Équipe'));
          return (
            <Fragment key={m.id}>
              {day}
              <div className={'th-row ' + m.role}>
                <div className="th-b"><Content m={m} urlOf={urlOf} chatId={chatId} prefix={prefix} /></div>
                <div className="th-meta"><span className="th-who">{who}</span><span>{fmtHour(m.at)}</span>{m.role !== 'user' && contactTo ? <span>{t('à {to}', { to: contactTo })}</span> : null}</div>
              </div>
            </Fragment>
          );
        })}
      </div>
      {unseen ? <button className="btn primary small th-new" type="button" onClick={down}>{t('Nouveaux messages')} ↓</button> : null}
    </div>
  );
}
