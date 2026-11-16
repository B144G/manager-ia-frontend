import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { Failed, Field, LinesEditor, Pill, RFQ_STATUS, blankLine, linesPayload, reasonModal, useFormState, useItems, useSuppliers, num } from './common.jsx';

/* Appels d'offres : consulter plusieurs fournisseurs, saisir leurs devis, comparer, attribuer (le bon de commande est généré). */

export default function Rfqs({ openOrder }) {
  const t = useT();
  const { oapi, money, dateFr, modal } = useWs();
  const st = useLoad(() => oapi('GET', '/purchasing/rfqs'), []);
  const j = st.data;
  const open = (id) => modal(t("Appel d'offres"), (close) => <RfqDetail id={id} close={close} onChange={st.reload} openOrder={openOrder} />, { wide: true });
  const add = () => modal(t("Nouvel appel d'offres"), (close) => <RfqForm close={close} onSaved={(id) => { st.reload(); open(id); }} />, { wide: true });
  return (
    <div className="ws-card">
      <div className="row"><h2 className="grow">{t("Appels d'offres")}</h2><button className="btn primary small" type="button" onClick={add}>{t("Lancer un appel d'offres")}</button></div>
      <p className="muted small">{t("Consultez plusieurs fournisseurs, saisissez leurs devis, comparez, puis attribuez : le bon de commande est généré avec les prix retenus.")}</p>
      {j ? <p><b>{t('Économies obtenues : {amount}', { amount: money(j.savings) })}</b></p> : null}
      {st.loading && !j ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {j && !j.rfqs.length ? <Empty text={t("Aucun appel d'offres pour l'instant.")} /> : null}
      {j ? j.rfqs.map((r) => (
        <div className="line" key={r.id}>
          <span><b>{r.number}</b> · {r.title}<br /><small>{t('{q} devis reçu(s) sur {n} fournisseur(s)', { q: r.quotesCount, n: r.suppliersCount })}{r.deadline ? ' · ' + t('avant le {date}', { date: dateFr(r.deadline) }) : ''}{r.late ? ' · ' : ''}{r.late ? <b className="late">{t('Date limite dépassée')}</b> : null}{r.status === 'awarded' ? ' · ' + t('économie {amount}', { amount: money(r.savings) }) : ''}</small></span>
          <span className="row"><Pill map={RFQ_STATUS} k={r.status} /><button className="btn small" type="button" onClick={() => open(r.id)}>{t('Ouvrir')}</button></span>
        </div>
      )) : null}
    </div>
  );
}

function RfqForm({ close, onSaved }) {
  const t = useT();
  const { oapi, toast, today } = useWs();
  const items = useItems();
  const sup = useSuppliers();
  const f = useFormState({ title: '', deadline: '', category: '', notes: '' });
  const [ids, setIds] = useState([]);
  const [lines, setLines] = useState([blankLine()]);
  const list = sup.data ? sup.data.suppliers.filter((s) => !s.blocked) : [];
  const toggle = (id) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (!f.v.title.trim()) throw new Error(t("Donnez un titre à l'appel d'offres."));
      if (!ids.length) throw new Error(t('Choisissez au moins un fournisseur à consulter.'));
      const r = await oapi('POST', '/purchasing/rfqs', { title: f.v.title, deadline: f.v.deadline || undefined, category: f.v.category, notes: f.v.notes, supplierIds: ids, lines: linesPayload(lines, 'refPrice') });
      toast(t("Appel d'offres {number} lancé.", { number: r.number })); close(); onSaved(r.id);
    }); }}>
      <Field label={t('Titre')}><input type="text" value={f.v.title} maxLength={150} onChange={f.set('title')} placeholder={t('Ex. Ciment pour le lot 2')} /></Field>
      <div className="pur-grid">
        <Field label={t('Date limite des devis')}><input type="date" min={today()} value={f.v.deadline} onChange={f.set('deadline')} /></Field>
        <Field label={t('Catégorie de budget')}><input type="text" value={f.v.category} maxLength={60} onChange={f.set('category')} /></Field>
      </div>
      <h3>{t('Fournisseurs consultés')}</h3>
      <div className="pur-checks">{list.map((s) => <label key={s.id} className="pur-check"><input type="checkbox" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} /> {s.name}{s.stats.score ? <small> · {s.stats.score}/5</small> : null}</label>)}</div>
      {!list.length ? <p className="muted small">{t("Ajoutez d'abord des fournisseurs dans l'écran Fournisseurs.")}</p> : null}
      <h3>{t('Ce que vous demandez')}</h3>
      <LinesEditor lines={lines} setLines={setLines} items={items} priceLabel={t('Prix de référence')} />
      <p className="muted small">{t("Le prix de référence (facultatif) sert à mesurer l'économie obtenue.")}</p>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{t("Lancer l'appel d'offres")}</button></div>
    </form>
  );
}

function RfqDetail({ id, close, onChange, openOrder }) {
  const t = useT();
  const { oapi, money, dateFr, modal, toast, fail, confirm } = useWs();
  const st = useLoad(() => oapi('GET', '/purchasing/rfqs/' + id), [id]);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <Failed e={st.error} />;
  const r = st.data.rfq; const c = r.comparison;
  const refresh = () => { st.reload(); onChange(); };
  const quote = (s) => modal(t('Devis de {name}', { name: s.name }), (cl) => <QuoteForm rfq={r} s={s} close={cl} onSaved={refresh} />, { wide: true });
  const award = (s) => {
    const isLowest = c.recommended === s.supplierId;
    const go = (reason) => oapi('POST', '/purchasing/rfqs/' + id + '/award', { supplierId: s.supplierId, reason }).then((res) => { toast(t('Attribué : bon de commande créé en brouillon (économie {amount}).', { amount: money(res.savings) })); refresh(); if (openOrder) { close(); openOrder(res.orderId); } });
    if (isLowest) confirm(t('Attribuer à {name} pour {amount} HT ?', { name: s.name, amount: money(s.total) }), () => go('').catch(fail), t('Attribuer'));
    else reasonModal(modal, t, { title: t('Attribuer à {name}', { name: s.name }), label: t("Pourquoi ne pas retenir l'offre la moins chère ?"), submit: t('Attribuer'), onSubmit: go });
  };
  const cancel = () => reasonModal(modal, t, { title: t("Annuler l'appel d'offres"), label: t('Motif'), submit: t('Annuler'), onSubmit: (reason) => oapi('POST', '/purchasing/rfqs/' + id + '/cancel', { reason }).then(() => { toast(t("Appel d'offres annulé.")); refresh(); }) });
  const open = r.status === 'open';
  return (
    <div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}><h3 className="grow">{r.number} · {r.title}</h3><Pill map={RFQ_STATUS} k={r.status} /></div>
      {r.deadline ? <p className="muted small">{t('Date limite : {date}', { date: dateFr(r.deadline) })}</p> : null}
      <div className="pur-table-wrap">
        <table className="pur-table">
          <thead><tr><th>{t('Désignation')}</th><th>{t('Quantité')}</th><th>{t('Référence')}</th>{c.suppliers.map((s) => <th key={s.supplierId}>{s.name}{c.recommended === s.supplierId ? <small className="ok"> ★</small> : null}</th>)}</tr></thead>
          <tbody>
            {c.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td>{l.quantity} {l.unit}</td><td>{l.refPrice ? money(l.refPrice) : '—'}</td>{c.suppliers.map((s) => <td key={s.supplierId} className={l.bestSuppliers.includes(s.supplierId) ? 'ok' : ''}>{s.prices[l.id] ? money(s.prices[l.id]) : '—'}</td>)}</tr>)}
            <tr><th colSpan={3}>{t('Total HT')}</th>{c.suppliers.map((s) => <th key={s.supplierId}>{s.total !== null ? money(s.total) : s.status === 'declined' ? t('Décliné') : s.status === 'quoted' ? t('Incomplet') : t('En attente')}</th>)}</tr>
            <tr><td colSpan={3}>{t('Livraison (jours)')}</td>{c.suppliers.map((s) => <td key={s.supplierId}>{s.deliveryDays === null ? '—' : s.deliveryDays}{c.fastest === s.supplierId ? ' ⚡' : ''}</td>)}</tr>
            <tr><td colSpan={3}>{t('Paiement (jours)')}</td>{c.suppliers.map((s) => <td key={s.supplierId}>{s.paymentDays === null ? '—' : s.paymentDays}</td>)}</tr>
            <tr><td colSpan={3}>{t('Conditions')}</td>{c.suppliers.map((s) => <td key={s.supplierId}><small>{s.terms || '—'}{s.expired ? ' · ' : ''}{s.expired ? <b className="late">{t('Devis expiré')}</b> : null}</small></td>)}</tr>
            {open ? <tr><td colSpan={3} /> {c.suppliers.map((s) => <td key={s.supplierId}><div className="pur-stack"><button className="btn small" type="button" onClick={() => quote(s)}>{s.status === 'quoted' ? t('Modifier le devis') : t('Saisir le devis')}</button>{s.total !== null && !s.expired ? <button className="btn primary small" type="button" onClick={() => award(s)}>{t('Attribuer')}</button> : null}</div></td>)}</tr> : null}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t('★ moins cher · ⚡ plus rapide · prix en vert : meilleur prix de la ligne.')}{c.baseline ? ' ' + t('Référence pour mesurer l\'économie : {amount}.', { amount: money(c.baseline) }) : ''}</p>
      {r.status === 'awarded' ? <p className="ok">{t('Attribué pour {amount} HT, économie {savings}.', { amount: money(r.awardedTotal), savings: money(r.savings) })}{r.awardReason ? ' ' + t('Motif : {reason}', { reason: r.awardReason }) : ''}</p> : null}
      {r.status === 'awarded' && r.orderId && openOrder ? <div className="row"><button className="btn" type="button" onClick={() => { close(); openOrder(r.orderId); }}>{t('Ouvrir le bon de commande')}</button></div> : null}
      {open ? <div className="row"><button className="btn" type="button" onClick={cancel}>{t("Annuler l'appel d'offres")}</button></div> : null}
    </div>
  );
}

function QuoteForm({ rfq, s, close, onSaved }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const c = rfq.comparison;
  const f = useFormState({ deliveryDays: s.deliveryDays === null ? '' : String(s.deliveryDays), paymentDays: s.paymentDays === null ? '' : String(s.paymentDays), terms: s.terms || '', validUntil: s.validUntil || '', note: s.note || '', prices: Object.fromEntries(c.lines.map((l) => [l.id, s.prices[l.id] ? String(s.prices[l.id]) : ''])) });
  const save = (declined) => f.run(async () => {
    const body = declined ? { declined: true, note: f.v.note } : { deliveryDays: f.v.deliveryDays === '' ? undefined : num(f.v.deliveryDays), paymentDays: f.v.paymentDays === '' ? undefined : num(f.v.paymentDays), terms: f.v.terms, validUntil: f.v.validUntil || undefined, note: f.v.note, lines: c.lines.filter((l) => f.v.prices[l.id]).map((l) => ({ rfqLineId: l.id, unitPrice: num(f.v.prices[l.id]) })) };
    await oapi('PUT', '/purchasing/rfqs/' + rfq.id + '/quotes/' + s.supplierId, body);
    toast(declined ? t('Fournisseur marqué comme ayant décliné.') : t('Devis enregistré.')); close(); onSaved();
  });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); save(false); }}>
      <h3>{t('Prix unitaires hors taxe')}</h3>
      {c.lines.map((l) => <Field key={l.id} label={l.description + ' (' + l.quantity + ' ' + l.unit + ')'}><input type="text" inputMode="numeric" value={f.v.prices[l.id]} onChange={(e) => f.setV((x) => ({ ...x, prices: { ...x.prices, [l.id]: e.target.value } }))} /></Field>)}
      <div className="pur-grid">
        <Field label={t('Délai de livraison (jours)')}><input type="text" inputMode="numeric" value={f.v.deliveryDays} onChange={f.set('deliveryDays')} /></Field>
        <Field label={t('Délai de paiement (jours)')}><input type="text" inputMode="numeric" value={f.v.paymentDays} onChange={f.set('paymentDays')} /></Field>
        <Field label={t("Devis valable jusqu'au")}><input type="date" value={f.v.validUntil} onChange={f.set('validUntil')} /></Field>
      </div>
      <Field label={t('Conditions')} wide><input type="text" value={f.v.terms} maxLength={500} onChange={f.set('terms')} placeholder={t('Franco chantier, acompte 30 %…')} /></Field>
      <Field label={t('Remarque')} wide><input type="text" value={f.v.note} maxLength={500} onChange={f.set('note')} /></Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row" style={{ flexWrap: 'wrap' }}><button className="btn primary" type="submit" disabled={f.busy}>{t('Enregistrer le devis')}</button><button className="btn" type="button" disabled={f.busy} onClick={() => save(true)}>{t('Ce fournisseur décline')}</button></div>
    </form>
  );
}
