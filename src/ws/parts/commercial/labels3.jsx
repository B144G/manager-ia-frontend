import { useMemo } from 'react';
import { useT } from '../../../lib/i18n.jsx';

/* Libellés de l'étape 3 (tarifs et marges, fidélisation, force de vente, performance), traduits à l'affichage.
   Les conseils de coaching et le résumé de la performance arrivent du serveur sous forme de codes + chiffres : les phrases sont fabriquées ici. */
export function useL3() {
  const t = useT();
  return useMemo(() => ({
    reason: { liste: t('prix de liste'), palier: t('palier de quantité'), remise_client: t('remise du client'), prix_client: t('prix négocié pour ce client'), pricelist: t('liste de prix'), floor: t('prix plancher') },
    costSource: { catalog: t('catalogue'), stock: t('stock et achats') },
    channel: { all: t('Tous les canaux'), whatsapp: t('WhatsApp'), counter: t('Comptoir'), field: t('Terrain'), web: t('Site web') },
    tier: { base: t('Base'), silver: t('Argent'), gold: t('Or'), platinum: t('Platine') },
    churn: { high: t('Élevé'), medium: t('Moyen'), low: t('Faible') },
    severity: { low: t('Faible'), normal: t('Normale'), high: t('Élevée') },
    complaint: { open: t('Ouverte'), in_progress: t('En cours'), resolved: t('Résolue') },
    ledger: { earn: t('Gain'), redeem: t('Utilisation'), adjust: t('Ajustement') },
    visit: { planned: t('Prévue'), done: t('Faite'), missed: t('Manquée'), cancelled: t('Annulée') },
    agenda: { visit: t('Visite'), task: t('Tâche'), appointment: t('Rendez-vous') },
    basis: { revenue: t("Chiffre d'affaires"), margin: t('Marge') },
    statement: { draft: t('Brouillon'), approved: t('Validé'), paid: t('Payé') },
    report: { sales: t('Ventes'), leads: t('Prospects'), pipeline: t('Pipeline'), margins: t('Marges par produit'), commissions: t('Commissions') },
    docKind: { invoice: t('Factures'), order: t('Commandes'), quote: t('Devis') },
    seg: { A: t('Classe A'), B: t('Classe B'), C: t('Classe C') },
  }), [t]);
}

/** Phrase de coaching à partir du code et des chiffres du serveur. */
export function useTip() {
  const t = useT();
  return (tip) => {
    const p = tip.params || {};
    switch (tip.code) {
      case 'low_activity': return t("Peu d'activités ce mois-ci : {mine} contre {team} en moyenne dans l'équipe. Planifiez davantage d'appels et de visites.", p);
      case 'low_win_rate': return t("Taux de gain de {mine} % contre {team} % dans l'équipe. Revoyez la qualification (BANT) et les arguments avant la proposition.", p);
      case 'behind_target': return t("Objectif atteint à {attainment} % : concentrez-vous sur les affaires les plus avancées.", p);
      case 'thin_pipeline': return t("Pipeline pondéré de {weighted} pour {remaining} restant à réaliser : il faut ouvrir de nouvelles opportunités.", p);
      case 'stagnant_opps': return t("{count} opportunité(s) stagnent : relancez-les ou clôturez-les.", p);
      case 'untouched_leads': return t("{count} prospect(s) sans contact depuis plus d'une semaine : contactez-les.", p);
      case 'on_track': return t('Rien à signaler : continuez ainsi.');
      default: return tip.code;
    }
  };
}
