import { useEffect, useState } from 'react';
import { useWs } from '../../../WsContext.jsx';
import { useT } from '../../../../lib/i18n.jsx';
import { Alert, Button, Card, EmptyState } from '../../../ui/index.jsx';
import { BarChart } from '../../bp/Charts.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion, EdTable } from './common.jsx';
import { FindingsBlock, FlowTech, cut } from './flowCommon.jsx';

/* Production · théorie des contraintes (TOC) : la contrainte du circuit, les 5 étapes de focalisation, le schéma tambour-tampon-corde et la comptabilité de débit.
   Le serveur calcule tout (GET /production/flows/:id/toc) ; le site dessine et explique. */

function Drum({ steps, c, r }) {
  const t = useT();
  const BW = 118; const BH = 54; const GX = 30; const BUF = 92; const Y = 78;
  const idx = Math.max(steps.findIndex((s) => s.id === c.id), 0);
  const pos = []; let x = 10;
  steps.forEach((s, i) => { if (i === idx && i > 0) x += BUF; pos.push(x); x += BW + GX; });
  const W = x - GX + 10; const H = Y + BH + 14;
  const mid = (i) => pos[i] + BW / 2;
  return (
    <div className="ro-net" role="figure" aria-label={t('Schéma tambour, tampon, corde')}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs><marker id="toc-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--plan)" /></marker><marker id="toc-rope" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--s2)" /></marker></defs>
        {steps.map((s, i) => (i > 0 ? <path key={'a' + s.id} d={`M${pos[i - 1] + BW + 2} ${Y + BH / 2} L${pos[i] - 3} ${Y + BH / 2}`} className="ro-edge" markerEnd="url(#toc-arrow)" /> : null))}
        {idx > 0 ? (
          <g>
            <rect x={pos[idx] - BUF + 14} y={Y + 6} width={BUF - 28} height={BH - 12} rx="14" fill="color-mix(in srgb, var(--s3) 16%, var(--surface))" stroke="var(--s3)" strokeWidth="2" strokeDasharray="5 3" />
            <text x={pos[idx] - BUF / 2} y={Y + BH / 2 - 1} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--fg)' }}>{t('Tampon')}</text>
            <text x={pos[idx] - BUF / 2} y={Y + BH / 2 + 13} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--muted)' }}>{t('{h} h', { h: num(r.bufferHours, 1) })}</text>
          </g>
        ) : null}
        {steps.map((s, i) => (
          <g key={s.id} className="ro-node">
            <rect x={pos[i]} y={Y} width={BW} height={BH} rx="10" fill={i === idx ? 'color-mix(in srgb, var(--pink) 10%, var(--surface))' : 'var(--surface)'} stroke={i === idx ? 'var(--pink)' : 'var(--line)'} strokeWidth={i === idx ? 3 : 1.5} />
            <text x={pos[i] + 8} y={Y + 20} className="ttl">{cut(s.name, 17)}</text>
            <text x={pos[i] + 8} y={Y + 38} className="mut">{i === idx ? t('Tambour (contrainte)') : t('{h} h', { h: num(s.hours / Math.max(s.slots, 1), 1) })}</text>
          </g>
        ))}
        {idx > 0 ? (
          <g>
            <path d={`M${mid(0)} ${Y - 2} C${mid(0)} 10 ${mid(idx)} 10 ${mid(idx)} ${Y - 4}`} fill="none" stroke="var(--s2)" strokeWidth="2.2" strokeDasharray="6 4" markerEnd="url(#toc-rope)" />
            <text x={(mid(0) + mid(idx)) / 2} y={30} textAnchor="middle" style={{ fontSize: 11.5, fontWeight: 700, fill: 'var(--s2)' }}>{t('Corde : un lot lancé toutes les {h} h', { h: num(r.rope.releaseEveryHours, 1) })}</text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function Extra({ flow, mgr, save }) {
  const t = useT();
  const [e, setE] = useState({ ...flow.extra });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setE({ ...flow.extra }); setDirty(false); }, [flow]);
  const keys = [['unitPrice', t('Prix de vente par lot')], ['materialCost', t('Coût matière par lot')], ['opexPerDay', t('Frais par jour')], ['inventoryValue', t('Valeur des stocks')]];
  return (
    <>
      <fieldset disabled={!mgr} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <EdTable head={keys.map((k) => k[1])} rows={[keys.map((k) => <Cell key={k[0]} label={k[1]} value={e[k[0]]} onChange={(v) => { setE((o) => ({ ...o, [k[0]]: v })); setDirty(true); }} />)]} />
      </fieldset>
      <p className="muted small">{t('Frais par jour : salaires, loyer, énergie… tout ce que vous dépensez pour faire tourner l\'atelier. Valeur des stocks : l\'argent immobilisé en matières, en cours et produits finis.')}</p>
      {mgr ? <Button variant="primary" icon="check" loading={busy} disabled={!dirty} onClick={() => { setBusy(true); save({ extra: e }).finally(() => setBusy(false)); }}>{t('Enregistrer et recalculer')}</Button> : <p className="muted small">{t('Consultation seule : seuls les responsables modifient ces hypothèses.')}</p>}
    </>
  );
}

function Result({ r, flow, mgr, act, save }) {
  const t = useT();
  const { money } = useWs();
  const c = r.constraint;
  if (!c) return <EmptyState icon="gear" title={t('Aucune contrainte à calculer')}>{t('Renseignez la durée de travail (heures par lot) d\'au moins une étape dans l\'onglet « Circuit de production ».')}</EmptyState>;
  const th = r.throughput; const el = r.elevate;
  const same = el.newConstraint === c.name;
  const sold = th.lotsPerDay;
  const steps5 = [
    { n: 1, title: t('1. Identifier la contrainte'), text: t('« {name} » limite tout le circuit : elle ne peut traiter que {cap} lots par jour, soit une charge de {load} % par rapport à l\'objectif.', { name: c.name, cap: num(c.capacityPerDay, 1), load: c.load === null ? '—' : num(c.load, 0) }) },
    { n: 2, title: t('2. Exploiter la contrainte'), text: t('Ne perdez aucune heure sur « {name} » : gardez devant elle un tampon d\'environ {h} h de travail (stock actuel : {s} lot(s)), contrôlez la qualité avant elle, évitez qu\'elle attende ou fasse des pauses en même temps.', { name: c.name, h: num(r.bufferHours, 1), s: num(r.buffer.stock, 1) }) },
    { n: 3, title: t('3. Subordonner le reste'), text: t('Toutes les autres étapes suivent le rythme de la contrainte : lancez une matière toutes les {h} h à « {first} » (c\'est la corde). Produire plus vite en amont ne ferait que créer des stocks.', { h: num(r.rope.releaseEveryHours, 1), first: r.rope.firstStep || '—' }) },
    { n: 4, title: t('4. Élever la contrainte'), text: el.gainLotsPerDay > 0
      ? t('Ajouter un poste à « {name} » donne +{gain} lot(s) par jour{money}. {next}', { name: c.name, gain: num(el.gainLotsPerDay, 2), money: th.hasMoney ? t(', soit +{m} de débit par jour', { m: money(el.gainPerDay) }) : '', next: same ? t('Elle resterait la contrainte.') : t('La nouvelle contrainte deviendrait « {n} » ({cap} lots par jour).', { n: el.newConstraint, cap: num(el.newCapacity, 1) }) })
      : t('Ajouter un poste à « {name} » ne ferait pas sortir plus de lots pour l\'instant : votre objectif est déjà atteint ou une autre étape (« {n} ») limite aussi.', { name: c.name, n: el.newConstraint }) },
    { n: 5, title: t('5. Recommencer'), text: same ? t('Après chaque amélioration, refaites l\'analyse : la contrainte peut se déplacer.') : t('Une fois « {name} » renforcée, la contrainte se déplace vers « {n} » : refaites alors les étapes 1 à 4 sur elle.', { name: c.name, n: el.newConstraint }) },
  ];
  return (
    <>
      <Conclusion>
        {t('La contrainte du circuit est « {name} » : {cap} lots par jour au maximum.', { name: c.name, cap: num(c.capacityPerDay, 1) })}{' '}
        {c.nextName ? t('L\'étape suivante la plus lente est « {n} » avec {cap} lots par jour.', { n: c.nextName, cap: num(c.nextCapacity, 1) }) : null}{' '}
        {t('Toute heure gagnée ailleurs qu\'à la contrainte ne fait pas sortir un lot de plus.')}
      </Conclusion>
      <div className="bp-kpis">
        <Kpi label={t('Contrainte')} value={c.name} sub={t('capacité {cap} lots/jour', { cap: num(c.capacityPerDay, 1) })} tone={c.load !== null && c.load > 100 ? 'bad' : c.load !== null && c.load >= 80 ? 'warn' : ''} />
        <Kpi label={t('Charge de la contrainte')} value={c.load === null ? '—' : num(c.load, 0) + ' %'} sub={t('objectif : {n} lots/jour', { n: num(flow.targetPerDay, 1) })} />
        <Kpi label={t('Tampon conseillé')} value={t('{h} h', { h: num(r.bufferHours, 1) })} sub={t('devant « {name} »', { name: c.name })} />
        <Kpi label={t('Corde')} value={t('{h} h', { h: num(r.rope.releaseEveryHours, 1) })} sub={t('entre deux lancements de matière')} />
      </div>
      <Card title={t('Tambour, tampon, corde')} subtitle={t('Le tambour donne le rythme (la contrainte), le tampon la protège, la corde relie l\'entrée du circuit au tambour pour ne lancer que ce qu\'il peut traiter.')}>
        <Drum steps={flow.steps} c={c} r={r} />
        {flow.steps.findIndex((s) => s.id === c.id) <= 0 ? <p className="muted small">{t('La contrainte est la première étape : il n\'y a ni tampon ni corde à dessiner.')}</p> : null}
      </Card>
      <Card title={t('Les 5 étapes de focalisation')} subtitle={t('La méthode de la théorie des contraintes, avec les chiffres de votre circuit.')}>
        <div className="ro-advice">{steps5.map((s) => <div key={s.n} className="ro-adv"><b>{s.title}</b><p>{s.text}</p></div>)}</div>
      </Card>
      <FindingsBlock flow={flow} codes={['tocNoBuffer']} mgr={mgr} act={act} title={t('Avis sur la contrainte')} subtitle={t('Le tampon protège la contrainte des aléas des étapes précédentes.')} okText={t('La contrainte est protégée, ou elle n\'est pas assez chargée pour demander un tampon.')} />
      <Card title={t('Comptabilité de débit')} subtitle={t('Trois mesures simples : le débit (T) est l\'argent gagné par les ventes moins la matière ; les stocks (I) sont l\'argent immobilisé ; les dépenses opérationnelles (OE) sont ce qu\'il en coûte pour faire tourner l\'atelier.')}>
        {!th.hasMoney ? <Alert tone="info" title={t('Prix de vente à renseigner')}>{t('Saisissez le prix de vente par lot ci-dessous pour voir le débit et le bénéfice en argent.')}</Alert> : null}
        <div className="bp-kpis">
          <Kpi label={t('Débit (T) par jour')} value={money(th.perDay)} sub={t('{n} lots × (prix − coût matière)', { n: num(sold, 1) })} tone={th.hasMoney && th.perDay <= 0 ? 'bad' : ''} />
          <Kpi label={t('Stocks (I)')} value={money(th.inventory)} sub={t('argent immobilisé')} />
          <Kpi label={t('Dépenses opérationnelles (OE) par jour')} value={money(th.opexPerDay)} />
          <Kpi label={t('Bénéfice net par jour')} value={money(th.netProfitPerDay)} sub={t('T − OE')} tone={th.hasMoney ? (th.netProfitPerDay < 0 ? 'bad' : 'good') : ''} />
          <Kpi label={t('ROI annuel')} value={th.roiYearPct === null ? '—' : num(th.roiYearPct, 0) + ' %'} sub={t('bénéfice net sur 250 jours ÷ stocks')} />
          <Kpi label={t('Productivité')} value={th.productivity === null ? '—' : num(th.productivity, 2)} sub={t('débit ÷ dépenses : au-dessus de 1, chaque franc dépensé en rapporte plus')} tone={th.productivity === null ? '' : th.productivity >= 1 ? 'good' : 'bad'} />
        </div>
        <Extra flow={flow} mgr={mgr} save={save} />
      </Card>
      <div className="bp-grid2 bp-sec">
        <Card title={t('Débit en lots : actuel et après élévation')} subtitle={t('Après l\'ajout d\'un poste sur la contrainte, dans la limite de votre objectif.')}>
          <BarChart title={t('Lots par jour, actuel et après élévation de la contrainte')} labels={[t('Actuel'), t('Après élévation')]} fmt={(v) => num(v, 2)} height={220}
            bars={[{ key: 'l', label: t('Lots par jour'), values: [sold, sold + el.gainLotsPerDay], color: 's1' }]} />
        </Card>
        {th.hasMoney ? (
          <Card title={t('Débit en argent : actuel et après élévation')} subtitle={t('Débit (T) par jour : ventes moins matières.')}>
            <BarChart title={t('Débit par jour, actuel et après élévation de la contrainte')} labels={[t('Actuel'), t('Après élévation')]} fmt={(v) => money(v)} height={220}
              bars={[{ key: 'm', label: t('Débit (T) par jour'), values: [th.perDay, th.perDay + el.gainPerDay], color: 's3' }]} />
          </Card>
        ) : null}
      </div>
    </>
  );
}

export default function Toc() {
  const t = useT();
  return (
    <FlowTech tech="toc" title={t('Théorie des contraintes (TOC)')} subtitle={t('Quelle étape limite tout le circuit, et comment gagner le plus en la traitant en premier ?')}>
      {(p) => <Result {...p} />}
    </FlowTech>
  );
}
