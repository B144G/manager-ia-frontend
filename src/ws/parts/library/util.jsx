import { getLocale } from '../../../lib/i18n.jsx';
import { BLOCK_ICONS } from './api.js';

export function BlockIcon({ name, size = 28 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} className="lib-ico" aria-hidden="true" focusable="false"><path d={BLOCK_ICONS[name] || BLOCK_ICONS.folder} /></svg>;
}
export const LockIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" className="lib-ico" aria-hidden="true" focusable="false"><path d={BLOCK_ICONS.lock} /></svg>;

/** Taille lisible : 1 234 567 → « 1,2 Mo ». */
export function bytes(n, t) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} ${t('o')}`;
  if (v < 1048576) return `${(v / 1024).toFixed(v < 10240 ? 1 : 0)} ${t('Ko')}`;
  return `${(v / 1048576).toFixed(v < 10485760 ? 1 : 0)} ${t('Mo')}`;
}
export function when(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short' });
}
export const hm = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }); };
export const day = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(getLocale());
};
/** Couleur de l'en-tête : la couleur du bloc assombrie, pour que le texte blanc reste lisible. */
export const headColor = (c) => `color-mix(in srgb, ${/^#[0-9a-f]{6}$/i.test(c) ? c : '#2f6f5e'} 80%, #000)`;
export function kindOf(mime) {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'IMG';
  if (/^(audio|video)\//.test(mime)) return 'A/V';
  if (mime === 'text/plain') return 'TXT';
  return 'DOC';
}
