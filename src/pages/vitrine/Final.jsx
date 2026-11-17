import { Link } from 'react-router-dom';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import { waLink } from './shared.js';

export default function Final() {
  const t = useT();
  return (
    <section className="vt-final" aria-labelledby="vt-fin">
      <div className="vt-wrap">
        <div className="vt-finalbox">
          <h2 className="vt-h2" id="vt-fin">{t('Prêt à reprendre la main sur votre entreprise ?')}</h2>
          <p>{t("Créez votre espace gratuit en quelques minutes, sans carte bancaire. Une question ? Écrivez-nous sur WhatsApp : nous vous répondons.")}</p>
          <div className="vt-cta">
            <Link to="/inscription" className="vt-btn vt-btn--light vt-btn--lg">{t('Essai gratuit')}<Fa name="arrow-right" /></Link>
            <a className="vt-btn vt-btn--ghost-dark vt-btn--lg" href={waLink(t('Bonjour, je voudrais en savoir plus sur Brij-IA.'))} target="_blank" rel="noopener noreferrer"><Fa name="whatsapp" />{t('Écrire sur WhatsApp')}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
