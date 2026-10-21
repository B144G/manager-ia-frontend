import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';

/* Outils locaux du module « sales » (anciens petits utilitaires de sales.js). */

export const TEMP = { chaud: ['Chaud', 'bad'], tiede: ['Tiède', 'mid'], froid: ['Froid', 'good'] };
export const OST = { pending: ['À valider', 'mid'], confirmed: ['Confirmée', 'good'], cancelled: ['Refusée', 'bad'], invoiced: ['Facturée', 'good'] };
export const CHANNELS = { whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram' };

/** Pastille : t = [texte, classe]. */
export const Pill = ({ t }) => <span className={'pill ' + t[1]}>{t[0]}</span>;

/** Adresse publique du serveur (pour les webhooks et l'agenda). */
export const publicBase = () => API_BASE || window.location.origin;

/** Adresse d'un fichier de l'organisation courante : /api/ws/orgs/<id><chemin>. */
export function useOrgUrl() {
  const { orgId } = useWs();
  return (path) => API_BASE + '/api/ws/orgs/' + orgId + path;
}

/** Télécharge un blob sous un nom donné. */
export function saveBlob(blob, name, delay) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), delay || 1000);
}

/** Comme Form (ui.jsx) mais prévient le parent des valeurs courantes (onValues), pour les champs qui dépendent d'un autre. */
export function Form2({ fields, submitText, onSubmit, onValues }) {
  const { fail } = useWs();
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map((d) => [d.k, d.value === undefined || d.value === null ? (d.type === 'select' && d.options && d.options[0] ? d.options[0][0] : '') : d.value])));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { if (onValues) onValues(vals); }, [vals]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));
  async function submit(ev) {
    ev.preventDefault();
    setErr('');
    for (const d of fields) if (d.required && !String(vals[d.k]).trim()) { setErr('Remplissez : ' + d.label.toLowerCase() + '.'); return; }
    setBusy(true);
    try { await onSubmit(vals); } catch (e) { if (alive.current) setErr(e.message || 'Erreur'); if (e && e.status === 401) fail(e); }
    if (alive.current) setBusy(false);
  }
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      {fields.map((d) => {
        const id = 'f_' + d.k;
        const el = d.type === 'select'
          ? <select id={id} value={vals[d.k]} onChange={(e) => set(d.k, e.target.value)}>{(d.options || []).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
          : <input id={id} type={d.type || 'text'} placeholder={d.placeholder || ''} autoComplete="off" value={vals[d.k]} onChange={(e) => set(d.k, e.target.value)} />;
        return <label className="fld" htmlFor={id} key={d.k}><span>{d.label}</span>{el}{d.hint ? <small>{d.hint}</small> : null}</label>;
      })}
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={busy}>{submitText}</button></div>
    </form>
  );
}

/** Champ en lecture seule, sélectionné au clic (liens, jetons à coller ailleurs). */
export const ReadOnly = ({ value, label, ...rest }) => (
  <input type="text" readOnly value={value} aria-label={label} onFocus={(e) => e.target.select()} {...rest} />
);

/* ---------- QR codes : seulement si la bibliothèque « qrcode » est présente sur la page (aucune requête externe) ---------- */
export const hasQr = () => typeof window.qrcode === 'function';

export function QrBlock({ label, text, file }) {
  const { copy } = useWs();
  const cv = useRef(null);
  useEffect(() => {
    const el = cv.current;
    if (!el || !hasQr()) return;
    const q = window.qrcode(0, 'M');
    q.addData(text); q.make();
    const n = q.getModuleCount(), m = 4, cell = Math.max(3, Math.floor(800 / (n + 2 * m))), size = (n + 2 * m) * cell;
    el.width = el.height = size;
    const g = el.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
  }, [text]);
  if (!hasQr()) return null;
  return (
    <div className="ws-qr">
      <b>{label}</b>
      <canvas ref={cv} role="img" aria-label={'QR code : ' + label} style={{ width: 200, height: 200, maxWidth: '100%', imageRendering: 'pixelated', border: '1px solid var(--line)', borderRadius: 8 }} />
      <div className="row">
        <button className="btn small" type="button" onClick={() => cv.current.toBlob((bl) => saveBlob(bl, file + '.png'))}>Télécharger l'image</button>
        <button className="btn small" type="button" onClick={() => copy(text, 'Lien copié.')}>Copier le lien</button>
      </div>
    </div>
  );
}
