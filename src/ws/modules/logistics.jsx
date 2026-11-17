/* Sous-application : Logistique et transport (TMS). Cadre commun (menu en groupes, fil d'Ariane) autour des écrans d'origine
   (livraisons, tournées manuelles, parc, transporteurs, zones) et des écrans transport : planification des tournées (capacité,
   créneaux, ordre de passage), répartition jour / semaine, « Ma tournée » du chauffeur sur téléphone (preuves de livraison,
   encaissement, échecs et reports), suivi client par lien secret, grilles tarifaires, factures des transporteurs, indicateurs. */
import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Loaded, useLoad } from '../ui.jsx';
import ModuleShell from '../ModuleShell.jsx';
import { Carriers, Rounds, Zones } from '../parts/logistics/Lists.jsx';
import { Fleet } from '../parts/logistics/Fleet.jsx';
import Deliveries from '../parts/tms/Deliveries.jsx';
import Driver from '../parts/tms/Driver.jsx';
import Dashboard from '../parts/tms/Dashboard.jsx';
import { Dispatch, Planner, TripsList } from '../parts/tms/Planning.jsx';
import { CarrierInvoices, Rates } from '../parts/tms/Costs.jsx';
import { Network, TmsSettings } from '../parts/tms/Settings.jsx';

function ManualRounds() {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/logistics'), []);
  return <Loaded state={st}>{(j) => <Rounds deliveries={j.deliveries} onChange={st.reload} />}</Loaded>;
}

export default function Logistics() {
  const t = useT();
  const { can } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState(() => (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 760px)').matches && !mgr ? 'driver' : 'deliveries'));
  const only = (cond, list) => (cond ? list : []);
  const GROUPS = [
    { id: 'pilot', icon: 'gauge', label: t('Pilotage'), items: [
      { id: 'deliveries', label: t('Livraisons'), hint: t('Toutes vos livraisons : état, retards, preuves, prévenir le client, lien de suivi.') },
      { id: 'kpi', label: t('Indicateurs'), hint: t("Livraisons à l'heure, au premier passage, coûts, kilomètres, utilisation des véhicules, échecs par motif.") }] },
    { id: 'plan', icon: 'route', label: t('Planification'), items: [
      { id: 'planner', label: t('Planifier les tournées'), hint: t('Proposition de tournées selon la charge des véhicules, les zones, les créneaux et la priorité, avec l\'ordre de passage.') },
      { id: 'dispatch', label: t('Répartition'), hint: t('Le planning du jour ou de la semaine : tournées, véhicules et chauffeurs libres, livraisons à planifier.') },
      { id: 'trips', label: t('Tournées'), hint: t('Suivi des tournées : départ, arrêts faits, kilomètres, encaissements, frais à valider.') },
      { id: 'rounds', label: t('Tournées manuelles'), hint: t('Regrouper des livraisons à la main et choisir l\'ordre de passage.') }] },
    { id: 'run', icon: 'mobile', label: t('Exécution'), items: [
      { id: 'driver', label: t('Ma tournée'), hint: t('Sur le téléphone du chauffeur : arrivée, livraison signée, photo, encaissement, échec et nouvelle date.') }] },
    ...only(mgr, [{ id: 'costs', icon: 'coins', label: t('Coûts et tarifs'), items: [
      { id: 'rates', label: t('Grilles tarifaires'), hint: t('Tarifs par zone, tranche de poids, distance et palette, minimum de perception, surcharge carburant.') },
      { id: 'invoices', label: t('Factures des transporteurs'), hint: t('Rapprochement avec le coût attendu de chaque livraison, écarts signalés, écriture d\'achat à la validation.') }] }]),
    { id: 'res', icon: 'truck', label: t('Ressources'), items: [
      { id: 'fleet', label: t('Parc'), hint: t('Véhicules (capacités), chauffeurs (compte relié), échéances réglementaires, carburant.') },
      { id: 'carriers', label: t('Transporteurs'), hint: t('Vos livreurs et sociétés de transport.') },
      { id: 'zones', label: t('Zones'), hint: t('Zones de livraison avec leurs frais et leur délai.') },
      { id: 'network', label: t('Réseau et distances'), hint: t('Distance de chaque zone au dépôt et entre zones, pour ordonner les tournées sans GPS.') },
      { id: 'settings', label: t('Réglages du transport'), hint: t('Dépôt, vitesse moyenne, temps d\'arrêt, fuseau horaire, tolérance des factures.') }] },
    { id: 'links', icon: 'link', label: t('Autres modules'), items: [
      { id: 'stock', to: 'stock', label: t('Expéditions de l\'entrepôt'), hint: t('Ouvre le module Stock : préparation, emballage, expéditions.') },
      ...only(mgr, [{ id: 'accounting', to: 'accounting', label: t('Comptabilité'), hint: t('Ouvre la Comptabilité : frais de transport et factures des transporteurs.') }])] },
  ];
  const SCREENS = {
    deliveries: <Deliveries />, kpi: <Dashboard />, planner: <Planner />, dispatch: <Dispatch />, trips: <TripsList />, rounds: <ManualRounds />, driver: <Driver />,
    rates: <Rates />, invoices: <CarrierInvoices />, fleet: <Fleet />, carriers: <Carriers />, zones: <Zones />, network: <Network />, settings: <TmsSettings />,
  };
  return (
    <ModuleShell title={t('Logistique et transport')} groups={GROUPS} active={tab} onSelect={setTab}>
      <div key={tab}>{SCREENS[tab] || <Deliveries />}</div>
    </ModuleShell>
  );
}
