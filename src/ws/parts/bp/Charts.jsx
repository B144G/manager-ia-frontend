import { useEffect, useRef, useState } from 'react';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import '../../../styles/ws-bp.css';

/* Graphiques SVG légers du pilotage Budget et Projets (aucune bibliothèque) : courbes, barres groupées ou empilées, jauge, anneau,
   Gantt, charge par semaine et matrice des risques. Chaque graphique : titre accessible (role="img" + aria-label), légende dès
   2 séries, info-bulle au survol / au toucher, tableau des valeurs dépliable (lecture sans couleur). Les couleurs viennent des
   variables CSS (thème clair et sombre). Un seul axe vertical par graphique. */

/** Largeur réelle du conteneur (pour garder des textes lisibles sur téléphone au lieu de réduire tout le dessin). */
function useWidth(def = 640) {
  const ref = useRef(null);
  const [w, setW] = useState(def);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const set = () => { const x = Math.round(el.getBoundingClientRect().width); if (x > 0) setW(x); };
    set();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Nombre court pour les axes : 1,2 M · 350 k. */
export function short(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '';
  try { return new Intl.NumberFormat(getLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch { return String(Math.round(n)); }
}
/** Borne « ronde » au-dessus du maximum, et pas des graduations. */
function nice(max, ticks = 4) {
  if (!(max > 0)) return { top: 1, step: 0.25 };
  const raw = max / ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  return { top: Math.ceil(max / step - 1e-9) * step, step };
}

export function Legend({ items }) {
  if (!items || items.length < 2) return null;
  return (
    <div className="bp-leg">
      {items.map((s) => <span key={s.key || s.label} className={'c-' + (s.color || 's1')}><i className={(s.dashed ? 'dash ' : s.line ? 'ln ' : '') + 'bg-' + (s.color || 's1')} aria-hidden="true" /><span style={{ color: 'var(--muted)' }}>{s.label}</span></span>)}
    </div>
  );
}

/** Tableau des valeurs (repli lisible sans couleur, et pour les lecteurs d'écran). */
export function DataTable({ labels, series, fmt }) {
  const t = useT();
  const f = fmt || ((v) => (v === null || v === undefined ? '—' : String(v)));
  return (
    <details>
      <summary>{t('Voir les valeurs')}</summary>
      <div className="bp-scroll">
        <table className="bp-table">
          <thead><tr><th>{''}</th>{series.map((s) => <th key={s.key || s.label}>{s.label}</th>)}</tr></thead>
          <tbody>{labels.map((l, i) => <tr key={l + i}><td>{l}</td>{series.map((s) => <td key={s.key || s.label} className="bp-num">{f(s.values[i])}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

function Tip({ x, y, w, title, rows, fmt }) {
  const left = Math.min(Math.max(x + 12, 0), Math.max(w - 200, 0));
  return (
    <div className="bp-tip" style={{ left, top: Math.max(y - 10, 0) }} role="status">
      <b>{title}</b>
      {rows.filter((r) => r.value !== null && r.value !== undefined).map((r) => <div key={r.label}><span><i className={'bg-' + (r.color || 's1')} aria-hidden="true" />{r.label}</span><span className="bp-num">{typeof r.value === 'string' ? r.value : fmt(r.value)}</span></div>)}
    </div>
  );
}

/**
 * Courbes sur un axe commun.
 * labels : textes de l'axe X ; series : [{ key, label, values (null = absent), color: 's1'|'s2'|'s3'|'plan', dashed, area }]
 * band : { low[], high[], label } (fourchette) ; marker : index de « aujourd'hui » ; fmt : format des valeurs ; unit : suffixe d'axe.
 */
export function LineChart({ title, labels, series, band, marker, fmt, height = 260, tickEvery }) {
  const t = useT();
  const [ref, W] = useWidth();
  const [hover, setHover] = useState(null);
  const H = height; const L = 54; const R = 12; const T = 14; const B = 30;
  const n = labels.length;
  const all = series.flatMap((s) => s.values).concat(band ? band.high : []).filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  const min = Math.min(0, ...all);
  const { top, step } = nice(Math.max(...all, 0) - min);
  const lo = min < 0 ? -nice(-min).top : 0;
  const span = top - (lo < 0 ? lo : 0) || 1;
  const x = (i) => L + (n <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / span);
  const path = (vals) => { let d = ''; let pen = false; vals.forEach((v, i) => { if (v === null || v === undefined) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; }); return d; };
  const grid = [];
  for (let g = lo; g <= top + 1e-9; g += step) grid.push(g);
  const every = tickEvery || Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - L) / 92))));
  const bandPath = band ? (() => { const idx = band.high.map((v, i) => (v === null || v === undefined ? null : i)).filter((i) => i !== null); if (!idx.length) return ''; return 'M' + idx.map((i) => x(i).toFixed(1) + ' ' + y(band.high[i]).toFixed(1)).join('L') + 'L' + idx.slice().reverse().map((i) => x(i).toFixed(1) + ' ' + y(band.low[i]).toFixed(1)).join('L') + 'Z'; })() : '';
  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (W / r.width);
    const i = Math.min(n - 1, Math.max(0, Math.round((px - L) / ((W - L - R) / Math.max(n - 1, 1)))));
    setHover({ i, px: x(i), py: (ev.clientY - r.top) });
  };
  const legend = series.map((s) => ({ key: s.key, label: s.label, color: s.color, dashed: s.dashed, line: true })).concat(band ? [{ key: 'band', label: band.label, color: 'band' }] : []);
  return (
    <div className="bp-chart" ref={ref}>
      <Legend items={legend} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={title}>
        <title>{title}</title>
        {grid.map((g) => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className={g === 0 ? 'base' : 'grid'} /><text x={L - 6} y={y(g) + 4} textAnchor="end" className="ax">{short(g)}</text></g>)}
        {labels.map((l, i) => (i % every === 0 || i === n - 1) && (i === n - 1 ? true : n - 1 - i >= every * 0.8) ? <text key={'x' + i} x={x(i)} y={H - 10} textAnchor="middle" className="ax">{l}</text> : null)}
        {bandPath ? <path d={bandPath} className="bp-band" /> : null}
        {marker !== undefined && marker !== null && marker >= 0 && marker < n ? <g><line x1={x(marker)} x2={x(marker)} y1={T} y2={H - B} className="today" /><text x={x(marker) + 4} y={T + 10} className="today-t">{t("aujourd'hui")}</text></g> : null}
        {series.map((s) => (s.area ? <path key={s.key + 'a'} d={path(s.values) + (() => { const idx = s.values.map((v, i) => (v === null || v === undefined ? null : i)).filter((i) => i !== null); return idx.length ? `L${x(idx[idx.length - 1])} ${y(lo < 0 ? 0 : lo)}L${x(idx[0])} ${y(lo < 0 ? 0 : lo)}Z` : ''; })()} className={'f-' + s.color} opacity="0.12" /> : null))}
        {series.map((s) => <path key={s.key} d={path(s.values)} fill="none" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '6 5' : undefined} className={'st-' + (s.color || 's1')} />)}
        {hover ? <line x1={hover.px} x2={hover.px} y1={T} y2={H - B} className="cross" /> : null}
        {hover ? series.map((s) => (s.values[hover.i] === null || s.values[hover.i] === undefined ? null : <circle key={s.key + 'h'} cx={x(hover.i)} cy={y(s.values[hover.i])} r="4.5" className={'f-' + (s.color || 's1')} stroke="var(--surface)" strokeWidth="2" />)) : null}
        <rect x={L} y={T} width={Math.max(W - L - R, 1)} height={H - T - B} className="hit" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchStart={(e) => onMove(e.touches[0] ? { ...e.touches[0], currentTarget: e.currentTarget } : e)} />
      </svg>
      {hover ? <Tip x={hover.px} y={hover.py} w={W} title={labels[hover.i]} fmt={fmt || short} rows={series.map((s) => ({ label: s.label, value: s.values[hover.i], color: s.color })).concat(band && band.high[hover.i] !== null && band.high[hover.i] !== undefined ? [{ label: band.label, value: (fmt || short)(band.low[hover.i]) + ' – ' + (fmt || short)(band.high[hover.i]), color: 'band' }] : [])} /> : null}
      <DataTable labels={labels} series={series.concat(band ? [{ key: 'lo', label: band.label + ' (−)', values: band.low }, { key: 'hi', label: band.label + ' (+)', values: band.high }] : [])} fmt={fmt} />
    </div>
  );
}

/**
 * Barres par période (groupées, ou empilées quand plusieurs séries ont le même `stack`) + courbes superposées sur le même axe.
 * bars : [{ key, label, values, color, stack }] ; lines : [{ key, label, values, color, dashed }].
 */
export function BarChart({ title, labels, bars, lines = [], fmt, height = 260, onPick }) {
  const t = useT();
  const [ref, W] = useWidth();
  const [hover, setHover] = useState(null);
  const H = height; const L = 54; const R = 10; const T = 14; const B = 30;
  const n = labels.length;
  const stacks = [];
  for (const b of bars) { const k = b.stack || b.key; if (!stacks.includes(k)) stacks.push(k); }
  const stackTotal = (k, i) => bars.filter((b) => (b.stack || b.key) === k).reduce((a, b) => a + Math.max(0, Number(b.values[i]) || 0), 0);
  const maxV = Math.max(0, ...labels.map((_, i) => Math.max(...stacks.map((k) => stackTotal(k, i)))), ...lines.flatMap((l) => l.values.filter((v) => v !== null && v !== undefined)));
  const { top, step } = nice(maxV);
  const cw = (W - L - R) / Math.max(n, 1);
  const gap = Math.min(10, cw * 0.18);
  const bw = Math.min(56, Math.max(3, (cw - gap * 2) / stacks.length - 2));
  const pad = (cw - gap * 2 - stacks.length * (bw + 2) + 2) / 2; // barres centrées quand elles sont plafonnées
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const grid = []; for (let g = 0; g <= top + 1e-9; g += step) grid.push(g);
  const cx = (i) => L + cw * i + cw / 2;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - L) / 44))));
  const f = fmt || short;
  const legend = bars.map((b) => ({ key: b.key, label: b.label, color: b.color })).concat(lines.map((l) => ({ key: l.key, label: l.label, color: l.color, dashed: l.dashed, line: true })));
  if (!(maxV > 0)) return <div className="bp-chart" ref={ref}><Legend items={legend} /><p className="ws-empty" role="img" aria-label={title}>{t('Aucune valeur à afficher.')}</p></div>;
  return (
    <div className="bp-chart" ref={ref}>
      <Legend items={legend} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={title}>
        <title>{title}</title>
        {grid.map((g) => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className={g === 0 ? 'base' : 'grid'} /><text x={L - 6} y={y(g) + 4} textAnchor="end" className="ax">{short(g)}</text></g>)}
        {labels.map((l, i) => {
          const x0 = L + cw * i + gap;
          return (
            <g key={l + i}>
              {stacks.map((k, si) => {
                let acc = 0;
                return bars.filter((b) => (b.stack || b.key) === k).map((b) => {
                  const v = Math.max(0, Number(b.values[i]) || 0);
                  if (!v) return null;
                  const y1 = y(acc + v); const h = y(acc) - y1; acc += v;
                  return <rect key={b.key} x={x0 + pad + si * (bw + 2)} y={y1} width={bw} height={Math.max(h, 1)} rx={Math.min(4, bw / 3)} className={'bp-bar f-' + (b.color || 's1')} />;
                });
              })}
              {i % every === 0 ? <text x={cx(i)} y={H - 10} textAnchor="middle" className="ax">{l}</text> : null}
            </g>
          );
        })}
        {lines.map((ln) => {
          let d = ''; let pen = false;
          ln.values.forEach((v, i) => { if (v === null || v === undefined) { pen = false; return; } d += (pen ? 'L' : 'M') + cx(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
          return <g key={ln.key}><path d={d} fill="none" strokeWidth="2.2" strokeDasharray={ln.dashed ? '6 5' : undefined} strokeLinejoin="round" className={'st-' + ln.color} />{ln.values.map((v, i) => (v === null || v === undefined ? null : <circle key={i} cx={cx(i)} cy={y(v)} r="3" className={'f-' + ln.color} stroke="var(--surface)" strokeWidth="1.5" />))}</g>;
        })}
        {labels.map((l, i) => <rect key={'h' + i} x={L + cw * i} y={T} width={cw} height={H - T - B} className="hit" style={{ cursor: onPick ? 'pointer' : 'crosshair' }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} onClick={onPick ? () => onPick(i) : undefined}><title>{l}</title></rect>)}
      </svg>
      {hover !== null ? <Tip x={cx(hover)} y={20} w={W} title={labels[hover]} fmt={f} rows={bars.map((b) => ({ label: b.label, value: b.values[hover], color: b.color })).concat(lines.map((l) => ({ label: l.label, value: l.values[hover], color: l.color })))} /> : null}
      <DataTable labels={labels} series={bars.concat(lines)} fmt={fmt} />
    </div>
  );
}

/** Jauge demi-cercle (0 à 100 %, au-delà affiché « plein ») avec la valeur et une légende. tone : '' | 'warn' | 'bad'. */
export function Gauge({ value, label, sub, tone = '' }) {
  const v = Math.max(0, Math.min(Number(value) || 0, 100));
  const R = 80; const C = Math.PI * R;
  return (
    <div className="bp-gauge">
      <svg viewBox="0 0 200 112" role="img" aria-label={`${label} : ${value === null || value === undefined ? '—' : Math.round(value) + ' %'}`}>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" strokeWidth="16" strokeLinecap="round" className="trk" />
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" strokeWidth="16" strokeLinecap="round" className={'val ' + tone} strokeDasharray={`${(C * v / 100).toFixed(1)} ${C.toFixed(1)}`} />
      </svg>
      <b className="bp-num">{value === null || value === undefined ? '—' : `${Math.round(value)} %`}</b>
      <small>{label}{sub ? <><br />{sub}</> : null}</small>
    </div>
  );
}

/** Anneau de répartition (≤ 3 parts colorées + « autres »), légende avec valeurs. */
export function Donut({ title, items, fmt }) {
  const total = items.reduce((a, x) => a + Math.max(0, x.value), 0);
  const R = 52; const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={title}>
        <title>{title}</title>
        <circle cx="70" cy="70" r={R} fill="none" strokeWidth="20" stroke="var(--surface2)" />
        {total > 0 ? items.map((x) => { const len = C * Math.max(0, x.value) / total; const el = <circle key={x.label} cx="70" cy="70" r={R} fill="none" strokeWidth="20" className={'st-' + x.color} strokeDasharray={`${Math.max(len - 2, 0)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />; acc += len; return el; }) : null}
      </svg>
      <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
        {items.map((x) => <span key={x.label}><i className={'bg-' + x.color} style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, marginRight: 6, verticalAlign: -1 }} aria-hidden="true" />{x.label} : <b className="bp-num">{(fmt || short)(x.value)}</b>{total ? ` (${Math.round(x.value * 100 / total)} %)` : ''}</span>)}
      </div>
    </div>
  );
}

const DAY = 86400000;
const dn = (d) => Math.round(Date.parse(d + 'T00:00:00Z') / DAY);

/**
 * Gantt : une ligne par tâche (barre = dates actuelles, remplissage = avancement, trait gris = plan de référence), tâches critiques
 * en couleur 2 avec contour, jalons en losange, trait « aujourd'hui ». rows : [{ id, title, sub, start, end, baselineStart, baselineEnd,
 * progress, critical, done }] ; milestones : [{ id, title, due, done, late }].
 */
export function Gantt({ title, rows, milestones = [], today, dateFr }) {
  const t = useT();
  const dates = rows.flatMap((r) => [r.start, r.end, r.baselineStart, r.baselineEnd]).concat(milestones.map((m) => m.due), [today]).filter(Boolean);
  if (!dates.length) return null;
  const from = dn(dates.reduce((a, b) => (a < b ? a : b))) - 1; const to = dn(dates.reduce((a, b) => (a > b ? a : b))) + 2;
  const span = Math.max(to - from, 1);
  const pos = (d) => ((dn(d) - from) / span) * 100;
  const wid = (s, e) => Math.max(((dn(e) - dn(s) + 1) / span) * 100, 0.8);
  const ticks = [];
  const stepDays = Math.max(1, Math.ceil(span / 6));
  for (let k = 0; k <= span; k += stepDays) ticks.push(new Date((from + k) * DAY).toISOString().slice(0, 10));
  return (
    <div className="bp-scroll" role="figure" aria-label={title}>
      <div className="bp-gantt">
        <div className="gl" />
        <div className="gh" aria-hidden="true">{ticks.map((d) => <span key={d} style={{ left: pos(d) + '%' }}>{dateFr(d)}</span>)}</div>
        {rows.map((r) => (
          <div key={r.id} style={{ display: 'contents' }}>
            <div className="gl" title={r.title}><span>{r.critical ? '◆ ' : ''}{r.title}</span>{r.sub ? <small>{r.sub}</small> : null}</div>
            <div className="gr">
              {r.baselineStart && r.baselineEnd ? <span className="gbase" style={{ left: pos(r.baselineStart) + '%', width: wid(r.baselineStart, r.baselineEnd) + '%' }} title={t('Plan de référence : {a} → {b}', { a: dateFr(r.baselineStart), b: dateFr(r.baselineEnd) })} /> : null}
              {r.start && r.end ? (
                <span className={'gb' + (r.critical ? ' crit' : '') + (r.done ? ' done' : '')} style={{ left: pos(r.start) + '%', width: wid(r.start, r.end) + '%' }} title={`${r.title} · ${dateFr(r.start)} → ${dateFr(r.end)} · ${r.progress || 0} %`}>
                  <i style={{ width: (r.progress || 0) + '%' }} />
                </span>
              ) : <small className="muted" style={{ position: 'absolute', top: 9, left: 4 }}>{t('sans date')}</small>}
              {today ? <span className="gtoday" style={{ left: pos(today) + '%' }} aria-hidden="true" /> : null}
            </div>
          </div>
        ))}
        {milestones.filter((m) => m.due).map((m) => (
          <div key={'m' + m.id} style={{ display: 'contents' }}>
            <div className="gl"><span>{'◇ ' + m.title}</span><small>{dateFr(m.due) + (m.done ? ' · ' + t('atteint') : m.late ? ' · ' + t('en retard') : '')}</small></div>
            <div className="gr"><span className={'gms' + (m.done ? ' done' : m.late ? ' late' : '')} style={{ left: pos(m.due) + '%' }} title={m.title} />{today ? <span className="gtoday" style={{ left: pos(today) + '%' }} aria-hidden="true" /> : null}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matrice des risques 5 × 5 (probabilité en lignes, de 5 en haut à 1, impact en colonnes de 1 à 5) : nombre de risques ouverts. */
export function RiskMatrix({ matrix }) {
  const t = useT();
  const lvl = (p, i) => (p * i >= 15 ? 'high' : p * i >= 8 ? 'medium' : 'low');
  return (
    <div role="table" aria-label={t('Matrice des risques : probabilité × impact')}>
      <div className="bp-matrix">
        {matrix.map((row, r) => [
          <div key={'l' + r} className="ml" role="rowheader">{5 - r}</div>,
          ...row.map((c, j) => <div key={r + '-' + j} role="cell" className={'mc ' + lvl(5 - r, j + 1)} title={t('Probabilité {p} × impact {i} = {s}', { p: 5 - r, i: j + 1, s: (5 - r) * (j + 1) })}>{c || ''}</div>),
        ])}
        <div />
        {[1, 2, 3, 4, 5].map((i) => <div key={'i' + i} className="ml">{i}</div>)}
      </div>
      <p className="muted small" style={{ marginTop: 6 }}>{t('Lignes : probabilité (5 = presque sûr). Colonnes : impact (5 = très grave).')}</p>
    </div>
  );
}
