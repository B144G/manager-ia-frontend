import { Suspense, lazy, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, Loading, useLoad, Icon } from '../../ui.jsx';
import { Legend, REASON_LABEL, StatePill, TG, useAge } from './common.jsx';

const GeoMap = lazy(() => import('./GeoMap.jsx'));

/* Réglages de la géolocalisation, fiches des transporteurs (véhicule, statut manuel, position saisie) et journal d'audit. */
const STATES = [['', 'Automatique'], ['available', 'Disponible (forcé)'], ['absent', 'Absent'], ['out_of_service', 'Hors service'], ['full', 'Chargement plein'], ['busy', 'En mission (manuel)']];

function DriverForm({ d, vehicles, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const [pos, setPos] = useState(d.position ? { lat: d.position.lat, lng: d.position.lng } : null);
  return (
    <div className="geo-drv">
      <Form
        submitText={t('Enregistrer')}
        fields={[
          { k: 'vehicleId', label: t('Véhicule habituel'), type: 'select', options: [['', t('Aucun')]].concat(vehicles.map((v) => [String(v.id), v.plate + (v.capacityKg ? ' · ' + v.capacityKg + ' kg' : '')])), value: d.vehicle ? String(d.vehicle.id) : '' },
          { k: 'manualState', label: t('Statut'), type: 'select', options: STATES.map((x) => [x[0], t(x[1])]), value: d.manualState || '', hint: t('« Automatique » : calculé (absent, en mission, hors service, chargement plein). Un statut manuel prime, sauf un blocage réel (permis ou papiers périmés).') },
          { k: 'manualReason', label: t('Motif (facultatif)'), value: d.manualReason || '' },
          { k: 'manualUntil', label: t("Jusqu'à (facultatif)"), type: 'datetime-local', value: d.manualUntil ? d.manualUntil.slice(0, 16) : '' },
        ]}
        onSubmit={(v) => oapi('PUT', TG + '/drivers/' + d.id, { vehicleId: v.vehicleId || null, manualState: v.manualState, manualReason: v.manualReason, manualUntil: v.manualUntil ? new Date(v.manualUntil).toISOString() : null }).then(() => { close(); done(); })}
      />
      <h4>{t('Saisir sa position à la main')}</h4>
      <p className="muted small">{t("Utile quand le transporteur vous a donné sa position par téléphone. Cliquez sur la carte, puis enregistrez.")}</p>
      <Suspense fallback={<Loading />}><GeoMap drivers={pos ? [{ id: d.id, name: d.name, available: d.available, position: { ...pos, state: 'fresh' } }] : []} onPick={(la, ln) => setPos({ lat: la, lng: ln })} height={240} /></Suspense>
      <button type="button" className="ui-btn" disabled={!pos} onClick={() => oapi('POST', TG + '/drivers/' + d.id + '/position', pos).then(() => { close(); done(); })}><Icon name="location-dot" />{t('Enregistrer cette position')}</button>
    </div>
  );
}

export default function GeoAdmin() {
  const t = useT();
  const { oapi, can, modal, confirm, toast, fail, dateFr } = useWs();
  const age = useAge();
  const owner = can('admin');
  const st = useLoad(async () => ({ drv: await oapi('GET', TG + '/drivers'), fleet: await oapi('GET', '/logistics/fleet'), audit: owner ? await oapi('GET', TG + '/audit?limit=60') : { audit: [] } }), []);
  const KIND = { consent_granted: 'Consentement donné', consent_revoked: 'Consentement retiré', shift_on: 'Début de service', shift_off: 'Fin de service', position_manual: 'Position saisie à la main', map_view: 'Carte consultée', request_created: 'Lien envoyé au client', request_cancelled: 'Lien annulé', client_located: 'Client localisé', client_position_set: 'Position du client posée', assign: 'Affectation', purge: 'Purge', manual_state: 'Statut manuel', history_erased: 'Historique effacé', settings: 'Réglages modifiés' };
  return (
    <Loaded state={st}>{(j) => {
      const s = j.drv.settings;
      return (
        <div className="geo-admin">
          <Legend staleMin={s.staleMin} />
          <section className="geo-card">
            <h3>{t('Transporteurs')}</h3>
            <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={t('Fiches des transporteurs')}>
              <table className="ui-table">
                <thead><tr><th scope="col">{t('Transporteur')}</th><th scope="col">{t('État')}</th><th scope="col">{t('Véhicule')}</th><th scope="col">{t('Accord')}</th><th scope="col">{t('Position')}</th><th scope="col" /></tr></thead>
                <tbody>{j.drv.drivers.map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.name}</b>{!d.userId ? <div className="muted small">{t('Sans compte relié : position saisie à la main')}</div> : null}</td>
                    <td><StatePill d={d} /></td>
                    <td>{d.vehicle ? d.vehicle.plate : '—'}</td>
                    <td>{d.userId ? (d.consent ? <span className="pill good">{d.shiftOn ? t('En service') : t('Accord donné')}</span> : <span className="pill">{t('Pas d\'accord')}</span>) : '—'}</td>
                    <td>{d.position ? age(d.position.ageMin) : <span className="muted">—</span>}</td>
                    <td className="r"><button type="button" className="ui-btn sm" onClick={() => modal(t('Transporteur : {name}', { name: d.name }), (close) => <DriverForm d={d} vehicles={j.fleet.vehicles} close={close} done={st.reload} />, { wide: true })}>{t('Modifier')}</button>
                      <button type="button" className="ui-btn sm" onClick={() => confirm(t("Effacer l'historique des positions de {name} ?", { name: d.name }), () => oapi('DELETE', TG + '/drivers/' + d.id + '/history').then(() => { toast(t('Historique effacé.')); st.reload(); }).catch(fail), t('Effacer'))}>{t('Effacer l\'historique')}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {!j.drv.drivers.length ? <Empty text={t("Aucun chauffeur : créez-les dans Parc.")} /> : null}
          </section>
          {owner ? (
            <section className="geo-card">
              <h3>{t('Vie privée et conservation')}</h3>
              <Form
                submitText={t('Enregistrer')}
                fields={[
                  { k: 'staleMin', label: t('Position « ancienne » après (minutes)'), value: s.staleMin }, { k: 'lostMin', label: t('Position masquée après (minutes)'), value: s.lostMin },
                  { k: 'retentionDays', label: t('Conservation des positions (jours)'), value: s.retentionDays, hint: t('Passé ce délai, les positions sont supprimées automatiquement (1 à 90 jours).') },
                  { k: 'shiftMaxH', label: t('Durée maximale d\'un service (heures)'), value: s.shiftMaxH }, { k: 'pingMin', label: t('Envoi de la position toutes les (minutes)'), value: s.pingMin },
                ]}
                onSubmit={(v) => oapi('PUT', TG + '/settings', Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x)]))).then(() => { toast(t('Réglages enregistrés.')); st.reload(); })}
              />
            </section>
          ) : null}
          {owner ? (
            <section className="geo-card">
              <h3>{t("Journal d'audit")}</h3>
              <p className="muted small">{t('Consentements, début et fin de service, consultations de la carte, localisation des clients, affectations. Conservé un an.')}</p>
              <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={t("Journal d'audit")}>
                <table className="ui-table">
                  <thead><tr><th scope="col">{t('Date')}</th><th scope="col">{t('Événement')}</th><th scope="col">{t('Par')}</th><th scope="col">{t('Transporteur')}</th></tr></thead>
                  <tbody>{j.audit.audit.map((a) => <tr key={a.id}><td>{dateFr(a.at.slice(0, 10))} {a.at.slice(11, 16)}</td><td>{t(KIND[a.kind] || a.kind)}</td><td>{a.user || t('Client (lien)')}</td><td>{a.driver || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          ) : null}
          <p className="muted small">{t('Motifs d\'indisponibilité : {a}', { a: Object.values(REASON_LABEL).map((x) => t(x)).join(', ') })}</p>
        </div>
      );
    }}</Loaded>
  );
}
