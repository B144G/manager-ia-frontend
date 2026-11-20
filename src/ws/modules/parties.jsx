/* Sous-application : Clients et fournisseurs (types : simple, temporaire avec date de fin, permanent, haut de gamme). Les fiches sont celles des modules
   Clients et ventes, Commercial, Achats et Trésorerie (mêmes tables) : ici on les classe par type, on les cherche, on les importe et on les exporte. */
import { useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import ModuleShell from '../ModuleShell.jsx';
import PartyList from '../parts/parties/List.jsx';
import PartyMap from '../parts/parties/PartyMap.jsx';
import Terms from '../parts/parties/Terms.jsx';
import { useWs } from '../WsContext.jsx';
import '../../styles/ws-geo.css';

export default function Parties() {
  const t = useT();
  const { can } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('customers');
  const GROUPS = [
    { id: 'fiches', icon: 'address-book', label: t('Fiches'), items: [
      { id: 'customers', label: t('Clients'), hint: t('Simple, temporaire (avec date de fin), permanent ou haut de gamme : recherche, filtres, fiches, import et export CSV.') },
      ...(mgr ? [{ id: 'suppliers', label: t('Fournisseurs'), hint: t('Les mêmes types pour vos fournisseurs ; les fiches sont celles du module Achats.') }] : [])] },
    { id: 'outils', icon: 'map', label: t('Outils'), items: [
      { id: 'map', label: t('Carte'), hint: t('Vos clients ou fournisseurs localisés, colorés par type.') },
      ...(mgr ? [{ id: 'terms', label: t('Conditions par type'), hint: t('Remise, délais et plafond propres à chaque type.') }] : [])] },
  ];
  const SCREENS = { customers: <PartyList kind="customers" />, suppliers: <PartyList kind="suppliers" />, map: <PartyMap />, terms: <Terms /> };
  return (
    <ModuleShell title={t('Clients et fournisseurs')} groups={GROUPS} active={tab} onSelect={setTab}>
      <div key={tab}>{SCREENS[tab] || SCREENS.customers}</div>
    </ModuleShell>
  );
}
