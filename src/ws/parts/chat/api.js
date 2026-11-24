import { useMemo } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';

/* Appels du chat : JSON via oapi (comme les autres modules) + fichiers en binaire brut (téléversement et téléchargement). */
export function useChatApi() {
  const { oapi, orgId } = useWs();
  return useMemo(() => {
    const base = `${API_BASE}/api/ws/orgs/${orgId}/chat`;
    const c = (method, path, body) => oapi(method, '/chat' + path, body);
    /** Envoie des octets bruts (fichier, vocal) ; renvoie le JSON du serveur (message créé). */
    const upload = async (query, bytes) => {
      const r = await fetch(`${base}/files?${query}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(j.error || 'Envoi impossible. Réessayez.'); e.status = r.status; throw e; }
      return j;
    };
    /** Récupère un fichier comme Blob (le navigateur envoie le cookie de connexion). */
    const fetchBytes = async (id) => {
      const r = await fetch(`${base}/files/${id}/content`, { credentials: 'include' });
      if (!r.ok) throw new Error('Fichier introuvable.');
      return r.arrayBuffer();
    };
    return { c, upload, fetchBytes, base, orgId };
  }, [oapi, orgId]);
}
