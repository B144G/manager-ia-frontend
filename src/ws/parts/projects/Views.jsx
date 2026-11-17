import { useMemo, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { deleteView, saveView, usePrefs } from '../../../lib/prefs.js';
import { useWs } from '../../WsContext.jsx';
import { Badge, Button, EmptyState, Form, Icon } from '../../ui.jsx';
import { dn, iso } from './Gantt.jsx';

/* Projets : filtres communs (avec vues enregistrées), tableau kanban (glisser-déposer), calendrier (mois), liste filtrable et triable. */

export const TS = { todo: 'À faire', doing: 'En cours', done: 'Terminé' };
export const PR = { low: 'Basse', normal: 'Normale', high: 'Haute' };
const NEXT = { todo: 'doing', doing: 'done', done: 'todo' };
const TONE = { todo: 'neutral', doing: 'brand', done: 'ok' };
const initials = (n) => (n || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

export const EMPTY_FILTER = { q: '', assignee: '', priority: '', status: '', late: false };
export function applyFilter(tasks, f, today) {
  const q = f.q.trim().toLowerCase();
  return tasks.filter((x) => (!q || (x.title + ' ' + (x.description || '') + ' ' + (x.assignee || '')).toLowerCase().includes(q))
    && (!f.assignee || (f.assignee === '_' ? !x.assigneeId : String(x.assigneeId) === f.assignee))
    && (!f.priority || x.priority === f.priority) && (!f.status || x.status === f.status)
    && (!f.late || (x.status !== 'done' && x.due && x.due < today)));
}

/** Barre de filtres + vues enregistrées (stockées dans le navigateur, par personne). */
export function Filters({ f, setF, tasks, viewKey = 'projects' }) {
  const t = useT();
  const { modal } = useWs();
  const p = usePrefs();
  const saved = p.views[viewKey] || [];
  const people = useMemo(() => { const m = new Map(); tasks.forEach((x) => { if (x.assigneeId) m.set(String(x.assigneeId), x.assignee); }); return [...m.entries()]; }, [tasks]);
  const set = (k, v) => setF({ ...f, [k]: v });
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY_FILTER);
  return (
    <div className="pf" role="search" aria-label={t('Filtrer les tâches')}>
      <div className="pf-q"><Icon name="search" /><input type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder={t('Rechercher une tâche…')} aria-label={t('Rechercher une tâche…')} /></div>
      <select value={f.assignee} onChange={(e) => set('assignee', e.target.value)} aria-label={t('Assignée à')}><option value="">{t('Toutes les personnes')}</option><option value="_">{t('Non assignée')}</option>{people.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
      <select value={f.priority} onChange={(e) => set('priority', e.target.value)} aria-label={t('Priorité')}><option value="">{t('Toutes les priorités')}</option>{Object.keys(PR).map((k) => <option key={k} value={k}>{t(PR[k])}</option>)}</select>
      <select value={f.status} onChange={(e) => set('status', e.target.value)} aria-label={t('Statut')}><option value="">{t('Tous les statuts')}</option>{Object.keys(TS).map((k) => <option key={k} value={k}>{t(TS[k])}</option>)}</select>
      <label className="pf-chk"><input type="checkbox" checked={f.late} onChange={(e) => set('late', e.target.checked)} />{t('En retard')}</label>
      <span className="grow" />
      {saved.length ? <select value="" onChange={(e) => { const v = saved.find((x) => x.name === e.target.value); if (v) setF({ ...EMPTY_FILTER, ...v.state }); }} aria-label={t('Vues enregistrées')}><option value="">{t('Vues enregistrées')}</option>{saved.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}</select> : null}
      {dirty ? <Button size="sm" icon="star-o" onClick={() => modal(t('Enregistrer la vue'), (close) => <Form fields={[{ k: 'name', label: t('Nom de la vue'), required: true, placeholder: t('Ex : Mes tâches en retard') }]} submitText={t('Enregistrer')} onSubmit={(v) => { saveView(viewKey, v.name.trim().slice(0, 40), f); close(); }} />)}>{t('Enregistrer la vue')}</Button> : null}
      {dirty ? <Button size="sm" variant="ghost" onClick={() => setF(EMPTY_FILTER)}>{t('Effacer')}</Button> : null}
      {saved.length ? <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer une vue enregistrée')} onClick={() => modal(t('Vues enregistrées'), (close) => <div>{saved.map((v) => <div className="line" key={v.id}><b>{v.name}</b><Button size="sm" variant="danger-outline" onClick={() => { deleteView(viewKey, v.name); close(); }}>{t('Supprimer')}</Button></div>)}</div>)} /> : null}
    </div>
  );
}

function Due({ x, today }) {
  const { dateFr } = useWs();
  const t = useT();
  if (!x.due) return <span className="muted small">{t('sans date')}</span>;
  const late = x.status !== 'done' && x.due < today;
  return <span className={'small' + (late ? ' late' : ' muted')}><Icon name="calendar" /> {dateFr(x.due)}</span>;
}

/* ----- Kanban ----- */
export function Kanban({ tasks, today, onMove, onOpen, onAdd }) {
  const t = useT();
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  return (
    <div className="kb">
      {['todo', 'doing', 'done'].map((s) => {
        const list = tasks.filter((x) => x.status === s);
        return (
          <section key={s} className={'kb-col' + (over === s ? ' over' : '')} aria-label={t(TS[s])}
            onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = Number(e.dataTransfer.getData('text/plain') || drag); const tk = tasks.find((x) => x.id === id); if (tk && tk.status !== s) onMove(tk, s); setDrag(null); }}>
            <header><span className={'gt-dot ' + s} /><h3>{t(TS[s])}</h3><Badge>{list.length}</Badge>{s === 'todo' && onAdd ? <Button size="sm" variant="ghost" iconOnly icon="plus" label={t('Ajouter une tâche')} onClick={onAdd} /> : null}</header>
            <div className="kb-list">
              {!list.length ? <p className="muted small kb-none">{t('Aucune tâche')}</p> : null}
              {list.map((x) => (
                <article key={x.id} className={'kb-card p-' + x.priority + (drag === x.id ? ' dragging' : '')} draggable onDragStart={(e) => { setDrag(x.id); e.dataTransfer.setData('text/plain', String(x.id)); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDrag(null); setOver(null); }}>
                  <button type="button" className="kb-t" onClick={() => onOpen(x)}>{x.title}</button>
                  {x.description ? <p className="small muted kb-d">{x.description}</p> : null}
                  <div className="kb-meta"><Due x={x} today={today} />{x.estimateHours ? <span className="small muted"><Icon name="clock" /> {x.estimateHours} h</span> : null}{x.dependsOn ? <span className="small muted" title={t('Dépend d\'une autre tâche')}><Icon name="link" /></span> : null}</div>
                  <div className="kb-foot">
                    <Badge tone={x.priority === 'high' ? 'danger' : x.priority === 'low' ? 'neutral' : 'info'}>{t(PR[x.priority])}</Badge>
                    <span className="grow" />
                    {x.assignee ? <span className="av" style={{ width: 26, height: 26, fontSize: 11 }} title={x.assignee}>{initials(x.assignee)}</span> : null}
                    <Button size="sm" variant="ghost" iconOnly icon={s === 'done' ? 'retry' : 'arrow-right'} label={t(s === 'todo' ? 'Démarrer' : s === 'doing' ? 'Terminer' : 'Rouvrir')} onClick={() => onMove(x, NEXT[s])} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ----- Calendrier ----- */
const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MN = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function CalendarView({ tasks, milestones, today, onOpen }) {
  const t = useT();
  const { dateFr } = useWs();
  const [m, setM] = useState(() => today.slice(0, 7));
  const [sel, setSel] = useState(today);
  const [y, mo] = m.split('-').map(Number);
  const first = dn(`${m}-01`); const start = first - ((new Date(first * 86400000).getUTCDay() + 6) % 7);
  const cells = Array.from({ length: 42 }, (_, i) => iso(start + i));
  const by = useMemo(() => { const r = {}; tasks.filter((x) => x.due).forEach((x) => { (r[x.due] = r[x.due] || []).push({ k: 't', x }); }); (milestones || []).filter((x) => x.due).forEach((x) => { (r[x.due] = r[x.due] || []).push({ k: 'm', x }); }); return r; }, [tasks, milestones]);
  const go = (d) => { const n = new Date(Date.UTC(y, mo - 1 + d, 1)); setM(n.toISOString().slice(0, 7)); };
  const chip = (e) => (e.k === 'm'
    ? <span key={'m' + e.x.id} className={'cal-chip ms' + (e.x.done ? ' done' : '')}><Icon name="milestone" /> {e.x.title}</span>
    : <button key={e.x.id} type="button" className={'cal-chip ' + (e.x.status === 'done' ? 'done' : e.x.due < today ? 'late' : e.x.status)} onClick={() => onOpen(e.x)}>{e.x.title}</button>);
  const list = by[sel] || [];
  return (
    <div className="cal">
      <div className="cal-h">
        <Button iconOnly icon="left" label={t('Mois précédent')} onClick={() => go(-1)} /><h3 aria-live="polite">{t(MN[mo - 1].charAt(0).toUpperCase() + MN[mo - 1].slice(1))} {y}</h3><Button iconOnly icon="right" label={t('Mois suivant')} onClick={() => go(1)} />
        <span className="grow" /><Button size="sm" onClick={() => { setM(today.slice(0, 7)); setSel(today); }}>{t("Aujourd'hui")}</Button>
      </div>
      <div className="cal-g" role="grid" aria-label={t('Calendrier des échéances')}>
        {DOW.map((d) => <div key={d} className="cal-dow" role="columnheader">{t(d)}</div>)}
        {cells.map((d) => {
          const ev = by[d] || []; const out = d.slice(0, 7) !== m;
          return (
            <div key={d} role="gridcell" className={'cal-c' + (out ? ' other' : '') + (d === today ? ' today' : '') + (d === sel ? ' sel' : '')} onClick={() => setSel(d)}>
              <button type="button" className="cal-n" onClick={() => setSel(d)} aria-label={dateFr(d) + (ev.length ? ', ' + t('{n} élément(s)', { n: ev.length }) : '')}>{Number(d.slice(8))}</button>
              <div className="cal-ev">{ev.slice(0, 3).map(chip)}{ev.length > 3 ? <span className="small muted">+{ev.length - 3}</span> : null}</div>
              {ev.length ? <span className="cal-dots" aria-hidden="true">{ev.slice(0, 4).map((e, i) => <i key={i} className={e.k === 'm' ? 'm' : e.x.status === 'done' ? 'd' : e.x.due < today ? 'l' : ''} />)}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="cal-day">
        <h4>{dateFr(sel)}</h4>
        {list.length ? <div className="cal-list">{list.map(chip)}</div> : <p className="muted small">{t('Rien à cette date.')}</p>}
      </div>
    </div>
  );
}

/* ----- Liste ----- */
export function ListView({ tasks, today, onOpen, onMove, projectName }) {
  const t = useT();
  const { dateFr } = useWs();
  const [sort, setSort] = useState({ k: 'due', d: 1 });
  const rank = { high: 0, normal: 1, low: 2 }; const srank = { doing: 0, todo: 1, done: 2 };
  const rows = useMemo(() => [...tasks].sort((a, b) => {
    const g = (x) => (sort.k === 'due' ? x.due || '9999' : sort.k === 'priority' ? rank[x.priority] : sort.k === 'status' ? srank[x.status] : sort.k === 'assignee' ? x.assignee || '~' : sort.k === 'est' ? -(x.estimateHours || 0) : x.title.toLowerCase());
    const A = g(a), B = g(b); return (A < B ? -1 : A > B ? 1 : 0) * sort.d;
  }), [tasks, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows.length) return <EmptyState icon="list" title={t('Aucune tâche ne correspond')}>{t('Changez les filtres ou ajoutez une tâche.')}</EmptyState>;
  const th = (k, label, cls) => <th scope="col" className={cls} aria-sort={sort.k === k ? (sort.d > 0 ? 'ascending' : 'descending') : 'none'}><button type="button" className="th-btn" onClick={() => setSort({ k, d: sort.k === k ? -sort.d : 1 })}>{label}{sort.k === k ? <Icon name={sort.d > 0 ? 'up' : 'down'} /> : null}</button></th>;
  return (
    <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={t('Liste des tâches')}>
      <table className="ui-table">
        <thead><tr>{th('title', t('Tâche'))}{projectName ? <th scope="col">{t('Projet')}</th> : null}{th('status', t('Statut'))}{th('assignee', t('Assignée à'))}{th('priority', t('Priorité'))}{th('due', t('Échéance'))}{th('est', t('Estim.'), 'r')}<th scope="col"><span className="sr-only">{t('Actions')}</span></th></tr></thead>
        <tbody>{rows.map((x) => (
          <tr key={x.id}>
            <td><button type="button" className="th-btn tl" onClick={() => onOpen(x)}>{x.title}</button></td>
            {projectName ? <td className="muted">{x.project || '—'}</td> : null}
            <td><Badge tone={TONE[x.status]} dot>{t(TS[x.status])}</Badge></td>
            <td>{x.assignee || <span className="muted">—</span>}</td>
            <td><Badge tone={x.priority === 'high' ? 'danger' : x.priority === 'low' ? 'neutral' : 'info'}>{t(PR[x.priority])}</Badge></td>
            <td className={x.status !== 'done' && x.due && x.due < today ? 'late' : ''}>{x.due ? dateFr(x.due) : '—'}</td>
            <td className="r num">{x.estimateHours ? x.estimateHours + ' h' : '—'}</td>
            <td className="r"><Button size="sm" variant="ghost" onClick={() => onMove(x, NEXT[x.status])}>{t(x.status === 'todo' ? 'Démarrer' : x.status === 'doing' ? 'Terminer' : 'Rouvrir')}</Button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
