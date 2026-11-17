import { useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';
import { useT, getLocale } from '../../../lib/i18n.jsx';

/* Transport (TMS) : petits éléments communs. Tout texte passe par React (échappé), jamais de HTML brut. */
export const TMS = '/logistics/tms';
export const num = (n, d = 1) => (n === null || n === undefined ? '—' : Number(n).toLocaleString(getLocale(), { maximumFractionDigits: d }));
export const pct = (n) => (n === null || n === undefined ? '—' : num(n) + ' %');
export const TRIP_TONE = { planned: 'mid', dispatched: 'mid', in_progress: 'mid', done: 'good', cancelled: 'bad' };
export const TRIP_LABEL = { planned: 'Planifiée', dispatched: 'Répartie', in_progress: 'En cours', done: 'Terminée', cancelled: 'Annulée' };
export const DEL_TONE = { to_prepare: 'mid', shipped: 'mid', on_route: 'mid', delivered: 'good', failed: 'bad', returned: 'bad' };
export const REASONS = [['absent', 'Client absent'], ['address', 'Adresse introuvable'], ['refused', 'Refus du client'], ['damaged', 'Marchandise abîmée'], ['no_cash', 'Paiement impossible'], ['closed', 'Fermé'], ['access', 'Accès impossible'], ['other', 'Autre motif']];
export const PRIORITY = [['0', 'Normale'], ['1', 'Haute'], ['2', 'Urgente']];

/** Fichier du serveur (PDF, CSV, image) avec le cookie de connexion : ouvert dans un onglet, sinon téléchargé. */
export function useFile() {
  const t = useT();
  const { orgId, fail } = useWs();
  return (path, name, { download = false } = {}) => fetch(API_BASE + '/api/ws/orgs/' + orgId + path, { credentials: 'include' })
    .then((r) => { if (!r.ok) throw new Error(t('Document indisponible.')); return r.blob(); })
    .then((b) => {
      const url = URL.createObjectURL(b);
      const w = download ? null : window.open(url, '_blank', 'noopener');
      if (!w) { const a = document.createElement('a'); a.href = url; a.download = name || 'document'; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }).catch(fail);
}
/** Envoi d'un fichier brut (image) vers le serveur. */
export function useUpload() {
  const { orgId } = useWs();
  return async (path, blob) => {
    const r = await fetch(API_BASE + '/api/ws/orgs/' + orgId + path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Envoi impossible.'); e.status = r.status; throw e; }
    return j;
  };
}
/** Action serveur avec garde contre le double clic ; recharge ensuite. */
export function useRun(reload) {
  const { fail, toast } = useWs();
  const [busy, setBusy] = useState(false);
  const go = (p, okMsg) => { if (busy) return Promise.resolve(); setBusy(true); return p.then((j) => { if (okMsg) toast(okMsg); if (reload) reload(); return j; }).catch(fail).finally(() => setBusy(false)); };
  return [go, busy];
}
/** Jauge de chargement (0 à 100 %, rouge au-delà). */
export function Gauge({ value, label }) {
  if (value === null || value === undefined) return null;
  const v = Math.max(0, Math.min(100, Number(value)));
  return <span className="tms-gauge" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}><span className={Number(value) > 100 ? 'over' : Number(value) >= 85 ? 'high' : ''} style={{ width: v + '%' }} /></span>;
}
export function Pill({ tone, children }) { return <span className={'pill ' + (tone || '')}>{children}</span>; }
export const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
