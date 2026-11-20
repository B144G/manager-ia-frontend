import { Suspense, lazy, useMemo, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Loaded, Loading, useLoad, Icon, Segmented, Alert } from '../../ui.jsx';
import { num } from '../tms/kit.jsx';
import { AddressSearch, Legend, StatePill, TG, useAge } from './common.jsx';

const GeoMap = lazy(() => import('./GeoMap.jsx'));

/* Carte et affectation : la position du client et celle de tous les transporteurs de l'entreprise (vert = disponible, rouge = indisponible),
   la distance et la durée estimées de chacun, deux recommandations chiffrées ; la personne choisit, l'affectation crée la tournée du Transport. */
const PARTS = [['distance', 'Distance'], ['time', 'Délai'], ['cost', 'Coût'], ['reliability', 'Fiabilité'], ['capacity', 'Charge']];

function Reco({ r, onChoose, busy }) {
  const t = useT();
  const { money } = useWs();
  const age = useAge();
  const j = r.justification; const c = j.capacity;
  return (
    <article className="geo-reco" aria-label={t('Recommandation {n}', { n: r.rank })}>
      <header><span className="geo-rank">{r.rank}</span><div><b>{r.name}</b><small className="muted">{j.vehicle || t('Véhicule non renseigné')}</small></div><span className="geo-score" title={t('Score sur 100')}>{num(r.score, 1)}<small>/100</small></span></header>
      <ul>
        <li><Icon name="route" /><span>{t('Distance')}</span><b>{num(j.distanceKm)} km</b><small>{t('à vol d\'oiseau {n} km', { n: num(j.straightKm) })}</small></li>
        <li><Icon name="clock" /><span>{t('Délai estimé')}</span><b>{t('{n} min', { n: j.etaMin })}</b></li>
        <li><Icon name="ok" /><span>{t('Disponibilité')}</span><b>{t('Disponible')}</b><small>{t('position {age}', { age: age(j.positionAgeMin) })}{j.positionStale ? ' · ' + t('ancienne') : ''}</small></li>
        <li><Icon name="truck" /><span>{t('Capacité et charge')}</span><b>{c.known ? t('{a} / {b} kg', { a: num(c.loadKg, 0), b: num(c.capacityKg, 0) }) : '—'}</b><small>{c.known ? t('déjà chargés / capacité du véhicule') : t('capacité non renseignée')}</small></li>
        <li><Icon name="coins" /><span>{t('Coût estimé')}</span><b>{j.estCost === null ? '—' : money(j.estCost)}</b><small>{j.estKm ? t('{n} km aller-retour', { n: num(j.estKm) }) : ''}</small></li>
        <li><Icon name="star" /><span>{t('Fiabilité')}</span><b>{j.reliabilityPct} %</b><small>{j.reliabilityLow ? t('peu d\'historique ({n} livraisons)', { n: j.reliabilitySample }) : t('sur {n} livraisons', { n: j.reliabilitySample })}</small></li>
      </ul>
      <div className="geo-parts" aria-label={t('Détail du score')}>{PARTS.map(([k, l]) => <span key={k} title={t(l)}><i style={{ width: Math.round((r.parts[k] || 0) * 100) + '%' }} />{t(l)}</span>)}</div>
      <button type="button" className="ui-btn primary" disabled={busy} onClick={() => onChoose(r.driverId, r.name)}><Icon name="check" />{t('Choisir {name}', { name: r.name })}</button>
    </article>
  );
}

export default function GeoDispatch() {
  const t = useT();
  const { oapi, toast, fail, modal, copy, today, dateFr, confirm } = useWs();
  const age = useAge();
  const [date, setDate] = useState(today());
  const [deliveryId, setDeliveryId] = useState('');
  const [filter, setFilter] = useState('all');
  const [freshOnly, setFreshOnly] = useState(false);
  const [sel, setSel] = useState(null);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const cands = useLoad(() => oapi('GET', '/logistics/tms/candidates?date=' + date), [date]);
  const st = useLoad(() => (deliveryId ? oapi('GET', TG + '/map?deliveryId=' + deliveryId + '&date=' + date) : oapi('GET', TG + '/fleet?date=' + date)), [deliveryId, date]);

  const setClient = (p, source) => {
    if (!deliveryId) return;
    oapi('PUT', TG + '/deliveries/' + deliveryId + '/location', { lat: p.lat, lng: p.lng, source: source || (p.source === 'address' ? 'address' : 'pin'), ...(p.label ? { address: p.label.slice(0, 280) } : {}) })
      .then(() => { setPick(false); toast(t('Position du client enregistrée.')); st.reload(); }).catch(fail);
  };
  const ask = () => oapi('POST', TG + '/requests', { deliveryId: Number(deliveryId) }).then((j) => modal(t('Demander sa position au client'), () => (
    <div className="geo-ask">
      <p>{t('Envoyez ce lien au client : il indiquera son adresse, posera un point sur la carte ou partagera la position GPS de son téléphone (avec son accord). Le lien est valable 48 heures.')}</p>
      <label className="fld"><span>{t('Lien')}</span><input readOnly value={j.url} onFocus={(e) => e.target.select()} /></label>
      <label className="fld"><span>{t('Message prêt à envoyer')}</span><textarea readOnly rows={4} value={j.message} /></label>
      <div className="row">
        <button type="button" className="ui-btn" onClick={() => copy(j.message, t('Message copié.'))}><Icon name="copy" />{t('Copier le message')}</button>
        {j.whatsapp ? <a className="ui-btn primary" href={j.whatsapp} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t('Envoyer par WhatsApp')}</a> : null}
      </div>
    </div>
  ), { wide: true })).catch(fail);

  const choose = (driverId, name) => confirm(t('Affecter {name} à cette livraison ? Une tournée sera créée (ou complétée) dans le Transport.', { name }), () => {
    setBusy(true);
    oapi('POST', TG + '/assign', { deliveryId: Number(deliveryId), driverId, date }).then((j) => { toast(j.created ? t('Tournée créée pour {name}.', { name }) : t('Livraison ajoutée à la tournée de {name}.', { name })); setDeliveryId(''); cands.reload(); })
      .catch(fail).finally(() => setBusy(false));
  }, t('Affecter'));

  return (
    <div className="geo">
      <div className="geo-bar">
        <label className="fld"><span>{t('Jour')}</span><input type="date" value={date} onChange={(e) => { setDate(e.target.value || today()); setDeliveryId(''); }} /></label>
        <label className="fld grow"><span>{t('Livraison à organiser (commande à distance ou achat)')}</span>
          <select value={deliveryId} onChange={(e) => { setDeliveryId(e.target.value); setSel(null); setPick(false); }}>
            <option value="">{t('— Aucune : voir seulement les transporteurs —')}</option>
            {cands.data ? cands.data.deliveries.map((d) => <option key={d.id} value={d.id}>{d.customerName} · {d.address ? d.address.slice(0, 40) : t('adresse non renseignée')}{d.weight ? ' · ' + d.weight + ' kg' : ''}</option>) : null}
          </select>
        </label>
      </div>
      <Loaded state={st}>{(j) => <Body j={j} deliveryId={deliveryId} filter={filter} setFilter={setFilter} freshOnly={freshOnly} setFreshOnly={setFreshOnly} sel={sel} setSel={setSel} pick={pick} setPick={setPick} setClient={setClient} ask={ask} choose={choose} busy={busy} age={age} dateFr={dateFr} />}</Loaded>
    </div>
  );
}

function Body({ j, deliveryId, filter, setFilter, freshOnly, setFreshOnly, sel, setSel, pick, setPick, setClient, ask, choose, busy, age, dateFr }) {
  const t = useT();
  const hasDel = Boolean(deliveryId) && Boolean(j.delivery); // pendant le chargement, j peut encore être la carte sans livraison
  const all = j.drivers;
  const shown = useMemo(() => all.filter((d) => (filter === 'all' || (filter === 'ok' ? d.available : !d.available)) && (!freshOnly || (d.position && d.position.state === 'fresh'))), [all, filter, freshOnly]);
  const counts = { ok: all.filter((d) => d.available).length, bad: all.filter((d) => !d.available).length, located: all.filter((d) => d.position).length };
  const recs = j.recommendations || [];
  const del = j.delivery;
  return (
    <>
      {hasDel ? (
        <section className="geo-client" aria-label={t('Position du client')}>
          <div>
            <b>{del.customerName}</b>
            <div className="muted">{del.address || t('Adresse non renseignée')}{del.weight ? ' · ' + del.weight + ' kg' : ''}</div>
            {j.client ? <small className="muted"><Icon name="location-dot" />{({ address: t('adresse trouvée'), pin: t('point posé sur la carte'), gps: t('GPS partagé par le client'), manual: t('saisie à la main') })[j.client.source] || ''} {j.client.at ? '· ' + dateFr(j.client.at.slice(0, 10)) : ''}{j.client.accuracy ? ' · ±' + j.client.accuracy + ' m' : ''}</small>
              : <Alert tone="warn">{t("La position du client n'est pas connue : saisissez son adresse, posez un point sur la carte, ou demandez-lui de la partager.")}</Alert>}
          </div>
          <div className="row">
            <button type="button" className={'ui-btn' + (pick ? ' primary' : '')} onClick={() => setPick(!pick)} aria-pressed={pick}><Icon name="map" />{pick ? t('Cliquez sur la carte…') : t('Poser le point sur la carte')}</button>
            <button type="button" className="ui-btn" onClick={ask}><Icon name="whatsapp" />{t('Demander sa position au client')}</button>
          </div>
          <AddressSearch initial={del.address} onPick={(p) => setClient(p, p.source === 'gps' ? 'manual' : undefined)} gps />
        </section>
      ) : <p className="muted">{t("Choisissez une livraison pour voir les distances et obtenir deux recommandations. Sans livraison, la carte montre où sont vos transporteurs.")}</p>}

      <div className="geo-tools">
        <Segmented label={t('Filtrer les transporteurs')} value={filter} onChange={setFilter} items={[{ id: 'all', label: t('Tous ({n})', { n: all.length }) }, { id: 'ok', label: t('Disponibles ({n})', { n: counts.ok }) }, { id: 'bad', label: t('Indisponibles ({n})', { n: counts.bad }) }]} />
        <label className="geo-chk"><input type="checkbox" checked={freshOnly} onChange={(e) => setFreshOnly(e.target.checked)} />{t('Positions récentes seulement')}</label>
      </div>
      <Legend staleMin={j.settings.staleMin} />
      <Suspense fallback={<Loading />}>
        <GeoMap client={hasDel ? j.client : null} depot={j.depot} drivers={shown} selectedId={sel} onSelect={setSel} onPick={pick ? (la, ln) => setClient({ lat: la, lng: ln, source: 'pin' }) : null} height={380} ariaLabel={t('Carte des transporteurs et du client')} />
      </Suspense>
      <p className="muted small">{t('{n} transporteur(s) localisé(s) sur {m}. Les distances sont à vol d\'oiseau multipliées par {f} (routes non rectilignes) ; durée estimée à {v} km/h.', { n: counts.located, m: all.length, f: hasDel ? j.params.roadFactor : '1,3', v: hasDel ? j.params.speedKmh : '30' })}</p>

      {hasDel && j.client ? (
        <section aria-label={t('Recommandations')}>
          <h3 className="geo-h">{t('Nos deux recommandations')}</h3>
          {recs.length ? <div className="geo-recos">{recs.map((r) => <Reco key={r.driverId} r={r} onChoose={choose} busy={busy} />)}</div>
            : <Alert tone="warn">{t("Aucun transporteur ne peut être recommandé : aucun n'est disponible avec une position connue et un véhicule assez grand. Vous pouvez en choisir un à la main dans la liste.")}</Alert>}
          {recs.length === 1 ? <p className="muted small">{t("Un seul transporteur remplit toutes les conditions.")}</p> : null}
        </section>
      ) : null}

      <section aria-label={t('Transporteurs')}>
        <h3 className="geo-h">{t('Transporteurs')}</h3>
        <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={t('Liste des transporteurs')}>
          <table className="ui-table">
            <thead><tr><th scope="col">{t('Transporteur')}</th><th scope="col">{t('État')}</th>{hasDel ? <><th scope="col" className="r">{t('Distance')}</th><th scope="col" className="r">{t('Durée')}</th></> : null}<th scope="col">{t('Position')}</th><th scope="col">{t('Véhicule')}</th>{hasDel ? <th scope="col" /> : null}</tr></thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className={d.id === sel ? 'sel' : ''} onClick={() => setSel(d.id === sel ? null : d.id)}>
                  <td><b>{d.name}</b>{d.phone ? <div className="muted small">{d.phone}</div> : null}</td>
                  <td><StatePill d={d} />{d.blocked ? <div className="muted small">{t(({ license: 'Permis périmé', vehicle: 'Véhicule hors parc', papers: 'Papiers du véhicule périmés' })[d.blocked])}</div> : null}{d.manualReason ? <div className="muted small">{d.manualReason}</div> : null}{d.vehicleTaken ? <div className="muted small">{t('Son véhicule est déjà pris ce jour-là')}</div> : null}</td>
                  {hasDel ? <><td className="r num">{d.distanceKm === null ? '—' : num(d.distanceKm) + ' km'}</td><td className="r num">{d.etaMin === null ? '—' : t('{n} min', { n: d.etaMin })}</td></> : null}
                  <td>{d.position ? <span className={d.position.state === 'stale' ? 'geo-old' : ''}>{age(d.position.ageMin)}{d.position.state === 'stale' ? ' ⚠ ' + t('ancienne') : ''}</span> : <span className="muted">{d.positionHidden === 'lost' ? t('Trop ancienne : masquée') : d.positionHidden === 'off_duty' ? t('Hors service : non suivie') : t('Position inconnue')}</span>}</td>
                  <td>{d.vehicle ? d.vehicle.plate : <span className="muted">—</span>}</td>
                  {hasDel ? <td className="r"><button type="button" className="ui-btn sm" disabled={busy || !d.available || !j.client} onClick={(e) => { e.stopPropagation(); choose(d.id, d.name); }}>{t('Choisir')}</button></td> : null}
                </tr>
              ))}
              {!shown.length ? <tr><td colSpan={hasDel ? 7 : 4} className="muted">{t('Aucun transporteur ne correspond aux filtres.')}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
