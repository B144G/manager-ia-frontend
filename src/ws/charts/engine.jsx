import { SERIES, compact } from './series.js';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/* Graphiques de l'application : UNE bibliothèque (Recharts), chargée à la demande (React.lazy via src/ws/charts/lazy.jsx), couleurs = jetons
   --c1…--c8 (thèmes clair et sombre). Montants abrégés sur les axes (1,2 M), exacts dans l'infobulle. */

function Tip({ active, payload, label, fmt, labels }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="ui-tip">
      {label !== undefined && label !== '' ? <b>{label}</b> : null}
      {payload.filter((p) => p.value !== null && p.value !== undefined && !p.hide).map((p) => (
        <div key={p.dataKey + p.name}><span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: p.color || p.fill, marginRight: 6 }} />{(labels && labels[p.dataKey]) || p.name}</span><b style={{ margin: 0 }}>{fmt ? fmt(p.value) : p.value}</b></div>
      ))}
    </div>
  );
}

/** Courbes, aires et barres combinées. series : [{ key, label, type: 'line'|'area'|'bar', color, dashed, stack }]. refs : [{ y, label, tone }] */
export function Combo({ data, xKey = 'x', series, fmt = (v) => v, height = 260, refs = [], zeroLine, stacked }) {
  const labels = Object.fromEntries(series.map((s) => [s.key, s.label]));
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={height - 20}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 12 }} tickFormatter={compact} />
        <Tooltip content={<Tip fmt={fmt} labels={labels} />} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3', fill: 'var(--on-surface-hover)' }} />
        {zeroLine ? <ReferenceLine y={0} stroke="var(--danger)" strokeWidth={1.5} /> : null}
        {refs.map((r, i) => <ReferenceLine key={i} y={r.y} stroke={r.tone === 'danger' ? 'var(--danger)' : 'var(--chart-plan)'} strokeDasharray="4 4" label={{ value: r.label, fill: 'var(--chart-axis)', fontSize: 11, position: 'insideTopRight' }} />)}
        {series.map((s, i) => {
          const color = s.color || SERIES[i % SERIES.length];
          if (s.type === 'bar') return <Bar key={s.key} isAnimationActive={false} dataKey={s.key} name={s.label} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} stackId={stacked ? 'a' : undefined} />;
          if (s.type === 'area') return <Area key={s.key} isAnimationActive={false} dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} fill={color} fillOpacity={0.14} type="monotone" dot={false} connectNulls />;
          return <Line key={s.key} isAnimationActive={false} dataKey={s.key} name={s.label} stroke={color} strokeWidth={2.25} strokeDasharray={s.dashed ? '6 4' : undefined} type="monotone" dot={s.dots ? { r: 3 } : false} activeDot={{ r: 5 }} connectNulls />;
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Anneau de répartition. data : [{ name, value }]. center : texte au centre. */
export function Donut({ data, fmt = (v) => v, center, sub, colors }) {
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<Tip fmt={fmt} />} />
          <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={data.length > 1 ? 2 : 0} stroke="var(--surface)" strokeWidth={2} startAngle={90} endAngle={-270}>
            {data.map((d, i) => <Cell key={d.name} fill={(colors && colors[i]) || d.color || SERIES[i % SERIES.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
        <b style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{center !== undefined ? center : fmt(total)}</b>
        {sub ? <small style={{ color: 'var(--muted)', fontSize: 'var(--fs-xs)' }}>{sub}</small> : null}
      </div>
    </div>
  );
}

/** Barres horizontales. data : [{ name, value, color? }] ; diverging : vert si favorable (value ≤ 0 pour une dépense)… color fournie par l'appelant. */
export function HBars({ data, fmt = (v) => v, height = 260, valueLabel }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={height - 20}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={compact} />
        <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <Tooltip content={<Tip fmt={fmt} labels={{ value: valueLabel }} />} cursor={{ fill: 'var(--on-surface-hover)' }} />
        <ReferenceLine x={0} stroke="var(--border-strong)" />
        <Bar isAnimationActive={false} dataKey="value" name={valueLabel} radius={4} maxBarSize={20}>
          {data.map((d, i) => <Cell key={d.name + i} fill={d.color || SERIES[i % SERIES.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barres verticales groupées ou empilées. */
export function Bars({ data, xKey = 'x', series, fmt = (v) => v, height = 260, stacked }) {
  const labels = Object.fromEntries(series.map((s) => [s.key, s.label]));
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={height - 20}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={10} />
        <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 12 }} tickFormatter={compact} allowDecimals={false} />
        <Tooltip content={<Tip fmt={fmt} labels={labels} />} cursor={{ fill: 'var(--on-surface-hover)' }} />
        {series.map((s, i) => <Bar key={s.key} isAnimationActive={false} dataKey={s.key} name={s.label} fill={s.color || SERIES[i % SERIES.length]} radius={stacked ? 0 : [4, 4, 0, 0]} maxBarSize={26} stackId={stacked ? 'a' : undefined} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
