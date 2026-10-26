import { Link } from 'react-router-dom';
import Showcase from './Showcase.jsx';

/** Une seule section : ce que fait MANAGER-IA, ce qu'il contient, et pourquoi on peut lui faire confiance. */
export default function Essentials() {
  return (
    <section className="s-sec" id="modules"><div className="s-wrap">
      <div className="s-head rv"><span className="s-eyebrow">Tout en un</span><h2>Toute votre entreprise, au même endroit</h2><p>Une IA qui connaît votre activité, et les outils d'un vrai logiciel de gestion.</p></div>
      <div className="s-pillars">
        <div className="rv"><h3>Elle répond à vos clients</h3><p>Sur WhatsApp, jour et nuit, avec vos vrais prix. Elle enregistre le client et prend sa commande.</p></div>
        <div className="rv" style={{ '--d': '.06s' }}><h3>Elle gère votre activité</h3><p>Ventes, stock, factures, paie, comptabilité, production, chantiers : tout est relié, rien n'est saisi deux fois.</p></div>
        <div className="rv" style={{ '--d': '.12s' }}><h3>Vous gardez le contrôle</h3><p>Elle propose, vous validez. Accès par rôle, double authentification et journal d'audit infalsifiable.</p></div>
      </div>
      <div className="rv"><Showcase /></div>
      <div className="s-cta rv"><Link to="/inscription" className="s-btn pri big">Créer mon espace gratuit</Link></div>
    </div></section>
  );
}
