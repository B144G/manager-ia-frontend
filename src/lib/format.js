export const initials = (n) => (n || '?').split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
export const firstName = (n) => (n ? String(n).split(' ')[0] : '');
export const dateFr = (d) => { if (!d) return ''; const p = String(d).slice(0, 10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };
export const today = () => new Date().toISOString().slice(0, 10);
/** Montant avec espaces insécables classiques (toutes les polices savent les afficher). */
export const formatMoney = (n, currency = 'FCFA') => `${Number(n || 0).toLocaleString('fr-FR').replace(/ /g, ' ')} ${currency}`;
