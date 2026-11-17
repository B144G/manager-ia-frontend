import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';

/** « Comment ça marche » en 3 étapes, puis une démonstration de l'assistant WhatsApp (conversation d'exemple, présentée comme telle). */
export default function How() {
  const t = useT();
  const steps = [
    [t('Créez votre espace'), t("Gratuit, sans carte bancaire. Votre organisation est prête en quelques minutes.")],
    [t('Ajoutez votre activité'), t("Produits, clients, équipe : saisissez-les, ou demandez à l'IA de vous aider à démarrer.")],
    [t('Branchez WhatsApp'), t("Scannez un QR code avec le WhatsApp de l'entreprise, comme pour WhatsApp Web. L'assistant répond ; vous validez.")],
  ];
  return (
    <section className="vt-sec vt-sec--soft" id="comment" aria-labelledby="vt-how">
      <div className="vt-wrap">
        <div className="vt-head vt-rv"><span className="vt-eyebrow">{t('Comment ça marche')}</span><h2 className="vt-h2" id="vt-how">{t('Démarrez en trois étapes')}</h2></div>
        <ol className="vt-steps">
          {steps.map(([h, p], k) => <li className="vt-step vt-rv" key={h}><span className="n" aria-hidden="true">{k + 1}</span><h3 className="vt-h3">{h}</h3><p>{p}</p></li>)}
        </ol>
        <div className="vt-demo">
          <div className="vt-demo-txt vt-rv">
            <span className="vt-eyebrow">{t('Assistant WhatsApp')}</span>
            <h3 className="vt-h2" style={{ fontSize: 'clamp(1.5rem,2.8vw,2.125rem)' }}>{t('Il répond à vos clients. Vous gardez la décision.')}</h3>
            <p>{t("Quand un client écrit, l'assistant répond avec vos vrais prix et votre stock, prépare la commande et vous la soumet.")}</p>
            <ul>
              <li><Fa name="check" />{t('Réponses à toute heure, dans la langue du client')}</li>
              <li><Fa name="check" />{t('Le client et la commande sont enregistrés pour vous')}</li>
              <li><Fa name="check" />{t("Rien n'est confirmé tant que vous n'avez pas validé")}</li>
            </ul>
            <span className="vt-tag">{t("Exemple de conversation, à titre d'illustration")}</span>
          </div>
          <figure className="vt-wa vt-rv" aria-label={t("Exemple de conversation WhatsApp avec l'assistant")}>
            <div className="vt-wa-top"><span className="av"><Fa name="whatsapp" /></span><div><b>{t('Votre boutique')}</b><span>{t("Assistant Brij-IA · exemple")}</span></div></div>
            <div className="vt-wa-body">
              <div className="vt-msg vt-msg--in">{t('Bonjour, vous avez la chaise de bureau en stock ? Quel prix ?')}<small>10:42</small></div>
              <div className="vt-msg vt-msg--out">{t('Bonjour ! Oui, elle est disponible : 45 000 FCFA. Voulez-vous que je prépare une commande ?')}<small>10:42</small></div>
              <div className="vt-msg vt-msg--in">{t('Oui, 2 chaises, livraison à Bonamoussadi.')}<small>10:43</small></div>
              <div className="vt-msg vt-msg--out">{t("C'est noté : 2 chaises, 90 000 FCFA, livraison à Bonamoussadi. Je transmets votre commande pour confirmation.")}<small>10:43</small></div>
              <div className="vt-wa-note"><Fa name="clipboard-check" /><span><b>{t('Dans Brij-IA')}</b><br />{t('Commande en attente de validation : le responsable la confirme ou la modifie.')}</span></div>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
