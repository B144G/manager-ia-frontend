import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { FormFoot, Kpis, Seg, Tag, WMS, qty, useDate, useItems, useLocations, useRows, locOptions } from './kit.jsx';

/* Retours client, retours fournisseur et mises au rebut : un document numéroté, lié à ses mouvements de stock. */
const ST = { draft: ['Brouillon', 'mid'], done: ['Validé', 'good'], cancelled: ['Annulé', 'bad'] };
const DISP = { restock: 'Remis en stock', quarantine: 'À contrôler', scrap: 'Rebut', to_supplier: 'Rendu au fournisseur' };

function NewReturn({ kind, close, done }) {
  const t = useT();
  const { oapi, can, fail } = useWs();
  const mgr = can('manager');
  const items = useItems(); const locs = useLocations();
  const reasons = useLoad(() => oapi('GET', WMS + '/returns/reasons'), []);
  const sup = useLoad(() => (kind === 'supplier' ? oapi('GET', '/stock/suppliers') : Promise.resolve({ suppliers: [] })), [kind]);
  const cust = useLoad(() => (kind === 'customer' ? oapi('GET', '/crm/customers').catch(() => ({ customers: [] })) : Promise.resolve({ customers: [] })), [kind]);
  const [rows, setRows] = useRows([{ itemId: '', quantity: '', reasonCode: 'other', disposition: kind === 'customer' ? 'restock' : '' }]);
  const [v, setV] = useState({ supplierId: '', customerId: '', documentId: '', reason: '', validate: mgr ? '1' : '0' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const R = reasons.data ? reasons.data.reasons[kind] : {};
  const setRow = (i, k, x) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: x } : r)));
  const submit = (e) => {
    e.preventDefault(); setErr('');
    const lines = rows.filter((r) => r.itemId && String(r.quantity).trim()).map((r) => ({ itemId: Number(r.itemId), quantity: r.quantity, reasonCode: r.reasonCode, disposition: r.disposition || undefined, lotNo: r.lotNo || undefined, serials: r.serials || undefined, locationId: r.locationId ? Number(r.locationId) : undefined }));
    if (!lines.length) { setErr(t('Ajoutez au moins une ligne.')); return; }
    setBusy(true);
    oapi('POST', WMS + '/returns', { kind, lines, supplierId: v.supplierId ? Number(v.supplierId) : undefined, customerId: v.customerId ? Number(v.customerId) : undefined, documentId: v.documentId ? Number(v.documentId) : undefined, reason: v.reason, validate: v.validate === '1' })
      .then(() => { close(); done(); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(x.message); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      {kind === 'supplier' ? <label className="fld"><span>{t('Fournisseur')}</span><select value={v.supplierId} onChange={(e) => setV({ ...v, supplierId: e.target.value })}><option value="">{t('Choisir…')}</option>{(sup.data ? sup.data.suppliers : []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label> : null}
      {kind === 'customer' ? <label className="fld"><span>{t('Client (facultatif)')}</span><select value={v.customerId} onChange={(e) => setV({ ...v, customerId: e.target.value })}><option value="">{t('Aucun')}</option>{(cust.data ? cust.data.customers : []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label> : null}
      {kind === 'customer' ? <label className="fld"><span>{t('Numéro de la commande ou facture (facultatif)')}</span><input type="text" inputMode="numeric" value={v.documentId} onChange={(e) => setV({ ...v, documentId: e.target.value })} placeholder={t('Identifiant du document')} /></label> : null}
      {rows.map((r, i) => {
        const it = items.items.find((x) => String(x.id) === String(r.itemId));
        return (
          <div className="wms-lrow" key={i}>
            <label className="fld wms-l-item"><span>{t('Article')}</span><select value={r.itemId} onChange={(e) => setRow(i, 'itemId', e.target.value)}><option value="">{t('Choisir…')}</option>{items.items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label className="fld wms-l-qty"><span>{t('Quantité')}</span><input type="text" inputMode="decimal" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} /></label>
            <label className="fld wms-l-qty"><span>{t('Motif')}</span><select value={r.reasonCode} onChange={(e) => setRow(i, 'reasonCode', e.target.value)}>{Object.entries(R).map(([k, x]) => <option key={k} value={k}>{t(x)}</option>)}</select></label>
            {kind === 'customer' ? <label className="fld wms-l-qty"><span>{t('Que faire ?')}</span><select value={r.disposition} onChange={(e) => setRow(i, 'disposition', e.target.value)}><option value="restock">{t('Remettre en stock')}</option><option value="quarantine">{t('À contrôler')}</option><option value="scrap">{t('Rebut')}</option></select></label> : null}
            {kind === 'customer' && r.disposition === 'restock' ? <label className="fld wms-l-item"><span>{t('Emplacement')}</span><select value={r.locationId || ''} onChange={(e) => setRow(i, 'locationId', e.target.value)}>{locOptions(locs.locations, t('Automatique'), true).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label> : null}
            {it && it.tracking === 'lot' && kind === 'customer' ? <label className="fld wms-l-qty"><span>{t('N° de lot')}</span><input type="text" value={r.lotNo || ''} onChange={(e) => setRow(i, 'lotNo', e.target.value)} /></label> : null}
            {it && it.tracking === 'serial' ? <label className="fld wms-l-item"><span>{t('Numéros de série')}</span><input type="text" value={r.serials || ''} onChange={(e) => setRow(i, 'serials', e.target.value)} /></label> : null}
            {rows.length > 1 ? <button className="link" type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}>{t('Retirer')}</button> : null}
          </div>
        );
      })}
      <button className="btn small" type="button" onClick={() => setRows(rows.concat([{ itemId: '', quantity: '', reasonCode: 'other', disposition: kind === 'customer' ? 'restock' : '' }]))}>{t('Ajouter une ligne')}</button>
      <label className="fld"><span>{kind === 'scrap' ? t('Explication (obligatoire si le motif est « Autre »)') : t('Explication (facultatif)')}</span><input type="text" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></label>
      {mgr ? <label className="fld"><span>{t('Enregistrement')}</span><select value={v.validate} onChange={(e) => setV({ ...v, validate: e.target.value })}><option value="1">{t('Valider maintenant (le stock bouge)')}</option><option value="0">{t('Brouillon')}</option></select></label> : <p className="muted small">{t('Votre demande sera enregistrée en brouillon : un responsable la validera.')}</p>}
      <FormFoot busy={busy} err={err} text={t('Enregistrer')} />
    </form>
  );
}

function Detail({ id, reload }) {
  const t = useT();
  const { oapi, can, money, fail, modal } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/returns/' + id), []);
  const mgr = can('manager');
  const dispose = (r, l, disposition) => oapi('POST', WMS + '/returns/' + r.id + '/lines/' + l.id + '/dispose', { disposition }).then(() => { st.reload(); reload(); }).catch(fail);
  const credit = (r) => modal(t('Avoir fournisseur'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'amount', label: t('Montant de l\'avoir reçu'), value: r.creditAmount || '', required: true }]}
    onSubmit={(v) => oapi('POST', WMS + '/returns/' + r.id + '/credit', { amount: v.amount }).then(() => { close(); st.reload(); reload(); })} />
  ));
  return (
    <Loaded state={st}>{({ return: r }) => (
      <div>
        <p><b>{r.code}</b> <Tag tone={ST[r.status][1]}>{t(ST[r.status][0])}</Tag> <small className="muted">{t(r.kindLabel)}</small></p>
        <p className="muted small">{[r.customer, r.supplier, r.documentNumber, r.reason].filter(Boolean).join(' · ')}</p>
        {r.lines.map((l) => (
          <div className="line" key={l.id}>
            <span><b>{l.name + ' × ' + qty(l.quantity)}</b><small>{' ' + t(l.reasonLabel || '') + ' · ' + t(DISP[l.final || l.disposition]) + (l.location ? ' · ' + l.location : '')}</small>{l.value !== undefined ? <small>{' · ' + money(l.value)}</small> : null}</span>
            {mgr && r.status === 'done' && l.disposition === 'quarantine' && !l.final ? (
              <span className="row"><button className="btn small primary" type="button" onClick={() => dispose(r, l, 'restock')}>{t('Contrôle OK : remettre en stock')}</button><button className="btn small" type="button" onClick={() => dispose(r, l, 'scrap')}>{t('Mettre au rebut')}</button></span>
            ) : null}
          </div>
        ))}
        {mgr && r.kind === 'supplier' && r.status === 'done' ? <div className="row" style={{ marginTop: 8 }}><span className="muted small">{r.creditAmount ? t('Avoir reçu : {n}', { n: money(r.creditAmount) }) : t('Avoir attendu : {n}', { n: money(r.value) })}</span><button className="btn small" type="button" onClick={() => credit(r)}>{t("Enregistrer l'avoir")}</button></div> : null}
      </div>
    )}
    </Loaded>
  );
}

export default function Returns() {
  const t = useT();
  const { oapi, can, modal, fail, toast, confirm, money } = useWs();
  const date = useDate();
  const mgr = can('manager');
  const [kind, setKind] = useState('');
  const st = useLoad(() => oapi('GET', WMS + '/returns' + (kind ? '?kind=' + kind : '')), [kind]);
  const open = (k) => modal(t({ customer: 'Retour client', supplier: 'Retour fournisseur', scrap: 'Mise au rebut' }[k]), (close) => <NewReturn kind={k} close={close} done={() => { toast(t('Enregistré.')); st.reload(); }} />, { wide: true });
  return (
    <>
      <div className="row wms-toolbar">
        <button className="btn primary small" type="button" onClick={() => open('customer')}>{t('Retour client')}</button>
        <button className="btn small" type="button" onClick={() => open('supplier')}>{t('Retour fournisseur')}</button>
        <button className="btn small" type="button" onClick={() => open('scrap')}>{t('Mise au rebut')}</button>
      </div>
      <Seg tabs={[['', t('Tous')], ['customer', t('Clients')], ['supplier', t('Fournisseurs')], ['scrap', t('Rebuts')]]} value={kind} onChange={setKind} />
      <Loaded state={st}>{(j) => (
        <>
          {j.toDecide ? <Kpis list={[{ label: t('ligne(s) à contrôler'), value: String(j.toDecide), bad: true }]} /> : null}
          <div className="ws-card">
            {!j.returns.length ? <Empty text={t('Aucun retour.')} /> : null}
            {j.returns.map((r) => (
              <div className="line" key={r.id}>
                <span><b>{r.code}</b> <Tag tone={ST[r.status][1]}>{t(ST[r.status][0])}</Tag> <small>{t(r.kindLabel) + ' · ' + [r.customer, r.supplier, r.documentNumber].filter(Boolean).join(' · ') + ' · ' + t('{n} ligne(s)', { n: r.lineCount }) + ' · ' + date(r.createdAt.slice(0, 10))}</small>{r.value !== undefined && r.value ? <small>{' · ' + money(r.value)}</small> : null}{r.pending ? <Tag tone="bad">{t('à contrôler')}</Tag> : null}</span>
                <span className="row">
                  <button className="link" type="button" onClick={() => modal(t('Retour {code}', { code: r.code }), () => <Detail id={r.id} reload={st.reload} />)}>{t('Détail')}</button>
                  {mgr && r.status === 'draft' ? <button className="link" type="button" onClick={() => oapi('POST', WMS + '/returns/' + r.id + '/validate', {}).then(() => { toast(t('Validé.')); st.reload(); }).catch(fail)}>{t('Valider')}</button> : null}
                  {r.status === 'draft' ? <button className="link" type="button" onClick={() => confirm(t('Annuler ce brouillon ?'), () => { oapi('POST', WMS + '/returns/' + r.id + '/cancel', {}).then(st.reload).catch(fail); })}>{t('Annuler')}</button> : null}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      </Loaded>
    </>
  );
}
