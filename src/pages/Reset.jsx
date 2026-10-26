import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import { rq } from '../lib/api.js';
import { useT } from '../lib/i18n.jsx';
import { serverMsg } from '../components/serverMsg.js';

/** Nouveau mot de passe : le jeton vient du lien reçu (/reinitialiser?t=...), puis il est retiré de la barre d'adresse. */
export default function Reset() {
  const t = useT();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => params.get('t') || '');
  const valid = /^[a-f0-9]{64}$/.test(token);
  const [v, setV] = useState({ a: '', b: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { if (valid) navigate('/reinitialiser', { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (v.a.length < 8) { setErr('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (v.a !== v.b) { setErr('Les deux mots de passe ne sont pas identiques.'); return; }
    setBusy(true);
    try { await rq('POST', '/api/password/reset', { token, pass: v.a }); setDone(true); } catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <AuthLayout pitch={t('Choisissez un nouveau mot de passe')} bullets={[t('Au moins 8 caractères, pas trop facile à deviner'), t("Le lien ne sert qu'une fois et dure 1 heure"), t('Vos autres appareils seront déconnectés')]} image={false}>
      {!valid ? (
        <section className="au-card" id="vOff">
          <h1>{t('Lien non valable')}</h1>
          <p className="au-sub">{t("Ce lien est incomplet ou le serveur n'est pas branché. Demandez un nouveau lien depuis la page de connexion.")}</p>
          <Link className="s-btn" to="/connexion">{t('Retour à la connexion')}</Link>
        </section>
      ) : done ? (
        <section className="au-card" id="vDone">
          <h1>{t("C'est fait")}</h1>
          <p className="au-sub">{t('Votre mot de passe est changé. Vous pouvez vous connecter.')}</p>
          <Link className="s-btn pri big au-go" to="/connexion?stay=1">{t('Me connecter')}</Link>
        </section>
      ) : (
        <section className="au-card" id="vForm">
          <h1>{t('Nouveau mot de passe')}</h1>
          <form id="f" noValidate onSubmit={submit}>
            <label className="fld"><span>{t('Nouveau mot de passe')}</span><input id="p1" type="password" autoComplete="new-password" required value={v.a} onChange={(e) => setV({ ...v, a: e.target.value })} /></label>
            <label className="fld"><span>{t('Répétez-le')}</span><input id="p2" type="password" autoComplete="new-password" required value={v.b} onChange={(e) => setV({ ...v, b: e.target.value })} /></label>
            <p className="hm-err" id="err" role="alert">{err ? serverMsg(t, err) : ''}</p>
            <button className="s-btn pri big au-go" type="submit" id="go" disabled={busy}>{t('Enregistrer')}</button>
          </form>
        </section>
      )}
    </AuthLayout>
  );
}
