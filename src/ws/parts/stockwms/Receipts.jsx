import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { FormFoot, Kpis, LinesEditor, Tag, WMS, qty, useDate, useItems, useLocations, useRows, locOptions } from './kit.jsx';

/* Réceptions multi-lignes et coûts d'arrivée (transport, douane, manutention…) répartis sur les lignes et incorporés au coût moyen pondéré. */
function NewReceipt({ close, done }) {
  const t = useT();
  const { oapi, fail, money, info } = useWs();
  const items = useItems(); const locs = useLocations();
  const kinds = useLoad(() => oapi('GET', WMS + '/receipts/kinds'), []);
  const sup = useLoad(() => oapi('GET', '/stock/suppliers'), []);
  const [rows, setRows] = useRows([{ itemId: '', quantity: '', unitCost: '', weight: '', lotNo: '', expiry: '', serials: '' }]);
  const [costs, setCosts] = useState([]);
  const [v, setV] = useState({ supplierId: '', reference: '', locationId: '' });
  const [prev, setPrev] = useState(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const lines = () => rows.filter((r) => r.itemId && String(r.quantity).trim()).map((r) => ({ itemId: Number(r.itemId), quantity: r.quantity, unitCost: r.unitCost || 0, weight: r.weight || undefined, lotNo: r.lotNo || undefined, expiry: r.expiry || undefined, serials: r.serials || undefined }));
  const cl = () => costs.filter((c) => String(c.amount).trim()).map((c) => ({ kind: c.kind, label: c.label, amount: c.amount, basis: c.basis }));
  const preview = () => { setErr(''); oapi('POST', WMS + '/receipts/preview', { lines: lines(), costs: cl() }).then(setPrev).catch((x) => setErr(x.message)); };
  const submit = (e) => {
    e.preventDefault(); setErr('');
    if (!lines().length) { setErr(t('Ajoutez au moins une ligne.')); return; }
    setBusy(true);
    oapi('POST', WMS + '/receipts', { supplierId: v.supplierId ? Number(v.supplierId) : undefined, reference: v.reference, locationId: v.locationId ? Number(v.locationId) : undefined, lines: lines(), costs: cl() })
      .then((j) => { close(); done(j); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(x.message); }).finally(() => setBusy(false));
  };
  const setCost = (i, k, x) => setCosts(costs.map((c, j) => (j === i ? { ...c, [k]: x } : c)));
  const KINDS = kinds.data ? kinds.data.costKinds : {}; const BASES = kinds.data ? kinds.data.bases : {};
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <label className="fld"><span>{t('Fournisseur (facultatif)')}</span><select style={{ fontSize: 16 }} value={v.supplierId} onChange={(e) => setV({ ...v, supplierId: e.target.value })}><option value="">{t('Aucun')}</option>{(sup.data ? sup.data.suppliers : []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="fld"><span>{t('Bon de livraison ou facture (facultatif)')}</span><input type="text" style={{ fontSize: 16 }} value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} /></label>
      <label className="fld"><span>{t('Emplacement de réception')}</span><select style={{ fontSize: 16 }} value={v.locationId} onChange={(e) => setV({ ...v, locationId: e.target.value })}>{locOptions(locs.locations, t('Automatique (règles de rangement)'), true).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
      <h3>{t('Marchandises reçues')}</h3>
      <LinesEditor items={items.items} rows={rows} setRows={setRows} addText={t('Ajouter une ligne')}
        extra={[{ k: 'unitCost', label: t('Prix unitaire'), numeric: true }, { k: 'weight', label: t('Poids unitaire (kg)'), numeric: true }, { k: 'lotNo', label: t('N° de lot') }, { k: 'expiry', label: t('Péremption (AAAA-MM-JJ)') }, { k: 'serials', label: t('N° de série') }]} />
      <h3>{t("Coûts d'arrivée")}</h3>
      <p className="muted small">{t("Transport, douane, manutention… Ils sont répartis sur les lignes et ajoutés au coût moyen de chaque article.")}</p>
      {costs.map((c, i) => (
        <div className="wms-lrow" key={i}>
          <label className="fld wms-l-qty"><span>{t('Type')}</span><select style={{ fontSize: 16 }} value={c.kind} onChange={(e) => setCost(i, 'kind', e.target.value)}>{Object.entries(KINDS).map(([k, x]) => <option key={k} value={k}>{t(x)}</option>)}</select></label>
          <label className="fld wms-l-qty"><span>{t('Montant ({currency})', { currency: info.org.currency })}</span><input type="text" inputMode="numeric" style={{ fontSize: 16 }} value={c.amount} onChange={(e) => setCost(i, 'amount', e.target.value)} /></label>
          <label className="fld wms-l-qty"><span>{t('Répartir selon')}</span><select style={{ fontSize: 16 }} value={c.basis} onChange={(e) => setCost(i, 'basis', e.target.value)}>{Object.entries(BASES).map(([k, x]) => <option key={k} value={k}>{t(x)}</option>)}</select></label>
          <label className="fld wms-l-item"><span>{t('Libellé (facultatif)')}</span><input type="text" style={{ fontSize: 16 }} value={c.label} onChange={(e) => setCost(i, 'label', e.target.value)} /></label>
          <button className="link" type="button" onClick={() => setCosts(costs.filter((_, j) => j !== i))}>{t('Retirer')}</button>
        </div>
      ))}
      <div className="row"><button className="btn small" type="button" onClick={() => setCosts(costs.concat([{ kind: 'transport', amount: '', basis: 'value', label: '' }]))}>{t("Ajouter un coût d'arrivée")}</button>
        {costs.length ? <button className="btn small" type="button" onClick={preview}>{t('Voir la répartition')}</button> : null}</div>
      {prev ? (
        <div className="ws-card">
          <h3>{t('Répartition')}</h3>
          {prev.lines.map((l, i) => <div className="line" key={i}><span><b>{l.name}</b><small>{' ' + t('{n} × {price}', { n: qty(l.quantity), price: money(l.unitCost) })}</small></span><span><b>{t('coût de revient {price}', { price: money(l.landedUnit) })}</b><small>{' (+' + money(l.landedTotal) + ')'}</small></span></div>)}
          <p className="small">{t('Marchandises {a} + coûts {b}', { a: money(prev.baseValue), b: money(prev.landedCost) })}</p>
        </div>
      ) : null}
      <FormFoot busy={busy} err={err} text={t('Enregistrer la réception')} />
    </form>
  );
}

function Detail({ id, reload }) {
  const t = useT();
  const { oapi, money, modal } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/receipts/' + id), []);
  const kinds = useLoad(() => oapi('GET', WMS + '/receipts/kinds'), []);
  const add = () => modal(t("Ajouter un coût d'arrivée"), (close) => (
    <Form submitText={t('Ajouter')} fields={[
      { k: 'kind', label: t('Type'), type: 'select', options: Object.entries(kinds.data.costKinds).map(([k, x]) => [k, t(x)]) },
      { k: 'amount', label: t('Montant'), required: true },
      { k: 'basis', label: t('Répartir selon'), type: 'select', options: Object.entries(kinds.data.bases).map(([k, x]) => [k, t(x)]) },
      { k: 'label', label: t('Libellé (facultatif)'), placeholder: t('Facture du transitaire') }]}
    onSubmit={(v) => oapi('POST', WMS + '/receipts/' + id + '/costs', v).then(() => { close(); st.reload(); reload(); })} />
  ));
  return (
    <Loaded state={st}>{({ receipt: r }) => (
      <div>
        <p><b>{r.code}</b> <small className="muted">{[r.supplier, r.reference].filter(Boolean).join(' · ')}</small></p>
        <Kpis list={[{ label: t('marchandises'), value: money(r.baseValue) }, { label: t("coûts d'arrivée"), value: money(r.landedCost) }, { label: t('incorporé au coût moyen'), value: money(r.incorporated) }, ...(r.expensed ? [{ label: t('déjà sorti : à passer en charge'), value: money(r.expensed) }] : [])]} />
        {r.lines.map((l) => <div className="line" key={l.id}><span><b>{l.name + ' × ' + qty(l.quantity)}</b><small>{' ' + t('prix {a} · coût de revient {b}', { a: money(l.unitCost), b: money(l.landedUnit) })}</small></span><small>{money(l.baseValue + l.landedTotal)}</small></div>)}
        <h3>{t("Coûts d'arrivée")}</h3>
        {!r.costs.length ? <Empty text={t("Aucun coût d'arrivée.")} /> : null}
        {r.costs.map((c) => <div className="line" key={c.id}><span><b>{t(c.kindLabel)}</b><small>{(c.label ? ' ' + c.label : '') + ' · ' + t('réparti selon la {x}', { x: t(c.basisLabel).toLowerCase() })}</small></span><span><b>{money(c.amount)}</b>{c.expensed ? <small>{' ' + t('dont {n} déjà sorti', { n: money(c.expensed) })}</small> : null}</span></div>)}
        {kinds.data ? <button className="btn small" type="button" style={{ marginTop: 8 }} onClick={add}>{t("Ajouter un coût d'arrivée")}</button> : null}
      </div>
    )}
    </Loaded>
  );
}

export default function Receipts() {
  const t = useT();
  const { oapi, modal, toast, money } = useWs();
  const date = useDate();
  const st = useLoad(() => oapi('GET', WMS + '/receipts'), []);
  return (
    <>
      <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t('Nouvelle réception'), (close) => <NewReceipt close={close} done={(j) => { toast(j && j.crossDock && j.crossDock.length ? t('Réception enregistrée : {n} transbordement(s) vers les commandes qui attendent (écran Transbordement).', { n: j.crossDock.length }) : t('Réception enregistrée.')); st.reload(); }} />, { wide: true })}>{t('Nouvelle réception')}</button></div>
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.receipts.length ? <Empty text={t('Aucune réception enregistrée ici.')} /> : null}
          {j.receipts.map((r) => (
            <div className="line" key={r.id}>
              <span><b>{r.code}</b> <small>{[r.supplier, r.reference].filter(Boolean).join(' · ') + ' · ' + t('{n} ligne(s)', { n: r.lineCount }) + ' · ' + date(r.createdAt.slice(0, 10))}</small>{r.landedCost ? <Tag tone="mid">{t("frais d'arrivée {n}", { n: money(r.landedCost) })}</Tag> : null}</span>
              <span className="row"><b>{money(r.totalValue)}</b><button className="link" type="button" onClick={() => modal(t('Réception {code}', { code: r.code }), () => <Detail id={r.id} reload={st.reload} />, { wide: true })}>{t('Détail')}</button></span>
            </div>
          ))}
        </div>
      )}
      </Loaded>
      <p className="muted small">{t("La réception d'une commande d'achat reste dans « Articles et commandes ». Pour lui ajouter des frais de transport ou de douane, utilisez le bouton ci-dessous.")}</p>
      <PurchaseCosts reload={st.reload} />
    </>
  );
}

/** Rattacher des frais d'arrivée à des réceptions de commandes d'achat déjà passées en stock. */
function PurchaseCosts({ reload }) {
  const t = useT();
  const { oapi, modal, toast } = useWs();
  const kinds = useLoad(() => oapi('GET', WMS + '/receipts/kinds'), []);
  const open = () => oapi('GET', WMS + '/receipts/purchase-candidates').then((c) => modal(t("Frais d'arrivée sur commande"), (close) => (
    <PurchaseForm cands={c.receipts} kinds={kinds.data} close={close} done={() => { toast(t("Frais d'arrivée rattachés.")); reload(); }} />
  )));
  return kinds.data ? <button className="btn small" type="button" onClick={open}>{t("Frais d'arrivée sur commande")}</button> : null;
}
function PurchaseForm({ cands, kinds, close, done }) {
  const t = useT();
  const { oapi, money, fail } = useWs();
  const date = useDate();
  const [sel, setSel] = useState({}); const [v, setV] = useState({ kind: 'transport', amount: '', basis: 'value', label: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const ids = Object.keys(sel).filter((k) => sel[k]).map(Number);
  const submit = (e) => {
    e.preventDefault(); setErr('');
    if (!ids.length) { setErr(t('Cochez au moins une réception.')); return; }
    setBusy(true);
    oapi('POST', WMS + '/receipts/from-purchase', { purchaseReceiptIds: ids, costs: [{ kind: v.kind, amount: v.amount, basis: v.basis, label: v.label }] }).then(() => { close(); done(); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(x.message); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      {!cands.length ? <Empty text={t("Aucune réception de commande à rattacher.")} /> : null}
      {cands.map((c) => (
        <label className="line wms-check" key={c.id}>
          <input type="checkbox" checked={!!sel[c.id]} onChange={(e) => setSel({ ...sel, [c.id]: e.target.checked })} />
          <span><b>{c.item + ' × ' + qty(c.quantity)}</b><small>{' ' + (c.supplier || '') + ' · ' + t('commande n° {n}', { n: c.orderId }) + ' · ' + date(c.at.slice(0, 10)) + ' · ' + money(c.unitPrice)}</small></span>
        </label>
      ))}
      <label className="fld"><span>{t('Type')}</span><select style={{ fontSize: 16 }} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>{Object.entries(kinds.costKinds).map(([k, x]) => <option key={k} value={k}>{t(x)}</option>)}</select></label>
      <label className="fld"><span>{t('Montant')}</span><input type="text" inputMode="numeric" style={{ fontSize: 16 }} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></label>
      <label className="fld"><span>{t('Répartir selon')}</span><select style={{ fontSize: 16 }} value={v.basis} onChange={(e) => setV({ ...v, basis: e.target.value })}>{Object.entries(kinds.bases).filter(([k]) => k !== 'weight').map(([k, x]) => <option key={k} value={k}>{t(x)}</option>)}</select></label>
      <label className="fld"><span>{t('Libellé (facultatif)')}</span><input type="text" style={{ fontSize: 16 }} value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} /></label>
      <FormFoot busy={busy} err={err} text={t('Rattacher')} />
    </form>
  );
}
