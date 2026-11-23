import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import LangSwitch from '../../components/LangSwitch.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Icon } from '../../lib/fa.jsx';
import { toggleFavorite, usePrefs } from '../../lib/prefs.js';
import { assetUrl, useBrand } from '../../lib/brand.js';
import { MODULE_ICONS } from '../registry.js';
import { FeedbackLink } from '../Feedback.jsx';
import { GuideButton } from '../guide/GuideContext.jsx';
import { useScreens, openPalette } from './screens.js';

/* Éléments du cadre d'application : barre latérale, en-tête (fil d'Ariane, recherche, actions), pied de page, barre de navigation basse (téléphone). */

export function BrandMark({ brand }) {
  const cb = useBrand(); // logo de l'entreprise (réglé par l'administrateur) ; à défaut, celui choisi sur cet appareil, puis le logo d'origine
  if (cb.logoUrl) return <img className="app-logo-img" src={assetUrl(cb.logoUrl)} alt="" />;
  if (brand && brand.logo) return <img className="app-logo-img" src={brand.logo} alt="" />;
  return <img className="app-logo-img" src="/favicon.svg" alt="" />;
}

export function Sidebar({ mods, cur, orgId, orgs, info, user, badgeOf, initials, onOrg, onClose, onSecurity, onLogout, onPersonalize, mini, onMini, members }) {
  const t = useT();
  const p = usePrefs();
  const brand = p.brand[orgId];
  const cb = useBrand();
  const named = cb.customized && (cb.mode !== 'brij' || cb.logoUrl); // nom et/ou logo de l'entreprise à la place de « Brij-IA »
  const fav = mods.filter((m) => p.favorites.includes(m.id));
  const rest = mods.filter((m) => !p.favorites.includes(m.id));
  const link = (m) => {
    const n = badgeOf(m.id);
    const on = p.favorites.includes(m.id);
    return (
      <li key={m.id} className="app-li">
        <Link to={`/app/${orgId}/${m.id}`} className={m.id === cur ? 'on' : ''} aria-current={m.id === cur ? 'page' : undefined} title={mini ? t(m.title) : undefined}>
          <Icon name={MODULE_ICONS[m.id] || m.id} fixedWidth /><span className="nl">{t(m.title)}</span>
          {n ? <span className="nbadge">{n}</span> : null}
        </Link>
        <button type="button" className={'app-star' + (on ? ' on' : '')} aria-pressed={on} aria-label={t('Favori : {m}', { m: t(m.title) })} onClick={() => toggleFavorite(m.id)}><Icon name={on ? 'star' : 'star-o'} /></button>
      </li>
    );
  };
  return (
    <aside className="app-side" id="ws-side" aria-label={t('Menu principal')}>
      <div className="app-side-h">
        <Link className="app-logo" to="/" aria-label={cb.customized && cb.mode !== 'brij' ? cb.name : 'Brij-IA'}><BrandMark brand={brand} /><span className="app-logo-t">{cb.customized && cb.mode !== 'brij' ? cb.name : brand && brand.logo ? info.org.name : cb.logoUrl && named ? info.org.name : <>Brij<b>-IA</b></>}</span></Link>
        <button type="button" className="ws-close app-x" aria-label={t('Fermer le menu')} onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="ws-org">
        <span className="av">{initials(info.org.name)}</span>
        <div>
          <select className="org-sel" aria-label={t('Organisation')} value={orgId} onChange={onOrg}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            <option value="new">{t('+ Nouvelle organisation / rejoindre')}</option>
          </select>
          <small>{(info.org.sector ? info.org.sector + ' · ' : '') + (members > 1 ? t('{n} personnes', { n: members }) : t('{n} personne', { n: members }))}</small>
        </div>
      </div>
      <button type="button" className="app-find" onClick={openPalette} aria-label={t('Rechercher un écran…')}><Icon name="search" /><span>{t('Rechercher un écran…')}</span><kbd>Ctrl K</kbd></button>
      <nav className="ws-nav" aria-label={t('Sous-applications')}>
        {fav.length ? <><div className="ws-label">{t('FAVORIS')}</div><ul>{fav.map(link)}</ul></> : null}
        <div className="ws-label">{t('MON ESPACE')}</div>
        <ul>{rest.map(link)}</ul>
      </nav>
      <div className="app-side-f">
        <button type="button" className="app-mini-btn" onClick={onMini} aria-pressed={mini} aria-label={mini ? t('Agrandir le menu') : t('Réduire le menu')}><Icon name={mini ? 'right' : 'left'} /><span>{t('Réduire le menu')}</span></button>
        <div className="ws-me">
          <span className="av gold">{initials(user && user.name)}</span>
          <div><b>{user ? user.name : ''}</b><small>{t(info.me.roleLabel)}</small></div>
          <button type="button" className="out" title={t('Personnaliser l\'affichage')} aria-label={t('Personnaliser l\'affichage')} onClick={onPersonalize}><Icon name="brand" /></button>
          <button type="button" className="out" title={t('Sécurité du compte')} aria-label={t('Sécurité du compte')} onClick={onSecurity}><Icon name="shield" /></button>
          <button type="button" className="out" title={t('Me déconnecter')} aria-label={t('Me déconnecter')} onClick={onLogout}><Icon name="out" /></button>
        </div>
      </div>
    </aside>
  );
}

/** En-tête : bouton menu, fil d'Ariane, question à l'IA, outils. */
export function TopBar({ modTitle, navOpen, onNav, onAsk, orgId, bell, user, role, initials, onSecurity, onPersonalize }) {
  const t = useT();
  const sc = useScreens();
  const cur = sc.items.find((i) => i.id === sc.active);
  const crumbs = [modTitle].concat(cur && sc.title === modTitle ? [cur.group, cur.label] : []).filter(Boolean);
  return (
    <header className="app-top ws-top2">
      <button type="button" className="app-burger ws-burger" aria-label={t('Ouvrir le menu')} aria-expanded={navOpen} aria-controls="ws-side" onClick={onNav}><Icon name="menu" /></button>
      <nav className="app-crumb" aria-label={t("Fil d'Ariane")}>
        <ol>{crumbs.map((c, i) => <li key={i} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c}</li>)}</ol>
      </nav>
      <AskBar onAsk={onAsk} />
      <span className="grow" />
      <button type="button" className="ui-btn ghost icon-only app-find-top" onClick={openPalette} aria-label={t('Rechercher un écran…')} title="Ctrl K"><Icon name="search" /></button>
      <GuideButton />
      <LangSwitch className="ws-lang ws-lang-top" />
      <Link className="bell" to={`/app/${orgId}/alerts`} aria-label={t('Alertes')}><Icon name="alerts" /><i className="dot" hidden={!bell} /></Link>
      <button type="button" className="ui-btn ghost icon-only" onClick={onPersonalize} aria-label={t('Personnaliser l\'affichage')} title={t('Personnaliser l\'affichage')}><Icon name="brand" /></button>
      <div className="ws-user" role="button" tabIndex={0} title={t('Sécurité du compte')} onClick={onSecurity} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSecurity(); } }}><span className="av">{initials(user && user.name)}</span><div><b>{user ? user.name : ''}</b><small>{role}</small></div></div>
    </header>
  );
}

function AskBar({ onAsk }) {
  const t = useT();
  const ref = useRef(null);
  return (
    <form className="ws-ask" role="search" onSubmit={(ev) => { ev.preventDefault(); const q = ref.current.value.trim(); if (q) { ref.current.value = ''; onAsk(q); } }}>
      <Icon name="ai" />
      <input ref={ref} type="text" placeholder={t('Demandez à Brij-IA…')} aria-label={t('Demandez à Brij-IA')} autoComplete="off" />
    </form>
  );
}

export function Footer({ orgId, onFeedback }) {
  const t = useT();
  const cb = useBrand();
  const own = cb.customized && cb.mode !== 'brij'; // marque de l'entreprise : son nom, son texte de pied de page, « Propulsé par Brij-IA » si elle le souhaite
  return (
    <footer className="app-foot">
      <span>© {new Date().getFullYear()} {own ? cb.name : 'Brij-IA'}{own && cb.footerText ? ' · ' + cb.footerText : ''}{own && cb.poweredBy ? <small className="muted"> · {t('Propulsé par {name}', { name: cb.platformName })}</small> : null}</span>
      <nav aria-label={t('Informations légales')}>
        <Link to="/confidentialite">{t('Confidentialité')}</Link>
        <Link to="/conditions">{t('Conditions')}</Link>
        {own ? <Link to="/mentions-legales">{t('Mentions légales')}</Link> : null}
        <Link to={`/app/${orgId}/support`}>{t('Aide et support')}</Link>
        {onFeedback ? <FeedbackLink onClick={onFeedback} /> : null}
      </nav>
      <span className="app-foot-r"><Icon name="shield" /> {t('Données protégées')} · <span className="mono">v2</span></span>
    </footer>
  );
}

/** Barre basse (téléphone) : accueil, deux favoris (ou projets/ventes), alertes, menu. */
export function BottomNav({ mods, cur, orgId, onMenu, onAi, alerts }) {
  const t = useT();
  const p = usePrefs();
  const ids = [...p.favorites, 'projects', 'sales', 'stock', 'budget'].filter((id, i, a) => id !== 'dashboard' && a.indexOf(id) === i && mods.some((m) => m.id === id)).slice(0, 2);
  const items = ['dashboard', ...ids].map((id) => mods.find((m) => m.id === id)).filter(Boolean);
  useEffect(() => { document.body.classList.add('has-bottom'); return () => document.body.classList.remove('has-bottom'); }, []);
  return (
    <nav className="app-bottom" aria-label={t('Navigation rapide')}>
      {items.map((m) => <Link key={m.id} to={`/app/${orgId}/${m.id}`} className={m.id === cur ? 'on' : ''} aria-current={m.id === cur ? 'page' : undefined}><Icon name={MODULE_ICONS[m.id] || m.id} /><span>{t(m.title)}</span></Link>)}
      <button type="button" onClick={onAi} className="ws-fab-b"><Icon name="ai" /><span>{t('Assistant IA')}</span></button>
      <button type="button" onClick={onMenu} aria-label={t('Ouvrir le menu')}><Icon name="menu" />{alerts ? <i className="dot" /> : null}<span>{t('Menu')}</span></button>
    </nav>
  );
}
