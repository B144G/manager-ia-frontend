import { useT } from '../../lib/i18n.jsx';

export default function Faq() {
  const t = useT();
  return (
    <>
      <section className="s-sec" id="faq"><div className="s-wrap">
        <div className="s-head rv"><span className="s-eyebrow">{t('Questions fréquentes')}</span><h2>{t("Ce que l'on nous demande souvent")}</h2></div>
        <div className="s-faq rv">
          <details><summary>{t('Dois-je payer pour essayer ?')}</summary><p>{t("Non. L'offre Gratuite permet de découvrir la plateforme sans paiement ni carte bancaire.")}</p></details>
          <details><summary>{t("L'IA peut-elle modifier mes données toute seule ?")}</summary><p>{t("Non. Elle propose un plan, une écriture, une commande ou une relance ; rien n'est enregistré ni envoyé tant que vous n'avez pas validé.")}</p></details>
          <details><summary>{t("Mes clients peuvent-ils m'écrire sur WhatsApp ?")}</summary><p>{t("Oui. Vous connectez le WhatsApp de votre entreprise en scannant un QR code, comme pour WhatsApp Web. L'IA répond, enregistre les prospects et prend les commandes, que vous validez.")}</p></details>
          <details><summary>{t('La comptabilité remplace-t-elle mon comptable ?')}</summary><p>{t("Non. C'est un outil d'aide : vos factures, paiements et achats deviennent des écritures, avec résultat, bilan simplifié et TVA estimée. Il ne produit pas la liasse fiscale officielle : votre comptable la prépare à partir de votre export.")}</p></details>
          <details><summary>{t('Comment joindre un humain ?')}</summary><p>{t('Par WhatsApp au +237 653 62 13 88 ou au +237 697 83 67 96, ou par e-mail à tendabrandon9@gmail.com.')}</p></details>
        </div>
      </div></section>
    </>
  );
}
