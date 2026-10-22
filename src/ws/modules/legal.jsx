import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import { Contracts, Disputes, Obligations, Privacy } from '../parts/legal/Sections.jsx';
import Templates from '../parts/legal/Templates.jsx';

/* Sous-application : Juridique et conformité (responsables et plus). Aide-mémoire d'organisation : ne remplace pas un avocat. */

const KIND = { contract_end: 'Fin de contrat', notice: 'Date limite de préavis', obligation: 'Obligation' };
const TABS = [['dash', 'Échéances'], ['contracts', 'Contrats'], ['obligations', 'Obligations'], ['disputes', 'Litiges'], ['privacy', 'Données personnelles'], ['templates', 'Modèles']];

export default function Legal() {
  const { oapi, dateFr, askAI } = useWs();
  const [tab, setTab] = useState('dash');
  const st = useLoad(() => oapi('GET', '/legal'), []);
  const load = st.reload;
  return (
    <>
      <div className="ws-head">
        <div><h1>Juridique et conformité</h1><p className="muted">Vos contrats, vos échéances et vos obligations, pour ne rien oublier.</p></div>
        <div className="row"><button className="btn signal small" type="button" onClick={() => askAI('Quelles sont mes échéances juridiques à venir et que dois-je faire en priorité ?')}>Demander à l'IA</button></div>
      </div>
      <p className="muted small">Aide-mémoire d'organisation : cet outil ne remplace pas un avocat et ne dit jamais qu'un document est « conforme ». Faites relire les textes importants par un professionnel du droit de votre pays.</p>
      <div className="ws-tabs">
        {TABS.map((t) => <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => { setTab(t[0]); load(); }}>{t[1]}</button>)}
      </div>
      {tab === 'contracts' ? <Contracts onChange={load} /> : null}
      {tab === 'obligations' ? <Obligations onChange={load} /> : null}
      {tab === 'disputes' ? <Disputes onChange={load} /> : null}
      {tab === 'privacy' ? <Privacy onChange={load} /> : null}
      {tab === 'templates' ? <Templates /> : null}
      {tab === 'dash' ? (
        <Loaded state={st}>{(j) => {
          const s = j.summary;
          return (
            <>
              <div className="kpis">
                <div className="stat"><b>{String(s.upcoming)}</b><span>échéance(s) dans 30 jours</span></div>
                <div className={'stat' + (s.toRenew ? ' bad' : '')}><b>{String(s.toRenew)}</b><span>contrat(s) à renouveler</span></div>
                <div className={'stat' + (s.overdue ? ' bad' : '')}><b>{String(s.overdue)}</b><span>obligation(s) en retard</span></div>
                <div className={'stat' + (s.expired ? ' bad' : '')}><b>{String(s.expired)}</b><span>contrat(s) expiré(s)</span></div>
              </div>
              <div className="ws-card">
                <h2>Échéances à venir (30 jours)</h2>
                {!j.upcoming.length ? <Empty text="Aucune échéance dans les 30 prochains jours." /> : null}
                {j.upcoming.map((u, i) => (
                  <div className="line" key={i}>
                    <span><b>{u.title}</b> <small>{KIND[u.kind] + (u.responsible ? ' · ' + u.responsible : '')}</small></span>
                    <span><span className={'pill ' + (u.days <= 7 ? 'bad' : 'mid')}>{u.days === 0 ? "Aujourd'hui" : 'Dans ' + u.days + ' j'}</span> <small>{dateFr(u.date)}</small></span>
                  </div>
                ))}
              </div>
              <div className="ws-card">
                <h2>Contrats à renouveler</h2>
                {!j.toRenew.length ? <Empty text="Aucun contrat à renouveler pour le moment." /> : null}
                {j.toRenew.map((c) => <div className="line" key={c.id}><span><b>{c.title}</b></span><span>{c.alerts.map((a) => <span key={a.code} className={'pill ' + (a.level === 'high' ? 'bad' : 'mid')}>{a.text}</span>)}</span></div>)}
              </div>
              <div className="ws-card">
                <h2>Obligations en retard</h2>
                {!j.overdueObligations.length ? <Empty text="Aucune obligation en retard." /> : null}
                {j.overdueObligations.map((o) => <div className="line" key={o.id}><span><b>{o.title}</b>{o.responsible ? <small>{' · ' + o.responsible}</small> : null}</span><span className="pill bad">{'Échue le ' + dateFr(o.dueDate)}</span></div>)}
              </div>
              {j.expired.length ? (
                <div className="ws-card">
                  <h2>Contrats expirés</h2>
                  {j.expired.map((c) => <div className="line" key={c.id}><span><b>{c.title}</b></span><span className="pill bad">{'Fini le ' + dateFr(c.endDate)}</span></div>)}
                  <p className="muted small">Passez un contrat expiré en « Terminé ou résilié » dans l'onglet Contrats quand il ne vous concerne plus.</p>
                </div>
              ) : null}
            </>
          );
        }}
        </Loaded>
      ) : null}
    </>
  );
}
