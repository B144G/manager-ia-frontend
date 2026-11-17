import { lazy, Suspense } from 'react';
import { Skeleton } from '../ui/index.jsx';

/* Les graphiques sont chargés à la demande : la bibliothèque n'est téléchargée que lorsqu'un écran qui en contient s'affiche. */
const mod = () => import('./engine.jsx');
const L = {
  Combo: lazy(() => mod().then((m) => ({ default: m.Combo }))),
  Donut: lazy(() => mod().then((m) => ({ default: m.Donut }))),
  HBars: lazy(() => mod().then((m) => ({ default: m.HBars }))),
  Bars: lazy(() => mod().then((m) => ({ default: m.Bars }))),
};
const wrap = (C) => function Lazy(props) { return <Suspense fallback={<Skeleton block />}><C {...props} /></Suspense>; };
export const Combo = wrap(L.Combo);
export const Donut = wrap(L.Donut);
export const HBars = wrap(L.HBars);
export const Bars = wrap(L.Bars);
export { SERIES, compact } from './series.js';
