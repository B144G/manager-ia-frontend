import { useT } from '../lib/i18n.jsx';
import { Link } from 'react-router-dom';
import Security from '../privacy/Security.jsx';
import { useWs } from './WsContext.jsx';

/** Sécurité du compte (fenêtre de l'espace de travail) : mêmes blocs que la page « Confidentialité et mes données › Sécurité du compte ». */
export default function AccountSecurity() {
  const t = useT();
  const { orgId } = useWs();
  return (
    <div className="pv-body">
      <Security orgId={orgId} />
      <p className="small muted">{t('Vos données et vos droits :')} <Link to="/app/confidentialite">{t('Confidentialité et mes données')}</Link></p>
    </div>
  );
}
