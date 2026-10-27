import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n.jsx';

export default function Hero({ onPlay }) {
  const t = useT();
  return (
    <section className="s-hero"><div className="s-wrap s-herogrid">
      <div className="s-herotxt">
      <a className="s-pill" href="#modules"><span>{t('Gestion, ventes et comptabilité')}</span><b>{t('Voir')}</b></a>
      <h1>{t('Gérez votre entreprise avec une IA qui travaille pour vous')}</h1>
      <p className="lead">{t('Brij-IA répond à vos clients sur WhatsApp, suit votre stock, vos factures, votre équipe et votre comptabilité.')} <b>{t('Elle propose, vous validez.')}</b></p>
      <div className="s-cta">
        <Link to="/inscription" className="s-btn pri big">{t('Essayer gratuitement')}</Link>
        <button className="s-btn big" type="button" id="playBtn" onClick={onPlay}><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none" /></svg>{t('Voir la vidéo (1 min 30)')}</button>
      </div>
      <ul className="s-trust"><li>{t('Gratuit pour commencer')}</li><li>{t('Paiement MTN et Orange Money')}</li><li>{t('En français, avec support sur WhatsApp')}</li></ul>

      </div>
      <button type="button" className="s-vidprev" onClick={onPlay} aria-label={t("Lancer la vidéo de présentation")}>
        <img src="/video/poster.jpg" alt={t("Aperçu de la vidéo de présentation de Brij-IA")} width="1280" height="720" />
        <span className="pl"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none" /></svg></span>
        <small>{t('Voir la vidéo · 1 min 30')}</small>
      </button>
    </div></section>
  );
}
