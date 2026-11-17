import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { FormFoot, LinesEditor, Seg, Tag, WMS, cleanRows, itemOptions, qty, useDate, useItems, useLocations, useRows, locOptions } from './kit.jsx';

/* Kits et assemblage : un kit est une nomenclature (la même que dans la Production) : un article fini et ses composants.
   L'ordre d'assemblage met les composants de côté, puis les consomme (emplacements de l'entrepôt, lots FEFO) et fait entrer le kit à son
   coût réel (composants + main-d'œuvre). Le désassemblage fait l'inverse. */
const ST = { planned: ['Planifié', 'mid'], done: ['Terminé', 'good'], cancelled: ['Annulé', 'bad'] };

function NewKit({ close, done }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const items = useItems();
  const [rows, setRows] = useRows();
  const [v, setV] = useState({ productId: '', laborCost: '', notes: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    oapi('POST', WMS + '/kits', { productId: v.productId ? Number(v.productId) : undefined, lines: cleanRows(rows), laborCost: v.laborCost, notes: v.notes })
      .then((j) => { close(); done(j); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(tsrv(x.message)); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <label className="fld"><span>{t('Article fini (le kit)')}</span><select style={{ fontSize: 16 }} value={v.productId} onChange={(e) => setV({ ...v, productId: e.target.value })}>{itemOptions(items.items, t('Choisir…')).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
        <small>{t('Créez d\'abord l\'article du kit dans « Articles et commandes ».')}</small></label>
      <h3>{t('Composants pour un kit')}</h3>
      <LinesEditor items={items.items} rows={rows} setRows={setRows} addText={t('Ajouter un composant')} />
      <label className="fld"><span>{t('Main-d\'œuvre par kit (facultatif)')}</span><input type="text" inputMode="decimal" style={{ fontSize: 16 }} value={v.laborCost} onChange={(e) => setV({ ...v, laborCost: e.target.value })} /></label>
      <label className="fld"><span>{t('Remarque (facultatif)')}</span><input type="text" style={{ fontSize: 16 }} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></label>
      <FormFoot busy={busy} err={err} text={t('Créer le kit')} />
    </form>
  );
}

function KitList() {
  const t = useT();
  const { oapi, can, money, fail, confirm, modal, toast } = useWs();
  const mgr = can('manager');
  const st = useLoad(() => oapi('GET', WMS + '/kits'), []);
  return (
    <>
      {mgr ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t('Nouveau kit'), (close) => <NewKit close={close} done={() => { toast(t('Kit créé.')); st.reload(); }} />, { wide: true })}>{t('Nouveau kit')}</button></div> : null}
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.kits.length ? <Empty text={t('Aucun kit : décrivez un article fini et ses composants (les nomenclatures de la Production servent aussi).')} /> : null}
          {j.kits.map((k) => (
            <div className="line" key={k.id}>
              <span><b>{k.product}</b> {k.kit ? <Tag tone="good">{t('kit')}</Tag> : <Tag tone="mid">{t('nomenclature de production')}</Tag>}
                <small>{' ' + k.components.map((c) => qty(c.quantity) + ' ' + c.unit + ' ' + c.name).join(' + ')}</small>
                <small>{' · ' + t('{n} réalisable(s) avec le stock disponible', { n: k.buildable }) + (k.unitCost !== undefined ? ' · ' + t('coût estimé {c}', { c: money(k.unitCost) }) : '')}</small></span>
              {mgr && k.kit ? <button className="link" type="button" onClick={() => confirm(t('Supprimer ce kit ?'), () => oapi('DELETE', WMS + '/kits/' + k.id).then(st.reload).catch(fail))}>{t('Supprimer')}</button> : null}
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}

function NewOrder({ close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const kits = useLoad(() => oapi('GET', WMS + '/kits'), []);
  const whs = useLoad(() => oapi('GET', WMS + '/overview'), []);
  const locs = useLocations();
  return (
    <Loaded state={kits}>{(j) => (
      <Form submitText={t("Créer l'ordre")} fields={[
        { k: 'kind', label: t('Opération'), type: 'select', options: [['assembly', t('Assemblage (composants → kit)')], ['disassembly', t('Désassemblage (kit → composants)')]] },
        { k: 'bomId', label: t('Kit'), type: 'select', options: [['', t('Choisir…')]].concat(j.kits.map((k) => [String(k.id), k.product + ' · ' + t('{n} réalisable(s)', { n: k.buildable })])), required: true },
        { k: 'quantity', label: t('Quantité de kits'), required: true },
        { k: 'warehouseId', label: t('Entrepôt'), type: 'select', options: [['', t('Tous (emplacements utilisables)')]].concat((whs.data ? whs.data.warehouses : []).map((w) => [String(w.id), w.name])) },
        { k: 'locationId', label: t('Emplacement de sortie (facultatif)'), type: 'select', options: locOptions(locs.locations, t('Selon les règles de rangement'), true) },
        { k: 'note', label: t('Remarque (facultatif)') }]}
      onSubmit={(v) => oapi('POST', WMS + '/kit-orders', { kind: v.kind, bomId: Number(v.bomId), quantity: v.quantity, warehouseId: v.warehouseId ? Number(v.warehouseId) : undefined, locationId: v.locationId ? Number(v.locationId) : undefined, note: v.note }).then((r) => { close(); done(r); })} />
    )}</Loaded>
  );
}

/** Exécution : quantité, main-d'œuvre (responsable), lot du kit, numéros de série des articles suivis par série. */
function Complete({ o, close, done }) {
  const t = useT();
  const { oapi, can } = useWs();
  const serialItems = o.components.filter((c) => c.tracking === 'serial');
  const lotItems = o.kind === 'disassembly' ? o.components.filter((c) => c.tracking === 'lot') : [];
  return (
    <Form submitText={o.kind === 'assembly' ? t("Assembler") : t('Désassembler')} fields={[
      { k: 'quantity', label: t('Quantité de kits'), value: String(o.remaining) },
      ...(can('manager') ? [{ k: 'laborCost', label: t('Main-d\'œuvre totale (facultatif)'), hint: t('Vide : celle prévue au kit.') }] : []),
      ...(o.kind === 'assembly' ? [{ k: 'lotNo', label: t('Lot du kit (facultatif)'), hint: t('Vide : le code de l\'ordre.') }] : []),
      { k: 'serials', label: o.kind === 'assembly' ? t('Numéros de série des kits (s\'ils sont suivis par série)') : t('Numéros de série des kits défaits (s\'ils sont suivis par série)'), type: 'textarea', rows: 2 },
      ...serialItems.map((c) => ({ k: 's' + c.itemId, label: t('Numéros de série : {n}', { n: c.name }), type: 'textarea', rows: 2 })),
      ...lotItems.map((c) => ({ k: 'l' + c.itemId, label: t('Lot récupéré : {n} (facultatif)', { n: c.name }) }))]}
    onSubmit={(v) => {
      const componentSerials = {}; const componentLots = {};
      serialItems.forEach((c) => { if (v['s' + c.itemId]) componentSerials[c.itemId] = v['s' + c.itemId]; });
      lotItems.forEach((c) => { if (v['l' + c.itemId]) componentLots[c.itemId] = v['l' + c.itemId]; });
      return oapi('POST', WMS + '/kit-orders/' + o.id + '/complete', { quantity: v.quantity, laborCost: v.laborCost || undefined, lotNo: v.lotNo || undefined, serials: v.serials || undefined, componentSerials, componentLots }).then((r) => { close(); done(r); });
    }} />
  );
}

function OrderDetail({ id, back }) {
  const t = useT();
  const { oapi, can, money, modal, toast, fail, confirm } = useWs();
  const date = useDate();
  const st = useLoad(() => oapi('GET', WMS + '/kit-orders/' + id), []);
  return (
    <Loaded state={st}>{({ order: o }) => (
      <div className="wms-run">
        <div className="row" style={{ justifyContent: 'space-between' }}><h2>{o.code}</h2><button className="btn small" type="button" onClick={back}>{t('Retour')}</button></div>
        <p><Tag tone={ST[o.status][1]}>{t(ST[o.status][0])}</Tag> <small className="muted">{[t(o.kindLabel), o.product + ' × ' + qty(o.quantity), o.doneQty ? t('{n} fait(s)', { n: qty(o.doneQty) }) : '', o.warehouse, o.location, o.lotNo && t('lot {x}', { x: o.lotNo }), o.doneAt && date(o.doneAt.slice(0, 10))].filter(Boolean).join(' · ')}</small></p>
        {o.status === 'planned' ? (
          <div className="ws-card"><b>{o.kind === 'assembly' ? t('Composants à prendre') : t('Kits à défaire')}</b>
            {o.inputs.map((x) => (
              <div className="line" key={x.itemId}>
                <span><b>{x.name}</b> {x.short ? <Tag tone="bad">{t('manque {q}', { q: qty(x.short) })}</Tag> : <Tag tone="good">{t('disponible')}</Tag>}
                  <small>{' ' + qty(x.need) + ' ' + x.unit + ' · ' + x.plan.map((p) => p.code + ' × ' + qty(p.quantity)).join(', ')}</small>
                  {x.lots.length ? <small className="muted">{' · ' + t('lots (FEFO) : {l}', { l: x.lots.map((l) => l.lotNo + (l.expiry ? ' ' + date(l.expiry) : '') + ' × ' + qty(l.quantity)).join(', ') })}</small> : null}</span>
              </div>
            ))}
          </div>
        ) : null}
        {o.consumed.length ? (
          <details className="ws-card"><summary>{t('Consommé ({n} lignes)', { n: o.consumed.length })}</summary>
            {o.consumed.map((c, i) => <div className="line" key={i}><span><b>{c.name}</b><small>{' ' + [c.location, c.lots.map((l) => t('lot {x}', { x: l.lotNo }) + ' × ' + qty(l.quantity)).join(', '), c.serials.join(', ')].filter(Boolean).join(' · ')}</small></span><span>{qty(c.quantity) + ' ' + c.unit}{c.cost !== undefined ? ' · ' + money(c.cost) : ''}</span></div>)}
          </details>
        ) : null}
        {o.totalCost !== undefined && o.doneQty ? <p className="small">{t('Coût réel : matières {m} + main-d\'œuvre {l} = {tot} ({u} par kit)', { m: money(o.materialCost), l: money(o.laborCost || 0), tot: money(o.totalCost), u: money(o.unitCost) })}</p> : null}
        {o.status === 'planned' ? (
          <div className="row wms-toolbar">
            <button className="btn primary" type="button" onClick={() => modal(o.kind === 'assembly' ? t('Assembler {code}', { code: o.code }) : t('Désassembler {code}', { code: o.code }), (close) => <Complete o={o} close={close} done={(r) => { toast(r.done ? t('Ordre terminé.') : t('{n} kit(s) traité(s).', { n: qty(r.quantity) })); st.reload(); }} />)}>{o.kind === 'assembly' ? t('Assembler') : t('Désassembler')}</button>
            {can('manager') ? <button className="link" type="button" onClick={() => confirm(t('Annuler cet ordre ? Les composants mis de côté sont libérés.'), () => oapi('POST', WMS + '/kit-orders/' + o.id + '/cancel', {}).then(st.reload).catch(fail))}>{t("Annuler l'ordre")}</button> : null}
          </div>
        ) : null}
      </div>
    )}</Loaded>
  );
}

function Orders() {
  const t = useT();
  const { oapi, can, modal, toast } = useWs();
  const date = useDate();
  const [f, setF] = useState('planned');
  const [open, setOpen] = useState(null);
  const st = useLoad(() => oapi('GET', WMS + '/kit-orders' + (f ? '?status=' + f : '')), [f]);
  if (open) return <OrderDetail id={open} back={() => { setOpen(null); st.reload(); }} />;
  return (
    <>
      {can('manager') ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t("Nouvel ordre d'assemblage"), (close) => <NewOrder close={close} done={(r) => { toast(r.short.length ? t('Ordre {code} créé : composants manquants ({list}).', { code: r.code, list: r.short.map((s) => s.name + ' ' + qty(s.missing)).join(', ') }) : t('Ordre {code} créé : composants mis de côté.', { code: r.code })); setOpen(r.id); }} />)}>{t('Nouvel ordre')}</button></div> : null}
      <Seg tabs={[['planned', t('Planifiés')], ['done', t('Terminés')], ['', t('Tous')]]} value={f} onChange={setF} />
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.orders.length ? <Empty text={t("Aucun ordre d'assemblage.")} /> : null}
          {j.orders.map((o) => (
            <div className="line" key={o.id}>
              <span><b>{o.code}</b> <Tag tone={ST[o.status][1]}>{t(ST[o.status][0])}</Tag><small>{' ' + [t(o.kindLabel), o.product + ' × ' + qty(o.quantity), o.unitCost !== undefined && o.doneQty ? t('{u} par kit', { u: qty(o.unitCost) }) : '', date(o.createdAt.slice(0, 10))].filter(Boolean).join(' · ')}</small></span>
              <button className="btn small" type="button" onClick={() => setOpen(o.id)}>{o.status === 'planned' ? (o.kind === 'assembly' ? t('Assembler') : t('Désassembler')) : t('Ouvrir')}</button>
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}

export default function Kits() {
  const t = useT();
  const [tab, setTab] = useState('orders');
  return (
    <>
      <Seg tabs={[['orders', t("Ordres d'assemblage")], ['kits', t('Kits')]]} value={tab} onChange={setTab} />
      {tab === 'orders' ? <Orders /> : <KitList />}
    </>
  );
}
