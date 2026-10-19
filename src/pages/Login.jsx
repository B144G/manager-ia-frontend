import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import SiteAssistant from '../components/SiteAssistant.jsx';
import { rq } from '../lib/api.js';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [forgot, setForgot] = useState(false);
  const [v, setV] = useState({ contact: '', pass: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [fc, setFc] = useState('');
  const [ferr, setFerr] = useState('');
  const [fok, setFok] = useState('');
  const [fbusy, setFbusy] = useState(false);
  const [tfa, setTfa] = useState(null);      // { ticket } : étape du code de double authentification
  const [code, setCode] = useState('');

  // Déjà connecté : direction le tableau de bord.
  useEffect(() => { if (params.get('stay')) return; rq('GET', '/api/me').then(() => navigate('/app', { replace: true }), () => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault(); setErr('');
    const contact = v.contact.trim();
    if (!contact || !v.pass) { setErr('Entrez votre e-mail ou téléphone et votre mot de passe.'); return; }
    setBusy(true);
    try {
      const j = await rq('POST', '/api/login', { contact, pass: v.pass });
      if (j && j.twofa) { setTfa({ ticket: j.ticket }); setCode(''); setBusy(false); return; }
      navigate('/app', { replace: true });
    } catch (x) { setErr(x.message); setBusy(false); }
  }
  async function submitCode(e) {
    e.preventDefault(); setErr('');
    if (!code.trim()) { setErr('Entrez le code de votre application.'); return; }
    setBusy(true);
    try { await rq('POST', '/api/login/2fa', { ticket: tfa.ticket, code: code.trim() }); navigate('/app', { replace: true }); } catch (x) { setErr(x.message); setBusy(false); if (/étape a expiré/i.test(x.message)) setTfa(null); }
  }
  async function submitForgot(e) {
    e.preventDefault(); setFerr(''); setFok('');
    const c = fc.trim();
    if (!c) { setFerr('Entrez votre e-mail ou votre téléphone.'); return; }
    setFbusy(true);
    try { const j = await rq('POST', '/api/password/forgot', { contact: c }); setFok(j.message); } catch (x) { setFerr(x.message); }
    setFbusy(false);
  }

  return (
    <>
      <AuthLayout pitch="Bon retour parmi nous" bullets={['Vos clients, votre stock et vos factures vous attendent', 'Une IA qui propose, vous validez', 'Un assistant qui vous guide à chaque étape']}>
        {tfa ? (
          <section className="au-card" id="vTfa">
            <h1>Vérification</h1>
            <p className="au-sub">Entrez le code à 6 chiffres de votre application d'authentification. Vous avez perdu votre téléphone ? Utilisez un de vos codes de secours.</p>
            <form id="ft" noValidate onSubmit={submitCode}>
              <label className="fld"><span>Code</span><input id="tcode" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" /></label>
              <p className="hm-err" id="terr" role="alert">{err}</p>
              <button className="s-btn pri big au-go" type="submit" id="tgo" disabled={busy}>Valider</button>
            </form>
            <p className="au-back"><a href="#" onClick={(e) => { e.preventDefault(); setTfa(null); setErr(''); }}>← Recommencer</a></p>
          </section>
        ) : forgot ? (
          <section className="au-card" id="vForgot">
            <h1>Mot de passe oublié</h1>
            <p className="au-sub">Entrez l'e-mail ou le téléphone de votre compte. Avec un e-mail, vous recevez un lien valable 1 heure. Avec un téléphone, l'équipe vous contacte pour vérifier que c'est bien vous, puis vous envoie le lien.</p>
            <form id="ff" noValidate onSubmit={submitForgot}>
              <label className="fld"><span>E-mail ou téléphone</span><input id="fcontact" autoComplete="username" inputMode="email" required autoFocus value={fc} onChange={(e) => setFc(e.target.value)} /></label>
              <p className="hm-err" id="ferr" role="alert">{ferr}</p>
              {fok ? <p className="au-sub" id="fok" role="status">{fok}</p> : null}
              <button className="s-btn pri big au-go" type="submit" id="fgo" disabled={fbusy}>Recevoir le lien</button>
            </form>
            <p className="au-back"><a href="#" id="backLogin" onClick={(e) => { e.preventDefault(); setForgot(false); }}>← Retour à la connexion</a></p>
          </section>
        ) : (
          <section className="au-card" id="vForm">
            <h1>Connexion</h1>
            <p className="au-sub">Accédez à votre tableau de bord.</p>
            <form id="f" noValidate onSubmit={submit}>
              <label className="fld"><span>E-mail ou téléphone</span><input id="contact" autoComplete="username" inputMode="email" required value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} /></label>
              <label className="fld"><span>Mot de passe</span>
                <span className="au-pass"><input id="pass" type={show ? 'text' : 'password'} autoComplete="current-password" required value={v.pass} onChange={(e) => setV({ ...v, pass: e.target.value })} />
                  <button type="button" id="eye" aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Masquer' : 'Afficher'}</button></span>
              </label>
              <p className="hm-err" id="err" role="alert">{err}</p>
              <button className="s-btn pri big au-go" type="submit" id="go" disabled={busy}>Se connecter</button>
            </form>
            <p className="au-alt"><a href="#oubli" id="forgotLink" onClick={(e) => { e.preventDefault(); setForgot(true); }}>Mot de passe oublié ?</a></p>
            <p className="au-alt">Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></p>
            <p className="au-back"><Link to="/">← Retour à l'accueil</Link></p>
          </section>
        )}
      </AuthLayout>
      <SiteAssistant />
    </>
  );
}
