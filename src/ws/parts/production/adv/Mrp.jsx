/* eslint-disable react/jsx-key -- les cellules des tableaux modifiables sont des listes fixes, rendues par EdTable */
import { useState } from 'react';
import { useWs } from '../../../WsContext.jsx';
import { useT } from '../../../../lib/i18n.jsx';
import { Badge, Button, Card, EmptyState } from '../../../ui/index.jsx';
import { BarChart } from '../../bp/Charts.jsx';
import { Cell, Kpi, num } from '../../projects/ro-common.jsx';
import { Check, Conclusion, Doc, EdTable, Issues, Pick, PeriodGrid, PeriodTable, PeriodsField, Remove, Setup, Sub, nextId, useDoc, usePeriodLabels } from './common.jsx';

/* Production · calcul des besoins en matières (MRP) : à partir de la demande, des stocks, des délais et des nomenclatures, le serveur calcule
   quoi fabriquer ou acheter, quand le lancer et pour quelle date. Les ordres sont des SUGGESTIONS : rien n'est créé dans Achats ni dans Production. */

const blank = (code) => ({ code, name: '', type: 'buy', leadTime: 1, lotRule: 'l4l', lotSize: '', onHand: '', safety: '', receipts: [], demand: [], bom: [] });
const slug = (s, id) => String(s || '').trim().replace(/\s+/g, '_').slice(0, 26) || 'A' + id;

/** Transforme les suggestions du serveur (stock, recettes, achats en cours) en articles MRP ; rien n'est enregistré. */
function fromImport(j) {
  const stock = new Map(j.stock.map((s) => [s.id, s]));
  const ids = []; const makes = new Map();
  const add = (id) => { if (stock.has(id) && !ids.includes(id)) ids.push(id); };
  j.boms.forEach((b) => { add(b.productId); if (!makes.has(b.productId)) makes.set(b.productId, b); b.lines.forEach((l) => add(l.itemId)); });
  if (!ids.length) j.stock.forEach((s) => add(s.id));
  const kept = ids.slice(0, 60); const used = new Set(); const code = new Map();
  kept.forEach((id) => { const base = slug(stock.get(id).name, id); let c = base; let k = 2; while (used.has(c)) c = base + '_' + k++; used.add(c); code.set(id, c); });
  const open = new Map(j.openPurchases.map((o) => [o.itemId, o.qty]));
  return kept.map((id) => {
    const s = stock.get(id); const b = makes.get(id); const q = open.get(id);
    return { ...blank(code.get(id)), name: s.name, type: b ? 'make' : 'buy', onHand: s.onHand, safety: s.safety, receipts: q ? [0, q] : [],
      bom: b ? b.lines.filter((l) => code.has(l.itemId)).map((l) => ({ child: code.get(l.itemId), qty: l.qty })) : [] };
  });
}

function Item({ d, it, i }) {
  const t = useT();
  const doc = d.doc;
  const codes = doc.items.map((x) => x.code).filter((c) => c && c !== it.code);
  return (
    <Card flat title={(it.code || t('Article {n}', { n: i + 1 })) + (it.name ? ' · ' + it.name : '')} actions={<Remove onClick={() => d.set((o) => ({ ...o, items: o.items.filter((_, k) => k !== i) }))} />}>
      <EdTable head={[t('Code'), t('Nom'), t('Origine'), t('Délai (périodes)'), t('Règle de lot'), t('Taille de lot'), t('Stock'), t('Stock de sécurité')]}
        rows={[[
          <Cell type="text" label={t('Code')} value={it.code} onChange={(v) => d.upd(['items', i, 'code'], v)} />,
          <Cell type="text" label={t('Nom')} value={it.name} onChange={(v) => d.upd(['items', i, 'name'], v)} />,
          <Pick label={t('Origine')} value={it.type} onChange={(v) => d.upd(['items', i, 'type'], v)} options={[['make', t('Fabriqué')], ['buy', t('Acheté')]]} />,
          <Cell label={t('Délai (périodes)')} step="1" value={it.leadTime} onChange={(v) => d.upd(['items', i, 'leadTime'], v)} />,
          <Pick label={t('Règle de lot')} value={it.lotRule} onChange={(v) => d.upd(['items', i, 'lotRule'], v)} options={[['l4l', t('Lot pour lot (juste le besoin)')], ['fixed', t('Lot fixe (multiples)')], ['min', t('Quantité minimale')]]} />,
          <Cell label={t('Taille de lot')} value={it.lotSize} onChange={(v) => d.upd(['items', i, 'lotSize'], v)} placeholder={it.lotRule === 'l4l' ? t('sans objet') : ''} />,
          <Cell label={t('Stock')} value={it.onHand} onChange={(v) => d.upd(['items', i, 'onHand'], v)} />,
          <Cell label={t('Stock de sécurité')} value={it.safety} onChange={(v) => d.upd(['items', i, 'safety'], v)} />,
        ]]} />
      <PeriodGrid periods={doc.periods} head={t('Quantités par période')}
        rows={[{ key: 'r', label: t('Réceptions déjà prévues'), values: it.receipts }, { key: 'd', label: t('Demande externe (ventes)'), values: it.demand }]}
        onChange={(r, k, v) => d.upd(['items', i, r === 0 ? 'receipts' : 'demand', k], v)} />
      <Sub>{t('Nomenclature : composants nécessaires pour 1 unité')}</Sub>
      <EdTable empty={t('Pas de composant (matière achetée ou article sans nomenclature).')} head={[t('Composant'), t('Quantité par unité'), '']}
        rows={it.bom.map((b, k) => [
          <Pick label={t('Composant')} value={b.child} onChange={(v) => d.upd(['items', i, 'bom', k, 'child'], v)} options={[['', t('Choisir…')]].concat(codes.concat(b.child && !codes.includes(b.child) ? [b.child] : []).map((c) => [c, c]))} />,
          <Cell label={t('Quantité par unité')} value={b.qty} onChange={(v) => d.upd(['items', i, 'bom', k, 'qty'], v)} />,
          <Remove onClick={() => d.set((o) => ({ ...o, items: o.items.map((x, n) => (n === i ? { ...x, bom: x.bom.filter((_, m) => m !== k) } : x)) }))} />,
        ])} />
      <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, items: o.items.map((x, n) => (n === i ? { ...x, bom: x.bom.concat([{ child: '', qty: 1 }]) } : x)) }))}>{t('Ajouter un composant')}</Button>
    </Card>
  );
}

function Editor({ d }) {
  const t = useT();
  const { oapi, confirm, toast, fail } = useWs();
  const [busy, setBusy] = useState(false);
  const doImport = () => {
    setBusy(true);
    oapi('GET', '/production/adv/import/stock').then((j) => {
      const items = fromImport(j);
      if (!items.length) { toast(t('Rien à importer : votre stock est vide.'), true); return; }
      const apply = () => { d.set((o) => ({ ...o, items })); toast(t('{n} article(s) proposé(s). Vérifiez-les, puis enregistrez.', { n: items.length })); };
      if (d.doc.items.length) confirm(t("Remplacer les articles actuels par les suggestions ? Rien n'est enregistré tant que vous ne cliquez pas sur « Enregistrer et calculer »."), apply, t('Remplacer'));
      else apply();
    }).catch(fail).finally(() => setBusy(false));
  };
  return (
    <>
      <PeriodsField value={d.doc.periods} onChange={(v) => d.upd(['periods'], v)} />
      <Check checked={d.doc.useMps} onChange={(v) => d.upd(['useMps'], v)}>{t('Utiliser le plan directeur : la production prévue alimente la demande des articles')}</Check>
      {d.doc.useMps ? <p className="muted small">{t("Le plan directeur alimente un article quand son code est identique au code (ou au nom) du produit dans le plan directeur.")}</p> : null}
      <div className="row" style={{ margin: '8px 0' }}>
        <Button icon="down" loading={busy} onClick={doImport}>{t('Pré-remplir depuis mon stock et mes recettes')}</Button>
      </div>
      <p className="muted small">{t("Le pré-remplissage lit votre stock, vos nomenclatures et vos achats en cours sans rien modifier. Les achats en cours sont placés en S2 : corrigez avec leurs vraies dates, complétez les délais et la demande, puis enregistrez.")}</p>
      {d.doc.items.map((it, i) => <Item key={i} d={d} it={it} i={i} />)}
      <Button size="sm" icon="plus" onClick={() => d.set((o) => ({ ...o, items: o.items.concat([blank(nextId(o.items, 'A', 'code'))]) }))}>{t('Ajouter un article')}</Button>
    </>
  );
}

function issueItems(t, issues) {
  return issues.map((x) => {
    if (x.code === 'mrpLoop') return { tone: 'danger', title: t('Nomenclature circulaire'), text: t("« {item} » se retrouve parmi ses propres composants. Corrigez la nomenclature, sinon les besoins sont faussés.", { item: x.item }) };
    if (x.code === 'mrpMissing') return { tone: 'danger', title: t('Composant inconnu'), text: t("L'article « {item} » utilise le composant « {child} » qui n'est pas dans la liste des articles. Ajoutez-le ou corrigez le code.", { item: x.item, child: x.child }) };
    return { tone: 'warn', title: t('Ordre déjà en retard'), text: t("L'ordre de « {item} » aurait dû être lancé {n} période(s) plus tôt : le délai est plus long que le temps disponible. Lancez-le tout de suite et prévenez le fournisseur ou l'atelier, ou repoussez la date de besoin.", { item: x.item, n: x.days }) };
  });
}

function Result({ r }) {
  const t = useT();
  const labels = usePeriodLabels(r.periods);
  const makes = r.orders.filter((o) => o.kind === 'production').length;
  const buys = r.orders.length - makes;
  const late = r.orders.filter((o) => o.late).length;
  const count = (kind) => labels.map((_, p) => r.orders.filter((o) => o.kind === kind && o.release === p).length);
  const first = r.orders[0];
  return (
    <>
      <Conclusion>
        {r.orders.length
          ? t("Le calcul propose {n} ordre(s) : {m} de fabrication et {a} d'achat. Le premier à lancer : « {item} » en S{p}.", { n: r.orders.length, m: makes, a: buys, item: first.name || first.item, p: first.release + 1 })
          : t("Votre stock et vos réceptions déjà prévues couvrent toute la demande : aucun ordre à lancer sur cette période.")}{' '}
        {late ? t('{k} ordre(s) sont déjà en retard : voir les alertes.', { k: late }) : null}
      </Conclusion>
      <div className="bp-kpis">
        <Kpi label={t('Ordres de fabrication suggérés')} value={String(makes)} />
        <Kpi label={t("Ordres d'achat suggérés")} value={String(buys)} />
        <Kpi label={t('Ordres en retard')} value={String(late)} tone={late ? 'bad' : 'good'} />
      </div>
      <Issues items={issueItems(t, r.issues)} />
      <Card title={t('Ordres suggérés')} subtitle={t("Ce sont des propositions : rien n'est créé. Pour acheter, passez par le module Achats ; pour fabriquer, créez un ordre dans le module Production (onglet « Ordres de fabrication »).")}>
        {r.orders.length ? (
          <div className="bp-scroll"><table className="bp-table">
            <thead><tr><th>{t('Article')}</th><th>{t('Type')}</th><th>{t('Quantité')}</th><th>{t('À lancer en')}</th><th>{t('Pour réception en')}</th><th>{t('État')}</th></tr></thead>
            <tbody>{r.orders.map((o, i) => (
              <tr key={i}>
                <td>{o.name || o.item}<br /><small className="muted">{o.item}</small></td>
                <td><Badge tone={o.kind === 'production' ? 'info' : 'brand'}>{o.kind === 'production' ? t('Fabrication') : t('Achat')}</Badge></td>
                <td>{num(o.qty, 1)}</td>
                <td>{t('S{n}', { n: o.release + 1 })}</td>
                <td>{t('S{n}', { n: o.receipt + 1 })}</td>
                <td>{o.late ? <Badge tone="danger">{t('En retard de {n} période(s)', { n: o.lateBy })}</Badge> : <Badge tone="ok">{t('Dans les temps')}</Badge>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">{t('Aucun ordre à lancer.')}</p>}
        {r.orders.length ? (
          <BarChart title={t('Ordres à lancer par période')} labels={labels} fmt={(v) => num(v, 0)} height={200}
            bars={[{ key: 'mk', label: t('Fabrication'), values: count('production'), color: 's1', stack: 'o' }, { key: 'by', label: t('Achat'), values: count('purchase'), color: 's2', stack: 'o' }]} />
        ) : null}
      </Card>
      <Card title={t('Détail du calcul par article')} subtitle={t("Besoin brut = ce qu'il faut fournir ; besoin net = ce qui manque après le stock et les réceptions ; les ordres planifiés couvrent ce besoin net, en tenant compte des lots.")}>
        {r.items.map((it, n) => (
          <details key={it.code} open={n < 2} style={{ marginBottom: 8 }}>
            <summary><b>{it.name || it.code}</b> <small className="muted">{it.code + ' · ' + (it.type === 'buy' ? t('Acheté') : t('Fabriqué')) + ' · ' + t('délai {n}', { n: it.leadTime })}</small></summary>
            <PeriodTable periods={r.periods} head={t('Par période')} rows={[
              { key: 'g', label: t('Besoin brut'), values: it.gross },
              { key: 'r', label: t('Réceptions prévues'), values: it.receipts },
              { key: 'p', label: t('Stock projeté'), values: it.projected, tone: (v) => (v < 0 ? 'bad' : '') },
              { key: 'n', label: t('Besoin net'), values: it.net, tone: (v) => (v > 0 ? 'warn' : '') },
              { key: 'pr', label: t('Réceptions planifiées'), values: it.plannedReceipts, strong: true },
              { key: 'pl', label: t('Lancements planifiés'), values: it.plannedReleases, strong: true },
            ]} />
          </details>
        ))}
      </Card>
    </>
  );
}

export default function Mrp() {
  const t = useT();
  const d = useDoc('mrp');
  return (
    <Doc d={d}>
      <Setup d={d} title={t('Besoins en matières (MRP)')} subtitle={t('Quoi fabriquer ou acheter, en quelle quantité, et à quelle date le lancer pour ne jamais manquer de matière.')}>
        <Editor d={d} />
      </Setup>
      {d.result && d.result.items.length ? <Result r={d.result} /> : <EmptyState icon="chart" title={t("Pas encore d'articles")}>{t('Ajoutez vos articles (ou pré-remplissez-les depuis votre stock), puis enregistrez.')}</EmptyState>}
    </Doc>
  );
}
