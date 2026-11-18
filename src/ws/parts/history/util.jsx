import { useEffect, useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useT } from '../../../lib/i18n.jsx';
import { Icon } from '../../ui/index.jsx';

/* Histoire de l'entreprise : constantes, aides de date, et affichage des médias (images / vidéos lues avec le cookie de session, jamais par une adresse publique). */

export const CATEGORY_IDS = ['creation', 'recruitment', 'contract', 'award', 'launch', 'meeting', 'move', 'training', 'crisis', 'loss', 'dispute', 'incident', 'financial', 'departure', 'other'];
export const GOOD = 'var(--ok)';
export const BAD = 'var(--danger)';

/** Libellés (à passer par t() à l'appel : les chaînes sont écrites en toutes lettres pour être détectées par le contrôle des traductions). */
export function useLabels() {
  const t = useT();
  const cat = {
    creation: t('Création'), recruitment: t('Recrutement'), contract: t('Contrat'), award: t('Récompense'), launch: t('Lancement'), meeting: t('Rencontre / partenariat'),
    move: t('Déménagement'), training: t('Formation'), crisis: t('Crise'), loss: t('Perte'), dispute: t('Litige'), incident: t('Incident'), financial: t('Difficulté financière'),
    departure: t('Départ'), other: t('Autre'),
  };
  const level = [t('Fondateur'), t('Direction générale'), t('Directeur'), t('Responsable'), t("Chef d'équipe"), t('Employé'), t('Stagiaire / apprenti'), t('Autre niveau 7'), t('Autre niveau 8'), t('Autre niveau 9')];
  const nature = { good: t('Moment fort'), bad: t('Moment dur') };
  const vis = { internal: t('Toute l’entreprise'), direction: t('Direction seulement') };
  return { cat, level, nature, vis };
}

export const yearOf = (d) => Number(String(d || '').slice(0, 4)) || 0;
export const frDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
export const today = () => new Date().toISOString().slice(0, 10);

/** État d'une personne pour une année : null (pas encore arrivée), 'active', 'leaving' (part cette année-là), 'former' (partie avant). Même règle que le serveur (GET /history/tree). */
export function stateIn(p, year) {
  const s = yearOf(p.startDate); const e = yearOf(p.endDate);
  if (s && s > year) return null;
  if (e && e < year) return 'former';
  if (e && e === year) return 'leaving';
  return 'active';
}

export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');

// ---------- Médias ----------
const cache = new Map(); // id -> Promise<objectURL>
export const mediaPath = (orgId, id) => `${API_BASE}/api/ws/orgs/${orgId}/history/media/${id}/file`;
export function loadMedia(orgId, id) {
  const k = orgId + ':' + id;
  if (!cache.has(k)) {
    cache.set(k, fetch(mediaPath(orgId, id), { credentials: 'include', cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('media ' + r.status);
      return r.blob();
    }).then((b) => URL.createObjectURL(b)).catch((e) => { cache.delete(k); throw e; }));
  }
  return cache.get(k);
}
export function forgetMedia(orgId, id) {
  const k = orgId + ':' + id;
  const p = cache.get(k);
  if (p) p.then((u) => URL.revokeObjectURL(u), () => {});
  cache.delete(k);
}

/** Image d'un média (miniature ou grande). Pendant le chargement ou en cas d'erreur : une pastille neutre. */
export function Pic({ orgId, id, alt, className, fallback }) {
  const [src, setSrc] = useState(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    setSrc(null); setBad(false);
    if (id) loadMedia(orgId, id).then((u) => { if (live) setSrc(u); }, () => { if (live) setBad(true); });
    return () => { live = false; };
  }, [orgId, id]);
  if (src) return <img src={src} alt={alt || ''} className={className} loading="lazy" />;
  return <span className={'hst-ph ' + (className || '')} aria-hidden={!bad}>{bad ? <Icon name="warn" /> : fallback || <Icon name="image" />}</span>;
}

/** Lecteur vidéo : le fichier est lu avec le cookie puis donné au lecteur (sous forme de blob). */
export function Video({ orgId, id, label }) {
  const t = useT();
  const [src, setSrc] = useState(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    setSrc(null); setBad(false);
    loadMedia(orgId, id).then((u) => { if (live) setSrc(u); }, () => { if (live) setBad(true); });
    return () => { live = false; };
  }, [orgId, id]);
  if (bad) return <p className="ws-err" role="alert">{t('Cette vidéo ne peut pas être lue.')}</p>;
  if (!src) return <p className="muted small" role="status">{t('Chargement de la vidéo…')}</p>;
  return <video className="hst-video" src={src} controls preload="metadata" playsInline aria-label={label} />;
}

/** Envoie un fichier (corps brut) — renvoie la réponse JSON. */
export async function uploadMedia(orgId, file, params) {
  const q = new URLSearchParams({ name: file.name });
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '' && v !== false) q.set(k, v === true ? '1' : String(v)); });
  const r = await fetch(`${API_BASE}/api/ws/orgs/${orgId}/history/media?${q}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Une erreur est survenue. Réessayez.'); e.status = r.status; throw e; }
  return j;
}

/** Télécharge un fichier produit par le serveur (PDF, CSV) avec le cookie de session. */
export async function downloadFile(orgId, path, filename) {
  const r = await fetch(`${API_BASE}/api/ws/orgs/${orgId}/history${path}`, { credentials: 'include', cache: 'no-store' });
  if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.error || 'Une erreur est survenue. Réessayez.'); e.status = r.status; throw e; }
  const blob = await r.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
