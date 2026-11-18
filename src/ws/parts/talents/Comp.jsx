import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, ChartFrame, Form, Loaded, Table, useLoad } from '../../ui.jsx';
import { Combo } from '../../charts/lazy.jsx';
import { Locked, Panel, num1, pct, useAct, useTl, yearNow } from './common.jsx';

/* Rémunération et avantages : grilles par emploi et échelon, positionnement (compa-ratio), primes et avantages, simulation de révision, masse salariale prévisionnelle.
   Relié à la paie : le salaire de base est celui de la fiche employé lu par la paie ; seule l'application d'une simulation confirmée le modifie. */

export function Grades() {
  const t = useT();
  const { modal, money } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const grades = useLoad(() => (has('remun') ? tp('GET', '/comp/grades') : Promise.resolve(null)), []);
  const pos = useLoad(() => (has('remun') ? tp('GET', '/comp/positioning') : Promise.resolve(null)), []);
  const jobs = useLoad(() => (has('remun') ? tp('GET', '/job-profiles') : Promise.resolve(null)), []);
  if (!has('remun')) return <Mine />;
  const STATUS = { in_range: [t('Dans la grille'), 'ok'], below_min: [t('Sous le minimum'), 'danger'], above_max: [t('Au-dessus du maximum'), 'warn'], no_grade: [t('Pas de grille'), 'neutral'] };
  const add = () => modal(t('Nouvelle grille'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'jobProfileId', label: t('Emploi'), type: 'select', options: (jobs.data ? jobs.data.items : []).map((j) => [String(j.id), j.title]) }, { k: 'level', label: t('Échelon'), type: 'number', value: '1' }, { k: 'minSalary', label: t('Minimum mensuel'), type: 'number', required: true }, { k: 'midSalary', label: t('Point médian'), type: 'number', required: true }, { k: 'maxSalary', label: t('Maximum'), type: 'number', required: true }]}
    onSubmit={async (v) => { await tp('POST', '/comp/grades', { jobProfileId: Number(v.jobProfileId), level: Number(v.level), minSalary: Number(v.minSalary), midSalary: Number(v.midSalary), maxSalary: Number(v.maxSalary) }); close(); grades.reload(); pos.reload(); }} />));
  const item = (e) => modal(t('Prime ou avantage — {name}', { name: e.name }), (close) => (
    <Form submitText={t('Ajouter')} fields={[{ k: 'kind', label: t('Type'), type: 'select', options: [['bonus', t('Prime')], ['allowance', t('Indemnité')], ['benefit_in_kind', t('Avantage en nature')]] }, { k: 'label', label: t('Libellé'), required: true }, { k: 'amount', label: t('Montant'), type: 'number', required: true }, { k: 'recurrence', label: t('Périodicité'), type: 'select', options: [['monthly', t('Mensuelle')], ['annual', t('Annuelle')], ['once', t('Ponctuelle')]] }]}
    onSubmit={async (v) => { await tp('POST', '/comp/items', { employeeId: e.employeeId, kind: v.kind, label: v.label, amount: Number(v.amount), recurrence: v.recurrence }); close(); }} />));
  return (
    <div className="tl-grid">
      <Loaded state={pos}>{(p) => (
        <div className="tl-kpis"><Panel title={t('Compa-ratio moyen')}><b>{num1(p.summary.avgCompaRatio)}</b></Panel><Panel title={t('Sous le minimum')}><b>{p.summary.belowMin}</b></Panel><Panel title={t('Au-dessus du maximum')}><b>{p.summary.aboveMax}</b></Panel><Panel title={t('Écart avec la paie')}><b>{p.summary.payrollMismatch}</b></Panel></div>
      )}
      </Loaded>
      <Panel title={t('Positionnement salarial')} note={t('Compa-ratio = salaire / point médian de la grille (1,00 = au marché interne). Pénétration = place du salaire entre le minimum et le maximum.')}>
        <Loaded state={pos}>{(p) => (
          <Table rows={p.items} rowKey="employeeId" empty={t('Aucun employé avec salaire.')} columns={[
            { key: 'name', label: t('Nom'), render: (r) => <b>{r.name}</b> }, { key: 'job', label: t('Emploi') }, { key: 'salary', label: t('Salaire'), align: 'r', render: (r) => (r.salary === null ? '—' : money(r.salary)) },
            { key: 'compa', label: t('Compa-ratio'), align: 'r', render: (r) => num1(r.compaRatio) }, { key: 'pen', label: t('Pénétration'), align: 'r', render: (r) => pct(r.penetration) },
            { key: 'st', label: t('Position'), render: (r) => <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge> },
            { key: 'pay', label: t('Dernière paie'), render: (r) => (r.payroll ? (r.payroll.diff ? <Badge tone="warn">{r.payroll.month} · {money(r.payroll.base)}</Badge> : <small className="tl-note">{r.payroll.month} ✓</small>) : '—') },
            { key: 'a', label: '', render: (r) => <button className="link" type="button" onClick={() => item(r)}>{t('Prime / avantage')}</button> }]} />
        )}
        </Loaded>
      </Panel>
      <Panel title={t('Grilles salariales')} actions={<Button size="sm" variant="primary" onClick={add}>{t('Nouvelle grille')}</Button>}>
        <Loaded state={grades}>{(g) => (
          <Table rows={g.items} empty={t('Aucune grille.')} columns={[
            { key: 'job', label: t('Emploi'), render: (r) => <b>{r.job}</b> }, { key: 'level', label: t('Échelon'), align: 'r' }, { key: 'minSalary', label: t('Minimum'), align: 'r', render: (r) => money(r.minSalary) },
            { key: 'midSalary', label: t('Médian'), align: 'r', render: (r) => money(r.midSalary) }, { key: 'maxSalary', label: t('Maximum'), align: 'r', render: (r) => money(r.maxSalary) },
            { key: 'a', label: '', render: (r) => <button className="link" type="button" onClick={() => act(tp('DELETE', '/comp/grades/' + r.id), () => { grades.reload(); pos.reload(); })}>{t('Supprimer')}</button> }]} />
        )}
        </Loaded>
      </Panel>
    </div>
  );
}

/** Ma rémunération : position et primes de la personne connectée (jamais celles des autres). */
function Mine() {
  const t = useT();
  const { money } = useWs();
  const { tp } = useTl();
  const st = useLoad(() => tp('GET', '/comp/mine'), []);
  return (
    <Panel title={t('Ma rémunération')}>
      <Loaded state={st}>{(m) => (!m.item ? <Locked what={t("Votre compte n'est lié à aucune fiche employé.")} /> : (
        <>
          <p>{t('Salaire de base')} : <b>{m.item.salary === null ? '—' : money(m.item.salary)}</b> · {t('Compa-ratio')} : <b>{num1(m.item.compaRatio)}</b></p>
          {m.item.items.map((i, k) => <div className="tl-row" key={k}><span>{i.label}</span><b>{money(i.amount)}</b></div>)}
        </>
      ))}
      </Loaded>
    </Panel>
  );
}

export function Simulation() {
  const t = useT();
  const { money, confirm } = useWs();
  const { tp, has } = useTl();
  const act = useAct();
  const [p, setP] = useState({ generalPct: '3', minToGrade: true, capToMax: false, merit: '' });
  const [out, setOut] = useState(null);
  const [name, setName] = useState('');
  const sims = useLoad(() => (has('remun') ? tp('GET', '/comp/simulations') : Promise.resolve(null)), []);
  const scen = useLoad(() => (has('remun') ? tp('GET', '/workforce/scenarios') : Promise.resolve(null)), []);
  const [scenarioId, setScenarioId] = useState('');
  const [fyear] = useState(yearNow());
  const fc = useLoad(() => (has('remun') ? tp('GET', '/comp/forecast?year=' + fyear + (scenarioId ? '&scenarioId=' + scenarioId : '')) : Promise.resolve(null)), [scenarioId]);
  if (!has('remun')) return <Locked />;
  const body = () => ({ generalPct: Number(p.generalPct) || 0, minToGrade: p.minToGrade, capToMax: p.capToMax, meritByBox: p.merit ? Object.fromEntries(p.merit.split(',').map((x) => x.split(':').map((y) => y.trim())).filter((x) => x.length === 2)) : {} });
  const run = () => tp('POST', '/comp/simulate', body()).then(setOut).catch((e) => act(Promise.reject(e)));
  const save = () => act(tp('POST', '/comp/simulate', { ...body(), name, save: true }), (r) => { setOut(r); sims.reload(); }, t('Simulation enregistrée'));
  return (
    <div className="tl-grid">
      <Panel title={t('Simulation de révision salariale')} note={t("La simulation ne change rien tant que vous ne l'appliquez pas. Appliquée, elle met à jour le salaire de base lu par la paie.")}>
        <div className="row">
          <label className="fld"><span>{t('Augmentation générale (%)')}</span><input type="number" value={p.generalPct} onChange={(e) => setP({ ...p, generalPct: e.target.value })} /></label>
          <label className="fld"><span>{t('Mérite par case 9-box')}</span><input placeholder="9:5, 8:3" value={p.merit} onChange={(e) => setP({ ...p, merit: e.target.value })} /></label>
          <label><input type="checkbox" checked={p.minToGrade} onChange={(e) => setP({ ...p, minToGrade: e.target.checked })} /> {t('Remonter au minimum de la grille')}</label>
          <label><input type="checkbox" checked={p.capToMax} onChange={(e) => setP({ ...p, capToMax: e.target.checked })} /> {t('Plafonner au maximum')}</label>
          <Button variant="primary" onClick={run}>{t('Simuler')}</Button>
        </div>
        {out ? (
          <>
            <div className="tl-kpis"><Panel title={t('Surcoût mensuel')}><b>{money(out.monthlyDelta)}</b></Panel><Panel title={t('Surcoût annuel')}><b>{money(out.annualDelta)}</b></Panel><Panel title={t('Avec charges patronales')}><b>{money(out.annualDeltaWithCharges)}</b><br /><small className="tl-note">{t('Taux {n} %', { n: Math.round(out.chargesRate.rate * 1000) / 10 })} · {out.chargesRate.source === 'payroll' ? t('issu de la paie') : out.chargesRate.source === 'param' ? t('saisi') : t('repère modifiable')}</small></Panel></div>
            <Table rows={out.lines} rowKey="employeeId" columns={[{ key: 'name', label: t('Nom'), render: (r) => <b>{r.name}</b> }, { key: 'salary', label: t('Actuel'), align: 'r', render: (r) => money(r.salary) }, { key: 'newSalary', label: t('Nouveau'), align: 'r', render: (r) => money(r.newSalary) }, { key: 'pct', label: '%', align: 'r', render: (r) => num1(r.pct) }, { key: 'box', label: t('Case 9-box'), align: 'r', render: (r) => r.box || '—' }]} />
            <div className="row"><input aria-label={t('Nom de la simulation')} placeholder={t('Nom de la simulation')} value={name} onChange={(e) => setName(e.target.value)} /><Button disabled={!name} onClick={save}>{t('Enregistrer la simulation')}</Button></div>
          </>
        ) : null}
      </Panel>
      <Panel title={t('Simulations enregistrées')}>
        <Loaded state={sims}>{(s) => (
          <Table rows={s.items} empty={t('Aucune simulation enregistrée.')} columns={[{ key: 'name', label: t('Nom'), render: (r) => <b>{r.name}</b> }, { key: 'monthlyDelta', label: t('Surcoût mensuel'), align: 'r', render: (r) => money(r.monthlyDelta) },
            { key: 'st', label: t('État'), render: (r) => (r.status === 'applied' ? <Badge tone="ok">{t('Appliquée')}</Badge> : <Badge>{t('Brouillon')}</Badge>) },
            { key: 'a', label: '', render: (r) => (r.status === 'draft' ? <button className="link" type="button" onClick={() => confirm(t('Appliquer « {name} » ? Les salaires de base des employés seront modifiés (et utilisés par la paie).', { name: r.name }), () => act(tp('POST', '/comp/simulations/' + r.id + '/apply', { confirm: true }), sims.reload, t('Salaires mis à jour')), t('Appliquer'))}>{t('Appliquer')}</button> : null) }]} />
        )}
        </Loaded>
      </Panel>
      <Panel title={t('Masse salariale prévisionnelle')} actions={<select aria-label={t("Scénario d'embauche")} value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}><option value="">{t("Sans scénario d'embauche")}</option>{scen.data ? scen.data.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>) : null}</select>}>
        <Loaded state={fc}>{(f) => (
          <>
            <ChartFrame title={t('Sur 12 mois')} subtitle={t('Charges patronales {n} %', { n: Math.round(f.chargesRate * 1000) / 10 })} summary={t('Masse salariale mensuelle prévue')}>
              <Combo data={f.months.map((m) => ({ x: m.month.slice(5), base: m.base + m.items, hires: m.hires + m.raise }))} series={[{ key: 'base', label: t('Existant'), type: 'bar' }, { key: 'hires', label: t('Embauches et révision'), type: 'bar' }]} stacked fmt={(v) => money(v)} />
            </ChartFrame>
            <p><b>{t("Total de l'année")}</b> : {money(f.totalGross)} · {t('avec charges')} {money(f.totalWithCharges)}</p>
          </>
        )}
        </Loaded>
      </Panel>
      <Alert tone="info">{t("Le calcul des bulletins reste dans le module Paie : ici, on pilote les grilles, les révisions et le coût prévisionnel.")}</Alert>
    </div>
  );
}
