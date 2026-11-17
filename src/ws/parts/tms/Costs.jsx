import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Pill, TMS, num, useRun } from './kit.jsx';

/* Coûts et tarifs : grilles tarifaires (zone, tranche de poids, distance, palettes, minimum, surcharge carburant), devis,
   factures des transporteurs rapprochées des livraisons (écarts signalés), validation comptable. */

const yes = (v) => v === 'yes';
export function Rates() {
  const t = useT();
  const { oapi, money, modal, confirm, fail } = useWs();
  const st = useLoad(() => Promise.all([oapi('GET', TMS + '/rates'), oapi('GET', '/logistics/carriers'), oapi('GET', '/logistics/zones')]), []);
  const edit = (c, carriers, zones) => modal(c ? t('Modifier la grille') : t('Nouvelle grille tarifaire'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'name', label: t('Nom'), required: true, value: c && c.name, placeholder: t('Bonabéri 0-200 kg') },
      { k: 'carrierId', label: t('Transporteur'), type: 'select', value: c && c.carrierId ? String(c.carrierId) : '', options: [['', t('Notre flotte')]].concat(carriers.map((x) => [String(x.id), x.name])) },
      { k: 'zoneId', label: t('Zone'), type: 'select', value: c && c.zoneId ? String(c.zoneId) : '', options: [['', t('Toutes les zones')]].concat(zones.map((x) => [String(x.id), x.name])) },
      { k: 'minKg', label: t('Poids à partir de (kg)'), value: c ? c.minKg : 0 }, { k: 'maxKg', label: t("Jusqu'à (kg, exclu ; vide = sans limite)"), value: c && c.maxKg !== null ? c.maxKg : '' },
      { k: 'base', label: t('Prix de base'), value: c ? c.base : '' }, { k: 'perKg', label: t('Prix par kg'), value: c ? c.perKg : '' }, { k: 'perKm', label: t('Prix par km'), value: c ? c.perKm : '' },
      { k: 'perPallet', label: t('Prix par palette'), value: c ? c.perPallet : '' }, { k: 'minCharge', label: t('Minimum de perception'), value: c ? c.minCharge : '' },
      { k: 'fuelPct', label: t('Surcharge carburant (%)'), value: c ? c.fuelPct : '' },
      { k: 'validFrom', label: t('Valable du'), type: 'date', value: c && c.validFrom }, { k: 'validTo', label: t('au'), type: 'date', value: c && c.validTo },
      { k: 'active', label: t('Active'), type: 'select', value: c && !c.active ? 'no' : 'yes', options: [['yes', t('Oui')], ['no', t('Non')]] },
    ]} onSubmit={(v) => oapi(c ? 'PUT' : 'POST', TMS + '/rates' + (c ? '/' + c.id : ''), { ...v, carrierId: v.carrierId || null, zoneId: v.zoneId || null, active: yes(v.active) }).then(() => { close(); st.reload(); })} />
  ), { wide: true });
  const quote = (carriers, zones) => modal(t('Devis de transport'), () => <Quote carriers={carriers} zones={zones} />);
  return (
    <Loaded state={st}>{([j, cj, zj]) => (
      <div className="ws-card">
        <div className="ws-head"><h2>{t('Grilles tarifaires')}</h2><div className="row"><button className="btn" type="button" onClick={() => quote(cj.carriers, zj.zones)}>{t('Calculer un devis')}</button><button className="btn primary" type="button" onClick={() => edit(null, cj.carriers, zj.zones)}>{t('Nouvelle grille')}</button></div></div>
        <p className="small muted">{t('Prix = base + prix au kg × poids + prix au km × distance + prix par palette × palettes ; au moins le minimum ; puis la surcharge carburant. La grille la plus précise (zone exacte, tranche la plus étroite) s\'applique.')}</p>
        {!j.rates.length ? <Empty text={t('Aucune grille. Ajoutez les tarifs de vos transporteurs et de votre flotte : le coût de chaque livraison sera estimé et les factures rapprochées.')} /> : null}
        {j.rates.map((c) => (
          <div className="line" key={c.id}>
            <span><b>{c.name}</b>{!c.active ? <Pill>{t('Inactive')}</Pill> : null}<br /><small>{[c.carrier || t('Notre flotte'), c.zone || t('Toutes les zones'), t('{a} à {b} kg', { a: num(c.minKg), b: c.maxKg === null ? '∞' : num(c.maxKg) }),
              c.base ? t('base {x}', { x: money(c.base) }) : '', c.perKg ? t('{x} / kg', { x: money(c.perKg) }) : '', c.perKm ? t('{x} / km', { x: money(c.perKm) }) : '', c.perPallet ? t('{x} / palette', { x: money(c.perPallet) }) : '', c.minCharge ? t('minimum {x}', { x: money(c.minCharge) }) : '', c.fuelPct ? t('carburant +{x} %', { x: num(c.fuelPct) }) : ''].filter(Boolean).join(' · ')}</small></span>
            <span className="row"><button className="link" type="button" onClick={() => edit(c, cj.carriers, zj.zones)}>{t('Modifier')}</button><button className="link" type="button" onClick={() => confirm(t('Supprimer la grille « {name} » ?', { name: c.name }), () => oapi('DELETE', TMS + '/rates/' + c.id).then(st.reload).catch(fail))}>{t('Supprimer')}</button></span>
          </div>
        ))}
      </div>
    )}</Loaded>
  );
}

function Quote({ carriers, zones }) {
  const t = useT();
  const { oapi, money } = useWs();
  const [q, setQ] = useState(null);
  return (
    <>
      <Form submitText={t('Calculer')} fields={[
        { k: 'carrierId', label: t('Transporteur'), type: 'select', options: [['', t('Notre flotte')]].concat(carriers.map((x) => [String(x.id), x.name])) },
        { k: 'zoneId', label: t('Zone'), type: 'select', options: [['', t('Aucune')]].concat(zones.map((x) => [String(x.id), x.name])) },
        { k: 'weight', label: t('Poids (kg)') }, { k: 'pallets', label: t('Palettes') }, { k: 'km', label: t('Distance (km, vide = selon la zone)') },
      ]} onSubmit={(v) => oapi('POST', TMS + '/rates/quote', { ...v, carrierId: v.carrierId || null, zoneId: v.zoneId || null }).then((j) => setQ(j.quote))} />
      {q ? (
        <div className="tms-quote">
          <div className="line"><span>{t('Grille appliquée')}</span><b>{q.card}</b></div>
          <div className="line"><span>{t('Base')}</span><b>{money(q.base)}</b></div>
          <div className="line"><span>{t('Poids')}</span><b>{money(q.weight)}</b></div>
          <div className="line"><span>{t('Distance ({km} km)', { km: q.km === null ? '?' : num(q.km) })}</span><b>{money(q.distance)}</b></div>
          <div className="line"><span>{t('Palettes')}</span><b>{money(q.pallets)}</b></div>
          {q.minimumApplied ? <div className="line"><span>{t('Minimum de perception appliqué')}</span><b>{money(q.kept)}</b></div> : null}
          <div className="line"><span>{t('Surcharge carburant')}</span><b>{money(q.fuel)}</b></div>
          <div className="line"><span><b>{t('Total')}</b></span><b>{money(q.total)}</b></div>
        </div>
      ) : null}
    </>
  );
}

function NewInvoice({ carriers, close, done }) {
  const t = useT();
  const { oapi, money, today, fail } = useWs();
  const [carrierId, setCarrierId] = useState(carriers[0] ? String(carriers[0].id) : '');
  const [ref, setRef] = useState(''); const [date, setDate] = useState(today()); const [vat, setVat] = useState('');
  const [amounts, setAmounts] = useState({});
  const [extra, setExtra] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const ub = useLoad(() => (carrierId ? oapi('GET', TMS + '/carriers/' + carrierId + '/unbilled') : Promise.resolve({ deliveries: [] })), [carrierId]);
  const submit = (e) => {
    e.preventDefault(); setErr('');
    const lines = Object.entries(amounts).filter(([, a]) => String(a).trim()).map(([id, a]) => ({ deliveryId: Number(id), amount: a }));
    if (String(extra).trim()) lines.push({ label: t('Autres frais'), amount: extra });
    setBusy(true);
    oapi('POST', TMS + '/carrier-invoices', { carrierId: Number(carrierId), ref, date, vat, lines }).then((j) => { close(); done(j.invoice); }).catch((x) => { if (x.status === 401) fail(x); setErr(tsrv(x.message)); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <label className="fld"><span>{t('Transporteur')}</span><select style={{ fontSize: 16 }} value={carrierId} onChange={(e) => { setCarrierId(e.target.value); setAmounts({}); }}>{carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="fld"><span>{t('Numéro de la facture du transporteur')}</span><input type="text" style={{ fontSize: 16 }} value={ref} onChange={(e) => setRef(e.target.value)} /></label>
      <label className="fld"><span>{t('Date')}</span><input type="date" style={{ fontSize: 16 }} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <h3>{t('Livraisons facturées')}</h3>
      <Loaded state={ub}>{(j) => (
        <>
          {!j.deliveries.length ? <Empty text={t('Aucune livraison terminée de ce transporteur à facturer.')} /> : null}
          {j.deliveries.map((d) => (
            <div className="wms-lrow" key={d.id}>
              <span className="wms-l-item"><b>{d.customerName}</b><br /><small>{[d.date, d.weight ? num(d.weight) + ' kg' : '', d.expected === null ? t('aucun tarif') : t('attendu {x}', { x: money(d.expected) })].filter(Boolean).join(' · ')}</small></span>
              <label className="fld wms-l-qty"><span>{t('Montant facturé')}</span><input type="text" inputMode="numeric" style={{ fontSize: 16 }} value={amounts[d.id] || ''} placeholder={d.expected === null ? '' : String(d.expected)} onChange={(e) => setAmounts({ ...amounts, [d.id]: e.target.value })} /></label>
            </div>
          ))}
        </>
      )}</Loaded>
      <label className="fld"><span>{t('Autres frais sur la facture (HT, facultatif)')}</span><input type="text" inputMode="numeric" style={{ fontSize: 16 }} value={extra} onChange={(e) => setExtra(e.target.value)} /></label>
      <label className="fld"><span>{t('TVA facturée')}</span><input type="text" inputMode="numeric" style={{ fontSize: 16 }} value={vat} onChange={(e) => setVat(e.target.value)} /></label>
      <p className="ws-err" role="alert">{err}</p>
      <button className="btn primary" type="submit" disabled={busy}>{t('Enregistrer et rapprocher')}</button>
    </form>
  );
}

function InvoiceDetail({ id, changed }) {
  const t = useT();
  const { oapi, money, dateFr, modal } = useWs();
  const st = useLoad(() => oapi('GET', TMS + '/carrier-invoices/' + id), []);
  const reload = () => { st.reload(); changed(); };
  const [run, busy] = useRun(reload);
  const approve = (inv) => (inv.issues ? modal(t('Valider malgré les écarts'), (close) => (
    <Form submitText={t('Valider quand même')} fields={[{ k: 'note', label: t('Pourquoi ?'), required: true, placeholder: t('Supplément accepté par téléphone…') }]} onSubmit={(v) => oapi('POST', TMS + '/carrier-invoices/' + inv.id + '/approve', { force: true, note: v.note }).then(() => { close(); reload(); })} />
  )) : run(oapi('POST', TMS + '/carrier-invoices/' + inv.id + '/approve', {}), t('Facture validée et comptabilisée.')));
  return (
    <Loaded state={st}>{({ invoice: inv }) => (
      <div>
        <div className="tms-trip-k">
          <span>{t('Facturé HT')}<b>{money(inv.amountHt)}</b></span><span>{t('Attendu')}<b>{money(inv.expected)}</b></span>
          <span>{t('Écart')}<b className={inv.gap > 0 ? 'late' : ''}>{money(inv.gap)}</b></span><span>{t('TVA')}<b>{money(inv.vat)}</b></span><span>{t('Total TTC')}<b>{money(inv.total)}</b></span>
        </div>
        {inv.lines.map((l) => (
          <div className="line" key={l.id}>
            <span><b>{l.customerName || l.label || t('Ligne libre')}</b> <Pill tone={l.flag === 'ok' ? 'good' : l.flag === 'over' || l.flag === 'duplicate' ? 'bad' : 'mid'}>{t(l.flagLabel)}</Pill><br /><small>{[l.date ? dateFr(l.date) : '', l.expected === null ? '' : t('attendu {x}', { x: money(l.expected) }), l.gap ? t('écart {x}', { x: money(l.gap) }) : ''].filter(Boolean).join(' · ')}</small></span>
            <b>{money(l.amount)}</b>
          </div>
        ))}
        {inv.note ? <p className="small">{inv.note}</p> : null}
        <div className="row">
          {inv.status === 'draft' ? <button className="btn" type="button" disabled={busy} onClick={() => run(oapi('POST', TMS + '/carrier-invoices/' + inv.id + '/rematch', {}))}>{t('Rapprocher à nouveau')}</button> : null}
          {inv.status === 'draft' ? <button className="btn primary" type="button" disabled={busy} onClick={() => approve(inv)}>{t('Valider et comptabiliser')}</button> : null}
          {inv.status !== 'cancelled' ? <button className="btn" type="button" disabled={busy} onClick={() => run(oapi('POST', TMS + '/carrier-invoices/' + inv.id + '/cancel', {}), t('Facture annulée.'))}>{t('Annuler la facture')}</button> : null}
        </div>
      </div>
    )}</Loaded>
  );
}

export function CarrierInvoices() {
  const t = useT();
  const { oapi, money, dateFr, modal } = useWs();
  const st = useLoad(() => Promise.all([oapi('GET', TMS + '/carrier-invoices'), oapi('GET', '/logistics/carriers')]), []);
  const open = (i) => modal(t('Facture {ref} · {carrier}', { ref: i.ref, carrier: i.carrier }), () => <InvoiceDetail id={i.id} changed={st.reload} />, { wide: true });
  return (
    <Loaded state={st}>{([j, cj]) => (
      <div className="ws-card">
        <div className="ws-head"><h2>{t('Factures des transporteurs')}</h2>{cj.carriers.length ? <button className="btn primary" type="button" onClick={() => modal(t('Nouvelle facture de transporteur'), (close) => <NewInvoice carriers={cj.carriers} close={close} done={(inv) => { st.reload(); open(inv); }} />, { wide: true })}>{t('Saisir une facture')}</button> : null}</div>
        <p className="small muted">{t('Chaque ligne est comparée au coût attendu (grille du transporteur) : au-delà de la tolérance, l\'écart est signalé, comme les doublons, les livraisons non livrées ou confiées à un autre transporteur. La validation passe l\'écriture d\'achat (612, 4454, 401).')}</p>
        {!j.invoices.length ? <Empty text={cj.carriers.length ? t('Aucune facture saisie.') : t("Ajoutez d'abord vos transporteurs (Ressources › Transporteurs).")} /> : null}
        {j.invoices.map((i) => (
          <button type="button" className="line tms-rowbtn" key={i.id} onClick={() => open(i)}>
            <span><b>{i.ref}</b> <Pill tone={i.status === 'approved' ? 'good' : i.status === 'cancelled' ? 'bad' : 'mid'}>{t(i.statusLabel)}</Pill>{i.issues && i.status === 'draft' ? <Pill tone="bad">{t('{n} écart(s)', { n: i.issues })}</Pill> : null}
              <br /><small>{[i.number, i.carrier, dateFr(i.date), t('attendu {x}', { x: money(i.expected) })].join(' · ')}</small></span>
            <b>{money(i.amountHt)}</b>
          </button>
        ))}
      </div>
    )}</Loaded>
  );
}
