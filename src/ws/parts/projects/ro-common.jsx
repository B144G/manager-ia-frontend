import { getLocale } from '../../../lib/i18n.jsx';

/* Petits éléments communs aux écrans Projets / Production (recherche opérationnelle, PERT, finances, circuit). */

export const num = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : (Math.round(Number(v) * 10 ** d) / 10 ** d).toLocaleString(getLocale(), { maximumFractionDigits: d }));
export const pct = (v, d = 1) => (v === null || v === undefined ? '—' : num(v, d) + ' %');

/** Tuile d'indicateur (même rendu que le pilotage de projet). */
export function Kpi({ label, value, sub, tone }) {
  return <div className={'bp-kpi' + (tone ? ' ' + tone : '')}><small>{label}</small><b className="bp-num">{value}</b>{sub ? <span>{sub}</span> : null}</div>;
}

/** Champ numérique d'un tableau modifiable (valeur texte pour ne pas bloquer la saisie des décimales). */
export function Cell({ value, onChange, type = 'number', label, placeholder, step = 'any' }) {
  return <input type={type} step={type === 'number' ? step : undefined} value={value === null || value === undefined ? '' : value} aria-label={label} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
