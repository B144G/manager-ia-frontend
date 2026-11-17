import { useLayoutEffect } from 'react';
import { Outlet } from 'react-router-dom';
// Les feuilles de style du site public, de l'espace de travail et du chat client se contredisent (mêmes noms de classes, variables différentes) :
// on n'active que celles du groupe de la page affichée, et on les retire en la quittant.
import tokens from '../styles/tokens.css?inline';
import base from '../styles/base.css?inline';
import ui from '../styles/ui.css?inline';
import style from '../styles/style.css?inline';
import home from '../styles/home.css?inline';
import site from '../styles/site.css?inline';
import authPlus from '../styles/auth-plus.css?inline';
import composer from '../styles/composer.css?inline';
import siteResponsive from '../styles/responsive-site.css?inline';
import chat from '../styles/chat.css?inline';

const DS = [tokens, base]; // jetons et base : communs à toutes les pages
const GROUPS = { site: [...DS, style, ui, home, site, composer, siteResponsive], auth: [...DS, style, ui, home, site, authPlus, composer, siteResponsive], ws: [...DS, style] /* le reste des styles de l'espace de travail est chargé avec lui (src/ws/wsStyles.js) */, chat: [...DS, chat], vitrine: [] /* la page de présentation charge elle-même sa feuille (src/pages/Home.jsx) : hors du paquet principal */ };

/** Route « enveloppe » : charge le groupe de feuilles de style, règle la classe du <body>, puis affiche la page. */
export function StyleLayout({ group, body = '', mode }) {
  useLayoutEffect(() => {
    const els = GROUPS[group].map((css) => { const s = document.createElement('style'); s.setAttribute('data-mia', group); s.textContent = css; document.head.appendChild(s); return s; });
    document.body.className = body;
    if (mode) document.body.setAttribute('data-mode', mode); else document.body.removeAttribute('data-mode');
    return () => { els.forEach((e) => e.remove()); };
  }, [group, body, mode]);
  return <Outlet />; // les styles sont posés avant l'affichage (effet de mise en page), sans clignotement
}
