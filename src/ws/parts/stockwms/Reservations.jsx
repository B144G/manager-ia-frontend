import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Seg, Tag, WMS, itemOptions, qty, useDate, useItems } from './kit.jsx';
import { FormReason } from './Transfers.jsx';

/* Réservations : stock mis de côté pour une commande (ou un devis), une demande interne ou une réservation libre. Disponible à promettre = stock utilisable − réservé. */
const ST = { active: ['Active', 'mid'], fulfilled: ['Livrée', 'good'], released: ['Libérée', ''] };

function FromDocument({ close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const docs = useLoad(() => oapi('GET', '/crm/documents'), []);
  const ords = useLoad(() => oapi('GET', '/sales/orders').catch(() => ({ orders: [] })), []);
  const list = [];
  if (ords.data) ords.data.orders.filter((o) => o.status !== 'cancelled').forEach((o) => list.push([String(o.id), o.number + ' · ' + o.customer]));
  if (docs.data) docs.data.documents.filter((d) => d.kind !== 'credit' && !['cancelled', 'refused', 'paid', 'credited'].includes(d.status)).forEach((d) => list.push([String(d.id), d.number + ' · ' + (d.customer || '')]));
  return (
    <Form submitText={t('Réserver')} fields={[
      { k: 'documentId', label: t('Commande, devis ou facture'), type: 'select', options: [['', t('Choisir…')]].concat(list), required: true, hint: t("Seules les lignes rattachées à un article du stock réservent du stock.") },
      { k: 'partial', label: t('Si le stock ne suffit pas'), type: 'select', options: [['0', t('Tout refuser')], ['1', t('Réserver ce qui est disponible')]] }]}
    onSubmit={(v) => oapi('POST', WMS + '/reservations/from-document', { documentId: Number(v.documentId), partial: v.partial === '1' }).then((j) => { close(); done(j); })} />
  );
}

export default function Reservations() {
  const t = useT();
  const { oapi, can, modal, fail, toast, confirm } = useWs();
  const date = useDate();
  const mgr = can('manager');
  const [f, setF] = useState('active');
  const items = useItems();
  const st = useLoad(() => oapi('GET', WMS + '/reservations?status=' + f), [f]);
  const av = useLoad(() => oapi('GET', WMS + '/availability?onlyReserved=1'), []);
  const reload = () => { st.reload(); av.reload(); };
  const add = () => modal(t('Nouvelle réservation'), (close) => (
    <Form submitText={t('Réserver')} fields={[
      { k: 'itemId', label: t('Article'), type: 'select', options: itemOptions(items.items, t('Choisir…')), required: true },
      { k: 'quantity', label: t('Quantité'), required: true },
      { k: 'label', label: t('Pour qui ou pour quoi'), required: true, placeholder: t('Chantier, client, atelier…') },
      ...(mgr ? [{ k: 'kind', label: t('Type'), type: 'select', options: [['internal', t('Demande interne')], ['manual', t('Réservation libre')]] }] : []),
      { k: 'expiresAt', label: t('Garder jusqu\'au (facultatif)'), type: 'date' }]}
    onSubmit={(v) => oapi('POST', WMS + '/reservations', { itemId: Number(v.itemId), quantity: v.quantity, label: v.label, kind: v.kind || 'internal', expiresAt: v.expiresAt || undefined }).then(() => { close(); toast(t('Stock réservé.')); reload(); })} />
  ));
  const fromDoc = () => modal(t('Réserver pour une commande'), (close) => <FromDocument close={close} done={(j) => { reload(); toast(t('{n} article(s) réservé(s).', { n: j.reserved.length }) + (j.short.length ? ' ' + t('{n} article(s) en manque.', { n: j.short.length }) : '')); }} />);
  const fulfil = (r) => modal(t('Livrer : {name}', { name: r.item }), (close) => (
    <Form submitText={t('Livrer')} fields={[{ k: 'quantity', label: t('Quantité ({unit})', { unit: r.unit }), value: String(r.remaining), required: true, hint: t('Le stock sort ; la réservation diminue d\'autant.') }]}
    onSubmit={(v) => oapi('POST', WMS + '/reservations/' + r.id + '/fulfill', { quantity: v.quantity }).then(() => { close(); reload(); })} />
  ));
  const release = (r) => modal(t('Libérer la réservation'), (close) => <FormReason onSubmit={(reason) => oapi('POST', WMS + '/reservations/' + r.id + '/release', { reason }).then(() => { close(); reload(); })} />);
  return (
    <>
      <div className="row wms-toolbar">
        <button className="btn primary small" type="button" onClick={add}>{t('Nouvelle réservation')}</button>
        {mgr ? <button className="btn small" type="button" onClick={fromDoc}>{t('Réserver pour une commande')}</button> : null}
      </div>
      <Loaded state={av}>{(j) => (
        <Kpis list={[{ label: t('articles réservés'), value: String(j.reservedItems) }, { label: t('réservations non couvertes'), value: String(j.shortItems), bad: j.shortItems > 0 }]} />
      )}
      </Loaded>
      <Seg tabs={[['active', t('Actives')], ['fulfilled', t('Livrées')], ['released', t('Libérées')]]} value={f} onChange={setF} />
      <div className="ws-card">
        <Loaded state={st}>{(j) => (
          <>
            {!j.reservations.length ? <Empty text={t('Aucune réservation.')} /> : null}
            {j.reservations.map((r) => (
              <div className="line" key={r.id}>
                <span><b>{r.item + ' × ' + qty(r.quantity)}</b> <Tag tone={ST[r.status][1]}>{t(ST[r.status][0])}</Tag>
                  <small>{' ' + (r.label || t(r.sourceLabel)) + (r.fulfilledQty ? ' · ' + t('livré {n}', { n: qty(r.fulfilledQty) }) : '') + (r.neededBy ? ' · ' + t('pour le {date}', { date: date(r.neededBy) }) : '') + (r.expiresAt ? ' · ' + t('jusqu\'au {date}', { date: date(r.expiresAt) }) : '') + (r.closeReason ? ' · ' + r.closeReason : '')}</small></span>
                {r.status === 'active' ? (
                  <span className="row">
                    {mgr ? <button className="link" type="button" onClick={() => fulfil(r)}>{t('Livrer')}</button> : null}
                    {mgr || (r.sourceKind === 'internal') ? <button className="link" type="button" onClick={() => (r.sourceKind === 'document' ? confirm(t('Libérer cette réservation ? La commande ne sera plus protégée.'), () => { oapi('POST', WMS + '/reservations/' + r.id + '/release', {}).then(reload).catch(fail); }) : release(r))}>{t('Libérer')}</button> : null}
                  </span>
                ) : null}
              </div>
            ))}
          </>
        )}
        </Loaded>
      </div>
      <p className="muted small">{t("Une commande annulée libère son stock automatiquement. Les sorties libres ne peuvent pas entamer le stock réservé ; la livraison de la commande utilise sa propre réservation.")}</p>
    </>
  );
}
