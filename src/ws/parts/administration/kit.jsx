import { createContext, useContext, useMemo } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Badge, Button, Card, Form, Loaded, useLoad } from '../../ui.jsx';

/* Administration : outils communs aux écrans. Rien ici ne décide d'un droit : le serveur contrôle tout, l'écran n'affiche que ce qu'il renvoie. */

export const AdmCtx = createContext(null);
export const useAdm = () => useContext(AdmCtx);

/** Appel à /api/ws/orgs/:id/administration/... ; corps brut (Blob) pour les fichiers ; opts.blob pour recevoir un fichier. */
export async function call(orgId, method, path, body, opts = {}) {
  const headers = {};
  let payload;
  if (typeof Blob !== 'undefined' && body instanceof Blob) { headers['Content-Type'] = 'application/octet-stream'; payload = body; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(`${API_BASE}/api/ws/orgs/${orgId}/administration${path}`, { method, credentials: 'include', headers, body: payload, cache: 'no-store' });
  if (opts.blob && r.ok) return r.blob();
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Une erreur est survenue. Réessayez.'); e.status = r.status; e.code = j.code; throw e; }
  return j;
}
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Charge un point d'accès du module et se recharge quand le compteur global change. */
export function useData(path, deps = []) {
  const { api, tick } = useAdm();
  return useLoad(() => api('GET', path), [path, tick, ...deps]);
}

/** Tonalité d'une pastille selon une clé d'état (même vocabulaire partout). */
const TONE = { ok: 'ok', active: 'ok', approved: 'ok', done: 'ok', fulfilled: 'ok', achieved: 'ok', in_use: 'ok', booked: 'ok', public: 'neutral', internal: 'neutral', reviewed: 'info', draft: 'neutral', pending: 'warn', waiting: 'warn', new: 'info', todo: 'warn', doing: 'info', in_progress: 'info', open: 'warn', restricted: 'warn', secret: 'danger', rejected: 'danger', ko: 'danger', overdue: 'danger', expired: 'danger', obsolete: 'neutral', cancelled: 'neutral', terminated: 'neutral', archived: 'info', destroyed: 'neutral', high: 'danger', medium: 'warn', low: 'info', critical: 'danger', partial: 'warn', repair: 'warn', retired: 'neutral', lost: 'danger', stock: 'info', mitigated: 'ok', accepted: 'info', closed: 'neutral', na: 'neutral', notice_soon: 'warn', notice_missed: 'danger', ending_soon: 'warn', open_ended: 'neutral' };
export function Pill({ k, children }) { return <Badge tone={TONE[k] || 'neutral'}>{children}</Badge>; }

/** Options de personnes de l'organisation (pour les listes déroulantes). */
export function useMembers() {
  const { cfg } = useAdm();
  return useMemo(() => (cfg ? cfg.members : []), [cfg]);
}
export const memberOptions = (members, t, none = true) => [...(none ? [['', t('— Personne —')]] : []), ...members.map((m) => [String(m.userId), m.name])];

/** Fenêtre de formulaire : ouvre la modale commune avec un Form, ferme et recharge à la réussite. */
export function useFormModal() {
  const { modal, toast } = useWs();
  const { reload } = useAdm();
  const t = useT();
  return (title, fields, submit, o = {}) => {
    const close = modal(title, (cl) => (
      <Form fields={fields} submitText={o.submitText || t('Enregistrer')} onSubmit={async (v) => { await submit(v); cl(); if (o.ok !== false) toast(o.done || t('Enregistré.')); reload(); }} />
    ), { wide: o.wide });
    return close;
  };
}

export function Section({ title, subtitle, actions, children }) {
  return <Card title={title} subtitle={subtitle} actions={actions}>{children}</Card>;
}
export function Kpis({ children }) { return <div className="adm-kpis">{children}</div>; }
export function Grid({ children, cols = 2 }) { return <div className={'adm-grid c' + cols}>{children}</div>; }

/** Charge un point d'accès et affiche son contenu. */
export function View({ path, children, deps }) {
  const st = useData(path, deps);
  return <Loaded state={st}>{(d) => children(d, st)}</Loaded>;
}
export function Perm({ ok, children }) { return ok ? children : null; }

export const toInt = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
export const num = (v) => (v === '' || v === undefined || v === null ? undefined : Number(String(v).replace(/\s/g, '').replace(',', '.')));
export { Button };
