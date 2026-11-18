import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { useWs } from '../WsContext.jsx';
import ModuleShell from '../ModuleShell.jsx';
import '../../styles/ws-administration.css';
import { AdmCtx, call } from '../parts/administration/kit.jsx';
import Dashboard, { MonthlyExport } from '../parts/administration/Dashboard.jsx';
import { Chart, Delegations, Raci } from '../parts/administration/Org.jsx';
import Sops from '../parts/administration/Sops.jsx';
import { Archive, DocLog, Docs, Retention } from '../parts/administration/Docs.jsx';
import { FlowStats, Flows, Inbox, Requests } from '../parts/administration/Flow.jsx';
import { Actions, Controls, Maturity, Risks, Sod } from '../parts/administration/Control.jsx';
import { Assets, Deadlines, MeansRequests, Places, Supplies } from '../parts/administration/Means.jsx';
import { Compliance, Contracts } from '../parts/administration/Contracts.jsx';
import Goals from '../parts/administration/Goals.jsx';
import Settings from '../parts/administration/Settings.jsx';

/* Administration : organigramme et responsabilités, procédures, GED et archives, circuits de validation, contrôle interne, moyens généraux,
   contrats et conformité, reporting. Cet écran n'affiche que ce que le serveur renvoie : les droits sont contrôlés côté serveur,
   le propriétaire désignant qui crée et valide les circuits (voir Réglages). Réunions et objectifs RH sont lus, jamais recopiés. */

export default function Administration() {
  const t = useT();
  const { orgId, fail, info, can } = useWs();
  const [screen, setScreen] = useState('dashboard');
  const [tick, setTick] = useState(0);
  const [cfg, setCfg] = useState(null);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  const api = useCallback((method, path, body, o) => call(orgId, method, path, body, o), [orgId]);
  useEffect(() => { api('GET', '/settings').then((j) => setCfg({ ...j, perms: j.me.perms }), fail); }, [api, tick, fail]);
  const hasMeetings = Boolean(info && info.modules && info.modules.some((m) => m.id === 'meetings'));
  const ctx = useMemo(() => cfg && ({ api, orgId, tick, reload, cfg, perms: cfg.perms, go: setScreen, hasMeetings }), [api, orgId, tick, reload, cfg, hasMeetings]);

  const groups = [
    { id: 'pilot', icon: 'gauge', label: t('Pilotage'), items: [
      { id: 'dashboard', label: t('Tableau de bord'), hint: t('Ce qu’il faut traiter en priorité : procédures, documents, circuits, conflits, contrats, conformité, moyens.') },
      { id: 'report', label: t('Rapport mensuel'), hint: t('Une synthèse du mois à télécharger en PDF ou en Excel.') },
      { id: 'goals', label: t('Objectifs'), hint: t('Suivi des objectifs administratifs.') },
    ] },
    { id: 'org', icon: 'sitemap', label: t('Organisation'), items: [
      { id: 'chart', label: t('Organigramme'), hint: t('Services, postes, titulaires et fiches de poste ; export en image ou en PDF.') },
      { id: 'raci', label: t('Matrice RACI'), hint: t('Qui réalise, dirige, supervise, est consulté ou informé, par processus et par activité.') },
      { id: 'delegations', label: t('Délégations et intérim'), hint: t('Qui remplace qui, pour combien de temps et jusqu’à quel montant.') },
    ] },
    { id: 'sop', icon: 'book-open', label: t('Procédures'), items: [
      { id: 'sops', label: t('Bibliothèque de procédures'), hint: t('Procédures écrites, versions, révisions et accusés de lecture.') },
    ] },
    { id: 'ged', icon: 'folder-open', label: t('Documents et archives'), items: [
      { id: 'docs', label: t('Documents'), hint: t('Classement, recherche, versions, verrou et prêt.') },
      { id: 'archive', label: t('Archives et échéances'), hint: t('À archiver, à détruire, destructions à valider.') },
      { id: 'retention', label: t('Conservation et classement'), hint: t('Durées de conservation par type de document et plan de classement.') },
      ...(cfg && cfg.perms.docs_manage ? [{ id: 'doclog', label: t('Journal d’accès'), hint: t('Qui a consulté, modifié ou détruit quoi.') }] : []),
    ] },
    { id: 'flow', icon: 'diagram-project', label: t('Validation'), items: [
      { id: 'inbox', label: t('À valider'), hint: t('Les demandes qui attendent votre décision.') },
      { id: 'requests', label: t('Demandes'), hint: t('Achat, congé, dépense, document, contrat, accès.') },
      { id: 'flows', label: t('Circuits'), hint: t('Étapes, approbateurs, seuils, délais, escalade, suppléants.') },
      { id: 'flowstats', label: t('Délais et indicateurs'), hint: t('Temps de traitement, retards, escalades.') },
    ] },
    { id: 'ic', icon: 'scale-balanced', label: t('Contrôle interne'), items: [
      { id: 'sod', label: t('Séparation des tâches'), hint: t('Fonctions incompatibles et conflits détectés automatiquement.') },
      { id: 'controls', label: t('Registre des contrôles'), hint: t('Fréquence, responsable, preuve et résultat de chaque contrôle.') },
      { id: 'risks', label: t('Risques'), hint: t('Registre et carte des risques de contrôle interne.') },
      { id: 'actions', label: t('Plans d’actions'), hint: t('Actions correctives et leurs échéances.') },
      { id: 'maturity', label: t('Maturité'), hint: t('Score de maturité du contrôle interne.') },
    ] },
    { id: 'means', icon: 'toolbox', label: t('Moyens généraux'), items: [
      { id: 'assets', label: t('Biens et équipements'), hint: t('Inventaire, attribution, véhicules, coûts.') },
      { id: 'deadlines', label: t('Échéances et coûts'), hint: t('Assurances, contrôles techniques, entretien.') },
      { id: 'places', label: t('Locaux et salles'), hint: t('Locaux, loyers et réservation de salles.') },
      { id: 'supplies', label: t('Fournitures'), hint: t('Stock de fournitures et seuils d’alerte.') },
      { id: 'meansreq', label: t('Demandes de moyens'), hint: t('Fournitures, équipements, véhicules, salles.') },
    ] },
    { id: 'legal', icon: 'file-contract', label: t('Contrats et conformité'), items: [
      ...(can('manager') ? [{ id: 'contracts', label: t('Contrats'), hint: t('Échéances, préavis, reconduction tacite, montants.') }, { id: 'compliance', label: t('Conformité'), hint: t('Obligations récurrentes, responsables, preuves.') }] : []),
    ] },
    ...(hasMeetings ? [{ id: 'links', icon: 'calendar-days', label: t('Réunions'), items: [{ id: 'meetings', label: t('Ouvrir Réunions'), hint: t('Convocations et comptes rendus.'), to: 'meetings' }] }] : []),
    { id: 'settings', icon: 'gear', label: t('Réglages'), items: [{ id: 'settings', label: t('Droits et alertes'), hint: t('Le responsable du compte désigne qui crée et valide, et règle les délais d’alerte.') }] },
  ].filter((g) => g.items.length);

  let body = null;
  if (ctx) {
    const S = {
      dashboard: <Dashboard />, report: <MonthlyExport />, goals: <Goals />, chart: <Chart />, raci: <Raci />, delegations: <Delegations />, sops: <Sops />,
      docs: <Docs />, archive: <Archive />, retention: <Retention />, doclog: <DocLog />, inbox: <Inbox />, requests: <Requests />, flows: <Flows />, flowstats: <FlowStats />,
      sod: <Sod />, controls: <Controls />, risks: <Risks />, actions: <Actions />, maturity: <Maturity />, assets: <Assets />, deadlines: <Deadlines />, places: <Places />, supplies: <Supplies />, meansreq: <MeansRequests />,
      contracts: <Contracts />, compliance: <Compliance />, settings: <Settings />,
    };
    body = S[screen] || S.dashboard;
  }
  return (
    <ModuleShell title={t('Administration')} groups={groups} active={screen} onSelect={setScreen}>
      {ctx ? <AdmCtx.Provider value={ctx}><div className="adm" key={screen}>{body}</div></AdmCtx.Provider> : <p className="muted" role="status">{t('Chargement…')}</p>}
    </ModuleShell>
  );
}
