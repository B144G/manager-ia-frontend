import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import { fcfa, usePlans } from './plans.js';
import { EMAIL, WA_DISPLAY, waLink } from './shared.js';

/** Questions fréquentes : accordéon (boutons avec aria-expanded, ouverture au clavier, flèches haut/bas pour passer d'une question à l'autre). */
export default function Faq() {
  const t = useT();
  const [open, setOpen] = useState(0);
  const { prices } = usePlans();
  const qs = [
    [t('Combien ça coûte ?'), <>{t("L'offre Gratuite permet de commencer sans payer. L'offre Illimité est à {price} par mois, et moins chère par mois si vous prenez un trimestre, un semestre ou un an. Il existe aussi un forfait sur mesure.", { price: fcfa(prices.month) })} <a href="#tarifs">{t('Voir les tarifs')}</a></>],
    [t("Puis-je essayer sans payer ?"), t("Oui. Créez votre espace gratuit : aucune carte bancaire n'est demandée. Vous pouvez passer à une offre payante quand vous êtes prêt.")],
    [t('Mes données sont-elles en sécurité ?'), t("Chaque entreprise est isolée, les accès dépendent du rôle, les mots de passe sont chiffrés et les actions sensibles sont inscrites dans un journal d'audit. Vous pouvez aussi activer la double authentification.")],
    [t("L'IA peut-elle modifier mes données toute seule ?"), t("Non. Elle propose un plan, une écriture, une commande ou une relance ; rien n'est enregistré ni envoyé tant que vous n'avez pas validé.")],
    [t("Comment connecter WhatsApp ?"), t("Vous scannez un QR code avec le WhatsApp de votre entreprise, comme pour WhatsApp Web. Ensuite l'assistant répond à vos clients, enregistre les prospects et prend les commandes, que vous validez.")],
    [t('La TVA et la paie du Cameroun sont-elles gérées ?'), t("Oui : MABAH propose une TVA estimée, des bulletins de paie avec les retenues du Cameroun (paramétrables) et des écritures comptables. C'est un outil d'aide : il ne produit pas la liasse fiscale officielle, que votre comptable prépare à partir de votre export.")],
    [t('La comptabilité remplace-t-elle mon comptable ?'), t("Non. Vos factures, paiements et achats deviennent des écritures, avec résultat, bilan simplifié et TVA estimée. Votre comptable garde son rôle et peut travailler à partir de vos exports.")],
    [t('Puis-je utiliser MABAH sans Internet ?'), t("Non : MABAH a besoin d'une connexion pour afficher et enregistrer vos données en sécurité. Si la connexion se coupe, une page vous l'indique et rien n'est perdu. Vous pouvez l'installer sur l'écran d'accueil de votre téléphone.")],
    [t('Puis-je importer mes données existantes ?'), t("Certains écrans acceptent l'import de fichiers, par exemple les relevés bancaires, ou vos listes de clients et de fournisseurs. Pour le reste, écrivez-nous : nous vous aidons à démarrer.")],
    [t('Comment joindre un humain ?'), <>{t('Par WhatsApp au')} <a href={waLink()} target="_blank" rel="noopener noreferrer">{WA_DISPLAY}</a> {t('ou par e-mail à')} <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. {t("Vous pouvez aussi demander à être contacté :")} <Link to="/essai">{t('Être contacté gratuitement')}</Link>.</>],
  ];
  const onKey = (e, k) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : e.key === 'Home' ? -99 : e.key === 'End' ? 99 : 0;
    if (!d) return; e.preventDefault();
    const nk = Math.abs(d) === 99 ? (d < 0 ? 0 : qs.length - 1) : (k + d + qs.length) % qs.length;
    const el = document.getElementById('vt-q' + nk); if (el) el.focus();
  };
  return (
    <section className="vt-sec" id="faq" aria-labelledby="vt-faq">
      <div className="vt-wrap">
        <div className="vt-faqgrid">
        <div className="vt-head"><span className="vt-eyebrow">{t('Questions fréquentes')}</span><h2 className="vt-h2" id="vt-faq">{t("Ce que l'on nous demande souvent")}</h2><p className="vt-p">{t('Une autre question ? Écrivez-nous, nous vous répondons.')}</p><a className="vt-btn vt-btn--secondary" href={waLink(t('Bonjour, je voudrais en savoir plus sur MABAH.'))} target="_blank" rel="noopener noreferrer"><Fa name="whatsapp" />{t('Écrire sur WhatsApp')}</a></div>
        <div className="vt-faq">
          {qs.map(([q, a], k) => (
            <div className={'vt-q' + (open === k ? ' is-open' : '')} key={k}>
              <h3><button type="button" id={'vt-q' + k} aria-expanded={open === k} aria-controls={'vt-a' + k} onClick={() => setOpen(open === k ? -1 : k)} onKeyDown={(e) => onKey(e, k)}>{q}<Fa name="down" /></button></h3>
              <div className="vt-qa" id={'vt-a' + k} role="region" aria-labelledby={'vt-q' + k}><div><p>{a}</p></div></div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </section>
  );
}
