import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Card, EmptyState, Icon, Loaded, Segmented, useLoad } from '../../ui.jsx';

/* Diagramme de Gantt : barres par tâche (début → fin), avancement, dépendances (flèches), jalons (losanges), aujourd'hui, échéance du projet,
   zoom jour / semaine / mois, charge par personne et par semaine. Données : GET /projects/:id/schedule. */

const DAY = 86400000;
export const dn = (d) => Math.round(Date.parse(d + 'T00:00:00Z') / DAY);
export const iso = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const ZOOM = { day: 30, week: 12, month: 4 };
const ROW = 38, LEFT = 248, HEAD = 52, CAP = 40; // hauteur de ligne, largeur de la colonne des noms, hauteur de l'en-tête, capacité hebdomadaire (h)
const PROG = { done: 1, doing: 0.5, todo: 0 };
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export default function Gantt({ id, rev, tasks: all, onOpen, ids }) {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/projects/' + id + '/schedule'), [id, rev]);
  const [zoom, setZoom] = useState(null);
  return (
    <Loaded state={st}>{(j) => <Chart j={j} zoom={zoom || (dn(j.to) - dn(j.from) <= 50 ? 'day' : dn(j.to) - dn(j.from) <= 220 ? 'week' : 'month')} setZoom={setZoom} onOpen={onOpen} ids={ids} t={t} dateFr={dateFr} all={all} />}</Loaded>
  );
}

function Chart({ j, zoom, setZoom, onOpen, ids, t, dateFr }) {
  const px = ZOOM[zoom];
  const box = useRef(null);
  const [cw, setCw] = useState(0);
  const scrolled = useRef(false);
  useEffect(() => { const el = box.current; if (!el || !window.ResizeObserver) return undefined; const ro = new ResizeObserver(() => setCw(el.clientWidth)); ro.observe(el); setCw(el.clientWidth); return () => ro.disconnect(); }, []);
  useEffect(() => { if (box.current && cw && !scrolled.current) { scrolled.current = true; box.current.scrollLeft = Math.max(0, LEFT + (dn(j.today) - (dn(j.from) - 3)) * px - cw / 3); } }, [cw]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => j.tasks.filter((x) => x.start && (!ids || ids.has(x.id))).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id)), [j, ids]);
  const unplanned = j.tasks.filter((x) => !x.start && (!ids || ids.has(x.id)));
  if (!rows.length) return <EmptyState icon="gantt" title={t('Rien à afficher dans le diagramme')}>{t('Donnez une date (et une estimation en heures) aux tâches pour les voir ici.')}</EmptyState>;
  const from = dn(j.from) - 3; let to = dn(j.to) + 5; to = Math.max(to, from + Math.ceil((cw - LEFT) / px)); const days = to - from + 1, W = days * px;
  const x = (d) => (dn(d) - from) * px;
  const idx = new Map(rows.map((r, i) => [r.id, i]));
  const top = (i) => HEAD + ROW * 2 + i * ROW; // 2 lignes réservées : résumé du projet + jalons
  const H = top(rows.length);
  // en-tête : mois (ligne 1), jours ou semaines (ligne 2)
  const months = [], ticks = [];
  for (let n = from; n <= to; n++) {
    const d = new Date(n * DAY); const first = d.getUTCDate() === 1 || n === from;
    if (first) months.push({ n, label: MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() });
    const monday = d.getUTCDay() === 1;
    if (zoom === 'day' || (zoom === 'week' && monday) || (zoom === 'month' && d.getUTCDate() === 1)) ticks.push({ n, label: zoom === 'month' ? MONTHS[d.getUTCMonth()] : String(d.getUTCDate()), we: d.getUTCDay() === 0 || d.getUTCDay() === 6 });
  }
  const weekends = zoom === 'day' ? Array.from({ length: days }, (_, i) => from + i).filter((n) => { const g = new Date(n * DAY).getUTCDay(); return g === 0 || g === 6; }) : [];
  const first = Math.min(...rows.map((r) => dn(r.start))), last = Math.max(...rows.map((r) => dn(r.end)));
  const donePct = Math.round(100 * rows.reduce((s, r) => s + PROG[r.status], 0) / rows.length);
  const bar = (r) => { const l = (dn(r.start) - from) * px, w = Math.max((dn(r.end) - dn(r.start) + 1) * px, 10); return { l, w }; };
  const deps = rows.filter((r) => r.dependsOn && idx.has(r.dependsOn));

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Segmented label={t('Échelle')} value={zoom} onChange={setZoom} items={[{ id: 'day', label: t('Jour') }, { id: 'week', label: t('Semaine') }, { id: 'month', label: t('Mois') }]} />
        <span className="gt-key" aria-hidden="true"><i className="k done" />{t('Terminée')}<i className="k doing" />{t('En cours')}<i className="k todo" />{t('À faire')}<i className="k late" />{t('En retard')}<i className="k ms" />{t('Jalon')}<i className="k td" />{t("Aujourd'hui")}<i className="k du" />{t('Échéance')}</span>
      </div>
      {j.forecast.conflicts ? <Alert tone="warn" title={t('{n} tâche(s) commencent avant la fin de celle dont elles dépendent.', { n: j.forecast.conflicts })}>{t('Barre pointillée : où elles seraient décalées.')}</Alert> : null}
      <div className="gt" ref={box} tabIndex={0} role="region" aria-label={t('Diagramme de Gantt')}>
        <div className="gt-in" style={{ width: LEFT + W, height: H + 8 }}>
          {/* en-tête */}
          <div className="gt-head" style={{ width: LEFT + W, height: HEAD }}>
            <div className="gt-corner" style={{ width: LEFT }}>{t('Tâche')}</div>
            <div className="gt-scale" style={{ width: W }}>
              {months.map((m) => <span key={m.n} className="gt-m" style={{ left: (m.n - from) * px }}>{m.label}</span>)}
              {ticks.map((k) => <span key={k.n} className={'gt-t' + (k.we ? ' we' : '')} style={{ left: (k.n - from) * px, width: zoom === 'day' ? px : undefined }}>{k.label}</span>)}
            </div>
          </div>
          {/* fond : week-ends, aujourd'hui, échéance */}
          <div className="gt-bg" style={{ left: LEFT, width: W, top: HEAD, height: H - HEAD }}>
            {weekends.map((n) => <i key={n} className="gt-we" style={{ left: (n - from) * px, width: px }} />)}
            {ticks.filter((k) => zoom !== 'day').map((k) => <i key={k.n} className="gt-gl" style={{ left: (k.n - from) * px }} />)}
            <i className="gt-today" style={{ left: x(j.today) + px / 2 }} title={t("Aujourd'hui")} />
            {j.project.due ? <i className="gt-due" style={{ left: x(j.project.due) + px }} title={t('Échéance du projet')} /> : null}
          </div>
          {/* ligne résumé du projet */}
          <div className="gt-row sum" style={{ top: HEAD, height: ROW }}>
            <div className="gt-name" style={{ width: LEFT }}><Icon name="projects" /><b className="gt-t1">{j.project.name}</b><Badge tone="brand">{donePct} %</Badge></div>
            <div className="gt-track" style={{ left: LEFT, width: W }}>
              <span className="gt-sum" style={{ left: (first - from) * px, width: (last - first + 1) * px }}><i style={{ width: donePct + '%' }} /></span>
            </div>
          </div>
          {/* jalons */}
          <div className="gt-row" style={{ top: HEAD + ROW, height: ROW }}>
            <div className="gt-name" style={{ width: LEFT }}><Icon name="milestone" /><span>{t('Jalons')}</span><small className="muted">{j.milestones.length}</small></div>
            <div className="gt-track" style={{ left: LEFT, width: W }}>
              {j.milestones.filter((m) => m.due).map((m) => (
                <span key={m.id} className={'gt-ms' + (m.done ? ' done' : m.due < j.today ? ' late' : '')} style={{ left: x(m.due) + px / 2 - 9 }} title={m.title + ' · ' + dateFr(m.due)} role="img" aria-label={m.title + ' ' + dateFr(m.due)} />
              ))}
            </div>
          </div>
          {/* tâches */}
          {rows.map((r, i) => {
            const b = bar(r); const state = r.status === 'done' ? 'done' : r.late ? 'late' : r.status === 'doing' ? 'doing' : 'todo';
            return (
              <div key={r.id} className="gt-row" style={{ top: top(i), height: ROW }}>
                <button type="button" className="gt-name btn-l" style={{ width: LEFT }} onClick={() => onOpen(r.id)} title={r.title}>
                  <span className={'gt-dot ' + state} /><span className="gt-t1">{r.title}</span>{r.assignee ? <small className="muted">{r.assignee.split(' ')[0]}</small> : null}
                </button>
                <div className="gt-track" style={{ left: LEFT, width: W }}>
                  <button type="button" className={'gt-bar ' + state} style={{ left: b.l, width: b.w }} onClick={() => onOpen(r.id)}
                    aria-label={`${r.title} : ${dateFr(r.start)} → ${dateFr(r.end)}${r.assignee ? ', ' + r.assignee : ''}`} title={`${r.title}\n${dateFr(r.start)} → ${dateFr(r.end)}${r.estimateHours ? '\n' + r.estimateHours + ' h' : ''}`}>
                    <i style={{ width: PROG[r.status] * 100 + '%' }} />{b.w > 70 ? <span>{r.title}</span> : null}
                  </button>
                  {r.needsShift ? <span className="gt-bar ghost" style={{ left: (dn(r.needsShift.toStart) - from) * px, width: Math.max((dn(r.needsShift.toEnd) - dn(r.needsShift.toStart) + 1) * px, 10) }} title={t('Nouvelle date proposée : {date}', { date: dateFr(r.needsShift.toEnd) })} /> : null}
                </div>
              </div>
            );
          })}
          {/* dépendances */}
          <svg className="gt-dep" style={{ left: LEFT, top: 0 }} width={W} height={H} aria-hidden="true">
            <defs><marker id="gt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--muted)" /></marker></defs>
            {deps.map((r) => {
              const p = rows[idx.get(r.dependsOn)]; const bp = bar(p), br = bar(r);
              const x1 = bp.l + bp.w, y1 = top(idx.get(p.id)) + ROW / 2, x2 = br.l, y2 = top(idx.get(r.id)) + ROW / 2;
              const mid = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 10));
              const d = x2 >= x1 + 14 ? `M${x1} ${y1} H${mid} V${y2} H${x2 - 1}` : `M${x1} ${y1} H${x1 + 8} V${y2 - ROW / 2 + 2} H${x2 - 8} V${y2} H${x2 - 1}`;
              return <path key={r.id} d={d} fill="none" stroke="var(--muted)" strokeWidth="1.5" markerEnd="url(#gt-arrow)" opacity=".75" />;
            })}
          </svg>
        </div>
      </div>
      {unplanned.length ? <p className="muted small" style={{ marginTop: 8 }}>{t('{n} tâche(s) sans date ne sont pas dans le diagramme : {names}.', { n: unplanned.length, names: unplanned.slice(0, 4).map((u) => u.title).join(', ') })}</p> : null}
      <Load rows={rows} t={t} dateFr={dateFr} />
    </>
  );
}

/** Charge : heures estimées par personne et par semaine (répartition égale sur la durée de la tâche) ; rouge au-dessus de 40 h. */
function Load({ rows, t, dateFr }) {
  const data = useMemo(() => {
    const weeks = new Map(), people = new Map();
    for (const r of rows) {
      if (r.status === 'done' || !r.estimateHours) continue;
      const a = dn(r.start), b = dn(r.end), n = b - a + 1, per = r.estimateHours / n;
      const who = r.assignee || t('Non assignée');
      for (let d = a; d <= b; d++) {
        const dow = (new Date(d * DAY).getUTCDay() + 6) % 7; const w = d - dow; // lundi de la semaine
        weeks.set(w, true);
        const m = people.get(who) || new Map(); m.set(w, (m.get(w) || 0) + per); people.set(who, m);
      }
    }
    return { weeks: [...weeks.keys()].sort((x, y) => x - y), people: [...people.entries()].sort((x, y) => x[0].localeCompare(y[0])) };
  }, [rows, t]);
  if (!data.people.length) return <Card title={t('Charge par personne')} className="gt-load"><p className="muted small">{t("Ajoutez une estimation en heures aux tâches pour voir la charge de chaque personne, semaine par semaine.")}</p></Card>;
  return (
    <Card title={t('Charge par personne')} subtitle={t('Heures estimées par semaine ; rouge au-dessus de {n} h.', { n: CAP })} className="gt-load">
      <div className="ui-table-wrap"><table className="ui-table gt-heat">
        <thead><tr><th scope="col">{t('Personne')}</th>{data.weeks.map((w) => <th key={w} scope="col" className="r">{dateFr(iso(w)).slice(0, 5)}</th>)}</tr></thead>
        <tbody>{data.people.map(([who, m]) => (
          <tr key={who}><th scope="row" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 'var(--fs-md)', color: 'var(--text)', position: 'static' }}>{who}</th>
            {data.weeks.map((w) => { const h = Math.round(m.get(w) || 0); const lvl = h > CAP ? 'over' : h > CAP * 0.75 ? 'high' : h ? 'ok' : ''; return <td key={w} className={'r heat ' + lvl}>{h || ''}</td>; })}
          </tr>
        ))}</tbody>
      </table></div>
    </Card>
  );
}
