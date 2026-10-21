/** Nombre affiché à la française (3 décimales au plus). */
export const qty = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
export const STATE = { out: ['Rupture', 'bad'], low: ['Sous le seuil', 'mid'], ok: ['', ''] };
export const ORDER = { pending: ['À valider', 'mid'], ordered: ['Commandée', 'good'], received: ['Reçue', 'good'], cancelled: ['Annulée', 'bad'] };
