/** Pastille d'état ([libellé, ton]) ; rien si le libellé est vide. */
import { tr } from '../../../lib/i18n.jsx';

export default function Pill({ t }) {
  return t && t[0] ? <span className={'pill ' + t[1]}>{tr(t[0])}</span> : null;
}
