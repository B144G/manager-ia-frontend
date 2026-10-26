import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n.jsx';

export default function Plans() {
  const t = useT();
  return (
    <>
      <section className="s-sec alt" id="offres"><div className="s-wrap">
        <div className="s-head rv"><span className="s-eyebrow">{t('Tarifs')}</span><h2>{t('Commencez gratuitement, évoluez quand vous êtes prêt')}</h2><p>{t('Paiement par MTN Mobile Money ou Orange Money.')}</p></div>
        <div className="s-plans">
          <div className="s-plan rv"><h3>{t('Gratuit')}</h3><p className="pr">0 FCFA</p><p className="sub">{t('Pour découvrir la plateforme et faire un premier essai.')}</p><ul><li>{t('1 organisation')}</li><li>{t('3 personnes')}</li><li>{t('40 messages IA par mois')}</li></ul><Link to="/inscription" className="s-btn">{t('Commencer')}</Link></div>
          <div className="s-plan hot rv" style={{ '--d': '.06s' }}><span className="flag">{t('Le plus choisi')}</span><h3>{t('Pro')}</h3><p className="pr">50 000 FCFA <small>{t('/ mois')}</small></p><p className="sub">{t('Pour utiliser la plateforme au quotidien.')}</p><ul><li>{t('3 organisations')}</li><li>{t('15 personnes, 5 antennes')}</li><li>{t('1 000 messages IA par mois')}</li></ul><Link to="/inscription" className="s-btn pri">{t('Choisir Pro')}</Link></div>
          <div className="s-plan rv" style={{ '--d': '.12s' }}><h3>{t('Pro Max')}</h3><p className="pr">75 000 FCFA <small>{t('/ mois')}</small></p><p className="sub">{t('Pour les équipes et organisations plus grandes.')}</p><ul><li>{t('10 organisations')}</li><li>{t('100 personnes, 50 antennes')}</li><li>{t('2 000 messages IA par mois')}</li></ul><Link to="/inscription" className="s-btn">{t('Choisir Pro Max')}</Link></div>
        </div>
        <p className="s-note rv">{t("Pour plusieurs sites ou de grandes équipes : Méga Pro (100 000 FCFA par mois) et Illimité (150 000 FCFA par mois), avec support prioritaire. Les messages IA sont partagés par toute l'organisation et se renouvellent avec votre abonnement.")}</p>
      </div></section>
    </>
  );
}
