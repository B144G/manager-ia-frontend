import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Icon } from '../../../lib/fa.jsx';
import { Button } from '../../ui.jsx';
import Message from './Message.jsx';
import { Avatar } from './Sidebar.jsx';
import { dayKey, fmtDay, fmtSeen } from './text.jsx';

/** Zone des messages : séparateurs de jours, non lus, défilement, charger plus ancien, « en train d'écrire ». */
export default function Thread({ conv, state, meId, names, texts, plainNames, api, e2e, act, group, isAdmin, loadMore, firstUnread, typingNow, jumpTo }) {
  const t = useT();
  const box = useRef(null); const stick = useRef(true); const last = useRef(0);
  const [showDown, setShowDown] = useState(false);
  const list = state ? state.list : [];

  useLayoutEffect(() => { // à l'arrivée d'un nouveau message : on reste en bas si on y était
    const el = box.current; if (!el) return;
    const lastId = list.length ? list[list.length - 1].id : 0;
    if (lastId !== last.current) { if (stick.current || (list.length && list[list.length - 1].mine)) el.scrollTop = el.scrollHeight; last.current = lastId; }
  }, [list]);
  useEffect(() => { stick.current = true; last.current = 0; setShowDown(false); }, [conv && conv.id]);
  useEffect(() => { if (jumpTo) { const el = document.getElementById(`ci-m-${jumpTo.id}`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } } }, [jumpTo]);
  const onScroll = () => { const el = box.current; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80; stick.current = near; setShowDown(!near); };

  let prevDay = ''; let sender = null;
  return (
    <div className="ci-thread" ref={box} onScroll={onScroll} role="log" aria-live="polite" aria-label={t('Messages')}>
      {state && state.hasMore && <div className="ci-more"><Button size="sm" variant="ghost" onClick={loadMore} label={t('Messages plus anciens')}>{t('Voir les messages plus anciens')}</Button></div>}
      {state && !list.length && state.loaded && (
        <div className="ci-empty"><Avatar name={conv.name} id={conv.kind === 'direct' ? conv.otherUserId : conv.id} group={conv.kind === 'group'} size="lg" /><b>{conv.name}</b>
          <p className="ci-muted">{conv.e2ee ? t('Conversation chiffrée de bout en bout : seuls vous et votre interlocuteur pouvez lire ces messages.') : t('Aucun message. Dites bonjour !')}</p></div>
      )}
      {list.map((m) => {
        const dk = dayKey(m.createdAt);
        const sep = dk !== prevDay ? <div className="ci-day" key={`d${dk}`}><span>{fmtDay(m.createdAt, t)}</span></div> : null;
        prevDay = dk;
        const showName = group && sender !== m.senderId; sender = m.kind === 'system' ? null : m.senderId;
        return (
          <div key={m.id}>
            {sep}
            {firstUnread === m.id && <div className="ci-newline"><span>{t('Nouveaux messages')}</span></div>}
            <Message m={m} text={texts[m.id] !== undefined ? texts[m.id] : m.body} names={names} meId={meId} api={api} e2e={e2e} plainName={plainNames[m.id]} act={act} group={group} showName={showName} isAdmin={isAdmin} convE2ee={conv.e2ee} />
          </div>
        );
      })}
      {typingNow && <div className="ci-typing" aria-live="polite"><span className="ci-dots" aria-hidden="true"><i /><i /><i /></span> {typingNow}</div>}
      {showDown && <button type="button" className="ci-down" onClick={() => { const el = box.current; el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }} aria-label={t('Aller au dernier message')}><Icon name="c-down" /></button>}
    </div>
  );
}

/** En-tête de la conversation. */
export function ThreadHeader({ conv, detail, presence, typingText, onBack, onCall, onPanel, panel, callsOn, geoCount }) {
  const t = useT();
  const pr = conv.kind === 'direct' ? presence[conv.otherUserId] : null;
  const sub = typingText || (conv.kind === 'direct'
    ? (pr && pr.online === null ? '' : pr && pr.online ? t('En ligne') : fmtSeen(pr && pr.lastSeen, t))
    : `${t('{n} membres', { n: conv.memberCount })}${detail ? ' · ' + t('{n} en ligne', { n: detail.members.filter((m) => (presence[m.userId] || {}).online).length }) : ''}`);
  return (
    <header className="ci-head">
      <button type="button" className="ci-back" onClick={onBack} aria-label={t('Retour aux conversations')}><Icon name="arrow-left" /></button>
      <Avatar name={conv.name} id={conv.kind === 'direct' ? conv.otherUserId : conv.id} group={conv.kind === 'group'} online={pr ? pr.online : undefined} />
      <button type="button" className="ci-head-main" onClick={() => onPanel('info')} aria-label={t('Informations sur la conversation')}>
        <b>{conv.e2ee && <Icon name="c-lock" />} {conv.name}</b>
        <small className={typingText ? 'typing' : ''}>{sub}</small>
      </button>
      <span className="ci-head-act">
        {callsOn && <Button size="sm" variant="ghost" iconOnly icon="c-phone" label={t('Appel audio')} onClick={() => onCall('audio')} />}
        {callsOn && <Button size="sm" variant="ghost" iconOnly icon="c-video" label={t('Appel vidéo')} onClick={() => onCall('video')} />}
        <Button size="sm" variant={panel === 'map' ? 'secondary' : 'ghost'} iconOnly icon="c-pos" label={t('Géolocalisation : voir les personnes connectées')} onClick={() => onPanel('map')}>{geoCount > 0 ? geoCount : null}</Button>
        <Button size="sm" variant="ghost" iconOnly icon="search" label={t('Rechercher')} onClick={() => onPanel('search')} />
        <Button size="sm" variant={panel ? 'secondary' : 'ghost'} iconOnly icon="c-more" label={t('Plus')} onClick={() => onPanel(panel ? null : 'info')} />
      </span>
    </header>
  );
}
