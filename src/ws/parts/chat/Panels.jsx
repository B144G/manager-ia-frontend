import { useEffect, useMemo, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Icon } from '../../../lib/fa.jsx';
import { useWs } from '../../WsContext.jsx';
import { Button } from '../../ui.jsx';
import GeoMap from '../geo/GeoMap.jsx';
import { Avatar } from './Sidebar.jsx';
import { fmtDur, fmtSeen, fmtShort, fmtSize } from './text.jsx';
import { safetyCode } from './crypto.js';

const Section = ({ title, children, actions }) => <section className="ci-sec"><div className="ci-sec-h"><h3>{title}</h3>{actions}</div>{children}</section>;
export function PanelFrame({ title, onClose, children }) {
  const t = useT();
  return (
    <aside className="ci-panel" aria-label={title}>
      <header><b>{title}</b><button type="button" className="ci-ico" onClick={onClose} aria-label={t('Fermer')}><Icon name="close" /></button></header>
      <div className="ci-panel-body">{children}</div>
    </aside>
  );
}

/** Informations, membres et administration de la conversation. */
export function InfoPanel({ conv, detail, presence, meId, api, reload, onClose, settings, aiStatus, e2e, openPanel, planMeeting }) {
  const t = useT();
  const { confirm, toast, fail, modal, orgId, can } = useWs();
  const group = conv.kind === 'group'; const admin = conv.myRole === 'admin';
  const [code, setCode] = useState('');
  useEffect(() => { if (conv.e2ee && e2e && e2e.myJwk && e2e.theirJwk) safetyCode(e2e.myJwk, e2e.theirJwk).then(setCode).catch(() => {}); else setCode(''); }, [conv.id, conv.e2ee, e2e]);
  const act = (p, label) => p.then(() => { if (label) toast(label); reload(); }, fail);
  const rename = () => modal(t('Modifier le groupe'), (close) => (
    <form className="ws-form" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.target); await act(api.c('PUT', `/conversations/${conv.id}`, { name: f.get('name'), description: f.get('description'), department: f.get('department') }), t('Groupe modifié')); close(); }}>
      <label>{t('Nom du groupe')}<input name="name" defaultValue={conv.name} maxLength={80} required /></label>
      <label>{t('Description')}<input name="description" defaultValue={conv.description} maxLength={300} /></label>
      {conv.purpose === 'department' && <label>{t('Département')}<input name="department" defaultValue={conv.department} maxLength={80} /></label>}
      <Button type="submit" variant="primary" label={t('Enregistrer')}>{t('Enregistrer')}</Button>
    </form>));
  const addMembers = async () => {
    const people = (await api.c('GET', '/people')).people.filter((p) => !detail.members.some((m) => m.userId === p.userId));
    if (!people.length) { toast(t('Tout le monde est déjà dans le groupe.')); return; }
    modal(t('Ajouter des membres'), (close) => <Picker people={people} t={t} submit={t('Ajouter')} extra={<label className="ci-check"><input type="checkbox" name="hist" /> {t("Partager l'historique avec les nouveaux membres")}</label>} onSubmit={async (ids, f) => { await act(api.c('POST', `/conversations/${conv.id}/members`, { userIds: ids, shareHistory: Boolean(f.get('hist')) }), t('Membres ajoutés')); close(); }} />);
  };
  const members = detail ? detail.members : [];
  return (
    <PanelFrame title={group ? t('Infos du groupe') : t('Infos')} onClose={onClose}>
      <div className="ci-profile"><Avatar name={conv.name} id={conv.kind === 'direct' ? conv.otherUserId : conv.id} group={group} size="lg" /><b>{conv.name}</b>
        {conv.description && <p className="ci-muted">{conv.description}</p>}
        {conv.department && <span className="ci-chip">{conv.department}</span>}
        {conv.projectId && <span className="ci-chip">{t('Groupe de projet')}</span>}
        {group && admin && <Button size="sm" variant="ghost" icon="pen" onClick={rename} label={t('Modifier')}>{t('Modifier')}</Button>}</div>
      {conv.e2ee && (
        <Section title={t('Chiffrement de bout en bout')}>
          <p className="ci-muted">{t("Les messages et fichiers sont chiffrés sur votre appareil : le serveur ne peut pas les lire (ni l'administrateur de l'entreprise, ni l'assistante). Comparez ce code avec votre interlocuteur, de vive voix : s'il est identique, personne ne s'interpose.")}</p>
          {code ? <pre className="ci-code" aria-label={t('Code de sécurité')}>{code}</pre> : <p className="ci-muted">{t('Code indisponible sur cet appareil.')}</p>}
        </Section>
      )}
      <Section title={t('Actions')}>
        <div className="ci-actions">
          <Button size="sm" variant="ghost" icon="c-bell-off" onClick={() => act(api.c('PUT', `/conversations/${conv.id}/me`, { muted: !conv.muted }))} label={conv.muted ? t('Réactiver') : t('Sourdine')}>{conv.muted ? t('Réactiver les notifications') : t('Mettre en sourdine')}</Button>
          <Button size="sm" variant="ghost" icon="c-archive" onClick={() => act(api.c('PUT', `/conversations/${conv.id}/me`, { archived: !conv.archived }))} label={t('Archiver')}>{conv.archived ? t('Désarchiver') : t('Archiver')}</Button>
          <Button size="sm" variant="ghost" icon="c-cal-plus" onClick={planMeeting} label={t('Planifier une réunion')}>{t('Planifier une réunion')}</Button>
          <Button size="sm" variant="ghost" icon="c-folder" onClick={() => openPanel('files')} label={t('Fichiers partagés')}>{t('Fichiers partagés')}</Button>
          <Button size="sm" variant="ghost" icon="clock" onClick={() => openPanel('later')} label={t('Programmés et rappels')}>{t('Programmés et rappels')}</Button>
        </div>
      </Section>
      {!conv.e2ee && settings.aiEnabled && (
        <Section title={aiStatus && aiStatus.name ? aiStatus.name : t('Assistante')}>
          <p className="ci-muted">{conv.aiEnabled ? t("L'assistante est invitée. Elle ne lit que cette conversation, et ses réponses restent privées tant que vous ne les partagez pas.") : t("Invitez l'assistante pour résumer la discussion, poser une question ou extraire les tâches et décisions. Tous les participants en sont informés.")}</p>
          {aiStatus && !aiStatus.available && <p className="ci-err">{aiStatus.message}</p>}
          {(!group || admin) ? <Button size="sm" variant={conv.aiEnabled ? 'ghost' : 'secondary'} icon="c-robot" onClick={() => act(api.c('PUT', `/ai/conversations/${conv.id}`, { enabled: !conv.aiEnabled }))} label={t('Assistante')}>{conv.aiEnabled ? t("Retirer l'assistante") : t("Inviter l'assistante")}</Button> : <small className="ci-muted">{t("Seul un administrateur du groupe peut inviter l'assistante.")}</small>}
        </Section>
      )}
      {group && admin && (
        <Section title={t('Réglages du groupe')}>
          <label className="ci-check"><input type="checkbox" checked={conv.onlyAdminsPost} onChange={(e) => act(api.c('PUT', `/conversations/${conv.id}`, { onlyAdminsPost: e.target.checked }))} /> {t('Seuls les administrateurs peuvent écrire')}</label>
        </Section>
      )}
      <Section title={`${t('Membres')} (${members.length})`} actions={group && admin ? <Button size="sm" variant="ghost" icon="c-user-plus" onClick={addMembers} label={t('Ajouter')}>{t('Ajouter')}</Button> : null}>
        <ul className="ci-members">
          {members.map((m) => {
            const pr = presence[m.userId] || {};
            return (
              <li key={m.userId}>
                <Avatar name={m.name} id={m.userId} online={pr.online} />
                <span className="ci-grow"><b>{m.name}{m.userId === meId ? ` (${t('vous')})` : ''}</b><small>{m.title || ''}{m.title ? ' · ' : ''}{pr.online === null ? '' : pr.online ? t('En ligne') : fmtSeen(pr.lastSeen, t)}</small></span>
                {m.role === 'admin' && <span className="ci-chip"><Icon name="c-crown" /> {t('Admin')}</span>}
                {group && admin && m.userId !== meId && (
                  <span className="ci-row-act">
                    <Button size="sm" variant="ghost" iconOnly icon={m.role === 'admin' ? 'c-user-minus' : 'c-crown'} label={m.role === 'admin' ? t('Retirer le rôle d’administrateur') : t('Nommer administrateur')} onClick={() => act(api.c('PUT', `/conversations/${conv.id}/members/${m.userId}`, { role: m.role === 'admin' ? 'member' : 'admin' }))} />
                    <Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Retirer du groupe')} onClick={() => confirm(t('Retirer {name} du groupe ?', { name: m.name }), () => act(api.c('DELETE', `/conversations/${conv.id}/members/${m.userId}`)), t('Retirer'))} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
      {group && <Button variant="danger" icon="c-leave" onClick={() => confirm(t('Quitter ce groupe ? Vous ne pourrez plus lire ses messages.'), () => api.c('POST', `/conversations/${conv.id}/leave`, {}).then(() => { reload(true); onClose(); }, fail), t('Quitter'))} label={t('Quitter le groupe')}>{t('Quitter le groupe')}</Button>}
      {detail && detail.pins.length > 0 && <Section title={t('Messages épinglés')}><ul className="ci-pins">{detail.pins.map((p) => <li key={p.id}><Icon name="c-pin" /> <button type="button" onClick={() => document.getElementById(`ci-m-${p.id}`) && document.getElementById(`ci-m-${p.id}`).scrollIntoView({ block: 'center' })}><b>{p.senderName}</b> {conv.e2ee ? '🔒' : p.body.slice(0, 100)}</button></li>)}</ul></Section>}
      <span hidden>{orgId}{String(can)}</span>
    </PanelFrame>
  );
}

function Picker({ people, onSubmit, submit, t, extra, one }) {
  const [sel, setSel] = useState(new Set()); const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  const list = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <form className="ws-form" onSubmit={async (e) => { e.preventDefault(); if (!sel.size) return; setBusy(true); try { await onSubmit([...sel], new FormData(e.target)); } finally { setBusy(false); } }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rechercher une personne')} aria-label={t('Rechercher une personne')} />
      <ul className="ci-pick">{list.map((p) => (
        <li key={p.userId}><label><input type={one ? 'radio' : 'checkbox'} name="p" checked={sel.has(p.userId)} onChange={() => setSel(one ? new Set([p.userId]) : (s) => { const n = new Set(s); if (n.has(p.userId)) n.delete(p.userId); else n.add(p.userId); return n; })} />
          <Avatar name={p.name} id={p.userId} online={p.online} /> <span><b>{p.name}</b><small>{p.title}</small></span></label></li>))}</ul>
      {extra}
      <Button type="submit" variant="primary" loading={busy} disabled={!sel.size} label={submit}>{submit}</Button>
    </form>
  );
}
export { Picker };

export function FilesPanel({ api, conv, onClose, onJump }) {
  const t = useT();
  const { fail, toast } = useWs();
  const [cat, setCat] = useState(''); const [q, setQ] = useState(''); const [folder, setFolder] = useState(''); const [all, setAll] = useState(false);
  const [data, setData] = useState(null); const [folders, setFolders] = useState([]);
  const load = () => api.c('GET', `/files?${all || !conv ? '' : `conv=${conv.id}&`}${cat ? `category=${cat}&` : ''}${folder ? `folder=${encodeURIComponent(folder)}&` : ''}${q ? `q=${encodeURIComponent(q)}` : ''}`).then((j) => setData(j.files), fail);
  useEffect(() => { load(); }, [cat, folder, all, conv && conv.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.c('GET', '/folders').then((j) => setFolders(j.folders), () => {}); }, [api, data]);
  const download = async (f) => { try { const raw = await api.fetchBytes(f.id); const u = URL.createObjectURL(new Blob([raw], { type: f.mime })); const a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } catch (e) { fail(e); } };
  const classify = (f) => { const name = window.prompt(t('Nom du dossier de classement (vide pour retirer)'), f.folder || ''); if (name === null) return; api.c('PUT', `/files/${f.id}`, { folder: name }).then(() => { toast(t('Fichier classé')); load(); }, fail); };
  const cats = [['', t('Tous')], ['image', t('Images')], ['pdf', 'PDF'], ['word', 'Word'], ['excel', 'Excel'], ['presentation', t('Présentations')], ['video', t('Vidéos')], ['audio', t('Audio')], ['text', t('Textes')]];
  return (
    <PanelFrame title={t('Fichiers partagés')} onClose={onClose}>
      <form className="ci-search" onSubmit={(e) => { e.preventDefault(); load(); }}><Icon name="search" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Nom du fichier')} aria-label={t('Nom du fichier')} /></form>
      <div className="ci-tabs">{cats.map(([id, l]) => <button key={id} type="button" className={cat === id ? 'on' : ''} onClick={() => setCat(id)}>{l}</button>)}</div>
      <div className="ci-row-flex">
        {conv && <label className="ci-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('Toutes mes conversations')}</label>}
        {folders.length > 0 && <select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label={t('Dossier')}><option value="">{t('Tous les dossiers')}</option>{folders.map((f) => <option key={f.name} value={f.name}>{f.name} ({f.count})</option>)}</select>}
      </div>
      {!data && <p className="ci-muted">{t('Chargement…')}</p>}
      {data && !data.length && <p className="ci-muted">{t('Aucun fichier partagé.')}</p>}
      <ul className="ci-filelist">{(data || []).map((f) => (
        <li key={f.id}><span className="ci-file-ico"><Icon name={{ image: 'c-image', pdf: 'c-pdf', word: 'c-word', excel: 'c-excel', presentation: 'c-ppt', video: 'c-film', audio: 'c-audio', encrypted: 'c-lock' }[f.category] || 'c-file'} /></span>
          <span className="ci-grow"><b>{f.category === 'encrypted' ? t('Fichier chiffré') : f.name}</b><small>{f.convName} · {f.uploader} · {fmtSize(f.size)} · {fmtShort(f.at, t)}{f.folder ? ` · ${f.folder}` : ''}</small></span>
          {f.category !== 'encrypted' && <Button size="sm" variant="ghost" iconOnly icon="download" label={t('Télécharger')} onClick={() => download(f)} />}
          {f.category !== 'encrypted' && <Button size="sm" variant="ghost" iconOnly icon="c-folder" label={t('Classer')} onClick={() => classify(f)} />}
          <Button size="sm" variant="ghost" iconOnly icon="arrow-right" label={t('Voir dans la conversation')} onClick={() => onJump(f.convId, f.messageId)} /></li>))}</ul>
    </PanelFrame>
  );
}

export function SearchPanel({ api, onClose, onJump, aiOn, initial }) {
  const t = useT();
  const { fail } = useWs();
  const [q, setQ] = useState(initial || ''); const [smart, setSmart] = useState(aiOn); const [res, setRes] = useState(null); const [busy, setBusy] = useState(false);
  const go = async (e) => { e && e.preventDefault(); if (q.trim().length < 2) return; setBusy(true); try { setRes(await api.c('GET', `/search?q=${encodeURIComponent(q.trim())}${smart ? '&smart=1' : ''}`)); } catch (er) { fail(er); } finally { setBusy(false); } };
  return (
    <PanelFrame title={t('Recherche')} onClose={onClose}>
      <form className="ci-search" onSubmit={go}><Icon name="search" /><input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Messages, fichiers, personnes…')} aria-label={t('Rechercher')} /><Button type="submit" size="sm" loading={busy} label={t('Chercher')}>{t('Chercher')}</Button></form>
      {aiOn && <label className="ci-check"><input type="checkbox" checked={smart} onChange={(e) => setSmart(e.target.checked)} /> {t('Recherche intelligente (mots proches, par l’IA)')}</label>}
      {res && res.smart && res.smart.reason && <p className="ci-muted"><Icon name="info" /> {res.smart.reason} {t('Recherche par mots exacts.')}</p>}
      {res && res.smart && res.smart.used && <p className="ci-muted"><Icon name="magic" /> {t('Mots proches ajoutés')} : {res.smart.terms.join(', ')}</p>}
      {res && (
        <>
          <Section title={`${t('Messages')} (${res.messages.length})`}><ul className="ci-results">{res.messages.map((m) => <li key={m.id}><button type="button" onClick={() => onJump(m.convId, m.id)}><b>{m.convName}</b><small>{m.senderName} · {fmtShort(m.at, t)}</small><span>{m.text}</span></button></li>)}</ul></Section>
          <Section title={`${t('Fichiers')} (${res.files.length})`}><ul className="ci-results">{res.files.map((f) => <li key={f.id}><button type="button" onClick={() => onJump(f.convId, null)}><b>{f.name}</b><small>{f.uploader} · {fmtSize(f.size)}</small></button></li>)}</ul></Section>
          <Section title={`${t('Personnes')} (${res.people.length})`}><ul className="ci-results">{res.people.map((p) => <li key={p.userId}><button type="button" onClick={() => onJump(null, null, p.userId)}><b>{p.name}</b><small>{p.title}</small></button></li>)}</ul></Section>
        </>
      )}
    </PanelFrame>
  );
}

/** Carte des personnes connectées qui partagent leur position (chaque personne l'active elle-même). */
export function MapPanel({ api, geo, setGeo, onClose, onChat, meId }) {
  const t = useT();
  const { fail, confirm, toast } = useWs();
  const [people, setPeople] = useState(null);
  const load = () => api.c('GET', '/geo/people').then((j) => setPeople(j.people), fail);
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (geo.tick) load(); }, [geo.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => {
    if (geo.enabled) { api.c('PUT', '/geo/me', { enabled: false }).then(() => { setGeo((g) => ({ ...g, enabled: false })); window.dispatchEvent(new Event('chat-geo-changed')); toast(t('Votre position n’est plus partagée.')); load(); }, fail); return; }
    confirm(t("Partager votre position en direct ? Vos collègues connectés verront où vous êtes, tant que vous êtes connecté(e) et que cette fonction est active. Vous pouvez l'arrêter à tout moment (vos coordonnées sont alors effacées)."), () => api.c('PUT', '/geo/me', { enabled: true, consent: true }).then(() => { setGeo((g) => ({ ...g, enabled: true })); window.dispatchEvent(new Event('chat-geo-changed')); toast(t('Position activée.')); setTimeout(load, 1500); }, fail), t('Activer'));
  };
  const points = useMemo(() => (people || []).map((p) => ({ lat: p.lat, lng: p.lng, glyph: p.name[0], cls: p.me ? 'ok' : '', label: `${p.name}${p.title ? ' — ' + p.title : ''}`, onClick: () => {} })), [people]);
  return (
    <PanelFrame title={t('Géolocalisation')} onClose={onClose}>
      <div className="ci-geo-toggle">
        <Icon name="c-pos" />
        <span className="ci-grow"><b>{geo.enabled ? t('Votre position est partagée') : t('Votre position n’est pas partagée')}</b><small>{t('Visible seulement par les membres de votre entreprise, pendant que vous êtes connecté(e).')}</small></span>
        <Button size="sm" variant={geo.enabled ? 'secondary' : 'primary'} onClick={toggle} label={geo.enabled ? t('Arrêter') : t('Activer')}>{geo.enabled ? t('Arrêter') : t('Activer')}</Button>
      </div>
      {geo.error && <p className="ci-err">{geo.error}</p>}
      {people && people.length > 0 && <div className="ci-map"><GeoMap points={points} height={260} ariaLabel={t('Carte des collègues connectés')} /></div>}
      {people && !people.length && <p className="ci-muted">{t('Personne ne partage sa position pour le moment.')}</p>}
      <ul className="ci-members">{(people || []).map((p) => (
        <li key={p.userId}><Avatar name={p.name} id={p.userId} online /> <span className="ci-grow"><b>{p.name}{p.me ? ` (${t('vous')})` : ''}</b><small>{p.title}{p.title ? ' · ' : ''}{t('en ligne')} · ±{p.accuracy} m · {fmtShort(p.updatedAt, t)}</small></span>
          {!p.me && <Button size="sm" variant="ghost" iconOnly icon="comments" label={t('Écrire à {name}', { name: p.name })} onClick={() => onChat(p.userId)} />}</li>))}</ul>
      <span hidden>{meId}</span>
    </PanelFrame>
  );
}

export function CallsPanel({ api, conv, onClose, onCall }) {
  const t = useT();
  const { fail } = useWs();
  const [calls, setCalls] = useState(null);
  useEffect(() => { api.c('GET', '/calls' + (conv ? `?conv=${conv.id}` : '')).then((j) => setCalls(j.calls), fail); }, [conv && conv.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = { ended: t('Terminé'), missed: t('Manqué'), declined: t('Refusé'), cancelled: t('Annulé'), ringing: t('Sonnerie'), active: t('En cours') };
  return (
    <PanelFrame title={t('Historique des appels')} onClose={onClose}>
      {!calls && <p className="ci-muted">{t('Chargement…')}</p>}
      {calls && !calls.length && <p className="ci-muted">{t('Aucun appel.')}</p>}
      <ul className="ci-members">{(calls || []).map((c) => (
        <li key={c.id}><span className={'ci-callico' + (c.status === 'missed' ? ' miss' : '')}><Icon name={c.kind === 'video' ? 'c-video' : 'c-phone'} /></span>
          <span className="ci-grow"><b>{c.convName}</b><small>{c.outgoing ? t('Sortant') : t('Entrant')} · {st[c.status]} · {fmtShort(c.startedAt, t)}{c.durationSec ? ` · ${fmtDur(c.durationSec)}` : ''}{c.group ? ` · ${c.peak} ${t('pers.')}` : ''}</small></span>
          <Button size="sm" variant="ghost" iconOnly icon="c-phone" label={t('Rappeler')} onClick={() => onCall(c.convId, c.kind)} /></li>))}</ul>
    </PanelFrame>
  );
}

export function LaterPanel({ api, onClose, onJump }) {
  const t = useT();
  const { fail, toast } = useWs();
  const [s, setS] = useState(null); const [r, setR] = useState(null);
  const load = () => { api.c('GET', '/scheduled').then((j) => setS(j.scheduled), fail); api.c('GET', '/reminders').then((j) => setR(j.reminders), fail); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  const when = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  return (
    <PanelFrame title={t('Programmés et rappels')} onClose={onClose}>
      <Section title={t('Messages programmés')}>
        {s && !s.length && <p className="ci-muted">{t('Aucun message programmé.')}</p>}
        <ul className="ci-members">{(s || []).map((x) => <li key={x.id}><Icon name="clock" /><span className="ci-grow"><b>{x.body.slice(0, 80)}</b><small>{when(x.sendAt)}</small></span><Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Annuler')} onClick={() => api.c('DELETE', `/scheduled/${x.id}`).then(() => { toast(t('Message annulé')); load(); }, fail)} /></li>)}</ul>
      </Section>
      <Section title={t('Rappels')}>
        {r && !r.length && <p className="ci-muted">{t('Aucun rappel.')}</p>}
        <ul className="ci-members">{(r || []).map((x) => <li key={x.id}><Icon name="bell" /><span className="ci-grow"><b>{x.note || t('Rappel')}</b><small>{when(x.remindAt)}</small></span><Button size="sm" variant="ghost" iconOnly icon="arrow-right" label={t('Voir le message')} onClick={() => onJump(x.convId, x.messageId)} /><Button size="sm" variant="ghost" iconOnly icon="trash" label={t('Annuler')} onClick={() => api.c('DELETE', `/reminders/${x.id}`).then(load, fail)} /></li>)}</ul>
      </Section>
    </PanelFrame>
  );
}

export function SettingsPanel({ api, boot, reloadBoot, onClose, canAdmin }) {
  const t = useT();
  const { fail, toast } = useWs();
  const [s, setS] = useState(null); const [cats, setCats] = useState([]); const [busy, setBusy] = useState(false);
  useEffect(() => { api.c('GET', '/settings').then((j) => { setS(j.settings); setCats(j.categories); }, fail); }, [api, fail]);
  const prefs = boot.prefs;
  const savePref = (k, v) => api.c('PUT', '/prefs', { [k]: v }).then(reloadBoot, fail);
  const save = async () => { setBusy(true); try { await api.c('PUT', '/settings', s); toast(t('Réglages enregistrés')); reloadBoot(); } catch (e) { fail(e); } finally { setBusy(false); } };
  return (
    <PanelFrame title={t('Réglages du chat')} onClose={onClose}>
      <Section title={t('Mes préférences')}>
        <label className="ci-check"><input type="checkbox" checked={prefs.readReceipts} onChange={(e) => savePref('readReceipts', e.target.checked)} /> {t('Envoyer des accusés de lecture')}</label>
        <label className="ci-check"><input type="checkbox" checked={prefs.showPresence} onChange={(e) => savePref('showPresence', e.target.checked)} /> {t('Montrer quand je suis en ligne')}</label>
      </Section>
      {canAdmin && s && (
        <Section title={t("Réglages de l'entreprise")}>
          <label>{t('Taille maximale d’un fichier (Mo)')}<input type="number" min="1" max={boot.settings.hardMaxFileMb} value={s.maxFileMb} onChange={(e) => setS({ ...s, maxFileMb: Number(e.target.value) })} /></label>
          <fieldset className="ci-fs"><legend>{t('Formats de fichiers autorisés')}</legend>
            {cats.map((c) => <label key={c.id} className="ci-check"><input type="checkbox" checked={s.allowedKinds.includes(c.id)} onChange={(e) => setS({ ...s, allowedKinds: e.target.checked ? [...s.allowedKinds, c.id] : s.allowedKinds.filter((x) => x !== c.id) })} /> {c.label}</label>)}</fieldset>
          <label className="ci-check"><input type="checkbox" checked={s.aiEnabled} onChange={(e) => setS({ ...s, aiEnabled: e.target.checked })} /> {t("Autoriser l'assistante dans les conversations")}</label>
          <label className="ci-check"><input type="checkbox" checked={s.callsEnabled} onChange={(e) => setS({ ...s, callsEnabled: e.target.checked })} /> {t('Autoriser les appels audio et vidéo')}</label>
          <label>{t('Qui peut créer un groupe ?')}<select value={s.groupsBy} onChange={(e) => setS({ ...s, groupsBy: e.target.value })}><option value="all">{t('Tout le monde')}</option><option value="manager">{t('Les responsables et plus')}</option></select></label>
          <Button variant="primary" loading={busy} onClick={save} label={t('Enregistrer')}>{t('Enregistrer')}</Button>
        </Section>
      )}
    </PanelFrame>
  );
}
