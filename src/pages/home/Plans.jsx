import { Link } from 'react-router-dom';

export default function Plans() {
  return (
    <>
      <section className="s-sec alt" id="offres"><div className="s-wrap">
        <div className="s-head rv"><span className="s-eyebrow">Tarifs</span><h2>Commencez gratuitement, évoluez quand vous êtes prêt</h2><p>Paiement par MTN Mobile Money ou Orange Money.</p></div>
        <div className="s-plans">
          <div className="s-plan rv"><h3>Gratuit</h3><p className="pr">0 FCFA</p><p className="sub">Pour découvrir la plateforme et faire un premier essai.</p><ul><li>1 organisation</li><li>3 personnes</li><li>40 messages IA par mois</li></ul><Link to="/inscription" className="s-btn">Commencer</Link></div>
          <div className="s-plan hot rv" style={{ '--d': '.06s' }}><span className="flag">Le plus choisi</span><h3>Pro</h3><p className="pr">50 000 FCFA <small>/ mois</small></p><p className="sub">Pour utiliser la plateforme au quotidien.</p><ul><li>3 organisations</li><li>15 personnes, 5 antennes</li><li>1 000 messages IA par mois</li></ul><Link to="/inscription" className="s-btn pri">Choisir Pro</Link></div>
          <div className="s-plan rv" style={{ '--d': '.12s' }}><h3>Pro Max</h3><p className="pr">75 000 FCFA <small>/ mois</small></p><p className="sub">Pour les équipes et organisations plus grandes.</p><ul><li>10 organisations</li><li>100 personnes, 50 antennes</li><li>2 000 messages IA par mois</li></ul><Link to="/inscription" className="s-btn">Choisir Pro Max</Link></div>
        </div>
        <p className="s-note rv">Pour plusieurs sites ou de grandes équipes : Méga Pro (100 000 FCFA par mois) et Illimité (150 000 FCFA par mois), avec support prioritaire. Les messages IA sont partagés par toute l'organisation et se renouvellent avec votre abonnement.</p>
      </div></section>
    </>
  );
}
