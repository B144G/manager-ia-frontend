import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { rq } from '../lib/api.js';
import { getLocale, useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';

/** Page publique de suivi d'une livraison (lien secret envoyé au client) : état, étapes horodatées, créneau d'arrivée estimé.
    Aucune donnée personnelle n'est affichée (ni adresse, ni téléphone, ni montant). Se rafraîchit toutes les deux minutes. */
export default function Tracking() {
  const t = useT();
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let off = false;
    const load = () => rq('GET', '/api/ws/public/track/' + encodeURIComponent(token)).then((j) => { if (!off) { setInfo(j); setErr(''); } }, (e) => { if (!off) setErr(e.message); });
    load();
    const id = setInterval(load, 120000);
    return () => { off = true; clearInterval(id); };
  }, [token]);
  const when = (iso) => new Date(iso).toLocaleString(getLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const day = (d) => new Date(d + 'T12:00:00').toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  const open = info && ['to_prepare', 'shipped', 'on_route'].includes(info.status);
  return (
    <div className="au-main" style={{ minHeight: '100vh' }}>
      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}><LangSwitch /></div>
      <Logo className="au-logo" style={{ display: 'flex' }} />
      <div className="au-card">
        <h1>{t('Suivi de votre livraison')}</h1>
        {info ? (
          <>
            <p className="au-sub">{t('{org} · référence {ref}', { org: info.organisation, ref: info.reference })}</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: '8px 0' }}>{tsrv(info.statusLabel)}{info.partial ? ' (' + t('partielle') + ')' : ''}</p>
            {open && info.window ? <p>{t('Arrivée estimée {date} entre {a} et {b}.', { date: info.plannedDate ? day(info.plannedDate) : '', a: info.window.from, b: info.window.to })}</p> : null}
            {open && !info.window && info.plannedDate ? <p>{t('Livraison prévue {date}.', { date: day(info.plannedDate) })}</p> : null}
            {open && info.stopsBefore ? <p>{t('{n} livraison(s) avant la vôtre.', { n: info.stopsBefore })}</p> : null}
            {info.deliveredAt ? <p>{t('Livrée le {date}.', { date: when(info.deliveredAt) })}</p> : null}
            <ol style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 10 }} aria-label={t('Étapes')}>
              {info.steps.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', borderLeft: '3px solid ' + (i === info.steps.length - 1 ? '#1f6feb' : '#d5dce6'), paddingLeft: 10 }}>
                  <b style={{ flex: 1 }}>{tsrv(s.label)}</b><small>{when(s.at)}</small>
                </li>
              ))}
            </ol>
          </>
        ) : null}
        {!info && err ? <p className="hm-err" role="alert">{tsrv(err)}</p> : null}
        {!info && !err ? <p>{t('Chargement…')}</p> : null}
      </div>
    </div>
  );
}
