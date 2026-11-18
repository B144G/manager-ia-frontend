import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Icon } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';

/* Trésorerie : éléments communs (libellés des groupes de flux, phrases d'interprétation, alertes, exports). */

export function useGroups() {
  const t = useT();
  return { clients: t('Clients'), fournisseurs: t('Fournisseurs'), personnel: t('Personnel'), impots: t('Impôts et taxes'), emprunts: t('Emprunts'), financiers: t('Produits et frais financiers'), capital: t('Capital'), investissements: t('Investissements'), autres: t('Autres') };
}
export function useSources() {
  const t = useT();
  return { invoice: t('Facture client'), bill: t('Dette fournisseur'), order: t('Commande'), payroll: t('Paie'), loan: t('Emprunt'), tax: t('Impôt'), plan: t('Prévu'), pending: t('En attente de validation'), trend_sales: t('Tendance des ventes'), trend_purchases: t('Tendance des achats'), scenario: t('Scénario') };
}

/** Phrase d'interprétation d'un indicateur (code + paramètres renvoyés par le serveur). */
export function useInterpret() {
  const t = useT();
  return (x) => {
    const p = x.p || {};
    switch (x.code) {
      case 'dso_ok': return t('Vos clients paient en {days} jours : dans votre objectif de {target} jours.', p);
      case 'dso_above': return t('Vos clients paient en {days} jours, au-dessus de votre objectif de {target} jours : relancez plus tôt.', p);
      case 'dso_high': return t('Vos clients paient en {days} jours, bien au-delà de l\'objectif de {target} jours : votre argent dort chez vos clients.', p);
      case 'dpo_ok': return t('Vous payez vos fournisseurs en {days} jours : le crédit fournisseur finance votre activité.', p);
      case 'dpo_short': return t('Vous payez vos fournisseurs en {days} jours, avant l\'objectif de {target} jours : négociez des délais plus longs.', p);
      case 'dio_ok': return t('Votre stock se renouvelle en {days} jours : dans votre objectif de {target} jours.', p);
      case 'dio_high': return t('Votre stock reste {days} jours en rayon, au-delà de l\'objectif de {target} jours : de l\'argent est immobilisé.', p);
      case 'ccc_negative': return t('Vos fournisseurs financent votre cycle : vous encaissez {days} jours avant de payer.', p);
      case 'ccc_ok': return t('Il s\'écoule {days} jours entre le paiement des achats et l\'encaissement des ventes : dans votre objectif de {target} jours.', p);
      case 'ccc_high': return t('Il s\'écoule {days} jours entre le paiement des achats et l\'encaissement des ventes, au-delà de l\'objectif de {target} jours : vous financez ce délai avec votre trésorerie.', p);
      default: return '';
    }
  };
}

/** Phrase d'une alerte du tableau de bord. */
export function useAlertText() {
  const t = useT();
  const { money, dateFr } = useWs();
  return (a) => {
    switch (a.code) {
      case 'overdraft': return t('Découvert prévu le {date} ({amount}), dans {days} jours.', { date: dateFr(a.date), amount: money(a.amount), days: a.daysAway });
      case 'below_min': return t('Le solde passera sous votre minimum le {date} ({amount}).', { date: dateFr(a.date), amount: money(a.amount) });
      case 'safety': return t('Fonds de sécurité insuffisant : il manque {amount}.', { amount: money(a.amount) });
      case 'overdue_receivables': return t('{pct} % des créances sont échues ({amount}).', { pct: a.ratio, amount: money(a.amount) });
      case 'overdue_payables': return t('Dettes fournisseurs en retard : {amount}.', { amount: money(a.amount) });
      case 'pending_ops': return t('{n} opération(s) attendent votre validation.', { n: a.count });
      case 'kpi_dso': return t('DSO de {value} jours pour un objectif de {target}.', a);
      case 'kpi_dpo': return t('DPO de {value} jours pour un objectif de {target}.', a);
      case 'kpi_dio': return t('DIO de {value} jours pour un objectif de {target}.', a);
      case 'kpi_ccc': return t('Cycle de conversion de {value} jours pour un objectif de {target}.', a);
      default: return a.code;
    }
  };
}
export const tone = (level) => (level === 'alert' || level === 'critical' ? 'danger' : level === 'warn' || level === 'low' ? 'warn' : level === 'ok' ? 'ok' : 'info');

export function Alerts({ list }) {
  const text = useAlertText();
  if (!list || !list.length) return null;
  return <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>{list.map((a, i) => <Alert key={i} tone={tone(a.level)}>{text(a)}</Alert>)}</div>;
}

/** Télécharge un export du serveur (PDF / Excel) avec la session de l'utilisateur. */
export function ExportButtons() {
  const t = useT();
  const { orgId, fail, toast } = useWs();
  const get = async (ext) => {
    try {
      const { fileGet } = await import('./download.js');
      await fileGet(orgId, `/treasury/export/plan.${ext}`, `plan-de-tresorerie.${ext}`);
      toast(t('Export prêt.'));
    } catch (e) { fail(e); }
  };
  return (
    <>
      <button type="button" className="ui-btn sm" onClick={() => get('pdf')}><Icon name="file-pdf" />{t('Plan en PDF')}</button>
      <button type="button" className="ui-btn sm" onClick={() => get('xlsx')}><Icon name="download" />{t('Plan en Excel')}</button>
    </>
  );
}

export const Level = ({ level }) => {
  const t = useT();
  const m = { ok: t('Atteint'), low: t('Un peu bas'), alert: t('Insuffisant'), critical: t('Critique'), unset: t('Non défini') };
  return <Badge tone={tone(level)}>{m[level] || level}</Badge>;
};
export const RiskBadge = ({ risk }) => {
  const t = useT();
  return <Badge tone={risk === 'high' ? 'danger' : risk === 'medium' ? 'warn' : 'ok'}>{risk === 'high' ? t('Risque élevé') : risk === 'medium' ? t('Risque moyen') : t('Risque faible')}</Badge>;
};
export const compactMoney = (n) => { const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toFixed(1) + ' Md' : a >= 1e6 ? (n / 1e6).toFixed(1) + ' M' : a >= 1e3 ? Math.round(n / 1e3) + ' k' : String(Math.round(n)); };
