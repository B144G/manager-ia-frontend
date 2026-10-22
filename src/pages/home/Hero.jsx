import { Link } from 'react-router-dom';

export default function Hero({ onPlay }) {
  return (
    <section className="s-hero"><div className="s-wrap s-herogrid">
      <div className="s-herotxt">
      <a className="s-pill" href="#modules"><span>Gestion, ventes et comptabilité</span><b>Voir</b></a>
      <h1>Gérez votre entreprise avec une IA qui travaille pour vous</h1>
      <p className="lead">MANAGER-IA répond à vos clients sur WhatsApp, suit votre stock, vos factures, votre équipe et votre comptabilité. <b>Elle propose, vous validez.</b></p>
      <div className="s-cta">
        <Link to="/inscription" className="s-btn pri big">Essayer gratuitement</Link>
        <button className="s-btn big" type="button" id="playBtn" onClick={onPlay}><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none" /></svg>Voir la vidéo (1 min 15)</button>
      </div>
      <ul className="s-trust"><li>Gratuit pour commencer</li><li>Paiement MTN et Orange Money</li><li>En français, avec support sur WhatsApp</li></ul>

      </div>
      <button type="button" className="s-vidprev" onClick={onPlay} aria-label="Lancer la vidéo de présentation">
        <img src="/video/poster.jpg" alt="Aperçu de la vidéo de présentation de MANAGER-IA" width="1280" height="720" />
        <span className="pl"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none" /></svg></span>
        <small>Voir la vidéo · 1 min 15</small>
      </button>
    </div></section>
  );
}
