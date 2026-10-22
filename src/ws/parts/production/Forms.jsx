/* Formulaires du module Production : nomenclature, ordre, clôture. */
import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { LinesEditor, qty } from './common.jsx';

/** Création / modification d'une nomenclature (recette). */
export function BomForm({ bom, close, done }) {
  const { oapi, info, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/stock'), []);
  const cur = info.org.currency;
  const [lines, setLines] = useState(() => (bom ? bom.lines.map((l) => ({ id: String(l.itemId), q: String(l.quantity) })) : [{ id: '', q: '' }]));
  const [product, setProduct] = useState('');
  const [labor, setLabor] = useState(bom ? String(bom.laborCost || '') : '');
  const [other, setOther] = useState(bom ? String(bom.otherCost || '') : '');
  const [notes, setNotes] = useState(bom ? bom.notes : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = (ev) => {
    ev.preventDefault();
    setErr('');
    if (!bom && !product) { setErr('Choisissez le produit fini.'); return; }
    const ls = lines.filter((l) => l.id || String(l.q).trim()).map((l) => ({ itemId: l.id, quantity: l.q }));
    if (!ls.length || ls.some((l) => !l.itemId || !String(l.quantity).trim())) { setErr('Chaque matière doit avoir un article et une quantité.'); return; }
    setBusy(true);
    const body = { lines: ls, laborCost: labor, otherCost: other, notes };
    if (!bom) body.productId = product;
    oapi(bom ? 'PUT' : 'POST', '/production/boms' + (bom ? '/' + bom.id : ''), body).then(() => { close(); done(); }).catch((e) => { setErr(e.message); if (e.status === 401) fail(e); setBusy(false); });
  };
  return (
    <Loaded state={st}>{(j) => {
      const opts = j.items.map((i) => [String(i.id), i.name + ' (' + i.unit + ')']);
      return (
        <form className="ws-form" noValidate onSubmit={submit}>
          {bom ? <p><b>{bom.product}</b></p> : (
            <label className="fld"><span>Produit fini (article du stock)</span>
              <select value={product} onChange={(e) => setProduct(e.target.value)}>{[['', 'Choisir…']].concat(opts).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
              <small>Le produit doit d'abord exister dans le stock. Une seule recette par produit.</small>
            </label>
          )}
          <p className="muted small">Matières nécessaires pour fabriquer UNE unité du produit :</p>
          <LinesEditor options={opts} value={lines} onChange={setLines} qLabel="Quantité par unité" addText="Ajouter une matière" />
          <label className="fld"><span>{'Main-d\'œuvre estimée par unité (' + cur + ')'}</span><input type="text" inputMode="numeric" value={labor} onChange={(e) => setLabor(e.target.value)} /></label>
          <label className="fld"><span>{'Autres frais par unité (' + cur + ')'}</span><input type="text" inputMode="numeric" value={other} onChange={(e) => setOther(e.target.value)} /><small>Énergie, emballage, transport…</small></label>
          <label className="fld"><span>Notes</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <p className="ws-err" role="alert">{err}</p>
          <div className="row"><button className="btn primary" type="submit" disabled={busy}>Enregistrer</button></div>
        </form>
      );
    }}
    </Loaded>
  );
}

/** Nouvel ordre ou modification d'un brouillon. */
export function OrderForm({ order, boms, close, done }) {
  const { oapi } = useWs();
  const fields = [];
  if (!order) fields.push({ k: 'bomId', label: 'Produit à fabriquer', type: 'select', options: boms.map((b) => [String(b.id), b.product]) });
  fields.push({ k: 'quantity', label: 'Quantité à produire', required: true, value: order ? String(order.quantity) : '', placeholder: '100' });
  fields.push({ k: 'dueDate', label: 'Date prévue', type: 'date', value: order && order.dueDate ? order.dueDate : '' });
  fields.push({ k: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: order ? order.notes : '' });
  return (
    <Form
      fields={fields}
      submitText="Enregistrer"
      onSubmit={(v) => oapi(order ? 'PUT' : 'POST', '/production/orders' + (order ? '/' + order.id : ''), { bomId: v.bomId, quantity: v.quantity, dueDate: v.dueDate || null, notes: v.notes }).then(() => { close(); done(); })}
    />
  );
}

/** Clôture : quantité produite et rebut. */
export function CloseForm({ order, close, done }) {
  const { oapi, toast } = useWs();
  return (
    <>
      <p className="muted small">{'À la clôture, les matières consommées sortent du stock et ' + order.product + ' entre en stock (motif « Production ' + order.code + ' »). Le rebut a aussi consommé des matières.'}</p>
      <Form
        fields={[
          { k: 'producedQty', label: 'Quantité réellement produite' + (order.unit ? ' (' + order.unit + ')' : ''), required: true, value: String(order.quantity) },
          { k: 'scrapQty', label: 'Rebut (pertes)', value: '0', hint: 'Quantité perdue ou jetée pendant la fabrication.' },
          { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: order.notes },
        ]}
        submitText="Clôturer l'ordre"
        onSubmit={(v) => oapi('POST', '/production/orders/' + order.id + '/close', v).then((r) => { toast('Ordre terminé. Coût de revient réel : ' + qty(r.unitCost) + ' par unité.'); close(); done(); })}
      />
    </>
  );
}
