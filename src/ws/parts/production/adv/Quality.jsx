/* eslint-disable react/jsx-key -- les cellules des tableaux modifiables sont des listes fixes, rendues par EdTable */
import { useState } from 'react';
import { useT } from '../../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, EmptyState, Segmented } from '../../../ui/index.jsx';
import { LineChart } from '../../bp/Charts.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Conclusion, Doc, EdTable, Pick, Remove, Setup, Sub, nextId, useDoc } from './common.jsx';
import { CircuitNote, ListCell, ParetoChart, sampleQuick } from './qcCommon.jsx';

/* Production · contrôle qualité : plans de contrôle, échantillonnage AQL (courbe d'efficacité), non-conformités et CAPA, traçabilité des lots.
   Le serveur calcule (GET/PUT /production/adv/quality). */

const STAGE = (t) => ({ incoming: t('Réception'), inprocess: t('En cours de fabrication'), final: t('Contrôle final') });
const STAGEK = ['incoming', 'inprocess', 'final'];
const DISP = (t) => [['scrap', t('Rebut')], ['rework', t('Retouche')], ['accept', t('Accepté en l\'état')], ['return', t('Retour fournisseur')]];
const CAT = (t) => [['man', t('Main-d\'œuvre')], ['machine', t('Machine')], ['method', t('Méthode')], ['material', t('Matière')], ['measure', t('Mesure')], ['environment', t('Milieu')]];
const LOTST = (t) => ({ released: t('libéré'), hold: t('bloqué'), rejected: t('rejeté') });
const LOTTONE = { released: 'ok', hold: 'warn', rejected: 'danger' };
const todayIso = () => new Date().toISOString().slice(0, 10);
const SUBS = (t) => [{ id: 'plans', label: t('Plans de contrôle') }, { id: 'aql', label: t('Échantillonnage AQL') }, { id: 'nc', label: t('Non-conformités et CAPA') }, { id: 'trace', label: t('Traçabilité') }];

/* ---------- Plans de contrôle ---------- */
function Plans({ d }) {
  const t = useT(); const sn = STAGE(t); const r = d.result;
  return (
    <>
      {r && r.missingStages.length ? <Alert tone="warn" title={t('Étape sans plan de contrôle')}>{t('Aucun plan pour : {s}. Un contrôle sans plan écrit n\'est ni répétable ni vérifiable.', { s: r.missingStages.map((s) => sn[s]).join(', ') })}</Alert> : null}
      <Setup d={d} title={t('Plans de contrôle')} subtitle={t('Qui contrôle quoi, comment et à quelle fréquence : à la réception des matières, en cours de fabrication et sur le produit final.')}>
        <EdTable empty={t('Aucun plan de contrôle.')} head={[t('Étape'), t('Produit'), t('Caractéristique contrôlée'), t('Méthode'), t('Fréquence'), t('AQL (%)'), t('Taille de lot'), t('Responsable'), '']}
          rows={d.doc.plans.map((p, i) => [
            <Pick label={t('Étape')} value={p.stage} onChange={(v) => d.upd(['plans', i, 'stage'], v)} options={STAGEK.map((s) => [s, sn[s]])} />,
            <Cell type="text" label={t('Produit')} value={p.product} onChange={(v) => d.upd(['plans', i, 'product'], v)} />,
            <Cell type="text" label={t('Caractéristique contrôlée')} value={p.characteristic} onChange={(v) => d.upd(['plans', i, 'characteristic'], v)} />,
            <Cell type="text" label={t('Méthode')} value={p.method} onChange={(v) => d.upd(['plans', i, 'method'], v)} />,
            <Cell type="text" label={t('Fréquence')} value={p.frequency} onChange={(v) => d.upd(['plans', i, 'frequency'], v)} />,
            <Pick label={t('AQL (%)')} value={String(p.aql)} onChange={(v) => d.upd(['plans', i, 'aql'], Number(v))} options={[['1', '1,0'], ['2.5', '2,5'], ['4', '4,0']]} />,
            <Cell label={t('Taille de lot')} value={p.lotSize} onChange={(v) => d.upd(['plans', i, 'lotSize'], v)} />,
            <Cell type="text" label={t('Responsable')} value={p.owner} onChange={(v) => d.upd(['plans', i, 'owner'], v)} />,
            <Remove onClick={() => d.set((o) => ({ ...o, plans: o.plans.filter((_, k) => k !== i) }))} />,
          ])} />
        <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, plans: o.plans.concat([{ id: nextId(o.plans, 'cp'), stage: 'final', product: '', characteristic: '', method: '', frequency: '', aql: 2.5, lotSize: 500, owner: '' }]) }))}>{t('Ajouter un plan')}</Button>
        <p className="muted small">{t('L\'AQL (niveau de qualité acceptable) est le pourcentage de défauts toléré : plus il est bas, plus le contrôle est sévère.')}</p>
      </Setup>
      {r ? <div className="bp-kpis">{r.stages.map((s) => <Kpi key={s.stage} label={sn[s.stage]} value={String(s.plans)} sub={t('plan(s) de contrôle')} tone={s.plans ? 'good' : 'bad'} />)}</div> : null}
    </>
  );
}

/* ---------- Échantillonnage AQL ---------- */
function OcCurve({ s, title }) {
  const t = useT();
  return <LineChart title={title} labels={s.oc.map((x) => num(x.defectPct, 1) + ' %')} fmt={(v) => num(v, 0) + ' %'} height={230} series={[{ key: 'oc', label: t('Probabilité d\'accepter le lot'), values: s.oc.map((x) => x.accept), color: 's1' }]} />;
}

function Sampling({ d }) {
  const t = useT(); const sn = STAGE(t); const plans = d.result ? d.result.plans : [];
  const [sel, setSel] = useState('');
  const [calc, setCalc] = useState({ lot: '1000', aql: '2.5' });
  const cur = plans.find((p) => p.id === sel) || plans[0];
  const lotN = Number(calc.lot);
  const q = Number.isFinite(lotN) && lotN >= 1 ? sampleQuick(Math.round(lotN), Number(calc.aql)) : null;
  return (
    <>
      <Card title={t('Plans d\'échantillonnage calculés')} subtitle={t('Pour chaque plan de contrôle : combien de pièces prélever dans le lot, et combien de défauts au maximum pour l\'accepter.')}>
        {!plans.length ? <EmptyState icon="chart" title={t('Aucun plan')}>{t('Créez d\'abord un plan de contrôle (onglet « Plans de contrôle ») et enregistrez.')}</EmptyState> : (
          <div className="bp-scroll"><table className="bp-table">
            <thead><tr><th>{t('Plan')}</th><th>{t('Lot')}</th><th>{t('AQL')}</th><th>{t('Lettre-code')}</th><th>{t('Échantillon')}</th><th>{t('Accepter si défauts ≤')}</th><th>{t('Rejeter si défauts ≥')}</th></tr></thead>
            <tbody>{plans.map((p) => (
              <tr key={p.id}>
                <td>{(p.product ? p.product + ' · ' : '') + p.characteristic} <small className="muted">{sn[p.stage]}</small></td>
                <td>{num(p.sampling.lot, 0)}</td><td>{num(p.aql, 1)} %</td><td>{p.sampling.letter}</td>
                <td><b>{num(p.sampling.sample, 0)}</b>{p.sampling.full ? <small className="muted"> {t('(contrôle à 100 %)')}</small> : null}</td>
                <td>{p.sampling.accept}</td><td>{p.sampling.reject}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {cur ? (
        <Card title={t('Courbe d\'efficacité')} subtitle={t('Plus le taux de défauts du lot est élevé, moins il a de chances d\'être accepté.')}>
          <div style={{ maxWidth: 420 }}>
            <label className="muted small" style={{ display: 'block' }}>{t('Plan affiché')}</label>
            <Pick label={t('Plan affiché')} value={cur.id} onChange={setSel} options={plans.map((p) => [p.id, (p.product ? p.product + ' · ' : '') + p.characteristic])} />
          </div>
          <Conclusion>{t('Avec un échantillon de {n} pièces et {c} défaut(s) acceptés, un lot à {a} % de défauts est accepté dans la plupart des cas, alors qu\'un lot à 10 % de défauts n\'a que {p} % de chances de passer.', { n: cur.sampling.sample, c: cur.sampling.accept, a: num(cur.aql, 1), p: num((cur.sampling.oc.find((x) => x.defectPct === 10) || { accept: 0 }).accept, 1) })}</Conclusion>
          <OcCurve s={cur.sampling} title={t('Courbe d\'efficacité du plan')} />
        </Card>
      ) : null}
      <Card title={t('Calculateur rapide')} subtitle={t('Essayez une taille de lot et un AQL sans créer de plan (même règle que le serveur).')}>
        <EdTable head={[t('Taille de lot'), t('AQL (%)')]} rows={[[
          <Cell label={t('Taille de lot')} value={calc.lot} onChange={(v) => setCalc((o) => ({ ...o, lot: v }))} />,
          <Pick label={t('AQL (%)')} value={calc.aql} onChange={(v) => setCalc((o) => ({ ...o, aql: v }))} options={[['1', '1,0'], ['2.5', '2,5'], ['4', '4,0']]} />,
        ]]} />
        {q ? (
          <>
            <div className="bp-kpis">
              <Kpi label={t('Échantillon à contrôler')} value={String(q.sample)} sub={q.full ? t('tout le lot') : t('lettre-code {l}', { l: q.letter })} />
              <Kpi label={t('Accepter si défauts ≤')} value={String(q.accept)} />
              <Kpi label={t('Rejeter si défauts ≥')} value={String(q.reject)} />
            </div>
            <OcCurve s={q} title={t('Courbe d\'efficacité du calculateur')} />
          </>
        ) : <p className="muted small">{t('Saisissez une taille de lot d\'au moins 1.')}</p>}
      </Card>
    </>
  );
}

/* ---------- Non-conformités et CAPA ---------- */
function Nc({ d }) {
  const t = useT(); const r = d.result; const doc = d.doc; const today = todayIso();
  const cat = CAT(t); const disp = DISP(t);
  const mapC = new Map(cat);
  return (
    <>
      <Setup d={d} title={t('Non-conformités')} subtitle={t('Une non-conformité est un produit ou un lot qui ne respecte pas l\'exigence. Notez-la, décidez de son sort et cherchez la cause.')}>
        <EdTable head={[t('Production de la période (quantité)')]} rows={[[<Cell label={t('Production de la période (quantité)')} value={doc.produced} onChange={(v) => d.upd(['produced'], v)} />]]} />
        <EdTable empty={t('Aucune non-conformité.')} head={[t('Date'), t('Lot'), t('Produit'), t('Quantité'), t('Décision'), t('Famille de cause (6M)'), t('Cause'), t('Description'), t('Statut'), '']}
          rows={doc.ncs.map((n, i) => [
            <Cell type="date" label={t('Date')} value={n.date} onChange={(v) => d.upd(['ncs', i, 'date'], v)} />,
            <Cell type="text" label={t('Lot')} value={n.lot} onChange={(v) => d.upd(['ncs', i, 'lot'], v)} />,
            <Cell type="text" label={t('Produit')} value={n.product} onChange={(v) => d.upd(['ncs', i, 'product'], v)} />,
            <Cell label={t('Quantité')} value={n.qty} onChange={(v) => d.upd(['ncs', i, 'qty'], v)} />,
            <Pick label={t('Décision')} value={n.disposition} onChange={(v) => d.upd(['ncs', i, 'disposition'], v)} options={disp} />,
            <Pick label={t('Famille de cause (6M)')} value={n.category} onChange={(v) => d.upd(['ncs', i, 'category'], v)} options={cat} />,
            <Cell type="text" label={t('Cause')} value={n.cause} onChange={(v) => d.upd(['ncs', i, 'cause'], v)} />,
            <Cell type="text" label={t('Description')} value={n.description} onChange={(v) => d.upd(['ncs', i, 'description'], v)} />,
            <Pick label={t('Statut')} value={n.status} onChange={(v) => d.upd(['ncs', i, 'status'], v)} options={[['open', t('Ouvert')], ['closed', t('Clos')]]} />,
            <Remove onClick={() => d.set((o) => ({ ...o, ncs: o.ncs.filter((_, k) => k !== i) }))} />,
          ])} />
        <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, ncs: o.ncs.concat([{ id: nextId(o.ncs, 'nc'), date: todayIso(), lot: '', product: '', qty: '', disposition: 'scrap', category: 'method', cause: '', description: '', status: 'open', capa: { type: 'corrective', action: '', owner: '', due: '', done: false, effective: false } }]) }))}>{t('Ajouter une non-conformité')}</Button>
        <Sub>{t('Actions correctives et préventives (CAPA)')}</Sub>
        <p className="muted small">{t('Action corrective : supprimer la cause du problème constaté. Action préventive : éviter qu\'il apparaisse ailleurs. Une ligne par non-conformité.')}</p>
        <EdTable empty={t('Ajoutez d\'abord une non-conformité.')} head={[t('Non-conformité'), t('Type'), t('Action'), t('Responsable'), t('Échéance'), t('Faite'), t('Efficace')]}
          rows={doc.ncs.map((n, i) => {
            const late = n.capa.action && !n.capa.done && n.capa.due && n.capa.due < today;
            return [
              <span>{n.lot || n.id} <small className="muted">{n.cause || mapC.get(n.category)}</small></span>,
              <Pick label={t('Type')} value={n.capa.type} onChange={(v) => d.upd(['ncs', i, 'capa', 'type'], v)} options={[['corrective', t('Corrective')], ['preventive', t('Préventive')]]} />,
              <Cell type="text" label={t('Action')} value={n.capa.action} onChange={(v) => d.upd(['ncs', i, 'capa', 'action'], v)} />,
              <Cell type="text" label={t('Responsable')} value={n.capa.owner} onChange={(v) => d.upd(['ncs', i, 'capa', 'owner'], v)} />,
              <div><Cell type="date" label={t('Échéance')} value={n.capa.due} onChange={(v) => d.upd(['ncs', i, 'capa', 'due'], v)} />{late ? <Badge tone="danger">{t('en retard')}</Badge> : null}</div>,
              <input type="checkbox" aria-label={t('Faite')} checked={Boolean(n.capa.done)} onChange={(e) => d.upd(['ncs', i, 'capa', 'done'], e.target.checked)} />,
              <input type="checkbox" aria-label={t('Efficace')} checked={Boolean(n.capa.effective)} onChange={(e) => d.upd(['ncs', i, 'capa', 'effective'], e.target.checked)} />,
            ];
          })} />
      </Setup>
      {r ? (
        <>
          {r.capa.late ? <Alert tone="danger" title={t('Actions en retard')}>{t('{n} action(s) corrective(s) ou préventive(s) ont dépassé leur échéance.', { n: r.capa.late })}</Alert> : null}
          {r.capa.withoutAction ? <Alert tone="warn" title={t('Non-conformités sans action')}>{t('{n} non-conformité(s) ouverte(s) n\'ont encore aucune action CAPA.', { n: r.capa.withoutAction })}</Alert> : null}
          <div className="bp-kpis">
            <Kpi label={t('Taux de rebut')} value={r.rates.scrapPct === null ? '—' : num(r.rates.scrapPct, 2) + ' %'} sub={t('{q} pièce(s) mise(s) au rebut', { q: num(r.rates.scrap, 0) })} tone={r.rates.scrapPct !== null && r.rates.scrapPct > 3 ? 'bad' : ''} />
            <Kpi label={t('Taux de retouche')} value={r.rates.reworkPct === null ? '—' : num(r.rates.reworkPct, 2) + ' %'} sub={t('{q} pièce(s) à retoucher', { q: num(r.rates.rework, 0) })} />
            <Kpi label={t('Non-conformités ouvertes')} value={String(r.open)} sub={t('sur {n}', { n: r.ncCount })} tone={r.open ? 'warn' : 'good'} />
            <Kpi label={t('CAPA ouvertes')} value={String(r.capa.open)} sub={t('{n} en retard', { n: r.capa.late })} tone={r.capa.late ? 'bad' : ''} />
            <Kpi label={t('Actions efficaces')} value={String(r.capa.effective)} />
          </div>
          {r.rates.scrapPct === null ? <Alert tone="info" title={t('Taux non calculés')}>{t('Saisissez la production de la période pour obtenir les taux de rebut et de retouche.')}</Alert> : null}
          {r.pareto.length ? (
            <Card title={t('Pareto des causes')} subtitle={t('Les causes qui font perdre le plus de pièces : agissez d\'abord sur les premières.')}>
              <Conclusion>{t('La cause principale est « {c} » avec {p} % des pièces non conformes.', { c: r.pareto[0].cause, p: num(r.pareto[0].pct, 0) })}</Conclusion>
              <ParetoChart title={t('Pareto des causes de non-conformité')} valueLabel={t('Quantité')} items={r.pareto.map((x) => ({ label: x.cause, value: x.qty, cum: x.cumPct }))} />
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/* ---------- Traçabilité ---------- */
function Trace({ d }) {
  const t = useT(); const r = d.result; const doc = d.doc; const ls = LOTST(t);
  const [q, setQ] = useState('');
  const key = q.trim().toLowerCase();
  const ncOf = (ids) => doc.ncs.filter((n) => ids.includes(n.id));
  const lots = r ? r.lots.filter((l) => key && l.code.toLowerCase().includes(key)) : [];
  const mats = r ? r.materialUse.filter((m) => key && m.material.toLowerCase().includes(key)) : [];
  const lotView = (l) => (
    <div key={l.code} className="ro-find low">
      <h3>{l.code} <Badge tone={LOTTONE[l.status]}>{ls[l.status]}</Badge></h3>
      <p style={{ margin: '2px 0' }}>{(l.product || t('Produit non précisé')) + ' · ' + num(l.qty, 0) + ' ' + t('pièce(s)') + (l.date ? ' · ' + l.date : '')}</p>
      <p style={{ margin: '2px 0' }}><b>{t('Matières utilisées')} :</b> {l.materialLots.length ? l.materialLots.join(', ') : t('aucune renseignée')}</p>
      <p style={{ margin: '2px 0' }}><b>{t('Non-conformités liées')} :</b> {l.ncs.length ? ncOf(l.ncs).map((n) => (n.cause || n.description || n.id) + ' (' + num(n.qty, 0) + ')').join(' ; ') : t('aucune')}</p>
    </div>
  );
  return (
    <>
      <Setup d={d} title={t('Lots de produits finis')} subtitle={t('Pour chaque lot fabriqué : les lots de matière utilisés. En cas de problème, on retrouve tout de suite les lots concernés.')}>
        <EdTable empty={t('Aucun lot.')} head={[t('Code du lot'), t('Produit'), t('Date'), t('Quantité'), t('Lots de matière utilisés (séparés par des virgules)'), t('Statut'), '']}
          rows={doc.lots.map((l, i) => [
            <Cell type="text" label={t('Code du lot')} value={l.code} onChange={(v) => d.upd(['lots', i, 'code'], v)} />,
            <Cell type="text" label={t('Produit')} value={l.product} onChange={(v) => d.upd(['lots', i, 'product'], v)} />,
            <Cell type="date" label={t('Date')} value={l.date} onChange={(v) => d.upd(['lots', i, 'date'], v)} />,
            <Cell label={t('Quantité')} value={l.qty} onChange={(v) => d.upd(['lots', i, 'qty'], v)} />,
            <ListCell label={t('Lots de matière utilisés (séparés par des virgules)')} items={l.materialLots} onChange={(v) => d.upd(['lots', i, 'materialLots'], v)} />,
            <Pick label={t('Statut')} value={l.status} onChange={(v) => d.upd(['lots', i, 'status'], v)} options={[['released', t('Libéré')], ['hold', t('Bloqué')], ['rejected', t('Rejeté')]]} />,
            <Remove onClick={() => d.set((o) => ({ ...o, lots: o.lots.filter((_, k) => k !== i) }))} />,
          ])} />
        <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, lots: o.lots.concat([{ code: 'L' + (o.lots.length + 1), product: '', date: todayIso(), qty: '', materialLots: [], status: 'released' }]) }))}>{t('Ajouter un lot')}</Button>
      </Setup>
      <Card title={t('Rechercher un lot')} subtitle={t('Tapez un code de lot de produit fini ou un code de lot de matière : voyez ce qui est concerné.')}>
        <div style={{ maxWidth: 420 }}><input type="search" aria-label={t('Code de lot à rechercher')} placeholder={t('Code de lot à rechercher')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', fontSize: 16, padding: 8, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', color: 'var(--fg)', boxSizing: 'border-box' }} /></div>
        {d.dirty ? <p className="muted small">{t('La recherche porte sur les données enregistrées.')}</p> : null}
        {!key ? <p className="muted small">{t('Saisissez un code pour lancer la recherche.')}</p> : !lots.length && !mats.length ? <Alert tone="info" title={t('Aucun résultat')}>{t('Aucun lot de produit fini ni lot de matière ne correspond à ce code.')}</Alert> : null}
        {lots.length ? <><Sub>{t('Lots de produits finis trouvés')}</Sub>{lots.map(lotView)}</> : null}
        {mats.map((m) => {
          const used = r.lots.filter((l) => m.lots.includes(l.code));
          return (
            <div key={m.material}>
              <Sub>{t('Matière {m}', { m: m.material })}</Sub>
              <Conclusion>{t('Le lot de matière « {m} » a servi à fabriquer {n} lot(s) : {l}.', { m: m.material, n: used.length, l: used.map((l) => l.code).join(', ') })}</Conclusion>
              {used.map(lotView)}
            </div>
          );
        })}
      </Card>
      {r && r.hold ? <Alert tone="warn" title={t('Lots non libérés')}>{t('{n} lot(s) sont bloqués ou rejetés.', { n: r.hold })}</Alert> : null}
    </>
  );
}

export default function Quality() {
  const t = useT();
  const d = useDoc('quality');
  const [sub, setSub] = useState('plans');
  return (
    <Doc d={d}>
      <Card title={t('Contrôle qualité')} subtitle={t('Vérifier que les produits respectent les exigences : plans de contrôle, échantillonnage, non-conformités, actions correctives et traçabilité.')}>
        <Segmented label={t('Outils de contrôle qualité')} value={sub} onChange={setSub} items={SUBS(t)} />
      </Card>
      <div style={{ margin: '12px 0' }}><CircuitNote>{t('Une étape de contrôle qualité sans plan de contrôle écrit (onglet « Plans de contrôle ») déclenche un avis dans l\'analyse du circuit.')}</CircuitNote></div>
      {sub === 'plans' ? <Plans d={d} /> : null}
      {sub === 'aql' ? <Sampling d={d} /> : null}
      {sub === 'nc' ? <Nc d={d} /> : null}
      {sub === 'trace' ? <Trace d={d} /> : null}
    </Doc>
  );
}
