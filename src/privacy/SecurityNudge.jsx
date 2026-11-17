import { useEffect, useState } from 'react';
import { rq } from '../lib/api.js';
import { useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';
import AccountSecurity from '../ws/AccountSecurity.jsx';
import { useWs } from '../ws/WsContext.jsx';

const BOX = { position: 'fixed', left: 12, bottom: 12, zIndex: 80, background: '#0b1322', color: '#fff', borderRadius: 14, padding: '12px 14px', boxShadow: '0 8px 30px rgba(0,0,0,.35)', maxWidth: 440, display: 'grid', gap: 10 };
const noteKey = 'brij-2fa-nudge';
// Lu au chargement du module : le routeur retire ensuite ?securite=1 de l'adresse.
let wantSecurity = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('securite') === '1';

/** Dans l'espace de travail : rappel « activez la double authentification », message clair quand une organisation l'exige,
    et ouverture directe de la sécurité du compte avec /app?securite=1. */
export default function SecurityNudge() {
  const t = useT();
  const { modal } = useWs();
  const [recommended, setRecommended] = useState(false);
  const [required, setRequired] = useState(null);
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(noteKey) === '1'; } catch { return false; } });
  const open = () => modal(t('Sécurité du compte'), () => <AccountSecurity />, { wide: true });

  useEffect(() => {
    let off = false;
    rq('GET', '/api/security/overview').then((j) => { if (!off) setRecommended(Boolean(j.twofa && j.twofa.recommended && !j.twofa.enabled)); }, () => {});
    return () => { off = true; };
  }, []);
  useEffect(() => {
    const on = (e) => setRequired((e.detail && e.detail.message) || '');
    window.addEventListener('brij:twofa-required', on);
    return () => window.removeEventListener('brij:twofa-required', on);
  }, []);
  useEffect(() => {
    if (wantSecurity) { wantSecurity = false; open(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hide = () => { setHidden(true); try { sessionStorage.setItem(noteKey, '1'); } catch { /* ignoré */ } };
  if (required !== null) {
    return (
      <div role="alert" style={BOX}>
        <b>{t('Cette organisation exige la double authentification')}</b>
        <span>{t("Pour accéder à cette organisation en tant qu'administrateur, activez d'abord la double authentification dans la sécurité de votre compte.")}</span>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn primary small" onClick={open}>{t('Ouvrir la sécurité du compte')}</button>
          <button type="button" className="btn small" style={{ color: '#fff', borderColor: '#fff', background: 'transparent' }} onClick={() => setRequired(null)}>{t('Fermer')}</button>
        </span>
        {required ? <small style={{ opacity: .75 }}>{tsrv(required)}</small> : null}
      </div>
    );
  }
  if (!recommended || hidden) return null;
  return (
    <div role="region" aria-label={t('Protégez votre compte')} style={BOX}>
      <b>{t('Protégez votre compte : activez la double authentification')}</b>
      <span>{t('Un mot de passe volé ne suffira plus à entrer dans votre compte. Cela prend deux minutes.')}</span>
      <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary small" onClick={open}>{t('Activer maintenant')}</button>
        <button type="button" className="btn small" style={{ color: '#fff', borderColor: '#fff', background: 'transparent' }} onClick={hide}>{t('Plus tard')}</button>
      </span>
    </div>
  );
}
