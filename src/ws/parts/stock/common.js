/** Nombre affiché selon la langue (3 décimales au plus). */
import { getLocale } from '../../../lib/i18n.jsx';

export const qty = (n) => Number(n).toLocaleString(getLocale(), { maximumFractionDigits: 3 });
export const STATE = { out: ['Rupture', 'bad'], low: ['Sous le seuil', 'mid'], over: ['Surstock', 'mid'], ok: ['', ''] };
export const ORDER = { pending: ['À valider', 'mid'], ordered: ['Commandée', 'good'], partial: ['Reçue en partie', 'mid'], received: ['Reçue', 'good'], cancelled: ['Annulée', 'bad'] };
