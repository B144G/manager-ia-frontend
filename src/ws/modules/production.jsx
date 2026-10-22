/* Sous-application : Production (nomenclatures, coût de revient, ordres de fabrication, planification). */
import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import { BomForm, CloseForm, OrderForm } from '../parts/production/Forms.jsx';
import Plan from '../parts/production/Plan.jsx';
import { Pill, STATUS, qty } from '../parts/production/common.jsx';

export default function Production() {
  const { oapi, can, money, dateFr, modal, confirm, fail, toast } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('orders');
  const st = useLoad(() => Promise.all([oapi('GET', '/production'), oapi('GET', '/production/boms')]), []);
  const load = st.reload;
  const act = (path, body, msg) => oapi('POST', '/production/orders/' + path, body || {}).then(() => { if (msg) toast(msg); load(); }).catch(fail);

  const editBom = (b) => modal(b ? 'Modifier la nomenclature' : 'Nouvelle nomenclature', (close) => <BomForm bom={b} close={close} done={load} />, { wide: true });
  const editOrder = (o, boms) => modal(o ? 'Modifier ' + o.code : 'Nouvel ordre de fabrication', (close) => <OrderForm order={o} boms={boms} close={close} done={load} />);
  const closeOrder = (o) => modal('Clôturer ' + o.code, (close) => <CloseForm order={o} close={close} done={load} />);

  /** Lancement : on vérifie d'abord les matières ; s'il en manque, on demande confirmation. */
  const launch = (o) => {
    oapi('GET', '/production/orders/' + o.id + '/check').then((c) => {
      if (c.ok) return act(o.id + '/launch', {}, o.code + ' lancé.');
      const txt = 'Matières manquantes pour ' + o.code + ' : ' + c.shortages.map((s) => s.name + ' (il manque ' + qty(s.missing) + ' ' + s.unit + ')').join(', ') + '. Lancer quand même ?';
      return confirm(txt, () => act(o.id + '/launch', { force: true }, o.code + ' lancé malgré les manques.'), 'Lancer quand même');
    }).catch(fail);
  };
  const check = (o) => {
    oapi('GET', '/production/orders/' + o.id + '/check').then((c) => modal('Matières pour ' + o.code, () => (
      <div>{c.needs.map((n) => (
        <div className="line" key={n.itemId}>
          <span><b>{n.name}</b><small>{' besoin ' + qty(n.needed) + ' ' + n.unit + ' · en stock ' + qty(n.inStock)}</small></span>
          {n.missing > 0 ? <span className="pill bad">{'Manque ' + qty(n.missing)}</span> : <span className="pill good">OK</span>}
        </div>
      ))}
      </div>
    ))).catch(fail);
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>Production</h1><p className="muted">Vos recettes, leur coût de revient et vos ordres de fabrication.</p></div>
        {mgr ? (
          <div className="row">
            <button className="btn small" type="button" onClick={() => editBom()}>Nouvelle nomenclature</button>
            <button className="btn primary small" type="button" onClick={() => (st.data && st.data[1].boms.length ? editOrder(null, st.data[1].boms) : toast('Créez d\'abord une nomenclature (recette).', true))}>Nouvel ordre</button>
          </div>
        ) : null}
      </div>
      <Loaded state={st}>{([j, b]) => {
        const s = j.summary;
        const boms = b.boms;
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{String(s.inProgress)}</b><span>ordre(s) en cours</span></div>
              <div className={'stat' + (s.late ? ' bad' : '')}><b>{String(s.late)}</b><span>en retard</span></div>
              <div className="stat"><b>{s.yieldPct === null ? '-' : s.yieldPct + ' %'}</b><span>rendement du mois ({qty(s.monthScrap)} de rebut)</span></div>
              {s.avgUnitCost !== undefined ? <div className="stat"><b>{money(s.avgUnitCost)}</b><span>coût de revient moyen du mois</span></div> : <div className="stat"><b>{qty(s.monthProduced)}</b><span>produit ce mois-ci</span></div>}
            </div>
            <div className="ws-tabs">
              {[['orders', 'Ordres de fabrication'], ['boms', 'Nomenclatures'], ['plan', 'Planification']].map((t) => (
                <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => setTab(t[0])}>{t[1]}</button>
              ))}
            </div>

            {tab === 'orders' ? (
              <div className="ws-card">
                <h2>Ordres de fabrication</h2>
                {!j.orders.length ? <Empty text={mgr ? 'Aucun ordre. Créez une nomenclature, puis un ordre de fabrication.' : 'Aucun ordre de fabrication pour le moment.'} /> : null}
                {j.orders.map((o) => (
                  <div className="line" key={o.id}>
                    <span>
                      <b>{o.code + ' · ' + o.product + ' × ' + qty(o.quantity)}</b>{' '}<Pill t={STATUS[o.status]} />{o.late ? <span className="pill bad">En retard</span> : null}
                      <small>{(o.dueDate ? ' prévu le ' + dateFr(o.dueDate) : '') + (o.status === 'done' ? ' · produit ' + qty(o.producedQty) + ', rebut ' + qty(o.scrapQty) + (o.unitCost !== undefined ? ' · revient à ' + money(o.unitCost) + ' pièce' : '') : '')}</small>
                    </span>
                    <span className="row">
                      {o.status === 'draft' || o.status === 'launched' ? <button className="link" type="button" onClick={() => check(o)}>Matières</button> : null}
                      {mgr && o.status === 'draft' ? <button className="link" type="button" onClick={() => launch(o)}>Lancer</button> : null}
                      {mgr && o.status === 'launched' ? <button className="link" type="button" onClick={() => closeOrder(o)}>Clôturer</button> : null}
                      {mgr && o.status === 'draft' ? <button className="link" type="button" onClick={() => editOrder(o, boms)}>Modifier</button> : null}
                      {mgr && (o.status === 'draft' || o.status === 'launched') ? <button className="link" type="button" onClick={() => confirm('Annuler ' + o.code + ' ?', () => act(o.id + '/cancel', {}, o.code + ' annulé.'))}>Annuler</button> : null}
                      {mgr && (o.status === 'draft' || o.status === 'cancelled') ? <button className="link" type="button" onClick={() => confirm('Supprimer ' + o.code + ' ?', () => { oapi('DELETE', '/production/orders/' + o.id).then(load).catch(fail); })}>Supprimer</button> : null}
                    </span>
                  </div>
                ))}
                <p className="muted small">Brouillon, puis lancé (les matières sont vérifiées), puis terminé : à la clôture, le stock est mis à jour en une seule opération.</p>
              </div>
            ) : null}

            {tab === 'boms' ? (
              <div className="ws-card">
                <h2>Nomenclatures (recettes)</h2>
                {!boms.length ? <Empty text={mgr ? 'Aucune recette. Ajoutez le produit fini et ses matières pour connaître son coût de revient.' : 'Aucune nomenclature pour le moment.'} /> : null}
                {boms.map((x) => (
                  <div className="line" key={x.id}>
                    <span>
                      <b>{x.product}</b>
                      <small>{' ' + x.lines.map((l) => qty(l.quantity) + ' ' + l.unit + ' de ' + l.name).join(', ')}</small>
                      <small>{' · peut en fabriquer ' + qty(x.maxQuantity) + (x.limiting && x.maxQuantity < 1000000 ? ' (limité par ' + x.limiting + ')' : '')}</small>
                      {x.unitCost !== undefined ? <small>{' · coût de revient estimé ' + money(x.unitCost) + ' (matières ' + money(x.materialCost) + ', main-d\'œuvre ' + money(x.laborCost) + ', autres frais ' + money(x.otherCost) + ')'}</small> : null}
                    </span>
                    {mgr ? (
                      <span className="row">
                        <button className="link" type="button" onClick={() => editBom(x)}>Modifier</button>
                        <button className="link" type="button" onClick={() => confirm('Supprimer la nomenclature de « ' + x.product + ' » ?', () => { oapi('DELETE', '/production/boms/' + x.id).then(load).catch(fail); })}>Supprimer</button>
                      </span>
                    ) : null}
                  </div>
                ))}
                {mgr ? <p className="muted small">Le coût de revient utilise le dernier coût d'achat connu de chaque matière (fiche du stock), plus vos estimations de main-d'œuvre et de frais. C'est une estimation : vérifiez-la avec vos chiffres réels.</p> : null}
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
