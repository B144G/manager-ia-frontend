/* eslint-disable react/jsx-key -- les cellules des tableaux modifiables sont des listes fixes, rendues par EdTable */
import { useT } from '../../../../lib/i18n.jsx';
import { Badge, Button, Card, EmptyState } from '../../../ui/index.jsx';
import { BarChart } from '../../bp/Charts.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Check, Conclusion, Doc, EdTable, Issues, PeriodGrid, PeriodTable, PeriodsField, Remove, Setup, Sub, nextId, useDoc, usePeriodLabels } from './common.jsx';

/* Production · plan directeur de production (MPS) : par produit fini, combien produire chaque semaine pour tenir les commandes et le stock de sécurité.
   Le serveur calcule la demande retenue, le plan, le stock projeté et le disponible à promettre (ATP). */

const blank = (id) => ({ id, name: '', onHand: '', safety: '', lotSize: '', maxPerPeriod: '', forecast: [], firm: [] });

function Editor({ d }) {
  const t = useT();
  const doc = d.doc;
  return (
    <>
      <PeriodsField value={doc.periods} onChange={(v) => d.upd(['periods'], v)} />
      <Check checked={doc.level} onChange={(v) => d.upd(['level'], v)}>{t('Lisser la charge : avancer la production qui dépasse le maximum par période')}</Check>
      <Sub>{t('Produits finis')}</Sub>
      <EdTable empty={t('Aucun produit. Ajoutez vos produits finis pour construire le plan directeur.')}
        head={[t('Code'), t('Produit'), t('Stock actuel'), t('Stock de sécurité'), t('Taille de lot'), t('Production maximale par période'), '']}
        rows={doc.products.map((p, i) => [
          <Cell type="text" label={t('Code')} value={p.id} onChange={(v) => d.upd(['products', i, 'id'], v)} />,
          <Cell type="text" label={t('Produit')} value={p.name} onChange={(v) => d.upd(['products', i, 'name'], v)} />,
          <Cell label={t('Stock actuel')} value={p.onHand} onChange={(v) => d.upd(['products', i, 'onHand'], v)} />,
          <Cell label={t('Stock de sécurité')} value={p.safety} onChange={(v) => d.upd(['products', i, 'safety'], v)} />,
          <Cell label={t('Taille de lot')} value={p.lotSize} onChange={(v) => d.upd(['products', i, 'lotSize'], v)} placeholder={t('au besoin')} />,
          <Cell label={t('Production maximale par période')} value={p.maxPerPeriod} onChange={(v) => d.upd(['products', i, 'maxPerPeriod'], v)} placeholder={t('illimitée')} />,
          <Remove onClick={() => d.set((o) => ({ ...o, products: o.products.filter((_, k) => k !== i) }))} />,
        ])} />
      {doc.products.map((p, i) => (
        <div key={i} style={{ marginTop: 10 }}>
          <b>{p.name || t('Produit {n}', { n: i + 1 })}</b>
          <PeriodGrid periods={doc.periods} head={t('Quantités par période')}
            rows={[{ key: 'f', label: t('Prévision de ventes'), values: p.forecast }, { key: 'c', label: t('Commandes fermes'), values: p.firm }]}
            onChange={(r, k, v) => d.upd(['products', i, r === 0 ? 'forecast' : 'firm', k], v)} />
        </div>
      ))}
      <div style={{ marginTop: 8 }}><Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, products: o.products.concat([blank(nextId(o.products))]) }))}>{t('Ajouter un produit')}</Button></div>
      <p className="muted small">{t('La demande retenue pour chaque période est la plus élevée entre la prévision et les commandes fermes. Le plan produit au plus tard, par lots, pour ne jamais passer sous le stock de sécurité.')}</p>
    </>
  );
}

function issueItems(t, issues) {
  return issues.map((x) => (x.code === 'mpsShortage'
    ? { tone: 'danger', title: t('Rupture prévue : {product}', { product: x.product }), text: t('Dès la période S{period}, le stock projeté devient négatif : la production ne suffit pas à couvrir la demande. Augmentez la production maximale, le stock de départ ou décalez des commandes.', { period: x.period }) }
    : { tone: 'warn', title: t('Lissage impossible : {product}', { product: x.product }), text: t('{qty} unités ne tiennent dans aucune période sous la production maximale. Relevez ce maximum (heures supplémentaires, deuxième équipe) ou réduisez la demande.', { qty: num(x.qty, 0) }) }));
}

function Result({ r }) {
  const t = useT();
  const labels = usePeriodLabels(r.periods);
  const tot = r.products.reduce((a, p) => ({ plan: a.plan + p.totalPlan, dem: a.dem + p.totalDemand }), { plan: 0, dem: 0 });
  const short = r.products.filter((p) => p.shortages.length).length;
  return (
    <>
      <Conclusion>
        {t('Pour {n} produit(s), le plan prévoit de fabriquer {plan} unités sur {weeks} semaines pour une demande de {dem}.', { n: r.products.length, plan: num(tot.plan, 0), weeks: r.periods, dem: num(tot.dem, 0) })}{' '}
        {r.issues.length ? t('Attention : {k} alerte(s) à traiter, détaillées ci-dessous.', { k: r.issues.length }) : t('Aucune rupture prévue : le plan couvre toute la demande.')}
      </Conclusion>
      <div className="bp-kpis">
        <Kpi label={t('Demande totale')} value={num(tot.dem, 0)} sub={t('sur {weeks} semaines', { weeks: r.periods })} />
        <Kpi label={t('Production planifiée')} value={num(tot.plan, 0)} />
        <Kpi label={t('Produits en rupture')} value={String(short)} tone={short ? 'bad' : 'good'} />
      </div>
      <Issues items={issueItems(t, r.issues)} />
      {r.products.map((p) => (
        <Card key={p.id} title={p.name} subtitle={t('Stock actuel {s}, stock de sécurité {z}', { s: num(p.onHand, 0), z: num(p.safety, 0) })} actions={p.shortages.length ? <Badge tone="danger">{t('rupture')}</Badge> : <Badge tone="ok">{t('couvert')}</Badge>}>
          <PeriodTable periods={r.periods} head={t('Par période')} fmt={(v) => num(v, 1)} rows={[
            { key: 'd', label: t('Demande'), values: p.demand },
            { key: 'p', label: t('Production'), values: p.plan, strong: true },
            { key: 's', label: t('Stock projeté'), values: p.projected, tone: (v) => (v < 0 ? 'bad' : v < p.safety ? 'warn' : '') },
            { key: 'a', label: t('Disponible à promettre (ATP)'), values: p.atp },
          ]} />
          <BarChart title={t('Production et stock projeté : {name}', { name: p.name })} labels={labels} fmt={(v) => num(v, 0)} height={220}
            bars={[{ key: 'prod', label: t('Production'), values: p.plan, color: 's1' }]}
            lines={[{ key: 'stock', label: t('Stock projeté'), values: p.projected.map((v) => Math.max(v, 0)), color: 's2' }, { key: 'dem', label: t('Demande'), values: p.demand, color: 'plan', dashed: true }]} />
          {p.shortages.length ? <p className="muted small">{t('Sur le graphique, un stock négatif (rupture) est ramené à 0 ; le tableau donne la valeur exacte.')}</p> : null}
        </Card>
      ))}
      <p className="muted small">{t("Le disponible à promettre (ATP) est la quantité que vous pouvez encore promettre à de nouveaux clients sans toucher aux commandes fermes ; il est calculé sur les périodes où l'on produit.")}</p>
    </>
  );
}

export default function Mps() {
  const t = useT();
  const d = useDoc('mps');
  return (
    <Doc d={d}>
      <Setup d={d} title={t('Plan directeur de production (MPS)')} subtitle={t('Que produire, produit par produit et semaine par semaine, pour livrer à temps sans stock inutile.')}>
        <Editor d={d} />
      </Setup>
      {d.result && d.result.products.length ? <Result r={d.result} /> : <EmptyState icon="chart" title={t('Pas encore de plan')}>{t('Ajoutez au moins un produit et ses prévisions, puis enregistrez.')}</EmptyState>}
    </Doc>
  );
}
