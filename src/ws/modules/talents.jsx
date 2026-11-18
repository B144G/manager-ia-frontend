import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import ModuleShell from '../ModuleShell.jsx';
import { Loading } from '../ui.jsx';
import { TCtx } from '../parts/talents/common.jsx';
import Home from '../parts/talents/Home.jsx';
import Dashboard from '../parts/talents/Dashboard.jsx';
import { Gaps, Matrix, Needs, Referential } from '../parts/talents/Gpec.jsx';
import Recruit from '../parts/talents/Recruit.jsx';
import Goals from '../parts/talents/Goals.jsx';
import Review360 from '../parts/talents/Review360.jsx';
import Training from '../parts/talents/Training.jsx';
import { NineBox, Pools } from '../parts/talents/Talent.jsx';
import { Grades, Simulation } from '../parts/talents/Comp.jsx';
import Workforce from '../parts/talents/Workforce.jsx';
import { Engagement, Succession } from '../parts/talents/Career.jsx';
import Rights from '../parts/talents/Rights.jsx';

/* Talents et compétences (RH) : GPEC, recrutement par compétences, objectifs MBO/SMART, évaluation 360°, indicateurs RH, formation, talents (9-box), rémunération,
   effectifs, carrières et succession, engagement. Les droits sont ceux des rôles RH désignés par le propriétaire (le serveur reste seul juge) ; chaque membre
   retrouve dans « Mon espace » ce qui le concerne. */
export default function Talents() {
  const t = useT();
  const { oapi } = useWs();
  const [me, setMe] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('home');
  const reloadMe = useCallback(() => oapi('GET', '/talents/me').then(setMe).catch((e) => setErr(e.message)), [oapi]);
  useEffect(() => { reloadMe(); }, [reloadMe]);
  const tp = useCallback((m, p, b) => oapi(m, '/talents' + p, b), [oapi]);
  const ctx = useMemo(() => (me ? { tp, me, reloadMe, has: (...roles) => me.isOwner || me.roles.includes('rh') || roles.some((r) => me.roles.includes(r)) } : null), [tp, me, reloadMe]);
  if (err) return <p className="ws-err" role="alert">{err}</p>;
  if (!ctx) return <Loading />;
  const has = ctx.has;
  const anyRh = has('recrut', 'talent', 'remun');
  const GROUPS = [
    { id: 'me', icon: 'user-tie', label: t('Mon espace'), items: [
      { id: 'home', label: t('Aperçu'), hint: t('Mes objectifs, questionnaires et actions.') },
      { id: 'goals', label: t('Objectifs (MBO)'), hint: t('Objectifs en cascade, assistant SMART, avancement et score.') },
      { id: 'r360', label: t('Évaluation 360°'), hint: t('Campagnes, questionnaires, résultats anonymisés et radar.') },
      { id: 'engagement', label: t('Engagement'), hint: t('Enquêtes anonymes et eNPS.') }] },
    ...(anyRh ? [{ id: 'pilot', icon: 'chart-pie', label: t('Pilotage RH'), items: [
      { id: 'kpi', label: t('Indicateurs RH'), hint: t('Effectif, rotation, absentéisme, coûts, parité, alertes.') },
      ...(has('talent', 'remun') ? [{ id: 'workforce', label: t('Planification des effectifs'), hint: t('Effectifs budgétés, besoins et scénarios d’embauche.') }] : [])] }] : []),
    ...(has('talent', 'remun', 'recrut') ? [{ id: 'gpec', icon: 'bullseye', label: t('GPEC'), items: [
      { id: 'ref', label: t('Référentiel'), hint: t('Emplois, compétences, services et rattachement des employés.') },
      ...(has('talent') ? [{ id: 'matrix', label: t('Matrice des compétences'), hint: t('Niveaux détenus par personne, en couleurs.') }, { id: 'gaps', label: t('Écarts de compétences'), hint: t('Requis face à détenu, par personne et par compétence.') }] : []),
      { id: 'needs', label: t('Besoins et plan d’actions'), hint: t('Besoins futurs face aux ressources actuelles.') }] }] : []),
    ...(has('recrut') ? [{ id: 'rec', icon: 'magnifying-glass', label: t('Recrutement'), items: [{ id: 'recruit', label: t('Offres et candidats'), hint: t('Pipeline, grille par compétence, entretiens, embauche.') }] }] : []),
    ...[{ id: 'dev', icon: 'seedling', label: t('Développement'), items: [
      { id: 'training', label: t('Formation'), hint: t('Catalogue, budget, sessions, évaluations, certificats.') },
      ...(has('talent') ? [{ id: 'ninebox', label: t('Talents (9-box)'), hint: t('Performance × potentiel, hauts potentiels.') }] : []),
      { id: 'pdi', label: t('Viviers et PDI'), hint: t('Viviers de talents et plans de développement individuels.') },
      ...(has('talent') ? [{ id: 'succession', label: t('Carrières et succession'), hint: t('Postes clés, successeurs, risque de vacance et de départ.') }] : [])] }],
    ...(has('remun') ? [{ id: 'pay', icon: 'coins', label: t('Rémunération'), items: [
      { id: 'grades', label: t('Grilles et positionnement'), hint: t('Grilles salariales, compa-ratio, primes et avantages.') },
      { id: 'sim', label: t('Simulation et prévisions'), hint: t('Révision salariale et masse salariale prévisionnelle.') }] }] : [{ id: 'pay', icon: 'coins', label: t('Rémunération'), items: [{ id: 'grades', label: t('Ma rémunération'), hint: t('Mon salaire et mes primes.') }] }]),
    ...(has('rh') ? [{ id: 'rights', icon: 'key', label: t('Droits et traçabilité'), items: [{ id: 'rights', label: t('Rôles RH et journal'), hint: t('Qui accède à quoi, et qui a consulté quoi.') }] }] : []),
  ];
  const SCREENS = { home: <Home go={setTab} />, goals: <Goals />, r360: <Review360 />, engagement: <Engagement />, kpi: <Dashboard />, workforce: <Workforce />, ref: <Referential />, matrix: <Matrix />, gaps: <Gaps />, needs: <Needs />, recruit: <Recruit />, training: <Training />, ninebox: <NineBox />, pdi: <Pools />, succession: <Succession />, grades: <Grades />, sim: <Simulation />, rights: <Rights /> };
  const known = GROUPS.some((g) => g.items.some((i) => i.id === tab));
  const cur = known ? tab : 'home';
  return (
    <TCtx.Provider value={ctx}>
      <ModuleShell title={t('Talents et compétences')} groups={GROUPS} active={cur} onSelect={setTab}>
        <div key={cur} className="tl">{SCREENS[cur]}</div>
      </ModuleShell>
    </TCtx.Provider>
  );
}
