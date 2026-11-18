import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, Field } from '../../ui/index.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { BarChart } from '../bp/Charts.jsx';
import { Kpi, num, pct } from './ro-common.jsx';
import '../../../styles/ws-ro.css';

/* Projets · diagramme PERT : réseau d'activités avec dates au plus tôt / au plus tard, marges et chemin critique en évidence,
   estimation optimiste / probable / pessimiste, durée et écart-type du projet, probabilité de tenir une date, simulation Monte-Carlo.
   Tous les calculs sont faits par le serveur ; ici on dessine et on explique. */

const BW = 190; const BH = 74; const GX = 70; const GY = 22;

function Network({ d, onPick }) {
  const t = useT();
  const cols = Math.max(...d.nodes.map((n) => n.level)) + 1;
  const rows = new Map();
  const pos = new Map();
  for (const n of d.nodes) { const k = rows.get(n.level) || 0; rows.set(n.level, k + 1); pos.set(n.id, { x: 12 + n.level * (BW + GX), y: 12 + k * (BH + GY) }); }
  const H = 24 + Math.max(...rows.values()) * (BH + GY); const W = 24 + cols * (BW + GX) - GX;
  const label = { FS: t('fin-début'), SS: t('début-début'), FF: t('fin-fin'), SF: t('début-fin') };
  const ends = (a) => (a.length > 17 ? a.slice(0, 16) + '…' : a);
  return (
    <div className="ro-net" role="figure" aria-label={t('Diagramme PERT : réseau des activités, chemin critique en rouge')}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs><marker id="ro-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="currentColor" /></marker></defs>
        {d.edges.map((e, i) => {
          const a = pos.get(e.from); const b = pos.get(e.to); if (!a || !b) return null;
          const x1 = a.x + BW; const y1 = a.y + BH / 2; const x2 = b.x; const y2 = b.y + BH / 2; const mx = (x1 + x2) / 2;
          return (
            <g key={i} className={e.tight ? 'c-s2' : 'c-plan'} style={{ color: e.tight ? 'var(--pink)' : 'var(--plan)' }}>
              <path d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2 - 2} ${y2}`} className={'ro-edge' + (e.tight ? ' crit' : '')} markerEnd="url(#ro-arrow)" />
              {e.type !== 'FS' || e.lag ? <text x={mx} y={(y1 + y2) / 2 - 4} textAnchor="middle" className="ro-edge-t">{label[e.type] + (e.lag ? ` ${e.lag > 0 ? '+' : ''}${e.lag} ${t('j')}` : '')}</text> : null}
            </g>
          );
        })}
        {d.nodes.map((n) => {
          const p = pos.get(n.id);
          return (
            <g key={n.id} className={'ro-node' + (n.critical ? ' crit' : '') + (n.status === 'done' ? ' done' : '')} transform={`translate(${p.x} ${p.y})`} tabIndex={0} role="button" aria-label={`${n.title} : ${t('marge')} ${n.float} ${t('j')}`} onClick={() => onPick(n)} onKeyDown={(e) => { if (e.key === 'Enter') onPick(n); }} style={{ cursor: 'pointer' }}>
              <rect className="box" width={BW} height={BH} rx="10" />
              <text x="8" y="16" className="ttl">{ends(n.title)}</text>
              <line x1="0" x2={BW} y1="23" y2="23" />
              <text x="8" y="39" className="mut">{t('Tôt')}</text><text x="42" y="39">{num(n.es, 1)} → {num(n.ef, 1)}</text>
              <text x="8" y="55" className="mut">{t('Tard')}</text><text x="42" y="55">{num(n.ls, 1)} → {num(n.lf, 1)}</text>
              <text x="8" y="69" className="mut">{t('Durée {d} j · marge {f} j', { d: num(n.duration, 1), f: num(n.float, 1) })}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Pert({ id }) {
  const t = useT();
  const { oapi, can, modal, fail, dateFr, toast } = useWs();
  const [target, setTarget] = useState('');
  const st = useLoad(() => oapi('GET', `/projects/${id}/pert${target ? '?target=' + target : ''}`), [id, target]);
  const edit = (n) => modal(n.title, (close) => (
    <Form
      fields={[
        { k: 'o', label: t('Durée optimiste (jours) : tout se passe bien'), type: 'number', value: n.o },
        { k: 'm', label: t('Durée probable (jours) : le plus réaliste'), type: 'number', value: n.m },
        { k: 'p', label: t('Durée pessimiste (jours) : tout se passe mal'), type: 'number', value: n.p },
      ]}
      submitText={t('Enregistrer')}
      onSubmit={(v) => oapi('PUT', `/projects/tasks/${n.id}/pert`, { optimistic: v.o, likely: v.m, pessimistic: v.p }).then(() => { close(); st.reload(); toast(t('Estimation enregistrée.')); })}
      extra={n.estimated ? null : <Button type="button" onClick={() => oapi('PUT', `/projects/tasks/${n.id}/pert`, { clear: true }).then(() => { close(); st.reload(); }).catch(fail)}>{t('Revenir à l\'estimation automatique')}</Button>}
    />
  ));
  return (
    <div className="bp">
      <Loaded state={st}>{(d) => {
        if (d.empty) return <Card title={t('Diagramme PERT')}><p className="muted">{t('Ajoutez des tâches au projet pour construire le réseau PERT.')}</p></Card>;
        if (!d.ok) {
          return (
            <Card title={t('Diagramme PERT')}>
              <Alert tone="danger" title={t('Dépendance circulaire : le calcul est impossible')}>{t('Ces tâches s\'attendent les unes les autres : {list}. Supprimez l\'un des liens dans l\'onglet Risques, rubrique Dépendances.', { list: d.cycle.map((c) => c.title).join(' → ') })}</Alert>
            </Card>
          );
        }
        const sim = d.simulation; const tg = d.target;
        const prob = tg ? tg.probability : null;
        const tone = prob === null ? '' : prob >= 0.8 ? 'good' : prob >= 0.5 ? 'warn' : 'bad';
        const crit = d.nodes.filter((n) => n.critical);
        return (
          <>
            <Card title={t('Diagramme PERT')} subtitle={t('Chaque case : dates au plus tôt (haut) et au plus tard (bas). Le chemin critique est en rouge : tout retard dessus retarde le projet.')} actions={<Field label={t('Date visée')}>{(p) => <input {...p} type="date" value={target || d.projectDue || ''} onChange={(e) => setTarget(e.target.value)} style={{ fontSize: 16 }} />}</Field>}>
              <div className="bp-kpis">
                <Kpi label={t('Durée attendue du projet')} value={t('{n} jours', { n: num(d.duration, 1) })} sub={t('fin prévue le {date}', { date: dateFr(d.end) })} />
                <Kpi label={t('Écart-type')} value={t('± {n} jours', { n: num(d.sd, 1) })} sub={t('2 fois sur 3 la fin tombe entre {a} et {b} jours', { a: num(d.ranges.p68[0], 1), b: num(d.ranges.p68[1], 1) })} />
                {tg ? <Kpi label={t('Probabilité de tenir le {date}', { date: dateFr(tg.date) })} value={pct(prob * 100, 0)} sub={tg.marginDays >= 0 ? t('marge de {n} jours sur la durée attendue', { n: num(tg.marginDays, 1) }) : t('il manque {n} jours sur la durée attendue', { n: num(-tg.marginDays, 1) })} tone={tone} /> : null}
                {sim ? <Kpi label={t('Simulation : 8 fois sur 10 fini avant le')} value={dateFr(sim.p80Date)} sub={t('9 fois sur 10 avant le {date}', { date: dateFr(sim.p90Date) })} /> : null}
              </div>
              <Network d={d} onPick={(n) => (can('manager') ? edit(n) : null)} />
              <p className="muted small" style={{ marginTop: 8 }}>{can('manager') ? t('Cliquez sur une case pour saisir les durées optimiste, probable et pessimiste.') : t('Seuls les responsables modifient les estimations.')}{d.estimatedCount ? ' ' + t('{n} tâche(s) utilisent une estimation automatique (probable = vos heures estimées ou vos dates, optimiste −25 %, pessimiste +50 %).', { n: d.estimatedCount }) : ''}</p>
              <div className="ro-concl" role="status">
                {tg ? (prob >= 0.8
                  ? t('Le projet a {p} de chances d\'être terminé le {date} : la date est tenable. Surveillez quand même le chemin critique ({path}).', { p: pct(prob * 100, 0), date: dateFr(tg.date), path: crit.map((c) => c.title).join(' → ') })
                  : prob >= 0.5 ? t('Le projet n\'a que {p} de chances d\'être terminé le {date}. Gagnez des jours sur le chemin critique ({path}) ou repoussez la date.', { p: pct(prob * 100, 0), date: dateFr(tg.date), path: crit.map((c) => c.title).join(' → ') })
                    : t('La date du {date} est très risquée ({p} de chances seulement). Il faut raccourcir le chemin critique ({path}) ou négocier un délai : fin la plus probable le {end}.', { date: dateFr(tg.date), p: pct(prob * 100, 0), path: crit.map((c) => c.title).join(' → '), end: dateFr(d.end) }))
                  : t('Chemin critique : {path}.', { path: crit.map((c) => c.title).join(' → ') })}
              </div>
            </Card>
            <div className="bp-grid2 bp-sec">
              {sim ? (
                <Card title={t('Simulation de la date de fin')} subtitle={t('{n} scénarios tirés au hasard à partir de vos durées optimistes, probables et pessimistes.', { n: sim.runs })}>
                  <BarChart title={t('Répartition de la durée du projet sur {n} simulations', { n: sim.runs })} labels={sim.histogram.map((h) => num(h.from, 0))} fmt={(v) => String(Math.round(v))} height={220}
                    bars={[{ key: 'c', label: t('Nombre de scénarios'), values: sim.histogram.map((h) => h.count), color: 's1' }]} />
                  <p className="small">{t('Durée en jours : moitié des scénarios avant {a} j, 8 sur 10 avant {b} j, 9 sur 10 avant {c} j.', { a: num(sim.p50, 1), b: num(sim.p80, 1), c: num(sim.p90, 1) })}{sim.probabilityTarget !== undefined ? ' ' + t('Part des scénarios qui tiennent la date visée : {p}.', { p: pct(sim.probabilityTarget * 100, 0) }) : ''}</p>
                </Card>
              ) : null}
              <Card title={t('Tableau des activités')}>
                <div className="bp-scroll">
                  <table className="bp-table">
                    <thead><tr><th>{t('Tâche')}</th><th>{t('Opt. / prob. / pess.')}</th><th>{t('Durée')}</th><th>{t('Tôt')}</th><th>{t('Tard')}</th><th>{t('Marge')}</th><th>{''}</th></tr></thead>
                    <tbody>{d.nodes.map((n) => (
                      <tr key={n.id}>
                        <td><b>{n.title}</b><br /><small className="muted">{dateFr(n.earliestStart)} → {dateFr(n.earliestFinish)}{n.estimated ? ' · ' + t('estimation automatique') : ''}</small></td>
                        <td>{n.o} / {n.m} / {n.p}</td><td>{num(n.duration, 1)} ± {num(n.sd, 1)}</td><td>{num(n.es, 1)}–{num(n.ef, 1)}</td><td>{num(n.ls, 1)}–{num(n.lf, 1)}</td>
                        <td>{n.critical ? <Badge tone="danger">{t('critique')}</Badge> : num(n.float, 1) + ' ' + t('j')}</td>
                        <td>{can('manager') ? <button className="link" type="button" onClick={() => edit(n)}>{t('Estimer')}</button> : null}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        );
      }}
      </Loaded>
    </div>
  );
}
