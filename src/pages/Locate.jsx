import { Suspense, lazy, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OrgLogo, { PublicFoot } from '../components/OrgLogo.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { Icon } from '../lib/fa.jsx';
import { rq } from '../lib/api.js';
import { getLang, useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';
import { gpsHere, searchAddress } from '../ws/parts/geo/geocode.js';
import '../styles/ws-geo.css';

const GeoMap = lazy(() => import('../ws/parts/geo/GeoMap.jsx'));

/** Page publique où le client indique où il se trouve (lien secret reçu par WhatsApp ou SMS) : adresse, point posé sur la carte,
    ou position GPS du téléphone — partagée seulement après une case à cocher (consentement). Aucun compte. */
export default function Locate() {
  const t = useT();
  const { token } = useParams();
  const [info, setInfo] = useState(null); const [err, setErr] = useState('');
  const [pt, setPt] = useState(null); const [source, setSource] = useState('pin'); const [accuracy, setAccuracy] = useState(null);
  const [q, setQ] = useState(''); const [res, setRes] = useState(null); const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { rq('GET', '/api/ws/public/geo/' + encodeURIComponent(token)).then((j) => { setInfo(j); if (j.location) { setPt(j.location); setSource('pin'); } if (j.address) setQ(j.address); }, (e) => setErr(e.message)); }, [token]);
  const find = (e) => {
    e.preventDefault(); setBusy(true); setNote('');
    searchAddress(q, getLang()).then((r) => { setRes(r); if (!r.length) setNote(t('Aucune adresse trouvée : touchez la carte pour poser le point.')); }).catch(() => setNote(t("La recherche d'adresse est indisponible : touchez la carte pour poser le point."))).finally(() => setBusy(false));
  };
  const share = () => {
    if (!consent) { setNote(t('Cochez la case pour accepter de partager votre position.')); return; }
    setBusy(true); setNote('');
    gpsHere().then((p) => { setPt({ lat: p.lat, lng: p.lng }); setAccuracy(p.accuracy); setSource('gps'); }).catch(() => setNote(t("Position indisponible : autorisez la localisation dans votre navigateur, ou touchez la carte."))).finally(() => setBusy(false));
  };
  const send = () => {
    setBusy(true); setNote('');
    rq('POST', '/api/ws/public/geo/' + encodeURIComponent(token), { source, lat: pt.lat, lng: pt.lng, accuracy, consent: source === 'gps' ? true : undefined, address: q || undefined }).then(() => setDone(true), (e) => setNote(tsrv(e.message))).finally(() => setBusy(false));
  };
  const closed = info && (info.status === 'expired' || info.status === 'cancelled' || info.assigned);
  return (
    <div className="au-main" style={{ minHeight: '100vh' }}>
      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}><LangSwitch /></div>
      <OrgLogo kind="geo" token={token} />
      <div className="au-card loc-card">
        <h1>{t('Où devons-nous vous livrer ?')}</h1>
        {info ? <p className="au-sub">{t('{org} · bonjour {name}', { org: info.org, name: info.name })}</p> : null}
        {err ? <p className="hm-err" role="alert">{tsrv(err)}</p> : null}
        {!info && !err ? <p>{t('Chargement…')}</p> : null}
        {done ? <p className="loc-ok" role="status"><Icon name="ok" /> {t('Merci ! Votre position est transmise. Vous pouvez fermer cette page.')}</p> : null}
        {info && closed && !done ? <p role="status">{info.assigned ? t('Votre livraison est déjà organisée : contactez la boutique pour la modifier.') : t('Ce lien a expiré : demandez-en un nouveau à la boutique.')}</p> : null}
        {info && !closed && !done ? (
          <>
            <form onSubmit={find} className="geo-search-row">
              <label className="sr-only" htmlFor="loc-q">{t('Votre adresse')}</label>
              <input id="loc-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rue, quartier, ville…')} autoComplete="street-address" />
              <button type="submit" className="ui-btn" disabled={busy || q.trim().length < 3}><Icon name="search" />{t('Rechercher')}</button>
            </form>
            <small className="muted">{t("La recherche utilise le service gratuit d'OpenStreetMap : l'adresse saisie lui est transmise.")}</small>
            {res && res.length ? <ul className="geo-results">{res.map((r, i) => <li key={i}><button type="button" onClick={() => { setPt({ lat: r.lat, lng: r.lng }); setSource('address'); setRes(null); }}>{r.label}</button></li>)}</ul> : null}
            <Suspense fallback={<p>{t('Chargement…')}</p>}><GeoMap client={pt} onPick={(la, ln) => { setPt({ lat: la, lng: ln }); setSource('pin'); setAccuracy(null); }} height={300} ariaLabel={t('Carte : touchez pour poser le point de livraison')} /></Suspense>
            <p className="muted small">{t('Touchez la carte pour déplacer le point.')}</p>
            <div className="loc-gps">
              <label className="geo-chk"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{t("J'accepte de partager la position GPS de mon téléphone avec {org}, uniquement pour organiser cette livraison. Elle est conservée 14 jours.", { org: info.org })}</label>
              <button type="button" className="ui-btn" onClick={share} disabled={busy}><Icon name="location-dot" />{t('Utiliser ma position GPS')}</button>
            </div>
            {note ? <p className="ws-err" role="alert">{note}</p> : null}
            <button type="button" className="ui-btn primary loc-send" disabled={busy || !pt} onClick={send}><Icon name="check" />{t('Valider ma position')}</button>
          </>
        ) : null}
      </div>
      <PublicFoot />
    </div>
  );
}
