/* Petits éléments communs du module Production. */
export const qty = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
export const STATUS = { draft: ['Brouillon', ''], launched: ['Lancé', 'mid'], done: ['Terminé', 'good'], cancelled: ['Annulé', 'bad'] };
export function Pill({ t }) {
  return t && t[0] ? <span className={'pill ' + t[1]}>{t[0]}</span> : null;
}

/** Liste de lignes « choisir un élément + une quantité » (matières d'une recette, produits d'un plan). value = [{ id, q }]. */
export function LinesEditor({ options, value, onChange, qLabel = 'Quantité', addText = 'Ajouter une ligne' }) {
  const set = (i, patch) => onChange(value.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {value.map((l, i) => (
        <div className="row" key={i} style={{ alignItems: 'flex-end' }}>
          <label className="fld" style={{ flex: '2 1 160px' }}><span>Élément</span>
            <select value={l.id} onChange={(e) => set(i, { id: e.target.value })}>{[['', 'Choisir…']].concat(options).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
          </label>
          <label className="fld" style={{ flex: '1 1 90px' }}><span>{qLabel}</span>
            <input type="text" inputMode="decimal" autoComplete="off" value={l.q} onChange={(e) => set(i, { q: e.target.value })} />
          </label>
          <button className="link" type="button" onClick={() => onChange(value.filter((_, k) => k !== i))}>Retirer</button>
        </div>
      ))}
      <div><button className="btn small" type="button" onClick={() => onChange(value.concat([{ id: '', q: '' }]))}>{addText}</button></div>
    </div>
  );
}
