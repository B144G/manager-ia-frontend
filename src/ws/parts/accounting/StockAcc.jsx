import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';

/* Stocks en comptabilité : valeur du stock du module Stock (coût moyen pondéré) face au stock comptabilisé, et constatation de la variation de stock.
   Lecture des routes du serveur ; l'écriture est passée par le serveur (équilibre, période clôturée, une seule écriture par opération). */

const NATURES = [['goods', 'Marchandises (311)'], ['raw', 'Matières premières (321)'], ['supplies', 'Matières consommables (331)']];

export default function StockAccScreen() {
  const t = useT();
  const { oapi, money, dateFr, today, toast, confirm, fail } = useWs();
  const [date, setDate] = useState(() => today());
  const [nature, setNature] = useState('goods');
  const st = useLoad(() => oapi('GET', '/accounting/stock-valuation?date=' + date + '&nature=' + nature), [date, nature]);
  const j = st.data;
  const post = () => confirm(
    t("Constater le stock au {date} ? Une écriture de variation de stock de {amount} sera passée.", { date: dateFr(date), amount: money(Math.abs(j.gap)) }),
    () => oapi('POST', '/accounting/stock-valuation/post', { date, nature }).then((r) => { toast(t('Variation de stock passée : {number}.', { number: r.entry })); st.reload(); }).catch(fail),
    t('Constater le stock'),
  );
  return (
    <>
      <div className="ws-card">
        <h2>{t('Stocks en comptabilité')}</h2>
        <p className="muted small">{t("Vos achats sont déjà comptabilisés en charges. À la date d'inventaire, le stock restant est ajouté au bilan et retiré des charges : c'est la variation de stock. Le stock est valorisé au coût moyen pondéré du module Stock.")}</p>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
          <label className="fld"><span>{t("Date d'inventaire")}</span><input type="date" value={date} max={today()} onChange={(e) => { if (e.target.value) setDate(e.target.value); }} /></label>
          <label className="fld"><span>{t('Nature du stock')}</span>
            <select value={nature} onChange={(e) => setNature(e.target.value)}>{NATURES.map((x) => <option key={x[0]} value={x[0]}>{t(x[1])}</option>)}</select>
          </label>
        </div>
        {st.loading && !j ? <Loading /> : null}
        {st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : null}
      </div>
      {j ? (
        <>
          <div className="ws-card">
            <div className="line"><span>{t('Stock valorisé (module Stock)')}</span><b>{money(j.totalValue)}</b></div>
            <div className="line"><span>{t('Stock en comptabilité (compte {account})', { account: j.account })}</span><b>{money(j.accounting)}</b></div>
            <div className="line"><b>{j.gap === 0 ? t('Aucun écart') : j.gap > 0 ? t('Stock à ajouter en comptabilité') : t('Stock à retirer de la comptabilité')}</b><b className={j.gap === 0 ? 'ok' : 'late'}>{money(Math.abs(j.gap))}</b></div>
            {j.gap !== 0 ? <div className="row" style={{ marginTop: 10 }}><button className="btn primary small" type="button" onClick={post}>{t('Constater le stock à cette date')}</button></div> : <p className="ok small">{t('La comptabilité est à jour pour cette date.')}</p>}
            {j.gap !== 0 ? <p className="muted small">{j.gap > 0 ? t('Débit {s} (stock) · crédit {v} (variation de stock).', { s: j.account, v: j.variationAccount }) : t('Débit {v} (variation de stock) · crédit {s} (stock).', { s: j.account, v: j.variationAccount })}</p> : null}
          </div>
          <div className="ws-card">
            <h3>{t('Détail par article')}</h3>
            {!j.items.length ? <Empty text={t("Aucun article en stock à cette date. Ajoutez-les dans le module Stock et achats.")} /> : null}
            {j.items.map((x) => (
              <div className="line" key={x.id} style={{ flexWrap: 'wrap' }}>
                <span><b>{x.name}</b><small>{' ' + x.quantity + ' ' + x.unit + ' × ' + money(x.unitCost)}</small></span>
                <b>{money(x.value)}</b>
              </div>
            ))}
            <p className="muted small">{t('Les quantités des dates passées sont reconstituées à partir des mouvements du module Stock ; le coût unitaire est le coût moyen actuel.')}</p>
          </div>
          {j.history.length ? (
            <div className="ws-card">
              <h3>{t('Variations déjà constatées')}</h3>
              {j.history.map((h) => (
                <div className="line" key={h.number} style={{ flexWrap: 'wrap' }}>
                  <span><b>{h.number}</b><small>{' ' + dateFr(h.date) + (h.cancelled ? ' · ' + t('annulée') : '')}</small></span>
                  <b>{(h.increase ? '+' : '−') + money(h.amount)}</b>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
