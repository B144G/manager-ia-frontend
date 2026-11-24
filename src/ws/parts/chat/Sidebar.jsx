import { useMemo, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Icon } from '../../../lib/fa.jsx';
import { Button } from '../../ui.jsx';
import { fmtShort } from './text.jsx';

const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
export const initialsOf = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
export function Avatar({ name, id, group, online, size }) {
  return (
    <span className={`ci-av ${COLORS[Number(id || 0) % COLORS.length]}${size ? ' ' + size : ''}${group ? ' grp' : ''}`} aria-hidden="true">
      {group ? <Icon name="c-group" /> : initialsOf(name)}
      {online !== undefined && online !== null && <i className={'ci-dot' + (online ? ' on' : '')} />}
    </span>
  );
}

const preview = (c, t, typing) => {
  if (typing) return typing;
  const l = c.last; if (!l) return t('Aucun message');
  if (l.deleted) return t('Message supprimé');
  if (l.encrypted) return `🔒 ${t('Message chiffré')}`;
  const who = c.kind === 'group' && l.senderName ? `${l.senderName.split(' ')[0]} : ` : '';
  const body = l.kind === 'voice' ? `🎤 ${t('Message vocal')}` : l.kind === 'file' ? `📎 ${l.text}` : l.kind === 'poll' ? `📊 ${l.text}` : l.kind === 'location' ? `📍 ${t('Position partagée')}` : l.kind === 'call' ? `📞 ${t('Appel')}` : l.kind === 'meeting' ? `📅 ${l.text}` : l.kind === 'object' ? `🔗 ${t('Objet partagé')}` : l.kind === 'system' ? '' : l.text;
  return who + body;
};

/** Liste des conversations : nom, dernier message, date / heure, non lus, présence. */
export default function Sidebar({ convs, activeId, onOpen, presence, typing, onNew, onGroup, onSearch, filter, setFilter, loading, mode, unreadTotal }) {
  const t = useT();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return convs.filter((c) => (filter === 'unread' ? c.unread > 0 : filter === 'groups' ? c.kind === 'group' : true) && (!s || c.name.toLowerCase().includes(s)));
  }, [convs, filter, q]);
  const tabs = [['all', t('Tous')], ['unread', t('Non lus')], ['groups', t('Groupes')], ['archived', t('Archivés')]];
  return (
    <aside className="ci-side" aria-label={t('Conversations')}>
      <div className="ci-side-h">
        <h2>{t('Discussions')}{unreadTotal > 0 && <span className="ci-badge">{unreadTotal}</span>}</h2>
        <span className="ci-side-act">
          <Button size="sm" variant="ghost" iconOnly icon="c-user-plus" label={t('Nouvelle conversation')} onClick={onNew} />
          <Button size="sm" variant="ghost" iconOnly icon="c-group" label={t('Nouveau groupe')} onClick={onGroup} />
        </span>
      </div>
      <div className="ci-search">
        <Icon name="search" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Filtrer les conversations')} aria-label={t('Filtrer les conversations')} />
        <button type="button" className="ci-ico" onClick={onSearch} aria-label={t('Recherche dans les messages, fichiers et personnes')}><Icon name="magic" /></button>
      </div>
      <div className="ci-tabs" role="tablist">{tabs.map(([id, l]) => <button key={id} role="tab" type="button" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{l}</button>)}</div>
      {mode === 'poll' && <p className="ci-mode" role="status"><Icon name="warn" /> {t('Connexion temps réel interrompue : actualisation automatique toutes les 5 secondes.')}</p>}
      <ul className="ci-list">
        {loading && <li className="ci-muted ci-pad">{t('Chargement…')}</li>}
        {!loading && !list.length && <li className="ci-muted ci-pad">{filter === 'unread' ? t('Aucun message non lu.') : filter === 'archived' ? t('Aucune conversation archivée.') : t('Aucune conversation. Commencez par écrire à un collègue.')}</li>}
        {list.map((c) => {
          const ty = typing[c.id] && Object.values(typing[c.id]).filter((x) => x.at > Date.now() - 7000);
          const tl = ty && ty.length ? (ty[0].kind === 'recording' ? t('{name} enregistre un audio…', { name: ty[0].name.split(' ')[0] }) : t('{name} écrit…', { name: ty[0].name.split(' ')[0] })) : '';
          const pr = c.kind === 'direct' ? presence[c.otherUserId] : null;
          return (
            <li key={c.id}>
              <button type="button" className={'ci-item' + (c.id === activeId ? ' on' : '') + (c.unread ? ' unread' : '')} onClick={() => onOpen(c.id)} aria-current={c.id === activeId ? 'true' : undefined}>
                <Avatar name={c.name} id={c.kind === 'direct' ? c.otherUserId : c.id} group={c.kind === 'group'} online={pr ? pr.online : undefined} />
                <span className="ci-item-main">
                  <span className="ci-item-top"><b>{c.e2ee && <Icon name="c-lock" />} {c.name}</b><time>{fmtShort(c.last ? c.last.at : c.lastAt, t)}</time></span>
                  <span className="ci-item-bot"><span className={'ci-prev' + (tl ? ' typing' : '')}>{preview(c, t, tl)}</span>
                    {c.muted && <Icon name="c-bell-off" />}{c.unread > 0 && <span className={'ci-badge' + (c.mentioned ? ' hot' : '')}>{c.unread}</span>}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
