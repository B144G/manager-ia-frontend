import { MN } from './helpers.js';

/** Anneau du score de santé (SVG à la main). */
export function HealthRing({ score }) {
  const R = 48;
  const C2 = 2 * Math.PI * R;
  const tone = score >= 80 ? 'good' : score >= 60 ? 'mid' : 'bad';
  return (
    <svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label={'Score de santé ' + score + ' sur 100'}>
      <circle cx="60" cy="60" r={String(R)} fill="none" strokeWidth="12" className="ring-bg" />
      <circle cx="60" cy="60" r={String(R)} fill="none" strokeWidth="12" strokeLinecap="round" className={'ring ' + tone} strokeDasharray={(C2 * score / 100).toFixed(1) + ' ' + C2.toFixed(1)} transform="rotate(-90 60 60)" />
    </svg>
  );
}

/** Barres « entrées / sorties » des six derniers mois. */
export function flowChart(series) {
  let max = 1;
  series.forEach((m) => { max = Math.max(max, m.income, m.expense); });
  const unit = max >= 1000000 ? 1000000 : 1000;
  const top = Math.max(1, Math.ceil(max / unit));
  const W = 640;
  const H = 240;
  const base = 200;
  const sc = 160 / (top * unit);
  const step = top > 6 ? Math.ceil(top / 6) : 1;
  const grid = [];
  for (let g = 0; g <= top; g += step) {
    const y = base - g * unit * sc;
    grid.push(
      <g key={'g' + g}>
        <line x1="40" y1={String(y)} x2={String(W)} y2={String(y)} className="grid" />
        <text x="32" y={String(y + 4)} textAnchor="end" className="ax">{String(g)}</text>
      </g>,
    );
  }
  return {
    unit,
    svg: (
      <svg viewBox={'0 0 ' + W + ' ' + H} className="chart" role="img" aria-label="Entrées et sorties des six derniers mois">
        {grid}
        {series.map((m, i) => {
          const x = 62 + i * 96;
          return (
            <g key={m.month}>
              <rect x={String(x)} y={String(base - m.income * sc)} width="32" height={String(Math.max(m.income * sc, 0))} rx="6" className="b-in" />
              <rect x={String(x + 40)} y={String(base - m.expense * sc)} width="32" height={String(Math.max(m.expense * sc, 0))} rx="6" className="b-out" />
              <text x={String(x + 36)} y={String(base + 22)} textAnchor="middle" className="ax">{MN[Number(m.month.slice(5)) - 1]}</text>
            </g>
          );
        })}
      </svg>
    ),
  };
}
