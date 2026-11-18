import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../../lib/i18n.jsx';
import { Alert, Button } from '../../../ui/index.jsx';
import { cut } from './flowCommon.jsx';

/* Production · Six Sigma, TPM et qualité : briques communes (encadré « circuit », saisie en lignes, diagramme de Pareto, barre d'avancement).
   Le serveur calcule ; ces briques ne font que saisir et dessiner. */

/** Ouvre l'onglet « Circuit de production » du module (les techniques avancées ne reçoivent pas de prop pour cela : on active le bouton d'onglet). */
export function openCircuitTab(label, goTab) {
  if (typeof goTab === 'function') { goTab('flow'); return; }
  const b = Array.from(document.querySelectorAll('.ws-tabs .tab')).find((x) => x.textContent.trim() === label);
  if (b) { b.click(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}

/** Petit encadré « Utilisé par l'analyse du circuit » : une phrase + bouton vers l'onglet Circuit de production. */
export function CircuitNote({ children, goTab }) {
  const t = useT();
  return (
    <Alert tone="info" title={t('Utilisé par l\'analyse du circuit')}>
      <p style={{ margin: '0 0 8px' }}>{children}</p>
      <Button size="sm" onClick={() => openCircuitTab(t('Circuit de production'), goTab)}>{t('Ouvrir l\'onglet Circuit de production')}</Button>
    </Alert>
  );
}

/** Zone de texte « une valeur par ligne » : garde son texte brut pour ne pas avaler les séparateurs en cours de frappe ; se resynchronise si la valeur change d'ailleurs. */
export function TextLines({ label, lines, onChange, rows = 4, placeholder }) {
  const [txt, setTxt] = useState(() => lines.join('\n'));
  const last = useRef(lines.join('\n')); const self = useRef(false);
  useEffect(() => { const k = lines.join('\n'); if (k !== last.current) { last.current = k; if (self.current) self.current = false; else setTxt(k); } }, [lines.join('\n')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <textarea aria-label={label} rows={rows} placeholder={placeholder} value={txt} style={{ width: '100%', font: 'inherit', fontSize: 16, padding: 8, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', color: 'var(--fg)', boxSizing: 'border-box' }}
      onChange={(e) => { setTxt(e.target.value); self.current = true; const arr = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean); onChange(arr); }} />
  );
}

/** Champ texte « a, b, c » pour une liste de mots (garde le texte brut pendant la frappe). */
export function ListCell({ label, items, onChange }) {
  const [txt, setTxt] = useState(() => items.join(', '));
  const last = useRef(items.join('|')); const self = useRef(false);
  useEffect(() => { const k = items.join('|'); if (k !== last.current) { last.current = k; if (self.current) self.current = false; else setTxt(items.join(', ')); } }, [items.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input type="text" aria-label={label} value={txt} onChange={(e) => { setTxt(e.target.value); self.current = true; onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean)); }} />;
}

/** Barre d'avancement horizontale (0 à 100). tone : '' | 'full' (couleur d'alerte). */
export function Pbar({ value, tone, label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className={'ro-bar' + (tone === 'full' ? ' full' : '')} role="img" aria-label={label ? label + ' : ' + Math.round(v) + ' %' : Math.round(v) + ' %'}><i style={{ width: v + '%' }} /></div>;
}

/** Diagramme de Pareto : barres décroissantes + courbe de cumul + repère 80 %. items : [{ label, value, cum }] (cum en %). Les causes « vitales » (jusqu'à 80 %) sont en couleur forte. */
export function ParetoChart({ items, title, valueLabel }) {
  const t = useT();
  const W = 680; const H = 300; const L = 46; const R = 44; const T = 16; const B = 84;
  const n = items.length;
  if (!n) return null;
  const maxV = Math.max(...items.map((x) => x.value), 1);
  const cw = (W - L - R) / n; const bw = Math.min(54, cw * 0.7);
  const x = (i) => L + cw * i + cw / 2;
  const yv = (v) => T + (H - T - B) * (1 - v / maxV);
  const yp = (p) => T + (H - T - B) * (1 - p / 100);
  let vitalN = 0; for (const it of items) { vitalN++; if (it.cum >= 80) break; }
  const line = items.map((it, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yp(it.cum).toFixed(1)).join('');
  return (
    <div className="bp-chart" style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420 }} role="img" aria-label={title}>
        <title>{title}</title>
        {[0, 25, 50, 75, 100].map((p) => <g key={p}><line x1={L} x2={W - R} y1={yp(p)} y2={yp(p)} stroke="var(--line)" /><text x={W - R + 6} y={yp(p) + 4} style={{ fontSize: 11, fill: 'var(--muted)' }}>{p} %</text></g>)}
        <line x1={L} x2={W - R} y1={yp(80)} y2={yp(80)} stroke="var(--plan)" strokeWidth="1.6" strokeDasharray="5 4" />
        <text x={L + 4} y={yp(80) - 4} style={{ fontSize: 11, fill: 'var(--plan)', fontWeight: 700 }}>{t('Repère 80 %')}</text>
        <text x={4} y={T + 4} style={{ fontSize: 11, fill: 'var(--muted)' }}>{valueLabel || ''}</text>
        {items.map((it, i) => (
          <g key={i}>
            <rect x={x(i) - bw / 2} y={yv(it.value)} width={bw} height={Math.max(0, yv(0) - yv(it.value))} rx="3" fill={i < vitalN ? 'var(--s1)' : 'var(--s3)'} />
            <text x={x(i)} y={yv(it.value) - 4} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--fg)', fontWeight: 700 }}>{it.value}</text>
            <text transform={`translate(${x(i)} ${H - B + 12}) rotate(-35)`} textAnchor="end" style={{ fontSize: 11, fill: 'var(--fg)' }}>{cut(it.label, 18)}</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="var(--pink)" strokeWidth="2.2" strokeLinejoin="round" />
        {items.map((it, i) => <circle key={i} cx={x(i)} cy={yp(it.cum)} r="3.5" fill="var(--pink)" stroke="var(--surface)" strokeWidth="1.5" />)}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5 }}>
        <span><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--s1)', marginRight: 5, verticalAlign: -1 }} aria-hidden="true" />{t('Causes vitales')}</span>
        <span><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--s3)', marginRight: 5, verticalAlign: -1 }} aria-hidden="true" />{t('Autres causes')}</span>
        <span><i style={{ display: 'inline-block', width: 12, height: 0, borderTop: '2px solid var(--pink)', marginRight: 5, verticalAlign: 3 }} aria-hidden="true" />{t('Cumul (%)')}</span>
      </div>
    </div>
  );
}

/** Taille d'échantillon et critère d'acceptation, même règle que le serveur (calculateur rapide : les plans enregistrés utilisent le calcul du serveur). */
const LET = [[8, 'A', 2], [15, 'B', 3], [25, 'C', 5], [50, 'D', 8], [90, 'E', 13], [150, 'F', 20], [280, 'G', 32], [500, 'H', 50], [1200, 'J', 80], [3200, 'K', 125], [10000, 'L', 200], [35000, 'M', 315], [150000, 'N', 500], [500000, 'P', 800], [Infinity, 'Q', 1250]];
const binCdf = (c, n, p) => { let s = 0; let term = Math.pow(1 - p, n); for (let k = 0; k <= c; k++) { s += term; term *= (n - k) / (k + 1) * p / (1 - p); } return Math.min(s, 1); };
export function sampleQuick(lot, aql) {
  const row = LET.find((r) => lot <= r[0]); const n = Math.min(row[2], Math.max(Math.round(lot), 1)); const p = aql / 100;
  let c = 0; while (c < n && binCdf(c, n, p) < 0.95) c++;
  const oc = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 10, 15].map((d) => ({ defectPct: d, accept: Math.round(binCdf(c, n, d / 100) * 1000) / 10 }));
  return { lot, letter: row[1], sample: n, aql, accept: c, reject: c + 1, oc, full: lot <= n };
}
