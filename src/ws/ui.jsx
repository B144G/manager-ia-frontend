import { useEffect, useRef, useState } from 'react';
import { useWs } from './WsContext.jsx';

/* Petits éléments d'interface de l'espace de travail. Toute donnée affichée passe par React (échappée) : jamais de HTML brut. */

export const ICONS = {
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  support: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  projects: 'M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h9',
  budget: 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2',
  stock: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  crm: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  hr: 'M3 5h18v14H3zM8 11a2 2 0 100-4 2 2 0 000 4zM5 16a3 3 0 016 0M14 9h5M14 13h4',
  sales: 'M4 5h16v11H9l-5 4zM9 9l2 2 4-4',
  structure: 'M12 3v5M5 14v-3h14v3M5 14v4M12 14v4M19 14v4M9 3h6v5H9zM2 18h6v3H2zM9 18h6v3H9zM16 18h6v3h-6z',
  processes: 'M4 6h16M4 12h10M4 18h7M17 15l2 2 3-4',
  team: 'M16 11a4 4 0 10-8 0M4 21a8 8 0 0116 0M20 8a3 3 0 010 6',
  payroll: 'M4 6h16v12H4zM4 10h16M8 15h3M15 15h1',
  fiscal: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
  marketing: 'M3 11v3a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM15 9a4 4 0 010 6M18 6a8 8 0 010 12',
  logistics: 'M2 6h12v10H2zM14 9h4l3 3v4h-7zM6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
  production: 'M3 21V10l6 3V10l6 3V6h6v15zM7 17h2M12 17h2M17 17h2',
  construction: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6M8 11h2M14 11h2',
  maintenance: 'M14 6a4 4 0 005 5l-9 9a2.1 2.1 0 01-3-3l9-9a4 4 0 00-2-2zM15 5l3 3',
  legal: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0zM8 21h8',
  memory: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11M9 8h6',
  agents: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM18 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z',
  out: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  alerts: 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 004 0',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  ai: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
};

/** Icône du menu (classe « ic », comme avant). */
export function Icon({ name }) {
  return <svg viewBox="0 0 24 24" className="ic" aria-hidden="true"><path d={ICONS[name] || ICONS.dashboard} /></svg>;
}

export const Empty = ({ text }) => <p className="ws-empty">{text}</p>;
export const Loading = () => <p className="ws-empty">Chargement…</p>;

/**
 * Charge des données au montage du module (et à chaque changement de `deps`).
 *   const { data, loading, error, reload, setData } = useLoad(() => oapi('GET', '/stock'), []);
 * Une erreur 401 renvoie à la connexion (fail) ; toute autre erreur est affichée dans `error`.
 */
export function useLoad(loader, deps = []) {
  const { fail } = useWs();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [n, setN] = useState(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let cancel = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve().then(loader).then(
      (data) => { if (!cancel && alive.current) setState({ data, loading: false, error: null }); },
      (e) => { if (cancel || !alive.current) return; if (e && e.status === 401) fail(e); setState({ data: null, loading: false, error: e }); },
    );
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: () => setN((x) => x + 1), setData: (data) => setState((s) => ({ ...s, data })) };
}

/** Affiche « Chargement… », l'erreur, ou les enfants (fonction recevant les données). */
export function Loaded({ state, children }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <p className="ws-err" role="alert">{state.error.message}</p>;
  if (!state.data) return null;
  return children(state.data);
}

/**
 * Petit formulaire : fields = [{k, label, type, options:[[valeur, libellé]], value, hint, required, rows, placeholder}]
 * onSubmit(valeurs) peut renvoyer une promesse ; une erreur levée s'affiche sous le formulaire.
 */
export function Form({ fields, submitText, onSubmit, extra, className = 'ws-form' }) {
  const { fail } = useWs();
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map((d) => [d.k, d.value === undefined || d.value === null ? (d.type === 'select' && d.options && d.options[0] ? d.options[0][0] : '') : d.value])));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
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
    <form className={className} noValidate onSubmit={submit}>
      {fields.map((d) => {
        const id = 'f_' + d.k;
        let el;
        if (d.type === 'select') el = <select id={id} style={{ fontSize: 16 }} value={vals[d.k]} onChange={(e) => set(d.k, e.target.value)}>{(d.options || []).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>;
        else if (d.type === 'textarea') el = <textarea id={id} style={{ fontSize: 16 }} rows={d.rows || 4} placeholder={d.placeholder || ''} value={vals[d.k]} onChange={(e) => set(d.k, e.target.value)} />;
        else el = <input id={id} style={{ fontSize: 16 }} type={d.type || 'text'} placeholder={d.placeholder || ''} autoComplete="off" value={vals[d.k]} onChange={(e) => set(d.k, e.target.value)} />;
        return <label className="fld" htmlFor={id} key={d.k}><span>{d.label}</span>{el}{d.hint ? <small>{d.hint}</small> : null}</label>;
      })}
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={busy}>{submitText}</button>{extra || null}</div>
    </form>
  );
}

/** Fenêtre (utilisée par WsContext.modal) : Échap ou clic à côté pour fermer, focus sur le premier champ. */
export function ModalBox({ title, wide, onClose, children }) {
  const body = useRef(null);
  useEffect(() => { const first = body.current && body.current.querySelector('input,textarea,select'); if (first) first.focus(); }, []);
  return (
    <div className="ws-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className={'ws-box' + (wide ? ' wide' : '')}>
        <div className="ws-box-h"><h2>{title}</h2><button className="x" type="button" aria-label="Fermer" style={{ minWidth: 44, minHeight: 44 }} onClick={onClose}>×</button></div>
        <div className="ws-box-b" ref={body}>{children}</div>
      </div>
    </div>
  );
}
