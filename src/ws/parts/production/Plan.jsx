/* Planification : que puis-je produire ? besoin en matières pour un plan. */
import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { LinesEditor, qty } from './common.jsx';

export default function Plan({ boms }) {
  const t = useT();
  const { oapi, money, fail } = useWs();
  const cap = useLoad(() => oapi('GET', '/production/plan/capacity'), []);
  const [lines, setLines] = useState([{ id: '', q: '' }]);
  const [res, setRes] = useState(null);
  const calc = () => {
    const ls = lines.filter((l) => l.id && String(l.q).trim()).map((l) => ({ bomId: l.id, quantity: l.q }));
    if (!ls.length) { fail(new Error(t('Choisissez au moins un produit et une quantité.'))); return; }
    oapi('POST', '/production/plan/needs', { lines: ls }).then(setRes).catch(fail);
  };
  return (
    <>
      <div className="ws-card">
        <h2>{t('Que puis-je produire avec mon stock actuel ?')}</h2>
        <Loaded state={cap}>{(j) => (
          <>
            {!j.capacity.length ? <Empty text={t("Créez d'abord une nomenclature (recette) pour voir ce que vous pouvez fabriquer.")} /> : null}
            {j.capacity.map((c) => (
              <div className="line" key={c.bomId}>
                <span><b>{c.product}</b><small>{c.limiting ? ' ' + t('limité par : {name}', { name: c.limiting }) : ''}{c.unitCost !== undefined ? ' · ' + t('coût de revient {amount}', { amount: money(c.unitCost) }) : ''}</small></span>
                <b className={c.maxQuantity > 0 ? 'ok' : ''}>{t("jusqu'à {qty} {unit}", { qty: qty(c.maxQuantity), unit: c.unit || '' })}</b>
              </div>
            ))}
          </>
        )}
        </Loaded>
      </div>
      <div className="ws-card">
        <h2>{t('Besoin en matières pour un plan de production')}</h2>
        {!boms.length ? <Empty text={t('Aucune nomenclature pour le moment.')} /> : (
          <>
            <LinesEditor options={boms.map((b) => [String(b.id), b.product])} value={lines} onChange={setLines} qLabel={t("Quantité à produire")} addText={t("Ajouter un produit")} />
            <p><button className="btn primary small" type="button" onClick={calc}>{t('Calculer le besoin')}</button></p>
          </>
        )}
        {res ? (
          <>
            {res.needs.map((n) => (
              <div className="line" key={n.itemId}>
                <span><b>{n.name}</b><small>{' ' + t('besoin {needed} {unit} · en stock {stock}', { needed: qty(n.needed), unit: n.unit, stock: qty(n.inStock) })}</small></span>
                {n.missing > 0 ? <span className="pill bad">{t('Manque {qty} {unit}', { qty: qty(n.missing), unit: n.unit }) + (n.missingCost !== undefined ? ' (≈ ' + money(n.missingCost) + ')' : '')}</span> : <span className="pill good">{t('Suffisant')}</span>}
              </div>
            ))}
            <p className="muted small">{res.missingCount ? (res.missingCost !== undefined ? t("{n} matière(s) à commander, pour environ {amount} au dernier coût d'achat connu.", { n: res.missingCount, amount: money(res.missingCost) }) : t('{n} matière(s) à commander.', { n: res.missingCount })) : t('Votre stock couvre tout le plan.')}</p>
          </>
        ) : null}
      </div>
    </>
  );
}
