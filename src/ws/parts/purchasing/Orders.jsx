import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { Failed, Field, LinesEditor, ORDER_STATUS, Pill, blankLine, linesPayload, reasonModal, useDownload, useFormState, useItems, useSuppliers, num } from './common.jsx';

/* Bons de commande (en-tête + lignes), envoi au fournisseur, réceptions partielles avec contrôle, bons de réception. */

const FILTERS = [['', 'Tous'], ['draft', 'Brouillons'], ['sent', 'Envoyés'], ['partial', 'Partiellement reçus'], ['received', 'Reçus'], ['closed', 'Clos']];

export default function Orders({ focus, onFocused, goInvoice }) {
  const t = useT();
  const { oapi, money, dateFr, modal } = useWs();
  const [status, setStatus] = useState('');
  const st = useLoad(() => oapi('GET', '/purchasing/orders' + (status ? '?status=' + status : '')), [status]);
  const j = st.data;
  const open = (id) => modal(t('Bon de commande'), (close) => <OrderDetail id={id} close={close} onChange={st.reload} goInvoice={goInvoice} />, { wide: true });
  const add = () => modal(t('Nouveau bon de commande'), (close) => <OrderForm close={close} onSaved={(id) => { st.reload(); open(id); }} />, { wide: true });
  useEffect(() => { if (focus) { open(focus); onFocused(); } }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ws-card">
      <div className="row"><h2 className="grow">{t('Bons de commande')}</h2><button className="btn primary small" type="button" onClick={add}>{t('Nouveau bon de commande')}</button></div>
      <div className="pur-filters" role="group" aria-label={t('Filtrer par état')}>
        {FILTERS.map(([k, l]) => <button key={k} type="button" className={'btn small' + (status === k ? ' primary' : '')} aria-pressed={status === k} onClick={() => setStatus(k)}>{t(l)}{j && k && j.counts[k] ? ' (' + j.counts[k] + ')' : ''}</button>)}
      </div>
      {j && j.late ? <p className="late">{t('{n} livraison(s) en retard', { n: j.late })}</p> : null}
      {st.loading && !j ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {j && !j.orders.length ? <Empty text={t('Aucun bon de commande.')} /> : null}
      {j ? j.orders.map((o) => (
        <div className="line" key={o.id}>
          <span><b>{o.number}</b> · {o.supplier}<br /><small>{dateFr(o.orderDate)}{o.expectedDate ? ' · ' + t('livraison prévue le {date}', { date: dateFr(o.expectedDate) }) : ''}{o.category ? ' · ' + o.category : ''}{o.late ? ' · ' : ''}{o.late ? <b className="late">{t('En retard')}</b> : null}</small></span>
          <span className="row"><b>{money(o.totalTtc)}</b><Pill map={ORDER_STATUS} k={o.status} /><button className="btn small" type="button" onClick={() => open(o.id)}>{t('Ouvrir')}</button></span>
        </div>
      )) : null}
    </div>
  );
}

export function OrderForm({ close, onSaved }) {
  const t = useT();
  const { oapi, toast, today, info } = useWs();
  const items = useItems();
  const sup = useSuppliers();
  const cats = useLoad(() => oapi('GET', '/purchasing/categories').then((j) => j.categories), []);
  const f = useFormState({ supplierId: '', orderDate: today(), expectedDate: '', paymentDays: '30', vatRate: String(info && info.org ? info.org.vatRate : 19.25), category: '', deliveryAddress: '', notes: '' });
  const [lines, setLines] = useState([blankLine()]);
  const list = sup.data ? sup.data.suppliers.filter((s) => !s.blocked) : [];
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.supplierId) throw new Error(t('Choisissez un fournisseur.'));
      const r = await oapi('POST', '/purchasing/orders', { supplierId: Number(f.v.supplierId), orderDate: f.v.orderDate, expectedDate: f.v.expectedDate || undefined, paymentDays: Number(f.v.paymentDays), vatRate: num(f.v.vatRate), category: f.v.category, deliveryAddress: f.v.deliveryAddress, notes: f.v.notes, lines: linesPayload(lines, 'unitPrice') });
      toast(t('Bon de commande {number} créé.', { number: r.number })); close(); onSaved(r.id);
    }); }}>
      <div className="pur-grid">
        <Field label={t('Fournisseur')}><select value={f.v.supplierId} onChange={f.set('supplierId')}><option value="">{t('— Choisir —')}</option>{list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label={t('Catégorie de budget')}><input type="text" list="pur-cats2" value={f.v.category} maxLength={60} onChange={f.set('category')} /><datalist id="pur-cats2">{(cats.data || []).map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label={t('Date de commande')}><input type="date" value={f.v.orderDate} onChange={f.set('orderDate')} /></Field>
        <Field label={t('Livraison prévue')}><input type="date" value={f.v.expectedDate} onChange={f.set('expectedDate')} /></Field>
        <Field label={t('Paiement (jours)')}><input type="text" inputMode="numeric" value={f.v.paymentDays} onChange={f.set('paymentDays')} /></Field>
        <Field label={t('TVA (%)')}><input type="text" inputMode="decimal" value={f.v.vatRate} onChange={f.set('vatRate')} /></Field>
      </div>
      <Field label={t('Adresse de livraison')} wide><input type="text" value={f.v.deliveryAddress} maxLength={200} onChange={f.set('deliveryAddress')} /></Field>
      <Field label={t('Notes pour le fournisseur')} wide><textarea rows={2} value={f.v.notes} onChange={f.set('notes')} /></Field>
      <h3>{t('Lignes (prix hors taxe)')}</h3>
      <LinesEditor lines={lines} setLines={setLines} items={items} priceLabel={t('Prix unitaire HT')} priceRequired />
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{t('Créer le bon de commande')}</button></div>
    </form>
  );
}

function OrderDetail({ id, close, onChange, goInvoice }) {
  const t = useT();
  const { oapi, money, dateFr, can, modal, toast, fail, confirm } = useWs();
  const dl = useDownload();
  const st = useLoad(() => oapi('GET', '/purchasing/orders/' + id), [id]);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <Failed e={st.error} />;
  const o = st.data.order;
  const after = (msg) => (res) => { if (msg) toast(msg); if (res && res.budgetWarning) toast(t('Attention : le budget « {category} » est dépassé.', { category: res.budgetWarning.category }), true); st.reload(); onChange(); };
  const post = (path, body, msg) => oapi('POST', '/purchasing/orders/' + id + path, body || {}).then(after(msg)).catch(fail);
  const send = () => modal(t('Envoyer au fournisseur'), (c) => <SendForm o={o} close={c} onDone={(r) => { after(r.via === 'email' ? t('Envoyé par e-mail à {to}.', { to: r.to }) : t('Marqué comme envoyé.'))(); }} />);
  const receive = () => modal(t('Réception de marchandises'), (c) => <ReceiveForm o={o} close={c} onDone={(r) => { after(t('Réception {number} enregistrée.', { number: r.number }))(); }} />, { wide: true });
  const cancel = () => reasonModal(modal, t, { title: t('Annuler le bon de commande'), label: t("Motif de l'annulation"), submit: t('Annuler le bon'), required: o.status !== 'draft', onSubmit: (reason) => oapi('POST', '/purchasing/orders/' + id + '/cancel', { reason }).then(after(t('Bon de commande annulé.'))) });
  const canReceive = ['approved', 'sent', 'partial'].includes(o.status);
  return (
    <div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}><h3 className="grow">{o.number} · {o.supplier}</h3><Pill map={ORDER_STATUS} k={o.status} />{o.late ? <span className="pill bad">{t('En retard')}</span> : null}</div>
      <p className="muted small">{t('Commande du {date}', { date: dateFr(o.orderDate) })}{o.expectedDate ? ' · ' + t('livraison prévue le {date}', { date: dateFr(o.expectedDate) }) : ''} · {t('paiement à {n} jours', { n: o.paymentDays })} · {t('créé par {name}', { name: o.creator })}{o.approver ? ' · ' + t('approuvé par {name}', { name: o.approver }) : ''}</p>
      {o.sentAt ? <p className="muted small">{t('Envoyé le {date} ({to})', { date: dateFr(String(o.sentAt).slice(0, 10)), to: o.sentTo })}</p> : null}
      {o.status === 'draft' ? <p className="muted small">{t('À approuver par : {role} ou un rôle supérieur.', { role: t(o.requiredRoleLabel) })}</p> : null}
      <div className="pur-table-wrap">
        <table className="pur-table">
          <thead><tr><th>{t('Désignation')}</th><th>{t('Commandé')}</th><th>{t('Reçu')}</th><th>{t('Refusé')}</th><th>{t('Facturé')}</th><th>{t('Prix HT')}</th><th>{t('Montant')}</th></tr></thead>
          <tbody>{o.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td>{l.quantity} {l.unit}</td><td>{l.receivedQty}</td><td>{l.rejectedQty || ''}</td><td>{l.invoicedQty || ''}</td><td>{money(l.unitPrice)}</td><td>{money(l.amount)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="line"><span>{t('Total HT')}</span><b>{money(o.totalHt)}</b></div>
      <div className="line"><span>{t('TVA {rate} %', { rate: o.vatRate })}</span><b>{money(o.vatAmount)}</b></div>
      <div className="line"><b>{t('Total TTC')}</b><b>{money(o.totalTtc)}</b></div>
      {o.budget ? <p className={o.budget.over ? 'late' : 'muted small'}>{t('Budget « {category} » : {planned} prévus, {left} disponibles après ce bon.', { category: o.budget.category, planned: money(o.budget.planned), left: money(o.budget.planned - o.budget.engaged - o.budget.invoiced - (o.status === 'draft' ? o.totalTtc : 0)) })}</p> : null}
      {o.receipts.length ? <><h3>{t('Bons de réception')}</h3>{o.receipts.map((r) => <div className="line" key={r.id}><span><b>{r.number}</b><small> · {dateFr(r.date)}{r.deliveryNote ? ' · ' + t('BL {ref}', { ref: r.deliveryNote }) : ''}</small></span><button className="btn small" type="button" onClick={() => dl('/receipts/' + r.id + '/pdf', r.number + '.pdf')}>{t('PDF')}</button></div>)}</> : null}
      {o.invoices.length ? <><h3>{t('Factures liées')}</h3>{o.invoices.map((v) => <div className="line" key={v.id}><span><b>{v.number}</b><small> · {v.supplierRef}</small></span><span className="row"><b>{money(v.totalTtc)}</b>{goInvoice ? <button className="btn small" type="button" onClick={() => { close(); goInvoice(v.id); }}>{t('Ouvrir')}</button> : null}</span></div>)}</> : null}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {o.status === 'draft' && o.canApprove ? <button className="btn primary" type="button" onClick={() => post('/approve', {}, t('Bon de commande approuvé.'))}>{t('Approuver')}</button> : null}
        {['approved', 'sent', 'partial'].includes(o.status) ? <button className="btn" type="button" onClick={send}>{o.status === 'approved' ? t('Envoyer au fournisseur') : t('Renvoyer')}</button> : null}
        <button className="btn" type="button" onClick={() => dl('/orders/' + id + '/pdf', o.number + '.pdf')}>{t('Télécharger le PDF')}</button>
        {canReceive ? <button className="btn primary" type="button" onClick={receive}>{t('Enregistrer une réception')}</button> : null}
        {['received', 'partial'].includes(o.status) ? <button className="btn" type="button" onClick={() => confirm(t('Clore ce bon de commande ? Le reste non livré ne sera plus attendu.'), () => post('/close', {}, t('Bon de commande clos.')), t('Clore'))}>{t('Clore')}</button> : null}
        {['draft', 'approved', 'sent'].includes(o.status) ? <button className="btn" type="button" onClick={cancel}>{t('Annuler')}</button> : null}
        {o.status === 'draft' ? <button className="btn" type="button" onClick={() => confirm(t('Supprimer ce brouillon ?'), () => oapi('DELETE', '/purchasing/orders/' + id).then(() => { close(); onChange(); }).catch(fail), t('Supprimer'))}>{t('Supprimer')}</button> : null}
        {['approved', 'sent', 'partial', 'received', 'closed'].includes(o.status) && can('manager') && goInvoice ? <button className="btn" type="button" onClick={() => { close(); goInvoice('new:' + id); }}>{t('Saisir la facture')}</button> : null}
      </div>
    </div>
  );
}

function SendForm({ o, close, onDone }) {
  const t = useT();
  const { oapi } = useWs();
  const f = useFormState({ via: 'email', to: o.supplierEmail || '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => { const r = await oapi('POST', '/purchasing/orders/' + o.id + '/send', { via: f.v.via, to: f.v.to }); close(); onDone(r); }); }}>
      <Field label={t("Mode d'envoi")}><select value={f.v.via} onChange={f.set('via')}><option value="email">{t('Par e-mail (PDF joint)')}</option><option value="manual">{t('Marquer comme envoyé (remis en main propre, WhatsApp…)')}</option></select></Field>
      {f.v.via === 'email' ? <Field label={t('Adresse e-mail du fournisseur')}><input type="email" value={f.v.to} onChange={f.set('to')} /></Field> : null}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{f.v.via === 'email' ? t('Envoyer') : t('Marquer comme envoyé')}</button></div>
    </form>
  );
}

function ReceiveForm({ o, close, onDone }) {
  const t = useT();
  const { oapi, today } = useWs();
  const open = o.lines.filter((l) => l.remainingQty > 0 || l.receivedQty === 0);
  const f = useFormState({ receiptDate: today(), deliveryNote: '', note: '', rows: Object.fromEntries(open.map((l) => [l.id, { recv: String(l.remainingQty), rej: '', reason: '', lot: '', expiry: '', serials: '', loc: '' }])) });
  const locs = useLoad(() => oapi('GET', '/stock/wms/locations').then((j) => j.locations || []).catch(() => []), []);
  const set = (id, k, v) => f.setV((s) => ({ ...s, rows: { ...s.rows, [id]: { ...s.rows[id], [k]: v } } }));
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      const lines = open.map((l) => { const r = f.v.rows[l.id]; return { orderLineId: l.id, receivedQty: num(r.recv), rejectedQty: num(r.rej), reason: r.reason, lotNo: r.lot, expiry: r.expiry || undefined, serials: r.serials, locationId: r.loc ? Number(r.loc) : undefined }; });
      const res = await oapi('POST', '/purchasing/orders/' + o.id + '/receipts', { receiptDate: f.v.receiptDate, deliveryNote: f.v.deliveryNote, note: f.v.note, lines });
      close(); onDone(res);
    }); }}>
      <div className="pur-grid">
        <Field label={t('Date de réception')}><input type="date" max={today()} value={f.v.receiptDate} onChange={f.set('receiptDate')} /></Field>
        <Field label={t('N° du bon de livraison')}><input type="text" value={f.v.deliveryNote} maxLength={60} onChange={f.set('deliveryNote')} /></Field>
      </div>
      <p className="muted small">{t("Indiquez pour chaque ligne la quantité acceptée et, s'il y en a, la quantité refusée avec son motif. Seules les quantités acceptées entrent en stock.")}</p>
      {open.map((l) => {
        const r = f.v.rows[l.id];
        return (
          <div className="pur-line" key={l.id}>
            <div className="pur-wide"><b>{l.description}</b><small> · {t('commandé {q}, déjà reçu {r}', { q: l.quantity + ' ' + l.unit, r: l.receivedQty })}</small></div>
            <Field label={t('Quantité acceptée')}><input type="text" inputMode="decimal" value={r.recv} onChange={(e) => set(l.id, 'recv', e.target.value)} /></Field>
            <Field label={t('Quantité refusée')}><input type="text" inputMode="decimal" value={r.rej} onChange={(e) => set(l.id, 'rej', e.target.value)} /></Field>
            {num(r.rej) > 0 ? <Field label={t('Motif du refus')} wide><input type="text" value={r.reason} maxLength={200} onChange={(e) => set(l.id, 'reason', e.target.value)} /></Field> : null}
            {l.itemId && (locs.data || []).length ? <Field label={t("Emplacement de réception")} hint={t('Vide : rangement automatique selon les règles du stock.')} wide><select value={r.loc} onChange={(e) => set(l.id, 'loc', e.target.value)}><option value="">{t('Rangement automatique')}</option>{locs.data.map((x) => <option key={x.id} value={x.id}>{x.code || x.name}</option>)}</select></Field> : null}
            {l.itemId && l.tracking === 'lot' ? <><Field label={t('Numéro de lot')}><input type="text" value={r.lot} maxLength={40} onChange={(e) => set(l.id, 'lot', e.target.value)} /></Field><Field label={t('Péremption')}><input type="date" value={r.expiry} onChange={(e) => set(l.id, 'expiry', e.target.value)} /></Field></> : null}
            {l.itemId && l.tracking === 'serial' ? <Field label={t('Numéros de série (un par ligne ou séparés par des virgules)')} wide><textarea rows={2} value={r.serials} onChange={(e) => set(l.id, 'serials', e.target.value)} /></Field> : null}
          </div>
        );
      })}
      <Field label={t('Remarque')} wide><input type="text" value={f.v.note} maxLength={500} onChange={f.set('note')} /></Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{t('Enregistrer la réception')}</button></div>
    </form>
  );
}

/** Liste des bons de réception. */
export function Receipts() {
  const t = useT();
  const { oapi, dateFr, modal } = useWs();
  const dl = useDownload();
  const st = useLoad(() => oapi('GET', '/purchasing/receipts'), []);
  const j = st.data;
  const show = (r) => modal(r.number, () => (
    <div>
      <p className="muted small">{r.orderNumber} · {r.supplier} · {dateFr(r.date)}{r.deliveryNote ? ' · ' + t('BL {ref}', { ref: r.deliveryNote }) : ''} · {t('reçu par {name}', { name: r.receiver })}</p>
      {r.lines.map((l) => <div className="line" key={l.id}><span>{l.description}<small> · {t('commandé {q}', { q: l.ordered + ' ' + l.unit })}{l.lotNo ? ' · ' + t('lot {no}', { no: l.lotNo }) : ''}{l.expiry ? ' · ' + t('péremption {date}', { date: dateFr(l.expiry) }) : ''}{l.reason ? ' · ' + l.reason : ''}</small></span><span><b>{l.receivedQty}</b>{l.rejectedQty ? <b className="late"> / {t('refusé {n}', { n: l.rejectedQty })}</b> : null}</span></div>)}
      <div className="row"><button className="btn" type="button" onClick={() => dl('/receipts/' + r.id + '/pdf', r.number + '.pdf')}>{t('Télécharger le PDF')}</button></div>
    </div>
  ));
  return (
    <div className="ws-card">
      <h2>{t('Réceptions')}</h2>
      <p className="muted small">{t("Chaque réception est enregistrée depuis son bon de commande ; les quantités acceptées entrent en stock (lot, péremption et numéros de série compris).")}</p>
      {st.loading && !j ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {j && !j.receipts.length ? <Empty text={t('Aucune réception enregistrée.')} /> : null}
      {j ? j.receipts.map((r) => (
        <div className="line" key={r.id}><span><b>{r.number}</b> · {r.orderNumber} · {r.supplier}<br /><small>{dateFr(r.date)} · {r.lines.length} {t('ligne(s)')}</small></span><button className="btn small" type="button" onClick={() => show(r)}>{t('Ouvrir')}</button></div>
      )) : null}
    </div>
  );
}
