/* eslint-disable react/jsx-key -- les cellules des tableaux modifiables sont des listes fixes, rendues par EdTable */
import { useT } from '../../../../lib/i18n.jsx';
import { Badge, Button, Card, EmptyState, Segmented } from '../../../ui/index.jsx';
import { BarChart } from '../../bp/Charts.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion, Doc, EdTable, Issues, Pick, PeriodGrid, PeriodTable, PeriodsField, Remove, Setup, Sub, useDoc, usePeriodLabels } from './common.jsx';

/* Production · planification des capacités : la charge (heures) que demande le plan, poste par poste et semaine par semaine, comparée aux heures disponibles.
   Le serveur détecte les surcharges et calcule les solutions (heures supplémentaires, sous-traitance, décalage, lissage). */

function Editor({ d }) {
  const t = useT();
  const doc = d.doc;
  const names = doc.centers.map((c) => c.name).filter(Boolean);
  const products = doc.routings.map((r) => r.product).filter(Boolean);
  const upRouting = (i, fn) => d.set((o) => ({ ...o, routings: o.routings.map((r, n) => (n === i ? fn(r) : r)) }));
  return (
    <>
      <PeriodsField value={doc.periods} onChange={(v) => d.upd(['periods'], v)} />
      <Sub>{t('Postes de travail (machines, ateliers, équipes)')}</Sub>
      <EdTable empty={t('Aucun poste. Ajoutez vos machines ou ateliers.')} head={[t('Poste'), t('Heures disponibles par période'), t('Rendement (%)'), '']}
        rows={doc.centers.map((c, i) => [
          <Cell type="text" label={t('Poste')} value={c.name} onChange={(v) => d.upd(['centers', i, 'name'], v)} />,
          <Cell label={t('Heures disponibles par période')} value={c.hours} onChange={(v) => d.upd(['centers', i, 'hours'], v)} />,
          <Cell label={t('Rendement (%)')} value={c.efficiency} onChange={(v) => d.upd(['centers', i, 'efficiency'], v)} />,
          <Remove onClick={() => d.set((o) => ({ ...o, centers: o.centers.filter((_, k) => k !== i) }))} />,
        ])} />
      <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, centers: o.centers.concat([{ name: '', hours: '', efficiency: 100 }]) }))}>{t('Ajouter un poste')}</Button>
      <p className="muted small">{t("Le rendement tient compte des pannes et des arrêts : 85 % signifie que 100 heures d'ouverture donnent 85 heures utiles.")}</p>

      <Sub>{t('Gammes de fabrication : par quels postes passe chaque produit')}</Sub>
      {doc.routings.map((r, i) => (
        <Card flat key={i} title={r.product || t('Produit {n}', { n: i + 1 })} actions={<Remove onClick={() => d.set((o) => ({ ...o, routings: o.routings.filter((_, k) => k !== i) }))} />}>
          <EdTable head={[t('Produit (même nom que dans le plan directeur)')]} rows={[[<Cell type="text" label={t('Produit')} value={r.product} onChange={(v) => d.upd(['routings', i, 'product'], v)} />]]} />
          <EdTable empty={t('Aucune opération.')} head={[t('Poste'), t('Heures par unité'), t('Réglage (heures par lancement)'), '']}
            rows={r.ops.map((o, k) => [
              <Pick label={t('Poste')} value={o.center} onChange={(v) => d.upd(['routings', i, 'ops', k, 'center'], v)} options={[['', t('Choisir…')]].concat(names.concat(o.center && !names.includes(o.center) ? [o.center] : []).map((n) => [n, n]))} />,
              <Cell label={t('Heures par unité')} value={o.hoursPerUnit} onChange={(v) => d.upd(['routings', i, 'ops', k, 'hoursPerUnit'], v)} />,
              <Cell label={t('Réglage (heures par lancement)')} value={o.setup} onChange={(v) => d.upd(['routings', i, 'ops', k, 'setup'], v)} />,
              <Remove onClick={() => upRouting(i, (x) => ({ ...x, ops: x.ops.filter((_, m) => m !== k) }))} />,
            ])} />
          <Button size="sm" icon="plus" onClick={() => upRouting(i, (x) => ({ ...x, ops: x.ops.concat([{ center: '', hoursPerUnit: '', setup: '' }]) }))}>{t('Ajouter une opération')}</Button>
        </Card>
      ))}
      <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, routings: o.routings.concat([{ product: '', ops: [] }]) }))}>{t('Ajouter une gamme')}</Button>

      <Sub>{t('Quantités à produire')}</Sub>
      <Segmented label={t('Source des quantités')} value={doc.useMps ? 'mps' : 'manual'} onChange={(v) => d.upd(['useMps'], v === 'mps')}
        items={[{ id: 'mps', label: t('Plan directeur (MPS)') }, { id: 'manual', label: t('Saisie manuelle') }]} />
      {doc.useMps ? <p className="muted small">{t("Les quantités viennent du plan directeur : le nom du produit de la gamme doit être identique à celui du plan directeur.")}</p> : (
        <>
          <PeriodGrid periods={doc.periods} head={t('Quantités par période')} rows={doc.manual.map((m, i) => ({ key: i, label: <Pick label={t('Produit')} value={m.product} onChange={(v) => d.upd(['manual', i, 'product'], v)} options={[['', t('Choisir…')]].concat(products.concat(m.product && !products.includes(m.product) ? [m.product] : []).map((n) => [n, n]))} />, values: m.qty }))}
            onChange={(r, k, v) => d.upd(['manual', r, 'qty', k], v)} />
          <div style={{ marginTop: 6 }}><Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, manual: o.manual.concat([{ product: '', qty: [] }]) }))}>{t('Ajouter un produit')}</Button>{' '}{doc.manual.length ? <Button size="sm" onClick={() => d.set((o) => ({ ...o, manual: o.manual.slice(0, -1) }))}>{t('Retirer la dernière ligne')}</Button> : null}</div>
        </>
      )}
      <EdTable head={[t('Heures supplémentaires maximales (% de la capacité)')]} rows={[[<Cell label={t('Heures supplémentaires maximales (% de la capacité)')} value={doc.overtimeMaxPct} onChange={(v) => d.upd(['overtimeMaxPct'], v)} />]]} />
    </>
  );
}

function issueItems(t, issues) {
  return issues.map((x) => ({ tone: 'warn', title: t('Poste inconnu'), text: t("Une gamme utilise le poste « {center} » qui n'existe pas dans la liste des postes : ses heures ne sont pas comptées. Ajoutez ce poste ou corrigez son nom.", { center: x.center }) }));
}

/** Phrase simple pour une solution proposée par le serveur. */
function solText(t, s, ot, prev) {
  if (s.id === 'overtime') return t('Heures supplémentaires : {h} h (dans la limite de {p} % de la capacité).', { h: num(s.hours, 1), p: num(ot, 0) });
  if (s.id === 'subcontract') return t('Sous-traiter {h} h à un atelier extérieur : c\'est ce qui reste après les heures supplémentaires.', { h: num(s.hours, 1) });
  return t('Décaler jusqu\'à {h} h vers la période {p}, qui a de la marge.', { h: num(s.hours, 1), p: prev });
}

function Result({ r, ot }) {
  const t = useT();
  const labels = usePeriodLabels(r.periods);
  const b = r.centers.find((c) => c.name === r.bottleneck);
  const empty = r.centers.every((c) => c.load.every((v) => v === 0));
  const over = r.centers.filter((c) => c.overloads.length);
  return (
    <>
      {empty ? <EmptyState icon="chart" title={t('Aucune charge à calculer')}>{t('Ajoutez des gammes de fabrication et des quantités (plan directeur ou saisie manuelle), puis enregistrez.')}</EmptyState> : (
        <Conclusion>
          {r.overloadCount
            ? t('{k} surcharge(s) détectée(s) : certaines semaines, le travail demandé dépasse les heures disponibles. Les solutions sont proposées ci-dessous.', { k: r.overloadCount })
            : t('Aucune surcharge : tous les postes tiennent dans leur capacité sur {n} semaines.', { n: r.periods })}{' '}
          {b ? t('Le poste le plus sollicité (goulot) est « {name} », utilisé en moyenne à {u} %.', { name: b.name, u: num(b.avgUtil, 0) }) : null}
        </Conclusion>
      )}
      <div className="bp-kpis">
        <Kpi label={t('Poste goulot')} value={b ? b.name : '—'} sub={b ? t('utilisation moyenne {u} %', { u: num(b.avgUtil, 0) }) : undefined} tone={b && b.avgUtil > 100 ? 'bad' : b && b.avgUtil > 85 ? 'warn' : ''} />
        <Kpi label={t('Surcharges')} value={String(r.overloadCount)} sub={t('poste × semaine au-dessus de la capacité')} tone={r.overloadCount ? 'bad' : 'good'} />
        <Kpi label={t('Postes concernés')} value={String(over.length)} sub={t('sur {n}', { n: r.centers.length })} />
      </div>
      <Issues items={issueItems(t, r.issues)} />
      {empty ? null : (
        <>
          <Card title={t('Taux d\'utilisation des postes')} subtitle={t('Charge demandée divisée par la capacité. Au-dessus de 100 %, le poste est surchargé.')}>
            <PeriodTable periods={r.periods} head={t('Poste')} fmt={(v) => num(v, 0) + ' %'} rows={r.centers.map((c) => ({ key: c.name, label: c.name, values: c.utilization, tone: (v) => (v > 100 ? 'bad' : v > 85 ? 'warn' : '') }))} />
          </Card>
          <div className="bp-grid2 bp-sec">
            {r.centers.map((c) => (
              <Card key={c.name} title={c.name} subtitle={t('Capacité {c} h par période', { c: num(c.capacity, 1) })} actions={c.overloads.length ? <Badge tone="danger">{t('{n} surcharge(s)', { n: c.overloads.length })}</Badge> : <Badge tone="ok">{t('OK')}</Badge>}>
                <BarChart title={t('Charge et capacité : {name}', { name: c.name })} labels={labels} fmt={(v) => num(v, 1) + ' h'} height={220}
                  bars={[{ key: 'ok', label: t('Charge dans la capacité'), values: c.load.map((v) => Math.min(v, c.capacity)), color: 's1', stack: 'l' }, { key: 'ex', label: t('Surcharge'), values: c.load.map((v) => Math.max(v - c.capacity, 0)), color: 's2', stack: 'l' }]}
                  lines={[{ key: 'cap', label: t('Capacité'), values: c.load.map(() => c.capacity), color: 'plan', dashed: true }].concat(c.overloads.length ? [{ key: 'lv', label: t('Charge après lissage'), values: c.leveled, color: 's3' }] : [])} />
              </Card>
            ))}
          </div>
        </>
      )}
      {over.length ? (
        <Card title={t('Solutions pour chaque surcharge')} subtitle={t('Heures supplémentaires d\'abord, puis sous-traitance pour le reste ; le décalage et le lissage avancent du travail sur des semaines moins chargées.')}>
          {over.map((c) => (
            <div key={c.name}>
              {c.overloads.map((o) => (
                <div key={o.period} className={'ro-find' + (o.solutions.some((s) => s.id === 'subcontract') ? ' high' : '')}>
                  <h3>{t('{name}, {p} : {load} h demandées pour {cap} h disponibles', { name: c.name, p: t('S{n}', { n: o.period + 1 }), load: num(o.load, 1), cap: num(o.capacity, 1) })}</h3>
                  <p className="muted small" style={{ margin: 0 }}>{t('Il manque {h} h.', { h: num(o.excess, 1) })}</p>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {o.solutions.map((s) => <li key={s.id}>{solText(t, s, ot, t('S{n}', { n: o.period }))}</li>)}
                  </ul>
                </div>
              ))}
              <p className="muted small" style={{ margin: '0 0 12px' }}>{c.leveledStuck > 0
                ? t('Lissage de « {name} » : en avançant du travail sur les semaines précédentes, il resterait {h} h impossibles à placer : prévoyez de la sous-traitance ou plus de capacité.', { name: c.name, h: num(c.leveledStuck, 1) })
                : t('Lissage de « {name} » : possible. En avançant du travail sur les semaines précédentes, la charge tient dans la capacité (courbe verte du graphique).', { name: c.name })}</p>
            </div>
          ))}
        </Card>
      ) : null}
    </>
  );
}

export default function Capacity() {
  const t = useT();
  const d = useDoc('capacity');
  return (
    <Doc d={d}>
      <Setup d={d} title={t('Planification des capacités')} subtitle={t('Vos machines et ateliers ont-ils assez d\'heures pour fabriquer le plan ? Où et quand ça coince ?')}>
        <Editor d={d} />
      </Setup>
      {d.result && d.result.centers.length ? <Result r={d.result} ot={d.doc.overtimeMaxPct} /> : <EmptyState icon="chart" title={t('Pas encore de postes')}>{t('Ajoutez vos postes de travail et leurs gammes, puis enregistrez.')}</EmptyState>}
    </Doc>
  );
}
