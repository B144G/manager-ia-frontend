/* Planification : que puis-je produire ? besoin en matières pour un plan. */
import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { LinesEditor, qty } from './common.jsx';

export default function Plan({ boms }) {
  const { oapi, money, fail } = useWs();
  const cap = useLoad(() => oapi('GET', '/production/plan/capacity'), []);
  const [lines, setLines] = useState([{ id: '', q: '' }]);
  const [res, setRes] = useState(null);
  const calc = () => {
    const ls = lines.filter((l) => l.id && String(l.q).trim()).map((l) => ({ bomId: l.id, quantity: l.q }));
    if (!ls.length) { fail(new Error('Choisissez au moins un produit et une quantité.')); return; }
    oapi('POST', '/production/plan/needs', { lines: ls }).then(setRes).catch(fail);
  };
  return (
    <>
      <div className="ws-card">
        <h2>Que puis-je produire avec mon stock actuel ?</h2>
        <Loaded state={cap}>{(j) => (
          <>
            {!j.capacity.length ? <Empty text="Créez d'abord une nomenclature (recette) pour voir ce que vous pouvez fabriquer." /> : null}
            {j.capacity.map((c) => (
              <div className="line" key={c.bomId}>
                <span><b>{c.product}</b><small>{c.limiting ? ' limité par : ' + c.limiting : ''}{c.unitCost !== undefined ? ' · coût de revient ' + money(c.unitCost) : ''}</small></span>
                <b className={c.maxQuantity > 0 ? 'ok' : ''}>{'jusqu\'à ' + qty(c.maxQuantity) + ' ' + (c.unit || '')}</b>
              </div>
            ))}
          </>
        )}
        </Loaded>
      </div>
      <div className="ws-card">
        <h2>Besoin en matières pour un plan de production</h2>
        {!boms.length ? <Empty text="Aucune nomenclature pour le moment." /> : (
          <>
            <LinesEditor options={boms.map((b) => [String(b.id), b.product])} value={lines} onChange={setLines} qLabel="Quantité à produire" addText="Ajouter un produit" />
            <p><button className="btn primary small" type="button" onClick={calc}>Calculer le besoin</button></p>
          </>
        )}
        {res ? (
          <>
            {res.needs.map((n) => (
              <div className="line" key={n.itemId}>
                <span><b>{n.name}</b><small>{' besoin ' + qty(n.needed) + ' ' + n.unit + ' · en stock ' + qty(n.inStock)}</small></span>
                {n.missing > 0 ? <span className="pill bad">{'Manque ' + qty(n.missing) + ' ' + n.unit + (n.missingCost !== undefined ? ' (≈ ' + money(n.missingCost) + ')' : '')}</span> : <span className="pill good">Suffisant</span>}
              </div>
            ))}
            <p className="muted small">{res.missingCount ? res.missingCount + ' matière(s) à commander' + (res.missingCost !== undefined ? ', pour environ ' + money(res.missingCost) + ' au dernier coût d\'achat connu.' : '.') : 'Votre stock couvre tout le plan.'}</p>
          </>
        ) : null}
      </div>
    </>
  );
}
