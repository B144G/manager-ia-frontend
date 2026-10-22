/* Détail d'une intervention (pièces, démarrage, clôture) et historique d'un équipement. */
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { CloseForm, PartForm } from './Forms.jsx';
import { EQ_FR, EQ_TONE, ORDER_FR, PRIO_FR, Pill, dueText, qty } from './common.jsx';

export function OrderDetail({ id, done }) {
  const { oapi, can, money, dateFr, modal, confirm, fail, info } = useWs();
  const st = useLoad(() => oapi('GET', '/maintenance/orders/' + id), []);
  const reload = () => { st.reload(); done(); };
  return (
    <Loaded state={st}>{({ order: o, parts }) => {
      const mgr = can('manager');
      const work = mgr || o.assigneeId === info.me.userId;
      const add = () => oapi('GET', '/stock').then((s) => modal('Ajouter une pièce', (close) => <PartForm orderId={o.id} items={s.items} close={close} done={reload} />)).catch(fail);
      return (
        <div>
          <p><b>{o.code + ' · ' + o.equipment}</b>{' '}<Pill t={ORDER_FR[o.status]} /></p>
          <p>{o.title}</p>
          {o.description ? <p className="muted">{o.description}</p> : null}
          <p className="muted small">{(o.kind === 'corrective' ? 'Corrective' : 'Préventive') + ' · priorité ' + PRIO_FR[o.priority].toLowerCase() + ' · ouverte le ' + dateFr(o.openedAt) + (o.closedAt ? ' · terminée le ' + dateFr(o.closedAt) : '') + (o.contractor ? ' · prestataire : ' + o.contractor : '') + (o.status === 'done' ? ' · arrêt : ' + qty(o.downtimeHours) + ' h' : '')}</p>
          {o.cost !== undefined ? <p className="muted small">{'Coût : ' + money(o.cost) + ' (main-d\'œuvre ' + money(o.laborCost) + ', pièces ' + money(o.partsCost) + ')'}</p> : null}
          <h3>Pièces utilisées</h3>
          {!parts.length ? <Empty text="Aucune pièce." /> : null}
          {parts.map((p) => (
            <div className="line" key={p.id}>
              <span><b>{qty(p.quantity) + ' × ' + p.name}</b><small>{p.fromStock ? ' prélevée du stock' : ' hors stock'}{p.total !== undefined ? ' · ' + money(p.total) : ''}</small></span>
              {work && o.status !== 'done' ? <button className="link" type="button" onClick={() => confirm('Retirer cette pièce' + (p.fromStock ? ' (elle retourne au stock)' : '') + ' ?', () => { oapi('DELETE', '/maintenance/orders/' + o.id + '/parts/' + p.id).then(reload).catch(fail); })}>Retirer</button> : null}
            </div>
          ))}
          {work && o.status !== 'done' ? (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn small" type="button" onClick={add}>Ajouter une pièce</button>
              {o.status === 'open' ? <button className="btn small" type="button" onClick={() => oapi('POST', '/maintenance/orders/' + o.id + '/start').then(reload).catch(fail)}>Démarrer</button> : null}
              <button className="btn primary small" type="button" onClick={() => modal('Terminer ' + o.code, (close) => <CloseForm order={o} close={close} done={reload} />)}>Terminer</button>
            </div>
          ) : null}
        </div>
      );
    }}
    </Loaded>
  );
}

export function History({ id }) {
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/maintenance/equipment/' + id), []);
  return (
    <Loaded state={st}>{(j) => (
      <div>
        <p><Pill t={[EQ_FR[j.equipment.status], EQ_TONE[j.equipment.status]]} />{' '}<small className="muted">{[j.equipment.reference, j.equipment.location].filter(Boolean).join(' · ')}</small></p>
        <p className="muted small">{j.totals.interventions + ' intervention(s), ' + j.totals.breakdowns + ' panne(s), ' + qty(j.totals.downtimeHours) + ' h d\'arrêt' + (j.totals.cost !== undefined ? ', coût total ' + money(j.totals.cost) : '')}</p>
        <h3>Plans préventifs</h3>
        {!j.plans.length ? <Empty text="Aucun plan préventif." /> : null}
        {j.plans.map((p) => <div className="line" key={p.id}><span><b>{p.task}</b><small>{' ' + dueText(p, dateFr)}</small></span><Pill t={p.state === 'late' ? ['En retard', 'bad'] : p.state === 'soon' ? ['Bientôt', 'mid'] : ['', '']} /></div>)}
        <h3>Historique</h3>
        {!j.orders.length ? <Empty text="Aucune intervention pour cet équipement." /> : null}
        {j.orders.map((o) => (
          <div className="line" key={o.id}>
            <span><b>{o.code + ' · ' + o.title}</b>{' '}<Pill t={ORDER_FR[o.status]} /><small>{' ' + dateFr(o.openedAt) + (o.cost !== undefined && o.status === 'done' ? ' · ' + money(o.cost) : '') + (o.status === 'done' ? ' · arrêt ' + qty(o.downtimeHours) + ' h' : '')}</small></span>
          </div>
        ))}
      </div>
    )}
    </Loaded>
  );
}
