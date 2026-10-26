import { getLocale } from './i18n.jsx';

export const initials = (n) => (n || '?').split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
export const firstName = (n) => (n ? String(n).split(' ')[0] : '');
/** Date AAAA-MM-JJ affichée selon la langue choisie (le nom est conservé pour ne rien casser). */
export const dateFr = (d) => { if (!d) return ''; const p = String(d).slice(0, 10).split('-'); if (p.length !== 3) return d; try { return new Intl.DateTimeFormat(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12))); } catch { return `${p[2]}/${p[1]}/${p[0]}`; } };
export const today = () => new Date().toISOString().slice(0, 10);
/** Montant avec espaces insécables classiques (toutes les polices savent les afficher). */
export const formatMoney = (n, currency = 'FCFA') => `${Number(n || 0).toLocaleString('fr-FR').replace(/ /g, ' ')} ${currency}`;
