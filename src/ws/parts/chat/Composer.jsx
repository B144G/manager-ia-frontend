import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Icon } from '../../../lib/fa.jsx';
import { useWs } from '../../WsContext.jsx';
import { Button } from '../../ui.jsx';
import { EMOJIS, fmtDur } from './text.jsx';

const pickMime = () => { for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch { /* essai suivant */ } } return ''; };

/** Zone d'écriture : texte, émojis, @mentions, pièce jointe, message vocal, urgent, sondage, position, message programmé. */
export default function Composer({ conv, members, meId, settings, disabled, disabledText, reply, edit, onCancelContext, onSend, onFile, onVoice, onPoll, onLocation, onSchedule, onTyping, e2ee }) {
  const t = useT();
  const { modal, toast, confirm } = useWs();
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [plus, setPlus] = useState(false);
  const [rec, setRec] = useState(null); // { start, stop() }
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const ta = useRef(null); const fileIn = useRef(null); const typedAt = useRef(0);
  const recRef = useRef(null);

  useEffect(() => { if (edit) { setText(edit.body); ta.current && ta.current.focus(); } }, [edit]);
  useEffect(() => { if (reply && ta.current) ta.current.focus(); }, [reply]);
  useEffect(() => { setText(''); setUrgent(false); setEmoji(false); setPlus(false); }, [conv && conv.id]);
  useEffect(() => { if (!ta.current) return; ta.current.style.height = 'auto'; ta.current.style.height = Math.min(ta.current.scrollHeight, 160) + 'px'; }, [text]);
  useEffect(() => () => { if (recRef.current) { try { recRef.current.cancel(); } catch { /* arrêté */ } } }, []);

  // @mentions : suggestions à partir du mot en cours
  const m = /(?:^|\s)@([^\s@]{0,30})$/.exec(text);
  const sugg = m && conv && conv.kind === 'group' ? [{ userId: 0, name: t('tous') }, ...members.filter((x) => x.userId !== meId)].filter((x) => x.name.toLowerCase().startsWith(m[1].toLowerCase())).slice(0, 5) : (m ? members.filter((x) => x.userId !== meId && x.name.toLowerCase().startsWith(m[1].toLowerCase())).slice(0, 5) : []);
  const insertMention = (name) => { setText((v) => v.replace(/@([^\s@]{0,30})$/, '@' + name + ' ')); ta.current && ta.current.focus(); };

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try { await onSend({ body: v, urgent }); setText(''); setUrgent(false); setEmoji(false); } finally { setBusy(false); }
  };
  const key = (e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia && !window.matchMedia('(pointer: coarse)').matches) { e.preventDefault(); send(); } };
  const change = (e) => { setText(e.target.value); if (Date.now() - typedAt.current > 3000) { typedAt.current = Date.now(); onTyping('typing'); } };

  const startRec = async () => {
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast(t("L'enregistrement audio n'est pas disponible sur ce navigateur."), true); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { toast(t("Le micro n'est pas accessible : autorisez-le dans votre navigateur."), true); return; }
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = []; const start = Date.now();
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { mr.onstop = () => res(); });
    mr.start(250);
    const tick = setInterval(() => { setSecs(Math.round((Date.now() - start) / 1000)); onTyping('recording'); if (Date.now() - start > 5 * 60 * 1000) ctl.stop(); }, 1000);
    const ctl = {
      async stop() { clearInterval(tick); mr.stop(); stream.getTracks().forEach((x) => x.stop()); await done; recRef.current = null; setRec(null); const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); const dur = Date.now() - start; if (dur < 700) return; onTyping('none'); await onVoice(blob, dur); },
      cancel() { clearInterval(tick); try { mr.stop(); } catch { /* */ } stream.getTracks().forEach((x) => x.stop()); recRef.current = null; setRec(null); onTyping('none'); },
    };
    recRef.current = ctl; setSecs(0); setRec(ctl); onTyping('recording');
  };

  const pickFile = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onFile(f); setPlus(false); };
  const sharePos = () => {
    setPlus(false);
    confirm(t("Partager votre position UNE SEULE FOIS avec cette conversation ? Les participants verront l'endroit où vous êtes maintenant. Rien n'est suivi ensuite."), () => {
      if (!navigator.geolocation) { toast(t("La localisation n'est pas disponible sur cet appareil."), true); return; }
      navigator.geolocation.getCurrentPosition((p) => onLocation(p.coords.latitude, p.coords.longitude, p.coords.accuracy), () => toast(t("Position impossible à lire : autorisez la localisation dans votre navigateur."), true), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    }, t('Partager ma position'));
  };
  const pollForm = () => {
    setPlus(false);
    modal(t('Nouveau sondage'), (close) => <PollForm t={t} onSubmit={async (v) => { await onPoll(v); close(); }} />);
  };
  const schedForm = () => {
    setPlus(false);
    modal(t('Programmer un message'), (close) => <ScheduleForm t={t} initial={text} onSubmit={async (v) => { await onSchedule(v); setText(''); close(); }} />);
  };

  if (disabled) return <div className="ci-composer off"><p className="ci-muted">{disabledText}</p></div>;
  const allowedExt = settings && settings.allowedKinds ? '' : '';
  void allowedExt;
  return (
    <div className="ci-composer">
      {(reply || edit) && (
        <div className="ci-ctx"><Icon name={edit ? 'pen' : 'c-reply'} /> <span>{edit ? t('Modifier le message') : t('Réponse à {name}', { name: reply.senderName })}</span>
          {reply && <small>{reply.snippet}</small>}<button type="button" onClick={() => { onCancelContext(); setText(''); }} aria-label={t('Annuler')}><Icon name="close" /></button></div>
      )}
      {rec ? (
        <div className="ci-recbar" role="status">
          <span className="ci-recdot" aria-hidden="true" /> <b>{t('Enregistrement…')}</b> <span>{fmtDur(secs)}</span>
          <span className="ci-grow" />
          <Button variant="ghost" onClick={() => rec.cancel()} icon="trash" label={t('Annuler')}>{t('Annuler')}</Button>
          <Button onClick={() => rec.stop()} icon="send" label={t('Envoyer')}>{t('Envoyer')}</Button>
        </div>
      ) : (
        <>
          {sugg.length > 0 && <ul className="ci-sugg" role="listbox">{sugg.map((s) => <li key={s.userId}><button type="button" role="option" onClick={() => insertMention(s.name)}><Icon name="c-at" /> {s.name}</button></li>)}</ul>}
          {emoji && (
            <div className="ci-emoji" role="dialog" aria-label={t('Émojis')}>
              {EMOJIS.map((row, i) => <div key={i}>{row.map((e) => <button key={e} type="button" onClick={() => { setText((v) => v + e); ta.current && ta.current.focus(); }}>{e}</button>)}</div>)}
            </div>
          )}
          {plus && (
            <ul className="ci-plus" role="menu">
              <li><button type="button" role="menuitem" onClick={() => fileIn.current.click()}><Icon name="clip" /> {t('Fichier ou image')}</button></li>
              {!e2ee && <li><button type="button" role="menuitem" onClick={pollForm}><Icon name="c-poll" /> {t('Sondage')}</button></li>}
              {!e2ee && <li><button type="button" role="menuitem" onClick={sharePos}><Icon name="c-pos" /> {t('Ma position (une fois)')}</button></li>}
              {!e2ee && <li><button type="button" role="menuitem" onClick={schedForm}><Icon name="clock" /> {t('Programmer ce message')}</button></li>}
              <li><button type="button" role="menuitem" aria-pressed={urgent} onClick={() => { setUrgent((v) => !v); setPlus(false); }}><Icon name="c-bolt" /> {urgent ? t('Retirer « urgent »') : t('Marquer urgent')}</button></li>
            </ul>
          )}
          <div className="ci-row">
            <input ref={fileIn} type="file" hidden onChange={pickFile} />
            <button type="button" className="ci-ico" aria-label={t('Plus')} aria-expanded={plus} onClick={() => { setPlus((v) => !v); setEmoji(false); }}><Icon name="plus" /></button>
            <button type="button" className="ci-ico" aria-label={t('Émojis')} aria-expanded={emoji} onClick={() => { setEmoji((v) => !v); setPlus(false); }}><Icon name="c-smile" /></button>
            <textarea ref={ta} rows={1} value={text} onChange={change} onKeyDown={key} placeholder={e2ee ? t('Message chiffré…') : t('Écrire un message…')} aria-label={t('Message')} maxLength={e2ee ? 3000 : 4000} className={urgent ? 'urgent' : ''} />
            {text.trim() ? <button type="button" className="ci-send" onClick={send} disabled={busy} aria-label={t('Envoyer')}><Icon name="send" /></button>
              : <button type="button" className="ci-send" onClick={startRec} aria-label={t('Message vocal')}><Icon name="c-mic" /></button>}
          </div>
          {urgent && <small className="ci-urgnote"><Icon name="c-bolt" /> {t('Ce message sera marqué urgent.')}</small>}
        </>
      )}
    </div>
  );
}

function PollForm({ t, onSubmit }) {
  const [q, setQ] = useState(''); const [opts, setOpts] = useState(['', '']); const [multiple, setMultiple] = useState(false); const [anon, setAnon] = useState(false); const [busy, setBusy] = useState(false);
  return (
    <form className="ws-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit({ question: q, options: opts.filter((o) => o.trim()), multiple, anonymous: anon }); } finally { setBusy(false); } }}>
      <label>{t('Question')}<input value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} required /></label>
      {opts.map((o, i) => <label key={i}>{t('Choix {n}', { n: i + 1 })}<input value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} maxLength={100} /></label>)}
      {opts.length < 10 && <Button type="button" variant="ghost" onClick={() => setOpts([...opts, ''])} icon="plus" label={t('Ajouter un choix')}>{t('Ajouter un choix')}</Button>}
      <label className="ci-check"><input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} /> {t('Plusieurs réponses possibles')}</label>
      <label className="ci-check"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> {t('Vote anonyme')}</label>
      <Button type="submit" loading={busy} label={t('Publier')}>{t('Publier')}</Button>
    </form>
  );
}
function ScheduleForm({ t, initial, onSubmit }) {
  const def = new Date(Date.now() + 3600000); def.setMinutes(0, 0, 0);
  const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [body, setBody] = useState(initial || ''); const [at, setAt] = useState(local(def)); const [urgent, setUrgent] = useState(false); const [busy, setBusy] = useState(false);
  return (
    <form className="ws-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit({ body, sendAt: new Date(at).toISOString(), urgent }); } finally { setBusy(false); } }}>
      <label>{t('Message')}<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} required /></label>
      <label>{t("Date et heure d'envoi")}<input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required /></label>
      <label className="ci-check"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> {t('Urgent')}</label>
      <Button type="submit" loading={busy} label={t('Programmer')}>{t('Programmer')}</Button>
    </form>
  );
}
