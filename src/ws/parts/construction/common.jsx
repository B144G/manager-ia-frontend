/* Libellés et petits éléments du module Chantiers. */
import { getLocale, useT } from '../../../lib/i18n.jsx';

export const STATUS = [['preparation', 'En préparation'], ['active', 'En cours'], ['suspended', 'Suspendu'], ['done', 'Terminé'], ['received', 'Réceptionné']];
export const STATUS_FR = Object.fromEntries(STATUS);
export const STATUS_TONE = { preparation: '', active: 'good', suspended: 'mid', done: 'good', received: '' };
export const CATS = [['materials', 'Matériaux'], ['labor', "Main-d'œuvre"], ['subcontract', 'Sous-traitance'], ['equipment', "Location d'engins"], ['transport', 'Transport'], ['other', 'Divers']];
export const CAT_FR = Object.fromEntries(CATS);
export const KINDS = [['incident', 'Incident'], ['safety', 'Sécurité'], ['snag', 'Réserve à lever']];
export const KIND_FR = Object.fromEntries(KINDS);
export const qty = (n) => Number(n).toLocaleString(getLocale(), { maximumFractionDigits: 3 });
export function Pill({ s }) {
  const t = useT();
  return s && s[0] ? <span className={'pill ' + s[1]}>{t(s[0])}</span> : null;
}
/** Barre d'avancement (0 à 100 %). */
export function Bar({ value, bad }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden', margin: '6px 0', width: '100%' }}>
      <div style={{ height: '100%', width: v + '%', background: bad ? 'var(--pink)' : 'var(--accent)' }} />
    </div>
  );
}
