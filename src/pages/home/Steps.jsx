import { useT } from '../../lib/i18n.jsx';

const STEPS = [
  ['1', 'Créez votre espace', 'Gratuit, sans carte bancaire. Votre organisation est prête en quelques minutes.'],
  ['2', 'Ajoutez votre activité', 'Stock, clients, équipe : saisissez ou demandez à l\'IA de vous aider à démarrer.'],
  ['3', 'Branchez vos canaux', 'Connectez votre WhatsApp en scannant un QR code, quand vous êtes prêt.'],
  ['4', 'Elle propose, vous validez', 'Commandes, relances, écritures : rien ne part sans votre accord.'],
];
const TRUST = [
  ['Données séparées', "Chaque organisation est isolée. Les accès dépendent du rôle : propriétaire, administrateur, responsable, membre."],
  ['Connexion renforcée', 'Double authentification, sessions que vous pouvez fermer, blocage des adresses suspectes.'],
  ['Journal d\'audit', 'Les actions sensibles sont enregistrées dans un journal chaîné, qui ne se modifie pas sans que cela se voie.'],
];

/** « Comment ça marche » en quatre étapes, puis les garanties de sécurité. */
export default function Steps() {
  const t = useT();
  return (
    <section className="s-sec alt" id="comment"><div className="s-wrap">
      <div className="s-head rv"><span className="s-eyebrow">{t('Simple et sûr')}</span><h2>{t('Démarrez en quatre étapes')}</h2></div>
      <ol className="s-steps4 rv">
        {STEPS.map(([n, h, p]) => <li key={n}><b>{n}</b><h3>{t(h)}</h3><p>{t(p)}</p></li>)}
      </ol>
      <div className="s-trust3 rv">
        {TRUST.map(([h, p]) => <div key={h}><h3>{t(h)}</h3><p>{t(p)}</p></div>)}
      </div>
    </div></section>
  );
}
