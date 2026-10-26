/* Libellés et petits éléments du module Maintenance. */
import { getLocale, tr, useT } from '../../../lib/i18n.jsx';

export const KIND = [['machine', 'Machine'], ['vehicle', 'Véhicule'], ['building', 'Bâtiment'], ['tool', 'Outil'], ['it', 'Informatique']];
export const KIND_FR = Object.fromEntries(KIND);
export const EQ_STATUS = [['running', 'En service'], ['broken', 'En panne'], ['stopped', "À l'arrêt"], ['retired', 'Réformé']];
export const EQ_TONE = { running: 'good', broken: 'bad', stopped: 'mid', retired: '' };
export const EQ_FR = Object.fromEntries(EQ_STATUS);
export const PRIO = [['low', 'Basse'], ['normal', 'Normale'], ['high', 'Haute'], ['urgent', 'Urgente']];
export const PRIO_FR = Object.fromEntries(PRIO);
export const ORDER_FR = { open: ['Ouverte', 'mid'], in_progress: ['En cours', 'good'], done: ['Terminée', ''] };
export const PERIOD = [['days', 'Tous les X jours'], ['hours', 'Toutes les X heures de marche'], ['km', 'Tous les X km']];
export const qty = (n) => Number(n).toLocaleString(getLocale(), { maximumFractionDigits: 3 });
export function Pill({ s }) {
  const t = useT();
  return s && s[0] ? <span className={'pill ' + s[1]}>{t(s[0])}</span> : null;
}
/** Texte de l'échéance d'un plan. */
export function dueText(p, dateFr) {
  if (p.periodKind === 'days') return p.left < 0 ? tr('en retard de {n} jour(s) (échéance {date})', { n: Math.abs(p.left), date: dateFr(p.nextDueAt) }) : p.left === 0 ? tr("à faire aujourd'hui") : tr('dans {n} jour(s) ({date})', { n: p.left, date: dateFr(p.nextDueAt) });
  const u = p.periodKind === 'km' ? 'km' : 'h';
  return p.left <= 0 ? tr('dépassé de {n} {unit}', { n: qty(Math.abs(p.left)), unit: u }) : tr('dans {n} {unit} (à {at} {unit})', { n: qty(p.left), unit: u, at: qty(p.nextMeter) });
}
