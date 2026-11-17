import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { FormFoot, Kpis, Progress, Seg, Tag, WMS, qty, useDate, useLocations, usePdf } from './kit.jsx';
import Scanner from './Scanner.jsx';
import { VasPanel } from './Vas.jsx';

/* Expéditions : des colis fermés (ou des palettes de colis) regroupés pour un transporteur, avec numéro de suivi et quai ; chaque unité est
   chargée par scan ; la validation sort le stock, crée la livraison dans la Logistique et produit le bon de livraison. */
const ST = { open: ['En préparation', 'mid'], loading: ['Chargement', 'mid'], shipped: ['Expédiée', 'good'], cancelled: ['Annulée', 'bad'] };

function NewShipment({ close, done }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const ready = useLoad(() => oapi('GET', WMS + '/shipments/ready'), []);
  const carriers = useLoad(() => oapi('GET', '/logistics/carriers').catch(() => ({ carriers: [] })), []);
  const locs = useLocations();
  const docks = locs.locations.filter((l) => l.kind === 'shipping' && l.active);
  const [sel, setSel] = useState([]);
  const [v, setV] = useState({ carrierId: '', carrierName: '', tracking: '', dockLocationId: '', dock: '', customerName: '', address: '', plannedDate: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    oapi('POST', WMS + '/shipments', { huIds: sel, carrierId: v.carrierId ? Number(v.carrierId) : undefined, carrierName: v.carrierId ? undefined : v.carrierName, tracking: v.tracking, dockLocationId: v.dockLocationId ? Number(v.dockLocationId) : undefined, dock: v.dock, customerName: v.customerName, address: v.address, plannedDate: v.plannedDate || undefined })
      .then((j) => { close(); done(j); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(tsrv(x.message)); }).finally(() => setBusy(false));
  };
  const field = (k, label, extra = {}) => <label className="fld"><span>{label}</span><input type={extra.type || 'text'} style={{ fontSize: 16 }} value={v[k]} onChange={set(k)} placeholder={extra.placeholder || ''} /></label>;
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <h3>{t('Colis et palettes prêts')}</h3>
      <Loaded state={ready}>{(r) => (
        <>
          {!r.units.length ? <Empty text={t("Aucun colis fermé en attente : terminez d'abord l'emballage.")} /> : null}
          {r.units.map((u) => (
            <label className="row wms-check" key={u.huId}><input type="checkbox" checked={sel.includes(u.huId)} onChange={() => setSel(sel.includes(u.huId) ? sel.filter((x) => x !== u.huId) : sel.concat([u.huId]))} />
              <span><b>{u.code}</b> <small>{[t(u.typeLabel), u.location, u.weight ? qty(u.weight) + ' kg' : '', u.orders.map((o) => [o.documentNumber || o.pickCode, o.customer].filter(Boolean).join(' ')).join(', ')].filter(Boolean).join(' · ')}</small></span></label>
          ))}
        </>
      )}</Loaded>
      <label className="fld"><span>{t('Transporteur')}</span><select style={{ fontSize: 16 }} value={v.carrierId} onChange={set('carrierId')}><option value="">{t('Autre (saisir le nom)')}</option>{(carriers.data ? carriers.data.carriers : []).filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {!v.carrierId ? field('carrierName', t('Nom du transporteur'), { placeholder: t('Votre camion, Express Union…') }) : null}
      {field('tracking', t('Numéro de suivi (facultatif)'))}
      <label className="fld"><span>{t("Quai d'expédition")}</span><select style={{ fontSize: 16 }} value={v.dockLocationId} onChange={set('dockLocationId')}><option value="">{t('Aucun (porte en texte libre)')}</option>{docks.map((l) => <option key={l.id} value={l.id}>{l.code + ' (' + l.warehouse + ')'}</option>)}</select>
        {!docks.length ? <small>{t("Créez un emplacement de type « Quai d'expédition » pour suivre la marchandise à quai.")}</small> : null}</label>
      {!v.dockLocationId ? field('dock', t('Porte ou quai (facultatif)'), { placeholder: t('Porte 2') }) : null}
      {field('customerName', t('Client (repris de la commande si vide)'))}
      {field('address', t('Adresse de livraison (facultatif)'))}
      {field('plannedDate', t('Date prévue (facultatif)'), { type: 'date' })}
      <FormFoot busy={busy} err={err} text={t("Créer l'expédition")} />
    </form>
  );
}

function ShipmentDetail({ id, back }) {
  const t = useT();
  const { oapi, can, modal, toast, fail, confirm } = useWs();
  const pdf = usePdf();
  const date = useDate();
  const mgr = can('manager');
  const st = useLoad(() => oapi('GET', WMS + '/shipments/' + id), []);
  const [err, setErr] = useState(''); const [last, setLast] = useState('');
  const load = (code) => { setErr(''); oapi('POST', WMS + '/shipments/' + id + '/load', { code }).then((j) => { setLast(j.already ? t('{code} déjà chargé.', { code: j.code }) : t('{code} chargé ({l} / {n}).', { code: j.code, l: j.loaded, n: j.units })); st.reload(); }).catch((e) => { if (e && e.status === 401) fail(e); setErr(tsrv(e.message)); }); };
  const addUnit = (code) => { setErr(''); oapi('POST', WMS + '/shipments/' + id + '/units', { code }).then(() => st.reload()).catch((e) => setErr(tsrv(e.message))); };
  const ship = (allowPartial) => oapi('POST', WMS + '/shipments/' + id + '/ship', { allowPartial }).then((j) => { toast(j.deliveryId ? t('Expédition validée : stock sorti, livraison créée dans la Logistique.') : t('Expédition validée : stock sorti.')); st.reload(); }).catch((e) => {
    if (e.status === 409 && !allowPartial && !/^Services obligatoires/.test(e.message || '')) modal(t('Unités non chargées'), (close) => <div><p>{tsrv(e.message)}</p><button className="btn primary" type="button" onClick={() => { close(); ship(true); }}>{t('Expédier sans elles')}</button></div>);
    else fail(e);
  });
  const editTracking = (s) => modal(t('Transport'), (close) => (
    <Form submitText={t('Enregistrer')} fields={s.status === 'shipped' ? [{ k: 'tracking', label: t('Numéro de suivi'), value: s.tracking }] : [
      { k: 'carrierName', label: t('Nom du transporteur'), value: s.carrier || '' }, { k: 'tracking', label: t('Numéro de suivi'), value: s.tracking },
      { k: 'dock', label: t('Porte ou quai (facultatif)'), value: s.dockNote }, { k: 'customerName', label: t('Client'), value: s.customerName }, { k: 'address', label: t('Adresse de livraison (facultatif)'), value: s.address }]}
    onSubmit={(v) => oapi('PUT', WMS + '/shipments/' + id, s.status === 'shipped' ? { tracking: v.tracking } : { ...v, carrierId: v.carrierName !== (s.carrier || '') ? null : undefined }).then(() => { close(); st.reload(); })} />
  ));
  return (
    <Loaded state={st}>{({ shipment: s }) => {
      const open = s.status === 'open' || s.status === 'loading';
      return (
        <div className="wms-run">
          <div className="row" style={{ justifyContent: 'space-between' }}><h2>{s.code}</h2><button className="btn small" type="button" onClick={back}>{t('Retour')}</button></div>
          <p><Tag tone={ST[s.status][1]}>{t(ST[s.status][0])}</Tag> <small className="muted">{[s.customerName, s.documentNumber, s.carrier, s.tracking && t('suivi {x}', { x: s.tracking }), s.dock && t('quai {x}', { x: s.dock }), s.plannedDate && date(s.plannedDate)].filter(Boolean).join(' · ')}</small></p>
          <Kpis list={[{ label: t('unités'), value: String(s.units) }, { label: t('chargées'), value: s.loaded + ' / ' + s.units, bad: open && s.loaded < s.units }, { label: t('poids'), value: s.weight ? qty(s.weight) + ' kg' : '—' }]} />
          <Progress value={s.units ? (100 * s.loaded) / s.units : 0} label={t('Chargement')} />
          {err ? <p className="ws-err" role="alert">{err}</p> : null}
          {last ? <p className="small ok" role="status">{last}</p> : null}
          {open ? (
            <div className="ws-card">
              <Scanner autoFocus label={t('Scanner chaque colis ou palette chargé')} hint={s.dockLocationId ? t('Au scan, l\'unité passe sur le quai {d}.', { d: s.dock }) : ''} onCode={load} />
              <details><summary>{t('Ajouter une unité')}</summary><Scanner label={t('Scanner le colis ou la palette à ajouter')} onCode={addUnit} /></details>
            </div>
          ) : null}
          <div className="ws-card">
            {!s.unitList.length ? <Empty text={t('Aucune unité sur cette expédition.')} /> : null}
            {s.unitList.map((u) => (
              <div className="line" key={u.huId}>
                <span><b>{u.code}</b> {u.loaded ? <Tag tone="good">{t('chargé')}</Tag> : <Tag tone="mid">{t('à charger')}</Tag>}
                  <small>{' ' + [t(u.typeLabel), u.location, u.weight ? qty(u.weight) + ' kg' : '', u.boxes.length > 1 || u.boxes[0]?.id !== u.huId ? t('{n} colis', { n: u.boxes.length }) : '', u.boxes.map((b) => b.pick).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ')].filter(Boolean).join(' · ')}</small></span>
                {open ? <span className="row">
                  {u.loaded ? <button className="link" type="button" onClick={() => oapi('POST', WMS + '/shipments/' + id + '/unload', { huId: u.huId }).then(st.reload).catch(fail)}>{t('Décharger')}</button> : null}
                  <button className="link" type="button" onClick={() => oapi('DELETE', WMS + '/shipments/' + id + '/units/' + u.huId).then(st.reload).catch(fail)}>{t('Retirer')}</button>
                </span> : null}
              </div>
            ))}
          </div>
          <VasPanel refKind="shipment" refId={s.id} />
          {s.lines.length ? (
            <details className="ws-card"><summary>{t('Contenu expédié ({n} lignes)', { n: s.lines.length })}</summary>
              {s.lines.map((l, i) => <div className="line" key={i}><span><b>{l.hu}</b> <small>{l.name}{l.lotNo ? ' · ' + t('lot {x}', { x: l.lotNo }) : ''}</small></span><span>{qty(l.quantity) + ' ' + l.unit}</span></div>)}
            </details>
          ) : null}
          <div className="row wms-toolbar">
            {open && s.dockLocationId ? <button className="btn" type="button" onClick={() => oapi('POST', WMS + '/shipments/' + id + '/stage', {}).then((j) => { toast(t('{n} unité(s) mise(s) à quai.', { n: j.moved })); st.reload(); }).catch(fail)}>{t('Tout mettre à quai')}</button> : null}
            {mgr && open ? <button className="btn primary" type="button" disabled={!s.loaded} onClick={() => ship(false)}>{t("Valider l'expédition")}</button> : null}
            {mgr && s.status !== 'cancelled' ? <button className="btn" type="button" onClick={() => editTracking(s)}>{t('Transport et suivi')}</button> : null}
            <button className="btn" type="button" onClick={() => pdf('/shipments/' + id + '/delivery-note', 'bon-livraison-' + s.code)}>{t('Bon de livraison')}</button>
            {mgr && open ? <button className="link" type="button" onClick={() => confirm(t('Annuler cette expédition ? Les colis restent emballés, prêts pour une autre expédition.'), () => oapi('POST', WMS + '/shipments/' + id + '/cancel', {}).then(back).catch(fail))}>{t("Annuler l'expédition")}</button> : null}
          </div>
          {s.deliveryId ? <p className="muted small">{t('Livraison n° {n} créée dans la Logistique : suivez-la jusqu\'à la remise au client.', { n: s.deliveryId })}</p> : null}
        </div>
      );
    }}</Loaded>
  );
}

export default function Shipments() {
  const t = useT();
  const { oapi, can, modal, toast } = useWs();
  const date = useDate();
  const mgr = can('manager');
  const [f, setF] = useState('');
  const [open, setOpen] = useState(null);
  const st = useLoad(() => oapi('GET', WMS + '/shipments' + (f ? '?status=' + f : '')), [f]);
  if (open) return <ShipmentDetail id={open} back={() => { setOpen(null); st.reload(); }} />;
  const scan = (code) => oapi('GET', WMS + '/scan?code=' + encodeURIComponent(code)).then((r) => { if (r.type === 'shipment') setOpen(r.id); else toast(t("Ce code n'est pas une expédition.")); }).catch((e) => toast(tsrv(e.message)));
  return (
    <>
      {mgr ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t('Nouvelle expédition'), (close) => <NewShipment close={close} done={(j) => { toast(t('Expédition {code} créée.', { code: j.code })); setOpen(j.id); }} />, { wide: true })}>{t('Nouvelle expédition')}</button></div> : null}
      <div className="ws-card"><Scanner label={t('Scanner une expédition (EX-…)')} onCode={scan} /></div>
      <Seg tabs={[['', t('Toutes')], ['open', t('En préparation')], ['loading', t('Chargement')], ['shipped', t('Expédiées')]]} value={f} onChange={setF} />
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.shipments.length ? <Empty text={t('Aucune expédition.')} /> : null}
          {j.shipments.map((s) => (
            <div className="line" key={s.id}>
              <span><b>{s.code}</b> <Tag tone={ST[s.status][1]}>{t(ST[s.status][0])}</Tag>
                <small>{' ' + [s.customerName, s.documentNumber, s.carrier, s.tracking, t('{l} / {n} chargée(s)', { l: s.loaded, n: s.units }), date((s.shippedAt || s.createdAt).slice(0, 10))].filter(Boolean).join(' · ')}</small></span>
              <button className="btn small" type="button" onClick={() => setOpen(s.id)}>{s.status === 'shipped' ? t('Ouvrir') : t('Charger')}</button>
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}
