import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';

/** Sécurité : uniquement des affirmations vérifiables dans l'application ; aucune certification ni conformité revendiquée. */
export default function Security() {
  const t = useT();
  const items = [
    ['shield', t("Données séparées par entreprise"), t("Chaque organisation est isolée : les autres entreprises n'ont pas accès à vos données.")],
    ['users', t('Accès selon le rôle'), t('Propriétaire, administrateur, responsable ou membre : chacun voit ce qui le concerne.')],
    ['lock', t('Mots de passe protégés'), t("Les mots de passe sont enregistrés sous forme chiffrée, jamais en clair.")],
    ['mobile', t('Double authentification'), t("Un code en plus du mot de passe, et des sessions que vous pouvez fermer.")],
    ['file-pen', t("Journal d'audit"), t("Les actions sensibles sont enregistrées dans un journal chaîné : toute modification se voit.")],
    ['clipboard-check', t("L'IA ne décide pas seule"), t("Elle propose une commande, une écriture ou une relance ; rien n'est enregistré ni envoyé sans votre validation.")],
  ];
  return (
    <section className="vt-sec vt-dark vt-glow" id="securite" aria-labelledby="vt-sec">
      <div className="vt-wrap">
        <div className="vt-head vt-rv"><span className="vt-eyebrow">{t('Sécurité et confidentialité')}</span><h2 className="vt-h2" id="vt-sec">{t('Vos données restent les vôtres')}</h2><p className="vt-lead">{t("Voici, sans exagération, ce que MABAH met en place pour protéger votre entreprise.")}</p></div>
        <div className="vt-secgrid">
          {items.map(([ic, h, p]) => <div className="vt-secitem vt-rv" key={h}><span className="vt-ico"><Fa name={ic} /></span><h3 className="vt-h3">{h}</h3><p>{p}</p></div>)}
        </div>
        <p className="vt-secnote">{t("Pour le détail, lisez notre politique de confidentialité et nos conditions d'utilisation (liens en bas de page).")}</p>
      </div>
    </section>
  );
}
