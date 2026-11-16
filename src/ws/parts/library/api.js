import { API_BASE } from '../../../lib/api.js';

/* Appels de la Bibliothèque. Les documents sont envoyés en corps brut (jamais en JSON) et lus avec le cookie de session ;
   le mot de passe de déverrouillage ne passe que dans le corps d'une requête POST : jamais dans l'adresse ni dans le stockage du navigateur. */
export async function call(orgId, method, path, body, opts = {}) {
  const headers = {};
  let payload;
  if (typeof Blob !== 'undefined' && body instanceof Blob) { headers['Content-Type'] = 'application/octet-stream'; payload = body; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(`${API_BASE}/api/ws/orgs/${orgId}/library${path}`, { method, credentials: 'include', headers, body: payload, cache: 'no-store' });
  if (opts.blob && r.ok) return r.blob();
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error || 'Une erreur est survenue. Réessayez.');
    e.status = r.status; e.code = j.code;
    throw e;
  }
  return j;
}
export const fileUrl = (orgId, id, kind, version) => `${API_BASE}/api/ws/orgs/${orgId}/library/docs/${id}/${kind}${version ? '?version=' + version : ''}`;

/** Icônes des blocs (tracés SVG simples, 24 × 24). */
export const BLOCK_ICONS = {
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  cart: 'M3 4h2l2 11h11l2-8H6M9 20h.01M17 20h.01',
  wallet: 'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l2-3h12M16 14h3',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 010 6M18 14c2 .8 3 3 3 6',
  ruler: 'M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2',
  factory: 'M3 21V10l6 4V10l6 4V6h6v15zM7 17h2M12 17h2M17 17h2',
  hardhat: 'M4 17h16M5 17v-2a7 7 0 0114 0v2M12 8V5M10 5h4',
  box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
  scale: 'M12 4v16M6 20h12M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z',
  book: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18M12 16a4 4 0 100-8 4 4 0 000 8M12 12h.01',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 9.5h.01',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8M4 21c0-4 3.6-7 8-7s8 3 8 7',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  building: 'M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2',
};
