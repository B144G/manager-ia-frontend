import { useT } from '../../../../lib/i18n.jsx';
import { Badge, Card, EmptyState } from '../../../ui/index.jsx';
import { BarChart, Gauge } from '../../bp/Charts.jsx';
import { Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion } from './common.jsx';
import { FindingsBlock, FlowTech, StepEditor, cut } from './flowCommon.jsx';

/* Production · Lean : cartographie de flux (VSM) simplifiée, takt time, délai de traversée, taux de valeur ajoutée, 8 gaspillages (muda).
   Le serveur calcule tout (GET /production/flows/:id/lean) ; le site dessine et explique. */

const CLS_COLOR = { va: 'var(--s3)', bnva: 'var(--signal)', nva: 'var(--pink)' };
const clsName = (t) => ({ va: t('Valeur ajoutée'), bnva: t('Nécessaire sans valeur ajoutée'), nva: t('Gaspillage') });
const LEAN_CODES = ['mudaTransport', 'mudaInventory', 'mudaMotion', 'mudaWaiting', 'mudaOverproduction', 'mudaOverprocessing', 'mudaDefects', 'mudaTalent', 'overTakt', 'leanLowVa'];

/** Les 8 gaspillages : code d'avis, nom, explication, solution proposée. */
const MUDA = (t) => [
  { code: 'mudaTransport', name: t('Transport'), what: t('Déplacer la matière ou les lots d\'un poste à l\'autre.'), sol: t('Rapprocher les postes et supprimer les manutentions inutiles.') },
  { code: 'mudaInventory', name: t('Stocks'), what: t('Matière ou produits qui attendent devant une étape.'), sol: t('Réduire les stocks et piloter le réapprovisionnement avec des cartes kanban.') },
  { code: 'mudaMotion', name: t('Mouvements'), what: t('Chercher, se baisser, marcher pour atteindre un outil.'), sol: t('Ranger le poste avec la méthode 5S : une place pour chaque chose.') },
  { code: 'mudaWaiting', name: t('Attentes'), what: t('Le lot ou la personne attend l\'étape précédente.'), sol: t('Équilibrer la charge entre les postes et réduire les temps morts.') },
  { code: 'mudaOverproduction', name: t('Surproduction'), what: t('Fabriquer plus ou plus tôt que ce que le client demande.'), sol: t('Réduire la taille des lots et produire seulement sur demande (tiré).') },
  { code: 'mudaOverprocessing', name: t('Sur-traitement'), what: t('Faire plus de travail que ce que le client paie.'), sol: t('Supprimer ou simplifier les opérations que le client ne voit pas.') },
  { code: 'mudaDefects', name: t('Défauts'), what: t('Produits à refaire, à réparer ou à jeter.'), sol: t('Contrôler à la source et installer des détrompeurs (poka-yoke).') },
  { code: 'mudaTalent', name: t('Talents inutilisés'), what: t('Les idées et compétences des personnes ne servent pas.'), sol: t('Associer l\'équipe à l\'amélioration de son poste.') },
];

function Vsm({ r }) {
  const t = useT();
  const BW = 148; const BH = 92; const GX = 70; const TOP = 46; const n = r.steps.length;
  const W = GX + n * (BW + GX) + 8; const H = TOP + BH + 12;
  const names = clsName(t);
  return (
    <div className="ro-net" role="figure" aria-label={t('Cartographie du flux de valeur (VSM)')}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs><marker id="lean-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--plan)" /></marker></defs>
        {r.steps.map((s, i) => {
          const bx = GX + i * (BW + GX); const cy = TOP + BH / 2; const col = CLS_COLOR[s.cls];
          return (
            <g key={s.id}>
              <path d={`M${i === 0 ? 8 : bx - GX + 2} ${cy} L${bx - 3} ${cy}`} className="ro-edge" markerEnd="url(#lean-arrow)" />
              {s.stock > 0 ? (
                <g transform={`translate(${bx - GX / 2 - 15} ${TOP - 40})`} role="img" aria-label={t('Stock avant « {name} » : {n}', { name: s.name, n: num(s.stock, 1) })}>
                  <polygon points="15,0 30,26 0,26" fill="color-mix(in srgb, var(--signal) 25%, var(--surface))" stroke="var(--signal)" strokeWidth="1.8" />
                  <text x="15" y="22" textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: 'var(--fg)' }}>{num(s.stock, 0)}</text>
                  <text x="15" y="38" textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--muted)' }}>{t('stock')}</text>
                </g>
              ) : null}
              <g className="ro-node">
                <rect x={bx} y={TOP} width={BW} height={BH} rx="10" fill={`color-mix(in srgb, ${col} 14%, var(--surface))`} stroke={s.overTakt ? 'var(--pink)' : col} strokeWidth={s.overTakt ? 3 : 1.8} strokeDasharray={s.overTakt ? '6 3' : undefined} />
                <text x={bx + 8} y={TOP + 17} className="ttl">{cut(s.name, 20)}</text>
                <text x={bx + 8} y={TOP + 34} className="mut">{t('Temps de cycle : {h} h', { h: num(s.cycle, 1) })}</text>
                <text x={bx + 8} y={TOP + 49} className="mut">{names[s.cls]}</text>
                <text x={bx + 8} y={TOP + 64} className="mut">{t('Attente {w} h · transport {m} h', { w: num(s.wait, 1), m: num(s.move, 1) })}</text>
                {s.overTakt ? <text x={bx + 8} y={TOP + 80} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--pink)' }}>{t('Plus lent que le takt')}</text> : null}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Frise du temps : alterne les temps d'attente (gris) et les temps de travail (couleur de l'étape). */
function Timeline({ r }) {
  const t = useT();
  const segs = [];
  r.steps.forEach((s) => {
    const idle = s.wait + s.move + s.motion;
    if (idle > 0) segs.push({ key: s.id + 'w', h: idle, idle: true, label: t('Attente, transport et mouvements avant « {name} » : {h} h', { name: s.name, h: num(idle, 1) }) });
    if (s.process > 0) segs.push({ key: s.id + 'p', h: s.process, cls: s.cls, label: t('« {name} » : {h} h de travail ({c})', { name: s.name, h: num(s.process, 1), c: clsName(t)[s.cls] }) });
  });
  if (!segs.length) return null;
  const total = segs.reduce((a, x) => a + x.h, 0);
  return (
    <div role="figure" aria-label={t('Frise du temps')} style={{ marginTop: 14 }}>
      <b style={{ fontSize: 13 }}>{t('Frise du temps : le lot passe {lead} h dans le circuit, dont {va} h de travail qui crée de la valeur', { lead: num(r.leadTime, 1), va: num(r.valueAddedTime, 1) })}</b>
      <div style={{ display: 'flex', height: 30, marginTop: 6, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {segs.map((x) => <div key={x.key} title={x.label} style={{ flex: `${x.h} 1 0`, minWidth: 3, background: x.idle ? 'repeating-linear-gradient(45deg, var(--surface2), var(--surface2) 4px, var(--surface) 4px, var(--surface) 8px)' : CLS_COLOR[x.cls], borderRight: '1px solid var(--surface)' }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}><span>0 h</span><span>{num(total / 2, 1)} h</span><span>{num(total, 1)} h</span></div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, marginTop: 4 }}>
        {['va', 'bnva', 'nva'].map((k) => <span key={k}><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: CLS_COLOR[k], marginRight: 6, verticalAlign: -1 }} aria-hidden="true" />{clsName(t)[k]}</span>)}
        <span><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--surface2)', border: '1px solid var(--line)', marginRight: 6, verticalAlign: -1 }} aria-hidden="true" />{t('Attente, transport, mouvements')}</span>
      </div>
    </div>
  );
}

function Result({ r, flow, mgr, act, save }) {
  const t = useT();
  const found = (code) => flow.analysis.findings.filter((f) => f.code === code);
  const slow = r.steps.filter((s) => s.overTakt);
  const va = r.vaRatio;
  const names = r.steps.map((s) => cut(s.name, 12));
  if (!r.steps.length) return <EmptyState icon="gear" title={t('Circuit vide')}>{t('Ajoutez des étapes dans l\'onglet « Circuit de production ».')}</EmptyState>;
  return (
    <>
      <Conclusion>
        {t('Un lot met {lead} h à traverser le circuit, mais seulement {va} h créent de la valeur pour le client : {pct} % du temps.', { lead: num(r.leadTime, 1), va: num(r.valueAddedTime, 1), pct: num(va, 0) })}{' '}
        {r.takt === null ? t('Fixez un objectif de lots par jour pour calculer le takt time.') : slow.length
          ? t('Le rythme demandé est d\'un lot toutes les {takt} h (takt time) ; {k} étape(s) sont plus lentes et ne suivent pas.', { takt: num(r.takt, 2), k: slow.length })
          : t('Toutes les étapes tiennent le rythme demandé d\'un lot toutes les {takt} h (takt time).', { takt: num(r.takt, 2) })}
      </Conclusion>
      <Card title={t('Cartographie du flux de valeur (VSM)')} subtitle={t('Une boîte par étape : vert = crée de la valeur, orange = nécessaire sans créer de valeur, rouge = gaspillage. Triangle = stock avant l\'étape. Contour pointillé rouge = plus lent que le takt.')}>
        <Vsm r={r} />
        <Timeline r={r} />
      </Card>
      <div className="bp-kpis">
        <Kpi label={t('Takt time')} value={r.takt === null ? '—' : t('{n} h par lot', { n: num(r.takt, 2) })} sub={t('{h} h de travail par jour ÷ {n} lots demandés', { h: num(flow.hoursPerDay, 1), n: num(flow.targetPerDay, 1) })} />
        <Kpi label={t('Délai de traversée')} value={t('{n} h', { n: num(r.leadTime, 1) })} sub={t('travail + attentes + transports + mouvements')} />
        <Kpi label={t('Temps de valeur ajoutée')} value={t('{n} h', { n: num(r.valueAddedTime, 1) })} sub={t('temps nécessaire sans valeur ajoutée : {n} h', { n: num(r.necessaryTime, 1) })} />
        <Kpi label={t('Étapes plus lentes que le takt')} value={String(slow.length)} tone={slow.length ? 'bad' : 'good'} sub={slow.length ? slow.map((s) => s.name).join(', ') : t('toutes tiennent le rythme')} />
      </div>
      <div className="bp-grid2 bp-sec">
        <Card title={t('Taux de valeur ajoutée')} subtitle={t('Part du délai de traversée où l\'on fait vraiment avancer le produit pour le client.')}>
          <div style={{ maxWidth: 260, margin: '0 auto' }}><Gauge value={va} label={t('Valeur ajoutée / délai')} tone={va === null ? '' : va < 25 ? 'bad' : va < 50 ? 'warn' : ''} /></div>
          <p className="muted small">{t('Dans beaucoup d\'ateliers, ce taux est inférieur à 10 % : le gain est surtout dans l\'attente, pas dans le travail.')}</p>
        </Card>
        <Card title={t('Temps de cycle et takt time')} subtitle={t('Une barre au-dessus de la ligne pointillée : l\'étape est trop lente pour le rythme demandé.')}>
          <BarChart title={t('Temps de cycle de chaque étape contre le takt time (heures)')} labels={names} fmt={(v) => num(v, 2) + ' h'} height={230}
            bars={[{ key: 'c', label: t('Temps de cycle'), values: r.steps.map((s) => s.cycle), color: 's1' }]}
            lines={r.takt === null ? [] : [{ key: 'tk', label: t('Takt time'), values: r.steps.map(() => r.takt), color: 's2', dashed: true }]} />
        </Card>
      </div>
      <Card title={t('Les 8 gaspillages (muda)')} subtitle={t('Pour chacun : repéré ou non dans votre circuit, et la solution classique. Renseignez les données Lean de chaque étape pour que le système les repère.')}>
        <div className="bp-scroll"><table className="bp-table">
          <thead><tr><th>{t('Gaspillage')}</th><th>{t('Dans votre circuit')}</th><th>{t('Solution proposée')}</th></tr></thead>
          <tbody>{MUDA(t).map((m) => {
            const f = found(m.code); const open = f.find((x) => x.state === 'open');
            return (
              <tr key={m.code}>
                <td><b>{m.name}</b><br /><small className="muted">{m.what}</small></td>
                <td>{open ? <><Badge tone="warn">{t('Repéré')}</Badge><br /><small>{open.params.steps}</small></> : f.length ? <Badge tone="neutral">{t('Écarté')}</Badge> : <Badge tone="ok">{t('Non repéré')}</Badge>}</td>
                <td>{m.sol}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </Card>
      <FindingsBlock flow={flow} codes={LEAN_CODES} mgr={mgr} act={act} title={t('Avis Lean sur ce circuit')} subtitle={t('Appliquez une solution proposée, ou écartez l\'avis si vous l\'assumez.')} okText={t('Aucun gaspillage ni retard de rythme détecté avec les données saisies.')} />
      <StepEditor flow={flow} mgr={mgr} save={save} title={t('Données Lean de chaque étape')} subtitle={t('Temps en heures par lot. Laissez 0 ce que vous ne connaissez pas.')}
        fields={[{ k: 'cls', label: t('Nature du temps'), type: 'cls' }, { k: 'waitHours', label: t('Attente avant (h)') }, { k: 'moveHours', label: t('Transport (h)') }, { k: 'motionHours', label: t('Mouvements (h)') }, { k: 'stockBefore', label: t('Stock avant l\'étape (lots)') }, { k: 'defectPct', label: t('Défauts (%)') }, { k: 'batch', label: t('Taille de lot') }, { k: 'talentUnused', label: t('Talents inutilisés'), type: 'bool' }]} />
    </>
  );
}

export default function Lean() {
  const t = useT();
  return (
    <FlowTech tech="lean" title={t('Lean : supprimer les gaspillages')} subtitle={t('Où le temps est-il perdu entre l\'arrivée de la matière et la sortie du produit ? Que faire en premier ?')}>
      {(p) => <Result {...p} />}
    </FlowTech>
  );
}
