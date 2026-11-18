import { useT } from '../../../lib/i18n.jsx';
import { Alert, ChartFrame, Loaded, Stat, useLoad } from '../../ui.jsx';
import { Bars, Donut, HBars } from '../../charts/lazy.jsx';

/* Tableau de bord de la bibliothèque : volume du catalogue, répartition par type / classe / statut / année, état des prêts. */

export default function Dash({ L, goto }) {
  const t = useT();
  const st = useLoad(() => L.lib('GET', '/catalog/stats'), [L.tick]);
  return (
    <>
      <div className="ws-head"><div><h1>{t('Tableau de bord')}</h1><p className="muted">{t("Une vue d'ensemble du catalogue et des prêts. Les chiffres ne comptent que les ressources que vous avez le droit de voir.")}</p></div></div>
      <Loaded state={st}>{(j) => {
        const l = j.loans || { active: 0, overdue: 0, dueSoon: 0, reservations: 0, finesDue: 0, blocked: 0 };
        const types = j.byType.map((x) => ({ name: t(x.label), value: x.count }));
        const status = j.byStatus.map((x) => ({ name: t(x.label), value: x.count }));
        const classes = j.byClass.slice(0, 8).map((x) => ({ name: x.value ? x.value.split(' ')[0] : t('Sans classe'), value: x.count }));
        const years = j.byYear.map((x) => ({ x: x.value, n: x.count }));
        return (
          <>
            {l.overdue ? <Alert tone="danger" title={t('{n} prêt(s) en retard', { n: l.overdue })}><button className="btn small" type="button" onClick={() => goto('loans')}>{t('Voir les retards')}</button></Alert> : null}
            <div className="ui-stats">
              <Stat label={t('Notices')} value={j.total} sub={t('{n} numérique(s) · {p} physique(s)', { n: j.withDocument, p: j.physical })} />
              <Stat label={t('Prêts en cours')} value={l.active} sub={t('{n} à rendre sous 3 jours', { n: l.dueSoon })} tone="info" />
              <Stat label={t('En retard')} value={l.overdue} tone={l.overdue ? 'danger' : 'ok'} />
              <Stat label={t('Réservations')} value={l.reservations} tone="info" />
              <Stat label={t('Pénalités dues')} value={l.finesDue} tone={l.finesDue ? 'warn' : 'ok'} />
              <Stat label={t('Sans classe')} value={j.unclassified} tone={j.unclassified ? 'warn' : 'ok'} onClick={() => goto('classes')} />
            </div>
            <div className="ws-cols">
              <div className="ws-card"><ChartFrame title={t('Par type de ressource')} height={240} summary={types.map((x) => `${x.name} ${x.value}`).join(', ')}>
                {types.length ? <Donut data={types} center={j.total} sub={t('notices')} /> : <p className="ws-empty">{t('Catalogue vide.')}</p>}</ChartFrame></div>
              <div className="ws-card"><ChartFrame title={t('Par statut')} height={240} summary={status.map((x) => `${x.name} ${x.value}`).join(', ')}>
                {status.length ? <Donut data={status} center={l.active} sub={t('en prêt')} /> : <p className="ws-empty">{t('Catalogue vide.')}</p>}</ChartFrame></div>
            </div>
            <div className="ws-cols">
              <div className="ws-card"><ChartFrame title={t('Par classe principale')} height={Math.max(200, 50 + classes.length * 30)} summary={classes.map((x) => `${x.name} ${x.value}`).join(', ')}>
                {classes.length ? <HBars data={classes} valueLabel={t('Notices')} height={Math.max(200, 50 + classes.length * 30)} /> : <p className="ws-empty">{t('Catalogue vide.')}</p>}</ChartFrame></div>
              <div className="ws-card"><ChartFrame title={t('Par année de publication')} height={240} summary={years.map((x) => `${x.x} ${x.n}`).join(', ')}>
                {years.length ? <Bars data={years} height={240} series={[{ key: 'n', label: t('Notices'), color: 'var(--c1)' }]} /> : <p className="ws-empty">{t('Aucune année renseignée.')}</p>}</ChartFrame></div>
            </div>
          </>
        );
      }}
      </Loaded>
    </>
  );
}
