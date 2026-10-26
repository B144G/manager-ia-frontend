/* Sous-application : Production (nomenclatures, coût de revient, ordres de fabrication, planification). */
import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import { BomForm, CloseForm, OrderForm } from '../parts/production/Forms.jsx';
import Plan from '../parts/production/Plan.jsx';
import { Pill, STATUS, qty } from '../parts/production/common.jsx';

export default function Production() {
  const t = useT();
  const { oapi, can, money, dateFr, modal, confirm, fail, toast } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('orders');
  const st = useLoad(() => Promise.all([oapi('GET', '/production'), oapi('GET', '/production/boms')]), []);
  const load = st.reload;
  const act = (path, body, msg) => oapi('POST', '/production/orders/' + path, body || {}).then(() => { if (msg) toast(msg); load(); }).catch(fail);

  const editBom = (b) => modal(b ? t('Modifier la nomenclature') : t('Nouvelle nomenclature'), (close) => <BomForm bom={b} close={close} done={load} />, { wide: true });
  const editOrder = (o, boms) => modal(o ? t('Modifier {code}', { code: o.code }) : t('Nouvel ordre de fabrication'), (close) => <OrderForm order={o} boms={boms} close={close} done={load} />);
  const closeOrder = (o) => modal(t('Clôturer {code}', { code: o.code }), (close) => <CloseForm order={o} close={close} done={load} />);

  /** Lancement : on vérifie d'abord les matières ; s'il en manque, on demande confirmation. */
  const launch = (o) => {
    oapi('GET', '/production/orders/' + o.id + '/check').then((c) => {
      if (c.ok) return act(o.id + '/launch', {}, t('{code} lancé.', { code: o.code }));
      const txt = t('Matières manquantes pour {code} : {list}. Lancer quand même ?', { code: o.code, list: c.shortages.map((s) => t('{name} (il manque {qty} {unit})', { name: s.name, qty: qty(s.missing), unit: s.unit })).join(', ') });
      return confirm(txt, () => act(o.id + '/launch', { force: true }, t('{code} lancé malgré les manques.', { code: o.code })), t('Lancer quand même'));
    }).catch(fail);
  };
  const check = (o) => {
    oapi('GET', '/production/orders/' + o.id + '/check').then((c) => modal(t('Matières pour {code}', { code: o.code }), () => (
      <div>{c.needs.map((n) => (
        <div className="line" key={n.itemId}>
          <span><b>{n.name}</b><small>{' ' + t('besoin {needed} {unit} · en stock {stock}', { needed: qty(n.needed), unit: n.unit, stock: qty(n.inStock) })}</small></span>
          {n.missing > 0 ? <span className="pill bad">{t('Manque {qty}', { qty: qty(n.missing) })}</span> : <span className="pill good">{t('OK')}</span>}
        </div>
      ))}
      </div>
    ))).catch(fail);
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Production')}</h1><p className="muted">{t('Vos recettes, leur coût de revient et vos ordres de fabrication.')}</p></div>
        {mgr ? (
          <div className="row">
            <button className="btn small" type="button" onClick={() => editBom()}>{t('Nouvelle nomenclature')}</button>
            <button className="btn primary small" type="button" onClick={() => (st.data && st.data[1].boms.length ? editOrder(null, st.data[1].boms) : toast(t("Créez d'abord une nomenclature (recette)."), true))}>{t('Nouvel ordre')}</button>
          </div>
        ) : null}
      </div>
      <Loaded state={st}>{([j, b]) => {
        const s = j.summary;
        const boms = b.boms;
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{String(s.inProgress)}</b><span>{t('ordre(s) en cours')}</span></div>
              <div className={'stat' + (s.late ? ' bad' : '')}><b>{String(s.late)}</b><span>{t('en retard')}</span></div>
              <div className="stat"><b>{s.yieldPct === null ? '-' : s.yieldPct + ' %'}</b><span>{t('rendement du mois ({qty} de rebut)', { qty: qty(s.monthScrap) })}</span></div>
              {s.avgUnitCost !== undefined ? <div className="stat"><b>{money(s.avgUnitCost)}</b><span>{t('coût de revient moyen du mois')}</span></div> : <div className="stat"><b>{qty(s.monthProduced)}</b><span>{t('produit ce mois-ci')}</span></div>}
            </div>
            <div className="ws-tabs">
              {[['orders', 'Ordres de fabrication'], ['boms', 'Nomenclatures'], ['plan', 'Planification']].map((x) => (
                <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} onClick={() => setTab(x[0])}>{t(x[1])}</button>
              ))}
            </div>

            {tab === 'orders' ? (
              <div className="ws-card">
                <h2>{t('Ordres de fabrication')}</h2>
                {!j.orders.length ? <Empty text={mgr ? t('Aucun ordre. Créez une nomenclature, puis un ordre de fabrication.') : t('Aucun ordre de fabrication pour le moment.')} /> : null}
                {j.orders.map((o) => (
                  <div className="line" key={o.id}>
                    <span>
                      <b>{o.code + ' · ' + o.product + ' × ' + qty(o.quantity)}</b>{' '}<Pill s={STATUS[o.status]} />{o.late ? <span className="pill bad">{t('En retard')}</span> : null}
                      <small>{(o.dueDate ? ' ' + t('prévu le {date}', { date: dateFr(o.dueDate) }) : '') + (o.status === 'done' ? ' · ' + t('produit {produced}, rebut {scrap}', { produced: qty(o.producedQty), scrap: qty(o.scrapQty) }) + (o.unitCost !== undefined ? ' · ' + t('revient à {amount} pièce', { amount: money(o.unitCost) }) : '') : '')}</small>
                    </span>
                    <span className="row">
                      {o.status === 'draft' || o.status === 'launched' ? <button className="link" type="button" onClick={() => check(o)}>{t('Matières')}</button> : null}
                      {mgr && o.status === 'draft' ? <button className="link" type="button" onClick={() => launch(o)}>{t('Lancer')}</button> : null}
                      {mgr && o.status === 'launched' ? <button className="link" type="button" onClick={() => closeOrder(o)}>{t('Clôturer')}</button> : null}
                      {mgr && o.status === 'draft' ? <button className="link" type="button" onClick={() => editOrder(o, boms)}>{t('Modifier')}</button> : null}
                      {mgr && (o.status === 'draft' || o.status === 'launched') ? <button className="link" type="button" onClick={() => confirm(t('Annuler {code} ?', { code: o.code }), () => act(o.id + '/cancel', {}, t('{code} annulé.', { code: o.code })))}>{t('Annuler')}</button> : null}
                      {mgr && (o.status === 'draft' || o.status === 'cancelled') ? <button className="link" type="button" onClick={() => confirm(t('Supprimer {code} ?', { code: o.code }), () => { oapi('DELETE', '/production/orders/' + o.id).then(load).catch(fail); })}>{t('Supprimer')}</button> : null}
                    </span>
                  </div>
                ))}
                <p className="muted small">{t('Brouillon, puis lancé (les matières sont vérifiées), puis terminé : à la clôture, le stock est mis à jour en une seule opération.')}</p>
              </div>
            ) : null}

            {tab === 'boms' ? (
              <div className="ws-card">
                <h2>{t('Nomenclatures (recettes)')}</h2>
                {!boms.length ? <Empty text={mgr ? t('Aucune recette. Ajoutez le produit fini et ses matières pour connaître son coût de revient.') : t('Aucune nomenclature pour le moment.')} /> : null}
                {boms.map((x) => (
                  <div className="line" key={x.id}>
                    <span>
                      <b>{x.product}</b>
                      <small>{' ' + x.lines.map((l) => t('{qty} {unit} de {name}', { qty: qty(l.quantity), unit: l.unit, name: l.name })).join(', ')}</small>
                      <small>{' · ' + t('peut en fabriquer {qty}', { qty: qty(x.maxQuantity) }) + (x.limiting && x.maxQuantity < 1000000 ? ' (' + t('limité par {name}', { name: x.limiting }) + ')' : '')}</small>
                      {x.unitCost !== undefined ? <small>{' · ' + t("coût de revient estimé {unit} (matières {material}, main-d'œuvre {labor}, autres frais {other})", { unit: money(x.unitCost), material: money(x.materialCost), labor: money(x.laborCost), other: money(x.otherCost) })}</small> : null}
                    </span>
                    {mgr ? (
                      <span className="row">
                        <button className="link" type="button" onClick={() => editBom(x)}>{t('Modifier')}</button>
                        <button className="link" type="button" onClick={() => confirm(t('Supprimer la nomenclature de « {name} » ?', { name: x.product }), () => { oapi('DELETE', '/production/boms/' + x.id).then(load).catch(fail); })}>{t('Supprimer')}</button>
                      </span>
                    ) : null}
                  </div>
                ))}
                {mgr ? <p className="muted small">{t("Le coût de revient utilise le dernier coût d'achat connu de chaque matière (fiche du stock), plus vos estimations de main-d'œuvre et de frais. C'est une estimation : vérifiez-la avec vos chiffres réels.")}</p> : null}
              </div>
            ) : null}

            {tab === 'plan' ? <Plan boms={boms} /> : null}
          </>
        );
      }}
      </Loaded>
    </>
  );
}
