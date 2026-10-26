/* Formulaires du module Production : nomenclature, ordre, clôture. */
import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { LinesEditor, qty } from './common.jsx';

/** Création / modification d'une nomenclature (recette). */
export function BomForm({ bom, close, done }) {
  const t = useT();
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
    if (!bom && !product) { setErr(t('Choisissez le produit fini.')); return; }
    const ls = lines.filter((l) => l.id || String(l.q).trim()).map((l) => ({ itemId: l.id, quantity: l.q }));
    if (!ls.length || ls.some((l) => !l.itemId || !String(l.quantity).trim())) { setErr(t('Chaque matière doit avoir un article et une quantité.')); return; }
    setBusy(true);
    const body = { lines: ls, laborCost: labor, otherCost: other, notes };
    if (!bom) body.productId = product;
    oapi(bom ? 'PUT' : 'POST', '/production/boms' + (bom ? '/' + bom.id : ''), body).then(() => { close(); done(); }).catch((e) => { setErr(t(e.message)); if (e.status === 401) fail(e); setBusy(false); });
  };
  return (
    <Loaded state={st}>{(j) => {
      const opts = j.items.map((i) => [String(i.id), i.name + ' (' + i.unit + ')']);
      return (
        <form className="ws-form" noValidate onSubmit={submit}>
          {bom ? <p><b>{bom.product}</b></p> : (
            <label className="fld"><span>{t('Produit fini (article du stock)')}</span>
              <select value={product} onChange={(e) => setProduct(e.target.value)}>{[['', t('Choisir…')]].concat(opts).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
              <small>{t("Le produit doit d'abord exister dans le stock. Une seule recette par produit.")}</small>
            </label>
          )}
          <p className="muted small">{t('Matières nécessaires pour fabriquer UNE unité du produit :')}</p>
          <LinesEditor options={opts} value={lines} onChange={setLines} qLabel={t("Quantité par unité")} addText={t("Ajouter une matière")} />
          <label className="fld"><span>{t("Main-d'œuvre estimée par unité ({cur})", { cur })}</span><input type="text" inputMode="numeric" value={labor} onChange={(e) => setLabor(e.target.value)} /></label>
          <label className="fld"><span>{t('Autres frais par unité ({cur})', { cur })}</span><input type="text" inputMode="numeric" value={other} onChange={(e) => setOther(e.target.value)} /><small>{t('Énergie, emballage, transport…')}</small></label>
          <label className="fld"><span>{t('Notes')}</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <p className="ws-err" role="alert">{err}</p>
          <div className="row"><button className="btn primary" type="submit" disabled={busy}>{t('Enregistrer')}</button></div>
        </form>
      );
    }}
    </Loaded>
  );
}

/** Nouvel ordre ou modification d'un brouillon. */
export function OrderForm({ order, boms, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const fields = [];
  if (!order) fields.push({ k: 'bomId', label: t('Produit à fabriquer'), type: 'select', options: boms.map((b) => [String(b.id), b.product]) });
  fields.push({ k: 'quantity', label: t('Quantité à produire'), required: true, value: order ? String(order.quantity) : '', placeholder: '100' });
  fields.push({ k: 'dueDate', label: t('Date prévue'), type: 'date', value: order && order.dueDate ? order.dueDate : '' });
  fields.push({ k: 'notes', label: t('Notes'), type: 'textarea', rows: 2, value: order ? order.notes : '' });
  return (
    <Form
      fields={fields}
      submitText={t('Enregistrer')}
      onSubmit={(v) => oapi(order ? 'PUT' : 'POST', '/production/orders' + (order ? '/' + order.id : ''), { bomId: v.bomId, quantity: v.quantity, dueDate: v.dueDate || null, notes: v.notes }).then(() => { close(); done(); })}
    />
  );
}

/** Clôture : quantité produite et rebut. */
export function CloseForm({ order, close, done }) {
  const t = useT();
  const { oapi, toast } = useWs();
  return (
    <>
      <p className="muted small">{t('À la clôture, les matières consommées sortent du stock et {product} entre en stock (motif « Production {code} »). Le rebut a aussi consommé des matières.', { product: order.product, code: order.code })}</p>
      <Form
        fields={[
          { k: 'producedQty', label: t('Quantité réellement produite') + (order.unit ? ' (' + order.unit + ')' : ''), required: true, value: String(order.quantity) },
          { k: 'scrapQty', label: t('Rebut (pertes)'), value: '0', hint: t('Quantité perdue ou jetée pendant la fabrication.') },
          { k: 'notes', label: t('Notes'), type: 'textarea', rows: 2, value: order.notes },
        ]}
        submitText={t("Clôturer l'ordre")}
        onSubmit={(v) => oapi('POST', '/production/orders/' + order.id + '/close', v).then((r) => { toast(t('Ordre terminé. Coût de revient réel : {cost} par unité.', { cost: qty(r.unitCost) })); close(); done(); })}
      />
    </>
  );
}
