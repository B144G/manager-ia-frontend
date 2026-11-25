import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import SiteAssistant from '../components/SiteAssistant.jsx';
import { rq } from '../lib/api.js';
import { useT } from '../lib/i18n.jsx';
import { serverMsg } from '../components/serverMsg.js';

/* Connexion employé (compte d'entreprise) : code d'entreprise + e-mail + secret personnel (mot de passe ou PIN), appareil de confiance, première connexion par invitation.
   Un appareil de confiance ouvre directement le tableau de bord (redirection automatique). L'ancienne connexion reste sur /connexion. */
export default function EmployeeLogin() {
  const t = useT();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login | first
  const [v, setV] = useState({ companyCode: '', email: '', secret: '', inviteCode: '', method: 'pin', confirm: '', trustDays: '30' });
  const [tfa, setTfa] = useState(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const enter = (j) => navigate(j && j.landing ? `/app/${j.landing.orgId}/dashboard` : '/app', { replace: true });

  // Appareil de confiance : retour automatique, sans ressaisie. Sinon, la page s'affiche normalement.
  useEffect(() => {
    let off = false;
    rq('POST', '/api/entreprise-auth/resume').then((j) => { if (off) return; if (j && j.ok) enter(j); else setChecking(false); }, () => { if (!off) setChecking(false); });
    return () => { off = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (!v.companyCode.trim() || !v.email.trim() || !v.secret) { setErr("Entrez le code de l'entreprise, votre e-mail et votre secret."); return; }
    const trustDays = Number(v.trustDays) || 0;
    if (mode === 'first') {
      if (!v.inviteCode.trim()) { setErr("Entrez le code d'invitation personnel reçu de votre administrateur."); return; }
      if (v.secret !== v.confirm) { setErr('Les deux saisies du secret ne sont pas identiques.'); return; }
    }
    setBusy(true);
    try {
      const j = mode === 'first'
        ? await rq('POST', '/api/entreprise-auth/activate', { companyCode: v.companyCode.trim(), inviteCode: v.inviteCode.trim(), email: v.email.trim(), method: v.method, secret: v.secret, trustDays })
        : await rq('POST', '/api/entreprise-auth/login', { companyCode: v.companyCode.trim(), email: v.email.trim(), secret: v.secret, trustDays });
      if (j && j.twofa) { setTfa({ ticket: j.ticket }); setCode(''); setBusy(false); return; }
      enter(j);
    } catch (x) { setErr(x.message); setBusy(false); }
  }
  async function submitCode(e) {
    e.preventDefault(); setErr('');
    if (!code.trim()) { setErr('Entrez le code de votre application.'); return; }
    setBusy(true);
    try { enter(await rq('POST', '/api/entreprise-auth/login/2fa', { ticket: tfa.ticket, code: code.trim() })); } catch (x) { setErr(x.message); setBusy(false); if (/étape a expiré/i.test(x.message)) setTfa(null); }
  }

  return (
    <>
      <AuthLayout pitch={t('Votre espace de travail, selon votre poste')} bullets={[t("Un seul code d'entreprise, votre e-mail et votre secret personnel"), t('Sur un appareil de confiance, vous arrivez directement dans votre espace'), t('Vos accès dépendent de votre poste dans l\'entreprise')]}>
        {checking ? <section className="au-card" aria-busy="true"><h1>{t('Connexion employé')}</h1><p className="au-sub">{t('Vérification de votre appareil…')}</p></section> : tfa ? (
          <section className="au-card" id="vTfa">
            <h1>{t('Vérification')}</h1>
            <p className="au-sub">{t("Entrez le code à 6 chiffres de votre application d'authentification. Vous avez perdu votre téléphone ? Utilisez un de vos codes de secours.")}</p>
            <form noValidate onSubmit={submitCode}>
              <label className="fld"><span>{t('Code')}</span><input inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('123456')} /></label>
              <p className="hm-err" role="alert">{err ? serverMsg(t, err) : ''}</p>
              <button className="s-btn pri big au-go" type="submit" disabled={busy}>{t('Valider')}</button>
            </form>
            <p className="au-back"><a href="#" onClick={(e) => { e.preventDefault(); setTfa(null); setErr(''); }}>{t('← Recommencer')}</a></p>
          </section>
        ) : (
          <section className="au-card" id="vEmp">
            <h1>{mode === 'first' ? t('Première connexion') : t('Connexion employé')}</h1>
            <p className="au-sub">{mode === 'first' ? t("Saisissez le code de l'entreprise et le code d'invitation personnel que votre administrateur vous a remis, puis choisissez votre secret.") : t("Le code de l'entreprise vous est donné par votre administrateur.")}</p>
            <form noValidate onSubmit={submit}>
              <label className="fld"><span>{t("Code de l'entreprise")}</span><input autoComplete="off" autoCapitalize="characters" required value={v.companyCode} onChange={(e) => set('companyCode', e.target.value)} placeholder="ABC-123" /></label>
              {mode === 'first' ? <label className="fld"><span>{t("Code d'invitation personnel")}</span><input autoComplete="off" autoCapitalize="characters" required value={v.inviteCode} onChange={(e) => set('inviteCode', e.target.value)} /></label> : null}
              <label className="fld"><span>{t('Adresse e-mail')}</span><input type="email" autoComplete="username" inputMode="email" required value={v.email} onChange={(e) => set('email', e.target.value)} /></label>
              {mode === 'first' ? (
                <label className="fld"><span>{t('Votre secret personnel')}</span>
                  <select value={v.method} onChange={(e) => set('method', e.target.value)}><option value="pin">{t('Code PIN (6 à 8 chiffres)')}</option><option value="password">{t('Mot de passe')}</option></select></label>
              ) : null}
              <label className="fld"><span>{mode === 'first' ? (v.method === 'pin' ? t('Choisissez votre code PIN') : t('Choisissez votre mot de passe')) : t('Mot de passe ou code PIN')}</span>
                <input type="password" autoComplete={mode === 'first' ? 'new-password' : 'current-password'} inputMode={mode === 'first' && v.method === 'pin' ? 'numeric' : 'text'} required value={v.secret} onChange={(e) => set('secret', e.target.value)} /></label>
              {mode === 'first' ? <label className="fld"><span>{t('Confirmez votre secret')}</span><input type="password" autoComplete="new-password" required value={v.confirm} onChange={(e) => set('confirm', e.target.value)} /></label> : null}
              <label className="fld"><span>{t('Appareil de confiance')}</span>
                <select value={v.trustDays} onChange={(e) => set('trustDays', e.target.value)}>
                  <option value="0">{t('Ne pas retenir cet appareil')}</option><option value="30">{t('Retenir cet appareil 30 jours')}</option><option value="60">{t('Retenir cet appareil 60 jours')}</option><option value="90">{t('Retenir cet appareil 90 jours')}</option>
                </select><small>{t("Sur un appareil retenu, vous arrivez directement dans votre espace. À éviter sur un appareil partagé.")}</small></label>
              <p className="hm-err" role="alert">{err ? serverMsg(t, err) : ''}</p>
              <button className="s-btn pri big au-go" type="submit" disabled={busy}>{mode === 'first' ? t('Créer mon accès') : t('Se connecter')}</button>
            </form>
            <p className="au-alt"><a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'first' ? 'login' : 'first'); setErr(''); }}>{mode === 'first' ? t('J\'ai déjà un accès : me connecter') : t("C'est ma première connexion avec un code d'invitation")}</a></p>
            <p className="au-alt">{t('Vous avez un compte personnel ?')} <Link to="/connexion">{t('Connexion habituelle')}</Link></p>
            <p className="au-back"><Link to="/">{t("← Retour à l'accueil")}</Link></p>
          </section>
        )}
      </AuthLayout>
      <SiteAssistant />
    </>
  );
}
