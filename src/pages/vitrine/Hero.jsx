import { Link } from 'react-router-dom';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import { shot, waLink } from './shared.js';

/** Premier écran : promesse, deux boutons, vraie capture de l'application (données d'exemple), faits vérifiables. */
export default function Hero({ onPlay, modules }) {
  const t = useT();
  return (
    <section className="vt-hero" aria-labelledby="vt-h1">
      <div className="vt-wrap">
        <div className="vt-herogrid">
          <div className="vt-herotxt">
            <span className="vt-badge"><i />{t('Fait au Cameroun · en français, en FCFA')}</span>
            <h1 className="vt-h1" id="vt-h1">{t('Tout votre commerce au même endroit, avec une IA qui répond à vos clients')}</h1>
            <p className="vt-lead">{t('Brij-IA réunit ventes, stock, factures, comptabilité, paie et équipe. Son assistant répond à vos clients sur WhatsApp.')} <b>{t('Il propose, vous validez.')}</b></p>
            <div className="vt-cta">
              <Link to="/inscription" className="vt-btn vt-btn--primary vt-btn--lg">{t('Essai gratuit')}<Fa name="arrow-right" /></Link>
              <a className="vt-btn vt-btn--secondary vt-btn--lg" href={waLink(t('Bonjour, je voudrais en savoir plus sur Brij-IA.'))} target="_blank" rel="noopener noreferrer"><Fa name="whatsapp" />{t('Écrire sur WhatsApp')}</a>
            </div>
            <ul className="vt-checks">
              <li><Fa name="check" />{t('Gratuit pour commencer')}</li>
              <li><Fa name="check" />{t('TVA et paie du Cameroun')}</li>
              <li><Fa name="check" />{t('Paiement MTN et Orange Money')}</li>
            </ul>
            <button type="button" className="vt-link" onClick={onPlay}><Fa name="video" />{t('Voir la vidéo de présentation (2 min 30)')}</button>
          </div>
          <div className="vt-stage">
            <div className="vt-browser">
              <div className="dots" aria-hidden="true"><i /><i /><i /></div>
              <img src={shot('crm', 1280)} srcSet={`${shot('crm', 480)} 480w, ${shot('crm', 720)} 720w, ${shot('crm', 1280)} 1280w`} sizes="(min-width:1024px) 600px, 92vw" width="1280" height="800"
                alt={t("Écran « Clients et ventes » de Brij-IA : liste des factures et montants à encaisser (données d'exemple)")} {...{ fetchpriority: 'high' }} decoding="async" />
            </div>
            <div className="vt-phone"><img src="/vitrine/mobile-crm.webp" width="390" height="844" alt={t("Brij-IA sur téléphone : liste des clients (données d'exemple)")} loading="eager" decoding="async" /></div>
          </div>
        </div>
        <dl className="vt-facts">
          <div><dt className="sr-only">{t('Modules')}</dt><dd style={{ margin: 0 }}><b>{modules}</b><span>{t('modules intégrés')}</span></dd></div>
          <div><dt className="sr-only">{t('Langues')}</dt><dd style={{ margin: 0 }}><b>4</b><span>{t('langues : français, anglais, allemand, espagnol')}</span></dd></div>
          <div><dt className="sr-only">{t('Monnaie')}</dt><dd style={{ margin: 0 }}><b>FCFA</b><span>{t('montants, TVA et paie du Cameroun')}</span></dd></div>
          <div><dt className="sr-only">{t('Paiement')}</dt><dd style={{ margin: 0 }}><b>MTN · Orange</b><span>{t('paiement par Mobile Money')}</span></dd></div>
        </dl>
        <p className="vt-sample">{t("Captures de l'application avec des données d'exemple.")}</p>
      </div>
    </section>
  );
}
