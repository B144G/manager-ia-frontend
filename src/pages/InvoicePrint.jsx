import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useT, getLocale } from '../lib/i18n.jsx';
import { dateFr } from '../lib/format.js';

/* Page d'impression d'une facture, d'un devis ou d'un avoir (sans dépendance : le navigateur produit le PDF via « Imprimer »).
   Document de travail : à faire valider par l'expert-comptable avant tout usage légal ou fiscal. */

const CSS = `
.ip{font:14px/1.45 Arial,Helvetica,sans-serif;color:#111;background:#fff;max-width:800px;margin:0 auto;padding:24px 16px}
.ip h1{font-size:22px;margin:0 0 4px}.ip table{width:100%;border-collapse:collapse;margin:16px 0}.ip th,.ip td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}
.ip .r{text-align:right}.ip .top{display:flex;gap:24px;flex-wrap:wrap;justify-content:space-between}.ip .small{font-size:12px;color:#555}
.ip .tot{width:340px;max-width:100%;margin-left:auto}.ip .tot td{border:0}.ip .wd{margin-top:24px;padding:8px;border:1px dashed #999;font-size:12px;color:#555}
.ip .bar{display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap}.ip .btn{font:inherit;padding:10px 16px;border:1px solid #111;background:#111;color:#fff;border-radius:6px;cursor:pointer}
.ip .warn{background:#fff7e0;border:1px solid #e6c200;padding:8px;font-size:13px;margin-bottom:12px}
@media print{.ip .bar,.ip .warn{display:none}.ip{padding:0}}
`;

const KIND = { invoice: 'Facture', quote: 'Devis', credit: 'Avoir', order: 'Commande' };

export default function InvoicePrint() {
  const t = useT();
  const { orgId, docId } = useParams();
  const [st, setSt] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    let off = false;
    api('GET', `/orgs/${orgId}/crm/documents/${docId}/print`).then((data) => { if (!off) setSt({ loading: false, data, error: '' }); }, (e) => { if (!off) setSt({ loading: false, data: null, error: e.status === 401 ? 'login' : e.message }); });
    return () => { off = true; };
  }, [orgId, docId]);
  useEffect(() => { if (st.data) document.title = `${t(KIND[st.data.document.kind] || 'Facture')} ${st.data.document.number}`; }, [st.data, t]);

  const fmt = (n) => Number(n || 0).toLocaleString(getLocale()).replace(/[  ]/g, ' ');
  if (st.loading) return <div className="ip"><style>{CSS}</style><p>{t('Chargement…')}</p></div>;
  if (st.error) return <div className="ip"><style>{CSS}</style><p>{st.error === 'login' ? t('Connectez-vous pour imprimer ce document.') : t(st.error)}</p><p><Link to="/connexion">{t('Se connecter')}</Link></p></div>;
  const p = st.data; const d = p.document; const tot = p.totals; const cur = p.org.currency;
  const warn = { org_niu: t("NIU de l'entreprise"), org_address: t("adresse de l'entreprise"), customer_niu: t('NIU du client') };
  return (
    <div className="ip">
      <style>{CSS}</style>
      <div className="bar">
        <button className="btn" type="button" onClick={() => window.print()}>{t('Imprimer / enregistrer en PDF')}</button>
        <button className="btn" type="button" style={{ background: '#fff', color: '#111' }} onClick={() => window.close()}>{t('Fermer')}</button>
      </div>
      {p.missing.length ? <p className="warn">{t('Mentions à compléter avant usage officiel : {list}.', { list: p.missing.map((k) => warn[k]).join(', ') })}</p> : null}
      <div className="top">
        <div>
          <h1>{p.org.name}</h1>
          <div className="small">{p.org.address}<br />{p.org.niu ? t('NIU : {niu}', { niu: p.org.niu }) : ''}{p.org.rccm ? ' · ' + t('RCCM : {rccm}', { rccm: p.org.rccm }) : ''}</div>
        </div>
        <div>
          <h1>{t(KIND[d.kind] || 'Facture')} {d.number}</h1>
          <div className="small">{t('Date : {date}', { date: dateFr(d.issued) })}{d.due ? <><br />{t('Échéance : {date}', { date: dateFr(d.due) })}</> : null}{d.creditOf ? <><br />{t('Avoir sur la facture {number}', { number: d.creditOf })}</> : null}</div>
        </div>
      </div>
      <p><b>{p.customer.name}</b><br /><span className="small">{p.customer.address}{p.customer.niu ? <><br />{t('NIU : {niu}', { niu: p.customer.niu })}</> : null}</span></p>
      {d.creditReason ? <p className="small">{t('Motif : {reason}', { reason: d.creditReason })}</p> : null}
      <table>
        <thead><tr><th>{t('Désignation')}</th><th className="r">{t('Qté')}</th><th className="r">{p.pricesIncl ? t('Prix unit. TTC') : t('Prix unit. HT')}</th><th className="r">{p.pricesIncl ? t('Montant TTC') : t('Montant HT')}</th></tr></thead>
        <tbody>{p.lines.map((l, i) => <tr key={i}><td>{l.label}</td><td className="r">{l.quantity}</td><td className="r">{fmt(l.price)}</td><td className="r">{fmt(l.amount)}</td></tr>)}</tbody>
      </table>
      <table className="tot">
        <tbody>
          <tr><td>{t('Total HT')}</td><td className="r">{fmt(tot.ht)} {cur}</td></tr>
          <tr><td>{t('TVA {rate} %', { rate: String(tot.vatRate).replace('.', ',') })}</td><td className="r">{fmt(tot.vat)} {cur}</td></tr>
          <tr><td><b>{t('Total TTC')}</b></td><td className="r"><b>{fmt(tot.total)} {cur}</b></td></tr>
          {tot.paid ? <tr><td>{t('Déjà payé')}</td><td className="r">{fmt(tot.paid)} {cur}</td></tr> : null}
          {tot.credited ? <tr><td>{t('Avoirs')}</td><td className="r">{fmt(tot.credited)} {cur}</td></tr> : null}
          {tot.balance !== undefined ? <tr><td><b>{t('Reste à payer')}</b></td><td className="r"><b>{fmt(tot.balance)} {cur}</b></td></tr> : null}
        </tbody>
      </table>
      {tot.vatRate === 0 ? <p className="small">{t('TVA non applicable ou opération exonérée (à vérifier avec votre conseil).')}</p> : null}
      {p.payments.filter((x) => x.status === 'confirmed').length ? (
        <p className="small"><b>{t('Paiements reçus')}</b><br />{p.payments.filter((x) => x.status === 'confirmed').map((x) => `${dateFr(x.date)} · ${x.methodLabel ? t(x.methodLabel) : ''}${x.reference ? ' · ' + x.reference : ''} · ${fmt(x.amount)} ${cur}`).map((l, i) => <span key={i}>{l}<br /></span>)}</p>
      ) : null}
      {p.org.payInfo ? <p className="small"><b>{t('Règlement')}</b><br />{p.org.payInfo.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p> : null}
      {p.org.footer ? <p className="small">{p.org.footer.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p> : null}
      <div className="wd">{t("Document de travail généré par Brij-IA : à faire valider par votre expert-comptable avant tout usage légal ou fiscal.")}</div>
    </div>
  );
}
