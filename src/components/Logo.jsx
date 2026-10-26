import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n.jsx';

export default function Logo({ className = '', style, footer }) {
  const t = useT();
  return (
    <Link className={('s-logo ' + className).trim()} to="/" style={style} aria-label={footer ? undefined : t('MANAGER-IA, accueil')}>
      <i>MI</i><span>MANAGER<b>-IA</b></span>
    </Link>
  );
}
