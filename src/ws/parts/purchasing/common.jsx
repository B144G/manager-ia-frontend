import { useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { useLoad } from '../../ui.jsx';
import { tsrv } from '../../../lib/srv.js';

/* Outils communs du module Achats : pastilles d'état, téléchargements (PDF, CSV), éditeur de lignes, champs.
   Rien n'est calculé ici qui engage l'entreprise : montants, droits et règles viennent du serveur. */

export const REQ_STATUS = { draft: ['Brouillon', ''], submitted: ['À approuver', 'mid'], approved: ['Approuvée', 'good'], rejected: ['Refusée', 'bad'], cancelled: ['Annulée', ''], ordered: ['Commandée', 'good'] };
export const ORDER_STATUS = { draft: ['Brouillon', ''], approved: ['Approuvé', 'mid'], sent: ['Envoyé', 'mid'], partial: ['Partiellement reçu', 'mid'], received: ['Reçu', 'good'], closed: ['Clos', ''], cancelled: ['Annulé', 'bad'] };
export const INV_STATUS = { entered: ['Saisie', ''], matched: ['Rapprochée', 'good'], blocked: ['Bloquée', 'bad'], approved: ['Validée pour paiement', 'good'], cancelled: ['Annulée', ''] };
export const RFQ_STATUS = { open: ['En cours', 'mid'], awarded: ['Attribué', 'good'], cancelled: ['Annulé', ''] };

export function Pill({ map, k }) {
  const t = useT();
  const [label, tone] = map[k] || [k, ''];
  return <span className={'pill ' + tone}>{t(label)}</span>;
}
export function Failed({ e }) { const t = useT(); return <p className="ws-err" role="alert">{t(e.message)}</p>; }

/** Téléchargement d'un fichier du module (PDF, CSV) avec le cookie de connexion. */
export function useDownload() {
  const t = useT();
  const { orgId, fail } = useWs();
  return (path, name) => fetch(API_BASE + '/api/ws/orgs/' + orgId + '/purchasing' + path, { credentials: 'include' })
    .then((r) => { if (!r.ok) throw new Error(t('Téléchargement impossible.')); return r.blob(); })
    .then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }).catch(fail);
}

/** Articles du stock (pour choisir une ligne). Un membre y a accès en lecture. */
export function useItems() {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/stock').then((j) => j.items || []), []);
  return st.data || [];
}
export function useSuppliers() {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/purchasing/suppliers'), []);
  return st;
}

export const num = (v) => { const n = Number(String(v === undefined || v === null ? '' : v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
export const blankLine = () => ({ itemId: '', description: '', unit: '', quantity: '1', price: '' });

/** Prépare les lignes saisies pour le serveur. priceKey : estPrice, refPrice ou unitPrice. */
export function linesPayload(lines, priceKey) {
  return lines.map((l) => ({ itemId: l.itemId ? Number(l.itemId) : undefined, description: l.description, unit: l.unit, quantity: num(l.quantity), [priceKey]: l.price === '' ? undefined : num(l.price) }));
}
export function linesTotal(lines) { return lines.reduce((s, l) => s + Math.round(num(l.quantity) * num(l.price)), 0); }

/** Éditeur de lignes : article du stock ou désignation libre, unité, quantité, prix. Pensé pour le téléphone (chaque ligne est une carte). */
export function LinesEditor({ lines, setLines, items, priceLabel, priceRequired, noItem }) {
  const t = useT();
  const { money } = useWs();
  const set = (i, patch) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const pick = (i, id) => {
    const it = items.find((x) => String(x.id) === String(id));
    set(i, it ? { itemId: String(it.id), description: it.name, unit: it.unit || '', price: lines[i].price === '' && it.unit_cost ? String(it.unit_cost) : lines[i].price } : { itemId: '' });
  };
  return (
    <div className="pur-lines">
      {lines.map((l, i) => (
        <div className="pur-line" key={i}>
          {noItem ? null : <label className="fld pur-wide"><span>{t('Article du stock')}</span>
            <select value={l.itemId} onChange={(e) => pick(i, e.target.value)}>
              <option value="">{t('Désignation libre')}</option>
              {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
            </select></label>}
          <label className="fld pur-wide"><span>{t('Désignation')}</span><input type="text" value={l.description} maxLength={200} onChange={(e) => set(i, { description: e.target.value })} /></label>
          <label className="fld"><span>{t('Unité')}</span><input type="text" value={l.unit} maxLength={20} placeholder={t('pièce')} onChange={(e) => set(i, { unit: e.target.value })} /></label>
          <label className="fld"><span>{t('Quantité')}</span><input type="text" inputMode="decimal" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} /></label>
          <label className="fld"><span>{priceLabel}{priceRequired ? ' *' : ''}</span><input type="text" inputMode="numeric" value={l.price} onChange={(e) => set(i, { price: e.target.value })} /></label>
          <div className="pur-line-end">
            <b>{money(Math.round(num(l.quantity) * num(l.price)))}</b>
            {lines.length > 1 ? <button type="button" className="btn small" onClick={() => setLines(lines.filter((_, k) => k !== i))}>{t('Retirer')}</button> : null}
          </div>
        </div>
      ))}
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn small" onClick={() => setLines([...lines, blankLine()])}>{t('Ajouter une ligne')}</button>
        <b>{t('Total : {amount}', { amount: money(linesTotal(lines)) })}</b>
      </div>
    </div>
  );
}

/** Champ simple (libellé + saisie) pour les formulaires personnalisés. */
export function Field({ label, hint, wide, children }) {
  return <label className={'fld' + (wide ? ' pur-wide' : '')}><span>{tsrv(label)}</span>{children}{hint ? <small>{tsrv(hint)}</small> : null}</label>;
}

/** Petit hook de formulaire : valeurs, erreur, occupation. */
export function useFormState(initial) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e && e.target ? e.target.value : e }));
  const run = async (fn) => {
    setErr(''); setBusy(true);
    try { await fn(); } catch (e) { setErr(tsrv(e.message || 'Erreur')); }
    setBusy(false);
  };
  return { v, setV, set, err, setErr, busy, run };
}

/** Fenêtre qui demande un motif (refus, annulation) puis appelle onSubmit(motif). */
export function reasonModal(modal, t, { title, label, submit, required = true, onSubmit }) {
  modal(title, (close) => <ReasonForm t={t} label={label} submit={submit} required={required} onSubmit={(r) => onSubmit(r).then(() => close())} />);
}
function ReasonForm({ t, label, submit, required, onSubmit }) {
  const f = useFormState({ reason: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); if (required && !f.v.reason.trim()) { f.setErr(t('Indiquez le motif.')); return; } f.run(() => onSubmit(f.v.reason)); }}>
      <Field label={label}><textarea rows={3} value={f.v.reason} onChange={f.set('reason')} /></Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{submit}</button></div>
    </form>
  );
}
