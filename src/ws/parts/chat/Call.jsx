import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Icon } from '../../../lib/fa.jsx';
import { useWs } from '../../WsContext.jsx';
import { Button } from '../../ui.jsx';
import { Avatar } from './Sidebar.jsx';

/* Appels audio / vidéo et réunions de groupe en WebRTC. Le serveur ne fait que la signalisation ; l'audio et la vidéo passent directement
   entre les appareils (maillage : adapté aux petits groupes). Négociation « parfaite » (les deux côtés peuvent proposer sans se bloquer).
   Sans serveur TURN, certains réseaux (4G, pare-feu d'entreprise) empêchent la connexion directe : message clair à ce moment-là. */
function Tile({ stream, name, muted, off, label }) {
  const v = useRef(null);
  useEffect(() => { if (v.current && v.current.srcObject !== stream) v.current.srcObject = stream || null; }, [stream]);
  const hasVideo = stream && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled !== false);
  return (
    <div className={'ci-tile' + (hasVideo ? ' vid' : '')}>
      <video ref={v} autoPlay playsInline muted={muted} />
      {!hasVideo && <div className="ci-tile-av"><Avatar name={name} id={name.length} size="lg" /></div>}
      <span className="ci-tile-name">{name}{off ? ' 🔇' : ''}{label ? ` · ${label}` : ''}</span>
    </div>
  );
}

const CallLayer = forwardRef(function CallLayer({ api, meId, meName, convs, openConv }, ref) {
  const t = useT();
  const { toast, fail } = useWs();
  const [incoming, setIncoming] = useState(null);
  const [call, setCall] = useState(null); // { id, convId, kind, name }
  const [tiles, setTiles] = useState({}); // userId -> { stream, name, muted, screen }
  const [local, setLocal] = useState(null);
  const [ui, setUi] = useState({ mic: true, cam: true, screen: false, notice: '' });
  const pcs = useRef({}); const names = useRef({}); const localStream = useRef(null); const ice = useRef(null); const ids = useRef({ call: null }); const screenTrack = useRef(null); const ringTimer = useRef(null);
  const polite = (uid) => meId > uid;

  const nameOf = useCallback((uid) => names.current[uid] || t('Participant'), [t]);
  const setTile = useCallback((uid, patch) => setTiles((s) => ({ ...s, [uid]: { ...(s[uid] || {}), ...patch, name: nameOf(uid) } })), [nameOf]);
  const post = useCallback((path, body) => api.c('POST', `/calls/${ids.current.call}${path}`, body), [api]);

  const makePeer = useCallback((uid) => {
    if (pcs.current[uid]) return pcs.current[uid].pc;
    const pc = new RTCPeerConnection({ iceServers: ice.current ? ice.current.iceServers : [] });
    const st = { pc, making: false, ignore: false, remote: new MediaStream() };
    pcs.current[uid] = st;
    if (localStream.current) localStream.current.getTracks().forEach((tr) => pc.addTrack(tr, localStream.current));
    pc.onicecandidate = (e) => { if (e.candidate) post('/signal', { to: uid, type: 'candidate', data: e.candidate.toJSON() }).catch(() => {}); };
    pc.ontrack = (e) => { e.streams[0] ? e.streams[0].getTracks().forEach((tr) => st.remote.addTrack(tr)) : st.remote.addTrack(e.track); setTile(uid, { stream: st.remote, v: Date.now() }); e.track.onunmute = () => setTile(uid, { stream: st.remote, v: Date.now() }); e.track.onended = () => setTile(uid, { v: Date.now() }); };
    pc.onnegotiationneeded = async () => {
      try { st.making = true; await pc.setLocalDescription(); await post('/signal', { to: uid, type: 'offer', data: pc.localDescription.toJSON() }); } catch { /* renégociation ignorée */ } finally { st.making = false; }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setUi((u) => ({ ...u, notice: ice.current && ice.current.turn ? t("Connexion impossible avec {name}. Vérifiez votre réseau.", { name: nameOf(uid) }) : t("Connexion directe impossible avec {name} : votre réseau bloque les appels (4G ou pare-feu). Il faut un serveur TURN : parlez-en à l'administrateur.", { name: nameOf(uid) }) }));
        try { pc.restartIce(); } catch { /* */ }
      }
    };
    return pc;
  }, [post, setTile, t, nameOf]);

  const dropPeer = useCallback((uid) => { const p = pcs.current[uid]; if (p) { try { p.pc.close(); } catch { /* */ } delete pcs.current[uid]; } setTiles((s) => { const n = { ...s }; delete n[uid]; return n; }); }, []);

  const cleanup = useCallback(() => {
    clearTimeout(ringTimer.current);
    Object.keys(pcs.current).forEach(dropPeer);
    if (localStream.current) localStream.current.getTracks().forEach((x) => x.stop());
    if (screenTrack.current) { screenTrack.current.stop(); screenTrack.current = null; }
    localStream.current = null; ids.current.call = null;
    setLocal(null); setCall(null); setTiles({}); setUi({ mic: true, cam: true, screen: false, notice: '' });
  }, [dropPeer]);

  const getMedia = async (kind) => {
    if (!navigator.mediaDevices || !window.RTCPeerConnection) throw new Error(t("Les appels ne sont pas pris en charge par ce navigateur."));
    try { return await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false }); } catch (e) {
      if (kind === 'video') { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); toast(t("La caméra n'est pas accessible : appel en audio seulement."), true); return s; } catch { /* micro aussi */ } }
      throw new Error(t("Le micro (et la caméra) ne sont pas accessibles : autorisez-les dans votre navigateur."), { cause: e });
    }
  };

  const enter = useCallback(async (res, kind, convId, convName) => {
    ice.current = { iceServers: res.iceServers || [], turn: res.turn };
    const media = await getMedia(kind);
    localStream.current = media; setLocal(media);
    ids.current.call = res.call.id;
    res.call.participants.forEach((p) => { names.current[p.userId] = p.name; });
    setCall({ id: res.call.id, convId, kind, name: convName });
    setUi({ mic: true, cam: media.getVideoTracks().length > 0, screen: false, notice: res.maxParticipants && kind ? '' : '' });
    for (const uid of res.peers || []) { makePeer(uid); } // le nouvel arrivant initie : onnegotiationneeded envoie les offres
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async (convId, kind, convName) => {
    try { const res = await api.c('POST', '/calls', { convId, kind }); if (res.existing) return join(res.call.id, kind, convId, convName); await enter({ ...res, peers: [] }, kind, convId, convName); } catch (e) { cleanup(); fail(e); }
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  const join = useCallback(async (callId, kind, convId, convName) => {
    try {
      ids.current.call = callId;
      const res = await api.c('POST', `/calls/${callId}/join`, {});
      const cv = convs.find((c) => c.id === (convId || res.call.convId));
      await enter(res, kind || res.call.kind, res.call.convId, convName || (cv && cv.name) || '');
    } catch (e) { cleanup(); fail(e); }
  }, [api, convs]); // eslint-disable-line react-hooks/exhaustive-deps

  const hangup = useCallback(async () => { const id = ids.current.call; cleanup(); if (id) api.c('POST', `/calls/${id}/leave`, {}).catch(() => {}); }, [api, cleanup]);
  const decline = useCallback(() => { if (!incoming) return; api.c('POST', `/calls/${incoming.callId}/decline`, {}).catch(() => {}); setIncoming(null); clearTimeout(ringTimer.current); }, [api, incoming]);

  // événements temps réel (aiguillés par le module)
  useImperativeHandle(ref, () => ({
    start, join,
    handle(type, d) {
      if (type === 'call.incoming') {
        if (d.from.id === meId) return;
        names.current[d.from.id] = d.from.name;
        if (ids.current.call) { api.c('POST', `/calls/${d.callId}/decline`, {}).catch(() => {}); return; } // déjà en ligne
        setIncoming(d); clearTimeout(ringTimer.current); ringTimer.current = setTimeout(() => setIncoming(null), 60000);
        try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(t('Appel de {name}', { name: d.from.name })); } catch { /* */ }
      } else if (type === 'call.ended') { setIncoming((i) => (i && i.callId === d.callId ? null : i)); if (ids.current.call === d.callId) { toast(t('Appel terminé')); cleanup(); } }
      else if (d.callId !== ids.current.call) return;
      else if (type === 'call.joined') { names.current[d.userId] = d.name; setTile(d.userId, {}); }
      else if (type === 'call.left') { dropPeer(d.userId); }
      else if (type === 'call.state') { setTile(d.userId, { muted: d.muted, screen: d.screen }); }
      else if (type === 'call.declined') { toast(t('{name} a refusé l’appel', { name: nameOf(d.userId) })); }
      else if (type === 'call.signal') handleSignal(d);
    },
    active: () => Boolean(ids.current.call),
  }));

  const handleSignal = async (d) => {
    const uid = d.from; const pc = makePeer(uid); const st = pcs.current[uid];
    try {
      if (d.type === 'candidate') { try { await pc.addIceCandidate(d.data); } catch (e) { if (!st.ignore) throw e; } return; }
      const collision = d.type === 'offer' && (st.making || pc.signalingState !== 'stable');
      st.ignore = !polite(uid) && collision;
      if (st.ignore) return;
      await pc.setRemoteDescription(d.data);
      if (d.type === 'offer') { await pc.setLocalDescription(); await post('/signal', { to: uid, type: 'answer', data: pc.localDescription.toJSON() }); }
    } catch { /* signal périmé */ }
  };

  const toggleMic = () => { const on = !ui.mic; localStream.current && localStream.current.getAudioTracks().forEach((x) => { x.enabled = on; }); setUi((u) => ({ ...u, mic: on })); post('/state', { muted: !on, video: ui.cam, screen: ui.screen }).catch(() => {}); };
  const toggleCam = async () => {
    const on = !ui.cam;
    const vt = localStream.current && localStream.current.getVideoTracks()[0];
    if (vt) { vt.enabled = on; setUi((u) => ({ ...u, cam: on })); setLocal(new MediaStream(localStream.current.getTracks())); post('/state', { muted: !ui.mic, video: on, screen: ui.screen }).catch(() => {}); return; }
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); const track = s.getVideoTracks()[0]; localStream.current.addTrack(track); Object.values(pcs.current).forEach((p) => p.pc.addTrack(track, localStream.current)); setLocal(new MediaStream(localStream.current.getTracks())); setUi((u) => ({ ...u, cam: true })); } catch { toast(t("La caméra n'est pas accessible."), true); }
  };
  const toggleScreen = async () => {
    if (ui.screen) { // retour à la caméra
      const track = screenTrack.current; if (track) { track.stop(); screenTrack.current = null; }
      const cam = localStream.current.getVideoTracks()[0];
      for (const p of Object.values(pcs.current)) { const sender = p.pc.getSenders().find((s) => s.track && s.track.kind === 'video' && s.track === track); if (sender) { if (cam) await sender.replaceTrack(cam); else p.pc.removeTrack(sender); } }
      setUi((u) => ({ ...u, screen: false })); post('/state', { muted: !ui.mic, video: ui.cam, screen: false }).catch(() => {}); return;
    }
    if (!navigator.mediaDevices.getDisplayMedia) { toast(t("Le partage d'écran n'est pas disponible sur cet appareil."), true); return; }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true }); const track = s.getVideoTracks()[0]; screenTrack.current = track;
      track.onended = () => { if (screenTrack.current) toggleScreenOff(); };
      for (const p of Object.values(pcs.current)) { const sender = p.pc.getSenders().find((x) => x.track && x.track.kind === 'video'); if (sender) await sender.replaceTrack(track); else p.pc.addTrack(track, s); }
      setLocal(new MediaStream([...localStream.current.getAudioTracks(), track]));
      setUi((u) => ({ ...u, screen: true })); post('/state', { muted: !ui.mic, video: ui.cam, screen: true }).catch(() => {});
    } catch { /* partage annulé */ }
  };
  const toggleScreenOff = async () => { const track = screenTrack.current; screenTrack.current = null; const cam = localStream.current && localStream.current.getVideoTracks()[0]; for (const p of Object.values(pcs.current)) { const sender = p.pc.getSenders().find((s) => s.track === track); if (sender) { if (cam) await sender.replaceTrack(cam); else p.pc.removeTrack(sender); } } setLocal(new MediaStream(localStream.current.getTracks())); setUi((u) => ({ ...u, screen: false })); };

  useEffect(() => () => { cleanup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = () => { if (ids.current.call) navigator.sendBeacon && navigator.sendBeacon(`${api.base}/calls/${ids.current.call}/leave`, new Blob(['{}'], { type: 'application/json' })); }; window.addEventListener('pagehide', f); return () => window.removeEventListener('pagehide', f); }, [api]);

  const remotes = Object.entries(tiles);
  return (
    <>
      {incoming && (
        <div className="ci-incoming" role="alertdialog" aria-label={t('Appel entrant')}>
          <span className="ci-ring"><Icon name={incoming.kind === 'video' ? 'c-video' : 'c-ring'} /></span>
          <span className="ci-grow"><b>{incoming.group ? incoming.convName : incoming.from.name}</b><small>{incoming.kind === 'video' ? t('Appel vidéo') : t('Appel audio')}{incoming.group ? ` · ${incoming.from.name}` : ''}</small></span>
          <Button variant="danger" iconOnly icon="c-phone-off" label={t('Refuser')} onClick={decline} />
          <Button variant="primary" iconOnly icon="c-phone" label={t('Répondre')} onClick={() => { const i = incoming; setIncoming(null); clearTimeout(ringTimer.current); join(i.callId, i.kind, i.convId, i.convName); openConv(i.convId); }} />
        </div>
      )}
      {call && (
        <div className="ci-call" role="dialog" aria-label={t('Appel en cours')}>
          <header><b>{call.name}</b><small>{call.kind === 'video' ? t('Appel vidéo') : t('Appel audio')} · {remotes.length + 1} {t('pers.')}</small></header>
          {ui.notice && <p className="ci-callnote" role="status"><Icon name="warn" /> {ui.notice}</p>}
          <div className={'ci-tiles n' + Math.min(remotes.length + 1, 6)}>
            {remotes.map(([uid, tl]) => <Tile key={uid} stream={tl.stream} name={tl.name || nameOf(Number(uid))} off={tl.muted} label={tl.screen ? t("partage l'écran") : ''} />)}
            {!remotes.length && <div className="ci-waiting"><Icon name="c-ring" /><p>{t("Appel en cours… en attente d'une réponse.")}</p></div>}
            <Tile stream={local} name={t('Vous')} muted off={!ui.mic} />
          </div>
          <footer>
            <Button iconOnly variant={ui.mic ? 'secondary' : 'danger'} icon={ui.mic ? 'c-mic' : 'c-mic-off'} label={ui.mic ? t('Couper le micro') : t('Activer le micro')} onClick={toggleMic} />
            <Button iconOnly variant={ui.cam ? 'secondary' : 'danger'} icon={ui.cam ? 'c-video' : 'c-video-off'} label={ui.cam ? t('Couper la caméra') : t('Activer la caméra')} onClick={toggleCam} />
            <Button iconOnly variant={ui.screen ? 'primary' : 'secondary'} icon="c-screen" label={ui.screen ? t("Arrêter le partage d'écran") : t("Partager l'écran")} onClick={toggleScreen} />
            <Button iconOnly variant="danger" icon="c-phone-off" label={t('Raccrocher')} onClick={hangup} />
          </footer>
        </div>
      )}
    </>
  );
});
export default CallLayer;
