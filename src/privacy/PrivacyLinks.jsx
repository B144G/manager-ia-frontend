import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n.jsx';

/** Lien vers le centre de confidentialité (affiché en bas de la sécurité du compte). */
export default function PrivacyLinks() {
  const t = useT();
  return <p className="small muted" style={{ marginTop: 14 }}>{t('Vos données et vos droits :')} <Link to="/app/confidentialite">{t('Confidentialité et mes données')}</Link></p>;
}
