export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const MN = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

/** « il y a 5 min », « hier »… ; `dateFr` pour les dates anciennes. */
export function ago(iso, dateFr) {
  if (!iso) return '';
  const d = new Date(iso);
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return 'il y a ' + m + ' min';
  const hh = Math.round(m / 60);
  if (hh < 24) return 'il y a ' + hh + ' h';
  const j = Math.round(hh / 24);
  if (j === 1) return 'hier';
  if (j < 7) return 'il y a ' + j + ' j';
  return dateFr(iso);
}

/** « aujourd'hui », « demain », jour de la semaine, ou date. */
export function when(due, today, dateFr) {
  const t = new Date(today + 'T00:00:00');
  const d = new Date(due + 'T00:00:00');
  const n = Math.round((d - t) / 86400000);
  if (n < 0) return 'en retard (' + dateFr(due) + ')';
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n < 7) return JOURS[d.getDay()];
  return dateFr(due);
}
