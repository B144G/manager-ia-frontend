import { useState } from 'react';
import { rq, SUPPORT_WHATSAPP } from '../../lib/api.js';

/** Formulaire de contact de l'accueil : enregistré par le serveur ; si l'envoi est impossible, on propose WhatsApp. */
export default function Contact() {
  const [v, setV] = useState({ name: '', contact: '', msg: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    setErr('');
    const name = v.name.trim(), contact = v.contact.trim(), msg = v.msg.trim();
    if (!name || !msg) { setErr('Indiquez votre nom et votre message.'); return; }
    setBusy(true);
    try {
      await rq('POST', '/api/contact', { name, contact, what: "Contact depuis l'accueil", message: msg });
      setV({ name: '', contact: '', msg: '' }); setOk(true);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (
    <section className="s-sec alt" id="contact"><div className="s-wrap s-contact">
      <div className="rv">
        <div className="s-head left"><span className="s-eyebrow">Contact</span><h2>Une question ? Parlons-en</h2><p>Le plus rapide : un message sur WhatsApp. Vous pouvez aussi nous écrire par e-mail ou avec le formulaire.</p></div>
        <div className="s-rows">
          <div className="s-row"><div className="t"><small>WhatsApp</small><b>+237 653 62 13 88</b></div><a className="s-btn wa" href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">Écrire</a></div>
          <div className="s-row"><div className="t"><small>WhatsApp</small><b>+237 697 83 67 96</b></div><a className="s-btn wa" href="https://wa.me/237697836796" target="_blank" rel="noopener noreferrer">Écrire</a></div>
          <div className="s-row"><div className="t"><small>E-mail</small><b>tendabrandon9@gmail.com</b></div><a className="s-btn pri" href="mailto:tendabrandon9@gmail.com">Écrire</a></div>
        </div>
      </div>
      <form className="s-form rv" id="contactForm" noValidate onSubmit={submit}>
        <label>Votre nom<input id="cName" autoComplete="name" required value={v.name} onChange={set('name')} /></label>
        <label>Votre téléphone ou e-mail<input id="cContact" autoComplete="off" value={v.contact} onChange={set('contact')} /></label>
        <label>Votre message<textarea id="cMsg" rows={4} required value={v.msg} onChange={set('msg')} /></label>
        <p className="s-err" id="cErr" role="alert">{err}</p>
        <button className="s-btn pri big" type="submit" id="cSend" disabled={busy}>Envoyer le message</button>
        <p className="s-ok" id="cOk" hidden={!ok}>Merci ! Votre message est bien envoyé. Nous revenons vers vous très vite.</p>
      </form>
    </div></section>
  );
}
