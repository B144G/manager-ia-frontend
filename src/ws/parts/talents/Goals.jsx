import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, ChartFrame, Loaded, useLoad } from '../../ui.jsx';
import { HBars } from '../../charts/lazy.jsx';
import { Bar, Panel, pct, useAct, useTl, yearNow } from './common.jsx';

/* Objectifs (MBO) en cascade entreprise → équipe → individu, avec l'assistant SMART qui dit ce qui manque, l'avancement, la pondération et le score de réalisation. */

const CRIT = ['S', 'M', 'A', 'R', 'T'];

/** Résultat de l'assistant SMART : cinq pastilles et, pour chaque critère manquant, ce qu'il faut corriger. */
export function SmartBox({ check }) {
  const t = useT();
  if (!check) return null;
  const LABEL = { S: t('Spécifique'), M: t('Mesurable'), A: t('Atteignable'), R: t('Réaliste'), T: t('Temporel') };
  const TIP = {
    'S:title_short': t("Précisez l'objectif : au moins quatre mots (quoi, pour qui, où)."), 'S:vague': t('Évitez les mots vagues (améliorer, mieux, plus) : dites quoi, de combien.'), 'S:no_action': t("Commencez par un verbe d'action (augmenter, réduire, lancer…) ou détaillez la description."),
    'M:no_target': t('Indiquez une valeur cible chiffrée.'), 'M:target_equals_start': t('La cible est égale à la valeur de départ.'), 'M:no_unit': t("Indiquez l'unité (FCFA, ventes, %, jours…)."),
    'A:too_high': t("La progression demandée dépasse +100 % : revoyez la cible ou découpez l'objectif."), 'A:ambitious': t('Objectif ambitieux (+50 à +100 %) : expliquez les moyens dans la description.'), 'A:cannot_judge': t("Renseignez la valeur de départ et la cible pour juger si c'est atteignable."),
    'R:no_parent': t("Rattachez-le à un objectif de niveau supérieur (équipe ou entreprise)."), 'R:bad_weight': t('La pondération doit être entre 1 et 100.'), 'R:no_owner': t('Indiquez le responsable de cet objectif.'),
    'T:no_due': t("Fixez une échéance."), 'T:past': t("L'échéance est déjà passée."), 'T:too_far': t("L'échéance dépasse 18 mois : découpez l'objectif en étapes."),
  };
  return (
    <div>
      <div className="tl-smart" aria-label={t('Assistant SMART')}>{CRIT.map((k) => <span key={k} className={check.criteria[k].ok ? 'ok' : ''} title={LABEL[k]}>{k}</span>)}</div>
      {check.isSmart ? <Alert tone="success">{t('Objectif SMART : les cinq critères sont remplis.')}</Alert> : (
        <Alert tone="warning" title={t('{n}/5 — à corriger avant activation', { n: check.score })}>
          <ul>{check.tips.map((x) => <li key={x}><b>{LABEL[x[0]]}</b> : {TIP[x] || x}</li>)}</ul>
        </Alert>
      )}
    </div>
  );
}

function GoalForm({ goal, parents, emps, deps, level, close, done }) {
  const t = useT();
  const { tp, has } = useTl();
  const [v, setV] = useState(() => ({ title: goal ? goal.title : '', description: goal ? goal.description : '', unit: goal ? goal.unit : '', start: goal ? String(goal.start) : '0', target: goal && goal.target !== null ? String(goal.target) : '', due: goal && goal.due ? goal.due : '', weight: goal ? String(goal.weight) : '20', parentId: goal && goal.parentId ? String(goal.parentId) : '', employeeId: goal && goal.employeeId ? String(goal.employeeId) : '', departmentId: goal && goal.departmentId ? String(goal.departmentId) : '', period: goal ? goal.period : String(yearNow()) }));
  const [check, setCheck] = useState(null);
  const [err, setErr] = useState('');
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const lv = goal ? goal.level : level;
  const body = () => ({ level: lv, title: v.title, description: v.description, unit: v.unit, start: v.start, target: v.target, due: v.due || null, weight: Number(v.weight), parentId: v.parentId ? Number(v.parentId) : null, employeeId: lv === 'individual' && v.employeeId ? Number(v.employeeId) : null, departmentId: lv === 'team' && v.departmentId ? Number(v.departmentId) : null, period: v.period });
  useEffect(() => { // l'assistant SMART se met à jour pendant la saisie
    const id = setTimeout(() => { tp('POST', '/goals/smart-check', body()).then(setCheck).catch(() => {}); }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  const save = async (status, accept) => {
    setErr('');
    try {
      if (goal) await tp('PUT', '/goals/' + goal.id, { ...body(), status: status || goal.status, acceptNonSmart: accept });
      else await tp('POST', '/goals', { ...body(), status: status || 'draft', acceptNonSmart: accept });
      close(); done();
    } catch (e) { setErr(e.message); }
  };
  const parentsOk = parents.filter((p) => (lv === 'team' ? p.level === 'company' : p.level !== 'individual'));
  const fld = (k, label, type = 'text', extra = {}) => <label className="fld"><span>{label}</span><input type={type} value={v[k]} onChange={(e) => set(k, e.target.value)} {...extra} /></label>;
  return (
    <div className="ws-form">
      {fld('title', t('Objectif'), 'text', { placeholder: t('Ex. Augmenter le chiffre d’affaires de la boutique de 20 %') })}
      <label className="fld"><span>{t('Description et moyens')}</span><textarea rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} /></label>
      <div className="row">{fld('start', t('Valeur de départ'), 'number')}{fld('target', t('Cible'), 'number')}{fld('unit', t('Unité'))}</div>
      <div className="row">{fld('due', t('Échéance'), 'date')}{fld('weight', t('Pondération (%)'), 'number')}{fld('period', t('Période'))}</div>
      {lv !== 'company' ? <label className="fld"><span>{t('Objectif parent')}</span><select value={v.parentId} onChange={(e) => set('parentId', e.target.value)}><option value="">{t('Aucun')}</option>{parentsOk.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label> : null}
      {lv === 'individual' ? <label className="fld"><span>{t('Titulaire')}</span><select value={v.employeeId} onChange={(e) => set('employeeId', e.target.value)}><option value="">{t('Choisir…')}</option>{emps.map((e) => <option key={e.employeeId} value={e.employeeId}>{e.name}</option>)}</select></label> : null}
      {lv === 'team' ? <label className="fld"><span>{t('Service')}</span><select value={v.departmentId} onChange={(e) => set('departmentId', e.target.value)}><option value="">{t('Aucun')}</option>{deps.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label> : null}
      <SmartBox check={check} />
      <p className="ws-err" role="alert">{err}</p>
      <div className="row">
        <Button onClick={() => save(goal ? goal.status : 'draft')}>{t('Enregistrer')}{!goal ? ' (' + t('brouillon') + ')' : ''}</Button>
        {has('talent') && (!goal || goal.status === 'draft') ? <Button variant="primary" onClick={() => save('active', false)}>{t('Activer')}</Button> : null}
        {err && has('talent') ? <Button onClick={() => save('active', true)}>{t('Activer malgré tout')}</Button> : null}
      </div>
    </div>
  );
}

function Node({ n, onEdit, onProgress, onDelete, can }) {
  const t = useT();
  const { dateFr } = useWs();
  const LV = { company: t('Entreprise'), team: t('Équipe'), individual: t('Individuel') };
  return (
    <li>
      <div className="tl-node">
        <div className="top"><Badge tone={n.level === 'company' ? 'brand' : n.level === 'team' ? 'info' : 'neutral'}>{LV[n.level]}</Badge><b>{n.title}</b>
          {n.status === 'draft' ? <Badge tone="warn">{t('Brouillon')}</Badge> : n.status === 'done' ? <Badge tone="ok">{t('Atteint')}</Badge> : null}
          <small className="tl-note">{[n.employee, n.due ? dateFr(n.due) : '', t('poids {n} %', { n: n.weight }), n.smartScore + '/5 SMART'].filter(Boolean).join(' · ')}</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Bar value={n.progress} /><b>{pct(n.progress)}</b>{n.rolled ? <small className="tl-note">{t('cumul des sous-objectifs')}</small> : null}</div>
        <div className="row">
          {!n.rolled && n.status !== 'draft' && n.status !== 'cancelled' && n.can ? <button className="link" type="button" onClick={() => onProgress(n)}>{t("Saisir l'avancement")}</button> : null}
          {n.can ? <button className="link" type="button" onClick={() => onEdit(n)}>{t('Modifier')}</button> : null}
          {n.can ? <button className="link" type="button" onClick={() => onDelete(n)}>{t('Supprimer')}</button> : null}
        </div>
      </div>
      {n.children.length ? <ul>{n.children.map((c) => <Node key={c.id} n={c} onEdit={onEdit} onProgress={onProgress} onDelete={onDelete} can={can} />)}</ul> : null}
    </li>
  );
}

export default function Goals() {
  const t = useT();
  const { modal, confirm } = useWs();
  const { tp, has, me } = useTl();
  const act = useAct();
  const [period, setPeriod] = useState(String(yearNow()));
  const tree = useLoad(() => tp('GET', '/goals/tree?period=' + encodeURIComponent(period)), [period]);
  const flat = useLoad(() => tp('GET', '/goals?period=' + encodeURIComponent(period)), [period]);
  const scores = useLoad(() => tp('GET', '/goals-scores?period=' + encodeURIComponent(period)), [period]);
  const emps = useLoad(() => (has('talent') ? tp('GET', '/profiles') : Promise.resolve({ items: [] })), []);
  const deps = useLoad(() => (has('talent', 'remun', 'recrut') ? tp('GET', '/departments') : Promise.resolve({ items: [] })), []);
  const reload = () => { tree.reload(); flat.reload(); scores.reload(); };
  const reportsIds = new Set(me ? me.reports : []);
  const mark = (nodes, mgr) => nodes.map((n) => ({ ...n, can: has('talent') || (n.level === 'individual' && (reportsIds.has(n.employeeId) || (me && me.employee && n.employeeId === me.employee.id))), children: mark(n.children, mgr) }));
  const edit = (g, level) => modal(g ? t("Modifier l'objectif") : level === 'company' ? t("Nouvel objectif d'entreprise") : level === 'team' ? t("Nouvel objectif d'équipe") : t('Nouvel objectif individuel'),
    (close) => <GoalForm goal={g} level={level} parents={flat.data ? flat.data.items : []} emps={(emps.data ? emps.data.items : []).filter((e) => e.status === 'active')} deps={deps.data ? deps.data.items : []} close={close} done={reload} />, { wide: true });
  const progress = (n) => modal(n.title, (close) => (
    <div className="ws-form">
      <p>{t('Départ {s}, cible {c} {u}', { s: n.start, c: n.target, u: n.unit })}</p>
      <ProgressForm n={n} close={close} done={reload} />
    </div>
  ));
  const del = (n) => confirm(t("Supprimer l'objectif « {name} » ?", { name: n.title }), () => act(tp('DELETE', '/goals/' + n.id), reload));
  return (
    <div className="tl-grid">
      <Panel title={t('Cascade des objectifs')} subtitle={t('Entreprise → équipe → individu')} actions={<>
        <input aria-label={t('Période')} value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 90 }} />
        {has('talent') ? <><Button size="sm" onClick={() => edit(null, 'company')}>{t('Objectif d’entreprise')}</Button><Button size="sm" onClick={() => edit(null, 'team')}>{t('Objectif d’équipe')}</Button></> : null}
        <Button size="sm" variant="primary" onClick={() => edit(null, 'individual')}>{t('Objectif individuel')}</Button></>}>
        <Loaded state={tree}>{(j) => (!j.items.length ? <p className="ws-empty">{t("Aucun objectif sur cette période. Commencez par l'objectif de l'entreprise, puis descendez aux équipes et aux personnes.")}</p> : (
          <div className="tl-tree"><ul>{mark(j.items).map((n) => <Node key={n.id} n={n} onEdit={(g) => edit(g, g.level)} onProgress={progress} onDelete={del} can />)}</ul></div>
        ))}
        </Loaded>
      </Panel>
      <Loaded state={scores}>{(s) => (s.items.length ? (
        <ChartFrame title={t('Score de réalisation')} subtitle={t('Moyenne pondérée par la pondération : {avg}', { avg: pct(s.average) })} summary={t('Score de réalisation des objectifs par personne')}>
          <HBars data={s.items.map((i) => ({ name: i.employee, value: i.score || 0 }))} fmt={(v) => v + ' %'} />
        </ChartFrame>
      ) : null)}
      </Loaded>
    </div>
  );
}

function ProgressForm({ n, close, done }) {
  const t = useT();
  const { tp } = useTl();
  const [v, setV] = useState(String(n.current));
  const [note, setNote] = useState('');
  const act = useAct();
  return (
    <>
      <label className="fld"><span>{t('Valeur atteinte')}</span><input type="number" value={v} onChange={(e) => setV(e.target.value)} /></label>
      <label className="fld"><span>{t('Commentaire')}</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <Button variant="primary" onClick={() => act(tp('PUT', '/goals/' + n.id + '/progress', { value: Number(v), note }), () => { close(); done(); })}>{t('Enregistrer')}</Button>
    </>
  );
}
