import { useT } from '../../../../lib/i18n.jsx';
import { Badge, Button, Card, EmptyState } from '../../../ui/index.jsx';
import { BarChart, Gauge } from '../../bp/Charts.jsx';
import { Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion } from './common.jsx';
import { FindingsBlock, FlowTech, StepEditor, cut } from './flowCommon.jsx';

/* Production · juste-à-temps (JIT) : en-cours, tailles de lot, fournisseurs et indicateur « prêt pour le tiré ».
   Le serveur calcule (GET /production/flows/:id/jit) ; le site affiche et explique. */

const JIT_CODES = ['jitSingleSupplier', 'jitLongLead', 'mudaOverproduction', 'mudaInventory'];

function Result({ r, flow, mgr, act, save, go }) {
  const t = useT();
  const open = (code) => flow.analysis.findings.some((f) => f.code === code && f.state === 'open');
  const target = flow.targetPerDay;
  const days = (v) => (target > 0 ? num(v / target, 1) : '—');
  const hasStock = r.wipLots > 0; const hasBatch = r.batches.length > 0; const supplied = r.suppliers.filter((s) => s.count > 0);
  const leadKnown = r.suppliers.some((s) => s.wait > 0);
  /* Quatre vérifications : 'ok', 'bad' ou 'unknown' (donnée non renseignée). */
  const checks = [
    { key: 'stock', label: t('Peu de stock devant les étapes'), state: !hasStock ? 'unknown' : open('mudaInventory') ? 'bad' : 'ok' },
    { key: 'batch', label: t('Lots proches de la demande du jour'), state: !hasBatch ? 'unknown' : open('mudaOverproduction') ? 'bad' : 'ok' },
    { key: 'sup', label: t('Plusieurs fournisseurs par approvisionnement'), state: !supplied.length ? 'unknown' : open('jitSingleSupplier') ? 'bad' : 'ok' },
    { key: 'lead', label: t('Délais d\'approvisionnement couverts'), state: !leadKnown ? 'unknown' : open('jitLongLead') ? 'bad' : 'ok' },
  ];
  const known = checks.filter((c) => c.state !== 'unknown'); const okN = known.filter((c) => c.state === 'ok').length; const badN = known.length - okN;
  const ready = known.length >= 3 && badN === 0;
  const pctReady = known.length ? Math.round(okN * 100 / known.length) : null;
  const steps = flow.steps;
  const names = steps.map((s) => cut(s.name, 12));
  const sup = r.suppliers;
  if (!steps.length) return <EmptyState icon="gear" title={t('Circuit vide')}>{t('Ajoutez des étapes dans l\'onglet « Circuit de production ».')}</EmptyState>;
  return (
    <>
      <Conclusion>
        {!known.length ? t('Renseignez les stocks, tailles de lot et fournisseurs de chaque étape pour savoir si votre circuit est prêt pour le juste-à-temps.')
          : ready ? t('Votre circuit est prêt pour le tiré : peu de stock, des lots proches de la demande et des approvisionnements sûrs. Vous pouvez produire uniquement ce qui est demandé.')
            : badN ? t('Pas encore prêt pour le tiré : {k} point(s) à régler avant de produire seulement à la demande, détaillés ci-dessous.', { k: badN }) : t('Les points renseignés sont bons, mais il manque des données pour conclure : complétez le tableau de saisie ci-dessous.')}{' '}
        {r.wipDays !== null && hasStock ? t('Les en-cours représentent {lots} lot(s), soit {d} jour(s) de demande.', { lots: num(r.wipLots, 1), d: num(r.wipDays, 1) }) : null}
      </Conclusion>
      <div className="bp-kpis">
        <Kpi label={t('En-cours total')} value={t('{n} lot(s)', { n: num(r.wipLots, 1) })} sub={r.wipDays === null ? undefined : t('{n} jour(s) de demande', { n: num(r.wipDays, 1) })} tone={r.wipDays !== null && r.wipDays > steps.length ? 'warn' : ''} />
        <Kpi label={t('Étapes avec un stock devant')} value={String(r.pullReady)} sub={t('sur {n}', { n: steps.length })} />
        <Kpi label={t('Approvisionnements à un seul fournisseur')} value={String(sup.filter((s) => s.count === 1).length)} tone={sup.some((s) => s.count === 1) ? 'bad' : 'good'} sub={t('sur {n} approvisionnement(s)', { n: sup.length })} />
      </div>
      <div className="bp-grid2 bp-sec">
        <Card title={t('Prêt pour le tiré ?')} subtitle={t('Le tiré (JIT) : on ne produit que ce que l\'étape suivante ou le client demande.')} actions={ready ? <Badge tone="ok">{t('prêt')}</Badge> : badN ? <Badge tone="warn">{t('pas encore prêt')}</Badge> : <Badge tone="neutral">{t('à renseigner')}</Badge>}>
          <div style={{ maxWidth: 240, margin: '0 auto' }}><Gauge value={pctReady} label={t('Critères remplis')} tone={pctReady === null ? '' : pctReady < 50 ? 'bad' : pctReady < 100 ? 'warn' : ''} /></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 4 }}>
            {checks.map((c) => <li key={c.key}>{c.state === 'ok' ? '✅' : c.state === 'bad' ? '⚠️' : '➖'} {c.label}{c.state === 'unknown' ? <span className="muted small"> ({t('non renseigné')})</span> : null}</li>)}
          </ul>
        </Card>
        <Card title={t('En-cours devant chaque étape')} subtitle={t('Lots qui attendent avant l\'étape. Plus la barre est haute, plus l\'argent dort.')}>
          <BarChart title={t('En-cours (lots) devant chaque étape')} labels={names} fmt={(v) => num(v, 1)} height={220} bars={[{ key: 'w', label: t('En-cours (lots)'), values: steps.map((s) => Number(s.stockBefore) || 0), color: 's1' }]} />
        </Card>
      </div>
      <Card title={t('En-cours et tailles de lot')} subtitle={t('Exprimés en jours de demande : un chiffre proche de 1 jour ou moins est le signe d\'un flux tiré.')}>
        <div className="bp-scroll"><table className="bp-table">
          <thead><tr><th>{t('Étape')}</th><th>{t('En-cours devant (lots)')}</th><th>{t('en jours de demande')}</th><th>{t('Taille de lot')}</th><th>{t('en jours de demande')}</th></tr></thead>
          <tbody>{steps.map((s) => {
            const st = Number(s.stockBefore) || 0; const b = Number(s.batch) || 0;
            return (
              <tr key={s.id}>
                <td>{s.name}</td><td>{num(st, 1)}</td><td className={target > 0 && st / target > 1 ? 'ro-neg' : ''}>{days(st)}</td>
                <td>{b ? num(b, 1) : '—'}</td><td className={target > 0 && b > target * 1.5 ? 'ro-neg' : ''}>{b ? days(b) : '—'}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </Card>
      <Card title={t('Fournisseurs par approvisionnement')} subtitle={t('Un seul fournisseur et un long délai sont les deux grands risques du juste-à-temps.')}>
        {!sup.length ? <EmptyState icon="gear" title={t('Aucune étape d\'approvisionnement')}>{t('Donnez le type « Approvisionnement » à une étape du circuit pour suivre ses fournisseurs.')}</EmptyState> : (
          <div className="bp-scroll"><table className="bp-table">
            <thead><tr><th>{t('Étape d\'approvisionnement')}</th><th>{t('Nombre de fournisseurs')}</th><th>{t('Délai d\'attente (h)')}</th><th /></tr></thead>
            <tbody>{sup.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td className={s.count === 1 ? 'ro-neg' : ''}>{s.count || '—'}</td><td>{s.wait ? num(s.wait, 1) : '—'}</td>
                <td>{s.count === 1 ? <Badge tone="danger">{t('fournisseur unique')}</Badge> : s.count > 1 ? <Badge tone="ok">{t('sécurisé')}</Badge> : <Badge tone="neutral">{t('à renseigner')}</Badge>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <FindingsBlock flow={flow} codes={JIT_CODES} mgr={mgr} act={act} title={t('Risques du juste-à-temps')} subtitle={t('Pour chacun : appliquez la solution proposée, ou écartez-la si vous l\'assumez.')} okText={t('Aucun risque détecté avec les données saisies.')} />
      <Card title={t('Dimensionner les cartes kanban')} subtitle={t('Le kanban est l\'outil qui fait vivre le tiré : une carte vide dit « produis » ou « commande ».')}>
        <Button variant="primary" onClick={() => go && go('kanban')}>{t('Ouvrir l\'onglet Kanban')}</Button>
      </Card>
      <StepEditor flow={flow} mgr={mgr} save={save} title={t('Données JIT de chaque étape')} subtitle={t('Stock devant l\'étape, taille de lot, nombre de fournisseurs et délai d\'attente.')}
        fields={[{ k: 'stockBefore', label: t('Stock avant l\'étape (lots)') }, { k: 'batch', label: t('Taille de lot') }, { k: 'suppliers', label: t('Fournisseurs'), step: '1' }, { k: 'waitHours', label: t('Attente avant (h)') }]} />
    </>
  );
}

export default function Jit({ go }) {
  const t = useT();
  return (
    <FlowTech tech="jit" title={t('Juste-à-temps (JIT)')} subtitle={t('Votre circuit peut-il produire uniquement ce qui est demandé, sans gros stocks ni rupture d\'approvisionnement ?')}>
      {(p) => <Result {...p} go={go} />}
    </FlowTech>
  );
}
