import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';

/** Prix négociés et remise de fidélité d'un client, opposition aux relances (fiche client, responsables). */
export function ClientPrices({ cu }) {
  const t = useT();
  const { oapi, money, dateFr, toast, fail, can } = useWs();
  const st = useLoad(async () => ({ p: await oapi('GET', '/crm/customers/' + cu.id + '/prices'), items: (await oapi('GET', '/sales/catalog')).items }), []);
  const [disc, setDisc] = useState(null);
  const [form, setForm] = useState({ itemId: '', price: '', validUntil: '', note: '', reason: '' });
  const [err, setErr] = useState('');
  return (
    <Loaded state={st}>{({ p, items }) => {
      const set = (k, x) => setForm((o) => ({ ...o, [k]: x }));
      const saveDisc = () => oapi('PUT', '/crm/customers/' + cu.id + '/discount', { discount: disc === null ? p.defaultDiscount : disc }).then(() => { toast(t('Remise enregistrée.')); st.reload(); }).catch(fail);
      const savePrice = (ev) => {
        ev.preventDefault(); setErr('');
        oapi('PUT', '/crm/customers/' + cu.id + '/prices/' + form.itemId, { price: form.price, validUntil: form.validUntil || null, note: form.note, reason: form.reason }).then(() => { toast(t('Prix enregistré.')); setForm({ itemId: '', price: '', validUntil: '', note: '', reason: '' }); st.reload(); }).catch((e) => setErr(t(e.message)));
      };
      return (
        <div style={{ margin: '12px 0' }}>
          <h3>{t('Prix négociés et remise')}</h3>
          <div className="row" style={{ marginBottom: 8 }}>
            <label className="fld" htmlFor="cp_d"><span>{t('Remise de fidélité (%)')}</span><input id="cp_d" type="text" inputMode="decimal" value={disc === null ? String(p.defaultDiscount) : disc} onChange={(e) => setDisc(e.target.value)} /></label>
            <button className="btn small" type="button" onClick={saveDisc}>{t('Enregistrer')}</button>
          </div>
          {!p.prices.length ? <Empty text={t('Aucun prix négocié pour ce client.')} /> : null}
          {p.prices.map((x) => (
            <div className="line" key={x.itemId}>
              <span><b>{x.item}</b><small>{' ' + money(x.price) + ' (' + t('liste : {price}', { price: money(x.list) }) + ')' + (x.validUntil ? ' · ' + t("valable jusqu'au {date}", { date: dateFr(x.validUntil) }) : '') + (x.expired ? ' · ' + t('expiré') : '') + (x.note ? ' · ' + x.note : '')}</small></span>
              <button className="link" type="button" onClick={() => oapi('DELETE', '/crm/customers/' + cu.id + '/prices/' + x.itemId).then(st.reload).catch(fail)}>{t('Retirer')}</button>
            </div>
          ))}
          <form className="ws-form" onSubmit={savePrice}>
            <label className="fld" htmlFor="cp_i"><span>{t('Article')}</span><select id="cp_i" value={form.itemId} onChange={(e) => set('itemId', e.target.value)}><option value="">{t('Choisir…')}</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name + ' (' + money(i.price) + ')'}</option>)}</select></label>
            <label className="fld" htmlFor="cp_p"><span>{t('Prix négocié pour ce client')}</span><input id="cp_p" type="text" inputMode="numeric" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
            <label className="fld" htmlFor="cp_v"><span>{t("Valable jusqu'au (facultatif)")}</span><input id="cp_v" type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} /></label>
            <label className="fld" htmlFor="cp_n"><span>{t('Note (facultatif)')}</span><input id="cp_n" type="text" value={form.note} onChange={(e) => set('note', e.target.value)} /></label>
            {can('admin') ? <label className="fld" htmlFor="cp_r"><span>{t('Motif (obligatoire si le prix est sous le plancher)')}</span><input id="cp_r" type="text" value={form.reason} onChange={(e) => set('reason', e.target.value)} /></label> : null}
            <p className="ws-err" role="alert">{err}</p>
            <div className="row"><button className="btn primary small" type="submit" disabled={!form.itemId || !form.price}>{t('Enregistrer le prix')}</button></div>
          </form>
          <label className="row" htmlFor="cp_o" style={{ gap: 8, marginTop: 10 }}><input id="cp_o" type="checkbox" checked={p.followupOptout} onChange={(e) => oapi('PUT', '/crm/customers/' + cu.id + '/followup-optout', { optout: e.target.checked }).then(st.reload).catch(fail)} /><span>{t("Ce client s'oppose aux relances (ne jamais le relancer)")}</span></label>
        </div>
      );
    }}
    </Loaded>
  );
}

/** Aide à la saisie d'un devis ou d'une facture : prix de liste, du client, palier, dernier prix payé, plancher. */
export function PriceHelper({ customers }) {
  const t = useT();
  const { oapi, money, dateFr, copy, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/sales/catalog'), []);
  const [v, setV] = useState({ customerId: '', itemId: '', quantity: '1' });
  const [r, setR] = useState(null);
  const ask = (n) => {
    const x = { ...v, ...n }; setV(x);
    if (!x.itemId) { setR(null); return; }
    oapi('GET', '/crm/price-suggest?itemId=' + x.itemId + (x.customerId ? '&customerId=' + x.customerId : '') + '&quantity=' + encodeURIComponent(x.quantity || 1)).then(setR).catch(fail);
  };
  const items = (st.data && st.data.items) || [];
  return (
    <details style={{ marginBottom: 10 }}>
      <summary>{t('Suggestion de prix (catalogue)')}</summary>
      <div className="row" style={{ margin: '8px 0' }}>
        <select aria-label={t('Client')} value={v.customerId} onChange={(e) => ask({ customerId: e.target.value })}><option value="">{t('Client…')}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select aria-label={t('Article')} value={v.itemId} onChange={(e) => ask({ itemId: e.target.value })}><option value="">{t('Article…')}</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
        <input type="number" min="1" aria-label={t('Quantité')} style={{ width: 80 }} value={v.quantity} onChange={(e) => ask({ quantity: e.target.value })} />
      </div>
      {r && r.found ? (
        <div>
          <p><b>{t('Prix conseillé : {price}', { price: money(r.reference) })}</b>{' (' + t(r.reason) + ')'}</p>
          <p className="muted small">{t('Liste : {list}', { list: money(r.list) }) + (r.lastPaid ? ' · ' + t('dernier prix payé : {price} ({number}, {date})', { price: money(r.lastPaid.price), number: r.lastPaid.number, date: dateFr(r.lastPaid.date) }) : '') + (r.customerPrice ? ' · ' + t('prix client : {price}', { price: money(r.customerPrice.price) }) : '') + (r.tierPrice ? ' · ' + t('palier : {price}', { price: money(r.tierPrice) }) : '') + ' · ' + (r.floor ? t('plancher : {price}', { price: money(r.floor) }) : t('prix ferme (non négociable)'))}</p>
          <button className="btn small" type="button" onClick={() => copy(r.name + ' ; ' + r.quantity + ' ; ' + r.reference, t('Ligne copiée : collez-la dans les lignes.'))}>{t('Copier la ligne')}</button>
        </div>
      ) : null}
    </details>
  );
}
