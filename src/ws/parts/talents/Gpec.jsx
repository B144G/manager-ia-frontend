import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, ChartFrame, EmptyState, Form, Loaded, Table, useLoad } from '../../ui.jsx';
import { Bars, HBars } from '../../charts/lazy.jsx';
import { Bar, Legend, Locked, Panel, RadarView, levelOpts, num1, pct, useAct, useTl, yearNow } from './common.jsx';

/* GPEC : référentiel des compétences et des emplois, compétences par employé, matrice (heatmap), écarts requis / détenus, besoins futurs, plan d'actions. */

export function Referential() {
  const t = useT();
  const { modal, confirm } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const w = has('talent');
  const comps = useLoad(() => tp('GET', '/competencies'), []);
  const jobs = useLoad(() => tp('GET', '/job-profiles'), []);
  const deps = useLoad(() => tp('GET', '/departments'), []);
  const reload = () => { comps.reload(); jobs.reload(); deps.reload(); };
  const addComp = () => modal(t('Nouvelle compétence'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'name', label: t('Nom'), required: true }, { k: 'category', label: t('Catégorie'), placeholder: t('Ex. Métier, Comportement, Technique') }, { k: 'description', label: t('Description'), type: 'textarea', rows: 2 }]}
      onSubmit={async (v) => { await tp('POST', '/competencies', v); close(); reload(); }} />));
  const addDep = () => modal(t('Nouveau service'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'name', label: t('Nom'), required: true }, { k: 'budgetHeadcount', label: t('Effectif budgété'), type: 'number', value: '0' }]}
      onSubmit={async (v) => { await tp('POST', '/departments', v); close(); reload(); }} />));
  const editJob = (j) => modal(j ? t("Modifier l'emploi") : t('Nouvel emploi'), (close) => <JobForm job={j} comps={comps.data ? comps.data.items : []} deps={deps.data ? deps.data.items : []} close={close} done={reload} />, { wide: true });
  return (
    <div className="tl-grid">
      <Panel title={t('Emplois et compétences requises')} actions={w ? <Button size="sm" variant="primary" onClick={() => editJob(null)}>{t('Ajouter un emploi')}</Button> : null} note={t('Chaque emploi liste les compétences attendues avec un niveau de 1 (notions) à 5 (expert) et un poids.')}>
        <Loaded state={jobs}>{(j) => (
          <Table rows={j.items} empty={t('Aucun emploi défini.')} columns={[
            { key: 'title', label: t('Emploi'), render: (r) => <><b>{r.title}</b> <small className="tl-note">{r.family}</small></> },
            { key: 'competencies', label: t('Compétences requises'), render: (r) => r.competencies.map((c) => <Badge key={c.competencyId} tone="info">{c.name} · {c.requiredLevel}</Badge>) },
            { key: 'holders', label: t('Titulaires'), align: 'r' },
            { key: 'a', label: '', render: (r) => (w ? <span className="row"><button className="link" type="button" onClick={() => editJob(r)}>{t('Modifier')}</button><button className="link" type="button" onClick={() => confirm(t("Supprimer l'emploi « {name} » ?", { name: r.title }), () => act(tp('DELETE', '/job-profiles/' + r.id), reload))}>{t('Supprimer')}</button></span> : null) },
          ]} />
        )}
        </Loaded>
      </Panel>
      <div className="tl-2">
        <Panel title={t('Compétences')} actions={w ? <Button size="sm" onClick={addComp}>{t('Ajouter')}</Button> : null}>
          <Loaded state={comps}>{(c) => (!c.items.length ? <p className="ws-empty">{t('Aucune compétence : commencez par en créer quelques-unes.')}</p> : c.items.map((x) => (
            <div className="tl-row" key={x.id}><span><b>{x.name}</b> <small className="tl-note">{x.category}</small></span>{w ? <button className="link" type="button" onClick={() => confirm(t('Supprimer la compétence « {name} » ?', { name: x.name }), () => act(tp('DELETE', '/competencies/' + x.id), reload))}>{t('Supprimer')}</button> : null}</div>
          )))}
          </Loaded>
        </Panel>
        <Panel title={t('Services')} actions={w ? <Button size="sm" onClick={addDep}>{t('Ajouter')}</Button> : null}>
          <Loaded state={deps}>{(d) => (!d.items.length ? <p className="ws-empty">{t('Aucun service.')}</p> : d.items.map((x) => (
            <div className="tl-row" key={x.id}><span><b>{x.name}</b></span><span className="tl-note">{t('{n} en poste, {b} budgétés', { n: x.headcount, b: x.budgetHeadcount })}</span></div>
          )))}
          </Loaded>
        </Panel>
      </div>
      <Profiles deps={deps} jobs={jobs} />
    </div>
  );
}

function JobForm({ job, comps, deps, close, done }) {
  const t = useT();
  const { tp } = useTl();
  const [rows, setRows] = useState(job ? job.competencies.map((c) => ({ competencyId: String(c.competencyId), requiredLevel: String(c.requiredLevel), weight: String(c.weight) })) : []);
  const set = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <>
      <Form submitText={t('Enregistrer')} fields={[
        { k: 'title', label: t('Intitulé'), value: job ? job.title : '', required: true }, { k: 'family', label: t('Famille de métiers'), value: job ? job.family : '' },
        { k: 'departmentId', label: t('Service'), type: 'select', value: job && job.departmentId ? String(job.departmentId) : '', options: [['', t('Aucun')], ...deps.map((d) => [String(d.id), d.name])] },
        { k: 'description', label: t('Mission'), type: 'textarea', rows: 3, value: job ? job.description : '' }]}
      onSubmit={async (v) => {
        const body = { ...v, departmentId: v.departmentId || null };
        const id = job ? job.id : (await tp('POST', '/job-profiles', body)).id;
        if (job) await tp('PUT', '/job-profiles/' + id, body);
        await tp('PUT', '/job-profiles/' + id + '/competencies', { competencies: rows.filter((r) => r.competencyId).map((r) => ({ competencyId: Number(r.competencyId), requiredLevel: Number(r.requiredLevel), weight: Number(r.weight) })) });
        close(); done();
      }} />
      <h3>{t('Compétences requises')}</h3>
      {rows.map((r, i) => (
        <div className="row" key={i}>
          <select aria-label={t('Compétence')} value={r.competencyId} onChange={(e) => set(i, 'competencyId', e.target.value)}><option value="">{t('Choisir…')}</option>{comps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label={t('Niveau requis')} value={r.requiredLevel} onChange={(e) => set(i, 'requiredLevel', e.target.value)}>{levelOpts.map((o) => <option key={o[0]} value={o[0]}>{t('Niveau')} {o[1]}</option>)}</select>
          <select aria-label={t('Poids')} value={r.weight} onChange={(e) => set(i, 'weight', e.target.value)}>{levelOpts.map((o) => <option key={o[0]} value={o[0]}>{t('Poids')} {o[1]}</option>)}</select>
          <button className="link" type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>{t('Retirer')}</button>
        </div>
      ))}
      <Button size="sm" onClick={() => setRows((x) => [...x, { competencyId: '', requiredLevel: '3', weight: '1' }])}>{t('Ajouter une compétence')}</Button>
    </>
  );
}

/** Rattachement de chaque employé à un service, un emploi, un responsable et un genre (utile à la GPEC, aux KPI, au 360° et aux objectifs). */
function Profiles({ deps, jobs }) {
  const t = useT();
  const { modal } = useWs();
  const { tp, has } = useTl();
  const st = useLoad(() => tp('GET', '/profiles'), []);
  if (!has('talent')) return null;
  const edit = (e, all) => modal(e.name, (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'departmentId', label: t('Service'), type: 'select', value: e.departmentId ? String(e.departmentId) : '', options: [['', t('Aucun')], ...(deps.data ? deps.data.items : []).map((d) => [String(d.id), d.name])] },
      { k: 'jobProfileId', label: t('Emploi'), type: 'select', value: e.jobProfileId ? String(e.jobProfileId) : '', options: [['', t('Aucun')], ...(jobs.data ? jobs.data.items : []).map((d) => [String(d.id), d.title])] },
      { k: 'managerId', label: t('Responsable direct'), type: 'select', value: e.managerId ? String(e.managerId) : '', options: [['', t('Aucun')], ...all.filter((x) => x.employeeId !== e.employeeId && x.status === 'active').map((x) => [String(x.employeeId), x.name])] },
      { k: 'gender', label: t('Genre'), type: 'select', value: e.gender, options: [['', t('Non renseigné')], ['F', t('Femme')], ['M', t('Homme')]] },
      { k: 'level', label: t('Échelon'), type: 'number', value: String(e.level) }]}
    onSubmit={async (v) => { await tp('PUT', '/profiles/' + e.employeeId, { departmentId: v.departmentId || null, jobProfileId: v.jobProfileId || null, managerId: v.managerId || null, gender: v.gender, level: Number(v.level) }); close(); st.reload(); jobs.reload(); deps.reload(); }} />));
  return (
    <Panel title={t('Rattachement des employés')} note={t("Service, emploi, responsable direct et genre : ils alimentent la GPEC, les objectifs, le 360° et les indicateurs.")}>
      <Loaded state={st}>{(j) => (
        <Table rows={j.items.filter((e) => e.status === 'active')} rowKey="employeeId" empty={t('Aucun employé.')} columns={[
          { key: 'name', label: t('Nom'), render: (e) => <b>{e.name}</b> }, { key: 'job', label: t('Poste'), render: (e) => e.job },
          { key: 'dep', label: t('Service'), render: (e) => (e.departmentId ? (deps.data && (deps.data.items.find((d) => d.id === e.departmentId) || {}).name) : '—') },
          { key: 'jp', label: t('Emploi (référentiel)'), render: (e) => (e.jobProfileId ? (jobs.data && (jobs.data.items.find((d) => d.id === e.jobProfileId) || {}).title) : '—') },
          { key: 'a', label: '', render: (e) => <button className="link" type="button" onClick={() => edit(e, j.items)}>{t('Modifier')}</button> }]} />
      )}
      </Loaded>
    </Panel>
  );
}

const cellClass = (c) => (!c.level ? (c.required ? 'gap2' : 'l0') : c.required ? (c.gap > 1 ? 'gap2' : c.gap > 0 ? 'gap1' : 'ok') : 'l0');
/** Matrice des compétences (heatmap) : chaque cellule = niveau détenu ; couleur = écart avec le niveau requis par l'emploi. */
export function Matrix() {
  const t = useT();
  const { modal } = useWs();
  const { tp, has } = useTl();
  const st = useLoad(() => (has('talent') ? tp('GET', '/gpec/matrix') : Promise.resolve(null)), []);
  if (!has('talent')) return <Locked />;
  const setLevel = (row, comp, c) => modal(`${row.name} — ${comp.name}`, (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'level', label: t('Niveau détenu (1 à 5)'), type: 'select', value: String(c.level || 3), options: levelOpts }]}
      onSubmit={async (v) => { await tp('PUT', '/skills', { employeeId: row.employeeId, competencyId: comp.id, level: Number(v.level) }); close(); st.reload(); }} />));
  return (
    <Panel title={t('Matrice des compétences')} note={t('Cliquez sur une cellule pour évaluer. 0 = non évaluée.')}>
      <Loaded state={st}>{(m) => (!m.competencies.length || !m.rows.length ? <EmptyState title={t('Créez des compétences et des employés pour construire la matrice.')} /> : (
        <>
          <Legend items={[['var(--ok-soft)', t('Niveau requis atteint')], ['var(--warn-soft)', t('Écart de 1')], ['var(--danger-soft)', t('Écart de 2 ou plus / absente')], ['var(--surface-3)', t('Sans exigence')]]} />
          <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={t('Matrice des compétences')}>
            <table className="tl-heat">
              <thead><tr><th className="r" scope="col">{t('Employé')}</th>{m.competencies.map((c) => <th key={c.id} scope="col">{c.name}</th>)}</tr></thead>
              <tbody>{m.rows.map((r) => (
                <tr key={r.employeeId}><th className="r" scope="row">{r.name}<br /><small className="tl-note">{r.job}</small></th>
                  {r.cells.map((c, i) => <td key={c.competencyId} className={cellClass(c)} onClick={() => setLevel(r, m.competencies[i], c)} style={{ cursor: 'pointer' }} title={c.required ? t('Requis : {n}', { n: c.required }) : t('Aucune exigence')}>{c.level || 0}{c.required ? <small>/{c.required}</small> : null}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </>
      ))}
      </Loaded>
    </Panel>
  );
}

/** Écarts compétences requises / détenues, par personne et par compétence, avec radar. */
export function Gaps() {
  const t = useT();
  const { tp, has } = useTl();
  const st = useLoad(() => (has('talent') ? tp('GET', '/gpec/gaps') : Promise.resolve(null)), []);
  const comps = useLoad(() => (has('talent') ? tp('GET', '/competencies') : Promise.resolve({ items: [] })), []);
  const [who, setWho] = useState('');
  if (!has('talent')) return <Locked />;
  const nm = (id) => ((comps.data && comps.data.items.find((c) => c.id === id)) || {}).name || '#' + id;
  return (
    <Loaded state={st}>{(g) => {
      const sel = g.items.find((i) => String(i.employeeId) === who) || g.items[0];
      return (
        <div className="tl-grid">
          <div className="tl-kpis">
            <Panel title={t('Couverture moyenne')}><b>{pct(g.summary.avgCoverage)}</b></Panel>
            <Panel title={t('Personnes avec écarts')}><b>{g.summary.withGaps} / {g.summary.assessed}</b></Panel>
            <Panel title={t('Écarts critiques')}><b>{g.summary.criticalGaps}</b></Panel>
          </div>
          <div className="tl-2">
            <ChartFrame title={t('Compétences les plus déficitaires')} subtitle={t('Nombre de personnes sous le niveau requis')} summary={t('Écarts par compétence')}>
              <HBars data={g.byCompetency.slice(0, 8).map((c) => ({ name: c.name || nm(c.competencyId), value: c.below }))} />
            </ChartFrame>
            <Panel title={t('Couverture par personne')}>
              {g.items.map((i) => <div className="tl-row" key={i.employeeId}><span><b>{i.name}</b> <small className="tl-note">{i.job}</small></span><span style={{ minWidth: 160 }}><Bar value={i.coverage} /> <small>{pct(i.coverage)}</small></span></div>)}
              {!g.items.length ? <p className="ws-empty">{t("Rattachez les employés à un emploi pour mesurer les écarts.")}</p> : null}
            </Panel>
          </div>
          {sel ? <PersonGap sel={sel} items={g.items} who={who || String(sel.employeeId)} setWho={setWho} nm={nm} /> : null}
        </div>
      );
    }}
    </Loaded>
  );
}
function PersonGap({ sel, items, who, setWho, nm }) {
  const t = useT();
  const { tp } = useTl();
  const sk = useLoad(() => tp('GET', '/skills?employeeId=' + sel.employeeId), [sel.employeeId]);
  const all = useLoad(() => tp('GET', '/job-profiles'), []);
  return (
    <Panel title={t('Profil requis et détenu')} actions={<select aria-label={t('Employé')} value={who} onChange={(e) => setWho(e.target.value)}>{items.map((i) => <option key={i.employeeId} value={i.employeeId}>{i.name}</option>)}</select>}>
      <Loaded state={sk}>{(s) => (
        <Loaded state={all}>{(jp) => {
          const job = jp.items.find((j) => j.title === sel.job);
          const held = new Map(s.items.map((x) => [x.competencyId, x.level]));
          const data = (job ? job.competencies : []).map((c) => ({ name: c.name, req: c.requiredLevel, held: held.get(c.competencyId) || 0 }));
          return data.length >= 3 ? <RadarView data={data} series={[{ key: 'req', label: t('Requis') }, { key: 'held', label: t('Détenu') }]} />
            : <ul>{sel.gaps.map((g) => <li key={g.competencyId}>{nm(g.competencyId)} : {g.held} / {g.required}</li>)}</ul>;
        }}
        </Loaded>
      )}
      </Loaded>
      <small className="tl-note">{t('Couverture {n}', { n: pct(sel.coverage) })}</small>
    </Panel>
  );
}

/** Besoins futurs vs ressources actuelles et plan d'actions. */
export function Needs() {
  const t = useT();
  const { modal, confirm, dateFr } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const [year, setYear] = useState(yearNow());
  const st = useLoad(() => (has('talent', 'remun') ? tp('GET', '/gpec/needs?year=' + year) : Promise.resolve(null)), [year]);
  const acts = useLoad(() => tp('GET', '/actions?kind=gpec'), []);
  const emps = useLoad(() => tp('GET', '/profiles'), []);
  if (!has('talent', 'remun')) return <Locked />;
  const setNeed = (i) => modal(i.title, (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'needed', label: t("Effectif nécessaire en {year}", { year }), type: 'number', value: String(i.needed) }, { k: 'note', label: t('Note'), value: i.note }]}
      onSubmit={async (v) => { await tp('PUT', '/gpec/needs', { year, jobProfileId: i.jobProfileId, needed: Number(v.needed), note: v.note }); close(); st.reload(); }} />));
  const addAct = () => modal(t('Nouvelle action'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'title', label: t('Action'), required: true }, { k: 'employeeId', label: t('Personne concernée'), type: 'select', options: [['', t('Aucune')], ...(emps.data ? emps.data.items.filter((e) => e.status === 'active').map((e) => [String(e.employeeId), e.name]) : [])] }, { k: 'dueDate', label: t('Échéance'), type: 'date' }]}
      onSubmit={async (v) => { await tp('POST', '/actions', { kind: 'gpec', title: v.title, employeeId: v.employeeId || null, dueDate: v.dueDate || null }); close(); acts.reload(); }} />));
  return (
    <div className="tl-grid">
      <Loaded state={st}>{(n) => (
        <>
          <div className="tl-kpis">
            <Panel title={t('En poste')}><b>{n.summary.current}</b></Panel><Panel title={t('Départs à la retraite prévus')}><b>{n.summary.retiring}</b></Panel>
            <Panel title={t('Besoin')}><b>{n.summary.needed}</b></Panel><Panel title={t('Manque à combler')}><b>{n.summary.shortfall}</b></Panel>
          </div>
          <div className="tl-2">
            <ChartFrame title={t('Besoins futurs et ressources actuelles')} subtitle={t('Par emploi, année {year}', { year })} actions={<input type="number" aria-label={t('Année')} value={year} onChange={(e) => setYear(Number(e.target.value) || yearNow())} style={{ width: 90 }} />} summary={t('Effectifs disponibles et besoins par emploi')}>
              {n.items.length ? <Bars2 items={n.items} /> : null}
            </ChartFrame>
            <Panel title={t('Détail par emploi')} note={t("« Disponible » = en poste moins les départs à la retraite (60 ans) avant la fin de l'année.")}>
              <Table rows={n.items} rowKey="jobProfileId" empty={t('Aucun emploi.')} columns={[
                { key: 'title', label: t('Emploi') }, { key: 'current', label: t('En poste'), align: 'r' }, { key: 'retiring', label: t('Retraites'), align: 'r' }, { key: 'needed', label: t('Besoin'), align: 'r' },
                { key: 'shortfall', label: t('Manque'), align: 'r', render: (i) => (i.shortfall ? <Badge tone="danger">{i.shortfall}</Badge> : <Badge tone="ok">0</Badge>) },
                { key: 'a', label: '', render: (i) => (has('talent') ? <button className="link" type="button" onClick={() => setNeed(i)}>{t('Définir')}</button> : null) }]} />
            </Panel>
          </div>
        </>
      )}
      </Loaded>
      <Panel title={t("Plan d'actions")} actions={has('talent') ? <Button size="sm" variant="primary" onClick={addAct}>{t('Ajouter une action')}</Button> : null}>
        <Loaded state={acts}>{(a) => (!a.items.length ? <p className="ws-empty">{t('Aucune action.')}</p> : a.items.map((x) => (
          <div className="tl-row" key={x.id}>
            <span><b>{x.title}</b> <small className="tl-note">{[x.employee, x.dueDate ? dateFr(x.dueDate) : ''].filter(Boolean).join(' · ')}</small></span>
            <span className="row"><select aria-label={t('Statut')} value={x.status} onChange={(e) => act(tp('PUT', '/actions/' + x.id, { status: e.target.value }), acts.reload)}>{[['todo', t('À faire')], ['doing', t('En cours')], ['done', t('Fait')], ['cancelled', t('Annulé')]].map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
              <button className="link" type="button" onClick={() => confirm(t('Supprimer cette action ?'), () => act(tp('DELETE', '/actions/' + x.id), acts.reload))}>{t('Supprimer')}</button></span>
          </div>
        )))}
        </Loaded>
      </Panel>
    </div>
  );
}
function Bars2({ items }) {
  const t = useT();
  return <Bars data={items.map((i) => ({ x: i.title, available: i.available, needed: i.needed }))} series={[{ key: 'available', label: t('Disponible') }, { key: 'needed', label: t('Besoin') }]} />;
}
export { num1 };
