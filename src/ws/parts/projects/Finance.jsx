import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, Segmented } from '../../ui/index.jsx';
import { Loaded, useLoad } from '../../ui.jsx';
import { BarChart, Donut, LineChart } from '../bp/Charts.jsx';
import { Cell, Kpi, num, pct } from './ro-common.jsx';
import '../../../styles/ws-ro.css';

/* Projets · budget et coûts : valeur acquise (EVM), structure des coûts (CBS), coûts par activités (ABC), rentabilité (ROI, VAN, TRI),
   budget prévisionnel mensuel et analyse des écarts. Réservé aux responsables (montants). Calculs faits par le serveur. */

const CATS = (t) => ({ labor: t('Main-d\'œuvre'), material: t('Matériaux'), equipment: t('Équipement'), subcontract: t('Sous-traitance'), overhead: t('Frais généraux'), other: t('Autre') });
const clone = (o) => JSON.parse(JSON.stringify(o));
const sign = (v) => (v > 0 ? 'ro-pos' : v < 0 ? 'ro-neg' : '');

function useSave(id, kind, reload) {
  const { oapi, toast, fail } = useWs(); const t = useT();
  return (doc) => oapi('PUT', `/projects/${id}/fin/${kind}`, doc).then(() => { toast(t('Enregistré.')); reload(); }).catch(fail);
}

/* ---------- Valeur acquise ---------- */
function Evm({ d, openTool }) {
  const t = useT(); const { money } = useWs();
  const e = d.evm;
  if (e.mode !== 'money') return <Card title={t('Valeur acquise (EVM)')}><p className="muted">{t('Indiquez un budget pour le projet : la valeur acquise compare alors ce qui est prévu, ce qui est produit et ce qui est dépensé.')}</p></Card>;
  const tone = (v) => (v === null ? '' : v < 0.8 ? 'bad' : v < 0.95 ? 'warn' : 'good');
  return (
    <Card title={t('Valeur acquise (EVM)')} subtitle={t('Comparer ce qui était prévu (PV), ce qui est réellement produit (EV) et ce qui a été dépensé (AC).')} actions={<Button size="sm" onClick={() => openTool('pilot')}>{t('Voir la courbe en S')}</Button>}>
      <div className="bp-kpis">
        <Kpi label={t('Budget total (BAC)')} value={money(e.bac)} />
        <Kpi label={t('Valeur prévue (PV)')} value={money(e.pv)} sub={t('ce qui devrait être fait à ce jour')} />
        <Kpi label={t('Valeur acquise (EV)')} value={money(e.ev)} sub={t('ce qui est réellement fait')} />
        <Kpi label={t('Coût réel (AC)')} value={money(e.ac)} />
        <Kpi label={t('Indice de délai (SPI)')} value={num(e.spi)} sub={e.spi >= 1 ? t('en avance ou dans les temps') : t('en retard sur le planning')} tone={tone(e.spi)} />
        <Kpi label={t('Indice de coût (CPI)')} value={num(e.cpi)} sub={e.cpi >= 1 ? t('chaque franc dépensé produit plus d\'un franc') : t('on dépense plus que la valeur produite')} tone={tone(e.cpi)} />
        <Kpi label={t('Coût final prévu (EAC)')} value={money(e.eac)} sub={t('reste à dépenser {etc}', { etc: money(e.etc) })} tone={e.eac > e.bac ? 'bad' : 'good'} />
        <Kpi label={t('Écart final (VAC)')} value={money(e.vac)} sub={e.vac >= 0 ? t('économie prévue') : t('dépassement prévu')} tone={e.vac >= 0 ? 'good' : 'bad'} />
      </div>
    </Card>
  );
}

/* ---------- CBS ---------- */
function Cbs({ d, reload }) {
  const t = useT(); const { money } = useWs();
  const [lines, setLines] = useState(() => clone(d.docs.cbs.lines));
  const save = useSave(d.project.id, 'cbs', reload);
  const set = (i, k, v) => setLines((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const add = (parentId) => setLines((l) => l.concat([{ id: 'c' + Date.now().toString(36) + l.length, parentId: parentId || null, code: '', name: '', category: 'material', budget: '', actual: '', etc: '', qtyB: '', priceB: '', qtyA: '', priceA: '' }]));
  const del = (i) => setLines((l) => { const id = l[i].id; return l.filter((_, j) => j !== i).map((x) => (x.parentId === id ? { ...x, parentId: null } : x)); });
  const C = d.cbs; const cats = CATS(t);
  const leaves = C.rows.filter((r) => r.leaf);
  const parents = new Set(lines.map((l) => l.parentId).filter(Boolean));
  return (
    <>
      <Card title={t('Structure des coûts (CBS)')} subtitle={t('Découpez le coût du projet en postes (main-d\'œuvre, matériaux…). Un poste qui a des sous-postes prend leur total.')} actions={<Button variant="primary" size="sm" onClick={() => save({ lines })}>{t('Enregistrer')}</Button>}>
        <div className="ro-scroll"><table className="ro-ed">
          <thead><tr><th>{t('Code')}</th><th>{t('Poste de coût')}</th><th>{t('Catégorie')}</th><th>{t('Sous-poste de')}</th><th>{t('Budget')}</th><th>{t('Réel à ce jour')}</th><th>{t('Reste à faire')}</th><th>{t('Qté prévue')}</th><th>{t('Prix prévu')}</th><th>{t('Qté réelle')}</th><th>{t('Prix réel')}</th><th /></tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={l.id}>
              <td><Cell type="text" label={t('Code')} value={l.code} onChange={(v) => set(i, 'code', v)} /></td>
              <td><Cell type="text" label={t('Poste de coût')} value={l.name} onChange={(v) => set(i, 'name', v)} /></td>
              <td><select aria-label={t('Catégorie')} value={l.category} onChange={(e) => set(i, 'category', e.target.value)}>{Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td><select aria-label={t('Sous-poste de')} value={l.parentId || ''} onChange={(e) => set(i, 'parentId', e.target.value || null)}><option value="">{t('— (poste principal)')}</option>{lines.slice(0, i).map((p) => <option key={p.id} value={p.id}>{p.name || p.code || p.id}</option>)}</select></td>
              {parents.has(l.id) ? <td colSpan="3" className="muted small">{t('cumul des sous-postes')}</td> : (
                <>
                  <td><Cell label={t('Budget')} value={l.budget} onChange={(v) => set(i, 'budget', v)} /></td>
                  <td><Cell label={t('Réel à ce jour')} value={l.actual} onChange={(v) => set(i, 'actual', v)} /></td>
                  <td><Cell label={t('Reste à faire')} value={l.etc} onChange={(v) => set(i, 'etc', v)} placeholder={t('auto')} /></td>
                </>
              )}
              {parents.has(l.id) ? <td colSpan="4" /> : (
                <>
                  <td><Cell label={t('Qté prévue')} value={l.qtyB} onChange={(v) => set(i, 'qtyB', v)} /></td><td><Cell label={t('Prix prévu')} value={l.priceB} onChange={(v) => set(i, 'priceB', v)} /></td>
                  <td><Cell label={t('Qté réelle')} value={l.qtyA} onChange={(v) => set(i, 'qtyA', v)} /></td><td><Cell label={t('Prix réel')} value={l.priceA} onChange={(v) => set(i, 'priceA', v)} /></td>
                </>
              )}
              <td><button className="link" type="button" onClick={() => del(i)}>{t('Retirer')}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
        <div className="row" style={{ marginTop: 8 }}><Button size="sm" icon="plus" onClick={() => add(null)}>{t('Ajouter un poste')}</Button></div>
        <p className="muted small">{t('« Reste à faire » vide = budget − réel. Les quantités et prix servent à séparer l\'écart en effet quantité et effet prix.')}</p>
      </Card>
      {C.rows.length ? (
        <>
          <div className="bp-kpis">
            <Kpi label={t('Budget (CBS)')} value={money(C.totals.budget)} />
            <Kpi label={t('Réel à ce jour')} value={money(C.totals.actual)} sub={t('{p} du budget', { p: pct(C.totals.budget ? C.totals.actual / C.totals.budget * 100 : null, 0) })} />
            <Kpi label={t('Prévision à terminer')} value={money(C.totals.eac)} sub={t('reste à faire {n}', { n: money(C.totals.etc) })} />
            <Kpi label={t('Écart prévu')} value={money(C.totals.variance)} sub={C.totals.variance >= 0 ? t('économie') : t('dépassement')} tone={C.totals.variance >= 0 ? 'good' : 'bad'} />
          </div>
          {d.unallocated !== null && Math.abs(d.unallocated) > 0 ? <Alert tone="warn">{t('Les dépenses réelles du projet ({ac}) diffèrent de celles de la structure des coûts : {n} ne sont rattachées à aucun poste.', { ac: money(d.evm.ac), n: money(d.unallocated) })}</Alert> : null}
          <div className="bp-grid2 bp-sec">
            <Card title={t('Budget, réel et prévision par poste')}>
              <BarChart title={t('Budget, réel et prévision à terminer par poste')} labels={leaves.map((r) => (r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name))} fmt={(v) => num(v, 0)} height={240}
                bars={[{ key: 'b', label: t('Budget'), values: leaves.map((r) => r.budget), color: 'plan' }, { key: 'a', label: t('Réel'), values: leaves.map((r) => r.actual), color: 's1' }, { key: 'e', label: t('Prévision à terminer'), values: leaves.map((r) => r.eac), color: 's2' }]} />
            </Card>
            <Card title={t('Répartition du budget par catégorie')}>
              <Donut title={t('Répartition du budget par catégorie')} items={C.byCategory.map((c, i) => ({ label: cats[c.category], value: c.budget, color: ['s1', 's2', 's3', 'plan'][Math.min(i, 3)] }))} fmt={(v) => money(v)} />
            </Card>
          </div>
          <Card title={t('Tableau de la structure des coûts')}>
            <div className="bp-scroll"><table className="bp-table">
              <thead><tr><th>{t('Poste')}</th><th>{t('Budget')}</th><th>{t('Réel')}</th><th>{t('Prévision à terminer')}</th><th>{t('Écart')}</th></tr></thead>
              <tbody>{C.rows.map((r) => <tr key={r.id} style={{ fontWeight: r.leaf ? 400 : 700 }}><td style={{ paddingLeft: 8 + r.level * 18 }}>{r.code ? r.code + ' · ' : ''}{r.name}</td><td>{money(r.budget)}</td><td>{money(r.actual)}</td><td>{money(r.eac)}</td><td className={sign(r.variance)}>{money(r.variance)}</td></tr>)}</tbody>
            </table></div>
          </Card>
        </>
      ) : null}
    </>
  );
}

/* ---------- ABC ---------- */
function Abc({ d, reload }) {
  const t = useT(); const { money } = useWs();
  const [doc, setDoc] = useState(() => { const x = clone(d.docs.abc); return x; });
  const save = useSave(d.project.id, 'abc', reload);
  const A = d.abc;
  const setA = (i, k, v) => setDoc((o) => ({ ...o, activities: o.activities.map((a, j) => (j === i ? { ...a, [k]: v } : a)) }));
  const setO = (i, k, v) => setDoc((o) => ({ ...o, objects: o.objects.map((a, j) => (j === i ? { ...a, [k]: v } : a)) }));
  const setU = (i, j, v) => setDoc((o) => ({ ...o, objects: o.objects.map((a, k) => (k === i ? { ...a, usage: a.usage.map((u, m) => (m === j ? v : u)) } : a)) }));
  const addAct = () => setDoc((o) => ({ ...o, activities: o.activities.concat([{ name: '', cost: '', driver: '', driverQty: '' }]), objects: o.objects.map((x) => ({ ...x, usage: x.usage.concat(['']) })) }));
  const addObj = () => setDoc((o) => ({ ...o, objects: o.objects.concat([{ name: '', units: '', directCost: '', usage: o.activities.map(() => '') }]) }));
  return (
    <>
      <Card title={t('Coûts par activités (méthode ABC)')} subtitle={t('Les frais indirects sont répartis selon ce que chaque produit consomme vraiment (nombre de réglages, de contrôles, de livraisons…), et non au prorata.')} actions={<Button variant="primary" size="sm" onClick={() => save(doc)}>{t('Enregistrer')}</Button>}>
        <h3 style={{ margin: '4px 0 6px', fontSize: 15 }}>{t('1. Activités et leur coût')}</h3>
        <div className="ro-scroll"><table className="ro-ed">
          <thead><tr><th>{t('Activité')}</th><th>{t('Coût de l\'activité')}</th><th>{t('Ce qui déclenche le coût')}</th><th>{t('Volume total')}</th><th /></tr></thead>
          <tbody>{doc.activities.map((a, i) => (
            <tr key={i}><td><Cell type="text" label={t('Activité')} value={a.name} onChange={(v) => setA(i, 'name', v)} placeholder={t('Ex : réglage machine')} /></td><td><Cell label={t('Coût de l\'activité')} value={a.cost} onChange={(v) => setA(i, 'cost', v)} /></td>
              <td><Cell type="text" label={t('Ce qui déclenche le coût')} value={a.driver} onChange={(v) => setA(i, 'driver', v)} placeholder={t('Ex : nombre de séries')} /></td><td><Cell label={t('Volume total')} value={a.driverQty} onChange={(v) => setA(i, 'driverQty', v)} /></td>
              <td><button className="link" type="button" onClick={() => setDoc((o) => ({ ...o, activities: o.activities.filter((_, j) => j !== i), objects: o.objects.map((x) => ({ ...x, usage: x.usage.filter((_, j) => j !== i) })) }))}>{t('Retirer')}</button></td></tr>
          ))}</tbody>
        </table></div>
        <Button size="sm" icon="plus" onClick={addAct}>{t('Ajouter une activité')}</Button>
        <h3 style={{ margin: '14px 0 6px', fontSize: 15 }}>{t('2. Produits (ou livrables) et ce qu\'ils consomment')}</h3>
        {doc.objects.length ? (
          <div className="ro-scroll"><table className="ro-ed">
            <thead><tr><th>{t('Produit')}</th><th>{t('Unités produites')}</th><th>{t('Coûts directs')}</th>{doc.activities.map((a, j) => <th key={j}>{a.driver || a.name || t('activité {n}', { n: j + 1 })}</th>)}<th /></tr></thead>
            <tbody>{doc.objects.map((o, i) => (
              <tr key={i}><td><Cell type="text" label={t('Produit')} value={o.name} onChange={(v) => setO(i, 'name', v)} /></td><td><Cell label={t('Unités produites')} value={o.units} onChange={(v) => setO(i, 'units', v)} /></td><td><Cell label={t('Coûts directs')} value={o.directCost} onChange={(v) => setO(i, 'directCost', v)} /></td>
                {doc.activities.map((_, j) => <td key={j}><Cell label={t('Consommation')} value={o.usage[j]} onChange={(v) => setU(i, j, v)} /></td>)}
                <td><button className="link" type="button" onClick={() => setDoc((x) => ({ ...x, objects: x.objects.filter((_, j) => j !== i) }))}>{t('Retirer')}</button></td></tr>
            ))}</tbody>
          </table></div>
        ) : null}
        <Button size="sm" icon="plus" onClick={addObj}>{t('Ajouter un produit')}</Button>
      </Card>
      {A.objects.length ? (
        <>
          <div className="bp-grid2 bp-sec">
            <Card title={t('Coût complet par produit')}>
              <div className="bp-scroll"><table className="bp-table">
                <thead><tr><th>{t('Produit')}</th><th>{t('Coûts directs')}</th><th>{t('Frais indirects (ABC)')}</th><th>{t('Coût total')}</th><th>{t('Coût unitaire ABC')}</th><th>{t('Coût unitaire classique')}</th></tr></thead>
                <tbody>{A.objects.map((o) => <tr key={o.name}><td>{o.name}</td><td>{money(o.directCost)}</td><td>{money(o.indirect)}</td><td>{money(o.total)}</td><td><b>{money(o.unitCost)}</b></td><td>{money(o.classicUnitCost)}{o.gap ? <small className={o.gap > 0 ? 'ro-neg' : 'ro-pos'}> ({o.gap > 0 ? '+' : ''}{money(o.gap)})</small> : null}</td></tr>)}</tbody>
              </table></div>
              <p className="muted small">{t('Écart positif : la méthode classique sous-estimait ce produit (il consomme plus d\'activités).')}</p>
            </Card>
            <Card title={t('Coût unitaire : ABC contre méthode classique')}>
              <BarChart title={t('Coût unitaire par produit : ABC contre méthode classique')} labels={A.objects.map((o) => o.name)} fmt={(v) => num(v, 0)} height={220}
                bars={[{ key: 'c', label: t('Méthode classique'), values: A.objects.map((o) => o.classicUnitCost), color: 'plan' }, { key: 'a', label: t('Méthode ABC'), values: A.objects.map((o) => o.unitCost), color: 's1' }]} />
            </Card>
          </div>
          <Card title={t('Taux par activité et capacité inutilisée')}>
            <div className="bp-scroll"><table className="bp-table">
              <thead><tr><th>{t('Activité')}</th><th>{t('Taux')}</th><th>{t('Utilisé / disponible')}</th><th>{t('Coût de la capacité inutilisée')}</th></tr></thead>
              <tbody>{A.rates.map((r, j) => <tr key={r.name + j}><td>{r.name}</td><td>{t('{rate} par {driver}', { rate: money(r.rate), driver: r.driver })}</td><td>{num(A.capacity[j].used, 1)} / {num(A.capacity[j].available, 1)} ({pct(A.capacity[j].usedPct, 0)})</td><td className={A.capacity[j].idleCost ? 'ro-neg' : ''}>{money(A.capacity[j].idleCost)}</td></tr>)}</tbody>
            </table></div>
            {A.unallocated !== 0 ? <p className="muted small">{t('{n} de frais d\'activités ne sont rattachés à aucun produit (capacité non utilisée).', { n: money(A.unallocated) })}</p> : null}
          </Card>
        </>
      ) : null}
    </>
  );
}

/* ---------- ROI ---------- */
function Roi({ d, reload }) {
  const t = useT(); const { money } = useWs();
  const [doc, setDoc] = useState(() => clone(d.docs.roi));
  const save = useSave(d.project.id, 'roi', reload);
  const R = d.roi;
  const setF = (i, v) => setDoc((o) => ({ ...o, flows: o.flows.map((f, j) => (j === i ? v : f)) }));
  const verdict = { good: t('Le projet est rentable : il rapporte plus que le taux d\'actualisation exigé (VAN positive).'), weak: t('Le projet récupère son investissement mais rapporte moins que le taux exigé : rentabilité faible (VAN négative).'), bad: t('Le projet ne récupère pas son investissement sur la période : il est déconseillé tel quel.'), none: t('Saisissez l\'investissement et les flux pour juger la rentabilité.') }[R.verdict];
  return (
    <>
      <Card title={t('Rentabilité du projet (ROI, VAN, TRI)')} subtitle={t('Entrez ce que le projet coûte au départ et ce qu\'il rapporte chaque période.')} actions={<Button variant="primary" size="sm" onClick={() => save(doc)}>{t('Enregistrer')}</Button>}>
        <div className="ro-scroll"><table className="ro-ed"><thead><tr><th>{t('Investissement de départ')}</th><th>{t('Valeur de revente à la fin')}</th><th>{t('Taux d\'actualisation (%)')}</th><th>{t('Période')}</th></tr></thead>
          <tbody><tr><td><Cell label={t('Investissement de départ')} value={doc.investment} onChange={(v) => setDoc((o) => ({ ...o, investment: v }))} /></td><td><Cell label={t('Valeur de revente à la fin')} value={doc.residual} onChange={(v) => setDoc((o) => ({ ...o, residual: v }))} /></td><td><Cell label={t('Taux d\'actualisation (%)')} value={doc.discountRate} onChange={(v) => setDoc((o) => ({ ...o, discountRate: v }))} /></td><td><Cell type="text" label={t('Période')} value={doc.unit} onChange={(v) => setDoc((o) => ({ ...o, unit: v }))} placeholder={t('an')} /></td></tr></tbody></table></div>
        <h3 style={{ margin: '12px 0 6px', fontSize: 15 }}>{t('Gains nets de chaque période (peut être négatif)')}</h3>
        <div className="ro-scroll"><table className="ro-ed"><tbody><tr>{doc.flows.map((f, i) => <td key={i}><small className="muted">{t('Période {n}', { n: i + 1 })}</small><Cell label={t('Période {n}', { n: i + 1 })} value={f} onChange={(v) => setF(i, v)} /></td>)}</tr></tbody></table></div>
        <div className="row" style={{ marginTop: 8 }}><Button size="sm" icon="plus" onClick={() => setDoc((o) => ({ ...o, flows: o.flows.concat(['']) }))}>{t('Ajouter une période')}</Button>{doc.flows.length ? <Button size="sm" onClick={() => setDoc((o) => ({ ...o, flows: o.flows.slice(0, -1) }))}>{t('Retirer la dernière')}</Button> : null}</div>
      </Card>
      {R.investment > 0 ? (
        <>
          <div className="ro-concl" role="status">{verdict}</div>
          <div className="bp-kpis">
            <Kpi label={t('ROI (retour sur investissement)')} value={pct(R.roiPct)} sub={t('gain net {n} sur {i} investis', { n: money(R.netGain), i: money(R.investment) })} tone={R.roiPct > 0 ? 'good' : 'bad'} />
            <Kpi label={t('VAN (valeur actuelle nette)')} value={money(R.van)} sub={t('au taux de {r} %', { r: R.discountRate })} tone={R.van > 0 ? 'good' : 'bad'} />
            <Kpi label={t('TRI (taux de rentabilité interne)')} value={pct(R.irrPct)} sub={t('à comparer à {r} % exigés', { r: R.discountRate })} tone={R.irrPct !== null && R.irrPct > R.discountRate ? 'good' : 'warn'} />
            <Kpi label={t('Délai de récupération')} value={R.payback === null ? t('jamais') : t('{n} périodes', { n: num(R.payback, 1) })} sub={R.discountedPayback === null ? t('actualisé : jamais') : t('actualisé : {n} périodes', { n: num(R.discountedPayback, 1) })} />
            <Kpi label={t('Indice de rentabilité')} value={num(R.profitabilityIndex)} sub={t('au-dessus de 1 = rentable')} />
          </div>
          <Card title={t('Trésorerie cumulée')}>
            <LineChart title={t('Trésorerie cumulée du projet, brute et actualisée')} labels={R.series.map((s) => String(s.period))} fmt={(v) => num(v, 0)} height={240}
              series={[{ key: 'c', label: t('Cumul'), values: R.series.map((s) => s.cumulative), color: 's1' }, { key: 'd', label: t('Cumul actualisé'), values: R.series.map((s) => s.discounted), color: 's2', dashed: true }]} />
          </Card>
        </>
      ) : null}
    </>
  );
}

/* ---------- Budget prévisionnel ---------- */
const monthsBetween = (a, b) => { const out = []; let [y, m] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); while ((y < y2 || (y === y2 && m <= m2)) && out.length < 60) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; };
function Forecast({ d, reload }) {
  const t = useT(); const { money } = useWs();
  const [doc, setDoc] = useState(() => clone(d.docs.forecast));
  const save = useSave(d.project.id, 'forecast', reload);
  const Fo = d.forecast;
  const spread = () => {
    const end = d.project.due || d.project.end; const ms = monthsBetween(d.project.start.slice(0, 7), end.slice(0, 7));
    const each = d.project.budget && ms.length ? Math.round(d.project.budget / ms.length) : '';
    setDoc({ periods: ms.map((m) => ({ month: m, planned: each, revenue: '' })) });
  };
  const setP = (i, k, v) => setDoc((o) => ({ ...o, periods: o.periods.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  return (
    <>
      <Card title={t('Budget prévisionnel mensuel')} subtitle={t('Ce que vous comptez dépenser (et encaisser) chaque mois, comparé au réel.')} actions={<><Button size="sm" onClick={spread}>{t('Répartir le budget du projet')}</Button><Button variant="primary" size="sm" onClick={() => save(doc)}>{t('Enregistrer')}</Button></>}>
        {doc.periods.length ? (
          <div className="ro-scroll"><table className="ro-ed">
            <thead><tr><th>{t('Mois')}</th><th>{t('Dépenses prévues')}</th><th>{t('Recettes prévues')}</th><th /></tr></thead>
            <tbody>{doc.periods.map((p, i) => <tr key={i}><td><Cell type="month" label={t('Mois')} value={p.month} onChange={(v) => setP(i, 'month', v)} /></td><td><Cell label={t('Dépenses prévues')} value={p.planned} onChange={(v) => setP(i, 'planned', v)} /></td><td><Cell label={t('Recettes prévues')} value={p.revenue} onChange={(v) => setP(i, 'revenue', v)} /></td><td><button className="link" type="button" onClick={() => setDoc((o) => ({ ...o, periods: o.periods.filter((_, j) => j !== i) }))}>{t('Retirer')}</button></td></tr>)}</tbody>
          </table></div>
        ) : <p className="muted">{t('Aucun mois. Utilisez « Répartir le budget du projet » pour commencer, puis ajustez.')}</p>}
        <Button size="sm" icon="plus" onClick={() => setDoc((o) => ({ ...o, periods: o.periods.concat([{ month: (o.periods[o.periods.length - 1] || { month: d.month }).month, planned: '', revenue: '' }]) }))}>{t('Ajouter un mois')}</Button>
      </Card>
      {Fo.rows.length ? (
        <>
          <div className="bp-kpis">
            <Kpi label={t('Budget prévisionnel total')} value={money(Fo.total)} />
            <Kpi label={t('Prévu à ce jour / réel')} value={`${money(Fo.plannedToDate)} / ${money(Fo.actualToDate)}`} sub={Fo.variance >= 0 ? t('{n} en dessous du prévu', { n: money(Fo.variance) }) : t('{n} au-dessus du prévu', { n: money(-Fo.variance) })} tone={Fo.variance >= 0 ? 'good' : 'bad'} />
            <Kpi label={t('Rythme de consommation')} value={Fo.burnRate === null ? '—' : num(Fo.burnRate)} sub={t('1 = conforme au budget')} tone={Fo.burnRate !== null && Fo.burnRate > 1.05 ? 'warn' : ''} />
            <Kpi label={t('Dépense finale probable')} value={Fo.projectedTotal === null ? '—' : money(Fo.projectedTotal)} sub={Fo.projectedTotal !== null && Fo.projectedTotal > Fo.total ? t('au-dessus du budget prévisionnel') : t('dans le budget prévisionnel')} tone={Fo.projectedTotal !== null && Fo.projectedTotal > Fo.total ? 'bad' : 'good'} />
            {Fo.revenue ? <Kpi label={t('Marge prévisionnelle')} value={money(Fo.margin)} sub={t('recettes {r} − dépenses {d}', { r: money(Fo.revenue), d: money(Fo.total) })} tone={Fo.margin >= 0 ? 'good' : 'bad'} /> : null}
          </div>
          <Card title={t('Dépenses cumulées : prévu contre réel')}>
            <LineChart title={t('Dépenses cumulées prévues et réelles')} labels={Fo.rows.map((r) => r.month)} fmt={(v) => num(v, 0)} height={240}
              marker={Fo.rows.findIndex((r) => r.month === d.month)}
              series={[{ key: 'p', label: t('Cumul prévu'), values: Fo.rows.map((r) => r.cumPlanned), color: 'plan', dashed: true }, { key: 'a', label: t('Cumul réel'), values: Fo.rows.map((r) => r.cumActual), color: 's2' }].concat(Fo.revenue ? [{ key: 'r', label: t('Recettes cumulées prévues'), values: Fo.rows.map((r) => r.cumRevenue), color: 's3' }] : [])} />
            <div className="bp-scroll"><table className="bp-table">
              <thead><tr><th>{t('Mois')}</th><th>{t('Prévu')}</th><th>{t('Réel')}</th><th>{t('Écart')}</th></tr></thead>
              <tbody>{Fo.rows.map((r) => <tr key={r.month}><td>{r.month}</td><td>{money(r.planned)}</td><td>{r.actual === null ? '—' : money(r.actual)}</td><td className={r.variance === null ? '' : sign(r.variance)}>{r.variance === null ? '—' : money(r.variance)}</td></tr>)}</tbody>
            </table></div>
          </Card>
        </>
      ) : null}
    </>
  );
}

/* ---------- Analyse des écarts ---------- */
function Variances({ d, openTool }) {
  const t = useT(); const { money } = useWs();
  const C = d.cbs; const e = d.evm;
  const leaves = C.rows.filter((r) => r.leaf);
  const worst = C.worst[0];
  return (
    <>
      <Card title={t('Analyse des écarts')} subtitle={t('Écart = budget − prévision à terminer. Vert : économie. Rouge : dépassement.')}>
        <div className="bp-kpis">
          {e.mode === 'money' ? <Kpi label={t('Écart de coût (CV = EV − AC)')} value={money(e.cv)} sub={e.cv >= 0 ? t('vous produisez à moindre coût') : t('vous dépensez plus que la valeur produite')} tone={e.cv >= 0 ? 'good' : 'bad'} /> : null}
          {e.mode === 'money' ? <Kpi label={t('Écart de délai (SV = EV − PV)')} value={money(e.sv)} sub={e.sv >= 0 ? t('en avance') : t('en retard')} tone={e.sv >= 0 ? 'good' : 'bad'} /> : null}
          <Kpi label={t('Écart budget / prévision (CBS)')} value={money(C.totals.variance)} sub={C.totals.variancePct === null ? '' : pct(C.totals.variancePct)} tone={C.totals.variance >= 0 ? 'good' : 'bad'} />
          <Kpi label={t('Écart budget prévisionnel / réel')} value={money(d.forecast.variance)} sub={t('depuis le début du projet')} tone={d.forecast.variance >= 0 ? 'good' : 'bad'} />
        </div>
        {leaves.length ? (
          <>
            <div className="ro-concl" role="status">{worst
              ? t('Le plus gros dépassement vient de « {name} » : {n} de plus que prévu. Au total le projet devrait finir {sens} de {total} par rapport au budget.', { name: worst.name, n: money(-worst.variance), sens: C.totals.variance >= 0 ? t('en économie') : t('en dépassement'), total: money(Math.abs(C.totals.variance)) })
              : t('Aucun poste ne dépasse son budget : le projet devrait finir {n} sous le budget.', { n: money(Math.max(C.totals.variance, 0)) })}</div>
            <BarChart title={t('Écart par poste de coût (positif = économie)')} labels={leaves.map((r) => (r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name))} fmt={(v) => num(v, 0)} height={230}
              bars={[{ key: 'v', label: t('Écart'), values: leaves.map((r) => r.variance), color: 's3' }]} />
            <div className="bp-scroll"><table className="bp-table">
              <thead><tr><th>{t('Poste')}</th><th>{t('Budget')}</th><th>{t('Prévision à terminer')}</th><th>{t('Écart')}</th><th>{t('Écart en %')}</th><th>{t('dont effet quantité')}</th><th>{t('dont effet prix')}</th></tr></thead>
              <tbody>{leaves.map((r) => <tr key={r.id}><td>{r.name}</td><td>{money(r.budget)}</td><td>{money(r.eac)}</td><td className={sign(r.variance)}>{money(r.variance)}</td><td>{r.variancePct === null ? '—' : pct(r.variancePct)}</td><td className={r.qtyVariance === undefined ? '' : sign(r.qtyVariance)}>{r.qtyVariance === undefined ? '—' : money(r.qtyVariance)}</td><td className={r.priceVariance === undefined ? '' : sign(r.priceVariance)}>{r.priceVariance === undefined ? '—' : money(r.priceVariance)}</td></tr>)}</tbody>
            </table></div>
            <p className="muted small">{t('Effet quantité : on a consommé plus ou moins que prévu (au prix prévu). Effet prix : on a payé plus ou moins cher que prévu (pour la quantité réelle).')}</p>
          </>
        ) : <p className="muted">{t('Renseignez d\'abord la structure des coûts (onglet CBS) pour voir les écarts poste par poste.')}</p>}
        {C.totals.variance < 0 ? <div className="row" style={{ marginTop: 8 }}><Button size="sm" onClick={() => openTool('pilot')}>{t('Voir le pilotage et les prévisions')}</Button></div> : null}
      </Card>
      {e.mode === 'money' ? <Badge tone="info">{t('Valeur acquise : CPI {c} · SPI {s}', { c: num(e.cpi), s: num(e.spi) })}</Badge> : null}
    </>
  );
}

export default function Finance({ id, openTool }) {
  const t = useT();
  const { oapi } = useWs();
  const [tab, setTab] = useState('evm');
  const st = useLoad(() => oapi('GET', `/projects/${id}/fin`), [id]);
  return (
    <div className="bp">
      <Segmented label={t('Budget et coûts')} value={tab} onChange={setTab} items={[{ id: 'evm', label: t('Valeur acquise') }, { id: 'cbs', label: t('Structure des coûts (CBS)') }, { id: 'abc', label: t('Coûts par activités (ABC)') }, { id: 'roi', label: t('Rentabilité (ROI)') }, { id: 'forecast', label: t('Budget prévisionnel') }, { id: 'var', label: t('Écarts') }]} />
      <div style={{ height: 12 }} />
      <Loaded state={st}>{(d) => (
        <>
          {tab === 'evm' ? <Evm d={d} openTool={openTool} /> : null}
          {tab === 'cbs' ? <Cbs key={d.updated.cbs || 'n'} d={d} reload={st.reload} /> : null}
          {tab === 'abc' ? <Abc key={d.updated.abc || 'n'} d={d} reload={st.reload} /> : null}
          {tab === 'roi' ? <Roi key={d.updated.roi || 'n'} d={d} reload={st.reload} /> : null}
          {tab === 'forecast' ? <Forecast key={d.updated.forecast || 'n'} d={d} reload={st.reload} /> : null}
          {tab === 'var' ? <Variances d={d} openTool={openTool} /> : null}
        </>
      )}
      </Loaded>
    </div>
  );
}
