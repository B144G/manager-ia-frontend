import { Link } from 'react-router-dom';
import Logo from '../../components/Logo.jsx';
import { useT } from '../../lib/i18n.jsx';

export default function Footer() {
  const t = useT();
  return (
    <footer className="s-foot"><div className="s-wrap">
      <div><Logo footer /><p><small>{t("Gestion d'activité assistée par l'IA. Fait au Cameroun.")}</small></p></div>
      <nav aria-label={t("Liens du pied de page")}><a href="#modules">{t("Modules")}</a><a href="#offres">{t("Tarifs")}</a><a href="#faq">{t("Questions")}</a><Link to="/confidentialite">{t("Confidentialité")}</Link><Link to="/conditions">{t("Conditions")}</Link><Link to="/connexion">{t("Se connecter")}</Link></nav>
    </div></footer>
  );
}
