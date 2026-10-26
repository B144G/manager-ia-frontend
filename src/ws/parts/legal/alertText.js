import { tr } from '../../../lib/i18n.jsx';

/** Rappels d'un contrat renvoyés par le serveur en français : les dates et nombres sont repris pour reconstruire la phrase traduite. */
export function alertText(a, dateFr) {
  const x = a.text || '';
  let m;
  if (a.code === 'expired' && (m = /depuis le (\d{4}-\d{2}-\d{2})/.exec(x))) {
    return x.startsWith('Terminé') ? tr('Terminé depuis le {date} (reconduction tacite : vérifiez si le contrat continue)', { date: dateFr(m[1]) }) : tr('Expiré depuis le {date}', { date: dateFr(m[1]) });
  }
  if ((a.code === 'end7' || a.code === 'end30') && (m = /dans (\d+)/.exec(x))) return tr('Se termine dans {n} jour(s)', { n: m[1] });
  if (a.code === 'notice_passed' && (m = /\((\d{4}-\d{2}-\d{2})\)/.exec(x))) {
    return x.includes('reconduire') ? tr('Date limite de préavis dépassée ({date}) : le contrat peut se reconduire', { date: dateFr(m[1]) }) : tr('Date limite de préavis dépassée ({date})', { date: dateFr(m[1]) });
  }
  if ((a.code === 'notice7' || a.code === 'notice30') && (m = /avant le (\d{4}-\d{2}-\d{2}) \((\d+)/.exec(x))) return tr('Préavis à envoyer avant le {date} ({n} jour(s))', { date: dateFr(m[1]), n: m[2] });
  return tr(x);
}
