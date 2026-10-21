import { useEffect, useState } from 'react';

/** Propose « Installer l'application » (PWA) quand le navigateur le permet ; le refus est mémorisé. */
export default function InstallPrompt() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const dismissed = () => { try { return localStorage.getItem('mi_pwa_no') === '1'; } catch { return false; } };
    const on = (e) => { e.preventDefault(); if (!dismissed()) setEvt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (!evt) return null;
  const no = () => { setEvt(null); try { localStorage.setItem('mi_pwa_no', '1'); } catch { /* ignoré */ } };
  return (
    <div id="pwa-install" role="region" aria-label="Installer l'application"
      style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 60, background: '#0b1322', color: '#fff', borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: '0 8px 30px rgba(0,0,0,.35)', maxWidth: 460, margin: '0 auto' }}>
      <span style={{ flex: 1 }}>Installez MANAGER-IA sur votre écran d'accueil pour y accéder en un clic.</span>
      <button type="button" className="btn primary small" onClick={() => { evt.prompt(); setEvt(null); }}>Installer</button>
      <button type="button" className="btn small" onClick={no}>Plus tard</button>
    </div>
  );
}
