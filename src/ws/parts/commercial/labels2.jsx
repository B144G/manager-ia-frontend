import { useMemo } from 'react';
import { useT } from '../../../lib/i18n.jsx';

/* Libellés de l'étape 2 (méthodes de vente, prévision, devis), traduits à l'affichage. */
export function useL2() {
  const t = useT();
  return useMemo(() => ({
    spin: { situation: t('Situation'), problem: t('Problème'), implication: t('Implication'), payoff: t('Besoin-bénéfice') },
    spinHelp: {
      situation: t("Comprendre le contexte du client : son activité, ses habitudes, ses fournisseurs."),
      problem: t('Faire dire au client ce qui ne va pas, ses difficultés, ses insatisfactions.'),
      implication: t('Mesurer les conséquences du problème : coûts, retards, pertes.'),
      payoff: t("Faire dire au client ce qu'il gagnerait si le problème était résolu."),
    },
    questions: {
      situation: [t("Quelle est votre situation actuelle ?"), t("Quel est votre volume d'achats ou d'activité ?"), t('Qui est votre fournisseur actuel ?'), t("Comment procédez-vous aujourd'hui ?")],
      problem: [t("Qu'est-ce qui ne vous satisfait pas aujourd'hui ?"), t('Quelles difficultés rencontrez-vous ?'), t("Qu'est-ce qui vous fait perdre du temps ou de l'argent ?")],
      implication: [t('Quelles conséquences ce problème a-t-il sur votre activité ?'), t('Combien cela vous coûte-t-il ?'), t('Que se passe-t-il si rien ne change ?')],
      payoff: [t('Que gagneriez-vous si ce problème était résolu ?'), t('En quoi une solution vous aiderait-elle ?'), t('Quelle serait la solution idéale pour vous ?')],
    },
    spinKind: { call: t('Appel'), meeting: t('Rendez-vous'), visit: t('Visite') },
    maturity: { none: t('Besoin non exprimé'), implicit: t('Besoin implicite'), explicit: t('Besoin explicite') },
    quoteStatus: { draft: t('Brouillon'), sent: t('Envoyé'), accepted: t('Accepté'), refused: t('Refusé') },
    approval: { none: t('Aucune'), pending: t('En attente'), approved: t('Validée'), rejected: t('Refusée') },
    metric: { revenue: t("Chiffre d'affaires"), margin: t('Marge'), new_customers: t('Nouveaux clients'), visits: t('Visites'), opps_won: t('Affaires gagnées') },
    breakBy: { owner: t('Commercial'), product: t('Produit'), zone: t('Zone'), month: t('Mois'), stage: t('Étape') },
  }), [t]);
}

const TONE = { draft: 'neutral', sent: 'info', accepted: 'ok', refused: 'danger', none: 'neutral', pending: 'warn', approved: 'ok', rejected: 'danger' };
export const tone2 = (k) => TONE[k] || 'neutral';
