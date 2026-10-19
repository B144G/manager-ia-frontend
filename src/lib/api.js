// Appels au serveur (API). Les adresses « /api/... » restent sur le domaine du site : en développement Vite les renvoie vers le serveur,
// sur Vercel c'est vercel.json qui les renvoie vers Render. VITE_API_BASE permet d'appeler un autre domaine directement.
export const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
export const SUPPORT_WHATSAPP = String(import.meta.env.VITE_SUPPORT_WHATSAPP || '237653621388').replace(/\D/g, '');

/** Requête JSON avec cookie de connexion. Lève une Error (avec .status) portant le message du serveur. */
export async function rq(method, path, body, opts = {}) {
  const r = await fetch(API_BASE + path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: opts.signal,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Une erreur est survenue. Réessayez.'); e.status = r.status; throw e; }
  return j;
}
/** API de l'espace de travail : /api/ws/... */
export const api = (method, path, body) => rq(method, '/api/ws' + path, body);
