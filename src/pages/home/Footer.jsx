import { Link } from 'react-router-dom';
import Logo from '../../components/Logo.jsx';

export default function Footer() {
  return (
    <footer className="s-foot"><div className="s-wrap">
      <div><Logo footer /><p><small>Gestion d'activité assistée par l'IA. Fait au Cameroun.</small></p></div>
      <nav aria-label="Liens du pied de page"><a href="#modules">Modules</a><a href="#offres">Tarifs</a><a href="#faq">Questions</a><Link to="/connexion">Se connecter</Link></nav>
    </div></footer>
  );
}
