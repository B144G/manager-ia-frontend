import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Alert, Badge, Button, Card, Segmented } from '../../ui/index.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { BarChart, Donut, LineChart } from '../bp/Charts.jsx';
import { Cell, Kpi, num, pct } from './ro-common.jsx';
import '../../../styles/ws-ro.css';

/* Projets · recherche opérationnelle automatique pour un projet de VENTE (maximiser la marge, trouver le meilleur prix) ou de PRODUCTION
   (minimiser le coût). Saisie des hypothèses, solution optimale calculée par le serveur (simplexe), prix duaux, élasticité-prix,
   graphiques et phrase de conclusion ; scénarios enregistrés et comparables. */

const COLORS = ['s1', 's2', 's3', 'plan'];
const blankSale = () => ({ products: [{ name: '', price: '', unitCost: '', minQty: '', maxQty: '' }], resources: [], fixedCosts: '', pa: false, priceAnalysis: { basePrice: '', baseQty: '', unitCost: '', elasticity: '1.5', capacityQty: '', fixedCosts: '' } });
const blankProd = () => ({ demand: { name: '', qty: '', unit: '' }, sources: [{ name: '', unitCost: '', capacity: '', minQty: '' }], resources: [], fixedCosts: '', targetMarginPct: '' });
const toState = (kind, inp) => {
  if (kind === 'sale') return { ...blankSale(), ...inp, pa: Boolean(inp.priceAnalysis), priceAnalysis: inp.priceAnalysis || blankSale().priceAnalysis };
  return { ...blankProd(), ...inp, demand: inp.demand || blankProd().demand, targetMarginPct: inp.targetMarginPct ?? '' };
};
const payload = (kind, s) => {
  if (kind === 'sale') return { products: s.products, resources: s.resources, fixedCosts: s.fixedCosts, priceAnalysis: s.pa ? s.priceAnalysis : null };
  return { demand: s.demand, sources: s.sources, resources: s.resources, fixedCosts: s.fixedCosts, targetMarginPct: s.targetMarginPct };
};

export function ConclusionText({ c, money, kind }) {
  const t = useT();
  const p = c.params;
  const m = (v) => money(Math.round(v));
  if (c.code === 'infeasible') return t('Aucune solution ne respecte toutes vos contraintes : la demande à satisfaire dépasse ce que vos moyens permettent. Augmentez une capacité ou baissez la demande.');
  if (c.code === 'unbounded') return t('Le problème n\'a pas de limite : il manque une contrainte (capacité, matière, demande maximale).');
  if (kind === 'sale') {
    const base = t('Le meilleur choix est de produire surtout « {top} » ({qty} unités) : cela rapporte {margin} de marge, soit {profit} de bénéfice après les charges fixes.', { top: p.top, qty: num(p.topQty, 0), margin: m(p.margin), profit: m(p.profit) });
    const lim = p.limit ? ' ' + t('Ce qui vous limite : « {limit} ». Chaque unité en plus ({unit}) ajouterait environ {gain} de marge.', { limit: p.limit, unit: p.unit || t('unité'), gain: m(p.gain) }) : ' ' + t('Aucune de vos ressources n\'est saturée : vous pouvez produire davantage si la demande suit.');
    const pr = p.price ? ' ' + t('Côté prix, le prix qui rapporte le plus est {price} ({change} par rapport à aujourd\'hui), ce qui ajoute {gain} de marge.', { price: m(p.price), change: (p.pricePct >= 0 ? '+' : '') + num(p.pricePct, 1) + ' %', gain: m(p.priceGain) }) : '';
    return base + lim + pr;
  }
  const base = t('Le moins cher est de produire surtout chez « {main} » ({share} du volume) : coût total {cost}, soit {unit} par unité.', { main: p.main, share: pct(p.mainPct, 0), cost: m(p.cost), unit: m(p.unitCost) });
  const lim = p.limit ? ' ' + t('Ce qui vous limite : « {limit} ». Une unité de plus de cette capacité ferait économiser environ {gain}.', { limit: p.limit, gain: m(p.gain) }) : '';
  const ex = p.extra > 0 ? ' ' + t('C\'est {extra} de plus que si tout pouvait être fait à la source la moins chère : l\'écart vient de vos limites de capacité.', { extra: m(p.extra) }) : '';
  const pr = p.price ? ' ' + t('Pour votre marge visée, vendez à {price} l\'unité.', { price: m(p.price) }) : '';
  return base + lim + ex + pr;
}

function Result({ r, kind }) {
  const t = useT();
  const { money } = useWs();
  if (r.status !== 'optimal') return <Alert tone="danger" title={t('Pas de solution')}><ConclusionText c={r.conclusion} money={money} kind={kind} /></Alert>;
  const T = r.totals; const split = r.costSplit.map((x, i) => ({ label: x.name === '__fixed' ? t('Charges fixes') : x.name, value: x.value, color: COLORS[Math.min(i, 3)] }));
  const cons = r.constraints.filter((c) => c.kind !== 'need');
  return (
    <>
      <div className="ro-concl" role="status"><ConclusionText c={r.conclusion} money={money} kind={kind} /></div>
      <div className="bp-kpis">
        {kind === 'sale' ? (
          <>
            <Kpi label={t('Bénéfice maximal')} value={money(T.profit)} sub={t('marge {m} − charges fixes {f}', { m: money(T.margin), f: money(T.fixedCosts) })} tone={T.profit >= 0 ? 'good' : 'bad'} />
            <Kpi label={t('Chiffre d\'affaires')} value={money(T.revenue)} sub={t('taux de marge {p}', { p: pct(T.marginPct, 1) })} />
            <Kpi label={t('Coûts variables')} value={money(T.variableCost)} />
          </>
        ) : (
          <>
            <Kpi label={t('Coût total minimal')} value={money(T.totalCost)} sub={t('dont charges fixes {f}', { f: money(T.fixedCosts) })} tone="good" />
            <Kpi label={t('Coût par unité')} value={money(T.unitCost)} sub={t('coût de la dernière unité : {m}', { m: money(T.marginalCost) })} />
            <Kpi label={t('Surcoût dû aux limites')} value={money(T.extraVsIdeal)} sub={t('par rapport à la source la moins chère sans limite')} tone={T.extraVsIdeal > 0 ? 'warn' : 'good'} />
            {T.suggestedPrice ? <Kpi label={t('Prix de vente conseillé')} value={money(T.suggestedPrice)} sub={t('pour la marge visée')} /> : null}
          </>
        )}
      </div>
      <div className="bp-grid2 bp-sec">
        <Card title={kind === 'sale' ? t('Solution optimale : quoi produire') : t('Solution optimale : qui produit quoi')}>
          <div className="bp-scroll"><table className="bp-table">
            {kind === 'sale' ? (
              <>
                <thead><tr><th>{t('Produit')}</th><th>{t('Quantité')}</th><th>{t('Marge unitaire')}</th><th>{t('Chiffre d\'affaires')}</th><th>{t('Marge')}</th></tr></thead>
                <tbody>{r.lines.map((l) => <tr key={l.name}><td>{l.name}{l.qty < 1e-6 ? <> <Badge>{t('non retenu')}</Badge></> : l.atDemand ? <> <Badge tone="info">{t('demande atteinte')}</Badge></> : null}</td><td>{num(l.qty, 1)}</td><td>{money(l.unitMargin)}</td><td>{money(l.revenue)}</td><td>{money(l.margin)}</td></tr>)}</tbody>
              </>
            ) : (
              <>
                <thead><tr><th>{t('Source')}</th><th>{t('Quantité')}</th><th>{t('Part')}</th><th>{t('Coût unitaire')}</th><th>{t('Coût')}</th></tr></thead>
                <tbody>{r.lines.map((l) => <tr key={l.name}><td>{l.name}{l.atCapacity ? <> <Badge tone="warn">{t('à fond')}</Badge></> : null}</td><td>{num(l.qty, 1)}</td><td>{pct(l.sharePct, 0)}</td><td>{money(l.unitCost)}</td><td>{money(l.cost)}</td></tr>)}</tbody>
              </>
            )}
          </table></div>
          <BarChart title={kind === 'sale' ? t('Marge par produit') : t('Quantités par source')} labels={r.lines.map((l) => l.name)} fmt={(v) => num(v, 0)} height={200}
            bars={[kind === 'sale' ? { key: 'm', label: t('Marge'), values: r.lines.map((l) => l.margin), color: 's3' } : { key: 'q', label: t('Quantité'), values: r.lines.map((l) => l.qty), color: 's1' }]} />
        </Card>
        <Card title={t('Répartition des coûts')}>
          <Donut title={t('Répartition des coûts')} items={split} fmt={(v) => money(v)} />
        </Card>
      </div>
      {cons.length ? (
        <Card title={t('Contraintes : ce qui est saturé et ce que vaut une unité de plus')} subtitle={t('Une contrainte saturée est un frein : le « prix dual » dit ce que rapporterait (ou ferait économiser) une unité supplémentaire.')}>
          <div className="bp-scroll"><table className="bp-table">
            <thead><tr><th>{t('Contrainte')}</th><th>{t('Utilisé / disponible')}</th><th>{t('Taux d\'usage')}</th><th>{t('Valeur d\'une unité en plus')}</th></tr></thead>
            <tbody>{cons.map((c) => (
              <tr key={c.name}><td>{c.name}{c.saturated ? <> <Badge tone="danger">{t('saturée')}</Badge></> : null}</td><td>{num(c.used, 1)} / {num(c.capacity, 1)} {c.unit}</td>
                <td><div className={'ro-bar' + (c.saturated ? ' full' : '')} role="img" aria-label={pct(c.usePct, 0)}><i style={{ width: Math.min(c.usePct, 100) + '%' }} /></div><small>{pct(c.usePct, 0)}</small></td>
                <td>{c.shadowPrice > 0 ? <b className="ro-pos">+ {money(c.shadowPrice)}</b> : '—'}</td></tr>
            ))}</tbody>
          </table></div>
          <BarChart title={t('Taux d\'usage des contraintes (%)')} labels={cons.map((c) => (c.name.length > 16 ? c.name.slice(0, 15) + '…' : c.name))} fmt={(v) => num(v, 0) + ' %'} height={190}
            bars={[{ key: 'u', label: t('Taux d\'usage'), values: cons.map((c) => c.usePct), color: 's1' }]} />
        </Card>
      ) : null}
      {r.price ? (
        <Card title={t('Prix de vente optimal')} subtitle={t('La demande baisse quand le prix monte (élasticité {e}) : la marge totale monte puis redescend.', { e: num(r.price.elasticity, 2) })}>
          <LineChart title={t('Marge totale selon le prix de vente')} labels={r.price.points.map((p) => num(p.price, 0))} fmt={(v) => num(v, 0)} height={240}
            marker={r.price.points.reduce((b, p, i) => (Math.abs(p.price - r.price.optimal.price) < Math.abs(r.price.points[b].price - r.price.optimal.price) ? i : b), 0)}
            series={[{ key: 'm', label: t('Marge totale'), values: r.price.points.map((p) => p.margin), color: 's1' }, { key: 'q', label: t('Quantités vendues × 1000'), values: r.price.points.map((p) => p.qty * 1000), color: 'plan', dashed: true }]} />
          <div className="bp-kpis">
            <Kpi label={t('Prix actuel')} value={money(r.price.current.price)} sub={t('marge {m}', { m: money(r.price.current.margin) })} />
            <Kpi label={t('Prix optimal')} value={money(r.price.optimal.price)} sub={t('{q} ventes, marge {m}', { q: num(r.price.optimal.qty, 1), m: money(r.price.optimal.margin) })} tone="good" />
            <Kpi label={t('Gain de marge')} value={money(r.price.optimal.gain)} sub={(r.price.optimal.changePct >= 0 ? '+' : '') + num(r.price.optimal.changePct, 1) + ' %'} />
          </div>
          {r.price.optimal.atEdge ? <p className="muted small">{t('L\'optimum est au bord de la plage étudiée : la demande est peu sensible au prix (élasticité ≤ 1) ; testez prudemment.')}</p> : null}
        </Card>
      ) : null}
    </>
  );
}

function Editor({ kind, s, set }) {
  const t = useT();
  const upd = (path, v) => set((o) => { const c = JSON.parse(JSON.stringify(o)); let ref = c; for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]]; ref[path[path.length - 1]] = v; return c; });
  const items = kind === 'sale' ? s.products : s.sources;
  const key = kind === 'sale' ? 'products' : 'sources';
  const addItem = () => set((o) => ({ ...o, [key]: o[key].concat([kind === 'sale' ? { name: '', price: '', unitCost: '', minQty: '', maxQty: '' } : { name: '', unitCost: '', capacity: '', minQty: '' }]), resources: o.resources.map((r) => ({ ...r, uses: r.uses.concat(['']) })) }));
  const delItem = (i) => set((o) => ({ ...o, [key]: o[key].filter((_, k) => k !== i), resources: o.resources.map((r) => ({ ...r, uses: r.uses.filter((_, k) => k !== i) })) }));
  const addRes = () => set((o) => ({ ...o, resources: o.resources.concat([{ name: '', unit: '', capacity: '', uses: o[key].map(() => '') }]) }));
  return (
    <>
      {kind === 'production' ? (
        <div className="ro-scroll"><table className="ro-ed"><thead><tr><th>{t('Production demandée')}</th><th>{t('Quantité à produire')}</th><th>{t('Unité')}</th><th>{t('Marge visée (%)')}</th></tr></thead>
          <tbody><tr><td><Cell type="text" label={t('Production demandée')} value={s.demand.name} onChange={(v) => upd(['demand', 'name'], v)} placeholder={t('Ex : briques, jus, savons')} /></td><td><Cell label={t('Quantité à produire')} value={s.demand.qty} onChange={(v) => upd(['demand', 'qty'], v)} /></td><td><Cell type="text" label={t('Unité')} value={s.demand.unit} onChange={(v) => upd(['demand', 'unit'], v)} /></td><td><Cell label={t('Marge visée (%)')} value={s.targetMarginPct} onChange={(v) => set((o) => ({ ...o, targetMarginPct: v }))} /></td></tr></tbody></table></div>
      ) : null}
      <h3 style={{ margin: '14px 0 6px', fontSize: 15 }}>{kind === 'sale' ? t('Produits à vendre') : t('Façons de produire (atelier, sous-traitant, heures supplémentaires…)')}</h3>
      <div className="ro-scroll"><table className="ro-ed">
        <thead><tr>{kind === 'sale' ? [t('Produit'), t('Prix de vente'), t('Coût variable unitaire'), t('Quantité minimale'), t('Demande maximale')] : [t('Source'), t('Coût unitaire'), t('Capacité maximale'), t('Quantité minimale')]}<th /></tr></thead>
        <tbody>{items.map((it, i) => (
          <tr key={i}>
            <td><Cell type="text" label={t('Nom')} value={it.name} onChange={(v) => upd([key, i, 'name'], v)} /></td>
            {kind === 'sale' ? <td><Cell label={t('Prix de vente')} value={it.price} onChange={(v) => upd([key, i, 'price'], v)} /></td> : null}
            <td><Cell label={t('Coût unitaire')} value={it.unitCost} onChange={(v) => upd([key, i, 'unitCost'], v)} /></td>
            {kind === 'production' ? <td><Cell label={t('Capacité maximale')} value={it.capacity} onChange={(v) => upd([key, i, 'capacity'], v)} placeholder={t('illimitée')} /></td> : null}
            <td><Cell label={t('Quantité minimale')} value={it.minQty} onChange={(v) => upd([key, i, 'minQty'], v)} /></td>
            {kind === 'sale' ? <td><Cell label={t('Demande maximale')} value={it.maxQty} onChange={(v) => upd([key, i, 'maxQty'], v)} placeholder={t('illimitée')} /></td> : null}
            <td>{items.length > 1 ? <button className="link" type="button" onClick={() => delItem(i)}>{t('Retirer')}</button> : null}</td>
          </tr>
        ))}</tbody>
      </table></div>
      <Button size="sm" icon="plus" onClick={addItem}>{kind === 'sale' ? t('Ajouter un produit') : t('Ajouter une source')}</Button>
      <h3 style={{ margin: '14px 0 6px', fontSize: 15 }}>{t('Contraintes (matières, heures de travail, machines…)')}</h3>
      {s.resources.length ? (
        <div className="ro-scroll"><table className="ro-ed">
          <thead><tr><th>{t('Contrainte')}</th><th>{t('Unité')}</th><th>{t('Disponible')}</th>{items.map((it, i) => <th key={i}>{t('Consommé par {name}', { name: it.name || (kind === 'sale' ? t('produit {n}', { n: i + 1 }) : t('source {n}', { n: i + 1 })) })}</th>)}<th /></tr></thead>
          <tbody>{s.resources.map((r, i) => (
            <tr key={i}>
              <td><Cell type="text" label={t('Contrainte')} value={r.name} onChange={(v) => upd(['resources', i, 'name'], v)} placeholder={t('Ex : bois, heures')} /></td>
              <td><Cell type="text" label={t('Unité')} value={r.unit} onChange={(v) => upd(['resources', i, 'unit'], v)} /></td>
              <td><Cell label={t('Disponible')} value={r.capacity} onChange={(v) => upd(['resources', i, 'capacity'], v)} /></td>
              {items.map((_, j) => <td key={j}><Cell label={t('Consommation')} value={r.uses[j]} onChange={(v) => upd(['resources', i, 'uses', j], v)} /></td>)}
              <td><button className="link" type="button" onClick={() => set((o) => ({ ...o, resources: o.resources.filter((_, k) => k !== i) }))}>{t('Retirer')}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <p className="muted small">{t('Sans contrainte, le système produira tout ce que la demande permet. Ajoutez vos limites pour un résultat réaliste.')}</p>}
      <Button size="sm" icon="plus" onClick={addRes}>{t('Ajouter une contrainte')}</Button>
      <div className="ro-scroll" style={{ marginTop: 12 }}><table className="ro-ed"><thead><tr><th>{t('Charges fixes (loyer, salaires…)')}</th></tr></thead><tbody><tr><td><Cell label={t('Charges fixes')} value={s.fixedCosts} onChange={(v) => set((o) => ({ ...o, fixedCosts: v }))} /></td></tr></tbody></table></div>
      {kind === 'sale' ? (
        <>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, marginTop: 8 }}><input type="checkbox" style={{ width: 22, height: 22 }} checked={s.pa} onChange={(e) => set((o) => ({ ...o, pa: e.target.checked }))} /><b>{t('Chercher aussi le meilleur prix de vente (élasticité-prix)')}</b></label>
          {s.pa ? (
            <div className="ro-scroll"><table className="ro-ed">
              <thead><tr><th>{t('Prix actuel')}</th><th>{t('Ventes actuelles (quantité)')}</th><th>{t('Coût unitaire')}</th><th>{t('Élasticité (1,5 = si le prix monte de 10 %, les ventes baissent de 15 %)')}</th><th>{t('Capacité maximale de production')}</th></tr></thead>
              <tbody><tr>{['basePrice', 'baseQty', 'unitCost', 'elasticity', 'capacityQty'].map((k) => <td key={k}><Cell label={k} value={s.priceAnalysis[k]} onChange={(v) => upd(['priceAnalysis', k], v)} /></td>)}</tr></tbody>
            </table></div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export default function Optim({ id, projectKind }) {
  const t = useT();
  const { oapi, money, fail, toast, confirm, modal } = useWs();
  const [kind, setKind] = useState(projectKind === 'production' ? 'production' : 'sale');
  const [s, setS] = useState(kind === 'sale' ? blankSale() : blankProd());
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pick, setPick] = useState([]);
  const [cmp, setCmp] = useState(null);
  const list = useLoad(() => oapi('GET', `/projects/${id}/ro/scenarios`), [id]);
  const changeKind = (k) => { setKind(k); setS(k === 'sale' ? blankSale() : blankProd()); setRes(null); setErr(''); setCmp(null); };
  useEffect(() => {
    oapi('GET', `/projects/${id}/ro/starter`).then((j) => {
      if (!j.boms.length) return;
      setS((o) => {
        if (kind === 'sale' && o.products.length === 1 && !o.products[0].name) return { ...o, products: j.boms.map((b) => ({ name: b.name, price: '', unitCost: b.unitCost, minQty: '', maxQty: '' })) };
        return o;
      });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const solve = () => {
    setBusy(true); setErr('');
    oapi('POST', `/projects/${id}/ro/solve`, { kind, inputs: payload(kind, s) }).then((j) => { setRes(j.result); setCmp(null); }).catch((e) => { setErr(tsrv(e.message)); setRes(null); }).finally(() => setBusy(false));
  };
  const save = () => modal(t('Enregistrer ce scénario'), (close) => (
    <Form fields={[{ k: 'name', label: t('Nom du scénario'), required: true, placeholder: t('Ex : prix actuel, +10 % de bois') }]} submitText={t('Enregistrer')}
      onSubmit={(v) => oapi('POST', `/projects/${id}/ro/scenarios`, { name: v.name, kind, inputs: payload(kind, s) }).then(() => { close(); toast(t('Scénario enregistré.')); list.reload(); })} />
  ));
  const open = (sc) => oapi('GET', `/projects/ro/scenarios/${sc.id}`).then((j) => { setKind(j.kind); setS(toState(j.kind, j.inputs)); setRes(j.result); setCmp(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }).catch(fail);
  const compare = () => oapi('GET', `/projects/${id}/ro/compare?ids=${pick.join(',')}`).then(setCmp).catch(fail);
  const toggle = (sid) => setPick((p) => (p.includes(sid) ? p.filter((x) => x !== sid) : p.concat([sid]).slice(-4)));
  return (
    <div className="bp">
      <Card title={t('Recherche opérationnelle')} subtitle={kind === 'sale' ? t('Objectif : MAXIMISER la marge de vente (et trouver le meilleur prix), sous vos contraintes.') : t('Objectif : MINIMISER le coût de production, en respectant la quantité demandée et vos limites.')}
        actions={<Segmented label={t('Objectif')} value={kind} onChange={changeKind} items={[{ id: 'sale', label: t('Vente : maximiser la marge') }, { id: 'production', label: t('Production : minimiser le coût') }]} />}>
        <Editor kind={kind} s={s} set={setS} />
        {err ? <p className="ws-err" role="alert">{err}</p> : null}
        <div className="row" style={{ marginTop: 12 }}>
          <Button variant="primary" icon="gauge" loading={busy} onClick={solve}>{t('Calculer la solution optimale')}</Button>
          {res && res.status === 'optimal' ? <Button icon="save" onClick={save}>{t('Enregistrer ce scénario')}</Button> : null}
        </div>
      </Card>
      {res ? <Result r={res} kind={kind} /> : null}
      <Card title={t('Scénarios enregistrés')} subtitle={t('Cochez 2 à 4 scénarios du même type pour les comparer.')} actions={pick.length >= 2 ? <Button size="sm" variant="primary" onClick={compare}>{t('Comparer')}</Button> : null}>
        <Loaded state={list}>{(d) => (!d.items.length ? <p className="muted">{t('Aucun scénario. Calculez une solution puis enregistrez-la pour la comparer à d\'autres hypothèses.')}</p> : (
          <div className="bp-scroll"><table className="bp-table">
            <thead><tr><th>{t('Scénario')}</th><th>{kind === 'sale' ? t('Bénéfice') : t('Coût total')}</th><th>{''}</th></tr></thead>
            <tbody>{d.items.map((sc) => (
              <tr key={sc.id}><td><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 20, height: 20 }} checked={pick.includes(sc.id)} onChange={() => toggle(sc.id)} aria-label={t('Comparer {name}', { name: sc.name })} /><span><b>{sc.name}</b><br /><small className="muted">{sc.kind === 'sale' ? t('Vente') : t('Production')}</small></span></label></td>
                <td>{sc.metrics ? money(sc.kind === 'sale' ? sc.metrics.profit : sc.metrics.cost) : t('sans solution')}</td>
                <td><button className="link" type="button" onClick={() => open(sc)}>{t('Rouvrir')}</button>{' '}<button className="link" type="button" onClick={() => confirm(t('Supprimer ce scénario ?'), () => oapi('DELETE', `/projects/ro/scenarios/${sc.id}`).then(() => { setPick((p) => p.filter((x) => x !== sc.id)); list.reload(); }).catch(fail))}>{t('Supprimer')}</button></td></tr>
            ))}</tbody>
          </table></div>
        ))}
        </Loaded>
        {cmp ? (
          <div style={{ marginTop: 14 }}>
            <BarChart title={cmp.kind === 'sale' ? t('Comparaison des bénéfices') : t('Comparaison des coûts totaux')} labels={cmp.items.map((i) => i.name)} fmt={(v) => num(v, 0)} height={210}
              bars={[{ key: 'k', label: cmp.kind === 'sale' ? t('Bénéfice') : t('Coût total'), values: cmp.items.map((i) => (i.metrics ? i.metrics[cmp.key] : null)), color: cmp.kind === 'sale' ? 's3' : 's2' }]} />
            <div className="bp-scroll"><table className="bp-table">
              <thead><tr><th>{''}</th>{cmp.items.map((i) => <th key={i.id}>{i.name}{i.id === cmp.best ? ' ★' : ''}</th>)}</tr></thead>
              <tbody>
                {(cmp.kind === 'sale' ? [['profit', t('Bénéfice')], ['margin', t('Marge')], ['revenue', t('Chiffre d\'affaires')], ['marginPct', t('Taux de marge (%)')], ['price', t('Prix optimal')]] : [['cost', t('Coût total')], ['unitCost', t('Coût par unité')], ['qty', t('Quantité')], ['price', t('Prix conseillé')]]).map(([k, label]) => (
                  <tr key={k}><td>{label}</td>{cmp.items.map((i) => <td key={i.id}>{i.metrics && i.metrics[k] !== null && i.metrics[k] !== undefined ? (k === 'marginPct' || k === 'qty' ? num(i.metrics[k], 1) : money(i.metrics[k])) : '—'}</td>)}</tr>
                ))}
              </tbody>
            </table></div>
            <div className="ro-concl">{t('Le meilleur scénario est « {name} » ({what}).', { name: (cmp.items.find((i) => i.id === cmp.best) || {}).name || '—', what: cmp.kind === 'sale' ? t('le bénéfice le plus élevé') : t('le coût le plus bas') })}</div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
