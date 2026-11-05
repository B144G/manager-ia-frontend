import { useEffect, useRef, useState } from 'react';
import { Fa } from '../lib/fa.jsx';
import { getLocale, useT } from '../lib/i18n.jsx';

/* Barre de saisie de l'assistant : « + » (importer une image, un document ou une vidéo), zone de texte, micro (dictée), envoi.
   - Images : envoyées telles quelles (réduites si elles sont grandes). Documents : PDF et fichiers texte. Vidéo : l'IA ne lit pas les vidéos ; on lui envoie 4 images
     prises dans la vidéo (sans le son) et on le dit clairement. Au plus 4 pièces, 8 Mo au total ; rien n'est conservé côté serveur.
   - Micro : dictée du navigateur (Chrome, Edge, Safari récents). Le bouton n'apparaît que si le navigateur la propose. */
const MAX_FILES = 4; const MAX_BYTES = 8 * 1024 * 1024;
const TEXT_TYPES = ['text/plain', 'text/csv', 'text/markdown', 'application/json'];

const toB64 = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = ko; r.readAsDataURL(blob); });
async function shrinkImage(file) { // une photo de téléphone fait vite 5 Mo : on la ramène à 1 600 px de large au plus
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024) return file;
  const bmp = await createImageBitmap(file); const k = Math.min(1, 1600 / bmp.width);
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((ok) => c.toBlob((b) => ok(b || file), 'image/jpeg', 0.85));
}
async function videoFrames(file, n = 4) {
  const url = URL.createObjectURL(file); const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
  await new Promise((ok, ko) => { v.onloadedmetadata = ok; v.onerror = ko; });
  const out = []; const dur = Math.max(v.duration || 1, 1);
  for (let i = 0; i < n; i++) {
    v.currentTime = (dur * (i + 0.5)) / n;
    await new Promise((ok) => { v.onseeked = ok; });
    const c = document.createElement('canvas'); const k = Math.min(1, 960 / (v.videoWidth || 960)); c.width = Math.round((v.videoWidth || 960) * k); c.height = Math.round((v.videoHeight || 540) * k);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    out.push(await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8)));
  }
  URL.revokeObjectURL(url);
  return out;
}

export default function Composer({ value, onChange, onSend, busy, placeholder, label, rows = 2, files, setFiles, allowFiles = true, children }) {
  const t = useT();
  const [menu, setMenu] = useState(false);
  const [rec, setRec] = useState(false);
  const [note, setNote] = useState('');
  const recog = useRef(null); const box = useRef(null); const pick = useRef(null);
  const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  useEffect(() => {
    if (!menu) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', away); return () => document.removeEventListener('mousedown', away);
  }, [menu]);
  useEffect(() => () => { if (recog.current) recog.current.stop(); }, []);

  const dictate = () => {
    if (!SR) return;
    if (recog.current) { recog.current.stop(); return; }
    const r = new SR(); r.lang = getLocale(); r.interimResults = false; recog.current = r; setRec(true);
    r.onresult = (e) => { let txt = ''; for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript; onChange((value + ' ' + txt).trim()); };
    r.onend = r.onerror = () => { recog.current = null; setRec(false); };
    r.start();
  };

  const choose = (accept) => { setMenu(false); if (pick.current) { pick.current.accept = accept; pick.current.value = ''; pick.current.click(); } };
  async function onFiles(e) {
    const list = [...(e.target.files || [])]; setNote('');
    const next = [...files];
    try {
      for (const f of list) {
        if (next.length >= MAX_FILES) { setNote(t('Au plus {n} pièces jointes.', { n: MAX_FILES })); break; }
        if (f.type.startsWith('video/')) {
          const frames = await videoFrames(f);
          for (let i = 0; i < frames.length && next.length < MAX_FILES; i++) next.push({ name: `${f.name} (${t('image {n}', { n: i + 1 })})`, mime: 'image/jpeg', data: await toB64(frames[i]), size: frames[i].size, fromVideo: true });
          setNote(t("L'IA ne lit pas les vidéos : 4 images de la vidéo lui sont envoyées, sans le son."));
        } else if (f.type.startsWith('image/') || f.type === 'application/pdf' || TEXT_TYPES.includes(f.type)) {
          const blob = await shrinkImage(f);
          next.push({ name: f.name, mime: blob.type || f.type, data: await toB64(blob), size: blob.size });
        } else setNote(t("Ce type de fichier n'est pas accepté : images, PDF, fichiers texte et vidéos."));
      }
      if (next.reduce((a, x) => a + x.size, 0) > MAX_BYTES) { setNote(t('Les pièces jointes dépassent 8 Mo au total.')); return; }
      setFiles(next);
    } catch { setNote(t("Ce fichier n'a pas pu être lu.")); }
  }

  return (
    <div className="cmp">
      {files.length ? (
        <ul className="cmp-files" aria-label={t('Pièces jointes')}>
          {files.map((f, i) => (
            <li key={i}><Fa name={f.mime.startsWith('image/') ? 'image' : f.mime === 'application/pdf' ? 'pdf' : 'doc'} /><span>{f.name}</span>
              <button type="button" aria-label={t('Retirer {name}', { name: f.name })} onClick={() => setFiles(files.filter((_, k) => k !== i))}><Fa name="close" /></button></li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="cmp-note" role="status">{note}</p> : null}
      <div className="cmp-bar">
        {allowFiles ? (
          <div className="cmp-plus" ref={box}>
            <button type="button" className="cmp-btn" aria-haspopup="true" aria-expanded={menu} aria-label={t('Ajouter un fichier')} title={t('Ajouter un fichier')} onClick={() => setMenu(!menu)}><Fa name="plus" /></button>
            {menu ? (
              <div className="cmp-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => choose('image/png,image/jpeg,image/webp,image/gif')}><Fa name="image" fixedWidth />{t('Photo ou image')}</button>
                <button type="button" role="menuitem" onClick={() => choose('application/pdf,text/plain,text/csv,text/markdown,application/json,.csv,.txt,.md,.json')}><Fa name="doc" fixedWidth />{t('Document (PDF, texte, CSV)')}</button>
                <button type="button" role="menuitem" onClick={() => choose('video/*')}><Fa name="video" fixedWidth />{t('Vidéo')}</button>
              </div>
            ) : null}
            <input ref={pick} type="file" multiple hidden onChange={onFiles} />
          </div>
        ) : null}
        <textarea rows={rows} placeholder={placeholder} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} />
        {SR ? <button type="button" className={'cmp-btn' + (rec ? ' on' : '')} aria-pressed={rec} aria-label={rec ? t("Arrêter l'écoute") : t('Dicter votre message à la voix')} title={rec ? t("Arrêter l'écoute") : t('Dicter votre message à la voix')} onClick={dictate}><Fa name={rec ? 'stop' : 'mic'} /></button> : null}
        <button type="button" className="cmp-send" disabled={busy || (!value.trim() && !files.length)} aria-label={t('Envoyer')} title={t('Envoyer')} onClick={() => onSend()}><Fa name={busy ? 'spinner' : 'arrow-up'} spin={busy} /></button>
      </div>
      {children}
    </div>
  );
}
