import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Empty } from '../../ui.jsx';
import { qty } from './common.js';

/** Fenêtre « Commander ce qui manque » : suggestions de réapprovisionnement. */
export default function Reorder({ suggestions, close, done }) {
  const { oapi, money, toast, fail } = useWs();
  const [busy, setBusy] = useState(false);
  if (!suggestions.length) return <Empty text="Rien à commander : aucun article n'est sous son seuil, ou tout est déjà commandé." />;
  const create = () => {
    setBusy(true);
    oapi('POST', '/stock/orders', { orders: suggestions.map((s) => ({ itemId: s.itemId, quantity: s.toOrder, supplierId: s.best ? s.best.supplierId : null })) })
      .then(() => { close(); toast('Commandes créées.'); done(); })
      .catch((e) => { setBusy(false); fail(e); });
  };
  return (
    <>
      <p className="muted small">Quantité conseillée : de quoi revenir à environ le double du seuil. Les commandes créées seront « à valider ».</p>
      {suggestions.map((s) => (
        <div className="line" key={s.itemId}>
          <span><b>{s.name + ' × ' + qty(s.toOrder) + ' ' + s.unit}</b><small>{' (en stock : ' + qty(s.quantity) + ', seuil ' + qty(s.minQuantity) + ')'}</small></span>
          <small>{s.best ? s.best.supplier + ' · ' + money(s.best.unitPrice) : 'aucun prix connu'}</small>
        </div>
      ))}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary" type="button" disabled={busy} onClick={create}>Créer les commandes à valider</button>
        <button className="btn" type="button" onClick={close}>Fermer</button>
      </div>
    </>
  );
}
