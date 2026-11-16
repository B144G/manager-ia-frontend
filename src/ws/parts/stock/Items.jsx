/* Écran « Articles et commandes » du module Stock et achats (articles, entrées/sorties, fournisseurs et prix, commandes à valider, propositions de l'IA). */
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { OrderProjectForm, PromiseForm, ReceiveForm } from './Receive.jsx';
import Pill from './Pill.jsx';
import Reorder from './Reorder.jsx';
import Suppliers from './Suppliers.jsx';
import { History, ItemForm, Lots, MoveForm, PricesForm } from './ItemModals.jsx';
import { ORDER, STATE, qty } from './common.js';
import { ItemLevels } from '../stockwms/Warehouses.jsx';

export default function Items() {
  const t = useT();
  const { oapi, can, money, dateFr, modal, confirm, propose, fail, refreshBadges, toast } = useWs();
  const mgr = can('manager');
  const st = useLoad(() => Promise.all([oapi('GET', '/stock'), oapi('GET', '/stock/orders')]), []);
  const load = st.reload;

  const setStatus = (o, status) => { oapi('PUT', '/stock/orders/' + o.id + '/status', { status }).then(() => { if (refreshBadges) refreshBadges(); load(); }).catch(fail); };
  const move = (it, kind) => modal(kind === 'in' ? t('Entrée : {name}', { name: it.name }) : t('Sortie : {name}', { name: it.name }), (close) => <MoveForm item={it} kind={kind} close={close} done={load} />);
  const history = (it) => modal(t('Historique : {name}', { name: it.name }), () => <History item={it} />);
  const editItem = (it) => modal(it && it.id ? t("Modifier l'article") : t('Nouvel article'), (close) => <ItemForm item={it} close={close} done={load} />);
  const lots = (it) => modal(t('Lots et numéros : {name}', { name: it.name }), () => <Lots item={it} />);
  const orderProject = (od) => modal(t('Projet de cette commande'), (close) => <OrderProjectForm order={od} close={close} done={load} />);
  const receiveOrder = (od) => modal(t('Réception : {name}', { name: od.item }), (close) => <ReceiveForm order={od} close={close} done={() => { if (refreshBadges) refreshBadges(); load(); }} />);
  const promise = (od) => modal(t('Date promise : {name}', { name: od.item }), (close) => <PromiseForm order={od} close={close} done={load} />);
  const lookup = () => modal(t('Chercher par code-barres ou SKU'), (close) => (
    <Form submitText={t('Chercher')} fields={[{ k: 'code', label: t('Code-barres ou SKU'), required: true }]}
      onSubmit={(v) => oapi('GET', '/stock/lookup?code=' + encodeURIComponent(v.code.trim())).then((j) => { close(); toast(t('{name} : {n} {unit} en stock', { name: j.item.name, n: qty(j.item.quantity), unit: j.item.unit })); })} />
  ));
  const suppliers = () => modal(t('Fournisseurs'), () => <Suppliers />);

  const prices = (it) => {
    Promise.all([oapi('GET', '/stock/suppliers'), oapi('GET', '/stock/items/' + it.id + '/prices')]).then((res) => {
      const cur = {};
      res[1].prices.forEach((p) => { cur[p.supplierId] = p; });
      modal(t('Prix : {name}', { name: it.name }), (close) => <PricesForm item={it} suppliers={res[0].suppliers} current={cur} close={close} done={load} />);
    }).catch(fail);
  };

  const reorder = () => {
    oapi('GET', '/stock/reorder').then((j) => {
      modal(t('Commander ce qui manque'), (close) => <Reorder suggestions={j.suggestions} close={close} done={load} />);
    }).catch(fail);
  };

  const aiOrders = () => {
    propose('reorder', {}, {
      title: t("Commandes proposées par l'IA"),
      applyText: t('Créer les commandes à valider'),
      done: load,
      render: (p) => {
        const list = p.orders || [];
        return (
          <>
            {!list.length ? <Empty text={t("L'IA ne voit rien à commander pour le moment.")} /> : null}
            {list.map((o, i) => (
              <div className="line" key={i}>
                <span><b>{o.item + ' × ' + o.quantity}</b>{o.why ? <small>{' ' + o.why}</small> : null}</span>
                <small>{o.supplier || t('fournisseur à choisir')}</small>
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
      <div className="row wms-toolbar">
          {mgr ? <button className="btn signal small" type="button" onClick={aiOrders}>{t("Commandes avec l'IA")}</button> : null}
          {mgr ? <button className="btn small" type="button" onClick={reorder}>{t('Commander ce qui manque')}</button> : null}
          <button className="btn small" type="button" onClick={lookup}>{t('Code-barres')}</button>
          {mgr ? <button className="btn small" type="button" onClick={suppliers}>{t('Fournisseurs')}</button> : null}
          {mgr ? <button className="btn primary small" type="button" onClick={() => editItem()}>{t('Ajouter un article')}</button> : null}
      </div>
      <div>
        <Loaded state={st}>{([j, o]) => {
          const s = j.summary;
          const orders = o.orders;
          return (
            <>
              <div className="kpis">
                <div className="stat"><b>{String(s.count)}</b><span>{t('articles')}</span></div>
                <div className={'stat' + (s.low ? ' bad' : '')}><b>{String(s.low)}</b><span>{t('sous le seuil')}</span></div>
                <div className={'stat' + (s.out ? ' bad' : '')}><b>{String(s.out)}</b><span>{t('en rupture')}</span></div>
                {s.over ? <div className="stat"><b>{String(s.over)}</b><span>{t('en surstock')}</span></div> : null}
                {s.expired || s.expiring ? <div className={'stat' + (s.expired ? ' bad' : '')}><b>{String(s.expired + s.expiring)}</b><span>{t('lot(s) périmés ou proches de la péremption')}</span></div> : null}
                {s.value !== undefined
                  ? <div className="stat"><b>{money(s.value)}</b><span>{t('valeur du stock')}</span></div>
                  : <div className="stat"><b>{String(j.pendingOrders)}</b><span>{t('commande(s) à valider')}</span></div>}
              </div>

              <div className="ws-card">
                <h2>{t('Articles')}</h2>
                {!j.items.length ? <Empty text={mgr ? t("Aucun article. Ajoutez le premier, ou demandez à l'IA comment démarrer.") : t('Aucun article pour le moment.')} /> : null}
                {j.items.map((it) => (
                  <div className="line" key={it.id}>
                    <span>
                      <b>{it.name}</b>{' '}<Pill t={STATE[it.state]} />
                      <small>{' ' + qty(it.quantity) + ' ' + it.unit + (it.reserved ? ' · ' + t('dont {n} réservé(s), {m} à promettre', { n: qty(it.reserved), m: qty(it.available) }) : '') + (it.minQuantity ? ' · ' + t('seuil {n}', { n: qty(it.minQuantity) }) : '') + (it.maxQuantity ? ' · ' + t('max {n}', { n: qty(it.maxQuantity) }) : '') + (it.sku ? ' · ' + it.sku : '') + (mgr && it.avgCost ? ' · ' + t('coût moyen {price}', { price: money(it.avgCost) }) : '') + (mgr && it.best ? ' · ' + t('meilleur prix {price} ({supplier})', { price: money(it.best.unitPrice), supplier: it.best.supplier }) : '')}</small>
                    </span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => move(it, 'in')}>{t('Entrée')}</button>
                      <button className="link" type="button" onClick={() => move(it, 'out')}>{t('Sortie')}</button>
                      <button className="link" type="button" onClick={() => history(it)}>{t('Historique')}</button>
                      <button className="link" type="button" onClick={() => modal(t('Emplacements : {name}', { name: it.name }), () => <ItemLevels item={it} />)}>{t('Emplacements')}</button>
                      {it.tracking !== 'none' ? <button className="link" type="button" onClick={() => lots(it)}>{it.tracking === 'lot' ? t('Lots') : t('Numéros de série')}</button> : null}
                      {mgr ? <button className="link" type="button" onClick={() => prices(it)}>{t('Prix')}</button> : null}
                      {mgr ? <button className="link" type="button" onClick={() => editItem(it)}>{t('Modifier')}</button> : null}
                      {mgr ? <button className="link" type="button" onClick={() => confirm(t('Supprimer « {name} » ?', { name: it.name }), () => { oapi('DELETE', '/stock/items/' + it.id).then(load).catch(fail); })}>{t('Supprimer')}</button> : null}
                    </span>
                  </div>
                ))}
              </div>

              <div className="ws-card">
                <h2>{t('Commandes')}</h2>
                {!orders.length ? <Empty text={t("Aucune commande.")} /> : null}
                {orders.map((od) => (
                  <div className="line" key={od.id}>
                    <span>
                      <b>{od.item + ' × ' + qty(od.quantity)}</b>{' '}<Pill t={ORDER[od.status]} />
                      <small>{' ' + (od.supplier || t('fournisseur à choisir')) + (od.unitPrice ? ' · ' + money(od.total) : '') + ' · ' + dateFr(od.at) + (od.promisedDate ? ' · ' + t('promise le {date}', { date: dateFr(od.promisedDate) }) : '') + (od.project ? ' · ' + t('projet : {name}', { name: od.project }) : '') + (od.status === 'partial' ? ' · ' + t('reçu {n} sur {m}', { n: qty(od.receivedQty), m: qty(od.quantity) }) : '')}</small>{od.late ? <span className="pill bad">{t('En retard')}</span> : null}
                    </span>
                    {mgr ? (
                      <span className="row">
                        {od.status === 'pending' ? <button className="link" type="button" onClick={() => setStatus(od, 'ordered')}>{t('Valider')}</button> : null}
                        {od.status === 'ordered' || od.status === 'partial' ? <button className="link" type="button" onClick={() => receiveOrder(od)}>{t('Enregistrer une réception')}</button> : null}
                        {od.status === 'ordered' || od.status === 'partial' ? <button className="link" type="button" onClick={() => promise(od)}>{t('Date promise')}</button> : null}
                        {od.status !== 'cancelled' ? <button className="link" type="button" onClick={() => orderProject(od)}>{t('Projet')}</button> : null}
                        {od.status === 'pending' || od.status === 'ordered' || od.status === 'partial' ? <button className="link" type="button" onClick={() => confirm(t('Annuler cette commande ?'), () => setStatus(od, 'cancelled'))}>{t('Annuler')}</button> : null}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="muted small">{t("Une commande est d'abord « à valider » : l'IA et l'équipe proposent, un responsable décide. À la réception, le stock augmente et la dépense est inscrite au budget.")}</p>
            </>
          );
        }}
        </Loaded>
      </div>
    </>
  );
}
