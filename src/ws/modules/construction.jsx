/* Sous-application : Chantiers (BTP) : chantiers, phases, dépenses vs budget, pointage, rapports, incidents, situations. */
import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import { SiteForm } from '../parts/construction/Forms.jsx';
import Site from '../parts/construction/Site.jsx';
import { Bar, Pill, STATUS_FR, STATUS_TONE } from '../parts/construction/common.jsx';

export default function Construction() {
  const t = useT();
  const { oapi, can, money, dateFr, modal, confirm, fail } = useWs();
  const mgr = can('manager');
  const [siteId, setSiteId] = useState(null);
  const st = useLoad(() => Promise.all([oapi('GET', '/construction'), oapi('GET', '/members')]), []);
  const load = st.reload;

  const edit = (s, after) => modal(s && s.id ? t('Modifier le chantier') : t('Nouveau chantier'), (close) => <SiteForm site={s} members={st.data ? st.data[1].members : []} close={close} done={() => { load(); if (after) after(); }} />, { wide: true });

  if (siteId) return <Site id={siteId} back={() => setSiteId(null)} onChange={load} edit={edit} />;

  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Chantiers (BTP)')}</h1><p className="muted">{t('Vos chantiers : avancement, dépenses, équipe et paiements du client.')}</p></div>
        {mgr ? <div className="row"><button className="btn primary small" type="button" onClick={() => edit()}>{t('Nouveau chantier')}</button></div> : null}
      </div>
      <Loaded state={st}>{([j]) => {
        const s = j.summary;
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{String(s.active)}</b><span>{t('chantier(s) en cours')}</span></div>
              <div className="stat"><b>{s.avgProgress + ' %'}</b><span>{t('avancement moyen')}</span></div>
              <div className={'stat' + (s.late ? ' bad' : '')}><b>{String(s.late)}</b><span>{t('chantier(s) en retard')}</span></div>
              {s.forecastMargin !== undefined ? <div className={'stat' + (s.forecastMargin < 0 ? ' bad' : '')}><b>{money(s.forecastMargin)}</b><span>{t('marge prévisionnelle')}</span></div> : <div className="stat"><b>{String(s.total)}</b><span>{t('chantier(s) au total')}</span></div>}
            </div>
            {mgr && (s.overBudget || s.toCollect) ? <p className="muted small">{(s.overBudget ? t('{n} chantier(s) dépassent leur budget.', { n: s.overBudget }) + ' ' : '') + (s.toCollect ? t('Reste à encaisser auprès des clients : {amount}.', { amount: money(s.toCollect) }) : '')}</p> : null}
            <div className="ws-card">
              <h2>{t('Chantiers')}</h2>
              {!j.sites.length ? <Empty text={mgr ? t('Aucun chantier. Créez le premier avec son client, son budget et ses dates.') : t('Aucun chantier pour le moment.')} /> : null}
              {j.sites.map((x) => (
                <div className="line" key={x.id}>
                  <span style={{ flex: '1 1 240px' }}>
                    <b>{x.name}</b>{' '}<Pill s={[STATUS_FR[x.status], STATUS_TONE[x.status]]} />{x.late ? <span className="pill bad">{t('En retard')}</span> : null}{x.overrun === 'over' ? <span className="pill bad">{t('Budget dépassé')}</span> : null}
                    <small>{' ' + [x.client, x.location, x.endDate ? t('fin prévue le {date}', { date: dateFr(x.endDate) }) : '', x.budget ? t('marché {amount}', { amount: money(x.budget) }) : '', x.spent !== undefined && x.budget ? t('dépensé {amount}', { amount: money(x.spent) }) : ''].filter(Boolean).join(' · ')}</small>
                    <Bar value={x.progress} bad={x.late} />
                    <small>{t("{n} % d'avancement", { n: x.progress }) + (x.openIssues ? ' · ' + t('{n} point(s) ouvert(s)', { n: x.openIssues }) : '')}</small>
                  </span>
                  <span className="row">
                    <button className="link" type="button" onClick={() => setSiteId(x.id)}>{t('Ouvrir')}</button>
                    {mgr ? <button className="link" type="button" onClick={() => confirm(t('Supprimer le chantier « {name} » avec tout son suivi (phases, dépenses, rapports…) ?', { name: x.name }), () => { oapi('DELETE', '/construction/sites/' + x.id).then(load).catch(fail); })}>{t('Supprimer')}</button> : null}
                  </span>
                </div>
              ))}
            </div>
          </>
        );
      }}
      </Loaded>
    </>
  );
}
