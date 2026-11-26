import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { rq } from '../lib/api.js';
import { Icon } from '../lib/fa.jsx';
import { getLocale, useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';
import { Badge, Button } from '../ws/ui/index.jsx';
import { Empty, Msg, Note, PasswordInput, Row, Rows, Section, StrengthMeter, copyText, saveText, strengthOf } from './kit.jsx';
import { fmtDate, useData, useFlash } from './util.jsx';

const sec = (method, path, body) => rq(method, '/api/security' + path, body);
const when = (iso) => { try { return new Date(iso).toLocaleString(getLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };

/** Mot de passe, double authentification, appareils connectés et appareils de confiance : les mêmes blocs dans le centre de confidentialité et dans la fenêtre « Sécurité du compte ». */
export default function SecurityPanels({ orgId }) {
  const t = useT();
  const st = useData(() => sec('GET', '/overview'), []);
  if (st.loading) return <p className="ws-empty" role="status">{t('Chargement…')}</p>;
  if (st.error) return <Note tone="danger">{tsrv(st.error.message)} <Button size="sm" onClick={st.reload}>{t('Réessayer')}</Button></Note>;
  const { twofa, sessions } = st.data;
  return (
    <>
      <PasswordCard />
      <TwoFactorCard twofa={twofa} reload={st.reload} />
      <SessionsCard sessions={sessions} reload={st.reload} />
      {orgId ? <EmployeeAccessCard orgId={orgId} /> : null}
    </>
  );
}

function PasswordCard() {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [again, setAgain] = useState(''); const [busy, setBusy] = useState(false);
  const { score } = strengthOf(pw);
  const mismatch = again && pw !== again;
  const submit = async (e) => {
    e.preventDefault(); clear();
    if (!cur || !pw) return bad(new Error(t('Remplissez les deux mots de passe.')));
    if (score < 2) return bad(new Error(t('Le nouveau mot de passe est trop faible : 8 caractères au moins, avec des lettres et des chiffres.')));
    if (pw !== again) return bad(new Error(t('Les deux saisies du nouveau mot de passe ne sont pas identiques.')));
    setBusy(true);
    try { await rq('POST', '/api/me/password', { current: cur, pass: pw }); ok(t('Mot de passe changé. Les autres appareils sont déconnectés.')); setCur(''); setPw(''); setAgain(''); } catch (er) { bad(new Error(tsrv(er.message))); }
    setBusy(false);
  };
  return (
    <Section id="sec-password" icon="pv-key" title={t('Mot de passe')} desc={t('En le changeant, tous vos autres appareils sont déconnectés tout de suite.')}>
      <form className="pv-form" noValidate onSubmit={submit}>
        <PasswordInput label={t('Mot de passe actuel')} value={cur} onChange={setCur} />
        <PasswordInput label={t('Nouveau mot de passe')} value={pw} onChange={setPw} autoComplete="new-password" describedBy="pw-meter" />
        <StrengthMeter value={pw} id="pw-meter" />
        <PasswordInput label={t('Confirmer le nouveau mot de passe')} value={again} onChange={setAgain} autoComplete="new-password" />
        {mismatch ? <p className="pv-msg bad" role="alert">{t('Les deux saisies ne sont pas identiques.')}</p> : null}
        <div className="pv-act"><Button variant="primary" type="submit" loading={busy} icon="pv-lock">{t('Changer le mot de passe')}</Button></div>
        <Msg f={flash} />
      </form>
    </Section>
  );
}

function TwoFactorCard({ twofa, reload }) {
  const t = useT();
  return (
    <Section id="sec-2fa" icon="pv-user-shield" tone={twofa.enabled ? 'ok' : twofa.recommended ? 'warn' : ''} title={t('Double authentification')}
      desc={t('Un code qui change toutes les 30 secondes s’ajoute à votre mot de passe : s’il est volé, il ne suffit plus.')}
      actions={<Badge tone={twofa.enabled ? 'ok' : 'neutral'} dot>{twofa.enabled ? t('Activée') : t('Désactivée')}</Badge>}>
      {twofa.recommended ? <Note tone="warn">{t('Vous administrez une organisation : activer la double authentification est fortement recommandé.')}</Note> : null}
      {twofa.enabled ? <TwoFaOn left={twofa.recoveryLeft} done={reload} /> : <TwoFaOff done={reload} />}
    </Section>
  );
}

const STEPS = ['Confirmer', 'Scanner', 'Vérifier', 'Codes de secours'];
function Stepper({ at }) {
  const t = useT();
  return <ol className="pv-steps" aria-label={t('Étapes')}>{STEPS.map((s, i) => <li key={s} className={i === at ? 'on' : i < at ? 'done' : ''} aria-current={i === at ? 'step' : undefined}><i>{i < at ? <Icon name="pv-check" /> : i + 1}</i><span>{t(s)}</span></li>)}</ol>;
}

/** Activation guidée : mot de passe → scan du code → premier code → codes de secours à conserver. */
function TwoFaOff({ done }) {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const [step, setStep] = useState(-1);
  const [pw, setPw] = useState(''); const [code, setCode] = useState(''); const [setup, setSetup] = useState(null); const [codes, setCodes] = useState([]); const [busy, setBusy] = useState(false);
  const run = async (fn) => { clear(); setBusy(true); try { await fn(); } catch (e) { bad(new Error(tsrv(e.message))); } setBusy(false); };
  if (step < 0) return (
    <div className="pv-act"><Button variant="primary" icon="pv-user-shield" onClick={() => setStep(0)}>{t('Activer la double authentification')}</Button></div>
  );
  return (
    <div className="pv-form" style={{ maxWidth: 560 }}>
      <Stepper at={step} />
      {step === 0 ? (
        <form className="pv-form" noValidate onSubmit={(e) => { e.preventDefault(); run(async () => { setSetup(await sec('POST', '/2fa/setup', { password: pw })); setPw(''); setStep(1); }); }}>
          <p className="muted">{t('Il vous faut une application d’authentification : Google Authenticator, Microsoft Authenticator, Authy ou 2FAS.')}</p>
          <PasswordInput label={t('Votre mot de passe')} value={pw} onChange={setPw} />
          <div className="pv-act"><Button variant="primary" type="submit" loading={busy} disabled={!pw}>{t('Continuer')}</Button><Button type="button" variant="ghost" onClick={() => setStep(-1)}>{t('Annuler')}</Button></div>
        </form>
      ) : null}
      {step === 1 && setup ? (
        <>
          <p>{t('Dans votre application, ajoutez un compte et scannez ce code, ou saisissez la clé à la main.')}</p>
          <div className="pv-qr"><Qr text={setup.uri} /><div className="pv-key"><code>{setup.secret}</code><Button size="sm" icon="pv-copy" onClick={async () => ok((await copyText(setup.secret)) ? t('Clé copiée.') : t('Copie impossible : sélectionnez la clé.'))}>{t('Copier')}</Button></div></div>
          <div className="pv-act"><Button variant="primary" onClick={() => { clear(); setStep(2); }}>{t('J’ai scanné le code')}</Button></div>
        </>
      ) : null}
      {step === 2 ? (
        <form className="pv-form" noValidate onSubmit={(e) => { e.preventDefault(); run(async () => { const j = await sec('POST', '/2fa/enable', { code }); setCodes(j.recoveryCodes); setStep(3); }); }}>
          <label className="pv-field" htmlFor="tf_code"><span>{t('Code à 6 chiffres affiché dans l’application')}</span><input id="tf_code" className="pv-in" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <div className="pv-act"><Button variant="primary" type="submit" loading={busy} disabled={code.trim().length < 6}>{t('Vérifier et activer')}</Button><Button type="button" variant="ghost" onClick={() => setStep(1)}>{t('Retour')}</Button></div>
        </form>
      ) : null}
      {step === 3 ? <RecoveryCodes codes={codes} intro={t('C’est activé. Gardez ces codes de secours : si vous perdez votre téléphone, chacun permet une connexion, une seule fois. Ils ne seront plus affichés.')} onDone={done} doneText={t('J’ai noté mes codes')} /> : null}
      <Msg f={flash} />
    </div>
  );
}

function RecoveryCodes({ codes, intro, onDone, doneText }) {
  const t = useT();
  const [saved, setSaved] = useState(false); const [m, setM] = useState('');
  return (
    <>
      <Note tone="warn">{intro}</Note>
      <div className="pv-codes" aria-label={t('Codes de secours')}>{codes.map((c) => <span key={c}>{c}</span>)}</div>
      <div className="pv-act">
        <Button icon="pv-copy" onClick={async () => { setSaved(true); setM((await copyText(codes.join('\n'))) ? t('Codes copiés.') : t('Copie impossible : notez-les à la main.')); }}>{t('Copier')}</Button>
        <Button icon="pv-download" onClick={() => { setSaved(true); saveText('mabah-codes-de-secours.txt', codes.join('\n') + '\n'); }}>{t('Télécharger')}</Button>
        <Button variant="primary" disabled={!saved} onClick={onDone}>{doneText}</Button>
      </div>
      {!saved ? <p className="muted small">{t('Copiez ou téléchargez les codes pour continuer.')}</p> : null}
      {m ? <p className="pv-msg ok" role="status">{m}</p> : null}
    </>
  );
}

function TwoFaOn({ left, done }) {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const [mode, setMode] = useState('');
  const [pw, setPw] = useState(''); const [code, setCode] = useState(''); const [codes, setCodes] = useState(null); const [busy, setBusy] = useState(false);
  const reset = () => { setMode(''); setPw(''); setCode(''); clear(); };
  const submit = (path, after) => async (e) => { e.preventDefault(); clear(); setBusy(true); try { const j = await sec('POST', path, { password: pw, code }); after(j); } catch (er) { bad(new Error(tsrv(er.message))); } setBusy(false); };
  if (codes) return <RecoveryCodes codes={codes} intro={t('Nouveaux codes de secours : les anciens ne fonctionnent plus. Ils ne seront plus affichés.')} onDone={done} doneText={t('Terminé')} />;
  return (
    <>
      <Rows><Row title={t('Codes de secours')} desc={left <= 3 ? t('{n} code(s) de secours restant(s) : pensez à en générer de nouveaux.', { n: left }) : t('{n} code(s) de secours restant(s).', { n: left })}>
        {mode === '' ? <><Button size="sm" onClick={() => setMode('codes')}>{t('Nouveaux codes de secours')}</Button><Button size="sm" variant="danger-outline" onClick={() => setMode('off')}>{t('Désactiver')}</Button></> : null}
      </Row></Rows>
      {mode ? (
        <form className="pv-form" noValidate onSubmit={mode === 'codes' ? submit('/2fa/recovery', (j) => setCodes(j.recoveryCodes)) : submit('/2fa/disable', () => { ok(t('Double authentification désactivée.')); done(); })}>
          {mode === 'off' ? <Note tone="warn">{t('Sans double authentification, votre mot de passe suffit pour ouvrir votre compte.')}</Note> : null}
          <PasswordInput label={t('Votre mot de passe')} value={pw} onChange={setPw} />
          <label className="pv-field" htmlFor="tf_c2"><span>{t('Code de l’application (ou code de secours)')}</span><input id="tf_c2" className="pv-in" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <div className="pv-act"><Button variant={mode === 'off' ? 'danger' : 'primary'} type="submit" loading={busy} disabled={!pw || !code}>{mode === 'off' ? t('Désactiver la double authentification') : t('Générer de nouveaux codes')}</Button><Button type="button" variant="ghost" onClick={reset}>{t('Annuler')}</Button></div>
        </form>
      ) : null}
      <Msg f={flash} />
    </>
  );
}

function Qr({ text }) {
  const t = useT();
  const ref = useRef(null);
  useEffect(() => { if (ref.current) QRCode.toCanvas(ref.current, text, { width: 188, margin: 1 }).catch(() => {}); }, [text]);
  return <canvas ref={ref} aria-label={t('Code à scanner')} />;
}

const isPhone = (d) => /android|iphone|ipad|mobile/i.test(String(d));
function SessionsCard({ sessions, reload }) {
  const t = useT();
  const { flash, ok, bad, clear } = useFlash();
  const others = sessions.filter((s) => !s.current);
  const act = (fn, done) => { clear(); fn().then((j) => { ok(done(j)); reload(); }, (e) => bad(new Error(tsrv(e.message)))); };
  return (
    <Section id="sec-sessions" icon="pv-laptop" title={t('Appareils connectés')} desc={t('Les appareils où votre compte est ouvert en ce moment. Déconnectez ceux que vous ne reconnaissez pas.')}
      actions={others.length ? <Button size="sm" variant="danger-outline" onClick={() => act(() => sec('POST', '/sessions/revoke-others', {}), (j) => t('{n} appareil(s) déconnecté(s).', { n: j.closed }))}>{t('Déconnecter tous les autres')}</Button> : null}>
      <Rows>
        {sessions.map((s) => (
          <Row key={s.id} title={<><Icon name={isPhone(s.device) ? 'pv-mobile' : 'pv-laptop'} /> {tsrv(s.device)} {s.current ? <Badge tone="brand">{t('cet appareil')}</Badge> : null}</>} desc={t('{ip} · dernière activité {date}', { ip: s.ip || t('adresse inconnue'), date: when(s.lastSeen) })}>
            {s.current ? null : <Button size="sm" onClick={() => act(() => sec('DELETE', '/sessions/' + s.id), () => t('Appareil déconnecté.'))}>{t('Déconnecter')}</Button>}
          </Row>
        ))}
      </Rows>
      {!others.length ? <p className="muted small">{t('Aucun autre appareil connecté.')}</p> : null}
      <Msg f={flash} />
    </Section>
  );
}

/** Connexion avec le code de l'entreprise : secret personnel et appareils de confiance (retour automatique 30 à 90 jours). */
function EmployeeAccessCard({ orgId }) {
  const t = useT();
  const st = useData(() => rq('GET', '/api/entreprise-auth/devices'), []);
  const { flash, ok, bad, clear } = useFlash();
  const [cur, setCur] = useState(''); const [method, setMethod] = useState(''); const [secret, setSecret] = useState(''); const [busy, setBusy] = useState(false);
  if (st.loading || !st.data) return null;
  const d = st.data;
  const m = method || d.method || 'pin';
  const del = (id) => { clear(); rq('DELETE', '/api/entreprise-auth/devices/' + id).then(() => { ok(t('Appareil retiré.')); st.reload(); }, (e) => bad(new Error(tsrv(e.message)))); };
  const save = async (e) => {
    e.preventDefault(); clear(); setBusy(true);
    try { await rq('PUT', '/api/entreprise-auth/secret', { orgId, current: cur, method: m, secret }); ok(t('Secret enregistré. Vos appareils de confiance ont été retirés.')); setCur(''); setSecret(''); st.reload(); } catch (er) { bad(new Error(tsrv(er.message))); }
    setBusy(false);
  };
  return (
    <Section id="sec-trusted" icon="pv-finger" title={t('Connexion avec le code de l’entreprise')}
      desc={d.hasCompanyLogin ? t('Active : vous pouvez vous connecter avec le code de l’entreprise, votre e-mail et votre secret.') : t('Pas encore activée : choisissez un secret (mot de passe ou code PIN) pour vous connecter avec le code de l’entreprise.')}
      actions={<Badge tone={d.hasCompanyLogin ? 'ok' : 'neutral'} dot>{d.hasCompanyLogin ? t('Activée') : t('Désactivée')}</Badge>}>
      <form className="pv-form" noValidate onSubmit={save}>
        <PasswordInput label={d.hasCompanyLogin ? t('Secret actuel') : t('Mot de passe actuel')} value={cur} onChange={setCur} />
        <label className="pv-field" htmlFor="ea_m"><span>{t('Type de secret')}</span><select id="ea_m" className="pv-in" value={m} onChange={(e) => setMethod(e.target.value)}><option value="pin">{t('Code PIN (6 à 8 chiffres)')}</option><option value="password">{t('Mot de passe')}</option></select></label>
        <PasswordInput label={t('Nouveau secret')} value={secret} onChange={setSecret} autoComplete="new-password" />
        <div className="pv-act"><Button variant="primary" type="submit" loading={busy} disabled={!cur || !secret}>{d.hasCompanyLogin ? t('Changer mon secret') : t('Activer ma connexion employé')}</Button></div>
      </form>
      <h3 style={{ margin: 0, fontSize: 'var(--fs-md)' }}>{t('Appareils de confiance')}</h3>
      {d.devices.length === 0 ? <Empty icon="pv-laptop" title={t('Aucun appareil de confiance')}>{t('Un appareil de confiance évite de ressaisir votre secret pendant 30 à 90 jours.')}</Empty> : (
        <Rows>{d.devices.map((x) => (
          <Row key={x.id} title={<>{x.label} {x.current ? <Badge tone="brand">{t('cet appareil')}</Badge> : null}</>} desc={t('dernière activité {date}', { date: when(x.lastSeen) }) + ' · ' + t('valable jusqu’au {date}', { date: fmtDate(x.expiresAt) })}>
            <Button size="sm" onClick={() => del(x.id)}>{t('Retirer')}</Button>
          </Row>))}
        </Rows>
      )}
      {d.devices.length > 1 ? <div className="pv-act"><Button size="sm" variant="danger-outline" onClick={() => rq('DELETE', '/api/entreprise-auth/devices').then(() => { ok(t('Appareils retirés.')); st.reload(); }, (e) => bad(new Error(tsrv(e.message))))}>{t('Retirer tous mes appareils')}</Button></div> : null}
      <Msg f={flash} />
    </Section>
  );
}
