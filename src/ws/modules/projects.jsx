import { useEffect, useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Projets et tâches (liste des projets, tableau des tâches, plan par l'IA). */

const TS = { todo: 'À faire', doing: 'En cours', done: 'Terminé' };
const PR = { low: 'Basse', normal: 'Normale', high: 'Haute' };
const NEXT = { todo: 'doing', doing: 'done', done: 'todo' };
const NEXT_LABEL = { todo: 'Démarrer', doing: 'Terminer', done: 'Rouvrir' };

export default function Projects() {
  const { oapi, can, modal, confirm, propose, fail, info } = useWs();
  const branches = info.branches;
  const [pid, setPid] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    let off = false;
    oapi('GET', '/members').then((j) => { if (!off) setMembers(j.members); }, () => {});
    return () => { off = true; };
  }, [oapi]);

  const memberOpts = (blank) => [['', blank || 'Personne']].concat(members.map((m) => [String(m.userId), m.name]));
  const branchOpts = () => [['', "Toute l'organisation"]].concat(branches.map((b) => [String(b.id), b.name]));

  const setStatus = (t, s, again) => { oapi('PUT', '/projects/tasks/' + t.id, { status: s }).then(again).catch(fail); };

  const taskFields = (t) => {
    const x = t || {};
    return [
      { k: 'title', label: 'Tâche', required: true, value: x.title },
      { k: 'description', label: 'Détail', type: 'textarea', rows: 2, value: x.description },
      { k: 'assigneeId', label: 'Assignée à', type: 'select', options: memberOpts('Non assignée'), value: x.assigneeId ? String(x.assigneeId) : '' },
      { k: 'priority', label: 'Priorité', type: 'select', options: [['normal', 'Normale'], ['high', 'Haute'], ['low', 'Basse']], value: x.priority || 'normal' },
      { k: 'due', label: 'Pour le', type: 'date', value: x.due || '' },
    ];
  };
  const newTask = (projectId, again) => {
    modal('Nouvelle tâche', (close) => (
      <Form fields={taskFields()} submitText="Ajouter" onSubmit={(v) => oapi('POST', '/projects/tasks', { projectId, title: v.title, description: v.description, assigneeId: v.assigneeId || null, priority: v.priority, due: v.due || null }).then(() => { close(); again(); })} />
    ));
  };
  const editTask = (t, again) => {
    modal('Modifier la tâche', (close) => (
      <Form
        fields={taskFields(t)}
        submitText="Enregistrer"
        onSubmit={(v) => oapi('PUT', '/projects/tasks/' + t.id, { title: v.title, description: v.description, assigneeId: v.assigneeId || null, priority: v.priority, due: v.due || null }).then(() => { close(); again(); })}
        extra={<button className="btn" type="button" onClick={() => { oapi('DELETE', '/projects/tasks/' + t.id).then(() => { close(); again(); }).catch(fail); }}>Supprimer</button>}
      />
    ));
  };

  const newProject = () => {
    modal('Nouveau projet', (close) => (
      <Form
        fields={[
          { k: 'name', label: 'Nom du projet', required: true },
          { k: 'description', label: 'Description', type: 'textarea', rows: 3 },
          { k: 'due', label: 'Échéance', type: 'date' },
        ].concat(branches.length ? [{ k: 'branchId', label: 'Antenne concernée', type: 'select', options: branchOpts() }] : [])}
        submitText="Créer"
        onSubmit={(v) => oapi('POST', '/projects', { name: v.name, description: v.description, due: v.due || null, branchId: v.branchId || null }).then((j) => { close(); setPid(j.id); })}
      />
    ));
  };

  const aiPlan = () => {
    modal('Plan de projet avec l\'IA', (close) => (
      <Form
        fields={[{ k: 'goal', label: 'Quel objectif voulez-vous atteindre ?', type: 'textarea', rows: 4, required: true, placeholder: 'Ex : ouvrir une deuxième boutique à Douala avant décembre' }]}
        submitText="Demander un plan"
        onSubmit={(v) => {
          close();
          propose('project-plan', { goal: v.goal }, {
            title: 'Plan proposé',
            applyText: 'Créer le projet et ses tâches',
            render: (p) => (
              <>
                <h3>{p.name || 'Projet'}</h3>
                {p.description ? <p>{p.description}</p> : null}
                {(p.tasks || []).map((t, i) => (
                  <div className="line" key={i}><span>{(i + 1) + '. ' + t.title}</span><small>{(PR[t.priority] || 'Normale') + (t.dueInDays != null ? ' · dans ' + t.dueInDays + ' j' : '')}</small></div>
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
  const { newTask, setStatus, newProject, aiPlan } = actions;
  const ps = useLoad(() => oapi('GET', '/projects'), []);
  const ts = useLoad(() => oapi('GET', '/projects/tasks'), []);
  const reload = () => { ps.reload(); ts.reload(); };
  const mine = ts.data ? ts.data.tasks.filter((t) => t.status !== 'done' && (!t.projectId || t.assigneeId === info.me.userId)) : null;

  return (
    <div>
      <div className="ws-head">
        <div><h1>Projets et tâches</h1><p className="muted">Découpez vos objectifs en tâches et suivez l'avancement.</p></div>
        <div className="row">
          {can('manager') ? <button className="btn signal small" type="button" onClick={aiPlan}>Plan avec l'IA</button> : null}
          {can('manager') ? <button className="btn primary small" type="button" onClick={newProject}>Nouveau projet</button> : null}
          <button className="btn small" type="button" onClick={() => newTask(null, reload)}>Nouvelle tâche</button>
        </div>
      </div>
      <div className="ws-grid">
        <Loaded state={ps}>
          {(j) => (
            <>
              {!j.projects.length ? <Empty text={can('manager') ? 'Aucun projet. Décrivez un objectif à l\'IA (« Plan avec l\'IA ») ou créez un projet.' : 'Aucun projet pour l\'instant.'} /> : null}
              {j.projects.map((p) => {
                const pct = p.tasks ? Math.round(100 * p.done / p.tasks) : 0;
                return (
                  <button type="button" key={p.id} className={'ws-card pcard' + (p.status === 'done' ? ' done' : '')} onClick={() => open(p.id)}>
                    <b>{p.name}</b>
                    <small>{p.done + '/' + p.tasks + ' tâches' + (p.overdue ? ' · ' + p.overdue + ' en retard' : '') + (p.due ? ' · pour le ' + dateFr(p.due) : '')}</small>
                    <div className="meter"><i style={{ width: pct + '%' }} /></div>
                  </button>
                );
              })}
            </>
          )}
        </Loaded>
      </div>
      <div className="ws-card">
        <h2>Tâches sans projet et mes tâches</h2>
        {mine ? (
          <>
            {!mine.length ? <Empty text="Rien à afficher." /> : null}
            {mine.slice(0, 20).map((t) => {
              const late = t.due && t.due < today();
              return (
                <div className="line" key={t.id}>
                  <span>{t.title}{t.project ? <small>{' · ' + t.project}</small> : null}</span>
                  <span className="row">
                    <small className={late ? 'late' : ''}>{t.due ? dateFr(t.due) : ''}</small>
                    <button className="btn small" type="button" onClick={() => setStatus(t, 'done', reload)}>Terminer</button>
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
  const { can, newTask, editTask, setStatus, confirm, fail } = actions;
  const st = useLoad(() => oapi('GET', '/projects/' + id), [id]);
  const again = st.reload;
  const j = st.data;
  const p = j && j.project;

  return (
    <div>
      <button className="link" type="button" onClick={back}>← Tous les projets</button>
      <div className="ws-head">
        {p ? (
          <>
            <div><h1>{p.name}</h1><p className="muted">{(p.description || '') + (p.due ? ' Échéance : ' + dateFr(p.due) : '')}</p></div>
            <div className="row">
              <button className="btn primary small" type="button" onClick={() => newTask(p.id, again)}>Ajouter une tâche</button>
              {can('manager') ? <button className="btn small" type="button" onClick={() => { oapi('PUT', '/projects/' + id, { status: p.status === 'done' ? 'active' : 'done' }).then(again).catch(fail); }}>{p.status === 'done' ? 'Rouvrir' : 'Marquer terminé'}</button> : null}
              {can('manager') ? <button className="btn small" type="button" onClick={() => confirm('Supprimer ce projet et toutes ses tâches ?', () => { oapi('DELETE', '/projects/' + id).then(back).catch(fail); })}>Supprimer</button> : null}
            </div>
          </>
        ) : null}
      </div>
      <div className="kan">
        {!j && st.loading ? <Loading /> : null}
        {!j && st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
        {j ? ['todo', 'doing', 'done'].map((s) => {
          const ts = j.tasks.filter((t) => t.status === s);
          return (
            <div className="kcol" key={s}>
              <h3>{TS[s]}</h3>
              {!ts.length ? <Empty text="—" /> : null}
              {ts.map((t) => {
                const late = t.due && t.status !== 'done' && t.due < today();
                return (
                  <div className={'task p-' + t.priority} key={t.id}>
                    <b>{t.title}</b>
                    {t.description ? <p className="small muted">{t.description}</p> : null}
                    <small className={late ? 'late' : ''}>{(t.assignee ? t.assignee + ' · ' : 'Non assignée · ') + (t.due ? dateFr(t.due) : 'sans date') + ' · ' + PR[t.priority]}</small>
                    <div className="row">
                      <button className="btn small" type="button" onClick={() => setStatus(t, NEXT[t.status], again)}>{NEXT_LABEL[t.status]}</button>
                      <button className="link" type="button" onClick={() => editTask(t, again)}>Modifier</button>
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
