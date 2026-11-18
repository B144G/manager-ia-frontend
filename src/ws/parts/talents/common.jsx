import { createContext, lazy, Suspense, useContext } from 'react';
import { Badge, Card, Skeleton } from '../../ui.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import './talents.css';

/* RH Talents · éléments communs : contexte (appels serveur + rôles RH de la personne), barres, niveaux, légende, radar. */

export const TCtx = createContext(null);
export const useTl = () => useContext(TCtx);

const Radar = lazy(() => import('./charts.jsx'));
export function RadarView({ data, series, max }) {
  return <div className="tl-chart"><Suspense fallback={<Skeleton block />}><Radar data={data} series={series} max={max} /></Suspense></div>;
}

/** Barre de progression (0–100), colorée selon le seuil. */
export function Bar({ value, tone }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const c = tone || (v >= 70 ? 'ok' : v >= 40 ? 'warn' : 'bad');
  return <div className={'tl-bar ' + c} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: v + '%' }} /></div>;
}

export const pct = (v) => (v === null || v === undefined ? '—' : String(v).replace('.', ',') + ' %');
export const num1 = (v) => (v === null || v === undefined ? '—' : String(v).replace('.', ','));

/** Pastille de gravité / état. */
export function Tone({ tone, children }) { return <Badge tone={tone}>{children}</Badge>; }

/** Carte avec un message d'explication discret. */
export function Panel({ title, subtitle, actions, note, children }) {
  return <Card title={title} subtitle={subtitle} actions={actions}>{children}{note ? <p className="tl-note">{note}</p> : null}</Card>;
}

export function Legend({ items }) { return <div className="tl-legend">{items.map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>; }

/** Accès refusé : affiché quand la personne n'a pas le rôle RH utile (le serveur reste le seul juge). */
export function Locked({ what }) {
  const t = useT();
  return <Card><p className="ws-empty">{t("Cet espace est réservé aux personnes désignées par le propriétaire de l'organisation.")}{what ? ' ' + what : ''}</p></Card>;
}

export const levelOpts = [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]);
export const yearNow = () => new Date().getFullYear();

/** Lance une action serveur : message de succès, puis rechargement ; l'erreur s'affiche telle quelle (déjà en français / traduite). */
export function useAct() {
  const t = useT();
  const { toast, fail } = useWs();
  return (promise, then, msg) => promise.then((r) => { toast(msg || t('Enregistré')); if (then) then(r); return r; }).catch((e) => { fail(e); return null; });
}
