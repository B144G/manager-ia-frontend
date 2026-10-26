import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty } from '../../ui.jsx';
import { qty } from './common.js';

/** Fenêtre « Commander ce qui manque » : suggestions de réapprovisionnement. */
export default function Reorder({ suggestions, close, done }) {
  const t = useT();
  const { oapi, money, toast, fail } = useWs();
  const [busy, setBusy] = useState(false);
  if (!suggestions.length) return <Empty text={t("Rien à commander : aucun article n'est sous son seuil, ou tout est déjà commandé.")} />;
  const create = () => {
    setBusy(true);
    oapi('POST', '/stock/orders', { orders: suggestions.map((s) => ({ itemId: s.itemId, quantity: s.toOrder, supplierId: s.best ? s.best.supplierId : null })) })
      .then(() => { close(); toast(t('Commandes créées.')); done(); })
      .catch((e) => { setBusy(false); fail(e); });
  };
  return (
    <>
      <p className="muted small">{t('Quantité conseillée : de quoi revenir à environ le double du seuil. Les commandes créées seront « à valider ».')}</p>
      {suggestions.map((s) => (
        <div className="line" key={s.itemId}>
          <span><b>{s.name + ' × ' + qty(s.toOrder) + ' ' + s.unit}</b><small>{' ' + t('(en stock : {n}, seuil {min})', { n: qty(s.quantity), min: qty(s.minQuantity) })}</small></span>
          <small>{s.best ? s.best.supplier + ' · ' + money(s.best.unitPrice) : t('aucun prix connu')}</small>
        </div>
      ))}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary" type="button" disabled={busy} onClick={create}>{t('Créer les commandes à valider')}</button>
        <button className="btn" type="button" onClick={close}>{t('Fermer')}</button>
      </div>
    </>
  );
}
