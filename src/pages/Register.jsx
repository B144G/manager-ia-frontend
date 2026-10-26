import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import SiteAssistant from '../components/SiteAssistant.jsx';
import { rq } from '../lib/api.js';
import { useT } from '../lib/i18n.jsx';
import { serverMsg } from '../components/serverMsg.js';

/** Inscription : formulaire, puis (si les e-mails sont actifs) code à 6 chiffres reçu par e-mail, valable 1 minute. */
export default function Register() {
  const t = useT();
  const navigate = useNavigate();
  const [v, setV] = useState({ name: '', contact: '', pass: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'code'
  const [pending, setPending] = useState({ contact: '', shown: '' });
  const [code, setCode] = useState('');
  const [cerr, setCerr] = useState('');
  const [cbusy, setCbusy] = useState(false);
  const [timer, setTimer] = useState({ left: 60, wait: 0 });
  const tick = useRef(null);

  useEffect(() => { rq('GET', '/api/me').then(() => navigate('/app', { replace: true }), () => {}); rq('GET', '/api/register/info').then((j) => setVerify(Boolean(j.verify)), () => {}); return () => clearInterval(tick.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function countdown(life, wait) {
    clearInterval(tick.current);
    const t0 = Date.now();
    const step = () => {
      const el = Math.floor((Date.now() - t0) / 1000);
      setTimer({ left: life - el, wait: Math.max(0, wait - el) });
      if (life - el <= 0 && el >= wait) clearInterval(tick.current);
    };
    step(); tick.current = setInterval(step, 500);
  }

  async function submit(e) {
    e.preventDefault(); setErr('');
    const name = v.name.trim(), contact = v.contact.trim();
    if (!name || !contact || !v.pass) { setErr('Remplissez tous les champs.'); return; }
    setBusy(true);
    try {
      const j = await rq('POST', '/api/register', { name, contact, pass: v.pass });
      if (j && j.verify) { setBusy(false); setPending({ contact, shown: j.contact || contact }); setStep('code'); setCode(''); setCerr(''); countdown(j.expiresIn || 60, j.resendIn || 20); }
      else navigate('/app', { replace: true });
    } catch (x) { setErr(x.message); setBusy(false); }
  }
  async function submitCode(e) {
    e.preventDefault(); setCerr('');
    if (code.length !== 6) { setCerr('Entrez le code à 6 chiffres.'); return; }
    setCbusy(true);
    try { await rq('POST', '/api/register/verify', { contact: pending.contact, code }); clearInterval(tick.current); navigate('/app', { replace: true }); } catch (x) { setCerr(x.message); setCbusy(false); }
  }
  async function resend() {
    setCerr('');
    try { const j = await rq('POST', '/api/register/resend', { contact: pending.contact }); countdown(j.expiresIn || 60, j.resendIn || 20); setCode(''); } catch (x) { setCerr(x.message); }
  }

  return (
    <>
      <AuthLayout pitch={t('Créez votre espace gratuit')} bullets={[t('Réponses aux clients sur WhatsApp, stock, factures, équipe'), t('Une IA qui propose, vous validez'), t('Paiement MTN et Orange Money quand vous êtes prêt')]}>
        {step === 'form' ? (
          <section className="au-card" id="vForm">
            <h1>{t('Créer un compte')}</h1>
            <p className="au-sub">{verify ? t("C'est gratuit. Un code de vérification vous est envoyé par e-mail.") : t("C'est gratuit. Vous arrivez ensuite dans votre tableau de bord.")}</p>
            <form id="f" noValidate onSubmit={submit}>
              <label className="fld"><span>{t('Votre nom')}</span><input id="name" autoComplete="name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
              <label className="fld"><span>{verify ? t('Adresse e-mail') : t('E-mail ou téléphone')}</span><input id="contact" autoComplete="username" inputMode="email" required placeholder={verify ? t('vous@exemple.com') : undefined} value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} /></label>
              <label className="fld"><span>{t('Mot de passe')}</span>
                <span className="au-pass"><input id="pass" type={show ? 'text' : 'password'} autoComplete="new-password" required value={v.pass} onChange={(e) => setV({ ...v, pass: e.target.value })} />
                  <button type="button" id="eye" aria-label={show ? t('Masquer le mot de passe') : t('Afficher le mot de passe')} aria-pressed={show} onClick={() => setShow(!show)}>{show ? t('Masquer') : t('Afficher')}</button></span>
                <small>{t('8 caractères minimum, évitez les mots de passe faciles')}</small>
              </label>
              <p className="hm-err" id="err" role="alert">{err ? serverMsg(t, err) : ''}</p>
              <button className="s-btn pri big au-go" type="submit" id="go" disabled={busy}>{t('Créer mon compte')}</button>
            </form>
            <p className="au-alt">{t('Déjà un compte ?')} <Link to="/connexion">{t('Se connecter')}</Link></p>
            <p className="au-back"><Link to="/">{t("← Retour à l'accueil")}</Link></p>
          </section>
        ) : (
          <section className="au-card" id="vCode">
            <h1>{t('Vérifiez votre e-mail')}</h1>
            <p className="au-sub">{t('Nous avons envoyé un code à 6 chiffres à {to}. Il est valable 1 minute.', { to: pending.shown })}</p>
            <form id="fc" noValidate onSubmit={submitCode}>
              <label className="fld"><span>{t('Code reçu')}</span><input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]*" aria-describedby="timer" required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
              <p className="au-sub" id="timer" aria-live="polite">{timer.left > 0 ? t('Code valable encore {n} s', { n: timer.left }) : t('Code expiré : demandez-en un nouveau.')}</p>
              <p className="hm-err" id="cerr" role="alert">{cerr ? serverMsg(t, cerr) : ''}</p>
              <button className="s-btn pri big au-go" type="submit" id="cgo" disabled={cbusy}>{t('Valider et accéder à mon espace')}</button>
            </form>
            <p className="au-alt"><button type="button" className="link" id="resend" disabled={timer.wait > 0} onClick={resend}>{timer.wait > 0 ? t('Renvoyer le code ({n} s)', { n: timer.wait }) : t('Renvoyer le code')}</button> · <a href="#" id="cback" onClick={(e) => { e.preventDefault(); clearInterval(tick.current); setStep('form'); }}>{t("Changer d'adresse")}</a></p>
          </section>
        )}
      </AuthLayout>
      <SiteAssistant />
    </>
  );
}
