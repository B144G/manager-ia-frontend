import { Link } from 'react-router-dom';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import { shot, waLink } from './shared.js';

/** Conversation d'exemple (animée, jamais présentée comme réelle). Réutilisée dans le hero. */
export function ExampleChat({ compact }) {
  const t = useT();
  return (
    <div className="vt-phone" role="img" aria-label={t("Exemple de conversation WhatsApp avec l'assistant")}>
      <div className="scr">
        <div className="vt-phone-top"><span className="av"><Fa name="whatsapp" /></span><div><b>{t('Votre boutique')}</b><span>{t('Assistant Brij-IA · exemple')}</span></div></div>
        <div className="vt-chat">
          <div className="vt-bub vt-bub--in" style={{ '--d': '.4s' }}>{t('Bonjour, vous avez la chaise de bureau en stock ? Quel prix ?')}</div>
          <div className="vt-bub vt-bub--out" style={{ '--d': '1.4s' }}>{t('Bonjour ! Oui, elle est disponible : 45 000 FCFA. Voulez-vous que je prépare une commande ?')}</div>
          <div className="vt-bub vt-bub--in" style={{ '--d': '2.6s' }}>{t('Oui, 2 chaises, livraison à Bonamoussadi.')}</div>
          {compact ? null : <div className="vt-bub vt-bub--out" style={{ '--d': '3.6s' }}>{t("C'est noté : 2 chaises, 90 000 FCFA, livraison à Bonamoussadi. Je transmets votre commande pour confirmation.")}</div>}
          <div className="vt-bub note" style={{ '--d': '4.6s' }}><b>{t('Dans Brij-IA')}</b> · {t('Commande en attente de validation : le responsable la confirme ou la modifie.')}</div>
        </div>
        <span className="vt-ex">{t('Exemple illustratif')}</span>
      </div>
    </div>
  );
}

/** Premier écran, sombre : accroche, deux grands boutons, démonstration visuelle immédiate (capture réelle en perspective + conversation d'exemple). */
export default function Hero({ onPlay }) {
  const t = useT();
  return (
    <section className="vt-hero vt-dark" aria-labelledby="vt-h1">
      <div className="vt-wrap">
        <div className="vt-grid vt-herogrid">
          <div className="vt-herotxt">
            <span className="vt-badge"><i />{t('Fait au Cameroun · en français, en FCFA')}</span>
            <h1 className="vt-h1" id="vt-h1">{t('Pilotez votre entreprise')} <em>{t('avec le meilleur outil.')}</em></h1>
            <p className="vt-lead">{t('Brij-IA réunit ventes, stock, factures, comptabilité, paie et équipe. Son assistant répond à vos clients sur WhatsApp.')} <b style={{ color: 'var(--vt-ink)' }}>{t('Il propose, vous validez.')}</b></p>
            <div className="vt-cta">
              <Link to="/inscription" className="vt-btn vt-btn--primary vt-btn--lg">{t('Essai gratuit')}<Fa name="arrow-right" /></Link>
              <a className="vt-btn vt-btn--secondary vt-btn--lg" href={waLink(t('Bonjour, je voudrais en savoir plus sur Brij-IA.'))} target="_blank" rel="noopener noreferrer"><Fa name="whatsapp" />{t('Écrire sur WhatsApp')}</a>
            </div>
            <ul className="vt-checks">
              <li><Fa name="check" />{t('Gratuit pour commencer')}</li>
              <li><Fa name="check" />{t('Sans carte bancaire')}</li>
              <li><Fa name="check" />{t('TVA et paie du Cameroun')}</li>
            </ul>
            <button type="button" className="vt-link" onClick={onPlay}><Fa name="video" />{t('Voir la vidéo de présentation (2 min 30)')}</button>
          </div>
          <div className="vt-stage">
            <div className="vt-device">
              <div className="bar" aria-hidden="true"><i /><i /><i /></div>
              <img src={shot('crm', 1280)} srcSet={`${shot('crm', 720)} 720w, ${shot('crm', 1280)} 1280w`} sizes="(min-width:1024px) 52vw, 92vw" width="1280" height="800"
                alt={t("Écran « Clients et ventes » de Brij-IA : liste des factures et montants à encaisser (données d'exemple)")} {...{ fetchpriority: 'high' }} decoding="async" />
            </div>
            <ExampleChat compact />
          </div>
        </div>
      </div>
    </section>
  );
}
