import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import { useT } from '../lib/i18n.jsx';
import { assetUrl, useBrand, usePublicBrand } from '../lib/brand.js';

/* En-tête et pied des pages publiques d'une entreprise (formulaire, suivi, devis, localisation, satisfaction, discussion) :
   logo et nom de l'entreprise si elle les a personnalisés ; sinon le logo Brij-IA d'origine, sans aucun changement. */
export default function OrgLogo({ kind, token, className = 'au-logo', style = { display: 'flex' } }) {
  const b = usePublicBrand(kind, token);
  if (!b.customized) return <Logo className={className} style={style} />;
  return (
    <div className={('s-logo ' + className).trim()} style={style}>
      {b.logoUrl ? <img src={assetUrl(b.logoUrl)} alt="" width="38" height="38" style={{ objectFit: 'contain' }} /> : null}
      <span>{b.name}</span>
    </div>
  );
}

/** Pied discret : texte de l'entreprise, « Propulsé par Brij-IA » si elle le souhaite, et toujours les liens légaux de la plateforme. */
export function PublicFoot() {
  const t = useT();
  const b = useBrand();
  if (!b.customized) return null;
  return (
    <footer className="muted" style={{ textAlign: 'center', fontSize: 'var(--fs-sm, 13px)', padding: '16px 12px' }}>
      {b.footerText ? <p style={{ margin: '0 0 4px' }}>{b.footerText}</p> : null}
      {b.poweredBy ? <p style={{ margin: '0 0 4px' }}>{t('Propulsé par {name}', { name: b.platformName })}</p> : null}
      <nav aria-label={t('Informations légales')}>
        <Link to="/conditions">{t('Conditions')}</Link> · <Link to="/confidentialite">{t('Confidentialité')}</Link> · <Link to="/mentions-legales">{t('Mentions légales')}</Link>
      </nav>
    </footer>
  );
}
