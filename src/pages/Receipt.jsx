import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { rq } from '../lib/api.js';
import { getLocale, useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';

/* Reçu de paiement d'abonnement, imprimable (le navigateur produit le PDF). Document de travail : il ne tient pas lieu de facture fiscale. */
const CSS = `
.ip{font:14px/1.45 Arial,Helvetica,sans-serif;color:#111;background:#fff;max-width:640px;margin:0 auto;padding:24px 16px}
.ip h1{font-size:22px;margin:0 0 4px}.ip table{width:100%;border-collapse:collapse;margin:16px 0}.ip td{border-bottom:1px solid #ddd;padding:8px 4px}.ip td:last-child{text-align:right}
.ip .btn{font:inherit;padding:10px 16px;border:1px solid #111;background:#111;color:#fff;border-radius:6px;cursor:pointer;margin-bottom:16px}.ip .small{font-size:12px;color:#555}
@media print{.ip .btn{display:none}.ip{padding:0}}
`;

export default function Receipt() {
  const t = useT();
  const { reference } = useParams();
  const [st, setSt] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    let off = false;
    rq('GET', '/api/payments/' + encodeURIComponent(reference) + '/receipt').then((j) => { if (!off) setSt({ loading: false, data: j.receipt, error: '' }); }, (e) => { if (!off) setSt({ loading: false, data: null, error: e.status === 401 ? 'login' : e.message }); });
    return () => { off = true; };
  }, [reference]);
  if (st.loading) return <div className="ip"><style>{CSS}</style><p>{t('Chargement…')}</p></div>;
  if (st.error) return <div className="ip"><style>{CSS}</style><p>{st.error === 'login' ? t('Connectez-vous pour imprimer ce document.') : tsrv(st.error)}</p><p><Link to="/connexion">{t('Se connecter')}</Link></p></div>;
  const r = st.data;
  return (
    <div className="ip">
      <style>{CSS}</style>
      <button className="btn" type="button" onClick={() => window.print()}>{t('Imprimer / enregistrer en PDF')}</button>
      <h1>{t('Reçu de paiement {number}', { number: r.number })}</h1>
      <p>{r.issuer}</p>
      <table><tbody>
        <tr><td>{t('Client')}</td><td>{r.customer.name + ' (' + r.customer.contact + ')'}</td></tr>
        <tr><td>{t('Offre')}</td><td>{t('{plan} ({days} jours)', { plan: r.plan, days: r.durationDays })}</td></tr>
        <tr><td>{t('Référence')}</td><td>{r.reference}</td></tr>
        <tr><td>{t('Date de paiement')}</td><td>{new Date(r.paidAt).toLocaleDateString(getLocale())}</td></tr>
        <tr><td>{t('Montant')}</td><td><b>{r.amountXAF.toLocaleString(getLocale()).replace(/[  ]/g, ' ') + ' FCFA'}</b></td></tr>
      </tbody></table>
      <p className="small">{t("Reçu de paiement d'abonnement MANAGER-IA. Document de travail : il ne tient pas lieu de facture fiscale.")}</p>
    </div>
  );
}
