import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, ChartFrame, Form, Loaded, Table, useLoad } from '../../ui.jsx';
import { Bars } from '../../charts/lazy.jsx';
import { Locked, Panel, useAct, useTl, yearNow } from './common.jsx';

/* Planification des effectifs : effectifs actuels vs budgétés par service, besoins, scénarios d'embauche et leur coût. */
export default function Workforce() {
  const t = useT();
  const { modal, money, confirm } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const [scn, setScn] = useState('');
  const ok = has('talent', 'remun');
  const scens = useLoad(() => (ok ? tp('GET', '/workforce/scenarios') : Promise.resolve(null)), []);
  const ov = useLoad(() => (ok ? tp('GET', '/workforce/overview' + (scn ? '?scenarioId=' + scn : '')) : Promise.resolve(null)), [scn]);
  const detail = useLoad(() => (scn ? tp('GET', '/workforce/scenarios/' + scn) : Promise.resolve(null)), [scn]);
  const deps = useLoad(() => (ok ? tp('GET', '/departments') : Promise.resolve({ items: [] })), []);
  const jobs = useLoad(() => (ok ? tp('GET', '/job-profiles') : Promise.resolve({ items: [] })), []);
  if (!ok) return <Locked />;
  const reload = () => { scens.reload(); ov.reload(); detail.reload(); };
  const addScn = () => modal(t("Nouveau scénario d'embauche"), (close) => (
    <Form submitText={t('Créer')} fields={[{ k: 'name', label: t('Nom'), required: true }, { k: 'year', label: t('Année'), type: 'number', value: String(yearNow()) }, { k: 'chargesRate', label: t('Charges patronales (0,2 = 20 %)'), type: 'number', value: '0.2' }]}
    onSubmit={async (v) => { const r = await tp('POST', '/workforce/scenarios', { name: v.name, year: Number(v.year), chargesRate: Number(v.chargesRate) }); close(); setScn(String(r.id)); reload(); }} />));
  const addLine = () => modal(t('Embauches prévues'), (close) => (
    <Form submitText={t('Ajouter')} fields={[{ k: 'departmentId', label: t('Service'), type: 'select', options: [['', t('Aucun')], ...deps.data.items.map((d) => [String(d.id), d.name])] }, { k: 'jobProfileId', label: t('Emploi'), type: 'select', options: [['', t('Aucun')], ...jobs.data.items.map((d) => [String(d.id), d.title])] },
      { k: 'qty', label: t('Nombre de postes'), type: 'number', value: '1' }, { k: 'startMonth', label: t('Mois de début (1 à 12)'), type: 'number', value: '1' }, { k: 'monthlySalary', label: t('Salaire mensuel (vide = médian de la grille)'), type: 'number' }]}
    onSubmit={async (v) => { await tp('POST', '/workforce/scenarios/' + scn + '/lines', { departmentId: v.departmentId || null, jobProfileId: v.jobProfileId || null, qty: Number(v.qty), startMonth: Number(v.startMonth), monthlySalary: v.monthlySalary ? Number(v.monthlySalary) : undefined }); close(); reload(); }} />));
  return (
    <div className="tl-grid">
      <Loaded state={ov}>{(o) => (
        <>
          <div className="tl-kpis"><Panel title={t('Effectif actuel')}><b>{o.summary.current}</b></Panel><Panel title={t('Effectif budgété')}><b>{o.summary.budget}</b></Panel><Panel title={t('Postes vacants')}><b>{o.summary.vacancies}</b></Panel><Panel title={t('Embauches du scénario')}><b>{o.summary.planned}</b></Panel><Panel title={t('Besoin restant')}><b>{o.summary.needs}</b></Panel></div>
          <div className="tl-2">
            <ChartFrame title={t('Effectifs par service')} summary={t('Actuel, budgété et prévu par service')}>
              {o.items.length ? <Bars data={o.items.map((i) => ({ x: i.name, current: i.current, budget: i.budget, planned: i.planned }))} series={[{ key: 'current', label: t('Actuel') }, { key: 'budget', label: t('Budgété') }, { key: 'planned', label: t('Prévu (scénario)') }]} /> : null}
            </ChartFrame>
            <Panel title={t('Détail')} note={o.unassigned ? t('{n} employé(s) sans service ne sont pas comptés par service.', { n: o.unassigned }) : ''}>
              <Table rows={o.items} rowKey="departmentId" empty={t('Aucun service.')} columns={[{ key: 'name', label: t('Service'), render: (r) => <b>{r.name}</b> }, { key: 'current', label: t('Actuel'), align: 'r' }, { key: 'budget', label: t('Budgété'), align: 'r' },
                { key: 'vacancies', label: t('Vacants'), align: 'r', render: (r) => (r.vacancies ? <Badge tone="warn">{r.vacancies}</Badge> : '0') }, { key: 'over', label: t('Excédent'), align: 'r', render: (r) => (r.over ? <Badge tone="danger">{r.over}</Badge> : '0') }, { key: 'needs', label: t('Besoin'), align: 'r' },
                ...(o.items.length && o.items[0].monthlyPayroll !== undefined ? [{ key: 'monthlyPayroll', label: t('Masse / mois'), align: 'r', render: (r) => money(r.monthlyPayroll) }] : [])]} />
            </Panel>
          </div>
        </>
      )}
      </Loaded>
      <Panel title={t("Scénarios d'embauche")} actions={<><select aria-label={t('Scénario')} value={scn} onChange={(e) => setScn(e.target.value)}><option value="">{t('Choisir un scénario…')}</option>{scens.data ? scens.data.items.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.year})</option>) : null}</select><Button size="sm" variant="primary" onClick={addScn}>{t('Nouveau scénario')}</Button></>}>
        {scn ? <Loaded state={detail}>{(d) => (
          <>
            <Table rows={d.lines} empty={t('Aucune ligne.')} columns={[{ key: 'department', label: t('Service') }, { key: 'job', label: t('Emploi') }, { key: 'qty', label: t('Postes'), align: 'r' }, { key: 'startMonth', label: t('Dès le mois'), align: 'r' }, { key: 'monthlySalary', label: t('Salaire mensuel'), align: 'r', render: (r) => money(r.monthlySalary) },
              { key: 'yearCost', label: t("Coût de l'année"), align: 'r', render: (r) => money(r.yearCost) }, { key: 'fullYearCost', label: t('Année pleine'), align: 'r', render: (r) => money(r.fullYearCost) },
              { key: 'a', label: '', render: (r) => <button className="link" type="button" onClick={() => confirm(t('Retirer cette ligne ?'), () => act(tp('DELETE', '/workforce/scenarios/' + scn + '/lines/' + r.id), reload))}>{t('Retirer')}</button> }]} />
            <div className="row"><Button size="sm" onClick={addLine}>{t('Ajouter des embauches')}</Button><b>{t("Coût de l'année")} : {money(d.totals.yearCost)} · {t('année pleine')} {money(d.totals.fullYearCost)} · {d.totals.hires} {t('poste(s)')}</b></div>
          </>
        )}</Loaded> : <p className="ws-empty">{t("Créez un scénario pour chiffrer des embauches (salaire de la grille, mois de début, charges).")}</p>}
      </Panel>
    </div>
  );
}
