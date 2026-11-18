import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Field, useLoad } from '../../ui.jsx';
import { num, pct, qs, useCp, useForm } from './common.jsx';

/* Création et modification d'un devis : lignes avec aide au prix (liste de prix, palier, marge), remise calculée et plafond du rôle. */

const blank = () => ({ itemId: '', label: '', quantity: '1', price: '', listPrice: 0, hint: null });

export default function QuoteForm({ pre, customerId, oppId, close, onSaved }) {
  const t = useT();
  const { api, me, fail } = useCp();
  const { money, toast } = useWs();
  const accounts = useLoad(() => (pre || customerId ? Promise.resolve(null) : api('GET', '/accounts?limit=500')), []);
  const items = useLoad(() => api('GET', '/pricing/items').catch(() => ({ items: [] })), []);
  const policy = useLoad(() => api('GET', '/pricing/policy').catch(() => null), []);
  const f = useForm({ customerId: customerId ? String(customerId) : pre ? String(pre.customerId) : '', validUntil: pre ? pre.validUntil || '' : '', variant: pre ? pre.variant : '', conditions: pre ? pre.conditions : '', note: '' });
  const [lines, setLines] = useState(() => (pre ? pre.lines.map((l) => ({ itemId: l.itemId ? String(l.itemId) : '', label: l.label, quantity: String(l.quantity), price: String(l.price), listPrice: 0, hint: null })) : [blank()]));
  const catalog = items.data ? items.data.items : [];
  const patch = (i, p) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const pickItem = (i, id) => {
    const it = catalog.find((x) => String(x.id) === id);
    patch(i, it ? { itemId: id, label: it.name, price: String(it.price), listPrice: it.price, hint: null } : { itemId: '', listPrice: 0, hint: null });
  };
  const suggest = (i) => {
    const l = lines[i];
    api('GET', '/pricing/resolve' + qs({ itemId: l.itemId, customerId: f.v.customerId, quantity: num(l.quantity) || 1 })).then((r) => patch(i, { price: String(r.suggested), listPrice: r.list || l.listPrice, hint: r }), fail);
  };
  const sold = lines.reduce((a, l) => a + num(l.quantity) * num(l.price), 0);
  const list = lines.reduce((a, l) => a + num(l.quantity) * Math.max(num(l.listPrice) || num(l.price), num(l.price)), 0);
  const disc = list > 0 ? Math.round((1 - sold / list) * 1000) / 10 : 0;
  const cap = me.boss ? 100 : policy.data ? Number(policy.data.discountCaps[me.role] ?? 0) : null;
  const over = cap !== null && disc > cap;
  const submit = (e) => {
    e.preventDefault();
    f.run(async () => {
      if (!pre && !f.v.customerId) throw new Error(t('Choisissez le client.'));
      const body = { lines: lines.map((l) => ({ ...(l.itemId ? { itemId: Number(l.itemId) } : {}), label: l.label, quantity: num(l.quantity), price: num(l.price) })), validUntil: f.v.validUntil || undefined, conditions: f.v.conditions, variant: f.v.variant };
      if (pre) { await api('PUT', '/quotes/' + pre.id, body); toast(t('Devis enregistré.')); close(); onSaved(pre.id); return; }
      const r = await api('POST', '/quotes', { ...body, customerId: Number(f.v.customerId), oppId: oppId || undefined, note: f.v.note });
      toast(t('Devis créé.')); close(); onSaved(r.id);
    });
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <div className="cp-grid">
        {!pre && !customerId ? <Field label={t('Client')} required>{(p) => <select {...p} value={f.v.customerId} onChange={f.set('customerId')}><option value="">{t('Choisir…')}</option>{accounts.data ? accounts.data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>) : null}</select>}</Field> : null}
        <Field label={t("Valable jusqu'au")} hint={t('Vide : durée de validité par défaut.')}>{(p) => <input {...p} type="date" value={f.v.validUntil} onChange={f.set('validUntil')} />}</Field>
        <Field label={t('Variante')} hint={t('Ex. « Option économique ».')}>{(p) => <input {...p} type="text" maxLength={40} value={f.v.variant} onChange={f.set('variant')} />}</Field>
      </div>
      <div className="pur-lines">
        {lines.map((l, i) => (
          <div className="cp-qline" key={i}>
            {catalog.length ? <Field label={t('Article du catalogue')}>{(p) => <select {...p} value={l.itemId} onChange={(e) => pickItem(i, e.target.value)}><option value="">{t('Ligne libre')}</option>{catalog.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}</select>}</Field> : null}
            <Field label={t('Désignation')}>{(p) => <input {...p} type="text" maxLength={150} value={l.label} onChange={(e) => patch(i, { label: e.target.value })} />}</Field>
            <Field label={t('Quantité')}>{(p) => <input {...p} type="text" inputMode="decimal" value={l.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} />}</Field>
            <Field label={t('Prix unitaire')}>{(p) => <input {...p} type="text" inputMode="numeric" value={l.price} onChange={(e) => patch(i, { price: e.target.value })} />}</Field>
            <div className="row cp-qend">
              <b>{money(Math.round(num(l.quantity) * num(l.price)))}</b>
              {l.itemId && f.v.customerId ? <Button size="sm" onClick={() => suggest(i)}>{t('Prix proposé')}</Button> : null}
              {lines.length > 1 ? <Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, k) => k !== i))}>{t('Retirer')}</Button> : null}
            </div>
            {l.hint ? <p className="small muted cp-qhint">{t('Prix de liste {l}, plancher {f}', { l: money(l.hint.list), f: l.hint.floor ? money(l.hint.floor) : '—' })}{l.hint.cost !== null ? ' · ' + t('coût {c}', { c: money(l.hint.cost) }) : ''}{l.hint.marginPct !== null ? ' · ' + t('marge {m}', { m: pct(l.hint.marginPct) }) : ''}</p> : null}
          </div>
        ))}
        <div className="row"><Button size="sm" icon="plus" onClick={() => setLines([...lines, blank()])}>{t('Ajouter une ligne')}</Button></div>
      </div>
      <div className="row"><b>{t('Total : {amount}', { amount: money(Math.round(sold)) })}</b><Badge tone={over ? 'warn' : 'neutral'}>{t('Remise : {p}', { p: pct(disc) })}</Badge>{cap !== null ? <span className="small muted">{t('Plafond de votre rôle : {p}', { p: pct(cap) })}</span> : null}</div>
      {over ? <Alert tone="warn">{t('Cette remise dépasse le plafond de votre rôle : le devis ne pourra partir qu’après validation du responsable commercial.')}</Alert> : null}
      <Field label={t('Conditions')}>{(p) => <textarea {...p} rows={3} maxLength={1500} value={f.v.conditions} onChange={f.set('conditions')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}
