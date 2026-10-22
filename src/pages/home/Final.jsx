import { Link } from 'react-router-dom';
import { SUPPORT_WHATSAPP } from '../../lib/api.js';

export default function Final() {
  return (
    <section className="s-final" id="contact">
      <h2>Confiez la gestion quotidienne de votre activité à une IA</h2>
      <p>L'offre Gratuite vous permet de tout découvrir, sans carte bancaire.</p>
      <div className="s-cta">
        <Link to="/inscription" className="s-btn big">Créer mon espace gratuit</Link>
        <a className="s-btn big" href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">Une question ? WhatsApp</a>
      </div>
    </section>
  );
}
