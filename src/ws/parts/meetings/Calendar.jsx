import { useMemo, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { getLocale } from '../../../lib/i18n.jsx';
import { Failed } from './Failed.jsx';
import { Badge, Button, Card, EmptyState, Segmented, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { DateTile, StatusBadges, TypeDot, addDays, fmtDay, fmtShort, iso, mondayOf, parseDay, todayLocal, useLabels, TYPE_IDS, useMtg } from './common.jsx';

/* Calendrier des réunions : mois, semaine ou liste. Sur téléphone, le mois montre des points et le détail du jour sélectionné s'affiche dessous. */

function range(view, cursor) {
  if (view === 'week') { const from = mondayOf(cursor); return { from, to: addDays(from, 6) }; }
  if (view === 'month') { const d = parseDay(cursor); const first = iso(new Date(d.getFullYear(), d.getMonth(), 1)); const from = mondayOf(first); return { from, to: addDays(from, 41) }; }
  return { from: null, to: null };
}

function Row({ m, open }) {
  const L = useLabels();
  return (
    <button type="button" className="mtg-item" onClick={() => open(m.id)}>
      <DateTile date={m.date} />
      <span><b>{m.title}</b><small><TypeDot type={m.type} /> {L.types[m.type]} · {fmtShort(m.date)} · {m.time}–{m.endTime}{m.place ? ' · ' + m.place : ''}</small></span>
      <span className="mtg-row"><StatusBadges m={m} /></span>
    </button>
  );
}

export default function CalendarView({ openMeeting, newOn, canConvene }) {
  const t = useT();
  const L = useLabels();
  const { oapi } = useMtg();
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(todayLocal());
  const [sel, setSel] = useState(todayLocal());
  const [type, setType] = useState('');
  const [mine, setMine] = useState(false);
  const [when, setWhen] = useState('upcoming');
  const r = range(view, cursor);
  const q = new URLSearchParams();
  if (r.from) { q.set('from', r.from); q.set('to', r.to); }
  if (type) q.set('type', type);
  if (mine) q.set('mine', '1');
  const st = useLoad(() => oapi('GET', '/meetings?' + q.toString()), [view, r.from, type, mine]);
  const all = (st.data && st.data.meetings) || [];
  const byDay = useMemo(() => { const m = {}; for (const x of all) (m[x.date] = m[x.date] || []).push(x); return m; }, [all]);
  const today = todayLocal();
  const step = (n) => {
    const d = parseDay(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + n, 1); else d.setDate(d.getDate() + 7 * n);
    setCursor(iso(d));
  };
  const goToday = () => { setCursor(today); setSel(today); };
  const dow = Array.from({ length: 7 }, (_, i) => parseDay(addDays(mondayOf(today), i)).toLocaleDateString(getLocale(), { weekday: 'short' }));
  const title = view === 'week' ? `${fmtShort(r.from)} – ${fmtShort(r.to)}` : parseDay(cursor).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
  const curMonth = parseDay(cursor).getMonth();

  const list = view === 'list' ? all.filter((m) => (when === 'upcoming' ? m.date >= today : m.date < today)).sort((a, b) => (when === 'upcoming' ? (a.date + a.time).localeCompare(b.date + b.time) : (b.date + b.time).localeCompare(a.date + a.time))) : [];
  const groups = []; for (const m of list) { const g = groups[groups.length - 1]; if (g && g.date === m.date) g.items.push(m); else groups.push({ date: m.date, items: [m] }); }

  const dayCell = (date) => {
    const items = byDay[date] || [];
    const d = parseDay(date);
    return (
      <button key={date} type="button" className={'mtg-day' + (d.getMonth() !== curMonth ? ' out' : '') + (date === today ? ' today' : '') + (date === sel ? ' sel' : '')}
        onClick={() => setSel(date)} aria-label={fmtDay(date) + (items.length ? ' — ' + t('{n} réunion(s)', { n: items.length }) : '')} aria-pressed={date === sel}>
        <span className="mtg-dnum">{d.getDate()}</span>
        {items.slice(0, 2).map((m) => <span key={m.id} className={'mtg-chip t-' + m.type + (m.status === 'cancelled' ? ' cancelled' : '')}><i />{m.time} {m.title}</span>)}
        {items.length > 2 ? <span className="mtg-more">+{items.length - 2}</span> : null}
        {items.length ? <span className="mtg-dots">{items.slice(0, 3).map((m) => <span key={m.id} className={'mtg-dot t-' + m.type} />)}</span> : null}
      </button>
    );
  };

  return (
    <div className="mtg">
      <div className="mtg-cal-h">
        <Segmented label={t('Affichage')} value={view} onChange={setView} items={[{ id: 'month', label: t('Mois'), icon: 'calendar-days' }, { id: 'week', label: t('Semaine'), icon: 'table-columns' }, { id: 'list', label: t('Liste'), icon: 'list' }]} />
        {view !== 'list' ? (
          <div className="mtg-row">
            <Button size="sm" iconOnly label={t('Précédent')} icon="chevron-left" onClick={() => step(-1)} />
            <b className="mtg-cal-title">{title}</b>
            <Button size="sm" iconOnly label={t('Suivant')} icon="chevron-right" onClick={() => step(1)} />
            <Button size="sm" onClick={goToday}>{t("Aujourd'hui")}</Button>
          </div>
        ) : <Segmented label={t('Période')} value={when} onChange={setWhen} items={[{ id: 'upcoming', label: t('À venir') }, { id: 'past', label: t('Passées') }]} />}
        {canConvene ? <Button variant="primary" icon="plus" onClick={() => newOn(view === 'list' ? today : sel)}>{t('Nouvelle réunion')}</Button> : null}
      </div>
      <div className="mtg-row">
        <select aria-label={t('Type de réunion')} value={type} onChange={(e) => setType(e.target.value)} style={{ width: 'auto' }}>
          <option value="">{t('Tous les types')}</option>
          {TYPE_IDS.map((x) => <option key={x} value={x}>{L.types[x]}</option>)}
        </select>
        <label className="mtg-check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{t('Seulement mes réunions')}</label>
      </div>

      {st.error ? <Failed e={st.error} /> : null}
      {st.loading && !st.data ? <Skeleton lines={8} /> : null}

      {st.data && view === 'month' ? (
        <>
          <div className="mtg-month" role="grid" aria-label={title}>
            {dow.map((d) => <div key={d} className="mtg-dow" role="columnheader">{d}</div>)}
            {Array.from({ length: 42 }, (_, i) => dayCell(addDays(r.from, i)))}
          </div>
          <Card title={fmtDay(sel)} actions={canConvene ? <Button size="sm" icon="plus" onClick={() => newOn(sel)}>{t('Ajouter')}</Button> : null}>
            {(byDay[sel] || []).length ? <ul className="mtg-list">{byDay[sel].map((m) => <li key={m.id}><Row m={m} open={openMeeting} /></li>)}</ul> : <p className="mtg-muted">{t('Aucune réunion ce jour-là.')}</p>}
          </Card>
        </>
      ) : null}

      {st.data && view === 'week' ? (
        <div className="mtg-week">
          {Array.from({ length: 7 }, (_, i) => addDays(r.from, i)).map((date) => (
            <div key={date} className={'mtg-wcol' + (date === today ? ' today' : '')}>
              <h3>{fmtShort(date)}</h3>
              {(byDay[date] || []).map((m) => (
                <button key={m.id} type="button" className={'mtg-card-mini t-' + m.type} onClick={() => openMeeting(m.id)}>
                  <b>{m.title}</b><small>{m.time}–{m.endTime}{m.place ? ' · ' + m.place : ''}</small>
                  <span className="mtg-row">{m.status === 'cancelled' ? <Badge tone="danger">{L.status.cancelled}</Badge> : m.myResponse ? <Badge tone={m.myResponse === 'present' ? 'ok' : m.myResponse === 'pending' ? 'warn' : 'neutral'}>{L.resp[m.myResponse]}</Badge> : null}</span>
                </button>
              ))}
              {!(byDay[date] || []).length ? <small className="mtg-muted">—</small> : null}
            </div>
          ))}
        </div>
      ) : null}

      {st.data && view === 'list' ? (
        groups.length ? groups.map((g) => (
          <div className="mtg-sec" key={g.date}>
            <h3>{fmtDay(g.date)}</h3>
            <ul className="mtg-list">{g.items.map((m) => <li key={m.id}><Row m={m} open={openMeeting} /></li>)}</ul>
          </div>
        )) : <EmptyState icon="calendar" title={when === 'upcoming' ? t('Aucune réunion à venir') : t('Aucune réunion passée')}>{canConvene ? t('Convoquez une réunion pour la voir ici.') : ''}</EmptyState>
      ) : null}
    </div>
  );
}
