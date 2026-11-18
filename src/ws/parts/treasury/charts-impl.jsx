import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SERIES, compact } from '../../charts/series.js';

/* Recharts : cascade (waterfall) et courbes multiples. Couleurs = jetons --c1…--c8, --ok, --danger (thèmes clair et sombre). */

function Tip({ active, payload, label, fmt }) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined && !p.hide && p.dataKey !== 'base');
  return (
    <div className="ui-tip">
      {label !== undefined ? <b>{label}</b> : null}
      {rows.map((p) => <div key={p.dataKey + p.name}><span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: p.color || p.fill, marginRight: 6 }} />{p.name}</span><b style={{ marginLeft: 12 }}>{fmt(p.payload && p.payload.raw !== undefined && p.dataKey === 'size' ? p.payload.raw : p.value)}</b></div>)}
    </div>
  );
}

/** Cascade : data = [{ name, value, kind: 'total'|'delta' }] — un total part de zéro, un écart s'empile sur le cumul précédent. */
export function Waterfall({ data, fmt = (v) => v, height = 280 }) {
  let run = 0;
  const rows = data.map((d) => {
    if (d.kind === 'total') { run = d.value; return { name: d.name, base: Math.min(0, d.value), size: Math.abs(d.value), raw: d.value, color: 'var(--c1)' }; }
    const from = run; run += d.value;
    return { name: d.name, base: Math.min(from, run), size: Math.abs(d.value), raw: d.value, color: d.value >= 0 ? 'var(--ok)' : 'var(--danger)' };
  });
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={height - 20}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} tick={{ fontSize: 12 }} interval={0} />
        <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 12 }} tickFormatter={compact} />
        <ReferenceLine y={0} stroke="var(--border-strong)" />
        <Tooltip content={<Tip fmt={fmt} />} cursor={{ fill: 'var(--on-surface-hover)' }} />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="size" name="Montant" stackId="w" radius={4} isAnimationActive={false}>{rows.map((r, i) => <Cell key={i} fill={r.color} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Plusieurs courbes sur les mêmes dates. series : [{ key, label, color?, dashed? }] ; refs : lignes horizontales [{ y, label, tone }]. */
export function Lines({ data, series, fmt = (v) => v, height = 280, refs = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={height - 20}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="x" tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={14} />
        <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 12 }} tickFormatter={compact} />
        <ReferenceLine y={0} stroke="var(--danger)" strokeWidth={1.25} />
        {refs.map((r, i) => <ReferenceLine key={i} y={r.y} stroke={r.tone === 'danger' ? 'var(--danger)' : 'var(--chart-plan)'} strokeDasharray="4 4" label={{ value: r.label, fill: 'var(--chart-axis)', fontSize: 11, position: 'insideTopRight' }} />)}
        <Tooltip content={<Tip fmt={fmt} />} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }} />
        {series.map((s, i) => <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color || SERIES[i % SERIES.length]} strokeWidth={2.25} strokeDasharray={s.dashed ? '6 4' : undefined} type="monotone" dot={false} isAnimationActive={false} connectNulls />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
