import { useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';
import { useT, getLocale } from '../../../lib/i18n.jsx';
import { useLoad } from '../../ui.jsx';

/* Petits éléments communs aux écrans de l'entrepôt (WMS). Tout texte passe par React (échappé). */
export const WMS = '/stock/wms';
export const qty = (n) => Number(n).toLocaleString(getLocale(), { maximumFractionDigits: 3 });
export const pct = (n) => Number(n).toLocaleString(getLocale(), { maximumFractionDigits: 1 }) + ' %';

/** Rangée d'indicateurs : list = [{ label, value, bad? }] */
export function Kpis({ list }) {
  return <div className="kpis wms-kpis">{list.map((k, i) => <div key={i} className={'stat' + (k.bad ? ' bad' : '')}><b>{k.value}</b><span>{k.label}</span></div>)}</div>;
}
/** Onglets : tabs = [[id, libellé]] */
export function Seg({ tabs, value, onChange }) {
  return <div className="ws-tabs wms-seg" role="tablist">{tabs.map((x) => <button key={x[0]} type="button" role="tab" aria-selected={value === x[0]} className={'tab' + (value === x[0] ? ' on' : '')} onClick={() => onChange(x[0])}>{x[1]}</button>)}</div>;
}
export const TONES = { good: 'good', ok: 'good', mid: 'mid', bad: 'bad' };
export function Tag({ tone, children }) { return <span className={'pill ' + (TONES[tone] || '')}>{children}</span>; }

/** Téléchargement d'un état en CSV (cookie de connexion). */
export function useDownload() {
  const t = useT();
  const { orgId, fail } = useWs();
  return (path, name) => fetch(API_BASE + '/api/ws/orgs/' + orgId + '/stock/wms' + path + (path.includes('?') ? '&' : '?') + 'format=csv', { credentials: 'include' })
    .then((r) => { if (!r.ok) throw new Error(t('Export impossible.')); return r.blob(); })
    .then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url; a.download = name + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }).catch(fail);
}
export function CsvButton({ path, name }) {
  const t = useT();
  const dl = useDownload();
  return <button className="btn small" type="button" onClick={() => dl(path, name)}>{t('Exporter en CSV')}</button>;
}

/** Articles et emplacements pour les listes déroulantes. */
export function useItems() {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/stock'), []);
  return { ...st, items: st.data ? st.data.items : [] };
}
export function useLocations(warehouseId) {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/locations' + (warehouseId ? '?warehouseId=' + warehouseId : '')), [warehouseId]);
  return { ...st, locations: st.data ? st.data.locations : [] };
}
export const itemOptions = (items, first) => (first ? [['', first]] : []).concat(items.map((i) => [String(i.id), i.name + ' (' + qty(i.quantity) + ' ' + i.unit + ')']));
export const locOptions = (locs, first, usableOnly) => (first ? [['', first]] : []).concat(locs.filter((l) => l.active && l.kind !== 'transit' && (!usableOnly || l.usable)).map((l) => [String(l.id), l.code + (l.name && l.name !== l.code ? ' · ' + l.name : '') + ' (' + l.warehouse + ')']));

/** Date courte AAAA-MM-JJ → JJ/MM/AAAA via l'espace de travail. */
export function useDate() { const { dateFr } = useWs(); return (d) => (d ? dateFr(d) : '—'); }

/** Bouton qui exécute une action serveur puis recharge. */
export function useAct(reload) {
  const { fail, toast } = useWs();
  const [busy, setBusy] = useState(false);
  return (p, okMsg) => { if (busy) return Promise.resolve(); setBusy(true); return p.then((j) => { if (okMsg) toast(okMsg); if (reload) reload(); return j; }).catch(fail).finally(() => setBusy(false)); };
}

/** Lignes « article + quantité » (+ champs en plus) d'un formulaire de document. rows = [{ itemId, quantity, ... }] ; extra = [{ k, label, placeholder, narrow }]. */
export function LinesEditor({ items, rows, setRows, extra = [], addText }) {
  const t = useT();
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="wms-lines">
      {rows.map((r, i) => (
        <div className="wms-lrow" key={i}>
          <label className="fld wms-l-item"><span>{t('Article')}</span>
            <select value={r.itemId} onChange={(e) => set(i, 'itemId', e.target.value)}>{itemOptions(items, t('Choisir…')).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
          <label className="fld wms-l-qty"><span>{t('Quantité')}</span><input type="text" inputMode="decimal" value={r.quantity} onChange={(e) => set(i, 'quantity', e.target.value)} /></label>
          {extra.map((x) => <label className="fld wms-l-qty" key={x.k}><span>{x.label}</span><input type="text" inputMode={x.numeric ? 'decimal' : 'text'} placeholder={x.placeholder || ''} value={r[x.k] || ''} onChange={(e) => set(i, x.k, e.target.value)} /></label>)}
          {rows.length > 1 ? <button className="link" type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={t('Retirer cette ligne')}>{t('Retirer')}</button> : null}
        </div>
      ))}
      <button className="btn small" type="button" onClick={() => setRows(rows.concat([{ itemId: '', quantity: '' }]))}>{addText || t('Ajouter une ligne')}</button>
    </div>
  );
}
export function useRows(init) { return useState(init || [{ itemId: '', quantity: '' }]); }
export const cleanRows = (rows, keys = []) => rows.filter((r) => r.itemId && String(r.quantity).trim()).map((r) => ({ itemId: Number(r.itemId), quantity: r.quantity, ...Object.fromEntries(keys.filter((k) => r[k] !== undefined && r[k] !== '').map((k) => [k, r[k]])) }));

/** Pied de formulaire personnalisé : message d'erreur + bouton. */
export function FormFoot({ busy, err, text }) {
  return <div className="wms-foot">{err ? <p className="ws-err" role="alert">{err}</p> : null}<button className="btn primary" type="submit" disabled={busy}>{text}</button></div>;
}
