import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { FormFoot, Kpis, LinesEditor, Seg, Tag, WMS, cleanRows, qty, useDate, useItems, useRows } from './kit.jsx';

/* Transferts entre entrepôts ou emplacements : demande → expédition (en transit) → réception avec écarts. */
const ST = { requested: ['Demandé', 'mid'], shipped: ['En transit', 'mid'], received: ['Reçu', 'good'], cancelled: ['Annulé', 'bad'] };

function NewTransfer({ close, done }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const whs = useLoad(() => oapi('GET', WMS + '/overview'), []);
  const items = useItems();
  const [rows, setRows] = useRows();
  const [v, setV] = useState({ from: '', to: '', note: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const list = whs.data ? whs.data.warehouses.filter((w) => w.active) : [];
  const submit = (e) => {
    e.preventDefault(); setErr('');
    const lines = cleanRows(rows);
    if (!v.from || !v.to) { setErr(t('Choisissez les deux entrepôts.')); return; }
    if (!lines.length) { setErr(t('Ajoutez au moins une ligne.')); return; }
    setBusy(true);
    oapi('POST', WMS + '/transfers', { fromWarehouseId: Number(v.from), toWarehouseId: Number(v.to), note: v.note, lines }).then(() => { close(); done(); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(x.message); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <label className="fld"><span>{t('De (entrepôt)')}</span><select value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })}><option value="">{t('Choisir…')}</option>{list.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label className="fld"><span>{t('Vers (entrepôt)')}</span><select value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })}><option value="">{t('Choisir…')}</option>{list.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <LinesEditor items={items.items} rows={rows} setRows={setRows} />
      <label className="fld"><span>{t('Note (facultatif)')}</span><input type="text" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></label>
      <FormFoot busy={busy} err={err} text={t('Envoyer la demande')} />
    </form>
  );
}

function ReceiveTransfer({ tr, close, done }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const [vals, setVals] = useState(() => Object.fromEntries(tr.lines.filter((l) => l.shippedQty > 0).map((l) => [l.id, { got: String(l.shippedQty), reason: '', serials: '' }])));
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (id, k, x) => setVals((s) => ({ ...s, [id]: { ...s[id], [k]: x } }));
  const submit = (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    oapi('POST', WMS + '/transfers/' + tr.id + '/receive', { lines: Object.entries(vals).map(([id, x]) => ({ lineId: Number(id), receivedQty: x.got, reason: x.reason, serials: x.serials || undefined })) })
      .then((j) => { close(); done(j); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(x.message); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <p className="muted small">{t("Comptez ce qui est arrivé. S'il en manque, indiquez le motif : le manquant est passé en perte et valorisé.")}</p>
      {tr.lines.filter((l) => l.shippedQty > 0).map((l) => {
        const gap = Number(vals[l.id].got) < l.shippedQty - 1e-9;
        return (
          <div className="wms-lrow" key={l.id}>
            <span className="wms-l-item"><b>{l.name}</b><small>{' ' + t('expédié {n} {unit}', { n: qty(l.shippedQty), unit: l.unit })}</small></span>
            <label className="fld wms-l-qty"><span>{t('Reçu')}</span><input type="text" inputMode="decimal" value={vals[l.id].got} onChange={(e) => set(l.id, 'got', e.target.value)} /></label>
            {gap ? <label className="fld wms-l-item"><span>{t('Motif de l\'écart')}</span><input type="text" value={vals[l.id].reason} onChange={(e) => set(l.id, 'reason', e.target.value)} placeholder={t('Casse, vol, erreur de comptage…')} /></label> : null}
            {gap && l.tracking === 'serial' ? <label className="fld wms-l-item"><span>{t('Numéros manquants')}</span><input type="text" value={vals[l.id].serials} onChange={(e) => set(l.id, 'serials', e.target.value)} /></label> : null}
          </div>
        );
      })}
      <FormFoot busy={busy} err={err} text={t('Confirmer la réception')} />
    </form>
  );
}

function Detail({ id }) {
  const t = useT();
  const { oapi, money } = useWs();
  const date = useDate();
  const st = useLoad(() => oapi('GET', WMS + '/transfers/' + id), []);
  return (
    <Loaded state={st}>{({ transfer: x }) => (
      <div>
        <p><b>{x.code}</b> <Tag tone={ST[x.status][1]}>{t(ST[x.status][0])}</Tag></p>
        <p className="muted small">{x.from + ' → ' + x.to}{x.note ? ' · ' + x.note : ''}</p>
        {x.lines.map((l) => (
          <div className="line" key={l.id}>
            <span><b>{l.name}</b><small>{' ' + t('demandé {n}', { n: qty(l.quantity) }) + (l.shippedQty ? ' · ' + t('expédié {n}', { n: qty(l.shippedQty) }) : '') + (x.status === 'received' ? ' · ' + t('reçu {n}', { n: qty(l.receivedQty) }) : '')}</small></span>
            {l.gapQty ? <span className="pill bad">{t('écart {n}', { n: qty(l.gapQty) }) + (l.gapValue !== undefined ? ' · ' + money(l.gapValue) : '') + (l.gapReason ? ' · ' + l.gapReason : '')}</span> : null}
          </div>
        ))}
        <h3>{t('Journal')}</h3>
        {x.journal.map((e, i) => <p className="small" key={i}>{date(e.at.slice(0, 10)) + ' · ' + t({ requested: 'Demandé', shipped: 'Expédié', received: 'Reçu', cancelled: 'Annulé' }[e.action] || e.action) + (e.by ? ' · ' + e.by : '') + (e.note ? ' · ' + e.note : '')}</p>)}
      </div>
    )}
    </Loaded>
  );
}

export default function Transfers() {
  const t = useT();
  const { oapi, can, modal, fail, toast, confirm, money } = useWs();
  const date = useDate();
  const mgr = can('manager');
  const [f, setF] = useState('');
  const st = useLoad(() => oapi('GET', WMS + '/transfers' + (f ? '?status=' + f : '')), [f]);
  const act = (p, msg) => p.then(() => { if (msg) toast(msg); st.reload(); }).catch(fail);
  const detail = (x) => modal(t('Transfert {code}', { code: x.code }), () => <Detail id={x.id} />);
  const receive = (x) => oapi('GET', WMS + '/transfers/' + x.id).then((j) => modal(t('Réception : {code}', { code: x.code }), (close) => (
    <ReceiveTransfer tr={j.transfer} close={close} done={(r) => { st.reload(); toast(r.gapQty ? t('Reçu avec un écart de {n}.', { n: qty(r.gapQty) }) : t('Reçu sans écart.')); }} />
  ))).catch(fail);
  const cancel = (x) => {
    if (x.status === 'requested') confirm(t('Annuler cette demande ?'), () => act(oapi('POST', WMS + '/transfers/' + x.id + '/cancel', {})));
    else modal(t('Annuler en transit'), (close) => <FormReason text={t('La marchandise retourne au départ.')} onSubmit={(reason) => oapi('POST', WMS + '/transfers/' + x.id + '/cancel', { reason }).then(() => { close(); st.reload(); })} />);
  };
  return (
    <>
      <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t('Nouvelle demande de transfert'), (close) => <NewTransfer close={close} done={() => { toast(t('Demande envoyée.')); st.reload(); }} />, { wide: true })}>{t('Nouveau transfert')}</button></div>
      <Seg tabs={[['', t('Tous')], ['requested', t('Demandés')], ['shipped', t('En transit')], ['received', t('Reçus')], ['cancelled', t('Annulés')]]} value={f} onChange={setF} />
      <Loaded state={st}>{(j) => (
        <>
          <Kpis list={[{ label: t('en transit'), value: String(j.inTransit) }, { label: t('transferts'), value: String(j.transfers.length) }]} />
          <div className="ws-card">
            {!j.transfers.length ? <Empty text={t('Aucun transfert.')} /> : null}
            {j.transfers.map((x) => (
              <div className="line" key={x.id}>
                <span><b>{x.code}</b> <Tag tone={ST[x.status][1]}>{t(ST[x.status][0])}</Tag>
                  <small>{' ' + x.from + ' → ' + x.to + ' · ' + t('{n} ligne(s)', { n: x.lineCount }) + ' · ' + date(x.requestedAt.slice(0, 10)) + (x.requestedBy ? ' · ' + x.requestedBy : '')}</small>
                  {x.gapQty ? <Tag tone="bad">{t('écart {n}', { n: qty(x.gapQty) }) + (x.gapValue !== undefined ? ' · ' + money(x.gapValue) : '')}</Tag> : null}</span>
                <span className="row">
                  <button className="link" type="button" onClick={() => detail(x)}>{t('Détail')}</button>
                  {mgr && x.status === 'requested' ? <button className="link" type="button" onClick={() => confirm(t('Expédier {code} ? Le stock passe « en transit ».', { code: x.code }), () => act(oapi('POST', WMS + '/transfers/' + x.id + '/ship', {}), t('Expédié.')))}>{t('Expédier')}</button> : null}
                  {mgr && x.status === 'shipped' ? <button className="link" type="button" onClick={() => receive(x)}>{t('Recevoir')}</button> : null}
                  {(x.status === 'requested' || (mgr && x.status === 'shipped')) ? <button className="link" type="button" onClick={() => cancel(x)}>{t('Annuler')}</button> : null}
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

export function FormReason({ onSubmit, text }) {
  const t = useT();
  const [reason, setReason] = useState(''); const [err, setErr] = useState('');
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); setErr(''); onSubmit(reason).catch((x) => setErr(x.message)); }}>
      {text ? <p className="muted small">{text}</p> : null}
      <label className="fld"><span>{t('Motif')}</span><input type="text" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <FormFoot err={err} text={t('Confirmer')} />
    </form>
  );
}
