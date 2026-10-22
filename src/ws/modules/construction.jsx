/* Sous-application : Chantiers (BTP) : chantiers, phases, dépenses vs budget, pointage, rapports, incidents, situations. */
import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import { SiteForm } from '../parts/construction/Forms.jsx';
import Site from '../parts/construction/Site.jsx';
import { Bar, Pill, STATUS_FR, STATUS_TONE } from '../parts/construction/common.jsx';

export default function Construction() {
  const { oapi, can, money, dateFr, modal, confirm, fail } = useWs();
  const mgr = can('manager');
  const [siteId, setSiteId] = useState(null);
  const st = useLoad(() => Promise.all([oapi('GET', '/construction'), oapi('GET', '/members')]), []);
  const load = st.reload;

  const edit = (s, after) => modal(s && s.id ? 'Modifier le chantier' : 'Nouveau chantier', (close) => <SiteForm site={s} members={st.data ? st.data[1].members : []} close={close} done={() => { load(); if (after) after(); }} />, { wide: true });

  if (siteId) return <Site id={siteId} back={() => setSiteId(null)} onChange={load} edit={edit} />;

  return (
    <>
      <div className="ws-head">
        <div><h1>Chantiers (BTP)</h1><p className="muted">Vos chantiers : avancement, dépenses, équipe et paiements du client.</p></div>
        {mgr ? <div className="row"><button className="btn primary small" type="button" onClick={() => edit()}>Nouveau chantier</button></div> : null}
      </div>
      <Loaded state={st}>{([j]) => {
        const s = j.summary;
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{String(s.active)}</b><span>chantier(s) en cours</span></div>
              <div className="stat"><b>{s.avgProgress + ' %'}</b><span>avancement moyen</span></div>
              <div className={'stat' + (s.late ? ' bad' : '')}><b>{String(s.late)}</b><span>chantier(s) en retard</span></div>
              {s.forecastMargin !== undefined ? <div className={'stat' + (s.forecastMargin < 0 ? ' bad' : '')}><b>{money(s.forecastMargin)}</b><span>marge prévisionnelle</span></div> : <div className="stat"><b>{String(s.total)}</b><span>chantier(s) au total</span></div>}
            </div>
            {mgr && (s.overBudget || s.toCollect) ? <p className="muted small">{(s.overBudget ? s.overBudget + ' chantier(s) dépassent leur budget. ' : '') + (s.toCollect ? 'Reste à encaisser auprès des clients : ' + money(s.toCollect) + '.' : '')}</p> : null}
            <div className="ws-card">
              <h2>Chantiers</h2>
              {!j.sites.length ? <Empty text={mgr ? 'Aucun chantier. Créez le premier avec son client, son budget et ses dates.' : 'Aucun chantier pour le moment.'} /> : null}
              {j.sites.map((x) => (
                <div className="line" key={x.id}>
                  <span style={{ flex: '1 1 240px' }}>
                    <b>{x.name}</b>{' '}<Pill t={[STATUS_FR[x.status], STATUS_TONE[x.status]]} />{x.late ? <span className="pill bad">En retard</span> : null}{x.overrun === 'over' ? <span className="pill bad">Budget dépassé</span> : null}
                    <small>{' ' + [x.client, x.location, x.endDate ? 'fin prévue le ' + dateFr(x.endDate) : '', x.budget ? 'marché ' + money(x.budget) : '', x.spent !== undefined && x.budget ? 'dépensé ' + money(x.spent) : ''].filter(Boolean).join(' · ')}</small>
                    <Bar value={x.progress} bad={x.late} />
                    <small>{x.progress + ' % d\'avancement' + (x.openIssues ? ' · ' + x.openIssues + ' point(s) ouvert(s)' : '')}</small>
                  </span>
                  <span className="row">
                    <button className="link" type="button" onClick={() => setSiteId(x.id)}>Ouvrir</button>
                    {mgr ? <button className="link" type="button" onClick={() => confirm('Supprimer le chantier « ' + x.name + ' » avec tout son suivi (phases, dépenses, rapports…) ?', () => { oapi('DELETE', '/construction/sites/' + x.id).then(load).catch(fail); })}>Supprimer</button> : null}
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
