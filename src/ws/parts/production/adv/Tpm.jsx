/* eslint-disable react/jsx-key -- les cellules des tableaux modifiables sont des listes fixes, rendues par EdTable */
import { useState } from 'react';
import { useWs } from '../../../WsContext.jsx';
import { useT } from '../../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, EmptyState } from '../../../ui/index.jsx';
import { Gauge } from '../../bp/Charts.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion, Doc, EdTable, Pick, Remove, Setup, Sub, nextId, useDoc } from './common.jsx';
import { CircuitNote, Pbar } from './qcCommon.jsx';

/* Production · TPM (maintenance productive totale) : TRS/OEE par machine, 6 grandes pertes, MTBF/MTTR, calendrier de maintenance, maintenance autonome.
   Le serveur calcule (GET/PUT /production/adv/tpm) ; l'import du module Maintenance (lecture seule) ne fait que proposer des machines. */

const LOSS = ['breakdown', 'setup', 'minorStops', 'reducedSpeed', 'defects', 'startup'];
const LNAME = (t) => ({ breakdown: t('Pannes'), setup: t('Réglages et changements de série'), minorStops: t('Micro-arrêts'), reducedSpeed: t('Vitesse réduite'), defects: t('Pièces défectueuses'), startup: t('Rebuts au démarrage') });
const LADV = (t) => ({
  breakdown: t('Mettre en place une maintenance préventive et une inspection quotidienne de la machine.'),
  setup: t('Préparer les outils à l\'avance et standardiser les réglages pour raccourcir les changements de série.'),
  minorStops: t('Nettoyer, resserrer et lubrifier : les petits arrêts viennent souvent d\'une machine encrassée ou mal réglée.'),
  reducedSpeed: t('Comparer la vitesse réelle à la cadence idéale et corriger ce qui oblige à ralentir.'),
  defects: t('Chercher la cause des défauts (matière, réglage, méthode) et installer un contrôle au poste.'),
  startup: t('Stabiliser les réglages avant de lancer la série et former l\'opérateur au démarrage.'),
});
const LEVEL = (t) => ({ world: t('classe mondiale'), good: t('bon'), fair: t('moyen'), poor: t('faible') });
const STATUS = (t) => ({ overdue: t('en retard'), soon: t('bientôt'), ok: t('ok') });
const TONE = { overdue: 'danger', soon: 'warn', ok: 'ok' };
const blank = (id) => ({ id, name: '', plannedHours: 160, breakdownHours: '', setupHours: '', minorStopHours: '', idealCycleMin: 1, totalCount: '', goodCount: '', startupRejects: '', failures: [], pm: [] });
const todayIso = () => new Date().toISOString().slice(0, 10);

function Importer({ d, close }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const [list, setList] = useState(null);
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState(false);
  const load = () => { setBusy(true); oapi('GET', '/production/adv/import/maintenance').then((j) => setList(j.equipment || [])).catch(fail).finally(() => setBusy(false)); };
  const add = () => {
    d.set((o) => {
      const machines = o.machines.map((x) => ({ ...x })); const have = new Set(machines.map((x) => x.name.toLowerCase()));
      (list || []).filter((e) => pick[e.id] && !have.has(String(e.name).toLowerCase())).forEach((e) => {
        machines.push({ ...blank(nextId(machines, 'm')), name: e.name, pm: e.plans.filter((p) => p.task).map((p) => ({ task: p.task, everyDays: p.everyDays || 30, lastDone: p.lastDone || '', kind: 'preventive' })) });
      });
      return { ...o, machines };
    });
    close();
  };
  return (
    <Card flat title={t('Pré-remplir depuis le module Maintenance')} subtitle={t('Choisissez des équipements : leur nom et leurs plans de maintenance sont repris. Rien n\'est modifié dans le module Maintenance.')}>
      {list === null ? <Button loading={busy} onClick={load}>{t('Afficher les équipements')}</Button> : !list.length ? <p className="muted small">{t('Aucun équipement dans le module Maintenance.')}</p> : (
        <>
          <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 2 }}>
            {list.map((e) => <label key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 40 }}><input type="checkbox" style={{ width: 22, height: 22 }} checked={Boolean(pick[e.id])} onChange={(ev) => setPick((o) => ({ ...o, [e.id]: ev.target.checked }))} /><span><b>{e.name}</b> <small className="muted">{t('{n} plan(s) de maintenance', { n: e.plans.length })}</small></span></label>)}
          </div>
          <div className="row" style={{ marginTop: 8 }}><Button variant="primary" onClick={add} disabled={!Object.values(pick).some(Boolean)}>{t('Ajouter les machines')}</Button></div>
        </>
      )}
      <div style={{ marginTop: 6 }}><button className="link" type="button" onClick={close}>{t('Fermer')}</button></div>
    </Card>
  );
}

function MachineEditor({ d, m, i }) {
  const t = useT();
  const up = (k) => (v) => d.upd(['machines', i, k], v);
  const mut = (key, fn) => d.set((o) => ({ ...o, machines: o.machines.map((x, n) => (n === i ? { ...x, [key]: fn(x[key]) } : x)) }));
  return (
    <Card flat title={m.name || t('Machine {n}', { n: i + 1 })} actions={<Remove onClick={() => d.set((o) => ({ ...o, machines: o.machines.filter((_, k) => k !== i) }))} />}>
      <EdTable head={[t('Nom de la machine'), t('Heures planifiées'), t('Pannes (heures)'), t('Réglages (heures)'), t('Micro-arrêts (heures)')]} rows={[[
        <Cell type="text" label={t('Nom de la machine')} value={m.name} onChange={up('name')} />,
        <Cell label={t('Heures planifiées')} value={m.plannedHours} onChange={up('plannedHours')} />,
        <Cell label={t('Pannes (heures)')} value={m.breakdownHours} onChange={up('breakdownHours')} />,
        <Cell label={t('Réglages (heures)')} value={m.setupHours} onChange={up('setupHours')} />,
        <Cell label={t('Micro-arrêts (heures)')} value={m.minorStopHours} onChange={up('minorStopHours')} />,
      ]]} />
      <EdTable head={[t('Cadence idéale (minutes par pièce)'), t('Pièces produites'), t('Pièces bonnes'), t('Rebuts de démarrage')]} rows={[[
        <Cell label={t('Cadence idéale (minutes par pièce)')} value={m.idealCycleMin} onChange={up('idealCycleMin')} />,
        <Cell label={t('Pièces produites')} value={m.totalCount} onChange={up('totalCount')} />,
        <Cell label={t('Pièces bonnes')} value={m.goodCount} onChange={up('goodCount')} />,
        <Cell label={t('Rebuts de démarrage')} value={m.startupRejects} onChange={up('startupRejects')} />,
      ]]} />
      <Sub>{t('Pannes datées')}</Sub>
      <EdTable empty={t('Aucune panne enregistrée.')} head={[t('Date'), t('Durée (heures)'), '']}
        rows={m.failures.map((f, k) => [
          <Cell type="date" label={t('Date')} value={f.date} onChange={(v) => d.upd(['machines', i, 'failures', k, 'date'], v)} />,
          <Cell label={t('Durée (heures)')} value={f.hours} onChange={(v) => d.upd(['machines', i, 'failures', k, 'hours'], v)} />,
          <Remove onClick={() => mut('failures', (a) => a.filter((_, n) => n !== k))} />,
        ])} />
      <Button size="sm" icon="plus" onClick={() => mut('failures', (a) => a.concat([{ date: todayIso(), hours: '' }]))}>{t('Ajouter une panne')}</Button>
      <Sub>{t('Tâches de maintenance')}</Sub>
      <EdTable empty={t('Aucune tâche : cette machine n\'a pas de plan de maintenance.')} head={[t('Tâche'), t('Type'), t('Tous les (jours)'), t('Dernière fois'), '']}
        rows={m.pm.map((p, k) => [
          <Cell type="text" label={t('Tâche')} value={p.task} onChange={(v) => d.upd(['machines', i, 'pm', k, 'task'], v)} />,
          <Pick label={t('Type')} value={p.kind} onChange={(v) => d.upd(['machines', i, 'pm', k, 'kind'], v)} options={[['preventive', t('Préventive')], ['autonomous', t('Autonome (opérateur)')]]} />,
          <Cell label={t('Tous les (jours)')} value={p.everyDays} onChange={(v) => d.upd(['machines', i, 'pm', k, 'everyDays'], v)} />,
          <Cell type="date" label={t('Dernière fois')} value={p.lastDone} onChange={(v) => d.upd(['machines', i, 'pm', k, 'lastDone'], v)} />,
          <Remove onClick={() => mut('pm', (a) => a.filter((_, n) => n !== k))} />,
        ])} />
      <Button size="sm" icon="plus" onClick={() => mut('pm', (a) => a.concat([{ task: '', kind: 'preventive', everyDays: 30, lastDone: '' }]))}>{t('Ajouter une tâche')}</Button>
    </Card>
  );
}

function Editor({ d }) {
  const t = useT();
  const [imp, setImp] = useState(false);
  return (
    <>
      <Sub>{t('Machines')}</Sub>
      {d.doc.machines.map((m, i) => <MachineEditor key={m.id} d={d} m={m} i={i} />)}
      <div className="row">
        <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, machines: o.machines.concat([blank(nextId(o.machines, 'm'))]) }))}>{t('Ajouter une machine')}</Button>
        {d.mgr ? <Button size="sm" onClick={() => setImp(true)}>{t('Pré-remplir depuis le module Maintenance')}</Button> : null}
      </div>
      {imp ? <Importer d={d} close={() => setImp(false)} /> : null}
      <p className="muted small">{t('Le TRS (taux de rendement synthétique, OEE en anglais) = disponibilité × performance × qualité, sur la période saisie (par exemple un mois).')}</p>
    </>
  );
}

function Strip({ items }) {
  const t = useT();
  const W = 640; const x = (n) => 70 + (Math.max(0, Math.min(30, n)) / 30) * (W - 90);
  const rows = {}; const pts = items.map((c) => { const day = Math.max(0, c.daysLeft); rows[day] = (rows[day] || 0) + 1; return { c, day, row: rows[day] - 1 }; });
  const H = 60 + Math.max(0, ...Object.values(rows)) * 16;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420 }} role="img" aria-label={t('Tâches de maintenance des 30 prochains jours')}>
        <line x1={x(0)} x2={x(30)} y1="30" y2="30" stroke="var(--line)" strokeWidth="3" />
        {[0, 5, 10, 15, 20, 25, 30].map((n) => <g key={n}><line x1={x(n)} x2={x(n)} y1="24" y2="36" stroke="var(--muted)" /><text x={x(n)} y="16" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--muted)' }}>{n === 0 ? t('Aujourd\'hui') : t('J+{n}', { n })}</text></g>)}
        {pts.map((p, i) => <circle key={i} cx={x(p.day)} cy={50 + p.row * 16} r="6" fill={p.c.status === 'overdue' ? 'var(--pink)' : p.c.status === 'soon' ? 'var(--signal)' : 'var(--s1)'} stroke="var(--surface)" strokeWidth="1.5"><title>{p.c.machine + ' · ' + p.c.task + ' · ' + p.c.next}</title></circle>)}
      </svg>
    </div>
  );
}

function Machine({ m, doc }) {
  const t = useT(); const ln = LNAME(t); const adv = LADV(t); const lv = LEVEL(t);
  const maxPct = Math.max(...m.losses.map((x) => x.pct), 0.1);
  const worst = m.biggestLoss;
  const tone = m.level === 'world' || m.level === 'good' ? '' : m.level === 'fair' ? 'warn' : 'bad';
  const dm = doc.machines.find((x) => x.id === m.id);
  return (
    <Card title={m.name} subtitle={t('Période de {h} heures planifiées', { h: num(m.plannedHours, 0) })} actions={<Badge tone={m.level === 'poor' ? 'danger' : m.level === 'fair' ? 'warn' : 'ok'}>{lv[m.level]}</Badge>}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ width: 200 }}><Gauge value={m.oee} label={t('TRS (OEE)')} sub={t('{l} (classe mondiale : 85 % et plus)', { l: lv[m.level] })} tone={tone} /></div>
        <div style={{ flex: '1 1 260px', display: 'grid', gap: 8 }}>
          {[[t('Disponibilité'), m.availability], [t('Performance'), m.performance], [t('Qualité'), m.quality]].map(([lab, v]) => (
            <div key={lab}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><b>{lab}</b><span className="bp-num">{num(v, 1)} %</span></div><Pbar value={v} tone={v < 60 ? 'full' : ''} label={lab} /></div>
          ))}
          <small className="muted">{t('TRS = disponibilité × performance × qualité')}</small>
        </div>
      </div>
      <div className="bp-kpis" style={{ marginTop: 10 }}>
        <Kpi label={t('Pannes')} value={String(m.failures)} sub={t('enregistrées')} />
        <Kpi label={t('MTBF')} value={m.mtbf === null ? '—' : num(m.mtbf, 1) + ' h'} sub={t('temps moyen entre pannes')} />
        <Kpi label={t('MTTR')} value={m.mttr === null ? '—' : num(m.mttr, 1) + ' h'} sub={t('durée moyenne de réparation')} />
      </div>
      <Sub>{t('Les 6 grandes pertes (en % du temps planifié)')}</Sub>
      <div style={{ display: 'grid', gap: 8 }}>
        {LOSS.map((k) => {
          const x = m.losses.find((y) => y.loss === k) || { hours: 0, pct: 0 };
          return (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,210px) 1fr minmax(90px,120px)', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: k === worst ? 800 : 500 }}>{ln[k]}</span>
              <Pbar value={x.pct / maxPct * 100} tone={k === worst ? 'full' : ''} label={ln[k]} />
              <span className={'bp-num' + (k === worst ? ' ro-neg' : '')} style={{ fontSize: 13 }}>{num(x.pct, 1)} % · {num(x.hours, 1)} h</span>
            </div>
          );
        })}
      </div>
      {worst ? <Alert tone="warn" title={t('Perte la plus lourde : {l}', { l: ln[worst] })}>{adv[worst]}</Alert> : null}
      <details style={{ margin: '8px 0' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{t('Une action simple par perte')}</summary>
        <ul style={{ margin: '6px 0', paddingLeft: 20 }}>{LOSS.map((k) => <li key={k}><b>{ln[k]}</b> : {adv[k]}</li>)}</ul>
      </details>
      {dm && !dm.pm.length ? <Alert tone="danger" title={t('Machine sans plan de maintenance')}>{t('Ajoutez au moins une tâche de maintenance préventive pour cette machine.')}</Alert> : null}
    </Card>
  );
}

function Result({ r, doc }) {
  const t = useT(); const st = STATUS(t); const ln = LNAME(t);
  if (!r.machines.length) return <EmptyState icon="gear" title={t('Pas encore de machine')}>{t('Ajoutez une machine (ou pré-remplissez depuis le module Maintenance), saisissez ses temps et ses pièces, puis enregistrez.')}</EmptyState>;
  const next30 = r.calendar.filter((c) => c.status === 'overdue' || c.daysLeft <= 30);
  const auto = r.calendar.filter((c) => c.kind === 'autonomous');
  const worstM = r.machines.find((m) => m.name === r.worst);
  const autoBy = {}; auto.forEach((c) => { (autoBy[c.machine] = autoBy[c.machine] || []).push(c); });
  return (
    <>
      <Conclusion>
        {t('Le TRS moyen est de {p} %.', { p: num(r.oeeAverage, 1) })}{' '}
        {worstM ? t('La machine la moins efficace est « {m} » ({p} %)', { m: worstM.name, p: num(worstM.oee, 1) }) : null}
        {worstM && worstM.biggestLoss ? t(', sa perte la plus lourde : {l}.', { l: ln[worstM.biggestLoss] }) : '.'}{' '}
        {r.overdue ? t('{n} tâche(s) de maintenance sont en retard.', { n: r.overdue }) : t('Aucune tâche de maintenance en retard.')}
      </Conclusion>
      {r.noPlan.length ? <Alert tone="danger" title={t('Machines sans plan de maintenance')}>{r.noPlan.join(', ')}</Alert> : null}
      <div className="bp-kpis">
        <Kpi label={t('TRS moyen')} value={num(r.oeeAverage, 1) + ' %'} tone={r.oeeAverage >= 85 ? 'good' : r.oeeAverage >= 60 ? 'warn' : 'bad'} sub={t('objectif classe mondiale : 85 %')} />
        <Kpi label={t('Machines')} value={String(r.machines.length)} />
        <Kpi label={t('Tâches en retard')} value={String(r.overdue)} tone={r.overdue ? 'bad' : 'good'} />
        <Kpi label={t('Machines sans plan')} value={String(r.noPlan.length)} tone={r.noPlan.length ? 'bad' : 'good'} />
      </div>
      {r.machines.map((m) => <Machine key={m.id} m={m} doc={doc} />)}
      <Card title={t('Calendrier de maintenance')} subtitle={t('Toutes les tâches, de la plus urgente à la moins urgente.')}>
        {!r.calendar.length ? <p className="muted small">{t('Aucune tâche planifiée.')}</p> : (
          <>
            <Sub>{t('Les 30 prochains jours')}</Sub>
            {next30.length ? <Strip items={next30} /> : <p className="muted small">{t('Rien à faire dans les 30 prochains jours.')}</p>}
            <div className="bp-scroll"><table className="bp-table">
              <thead><tr><th>{t('Machine')}</th><th>{t('Tâche')}</th><th>{t('Prévue le')}</th><th>{t('Délai')}</th><th>{t('État')}</th></tr></thead>
              <tbody>{r.calendar.map((c, i) => (
                <tr key={i}>
                  <td>{c.machine}</td><td>{c.task}</td><td>{c.lastDone || c.status !== 'overdue' ? c.next : t('jamais faite')}</td>
                  <td className={c.status === 'overdue' ? 'ro-neg' : ''}>{c.status === 'overdue' ? (c.lastDone ? t('{n} j de retard', { n: Math.abs(c.daysLeft) }) : t('à faire')) : t('dans {n} j', { n: c.daysLeft })}</td>
                  <td><Badge tone={TONE[c.status]}>{st[c.status]}</Badge></td>
                </tr>
              ))}</tbody>
            </table></div>
          </>
        )}
      </Card>
      <Card title={t('Maintenance autonome')} subtitle={t('Les gestes que l\'opérateur fait lui-même : nettoyer, inspecter, lubrifier, resserrer.')}>
        {!auto.length ? <p className="muted small">{t('Aucune tâche autonome. Ajoutez une tâche de type « Autonome (opérateur) » à une machine.')}</p> : Object.keys(autoBy).map((mn) => (
          <div key={mn} style={{ marginBottom: 8 }}>
            <b>{mn}</b>
            {autoBy[mn].map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, flexWrap: 'wrap' }}>
                <span aria-hidden="true" style={{ fontSize: 20 }}>{c.status === 'ok' ? '☑' : '☐'}</span>
                <span style={{ flex: '1 1 200px' }}>{c.task} <small className="muted">{t('tous les {n} jours', { n: c.everyDays })}</small></span>
                <Badge tone={TONE[c.status]}>{st[c.status]}</Badge>
              </div>
            ))}
          </div>
        ))}
      </Card>
    </>
  );
}

export default function Tpm() {
  const t = useT();
  const d = useDoc('tpm');
  return (
    <Doc d={d}>
      <Setup d={d} title={t('TPM (maintenance productive totale)')} subtitle={t('Mesurez le rendement réel de vos machines, repérez les 6 grandes pertes et tenez le calendrier de maintenance.')}>
        <Editor d={d} />
      </Setup>
      <div style={{ margin: '12px 0' }}><CircuitNote>{t('Les machines sans plan de maintenance et celles dont le TRS est très bas déclenchent des avis dans l\'analyse du circuit.')}</CircuitNote></div>
      {d.result ? <Result r={d.result} doc={d.doc} /> : null}
    </Doc>
  );
}
