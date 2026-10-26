import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { rq } from '../lib/api.js';
import { useT } from '../lib/i18n.jsx';
import { serverMsg } from '../components/serverMsg.js';

/** « Nous écrire » : formulaire public d'une organisation (lien /form?o=<jeton>), la demande arrive dans son service client. */
export default function ContactForm() {
  const t = useT();
  const [params] = useSearchParams();
  const token = params.get('o') || '';
  const [v, setV] = useState({ name: '', contact: '', subject: '', message: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setErr('');
    const name = v.name.trim(), message = v.message.trim();
    if (!name || !message) { setErr('Indiquez votre nom et votre message.'); return; }
    setBusy(true);
    try { await rq('POST', '/api/ws/public/intake/' + encodeURIComponent(token), { name, contact: v.contact.trim(), subject: v.subject.trim(), message }); setSent(true); } catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <div className="au-main" style={{ minHeight: '100vh' }}>
      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}><LangSwitch /></div>
      <Logo className="au-logo" style={{ display: 'flex' }} />
      <div className="au-card">
        <h1>{t('Nous écrire')}</h1>
        <p className="au-sub">{t("Décrivez votre demande : l'équipe vous répond le plus vite possible.")}</p>
        {!sent ? (
          <form id="f" noValidate onSubmit={submit}>
            <label className="fld"><span>{t('Votre nom')}</span><input id="name" autoComplete="name" required value={v.name} onChange={set('name')} /></label>
            <label className="fld"><span>{t('Votre téléphone ou e-mail')}</span><input id="contact" autoComplete="off" value={v.contact} onChange={set('contact')} /></label>
            <label className="fld"><span>{t('Sujet')}</span><input id="subject" value={v.subject} onChange={set('subject')} /></label>
            <label className="fld"><span>{t('Votre message')}</span><textarea id="message" rows={5} required value={v.message} onChange={set('message')} /></label>
            <p className="hm-err" id="err" role="alert">{err ? serverMsg(t, err) : ''}</p>
            <button className="s-btn pri big au-go" type="submit" id="go" disabled={busy}>{t('Envoyer')}</button>
          </form>
        ) : <p id="ok" className="s-ok">{t('Merci ! Votre message a bien été envoyé. Nous revenons vers vous très vite.')}</p>}
      </div>
    </div>
  );
}
