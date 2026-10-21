import { Link } from 'react-router-dom';

export default function Hero({ onPlay }) {
  return (
    <section className="s-hero"><div className="s-wrap">
      <a className="s-pill" href="#produit"><span>Gestion, ventes et comptabilité</span><b>Voir</b></a>
      <h1>Gérez votre entreprise avec une IA qui travaille pour vous</h1>
      <p className="lead">MANAGER-IA répond à vos clients sur WhatsApp, suit votre stock, vos factures, votre équipe et votre comptabilité. <b>Elle propose, vous validez.</b></p>
      <div className="s-cta">
        <Link to="/inscription" className="s-btn pri big">Essayer gratuitement</Link>
        <button className="s-btn big" type="button" id="playBtn" onClick={onPlay}><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none" /></svg>Voir la vidéo (1 min 15)</button>
      </div>
      <ul className="s-trust"><li>Gratuit pour commencer</li><li>Paiement MTN et Orange Money</li><li>En français, avec support sur WhatsApp</li></ul>

      <div className="s-stage">
        <div className="s-fl a" aria-hidden="true"><i>✓</i><div><b>Commande à valider</b><span>C-2026-0012 · 30 000 FCFA</span></div></div>
        <div className="s-fl b" aria-hidden="true"><i>↗</i><div><b>3 factures relancées</b><span>412 000 FCFA à récupérer</span></div></div>
        <div className="s-fl c" aria-hidden="true"><i>!</i><div><b>Stock critique</b><span>Tissu wax rouge : 4 restants</span></div></div>
        <div className="s-shot">
          <img src="/assets/img/gestion.svg" alt="Tableau de bord MANAGER-IA : demandes, projets, solde, graphique et point de situation de l'IA" width="640" height="420" />
        </div>
      </div>
    </div></section>
  );
}
