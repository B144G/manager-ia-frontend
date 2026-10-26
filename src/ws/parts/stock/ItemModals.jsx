import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { qty } from './common.js';

/** Entrée ou sortie de stock. */
export function MoveForm({ item, kind, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  return (
    <Form
      fields={[
        { k: 'quantity', label: t('Quantité ({unit})', { unit: item.unit }), required: true, placeholder: '10', hint: t('En stock : {n} {unit}', { n: qty(item.quantity), unit: item.unit }) },
        { k: 'reason', label: t('Motif'), placeholder: kind === 'in' ? t('Livraison, retour…') : t('Vente, perte, usage…') },
      ]}
      submitText={t("Enregistrer")}
      onSubmit={(v) => oapi('POST', '/stock/items/' + item.id + '/move', { kind, quantity: v.quantity, reason: v.reason }).then(() => { close(); done(); })}
    />
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
  const f = [{ k: 'name', label: t('Nom'), required: true, value: it.name }, { k: 'unit', label: t('Unité'), value: it.unit || 'pièce', placeholder: t('pièce, kg, litre, carton…') }];
  if (!it.id) f.push({ k: 'quantity', label: t('Quantité en stock'), value: '0' });
  f.push({ k: 'minQuantity', label: t("Seuil d'alerte"), value: it.minQuantity || '0', hint: t("Sous cette quantité, MANAGER-IA vous alerte et propose de commander. 0 = pas d'alerte.") });
  f.push({ k: 'unitCost', label: t("Coût d'achat habituel ({currency})", { currency: info.org.currency }), value: it.unitCost || '' });
  if (branches.length && !it.id) f.push({ k: 'branchId', label: t('Antenne'), type: 'select', options: [['', t("Toute l'organisation")]].concat(branches.map((x) => [String(x.id), x.name])) });
  return (
    <Form
      fields={f}
      submitText={t("Enregistrer")}
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
