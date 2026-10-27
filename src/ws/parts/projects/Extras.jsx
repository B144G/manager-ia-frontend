import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN, FilesBox, SettingsCard } from '../w3/common.jsx';

/* Projets · vague 3 : budget et coût, temps passé, jalons, charge par personne, détail d'une tâche (temps, commentaires, dépendance, récurrence, pièces). */

export function ProjectTrack({ id }) {
  const t = useT();
  const { oapi, can, money, dateFr, modal, toast, fail } = useWs();
  const [v, setV] = useState(0);
  const sum = useLoad(() => oapi('GET', '/projects/' + id + '/summary'), [id, v]);
  const costs = useLoad(() => (can('manager') ? oapi('GET', '/projects/' + id + '/costs') : Promise.resolve({ items: [] })), [id, v]);
  const again = () => setV((n) => n + 1);
  const budget = (cur) => modal(t('Budget du projet'), (close) => <Form fields={[{ k: 'budget', label: t('Budget'), value: cur || '' }]} submitText={t('Enregistrer')} onSubmit={(f) => oapi('PUT', '/projects/' + id + '/budget', { budget: f.budget }).then(() => { close(); again(); })} />);
  const addCost = () => modal(t('Dépense du projet'), (close) => <Form fields={[{ k: 'label', label: t('Libellé'), required: true }, { k: 'amount', label: t('Montant'), required: true }, { k: 'date', label: t('Date'), type: 'date' }]} submitText={t('Ajouter')} onSubmit={(f) => oapi('POST', '/projects/' + id + '/costs', f).then(() => { close(); again(); })} />);
  const addMs = () => modal(t('Nouveau jalon'), (close) => <Form fields={[{ k: 'title', label: t('Jalon'), required: true }, { k: 'due', label: t('Date prévue'), type: 'date' }]} submitText={t('Ajouter')} onSubmit={(f) => oapi('POST', '/projects/' + id + '/milestones', f).then(() => { close(); again(); })} />);
  return (
    <>
      <Loaded state={sum}>{(j) => (
        <div className="ws-card">
          <h2>{t('Suivi du projet')}</h2>
          {j.cost ? (
            <>
              <div className="kpis">
                <div className="stat"><b>{j.cost.budget ? money(j.cost.budget) : '—'}</b><span>{t('budget')}</span></div>
                <div className={'stat' + (j.cost.overBudget ? ' bad' : '')}><b>{money(j.cost.spent)}</b><span>{t('coût (dépenses + temps)')}</span></div>
                <div className="stat"><b>{j.cost.remaining === null ? '—' : money(j.cost.remaining)}</b><span>{t('reste')}</span></div>
                <div className="stat"><b>{j.time.hours + ' h'}</b><span>{t('temps passé') + (j.time.estimatedHours ? ' / ' + j.time.estimatedHours + ' h' : '')}</span></div>
              </div>
              {j.cost.overBudget ? <p className="small late">{t('Le coût dépasse le budget.')}</p> : null}
              <p className="muted small">{t('Le temps est valorisé au coût horaire réglé dans les réglages du projet ({rate} par heure).', { rate: money(j.cost.hourlyCost) })}</p>
              <div className="row">
                <button className="btn small" type="button" style={BTN} onClick={() => budget(j.cost.budget)}>{t('Fixer le budget')}</button>
                <button className="btn small" type="button" style={BTN} onClick={addCost}>{t('Ajouter une dépense')}</button>
              </div>
              {costs.data ? costs.data.items.map((c) => <div className="line" key={c.id}><span>{c.label}<br /><small className="muted">{dateFr(c.date)}</small></span><span className="row"><b>{money(c.amount)}</b><button className="link" type="button" style={BTN} onClick={() => oapi('DELETE', '/projects/costs/' + c.id).then(again).catch(fail)}>{t('Supprimer')}</button></span></div>) : null}
            </>
          ) : <p className="muted small">{t('Temps passé : {n} h', { n: j.time.hours })}</p>}
          <h3>{t('Jalons')}</h3>
          {!j.milestones.length ? <Empty text={t('Aucun jalon.')} /> : null}
          {j.milestones.map((m) => (
            <div className="line" key={m.id}>
              <span><b>{m.title}</b>{m.done ? <span className="pill">{t('Atteint')}</span> : m.late ? <span className="pill bad">{t('En retard')}</span> : null}<br /><small className="muted">{m.due ? dateFr(m.due) : t('sans date')}</small></span>
              {can('manager') ? <span className="row"><button className="link" type="button" style={BTN} onClick={() => oapi('PUT', '/projects/milestones/' + m.id, { done: !m.done }).then(again).catch(fail)}>{m.done ? t('Rouvrir') : t('Marquer atteint')}</button><button className="link" type="button" style={BTN} onClick={() => oapi('DELETE', '/projects/milestones/' + m.id).then(again).catch(fail)}>{t('Supprimer')}</button></span> : null}
            </div>
          ))}
          {can('manager') ? <button className="btn small" type="button" style={BTN} onClick={addMs}>{t('Ajouter un jalon')}</button> : null}
          <h3>{t('Pièces du projet')}</h3>
          <FilesBox listPath={'/projects/' + id + '/files'} filePath="/projects/files" />
          {void toast}
        </div>
      )}
      </Loaded>
      {can('manager') ? <SettingsCard path="/projects" canEdit={can('admin')} title={t('Réglages des projets')} keys={[['project_hourly_cost', t('Coût horaire moyen'), t('Sert à valoriser le temps passé')]]} /> : null}
    </>
  );
}

const FREQ = [['', 'Aucune'], ['daily', 'Chaque jour'], ['weekly', 'Chaque semaine'], ['monthly', 'Chaque mois']];
export function TaskDetail({ task, tasks, close, done }) {
  const t = useT();
  const { oapi, can, toast, dateFr, today } = useWs();
  const [v, setV] = useState(0);
  const time = useLoad(() => oapi('GET', '/projects/tasks/' + task.id + '/time'), [task.id, v]);
  const com = useLoad(() => oapi('GET', '/projects/tasks/' + task.id + '/comments'), [task.id, v]);
  const again = () => setV((n) => n + 1);
  return (
    <div>
      <h3>{t('Temps passé')}</h3>
      <Loaded state={time}>{(j) => (
        <>
          <p className="muted small">{t('Total : {n} h', { n: j.total })}</p>
          {j.items.map((e) => <div className="line" key={e.id}><span>{e.who + ' · ' + dateFr(e.day)}{e.note ? ' · ' + e.note : ''}</span><b>{e.hours + ' h'}</b></div>)}
        </>
      )}
      </Loaded>
      <Form fields={[{ k: 'hours', label: t('Heures'), required: true }, { k: 'note', label: t('Note') }]} submitText={t('Saisir mon temps')} onSubmit={(f) => oapi('POST', '/projects/tasks/' + task.id + '/time', { hours: f.hours, note: f.note, day: today() }).then(() => { toast(t('Enregistré.')); again(); done(); })} />
      <h3>{t('Commentaires')}</h3>
      <Loaded state={com}>{(j) => j.items.map((c) => <div className="line" key={c.id}><span><b>{c.who}</b> · <small className="muted">{dateFr(c.at)}</small><br />{c.content}</span></div>)}</Loaded>
      <Form fields={[{ k: 'content', label: t('Votre commentaire'), type: 'textarea', rows: 2, required: true }]} submitText={t('Commenter')} onSubmit={(f) => oapi('POST', '/projects/tasks/' + task.id + '/comments', f).then(() => { again(); })} />
      {can('manager') ? (
        <>
          <h3>{t('Planification')}</h3>
          <Form
            fields={[{ k: 'estimateHours', label: t('Estimation (heures)'), value: task.estimateHours || '' },
              { k: 'dependsOn', label: t('Dépend de la tâche'), type: 'select', options: [['', t('Aucune')]].concat(tasks.filter((x) => x.id !== task.id).map((x) => [String(x.id), x.title])), value: task.dependsOn ? String(task.dependsOn) : '' },
              { k: 'recurrence', label: t('Répétition'), type: 'select', options: FREQ.map((o) => [o[0], t(o[1])]), value: task.recurrence || '' }]}
            submitText={t('Enregistrer')}
            onSubmit={(f) => oapi('PUT', '/projects/tasks/' + task.id + '/plan', { estimateHours: f.estimateHours, dependsOn: f.dependsOn || null, recurrence: f.recurrence }).then(() => { close(); done(); })}
          />
        </>
      ) : null}
      <h3>{t('Pièces de la tâche')}</h3>
      <p className="muted small">{t('Les pièces se joignent au projet.')}</p>
    </div>
  );
}

export function Workload() {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/projects/workload'), []);
  return (
    <div className="ws-card">
      <h2>{t('Charge par personne')}</h2>
      <Loaded state={st}>{(j) => (
        <>
          {!j.items.length ? <Empty text={t('Aucune tâche ouverte.')} /> : null}
          {j.items.map((p, i) => <div className="line" key={i}><b>{p.name || t('Non assignée')}</b><span>{t('{n} tâche(s) ouverte(s) · {o} en retard · {e} h estimées · {l} h saisies (30 j)', { n: p.openTasks, o: p.overdue, e: p.estimatedHours, l: p.loggedHours30d })}</span></div>)}
        </>
      )}
      </Loaded>
    </div>
  );
}
