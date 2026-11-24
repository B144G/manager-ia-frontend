import { rq } from './api.js';

/* Choix de cookies et de mesure d'audience.
   - Rien d'optionnel n'est activé avant un choix explicite (refuser = ne rien envoyer).
   - Le choix est mémorisé dans le navigateur avec la version du texte et la date ; il est redemandé si le texte change.
   - Connecté, le choix est aussi enregistré côté serveur (échec silencieux). */

export const COOKIES_VERSION = '2026-11-16';
const KEY = 'mabah-cookies';
const OPEN_EVENT = 'mabah:cookies-open';
const CHANGE_EVENT = 'mabah:cookies-change';

/** Choix enregistré { v, at, analytics } ou null (aucun choix, ou texte modifié depuis). */
export function readConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && c.v === COOKIES_VERSION && typeof c.analytics === 'boolean' && Date.now() - Date.parse(c.at) < 365 * 864e5) return c; // validité : 12 mois, comme annoncé dans la politique de cookies
  } catch { /* stockage indisponible ou illisible : comme s'il n'y avait aucun choix */ }
  return null;
}

/** La mesure d'audience (compteur de visites) n'est permise que si l'utilisateur l'a acceptée. */
export const hasAnalyticsConsent = () => { const c = readConsent(); return Boolean(c && c.analytics); };

/** Enregistre le choix { analytics: true|false } et prévient le reste du site. */
export function saveConsent({ analytics }) {
  const c = { v: COOKIES_VERSION, at: new Date().toISOString(), analytics: Boolean(analytics) };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* stockage indisponible : le choix vaut pour cette page seulement */ }
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: c })); } catch { /* ignoré */ }
  rq('POST', '/api/privacy/consents', { kind: 'cookies', accepted: c.analytics }).catch(() => {}); // non connecté : sans importance
  return c;
}

/** Ouvre le panneau « Gérer mes cookies » (à appeler depuis le pied de page ou la page Cookies). */
export function openCookieSettings() {
  try { window.dispatchEvent(new CustomEvent(OPEN_EVENT)); } catch { /* ignoré */ }
}

export function onCookieSettingsOpen(fn) { window.addEventListener(OPEN_EVENT, fn); return () => window.removeEventListener(OPEN_EVENT, fn); }
export function onConsentChange(fn) { const h = (e) => fn(e.detail); window.addEventListener(CHANGE_EVENT, h); return () => window.removeEventListener(CHANGE_EVENT, h); }
