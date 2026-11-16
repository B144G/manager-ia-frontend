import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Seg, Tag, WMS, qty } from './kit.jsx';

/* Prévision de la demande (moyenne mobile sur les sorties hebdomadaires) et réapprovisionnement : point de commande, stock de sécurité, délai fournisseur. */
const URG = { critical: ['Urgent', 'bad'], soon: ['Bientôt', 'mid'], ok: ['', ''] };
const TREND = { up: '↗', down: '↘', flat: '→' };

/** Petite courbe des sorties par semaine (SVG, sans bibliothèque). */
function Spark({ series, label }) {
  const max = Math.max(...series, 1);
  const w = 120; const h = 30; const step = series.length > 1 ? w / (series.length - 1) : w;
  const pts = series.map((v, i) => (i * step).toFixed(1) + ',' + (h - (v / max) * (h - 4) - 2).toFixed(1)).join(' ');
  return <svg className="wms-spark" viewBox={'0 0 ' + w + ' ' + h} role="img" aria-label={label}><polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts} /></svg>;
}

export default function Forecast() {
  const t = useT();
  const { oapi, can, money, modal, fail, toast } = useWs();
  const [tab, setTab] = useState('reorder');
  const ro = useLoad(() => oapi('GET', WMS + '/reorder'), []);
  const fc = useLoad(() => oapi('GET', WMS + '/forecast'), []);
  const reload = () => { ro.reload(); fc.reload(); };
  const params = (x) => oapi('GET', WMS + '/items/' + x.itemId + '/params').then((j) => modal(t('Réglages de réapprovisionnement : {name}', { name: x.name }), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'leadDays', label: t('Délai du fournisseur (jours)'), value: j.params.leadDays === null ? '' : j.params.leadDays, hint: t('Vide : on prend le délai du fournisseur au meilleur prix, sinon le délai par défaut.') },
      { k: 'safetyStock', label: t('Stock de sécurité ({unit})', { unit: x.unit || '' }), value: j.params.safetyStock === null ? '' : j.params.safetyStock, hint: t('Vide : calculé selon la régularité de la demande et le niveau de service.') },
      { k: 'reorderPoint', label: t('Point de commande (facultatif)'), value: j.params.reorderPoint === null ? '' : j.params.reorderPoint, hint: t('Vide : demande pendant le délai + stock de sécurité.') },
      { k: 'orderMultiple', label: t('Commander par multiples de (facultatif)'), value: j.params.orderMultiple === null ? '' : j.params.orderMultiple, hint: t('Ex. 12 pour des cartons de 12.') }]}
    onSubmit={(v) => oapi('PUT', WMS + '/items/' + x.itemId + '/params', { leadDays: v.leadDays === '' ? null : v.leadDays, safetyStock: v.safetyStock === '' ? null : v.safetyStock, reorderPoint: v.reorderPoint === '' ? null : v.reorderPoint, orderMultiple: v.orderMultiple === '' ? null : v.orderMultiple }).then(() => { close(); reload(); toast(t('Réglages enregistrés.')); })} />
  ))).catch(fail);
  const settings = () => oapi('GET', WMS + '/settings').then((j) => modal(t('Réglages de la prévision'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'forecastWeeks', label: t('Semaines prises en compte'), value: j.settings.forecastWeeks }, { k: 'serviceLevel', label: t('Niveau de service visé (%)'), value: j.settings.serviceLevel, hint: t('95 % : on accepte une rupture sur 20 cycles de commande.') },
      { k: 'defaultLeadDays', label: t('Délai fournisseur par défaut (jours)'), value: j.settings.defaultLeadDays }, { k: 'reviewDays', label: t('Jours de demande à couvrir entre deux commandes'), value: j.settings.reviewDays }]}
    onSubmit={(v) => oapi('PUT', WMS + '/settings', v).then(() => { close(); reload(); })} />
  ))).catch(fail);
  const order = (x) => {
    if (!x.supplier) { toast(t("Aucun fournisseur connu pour cet article : ajoutez un prix dans « Articles et commandes ».")); return; }
    oapi('POST', '/stock/orders', { orders: [{ itemId: x.itemId, quantity: x.toOrder, supplierId: x.supplier.supplierId }] }).then(() => { toast(t('Commande créée : elle attend la validation d\'un responsable.')); reload(); }).catch(fail);
  };
  return (
    <>
      <div className="row wms-toolbar">{can('admin') ? <button className="btn small" type="button" onClick={settings}>{t('Réglages')}</button> : null}</div>
      <Seg tabs={[['reorder', t('À commander')], ['forecast', t('Prévision de la demande')]]} value={tab} onChange={setTab} />
      {tab === 'reorder' ? (
        <Loaded state={ro}>{(j) => (
          <>
            <Kpis list={[{ label: t('à commander'), value: String(j.suggestions.length) }, { label: t('urgents'), value: String(j.critical), bad: j.critical > 0 }, { label: t('montant estimé'), value: money(j.estimate) }]} />
            <p className="muted small">{t("Point de commande = demande pendant le délai du fournisseur + stock de sécurité (niveau de service {n} %). On compare à ce qui est disponible à promettre, plus ce qui est déjà commandé.", { n: j.serviceLevel })}</p>
            <div className="ws-card">
              {!j.suggestions.length ? <Empty text={t('Rien à commander pour le moment.')} /> : null}
              {j.suggestions.map((x) => (
                <div className="line" key={x.itemId}>
                  <span><b>{x.name}</b> {URG[x.urgency][0] ? <Tag tone={URG[x.urgency][1]}>{t(URG[x.urgency][0])}</Tag> : null}
                    <small>{' ' + t('disponible {a}, déjà commandé {b}', { a: qty(x.available), b: qty(x.onOrder) }) + ' · ' + t('point de commande {p}', { p: qty(x.reorderPoint) }) + ' · ' + t('délai {d} j', { d: x.leadDays }) + (x.coverDays !== null ? ' · ' + t('autonomie {d} j', { d: qty(x.coverDays) }) : '') + ' ' + TREND[x.trend]}</small></span>
                  <span className="row"><b>{t('commander {n} {unit}', { n: qty(x.toOrder), unit: x.unit })}</b>{x.estimate !== null ? <small>{money(x.estimate)}</small> : null}
                    <button className="btn small primary" type="button" onClick={() => order(x)}>{t('Créer la commande')}</button>
                    <button className="link" type="button" onClick={() => params(x)}>{t('Réglages')}</button></span>
                </div>
              ))}
            </div>
          </>
        )}
        </Loaded>
      ) : (
        <Loaded state={fc}>{(j) => (
          <>
            <p className="muted small">{t("Moyenne des {n} dernières semaines de sorties. Prévision simple : elle ne voit ni les saisons ni les promotions.", { n: j.weeksWindow })}</p>
            <div className="ws-card">
              {!j.items.length ? <Empty text={t('Pas encore assez de sorties pour prévoir.')} /> : null}
              {j.items.map((x) => (
                <div className="line" key={x.itemId}>
                  <span><b>{x.name}</b> <small>{TREND[x.trend] + ' ' + t('{a} par semaine, {b} sur un mois', { a: qty(x.avgWeekly), b: qty(x.nextMonth) }) + (x.cover !== null ? ' · ' + t('autonomie {d} j', { d: qty(x.cover) }) : '')}</small></span>
                  <span className="row"><Spark series={x.series} label={t('Sorties par semaine : {name}', { name: x.name })} /><button className="link" type="button" onClick={() => params(x)}>{t('Réglages')}</button></span>
                </div>
              ))}
            </div>
          </>
        )}
        </Loaded>
      )}
    </>
  );
}
