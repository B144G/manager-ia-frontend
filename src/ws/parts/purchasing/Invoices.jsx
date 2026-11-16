import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { Failed, Field, INV_STATUS, LinesEditor, Pill, blankLine, reasonModal, useFormState, useSuppliers, num } from './common.jsx';

/* Factures fournisseurs : saisie, rapprochement à trois (commande / réception / facture), anomalies, validation pour paiement (écriture comptable), règlement. */

const FILTERS = [['', 'Toutes'], ['blocked', 'Bloquées'], ['matched', 'Rapprochées'], ['approved', 'Validées'], ['entered', 'Saisies']];
const ISSUE = { no_order: 'Sans bon de commande', duplicate: 'Doublon', not_received: 'Facturé plus que reçu', over_ordered: 'Plus que commandé', price_gap: 'Écart de prix', extra_line: 'Ligne hors commande', vat_gap: 'TVA différente', total_mismatch: 'Total différent', order_status: 'Bon non approuvé' };
const PAYST = { unpaid: ['À payer', 'mid'], partial: ['Payée en partie', 'mid'], paid: ['Payée', 'good'] };

export default function Invoices({ focus, onFocused }) {
  const t = useT();
  const { oapi, money, dateFr, modal } = useWs();
  const [status, setStatus] = useState('');
  const st = useLoad(() => oapi('GET', '/purchasing/invoices' + (status ? '?status=' + status : '')), [status]);
  const j = st.data;
  const open = (id) => modal(t('Facture fournisseur'), (close) => <InvoiceDetail id={id} close={close} onChange={st.reload} />, { wide: true });
  const add = (orderId) => modal(t('Saisir une facture fournisseur'), (close) => <InvoiceForm orderId={orderId} close={close} onSaved={(id) => { st.reload(); open(id); }} />, { wide: true });
  useEffect(() => {
    if (!focus) return;
    if (String(focus).startsWith('new:')) add(Number(String(focus).slice(4))); else open(focus);
    onFocused();
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ws-card">
      <div className="row"><h2 className="grow">{t('Factures fournisseurs')}</h2><button className="btn primary small" type="button" onClick={() => add()}>{t('Saisir une facture')}</button></div>
      <p className="muted small">{t('Chaque facture est rapprochée du bon de commande et des réceptions. Une anomalie la bloque tant qu\'elle n\'est pas corrigée ou acceptée avec un motif.')}</p>
      <div className="pur-filters" role="group" aria-label={t('Filtrer par état')}>
        {FILTERS.map(([k, l]) => <button key={k} type="button" className={'btn small' + (status === k ? ' primary' : '')} aria-pressed={status === k} onClick={() => setStatus(k)}>{t(l)}{j && k && j.counts[k] ? ' (' + j.counts[k] + ')' : ''}</button>)}
      </div>
      {j ? <p className="muted small">{t('Restant à payer : {amount}', { amount: money(j.toPay) })}{j.overdue ? ' · ' : ''}{j.overdue ? <b className="late">{t('{n} en retard de paiement', { n: j.overdue })}</b> : null}</p> : null}
      {st.loading && !j ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {j && !j.invoices.length ? <Empty text={t('Aucune facture fournisseur.')} /> : null}
      {j ? j.invoices.map((v) => (
        <div className="line" key={v.id}>
          <span><b>{v.number}</b> · {v.supplier} · {v.supplierRef}<br /><small>{dateFr(v.invoiceDate)} · {t('échéance {date}', { date: dateFr(v.dueDate) })}{v.orderNumber ? ' · ' + v.orderNumber : ''}{v.issues.length ? ' · ' : ''}{v.issues.length ? <b className="late">{t('{n} anomalie(s)', { n: v.issues.length })}</b> : null}</small></span>
          <span className="row"><b>{money(v.totalTtc)}</b><Pill map={INV_STATUS} k={v.status} />{v.paymentStatus ? <Pill map={PAYST} k={v.paymentStatus} /> : null}<button className="btn small" type="button" onClick={() => open(v.id)}>{t('Ouvrir')}</button></span>
        </div>
      )) : null}
    </div>
  );
}

function InvoiceForm({ orderId, pre, close, onSaved }) {
  const t = useT();
  const { oapi, toast, today } = useWs();
  const sup = useSuppliers();
  const ords = useLoad(() => oapi('GET', '/purchasing/orders').then((j) => j.orders.filter((o) => ['approved', 'sent', 'partial', 'received', 'closed'].includes(o.status))), []);
  const f = useFormState({ orderId: pre ? String(pre.orderId || '') : orderId ? String(orderId) : '', supplierId: pre ? String(pre.supplierId) : '', supplierRef: pre ? pre.supplierRef : '', invoiceDate: pre ? pre.invoiceDate : today(), dueDate: pre ? pre.dueDate : '', vatRate: pre ? String(pre.vatRate) : '19.25', declaredTotal: pre && pre.declaredTotal ? String(pre.declaredTotal) : '', expenseAccount: pre ? pre.expenseAccount : '601', notes: pre ? pre.notes : '' });
  const [lines, setLines] = useState(pre ? pre.lines.map((l) => ({ ...blankLine(), orderLineId: l.orderLineId, description: l.description, quantity: String(l.quantity), price: String(l.unitPrice) })) : [blankLine()]);
  const chooseOrder = async (id) => {
    f.setV((s) => ({ ...s, orderId: id }));
    if (!id) return;
    try {
      const d = await oapi('GET', '/purchasing/orders/' + id + '/invoice-draft');
      f.setV((s) => ({ ...s, orderId: id, supplierId: String(d.supplierId), vatRate: String(d.vatRate) }));
      setLines(d.lines.length ? d.lines.map((l) => ({ ...blankLine(), orderLineId: l.orderLineId, description: l.description, unit: l.unit, quantity: String(l.quantity), price: String(l.unitPrice) })) : [blankLine()]);
    } catch (e) { f.setErr(e.message); }
  };
  useEffect(() => { if (orderId && !pre) chooseOrder(String(orderId)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const withOrder = Boolean(f.v.orderId);
  const submit = () => f.run(async () => {
    const body = { orderId: f.v.orderId ? Number(f.v.orderId) : null, supplierId: f.v.supplierId ? Number(f.v.supplierId) : undefined, supplierRef: f.v.supplierRef, invoiceDate: f.v.invoiceDate, dueDate: f.v.dueDate || undefined, vatRate: num(f.v.vatRate), declaredTotal: f.v.declaredTotal ? num(f.v.declaredTotal) : null, expenseAccount: f.v.expenseAccount, notes: f.v.notes,
      lines: lines.map((l) => ({ orderLineId: l.orderLineId || undefined, description: l.description, quantity: num(l.quantity), unitPrice: num(l.price) })) };
    const r = pre ? await oapi('PUT', '/purchasing/invoices/' + pre.id, body).then(() => ({ id: pre.id })) : await oapi('POST', '/purchasing/invoices', body);
    toast(pre ? t('Facture modifiée.') : t('Facture saisie : {n}', { n: r.number || '' }));
    close(); onSaved(r.id);
  });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="pur-grid">
        <Field label={t('Bon de commande')} hint={t('Choisissez-le pour pré-remplir les lignes reçues et pas encore facturées.')}>
          <select value={f.v.orderId} onChange={(e) => chooseOrder(e.target.value)} disabled={Boolean(pre)}><option value="">{t('Sans bon de commande')}</option>{(ords.data || []).map((o) => <option key={o.id} value={o.id}>{o.number} · {o.supplier}</option>)}</select></Field>
        <Field label={t('Fournisseur')}><select value={f.v.supplierId} onChange={f.set('supplierId')} disabled={withOrder || Boolean(pre)}><option value="">{t('— Choisir —')}</option>{(sup.data ? sup.data.suppliers : []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label={t('N° de la facture du fournisseur')}><input type="text" value={f.v.supplierRef} maxLength={60} onChange={f.set('supplierRef')} /></Field>
        <Field label={t('Date de la facture')}><input type="date" max={today()} value={f.v.invoiceDate} onChange={f.set('invoiceDate')} /></Field>
        <Field label={t('Échéance')} hint={t('Vide : selon les conditions de paiement.')}><input type="date" value={f.v.dueDate} onChange={f.set('dueDate')} /></Field>
        <Field label={t('TVA (%)')}><input type="text" inputMode="decimal" value={f.v.vatRate} onChange={f.set('vatRate')} /></Field>
        <Field label={t('Total TTC annoncé par le fournisseur')} hint={t('Facultatif : sert à détecter un écart de calcul.')}><input type="text" inputMode="numeric" value={f.v.declaredTotal} onChange={f.set('declaredTotal')} /></Field>
        <Field label={t('Compte de charge')} hint={t('601 achats de marchandises, 605 travaux et services, 622 honoraires…')}><input type="text" inputMode="numeric" value={f.v.expenseAccount} maxLength={6} onChange={f.set('expenseAccount')} /></Field>
      </div>
      <h3>{t('Lignes de la facture (prix hors taxe)')}</h3>
      {withOrder ? <p className="muted small">{t('Les lignes liées au bon de commande sont rapprochées de ce qui a été reçu.')}</p> : null}
      <LinesEditor noItem lines={lines} setLines={setLines} items={[]} priceLabel={t('Prix unitaire HT')} priceRequired />
      <Field label={t('Notes')} wide><input type="text" value={f.v.notes} maxLength={500} onChange={f.set('notes')} /></Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{pre ? t('Enregistrer et rapprocher') : t('Saisir et rapprocher')}</button></div>
    </form>
  );
}

function InvoiceDetail({ id, close, onChange }) {
  const t = useT();
  const { oapi, money, dateFr, can, modal, toast, fail, confirm } = useWs();
  const st = useLoad(() => oapi('GET', '/purchasing/invoices/' + id), [id]);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <Failed e={st.error} />;
  const v = st.data.invoice;
  const refresh = () => { st.reload(); onChange(); };
  const approve = () => {
    if (v.status === 'blocked') reasonModal(modal, t, { title: t('Valider malgré les anomalies'), label: t('Pourquoi acceptez-vous cette facture malgré les anomalies ?'), submit: t('Valider pour paiement'), onSubmit: (reason) => oapi('POST', '/purchasing/invoices/' + id + '/approve', { override: true, overrideReason: reason }).then((r) => { toast(t('Facture validée, écriture {number} passée.', { number: r.entry })); refresh(); }) });
    else oapi('POST', '/purchasing/invoices/' + id + '/approve', {}).then((r) => { toast(t('Facture validée, écriture {number} passée.', { number: r.entry })); refresh(); }).catch(fail);
  };
  const unapprove = () => reasonModal(modal, t, { title: t('Annuler la validation'), label: t("Motif de l'annulation"), submit: t('Annuler la validation'), onSubmit: (reason) => oapi('POST', '/purchasing/invoices/' + id + '/unapprove', { reason }).then(() => { toast(t('Validation annulée : écriture inverse passée.')); refresh(); }) });
  const pay = () => modal(t('Régler la facture'), (c) => <PayForm v={v} close={c} onDone={() => { c(); refresh(); }} />);
  const edit = () => modal(t('Modifier la facture'), (c) => <InvoiceForm pre={v} close={c} onSaved={() => { st.reload(); onChange(); }} />, { wide: true });
  return (
    <div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}><h3 className="grow">{v.number} · {v.supplier}</h3><Pill map={INV_STATUS} k={v.status} />{v.paymentStatus ? <Pill map={PAYST} k={v.paymentStatus} /> : null}</div>
      <p className="muted small">{t('Facture {ref} du {date}', { ref: v.supplierRef, date: dateFr(v.invoiceDate) })} · {t('échéance {date}', { date: dateFr(v.dueDate) })}{v.orderNumber ? ' · ' + v.orderNumber : ''}{v.entry ? ' · ' + t('écriture {number}', { number: v.entry }) : ''}</p>
      {v.issues.length ? (
        <div className="pur-issues" role="alert">
          <b>{t('Anomalies du rapprochement')}</b>
          {v.issues.map((i, k) => <p key={k}>⚠ <b>{t(ISSUE[i.code] || i.code)}</b> : {i.message}</p>)}
        </div>
      ) : v.status === 'matched' ? <p className="ok">{t('Rapprochement conforme : quantités, prix et totaux concordent avec la commande et les réceptions.')}</p> : null}
      {v.overrideReason ? <p className="muted small">{t('Validée malgré les anomalies : {reason}', { reason: v.overrideReason })}</p> : null}
      <div className="pur-table-wrap">
        <table className="pur-table">
          <thead><tr><th>{t('Désignation')}</th><th>{t('Commandé')}</th><th>{t('Reçu')}</th><th>{t('Déjà facturé')}</th><th>{t('Cette facture')}</th><th>{t('Prix')}</th></tr></thead>
          <tbody>{v.matching.map((l, k) => <tr key={k}><td>{l.description}</td><td>{l.ordered === undefined ? '—' : l.ordered}</td><td>{l.received === undefined ? '—' : l.received}</td><td>{l.invoicedBefore === undefined ? '—' : l.invoicedBefore}</td><td>{l.quantity}</td><td>{money(l.unitPrice)}{l.orderPrice !== undefined && l.orderPrice !== l.unitPrice ? <small className="late"> ({t('commande : {price}', { price: money(l.orderPrice) })})</small> : null}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="line"><span>{t('Total HT')}</span><b>{money(v.totalHt)}</b></div>
      <div className="line"><span>{t('TVA {rate} %', { rate: v.vatRate })}</span><b>{money(v.vatAmount)}</b></div>
      <div className="line"><b>{t('Total TTC')}</b><b>{money(v.totalTtc)}</b></div>
      {v.payments && v.payments.length ? <><h3>{t('Règlements')}</h3>{v.payments.map((p, k) => <div className="line" key={k}><span>{dateFr(p.date)}<small> · {p.method}{p.reference ? ' · ' + p.reference : ''}</small></span><b>{money(p.amount)}</b></div>)}<div className="line"><b>{t('Reste à payer')}</b><b>{money(v.balance)}</b></div></> : null}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {['entered', 'matched', 'blocked'].includes(v.status) ? <><button className="btn" type="button" onClick={() => oapi('POST', '/purchasing/invoices/' + id + '/match', {}).then(refresh).catch(fail)}>{t('Relancer le rapprochement')}</button><button className="btn" type="button" onClick={edit}>{t('Modifier')}</button></> : null}
        {['matched', 'blocked'].includes(v.status) && can('admin') ? <button className="btn primary" type="button" onClick={approve}>{v.status === 'blocked' ? t('Valider malgré les anomalies') : t('Valider pour paiement')}</button> : null}
        {['matched', 'blocked'].includes(v.status) && !can('admin') ? <span className="muted small">{t('La validation pour paiement est réservée à un administrateur.')}</span> : null}
        {v.canPay && can('admin') ? <button className="btn primary" type="button" onClick={pay}>{t('Régler')}</button> : null}
        {v.status === 'approved' && v.paid === 0 && can('admin') ? <button className="btn" type="button" onClick={unapprove}>{t('Annuler la validation')}</button> : null}
        {['entered', 'matched', 'blocked'].includes(v.status) ? <button className="btn" type="button" onClick={() => confirm(t('Annuler cette facture ?'), () => oapi('DELETE', '/purchasing/invoices/' + id).then(() => { close(); onChange(); }).catch(fail), t('Annuler la facture'))}>{t('Annuler la facture')}</button> : null}
      </div>
    </div>
  );
}

function PayForm({ v, close, onDone }) {
  const t = useT();
  const { oapi, today, toast, money } = useWs();
  const f = useFormState({ amount: String(v.balance), method: 'bank', date: today(), reference: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => { const r = await oapi('POST', '/purchasing/invoices/' + v.id + '/pay', { amount: num(f.v.amount), method: f.v.method, date: f.v.date, reference: f.v.reference }); toast(t('Règlement enregistré, écriture {number}.', { number: r.entry })); onDone(); }); }}>
      <p className="muted small">{t('Reste à payer : {amount}', { amount: money(v.balance) })}</p>
      <Field label={t('Montant (FCFA)')}><input type="text" inputMode="numeric" value={f.v.amount} onChange={f.set('amount')} /></Field>
      <Field label={t('Payé avec')}><select value={f.v.method} onChange={f.set('method')}><option value="bank">{t('Banque')}</option><option value="mobile">{t('Mobile money')}</option><option value="cash">{t('Espèces')}</option></select></Field>
      <Field label={t('Date')}><input type="date" max={today()} value={f.v.date} onChange={f.set('date')} /></Field>
      <Field label={t('Référence du paiement')}><input type="text" maxLength={80} value={f.v.reference} onChange={f.set('reference')} /></Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{t('Enregistrer le règlement')}</button><button className="btn" type="button" onClick={close}>{t('Annuler')}</button></div>
    </form>
  );
}
