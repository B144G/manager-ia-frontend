import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { TMS, num } from './kit.jsx';

/* Réglages du transport (dépôt, vitesse, temps d'arrêt, coefficient routier, CO2, tolérance des factures) et réseau
   (coordonnées des zones, distance depuis le dépôt, distances entre zones quand les adresses n'ont pas de GPS). */
export function TmsSettings() {
  const t = useT();
  const { oapi, can, toast } = useWs();
  const st = useLoad(() => oapi('GET', TMS + '/settings'), []);
  const mgr = can('manager');
  return (
    <Loaded state={st}>{({ settings: s }) => (
      <div className="ws-card">
        <h2>{t('Réglages du transport')}</h2>
        {!mgr ? <p className="small muted">{t('Seul un responsable modifie ces réglages.')}</p> : null}
        <Form submitText={t('Enregistrer')} fields={[
          { k: 'depotLabel', label: t('Dépôt (nom ou adresse)'), value: s.depotLabel },
          { k: 'depotLat', label: t('Latitude du dépôt'), value: s.depotLat ?? '', placeholder: '4.0511', hint: t('Relevée sur le téléphone (appui long dans une application de cartes). Sans GPS, les distances viennent des zones.') },
          { k: 'depotLng', label: t('Longitude du dépôt'), value: s.depotLng ?? '', placeholder: '9.7679' },
          { k: 'speedKmh', label: t('Vitesse moyenne en ville (km/h)'), value: s.speedKmh }, { k: 'serviceMin', label: t("Temps d'arrêt chez un client (minutes)"), value: s.serviceMin },
          { k: 'roadFactor', label: t('Coefficient routier'), value: s.roadFactor, hint: t('Distance par la route ÷ distance à vol d\'oiseau (1,3 en ville en général).') },
          { k: 'tzOffset', label: t('Fuseau horaire (minutes par rapport à UTC)'), value: s.tzOffset, hint: t('60 pour Douala, Kinshasa ou Libreville ; 0 pour Abidjan ou Dakar.') },
          { k: 'etaMargin', label: t("Marge de l'heure annoncée au client (± minutes)"), value: s.etaMargin },
          { k: 'co2', label: t('Émission par défaut (g de CO2 par km)'), value: s.co2 },
          { k: 'tolerancePct', label: t('Tolérance des factures de transporteur (%)'), value: s.tolerancePct }, { k: 'toleranceMin', label: t('Tolérance minimale (montant)'), value: s.toleranceMin },
        ]} onSubmit={(v) => { if (!mgr) return Promise.resolve(); return oapi('PUT', TMS + '/settings', { ...v, depotLat: v.depotLat === '' ? null : v.depotLat, depotLng: v.depotLng === '' ? null : v.depotLng }).then(() => { toast(t('Réglages enregistrés.')); st.reload(); }); }} />
      </div>
    )}</Loaded>
  );
}

export function Network() {
  const t = useT();
  const { oapi, can, modal } = useWs();
  const mgr = can('manager');
  const st = useLoad(() => oapi('GET', TMS + '/network'), []);
  const editZone = (z) => modal(t('Zone : {name}', { name: z.name }), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'depotKm', label: t('Distance depuis le dépôt (km)'), value: z.depotKm ?? '' }, { k: 'intraKm', label: t('Distance moyenne entre deux clients de la zone (km)'), value: z.intraKm },
      { k: 'sortOrder', label: t('Rang de passage (1 = desservie en premier)'), value: z.sortOrder || '' },
      { k: 'lat', label: t('Latitude du centre (facultatif)'), value: z.lat ?? '' }, { k: 'lng', label: t('Longitude du centre (facultatif)'), value: z.lng ?? '' },
    ]} onSubmit={(v) => oapi('PUT', TMS + '/zones/' + z.id, { ...v, depotKm: v.depotKm === '' ? null : v.depotKm, lat: v.lat === '' ? null : v.lat, lng: v.lng === '' ? null : v.lng }).then(() => { close(); st.reload(); })} />
  ));
  const editKm = (zones) => modal(t('Distance entre deux zones'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'zoneA', label: t('De'), type: 'select', options: zones.map((z) => [String(z.id), z.name]) }, { k: 'zoneB', label: t('À'), type: 'select', options: zones.map((z) => [String(z.id), z.name]), value: zones[1] ? String(zones[1].id) : '' },
      { k: 'km', label: t('Distance (km, vide pour effacer)') },
    ]} onSubmit={(v) => oapi('PUT', TMS + '/zone-km', { ...v, km: v.km === '' ? null : v.km }).then(() => { close(); st.reload(); })} />
  ));
  return (
    <Loaded state={st}>{(j) => (
      <div className="ws-card">
        <div className="ws-head"><h2>{t('Réseau de livraison')}</h2>{mgr && j.zones.length > 1 ? <button className="btn primary" type="button" onClick={() => editKm(j.zones)}>{t('Distance entre zones')}</button> : null}</div>
        <p className="small muted">{t("Les livraisons avec coordonnées GPS sont ordonnées sur la distance réelle (haversine × coefficient routier). Les autres utilisent la zone : distance depuis le dépôt, distance interne et distances entre zones.")}</p>
        {!j.zones.length ? <Empty text={t('Créez d\'abord vos zones (Ressources › Zones).')} /> : null}
        {j.zones.map((z) => (
          <div className="line" key={z.id}>
            <span><b>{z.name}</b><small>{' ' + [z.depotKm === null ? t('distance au dépôt inconnue') : t('{km} km du dépôt', { km: num(z.depotKm) }), t('{km} km entre clients', { km: num(z.intraKm) }), z.sortOrder ? t('rang {n}', { n: z.sortOrder }) : '', z.lat !== null ? 'GPS' : ''].filter(Boolean).join(' · ')}</small></span>
            {mgr ? <button className="link" type="button" onClick={() => editZone(z)}>{t('Modifier')}</button> : null}
          </div>
        ))}
        {j.distances.length ? <h3>{t('Distances entre zones')}</h3> : null}
        {j.distances.map((d) => <div className="line" key={d.id}><span>{d.zoneAName + ' ↔ ' + d.zoneBName}</span><b>{num(d.km) + ' km'}</b></div>)}
      </div>
    )}</Loaded>
  );
}
