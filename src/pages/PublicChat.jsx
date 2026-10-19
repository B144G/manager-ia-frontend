import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '../lib/api.js';

/* Page publique « discuter avec nous » : l'assistant commercial d'une organisation parle au prospect (texte ou voix).
   Lien à partager dans une publicité : /chat?o=<jeton>&c=<nom de la campagne>. */
export default function PublicChat() {
  const [params] = useSearchParams();
  const token = params.get('o') || '';
  const campaign = (params.get('c') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  const key = 'mi_chat_' + token;
  const [org, setOrg] = useState({ name: 'Assistant', ready: false });
  const [off, setOff] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [rec, setRec] = useState(false);
  const session = useRef('');
  const log = useRef(null);
  const area = useRef(null);
  const recorder = useRef(null);
  const dictation = useRef(null);
  const seq = useRef(0);

  const add = useCallback((cls, content) => { const id = ++seq.current; setMsgs((l) => [...l, { id, cls, content }]); return id; }, []);
  const patch = (id, p) => setMsgs((l) => l.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const drop = (id) => setMsgs((l) => l.filter((m) => m.id !== id));
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [msgs]);

  const call = useCallback(async (path, body) => {
    const r = await fetch(API_BASE + '/api/ws/public/chat/' + encodeURIComponent(token) + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Une erreur est survenue. Réessayez.'); e.status = r.status; throw e; }
    return j;
  }, [token]);

  useEffect(() => {
    try { session.current = localStorage.getItem(key) || ''; } catch { session.current = ''; }
    if (!token) { setOff("Ce lien n'est pas valide ou le service n'est pas encore branché."); return undefined; }
    let gone = false;
    call('/info').then((i) => {
      if (gone) return;
      setOrg({ name: i.name, ready: true }); document.title = 'Discuter avec ' + i.name;
      if (!i.enabled) { setOff('Ce service n\'est pas disponible pour le moment. Merci de contacter directement l\'entreprise.'); return; }
      add('bot', i.welcome); setVoiceOn(Boolean(i.voice));
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if ((i.voice && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) || SR) setMicOk(true);
    }).catch((e) => { if (!gone) setOff(e.message || 'Service indisponible.'); });
    return () => { gone = true; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function reply(j) {
    if (j.sessionId) { session.current = j.sessionId; try { localStorage.setItem(key, j.sessionId); } catch { /* ignoré */ } }
    add('bot', j.reply);
    if (j.order) add('order', 'Commande ' + j.order.number + ' enregistrée');
  }

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText(''); if (area.current) area.current.style.height = 'auto';
    add('me', t);
    const wait = add('bot wait', '…');
    setBusy(true);
    try { const j = await call('/message', { sessionId: session.current, message: t, campaign }); drop(wait); reply(j); } catch (x) { patch(wait, { cls: 'bot err', content: x.message }); }
    setBusy(false);
    if (area.current) area.current.focus();
  }

  /* ---------- Voix : enregistrement envoyé au serveur (transcrit en texte), sinon dictée du navigateur ---------- */
  function micClick() {
    if (busy) return;
    const canRecord = voiceOn && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder;
    if (canRecord) record(); else dictate();
  }
  function record() {
    const r = recorder.current;
    if (r && r.state === 'recording') { r.stop(); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const chunks = [];
      const rc = new MediaRecorder(stream); recorder.current = rc;
      const timer = setTimeout(() => { if (rc.state === 'recording') rc.stop(); }, 60000);
      rc.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rc.onstop = () => {
        clearTimeout(timer); setRec(false); stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rc.mimeType || 'audio/webm' });
        if (blob.size < 800) { add('bot err', "Je n'ai rien entendu. Appuyez sur le micro et parlez un peu plus longtemps."); return; }
        const me = add('me voice', 'Message vocal…'), wait = add('bot wait', '…');
        const fr = new FileReader();
        fr.onload = async () => {
          setBusy(true);
          try {
            const j = await call('/voice', { sessionId: session.current, campaign, audio: String(fr.result).split(',')[1] || '' });
            patch(me, { content: '🎤 ' + (j.transcript || 'Message vocal') }); drop(wait); reply(j);
          } catch (x) { drop(me); patch(wait, { cls: 'bot err', content: x.message }); }
          setBusy(false);
        };
        fr.readAsDataURL(blob);
      };
      rc.start(); setRec(true);
    }).catch(() => add('bot err', "Le micro n'est pas autorisé. Autorisez-le dans votre navigateur, ou écrivez votre message."));
  }
  function dictate() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (dictation.current) { dictation.current.stop(); return; }
    const r = new SR(); r.lang = 'fr-FR'; r.interimResults = false; dictation.current = r;
    r.onresult = (ev) => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) t += ev.results[i][0].transcript; setText((x) => (x + ' ' + t).trim()); };
    r.onend = () => { dictation.current = null; setRec(false); if (area.current) area.current.focus(); };
    r.onerror = () => { dictation.current = null; setRec(false); };
    setRec(true); r.start();
  }

  return (
    <main className="chat" id="app">
      <header className="top"><div className="av" aria-hidden="true">{(org.name || '?').trim().charAt(0).toUpperCase()}</div><div><h1>{org.name}</h1><p>Assistant commercial · répond tout de suite</p></div></header>
      <div className="log" ref={log} aria-live="polite">{msgs.map((m) => <div key={m.id} className={m.cls === 'order' ? 'order' : 'b ' + m.cls}>{m.content}</div>)}</div>
      {off ? <p className="off">{off}</p> : null}
      <form className="bar" hidden={Boolean(off)} autoComplete="off" onSubmit={send}>
        <button type="button" className={'mic' + (rec ? ' rec' : '')} hidden={!micOk} aria-label="Parler (message vocal)" title="Parler" onClick={micClick}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM6 11a6 6 0 0012 0M12 17v4M9 21h6" /></svg></button>
        <textarea ref={area} rows={1} maxLength={1000} placeholder="Écrivez votre message…" aria-label="Votre message" value={text}
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }} />
        <button className="send" type="submit" aria-label="Envoyer" disabled={busy}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-7z" /></svg></button>
      </form>
      <p className="note" hidden={Boolean(off)}>Vos informations (nom, téléphone) servent uniquement à traiter votre demande. Ne donnez jamais de mot de passe ni de code secret.</p>
    </main>
  );
}
