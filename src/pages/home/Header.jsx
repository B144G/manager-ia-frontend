import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/Logo.jsx';
import { toggleTheme } from '../../lib/theme.js';

/** Bandeau d'annonce + barre de navigation (thème, menu mobile, ombre au défilement). */
export default function Header() {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const on = () => setStuck(window.scrollY > 8);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const close = (e) => { if (e.target.tagName === 'A') setOpen(false); };
  return (
    <>
      <a className="skip" href="#haut">Aller au contenu</a>
      <div className="s-ann">Nouveau : comptabilité simple, relances WhatsApp, Messenger et Instagram.<a href="#modules">Découvrir</a></div>
      <header className={'s-nav' + (stuck ? ' stuck' : '')} id="top"><div className="s-wrap">
        <Logo />
        <nav className={'s-links' + (open ? ' open' : '')} id="nav" aria-label="Navigation principale" onClick={close}>
          <a href="#modules">Modules</a><a href="#offres">Tarifs</a><a href="#faq">FAQ</a><a href="#contact">Contact</a>
        </nav>
        <div className="s-act">
          <button className="s-icon" id="theme" type="button" aria-label="Changer le thème clair ou sombre" onClick={toggleTheme}><svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg></button>
          <Link className="s-btn login" to="/connexion">Se connecter</Link>
          <Link className="s-btn pri" to="/inscription">Essayer gratuitement</Link>
          <button className="s-icon" id="burger" type="button" aria-label="Ouvrir le menu" aria-expanded={open} aria-controls="nav" onClick={() => setOpen(!open)}><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
        </div>
      </div></header>
    </>
  );
}
