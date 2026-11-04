import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { SUPPORT_WHATSAPP, rq } from '../lib/api.js';
import { useT } from '../lib/i18n.jsx';
import { serverMsg } from '../components/serverMsg.js';

/** « Être contacté » : la personne laisse volontairement ses coordonnées. Les e-mails de suivi (3 au plus) ne partent que si la case est cochée, avec un lien pour s'arrêter. */
export default function Essai() {
  const t = useT();
  const [params] = useSearchParams();
  const source = (params.get('utm_source') || params.get('src') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30) || 'site';
  const [v, setV] = useState({ name: '', contact: '', activity: '', consent: false, website: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { document.title = t('Essayer Brij-IA gratuitement') + ' · Brij-IA'; }, [t]);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const isMail = v.contact.includes('@');
  async function submit(e) {
    e.preventDefault(); setErr('');
    const name = v.name.trim(), contact = v.contact.trim();
    if (name.length < 2) { setErr('Veuillez indiquer votre nom.'); return; }
    if (contact.replace(/\D/g, '').length < 8 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)) { setErr('Indiquez un numéro WhatsApp ou une adresse e-mail valide.'); return; }
    setBusy(true);
    try {
      await rq('POST', '/api/contact', { name, contact, what: 'Essai gratuit', message: v.activity.trim() ? 'Activité : ' + v.activity.trim() : "Demande d'essai gratuit.", consent: v.consent && isMail, source, website: v.website });
      setDone(true);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (
    <div className="au-main" style={{ minHeight: '100vh' }}>
      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}><LangSwitch /></div>
      <Logo className="au-logo" style={{ display: 'flex' }} />
      <div className="au-card">
        <h1>{t('Essayer Brij-IA gratuitement')}</h1>
        {!done ? (
          <>
            <p className="au-sub">{t("Laissez votre numéro WhatsApp ou votre e-mail : nous vous aidons à démarrer, sans engagement et sans carte bancaire.")}</p>
            <form noValidate onSubmit={submit}>
              <label className="fld"><span>{t('Votre nom')}</span><input id="name" autoComplete="name" required value={v.name} onChange={set('name')} /></label>
              <label className="fld"><span>{t('Votre numéro WhatsApp ou e-mail')}</span><input id="contact" autoComplete="off" inputMode="email" required value={v.contact} onChange={set('contact')} /></label>
              <label className="fld"><span>{t('Votre activité (facultatif)')}</span><input id="activity" placeholder={t('Ex : menuiserie, boutique, restaurant…')} value={v.activity} onChange={set('activity')} /></label>
              <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}><label>Site web<input tabIndex={-1} autoComplete="off" value={v.website} onChange={set('website')} /></label></div>
              {isMail ? (
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '10px 0', fontSize: 14 }}>
                  <input type="checkbox" checked={v.consent} onChange={(e) => setV((s) => ({ ...s, consent: e.target.checked }))} style={{ marginTop: 3, minWidth: 20, minHeight: 20 }} />
                  <span>{t("J'accepte de recevoir 3 e-mails de conseils pour bien démarrer. Chaque e-mail contient un lien pour ne plus en recevoir.")}</span>
                </label>
              ) : null}
              <p className="hm-err" role="alert">{err ? serverMsg(t, err) : ''}</p>
              <button className="s-btn pri big au-go" type="submit" disabled={busy}>{t('Je veux être contacté')}</button>
            </form>
            <p style={{ fontSize: 13, opacity: 0.8 }}>{t("Vos coordonnées servent uniquement à vous répondre. Elles ne sont ni vendues ni partagées.")} <Link to="/confidentialite">{t('Politique de confidentialité')}</Link></p>
          </>
        ) : (
          <>
            <p className="s-ok">{t('Merci ! Nous revenons vers vous très vite.')}</p>
            <p>{t('Pour aller plus vite, vous pouvez aussi nous écrire sur WhatsApp, ou créer votre espace gratuit tout de suite.')}</p>
            <div className="s-cta">
              <a className="s-btn big" href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">{t('Écrire sur WhatsApp')}</a>
              <Link to="/inscription" className="s-btn big pri">{t('Créer mon espace gratuit')}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
