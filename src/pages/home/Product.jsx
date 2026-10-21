import { Link } from 'react-router-dom';

export default function Product() {
  return (
    <>
      <section className="s-sec" id="produit"><div className="s-wrap">
        <div className="s-head rv"><span className="s-eyebrow">Ce qu'elle fait pour vous</span><h2>Tout ce qu'il faut pour gérer, au même endroit</h2><p>Plus de cahiers, de fichiers éparpillés ni de messages perdus. Une seule IA connaît votre activité et vous aide au quotidien.</p></div>
        <div className="s-bento">
          <article className="s-tile wide rv">
            <div><span className="ic"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4zM9 9l2 2 4-4" /></svg></span>
              <h3>Elle répond à vos clients, jour et nuit</h3>
              <p>Après une publicité Facebook, vos prospects vous écrivent. L'IA répond avec vos vrais prix, comprend les messages vocaux et les fautes, enregistre la personne et prend sa commande. Vous la validez.</p>
              <a className="more" href="#histoire">Voir comment ça se passe →</a></div>
            <div className="img" data-zoom="" tabIndex={0} role="button" aria-label="Agrandir l'aperçu"><img src="/assets/img/ventes-ligne.svg" alt="Un prospect discute avec l'assistant, est enregistré et passe une commande à valider" width="640" height="420" loading="lazy" /></div>
          </article>
          <article className="s-tile rv" style={{ '--d': '.06s' }}>
            <span className="ic"><svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" /></svg></span>
            <h3>Elle surveille votre stock</h3>
            <p>Alerte avant la rupture, fournisseurs comparés, commande proposée. Vous validez.</p>
            <div className="img" data-zoom="" tabIndex={0} role="button" aria-label="Agrandir l'aperçu"><img src="/assets/img/stock.svg" alt="Stock avec alertes de rupture et commande à valider" width="640" height="420" loading="lazy" /></div>
          </article>
          <article className="s-tile rv">
            <span className="ic"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /></svg></span>
            <h3>Elle facture et relance</h3>
            <p>Devis, factures, impayés : l'IA rédige la relance, vous l'envoyez en un clic.</p>
            <div className="img" data-zoom="" tabIndex={0} role="button" aria-label="Agrandir l'aperçu"><img src="/assets/img/clients.svg" alt="Clients, factures, impayés et message de relance" width="640" height="420" loading="lazy" /></div>
          </article>
          <article className="s-tile rv" style={{ '--d': '.06s' }}>
            <span className="ic"><svg viewBox="0 0 24 24"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5" /></svg></span>
            <h3>Elle tient votre comptabilité</h3>
            <p>Vos factures et paiements deviennent des écritures. Résultat, bilan simplifié et TVA estimée à tout moment.</p>
            <div className="img" data-zoom="" tabIndex={0} role="button" aria-label="Agrandir l'aperçu"><img src="/assets/img/comptabilite.svg" alt="Comptabilité : journal d'écritures et compte de résultat" width="640" height="420" loading="lazy" /></div>
          </article>
          <article className="s-tile rv" style={{ '--d': '.12s' }}>
            <span className="ic"><svg viewBox="0 0 24 24"><path d="M3 5h18v14H3zM8 11a2 2 0 100-4 2 2 0 000 4zM5 16a3 3 0 016 0M14 9h5M14 13h4" /></svg></span>
            <h3>Elle organise votre équipe</h3>
            <p>Employés, congés, planning de la semaine, sans chevauchement. Chacun voit ce qui le concerne.</p>
            <div className="img" data-zoom="" tabIndex={0} role="button" aria-label="Agrandir l'aperçu"><img src="/assets/img/rh.svg" alt="Planning de la semaine et demande de congé" width="640" height="420" loading="lazy" /></div>
          </article>
        </div>
        <div className="s-cta rv"><Link to="/inscription" className="s-btn pri big">Créer mon espace gratuit</Link><a className="s-btn big" href="#modules">Voir toutes les sous-applications</a></div>
      </div></section>
    </>
  );
}
