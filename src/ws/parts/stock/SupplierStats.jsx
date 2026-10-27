import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';

/** Fiabilité des fournisseurs : retards par rapport à la date promise et taux de livraison. */
export default function SupplierStats() {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/stock/supplier-stats'), []);
  return (
    <div className="ws-card">
      <h2>{t('Fiabilité des fournisseurs')}</h2>
      <Loaded state={st}>{(j) => (
        <>
          {!j.suppliers.length ? <Empty text={t('Aucune commande fournisseur. Les retards se calculent à partir de la date promise saisie sur chaque commande.')} /> : null}
          {j.suppliers.map((s) => (
            <div className="line" key={s.supplierId}>
              <span><b>{s.supplier}</b><small>{' ' + t('{n} commande(s)', { n: s.orders }) + ' · ' + t('{n} avec date promise', { n: s.promised })}</small></span>
              <span className="row">
                {s.lateRate === null ? <small>{t('retard : pas assez de données')}</small> : <span className={'pill ' + (s.lateRate >= 30 ? 'bad' : s.lateRate > 0 ? 'mid' : 'good')}>{t('{n} % en retard', { n: s.lateRate })}</span>}
                {s.late ? <small>{t('retard moyen {n} j', { n: s.avgDelayDays })}</small> : null}
                {s.fillRate !== null ? <small>{t('livré à {n} %', { n: s.fillRate })}</small> : null}
              </span>
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}
