import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { rq } from '../lib/api.js';
import { Form, Loading, useLoad } from './ui.jsx';
import { useWs } from './WsContext.jsx';

const sec = (method, path, body) => rq(method, '/api/security' + path, body);
const when = (iso) => { try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };

/** Sécurité du compte : mot de passe, double authentification (application d'authentification), appareils connectés. */
export default function AccountSecurity() {
  const { toast, fail } = useWs();
  const st = useLoad(() => sec('GET', '/overview'), []);
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <p className="ws-err">{st.error.message}</p>;
  const { twofa, sessions } = st.data;
  const others = sessions.filter((s) => !s.current);
  return (
    <div>
      <section className="ws-sub" style={{ marginBottom: 18 }}>
        <h2>Mot de passe</h2>
        <p className="muted small">En le changeant, tous vos autres appareils sont déconnectés tout de suite.</p>
        <Form submitText="Changer le mot de passe" onSubmit={(v) => rq('POST', '/api/me/password', { current: v.current, pass: v.pass }).then(() => { toast('Mot de passe changé. Les autres appareils sont déconnectés.'); st.reload(); })}
          fields={[{ k: 'current', label: 'Mot de passe actuel', type: 'password', required: true }, { k: 'pass', label: 'Nouveau mot de passe', type: 'password', required: true, hint: '8 caractères minimum, mélangez lettres et chiffres.' }]} />
      </section>

      <section className="ws-sub" style={{ marginBottom: 18 }}>
        <h2>Double authentification</h2>
        {twofa.enabled ? <TwoFaOn left={twofa.recoveryLeft} done={st.reload} /> : <TwoFaOff done={st.reload} />}
      </section>

      <section className="ws-sub">
        <h2>Appareils connectés</h2>
        {sessions.map((s) => (
          <div className="line" key={s.id}>
            <span><b>{s.device}</b>{s.current ? <small> · cet appareil</small> : null}<br /><small>{s.ip || 'adresse inconnue'} · dernière activité {when(s.lastSeen)}</small></span>
            {s.current ? null : <button className="link" type="button" onClick={() => sec('DELETE', '/sessions/' + s.id).then(() => { toast('Appareil déconnecté.'); st.reload(); }, fail)}>Déconnecter</button>}
          </div>
        ))}
        {others.length ? <p style={{ marginTop: 12 }}><button className="btn small" type="button" onClick={() => sec('POST', '/sessions/revoke-others', {}).then((j) => { toast(j.closed + ' appareil(s) déconnecté(s).'); st.reload(); }, fail)}>Déconnecter tous les autres appareils</button></p> : <p className="muted small">Aucun autre appareil connecté.</p>}
      </section>
    </div>
  );
}

/** Activation en deux temps : mot de passe → secret + QR code → premier code → codes de secours. */
function TwoFaOff({ done }) {
  const [step, setStep] = useState('ask');   // ask | scan | codes
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState([]);
  const { copy } = useWs();
  if (step === 'ask') {
    return (
      <>
        <p className="muted small">Ajoute une 2ᵉ étape à la connexion : un code qui change toutes les 30 secondes, dans une application (Google Authenticator, Microsoft Authenticator, Authy, 2FAS…). Un mot de passe volé ne suffit plus.</p>
        <Form submitText="Activer la double authentification" onSubmit={(v) => sec('POST', '/2fa/setup', { password: v.password }).then((j) => { setSetup(j); setStep('scan'); })}
          fields={[{ k: 'password', label: 'Votre mot de passe', type: 'password', required: true }]} />
      </>
    );
  }
  if (step === 'scan') {
    return (
      <>
        <p className="small">1. Dans votre application, ajoutez un compte et <b>scannez ce code</b> (ou saisissez la clé).</p>
        <Qr text={setup.uri} />
        <p className="small">Clé : <code style={{ wordBreak: 'break-all' }}>{setup.secret}</code> <button className="link" type="button" onClick={() => copy(setup.secret, 'Clé copiée.')}>Copier</button></p>
        <p className="small">2. Entrez le code à 6 chiffres affiché pour confirmer.</p>
        <Form submitText="Confirmer et activer" onSubmit={(v) => sec('POST', '/2fa/enable', { code: v.code }).then((j) => { setCodes(j.recoveryCodes); setStep('codes'); })}
          fields={[{ k: 'code', label: 'Code à 6 chiffres', required: true, placeholder: '123456' }]} />
      </>
    );
  }
  return (
    <>
      <p><b>C'est activé.</b> Notez ces <b>codes de secours</b> : si vous perdez votre téléphone, chacun permet une connexion (une seule fois). Ils ne seront plus affichés.</p>
      <div className="ws-prop" style={{ fontFamily: 'monospace', columns: 2, padding: 12 }}>{codes.map((c) => <div key={c}>{c}</div>)}</div>
      <p className="row"><button className="btn small" type="button" onClick={() => copy(codes.join('\n'), 'Codes copiés.')}>Copier</button><button className="btn primary small" type="button" onClick={done}>J'ai noté mes codes</button></p>
    </>
  );
}

function TwoFaOn({ left, done }) {
  const [mode, setMode] = useState('');   // '' | 'off' | 'codes'
  const [codes, setCodes] = useState(null);
  const { copy, toast } = useWs();
  const fields = [{ k: 'password', label: 'Votre mot de passe', type: 'password', required: true }, { k: 'code', label: 'Code de l\'application (ou code de secours)', required: true }];
  if (codes) {
    return (
      <>
        <p>Nouveaux codes de secours (les anciens ne marchent plus). Notez-les : ils ne seront plus affichés.</p>
        <div className="ws-prop" style={{ fontFamily: 'monospace', columns: 2, padding: 12 }}>{codes.map((c) => <div key={c}>{c}</div>)}</div>
        <p className="row"><button className="btn small" type="button" onClick={() => copy(codes.join('\n'), 'Codes copiés.')}>Copier</button><button className="btn primary small" type="button" onClick={done}>Terminé</button></p>
      </>
    );
  }
  return (
    <>
      <p><b style={{ color: 'var(--green, #12b76a)' }}>Active.</b> <span className="muted small">{left} code(s) de secours restant(s){left <= 3 ? ' : pensez à en générer de nouveaux.' : '.'}</span></p>
      {mode === '' ? (
        <p className="row"><button className="btn small" type="button" onClick={() => setMode('codes')}>Nouveaux codes de secours</button><button className="btn small" type="button" onClick={() => setMode('off')}>Désactiver</button></p>
      ) : mode === 'codes' ? (
        <Form submitText="Générer de nouveaux codes" onSubmit={(v) => sec('POST', '/2fa/recovery', v).then((j) => setCodes(j.recoveryCodes))} fields={fields} extra={<button className="btn" type="button" onClick={() => setMode('')}>Annuler</button>} />
      ) : (
        <Form submitText="Désactiver la double authentification" onSubmit={(v) => sec('POST', '/2fa/disable', v).then(() => { toast('Double authentification désactivée.'); done(); })} fields={fields} extra={<button className="btn" type="button" onClick={() => setMode('')}>Annuler</button>} />
      )}
    </>
  );
}

function Qr({ text }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) QRCode.toCanvas(ref.current, text, { width: 200, margin: 1 }).catch(() => {}); }, [text]);
  return <canvas ref={ref} aria-label="Code à scanner" style={{ display: 'block', margin: '8px 0', borderRadius: 8 }} />;
}
