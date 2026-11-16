import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { onCookieSettingsOpen, readConsent, saveConsent } from '../lib/consent.js';
import { useT } from '../lib/i18n.jsx';
import { trackVisit } from '../lib/visit.js';

/* Bandeau de consentement aux cookies. Les trois boutons ont exactement la même apparence : refuser est aussi simple qu'accepter.
   Mise en forme en ligne : le bandeau s'affiche pareil sur toutes les pages, quelle que soit la feuille de style chargée. */
const BOX = { position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 300, background: '#0b1322', color: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 8px 30px rgba(0,0,0,.45)', maxWidth: 640, margin: '0 auto', fontSize: 15, lineHeight: 1.5, maxHeight: '85vh', overflowY: 'auto' };
const BTN = { flex: '1 1 150px', minHeight: 46, padding: '10px 16px', borderRadius: 10, border: '2px solid #fff', background: 'transparent', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' };
const ROW = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,.2)' };

export default function CookieBanner() {
  const t = useT();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => !readConsent());
  const [view, setView] = useState('main');
  const [analytics, setAnalytics] = useState(() => { const c = readConsent(); return c ? c.analytics : false; });
  const box = useRef(null);
  useEffect(() => onCookieSettingsOpen(() => { const c = readConsent(); setAnalytics(c ? c.analytics : false); setView('custom'); setOpen(true); }), []);
  useEffect(() => { if (open && view === 'custom' && box.current) box.current.focus(); }, [open, view]);
  if (!open || /^\/(imprimer|imprimer-kpi|recu)\//.test(pathname)) return null;

  const choose = (a) => {
    saveConsent({ analytics: a });
    setOpen(false); setView('main');
    if (a) trackVisit(window.location.pathname); // la page déjà affichée est comptée dès l'acceptation
  };

  return (
    <div ref={box} tabIndex={-1} role="region" aria-label={t('Cookies et mesure d\'audience')} style={BOX} id="cookie-banner">
      <b style={{ display: 'block', fontSize: 17, marginBottom: 4 }}>{t('Vos choix sur les cookies')}</b>
      {view === 'main' ? (
        <p style={{ margin: '0 0 12px' }}>{t("Nous utilisons uniquement ce qui est nécessaire au fonctionnement du site. Avec votre accord, nous comptons aussi les visites de façon anonyme pour améliorer le site. Vous pouvez changer d'avis à tout moment.")} <Link to="/confidentialite" style={{ color: '#fff', textDecoration: 'underline' }}>{t('En savoir plus')}</Link></p>
      ) : (
        <div style={{ margin: '4px 0 12px' }}>
          <label style={ROW}>
            <input type="checkbox" checked disabled style={{ width: 20, height: 20, marginTop: 2 }} />
            <span><b>{t('Nécessaires (toujours actifs)')}</b><br /><small>{t("Cookie de session pour rester connecté (invisible pour les scripts du navigateur) et préférences d'affichage comme la langue et le thème. Sans eux, le site ne fonctionne pas.")}</small></span>
          </label>
          <label style={ROW}>
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
            <span><b>{t("Mesure d'audience")}</b><br /><small>{t("Compte les pages vues du site public (page, origine de la visite, type d'appareil), sans identifiant ni adresse enregistrée. Désactivée par défaut.")}</small></span>
          </label>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {view === 'main' ? (
          <>
            <button type="button" style={BTN} onClick={() => choose(false)}>{t('Tout refuser')}</button>
            <button type="button" style={BTN} onClick={() => choose(true)}>{t('Tout accepter')}</button>
            <button type="button" style={BTN} onClick={() => setView('custom')}>{t('Personnaliser')}</button>
          </>
        ) : (
          <>
            <button type="button" style={BTN} onClick={() => choose(false)}>{t('Tout refuser')}</button>
            <button type="button" style={BTN} onClick={() => choose(true)}>{t('Tout accepter')}</button>
            <button type="button" style={BTN} onClick={() => choose(analytics)}>{t('Enregistrer mes choix')}</button>
          </>
        )}
      </div>
    </div>
  );
}
