import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LangSwitch from '../../components/LangSwitch.jsx';
import { Fa } from '../../lib/fa.jsx';
import { toggleTheme } from '../../lib/theme.js';
import { useT } from '../../lib/i18n.jsx';

export function VtLogo() {
  const t = useT();
  return (
    <Link className="vt-logo" to="/" aria-label={t('Brij-IA, accueil')}>
      <img src="/logo.svg" alt="" width="36" height="36" /><span>Brij<b>-IA</b></span>
    </Link>
  );
}

const SunMoon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>;

/** En-tête collant : logo, menu, langue, thème, « Me connecter » et « Essai gratuit ». Menu mobile en panneau. */
export default function Header() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const btn = useRef(null);
  useEffect(() => {
    const on = () => setStuck(window.scrollY > 8);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); if (btn.current) btn.current.focus(); } };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);
  const links = [['#fonctions', t('Fonctions')], ['#modules', t('Modules')], ['#tarifs', t('Tarifs')], ['#faq', t('Questions')], ['#contact', t('Contact')]];
  const close = () => setOpen(false);
  return (
    <>
      <a className="vt-skip" href="#contenu">{t('Aller au contenu')}</a>
      <header className={'vt-header' + (stuck ? ' is-stuck' : '')}>
        <div className="vt-wrap vt-bar">
          <VtLogo />
          <nav className="vt-nav" aria-label={t('Navigation principale')}>
            {links.map(([h, l]) => <a key={h} href={h}>{l}</a>)}
          </nav>
          <div className="vt-actions">
            <span className="vt-desk"><LangSwitch /></span>
            <button type="button" className="vt-iconbtn vt-desk" aria-label={t('Changer le thème clair ou sombre')} onClick={toggleTheme}><SunMoon /></button>
            <Link className="vt-btn vt-btn--secondary vt-btn--sm vt-desk" to="/connexion">{t('Me connecter')}</Link>
            <Link className="vt-btn vt-btn--primary vt-btn--sm vt-cta-head" to="/inscription">{t('Essai gratuit')}</Link>
            <button ref={btn} type="button" className="vt-iconbtn vt-burger" aria-expanded={open} aria-controls="vt-panel" aria-label={open ? t('Fermer le menu') : t('Ouvrir le menu')} onClick={() => setOpen(!open)}>
              <Fa name={open ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
        <div className={'vt-panel' + (open ? ' is-open' : '')} id="vt-panel">
          {links.map(([h, l]) => <a key={h} className="vt-pl" href={h} onClick={close}>{l}</a>)}
          <div className="vt-prow">
            <LangSwitch />
            <button type="button" className="vt-iconbtn" aria-label={t('Changer le thème clair ou sombre')} onClick={toggleTheme}><SunMoon /></button>
          </div>
          <div className="vt-prow">
            <Link className="vt-btn vt-btn--secondary" to="/connexion" onClick={close}>{t('Me connecter')}</Link>
            <Link className="vt-btn vt-btn--primary" to="/inscription" onClick={close}>{t('Essai gratuit')}</Link>
          </div>
        </div>
      </header>
    </>
  );
}
