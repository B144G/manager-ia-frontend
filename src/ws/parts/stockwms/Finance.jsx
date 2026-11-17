import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Seg, Tag, WMS, qty, useDate } from './kit.jsx';

/* Stock et finances : la valeur du stock face à la comptabilité, et l'argent que le stock immobilise ou va demander (trésorerie). */
function Accounting() {
  const t = useT();
  const { oapi, money, orgId } = useWs();
  const navigate = useNavigate();
  const date = useDate();
  const st = useLoad(() => oapi('GET', WMS + '/accounting-link'), []);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Kpis list={[{ label: t('valeur du stock'), value: money(j.stockValue) }, { label: t('stock en comptabilité (classe 3)'), value: money(j.accounted) }, { label: t('écart à constater'), value: money(j.gap), bad: Math.abs(j.gap) > 1 }]} />
        <div className="ws-card">
          <h2>{t('Comptes de stock')}</h2>
          {j.balances.map((b) => <div className="line" key={b.account}><span><b>{b.account}</b><small>{' ' + t(b.label)}</small></span><b>{money(b.balance)}</b></div>)}
          <p className="muted small">{j.lastPosting ? t('Dernière constatation : {n} du {d}.', { n: j.lastPosting.number, d: date(j.lastPosting.date) }) : t("Le stock n'a pas encore été constaté en comptabilité.")}</p>
          <button className="btn small primary" type="button" onClick={() => navigate('/app/' + orgId + '/accounting')}>{t('Ouvrir la Comptabilité (Stocks)')}</button>
        </div>
        <div className="ws-card">
          <h2>{t('À comptabiliser')}</h2>
          <div className="line"><span>{t('Avoirs fournisseur reçus, enregistrés sans écriture')}</span><b>{j.toBook.supplierCredits + (j.toBook.supplierCredits ? ' · ' + money(j.toBook.supplierCreditsAmount) : '')}</b></div>
          <div className="line"><span>{t('Retours clients validés sans avoir client')}</span><b>{String(j.toBook.customerReturnsWithoutCreditNote)}</b></div>
          <div className="line"><span>{t("Frais d'arrivée déjà sortis du stock (à passer en charge)")}</span><b>{money(j.toBook.landedCostsToExpense)}</b></div>
          <p className="muted small">{t("La valeur du stock vient du coût moyen pondéré ; la comptabilité la constate à une date d'inventaire.")}</p>
        </div>
      </>
    )}
    </Loaded>
  );
}

function Cash() {
  const t = useT();
  const { oapi, money } = useWs();
  const date = useDate();
  const [days, setDays] = useState('30');
  const st = useLoad(() => oapi('GET', WMS + '/cash?days=' + days), [days]);
  return (
    <>
      <Seg tabs={[['30', t('30 jours')], ['60', t('60 jours')], ['90', t('90 jours')]]} value={days} onChange={setDays} />
      <Loaded state={st}>{(j) => (
        <>
          <Kpis list={[{ label: t('besoin de trésorerie sur {n} jours', { n: j.horizonDays }), value: money(j.cashNeed), bad: j.cashNeed > 0 }, { label: t('argent immobilisé dans le stock'), value: money(j.tiedUp) }, { label: t('dont stock dormant ({p} %)', { p: qty(j.dormantShare) }), value: money(j.dormant), bad: j.dormantShare > 20 }]} />
          <div className="ws-card">
            <h2>{t('Ce qui sortira')}</h2>
            <div className="line"><span>{t("Bons de commande à recevoir (jusqu'au {d})", { d: date(j.until) })}</span><b>{money(j.commitments.inHorizon)}</b></div>
            <div className="line"><span>{t('Dettes fournisseurs à échéance')}</span><b>{money(j.payables.dueInHorizon)}</b></div>
            {j.payables.overdue ? <div className="line"><span>{t('dont en retard')}</span><b className="late">{money(j.payables.overdue)}</b></div> : null}
            <div className="line"><span>{t('Réapprovisionnement conseillé')}</span><b>{money(j.reorder.estimate)}</b></div>
            <div className="line"><span>{t('Avoirs attendus des fournisseurs')}</span><b className="ok">{'− ' + money(j.creditsExpected)}</b></div>
            <p className="muted small">{t("Besoin = bons de commande à recevoir + dettes à échéance + réapprovisionnement conseillé − avoirs attendus.")}</p>
          </div>
          <div className="ws-card">
            <h2>{t("Engagements d'achat")}</h2>
            {!j.commitments.orders.length ? <Empty text={t('Aucun bon de commande en attente de réception.')} /> : null}
            {j.commitments.orders.map((o) => <div className="line" key={o.id}><span><b>{o.number}</b><small>{' ' + o.supplier + (o.expectedDate ? ' · ' + t('attendu le {d}', { d: date(o.expectedDate) }) : '')}</small></span><b>{money(o.amount)}</b></div>)}
          </div>
          {j.reorder.items.length ? (
            <div className="ws-card">
              <h2>{t('À commander bientôt')}</h2>
              {j.reorder.items.map((x) => <div className="line" key={x.itemId}><span><b>{x.name}</b> {x.urgency === 'critical' ? <Tag tone="bad">{t('Urgent')}</Tag> : null}<small>{' ' + t('commander {n}', { n: qty(x.toOrder) })}</small></span>{x.estimate !== null ? <b>{money(x.estimate)}</b> : null}</div>)}
            </div>
          ) : null}
        </>
      )}
      </Loaded>
    </>
  );
}

export default function Finance() {
  const t = useT();
  const [tab, setTab] = useState('acc');
  return (
    <>
      <Seg tabs={[['acc', t('Stock et comptabilité')], ['cash', t('Trésorerie du stock')]]} value={tab} onChange={setTab} />
      {tab === 'acc' ? <Accounting /> : <Cash />}
    </>
  );
}
