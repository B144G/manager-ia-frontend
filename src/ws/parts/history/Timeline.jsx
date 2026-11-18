import { useMemo, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Button, EmptyState, Segmented } from '../../ui/index.jsx';
import { EventCard } from './Cards.jsx';
import { CATEGORY_IDS, frDate, useLabels } from './util.jsx';

/* Frise chronologique : bande horizontale (moments forts au-dessus de l'axe en vert, moments durs en dessous en rouge) puis les années, de la plus ancienne à la plus récente. */

function Filters({ f, setF, years }) {
  const t = useT();
  const L = useLabels();
  return (
    <div className="hst-bar">
      <input type="search" className="grow" aria-label={t('Rechercher')} placeholder={t('Rechercher un événement…')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      <select aria-label={t('Catégorie')} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
        <option value="">{t('Toutes les catégories')}</option>
        {CATEGORY_IDS.map((c) => <option key={c} value={c}>{L.cat[c]}</option>)}
      </select>
      <select aria-label={t('Année')} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}>
        <option value="">{t('Toutes les années')}</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
export function useFiltered(events, nature) {
  const [f, setF] = useState({ q: '', category: '', year: '' });
  const years = useMemo(() => [...new Set(events.map((e) => e.year))].sort((a, b) => a - b), [events]);
  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return events.filter((e) => (!nature || e.nature === nature) && (!f.category || e.category === f.category) && (!f.year || e.year === Number(f.year))
      && (!q || (e.title + ' ' + e.description + ' ' + e.place + ' ' + e.people.map((p) => p.name).join(' ')).toLowerCase().includes(q)));
  }, [events, nature, f]);
  return { f, setF, years, list };
}
export { Filters };

function Strip({ events }) {
  const t = useT();
  const L = useLabels();
  if (!events.length) return null;
  const ts = (d) => new Date(d + 'T00:00:00Z').getTime();
  const min = ts(events[0].date); const max = Math.max(ts(events[events.length - 1].date), min + 86400000 * 30);
  const W = Math.max(720, (new Date(max).getUTCFullYear() - new Date(min).getUTCFullYear() + 1) * 70);
  const x = (d) => 30 + ((ts(d) - min) / (max - min)) * (W - 60);
  const y0 = new Date(min).getUTCFullYear(); const y1 = new Date(max).getUTCFullYear();
  const step = Math.max(1, Math.ceil((y1 - y0 + 1) / Math.floor(W / 70)));
  const stack = { good: new Map(), bad: new Map() };
  const pos = events.map((e) => { // empile les points qui tombent au même endroit
    const k = Math.round(x(e.date) / 14); const m = stack[e.nature]; const n = m.get(k) || 0; m.set(k, n + 1);
    return { e, cx: x(e.date), n };
  });
  return (
    <div className="hst-strip">
      <div className="hst-legend"><span><i style={{ background: 'var(--ok)' }} />{L.nature.good}</span><span><i style={{ background: 'var(--danger)' }} />{L.nature.bad}</span></div>
      <svg role="img" aria-label={t('Frise : {n} événements, moments forts au-dessus de la ligne, moments durs en dessous.', { n: events.length })} width={W} height={190} viewBox={`0 0 ${W} 190`}>
        <line x1="20" x2={W - 20} y1="95" y2="95" stroke="var(--border-strong)" strokeWidth="3" strokeLinecap="round" />
        {Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).filter((y) => (y - y0) % step === 0).map((y) => {
          const xx = x(`${y}-01-01`);
          return <g key={y}><line x1={xx} x2={xx} y1="89" y2="101" stroke="var(--border-strong)" /><text x={xx} y="118" textAnchor="middle">{y}</text></g>;
        })}
        {pos.map(({ e, cx, n }) => {
          const good = e.nature === 'good';
          const cy = good ? 80 - n * 15 : 112 + n * 15;
          return (
            <a key={e.id} href={`#hst-ev-${e.id}`} onClick={(ev) => { ev.preventDefault(); const el = document.getElementById('hst-ev-' + e.id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); } }}>
              <title>{`${frDate(e.date)} — ${e.title} (${L.nature[e.nature]})`}</title>
              <line x1={cx} x2={cx} y1="95" y2={cy} stroke={good ? 'var(--ok)' : 'var(--danger)'} strokeOpacity=".35" />
              {good ? <circle cx={cx} cy={cy} r="6" fill="var(--ok)" /> : <rect x={cx - 6} y={cy - 6} width="12" height="12" rx="2" fill="var(--danger)" />}
            </a>
          );
        })}
      </svg>
    </div>
  );
}

export default function Timeline({ H }) {
  const t = useT();
  const { f, setF, years, list } = useFiltered(H.events, null);
  const [order, setOrder] = useState('asc');
  const byYear = useMemo(() => {
    const m = new Map();
    for (const e of list) { if (!m.has(e.year)) m.set(e.year, []); m.get(e.year).push(e); }
    const arr = [...m.entries()].sort((a, b) => (order === 'asc' ? a[0] - b[0] : b[0] - a[0]));
    return arr;
  }, [list, order]);
  return (
    <>
      <Filters f={f} setF={setF} years={years} />
      <div className="hst-bar">
        <Segmented label={t('Ordre')} value={order} onChange={setOrder} items={[{ id: 'asc', label: t('Du plus ancien'), icon: 'down' }, { id: 'desc', label: t('Du plus récent'), icon: 'up' }]} />
        {H.canEdit ? <Button variant="primary" icon="plus" onClick={() => H.editEvent(null)}>{t('Ajouter un événement')}</Button> : null}
      </div>
      {!H.events.length ? (
        <EmptyState icon="clock" title={t("L'histoire commence ici")} action={H.canEdit ? <Button variant="primary" icon="plus" onClick={() => H.editEvent(null, { category: 'creation', nature: 'good' })}>{t('Raconter la création de l’entreprise')}</Button> : null}>
          {t('Ajoutez la création, les recrutements, les contrats, les réussites… et aussi les épreuves : elles font partie de votre histoire.')}
        </EmptyState>
      ) : (
        <>
          <Strip events={list} />
          {byYear.length ? <div className="hst-rail">{byYear.map(([y, evs]) => (
            <section key={y} aria-label={String(y)}>
              <div className="hst-year" id={'hst-y-' + y}><h2>{y}</h2><span className="ui-badge hst-badge-good">{evs.filter((e) => e.nature === 'good').length} {t('forts')}</span><span className="ui-badge hst-badge-bad">{evs.filter((e) => e.nature === 'bad').length} {t('durs')}</span></div>
              {evs.map((e) => <div id={'hst-ev-' + e.id} key={e.id} tabIndex={-1} style={{ outline: 'none' }}><EventCard H={H} e={e} /></div>)}
            </section>
          ))}</div> : <p className="muted">{t('Aucun événement ne correspond à ces filtres.')}</p>}
        </>
      )}
    </>
  );
}
