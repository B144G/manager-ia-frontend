import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { qty } from './common.js';

/** Entrée ou sortie de stock (lot et péremption, numéros de série ou VIN, coût d'achat selon l'article). */
export function MoveForm({ item, kind, close, done }) {
  const t = useT();
  const { oapi, can, info } = useWs();
  const lot = item.tracking === 'lot'; const ser = item.tracking === 'serial';
  const f = [];
  if (ser) f.push({ k: 'serials', label: kind === 'in' ? t('Numéros de série ou VIN (un par ligne)') : t('Numéros de série ou VIN sortis (un par ligne)'), type: 'textarea', rows: 4, required: true, hint: t('La quantité est le nombre de numéros.') });
  else f.push({ k: 'quantity', label: t('Quantité ({unit})', { unit: item.unit }), required: true, placeholder: '10', hint: t('En stock : {n} {unit}', { n: qty(item.quantity), unit: item.unit }) });
  if (lot && kind === 'in') { f.push({ k: 'lotNo', label: t('Numéro de lot'), required: true }); f.push({ k: 'expiry', label: t('Date de péremption (facultatif)'), type: 'date' }); }
  if (kind === 'in' && can('manager')) f.push({ k: 'unitCost', label: t("Coût d'achat unitaire ({currency}, facultatif)", { currency: info.org.currency }), hint: t('Sert à calculer le coût moyen pondéré du stock.') });
  f.push({ k: 'reason', label: t('Motif'), placeholder: kind === 'in' ? t('Livraison, retour…') : t('Vente, perte, usage…') });
  return (
    <>
      {lot && kind === 'out' ? <p className="muted small">{item.pickRule === 'fifo' ? t('La sortie prend automatiquement le lot reçu en premier (FIFO).') : t('La sortie prend automatiquement le lot qui périme en premier (FEFO). Les lots périmés sont ignorés.')}</p> : null}
    <Form
      fields={f}
      submitText={t("Enregistrer")}
      onSubmit={(v) => oapi('POST', '/stock/items/' + item.id + '/move', { kind, quantity: v.quantity, reason: v.reason, lotNo: v.lotNo, expiry: v.expiry || undefined, serials: v.serials, unitCost: v.unitCost }).then(() => { close(); done(); })}
    />
    </>
  );
}

/** Lots (péremption) et numéros de série d'un article. */
export function Lots({ item }) {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/stock/items/' + item.id + '/lots'), []);
  if (st.loading && !st.data) return <div><Loading /></div>;
  if (st.error) return <div>{t(st.error.message)}</div>;
  const j = st.data;
  return (
    <div>
      {j.tracking === 'lot' ? <p className="muted small">{j.rule === 'fifo' ? t('Sorties : le lot reçu en premier part en premier (FIFO).') : t('Sorties : le lot qui périme en premier part en premier (FEFO).')}</p> : null}
      {j.tracking === 'lot' && !j.lots.length ? <Empty text={t('Aucun lot en stock.')} /> : null}
      {j.lots.map((l) => (
        <div className="line" key={l.id}>
          <span><b>{l.lotNo}</b>{l.expired ? <span className="pill bad">{t('Périmé')}</span> : l.daysLeft !== null && l.daysLeft <= 30 ? <span className="pill mid">{t('Périme dans {n} j', { n: l.daysLeft })}</span> : null}<small>{' ' + (l.expiry ? t('péremption {date}', { date: dateFr(l.expiry) }) : t('sans péremption'))}</small></span>
          <b>{qty(l.quantity) + ' ' + j.unit}</b>
        </div>
      ))}
      {j.tracking === 'serial' && !j.serials.length ? <Empty text={t('Aucun numéro de série.')} /> : null}
      {j.serials.map((s) => (
        <div className="line" key={s.serial}>
          <span><b>{s.serial}</b><small>{' ' + (s.status === 'in_stock' ? t('en stock') : t('sorti') + (s.note ? ' · ' + s.note : ''))}</small></span>
          <small>{dateFr(s.outAt || s.receivedAt)}</small>
        </div>
      ))}
    </div>
  );
}

/** Historique des mouvements d'un article. */
export function History({ item }) {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/stock/items/' + item.id + '/moves'), []);
  if (st.loading && !st.data) return <div><Loading /></div>;
  if (st.error) return <div>{t(st.error.message)}</div>;
  const moves = st.data.moves;
  return (
    <div>
      {!moves.length ? <Empty text={t("Aucun mouvement.")} /> : null}
      {moves.map((m, i) => (
        <div className="line" key={i}>
          <span><b className={m.delta > 0 ? 'ok' : ''}>{(m.delta > 0 ? '+' : '−') + qty(Math.abs(m.delta))}</b><small>{' ' + t(m.reason) + (m.name ? ' · ' + m.name : '')}</small></span>
          <small>{dateFr(m.at)}</small>
        </div>
      ))}
    </div>
  );
}

/** Création / modification d'un article. */
export function ItemForm({ item, close, done }) {
  const t = useT();
  const { oapi, info } = useWs();
  const it = item || {};
  const branches = info.branches;
  const f = [{ k: 'name', label: t('Nom'), required: true, value: it.name }, { k: 'unit', label: t('Unité'), value: it.unit || 'pièce', placeholder: t('pièce, kg, litre, carton…') },
    { k: 'sku', label: t('SKU (référence interne, facultatif)'), value: it.sku }, { k: 'barcode', label: t('Code-barres (facultatif)'), value: it.barcode, hint: t('Permet de retrouver l’article avec un lecteur ou en tapant le code.') },
    { k: 'tracking', label: t('Suivi'), type: 'select', value: it.tracking || 'none', options: [['none', t('Simple quantité')], ['lot', t('Par lot, avec date de péremption')], ['serial', t('Par numéro de série ou VIN (véhicules, pièces)')]], hint: t('Se change seulement quand la quantité est à zéro, sauf passage à « par lot ».') },
    { k: 'pickRule', label: t('Règle de sortie des lots'), type: 'select', value: it.pickRule || 'fefo', options: [['fefo', t('FEFO : le plus proche de la péremption d’abord')], ['fifo', t('FIFO : le plus ancien reçu d’abord')]] }];
  if (!it.id) {
    f.push({ k: 'quantity', label: t('Quantité en stock'), value: '0' });
    f.push({ k: 'lotNo', label: t('Lot de départ (si suivi par lot)'), placeholder: 'INITIAL' });
    f.push({ k: 'expiry', label: t('Péremption du lot de départ'), type: 'date' });
    f.push({ k: 'serials', label: t('Numéros de série de départ (un par ligne)'), type: 'textarea', rows: 2 });
  }
  f.push({ k: 'minQuantity', label: t("Seuil d'alerte"), value: it.minQuantity || '0', hint: t("Sous cette quantité, MANAGER-IA vous alerte et propose de commander. 0 = pas d'alerte.") });
  f.push({ k: 'maxQuantity', label: t('Stock maximum'), value: it.maxQuantity || '0', hint: t('Au-dessus, une alerte de surstock apparaît. 0 = pas de maximum.') });
  f.push({ k: 'unitCost', label: t("Coût d'achat habituel ({currency})", { currency: info.org.currency }), value: it.unitCost || '' });
  if (branches.length && !it.id) f.push({ k: 'branchId', label: t('Antenne'), type: 'select', options: [['', t("Toute l'organisation")]].concat(branches.map((x) => [String(x.id), x.name])) });
  return (
    <Form
      fields={f}
      submitText={t("Enregistrer")}
      onSubmit={(v) => {
        const p = { name: v.name, unit: v.unit, minQuantity: v.minQuantity, maxQuantity: v.maxQuantity, unitCost: v.unitCost, sku: v.sku, barcode: v.barcode, tracking: v.tracking, pickRule: v.pickRule };
        if (!it.id) { p.quantity = v.quantity; p.lotNo = v.lotNo; p.expiry = v.expiry || undefined; p.serials = v.serials; if (v.branchId) p.branchId = v.branchId; }
        return oapi(it.id ? 'PUT' : 'POST', '/stock/items' + (it.id ? '/' + it.id : ''), p).then(() => { close(); done(); });
      }}
    />
  );
}

/** Prix par fournisseur d'un article. */
export function PricesForm({ item, suppliers, current, close, done }) {
  const t = useT();
  const { oapi, info } = useWs();
  if (!suppliers.length) return <Empty text={t("Ajoutez d'abord un fournisseur (bouton « Fournisseurs »).")} />;
  const f = [];
  suppliers.forEach((s) => {
    f.push({ k: 'p' + s.id, label: t('{name} : prix unitaire ({currency})', { name: s.name, currency: info.org.currency }), value: current[s.id] ? current[s.id].unitPrice : '', hint: t('Laissez vide si ce fournisseur ne vend pas cet article.') });
    f.push({ k: 'd' + s.id, label: t('{name} : délai de livraison (jours)', { name: s.name }), value: current[s.id] && current[s.id].leadDays != null ? current[s.id].leadDays : '' });
  });
  return (
    <Form
      fields={f}
      submitText={t("Enregistrer")}
      onSubmit={(v) => {
        const list = [];
        suppliers.forEach((s) => { if (String(v['p' + s.id]).trim()) list.push({ supplierId: s.id, unitPrice: v['p' + s.id], leadDays: v['d' + s.id] }); });
        return oapi('PUT', '/stock/items/' + item.id + '/prices', { prices: list }).then(() => { close(); done(); });
      }}
    />
  );
}
