import { useRef, useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loading, useLoad } from '../../ui.jsx';
import { Failed, Field, useDownload, useFormState, num } from './common.jsx';

/* Fournisseurs : fiche enrichie, note calculée (délais, qualité, prix + avis), historique, documents. */

const ST_SCORE = (s) => (s === null || s === undefined ? ['Pas encore de note', ''] : s >= 4.5 ? ['Excellent', 'good'] : s >= 3.5 ? ['Bon', 'good'] : s >= 2.5 ? ['Moyen', 'mid'] : ['À surveiller', 'bad']);

function Score({ score }) {
  const t = useT();
  const [label, tone] = ST_SCORE(score);
  return <span className={'pill ' + tone}>{score === null || score === undefined ? t(label) : score + ' / 5 · ' + t(label)}</span>;
}

export default function Suppliers() {
  const t = useT();
  const { oapi, money, modal } = useWs();
  const st = useLoad(() => oapi('GET', '/purchasing/suppliers'), []);
  const j = st.data;
  const open = (id) => modal(t('Fiche fournisseur'), (close) => <SupplierDetail id={id} close={close} onChange={st.reload} />, { wide: true });
  const add = () => modal(t('Nouveau fournisseur'), (close) => <SupplierForm close={close} onSaved={(id) => { st.reload(); open(id); }} />, { wide: true });
  return (
    <div className="ws-card">
      <div className="row"><h2 className="grow">{t('Fournisseurs')}</h2><button className="btn primary small" type="button" onClick={add}>{t('Nouveau fournisseur')}</button></div>
      <p className="muted small">{t("La note sur 5 combine le respect des délais, la qualité des livraisons, le prix et vos avis. Ce sont les mêmes fournisseurs que dans Stock et achats.")}</p>
      {st.loading && !j ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {j && !j.suppliers.length ? <Empty text={t('Aucun fournisseur pour l\'instant.')} /> : null}
      {j ? j.suppliers.map((s) => (
        <div className="line" key={s.id}>
          <span><b>{s.name}</b>{s.blocked ? <span className="pill bad"> {t('Bloqué')}</span> : null}<br /><small>{[s.category, s.city, s.phone].filter(Boolean).join(' · ')}{s.stats.orders ? (s.category || s.city || s.phone ? ' · ' : '') + t('{n} commande(s)', { n: s.stats.orders }) + ' · ' + t('{amount} facturés', { amount: money(s.stats.spent) }) : ''}</small></span>
          <span className="row"><Score score={s.stats.score} /><button className="btn small" type="button" onClick={() => open(s.id)}>{t('Ouvrir')}</button></span>
        </div>
      )) : null}
    </div>
  );
}

function SupplierForm({ pre, close, onSaved }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const f = useFormState({ name: pre ? pre.name : '', contactPerson: pre ? pre.contactPerson : '', email: pre ? pre.email : '', phone: pre ? pre.phone : '', address: pre ? pre.address : '', city: pre ? pre.city : '', taxId: pre ? pre.taxId : '', rccm: pre ? pre.rccm : '', category: pre ? pre.category : '', paymentDays: pre ? String(pre.paymentDays) : '30', bankInfo: pre ? pre.bankInfo : '', notes: pre ? pre.notes : '', status: pre && pre.blocked ? 'blocked' : 'active' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      const body = { ...f.v, paymentDays: num(f.v.paymentDays) };
      const r = pre ? await oapi('PUT', '/purchasing/suppliers/' + pre.id, body).then(() => ({ id: pre.id })) : await oapi('POST', '/purchasing/suppliers', body);
      toast(pre ? t('Fiche enregistrée.') : t('Fournisseur ajouté.')); close(); onSaved(r.id);
    }); }}>
      <div className="pur-grid">
        <Field label={t('Nom')}><input type="text" value={f.v.name} maxLength={100} onChange={f.set('name')} /></Field>
        <Field label={t('Personne à contacter')}><input type="text" value={f.v.contactPerson} maxLength={100} onChange={f.set('contactPerson')} /></Field>
        <Field label={t('E-mail')}><input type="email" value={f.v.email} onChange={f.set('email')} /></Field>
        <Field label={t('Téléphone')}><input type="tel" value={f.v.phone} maxLength={40} onChange={f.set('phone')} /></Field>
        <Field label={t('Adresse')}><input type="text" value={f.v.address} maxLength={200} onChange={f.set('address')} /></Field>
        <Field label={t('Ville')}><input type="text" value={f.v.city} maxLength={80} onChange={f.set('city')} /></Field>
        <Field label={t('NIU')}><input type="text" value={f.v.taxId} maxLength={40} onChange={f.set('taxId')} /></Field>
        <Field label={t('RCCM')}><input type="text" value={f.v.rccm} maxLength={40} onChange={f.set('rccm')} /></Field>
        <Field label={t('Catégorie')} hint={t('Sert au classement des dépenses.')}><input type="text" value={f.v.category} maxLength={60} onChange={f.set('category')} /></Field>
        <Field label={t('Délai de paiement (jours)')}><input type="text" inputMode="numeric" value={f.v.paymentDays} onChange={f.set('paymentDays')} /></Field>
      </div>
      <Field label={t('Coordonnées bancaires')} wide><input type="text" value={f.v.bankInfo} maxLength={300} onChange={f.set('bankInfo')} /></Field>
      <Field label={t('Notes')} wide><input type="text" value={f.v.notes} maxLength={500} onChange={f.set('notes')} /></Field>
      {pre ? <Field label={t('Statut')} hint={t('Un fournisseur bloqué ne peut plus recevoir de commande.')}><select value={f.v.status} onChange={f.set('status')}><option value="active">{t('Actif')}</option><option value="blocked">{t('Bloqué')}</option></select></Field> : null}
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{t('Enregistrer')}</button></div>
    </form>
  );
}

function EvalForm({ id, close, onSaved }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const f = useFormState({ deliveryScore: '4', qualityScore: '4', priceScore: '4', comment: '' });
  const sel = (k, label) => <Field label={label}><select value={f.v[k]} onChange={f.set(k)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select></Field>;
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => { await oapi('POST', '/purchasing/suppliers/' + id + '/evaluations', { deliveryScore: num(f.v.deliveryScore), qualityScore: num(f.v.qualityScore), priceScore: num(f.v.priceScore), comment: f.v.comment }); toast(t('Avis enregistré.')); close(); onSaved(); }); }}>
      {sel('deliveryScore', t('Respect des délais'))}{sel('qualityScore', t('Qualité'))}{sel('priceScore', t('Prix'))}
      <Field label={t('Commentaire')}><textarea rows={3} value={f.v.comment} maxLength={500} onChange={f.set('comment')} /></Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><button className="btn primary" type="submit" disabled={f.busy}>{t("Enregistrer l'avis")}</button></div>
    </form>
  );
}

function SupplierDetail({ id, close, onChange }) {
  const t = useT();
  const { oapi, money, dateFr, can, modal, toast, fail, confirm, orgId } = useWs();
  const dl = useDownload();
  const file = useRef(null);
  const [busy, setBusy] = useState(false);
  const st = useLoad(() => oapi('GET', '/purchasing/suppliers/' + id), [id]);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <Failed e={st.error} />;
  const s = st.data.supplier; const k = s.stats;
  const refresh = () => { st.reload(); onChange(); };
  const upload = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const r = await fetch(API_BASE + '/api/ws/orgs/' + orgId + '/purchasing/suppliers/' + id + '/documents?name=' + encodeURIComponent(f.name.slice(0, 60)), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || t('Envoi impossible.'));
      toast(t('Document ajouté.')); refresh();
    } catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}><h3 className="grow">{s.name}</h3><Score score={k.score} />{s.blocked ? <span className="pill bad">{t('Bloqué')}</span> : null}</div>
      <p className="muted small">{[s.contactPerson, s.email, s.phone, s.address, s.city].filter(Boolean).join(' · ')}</p>
      <p className="muted small">{[s.taxId && 'NIU ' + s.taxId, s.rccm && 'RCCM ' + s.rccm, t('paiement à {n} jours', { n: s.paymentDays }), s.category].filter(Boolean).join(' · ')}</p>
      <div className="pur-kpis">
        <div className="kpi"><small>{t('Livraisons à temps')}</small><b>{k.onTimeRate === null ? '—' : k.onTimeRate + ' %'}</b></div>
        <div className="kpi"><small>{t('Délai moyen')}</small><b>{k.avgLeadDays === null ? '—' : t('{n} j', { n: k.avgLeadDays })}</b></div>
        <div className="kpi"><small>{t('Qualité reçue')}</small><b>{k.qualityRate === null ? '—' : k.qualityRate + ' %'}</b></div>
        <div className="kpi"><small>{t('Prix / meilleur prix connu')}</small><b>{k.priceIndex === null ? '—' : Math.round(k.priceIndex * 100) + ' %'}</b></div>
        <div className="kpi"><small>{t('Facturé')}</small><b>{money(k.spent)}</b></div>
      </div>
      <p className="muted small">{t('Détail de la note : délais {d}, qualité {q}, prix {p} (sur 5). {n} avis saisi(s).', { d: k.scores.delivery === null ? '—' : k.scores.delivery, q: k.scores.quality === null ? '—' : k.scores.quality, p: k.scores.price === null ? '—' : k.scores.price, n: k.evaluations })}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn" type="button" onClick={() => modal(t('Modifier la fiche'), (c) => <SupplierForm pre={s} close={c} onSaved={refresh} />, { wide: true })}>{t('Modifier la fiche')}</button>
        <button className="btn" type="button" onClick={() => modal(t('Donner un avis'), (c) => <EvalForm id={id} close={c} onSaved={refresh} />)}>{t('Donner un avis')}</button>
      </div>
      <h3>{t('Commandes')}</h3>
      {!s.orders.length ? <p className="muted small">{t('Aucune commande.')}</p> : s.orders.map((o) => <div className="line" key={o.id}><span><b>{o.number}</b><small> · {dateFr(o.orderDate)} · {o.status}</small></span><b>{money(o.totalTtc)}</b></div>)}
      <h3>{t('Factures')}</h3>
      {!s.invoices.length ? <p className="muted small">{t('Aucune facture.')}</p> : s.invoices.map((v) => <div className="line" key={v.id}><span><b>{v.number}</b><small> · {v.supplierRef} · {dateFr(v.invoiceDate)}</small></span><b>{money(v.totalTtc)}</b></div>)}
      <h3>{t('Avis')}</h3>
      {!s.evaluations.length ? <p className="muted small">{t('Aucun avis saisi.')}</p> : s.evaluations.map((e) => <div className="line" key={e.id}><span><small>{dateFr(String(e.createdAt).slice(0, 10))} · {e.author}</small><br />{t('Délais {d} · Qualité {q} · Prix {p}', { d: e.deliveryScore, q: e.qualityScore, p: e.priceScore })}{e.comment ? <><br /><small>{e.comment}</small></> : null}</span>{can('admin') ? <button className="btn small" type="button" onClick={() => confirm(t('Supprimer cet avis ?'), () => oapi('DELETE', '/purchasing/evaluations/' + e.id).then(refresh).catch(fail), t('Supprimer'))}>{t('Supprimer')}</button> : null}</div>)}
      <h3>{t('Documents')}</h3>
      <p className="muted small">{t("Contrats, attestations, catalogues : PDF ou image de 2 Mo au plus, conservés chiffrés.")}</p>
      {s.documents.map((d) => <div className="line" key={d.id}><span>{d.name}<small> · {Math.round(d.size / 1024)} Ko</small></span><span className="row"><button className="btn small" type="button" onClick={() => dl('/documents/' + d.id + '/file', d.name)}>{t('Télécharger')}</button><button className="btn small" type="button" onClick={() => confirm(t('Supprimer ce document ?'), () => oapi('DELETE', '/purchasing/documents/' + d.id).then(refresh).catch(fail), t('Supprimer'))}>{t('Supprimer')}</button></span></div>)}
      <input ref={file} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={upload} hidden />
      <div className="row"><button className="btn" type="button" disabled={busy} onClick={() => file.current && file.current.click()}>{t('Ajouter un document')}</button><button className="btn" type="button" onClick={close}>{t('Fermer')}</button></div>
    </div>
  );
}
