import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, ChartFrame, Form, Loaded, Table, useLoad } from '../../ui.jsx';
import { Bars } from '../../charts/lazy.jsx';
import { Locked, Panel, num1, pct, useAct, useTl } from './common.jsx';

/* Carrières et succession (parcours, postes clés, successeurs, degré de préparation, risque de vacance, risque de départ, plans de rétention) et engagement (enquêtes anonymes, eNPS). */

const RISK_TONE = { critical: 'danger', high: 'warn', medium: 'info', low: 'ok' };
export function Succession() {
  const t = useT();
  const { modal, confirm } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const st = useLoad(() => (has('talent') ? tp('GET', '/career/succession') : Promise.resolve(null)), []);
  const ret = useLoad(() => (has('talent') ? tp('GET', '/career/retention') : Promise.resolve(null)), []);
  const emps = useLoad(() => (has('talent') ? tp('GET', '/profiles') : Promise.resolve({ items: [] })), []);
  const jobs = useLoad(() => (has('talent') ? tp('GET', '/job-profiles') : Promise.resolve({ items: [] })), []);
  const paths = useLoad(() => (has('talent') ? tp('GET', '/career/paths') : Promise.resolve(null)), []);
  if (!has('talent')) return <Locked />;
  const RISK = { critical: t('Critique'), high: t('Élevé'), medium: t('Moyen'), low: t('Faible') };
  const READY = { now: t('Prêt maintenant'), '1-2y': t('Prêt dans 1 à 2 ans'), '3y+': t('Prêt dans 3 ans ou plus') };
  const active = (emps.data ? emps.data.items : []).filter((e) => e.status === 'active');
  const addKey = () => modal(t('Nouveau poste clé'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'title', label: t('Poste'), required: true }, { k: 'jobProfileId', label: t('Emploi du référentiel'), type: 'select', options: [['', t('Aucun')], ...jobs.data.items.map((j) => [String(j.id), j.title])] }, { k: 'holderId', label: t('Titulaire'), type: 'select', options: [['', t('Vacant')], ...active.map((e) => [String(e.employeeId), e.name])] }, { k: 'criticality', label: t('Criticité'), type: 'select', value: '2', options: [['1', t('Faible')], ['2', t('Moyenne')], ['3', t('Élevée')]] }]}
    onSubmit={async (v) => { await tp('POST', '/career/key-positions', { title: v.title, jobProfileId: v.jobProfileId || null, holderId: v.holderId || null, criticality: Number(v.criticality) }); close(); st.reload(); }} />));
  const addSucc = (k) => modal(t('Successeur — {title}', { title: k.title }), (close) => (
    <Form submitText={t('Ajouter')} fields={[{ k: 'employeeId', label: t('Personne'), type: 'select', options: active.filter((e) => e.employeeId !== k.holderId).map((e) => [String(e.employeeId), e.name]) }, { k: 'readiness', label: t('Préparation'), type: 'select', options: Object.entries(READY) }]}
    onSubmit={async (v) => { await tp('PUT', '/career/key-positions/' + k.id + '/successors', { employeeId: Number(v.employeeId), readiness: v.readiness }); close(); st.reload(); }} />));
  const setRisk = (e) => modal(t('Risque de départ — {name}', { name: e.name }), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'employeeId', label: t('Personne'), type: 'select', value: String(e.employeeId), options: active.map((x) => [String(x.employeeId), x.name]) }, { k: 'risk', label: t('Risque'), type: 'select', value: e.risk || 'low', options: [['low', t('Faible')], ['medium', t('Moyen')], ['high', t('Élevé')]] }, { k: 'reason', label: t('Raisons'), value: e.reason || '' }, { k: 'plan', label: t('Plan de rétention'), type: 'textarea', rows: 3, value: e.plan || '' }]}
    onSubmit={async (v) => { await tp('PUT', '/career/retention/' + v.employeeId, { risk: v.risk, reason: v.reason, plan: v.plan }); close(); ret.reload(); st.reload(); }} />));
  const addPath = () => modal(t('Parcours de carrière'), (close) => (
    <Form submitText={t('Ajouter')} fields={[{ k: 'fromJobId', label: t('De'), type: 'select', options: jobs.data.items.map((j) => [String(j.id), j.title]) }, { k: 'toJobId', label: t('Vers'), type: 'select', options: jobs.data.items.map((j) => [String(j.id), j.title]) }, { k: 'typicalYears', label: t('Années habituelles'), type: 'number', value: '2' }]}
    onSubmit={async (v) => { await tp('POST', '/career/paths', { fromJobId: Number(v.fromJobId), toJobId: Number(v.toJobId), typicalYears: Number(v.typicalYears) }); close(); paths.reload(); }} />));
  return (
    <div className="tl-grid">
      <Loaded state={st}>{(s) => (
        <>
          <div className="tl-kpis"><Panel title={t('Postes clés')}><b>{s.summary.positions}</b></Panel><Panel title={t('Risque critique')}><b>{s.summary.critical}</b></Panel><Panel title={t('Risque élevé')}><b>{s.summary.high}</b></Panel><Panel title={t('Sans successeur')}><b>{s.summary.noSuccessor}</b></Panel><Panel title={t('Avec un successeur prêt')}><b>{s.summary.covered}</b></Panel></div>
          <Panel title={t('Postes clés et successeurs')} actions={<Button size="sm" variant="primary" onClick={addKey}>{t('Ajouter un poste clé')}</Button>} note={t("Risque de vacance : criticité du poste, titulaire à risque de départ ou proche de la retraite, et préparation des successeurs.")}>
            {!s.items.length ? <p className="ws-empty">{t('Aucun poste clé : identifiez les postes dont l’absence bloquerait l’entreprise.')}</p> : s.items.map((k) => (
              <div className="tl-row" key={k.id}>
                <span><b>{k.title}</b> <Badge tone={RISK_TONE[k.vacancyRisk]}>{RISK[k.vacancyRisk]}</Badge><br /><small className="tl-note">{k.vacant ? t('Vacant') : t('Titulaire : {name}', { name: k.holder })}{k.holderRisk !== 'low' ? ' · ' + t('risque de départ {r}', { r: RISK[k.holderRisk] }) : ''}</small><br />
                  {k.successors.map((x) => <Badge key={x.employeeId} tone={x.readiness === 'now' ? 'ok' : x.readiness === '1-2y' ? 'info' : 'neutral'}>{x.name} · {READY[x.readiness]}{x.coverage !== null ? ` · ${pct(x.coverage)}` : ''}</Badge>)}</span>
                <span className="row"><button className="link" type="button" onClick={() => addSucc(k)}>{t('Ajouter un successeur')}</button><button className="link" type="button" onClick={() => confirm(t('Supprimer le poste clé « {name} » ?', { name: k.title }), () => act(tp('DELETE', '/career/key-positions/' + k.id), () => st.reload()))}>{t('Supprimer')}</button></span>
              </div>
            ))}
          </Panel>
        </>
      )}
      </Loaded>
      <Panel title={t('Risque de départ et rétention')} actions={<Button size="sm" onClick={() => setRisk({})}>{t('Évaluer une personne')}</Button>}>
        <Loaded state={ret}>{(r) => (
          <Table rows={r.items} rowKey="employeeId" empty={t('Aucune évaluation du risque de départ.')} columns={[{ key: 'employee', label: t('Personne'), render: (x) => <b>{x.employee}</b> }, { key: 'risk', label: t('Risque'), render: (x) => <Badge tone={x.risk === 'high' ? 'danger' : x.risk === 'medium' ? 'warn' : 'ok'}>{({ low: t('Faible'), medium: t('Moyen'), high: t('Élevé') })[x.risk]}</Badge> }, { key: 'reason', label: t('Raisons') }, { key: 'plan', label: t('Plan de rétention') }, { key: 'actions', label: t('Actions'), align: 'r' },
            { key: 'a', label: '', render: (x) => <button className="link" type="button" onClick={() => setRisk(x)}>{t('Modifier')}</button> }]} />
        )}
        </Loaded>
      </Panel>
      <Panel title={t('Parcours de carrière')} actions={<Button size="sm" onClick={addPath}>{t('Ajouter un parcours')}</Button>} note={t("La fiche de chaque personne montre, pour les emplois suivants, sa couverture des compétences et sa préparation.")}>
        <Loaded state={paths}>{(p) => (!p.items.length ? <p className="ws-empty">{t('Aucun parcours défini.')}</p> : p.items.map((x) => <div className="tl-row" key={x.id}><span><b>{x.from}</b> → <b>{x.to}</b></span><span className="tl-note">{t('{n} an(s) en général', { n: x.typicalYears })}</span></div>))}</Loaded>
      </Panel>
    </div>
  );
}

export function Engagement() {
  const t = useT();
  const { modal } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const list = useLoad(() => tp('GET', '/engagement/surveys'), []);
  const trend = useLoad(() => (has('talent') ? tp('GET', '/engagement/trend') : Promise.resolve(null)), []);
  const acts = useLoad(() => (has('talent') ? tp('GET', '/actions?kind=engagement') : Promise.resolve(null)), []);
  const [res, setRes] = useState(null);
  const create = () => modal(t('Nouvelle enquête'), (close) => (
    <Form submitText={t('Créer')} fields={[{ k: 'title', label: t('Titre'), required: true }, { k: 'minResponses', label: t('Seuil minimum de réponses pour voir les résultats'), type: 'number', value: '5' }, { k: 'questions', label: t('Questions (une par ligne, notées de 1 à 5)'), type: 'textarea', rows: 5, value: t('Je me sens soutenu par mon responsable') + '\n' + t('Je comprends les objectifs de mon équipe') }]}
    onSubmit={async (v) => { await tp('POST', '/engagement/surveys', { title: v.title, minResponses: Number(v.minResponses), questions: v.questions.split('\n').map((x) => x.trim()).filter(Boolean) }); close(); list.reload(); }} />));
  const answer = (s) => modal(s.title, (close) => <Respond s={s} close={close} done={list.reload} />, { wide: true });
  const results = (s) => tp('GET', '/engagement/surveys/' + s.id + '/results').then((r) => setRes(r)).catch((e) => act(Promise.reject(e)));
  const addAct = () => modal(t("Plan d'action"), (close) => <Form submitText={t('Ajouter')} fields={[{ k: 'title', label: t('Action'), required: true }, { k: 'dueDate', label: t('Échéance'), type: 'date' }]} onSubmit={async (v) => { await tp('POST', '/actions', { kind: 'engagement', title: v.title, dueDate: v.dueDate || null, refId: res ? res.id : undefined }); close(); acts.reload(); }} />);
  return (
    <div className="tl-grid">
      <Panel title={t('Enquêtes d’engagement')} actions={has('talent') ? <Button size="sm" variant="primary" onClick={create}>{t('Nouvelle enquête')}</Button> : null} note={t("Les réponses sont anonymes : aucune réponse n'est reliée à une personne, et les résultats n'apparaissent qu'à partir du seuil de réponses.")}>
        <Loaded state={list}>{(l) => (!l.items.length ? <p className="ws-empty">{t('Aucune enquête ouverte.')}</p> : l.items.map((s) => (
          <div className="tl-row" key={s.id}><span><b>{s.title}</b> <Badge tone={s.status === 'open' ? 'ok' : 'neutral'}>{({ draft: t('Brouillon'), open: t('Ouverte'), closed: t('Clôturée') })[s.status]}</Badge>{s.responses !== undefined ? <small className="tl-note"> {t('{n} réponse(s)', { n: s.responses })}</small> : null}</span>
            <span className="row">
              {s.status === 'open' && !s.answered ? <Button size="sm" variant="primary" onClick={() => answer(s)}>{t('Répondre')}</Button> : s.answered ? <Badge tone="ok">{t('Merci, déjà répondu')}</Badge> : null}
              {has('talent') ? <><button className="link" type="button" onClick={() => results(s)}>{t('Résultats')}</button>{s.status !== 'closed' ? <button className="link" type="button" onClick={() => act(tp('PUT', '/engagement/surveys/' + s.id + '/status', { status: s.status === 'draft' ? 'open' : 'closed' }), list.reload)}>{s.status === 'draft' ? t('Ouvrir') : t('Clôturer')}</button> : null}</> : null}</span></div>
        )))}
        </Loaded>
      </Panel>
      {res ? (res.hidden ? <Panel title={res.title}><p className="ws-empty">{t('Seulement {n} réponse(s) sur {m} requises : résultats masqués pour protéger l’anonymat.', { n: res.responses, m: res.minResponses })}</p></Panel> : (
        <Panel title={t('Résultats : {title}', { title: res.title })} subtitle={t('Participation {n}', { n: pct(res.participation) })}>
          <div className="tl-kpis"><Panel title="eNPS"><b>{res.enps.score}</b><br /><small className="tl-note">{t('{p} promoteurs · {n} passifs · {d} détracteurs', { p: res.enps.promoters, n: res.enps.passives, d: res.enps.detractors })}</small></Panel><Panel title={t('Score moyen /5')}><b>{num1(res.avg)}</b></Panel></div>
          <ChartFrame title={t('Réponses par question')} summary={t('Moyenne de chaque question')}><Bars data={res.questions.map((q) => ({ x: q.text.slice(0, 28), avg: q.avg }))} series={[{ key: 'avg', label: t('Moyenne /5') }]} /></ChartFrame>
          {res.departmentsHidden ? <p className="tl-note">{t('Le détail par service est masqué : un service compte trop peu de réponses.')}</p> : res.departments.length ? <Table rows={res.departments} rowKey="departmentId" columns={[{ key: 'name', label: t('Service') }, { key: 'responses', label: t('Réponses'), align: 'r' }, { key: 'enps', label: 'eNPS', align: 'r' }, { key: 'avg', label: t('Moyenne /5'), align: 'r', render: (d) => num1(d.avg) }]} /> : null}
        </Panel>
      )) : null}
      {has('talent') ? (
        <>
          <Panel title={t('Évolution de l’eNPS')}><Loaded state={trend}>{(tr) => (tr.items.filter((x) => x.enps !== null).length ? <ChartFrame title={t('eNPS par enquête')} summary={t('Évolution de l’eNPS')}><Bars data={tr.items.filter((x) => x.enps !== null).map((x) => ({ x: x.title.slice(0, 20), enps: x.enps }))} series={[{ key: 'enps', label: 'eNPS' }]} /></ChartFrame> : <p className="ws-empty">{t('Pas encore de résultat publiable.')}</p>)}</Loaded></Panel>
          <Panel title={t("Plans d'action d'engagement")} actions={<Button size="sm" onClick={addAct}>{t('Ajouter une action')}</Button>}>
            <Loaded state={acts}>{(a) => (!a.items.length ? <p className="ws-empty">{t('Aucune action.')}</p> : a.items.map((x) => <div className="tl-row" key={x.id}><b>{x.title}</b><select aria-label={t('Statut')} value={x.status} onChange={(e) => act(tp('PUT', '/actions/' + x.id, { status: e.target.value }), acts.reload)}>{[['todo', t('À faire')], ['doing', t('En cours')], ['done', t('Fait')], ['cancelled', t('Annulé')]].map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></div>))}</Loaded>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function Respond({ s, close, done }) {
  const t = useT();
  const { tp } = useTl();
  const act = useAct();
  const [a, setA] = useState({});
  const ok = s.questions.every((q) => a[q.id] !== undefined && a[q.id] !== '');
  return (
    <div className="ws-form">
      <p className="tl-note">{t('Réponse anonyme : personne ne saura ce que vous avez répondu.')}</p>
      {s.questions.map((q) => (
        <label className="fld" key={q.id}><span>{q.text}</span>
          <select value={a[q.id] ?? ''} onChange={(e) => setA({ ...a, [q.id]: e.target.value })}><option value="">{t('Note…')}</option>{(q.kind === 'enps' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5]).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      ))}
      <Button variant="primary" disabled={!ok} onClick={() => act(tp('POST', '/engagement/surveys/' + s.id + '/respond', { answers: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Number(v)])) }), () => { close(); done(); }, t('Merci pour votre réponse'))}>{t('Envoyer')}</Button>
    </div>
  );
}
