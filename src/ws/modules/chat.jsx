import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLang, useT } from '../../lib/i18n.jsx';
import { Icon } from '../../lib/fa.jsx';
import { useWs } from '../WsContext.jsx';
import { Button } from '../ui.jsx';
import '../../styles/ws-chat.css';
import '../../styles/ws-geo.css'; // épingles de la carte (GeoMap)
import '../parts/chat/chatIcons.js';
import { useChatApi } from '../parts/chat/api.js';
import { useChatLive } from '../parts/chat/live.js';
import * as E from '../parts/chat/crypto.js';
import Sidebar, { Avatar } from '../parts/chat/Sidebar.jsx';
import Thread, { ThreadHeader } from '../parts/chat/Thread.jsx';
import Composer from '../parts/chat/Composer.jsx';
import CallLayer from '../parts/chat/Call.jsx';
import { CallsPanel, FilesPanel, InfoPanel, LaterPanel, MapPanel, Picker, SearchPanel, SettingsPanel } from '../parts/chat/Panels.jsx';
import { setChatUnread } from '../parts/chat/unread.js';
import { ObjectPicker, SaveToLibrary } from '../parts/chat/ObjectUI.jsx';

/* Chat interne : conversations privées et groupes, fichiers, appels, assistante. Le serveur contrôle les droits de chaque action
   (une conversation n'est lisible que par ses participants). Mise en page : 3 colonnes sur ordinateur, une colonne à la fois sur mobile. */
const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', mp3: 'audio/mpeg', webm: 'audio/webm', txt: 'text/plain', csv: 'text/csv' };
const mimeOf = (name) => MIME[(/\.([a-z0-9]+)$/i.exec(name) || [])[1] ? (/\.([a-z0-9]+)$/i.exec(name)[1]).toLowerCase() : ''] || 'application/octet-stream';
const emptyState = { list: [], hasMore: false, loaded: false };

export default function Chat() {
  const t = useT();
  const ws = useWs();
  const { info, toast, fail, confirm, modal, orgId } = ws;
  const navigate = useNavigate();
  const api = useChatApi();
  const meId = info.me.userId;
  const meName = (ws.user && ws.user.name) || '';
  const [boot, setBoot] = useState(null); const [bootErr, setBootErr] = useState('');
  const [convs, setConvs] = useState([]); const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [msgs, setMsgs] = useState({}); const [detail, setDetail] = useState({});
  const [typing, setTyping] = useState({}); const [presence, setPresence] = useState({});
  const [filter, setFilter] = useState('all');
  const [panel, setPanel] = useState(null); const [searchInit, setSearchInit] = useState('');
  const [reply, setReply] = useState(null); const [edit, setEdit] = useState(null);
  const [jumpTo, setJumpTo] = useState(null);
  const [geo, setGeo] = useState({ enabled: false, tick: 0, error: '' }); const [geoCount, setGeoCount] = useState(0);
  const [texts, setTexts] = useState({}); const [plainNames, setPlainNames] = useState({});
  const [keys, setKeys] = useState({}); // convId -> { key, mine, theirJwk }
  const [e2eInfo, setE2eInfo] = useState({ ok: false });
  const [aiStatus, setAiStatus] = useState(null);
  const callRef = useRef(null); const activeRef = useRef(null); const convsRef = useRef([]); const msgsRef = useRef({}); const kicked = useRef(0);
  activeRef.current = activeId; convsRef.current = convs; msgsRef.current = msgs;
  const conv = convs.find((c) => c.id === activeId) || null;
  const members = (detail[activeId] && detail[activeId].members) || [];
  const names = useMemo(() => members.map((m) => m.name), [members]);

  // ---------- Chargement ----------
  const loadBoot = useCallback(() => api.c('GET', '').then((j) => { setBoot(j); return j; }, (e) => { setBootErr(e.message); }), [api]);
  const loadConvs = useCallback(async (archived) => {
    try {
      const j = await api.c('GET', '/conversations' + (archived ? '?archived=1' : ''));
      setConvs(j.conversations); setLoadingList(false);
      if (!archived) setChatUnread(j.conversations.filter((c) => !c.muted).reduce((a, c) => a + c.unread, 0));
      return j.conversations;
    } catch (e) { setLoadingList(false); fail(e); return []; }
  }, [api, fail]);
  const loadPresence = useCallback(() => api.c('GET', '/people').then((j) => { const p = {}; for (const x of j.people) p[x.userId] = { online: x.online, lastSeen: x.lastSeen }; setPresence(p); }, () => {}), [api]);
  const loadGeo = useCallback(() => { api.c('GET', '/geo/me').then((j) => setGeo((g) => ({ ...g, enabled: j.enabled })), () => {}); api.c('GET', '/geo/people').then((j) => setGeoCount(j.people.length), () => {}); }, [api]);
  useEffect(() => { loadBoot(); }, [loadBoot]);
  useEffect(() => { if (!boot) return; loadConvs(filter === 'archived'); loadPresence(); loadGeo(); api.c('GET', '/ai/status').then(setAiStatus, () => {}); }, [boot && boot.epoch, filter === 'archived']); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const i = setInterval(loadPresence, 30000); return () => clearInterval(i); }, [loadPresence]);

  // ---------- Chiffrement de bout en bout : clés de cet appareil ----------
  useEffect(() => {
    if (!boot) return;
    if (!E.supported()) { setE2eInfo({ ok: false, why: t("Ce navigateur ne permet pas le chiffrement de bout en bout.") }); return; }
    (async () => {
      try {
        const mine = await E.ensureKeys(orgId, meId);
        const srv = await api.c('GET', '/keys/me');
        if (!srv.publicKey || !E.sameKey(srv.publicKey, mine.jwk)) await api.c('PUT', '/keys/me', { publicKey: mine.jwk });
        setE2eInfo({ ok: true, mine });
      } catch { setE2eInfo({ ok: false, why: t("Le chiffrement n'a pas pu être préparé sur cet appareil.") }); }
    })();
  }, [boot && boot.epoch]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadKey = useCallback(async (c) => {
    if (!c || !c.e2ee || !e2eInfo.ok || keys[c.id]) return;
    try {
      const j = await api.c('GET', `/keys/${c.otherUserId}`);
      if (!j.publicKey) return;
      const key = await E.sharedKey(e2eInfo.mine, j.publicKey);
      setKeys((k) => ({ ...k, [c.id]: { key, myJwk: e2eInfo.mine.jwk, theirJwk: j.publicKey } }));
    } catch { /* clé indisponible : les messages restent illisibles */ }
  }, [api, e2eInfo, keys]);

  // ---------- Messages d'une conversation ----------
  const loadMessages = useCallback(async (id, { before, refresh } = {}) => {
    try {
      const j = await api.c('GET', `/conversations/${id}/messages?limit=40${before ? `&before=${before}` : ''}`);
      setMsgs((s) => {
        const cur = s[id] || emptyState;
        let list;
        if (before) list = [...j.messages, ...cur.list];
        else if (refresh && cur.list.length) { const first = j.messages.length ? j.messages[0].id : 0; list = [...cur.list.filter((m) => m.id < first), ...j.messages]; }
        else list = j.messages;
        return { ...s, [id]: { list, hasMore: before || !refresh ? j.hasMore : cur.hasMore, loaded: true } };
      });
    } catch (e) { fail(e); }
  }, [api, fail]);
  const loadDetail = useCallback((id) => api.c('GET', `/conversations/${id}`).then((j) => { setDetail((d) => ({ ...d, [id]: j })); setConvs((cs) => cs.map((c) => (c.id === id ? j.conversation : c))); }, (e) => { if (e.status === 404) { setActiveId(null); loadConvs(); } else fail(e); }), [api, fail, loadConvs]);
  const markRead = useCallback((id) => { if (document.hidden) return; api.c('POST', `/conversations/${id}/read`, {}).then(() => { setConvs((cs) => { const n = cs.map((c) => (c.id === id ? { ...c, unread: 0, mentioned: 0 } : c)); setChatUnread(n.filter((c) => !c.muted && !c.archived).reduce((a, c) => a + c.unread, 0)); return n; }); }, () => {}); }, [api]);
  const [firstUnread, setFirstUnread] = useState(null);
  const open = useCallback(async (id, jump) => {
    setActiveId(id); setPanel(null); setReply(null); setEdit(null);
    const c = convsRef.current.find((x) => x.id === id);
    const first = msgsRef.current[id] && msgsRef.current[id].list.find((m) => !m.mine && m.id > 0);
    void first;
    await loadMessages(id); await loadDetail(id);
    if (c) loadKey(c);
    if (jump) setTimeout(() => setJumpTo({ id: jump, k: Date.now() }), 150);
    markRead(id);
  }, [loadMessages, loadDetail, loadKey, markRead]);
  useEffect(() => { if (conv && conv.e2ee) loadKey(conv); }, [conv && conv.id, conv && conv.e2ee, e2eInfo.ok]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // le premier message non lu est repéré à l'ouverture
    if (!conv) { setFirstUnread(null); return; }
    const list = (msgs[conv.id] || emptyState).list;
    if (conv.unread > 0 && list.length && firstUnread === null) { const others = list.filter((m) => !m.mine && m.kind !== 'system'); const m = others[Math.max(0, others.length - conv.unread)]; if (m) setFirstUnread(m.id); }
  }, [conv && conv.id, (msgs[activeId] || emptyState).loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFirstUnread(null); }, [activeId]);

  // ---------- Déchiffrement des messages (conversations chiffrées) ----------
  const kk = conv && keys[conv.id];
  useEffect(() => {
    if (!conv || !conv.e2ee || !kk) return;
    const list = (msgs[conv.id] || emptyState).list;
    (async () => {
      const add = {}; const addN = {};
      for (const m of list) {
        if (m.deleted || texts[m.id] !== undefined || !['text', 'file', 'voice'].includes(m.kind)) continue;
        try {
          if (m.kind === 'text') add[m.id] = await E.decryptText(kk.key, m.body);
          else if (m.kind === 'file') addN[m.id] = await E.decryptText(kk.key, m.file ? m.file.name : m.body);
        } catch { add[m.id] = t('🔒 Message illisible sur cet appareil'); }
      }
      if (Object.keys(add).length) setTexts((x) => ({ ...x, ...add }));
      if (Object.keys(addN).length) setPlainNames((x) => ({ ...x, ...addN }));
    })();
  }, [msgs, kk]); // eslint-disable-line react-hooks/exhaustive-deps
  const e2e = kk ? { key: kk.key, mime: mimeOf, myJwk: kk.myJwk, theirJwk: kk.theirJwk } : null;

  // ---------- Temps réel ----------
  const upsert = useCallback((id, message, replace) => setMsgs((s) => {
    const cur = s[id]; if (!cur || !cur.loaded) return s;
    const i = cur.list.findIndex((m) => m.id === message.id);
    const list = i >= 0 ? cur.list.map((m, j) => (j === i ? { ...message, mine: m.mine || message.mine, delivered: message.delivered === undefined ? m.delivered : message.delivered, read: message.read === undefined ? m.read : message.read, readBy: message.readBy || m.readBy } : m)) : replace ? cur.list : [...cur.list, message];
    return { ...s, [id]: { ...cur, list } };
  }), []);
  const refreshTimer = useRef(null);
  const onLive = useCallback((type, d) => {
    if (type.startsWith('call.')) { callRef.current && callRef.current.handle(type, d); return; }
    if (type === 'message') {
      const id = d.convId; const m = d.message;
      upsert(id, m, false);
      const known = convsRef.current.some((c) => c.id === id);
      if (!known) { loadConvs(filter === 'archived'); return; }
      const active = activeRef.current === id && !document.hidden;
      setConvs((cs) => {
        const next = cs.map((c) => (c.id === id ? { ...c, last: { id: m.id, kind: m.kind, senderId: m.senderId, senderName: m.senderName, text: m.kind === 'system' ? '' : (c.e2ee ? '' : String(m.body || '').slice(0, 120)), encrypted: c.e2ee && m.kind !== 'system', deleted: false, at: m.createdAt, urgent: m.urgent }, lastAt: m.createdAt, unread: !m.mine && d.unreadFor && m.kind !== 'system' && m.kind !== 'call' && !m.privateToMe && !active ? c.unread + 1 : c.unread } : c));
        next.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
        setChatUnread(next.filter((c) => !c.muted && !c.archived).reduce((a, c) => a + c.unread, 0));
        return next;
      });
      if (activeRef.current === id) { if (!m.mine && !document.hidden) markRead(id); if (m.kind === 'system') loadDetail(id); }
      if (!m.mine && m.kind === 'message') void 0;
      if (!active && !m.mine && m.kind !== 'system' && m.urgent) toast(`${m.senderName} : ${t('message urgent')}`);
      setTyping((s) => { if (!s[id]) return s; const n = { ...s[id] }; delete n[m.senderId]; return { ...s, [id]: n }; });
    } else if (type === 'message.update') upsert(d.convId, d.message, true);
    else if (type === 'message.delete') setMsgs((s) => { const cur = s[d.convId]; return cur ? { ...s, [d.convId]: { ...cur, list: cur.list.map((m) => (m.id === d.messageId ? { ...m, deleted: true, body: '', file: null } : m)) } } : s; });
    else if (type === 'receipt') { if (activeRef.current === d.convId) { clearTimeout(refreshTimer.current); refreshTimer.current = setTimeout(() => loadMessages(d.convId, { refresh: true }), 500); } }
    else if (type === 'read') setConvs((cs) => cs.map((c) => (c.id === d.convId ? { ...c, unread: 0, mentioned: 0 } : c)));
    else if (type === 'typing') {
      setTyping((s) => ({ ...s, [d.convId]: { ...(s[d.convId] || {}), [d.userId]: d.kind ? { kind: d.kind, name: d.name, at: Date.now() } : undefined } }));
      setTimeout(() => setTyping((s) => ({ ...s })), 7200);
    } else if (type === 'presence') setPresence((p) => ({ ...p, [d.userId]: { online: d.online, lastSeen: d.lastSeen || null } }));
    else if (type === 'conversation') { loadConvs(filter === 'archived'); if (activeRef.current === d.convId) { if (d.removed) setActiveId(null); else loadDetail(d.convId); } }
    else if (type === 'reminder') toast(`⏰ ${d.note || t('Rappel : un message vous attend.')}`);
    else if (type === 'geo') { setGeo((g) => ({ ...g, tick: g.tick + 1 })); api.c('GET', '/geo/people').then((j) => setGeoCount(j.people.length), () => {}); }
    else if (type === 'reset' || type === 'connected') { if (Date.now() - kicked.current > 3000) { kicked.current = Date.now(); loadConvs(filter === 'archived'); loadPresence(); if (activeRef.current) { loadMessages(activeRef.current, { refresh: true }); loadDetail(activeRef.current); } } }
  }, [upsert, loadConvs, loadDetail, loadMessages, loadPresence, markRead, toast, t, api, filter]);
  const mode = useChatLive(orgId, boot && boot.epoch, onLive);
  useEffect(() => { const f = () => { if (!document.hidden && activeRef.current) markRead(activeRef.current); }; document.addEventListener('visibilitychange', f); window.addEventListener('focus', f); return () => { document.removeEventListener('visibilitychange', f); window.removeEventListener('focus', f); }; }, [markRead]);
  useEffect(() => { // un « écrit… » périmé s'efface même sans nouvel événement
    const i = setInterval(() => setTyping((s) => { let ch = false; const n = {}; for (const [c, v] of Object.entries(s)) { const m = {}; for (const [u, x] of Object.entries(v)) if (x && x.at > Date.now() - 7000) m[u] = x; else ch = true; n[c] = m; } return ch ? n : s; }), 3000);
    return () => clearInterval(i);
  }, []);

  // ---------- Envoi ----------
  const typingNow = (() => { const ty = conv && typing[conv.id] ? Object.values(typing[conv.id]).filter((x) => x && x.at > Date.now() - 7000) : []; if (!ty.length) return ''; return ty[0].kind === 'recording' ? t('{name} enregistre un audio…', { name: ty[0].name }) : t('{name} écrit…', { name: ty[0].name }); })();
  const lastTyping = useRef(0);
  const sendTyping = useCallback((kind) => { if (!conv) return; if (kind !== 'none' && Date.now() - lastTyping.current < 2500) return; lastTyping.current = Date.now(); api.c('POST', `/conversations/${conv.id}/typing`, { kind }).catch(() => {}); }, [api, conv]);
  const add = (id, m) => { upsert(id, m, false); setMsgs((s) => (s[id] && !s[id].list.some((x) => x.id === m.id) ? { ...s, [id]: { ...s[id], list: [...s[id].list, m] } } : s)); };
  const bump = (id, m) => setConvs((cs) => { const n = cs.map((c) => (c.id === id ? { ...c, lastAt: m.createdAt, last: { id: m.id, kind: m.kind, senderId: m.senderId, senderName: m.senderName, text: c.e2ee ? '' : String(m.body || '').slice(0, 120), encrypted: c.e2ee, at: m.createdAt } } : c)); n.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)); return n; });
  const needKey = () => { if (conv.e2ee && !kk) { toast(t("La clé de chiffrement n'est pas prête sur cet appareil."), true); return false; } return true; };
  const send = async ({ body, urgent }) => {
    if (!conv || !needKey()) throw new Error('x');
    try {
      if (edit) { const j = await api.c('PUT', `/messages/${edit.id}`, conv.e2ee ? { cipher: await E.encryptText(kk.key, body) } : { body }); upsert(conv.id, j.message, true); if (conv.e2ee) setTexts((x) => ({ ...x, [edit.id]: body })); setEdit(null); return; }
      const payload = conv.e2ee ? { cipher: await E.encryptText(kk.key, body.slice(0, 3000)) } : { body, urgent };
      if (reply) payload.replyToId = reply.id;
      const j = await api.c('POST', `/conversations/${conv.id}/messages`, payload);
      if (conv.e2ee) setTexts((x) => ({ ...x, [j.message.id]: body }));
      add(conv.id, j.message); bump(conv.id, j.message); setReply(null); sendTyping('none');
    } catch (e) { fail(e); throw e; }
  };
  const sendFile = async (file, extra = '') => {
    if (!conv || !needKey()) return;
    const max = (boot.settings.maxFileMb || 8) * 1024 * 1024;
    if (file.size > max) { toast(t('Fichier trop volumineux : {n} Mo au maximum.', { n: boot.settings.maxFileMb }), true); return; }
    const tid = t('Envoi de « {name} »…', { name: file.name });
    toast(tid);
    try {
      let bytes = await file.arrayBuffer(); let q = `conv=${conv.id}&name=${encodeURIComponent(file.name)}${extra}${reply ? `&replyTo=${reply.id}` : ''}`;
      if (conv.e2ee) { bytes = await E.encryptBytes(kk.key, bytes); q = `conv=${conv.id}&name=${encodeURIComponent(await E.encryptText(kk.key, file.name.slice(0, 100)))}${extra}`; }
      const j = await api.upload(q, bytes);
      if (conv.e2ee) setPlainNames((x) => ({ ...x, [j.message.id]: file.name }));
      add(conv.id, j.message); bump(conv.id, j.message); setReply(null);
    } catch (e) { fail(e); }
  };
  const sendVoice = async (blob, dur) => {
    const ext = /mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
    await sendFile(new File([blob], `message-vocal.${ext}`, { type: blob.type }), `&voice=1&durationMs=${dur}`);
  };
  const act = {
    reply: (m) => { setEdit(null); setReply({ id: m.id, senderName: m.senderName, snippet: conv.e2ee ? '🔒' : (m.kind === 'text' ? m.body.slice(0, 80) : m.kind === 'voice' ? '🎤' : m.file ? m.file.name : '') }); },
    quoteText: (r) => (conv && conv.e2ee ? (texts[r.id] ? texts[r.id].slice(0, 80) : '🔒') : r.snippet),
    copy: (txt) => { navigator.clipboard && navigator.clipboard.writeText(txt).then(() => toast(t('Copié')), () => {}); },
    edit: (m) => { setReply(null); setEdit({ id: m.id, body: conv.e2ee ? texts[m.id] || '' : m.body }); },
    del: (m) => confirm(t('Supprimer ce message pour tout le monde ?'), () => api.c('DELETE', `/messages/${m.id}`).then(() => upsert(conv.id, { ...m, deleted: true, body: '', file: null }, true), fail), t('Supprimer')),
    pin: (m) => api.c(m.pinned ? 'DELETE' : 'POST', `/messages/${m.id}/pin`, m.pinned ? undefined : {}).then(() => loadDetail(conv.id), fail),
    remind: (m) => modal(t('Me rappeler ce message'), (close) => <RemindForm t={t} onSubmit={async (v) => { await api.c('POST', `/messages/${m.id}/reminder`, v).then(() => toast(t('Rappel programmé')), fail); close(); }} />),
    task: (m, text) => modal(t('Créer une tâche'), (close) => <TaskForm t={t} api={api} members={members} initial={{ title: (text || m.body || '').slice(0, 160) }} onSubmit={async (v) => { const j = await api.c('POST', `/messages/${m.id}/task`, v).catch(fail); if (j) { upsert(conv.id, j.message, true); toast(t('Tâche créée dans Projets et tâches')); } close(); }} />),
    taskFrom: (m, tk) => modal(t('Créer une tâche'), (close) => <TaskForm t={t} api={api} members={members} initial={{ title: tk.title, due: tk.due, assigneeId: tk.assigneeId }} onSubmit={async (v) => { const j = await api.c('POST', `/messages/${m.id}/task`, v).catch(fail); if (j) toast(t('Tâche créée dans Projets et tâches')); close(); }} />),
    translate: async (m, lang) => { try { return await api.c('POST', `/messages/${m.id}/translate`, { lang: getLang() }); } catch (e) { return { ok: false, message: e.message }; } },
    transcribe: async (m) => { const r = await api.c('POST', `/messages/${m.id}/transcribe`, {}).catch((e) => ({ ok: false, message: e.message })); if (!r.ok) toast(r.message, true); },
    share: (m) => api.c('POST', `/ai/messages/${m.id}/share`, {}).then((j) => upsert(conv.id, j.message, true), fail),
    vote: (pid, optionIds) => api.c('POST', `/polls/${pid}/vote`, { optionIds }).catch(fail),
    closePoll: (pid) => api.c('POST', `/polls/${pid}/close`, {}).catch(fail),
    jump: (id) => setJumpTo({ id, k: Date.now() }),
    joinCall: (callId, kind) => callRef.current && callRef.current.join(callId, kind, conv.id, conv.name),
    openMeeting: () => navigate(`/app/${orgId}/meetings`),
    openObject: (o) => navigate(o.path),
    saveLib: (m) => modal(t('Enregistrer dans la Bibliothèque'), (close) => <SaveToLibrary api={api} file={m.file} close={close} getBytes={() => api.fetchBytes(m.file.id)} />),
  };
  const pickObject = () => modal(t("Partager un objet d'un module"), (close) => <ObjectPicker api={api} close={close} onPick={async (type, id) => { const j = await api.c('POST', '/objects/share', { convId: conv.id, type, id }).catch(fail); if (j) { add(conv.id, j.message); bump(conv.id, j.message); } }} />);
  const sendPoll = async (v) => { const j = await api.c('POST', `/conversations/${conv.id}/polls`, v).catch(fail); if (j) { add(conv.id, j.message); bump(conv.id, j.message); } };
  const sendLoc = async (lat, lng, accuracy) => { const j = await api.c('POST', `/conversations/${conv.id}/location`, { lat, lng, accuracy, consent: true }).catch(fail); if (j) { add(conv.id, j.message); bump(conv.id, j.message); } };
  const schedule = async (v) => { await api.c('POST', `/conversations/${conv.id}/scheduled`, v).then(() => toast(t('Message programmé')), fail); };

  // ---------- Création de conversations ----------
  const newChat = async () => {
    const people = (await api.c('GET', '/people')).people.filter((p) => !p.me);
    modal(t('Nouvelle conversation'), (close) => (
      <Picker one people={people} t={t} submit={t('Ouvrir')} extra={<label className="ci-check"><input type="checkbox" name="enc" disabled={!e2eInfo.ok} /> <Icon name="c-lock" /> {t('Chiffrée de bout en bout (le serveur ne peut pas la lire)')}</label>}
        onSubmit={async ([uid], f) => { try { const j = await api.c('POST', '/conversations/direct', { userId: uid, encrypted: Boolean(f.get('enc')) }); close(); await loadConvs(); open(j.conversation.id); } catch (e) { fail(e); } }} />));
  };
  const newGroup = async () => {
    const [pp, pr] = await Promise.all([api.c('GET', '/people'), ws.oapi('GET', '/projects').catch(() => ({ projects: [] }))]);
    modal(t('Nouveau groupe'), (close) => <GroupForm t={t} people={pp.people.filter((p) => !p.me)} projects={pr.projects || []} branches={info.branches || []} aiOk={boot.settings.aiEnabled} canCreate={boot.me.canCreateGroup} onSubmit={async (v) => { try { const j = await api.c('POST', '/groups', v); close(); await loadConvs(); open(j.conversation.id); } catch (e) { fail(e); } }} />, { wide: true });
  };
  const openDirect = async (uid) => { try { const j = await api.c('POST', '/conversations/direct', { userId: uid }); await loadConvs(); setPanel(null); open(j.conversation.id); } catch (e) { fail(e); } };
  const jumpTo2 = async (convId, msgId, userId) => { if (userId) return openDirect(userId); if (!convId) return; if (!convsRef.current.some((c) => c.id === convId)) await loadConvs(); await open(convId, msgId); };
  const planMeeting = () => modal(t('Planifier une réunion'), (close) => <MeetingForm t={t} api={api} conv={conv} members={members} meId={meId} orgId={orgId} oapi={ws.oapi} onDone={async (id) => { const j = await api.c('POST', '/calls/meeting-link', { convId: conv.id, meetingId: id }).catch(fail); if (j) { add(conv.id, j.message); bump(conv.id, j.message); } close(); toast(t('Réunion planifiée')); }} />, { wide: true });

  // ---------- Fil rattaché à un objet d'un module : carte de l'objet (droits du lecteur) et ouverture directe (?conv=ID) ----------
  const [objCard, setObjCard] = useState(null);
  useEffect(() => { setObjCard(null); if (conv && conv.objectType) api.c('GET', `/objects/${conv.objectType}/${conv.objectId}`).then((j) => setObjCard(j.object), () => {}); }, [conv && conv.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const p = new URLSearchParams(window.location.search); const c = Number(p.get('conv')); if (c && boot) { window.history.replaceState({}, '', window.location.pathname); loadConvs().then(() => open(c)); } }, [boot]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Appels : lien de salle (?room=ID) ----------
  useEffect(() => { const p = new URLSearchParams(window.location.search); const room = Number(p.get('room')); if (room && boot && callRef.current) { open(room).then(() => callRef.current && callRef.current.start(room, 'video', '')); window.history.replaceState({}, '', window.location.pathname); } }, [boot]); // eslint-disable-line react-hooks/exhaustive-deps

  if (bootErr) return <div className="ci-wrap"><p className="ci-err ci-pad">{bootErr}</p></div>;
  if (!boot) return <div className="ci-wrap"><p className="ci-muted ci-pad" role="status">{t('Chargement…')}</p></div>;
  const unreadTotal = convs.filter((c) => !c.muted && !c.archived).reduce((a, c) => a + c.unread, 0);
  const group = conv && conv.kind === 'group';
  const showPanel = Boolean(panel) && (conv || ['search', 'files', 'later', 'settings', 'calls'].includes(panel));
  const panelEl = !showPanel ? null
    : panel === 'info' && conv ? <InfoPanel conv={conv} detail={detail[conv.id]} presence={presence} meId={meId} api={api} settings={boot.settings} aiStatus={aiStatus} e2e={e2e} reload={(left) => { if (left) { setActiveId(null); } loadConvs(filter === 'archived'); if (!left && conv) loadDetail(conv.id); }} onClose={() => setPanel(null)} openPanel={setPanel} planMeeting={planMeeting} />
      : panel === 'files' ? <FilesPanel api={api} conv={conv} onClose={() => setPanel(null)} onJump={jumpTo2} />
        : panel === 'search' ? <SearchPanel api={api} aiOn={Boolean(aiStatus && aiStatus.available)} initial={searchInit} onClose={() => setPanel(null)} onJump={(c, m, u) => { setPanel(null); jumpTo2(c, m, u); }} />
          : panel === 'map' ? <MapPanel api={api} geo={geo} setGeo={setGeo} meId={meId} onClose={() => setPanel(null)} onChat={openDirect} />
            : panel === 'calls' ? <CallsPanel api={api} conv={null} onClose={() => setPanel(null)} onCall={(c, k) => { const cv = convs.find((x) => x.id === c); callRef.current.start(c, k, cv ? cv.name : ''); }} />
              : panel === 'later' ? <LaterPanel api={api} onClose={() => setPanel(null)} onJump={(c, m) => { setPanel(null); jumpTo2(c, m); }} />
                : panel === 'settings' ? <SettingsPanel api={api} boot={boot} reloadBoot={loadBoot} canAdmin={boot.me.canAdmin} onClose={() => setPanel(null)} /> : null;
  const readOnly = conv && Number(conv.onlyAdminsPost) === 1 && conv.myRole !== 'admin';

  return (
    <div className={'ci-wrap' + (conv ? ' has-conv' : '') + (panelEl ? ' has-panel' : '')}>
      <CallLayer ref={callRef} api={api} meId={meId} meName={meName} convs={convs} openConv={open} />
      <Sidebar convs={convs} activeId={activeId} onOpen={open} presence={presence} typing={typing} onNew={newChat} onGroup={newGroup} onSearch={() => { setSearchInit(''); setPanel('search'); }} filter={filter} setFilter={(f) => { setFilter(f); }} loading={loadingList} mode={mode} unreadTotal={unreadTotal} />
      <main className="ci-main">
        {!conv && (
          <div className="ci-welcome">
            <span className="ci-welcome-ico"><Icon name="comments" /></span>
            <h2>{t('Chat interne')}</h2>
            <p className="ci-muted">{t("Écrivez à un collègue, créez un groupe par département ou par projet, partagez des fichiers, appelez-vous en audio ou en vidéo. Une conversation privée n'est lisible que par ses participants.")}</p>
            <div className="ci-welcome-act">
              <Button variant="primary" icon="c-user-plus" onClick={newChat} label={t('Nouvelle conversation')}>{t('Nouvelle conversation')}</Button>
              <Button icon="c-group" onClick={newGroup} label={t('Nouveau groupe')}>{t('Nouveau groupe')}</Button>
              <Button variant="ghost" icon="c-pos" onClick={() => setPanel('map')} label={t('Géolocalisation')}>{t('Géolocalisation')}</Button>
              <Button variant="ghost" icon="c-history" onClick={() => setPanel('calls')} label={t('Historique des appels')}>{t('Historique des appels')}</Button>
              <Button variant="ghost" icon="c-folder" onClick={() => setPanel('files')} label={t('Fichiers partagés')}>{t('Fichiers partagés')}</Button>
              <Button variant="ghost" icon="settings" onClick={() => setPanel('settings')} label={t('Réglages du chat')}>{t('Réglages du chat')}</Button>
            </div>
          </div>
        )}
        {conv && (
          <>
            <ThreadHeader conv={conv} detail={detail[conv.id]} presence={presence} typingText={typingNow} onBack={() => { setActiveId(null); setPanel(null); }} onCall={(k) => callRef.current.start(conv.id, k, conv.name)} onPanel={setPanel} panel={panel} callsOn={boot.settings.callsEnabled} geoCount={geoCount} onOpenObject={(o) => navigate(o.path)} objCard={objCard} />
            {conv.e2ee && <p className="ci-e2e-note"><Icon name="c-lock" /> {t('Chiffrée de bout en bout')}{!kk && e2eInfo.ok ? ` — ${t("clé en cours de préparation…")}` : ''}{!e2eInfo.ok && e2eInfo.why ? ` — ${e2eInfo.why}` : ''}</p>}
            <Thread conv={conv} state={msgs[conv.id]} meId={meId} names={names} texts={texts} plainNames={plainNames} api={api} e2e={e2e} act={act} group={group} isAdmin={group && conv.myRole === 'admin'} loadMore={() => { const l = msgs[conv.id].list; if (l.length) loadMessages(conv.id, { before: l[0].id }); }} firstUnread={firstUnread} typingNow={typingNow} jumpTo={jumpTo} />
            <Composer conv={conv} members={members} meId={meId} settings={boot.settings} disabled={readOnly} disabledText={t('Seuls les administrateurs du groupe peuvent écrire ici.')} reply={reply} edit={edit} onCancelContext={() => { setReply(null); setEdit(null); }} onSend={send} onFile={sendFile} onVoice={sendVoice} onPoll={sendPoll} onLocation={sendLoc} onSchedule={schedule} onTyping={sendTyping} e2ee={conv.e2ee} onObject={pickObject} />
          </>
        )}
      </main>
      {panelEl}
      <nav className="ci-quick" aria-label={t('Raccourcis du chat')}>
        <button type="button" onClick={() => { setActiveId(null); setPanel(null); }} aria-label={t('Discussions')}><Icon name="comments" />{unreadTotal > 0 && <span className="ci-badge">{unreadTotal}</span>}<small>{t('Discussions')}</small></button>
        <button type="button" onClick={() => setPanel('map')}><Icon name="c-pos" /><small>{t('Carte')}</small></button>
        <button type="button" onClick={() => setPanel('calls')}><Icon name="c-history" /><small>{t('Appels')}</small></button>
        <button type="button" onClick={() => setPanel('files')}><Icon name="c-folder" /><small>{t('Fichiers')}</small></button>
        <button type="button" onClick={() => setPanel('settings')}><Icon name="settings" /><small>{t('Réglages')}</small></button>
      </nav>
    </div>
  );
}

function RemindForm({ t, onSubmit }) {
  const def = new Date(Date.now() + 3600000); def.setMinutes(0, 0, 0);
  const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [at, setAt] = useState(local(def)); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  return <form className="ws-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit({ remindAt: new Date(at).toISOString(), note }); } finally { setBusy(false); } }}>
    <label>{t('Quand ?')}<input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required /></label>
    <label>{t('Note (facultatif)')}<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></label>
    <Button type="submit" variant="primary" loading={busy} label={t('Programmer le rappel')}>{t('Programmer le rappel')}</Button></form>;
}
function TaskForm({ t, members, initial, onSubmit, api }) {
  const [title, setTitle] = useState(initial.title || ''); const [due, setDue] = useState(initial.due || ''); const [who, setWho] = useState(initial.assigneeId || ''); const [project, setProject] = useState(''); const [projects, setProjects] = useState([]); const [busy, setBusy] = useState(false);
  useEffect(() => { api.c('GET', '/people').catch(() => {}); }, [api]);
  const ws = useWs();
  useEffect(() => { ws.oapi('GET', '/projects').then((j) => setProjects(j.projects || []), () => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <form className="ws-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit({ title, due: due || undefined, assigneeId: who ? Number(who) : undefined, projectId: project ? Number(project) : undefined }); } finally { setBusy(false); } }}>
    <p className="ci-muted">{t('Le texte choisi sera copié dans la tâche : elle sera visible des personnes qui ont accès aux tâches.')}</p>
    <label>{t('Titre')}<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required /></label>
    <label>{t('Responsable')}<select value={who} onChange={(e) => setWho(e.target.value)}><option value="">{t('— personne —')}</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select></label>
    <label>{t('Échéance')}<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
    <label>{t('Projet')}<select value={project} onChange={(e) => setProject(e.target.value)}><option value="">{t('— aucun —')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <Button type="submit" variant="primary" loading={busy} label={t('Créer la tâche')}>{t('Créer la tâche')}</Button></form>;
}
function GroupForm({ t, people, projects, branches, aiOk, canCreate, onSubmit }) {
  const [name, setName] = useState(''); const [purpose, setPurpose] = useState('general'); const [dept, setDept] = useState(''); const [project, setProject] = useState(''); const [branch, setBranch] = useState(''); const [sel, setSel] = useState(new Set()); const [ai, setAi] = useState(false); const [busy, setBusy] = useState(false);
  if (!canCreate) return <p className="ci-err">{t("Dans cette entreprise, seuls les responsables peuvent créer des groupes.")}</p>;
  return (
    <form className="ws-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit({ name, purpose, department: purpose === 'department' ? dept || name : '', projectId: purpose === 'project' && project ? Number(project) : undefined, branchId: branch ? Number(branch) : undefined, memberIds: [...sel], aiEnabled: ai }); } finally { setBusy(false); } }}>
      <label>{t('Nom du groupe')}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></label>
      <label>{t('Type de groupe')}<select value={purpose} onChange={(e) => setPurpose(e.target.value)}><option value="general">{t('Groupe libre')}</option><option value="department">{t('Département')}</option><option value="project">{t('Projet')}</option></select></label>
      {purpose === 'department' && <label>{t('Département')}<input value={dept} onChange={(e) => setDept(e.target.value)} maxLength={80} placeholder={name} /></label>}
      {purpose === 'project' && <label>{t('Projet')}<select value={project} onChange={(e) => setProject(e.target.value)}><option value="">{t('— choisir (les personnes ayant des tâches y sont ajoutées) —')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      {branches.length > 0 && <label>{t('Ajouter toute une antenne (facultatif)')}<select value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <fieldset className="ci-fs"><legend>{t('Membres')}</legend>
        <ul className="ci-pick">{people.map((p) => <li key={p.userId}><label><input type="checkbox" checked={sel.has(p.userId)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(p.userId)) n.delete(p.userId); else n.add(p.userId); return n; })} /> <Avatar name={p.name} id={p.userId} online={p.online} /> <span><b>{p.name}</b><small>{p.title}</small></span></label></li>)}</ul></fieldset>
      {aiOk && <label className="ci-check"><input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} /> {t("Inviter l'assistante dans ce groupe")}</label>}
      <Button type="submit" variant="primary" loading={busy} label={t('Créer le groupe')}>{t('Créer le groupe')}</Button>
    </form>
  );
}
function MeetingForm({ t, api, conv, members, meId, orgId, oapi, onDone }) {
  const [up, setUp] = useState(null); const [mode, setMode] = useState('new'); const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(conv.name); const [date, setDate] = useState(''); const [time, setTime] = useState('10:00'); const [dur, setDur] = useState(30); const [err, setErr] = useState('');
  useEffect(() => { api.c('GET', '/calls/meetings/upcoming').then((j) => setUp(j.meetings), () => setUp([])); }, [api]);
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const link = `${window.location.origin}/app/${orgId}/chat?room=${conv.id}`;
      const j = await oapi('POST', '/meetings', { title, type: 'team', date, time, durationMin: Number(dur), link, objective: t('Réunion en visio depuis le chat interne : rejoignez la salle avec le lien.'), participants: members.filter((m) => m.userId !== meId).map((m) => ({ userId: m.userId })), send: true });
      await onDone(j.id);
    } catch (er) { setErr(er.message); } finally { setBusy(false); }
  };
  return (
    <div className="ci-meet">
      <div className="ci-tabs"><button type="button" className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>{t('Nouvelle réunion')}</button><button type="button" className={mode === 'old' ? 'on' : ''} onClick={() => setMode('old')}>{t('Annoncer une réunion existante')}</button></div>
      {mode === 'new' ? (
        <form className="ws-form" onSubmit={create}>
          <p className="ci-muted">{t('La réunion est créée dans le module Réunions (convocation, compte rendu, actions). Le lien de la salle vidéo du chat est ajouté.')}</p>
          <label>{t('Titre')}<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required /></label>
          <label>{t('Date')}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <label>{t('Heure')}<input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></label>
          <label>{t('Durée (minutes)')}<input type="number" min="5" max="480" value={dur} onChange={(e) => setDur(e.target.value)} /></label>
          {err && <p className="ci-err">{err}</p>}
          <Button type="submit" variant="primary" loading={busy} label={t('Convoquer')}>{t('Convoquer')}</Button>
        </form>
      ) : (
        <ul className="ci-members">{!up && <li className="ci-muted">{t('Chargement…')}</li>}{up && !up.length && <li className="ci-muted">{t('Aucune réunion à venir.')}</li>}{(up || []).map((m) => <li key={m.id}><Icon name="calendar-check" /><span className="ci-grow"><b>{m.title}</b><small>{m.date} · {m.time}</small></span><Button size="sm" onClick={() => onDone(m.id)} label={t('Annoncer')}>{t('Annoncer')}</Button></li>)}</ul>
      )}
    </div>
  );
}
