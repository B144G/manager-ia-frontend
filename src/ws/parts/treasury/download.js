import { API_BASE } from '../../../lib/api.js';

/** Télécharge un fichier du serveur (PDF, Excel) avec la session de l'utilisateur, puis le propose à l'enregistrement. */
export async function fileGet(orgId, path, name) {
  const r = await fetch(`${API_BASE}/api/ws/orgs/${orgId}${path}`, { credentials: 'include' });
  if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.error || 'Une erreur est survenue. Réessayez.'); e.status = r.status; throw e; }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
