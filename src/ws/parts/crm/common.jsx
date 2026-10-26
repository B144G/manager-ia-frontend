import { getLocale, tr } from '../../../lib/i18n.jsx';

export const DST = { draft: ['Brouillon', ''], sent: ['Envoyé', 'mid'], accepted: ['Accepté', 'good'], refused: ['Refusé', 'bad'], paid: ['Payée', 'good'], cancelled: ['Annulée', 'bad'] };

export function Pill({ t }) {
  return t && t[0] ? <span className={'pill ' + t[1]}>{tr(t[0])}</span> : null;
}

/** Texte d'un devis / d'une facture, à copier ou à mettre dans un e-mail. */
export function docText(d, money, dateFr, orgName) {
  let t = (d.kind === 'quote' ? tr('Devis') : tr('Facture')) + ' ' + d.number + (d.customer ? ' — ' + d.customer : '') + '\n';
  d.lines.forEach((l) => { t += '• ' + l.label + ' : ' + l.quantity + ' × ' + Number(l.price).toLocaleString(getLocale()) + '\n'; });
  t += tr('Total : {amount}', { amount: money(d.total) });
  if (d.kind === 'invoice') {
    if (d.paid) t += '\n' + tr('Déjà payé : {paid} — Reste : {left}', { paid: money(d.paid), left: money(d.balance) });
    if (d.due) t += '\n' + tr('À payer avant le {date}', { date: dateFr(d.due) });
  }
  return t + '\n' + orgName;
}
