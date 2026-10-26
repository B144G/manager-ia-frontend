/* Détail d'une intervention (pièces, démarrage, clôture) et historique d'un équipement. */
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { CloseForm, PartForm } from './Forms.jsx';
import { EQ_FR, EQ_TONE, ORDER_FR, PRIO_FR, Pill, dueText, qty } from './common.jsx';

export function OrderDetail({ id, done }) {
  const t = useT();
  const { oapi, can, money, dateFr, modal, confirm, fail, info } = useWs();
  const st = useLoad(() => oapi('GET', '/maintenance/orders/' + id), []);
  const reload = () => { st.reload(); done(); };
  return (
    <Loaded state={st}>{({ order: o, parts }) => {
      const mgr = can('manager');
      const work = mgr || o.assigneeId === info.me.userId;
      const add = () => oapi('GET', '/stock').then((s) => modal(t('Ajouter une pièce'), (close) => <PartForm orderId={o.id} items={s.items} close={close} done={reload} />)).catch(fail);
      return (
        <div>
          <p><b>{o.code + ' · ' + o.equipment}</b>{' '}<Pill s={ORDER_FR[o.status]} /></p>
          <p>{o.title}</p>
          {o.description ? <p className="muted">{o.description}</p> : null}
          <p className="muted small">{(o.kind === 'corrective' ? t('Corrective') : t('Préventive')) + ' · ' + t('priorité {level}', { level: t(PRIO_FR[o.priority]).toLowerCase() }) + ' · ' + t('ouverte le {date}', { date: dateFr(o.openedAt) }) + (o.closedAt ? ' · ' + t('terminée le {date}', { date: dateFr(o.closedAt) }) : '') + (o.contractor ? ' · ' + t('prestataire : {name}', { name: o.contractor }) : '') + (o.status === 'done' ? ' · ' + t('arrêt : {n} h', { n: qty(o.downtimeHours) }) : '')}</p>
          {o.cost !== undefined ? <p className="muted small">{t("Coût : {total} (main-d'œuvre {labor}, pièces {parts})", { total: money(o.cost), labor: money(o.laborCost), parts: money(o.partsCost) })}</p> : null}
          <h3>{t('Pièces utilisées')}</h3>
          {!parts.length ? <Empty text={t('Aucune pièce.')} /> : null}
          {parts.map((p) => (
            <div className="line" key={p.id}>
              <span><b>{qty(p.quantity) + ' × ' + p.name}</b><small>{' ' + (p.fromStock ? t('prélevée du stock') : t('hors stock'))}{p.total !== undefined ? ' · ' + money(p.total) : ''}</small></span>
              {work && o.status !== 'done' ? <button className="link" type="button" onClick={() => confirm(p.fromStock ? t('Retirer cette pièce (elle retourne au stock) ?') : t('Retirer cette pièce ?'), () => { oapi('DELETE', '/maintenance/orders/' + o.id + '/parts/' + p.id).then(reload).catch(fail); })}>{t('Retirer')}</button> : null}
            </div>
          ))}
          {work && o.status !== 'done' ? (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn small" type="button" onClick={add}>{t('Ajouter une pièce')}</button>
              {o.status === 'open' ? <button className="btn small" type="button" onClick={() => oapi('POST', '/maintenance/orders/' + o.id + '/start').then(reload).catch(fail)}>{t('Démarrer')}</button> : null}
              <button className="btn primary small" type="button" onClick={() => modal(t('Terminer {code}', { code: o.code }), (close) => <CloseForm order={o} close={close} done={reload} />)}>{t('Terminer')}</button>
            </div>
          ) : null}
        </div>
      );
    }}
    </Loaded>
  );
}

export function History({ id }) {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/maintenance/equipment/' + id), []);
  return (
    <Loaded state={st}>{(j) => (
      <div>
        <p><Pill s={[EQ_FR[j.equipment.status], EQ_TONE[j.equipment.status]]} />{' '}<small className="muted">{[j.equipment.reference, j.equipment.location].filter(Boolean).join(' · ')}</small></p>
        <p className="muted small">{t("{n} intervention(s), {breakdowns} panne(s), {hours} h d'arrêt", { n: j.totals.interventions, breakdowns: j.totals.breakdowns, hours: qty(j.totals.downtimeHours) }) + (j.totals.cost !== undefined ? ', ' + t('coût total {amount}', { amount: money(j.totals.cost) }) : '')}</p>
        <h3>{t('Plans préventifs')}</h3>
        {!j.plans.length ? <Empty text={t('Aucun plan préventif.')} /> : null}
        {j.plans.map((p) => <div className="line" key={p.id}><span><b>{p.task}</b><small>{' ' + dueText(p, dateFr)}</small></span><Pill s={p.state === 'late' ? ['En retard', 'bad'] : p.state === 'soon' ? ['Bientôt', 'mid'] : ['', '']} /></div>)}
        <h3>{t('Historique')}</h3>
        {!j.orders.length ? <Empty text={t('Aucune intervention pour cet équipement.')} /> : null}
        {j.orders.map((o) => (
          <div className="line" key={o.id}>
            <span><b>{o.code + ' · ' + o.title}</b>{' '}<Pill s={ORDER_FR[o.status]} /><small>{' ' + dateFr(o.openedAt) + (o.cost !== undefined && o.status === 'done' ? ' · ' + money(o.cost) : '') + (o.status === 'done' ? ' · ' + t('arrêt {n} h', { n: qty(o.downtimeHours) }) : '')}</small></span>
          </div>
        ))}
      </div>
    )}
    </Loaded>
  );
}
