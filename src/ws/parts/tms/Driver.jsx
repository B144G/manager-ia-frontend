import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Fa } from '../../../lib/fa.jsx';
import SignaturePad from './SignaturePad.jsx';
import { DEL_TONE, Pill, REASONS, TMS, TRIP_LABEL, TRIP_TONE, num, useFile, useRun, useUpload } from './kit.jsx';

/* « Ma tournée » : écran du chauffeur sur téléphone. Départ (compteur), arrivée chez chaque client, livraison avec preuve
   (nom, signature au doigt, photo), livraison partielle, refus ou échec avec motif et nouvelle date, encaissement, frais de route, fin de tournée. */

/** Réduit une photo du téléphone (souvent plus de 2 Mo) : 1600 px au plus, JPEG. */
function shrink(file) {
  return new Promise((resolve) => {
    if (!file || !/^image\//.test(file.type)) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
const here = () => new Promise((resolve) => {
  if (!navigator.geolocation) { resolve({}); return; }
  navigator.geolocation.getCurrentPosition((p) => resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }), () => resolve({}), { timeout: 5000, maximumAge: 60000 });
});

function Complete({ stop, close, done }) {
  const t = useT();
  const { oapi, money, fail } = useWs();
  const upload = useUpload();
  const [partial, setPartial] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [cod, setCod] = useState(stop.codAmount ? String(stop.codAmount) : '');
  const [sig, setSig] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [lines, setLines] = useState(() => Object.fromEntries((stop.items || []).map((x) => [x.id, String(x.quantity)])));
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!recipient.trim()) { setErr(t('Indiquez le nom de la personne qui a reçu la marchandise.')); return; }
    setBusy(true);
    try {
      if (sig) await upload(TMS + '/stops/' + stop.id + '/pod?kind=signature', sig);
      if (photo) await upload(TMS + '/stops/' + stop.id + '/pod?kind=photo', await shrink(photo));
      const g = await here();
      await oapi('POST', TMS + '/stops/' + stop.id + '/complete', { outcome: partial ? 'partial' : 'delivered', recipient, codCollected: stop.codAmount ? cod : undefined, lines: partial ? Object.entries(lines).map(([id, q]) => ({ id: Number(id), delivered: q })) : undefined, ...g });
      close(); done(t('Livraison enregistrée.'));
    } catch (x) { if (x && x.status === 401) fail(x); setErr(tsrv(x.message)); }
    setBusy(false);
  };
  return (
    <form className="ws-form tms-pod" noValidate onSubmit={submit}>
      <div className="ws-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={!partial} className={'tab' + (!partial ? ' on' : '')} onClick={() => setPartial(false)}>{t('Tout est livré')}</button>
        <button type="button" role="tab" aria-selected={partial} className={'tab' + (partial ? ' on' : '')} onClick={() => setPartial(true)}>{t('Livraison partielle')}</button>
      </div>
      {partial && stop.items && stop.items.length ? stop.items.map((x) => (
        <label className="fld" key={x.id}><span>{t('« {name} » livré ({q} {u} chargés)', { name: x.name, q: num(x.quantity, 3), u: x.unit })}</span>
          <input type="text" inputMode="decimal" style={{ fontSize: 16 }} value={lines[x.id]} onChange={(e) => setLines({ ...lines, [x.id]: e.target.value })} /></label>
      )) : null}
      {partial && (!stop.items || !stop.items.length) ? <p className="small muted">{t('Notez ce qui n\'a pas été livré dans le nom ou demandez au bureau.')}</p> : null}
      <label className="fld"><span>{t('Reçu par')}</span><input type="text" autoComplete="off" style={{ fontSize: 16 }} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={t('Nom de la personne qui reçoit')} /></label>
      {stop.codAmount ? <label className="fld"><span>{t('Montant encaissé (à encaisser : {amount})', { amount: money(stop.codAmount) })}</span><input type="text" inputMode="numeric" style={{ fontSize: 16 }} value={cod} onChange={(e) => setCod(e.target.value)} /></label> : null}
      <div className="fld"><span>{t('Signature du client')}</span><SignaturePad onChange={setSig} /></div>
      <label className="fld"><span>{t('Photo de la livraison (facultatif)')}</span><input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files && e.target.files[0])} /><small>{t('JPEG, PNG ou WebP, réduite automatiquement à moins de 2 Mo.')}</small></label>
      <p className="ws-err" role="alert">{err}</p>
      <button className="btn primary tms-big" type="submit" disabled={busy}>{busy ? t('Envoi…') : t('Valider la livraison')}</button>
    </form>
  );
}

function Fail({ stop, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  return (
    <Form submitText={t("Enregistrer l'échec")} fields={[
      { k: 'outcome', label: t('Issue'), type: 'select', options: [['failed', t('Échec de livraison')], ['refused', t('Refus du client')]] },
      { k: 'reason', label: t('Motif'), type: 'select', options: REASONS.map((r) => [r[0], t(r[1])]) },
      { k: 'note', label: t('Précision'), placeholder: t('Portail fermé, client injoignable…') },
      { k: 'rescheduleDate', label: t('Nouvelle tentative le (facultatif)'), type: 'date', hint: t('La livraison quitte la tournée et revient à planifier à cette date.') },
    ]} onSubmit={async (v) => { const g = await here(); await oapi('POST', TMS + '/stops/' + stop.id + '/complete', { ...v, rescheduleDate: v.rescheduleDate || undefined, ...g }); close(); done(t('Échec enregistré.')); }} />
  );
}

function Stop({ s, trip, reload }) {
  const t = useT();
  const { oapi, money, modal, toast } = useWs();
  const [run, busy] = useRun(reload);
  const finished = ['delivered', 'failed', 'returned'].includes(s.status);
  const live = trip.status === 'in_progress';
  const arrive = async () => run(oapi('POST', TMS + '/stops/' + s.id + '/arrive', await here()), t('Arrivée enregistrée.'));
  const ok = (msg) => { toast(msg); reload(); };
  return (
    <div className={'tms-stop' + (finished ? ' done' : '') + (s.arrivedAt && !finished ? ' here' : '')}>
      <div className="tms-stop-h">
        <span className="tms-pos">{s.pos}</span>
        <div className="tms-stop-who"><b>{s.customerName}</b>{s.priority ? <Pill tone="bad">{t(s.priority === 2 ? 'Urgente' : 'Prioritaire')}</Pill> : null} <Pill tone={DEL_TONE[s.status]}>{t(s.statusLabel)}</Pill>
          <small>{[s.address, s.zone].filter(Boolean).join(' · ')}</small></div>
        <span className="tms-eta"><b>{s.etaLive || s.eta || '—'}</b><small>{s.windowStart || s.windowEnd ? (s.windowStart || '…') + '-' + (s.windowEnd || '…') : ''}</small></span>
      </div>
      <div className="tms-stop-m">
        {s.phone ? <a className="btn small" href={'tel:' + s.phone}><Fa name="phone" /> {t('Appeler')}</a> : null}
        {s.lat !== null && s.lng !== null ? <a className="btn small" href={'geo:' + s.lat + ',' + s.lng + '?q=' + s.lat + ',' + s.lng}><Fa name="globe" /> {t('Itinéraire')}</a> : null}
        {s.codAmount ? <span className="tms-cod">{t('À encaisser : {amount}', { amount: money(s.codAmount) })}{s.codCollected ? ' · ' + t('encaissé {amount}', { amount: money(s.codCollected) }) : ''}</span> : null}
        {s.weight ? <small>{num(s.weight) + ' kg'}{s.pallets ? ' · ' + t('{n} palette(s)', { n: num(s.pallets) }) : ''}</small> : null}
      </div>
      {s.items && s.items.length ? <ul className="tms-items">{s.items.map((x) => <li key={x.id}>{num(x.quantity, 3) + ' ' + x.unit + ' · ' + x.name}{x.returned ? ' ' + t('({q} remis en stock)', { q: num(x.returned, 3) }) : ''}</li>)}</ul> : null}
      {finished ? <small className="muted">{[s.receivedBy ? t('Reçu par {name}', { name: s.receivedBy }) : '', s.outcome === 'partial' ? t('partielle') : '', s.pod.signature ? t('signée') : '', s.pod.photo ? t('photo') : ''].filter(Boolean).join(' · ')}</small> : null}
      {live && !finished ? (
        <div className="tms-stop-a">
          {!s.arrivedAt ? <button className="btn tms-big" type="button" disabled={busy} onClick={arrive}>{t('Je suis arrivé')}</button> : null}
          <button className="btn primary tms-big" type="button" onClick={() => modal(t('Livraison : {name}', { name: s.customerName }), (close) => <Complete stop={s} close={close} done={ok} />)}>{t('Livrer')}</button>
          <button className="btn tms-big" type="button" onClick={() => modal(t('Échec : {name}', { name: s.customerName }), (close) => <Fail stop={s} close={close} done={ok} />)}>{t('Échec')}</button>
        </div>
      ) : null}
    </div>
  );
}

export function TripRun({ trip, reload }) {
  const t = useT();
  const { oapi, money, modal } = useWs();
  const file = useFile();
  const [, busy] = useRun(reload);
  const start = () => modal(t('Départ de la tournée'), (close) => (
    <Form submitText={t('Démarrer')} fields={[{ k: 'odometer', label: t('Kilométrage au compteur'), hint: t('Facultatif : sert à calculer les kilomètres réels.') }]} onSubmit={(v) => oapi('POST', TMS + '/trips/' + trip.id + '/start', v).then(() => { close(); reload(); })} />
  ));
  const finish = () => modal(t('Fin de la tournée'), (close) => (
    <Form submitText={t('Terminer la tournée')} fields={[
      { k: 'odometer', label: t('Kilométrage au retour') },
      ...(trip.cod.collected ? [{ k: 'codRemitted', label: t('Espèces remises au bureau (encaissé : {amount})', { amount: money(trip.cod.collected) }), value: String(trip.cod.collected) }] : []),
      { k: 'returnFailed', label: t('Marchandise des échecs'), type: 'select', options: [['yes', t('Rapportée au dépôt (remise en stock)')], ['no', t('Gardée pour une nouvelle tentative')]] },
    ]} onSubmit={(v) => oapi('POST', TMS + '/trips/' + trip.id + '/finish', { ...v, returnFailed: v.returnFailed !== 'no' }).then(() => { close(); reload(); })} />
  ));
  const expense = () => oapi('GET', TMS + '/trips/' + trip.id + '/costs').then((j) => modal(t('Frais de route'), (close) => (
    <Form submitText={t('Ajouter le frais')} fields={[
      { k: 'kind', label: t('Type'), type: 'select', options: Object.entries(j.kinds).map(([k, l]) => [k, t(l)]) }, { k: 'amount', label: t('Montant'), required: true }, { k: 'label', label: t('Détail (facultatif)'), placeholder: t('Station, péage de…') },
    ]} onSubmit={(v) => oapi('POST', TMS + '/trips/' + trip.id + '/costs', v).then(() => { close(); reload(); })} />
  )));
  const left = trip.stops.filter((s) => !['delivered', 'failed', 'returned'].includes(s.status));
  return (
    <div className="ws-card tms-run">
      <div className="tms-run-h">
        <div><h2>{trip.name}</h2><small className="muted">{[trip.vehicle, trip.carrier, t('départ {time}', { time: trip.startTime }), trip.plannedKm ? num(trip.plannedKm) + ' km' : ''].filter(Boolean).join(' · ')}</small></div>
        <Pill tone={TRIP_TONE[trip.status]}>{t(TRIP_LABEL[trip.status])}</Pill>
      </div>
      <div className="tms-run-k">
        <span>{t('Arrêts')}<b>{trip.done + ' / ' + trip.stopsCount}</b></span>
        <span>{t('Charge')}<b>{num(trip.load.weight) + ' kg'}</b></span>
        {trip.cod.due ? <span>{t('À encaisser')}<b>{money(trip.cod.due)}</b></span> : null}
        {trip.cod.collected ? <span>{t('Encaissé')}<b>{money(trip.cod.collected)}</b></span> : null}
      </div>
      <div className="row tms-run-a">
        {['planned', 'dispatched'].includes(trip.status) ? <button className="btn primary tms-big" type="button" disabled={busy} onClick={start}>{t('Démarrer la tournée')}</button> : null}
        {trip.status === 'in_progress' && !left.length ? <button className="btn primary tms-big" type="button" disabled={busy} onClick={finish}>{t('Terminer la tournée')}</button> : null}
        {trip.status === 'in_progress' || trip.status === 'done' ? <button className="btn tms-big" type="button" onClick={expense}>{t('Frais de route')}</button> : null}
        <button className="btn tms-big" type="button" onClick={() => file(TMS + '/trips/' + trip.id + '/sheet', 'tournee-' + trip.id + '.pdf')}><Fa name="pdf" /> {t('Fiche de tournée')}</button>
      </div>
      {trip.status === 'in_progress' && left.length ? <p className="small muted">{t('{n} arrêt(s) restant(s). Les heures d\'arrivée se recalculent à chaque arrêt.', { n: left.length })}</p> : null}
      {trip.stops.map((s) => <Stop key={s.id} s={s} trip={trip} reload={reload} />)}
    </div>
  );
}

export default function Driver() {
  const t = useT();
  const { oapi, today } = useWs();
  const [date, setDate] = useState(today());
  const st = useLoad(() => oapi('GET', TMS + '/driver?date=' + date), [date]);
  return (
    <div className="tms-driver">
      <div className="row tms-toolbar"><label className="fld"><span>{t('Jour')}</span><input type="date" style={{ fontSize: 16 }} value={date} onChange={(e) => setDate(e.target.value || today())} /></label></div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.driver ? <Empty text={j.message} /> : null}
          {j.driver && !j.trips.length ? <Empty text={t('Aucune tournée pour vous ce jour-là.')} /> : null}
          {j.trips.map((tr) => <TripRun key={tr.id} trip={tr} reload={st.reload} />)}
        </>
      )}</Loaded>
    </div>
  );
}
