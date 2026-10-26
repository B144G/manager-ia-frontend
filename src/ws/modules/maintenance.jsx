/* Sous-application : Maintenance (parc d'équipements, plans préventifs, interventions, indicateurs). */
import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import { EquipmentForm, OrderForm, PlanForm } from '../parts/maintenance/Forms.jsx';
import { History, OrderDetail } from '../parts/maintenance/Detail.jsx';
import { EQ_FR, EQ_TONE, KIND_FR, ORDER_FR, PRIO_FR, Pill, dueText, qty } from '../parts/maintenance/common.jsx';

export default function Maintenance() {
  const t = useT();
  const { oapi, can, money, dateFr, modal, confirm, fail, toast } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('orders');
  const st = useLoad(() => Promise.all([oapi('GET', '/maintenance'), oapi('GET', '/maintenance/plans'), oapi('GET', '/members')]), []);
  const load = st.reload;
  const del = (path, text) => confirm(text, () => { oapi('DELETE', path).then(load).catch(fail); });

  const editEq = (e) => modal(e ? t("Modifier l'équipement") : t('Nouvel équipement'), (close) => <EquipmentForm equipment={e} close={close} done={load} />);
  const history = (e) => modal(t('Historique : {name}', { name: e.name }), () => <History id={e.id} />, { wide: true });
  const detail = (o) => modal(o.code, () => <OrderDetail id={o.id} done={load} />);
  const newOrder = (eqs, members, preset) => (eqs.length ? modal(t('Nouvelle intervention'), (close) => <OrderForm equipment={eqs} members={members} preset={preset} close={close} done={() => { setTab('orders'); load(); }} />) : toast(t("Ajoutez d'abord un équipement."), true));
  const editPlan = (p, eqs) => modal(p ? t('Modifier le plan') : t('Nouveau plan préventif'), (close) => <PlanForm plan={p} equipment={eqs} close={close} done={load} />);
  const planOrder = (p) => oapi('POST', '/maintenance/plans/' + p.id + '/order', {}).then(() => { toast(t('Intervention préventive créée.')); setTab('orders'); load(); }).catch(fail);

  return (
    <>
      <Loaded state={st}>{([j, pl, mem]) => {
        const s = j.summary;
        const eqs = j.equipment.filter((e) => e.status !== 'retired');
        const members = mem.members;
        return (
          <>
            <div className="ws-head">
              <div><h1>{t('Maintenance')}</h1><p className="muted">{t('Vos équipements, leur entretien et leurs pannes.')}</p></div>
              <div className="row">
                <button className="btn small" type="button" onClick={() => newOrder(eqs, members)}>{mgr ? t('Nouvelle intervention') : t('Signaler une panne')}</button>
                {mgr ? <button className="btn primary small" type="button" onClick={() => editEq()}>{t('Ajouter un équipement')}</button> : null}
              </div>
            </div>
            <div className="kpis">
              <div className="stat"><b>{s.availability === null ? '-' : s.availability + ' %'}</b><span>{t('disponibilité du mois')}</span></div>
              <div className={'stat' + (s.equipment.broken ? ' bad' : '')}><b>{String(s.equipment.broken)}</b><span>{t('équipement(s) en panne')}</span></div>
              <div className="stat"><b>{qty(s.downtimeHours) + ' h'}</b><span>{t("d'arrêt ce mois-ci")}</span></div>
              {s.monthCost !== undefined ? <div className="stat"><b>{money(s.monthCost)}</b><span>{t('coût de maintenance du mois')}</span></div> : <div className={'stat' + (s.latePlans ? ' bad' : '')}><b>{String(s.latePlans)}</b><span>{t('entretien(s) en retard')}</span></div>}
            </div>
            {pl.plans.some((p) => p.state !== 'ok') ? (
              <div className="ws-card">
                <h2>{t("Alertes d'entretien")}</h2>
                {pl.plans.filter((p) => p.state !== 'ok').map((p) => (
                  <div className="line" key={p.id}><span><b>{p.equipment + ' : ' + p.task}</b>{' '}<Pill s={p.state === 'late' ? ['En retard', 'bad'] : ['Bientôt', 'mid']} /><small>{' ' + dueText(p, dateFr)}</small></span>
                    {mgr ? <button className="link" type="button" onClick={() => planOrder(p)}>{t('Planifier')}</button> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="ws-tabs">
              {[['orders', s.openOrders ? t('Interventions ({n})', { n: s.openOrders }) : t('Interventions')], ['equipment', t('Équipements')], ['plans', t('Plans préventifs')], ['stats', t('Indicateurs')]].map((x) => (
                <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} onClick={() => setTab(x[0])}>{x[1]}</button>
              ))}
            </div>

            {tab === 'orders' ? (
              <div className="ws-card">
                <h2>{t('Interventions')}</h2>
                {!j.orders.length ? <Empty text={t('Aucune intervention. Signalez une panne ou planifiez un entretien.')} /> : null}
                {j.orders.map((o) => (
                  <div className="line" key={o.id}>
                    <span><b>{o.code + ' · ' + o.equipment}</b>{' '}<Pill s={ORDER_FR[o.status]} />{o.priority === 'urgent' || o.priority === 'high' ? <span className="pill bad">{t(PRIO_FR[o.priority])}</span> : null}
                      <small>{' ' + o.title + ' · ' + (o.kind === 'corrective' ? t('panne') : t('préventive')) + ' · ' + dateFr(o.openedAt)}</small></span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => detail(o)}>{t('Ouvrir')}</button>
                      {mgr ? <button className="link" type="button" onClick={() => del('/maintenance/orders/' + o.id, t('Supprimer {code} ? Les pièces prises dans le stock y retournent.', { code: o.code }))}>{t('Supprimer')}</button> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'equipment' ? (
              <div className="ws-card">
                <h2>{t("Parc d'équipements")}</h2>
                {!j.equipment.length ? <Empty text={mgr ? t('Aucun équipement. Ajoutez vos machines, véhicules, outils…') : t('Aucun équipement pour le moment.')} /> : null}
                {j.equipment.map((e) => (
                  <div className="line" key={e.id}>
                    <span><b>{e.name}</b>{' '}<Pill s={[EQ_FR[e.status], EQ_TONE[e.status]]} />
                      <small>{' ' + [t(KIND_FR[e.kind]), e.reference, e.location, e.purchasedAt ? t('acheté le {date}', { date: dateFr(e.purchasedAt) }) : '', e.value ? money(e.value) : ''].filter(Boolean).join(' · ')}</small></span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => history(e)}>{t('Historique')}</button>
                      {e.status !== 'retired' ? <button className="link" type="button" onClick={() => newOrder([e], members, { equipmentId: e.id })}>{mgr ? t('Intervention') : t('Panne')}</button> : null}
                      {mgr ? <button className="link" type="button" onClick={() => editEq(e)}>{t('Modifier')}</button> : null}
                      {mgr ? <button className="link" type="button" onClick={() => del('/maintenance/equipment/' + e.id, t('Supprimer « {name} » et tout son historique ?', { name: e.name }))}>{t('Supprimer')}</button> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'plans' ? (
              <div className="ws-card">
                <h2>{t('Plans de maintenance préventive')}</h2>
                {mgr ? <p><button className="btn small" type="button" onClick={() => (eqs.length ? editPlan(null, eqs) : toast(t("Ajoutez d'abord un équipement."), true))}>Ajouter un plan</button></p> : null}
                {!pl.plans.length ? <Empty text={t('Aucun plan. Un plan rappelle un entretien régulier (graissage, vidange, contrôle…).')} /> : null}
                {pl.plans.map((p) => (
                  <div className="line" key={p.id}>
                    <span><b>{p.equipment + ' : ' + p.task}</b>{' '}<Pill s={p.state === 'late' ? ['En retard', 'bad'] : p.state === 'soon' ? ['Bientôt', 'mid'] : ['À jour', 'good']} /><small>{' ' + dueText(p, dateFr)}</small></span>
                    {mgr ? (
                      <span className="row">
                        <button className="link" type="button" onClick={() => planOrder(p)}>{t('Planifier')}</button>
                        <button className="link" type="button" onClick={() => editPlan(p, eqs)}>{t('Modifier')}</button>
                        <button className="link" type="button" onClick={() => del('/maintenance/plans/' + p.id, t('Supprimer ce plan ?'))}>{t('Supprimer')}</button>
                      </span>
                    ) : null}
                  </div>
                ))}
                <p className="muted small">{t('Quand vous terminez une intervention préventive liée à un plan, la prochaine échéance est recalculée automatiquement.')}</p>
              </div>
            ) : null}

            {tab === 'stats' ? (
              <div className="ws-card">
                <h2>{t('Indicateurs')}</h2>
                <div className="line"><span>{t('Équipements en service')}</span><b>{s.equipment.running + ' / ' + (s.equipment.total - s.equipment.retired)}</b></div>
                <div className="line"><span>{t('Disponibilité du mois')}</span><b>{s.availability === null ? '-' : s.availability + ' %'}</b></div>
                <div className="line"><span>{t("Temps d'arrêt du mois")}</span><b>{qty(s.downtimeHours) + ' h'}</b></div>
                {s.monthCost !== undefined ? <div className="line"><span>{t('Coût de maintenance du mois')}</span><b>{money(s.monthCost)}</b></div> : null}
                <h3>{t('Équipements les plus en panne (12 mois)')}</h3>
                {!s.topBreakdowns.length ? <Empty text={t('Aucune panne enregistrée.')} /> : null}
                {s.topBreakdowns.map((x) => <div className="line" key={x.equipmentId}><span><b>{x.name}</b></span><span>{t("{n} panne(s) · {hours} h d'arrêt", { n: x.breakdowns, hours: qty(x.downtimeHours) })}</span></div>)}
                <p className="muted small">{t("La disponibilité est calculée à partir des durées d'arrêt que vous saisissez à la clôture des interventions : plus elles sont justes, plus l'indicateur est fiable.")}</p>
              </div>
            ) : null}
          </>
        );
      }}
      </Loaded>
    </>
  );
}
