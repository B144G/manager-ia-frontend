import { useEffect, useRef, useState } from 'react';
import { SUGGEST } from './registry.js';
import NoteBox from './parts/memory/NoteBox.jsx';
import { getLocale, useT } from '../lib/i18n.jsx';
import { useWs } from './WsContext.jsx';

/** Panneau de l'assistant IA (colonne de droite) : une discussion par sous-application. */
export default function AIPanel({ mod }) {
  const t = useT();
  const { oapi, fail, info, aiOpen, setAiOpen, pendingAsk, setPendingAsk, modal } = useWs();
  const [msgs, setMsgs] = useState([]);
  const [remaining, setRemaining] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const log = useRef(null);
  const recog = useRef(null);
  const def = info.modules.find((m) => m.id === mod);
  const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  const scroll = () => { if (log.current) log.current.scrollTop = log.current.scrollHeight; };
  useEffect(scroll, [msgs]);

  const go = (v) => {
    const q = (v ?? text).trim();
    if (!q || busy) return;
    setBusy(true); setText('');
    setMsgs((l) => [...l, { role: 'user', content: q }, { role: 'assistant', content: t("L'IA réfléchit…"), wait: true }]);
    oapi('POST', '/ai/chat', { module: mod, message: q }).then((j) => {
      setMsgs((l) => [...l.slice(0, -1), { role: 'assistant', content: j.text }]);
      setRemaining(j.remaining);
    }, (e) => {
      setMsgs((l) => [...l.slice(0, -1), { role: 'assistant', content: t(e.message), err: true }]);
      if (e.status === 401) fail(e);
    }).then(() => setBusy(false));
  };

  // Historique du module affiché ; une question posée depuis la barre du haut part dès que l'historique est là.
  useEffect(() => {
    let off = false;
    setMsgs([]);
    oapi('GET', '/ai/history?module=' + mod).then((j) => {
      if (off) return;
      const first = !j.enabled
        ? [{ role: 'assistant', content: t("L'IA n'est pas encore activée sur ce serveur (clé manquante). Le reste de l'application fonctionne."), err: true }]
        : !j.messages.length ? [{ role: 'assistant', content: t("Bonjour ! Je connais votre organisation. Demandez-moi un point de situation, de l'aide pour répondre à un client, planifier un projet, ou analyser votre budget.") }] : [];
      setMsgs([...first, ...j.messages.map((m) => ({ role: m.role, content: m.content }))]);
      setRemaining(j.remaining);
    }, (e) => { if (!off) setMsgs([{ role: 'assistant', content: t(e.message), err: true }]); });
    return () => { off = true; };
  }, [mod, oapi]);
  useEffect(() => { if (pendingAsk && aiOpen) { const q = pendingAsk; setPendingAsk(null); setTimeout(() => go(q), 0); } }, [pendingAsk]); // eslint-disable-line react-hooks/exhaustive-deps

  // « Noter ceci » : propose d'enregistrer un résumé de la discussion dans la mémoire de l'entreprise (après relecture et validation).
  const lastAnswer = [...msgs].reverse().find((m) => m.role === 'assistant' && !m.err && !m.wait);
  const canNote = msgs.some((m) => m.role === 'user') && info.modules.some((m) => m.id === 'memory');
  const note = () => modal(t('Noter ceci dans la mémoire'), (close) => <NoteBox mod={mod} fallback={lastAnswer ? lastAnswer.content : ''} close={close} />, { wide: true });

  // Dictée vocale (navigateurs qui la proposent : Chrome, Edge, Safari récents)
  const dictate = () => {
    if (!SR) return;
    if (recog.current) { recog.current.stop(); return; }
    const r = new SR(); r.lang = getLocale(); r.interimResults = false; recog.current = r; setRec(true);
    r.onresult = (e) => { let txt = ''; for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript; setText((x) => (x + ' ' + txt).trim()); };
    r.onend = r.onerror = () => { recog.current = null; setRec(false); };
    r.start();
  };

  return (
    <div className="ws-ai" id="ws-ai" hidden={!aiOpen}>
      <div className="ai-h">
        <div><b>{t('Assistant IA')}</b><small>{mod === 'general' ? t("Toute l'organisation") : t('Module : {name}', { name: def ? t(def.title) : mod })}</small></div>
        <button className="x" type="button" aria-label={t("Fermer l'assistant")} onClick={() => setAiOpen(false)}>×</button>
      </div>
      <div className="ai-log" aria-live="polite" ref={log}>
        {msgs.map((m, i) => <div key={i} className={'bub ' + m.role + (m.wait ? ' wait' : '') + (m.err ? ' err' : '')}>{m.content}</div>)}
      </div>
      <div className="ai-chips">{(SUGGEST[mod] || SUGGEST.general).map((q) => <button key={q} type="button" className="chip" onClick={() => go(t(q))}>{t(q)}</button>)}</div>
      <div className="ai-in">
        <textarea rows={2} placeholder={t("Posez votre question ou demandez de l'aide…")} aria-label={t("Message pour l'IA")} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } }} />
        <div className="row">
          <button className="btn primary small" type="button" disabled={busy} onClick={() => go()}>{t('Envoyer')}</button>
          {SR ? <button className="btn small" type="button" title={t('Dicter votre message à la voix')} onClick={dictate}>{rec ? t('Écoute… (toucher pour arrêter)') : t('Parler')}</button> : null}
          {canNote ? <button className="btn small" type="button" title={t("Enregistrer un résumé de cette discussion dans la mémoire de l'entreprise")} onClick={note}>{t('Noter ceci')}</button> : null}
          <button className="btn small" type="button" onClick={() => oapi('DELETE', '/ai/history?module=' + mod).then(() => setMsgs([{ role: 'assistant', content: t('Discussion effacée.') }]), fail)}>{t('Effacer')}</button>
        </div>
        <p className="ai-info">{remaining === null ? '' : t('{n} message(s) IA restant(s) avant le renouvellement', { n: remaining })}</p>
      </div>
    </div>
  );
}
