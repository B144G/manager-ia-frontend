import { Suspense, lazy, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Icon, Loaded, Loading, useLoad } from '../../ui.jsx';
import { AddressSearch } from './common.jsx';

const GeoMap = lazy(() => import('./GeoMap.jsx'));

/* Position de l'entreprise (facultative) : partagée volontairement avec l'administration de Brij-IA (carte et statistiques par pays et par ville).
   Jamais visible des autres entreprises ; arrondie à environ 100 m ; modifiable et retirable à tout moment. */
export default function OrgPosition() {
  const t = useT();
  const { oapi, toast, fail, confirm, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/geo'), []);
  return <Loaded state={st}>{(j) => <Editor geo={j.geo} reload={st.reload} oapi={oapi} toast={toast} fail={fail} confirm={confirm} dateFr={dateFr} t={t} />}</Loaded>;
}

function Editor({ geo, reload, oapi, toast, fail, confirm, dateFr, t }) {
  const [pt, setPt] = useState(geo.shared ? { lat: geo.lat, lng: geo.lng } : null);
  const [city, setCity] = useState(geo.city); const [country, setCountry] = useState(geo.country);
  const [consent, setConsent] = useState(false); const [pick, setPick] = useState(false); const [busy, setBusy] = useState(false);
  const save = () => { setBusy(true); oapi('PUT', '/geo', { lat: pt.lat, lng: pt.lng, city, country, consent }).then(() => { toast(t("Position de l'entreprise enregistrée.")); setConsent(false); reload(); }).catch(fail).finally(() => setBusy(false)); };
  return (
    <section className="ws-card geo-card" aria-label={t("Position de l'entreprise")}>
      <h3><Icon name="location-dot" />{t("Position de l'entreprise")}</h3>
      <p className="muted">{geo.shared ? t('Position partagée le {d} : {c}.', { d: dateFr(geo.sharedAt.slice(0, 10)), c: [geo.city, geo.country].filter(Boolean).join(', ') }) : t("Facultatif. Indiquez où se trouve votre entreprise : Brij-IA s'en sert pour des statistiques par pays et par ville.")}</p>
      <AddressSearch initial={geo.address} onPick={(p) => { setPt({ lat: p.lat, lng: p.lng }); setPick(false); }} gps />
      <Suspense fallback={<Loading />}><GeoMap client={pt} onPick={(la, ln) => { setPt({ lat: la, lng: ln }); setPick(true); }} height={260} ariaLabel={t("Carte : position de l'entreprise")} /></Suspense>
      <p className="muted small">{pick ? t('Point posé. ') : ''}{t('Cliquez sur la carte pour poser ou déplacer le point.')}</p>
      <div className="geo-search-row">
        <label className="fld grow"><span>{t('Ville')}</span><input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} /></label>
        <label className="fld grow"><span>{t('Pays')}</span><input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} /></label>
      </div>
      <label className="geo-chk"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{t("J'accepte de partager la position de mon entreprise (arrondie à environ 100 m) avec l'administration de Brij-IA. Les autres entreprises ne la voient jamais. Je peux la retirer à tout moment.")}</label>
      <div className="row">
        <button type="button" className="ui-btn primary" disabled={busy || !pt || !consent || !country.trim()} onClick={save}><Icon name="check" />{t('Partager la position')}</button>
        {geo.shared ? <button type="button" className="ui-btn" onClick={() => confirm(t('Retirer la position de votre entreprise ?'), () => oapi('DELETE', '/geo').then(() => { toast(t('Position retirée.')); setPt(null); reload(); }).catch(fail), t('Retirer'))}><Icon name="ban" />{t('Retirer la position')}</button> : null}
      </div>
    </section>
  );
}
