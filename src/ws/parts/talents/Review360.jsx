import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Form, Loaded, Table, useLoad } from '../../ui.jsx';
import { Legend, Panel, RadarView, levelOpts, num1, useAct, useTl, yearNow } from './common.jsx';

/* Évaluation 360° : campagnes, évaluateurs (soi, manager, pairs, subordonnés, clients), questionnaire par compétences, résultats anonymisés (seuil minimum de répondants),
   radar, écarts perception de soi / autres, plan de progrès. */

export const useRel = () => {
  const t = useT();
  return { self: t('Soi'), manager: t('Manager'), peer: t('Pairs'), subordinate: t('Subordonnés'), client: t('Clients'), others: t('Autres (anonymisé)') };
};

/** Résultats d'un évalué : radar soi / autres / manager, tableau des écarts, angles morts, commentaires sans identité. */
export function Results({ r, canPlan, reload }) {
  const t = useT();
  const { modal } = useWs();
  const { tp } = useTl();
  const REL = useRel();
  const plan = () => modal(t('Plan de progrès'), (close) => (
    <Form submitText={t('Créer les actions')} fields={[...r.blindSpots.slice(0, 3).map((b, i) => ({ k: 'a' + i, label: t('Action pour « {name} »', { name: b.name }), value: t('Atelier / coaching : {name}', { name: b.name }) })), { k: 'dueDate', label: t('Échéance'), type: 'date' }]}
      onSubmit={async (v) => { const actions = r.blindSpots.slice(0, 3).map((b, i) => ({ title: v['a' + i], competencyId: b.competencyId, dueDate: v.dueDate || null })); if (!actions.length) throw new Error(t("Aucun angle mort : rien à planifier.")); await tp('POST', '/360/subjects/' + r.subjectId + '/plan', { actions }); close(); if (reload) reload(); }} />));
  return (
    <div className="tl-grid">
      {r.othersHidden ? <Alert tone="info">{t("Moins de {n} répondants « autres » : leurs notes et commentaires sont masqués pour protéger leur anonymat.", { n: r.minResponses })}</Alert> : null}
      {r.breakdownHidden && !r.othersHidden ? <Alert tone="info">{t("Un groupe compte moins de {n} répondants : seul l'ensemble « autres » est montré, jamais le détail par groupe.", { n: r.minResponses })}</Alert> : null}
      <div className="tl-2">
        <Panel title={t('Radar des compétences')} subtitle={t('Soi {s} · Autres {o}', { s: num1(r.selfAvg), o: num1(r.othersAvg) })}>
          {r.radar.length >= 3 ? <RadarView data={r.radar.map((k) => ({ name: k.name, self: k.self, others: k.others, manager: k.manager }))} series={[{ key: 'self', label: REL.self }, { key: 'others', label: REL.others }, { key: 'manager', label: REL.manager }]} /> : <p className="ws-empty">{t('Le radar demande au moins trois compétences.')}</p>}
        </Panel>
        <Panel title={t('Perception de soi et des autres')} note={t('Écart positif : la personne se juge mieux que les autres ne la jugent.')}>
          <Table rows={r.competencies} rowKey="competencyId" columns={[
            { key: 'name', label: t('Compétence'), render: (k) => <b>{k.name}</b> }, { key: 'self', label: REL.self, align: 'r', render: (k) => num1(k.self) },
            { key: 'manager', label: REL.manager, align: 'r', render: (k) => num1(k.manager) }, { key: 'others', label: REL.others, align: 'r', render: (k) => num1(k.others) },
            { key: 'gap', label: t('Écart'), align: 'r', render: (k) => (k.gap === null ? '—' : <Badge tone={k.gap >= 0.5 ? 'warn' : k.gap <= -0.5 ? 'info' : 'ok'}>{(k.gap > 0 ? '+' : '') + num1(k.gap)}</Badge>) }]} />
          <Legend items={[['var(--warn)', t('Angle mort (se surestime)')], ['var(--info)', t('Force cachée (se sous-estime)')]]} />
        </Panel>
      </div>
      <Panel title={t('Participation')}>{r.participation.map((p) => <span key={p.relation} style={{ marginRight: 12 }}>{REL[p.relation]} : {p.answered}/{p.invited}</span>)}</Panel>
      <Panel title={t('Commentaires (sans identité)')}>
        {!r.comments.length ? <p className="ws-empty">{t('Aucun commentaire visible.')}</p> : r.comments.map((c, i) => <div className="tl-row" key={i}><span>{c.text}</span><Badge>{REL[c.relation]}</Badge></div>)}
      </Panel>
      {canPlan && r.blindSpots.length ? <div><Button variant="primary" onClick={plan}>{t('Créer le plan de progrès')}</Button></div> : null}
    </div>
  );
}

function Answer({ task, close, done }) {
  const t = useT();
  const { tp } = useTl();
  const act = useAct();
  const [a, setA] = useState(() => Object.fromEntries(task.competencies.map((c) => [c.id, { score: '', comment: '' }])));
  const set = (id, k, v) => setA((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));
  const ok = task.competencies.every((c) => a[c.id].score);
  return (
    <div className="ws-form">
      <p className="tl-note">{task.relation === 'self' ? t('Évaluez-vous honnêtement.') : t('Vos réponses sont anonymes pour la personne évaluée (sauf si vous êtes son manager).')}</p>
      {task.competencies.map((c) => (
        <div key={c.id} className="tl-row"><b>{c.name}</b>
          <span className="row"><select aria-label={c.name} value={a[c.id].score} onChange={(e) => set(c.id, 'score', e.target.value)}><option value="">{t('Note…')}</option>{levelOpts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
            <input aria-label={t('Commentaire')} placeholder={t('Commentaire (facultatif)')} value={a[c.id].comment} onChange={(e) => set(c.id, 'comment', e.target.value)} /></span></div>
      ))}
      <small className="tl-note">{t('1 = à développer · 3 = maîtrisé · 5 = expert')}</small>
      <Button variant="primary" disabled={!ok} onClick={() => act(tp('POST', '/360/raters/' + task.raterId + '/answers', { answers: task.competencies.map((c) => ({ competencyId: c.id, score: Number(a[c.id].score), comment: a[c.id].comment })) }), () => { close(); done(); })}>{t('Envoyer mes réponses')}</Button>
    </div>
  );
}

/** Mes questionnaires à remplir et mes résultats diffusés (ouvert à tout membre lié à une fiche employé). */
export function Mine() {
  const t = useT();
  const { modal } = useWs();
  const { tp } = useTl();
  const REL = useRel();
  const todo = useLoad(() => tp('GET', '/360/todo'), []);
  const mine = useLoad(() => tp('GET', '/360/mine'), []);
  return (
    <div className="tl-grid">
      <Panel title={t('Questionnaires à remplir')}>
        <Loaded state={todo}>{(d) => (!d.items.length ? <p className="ws-empty">{t('Aucun questionnaire en attente.')}</p> : d.items.map((x) => (
          <div className="tl-row" key={x.raterId}><span><b>{x.campaign}</b> — {x.relation === 'self' ? t('Auto-évaluation') : t('Évaluation de {name} ({rel})', { name: x.subject, rel: REL[x.relation] })}</span>
            {x.status === 'done' ? <Badge tone="ok">{t('Envoyé')}</Badge> : <Button size="sm" variant="primary" onClick={() => modal(x.campaign, (close) => <Answer task={x} close={close} done={todo.reload} />, { wide: true })}>{t('Répondre')}</Button>}</div>
        )))}
        </Loaded>
      </Panel>
      <Loaded state={mine}>{(m) => m.items.map((r) => <Panel key={r.campaign.id} title={t('Mes résultats : {title}', { title: r.campaign.title })}><Results r={r} /></Panel>)}</Loaded>
    </div>
  );
}

export default function Review360() {
  const t = useT();
  const { modal, confirm } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const [camp, setCamp] = useState('');
  const [res, setRes] = useState(null);
  const list = useLoad(() => (has('talent') ? tp('GET', '/360/campaigns') : Promise.resolve({ items: [] })), []);
  const subs = useLoad(() => (camp ? tp('GET', '/360/campaigns/' + camp + '/subjects') : Promise.resolve(null)), [camp]);
  const comps = useLoad(() => (has('talent') ? tp('GET', '/competencies') : Promise.resolve({ items: [] })), []);
  const emps = useLoad(() => (has('talent') ? tp('GET', '/profiles') : Promise.resolve({ items: [] })), []);
  const REL = useRel();
  if (!has('talent')) return <Mine />;
  const STATUS = { draft: t('Brouillon'), open: t('Ouverte'), closed: t('Clôturée'), released: t('Diffusée') };
  const NEXT = { draft: ['open', t('Ouvrir la campagne')], open: ['closed', t('Clôturer')], closed: ['released', t('Diffuser les résultats aux évalués')] };
  const create = () => modal(t('Nouvelle campagne 360°'), (close) => <CampForm comps={comps.data ? comps.data.items : []} close={close} done={list.reload} />, { wide: true });
  const addSubject = () => modal(t('Ajouter une personne évaluée'), (close) => <SubjectForm camp={camp} emps={(emps.data ? emps.data.items : []).filter((e) => e.status === 'active')} close={close} done={subs.reload} />, { wide: true });
  const showRes = (s) => tp('GET', '/360/campaigns/' + camp + '/results/' + s.id).then((r) => setRes({ r, name: s.employee })).catch((e) => modal(t('Résultats'), () => <p className="ws-err">{e.message}</p>));
  return (
    <div className="tl-grid">
      <Panel title={t('Campagnes 360°')} actions={<Button size="sm" variant="primary" onClick={create}>{t('Nouvelle campagne')}</Button>}>
        <Loaded state={list}>{(l) => (
          <Table rows={l.items} empty={t('Aucune campagne.')} onRowClick={(c) => { setCamp(String(c.id)); setRes(null); }} columns={[
            { key: 'title', label: t('Campagne'), render: (c) => <b>{c.title}</b> }, { key: 'status', label: t('État'), render: (c) => <Badge tone={c.status === 'open' ? 'ok' : 'neutral'}>{STATUS[c.status]}</Badge> },
            { key: 'subjects', label: t('Évalués'), align: 'r' }, { key: 'done', label: t('Réponses'), align: 'r', render: (c) => `${c.done}/${c.raters}` }, { key: 'min', label: t("Seuil d'anonymat"), align: 'r', render: (c) => c.minResponses },
            { key: 'a', label: '', render: (c) => <span className="row">{NEXT[c.status] ? <button className="link" type="button" onClick={(e) => { e.stopPropagation(); confirm(t('{action} ?', { action: NEXT[c.status][1] }), () => act(tp('PUT', '/360/campaigns/' + c.id + '/status', { status: NEXT[c.status][0] }), list.reload)); }}>{NEXT[c.status][1]}</button> : null}</span> }]} />
        )}
        </Loaded>
      </Panel>
      {camp ? (
        <Loaded state={subs}>{(s) => (
          <Panel title={t('Personnes évaluées — {title}', { title: s.campaign.title })} actions={s.campaign.status !== 'closed' && s.campaign.status !== 'released' ? <Button size="sm" onClick={addSubject}>{t('Ajouter une personne')}</Button> : null}>
            {s.items.map((x) => (
              <div className="tl-row" key={x.id}>
                <span><b>{x.employee}</b><br /><small className="tl-note">{x.raters.map((r) => `${REL[r.relation]} : ${r.name || '—'}${r.status === 'done' ? ' ✓' : ''}`).join(' · ')}</small></span>
                {s.campaign.status === 'closed' || s.campaign.status === 'released' ? <Button size="sm" onClick={() => showRes({ ...x, employee: x.employee })}>{t('Voir les résultats')}</Button> : null}
              </div>
            ))}
            {!s.items.length ? <p className="ws-empty">{t('Ajoutez les personnes à évaluer et leurs évaluateurs.')}</p> : null}
          </Panel>
        )}
        </Loaded>
      ) : null}
      {res ? <Panel title={t('Résultats : {name}', { name: res.name })}><Results r={res.r} canPlan reload={() => showRes({ id: res.r.subjectId, employee: res.name })} /></Panel> : null}
      <Panel title={t('Mes questionnaires')}><Mine /></Panel>
    </div>
  );
}

function CampForm({ comps, close, done }) {
  const t = useT();
  const { tp } = useTl();
  const [sel, setSel] = useState([]);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <>
      <Form submitText={t('Créer')} fields={[{ k: 'title', label: t('Titre'), required: true }, { k: 'period', label: t('Période'), value: String(yearNow()) }, { k: 'minResponses', label: t("Seuil minimum de répondants (anonymat)"), type: 'number', value: '3', hint: t('Un groupe de moins de répondants que ce seuil n’est jamais détaillé.') }, { k: 'dueDate', label: t('Date limite'), type: 'date' }]}
        onSubmit={async (v) => { if (!sel.length) throw new Error(t('Choisissez au moins une compétence.')); await tp('POST', '/360/campaigns', { title: v.title, period: v.period, minResponses: Number(v.minResponses), dueDate: v.dueDate || null, competencyIds: sel }); close(); done(); }} />
      <h3>{t('Compétences du questionnaire')}</h3>
      <div className="row">{comps.map((c) => <label key={c.id}><input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggle(c.id)} /> {c.name}</label>)}</div>
    </>
  );
}

function SubjectForm({ camp, emps, close, done }) {
  const t = useT();
  const { tp } = useTl();
  const REL = useRel();
  const [who, setWho] = useState('');
  const [raters, setRaters] = useState([]);
  const [err, setErr] = useState('');
  const add = (rel) => setRaters((r) => [...r, { relation: rel, employeeId: '', label: '' }]);
  const set = (i, k, v) => setRaters((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = () => tp('POST', '/360/campaigns/' + camp + '/subjects', { employeeId: Number(who), raters: raters.map((r) => (r.relation === 'client' ? { relation: 'client', label: r.label } : { relation: r.relation, employeeId: Number(r.employeeId) })) }).then(() => { close(); done(); }).catch((e) => setErr(e.message));
  return (
    <div className="ws-form">
      <label className="fld"><span>{t('Personne évaluée')}</span><select value={who} onChange={(e) => setWho(e.target.value)}><option value="">{t('Choisir…')}</option>{emps.map((e) => <option key={e.employeeId} value={e.employeeId}>{e.name}</option>)}</select></label>
      <p className="tl-note">{t("Elle s'auto-évalue automatiquement ; son responsable direct est ajouté s'il est renseigné.")}</p>
      {raters.map((r, i) => (
        <div className="row" key={i}><Badge>{REL[r.relation]}</Badge>
          {r.relation === 'client' ? <input aria-label={t('Nom du client')} placeholder={t('Nom du client')} value={r.label} onChange={(e) => set(i, 'label', e.target.value)} />
            : <select aria-label={t('Évaluateur')} value={r.employeeId} onChange={(e) => set(i, 'employeeId', e.target.value)}><option value="">{t('Choisir…')}</option>{emps.filter((e) => String(e.employeeId) !== who).map((e) => <option key={e.employeeId} value={e.employeeId}>{e.name}</option>)}</select>}
          <button className="link" type="button" onClick={() => setRaters((x) => x.filter((_, j) => j !== i))}>{t('Retirer')}</button></div>
      ))}
      <div className="row">{['manager', 'peer', 'subordinate', 'client'].map((rel) => <Button key={rel} size="sm" onClick={() => add(rel)}>+ {REL[rel]}</Button>)}</div>
      <p className="ws-err" role="alert">{err}</p>
      <Button variant="primary" disabled={!who} onClick={save}>{t('Enregistrer')}</Button>
    </div>
  );
}
