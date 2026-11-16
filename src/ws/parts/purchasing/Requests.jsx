import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { Failed, Field, LinesEditor, Pill, REQ_STATUS, blankLine, linesPayload, reasonModal, useFormState, useItems, useSuppliers, num } from './common.jsx';

/* Demandes d'achat : tout membre demande ; un responsable ou plus approuve selon le montant (seuils réglés par l'administrateur). */

const FILTERS = [['', 'Toutes'], ['submitted', 'À approuver'], ['draft', 'Brouillons'], ['approved', 'Approuvées'], ['rejected', 'Refusées'], ['ordered', 'Commandées']];

export default function Requests({ openOrder }) {
  const t = useT();
  const { oapi, money, dateFr, can, modal } = useWs();
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(!can('manager'));
  const st = useLoad(() => oapi('GET', '/purchasing/requests?' + (status ? 'status=' + status + '&' : '') + (mine ? 'mine=1' : '')), [status, mine]);
  const j = st.data;
  const open = (id) => modal(t("Demande d'achat"), (close) => <RequestDetail id={id} close={close} onChange={st.reload} openOrder={openOrder} />, { wide: true });
  const add = () => modal(t("Nouvelle demande d'achat"), (close) => <RequestForm close={close} onSaved={() => { st.reload(); }} />, { wide: true });
  return (
    <div className="ws-card">
      <div className="row"><h2 className="grow">{t("Demandes d'achat")}</h2><button className="btn primary small" type="button" onClick={add}>{t('Nouvelle demande')}</button></div>
      <p className="muted small">{t("Décrivez ce dont vous avez besoin : un responsable l'approuve, puis les achats commandent.")}</p>
      <div className="pur-filters" role="group" aria-label={t('Filtrer par état')}>
        {FILTERS.map(([k, l]) => <button key={k} type="button" className={'btn small' + (status === k ? ' primary' : '')} aria-pressed={status === k} onClick={() => setStatus(k)}>{t(l)}{j && k && j.counts[k] ? ' (' + j.counts[k] + ')' : ''}</button>)}
        {can('manager') ? <button type="button" className={'btn small' + (mine ? ' primary' : '')} aria-pressed={mine} onClick={() => setMine(!mine)}>{t('Les miennes')}</button> : null}
      </div>
      {st.loading && !j ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {j && !j.requests.length ? <Empty text={t("Aucune demande pour l'instant.")} /> : null}
      {j ? j.requests.map((r) => (
        <div className="line" key={r.id}>
          <span><b>{r.number}</b> · {r.title}<br /><small>{r.requester} · {dateFr(String(r.createdAt).slice(0, 10))}{r.category ? ' · ' + r.category : ''}{r.neededDate ? ' · ' + t('pour le {date}', { date: dateFr(r.neededDate) }) : ''}</small></span>
          <span className="row"><b>{money(r.total)}</b><Pill map={REQ_STATUS} k={r.status} /><button className="btn small" type="button" onClick={() => open(r.id)}>{t('Ouvrir')}</button></span>
        </div>
      )) : null}
    </div>
  );
}

export function RequestForm({ close, onSaved, pre }) {
  const t = useT();
  const { oapi, toast, today } = useWs();
  const items = useItems();
  const cats = useLoad(() => oapi('GET', '/purchasing/categories').then((j) => j.categories), []);
  const f = useFormState({ title: pre ? pre.title : '', justification: pre ? pre.justification : '', neededDate: '', category: pre ? pre.category : '' });
  const [lines, setLines] = useState(pre ? pre.lines : [blankLine()]);
  const send = (submit) => f.run(async () => {
    if (!f.v.title.trim()) throw new Error(t('Donnez un titre à la demande.'));
    const body = { title: f.v.title, justification: f.v.justification, neededDate: f.v.neededDate || undefined, category: f.v.category, lines: linesPayload(lines, 'estPrice'), submit };
    const r = await oapi('POST', '/purchasing/requests', body);
    toast(submit ? t('Demande {number} envoyée pour approbation.', { number: r.number }) : t('Brouillon {number} enregistré.', { number: r.number }));
    close(); onSaved();
  });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); send(true); }}>
      <Field label={t('Titre')}><input type="text" value={f.v.title} maxLength={150} onChange={f.set('title')} placeholder={t('Ex. Fournitures de bureau')} /></Field>
      <Field label={t('Justification')} hint={t("Pourquoi cet achat est nécessaire : l'approbateur la lira.")}><textarea rows={3} value={f.v.justification} onChange={f.set('justification')} /></Field>
      <div className="pur-grid">
        <Field label={t('Date souhaitée')}><input type="date" min={today()} value={f.v.neededDate} onChange={f.set('neededDate')} /></Field>
        <Field label={t('Catégorie de budget')} hint={t('Pour suivre le budget des achats.')}>
          <input type="text" list="pur-cats" value={f.v.category} maxLength={60} onChange={f.set('category')} />
          <datalist id="pur-cats">{(cats.data || []).map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>
      <h3>{t('Ce que vous demandez')}</h3>
      <LinesEditor lines={lines} setLines={setLines} items={items} priceLabel={t('Prix estimé')} />
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn primary" type="submit" disabled={f.busy}>{t('Envoyer pour approbation')}</button>
        <button className="btn" type="button" disabled={f.busy} onClick={() => send(false)}>{t('Enregistrer en brouillon')}</button>
      </div>
    </form>
  );
}

function RequestDetail({ id, close, onChange, openOrder }) {
  const t = useT();
  const { oapi, money, dateFr, can, modal, toast, fail, confirm } = useWs();
  const st = useLoad(() => oapi('GET', '/purchasing/requests/' + id), [id]);
  const sup = useSuppliers();
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <Failed e={st.error} />;
  const r = st.data.request;
  const done = (msg) => (res) => { if (msg) toast(msg); if (res && res.budgetWarning) toast(t('Attention : le budget « {category} » est dépassé par cet achat.', { category: res.budgetWarning.category }), true); st.reload(); onChange(); };
  const post = (path, body, msg) => oapi('POST', '/purchasing/requests/' + id + path, body || {}).then(done(msg)).catch(fail);
  const approve = () => post('/approve', {}, t('Demande approuvée.'));
  const reject = () => reasonModal(modal, t, { title: t('Refuser la demande'), label: t('Motif du refus'), submit: t('Refuser'), onSubmit: (reason) => oapi('POST', '/purchasing/requests/' + id + '/reject', { reason }).then(done(t('Demande refusée.'))) });
  const toOrder = () => modal(t('Commander'), (c) => <ToOrder r={r} suppliers={sup.data ? sup.data.suppliers.filter((s) => !s.blocked) : []} close={c} onDone={(orderId) => { c(); close(); onChange(); toast(t('Bon de commande créé en brouillon.')); if (openOrder) openOrder(orderId); }} />, { wide: true });
  const cancel = () => confirm(t('Annuler cette demande ?'), () => post('/cancel', {}, t('Demande annulée.')), t('Annuler la demande'));
  return (
    <div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}><h3 className="grow">{r.number} · {r.title}</h3><Pill map={REQ_STATUS} k={r.status} /></div>
      <p className="muted small">{t('Demandée par {name} le {date}', { name: r.requester, date: dateFr(String(r.createdAt).slice(0, 10)) })}{r.neededDate ? ' · ' + t('pour le {date}', { date: dateFr(r.neededDate) }) : ''}{r.category ? ' · ' + r.category : ''}</p>
      {r.justification ? <p>{r.justification}</p> : null}
      {r.lines.map((l) => <div className="line" key={l.id}><span>{l.description}<small> · {l.quantity} {l.unit}</small></span><b>{l.estPrice ? money(l.amount) : '—'}</b></div>)}
      <div className="line"><b>{t('Total estimé')}</b><b>{money(r.total)}</b></div>
      {r.status === 'submitted' ? <p className="muted small">{t("Cette demande doit être approuvée par : {role} ou un rôle supérieur.", { role: t(r.requiredRoleLabel) })}</p> : null}
      {r.budget ? <p className={r.budget.over ? 'late' : 'muted small'}>{t('Budget « {category} » : {planned} prévus, {used} déjà consommés (engagé + facturé), {left} disponibles.', { category: r.budget.category, planned: money(r.budget.planned), used: money(r.budget.engaged + r.budget.invoiced), left: money(r.budget.available) })}</p> : null}
      {r.decider ? <p className="muted small">{t('Décision de {name} le {date}', { name: r.decider, date: dateFr(String(r.decidedAt).slice(0, 10)) })}</p> : null}
      {r.status === 'rejected' ? <p className="late">{t('Motif du refus : {reason}', { reason: r.rejectReason })}</p> : null}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {r.status === 'draft' && r.mine ? <button className="btn primary" type="button" onClick={() => post('/submit', {}, t('Demande envoyée pour approbation.'))}>{t('Envoyer pour approbation')}</button> : null}
        {r.status === 'submitted' && r.mine ? <button className="btn" type="button" onClick={() => post('/withdraw', {}, t('Demande retirée.'))}>{t("Retirer de l'approbation")}</button> : null}
        {r.canApprove ? <><button className="btn primary" type="button" onClick={approve}>{t('Approuver')}</button><button className="btn" type="button" onClick={reject}>{t('Refuser')}</button></> : null}
        {r.status === 'approved' && can('manager') ? <button className="btn primary" type="button" onClick={toOrder}>{t('Créer le bon de commande')}</button> : null}
        {['draft', 'submitted', 'approved'].includes(r.status) && (r.mine || can('admin')) ? <button className="btn" type="button" onClick={cancel}>{t('Annuler la demande')}</button> : null}
        {r.status === 'draft' && (r.mine || can('admin')) ? <button className="btn" type="button" onClick={() => confirm(t('Supprimer ce brouillon ?'), () => oapi('DELETE', '/purchasing/requests/' + id).then(() => { close(); onChange(); }).catch(fail), t('Supprimer'))}>{t('Supprimer')}</button> : null}
        <button className="btn" type="button" onClick={() => oapi('POST', '/purchasing/requests/' + id + '/duplicate', {}).then(() => { toast(t('Copie créée en brouillon.')); close(); onChange(); }).catch(fail)}>{t('Dupliquer')}</button>
      </div>
    </div>
  );
}

function ToOrder({ r, suppliers, close, onDone }) {
  const t = useT();
  const { oapi } = useWs();
  const f = useFormState({ supplierId: suppliers[0] ? String(suppliers[0].id) : '', prices: {} });
  const missing = r.lines.filter((l) => !l.estPrice);
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      const prices = {}; for (const l of missing) { const p = f.v.prices[l.id]; if (p) prices[l.id] = num(p); }
      const res = await oapi('POST', '/purchasing/requests/' + r.id + '/to-order', { supplierId: Number(f.v.supplierId), prices });
      onDone(res.orderId);
    }); }}>
      <Field label={t('Fournisseur')}><select value={f.v.supplierId} onChange={f.set('supplierId')}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      {missing.length ? <p className="muted small">{t("Ces lignes n'ont pas de prix estimé : indiquez le prix unitaire convenu (sauf si le fournisseur a un prix connu pour l'article).")}</p> : null}
      {missing.map((l) => <Field key={l.id} label={l.description}><input type="text" inputMode="numeric" value={f.v.prices[l.id] || ''} onChange={(e) => f.setV((s) => ({ ...s, prices: { ...s.prices, [l.id]: e.target.value } }))} /></Field>)}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy || !f.v.supplierId}>{t('Créer le bon de commande')}</button><button className="btn" type="button" onClick={close}>{t('Annuler')}</button></div>
    </form>
  );
}
