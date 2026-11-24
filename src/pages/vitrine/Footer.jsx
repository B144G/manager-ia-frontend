import { Link } from 'react-router-dom';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import { VtLogo } from './Header.jsx';
import { EMAIL, WA_DISPLAY, waLink } from './shared.js';

/** Pied de page dense : produit, ressources, compte, légal (pages existantes), contact. Aucun réseau social n'est cité tant qu'aucun lien officiel n'existe dans le code. */
export default function Footer({ onPlay }) {
  const t = useT();
  return (
    <footer className="vt-foot vt-dark" id="contact">
      <div className="vt-wrap">
        <div className="vt-footgrid">
          <div className="brand">
            <VtLogo />
            <p>{t("Gestion d'activité assistée par l'IA, en français et en FCFA. Fait au Cameroun.")}</p>
          </div>
          <nav aria-label={t('Produit')}>
            <h2>{t('Produit')}</h2>
            <ul>
              <li><a href="#fonctions">{t('Fonctions')}</a></li>
              <li><a href="#modules">{t('Modules')}</a></li>
              <li><a href="#metiers">{t('Pour qui ?')}</a></li>
              <li><a href="#tarifs">{t('Tarifs')}</a></li>
            </ul>
          </nav>
          <nav aria-label={t('Ressources')}>
            <h2>{t('Ressources')}</h2>
            <ul>
              <li><a href="#faq">{t('Questions')}</a></li>
              <li><button type="button" onClick={onPlay}>{t('Vidéo de présentation')}</button></li>
              <li><a href="/steve-brandon-tenda/">{t('Le fondateur')}</a></li>
              <li><Link to="/essai">{t('Être contacté gratuitement')}</Link></li>
            </ul>
          </nav>
          <nav aria-label={t('Informations légales')}>
            <h2>{t('Informations légales')}</h2>
            <ul>
              <li><Link to="/confidentialite">{t('Confidentialité')}</Link></li>
              <li><Link to="/conditions">{t('Conditions')}</Link></li>
              <li><Link to="/confidentialite">{t('Cookies et données')}</Link></li>
              <li><Link to="/connexion">{t('Me connecter')}</Link></li>
            </ul>
          </nav>
          <div>
            <h2>{t('Contact')}</h2>
            <ul>
              <li><a href={waLink()} target="_blank" rel="noopener noreferrer"><Fa name="whatsapp" />WhatsApp {WA_DISPLAY}</a></li>
              <li><a href={`mailto:${EMAIL}`}><Fa name="mail" />{EMAIL}</a></li>
            </ul>
          </div>
        </div>
        <div className="vt-legalrow">
          <span>© {new Date().getFullYear()} MABAH</span>
          <span>{t('Français · English · Deutsch · Español')}</span>
        </div>
      </div>
    </footer>
  );
}
