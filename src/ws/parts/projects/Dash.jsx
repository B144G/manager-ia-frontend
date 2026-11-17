import { useMemo } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Badge, Card, ChartFrame, EmptyState, Icon, Stat, useLoad } from '../../ui.jsx';
import { Donut, HBars } from '../../charts/lazy.jsx';
import { Insight } from './Planning.jsx';
import { TS } from './Views.jsx';

/* Projets : tableau de bord d'un projet (avancement, retards, jalons, budget, charge) et vue d'ensemble de tous les projets. */

const STATUS_COLOR = { todo: 'var(--c8)', doing: 'var(--c1)', done: 'var(--ok)' };

export function ProjectDashboard({ id, tasks, today, rev }) {
  const t = useT();
  const { oapi, can, money, dateFr } = useWs();
  const sum = useLoad(() => oapi('GET', '/projects/' + id + '/summary'), [id, rev]);
  const insight = useLoad(() => (can('manager') ? oapi('GET', '/projects/' + id + '/insight') : Promise.resolve(null)), [id, rev]);
  const total = tasks.length, done = tasks.filter((x) => x.status === 'done').length;
  const open = tasks.filter((x) => x.status !== 'done');
  const late = open.filter((x) => x.due && x.due < today);
  const pct = total ? Math.round(100 * done / total) : 0;
  const byStatus = ['todo', 'doing', 'done'].map((s) => ({ name: t(TS[s]), value: tasks.filter((x) => x.status === s).length, color: STATUS_COLOR[s] })).filter((d) => d.value);
  const byPerson = useMemo(() => {
    const m = new Map();
    open.forEach((x) => { const k = x.assignee || t('Non assignée'); const r = m.get(k) || { name: k.split(' ').slice(0, 2).join(' '), value: 0, late: 0 }; r.value += 1; if (x.due && x.due < today) r.late += 1; m.set(k, r); });
    return [...m.values()].sort((a, b) => b.value - a.value).slice(0, 8).map((r) => ({ ...r, color: r.late ? 'var(--danger)' : 'var(--c1)' }));
  }, [open, today, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = sum.data, ins = insight.data;
  const cost = s && s.cost;
  const upcoming = [...open].filter((x) => x.due).sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 6);
  const ms = s ? s.milestones : [];
  const msDone = ms.filter((m) => m.done).length;
  return (
    <>
      <div className="ui-stats">
        <Stat icon="target" label={t('Avancement')} value={pct + ' %'} sub={t('{done}/{total} tâches', { done, total })} tone="brand" />
        <Stat icon="warn" label={t('Tâches en retard')} value={late.length} sub={late.length ? t('à traiter en priorité') : t('rien en retard')} subTone={late.length ? 'down' : 'up'} tone={late.length ? 'danger' : 'ok'} />
        <Stat icon="milestone" label={t('Jalons atteints')} value={ms.length ? msDone + ' / ' + ms.length : '—'} sub={ms.some((m) => m.late) ? t('un jalon est en retard') : undefined} subTone="down" tone="brand" />
        {ins ? <Stat icon="calendar" label={t('Fin prévue')} value={ins.forecast.endDate ? dateFr(ins.forecast.endDate) : '—'} sub={ins.forecast.lateDays ? '+' + t('{n} j', { n: ins.forecast.lateDays }) : t('dans les temps')} subTone={ins.forecast.lateDays ? 'down' : 'up'} tone={ins.forecast.lateDays ? 'danger' : 'ok'} /> : null}
        {cost && cost.budget ? <Stat icon="wallet" label={t('Budget consommé')} value={cost.usedPct + ' %'} sub={money(cost.spent) + ' / ' + money(cost.budget)} subTone={cost.overBudget ? 'down' : undefined} tone={cost.overBudget ? 'danger' : cost.usedPct >= (cost.alertPct || 80) ? 'warn' : 'ok'} /> : null}
        {s ? <Stat icon="clock" label={t('Temps passé')} value={s.time.hours + ' h'} sub={s.time.estimatedHours ? t('sur {n} h estimées', { n: s.time.estimatedHours }) : undefined} tone="brand" /> : null}
      </div>
      <div className="pd-grid">
        <ChartFrame title={t('Statut des tâches')} summary={byStatus.map((d) => d.name + ' ' + d.value).join(', ')} height={240} legend={byStatus.map((d) => ({ label: d.name + ' (' + d.value + ')', color: d.color }))}>
          {total ? <Donut data={byStatus} center={pct + ' %'} sub={t('terminé')} /> : <EmptyState icon="list" title={t('Aucune tâche')} />}
        </ChartFrame>
        <ChartFrame title={t('Tâches ouvertes par personne')} subtitle={t('Rouge : au moins une tâche en retard')} summary={byPerson.map((d) => d.name + ' ' + d.value).join(', ')} height={240}>
          {byPerson.length ? <HBars data={byPerson} valueLabel={t('Tâches ouvertes')} /> : <EmptyState icon="ok" title={t('Rien à faire')} />}
        </ChartFrame>
        {cost ? (
          <ChartFrame title={t('Budget du projet')} subtitle={cost.budget ? t('{n} % consommé', { n: cost.usedPct }) : t('Aucun budget fixé')} height={240}
            summary={t('Dépensé {a}, reste {b}', { a: money(cost.spent), b: cost.remaining === null ? '—' : money(cost.remaining) })}
            legend={cost.budget ? [{ label: t('Dépenses') + ' ' + money(cost.expenses), color: 'var(--c1)' }, { label: t('Temps') + ' ' + money(cost.timeCost), color: 'var(--c3)' }, { label: t('Reste') + ' ' + money(Math.max(cost.remaining || 0, 0)), color: 'var(--surface-3)' }] : null}>
            {cost.budget ? <Donut data={[{ name: t('Dépenses'), value: cost.expenses, color: 'var(--c1)' }, { name: t('Temps'), value: cost.timeCost, color: 'var(--c3)' }, { name: t('Reste'), value: Math.max(cost.remaining || 0, 0), color: 'var(--surface-3)' }].filter((d) => d.value > 0)} fmt={money} center={cost.usedPct + ' %'} sub={t('du budget')} />
              : <EmptyState icon="wallet" title={t('Fixez un budget')}>{t("Onglet « Suivi » : budget, dépenses et temps passé apparaîtront ici.")}</EmptyState>}
          </ChartFrame>
        ) : null}
      </div>
      <div className="pd-grid two">
        <Card title={t('Prochaines échéances')}>
          {!upcoming.length ? <p className="muted">{t('Aucune tâche datée à venir.')}</p> : upcoming.map((x) => (
            <div className="line" key={x.id}><span><b>{x.title}</b><br /><small className="muted">{x.assignee || t('Non assignée')}</small></span><Badge tone={x.due < today ? 'danger' : 'neutral'}><Icon name="calendar" /> {dateFr(x.due)}</Badge></div>
          ))}
        </Card>
        <Card title={t('Jalons')}>
          {!ms.length ? <p className="muted">{t('Aucun jalon.')}</p> : ms.map((m) => (
            <div className="line" key={m.id}><span><Icon name="milestone" /> <b>{m.title}</b></span><span className="row"><small className="muted">{m.due ? dateFr(m.due) : t('sans date')}</small>{m.done ? <Badge tone="ok">{t('Atteint')}</Badge> : m.late ? <Badge tone="danger">{t('En retard')}</Badge> : <Badge>{t('À venir')}</Badge>}</span></div>
          ))}
        </Card>
      </div>
      {can('manager') ? <Insight id={id} rev={rev} /> : null}
    </>
  );
}

/** Vue d'ensemble de tous les projets : indicateurs, avancement comparé, cartes. */
export function Portfolio({ projects, open, today }) {
  const t = useT();
  const { dateFr } = useWs();
  const active = projects.filter((p) => p.status !== 'done');
  const tasks = projects.reduce((n, p) => n + p.tasks, 0), done = projects.reduce((n, p) => n + p.done, 0), overdue = projects.reduce((n, p) => n + p.overdue, 0);
  const prog = active.filter((p) => p.tasks).map((p) => { const v = Math.round(100 * p.done / p.tasks); return { name: p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name, value: v, color: p.overdue ? 'var(--danger)' : v === 100 ? 'var(--ok)' : 'var(--c1)' }; });
  return (
    <>
      <div className="ui-stats">
        <Stat icon="projects" label={t('Projets en cours')} value={active.length} sub={t('{n} terminé(s)', { n: projects.length - active.length })} />
        <Stat icon="list" label={t('Tâches')} value={tasks} sub={t('{n} terminées', { n: done })} tone="brand" />
        <Stat icon="target" label={t('Avancement global')} value={(tasks ? Math.round(100 * done / tasks) : 0) + ' %'} tone="ok" />
        <Stat icon="warn" label={t('Tâches en retard')} value={overdue} tone={overdue ? 'danger' : 'ok'} subTone="down" sub={overdue ? t('dans {n} projet(s)', { n: projects.filter((p) => p.overdue).length }) : undefined} />
      </div>
      {prog.length ? (
        <ChartFrame title={t('Avancement par projet')} subtitle={t('Rouge : des tâches sont en retard')} height={Math.max(160, prog.length * 38 + 40)} summary={prog.map((d) => d.name + ' ' + d.value + ' %').join(', ')}>
          <HBars data={prog} fmt={(v) => v + ' %'} valueLabel={t('Avancement')} height={Math.max(160, prog.length * 38 + 40)} />
        </ChartFrame>
      ) : null}
      <div className="ws-grid" style={{ marginTop: 16 }}>
        {projects.map((p) => {
          const pct = p.tasks ? Math.round(100 * p.done / p.tasks) : 0;
          const lateP = p.due && p.status !== 'done' && p.due < today;
          return (
            <button type="button" key={p.id} className={'ui-card hover pcard' + (p.status === 'done' ? ' done' : '')} onClick={() => open(p.id)}>
              <span className="row" style={{ justifyContent: 'space-between', width: '100%' }}><b className="pc-n">{p.name}</b>{p.status === 'done' ? <Badge tone="ok">{t('Terminé')}</Badge> : p.overdue || lateP ? <Badge tone="danger">{t('En retard')}</Badge> : <Badge tone="brand">{t('En cours')}</Badge>}</span>
              <span className="pc-pct">{pct}<small> %</small></span>
              <div className={'meter' + (p.overdue ? ' over' : '')} aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
              <small className="muted">{t('{done}/{total} tâches', { done: p.done, total: p.tasks }) + (p.overdue ? ' · ' + t('{n} en retard', { n: p.overdue }) : '') + (p.due ? ' · ' + t('pour le {date}', { date: dateFr(p.due) }) : '')}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}
