import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OrgLogo, { PublicFoot } from '../components/OrgLogo.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { rq } from '../lib/api.js';
import { getLocale, useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';

/** Page publique d'un devis (lien secret envoyé au client) : consultation, acceptation avec nom, ou refus.
    Acceptation simple (nom et horodatage conservés), pas une signature électronique qualifiée. */
export default function QuoteAccept() {
  const t = useT();
  const { token } = useParams();
  const [q, setQ] = useState(null);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const load = () => rq('GET', '/api/ws/public/quote/' + encodeURIComponent(token)).then((j) => { setQ(j); setErr(''); }, (e) => setErr(e.message));
  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const money = (n) => `${Number(n || 0).toLocaleString(getLocale())} ${q ? q.currency : ''}`;
  const day = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const answer = (accept) => {
    setErr('');
    if (accept && name.trim().length < 2) { setErr(t('Indiquez votre nom pour accepter le devis.')); return; }
    setBusy(true);
    rq('POST', '/api/ws/public/quote/' + encodeURIComponent(token) + (accept ? '/accept' : '/refuse'), { name, reason }).then(() => { setDone(accept ? 'accepted' : 'refused'); load(); }, (e) => setErr(e.message)).then(() => setBusy(false));
  };
  const state = done || (q && q.status);
  return (
    <div className="au-main" style={{ minHeight: '100vh' }}>
      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}><LangSwitch /></div>
      <OrgLogo kind="quote" token={token} />
      <div className="au-card" style={{ width: 'min(760px,100%)' }}>
        <h1>{t('Votre devis')}</h1>
        {q ? (
          <>
            <p className="au-sub">{t('{org} · devis {n} pour {client}', { org: q.organisation, n: q.number, client: q.customer })}</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                <thead><tr><th scope="col" style={{ textAlign: 'left' }}>{t('Désignation')}</th><th scope="col" style={{ textAlign: 'right' }}>{t('Quantité')}</th><th scope="col" style={{ textAlign: 'right' }}>{t('Prix unitaire')}</th><th scope="col" style={{ textAlign: 'right' }}>{t('Montant')}</th></tr></thead>
                <tbody>{q.lines.map((l, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #d5dce6' }}><td style={{ padding: '8px 4px' }}>{l.label}</td><td style={{ textAlign: 'right' }}>{l.quantity}</td><td style={{ textAlign: 'right' }}>{money(l.price)}</td><td style={{ textAlign: 'right' }}>{money(Math.round(l.quantity * l.price))}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <p style={{ textAlign: 'right', margin: '12px 0 0' }}>{t('Total hors taxes : {m}', { m: money(q.subtotalHt) })}<br />{t('TVA ({r} %) : {m}', { r: q.vatRate, m: money(q.vatAmount) })}<br /><b style={{ fontSize: 20 }}>{t('Total : {amount}', { amount: money(q.total) })}</b></p>
            {q.validUntil ? <p>{q.expired ? t('Ce devis a expiré le {d}.', { d: day(q.validUntil) }) : t("Valable jusqu'au {d}.", { d: day(q.validUntil) })}</p> : null}
            {q.conditions ? <p style={{ whiteSpace: 'pre-wrap' }}><b>{t('Conditions')}</b><br />{q.conditions}</p> : null}
            {state === 'accepted' ? <p role="status" style={{ fontWeight: 700 }}>{t('Devis accepté{n}. Merci !', { n: q.acceptedName ? ' ' + t('par {nom}', { nom: q.acceptedName }) : '' })}</p> : null}
            {state === 'refused' ? <p role="status" style={{ fontWeight: 700 }}>{t('Devis refusé. Merci de votre réponse.')}</p> : null}
            {state === 'draft' ? <p>{t("Ce devis n'a pas encore été envoyé : revenez plus tard.")}</p> : null}
            {q.canAnswer && !done ? (
              <form noValidate onSubmit={(e) => { e.preventDefault(); answer(true); }}>
                <label className="fld"><span>{t('Votre nom (obligatoire pour accepter)')}</span><input type="text" autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="fld"><span>{t('Motif du refus (facultatif)')}</span><input type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="submit" className="btn primary" disabled={busy}>{t('Accepter le devis')}</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => answer(false)}>{t('Refuser le devis')}</button>
                </div>
                <p className="muted small">{t("L'acceptation enregistre votre nom et l'heure. Ce n'est pas une signature électronique qualifiée.")}</p>
              </form>
            ) : null}
          </>
        ) : null}
        {err ? <p className="hm-err" role="alert">{tsrv(err)}</p> : null}
        {!q && !err ? <p>{t('Chargement…')}</p> : null}
      </div>
      <PublicFoot />
    </div>
  );
}
