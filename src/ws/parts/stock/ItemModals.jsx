import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { qty } from './common.js';

/** Entrée ou sortie de stock. */
export function MoveForm({ item, kind, close, done }) {
  const { oapi } = useWs();
  return (
    <Form
      fields={[
        { k: 'quantity', label: 'Quantité (' + item.unit + ')', required: true, placeholder: '10', hint: 'En stock : ' + qty(item.quantity) + ' ' + item.unit },
        { k: 'reason', label: 'Motif', placeholder: kind === 'in' ? 'Livraison, retour…' : 'Vente, perte, usage…' },
      ]}
      submitText="Enregistrer"
      onSubmit={(v) => oapi('POST', '/stock/items/' + item.id + '/move', { kind, quantity: v.quantity, reason: v.reason }).then(() => { close(); done(); })}
    />
  );
}

/** Historique des mouvements d'un article. */
export function History({ item }) {
  const { oapi, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/stock/items/' + item.id + '/moves'), []);
  if (st.loading && !st.data) return <div><Loading /></div>;
  if (st.error) return <div>{st.error.message}</div>;
  const moves = st.data.moves;
  return (
    <div>
      {!moves.length ? <Empty text="Aucun mouvement." /> : null}
      {moves.map((m, i) => (
        <div className="line" key={i}>
          <span><b className={m.delta > 0 ? 'ok' : ''}>{(m.delta > 0 ? '+' : '−') + qty(Math.abs(m.delta))}</b><small>{' ' + m.reason + (m.name ? ' · ' + m.name : '')}</small></span>
          <small>{dateFr(m.at)}</small>
        </div>
      ))}
    </div>
  );
}

/** Création / modification d'un article. */
export function ItemForm({ item, close, done }) {
  const { oapi, info } = useWs();
  const it = item || {};
  const branches = info.branches;
  const f = [{ k: 'name', label: 'Nom', required: true, value: it.name }, { k: 'unit', label: 'Unité', value: it.unit || 'pièce', placeholder: 'pièce, kg, litre, carton…' }];
  if (!it.id) f.push({ k: 'quantity', label: 'Quantité en stock', value: '0' });
  f.push({ k: 'minQuantity', label: "Seuil d'alerte", value: it.minQuantity || '0', hint: "Sous cette quantité, MANAGER-IA vous alerte et propose de commander. 0 = pas d'alerte." });
  f.push({ k: 'unitCost', label: "Coût d'achat habituel (" + info.org.currency + ')', value: it.unitCost || '' });
  if (branches.length && !it.id) f.push({ k: 'branchId', label: 'Antenne', type: 'select', options: [['', "Toute l'organisation"]].concat(branches.map((x) => [String(x.id), x.name])) });
  return (
    <Form
      fields={f}
      submitText="Enregistrer"
      onSubmit={(v) => {
        const p = { name: v.name, unit: v.unit, minQuantity: v.minQuantity, unitCost: v.unitCost };
        if (!it.id) { p.quantity = v.quantity; if (v.branchId) p.branchId = v.branchId; }
        return oapi(it.id ? 'PUT' : 'POST', '/stock/items' + (it.id ? '/' + it.id : ''), p).then(() => { close(); done(); });
      }}
    />
  );
}

/** Prix par fournisseur d'un article. */
export function PricesForm({ item, suppliers, current, close, done }) {
  const { oapi, info } = useWs();
  if (!suppliers.length) return <Empty text="Ajoutez d'abord un fournisseur (bouton « Fournisseurs »)." />;
  const f = [];
  suppliers.forEach((s) => {
    f.push({ k: 'p' + s.id, label: s.name + ' : prix unitaire (' + info.org.currency + ')', value: current[s.id] ? current[s.id].unitPrice : '', hint: 'Laissez vide si ce fournisseur ne vend pas cet article.' });
    f.push({ k: 'd' + s.id, label: s.name + ' : délai de livraison (jours)', value: current[s.id] && current[s.id].leadDays != null ? current[s.id].leadDays : '' });
  });
  return (
    <Form
      fields={f}
      submitText="Enregistrer"
      onSubmit={(v) => {
        const list = [];
        suppliers.forEach((s) => { if (String(v['p' + s.id]).trim()) list.push({ supplierId: s.id, unitPrice: v['p' + s.id], leadDays: v['d' + s.id] }); });
        return oapi('PUT', '/stock/items/' + item.id + '/prices', { prices: list }).then(() => { close(); done(); });
      }}
    />
  );
}
