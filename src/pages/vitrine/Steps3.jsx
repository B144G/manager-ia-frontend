import { useT } from '../../lib/i18n.jsx';

/** Démarrer en trois étapes. */
export default function Steps3() {
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
        <ol className="vt-three">
          {steps.map(([h, p], k) => <li className="vt-rv" key={h}><span className="big" aria-hidden="true">{k + 1}</span><h3 className="vt-h3">{h}</h3><p>{p}</p></li>)}
        </ol>
      </div>
    </section>
  );
}
