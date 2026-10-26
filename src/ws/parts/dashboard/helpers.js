import { getLocale, tr } from '../../../lib/i18n.jsx';

/** Nom du mois (0 = janvier) ou du jour (0 = dimanche) dans la langue choisie. */
export const monthName = (i, style = 'long') => new Intl.DateTimeFormat(getLocale(), { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, i, 15)));
export const dayName = (i) => new Intl.DateTimeFormat(getLocale(), { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + i)));
export const MN = (i) => monthName(i, 'short');

/** « il y a 5 min », « hier »… ; `dateFr` pour les dates anciennes. */
export function ago(iso, dateFr) {
  if (!iso) return '';
  const d = new Date(iso);
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 1) return tr("à l'instant");
  if (m < 60) return tr('il y a {n} min', { n: m });
  const hh = Math.round(m / 60);
  if (hh < 24) return tr('il y a {n} h', { n: hh });
  const j = Math.round(hh / 24);
  if (j === 1) return tr('hier');
  if (j < 7) return tr('il y a {n} j', { n: j });
  return dateFr(iso);
}

/** « aujourd'hui », « demain », jour de la semaine, ou date. */
export function when(due, today, dateFr) {
  const t = new Date(today + 'T00:00:00');
  const d = new Date(due + 'T00:00:00');
  const n = Math.round((d - t) / 86400000);
  if (n < 0) return tr('en retard ({date})', { date: dateFr(due) });
  if (n === 0) return tr("aujourd'hui");
  if (n === 1) return tr('demain');
  if (n < 7) return dayName(d.getDay());
  return dateFr(due);
}
