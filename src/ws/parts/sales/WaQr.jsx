import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { Loading, useLoad } from '../../ui.jsx';
import { Pill } from './util.jsx';

const BTN = { minHeight: 44 };
const fmtCode = (c) => (c && c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c || '');
const fmtDate = (iso) => { try { return new Date(iso).toLocaleString(getLocale(), { dateStyle: 'long', timeStyle: 'short' }); } catch { return ''; } };

/** Carte « Connecter votre WhatsApp » : connexion par QR code (comme WhatsApp Web, « Appareils connectés »). La confirmation est demandée avant la connexion. */
export function WaQrCard({ onChange }) {
  const t = useT();
  const { oapi, confirm, toast } = useWs();
  const base = '/sales/wa-qr';
  const st = useLoad(() => oapi('GET', base + '/status'), []);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [usePhone, setUsePhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const s = st.data;
  const status = s ? s.status : '';
  const waiting = status === 'qr' || status === 'connecting';

  // Tant que la connexion est en cours, on interroge le serveur toutes les 3 secondes (le QR code se renouvelle tout seul).
  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(() => { oapi('GET', base + '/status').then((j) => { st.setData(j); if (j.status === 'open') { setCode(''); setUsePhone(false); toast(t('WhatsApp est connecté.')); onChange && onChange(); } }, (e) => setErr(t(e.message))); }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  if (st.loading && !s) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  if (!s) return null;

  const run = (p, after) => { setBusy(true); setErr(''); return p.then((j) => { st.setData(j); if (after) after(j); }, (e) => setErr(t(e.message))).then(() => setBusy(false)); };
  const start = () => run(oapi('POST', base + '/start', { accept: true }));
  const askCode = () => { setBusy(true); setErr(''); setCode(''); oapi('POST', base + '/pairing', { phone }).then((j) => setCode(j.code), (e) => setErr(t(e.message))).then(() => setBusy(false)); };
  const cancel = () => { setCode(''); setUsePhone(false); run(oapi('POST', base + '/stop', {}), () => onChange && onChange()); };
  const disconnect = () => confirm(t("Déconnecter WhatsApp ? L'assistant cessera de répondre sur ce numéro. Vous pourrez le reconnecter avec un nouveau QR code."), () => run(oapi('POST', base + '/stop', {}), () => { toast(t('WhatsApp déconnecté.')); onChange && onChange(); }), t('Oui, déconnecter'));

  return (
    <div className="ws-card">
      <h2>{t('Connecter votre WhatsApp')}</h2>
      {!s.enabled ? <p className="ws-err" role="alert">{s.message ? t(s.message) : t("La connexion par QR code n'est pas disponible pour le moment.")}</p> : null}

      {s.enabled && status === 'open' ? (
        <>
          <p><Pill t={['Connecté', 'good']} /><span>{s.number ? '  +' + s.number : ''}</span></p>
          <p className="muted">{s.since ? t('Connecté depuis le {date}.', { date: fmtDate(s.since) }) + ' ' : ''}{t("L'assistant répond aux messages reçus sur ce numéro. Il n'écrit jamais le premier à une personne inconnue.")}</p>
          <div className="row"><button className="btn small" type="button" style={BTN} disabled={busy} onClick={disconnect}>{t('Déconnecter')}</button></div>
        </>
      ) : null}

      {s.enabled && status !== 'open' ? (
        <>
          <p className="muted">{t("Scannez un QR code avec votre téléphone, comme pour WhatsApp Web. Ensuite l'assistant répond aux clients depuis votre numéro.")}</p>
          {!waiting ? (
            <>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44, padding: '6px 0' }}>
                <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ width: 22, height: 22, flex: '0 0 auto' }} />
                <span>{t('Je confirme vouloir connecter ce numéro WhatsApp à MANAGER-IA')}</span>
              </label>
              <div className="row"><button className="btn primary small" type="button" style={BTN} disabled={!ok || busy} onClick={start}>{busy ? t('Un instant…') : t('Afficher le QR code')}</button></div>
            </>
          ) : (
            <>
              {status === 'qr' && s.qrSvg ? (
                <div style={{ textAlign: 'center', margin: '12px 0' }}>
                  <img alt={t("QR code à scanner avec WhatsApp")} src={'data:image/svg+xml;utf8,' + encodeURIComponent(s.qrSvg)} style={{ width: 260, maxWidth: '100%', height: 'auto', background: '#fff', padding: 8, borderRadius: 8 }} />
                </div>
              ) : <p role="status">{t('Préparation de la connexion…')}</p>}
              <ol className="ws-steps">
                <li>{t('Ouvrez WhatsApp sur votre téléphone.')}</li>
                <li>{t('Allez dans Paramètres, puis Appareils connectés.')}</li>
                <li>{t('Touchez Connecter un appareil, puis scannez ce QR code.')}</li>
              </ol>
              <p className="muted small">{t('Le QR code se renouvelle tout seul. Cette page se met à jour dès que la connexion est faite.')}</p>
              {!usePhone ? (
                <div className="row"><button className="btn small" type="button" style={BTN} onClick={() => setUsePhone(true)}>{t('Utiliser un code à la place')}</button></div>
              ) : (
                <div>
                  <label className="fld"><span>{t("Votre numéro WhatsApp, avec l'indicatif du pays")}</span>
                    <input type="tel" inputMode="tel" autoComplete="tel" placeholder="237677112233" aria-label={t("Numéro WhatsApp")} maxLength={24} value={phone} onChange={(e) => setPhone(e.target.value)} style={{ minHeight: 44 }} />
                  </label>
                  <div className="row"><button className="btn primary small" type="button" style={BTN} disabled={busy || phone.replace(/\D/g, '').length < 8} onClick={askCode}>{t('Obtenir le code')}</button></div>
                  {code ? (
                    <div role="status" style={{ margin: '12px 0' }}>
                      <p style={{ fontSize: 28, letterSpacing: 4, fontWeight: 700, margin: '4px 0' }}>{fmtCode(code)}</p>
                      <p className="muted small">{t('Dans WhatsApp : Paramètres, Appareils connectés, Connecter un appareil, puis « Connecter avec un numéro de téléphone », et saisissez ce code.')}</p>
                    </div>
                  ) : null}
                </div>
              )}
              <div className="row" style={{ marginTop: 10 }}><button className="btn small" type="button" style={BTN} disabled={busy} onClick={cancel}>{t('Annuler')}</button></div>
            </>
          )}
        </>
      ) : null}
      {err ? <p className="ws-err" role="alert" style={{ overflowWrap: 'anywhere' }}>{err}</p> : null}
    </div>
  );
}
