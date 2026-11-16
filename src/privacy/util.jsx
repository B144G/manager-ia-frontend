import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, rq } from '../lib/api.js';
import { getLocale } from '../lib/i18n.jsx';

export const priv = (method, path, body) => rq(method, '/api/privacy' + path, body);

export const fmtDate = (iso, withTime) => {
  try { return new Date(iso).toLocaleString(getLocale(), withTime ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return String(iso || ''); }
};

/** Charge des données ; une session expirée (401) renvoie à la connexion. */
export function useData(loader, deps = []) {
  const navigate = useNavigate();
  const [st, setSt] = useState({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let off = false;
    Promise.resolve().then(loader).then(
      (data) => { if (!off && alive.current) setSt({ data, error: null, loading: false }); },
      (e) => { if (off || !alive.current) return; if (e && e.status === 401) { navigate('/connexion', { replace: true }); return; } setSt({ data: null, error: e, loading: false }); },
    );
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { ...st, reload };
}

/** Message de retour affiché sous une action : { text, bad }. */
export function useFlash() {
  const [f, setF] = useState(null);
  const ok = useCallback((text) => setF({ text, bad: false }), []);
  const bad = useCallback((e) => setF({ text: (e && e.message) || String(e || ''), bad: true }), []);
  const clear = useCallback(() => setF(null), []);
  return { flash: f, ok, bad, clear };
}

export function Flash({ f }) {
  if (!f) return null;
  return <p role={f.bad ? 'alert' : 'status'} className={f.bad ? 'ws-err' : 'ok'} style={{ marginTop: 8, overflowWrap: 'anywhere' }}>{f.text}</p>;
}

/** Télécharge un fichier renvoyé par le serveur (cookie de session), sous le nom proposé par l'en-tête Content-Disposition. */
export async function downloadFile(path, fallbackName) {
  const r = await fetch(API_BASE + path, { credentials: 'include' });
  if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.error || 'Une erreur est survenue. Réessayez.'); e.status = r.status; throw e; }
  const m = /filename="?([^";]+)"?/i.exec(r.headers.get('Content-Disposition') || '');
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = m ? m[1] : fallbackName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return blob.size;
}
