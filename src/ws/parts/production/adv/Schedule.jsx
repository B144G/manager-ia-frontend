/* eslint-disable react/jsx-key -- les cellules des tableaux modifiables sont des listes fixes, rendues par EdTable */
import { useT } from '../../../../lib/i18n.jsx';
import { Badge, Button, Card, EmptyState, Segmented } from '../../../ui/index.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion, Doc, EdTable, Remove, Setup, Sub, nextId, useDoc } from './common.jsx';

/* Production · ordonnancement d'atelier : dans quel ordre passer les fabrications sur chaque poste. Le serveur simule les 4 règles de priorité
   (FIFO, plus courte durée, échéance, ratio critique) et renvoie le planning de la règle choisie + la comparaison des quatre. Durées en heures, jours = heures / heures par jour. */

const RULES = ['fifo', 'spt', 'edd', 'cr'];
const ruleName = (t) => ({ fifo: t('Premier arrivé, premier servi (FIFO)'), spt: t('Plus courte durée (SPT)'), edd: t('Échéance la plus proche (EDD)'), cr: t('Ratio critique') });
const ruleShort = (t) => ({ fifo: t('FIFO'), spt: t('Plus courte durée'), edd: t('Échéance'), cr: t('Ratio critique') });
const ruleHelp = (t) => ({
  fifo: t("On traite d'abord l'ordre prêt depuis le plus longtemps. Simple et équitable, mais sans souci des dates de livraison."),
  spt: t("On passe d'abord l'opération la plus courte. Les ordres en attente diminuent vite, mais les gros ordres peuvent être retardés."),
  edd: t("On traite d'abord l'ordre à livrer le plus tôt. Bonne règle pour limiter les retards."),
  cr: t("On traite d'abord l'ordre dont le temps restant avant l'échéance est le plus court par rapport au travail qui reste. Équilibre urgence et charge."),
});
const hue = (i) => `hsl(${Math.round((i * 137.5) % 360)} 55% 46%)`;

function Editor({ d }) {
  const t = useT();
  const doc = d.doc;
  const centers = [...new Set(doc.jobs.flatMap((j) => j.ops.map((o) => o.center)).filter(Boolean))];
  const upJob = (i, fn) => d.set((o) => ({ ...o, jobs: o.jobs.map((j, n) => (n === i ? fn(j) : j)) }));
  return (
    <>
      <datalist id="adv-centers">{centers.map((c) => <option key={c} value={c} />)}</datalist>
      <EdTable head={[t('Heures de travail par jour')]} rows={[[<Cell label={t('Heures de travail par jour')} value={doc.hoursPerDay} onChange={(v) => d.upd(['hoursPerDay'], v)} />]]} />
      <Sub>{t('Règle de priorité')}</Sub>
      <Segmented label={t('Règle de priorité')} value={doc.rule} onChange={(v) => d.upd(['rule'], v)} items={RULES.map((r) => ({ id: r, label: ruleShort(t)[r] }))} />
      <p className="muted small">{ruleHelp(t)[doc.rule]}</p>
      <Sub>{t('Ordres de fabrication à planifier')}</Sub>
      {doc.jobs.map((j, i) => (
        <Card flat key={i} title={j.name || t('Ordre {n}', { n: i + 1 })} actions={<Remove onClick={() => d.set((o) => ({ ...o, jobs: o.jobs.filter((_, k) => k !== i) }))} />}>
          <EdTable head={[t('Code'), t('Nom'), t('Début possible (jour)'), t('Échéance (jour)')]}
            rows={[[
              <Cell type="text" label={t('Code')} value={j.id} onChange={(v) => d.upd(['jobs', i, 'id'], v)} />,
              <Cell type="text" label={t('Nom')} value={j.name} onChange={(v) => d.upd(['jobs', i, 'name'], v)} />,
              <Cell label={t('Début possible (jour)')} value={j.release} onChange={(v) => d.upd(['jobs', i, 'release'], v)} />,
              <Cell label={t('Échéance (jour)')} value={j.due} onChange={(v) => d.upd(['jobs', i, 'due'], v)} />,
            ]]} />
          <EdTable empty={t('Aucune opération.')} head={[t('Opération'), t('Poste'), t('Durée (heures)'), '']}
            rows={j.ops.map((o, k) => [
              t('Opération {n}', { n: k + 1 }),
              <input type="text" list="adv-centers" aria-label={t('Poste')} value={o.center} onChange={(e) => d.upd(['jobs', i, 'ops', k, 'center'], e.target.value)} placeholder={t('Ex : découpe, assemblage')} />,
              <Cell label={t('Durée (heures)')} value={o.hours} onChange={(v) => d.upd(['jobs', i, 'ops', k, 'hours'], v)} />,
              <Remove onClick={() => upJob(i, (x) => ({ ...x, ops: x.ops.filter((_, m) => m !== k) }))} />,
            ])} />
          <Button size="sm" icon="plus" onClick={() => upJob(i, (x) => ({ ...x, ops: x.ops.concat([{ center: '', hours: '' }]) }))}>{t('Ajouter une opération')}</Button>
        </Card>
      ))}
      <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, jobs: o.jobs.concat([{ id: nextId(o.jobs, 'OF'), name: '', release: 0, due: 10, ops: [{ center: '', hours: '' }] }]) }))}>{t('Ajouter un ordre')}</Button>
      <p className="muted small">{t("Les jours sont comptés à partir de 0 (aujourd'hui). Un ordre sans opération est ignoré. Chaque ordre passe par ses opérations dans l'ordre indiqué.")}</p>
    </>
  );
}

/** Gantt d'atelier : une ligne par poste, une barre par opération, une couleur par ordre (heures converties en jours). */
export function ShopGantt({ segments, jobs, hoursPerDay, title }) {
  const t = useT();
  const H = hoursPerDay || 8;
  const centers = [...new Set(segments.map((s) => s.center))];
  const color = new Map(jobs.map((j, i) => [j.id, hue(i)]));
  const end = Math.max(1, ...segments.map((s) => s.end / H));
  const span = Math.ceil(end * 1.02);
  const step = Math.max(1, Math.ceil(span / 8));
  const ticks = []; for (let k = 0; k <= span; k += step) ticks.push(k);
  const left = (h) => (h / H / span) * 100;
  return (
    <>
      <div className="bp-scroll" role="figure" aria-label={title}>
        <div className="bp-gantt">
          <div className="gl" />
          <div className="gh" aria-hidden="true">{ticks.map((k) => <span key={k} style={{ left: (k / span * 100) + '%' }}>{t('J{n}', { n: k })}</span>)}</div>
          {centers.map((c) => (
            <div key={c} style={{ display: 'contents' }}>
              <div className="gl" title={c}><span>{c}</span></div>
              <div className="gr">
                {segments.filter((s) => s.center === c).map((s, i) => (
                  <span key={i} className="gb" style={{ left: left(s.start) + '%', width: Math.max(left(s.end - s.start), 0.6) + '%', background: color.get(s.job) || hue(0) }}
                    title={t('{name} · opération {op} · du jour {a} au jour {b}', { name: s.name, op: s.op, a: num(s.start / H, 1), b: num(s.end / H, 1) })}>
                    <small style={{ color: '#fff', fontSize: 10, padding: '0 3px', lineHeight: '16px', whiteSpace: 'nowrap' }}>{s.job}</small>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bp-leg" style={{ marginTop: 8 }}>{jobs.map((j) => <span key={j.id}><i style={{ background: color.get(j.id) }} aria-hidden="true" /><span style={{ color: 'var(--muted)' }}>{j.id + ' · ' + j.name}</span></span>)}</div>
    </>
  );
}

function Result({ r, hoursPerDay }) {
  const t = useT();
  const names = ruleName(t);
  const c = r.chosen; const m = c.metrics;
  const cmp = r.compare;
  const col = [
    { k: 'avgTardiness', label: t('Retard moyen (jours)'), better: 'min' },
    { k: 'lateJobs', label: t('Ordres en retard'), better: 'min' },
    { k: 'avgFlow', label: t('Temps de passage moyen (jours)'), better: 'min' },
    { k: 'avgWip', label: t('En-cours moyen (ordres)'), better: 'min' },
    { k: 'utilization', label: t("Taux d'utilisation (%)"), better: 'max' },
  ];
  const bestVal = (x) => (x.better === 'min' ? Math.min(...cmp.map((e) => e.metrics[x.k])) : Math.max(...cmp.map((e) => e.metrics[x.k])));
  const bt = names[r.best.tardiness]; const bw = names[r.best.wip];
  const lateOnes = c.jobs.filter((j) => j.late);
  return (
    <>
      <Conclusion>
        {t("Avec la règle « {rule} », {n} ordre(s) sur {total} finissent en retard (retard moyen {avg} jour(s)) et tout est terminé au jour {end}.", { rule: names[r.rule], n: m.lateJobs, total: c.jobs.length, avg: num(m.avgTardiness, 1), end: num(m.makespanDays, 1) })}{' '}
        {t("Pour limiter les retards, la meilleure règle testée est « {rule} » ; pour réduire les ordres en attente dans l'atelier, c'est « {wip} ».", { rule: bt, wip: bw })}{' '}
        {r.best.tardiness === r.rule ? t('Vous utilisez déjà la meilleure règle pour les retards.') : t('Changer de règle pourrait réduire vos retards : choisissez-la ci-dessus et enregistrez.')}
      </Conclusion>
      <div className="bp-kpis">
        <Kpi label={t('Ordres en retard')} value={String(m.lateJobs)} sub={t('sur {n}', { n: c.jobs.length })} tone={m.lateJobs ? 'bad' : 'good'} />
        <Kpi label={t('Retard maximal')} value={num(m.maxTardiness, 1) + ' ' + t('j')} tone={m.maxTardiness ? 'warn' : 'good'} />
        <Kpi label={t('Fin de tous les ordres')} value={t('jour {n}', { n: num(m.makespanDays, 1) })} />
        <Kpi label={t("Taux d'utilisation des postes")} value={num(m.utilization, 0) + ' %'} />
      </div>
      <Card title={t("Planning d'atelier (Gantt)")} subtitle={t('Une ligne par poste ; chaque couleur est un ordre. Règle appliquée : {rule}.', { rule: names[r.rule] })}>
        <ShopGantt title={t("Planning d'atelier")} segments={c.segments} jobs={c.jobs} hoursPerDay={hoursPerDay} />
      </Card>
      <Card title={t('Retards par ordre')}>
        <div className="bp-scroll"><table className="bp-table">
          <thead><tr><th>{t('Ordre')}</th><th>{t('Début possible')}</th><th>{t('Échéance')}</th><th>{t('Fin prévue')}</th><th>{t('Retard (jours)')}</th><th>{t('Temps de passage (jours)')}</th><th>{t('État')}</th></tr></thead>
          <tbody>{c.jobs.map((j) => (
            <tr key={j.id}>
              <td>{j.name}<br /><small className="muted">{j.id}</small></td><td>{t('jour {n}', { n: num(j.release, 1) })}</td><td>{t('jour {n}', { n: num(j.due, 1) })}</td><td>{t('jour {n}', { n: num(j.finishDay, 1) })}</td>
              <td className={j.late ? 'ro-neg' : ''}>{num(j.tardiness, 1)}</td><td>{num(j.flow, 1)}</td>
              <td>{j.late ? <Badge tone="danger">{t('En retard')}</Badge> : <Badge tone="ok">{t('À l\'heure')}</Badge>}</td>
            </tr>
          ))}</tbody>
        </table></div>
        {lateOnes.length ? <p className="muted small">{t("Pour rattraper un retard : faites passer l'ordre en priorité, ajoutez des heures sur le poste qui le retient, ou négociez une nouvelle date avec le client.")}</p> : null}
      </Card>
      <Card title={t('Comparaison des 4 règles de priorité')} subtitle={t('Mêmes ordres, quatre façons de les classer. La meilleure valeur de chaque colonne est en vert.')}>
        <div className="bp-scroll"><table className="bp-table">
          <thead><tr><th>{t('Règle')}</th>{col.map((x) => <th key={x.k}>{x.label}</th>)}</tr></thead>
          <tbody>{cmp.map((e) => (
            <tr key={e.rule}>
              <td><b>{names[e.rule]}</b>{e.rule === r.rule ? <> <Badge tone="brand">{t('choisie')}</Badge></> : null}</td>
              {col.map((x) => <td key={x.k} className={e.metrics[x.k] === bestVal(x) ? 'ro-pos' : ''}>{num(e.metrics[x.k], x.k === 'lateJobs' ? 0 : x.k === 'utilization' ? 0 : 2)}</td>)}
            </tr>
          ))}</tbody>
        </table></div>
        <p className="muted small">{t("Retard moyen : de combien de jours un ordre dépasse son échéance en moyenne. Temps de passage : durée entre le début possible et la fin. En-cours : nombre moyen d'ordres en cours de fabrication.")}</p>
      </Card>
    </>
  );
}

export default function Schedule() {
  const t = useT();
  const d = useDoc('schedule');
  return (
    <Doc d={d}>
      <Setup d={d} title={t("Ordonnancement d'atelier")} subtitle={t('Dans quel ordre passer vos fabrications sur chaque poste pour livrer à temps ?')}>
        <Editor d={d} />
      </Setup>
      {d.result && d.result.chosen ? <Result r={d.result} hoursPerDay={d.doc.hoursPerDay} /> : <EmptyState icon="chart" title={t('Pas encore de planning')}>{t('Ajoutez des ordres de fabrication avec leurs opérations, puis enregistrez.')}</EmptyState>}
    </Doc>
  );
}
