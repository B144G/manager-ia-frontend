import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Form, Loaded, Segmented, Table, useLoad } from '../../ui.jsx';
import { Bar, Locked, Panel, levelOpts, num1, pct, useAct, useTl } from './common.jsx';

/* Recrutement par compétences : offres liées à un emploi du référentiel, candidats notés par compétence, score de correspondance, entretiens structurés, pipeline kanban, embauche. */

const STAGES = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

export default function Recruit() {
  const t = useT();
  const { modal, money, dateFr } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const [job, setJob] = useState('');
  const [view, setView] = useState('kanban');
  const jobs = useLoad(() => (has('recrut') ? tp('GET', '/recruitment/jobs') : Promise.resolve(null)), []);
  const profiles = useLoad(() => tp('GET', '/job-profiles'), []);
  const pipe = useLoad(() => (job ? tp('GET', '/recruitment/pipeline?jobId=' + job) : Promise.resolve(null)), [job]);
  const stats = useLoad(() => (has('recrut') ? tp('GET', '/recruitment/stats') : Promise.resolve(null)), []);
  if (!has('recrut')) return <Locked />;
  const NAME = { new: t('Nouveau'), screening: t('Présélection'), interview: t('Entretien'), offer: t('Offre'), hired: t('Embauché'), rejected: t('Écarté') };
  const reloadAll = () => { jobs.reload(); pipe.reload(); stats.reload(); };
  const addJob = () => modal(t('Nouvelle offre'), (close) => (
    <Form submitText={t('Créer')} fields={[
      { k: 'profileId', label: t('Emploi du référentiel (compétences requises)'), type: 'select', options: [['', t('Aucun')], ...(profiles.data ? profiles.data.items.map((p) => [String(p.id), p.title]) : [])] },
      { k: 'title', label: t('Intitulé (si pas d’emploi choisi)') }, { k: 'openedAt', label: t("Date d'ouverture"), type: 'date' }, { k: 'recruitCost', label: t('Coût du recrutement (annonce, cabinet…)'), type: 'number', value: '0' }]}
    onSubmit={async (v) => { const r = await tp('POST', '/recruitment/jobs', { profileId: v.profileId || null, title: v.title || undefined, openedAt: v.openedAt || undefined, recruitCost: Number(v.recruitCost) || 0 }); close(); setJob(String(r.id)); reloadAll(); }} />));
  const addCand = () => modal(t('Nouveau candidat'), (close) => (
    <Form submitText={t('Ajouter')} fields={[{ k: 'name', label: t('Nom'), required: true }, { k: 'phone', label: t('Téléphone') }, { k: 'email', label: t('E-mail') }, { k: 'source', label: t('Source (annonce, recommandation…)') }, { k: 'expectedSalary', label: t('Prétention salariale'), type: 'number' }]}
    onSubmit={async (v) => { await tp('POST', '/recruitment/candidates', { ...v, jobId: Number(job), expectedSalary: Number(v.expectedSalary) || 0 }); close(); pipe.reload(); }} />));
  const move = (c, stage) => {
    if (stage === 'rejected') { modal(t('Écarter le candidat'), (close) => <Form submitText={t('Écarter')} fields={[{ k: 'rejectReason', label: t('Motif') }]} onSubmit={async (v) => { await tp('PUT', '/recruitment/candidates/' + c.id, { stage, rejectReason: v.rejectReason }); close(); reloadAll(); }} />); return; }
    act(tp('PUT', '/recruitment/candidates/' + c.id, { stage }), reloadAll);
  };
  const open = (c) => modal(c.name, (close) => <Candidate c={c} close={close} done={reloadAll} />, { wide: true });
  return (
    <div className="tl-grid">
      <Loaded state={stats}>{(s) => (
        <div className="tl-kpis">
          <Panel title={t('Offres ouvertes')}><b>{s.openJobs}</b></Panel><Panel title={t('Candidats')}><b>{s.candidates}</b></Panel><Panel title={t('Embauches')}><b>{s.hires}</b></Panel>
          <Panel title={t("Délai d'embauche")}><b>{s.avgDaysToHire === null ? '—' : t('{n} j', { n: num1(s.avgDaysToHire) })}</b></Panel><Panel title={t('Coût par recrutement')}><b>{s.costPerHire === null ? '—' : money(s.costPerHire)}</b></Panel>
        </div>
      )}
      </Loaded>
      <Panel title={t('Offres')} actions={<Button size="sm" variant="primary" onClick={addJob}>{t('Nouvelle offre')}</Button>}>
        <Loaded state={jobs}>{(j) => (
          <Table rows={j.items} empty={t("Aucune offre. Créez une offre à partir d'un emploi du référentiel pour noter les candidats par compétence.")} onRowClick={(r) => setJob(String(r.id))} columns={[
            { key: 'title', label: t('Offre'), render: (r) => <b>{r.title}</b> },
            { key: 'req', label: t('Compétences requises'), render: (r) => (r.requirements.length ? r.requirements.map((q) => <Badge key={q.competencyId} tone="info">{q.name} · {q.required}</Badge>) : <small className="tl-note">{t('Aucune')}</small>) },
            { key: 'openedAt', label: t('Ouverte le'), render: (r) => dateFr(r.openedAt) }, { key: 'candidates', label: t('Candidats'), align: 'r' },
            { key: 'status', label: t('État'), render: (r) => (r.status === 'open' ? <Badge tone="ok">{t('Ouverte')}</Badge> : <Badge>{t('Fermée')}</Badge>) },
            { key: 'a', label: '', render: (r) => <span className="row"><button className="link" type="button" onClick={(e) => { e.stopPropagation(); setJob(String(r.id)); }}>{t('Pipeline')}</button><button className="link" type="button" onClick={(e) => { e.stopPropagation(); act(tp('PUT', '/recruitment/jobs/' + r.id, { status: r.status === 'open' ? 'closed' : 'open' }), reloadAll); }}>{r.status === 'open' ? t('Fermer') : t('Rouvrir')}</button></span> }]} />
        )}
        </Loaded>
      </Panel>
      {job ? (
        <Loaded state={pipe}>{(p) => (
          <Panel title={t('Candidats : {job}', { job: p.job.title })} actions={<><Segmented label={t('Vue')} value={view} onChange={setView} items={[{ id: 'kanban', label: t('Kanban') }, { id: 'list', label: t('Liste') }]} /><Button size="sm" variant="primary" onClick={addCand}>{t('Ajouter un candidat')}</Button></>}>
            {view === 'kanban' ? (
              <div className="tl-kan">{p.columns.map((col) => (
                <div className="tl-col" key={col.stage}><h4>{NAME[col.stage]}<Badge>{col.items.length}</Badge></h4>
                  {col.items.map((c) => (
                    <div className="tl-card" key={c.id}>
                      <b><button className="link" type="button" onClick={() => open(c)}>{c.name}</button></b>
                      <Bar value={c.match} /><small>{t('Correspondance')} {pct(c.match)} · {t('{n}/{m} évaluées', { n: c.evaluated, m: c.requiredCount })}</small>
                      {c.stage !== 'hired' ? <select aria-label={t('Déplacer')} value={c.stage} onChange={(e) => move(c, e.target.value)}>{STAGES.filter((s) => s !== 'hired').map((s) => <option key={s} value={s}>{NAME[s]}</option>)}</select> : <Badge tone="ok">{t('Embauché')}</Badge>}
                    </div>
                  ))}
                </div>
              ))}</div>
            ) : (
              <Table rows={p.columns.flatMap((c) => c.items).sort((a, b) => (b.match ?? -1) - (a.match ?? -1))} empty={t('Aucun candidat.')} onRowClick={open} columns={[
                { key: 'name', label: t('Nom'), render: (c) => <b>{c.name}</b> }, { key: 'stage', label: t('Étape'), render: (c) => NAME[c.stage] },
                { key: 'match', label: t('Correspondance'), render: (c) => <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Bar value={c.match} /> {pct(c.match)}</span> },
                { key: 'sal', label: t('Prétention'), align: 'r', render: (c) => (c.expectedSalary ? money(c.expectedSalary) : '—') }]} />
            )}
          </Panel>
        )}
        </Loaded>
      ) : null}
    </div>
  );
}

/** Fiche candidat : grille d'évaluation par compétence, entretiens structurés (guide), embauche. */
function Candidate({ c, close, done }) {
  const t = useT();
  const { money } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const grid = useLoad(() => tp('GET', '/recruitment/candidates/' + c.id + '/grid'), []);
  const ivs = useLoad(() => tp('GET', '/recruitment/candidates/' + c.id + '/interviews'), []);
  const [iv, setIv] = useState('');
  const guide = useLoad(() => (iv ? tp('GET', '/recruitment/interviews/' + iv + '/guide') : Promise.resolve(null)), [iv]);
  const score = (competencyId, value) => act(tp('POST', '/recruitment/candidates/' + c.id + '/scores', { competencyId, score: Number(value), interviewId: iv ? Number(iv) : undefined }), () => { grid.reload(); done(); });
  const hire = () => act(tp('POST', '/recruitment/candidates/' + c.id + '/hire', { closeJob: false }), () => { close(); done(); }, t('Candidat embauché : la fiche employé est créée.'));
  return (
    <div className="tl-grid">
      <p className="tl-note">{[c.phone, c.email, c.source, c.expectedSalary ? t('Prétention {amount}', { amount: money(c.expectedSalary) }) : ''].filter(Boolean).join(' · ')}</p>
      <Loaded state={grid}>{(g) => (
        <Panel title={t("Grille d'évaluation par compétence")} subtitle={t('Correspondance globale {n}', { n: pct(g.match) })} note={t("Notez de 1 à 5 chaque compétence requise. Plusieurs évaluateurs : la moyenne est retenue.")}>
          <Table rows={g.grid} rowKey="competencyId" empty={t("Cette offre n'a pas de compétences requises.")} columns={[
            { key: 'name', label: t('Compétence'), render: (r) => <b>{r.name}</b> }, { key: 'required', label: t('Requis'), align: 'r' },
            { key: 'score', label: t('Note moyenne'), align: 'r', render: (r) => (r.score === null ? '—' : num1(r.score)) }, { key: 'evaluators', label: t('Évaluateurs'), align: 'r' },
            { key: 'gap', label: t('Écart'), align: 'r', render: (r) => (r.gap === null ? '—' : <Badge tone={r.gap > 0 ? 'warn' : 'ok'}>{num1(r.gap)}</Badge>) },
            { key: 'a', label: t('Ma note'), render: (r) => <select aria-label={t('Ma note')} defaultValue="" onChange={(e) => { if (e.target.value) score(r.competencyId, e.target.value); }}><option value="">…</option>{levelOpts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select> }]} />
        </Panel>
      )}
      </Loaded>
      <Panel title={t('Entretiens structurés')} actions={<Button size="sm" onClick={() => act(tp('POST', '/recruitment/candidates/' + c.id + '/interviews', { kind: 'structured' }), ivs.reload)}>{t('Planifier un entretien')}</Button>}>
        <Loaded state={ivs}>{(v) => (!v.items.length ? <p className="ws-empty">{t('Aucun entretien.')}</p> : (
          <>
            <select aria-label={t('Entretien')} value={iv} onChange={(e) => setIv(e.target.value)}><option value="">{t('Choisir un entretien pour son guide…')}</option>{v.items.map((i) => <option key={i.id} value={i.id}>{t('Entretien')} #{i.id}</option>)}</select>
            {iv ? <Loaded state={guide}>{(q) => (<ol>{q.questions.map((x) => <li key={x.competencyId}><b>{x.competency}</b> ({t('niveau visé {n}', { n: x.required })}) — {t("Décrivez une situation précise (contexte, tâche, action, résultat) où vous avez mis cette compétence en œuvre.")}</li>)}</ol>)}</Loaded> : null}
          </>
        ))}
        </Loaded>
      </Panel>
      {has('recrut') && c.stage !== 'hired' && c.stage !== 'rejected' ? <div className="row"><Button variant="primary" onClick={hire}>{t("Embaucher : créer la fiche employé")}</Button></div> : null}
    </div>
  );
}
