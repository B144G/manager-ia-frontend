import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Projets et tâches (liste des projets, tableau des tâches, plan par l'IA). */

const TS = { todo: 'À faire', doing: 'En cours', done: 'Terminé' };
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
        ].concat(branches.length ? [{ k: 'branchId', label: t('Antenne concernée'), type: 'select', options: branchOpts() }] : [])}
        submitText={t('Créer')}
        onSubmit={(v) => oapi('POST', '/projects', { name: v.name, description: v.description, due: v.due || null, branchId: v.branchId || null }).then((j) => { close(); setPid(j.id); })}
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

  const actions = { can, newTask, editTask, setStatus, newProject, aiPlan, confirm, fail };
  return pid ? <ProjectView key={pid} id={pid} back={() => setPid(null)} actions={actions} /> : <ProjectList open={setPid} actions={actions} />;
}

/* ----- Liste des projets ----- */
function ProjectList({ open, actions }) {
  const { oapi, dateFr, today, info, can } = useWs();
  const t = useT();
  const { newTask, setStatus, newProject, aiPlan } = actions;
  const ps = useLoad(() => oapi('GET', '/projects'), []);
  const ts = useLoad(() => oapi('GET', '/projects/tasks'), []);
  const reload = () => { ps.reload(); ts.reload(); };
  const mine = ts.data ? ts.data.tasks.filter((tk) => tk.status !== 'done' && (!tk.projectId || tk.assigneeId === info.me.userId)) : null;

  return (
    <div>
      <div className="ws-head">
        <div><h1>{t('Projets et tâches')}</h1><p className="muted">{t("Découpez vos objectifs en tâches et suivez l'avancement.")}</p></div>
        <div className="row">
          {can('manager') ? <button className="btn signal small" type="button" onClick={aiPlan}>{t("Plan avec l'IA")}</button> : null}
          {can('manager') ? <button className="btn primary small" type="button" onClick={newProject}>{t('Nouveau projet')}</button> : null}
          <button className="btn small" type="button" onClick={() => newTask(null, reload)}>{t('Nouvelle tâche')}</button>
        </div>
      </div>
      <div className="ws-grid">
        <Loaded state={ps}>
          {(j) => (
            <>
              {!j.projects.length ? <Empty text={can('manager') ? t('Aucun projet. Décrivez un objectif à l\'IA (« Plan avec l\'IA ») ou créez un projet.') : t("Aucun projet pour l'instant.")} /> : null}
              {j.projects.map((p) => {
                const pct = p.tasks ? Math.round(100 * p.done / p.tasks) : 0;
                return (
                  <button type="button" key={p.id} className={'ws-card pcard' + (p.status === 'done' ? ' done' : '')} onClick={() => open(p.id)}>
                    <b>{p.name}</b>
                    <small>{t('{done}/{total} tâches', { done: p.done, total: p.tasks }) + (p.overdue ? ' · ' + t('{n} en retard', { n: p.overdue }) : '') + (p.due ? ' · ' + t('pour le {date}', { date: dateFr(p.due) }) : '')}</small>
                    <div className="meter"><i style={{ width: pct + '%' }} /></div>
                  </button>
                );
              })}
            </>
          )}
        </Loaded>
      </div>
      <div className="ws-card">
        <h2>{t('Tâches sans projet et mes tâches')}</h2>
        {mine ? (
          <>
            {!mine.length ? <Empty text={t('Rien à afficher.')} /> : null}
            {mine.slice(0, 20).map((tk) => {
              const late = tk.due && tk.due < today();
              return (
                <div className="line" key={tk.id}>
                  <span>{tk.title}{tk.project ? <small>{' · ' + tk.project}</small> : null}</span>
                  <span className="row">
                    <small className={late ? 'late' : ''}>{tk.due ? dateFr(tk.due) : ''}</small>
                    <button className="btn small" type="button" onClick={() => setStatus(tk, 'done', reload)}>{t('Terminer')}</button>
                  </span>
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ----- Un projet ----- */
function ProjectView({ id, back, actions }) {
  const { oapi, dateFr, today } = useWs();
  const t = useT();
  const { can, newTask, editTask, setStatus, confirm, fail } = actions;
  const st = useLoad(() => oapi('GET', '/projects/' + id), [id]);
  const again = st.reload;
  const j = st.data;
  const p = j && j.project;

  return (
    <div>
      <button className="link" type="button" onClick={back}>{t('← Tous les projets')}</button>
      <div className="ws-head">
        {p ? (
          <>
            <div><h1>{p.name}</h1><p className="muted">{(p.description || '') + (p.due ? ' ' + t('Échéance : {date}', { date: dateFr(p.due) }) : '')}</p></div>
            <div className="row">
              <button className="btn primary small" type="button" onClick={() => newTask(p.id, again)}>{t('Ajouter une tâche')}</button>
              {can('manager') ? <button className="btn small" type="button" onClick={() => { oapi('PUT', '/projects/' + id, { status: p.status === 'done' ? 'active' : 'done' }).then(again).catch(fail); }}>{p.status === 'done' ? t('Rouvrir') : t('Marquer terminé')}</button> : null}
              {can('manager') ? <button className="btn small" type="button" onClick={() => confirm(t('Supprimer ce projet et toutes ses tâches ?'), () => { oapi('DELETE', '/projects/' + id).then(back).catch(fail); })}>{t('Supprimer')}</button> : null}
            </div>
          </>
        ) : null}
      </div>
      <div className="kan">
        {!j && st.loading ? <Loading /> : null}
        {!j && st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : null}
        {j ? ['todo', 'doing', 'done'].map((s) => {
          const list = j.tasks.filter((tk) => tk.status === s);
          return (
            <div className="kcol" key={s}>
              <h3>{t(TS[s])}</h3>
              {!list.length ? <Empty text="—" /> : null}
              {list.map((tk) => {
                const late = tk.due && tk.status !== 'done' && tk.due < today();
                return (
                  <div className={'task p-' + tk.priority} key={tk.id}>
                    <b>{tk.title}</b>
                    {tk.description ? <p className="small muted">{tk.description}</p> : null}
                    <small className={late ? 'late' : ''}>{(tk.assignee ? tk.assignee + ' · ' : t('Non assignée') + ' · ') + (tk.due ? dateFr(tk.due) : t('sans date')) + ' · ' + t(PR[tk.priority])}</small>
                    <div className="row">
                      <button className="btn small" type="button" onClick={() => setStatus(tk, NEXT[tk.status], again)}>{t(NEXT_LABEL[tk.status])}</button>
                      <button className="link" type="button" onClick={() => editTask(tk, again)}>{t('Modifier')}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }) : null}
      </div>
    </div>
  );
}
