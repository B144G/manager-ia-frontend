import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Form } from '../../ui.jsx';
import { qty } from './common.js';

/** Réception (totale ou partielle) d'une commande : lot, péremption, numéros de série, prix réellement facturé. */
export function ReceiveForm({ order, close, done }) {
  const t = useT();
  const { oapi, info } = useWs();
  const lot = order.tracking === 'lot'; const ser = order.tracking === 'serial';
  const f = [];
  if (ser) f.push({ k: 'serials', label: t('Numéros de série ou VIN reçus (un par ligne)'), type: 'textarea', rows: 4, required: true });
  else f.push({ k: 'quantity', label: t('Quantité reçue ({unit})', { unit: order.unit }), required: true, value: order.remaining, hint: t('Reste à recevoir : {n} {unit}. Une quantité plus petite enregistre une réception partielle.', { n: qty(order.remaining), unit: order.unit }) });
  if (lot) { f.push({ k: 'lotNo', label: t('Numéro de lot'), required: true }); f.push({ k: 'expiry', label: t('Date de péremption (facultatif)'), type: 'date' }); }
  f.push({ k: 'unitPrice', label: t('Prix unitaire facturé ({currency}, facultatif)', { currency: info.org.currency }), value: order.unitPrice || '' });
  f.push({ k: 'note', label: t('Note (bon de livraison…)') });
  return (
    <Form
      fields={f}
      submitText={t('Enregistrer la réception')}
      onSubmit={(v) => oapi('POST', '/stock/orders/' + order.id + '/receive', { quantity: v.quantity, lotNo: v.lotNo, expiry: v.expiry || undefined, serials: v.serials, unitPrice: v.unitPrice, note: v.note }).then(() => { close(); done(); })}
    />
  );
}

export function PromiseForm({ order, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  return (
    <Form
      fields={[{ k: 'promisedDate', label: t('Date de livraison promise par le fournisseur'), type: 'date', value: order.promisedDate }]}
      submitText={t('Enregistrer')}
      onSubmit={(v) => oapi('PUT', '/stock/orders/' + order.id, { promisedDate: v.promisedDate || null }).then(() => { close(); done(); })}
    />
  );
}
