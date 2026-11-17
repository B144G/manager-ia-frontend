import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { TONE, YearBar } from './common.jsx';

/* Ratios de gestion en langage simple : trésorerie, BFR, délais de paiement, marges, autonomie… */

const STATUS = { ok: 'Bon', watch: 'À surveiller', alert: 'Alerte', na: 'Données insuffisantes' };

function Val({ x }) {
  const t = useT();
  const { money } = useWs();
  if (x.status === 'na' || x.value === null || x.value === undefined) return <>{'—'}</>;
  if (x.unit === 'fcfa') return <>{money(x.value)}</>;
  if (x.unit === 'jours') return <>{t('{n} jours', { n: Math.round(x.value) })}</>;
  if (x.unit === 'pct') return <>{(Math.round(x.value * 10) / 10) + ' %'}</>;
  return <>{String(Math.round(x.value * 100) / 100)}</>;
}

export default function RatiosTab({ year, setYear }) {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/ratios?year=' + year), [year]);
  return (
    <>
      <YearBar year={year} setYear={setYear} />
      <Loaded state={st}>
        {(j) => (
          <>
            {j.summary ? <div className="ws-card"><h2>{t('En résumé')}</h2><p>{tsrv(j.summary)}</p></div> : null}
            {!(j.items || []).length ? <Empty text={t("Pas encore assez d'écritures pour calculer des ratios. Comptabilisez vos factures, paiements et achats, ils apparaîtront ici.")} /> : null}
            <div className="kpis">
              {(j.items || []).map((x) => (
                <div className={'stat' + (x.status === 'alert' ? ' bad' : '')} key={x.key} style={{ cursor: 'default' }}>
                  <span>{tsrv(x.label)}</span>
                  <b className={x.status === 'ok' ? 'ok' : ''}><Val x={x} /></b>
                  <span><span className={'pill ' + (TONE[x.status] || '')}>{t(STATUS[x.status] || 'Données insuffisantes')}</span></span>
                  {x.explain ? <small className="muted">{tsrv(x.explain)}</small> : null}
                </div>
              ))}
            </div>
            <p className="muted small">{t("Ratios indicatifs calculés d'après vos écritures.")}</p>
          </>
        )}
      </Loaded>
    </>
  );
}
