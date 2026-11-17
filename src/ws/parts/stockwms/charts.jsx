import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { qty } from './kit.jsx';

/* Graphiques légers en SVG (aucune bibliothèque) : une seule série par graphique, couleurs des variables CSS (thème clair et sombre),
   infobulle au survol et au clavier, et un tableau des valeurs pour les lecteurs d'écran (« Voir les chiffres »). */

/** Colonnes verticales : data = [{ label, value, hint? }]. */
export function Columns({ data, title, unit = '', height = 160 }) {
  const t = useT();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  const W = Math.max(240, data.length * 22); const H = height; const pad = 22; const bw = Math.max(4, (W / data.length) - 6);
  const step = W / data.length;
  const h = hover === null ? null : data[hover];
  return (
    <figure className="wms-chart">
      <figcaption className="wms-chart-h"><b>{title}</b>{h ? <span className="muted small" aria-live="polite">{h.label + ' : ' + qty(h.value) + (unit ? ' ' + unit : '')}</span> : null}</figcaption>
      <svg viewBox={`0 0 ${W} ${H + pad}`} role="img" aria-label={title} className="wms-chart-svg">
        <line x1="0" x2={W} y1={H} y2={H} className="wms-axis" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="wms-grid" />
        {data.map((d, i) => {
          const v = Number(d.value) || 0; const bh = v > 0 ? Math.max(3, (v / max) * (H - 8)) : 0; const x = i * step + (step - bw) / 2;
          return (
            <g key={i} tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={d.label + ' : ' + qty(v)}>
              <rect x={i * step} y="0" width={step} height={H} fill="transparent" />
              {bh ? <path className={'wms-bar' + (hover === i ? ' on' : '')} d={`M${x},${H} V${H - bh + 3} q0,-3 3,-3 h${bw - 6} q3,0 3,3 V${H} Z`} /> : null}
              {d.tick ? <text x={i * step + step / 2} y={H + 16} textAnchor="middle" className="wms-tick">{d.tick}</text> : null}
            </g>
          );
        })}
      </svg>
      <DataTable rows={data.map((d) => [d.label, qty(d.value) + (unit ? ' ' + unit : '')])} head={[t('Période'), t('Valeur')]} />
    </figure>
  );
}

/** Barres horizontales en pourcentage : rows = [{ label, value (0–100 ou null), sub? }]. Au-delà de `warn` %, la barre passe en couleur d'alerte. */
export function PctBars({ rows, title, warn = 90, empty }) {
  const t = useT();
  return (
    <figure className="wms-chart">
      <figcaption className="wms-chart-h"><b>{title}</b></figcaption>
      {!rows.length ? <p className="muted small">{empty}</p> : null}
      <div className="wms-hbars" role="list">
        {rows.map((r, i) => {
          const v = r.value === null || r.value === undefined ? null : Math.max(0, Number(r.value));
          const bad = v !== null && v >= warn;
          return (
            <div className="wms-hbar" role="listitem" key={i} title={r.label + ' : ' + (v === null ? '—' : qty(v) + ' %')}>
              <span className="wms-hbar-l">{r.label}{r.sub ? <small className="muted">{' · ' + r.sub}</small> : null}</span>
              <span className="wms-hbar-track" aria-hidden="true"><span className={'wms-hbar-fill' + (bad ? ' bad' : '')} style={{ width: Math.min(100, v || 0) + '%' }} /></span>
              <b className="wms-hbar-v">{v === null ? '—' : qty(v) + ' %'}{bad ? <span className="sr-only">{' ' + t('(saturé)')}</span> : null}</b>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

/** Jauge (anneau) : un pourcentage, avec son libellé. */
export function Gauge({ value, label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = 34; const c = 2 * Math.PI * r;
  return (
    <figure className="wms-gauge">
      <svg viewBox="0 0 84 84" role="img" aria-label={label + ' : ' + qty(v) + ' %'}>
        <circle cx="42" cy="42" r={r} className="wms-gauge-bg" />
        <circle cx="42" cy="42" r={r} className="wms-gauge-fg" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 42 42)" />
        <text x="42" y="47" textAnchor="middle" className="wms-gauge-t">{qty(Math.round(v)) + '%'}</text>
      </svg>
      <figcaption className="small muted">{label}</figcaption>
    </figure>
  );
}

function DataTable({ rows, head }) {
  const t = useT();
  return (
    <details className="wms-chart-table">
      <summary>{t('Voir les chiffres')}</summary>
      <table><thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
    </details>
  );
}
