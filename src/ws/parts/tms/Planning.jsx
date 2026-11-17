import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Fa } from '../../../lib/fa.jsx';
import { API_BASE } from '../../../lib/api.js';
import { TripRun } from './Driver.jsx';
import { DEL_TONE, Gauge, Pill, TMS, TRIP_LABEL, TRIP_TONE, addDays, num, pct, useFile, useRun } from './kit.jsx';

/* Planification : livraisons et expéditions à planifier, proposition de tournées (capacité, zones, créneaux, ordre de passage),
   validation avec véhicule et chauffeur ; tableau de répartition (jour / semaine) ; fiche détaillée d'une tournée. */

const METHOD = { route: 'Ordre optimisé sur les distances (plus proche voisin + 2-opt)', zones: 'Ordre des zones (distances incomplètes)', manual: 'Ordre choisi à la main', none: '' };

export function Planner() {
  const t = useT();
  const { oapi, can, money, dateFr, today, toast, fail } = useWs();
  const mgr = can('manager');
  const [date, setDate] = useState(today());
  const cand = useLoad(() => oapi('GET', TMS + '/candidates?date=' + date), [date]);
  const fleet = useLoad(() => oapi('GET', '/logistics/fleet'), []);
  const [off, setOff] = useState([]);
  const [plan, setPlan] = useState(null);
  const [startTime, setStartTime] = useState('08:00');
  const [err, setErr] = useState('');
  const [run, busy] = useRun();
  const list = cand.data ? cand.data.deliveries : [];
  const chosen = list.filter((d) => !off.includes(d.id));
  const suggest = () => { setErr(''); setPlan(null); oapi('POST', TMS + '/plan/suggest', { date, deliveryIds: chosen.map((d) => d.id), startTime }).then((j) => setPlan(j)).catch((e) => { if (e.status === 401) fail(e); setErr(tsrv(e.message)); }); };
  const setTrip = (i, k, v) => setPlan({ ...plan, trips: plan.trips.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const commit = () => run(oapi('POST', TMS + '/plan/commit', { date, trips: plan.trips.map((x) => ({ name: x.name, vehicleId: x.vehicleId || undefined, driverId: x.driverId || undefined, startTime: x.startTime, deliveryIds: x.stops.map((s) => s.deliveryId), keepOrder: true })) }))
    .then((j) => { if (j) { toast(t('{n} tournée(s) créée(s).', { n: j.trips.length })); setPlan(null); cand.reload(); } });
  const vs = fleet.data ? fleet.data.vehicles.filter((v) => v.status === 'active') : [];
  const ds = fleet.data ? fleet.data.drivers.filter((d) => d.active) : [];
  return (
    <>
      <div className="ws-card">
        <div className="row tms-toolbar">
          <label className="fld"><span>{t('Jour des tournées')}</span><input type="date" style={{ fontSize: 16 }} value={date} onChange={(e) => { setDate(e.target.value || today()); setPlan(null); }} /></label>
          <label className="fld"><span>{t('Départ du dépôt')}</span><input type="time" style={{ fontSize: 16 }} value={startTime} onChange={(e) => setStartTime(e.target.value || '08:00')} /></label>
          <button className="btn primary" type="button" disabled={!chosen.length} onClick={suggest}>{t('Proposer les tournées')}</button>
        </div>
        <p className="ws-err" role="alert">{err}</p>
        <Loaded state={cand}>{() => (
          <>
            <h3>{t('À planifier ({n} sur {m})', { n: chosen.length, m: list.length })}</h3>
            {!list.length ? <Empty text={t('Aucune livraison à planifier ce jour-là : elles sont déjà en tournée, terminées ou prévues plus tard.')} /> : null}
            {list.map((d) => (
              <label className="row wms-check line" key={d.id}>
                <input type="checkbox" checked={!off.includes(d.id)} onChange={() => setOff(off.includes(d.id) ? off.filter((x) => x !== d.id) : off.concat([d.id]))} />
                <span style={{ flex: 1 }}><b>{d.customerName}</b> <Pill tone={DEL_TONE[d.status]}>{t(d.statusLabel)}</Pill>{d.priority ? <Pill tone="bad">{t(d.priority === 2 ? 'Urgente' : 'Prioritaire')}</Pill> : null}{d.overdue ? <Pill tone="bad">{t('En retard')}</Pill> : null}
                  <br /><small>{[d.zone, d.address, d.weight ? num(d.weight) + ' kg' : t('poids non renseigné'), d.pallets ? t('{n} palette(s)', { n: num(d.pallets) }) : '', d.windowStart || d.windowEnd ? t('créneau {a}-{b}', { a: d.windowStart || '…', b: d.windowEnd || '…' }) : '', d.lat !== null ? 'GPS' : '', d.plannedDate ? dateFr(d.plannedDate) : ''].filter(Boolean).join(' · ')}</small></span>
              </label>
            ))}
          </>
        )}</Loaded>
      </div>
      {plan ? (
        <div className="ws-card">
          <div className="ws-head"><h2>{t('Proposition')}</h2>{mgr ? <button className="btn primary" type="button" disabled={busy || !plan.trips.length} onClick={commit}>{t('Valider les tournées')}</button> : null}</div>
          <p className="small muted">{t('{v} véhicule(s) et {d} chauffeur(s) libres ce jour-là (papiers et permis à jour).', { v: plan.vehiclesFree, d: plan.driversFree })}{mgr ? '' : ' ' + t('Un responsable valide les tournées.')}</p>
          {plan.trips.map((x, i) => (
            <div className="tms-trip" key={i}>
              <div className="row tms-toolbar">
                <label className="fld"><span>{t('Nom')}</span><input type="text" style={{ fontSize: 16 }} value={x.name} onChange={(e) => setTrip(i, 'name', e.target.value)} /></label>
                <label className="fld"><span>{t('Véhicule')}</span><select style={{ fontSize: 16 }} value={x.vehicleId || ''} onChange={(e) => setTrip(i, 'vehicleId', Number(e.target.value) || null)}>{vs.map((v) => <option key={v.id} value={v.id}>{v.plate + (v.capacityKg ? ' · ' + num(v.capacityKg) + ' kg' : '')}</option>)}</select></label>
                <label className="fld"><span>{t('Chauffeur')}</span><select style={{ fontSize: 16 }} value={x.driverId || ''} onChange={(e) => setTrip(i, 'driverId', Number(e.target.value) || null)}><option value="">{t('Non choisi')}</option>{ds.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
              </div>
              <div className="tms-trip-k">
                <span>{t('Arrêts')}<b>{x.stops.length}</b></span>
                <span>{t('Distance')}<b>{x.km === null ? t('inconnue') : num(x.km) + ' km'}</b></span>
                <span>{t('Retour vers')}<b>{x.endTime}</b></span>
                <span>{t('Charge')}<b>{num(x.load.weight) + ' kg'}{x.load.pctKg !== null ? ' · ' + pct(x.load.pctKg) : ''}</b><Gauge value={x.load.pctKg} label={t('Charge du véhicule')} /></span>
                {x.estCost !== undefined ? <span>{t('Coût estimé')}<b>{money(x.estCost)}</b></span> : null}
              </div>
              <small className="muted">{t(METHOD[x.method] || '')}{x.late ? ' · ' + t('{n} créneau(x) manqué(s)', { n: x.late }) : ''}</small>
              <ol className="tms-seq">{x.stops.map((s) => <li key={s.deliveryId} className={s.late ? 'late' : ''}><b>{s.eta}</b> {s.customerName}<small>{[s.zone, s.weight ? num(s.weight) + ' kg' : '', s.windowEnd ? t('avant {h}', { h: s.windowEnd }) : '', s.late ? t('en retard sur le créneau') : ''].filter(Boolean).join(' · ')}</small></li>)}</ol>
            </div>
          ))}
          {plan.unassigned.length ? (
            <>
              <h3>{t('Non placées')}</h3>
              {plan.unassigned.map((u) => <div className="line" key={u.deliveryId}><span><b>{u.customerName}</b><small>{' ' + num(u.weight) + ' kg · ' + t(u.reasonLabel)}</small></span></div>)}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Fiche d'une tournée : arrêts, chargement, actions (réordonner, répartir, démarrer, annuler), frais réels, fiche PDF. */
export function TripDetail({ id, close, changed }) {
  const t = useT();
  const { oapi, can, money, dateFr, modal, confirm, copy } = useWs();
  const mgr = can('manager');
  const file = useFile();
  const st = useLoad(() => oapi('GET', TMS + '/trips/' + id), []);
  const reload = () => { st.reload(); if (changed) changed(); };
  const [run, busy] = useRun(reload);
  const share = (s) => oapi('GET', TMS + '/deliveries/' + s.id + '/share').then((j) => modal(t('Suivi pour le client'), () => (
    <>
      <p className="small">{t('Lien secret à envoyer au client : il voit l\'état et le créneau d\'arrivée, sans adresse ni montant.')}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{j.message}</p>
      <div className="row">
        {j.whatsapp ? <a className="btn primary" href={j.whatsapp} target="_blank" rel="noopener noreferrer"><Fa name="whatsapp" /> {t('Ouvrir WhatsApp')}</a> : null}
        <button className="btn" type="button" onClick={() => copy(j.url, t('Lien copié.'))}>{t('Copier le lien')}</button>
      </div>
    </>
  )));
  const addCost = (tr) => oapi('GET', TMS + '/trips/' + tr.id + '/costs').then((j) => modal(t('Ajouter un frais'), (c) => (
    <Form submitText={t('Ajouter')} fields={[{ k: 'kind', label: t('Type'), type: 'select', options: Object.entries(j.kinds).map(([k, l]) => [k, t(l)]) }, { k: 'amount', label: t('Montant'), required: true }, { k: 'label', label: t('Détail') }]}
      onSubmit={(v) => oapi('POST', TMS + '/trips/' + tr.id + '/costs', v).then(() => { c(); reload(); })} />
  )));
  const approve = (tr) => modal(t('Valider les frais de la tournée'), (c) => (
    <Form submitText={t('Valider et comptabiliser')} fields={[{ k: 'account', label: t('Payé par'), type: 'select', options: [['571', t('Caisse (571)')], ['521', t('Banque (521)')], ['589', t('Mobile money (589)')]] }]}
      onSubmit={(v) => oapi('POST', TMS + '/trips/' + tr.id + '/costs/approve', v).then(() => { c(); reload(); })} />
  ));
  return (
    <Loaded state={st}>{({ trip: tr }) => (
      <div className="tms-detail">
        <div className="tms-run-h">
          <div><h2>{tr.name}</h2><small className="muted">{[dateFr(tr.date), t('départ {time}', { time: tr.startTime }), tr.vehicle, tr.driver, tr.carrier].filter(Boolean).join(' · ')}</small></div>
          <Pill tone={TRIP_TONE[tr.status]}>{t(TRIP_LABEL[tr.status])}</Pill>
        </div>
        <div className="tms-trip-k">
          <span>{t('Arrêts')}<b>{tr.done + ' / ' + tr.stopsCount}</b></span>
          <span>{t('Km prévus')}<b>{num(tr.plannedKm)}</b></span>
          {tr.actualKm !== null ? <span>{t('Km parcourus')}<b>{num(tr.actualKm)}</b></span> : null}
          <span>{t('Charge')}<b>{num(tr.load.weight) + ' kg'}{tr.load.pctKg !== null ? ' · ' + pct(tr.load.pctKg) : ''}</b><Gauge value={tr.load.pctKg} label={t('Charge du véhicule')} /></span>
          {tr.load.pctPallets !== null ? <span>{t('Palettes')}<b>{num(tr.load.pallets) + ' · ' + pct(tr.load.pctPallets)}</b></span> : null}
          {tr.cod.due ? <span>{t('À encaisser')}<b>{money(tr.cod.due)}</b></span> : null}
          {tr.cod.collected ? <span>{t('Encaissé / remis')}<b className={tr.status === 'done' && tr.cod.gap ? 'late' : ''}>{money(tr.cod.collected) + ' / ' + money(tr.cod.remitted)}</b></span> : null}
          {mgr ? <span>{t('Coût estimé / réel')}<b>{money(tr.estCost) + ' / ' + money(tr.actualCost)}</b></span> : null}
        </div>
        <div className="row tms-toolbar">
          {mgr && ['planned', 'dispatched'].includes(tr.status) ? <button className="btn" type="button" disabled={busy} onClick={() => run(oapi('POST', TMS + '/trips/' + tr.id + '/optimize', {}), t('Ordre de passage recalculé.'))}>{t('Optimiser l\'ordre')}</button> : null}
          {mgr && tr.status === 'planned' ? <button className="btn primary" type="button" disabled={busy} onClick={() => run(oapi('POST', TMS + '/trips/' + tr.id + '/dispatch', {}), t('Tournée répartie : le chauffeur la voit sur son téléphone.'))}>{t('Répartir')}</button> : null}
          {(mgr || tr.isMine) && ['planned', 'dispatched', 'in_progress'].includes(tr.status) ? <button className="btn" type="button" onClick={() => modal(tr.name, () => <TripRunLoader id={tr.id} changed={reload} />, { wide: true })}>{t('Suivre en direct')}</button> : null}
          <button className="btn" type="button" onClick={() => file(TMS + '/trips/' + tr.id + '/sheet', 'tournee-' + tr.id + '.pdf')}><Fa name="pdf" /> {t('Fiche de tournée')}</button>
          {mgr && ['planned', 'dispatched'].includes(tr.status) ? <button className="btn" type="button" onClick={() => confirm(t('Annuler cette tournée ? Les livraisons redeviennent à planifier.'), () => run(oapi('POST', TMS + '/trips/' + tr.id + '/cancel', {})).then(() => close && close()))}>{t('Annuler la tournée')}</button> : null}
        </div>
        {tr.routeMethod ? <p className="small muted">{t(METHOD[tr.routeMethod] || '')}</p> : null}
        {!tr.stops.length ? <Empty text={t('Aucun arrêt.')} /> : null}
        <ol className="tms-seq">
          {tr.stops.map((s) => (
            <li key={s.id}>
              <b>{s.etaLive || s.eta || '—'}</b> {s.customerName} <Pill tone={DEL_TONE[s.status]}>{t(s.statusLabel)}</Pill>
              <small>{[s.address, s.zone, s.weight ? num(s.weight) + ' kg' : '', s.window ? t('fenêtre annoncée {a}-{b}', { a: s.window.from, b: s.window.to }) : '', s.codAmount ? t('à encaisser {amount}', { amount: money(s.codAmount) }) : '', s.receivedBy ? t('reçu par {name}', { name: s.receivedBy }) : '', s.pod.signature ? t('signée') : '', s.pod.photo ? t('photo') : ''].filter(Boolean).join(' · ')}</small>
              <span className="row"><button className="link" type="button" onClick={() => share(s)}>{t('Suivi client')}</button>{(s.pod.signature || s.pod.photo) && (mgr || tr.isMine) ? <button className="link" type="button" onClick={() => modal(t('Preuves : {name}', { name: s.customerName }), () => <Proofs id={s.id} />)}>{t('Preuves')}</button> : null}</span>
            </li>
          ))}
        </ol>
        {mgr ? (
          <>
            <h3>{t('Frais réels')}</h3>
            {!tr.costs.length ? <Empty text={t('Aucun frais saisi (carburant, péages, indemnités…).')} /> : null}
            {tr.costs.map((c) => <div className="line" key={c.id}><span>{c.label || c.kind}</span><b>{money(c.amount)}</b></div>)}
            <div className="row">
              {!tr.costsApproved && tr.status !== 'cancelled' ? <button className="btn" type="button" onClick={() => addCost(tr)}>{t('Ajouter un frais')}</button> : null}
              {!tr.costsApproved && tr.status === 'done' && tr.costs.length ? <button className="btn primary" type="button" onClick={() => approve(tr)}>{t('Valider les frais')}</button> : null}
              {tr.costsApproved ? <Pill tone="good">{t('Frais validés et comptabilisés')}</Pill> : null}
            </div>
          </>
        ) : null}
      </div>
    )}</Loaded>
  );
}

function TripRunLoader({ id, changed }) {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', TMS + '/trips/' + id), []);
  return <Loaded state={st}>{({ trip }) => <TripRun trip={trip} reload={() => { st.reload(); if (changed) changed(); }} />}</Loaded>;
}

/** Preuves de livraison : images servies par le serveur (cookie), affichées par une adresse locale du navigateur. */
function Proofs({ id }) {
  const t = useT();
  const { oapi, orgId } = useWs();
  const [urls, setUrls] = useState({});
  const st = useLoad(() => oapi('GET', TMS + '/stops/' + id + '/pod'), []);
  const show = (f) => fetch(API_BASE + '/api/ws/orgs/' + orgId + TMS + '/pod/' + f.id + '/file', { credentials: 'include' }).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) setUrls((u) => ({ ...u, [f.id]: URL.createObjectURL(b) })); });
  return (
    <Loaded state={st}>{(j) => (
      <div className="tms-proofs">
        {!j.files.length ? <Empty text={t('Aucune preuve.')} /> : null}
        {j.files.map((f) => (
          <figure key={f.id}>
            {urls[f.id] ? <img src={urls[f.id]} alt={f.kind === 'signature' ? t('Signature du client') : t('Photo de la livraison')} /> : <button className="btn small" type="button" onClick={() => show(f)}>{t('Afficher')}</button>}
            <figcaption>{(f.kind === 'signature' ? t('Signature') : t('Photo')) + ' · ' + f.createdAt.slice(0, 16).replace('T', ' ')}</figcaption>
          </figure>
        ))}
      </div>
    )}</Loaded>
  );
}

export function Dispatch() {
  const t = useT();
  const { oapi, dateFr, today, modal } = useWs();
  const [from, setFrom] = useState(today());
  const [days, setDays] = useState(1);
  const st = useLoad(() => oapi('GET', TMS + '/dispatch?from=' + from + '&days=' + days), [from, days]);
  const open = (tr) => modal(tr.name, (close) => <TripDetail id={tr.id} close={close} changed={st.reload} />, { wide: true });
  return (
    <div className="ws-card">
      <div className="row tms-toolbar">
        <button className="btn" type="button" aria-label={t('Précédent')} onClick={() => setFrom(addDays(from, -days))}><Fa name="arrow-left" /></button>
        <label className="fld"><span>{t('À partir du')}</span><input type="date" style={{ fontSize: 16 }} value={from} onChange={(e) => setFrom(e.target.value || today())} /></label>
        <button className="btn" type="button" aria-label={t('Suivant')} onClick={() => setFrom(addDays(from, days))}><Fa name="arrow-right" /></button>
        <div className="ws-tabs" role="tablist">{[[1, 'Jour'], [7, 'Semaine']].map((x) => <button key={x[0]} type="button" role="tab" aria-selected={days === x[0]} className={'tab' + (days === x[0] ? ' on' : '')} onClick={() => setDays(x[0])}>{t(x[1])}</button>)}</div>
      </div>
      <Loaded state={st}>{(j) => (
        <div className={'tms-board' + (days > 1 ? ' week' : '')}>
          {j.days.map((d) => (
            <section key={d.date} className="tms-day" aria-label={dateFr(d.date)}>
              <h3>{dateFr(d.date)}</h3>
              {d.unplanned ? <p className="small"><Pill tone="mid">{t('{n} à planifier', { n: d.unplanned })}</Pill></p> : null}
              {!d.trips.length ? <p className="small muted">{t('Aucune tournée.')}</p> : null}
              {d.trips.map((tr) => (
                <button key={tr.id} type="button" className="tms-card" onClick={() => open(tr)}>
                  <span className="tms-card-h"><b>{tr.name}</b><Pill tone={TRIP_TONE[tr.status]}>{t(TRIP_LABEL[tr.status])}</Pill></span>
                  <small>{[tr.startTime, tr.vehicle || tr.carrier, tr.driver].filter(Boolean).join(' · ')}</small>
                  <small>{t('{a} / {n} arrêts', { a: tr.done, n: tr.stopsCount }) + ' · ' + num(tr.load.weight) + ' kg' + (tr.plannedKm ? ' · ' + num(tr.plannedKm) + ' km' : '')}</small>
                  <Gauge value={tr.load.pctKg} label={t('Charge du véhicule')} />
                </button>
              ))}
              <small className="muted">{t('Véhicules libres : {list}', { list: d.freeVehicles.join(', ') || '—' })}</small>
              <small className="muted">{t('Chauffeurs libres : {list}', { list: d.freeDrivers.join(', ') || '—' })}</small>
            </section>
          ))}
        </div>
      )}</Loaded>
    </div>
  );
}

/** Tournées de la période : état, chargement, km, frais à valider. */
export function TripsList() {
  const t = useT();
  const { oapi, can, money, dateFr, today, modal } = useWs();
  const [status, setStatus] = useState('');
  const [to, setTo] = useState(addDays(today(), 7));
  const st = useLoad(() => oapi('GET', TMS + '/trips?to=' + to + (status ? '&status=' + status : '')), [status, to]);
  const open = (tr) => modal(tr.name, (close) => <TripDetail id={tr.id} close={close} changed={st.reload} />, { wide: true });
  return (
    <div className="ws-card">
      <div className="ws-tabs" role="tablist">{[['', 'Toutes'], ['planned', 'Planifiées'], ['dispatched', 'Réparties'], ['in_progress', 'En cours'], ['done', 'Terminées']].map((x) => <button key={x[0]} type="button" role="tab" aria-selected={status === x[0]} className={'tab' + (status === x[0] ? ' on' : '')} onClick={() => setStatus(x[0])}>{t(x[1])}</button>)}</div>
      <div className="row tms-toolbar"><label className="fld"><span>{t("Jusqu'au")}</span><input type="date" style={{ fontSize: 16 }} value={to} onChange={(e) => setTo(e.target.value || today())} /></label></div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.trips.length ? <Empty text={t('Aucune tournée sur la période. Planifiez-les depuis « Planifier les tournées ».')} /> : null}
          {j.trips.map((tr) => (
            <button type="button" className="line tms-rowbtn" key={tr.id} onClick={() => open(tr)}>
              <span><b>{tr.name}</b> <Pill tone={TRIP_TONE[tr.status]}>{t(TRIP_LABEL[tr.status])}</Pill>{can('manager') && tr.status === 'done' && !tr.costsApproved ? <Pill tone="mid">{t('Frais à valider')}</Pill> : null}
                <br /><small>{[dateFr(tr.date), tr.startTime, tr.vehicle || tr.carrier, tr.driver, t('{a} / {n} arrêts', { a: tr.done, n: tr.stopsCount }), num(tr.load.weight) + ' kg', (tr.actualKm ?? tr.plannedKm) ? num(tr.actualKm ?? tr.plannedKm) + ' km' : ''].filter(Boolean).join(' · ')}</small></span>
              {can('manager') ? <small>{money(tr.actualCost || tr.estCost)}</small> : null}
            </button>
          ))}
        </>
      )}</Loaded>
    </div>
  );
}
