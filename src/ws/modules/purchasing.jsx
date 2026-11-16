import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import ModuleShell from '../ModuleShell.jsx';
import Requests from '../parts/purchasing/Requests.jsx';
import Orders, { Receipts } from '../parts/purchasing/Orders.jsx';
import Invoices from '../parts/purchasing/Invoices.jsx';
import Rfqs from '../parts/purchasing/Rfqs.jsx';
import Suppliers from '../parts/purchasing/Suppliers.jsx';
import { BudgetScreen, DashboardScreen, Home, SettingsScreen } from '../parts/purchasing/Dashboard.jsx';

/* Achats : de la demande d'achat au paiement du fournisseur. Tout membre fait une demande ; un responsable approuve, commande et réceptionne ;
   un administrateur valide les factures pour paiement. Les droits et les règles sont contrôlés par le serveur : cet écran ne fait que les présenter. */

export default function Purchasing() {
  const t = useT();
  const { can } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('home');
  const [orderFocus, setOrderFocus] = useState(null);
  const [invoiceFocus, setInvoiceFocus] = useState(null);
  const GROUPS = [
    { id: 'pilot', icon: '📊', label: t('Pilotage'), items: [
      { id: 'home', label: t('Aperçu'), hint: t("Vos demandes et ce qui attend une décision.") },
      ...(mgr ? [{ id: 'dashboard', label: t('Tableau de bord'), hint: t('Dépenses, délais, retards et économies obtenues.') }] : [])] },
    { id: 'need', icon: '📝', label: t('Besoins'), items: [
      { id: 'requests', label: t("Demandes d'achat"), hint: t("Demandez un achat ; un responsable l'approuve.") },
      ...(mgr ? [{ id: 'rfqs', label: t("Appels d'offres"), hint: t('Comparez les devis de plusieurs fournisseurs et attribuez.') }] : [])] },
    ...(mgr ? [
      { id: 'buy', icon: '🛒', label: t('Commandes et réceptions'), items: [
        { id: 'orders', label: t('Bons de commande'), hint: t('Commandes aux fournisseurs, envoi et suivi des livraisons.') },
        { id: 'receipts', label: t('Réceptions'), hint: t('Bons de réception : quantités reçues, refusées, lots et péremptions.') }] },
      { id: 'pay', icon: '🧾', label: t('Factures et paiements'), items: [
        { id: 'invoices', label: t('Factures fournisseurs'), hint: t('Rapprochement à trois, validation pour paiement et règlement.') }] },
      { id: 'sup', icon: '🏭', label: t('Fournisseurs'), items: [
        { id: 'suppliers', label: t('Fiches et évaluation'), hint: t('Coordonnées, note, historique et documents.') },
        { id: 'stock', to: 'stock', label: t('Stock et achats'), hint: t('Ouvre le module Stock et achats.') }] },
      { id: 'ctl', icon: '💰', label: t('Budget et réglages'), items: [
        { id: 'budget', label: t('Budgets et engagements'), hint: t('Budget prévu, engagé et facturé par catégorie.') },
        { id: 'settings', label: t('Seuils et tolérances'), hint: t("Qui approuve quel montant, et écarts acceptés au rapprochement.") }] }] : []),
  ];
  const go = (id) => { setTab(id); };
  const openOrder = (id) => { setOrderFocus(id); setTab('orders'); };
  const openInvoice = (id) => { setInvoiceFocus(id); setTab('invoices'); };
  let content;
  if (tab === 'dashboard' && mgr) content = <DashboardScreen />;
  else if (tab === 'requests') content = <Requests openOrder={openOrder} />;
  else if (tab === 'rfqs' && mgr) content = <Rfqs openOrder={openOrder} />;
  else if (tab === 'orders' && mgr) content = <Orders focus={orderFocus} onFocused={() => setOrderFocus(null)} goInvoice={openInvoice} />;
  else if (tab === 'receipts' && mgr) content = <Receipts />;
  else if (tab === 'invoices' && mgr) content = <Invoices focus={invoiceFocus} onFocused={() => setInvoiceFocus(null)} />;
  else if (tab === 'suppliers' && mgr) content = <Suppliers />;
  else if (tab === 'budget' && mgr) content = <BudgetScreen />;
  else if (tab === 'settings' && mgr) content = <SettingsScreen />;
  else content = <Home go={go} />;
  return (
    <ModuleShell title={t('Achats')} groups={GROUPS} active={tab} onSelect={go}>
      <div key={tab} className="pur">{content}</div>
    </ModuleShell>
  );
}
