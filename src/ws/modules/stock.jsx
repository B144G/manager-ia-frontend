/* Sous-application : Stock et achats (articles, entrées/sorties, fournisseurs et prix, commandes à valider, propositions de l'IA). */
import { useWs } from '../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import Pill from '../parts/stock/Pill.jsx';
import Reorder from '../parts/stock/Reorder.jsx';
import Suppliers from '../parts/stock/Suppliers.jsx';
import { History, ItemForm, MoveForm, PricesForm } from '../parts/stock/ItemModals.jsx';
import { ORDER, STATE, qty } from '../parts/stock/common.js';

export default function Stock() {
  const { oapi, can, money, dateFr, modal, confirm, propose, fail, refreshBadges } = useWs();
  const mgr = can('manager');
  const st = useLoad(() => Promise.all([oapi('GET', '/stock'), oapi('GET', '/stock/orders')]), []);
  const load = st.reload;

  const setStatus = (o, status) => { oapi('PUT', '/stock/orders/' + o.id + '/status', { status }).then(() => { if (refreshBadges) refreshBadges(); load(); }).catch(fail); };
  const move = (it, kind) => modal((kind === 'in' ? 'Entrée : ' : 'Sortie : ') + it.name, (close) => <MoveForm item={it} kind={kind} close={close} done={load} />);
  const history = (it) => modal('Historique : ' + it.name, () => <History item={it} />);
  const editItem = (it) => modal(it && it.id ? "Modifier l'article" : 'Nouvel article', (close) => <ItemForm item={it} close={close} done={load} />);
  const suppliers = () => modal('Fournisseurs', () => <Suppliers />);

  const prices = (it) => {
    Promise.all([oapi('GET', '/stock/suppliers'), oapi('GET', '/stock/items/' + it.id + '/prices')]).then((res) => {
      const cur = {};
      res[1].prices.forEach((p) => { cur[p.supplierId] = p; });
      modal('Prix : ' + it.name, (close) => <PricesForm item={it} suppliers={res[0].suppliers} current={cur} close={close} done={load} />);
    }).catch(fail);
  };

  const reorder = () => {
    oapi('GET', '/stock/reorder').then((j) => {
      modal('Commander ce qui manque', (close) => <Reorder suggestions={j.suggestions} close={close} done={load} />);
    }).catch(fail);
  };

  const aiOrders = () => {
    propose('reorder', {}, {
      title: "Commandes proposées par l'IA",
      applyText: 'Créer les commandes à valider',
      done: load,
      render: (p) => {
        const list = p.orders || [];
        return (
          <>
            {!list.length ? <Empty text="L'IA ne voit rien à commander pour le moment." /> : null}
            {list.map((o, i) => (
              <div className="line" key={i}>
                <span><b>{o.item + ' × ' + o.quantity}</b>{o.why ? <small>{' ' + o.why}</small> : null}</span>
                <small>{o.supplier || 'fournisseur à choisir'}</small>
              </div>
            ))}
            {(p.advice || []).map((a, i) => <p className="muted small" key={i}>{'• ' + a}</p>)}
          </>
        );
      },
    });
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>Stock et achats</h1><p className="muted">Vos articles, vos fournisseurs et vos commandes, avec des alertes avant la rupture.</p></div>
        <div className="row">
          {mgr ? <button className="btn signal small" type="button" onClick={aiOrders}>Commandes avec l'IA</button> : null}
          {mgr ? <button className="btn small" type="button" onClick={reorder}>Commander ce qui manque</button> : null}
          {mgr ? <button className="btn small" type="button" onClick={suppliers}>Fournisseurs</button> : null}
          {mgr ? <button className="btn primary small" type="button" onClick={() => editItem()}>Ajouter un article</button> : null}
        </div>
      </div>
      <div>
        <Loaded state={st}>{([j, o]) => {
          const s = j.summary;
          const orders = o.orders;
          return (
            <>
              <div className="kpis">
                <div className="stat"><b>{String(s.count)}</b><span>articles</span></div>
                <div className={'stat' + (s.low ? ' bad' : '')}><b>{String(s.low)}</b><span>sous le seuil</span></div>
                <div className={'stat' + (s.out ? ' bad' : '')}><b>{String(s.out)}</b><span>en rupture</span></div>
                {s.value !== undefined
                  ? <div className="stat"><b>{money(s.value)}</b><span>valeur du stock</span></div>
                  : <div className="stat"><b>{String(j.pendingOrders)}</b><span>commande(s) à valider</span></div>}
              </div>

              <div className="ws-card">
                <h2>Articles</h2>
                {!j.items.length ? <Empty text={mgr ? "Aucun article. Ajoutez le premier, ou demandez à l'IA comment démarrer." : 'Aucun article pour le moment.'} /> : null}
                {j.items.map((it) => (
                  <div className="line" key={it.id}>
                    <span>
                      <b>{it.name}</b>{' '}<Pill t={STATE[it.state]} />
                      <small>{' ' + qty(it.quantity) + ' ' + it.unit + (it.minQuantity ? ' · seuil ' + qty(it.minQuantity) : '') + (mgr && it.best ? ' · meilleur prix ' + money(it.best.unitPrice) + ' (' + it.best.supplier + ')' : '')}</small>
                    </span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => move(it, 'in')}>Entrée</button>
                      <button className="link" type="button" onClick={() => move(it, 'out')}>Sortie</button>
                      <button className="link" type="button" onClick={() => history(it)}>Historique</button>
                      {mgr ? <button className="link" type="button" onClick={() => prices(it)}>Prix</button> : null}
                      {mgr ? <button className="link" type="button" onClick={() => editItem(it)}>Modifier</button> : null}
                      {mgr ? <button className="link" type="button" onClick={() => confirm('Supprimer « ' + it.name + ' » ?', () => { oapi('DELETE', '/stock/items/' + it.id).then(load).catch(fail); })}>Supprimer</button> : null}
                    </span>
                  </div>
                ))}
              </div>

              <div className="ws-card">
                <h2>Commandes</h2>
                {!orders.length ? <Empty text="Aucune commande." /> : null}
                {orders.map((od) => (
                  <div className="line" key={od.id}>
                    <span>
                      <b>{od.item + ' × ' + qty(od.quantity)}</b>{' '}<Pill t={ORDER[od.status]} />
                      <small>{' ' + (od.supplier || 'fournisseur à choisir') + (od.unitPrice ? ' · ' + money(od.total) : '') + ' · ' + dateFr(od.at)}</small>
                    </span>
                    {mgr ? (
                      <span className="row">
                        {od.status === 'pending' ? <button className="link" type="button" onClick={() => setStatus(od, 'ordered')}>Valider</button> : null}
                        {od.status === 'ordered' ? <button className="link" type="button" onClick={() => setStatus(od, 'received')}>Marquer reçue</button> : null}
                        {od.status === 'pending' || od.status === 'ordered' ? <button className="link" type="button" onClick={() => confirm('Annuler cette commande ?', () => setStatus(od, 'cancelled'))}>Annuler</button> : null}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="muted small">Une commande est d'abord « à valider » : l'IA et l'équipe proposent, un responsable décide. À la réception, le stock augmente et la dépense est inscrite au budget.</p>
            </>
          );
        }}
        </Loaded>
      </div>
    </>
  );
}
