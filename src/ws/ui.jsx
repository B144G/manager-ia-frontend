import { useEffect, useRef, useState } from 'react';
import { useWs } from './WsContext.jsx';
import { ICONS } from '../lib/icons.js';
import { useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';

/* Petits éléments d'interface de l'espace de travail. Toute donnée affichée passe par React (échappée) : jamais de HTML brut. */

export { ICONS };

/** Icône du menu (classe « ic », comme avant). */
export function Icon({ name }) {
  return <svg viewBox="0 0 24 24" className="ic" aria-hidden="true"><path d={ICONS[name] || ICONS.dashboard} /></svg>;
}

export function Empty({ text }) { useT(); return <p className="ws-empty">{tsrv(text)}</p>; }
export function Loading() { const t = useT(); return <p className="ws-empty">{t('Chargement…')}</p>; }

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
  if (state.error) return <p className="ws-err" role="alert">{tsrv(state.error.message)}</p>;
  if (!state.data) return null;
  return children(state.data);
}

/**
 * Petit formulaire : fields = [{k, label, type, options:[[valeur, libellé]], value, hint, required, rows, placeholder}]
 * onSubmit(valeurs) peut renvoyer une promesse ; une erreur levée s'affiche sous le formulaire.
 */
export function Form({ fields, submitText, onSubmit, extra, className = 'ws-form' }) {
  const { fail } = useWs();
  const t = useT();
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map((d) => [d.k, d.value === undefined || d.value === null ? (d.type === 'select' && d.options && d.options[0] ? d.options[0][0] : '') : d.value])));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));
  async function submit(ev) {
    ev.preventDefault();
    setErr('');
    for (const d of fields) if (d.required && !String(vals[d.k]).trim()) { setErr(t('Remplissez : {champ}.', { champ: tsrv(d.label).toLowerCase() })); return; }
    setBusy(true);
    try { await onSubmit(vals); } catch (e) { if (alive.current) setErr(tsrv(e.message || t('Erreur'))); if (e && e.status === 401) fail(e); }
    if (alive.current) setBusy(false);
  }
  return (
    <form className={className} noValidate onSubmit={submit}>
      {fields.map((d) => {
        const id = 'f_' + d.k;
        let el;
        if (d.type === 'select') el = <select id={id} style={{ fontSize: 16 }} value={vals[d.k]} onChange={(e) => set(d.k, e.target.value)}>{(d.options || []).map((o) => <option key={o[0]} value={o[0]}>{tsrv(o[1])}</option>)}</select>;
        else if (d.type === 'textarea') el = <textarea id={id} style={{ fontSize: 16 }} rows={d.rows || 4} placeholder={d.placeholder ? tsrv(d.placeholder) : ''} value={vals[d.k]} onChange={(e) => set(d.k, e.target.value)} />;
        else el = <input id={id} style={{ fontSize: 16 }} type={d.type || 'text'} placeholder={d.placeholder ? tsrv(d.placeholder) : ''} autoComplete="off" value={vals[d.k]} onChange={(e) => set(d.k, e.target.value)} />;
        return <label className="fld" htmlFor={id} key={d.k}><span>{tsrv(d.label)}</span>{el}{d.hint ? <small>{tsrv(d.hint)}</small> : null}</label>;
      })}
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={busy}>{tsrv(submitText)}</button>{extra || null}</div>
    </form>
  );
}

/** Fenêtre (utilisée par WsContext.modal) : Échap ou clic à côté pour fermer, focus sur le premier champ. */
export function ModalBox({ title, wide, onClose, children }) {
  const t = useT();
  const body = useRef(null);
  useEffect(() => { const first = body.current && body.current.querySelector('input,textarea,select'); if (first) first.focus(); }, []);
  return (
    <div className="ws-modal" role="dialog" aria-modal="true" aria-label={tsrv(title)} onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className={'ws-box' + (wide ? ' wide' : '')}>
        <div className="ws-box-h"><h2>{tsrv(title)}</h2><button className="x" type="button" aria-label={t('Fermer')} style={{ minWidth: 44, minHeight: 44 }} onClick={onClose}>×</button></div>
        <div className="ws-box-b" ref={body}>{children}</div>
      </div>
    </div>
  );
}
