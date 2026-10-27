import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getLocale, useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';

/* Tableau de bord imprimable (le navigateur produit le PDF via « Imprimer »). Estimation de gestion : à faire valider par l'expert-comptable. */
const CSS = `
.ip{font:14px/1.45 Arial,Helvetica,sans-serif;color:#111;background:#fff;max-width:800px;margin:0 auto;padding:24px 16px}
.ip h1{font-size:22px;margin:0 0 4px}.ip table{width:100%;border-collapse:collapse;margin:12px 0}.ip th,.ip td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}.ip .r{text-align:right}
.ip .btn{font:inherit;padding:10px 16px;border:1px solid #111;background:#111;color:#fff;border-radius:6px;cursor:pointer;margin-bottom:16px}.ip .small{font-size:12px;color:#555}
@media print{.ip .btn{display:none}.ip{padding:0}}
`;

export default function KpiPrint() {
  const t = useT();
  const { orgId } = useParams();
  const [st, setSt] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    let off = false;
    api('GET', `/orgs/${orgId}/dashboard/kpis`).then((data) => { if (!off) setSt({ loading: false, data, error: '' }); }, (e) => { if (!off) setSt({ loading: false, data: null, error: e.status === 401 ? 'login' : e.message }); });
    return () => { off = true; };
  }, [orgId]);
  const fmt = (n) => Number(n || 0).toLocaleString(getLocale()).replace(/[  ]/g, ' ');
  if (st.loading) return <div className="ip"><style>{CSS}</style><p>{t('Chargement…')}</p></div>;
  if (st.error) return <div className="ip"><style>{CSS}</style><p>{st.error === 'login' ? t('Connectez-vous pour imprimer ce document.') : tsrv(st.error)}</p><p><Link to="/connexion">{t('Se connecter')}</Link></p></div>;
  const j = st.data; const c = j.currency;
  const rows = [[t("Chiffre d'affaires HT"), j.revenue], [t("Chiffre d'affaires HT depuis janvier"), j.revenueYtd], [t('Sorties du budget'), j.expenses], [t('Marge estimée'), j.margin], [t('Créances clients'), j.receivables.total],
    [t('Non échues'), j.receivables.aging.notDue], [t('1 à 30 jours'), j.receivables.aging.d1_30], [t('31 à 60 jours'), j.receivables.aging.d31_60], [t('61 à 90 jours'), j.receivables.aging.d61_90], [t('Plus de 90 jours'), j.receivables.aging.d90], [t('Trésorerie (solde du budget)'), j.cash.balance]];
  return (
    <div className="ip">
      <style>{CSS}</style>
      <button className="btn" type="button" onClick={() => window.print()}>{t('Imprimer / enregistrer en PDF')}</button>
      <h1>{t('Tableau de bord · {month}', { month: j.month })}</h1>
      <table><tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="r">{fmt(r[1]) + ' ' + c}</td></tr>)}</tbody></table>
      <h2>{t("Chiffre d'affaires sur 6 mois")}</h2>
      <table><tbody>{j.series.map((s) => <tr key={s.month}><td>{s.month}</td><td className="r">{fmt(s.revenue) + ' ' + c}</td></tr>)}</tbody></table>
      <p className="small">{t("Estimation de gestion : chiffre d'affaires HT moins les sorties du budget du mois.")} {t('Document de travail : à faire valider par un expert-comptable.')}</p>
    </div>
  );
}
