import { useEffect, useMemo, useState } from 'react';
import { ProjectTrack, TaskDetail, Workload } from '../parts/projects/Extras.jsx';
import { Insight, Planning, ReplanModal, ShiftModal } from '../parts/projects/Planning.jsx';
import { Portfolio as PortfolioPro, ProjectPilot, RiskRegister, WorkloadPlan } from '../parts/projects/Pro.jsx';
import { ProjectDashboard, Portfolio } from '../parts/projects/Dash.jsx';
import Gantt from '../parts/projects/Gantt.jsx';
import { Advice, Dependencies, useOpenTool } from '../parts/projects/Deps.jsx';
import Finance from '../parts/projects/Finance.jsx';
import Optim from '../parts/projects/Optim.jsx';
import Pert from '../parts/projects/Pert.jsx';
import { CalendarView, EMPTY_FILTER, Filters, Kanban, ListView, TS, applyFilter } from '../parts/projects/Views.jsx';
import { PdfActions } from '../parts/share/Share.jsx';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { DiscussButton } from '../parts/chat/ObjectUI.jsx';
import { Badge, Button, Card, EmptyState, Form, Loaded, Loading, PageHeader, Tabs, useLoad } from '../ui.jsx';

/* Sous-application : Projets et tâches (liste des projets, tableau des tâches, plan par l'IA). */

const PR = { low: 'Basse', normal: 'Normale', high: 'Haute' };
const NEXT = { todo: 'doing', doing: 'done', done: 'todo' };
const NEXT_LABEL = { todo: 'Démarrer', doing: 'Terminer', done: 'Rouvrir' };

export default function Projects() {
  const { oapi, can, modal, confirm, propose, fail, info } = useWs();
  const t = useT();
  const branches = info.branches;
  const [pid, setPid] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    let off = false;
    oapi('GET', '/members').then((j) => { if (!off) setMembers(j.members); }, () => {});
    return () => { off = true; };
  }, [oapi]);

  const memberOpts = (blank) => [['', blank || t('Personne')]].concat(members.map((m) => [String(m.userId), m.name]));
  const branchOpts = () => [['', t("Toute l'organisation")]].concat(branches.map((b) => [String(b.id), b.name]));

  const setStatus = (tk, s, again) => { oapi('PUT', '/projects/tasks/' + tk.id, { status: s }).then(again).catch(fail); };

  const taskFields = (tk) => {
    const x = tk || {};
    return [
      { k: 'title', label: t('Tâche'), required: true, value: x.title },
      { k: 'description', label: t('Détail'), type: 'textarea', rows: 2, value: x.description },
      { k: 'assigneeId', label: t('Assignée à'), type: 'select', options: memberOpts(t('Non assignée')), value: x.assigneeId ? String(x.assigneeId) : '' },
      { k: 'priority', label: t('Priorité'), type: 'select', options: [['normal', t('Normale')], ['high', t('Haute')], ['low', t('Basse')]], value: x.priority || 'normal' },
      { k: 'due', label: t('Pour le'), type: 'date', value: x.due || '' },
    ];
  };
  const newTask = (projectId, again) => {
    modal(t('Nouvelle tâche'), (close) => (
      <Form fields={taskFields()} submitText={t('Ajouter')} onSubmit={(v) => oapi('POST', '/projects/tasks', { projectId, title: v.title, description: v.description, assigneeId: v.assigneeId || null, priority: v.priority, due: v.due || null }).then(() => { close(); again(); })} />
    ));
  };
  const editTask = (tk, again) => {
    modal(t('Modifier la tâche'), (close) => (
      <Form
        fields={taskFields(tk)}
        submitText={t('Enregistrer')}
        onSubmit={(v) => oapi('PUT', '/projects/tasks/' + tk.id, { title: v.title, description: v.description, assigneeId: v.assigneeId || null, priority: v.priority, due: v.due || null }).then(() => { close(); again(); })}
        extra={<button className="btn" type="button" onClick={() => { oapi('DELETE', '/projects/tasks/' + tk.id).then(() => { close(); again(); }).catch(fail); }}>{t('Supprimer')}</button>}
      />
    ));
  };

  const newProject = () => {
    modal(t('Nouveau projet'), (close) => (
      <Form
        fields={[
          { k: 'name', label: t('Nom du projet'), required: true },
          { k: 'description', label: t('Description'), type: 'textarea', rows: 3 },
          { k: 'due', label: t('Échéance'), type: 'date' },
          { k: 'kind', label: t('Type de projet'), type: 'select', options: [['general', t('Général')], ['sale', t('Vente : maximiser la marge, trouver le meilleur prix')], ['production', t('Production : minimiser le coût')]], hint: t('Pour une vente ou une production, le système calcule automatiquement la solution optimale.') },
        ].concat(branches.length ? [{ k: 'branchId', label: t('Antenne concernée'), type: 'select', options: branchOpts() }] : [])}
        submitText={t('Créer')}
        onSubmit={(v) => oapi('POST', '/projects', { name: v.name, description: v.description, due: v.due || null, kind: v.kind, branchId: v.branchId || null }).then((j) => { close(); setPid(j.id); })}
      />
    ));
  };

  const aiPlan = () => {
    modal(t("Plan de projet avec l'IA"), (close) => (
      <Form
        fields={[{ k: 'goal', label: t('Quel objectif voulez-vous atteindre ?'), type: 'textarea', rows: 4, required: true, placeholder: t('Ex : ouvrir une deuxième boutique à Douala avant décembre') }]}
        submitText={t('Demander un plan')}
        onSubmit={(v) => {
          close();
          propose('project-plan', { goal: v.goal }, {
            title: t('Plan proposé'),
            applyText: t('Créer le projet et ses tâches'),
            render: (p) => (
              <>
                <h3>{p.name || t('Projet')}</h3>
                {p.description ? <p>{p.description}</p> : null}
                {(p.tasks || []).map((tk, i) => (
                  <div className="line" key={i}><span>{(i + 1) + '. ' + tk.title}</span><small>{t(PR[tk.priority] || 'Normale') + (tk.dueInDays != null ? ' · ' + t('dans {n} j', { n: tk.dueInDays }) : '')}</small></div>
                ))}
              </>
            ),
            done: (r) => setPid(r.id),
          });
        }}
      />
    ));
  };

  const actions = { can, newTask, editTask, setStatus, newProject, aiPlan, confirm, fail, modal, members };
  return pid ? <ProjectView key={pid} id={pid} back={() => setPid(null)} actions={actions} /> : <ProjectList open={setPid} actions={actions} />;
}

/* ----- Liste des projets : vue d'ensemble, mes tâches, charge ----- */
function ProjectList({ open, actions }) {
  const { oapi, today, info, can } = useWs();
  const t = useT();
  const { newTask, setStatus, newProject, aiPlan, modal } = actions;
  const ps = useLoad(() => oapi('GET', '/projects'), []);
  const ts = useLoad(() => oapi('GET', '/projects/tasks'), []);
  const reload = () => { ps.reload(); ts.reload(); };
  const [f, setF] = useState(EMPTY_FILTER);
  const mine = ts.data ? ts.data.tasks.filter((tk) => tk.status !== 'done' && (!tk.projectId || tk.assigneeId === info.me.userId)) : null;
  const shown = mine ? applyFilter(mine, f, today()) : null;
  const openTask = (tk) => modal(tk.title, (close) => <TaskModal task={tk} tasks={ts.data.tasks} close={close} again={reload} actions={actions} />, { wide: true });

  const [view, setView] = useState('list');
  return (
    <div>
      <PageHeader title={t('Projets et tâches')} subtitle={t("Découpez vos objectifs en tâches et suivez l'avancement.")} actions={<>
        {can('manager') ? <Button variant="soft" size="sm" icon="magic" onClick={aiPlan}>{t("Plan avec l'IA")}</Button> : null}
        {can('manager') ? <Button variant="primary" size="sm" icon="plus" onClick={newProject}>{t('Nouveau projet')}</Button> : null}
        <Button size="sm" icon="plus" onClick={() => newTask(null, reload)}>{t('Nouvelle tâche')}</Button>
      </>} />
      <Tabs items={[{ id: 'list', label: t('Projets'), icon: 'projects' }, { id: 'portfolio', label: t('Portefeuille'), icon: 'pie' }, ...(can('manager') ? [{ id: 'load', label: t('Charge prévue'), icon: 'users' }] : [])]} value={view} onChange={setView} label={t('Vues des projets')} />
      {view === 'portfolio' ? <PortfolioPro open={open} /> : null}
      {view === 'load' ? <WorkloadPlan /> : null}
      <div hidden={view !== 'list'}>
      <Loaded state={ps}>
        {(j) => (!j.projects.length
          ? <EmptyState icon="projects" title={t('Aucun projet')}>{can('manager') ? t('Décrivez un objectif à l\'IA (« Plan avec l\'IA ») ou créez un projet.') : t("Aucun projet pour l'instant.")}</EmptyState>
          : <Portfolio projects={j.projects} open={open} today={today()} />)}
      </Loaded>
      <Card title={t('Tâches sans projet et mes tâches')} className="pl-mine">
        {mine ? (
          <>
            <Filters f={f} setF={setF} tasks={mine} viewKey="projects-mine" />
            <ListView tasks={shown} today={today()} onOpen={openTask} onMove={(tk, s) => setStatus(tk, s, reload)} projectName />
          </>
        ) : <Loading />}
      </Card>
      {can('manager') ? <Workload /> : null}
      </div>
    </div>
  );
}

/** Fenêtre d'une tâche : actions rapides puis détail (temps, commentaires, planification). */
function TaskModal({ task, tasks, close, again, actions }) {
  const t = useT();
  const { editTask, setStatus, can, modal } = actions;
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Badge tone={task.status === 'done' ? 'ok' : task.status === 'doing' ? 'brand' : 'neutral'} dot>{t(TS[task.status])}</Badge>
        <span className="grow" />
        <Button size="sm" variant="primary" onClick={() => { setStatus(task, NEXT[task.status], () => { close(); again(); }); }}>{t(NEXT_LABEL[task.status])}</Button>
        <DiscussButton type="task" id={task.id} />
        <Button size="sm" icon="edit" onClick={() => { close(); editTask(task, again); }}>{t('Modifier')}</Button>
        {can('manager') && task.projectId && task.due ? <Button size="sm" icon="arrows-left-right" onClick={() => { close(); modal(task.title, (c) => <ShiftModal task={task} close={c} done={again} />); }}>{t('Décaler')}</Button> : null}
      </div>
      {task.description ? <p className="muted" style={{ marginBottom: 12 }}>{task.description}</p> : null}
      <TaskDetail task={task} tasks={tasks} close={close} done={again} />
    </div>
  );
}

/* ----- Un projet : tableau de bord, Gantt, kanban, calendrier, liste, suivi ----- */
const VIEWS = (t, manager) => [
  { id: 'dash', label: t('Tableau de bord'), icon: 'pie' }, { id: 'gantt', label: t('Gantt'), icon: 'gantt' }, { id: 'kanban', label: t('Kanban'), icon: 'kanban' },
  { id: 'calendar', label: t('Calendrier'), icon: 'calendar' }, { id: 'list', label: t('Liste'), icon: 'list' }, { id: 'follow', label: t('Suivi'), icon: 'wallet' },
  { id: 'plan', label: t('Planification'), icon: 'target' }, { id: 'pert', label: t('PERT'), icon: 'gantt' }, { id: 'pilot', label: t('Pilotage'), icon: 'gauge' }, { id: 'risks', label: t('Risques et dépendances'), icon: 'flag' },
  ...(manager ? [{ id: 'money', label: t('Budget et coûts'), icon: 'wallet' }, { id: 'optim', label: t('Optimisation'), icon: 'target' }] : []),
];
function ProjectView({ id, back, actions }) {
  const { oapi, dateFr, today: todayFn } = useWs();
  const t = useT();
  const { can, newTask, setStatus, confirm, fail, modal, members } = actions;
  const today = todayFn();
  const st = useLoad(() => oapi('GET', '/projects/' + id), [id]);
  const sum = useLoad(() => oapi('GET', '/projects/' + id + '/summary'), [id]);
  const [view, setView] = useState('dash');
  const [adviceKey, setAdviceKey] = useState(0);
  const { orgId } = useWs();
  const openTool2 = useOpenTool(setView, orgId);
  const [f, setF] = useState(EMPTY_FILTER);
  const again = () => { st.reload(); sum.reload(); };
  const j = st.data;
  const p = j && j.project;
  const tasks = j ? j.tasks : [];
  const shown = useMemo(() => applyFilter(tasks, f, today), [tasks, f, today]);
  const ids = useMemo(() => new Set(shown.map((x) => x.id)), [shown]);
  const openTask = (tk) => modal(tk.title, (close) => <TaskModal task={tk} tasks={tasks} close={close} again={again} actions={actions} />, { wide: true });
  const openId = (tid) => { const tk = tasks.find((x) => x.id === tid); if (tk) openTask(tk); };
  const move = (tk, s) => setStatus(tk, s, again);

  return (
    <div>
      <Button variant="ghost" size="sm" icon="arrow-left" onClick={back}>{t('Tous les projets')}</Button>
      {p ? (
        <PageHeader title={p.name} subtitle={(p.description || '') + (p.due ? ' ' + t('Échéance : {date}', { date: dateFr(p.due) }) : '')} actions={<>
          <Button variant="primary" size="sm" icon="plus" onClick={() => newTask(p.id, again)}>{t('Ajouter une tâche')}</Button>
          <PdfActions kind="project" sourceId={id} title={p.name} canCosts={can('manager')} />
          {can('manager') ? <Button size="sm" onClick={() => { oapi('PUT', '/projects/' + id, { status: p.status === 'done' ? 'active' : 'done' }).then(again).catch(fail); }}>{p.status === 'done' ? t('Rouvrir') : t('Marquer terminé')}</Button> : null}
          {can('manager') ? <Button size="sm" variant="danger-outline" icon="delete" onClick={() => confirm(t('Supprimer ce projet et toutes ses tâches ?'), () => { oapi('DELETE', '/projects/' + id).then(back).catch(fail); })}>{t('Supprimer')}</Button> : null}
        </>} />
      ) : null}
      {!j && st.loading ? <Loading /> : null}
      {!j && st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : null}
      {j ? (
        <>
          <Tabs items={VIEWS(t, can('manager'))} value={view} onChange={setView} label={t('Vues du projet')} />
          {!['dash', 'follow', 'plan', 'pilot', 'risks', 'pert', 'money', 'optim'].includes(view) ? <Filters f={f} setF={setF} tasks={tasks} /> : null}
          <div role="tabpanel" aria-labelledby={'tab-' + view}>
            {view === 'dash' ? <ProjectDashboard id={id} tasks={tasks} today={today} rev={j} /> : null}
            {view === 'gantt' ? (
              <>
                {can('manager') ? <div className="row" style={{ marginBottom: 8 }}><Button size="sm" icon="arrows-rotate" onClick={() => modal(t('Décaler les tâches qui suivent un retard'), (close) => <ReplanModal id={id} close={close} done={again} />, { wide: true })}>{t('Replanifier après un retard')}</Button></div> : null}
                <Gantt id={id} rev={j} onOpen={openId} ids={f.q || f.assignee || f.priority || f.status || f.late ? ids : null} />
              </>
            ) : null}
            {view === 'kanban' ? <Kanban tasks={shown} today={today} onMove={move} onOpen={openTask} onAdd={() => newTask(p.id, again)} /> : null}
            {view === 'calendar' ? <CalendarView tasks={shown} milestones={sum.data ? sum.data.milestones : []} today={today} onOpen={openTask} /> : null}
            {view === 'list' ? <ListView tasks={shown} today={today} onOpen={openTask} onMove={move} /> : null}
            {view === 'follow' ? <><ProjectTrack id={id} /><Workload /></> : null}
            {view === 'plan' ? <><Planning id={id} rev={j} />{can('manager') ? <Insight id={id} rev={j} /> : null}</> : null}
            {view === 'pilot' ? <ProjectPilot id={id} rev={j} /> : null}
            {view === 'pert' ? <Pert id={id} /> : null}
            {view === 'risks' ? <><Advice id={id} openTool={openTool2} reloadKey={adviceKey} /><RiskRegister id={id} members={members} onChange={() => setAdviceKey((k) => k + 1)} /><Dependencies id={id} onChange={() => setAdviceKey((k) => k + 1)} /></> : null}
            {view === 'money' && can('manager') ? <Finance id={id} openTool={openTool2} /> : null}
            {view === 'optim' && can('manager') ? <Optim id={id} projectKind={p ? p.kind : 'general'} /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
