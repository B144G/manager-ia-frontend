import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n.jsx';

export default function Logo({ className = '', style, footer }) {
  const t = useT();
  return (
    <Link className={('s-logo ' + className).trim()} to="/" style={style} aria-label={footer ? undefined : t('Brij-IA, accueil')}>
      <img src="/logo.svg" alt="" width="38" height="38" /><span>Brij<b>-IA</b></span>
    </Link>
  );
}
