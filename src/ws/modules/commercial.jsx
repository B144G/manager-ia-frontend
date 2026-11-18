import { useMemo } from 'react';
import { useT } from '../../lib/i18n.jsx';
import ModuleShell from '../ModuleShell.jsx';
import Account360 from '../parts/commercial/Account360.jsx';
import Accounts from '../parts/commercial/Accounts.jsx';
import { Audit, Settings, ZonesTeams } from '../parts/commercial/Admin.jsx';
import AssignRules from '../parts/commercial/AssignRules.jsx';
import Cadences from '../parts/commercial/Cadences.jsx';
import Duplicates from '../parts/commercial/Duplicates.jsx';
import Funnel from '../parts/commercial/Funnel.jsx';
import Home from '../parts/commercial/Home.jsx';
import Kanban, { Stagnant } from '../parts/commercial/Kanban.jsx';
import Leads, { LeadDetail } from '../parts/commercial/Leads.jsx';
import OppDetail from '../parts/commercial/OppDetail.jsx';
import ProspectDash from '../parts/commercial/ProspectDash.jsx';
import Segments, { CustomSegments } from '../parts/commercial/Segments.jsx';
import Stages from '../parts/commercial/Stages.jsx';
import Tasks from '../parts/commercial/Tasks.jsx';
import TeamRoles from '../parts/commercial/TeamRoles.jsx';
import { CommercialProvider, useCp } from '../parts/commercial/common.jsx';

/* Commercial : CRM complet, prospection, pipeline, segmentation, équipe et droits (étape 1).
   Pour ajouter un écran (étapes suivantes) : un composant dans parts/commercial/, puis une ligne dans un groupe de menuGroups() ci-dessous
   (avec `perm` si l'écran n'est offert qu'à un rôle précis). Pour une nouvelle fiche en tiroir : une entrée dans DRAWERS. */

const DRAWERS = { account: Account360, opp: OppDetail, lead: LeadDetail };

/** Menu du module : groupes → écrans. `perm` : droit commercial nécessaire pour voir l'écran (le serveur contrôle de toute façon). */
function menuGroups(t) {
  return [
    { id: 'pilot', icon: 'gauge', label: t('Pilotage'), items: [
      { id: 'home', label: t('Aperçu'), hint: t("Ce qui demande une action aujourd'hui."), render: () => <Home /> }] },
    { id: 'crm', icon: 'address-book', label: t('CRM'), items: [
      { id: 'accounts', label: t('Comptes'), hint: t('Clients et prospects, avec tout leur historique.'), render: () => <Accounts /> },
      { id: 'tasks', label: t('Tâches et rappels'), hint: t('Ce qu’il faut faire, et quand.'), render: () => <Tasks /> },
      { id: 'duplicates', label: t('Doublons'), perm: 'merge', hint: t('Fiches en double à fusionner.'), render: () => <Duplicates /> }] },
    { id: 'prospect', icon: 'user-plus', label: t('Prospection'), items: [
      { id: 'prospdash', label: t('Tableau de bord'), hint: t('Entonnoir, sources et conversion des prospects.'), render: () => <ProspectDash /> },
      { id: 'leads', label: t('Prospects'), hint: t('Prospects classés par score, qualification et conversion.'), render: () => <Leads /> },
      { id: 'cadences', label: t('Relances (cadences)'), hint: t('Messages de relance à envoyer, séquences et journal.'), render: () => <Cadences /> },
      { id: 'assign', label: t("Règles d'attribution"), perm: 'rules', hint: t('Qui reçoit quel prospect.'), render: () => <AssignRules /> }] },
    { id: 'pipeline', icon: 'bullseye', label: t('Pipeline'), items: [
      { id: 'kanban', label: t('Kanban'), hint: t('Les opportunités par étape ; glissez-les pour les faire avancer.'), render: () => <Kanban /> },
      { id: 'funnel', label: t('Entonnoir'), hint: t('Conversion entre étapes, taux de gain, cycle de vente.'), render: () => <Funnel /> },
      { id: 'stagnant', label: t('Opportunités stagnantes'), hint: t('Affaires qui n’avancent plus.'), render: () => <Stagnant /> },
      { id: 'stages', label: t('Étapes et motifs'), perm: 'rules', hint: t('Étapes du pipeline, règles de passage, motifs de gain et de perte.'), render: () => <Stages /> }] },
    { id: 'clients', icon: 'users', label: t('Clientèle'), items: [
      { id: 'segments', label: t('Segmentation'), hint: t('RFM, ABC, secteurs et villes, actions suggérées.'), render: () => <Segments /> },
      { id: 'custom', label: t('Segments personnalisés'), hint: t('Vos groupes de clients définis par des règles.'), render: () => <CustomSegments /> }] },
    { id: 'team', icon: 'user-group', label: t('Équipe et droits'), items: [
      { id: 'roles', label: t('Rôles commerciaux'), hint: t('Qui peut faire quoi dans le module.'), render: () => <TeamRoles /> },
      { id: 'zones', label: t('Zones et équipes'), hint: t('Territoires et équipes commerciales.'), render: () => <ZonesTeams /> },
      { id: 'audit', label: t('Journal de traçabilité'), perm: 'rules', hint: t('Qui a fait quoi.'), render: () => <Audit /> },
      { id: 'settings', label: t('Réglages'), perm: 'rules', hint: t('Poids des sources, seuils des notes, délais.'), render: () => <Settings /> }] },
  ];
}

function Inner() {
  const t = useT();
  const { screen, go, has } = useCp();
  const all = useMemo(() => menuGroups(t), [t]);
  const groups = useMemo(() => all.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || has(i.perm)) })).filter((g) => g.items.length), [all, has]);
  const shellGroups = useMemo(() => groups.map((g) => ({ ...g, items: g.items.map(({ render, perm, ...rest }) => rest) })), [groups]); // eslint-disable-line no-unused-vars
  const cur = groups.flatMap((g) => g.items).find((i) => i.id === screen.id) || groups[0].items[0];
  return (
    <ModuleShell title={t('Commercial')} groups={shellGroups} active={cur.id} onSelect={go}>
      <div key={cur.id} className="cp">{cur.render()}</div>
    </ModuleShell>
  );
}

export default function Commercial() {
  return <CommercialProvider drawers={DRAWERS}><Inner /></CommercialProvider>;
}
