import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, ChartFrame, Form, Loaded, Table, useLoad } from '../../ui.jsx';
import { Donut } from '../../charts/lazy.jsx';
import { Locked, Panel, levelOpts, num1, pct, useAct, useTl, yearNow } from './common.jsx';

/* Formation et développement des compétences : catalogue, budget annuel, demandes, sessions, présence, évaluations à chaud / à froid, certificats,
   lien avec les écarts de compétences. */

export default function Training() {
  const t = useT();
  const { modal, money, dateFr, confirm } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const [year, setYear] = useState(yearNow());
  const isHr = has('talent');
  const courses = useLoad(() => (isHr ? tp('GET', '/training/courses') : tp('GET', '/training/requests?year=' + year)), [isHr]);
  const comps = useLoad(() => (isHr ? tp('GET', '/competencies') : Promise.resolve({ items: [] })), []);
  const reqs = useLoad(() => tp('GET', '/training/requests?year=' + year), [year]);
  const sess = useLoad(() => (isHr ? tp('GET', '/training/sessions') : Promise.resolve({ items: [] })), []);
  const sum = useLoad(() => (isHr ? tp('GET', '/training/summary?year=' + year) : Promise.resolve(null)), [year]);
  const sug = useLoad(() => (isHr ? tp('GET', '/training/suggestions') : Promise.resolve(null)), []);
  const emps = useLoad(() => (isHr ? tp('GET', '/profiles') : Promise.resolve({ items: [] })), []);
  const all = () => { courses.reload(); reqs.reload(); sess.reload(); sum.reload(); sug.reload(); };
  if (!isHr) return <MyTraining reqs={reqs} />;
  const addCourse = () => modal(t('Nouvelle formation'), (close) => <CourseForm comps={comps.data ? comps.data.items : []} close={close} done={all} />, { wide: true });
  const budget = () => modal(t('Budget de formation {year}', { year }), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'amount', label: t('Montant annuel'), type: 'number', value: sum.data ? String(sum.data.budget.amount) : '0' }]}
      onSubmit={async (v) => { await tp('PUT', '/training/budget', { year, amount: Number(v.amount) }); close(); all(); }} />));
  const request = (employeeId, courseId) => act(tp('POST', '/training/requests', { employeeId, courseId, year, reason: t("Écart de compétence") }), all, t('Demande créée'));
  const addSession = () => modal(t('Nouvelle session'), (close) => (
    <Form submitText={t('Créer')} fields={[{ k: 'courseId', label: t('Formation'), type: 'select', options: (courses.data ? courses.data.items : []).map((c) => [String(c.id), c.title]) }, { k: 'startDate', label: t('Début'), type: 'date', required: true }, { k: 'endDate', label: t('Fin'), type: 'date' }, { k: 'place', label: t('Lieu') }, { k: 'trainer', label: t('Formateur') }, { k: 'capacity', label: t('Places (0 = illimité)'), type: 'number', value: '0' }]}
    onSubmit={async (v) => { await tp('POST', '/training/sessions', { ...v, courseId: Number(v.courseId), capacity: Number(v.capacity), endDate: v.endDate || null }); close(); sess.reload(); }} />));
  const openSession = (s) => modal(`${s.course} — ${dateFr(s.startDate)}`, (close) => <Session s={s} emps={(emps.data ? emps.data.items : []).filter((e) => e.status === 'active')} close={close} done={all} />, { wide: true });
  return (
    <div className="tl-grid">
      <Loaded state={sum}>{(s) => (
        <>
          <div className="tl-kpis">
            <Panel title={t('Budget {year}', { year })} actions={<Button size="sm" onClick={budget}>{t('Définir')}</Button>}><b>{money(s.budget.amount)}</b><br /><small className="tl-note">{t('Engagé {a} · reste {b}', { a: money(s.budget.committed), b: money(s.budget.remaining) })}</small></Panel>
            <Panel title={t('Sessions réalisées')}><b>{s.sessions}</b></Panel><Panel title={t('Taux de présence')}><b>{pct(s.attendanceRate)}</b></Panel>
            <Panel title={t('Satisfaction à chaud / à froid')}><b>{num1(s.hotAvg)} / {num1(s.coldAvg)}</b></Panel><Panel title={t('Coût par participant')}><b>{s.costPerParticipant === null ? '—' : money(s.costPerParticipant)}</b></Panel>
          </div>
          <div className="tl-2">
            <ChartFrame title={t('Utilisation du budget')} summary={t('Budget engagé et restant')}>
              <Donut data={[{ name: t('Engagé'), value: Math.max(s.budget.committed, 0) }, { name: t('Restant'), value: Math.max(s.budget.remaining, 0) }].filter((d) => d.value)} fmt={(v) => money(v)} center={s.budget.usedPct === null ? '—' : pct(s.budget.usedPct)} sub={t('utilisé')} />
            </ChartFrame>
            <Panel title={t('Écarts de compétences à combler')} subtitle={t('{n} écart(s), {m} sans formation adaptée', { n: sug.data ? sug.data.summary.gaps : 0, m: sug.data ? sug.data.summary.uncovered : 0 })}>
              <Loaded state={sug}>{(g) => (!g.items.length ? <p className="ws-empty">{t('Aucun écart : bravo.')}</p> : g.items.slice(0, 8).map((i) => (
                <div className="tl-row" key={i.employeeId + '-' + i.competencyId}><span><b>{i.employee}</b> <small className="tl-note">{t('niveau {h} / {r} requis', { h: i.held, r: i.required })}</small></span>
                  {i.courses[0] ? <Button size="sm" onClick={() => request(i.employeeId, i.courses[0].id)}>{i.courses[0].title}</Button> : <Badge tone="warn">{t('Aucune formation')}</Badge>}</div>
              )))}
              </Loaded>
            </Panel>
          </div>
        </>
      )}
      </Loaded>
      <Panel title={t('Catalogue de formations')} actions={<Button size="sm" variant="primary" onClick={addCourse}>{t('Ajouter une formation')}</Button>}>
        <Loaded state={courses}>{(c) => (
          <Table rows={c.items} empty={t('Catalogue vide.')} columns={[
            { key: 'title', label: t('Formation'), render: (r) => <b>{r.title}</b> }, { key: 'provider', label: t('Organisme') }, { key: 'hours', label: t('Heures'), align: 'r' }, { key: 'unitCost', label: t('Coût'), align: 'r', render: (r) => money(r.unitCost) },
            { key: 'c', label: t('Compétences visées'), render: (r) => r.competencies.map((k) => <Badge key={k.competencyId} tone="info">{k.name} → {k.targetLevel}</Badge>) },
            { key: 'a', label: '', render: (r) => <button className="link" type="button" onClick={() => confirm(t('Supprimer la formation « {name} » ?', { name: r.title }), () => act(tp('DELETE', '/training/courses/' + r.id), all))}>{t('Supprimer')}</button> }]} />
        )}
        </Loaded>
      </Panel>
      <Panel title={t('Plan de formation {year}', { year })} actions={<input type="number" aria-label={t('Année')} value={year} onChange={(e) => setYear(Number(e.target.value) || yearNow())} style={{ width: 90 }} />}>
        <Loaded state={reqs}>{(r) => (
          <Table rows={r.items} empty={t('Aucune demande.')} columns={[
            { key: 'employee', label: t('Personne') }, { key: 'course', label: t('Formation') }, { key: 'estCost', label: t('Coût estimé'), align: 'r', render: (x) => money(x.estCost) },
            { key: 'status', label: t('État'), render: (x) => <Badge tone={x.status === 'refused' ? 'danger' : x.status === 'requested' ? 'warn' : 'ok'}>{({ requested: t('Demandée'), approved: t('Acceptée'), planned: t('Planifiée'), done: t('Réalisée'), refused: t('Refusée') })[x.status]}</Badge> },
            { key: 'a', label: '', render: (x) => (x.status === 'requested' ? <span className="row"><button className="link" type="button" onClick={() => act(tp('PUT', '/training/requests/' + x.id + '/decision', { decision: 'approved' }), (j) => { if (j && j.overBudget) modal(t('Budget dépassé'), () => <p>{t('Cette demande dépasse le budget annuel de formation.')}</p>); all(); })}>{t('Accepter')}</button><button className="link" type="button" onClick={() => act(tp('PUT', '/training/requests/' + x.id + '/decision', { decision: 'refused' }), all)}>{t('Refuser')}</button></span> : null) }]} />
        )}
        </Loaded>
      </Panel>
      <Panel title={t('Sessions')} actions={<Button size="sm" onClick={addSession}>{t('Nouvelle session')}</Button>}>
        <Loaded state={sess}>{(s) => (
          <Table rows={s.items} empty={t('Aucune session.')} onRowClick={openSession} columns={[
            { key: 'course', label: t('Formation'), render: (r) => <b>{r.course}</b> }, { key: 'startDate', label: t('Date'), render: (r) => dateFr(r.startDate) }, { key: 'place', label: t('Lieu') },
            { key: 'p', label: t('Participants'), align: 'r', render: (r) => `${r.present}/${r.attendees}${r.capacity ? ' · ' + r.capacity : ''}` }, { key: 'status', label: t('État'), render: (r) => <Badge tone={r.status === 'done' ? 'ok' : 'neutral'}>{r.status === 'done' ? t('Clôturée') : t('Prévue')}</Badge> }]} />
        )}
        </Loaded>
      </Panel>
    </div>
  );
}

function CourseForm({ comps, close, done }) {
  const t = useT();
  const { tp } = useTl();
  const [rows, setRows] = useState([]);
  const set = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <>
      <Form submitText={t('Enregistrer')} fields={[{ k: 'title', label: t('Titre'), required: true }, { k: 'category', label: t('Catégorie') }, { k: 'provider', label: t('Organisme') }, { k: 'hours', label: t('Durée (heures)'), type: 'number', value: '8' }, { k: 'unitCost', label: t('Coût par participant'), type: 'number', value: '0' }, { k: 'description', label: t('Description'), type: 'textarea', rows: 2 }]}
        onSubmit={async (v) => { const r = await tp('POST', '/training/courses', { ...v, hours: Number(v.hours), unitCost: Number(v.unitCost) }); if (rows.length) await tp('PUT', '/training/courses/' + r.id + '/competencies', { competencies: rows.filter((x) => x.competencyId).map((x) => ({ competencyId: Number(x.competencyId), targetLevel: Number(x.targetLevel) })) }); close(); done(); }} />
      <h3>{t('Compétences développées')}</h3>
      {rows.map((r, i) => <div className="row" key={i}>
        <select aria-label={t('Compétence')} value={r.competencyId} onChange={(e) => set(i, 'competencyId', e.target.value)}><option value="">{t('Choisir…')}</option>{comps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select aria-label={t('Niveau visé')} value={r.targetLevel} onChange={(e) => set(i, 'targetLevel', e.target.value)}>{levelOpts.map((o) => <option key={o[0]} value={o[0]}>{t('Niveau visé')} {o[1]}</option>)}</select></div>)}
      <Button size="sm" onClick={() => setRows((x) => [...x, { competencyId: '', targetLevel: '4' }])}>{t('Ajouter une compétence')}</Button>
    </>
  );
}

function Session({ s, emps, close, done }) {
  const t = useT();
  const { tp } = useTl();
  const act = useAct();
  const det = useLoad(() => tp('GET', '/training/sessions/' + s.id), []);
  const [add, setAdd] = useState('');
  const reload = () => { det.reload(); done(); };
  return (
    <Loaded state={det}>{(d) => (
      <div className="tl-grid">
        {d.session.status === 'planned' ? <div className="row"><select aria-label={t('Ajouter un participant')} value={add} onChange={(e) => setAdd(e.target.value)}><option value="">{t('Ajouter un participant…')}</option>{emps.map((e) => <option key={e.employeeId} value={e.employeeId}>{e.name}</option>)}</select>
          <Button size="sm" disabled={!add} onClick={() => act(tp('POST', '/training/sessions/' + s.id + '/attendees', { employeeIds: [Number(add)] }), () => { setAdd(''); reload(); })}>{t('Inscrire')}</Button></div> : null}
        <Table rows={d.attendees} rowKey="employeeId" empty={t('Aucun participant.')} columns={[
          { key: 'employee', label: t('Participant'), render: (a) => <b>{a.employee}</b> },
          { key: 'presence', label: t('Présence'), render: (a) => <select aria-label={t('Présence')} value={a.presence} disabled={d.session.status !== 'planned'} onChange={(e) => act(tp('PUT', '/training/sessions/' + s.id + '/attendance', { employeeId: a.employeeId, presence: e.target.value }), reload)}><option value="registered">{t('Inscrit')}</option><option value="present">{t('Présent')}</option><option value="absent">{t('Absent')}</option></select> },
          { key: 'hot', label: t('À chaud'), render: (a) => <select aria-label={t('À chaud')} value={a.hot || ''} disabled={a.presence !== 'present'} onChange={(e) => e.target.value && act(tp('PUT', '/training/sessions/' + s.id + '/evaluation', { kind: 'hot', employeeId: a.employeeId, score: Number(e.target.value) }), reload)}><option value="">—</option>{levelOpts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select> },
          { key: 'cold', label: t('À froid'), render: (a) => <select aria-label={t('À froid')} value={a.cold || ''} disabled={a.presence !== 'present'} onChange={(e) => e.target.value && act(tp('PUT', '/training/sessions/' + s.id + '/evaluation', { kind: 'cold', employeeId: a.employeeId, score: Number(e.target.value) }), reload)}><option value="">—</option>{levelOpts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select> },
          { key: 'cert', label: t('Certificat'), render: (a) => (a.certNo ? <Badge tone="ok">{a.certNo}</Badge> : a.presence === 'present' ? <button className="link" type="button" onClick={() => { const no = window.prompt(t('Numéro du certificat')); if (no) act(tp('PUT', '/training/sessions/' + s.id + '/certificate', { employeeId: a.employeeId, certNo: no }), reload); }}>{t('Délivrer')}</button> : '—') }]} />
        {d.session.status === 'planned' ? <div className="row"><Button variant="primary" onClick={() => act(tp('POST', '/training/sessions/' + s.id + '/close', {}), () => { close(); done(); }, t('Session clôturée : les compétences des présents sont mises à jour.'))}>{t('Clôturer la session')}</Button><small className="tl-note">{t('Les présents montent au niveau visé de chaque compétence de la formation.')}</small></div> : null}
      </div>
    )}
    </Loaded>
  );
}

/** Vue d'un membre : ses demandes de formation et la possibilité d'en faire une. */
function MyTraining({ reqs }) {
  const t = useT();
  const { me } = useTl();
  if (!me || !me.employee) return <Locked what={t("Votre compte n'est lié à aucune fiche employé.")} />;
  return (
    <Panel title={t('Mes demandes de formation')}>
      <Loaded state={reqs}>{(r) => (!r.items.length ? <p className="ws-empty">{t('Aucune demande de formation.')}</p> : r.items.map((x) => <div className="tl-row" key={x.id}><b>{x.course}</b><Badge>{x.status}</Badge></div>))}</Loaded>
      <small className="tl-note">{t("Pour demander une formation, rapprochez-vous de votre responsable ou de la RH.")}</small>
    </Panel>
  );
}
