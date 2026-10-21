/** Pastille d'état ([libellé, ton]) ; rien si le libellé est vide. */
export default function Pill({ t }) {
  return t && t[0] ? <span className={'pill ' + t[1]}>{t[0]}</span> : null;
}
