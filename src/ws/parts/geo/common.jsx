import { useState } from 'react';
import { useT, getLang } from '../../../lib/i18n.jsx';
import { Icon } from '../../ui.jsx';
import { searchAddress, gpsHere } from './geocode.js';

/* Éléments communs de la géolocalisation : légende, état d'un transporteur, âge d'une position, recherche d'adresse. */
export const TG = '/logistics/tms/geo';
export const REASON_LABEL = { absent: 'Absent', on_mission: 'En mission', out_of_service: 'Hors service', full: 'Chargement plein' };
export const BLOCK_LABEL = { license: 'Permis périmé', vehicle: 'Véhicule hors parc', papers: 'Papiers du véhicule périmés' };

/** « il y a 5 min », « il y a 2 h 10 ». */
export function useAge() {
  const t = useT();
  return (m) => (m === null || m === undefined ? t('Position inconnue') : m < 1 ? t("à l'instant") : m < 60 ? t('il y a {n} min', { n: m }) : t('il y a {h} h {m} min', { h: Math.floor(m / 60), m: m % 60 }));
}

/** Pastille d'état : vert (disponible) ou rouge (indisponible) avec le motif ; le signe ✓ / ✕ double la couleur. */
export function StatePill({ d }) {
  const t = useT();
  const why = d.available ? '' : t(REASON_LABEL[d.reason] || 'Indisponible');
  return <span className={'pill ' + (d.available ? 'good' : 'bad')}>{d.available ? '✓ ' + t('Disponible') : '✕ ' + why}{d.manual ? ' · ' + t('manuel') : ''}</span>;
}

export function Legend({ staleMin }) {
  const t = useT();
  return (
    <ul className="geo-legend" aria-label={t('Légende de la carte')}>
      <li><span className="geo-pin ok sm"><span>✓</span></span>{t('Disponible')}</li>
      <li><span className="geo-pin bad sm"><span>✕</span></span>{t('Indisponible (absent, en mission, hors service, chargement plein)')}</li>
      <li><span className="geo-pin ok stale sm"><span>✓</span></span>{t('Position ancienne (plus de {n} min)', { n: staleMin || 30 })}</li>
      <li><span className="geo-pin client sm"><span>★</span></span>{t('Client')}</li>
      <li><span className="geo-pin depot sm"><span>D</span></span>{t('Dépôt')}</li>
    </ul>
  );
}

/** Recherche d'une adresse (OpenStreetMap / Nominatim) sur demande, et position GPS de cet appareil. onPick({lat, lng, label}). */
export function AddressSearch({ initial = '', onPick, gps = false }) {
  const t = useT();
  const [q, setQ] = useState(initial); const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = (e) => {
    if (e) e.preventDefault();
    setBusy(true); setErr('');
    searchAddress(q, getLang()).then((r) => { setRes(r); if (!r.length) setErr(t('Aucune adresse trouvée : posez le point à la main sur la carte.')); }).catch(() => setErr(t("La recherche d'adresse est indisponible : posez le point à la main sur la carte."))).finally(() => setBusy(false));
  };
  const here = () => { setBusy(true); setErr(''); gpsHere().then((p) => onPick({ ...p, label: '', source: 'gps' })).catch(() => setErr(t("Position de l'appareil indisponible (autorisation refusée ?)."))).finally(() => setBusy(false)); };
  return (
    <div className="geo-search">
      <form onSubmit={go} className="geo-search-row">
        <label className="sr-only" htmlFor="geo-q">{t('Adresse à rechercher')}</label>
        <input id="geo-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rue, quartier, ville…')} autoComplete="off" />
        <button type="submit" className="ui-btn" disabled={busy || q.trim().length < 3}><Icon name="search" />{t('Rechercher')}</button>
        {gps ? <button type="button" className="ui-btn" onClick={here} disabled={busy}><Icon name="location-dot" />{t('Ma position')}</button> : null}
      </form>
      <small className="muted">{t("La recherche utilise le service gratuit d'OpenStreetMap : l'adresse saisie lui est transmise. Vous pouvez aussi poser le point à la main.")}</small>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      {res && res.length ? <ul className="geo-results">{res.map((r, i) => <li key={i}><button type="button" onClick={() => { onPick({ ...r, source: 'address' }); setRes(null); }}>{r.label}</button></li>)}</ul> : null}
    </div>
  );
}
