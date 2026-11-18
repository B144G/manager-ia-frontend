import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Card, Loading, Stat, useLoad } from '../../ui.jsx';
import { TaskList } from './Panels.jsx';
import { useCp } from './common.jsx';

/* Aperçu : ce qui demande une action aujourd'hui. Chaque carte mène à l'écran concerné. Une carte dont la source échoue reste vide (le reste s'affiche). */

export default function Home() {
  const t = useT();
  const { api, go, fail, tick, bump } = useCp();
  const { money } = useWs();
  const st = useLoad(() => {
    const soft = (p) => p.catch(() => null);
    return Promise.all([soft(api('GET', '/prospection/dashboard')), soft(api('GET', '/cadences-queue')), soft(api('GET', '/tasks?mine=1&status=open')), soft(api('GET', '/pipeline/board')), soft(api('GET', '/pipeline/stagnant'))])
      .then(([lead, queue, tasks, board, stag]) => ({ lead, queue, tasks, board, stag }));
  }, [tick]);
  if (!st.data) return <Loading />;
  const { lead, queue, tasks, board, stag } = st.data;
  const dash = (v, f) => (v ? f(v) : '—');
  const toggle = (k) => api('PUT', '/tasks/' + k.id, { status: 'done' }).then(() => { st.reload(); bump(); }, fail);
  return (
    <div className="cp-stack">
      <div className="ui-stats">
        <Stat icon="user-plus" label={t('Prospects à traiter')} value={dash(lead, (l) => l.openTotal)} sub={lead ? t('{a} sans commercial · {b} à relancer', { a: lead.unassigned, b: lead.staleCount }) : ''} onClick={() => go('leads')} />
        <Stat icon="paper-plane" label={t('Relances dues')} value={dash(queue, (q) => q.queue.length)} tone={queue && queue.queue.length ? 'warn' : 'ok'} onClick={() => go('cadences')} />
        <Stat icon="list-check" label={t('Tâches en retard')} value={dash(tasks, (k) => k.overdue)} sub={tasks ? t('{n} tâche(s) ouverte(s)', { n: tasks.tasks.length }) : ''} tone={tasks && tasks.overdue ? 'danger' : 'ok'} onClick={() => go('tasks')} />
        <Stat icon="target" label={t('Pipeline pondéré')} value={dash(board, (b) => money(b.totals.weighted))} sub={board ? t('{n} opportunité(s) pour {m}', { n: board.totals.count, m: money(board.totals.amount) }) : ''} onClick={() => go('kanban')} />
        <Stat icon="hourglass" label={t('Opportunités stagnantes')} value={dash(stag, (s) => s.count)} tone={stag && stag.count ? 'warn' : 'ok'} onClick={() => go('stagnant')} />
      </div>
      <Card title={t('Mes prochaines tâches')} actions={<button type="button" className="cp-link" onClick={() => go('tasks')}>{t('Tout voir')}</button>}>
        {tasks ? <TaskList tasks={tasks.tasks.slice(0, 6)} onToggle={toggle} /> : <p className="muted">{t('Indisponible pour le moment.')}</p>}
      </Card>
    </div>
  );
}
