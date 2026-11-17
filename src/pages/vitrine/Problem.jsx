import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';

/** Le constat (trois douleurs), puis la solution en trois blocs sur fond sombre. */
export default function Problem() {
  const t = useT();
  const pains = [
    [t('Les commandes se perdent dans WhatsApp'), t("Un client écrit le soir, un autre le dimanche. Sans suivi, des ventes passent à côté.")],
    [t('Le stock et les comptes sont dans des cahiers'), t("Cahiers, tableurs, photos de factures : difficile de savoir ce qu'il reste, qui doit de l'argent, et ce que vous gagnez vraiment.")],
    [t('Vous faites tout vous-même, tout le temps'), t("Relances, devis, paie, réponses aux clients : le temps passé à administrer est du temps perdu pour développer l'activité.")],
  ];
  const sols = [
    ['whatsapp', t('Un assistant qui répond à vos clients'), t("Sur WhatsApp, jour et nuit, avec vos vrais prix. Il enregistre le client et prend sa commande ; vous la validez.")],
    ['gears', t('Un logiciel de gestion complet'), t("Ventes, stock, factures, paie, comptabilité, production, chantiers : tout est relié, rien n'est saisi deux fois.")],
    ['shield', t('Vous gardez le contrôle'), t("L'IA propose, vous validez. Accès par rôle, double authentification et journal d'audit pour savoir qui a fait quoi.")],
  ];
  return (
    <section className="vt-sec" id="fonctions" aria-labelledby="vt-prob">
      <div className="vt-wrap">
        <div className="vt-head vt-rv"><span className="vt-eyebrow">{t('Le constat')}</span><h2 className="vt-h2" id="vt-prob">{t("Gérer une entreprise ne devrait pas se faire dans dix applications et trois cahiers")}</h2></div>
        <div className="vt-pains">
          {pains.map(([h, p], k) => <div className="vt-pain vt-rv" key={h}><span className="num" aria-hidden="true">0{k + 1}</span><h3 className="vt-h3">{h}</h3><p>{p}</p></div>)}
        </div>
        <div className="vt-solve vt-dark vt-glow vt-rv">
          {sols.map(([ic, h, p]) => <div key={h}><span className="vt-ico"><Fa name={ic} /></span><h3 className="vt-h3">{h}</h3><p>{p}</p></div>)}
        </div>
      </div>
    </section>
  );
}
