import { Link } from 'react-router-dom';

export default function Logo({ className = '', style, footer }) {
  return (
    <Link className={('s-logo ' + className).trim()} to="/" style={style} aria-label={footer ? undefined : 'MANAGER-IA, accueil'}>
      <i>MI</i><span>MANAGER<b>-IA</b></span>
    </Link>
  );
}
