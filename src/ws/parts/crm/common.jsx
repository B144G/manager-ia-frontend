export const DST = { draft: ['Brouillon', ''], sent: ['Envoyé', 'mid'], accepted: ['Accepté', 'good'], refused: ['Refusé', 'bad'], paid: ['Payée', 'good'], cancelled: ['Annulée', 'bad'] };

export function Pill({ t }) {
  return t && t[0] ? <span className={'pill ' + t[1]}>{t[0]}</span> : null;
}

/** Texte d'un devis / d'une facture, à copier ou à mettre dans un e-mail. */
export function docText(d, money, dateFr, orgName) {
  let t = (d.kind === 'quote' ? 'Devis ' : 'Facture ') + d.number + (d.customer ? ' — ' + d.customer : '') + '\n';
  d.lines.forEach((l) => { t += '• ' + l.label + ' : ' + l.quantity + ' × ' + Number(l.price).toLocaleString('fr-FR') + '\n'; });
  t += 'Total : ' + money(d.total);
  if (d.kind === 'invoice') {
    if (d.paid) t += '\nDéjà payé : ' + money(d.paid) + ' — Reste : ' + money(d.balance);
    if (d.due) t += '\nÀ payer avant le ' + dateFr(d.due);
  }
  return t + '\n' + orgName;
}
