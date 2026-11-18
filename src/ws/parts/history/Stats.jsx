import { useT } from '../../../lib/i18n.jsx';
import { Bars, Combo, Donut } from '../../charts/lazy.jsx';
import { ChartFrame, EmptyState, Stat } from '../../ui/index.jsx';
import { useLoad, Loaded } from '../../ui.jsx';
import { useLabels } from './util.jsx';

/* Statistiques : nombre de moments par année (forts en vert, durs en rouge), courbe de la trajectoire (forts − durs, cumulés), répartition par catégorie, effectif. */

export default function Stats({ H }) {
  const t = useT();
  const L = useLabels();
  const st = useLoad(() => H.oapi('GET', '/history/stats'), [H.tick]);
  return (
    <Loaded state={st}>{(s) => {
      if (!s.total) return <EmptyState icon="chart" title={t('Pas encore de statistiques')}>{t("Elles apparaissent dès que vous avez enregistré des événements.")}</EmptyState>;
      const ratio = Math.round((s.good / s.total) * 100);
      const data = s.series.map((r) => ({ x: String(r.year), good: r.good, bad: r.bad, trajectory: r.trajectory }));
      const cats = s.byCategory.map((c) => ({ x: L.cat[c.category] || c.label, good: c.good, bad: c.bad }));
      const head = s.headcount.map((h) => ({ x: String(h.year), count: h.count }));
      return (
        <>
          <div className="hst-kpis">
            <Stat label={t('Événements')} value={s.total} icon="list" />
            <Stat label={t('Moments forts')} value={s.good} sub={ratio + ' %'} icon="arrow-trend-up" tone="ok" />
            <Stat label={t('Moments durs')} value={s.bad} sub={(100 - ratio) + ' %'} icon="arrow-trend-down" tone="danger" />
            <Stat label={t('Depuis')} value={s.firstYear} sub={t('{n} ans d’histoire', { n: Math.max(new Date().getFullYear() - s.firstYear, 0) })} icon="history" />
          </div>
          <div className="hst-grid2">
            <ChartFrame title={t('Moments par année')} subtitle={t('Vert : moments forts · Rouge : moments durs')} height={280}
              summary={t('Nombre de moments forts et durs pour chaque année depuis {y}.', { y: s.firstYear })}
              legend={[{ label: t('Moments forts'), color: 'var(--ok)' }, { label: t('Moments durs'), color: 'var(--danger)' }]}>
              <Bars data={data} series={[{ key: 'good', label: t('Moments forts'), color: 'var(--ok)' }, { key: 'bad', label: t('Moments durs'), color: 'var(--danger)' }]} />
            </ChartFrame>
            <ChartFrame title={t("Trajectoire de l'entreprise")} subtitle={t('Moments forts moins moments durs, cumulés année après année')} height={280}
              summary={t('Courbe cumulée : elle monte avec chaque moment fort et descend avec chaque moment dur.')}>
              <Combo data={data} series={[{ key: 'trajectory', label: t('Trajectoire'), type: 'area', color: 'var(--c1)' }]} zeroLine />
            </ChartFrame>
            <ChartFrame title={t('Forts et durs')} height={280} summary={t('{g} moments forts et {b} moments durs.', { g: s.good, b: s.bad })}>
              <Donut data={[{ name: t('Moments forts'), value: s.good, color: 'var(--ok)' }, { name: t('Moments durs'), value: s.bad, color: 'var(--danger)' }]} center={ratio + ' %'} sub={t('de moments forts')} />
            </ChartFrame>
            <ChartFrame title={t('Répartition par catégorie')} height={280} summary={t('Nombre de moments forts et durs pour chaque catégorie.')}>
              <Bars data={cats} stacked series={[{ key: 'good', label: t('Moments forts'), color: 'var(--ok)' }, { key: 'bad', label: t('Moments durs'), color: 'var(--danger)' }]} />
            </ChartFrame>
            {head.length > 1 ? (
              <ChartFrame title={t("Effectif d'après l'organigramme")} height={280} summary={t("Nombre de personnes présentes chaque année.")}>
                <Combo data={head} series={[{ key: 'count', label: t('Personnes'), type: 'line', color: 'var(--c5)', dots: true }]} />
              </ChartFrame>
            ) : null}
          </div>
        </>
      );
    }}</Loaded>
  );
}
