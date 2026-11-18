import { lazy, Suspense } from 'react';
import { Skeleton } from '../../ui/index.jsx';

/* Graphiques propres à la Trésorerie (cascade des écarts, courbe des scénarios). Chargés à la demande avec Recharts. */
const mod = () => import('./charts-impl.jsx');
const wrap = (C) => function Lazy(props) { return <Suspense fallback={<Skeleton block />}><C {...props} /></Suspense>; };
export const Waterfall = wrap(lazy(() => mod().then((m) => ({ default: m.Waterfall }))));
export const Lines = wrap(lazy(() => mod().then((m) => ({ default: m.Lines }))));

/** Jauge horizontale du fonds de sécurité : niveau actuel face à la cible. */
export function Gauge({ ratio, level, label }) {
  const pct = Math.max(0, Math.min(ratio === null || ratio === undefined ? 0 : ratio, 1.5));
  const color = level === 'ok' ? 'var(--ok)' : level === 'low' ? 'var(--warn)' : level === 'unset' ? 'var(--c8)' : 'var(--danger)';
  return (
    <div role="img" aria-label={label} style={{ position: 'relative', height: 16, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(pct, 1) * 100}%`, height: '100%', background: color, transition: 'width .3s' }} />
      <div style={{ position: 'absolute', left: '100%', top: 0, bottom: 0, marginLeft: -2, width: 2, background: 'var(--text)' }} aria-hidden="true" />
    </div>
  );
}
