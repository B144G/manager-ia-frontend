import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, ChartFrame, Loaded, Stat, useLoad } from '../../ui.jsx';
import { Bars, Combo, Donut } from '../../charts/lazy.jsx';
import { Panel, pct, num1, useTl } from './common.jsx';

/* Tableau de bord des indicateurs RH : effectif, rotation, absentéisme, ancienneté, masse salariale, recrutement, formation, parité, pyramide des âges, engagement. */
export default function Dashboard() {
  const t = useT();
  const { money } = useWs();
  const { tp } = useTl();
  const st = useLoad(() => tp('GET', '/kpi/dashboard'), []);
  const ALERT = {
    turnover: t('Rotation du personnel élevée'), absenteeism: t('Absentéisme élevé'), parity: t('Déséquilibre femmes / hommes'), training_rate: t('Peu de personnes formées'), training_budget: t('Budget de formation dépassé'),
    enps: t("Engagement (eNPS) faible"), due_expired: t('Échéances RH dépassées (contrats, visites, habilitations)'), slow_recruitment: t('Offres ouvertes depuis plus de 60 jours'), vacancy_critical: t('Postes clés à risque de vacance critique'),
    flight_risk: t('Personnes à risque de départ élevé'), goals_overdue: t('Objectifs en retard'), below_min_salary: t('Salaires sous le minimum de la grille'),
  };
  return (
    <Loaded state={st}>{(k) => (
      <div className="tl-grid">
        <div className="tl-kpis">
          <Stat icon="users" label={t('Effectif')} value={k.headcount.active} sub={t('{n} arrivée(s), {m} départ(s) cette année', { n: k.headcount.arrivals, m: k.headcount.departures })} />
          <Stat icon="arrows-rotate" label={t('Rotation (turnover)')} value={pct(k.turnover.rate)} tone={k.turnover.rate > 15 ? 'danger' : 'brand'} />
          <Stat icon="calendar-days" label={t('Absentéisme')} value={pct(k.absenteeism.rate)} sub={t('{n} jour(s) de maladie', { n: k.absenteeism.sickLeaveDays })} tone={k.absenteeism.rate > 5 ? 'danger' : 'brand'} />
          <Stat icon="hourglass" label={t('Ancienneté moyenne')} value={k.seniority.avgYears === null ? '—' : t('{n} ans', { n: num1(k.seniority.avgYears) })} />
          {k.payroll ? <Stat icon="money" label={t('Masse salariale / mois')} value={money(k.payroll.monthlyBase)} sub={t('{amount} par an', { amount: money(k.payroll.annualBase) })} /> : null}
          <Stat icon="magnifying-glass" label={t('Délai de recrutement')} value={k.recruitment.avgDaysToHire === null ? '—' : t('{n} j', { n: num1(k.recruitment.avgDaysToHire) })} sub={t('{n} offre(s) ouverte(s)', { n: k.recruitment.openJobs })} />
          {k.recruitment.costPerHire !== undefined ? <Stat icon="money" label={t('Coût par recrutement')} value={k.recruitment.costPerHire === null ? '—' : money(k.recruitment.costPerHire)} /> : null}
          <Stat icon="seedling" label={t('Taux de formation')} value={pct(k.training.rate)} sub={t('{n} personne(s) formée(s)', { n: k.training.trained })} />
          <Stat icon="heart" label={t('Engagement (eNPS)')} value={k.engagement && k.engagement.enps !== null ? String(k.engagement.enps) : '—'} sub={k.engagement ? t('{n} réponses', { n: k.engagement.responses }) : t('Aucune enquête')} />
        </div>
        <Panel title={t('Alertes')}>
          {!k.alerts.length ? <p className="ws-empty">{t('Aucune alerte : tous les indicateurs sont dans les seuils.')}</p> : (
            <div className="tl-alerts">{k.alerts.map((a) => (
              <div className="tl-row" key={a.key}><span>{ALERT[a.key] || a.key}</span><span><Badge tone={a.severity === 'high' ? 'danger' : 'warn'}>{a.key === 'turnover' || a.key === 'absenteeism' || a.key === 'parity' || a.key === 'training_rate' || a.key === 'training_budget' ? pct(a.value) : String(a.value)}</Badge></span></div>
            ))}</div>
          )}
        </Panel>
        <div className="tl-2">
          <ChartFrame title={t("Évolution de l'effectif")} subtitle={String(k.year)} summary={t("Effectif à la fin de chaque mois")}>
            <Combo data={k.headcount.trend.map((m) => ({ x: m.month.slice(5), headcount: m.headcount }))} series={[{ key: 'headcount', label: t('Effectif'), type: 'area' }]} />
          </ChartFrame>
          <ChartFrame title={t('Pyramide des âges')} subtitle={t('{n} sans date de naissance', { n: k.pyramid.unknown })} summary={t('Effectif par tranche d’âge et par genre')}>
            <Bars data={k.pyramid.bands.map((b) => ({ x: b.band, female: b.female, male: b.male, other: b.other }))} series={[{ key: 'female', label: t('Femmes') }, { key: 'male', label: t('Hommes') }, { key: 'other', label: t('Non renseigné') }]} stacked />
          </ChartFrame>
          <ChartFrame title={t('Parité')} summary={t('Répartition femmes / hommes')}>
            <Donut data={[{ name: t('Femmes'), value: k.parity.female }, { name: t('Hommes'), value: k.parity.male }, { name: t('Non renseigné'), value: k.parity.unknown }].filter((d) => d.value)} center={k.parity.femalePct === null ? '—' : pct(k.parity.femalePct)} sub={t('de femmes')} />
          </ChartFrame>
          <ChartFrame title={t('Entonnoir de recrutement')} summary={t('Candidats par étape')}>
            <Bars data={k.recruitment.funnel.map((f) => ({ x: ({ new: t('Nouveau'), screening: t('Présélection'), interview: t('Entretien'), offer: t('Offre'), hired: t('Embauché'), rejected: t('Écarté') })[f.stage], n: f.count }))} series={[{ key: 'n', label: t('Candidats') }]} />
          </ChartFrame>
        </div>
      </div>
    )}
    </Loaded>
  );
}
