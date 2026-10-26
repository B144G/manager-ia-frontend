import { Link } from 'react-router-dom';
import { SUPPORT_WHATSAPP } from '../../lib/api.js';
import { useT } from '../../lib/i18n.jsx';

export default function Final() {
  const t = useT();
  return (
    <section className="s-final" id="contact">
      <h2>{t('Confiez la gestion quotidienne de votre activité à une IA')}</h2>
      <p>{t("L'offre Gratuite vous permet de tout découvrir, sans carte bancaire.")}</p>
      <div className="s-cta">
        <Link to="/inscription" className="s-btn big">{t('Créer mon espace gratuit')}</Link>
        <a className="s-btn big" href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">{t('Une question ? WhatsApp')}</a>
      </div>
    </section>
  );
}
