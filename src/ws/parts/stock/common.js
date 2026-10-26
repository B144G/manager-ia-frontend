/** Nombre affiché selon la langue (3 décimales au plus). */
import { getLocale } from '../../../lib/i18n.jsx';

export const qty = (n) => Number(n).toLocaleString(getLocale(), { maximumFractionDigits: 3 });
export const STATE = { out: ['Rupture', 'bad'], low: ['Sous le seuil', 'mid'], ok: ['', ''] };
export const ORDER = { pending: ['À valider', 'mid'], ordered: ['Commandée', 'good'], received: ['Reçue', 'good'], cancelled: ['Annulée', 'bad'] };
