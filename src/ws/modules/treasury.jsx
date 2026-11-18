import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Alert, Loaded, useLoad } from '../ui.jsx';
import ModuleShell from '../ModuleShell.jsx';
import Dashboard from '../parts/treasury/Dashboard.jsx';
import { AccountsScreen, OpsScreen, ReconcileScreen } from '../parts/treasury/Accounts.jsx';
import { CalendarScreen, ForecastScreen, PlanScreen, ScenariosScreen } from '../parts/treasury/Forecast.jsx';
import { PayablesScreen, ReceivablesScreen } from '../parts/treasury/Clients.jsx';
import { CashflowScreen, KpisScreen, SafetyScreen, VarianceScreen } from '../parts/treasury/Analysis.jsx';
import { LogScreen, SettingsScreen, TeamScreen } from '../parts/treasury/Admin.jsx';
import { ExportButtons } from '../parts/treasury/common.jsx';
import '../../styles/ws-treasury.css';

/* Trésorerie : tableau de bord, comptes multi-banques / caisses / mobile money, prévision glissante à 13 semaines et 12 mois, calendrier, scénarios,
   créances et dettes, écarts prévu / réalisé, indicateurs (BFR, FRNG, trésorerie nette, DSO, DPO, DIO, CCC), fonds de sécurité, rôles et journal.
   Les droits (responsable de trésorerie, trésoriers) sont contrôlés par le serveur ; l'écran n'affiche que ce qu'on lui permet. */

export default function Treasury() {
  const t = useT();
  const { oapi, orgId } = useWs();
  const navigate = useNavigate();
  const [screen, setScreen] = useState('home');
  const me = useLoad(() => oapi('GET', '/treasury/me'), []);
  const GROUPS = (m) => [
    { id: 'pilot', icon: '📊', label: t('Pilotage'), items: [
      { id: 'home', label: t('Tableau de bord'), hint: t('Votre trésorerie en un coup d\'œil : soldes, prévision, alertes.') },
      { id: 'accounts', label: t('Comptes et soldes'), hint: t('Banques, caisses et mobile money, consolidés par monnaie et par antenne.') },
      { id: 'ops', label: t('Opérations'), hint: t('Encaissements, décaissements et virements : préparation et validation.') }] },
    { id: 'forecast', icon: '📈', label: t('Prévision'), items: [
      { id: 'forecast', label: t('13 semaines et 12 mois'), hint: t('Prévision glissante mise à jour à partir de vos documents.') },
      { id: 'calendar', label: t('Calendrier'), hint: t('Encaissements et décaissements jour par jour, avec le solde.') },
      { id: 'scenarios', label: t('Scénarios'), hint: t('Et si les ventes baissent, les clients tardent, un prêt arrive ?') },
      { id: 'plan', label: t('Éléments prévus'), hint: t('Loyer, impôt, apport : ce que les documents ne savent pas encore.') }] },
    { id: 'third', icon: '👥', label: t('Clients et fournisseurs'), items: [
      { id: 'receivables', label: t('Créances clients'), hint: t('Balance âgée, risque d\'impayé, provision et relances.') },
      { id: 'payables', label: t('Dettes fournisseurs'), hint: t('Échéancier et paiements optimisés.') }] },
    { id: 'analysis', icon: '🎯', label: t('Analyse'), items: [
      { id: 'variance', label: t('Écarts prévu / réalisé'), hint: t('Pourquoi la trésorerie s\'écarte de la prévision.') },
      { id: 'cashflow', label: t('Tableau des flux'), hint: t('Flux d\'exploitation, d\'investissement et de financement.') },
      { id: 'kpis', label: t('Indicateurs'), hint: t('BFR, FRNG, trésorerie nette, DSO, DPO, DIO et cycle de trésorerie.') },
      { id: 'safety', label: t('Fonds de sécurité'), hint: t('Votre réserve face à la cible, et comment la reconstituer.') }] },
    { id: 'control', icon: '🔒', label: t('Contrôle'), items: [
      { id: 'reconcile', label: t('Rapprochement'), hint: t('Soldes comptables et relevés bancaires, compte par compte.') },
      { id: 'bankacc', to: 'accounting', label: t('Relevés bancaires (Comptabilité)'), hint: t('Ouvre la Comptabilité pour importer et pointer les relevés.') },
      { id: 'team', label: t('Équipe et droits'), hint: t('Responsable de trésorerie et trésoriers.') },
      ...(m.canApprove ? [{ id: 'settings', label: t('Réglages'), hint: t('Seuil de double validation, fonds de sécurité, paie.') }, { id: 'log', label: t('Journal de traçabilité'), hint: t('Qui a fait quoi, et quand.') }] : [{ id: 'settings', label: t('Réglages'), hint: t('Les réglages fixés par le responsable.') }]) ] },
  ];
  return (
    <Loaded state={me}>{(m) => {
      const go = (id) => setScreen(id);
      const openAcc = () => navigate(`/app/${orgId}/accounting`);
      const body = {
        home: <Dashboard go={go} />, accounts: <AccountsScreen me={m} />, ops: <OpsScreen me={m} />, forecast: <ForecastScreen />, calendar: <CalendarScreen />, scenarios: <ScenariosScreen me={m} />, plan: <PlanScreen me={m} />,
        receivables: <ReceivablesScreen me={m} />, payables: <PayablesScreen me={m} />, variance: <VarianceScreen />, cashflow: <CashflowScreen />, kpis: <KpisScreen me={m} />, safety: <SafetyScreen me={m} />,
        reconcile: <ReconcileScreen openAccounting={openAcc} />, team: <TeamScreen me={m} />, settings: <SettingsScreen me={m} />, log: m.canApprove ? <LogScreen /> : null,
      }[screen];
      return (
        <ModuleShell title={t('Trésorerie')} groups={GROUPS(m)} active={screen} onSelect={setScreen} actions={m.canApprove ? <ExportButtons /> : null}>
          <div className="tre">
            {m.role === 'treasurer' ? <Alert tone="info">{t('Vous êtes trésorier : vous préparez les opérations, le responsable de trésorerie les valide.')}</Alert> : null}
            {body}
          </div>
        </ModuleShell>
      );
    }}</Loaded>
  );
}
