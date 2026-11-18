import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { SERIES } from '../../charts/series.js';

/* Radar des compétences (360°, comparaison poste / personne). series : [{ key, label }], data : [{ name, [key]: valeur 0–max }]. Chargé à la demande (voir common.jsx). */
export default function RadarChartView({ data, series, max = 5 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--chart-grid)" />
        <PolarAngleAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--chart-axis)' }} />
        <PolarRadiusAxis angle={90} domain={[0, max]} tickCount={max + 1} tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
        {series.map((s, i) => <Radar key={s.key} isAnimationActive={false} name={s.label} dataKey={s.key} stroke={s.color || SERIES[i % SERIES.length]} fill={s.color || SERIES[i % SERIES.length]} fillOpacity={0.15} strokeWidth={2} />)}
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
