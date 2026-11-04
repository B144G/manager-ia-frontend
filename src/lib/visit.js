import { API_BASE } from './api.js';

/* Compteur de visites anonyme : une page vue = un compteur de plus côté serveur (page, origine, type d'appareil).
   Aucun cookie, aucun identifiant, aucune adresse enregistrée. Le signal « Ne pas me suivre » du navigateur est respecté.
   Seules les pages publiques sont comptées (jamais l'espace de travail). */
const COUNTED = new Set(['/', '/confidentialite', '/conditions', '/connexion', '/inscription', '/essai']);

export function trackVisit(pathname) {
  try {
    const path = (pathname || '/').replace(/\/+$/, '') || '/';
    if (!COUNTED.has(path)) return;
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    const key = 'brij-seen:' + path;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* stockage indisponible : on compte quand même */ }
    const q = new URLSearchParams(window.location.search);
    const utm = q.get('utm_source') || q.get('src') || '';
    fetch(API_BASE + '/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, ref: document.referrer || '', utm }), keepalive: true, credentials: 'omit' }).catch(() => {});
  } catch { /* le comptage ne doit jamais gêner la page */ }
}
