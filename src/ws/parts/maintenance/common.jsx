/* Libellés et petits éléments du module Maintenance. */
export const KIND = [['machine', 'Machine'], ['vehicle', 'Véhicule'], ['building', 'Bâtiment'], ['tool', 'Outil'], ['it', 'Informatique']];
export const KIND_FR = Object.fromEntries(KIND);
export const EQ_STATUS = [['running', 'En service'], ['broken', 'En panne'], ['stopped', "À l'arrêt"], ['retired', 'Réformé']];
export const EQ_TONE = { running: 'good', broken: 'bad', stopped: 'mid', retired: '' };
export const EQ_FR = Object.fromEntries(EQ_STATUS);
export const PRIO = [['low', 'Basse'], ['normal', 'Normale'], ['high', 'Haute'], ['urgent', 'Urgente']];
export const PRIO_FR = Object.fromEntries(PRIO);
export const ORDER_FR = { open: ['Ouverte', 'mid'], in_progress: ['En cours', 'good'], done: ['Terminée', ''] };
export const PERIOD = [['days', 'Tous les X jours'], ['hours', 'Toutes les X heures de marche'], ['km', 'Tous les X km']];
export const qty = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
export function Pill({ t }) {
  return t && t[0] ? <span className={'pill ' + t[1]}>{t[0]}</span> : null;
}
/** Texte de l'échéance d'un plan. */
export function dueText(p, dateFr) {
  if (p.periodKind === 'days') return p.left < 0 ? 'en retard de ' + Math.abs(p.left) + ' jour(s) (échéance ' + dateFr(p.nextDueAt) + ')' : p.left === 0 ? "à faire aujourd'hui" : 'dans ' + p.left + ' jour(s) (' + dateFr(p.nextDueAt) + ')';
  const u = p.periodKind === 'km' ? 'km' : 'h';
  return p.left <= 0 ? 'dépassé de ' + qty(Math.abs(p.left)) + ' ' + u : 'dans ' + qty(p.left) + ' ' + u + ' (à ' + qty(p.nextMeter) + ' ' + u + ')';
}
