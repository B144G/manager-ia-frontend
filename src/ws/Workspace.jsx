import { Component, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InstallPrompt from '../components/InstallPrompt.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { useT } from '../lib/i18n.jsx';
import AccountSecurity from './AccountSecurity.jsx';
import AIPanel from './AIPanel.jsx';
import { MODULE_ICONS, hasModule, moduleComponent } from './registry.js';
import { Empty, Form, Icon, Loading } from './ui.jsx';
import { WsProvider, useWs } from './WsContext.jsx';

/** Espace de travail : connexion vérifiée, choix de l'organisation, menu des sous-applications, assistant IA. */
export default function Workspace() {
  return <WsProvider><Gate /></WsProvider>;
}

function Gate() {
  const ws = useWs();
  const t = useT();
  useEffect(() => {
    // « Installer l'application » (PWA) : enregistrement du service worker
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  if (ws.booting) return <p className="ws-boot">{t('Chargement…')}</p>;
  if (ws.onboarding) return <Onboarding />;
  if (!ws.info) return <p className="ws-boot">{t('Chargement…')}</p>;
  return <><Shell /><InstallPrompt /></>;
}

const Center = ({ children }) => (
  <div className="ws-center"><Link className="logo" to="/">Brij<b>-IA</b></Link>{children}</div>
);

/** Premier pas : créer son organisation ou rejoindre celle d'un collègue avec un code. */
function Onboarding() {
  const { user, api, loadOrg, onboarding, setOnboarding, orgs, logout, firstName } = useWs();
  const t = useT();
  const go = (j) => loadOrg(j.id, 'dashboard');
  return (
    <Center>
      <div className="ws-card">
        <h1>{user ? t('Bienvenue, {name}', { name: firstName() }) : t('Bienvenue')}</h1>
        <p className="muted">{t("Créez votre organisation (entreprise, boutique, association, équipe…) ou rejoignez celle d'un collègue avec un code d'invitation.")}</p>
        <div className="ws-cols">
          <div className="ws-sub">
            <h2>{t('Créer mon organisation')}</h2>
            <Form submitText={t('Créer')} onSubmit={(v) => api('POST', '/orgs', v).then(go)} fields={[
              { k: 'name', label: t('Nom'), required: true, placeholder: 'Boutique Awa' },
              { k: 'sector', label: t("Secteur d'activité"), placeholder: t('Commerce, restauration, services…') },
              { k: 'description', label: t('Décrivez votre activité'), type: 'textarea', rows: 3, hint: t("L'IA s'en sert pour mieux vous conseiller.") },
              { k: 'currency', label: t('Monnaie'), value: 'FCFA' },
            ]} />
          </div>
          <div className="ws-sub">
            <h2>{t('Rejoindre avec un code')}</h2>
            <Form submitText={t('Rejoindre')} onSubmit={(v) => api('POST', '/orgs/join', v).then(go)} fields={[{ k: 'code', label: t("Code d'invitation"), required: true, value: (onboarding && onboarding.code) || '' }]} />
          </div>
        </div>
        {orgs.length ? <p className="small"><button className="link" type="button" onClick={() => setOnboarding(null)}>{t('← Retour à mon espace')}</button></p> : null}
        <p className="small"><button className="link" type="button" onClick={logout}>{t('Me déconnecter')}</button></p>
      </div>
    </Center>
  );
}

// Sous-applications qui ont leur propre discussion avec l'IA (le serveur les connaît) ; les autres (comptabilité, abonnement, intégrations) utilisent la discussion générale.
const AI_MODULES = new Set(['support', 'projects', 'budget', 'stock', 'crm', 'hr', 'sales', 'structure', 'processes', 'team', 'alerts']);

/** Coque : menu, barre du haut, module affiché, panneau de l'IA. */
function Shell() {
  const ws = useWs();
  const t = useT();
  const { user, orgs, orgId, info, dash, route, aiOpen, setAiOpen, askAI, logout, loadOrg, refreshKey, refreshBadges, setOrgs, modal } = ws;
  const openSecurity = () => modal(t('Sécurité du compte'), () => <AccountSecurity />, { wide: true });
  const shell = useRef(null);
  const main = useRef(null);
  const mods = info.modules.filter((m) => hasModule(m.id));
  let cur = route ? route.mod : 'dashboard';
  if (!mods.some((m) => m.id === cur)) cur = 'dashboard';
  const Mod = moduleComponent(cur);

  // Menu : barre latérale fixe sur grand écran (≥ 1100 px), tiroir qui glisse depuis la gauche sur tablette et téléphone.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [cur, orgId]);
  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen);
    if (!navOpen) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); document.body.classList.remove('nav-open'); };
  }, [navOpen]);
  useEffect(() => { const big = () => { if (window.innerWidth >= 1100) setNavOpen(false); }; window.addEventListener('resize', big); return () => window.removeEventListener('resize', big); }, []);
  useEffect(() => { document.body.classList.toggle('ai-open', aiOpen); return () => document.body.classList.remove('ai-open'); }, [aiOpen]);
  useEffect(() => { if (main.current) main.current.scrollTop = 0; window.scrollTo(0, 0); }, [cur, orgId]);
  useEffect(() => { refreshBadges(); }, [cur, refreshKey, refreshBadges]);
  useEffect(() => { // petite mise à jour des organisations (ex. nouvelle organisation créée)
    if (orgs.some((o) => o.id === orgId)) return;
    ws.api('GET', '/orgs').then((j) => setOrgs(j.orgs), () => {});
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tickets = dash ? dash.stats.tickets.open : 0;
  const alerts = dash ? dash.alerts.filter((a) => a.level !== 'info').length : 0;
  const bell = dash ? dash.alerts.filter((a) => a.level === 'high').length : 0;
  const badgeOf = (id) => (id === 'support' ? tickets : id === 'alerts' ? alerts : 0);
  const initialsOf = ws.initials;

  const link = (m) => {
    const n = badgeOf(m.id);
    return (
      <Link key={m.id} to={`/app/${orgId}/${m.id}`} className={m.id === cur ? 'on' : ''} aria-current={m.id === cur ? 'page' : undefined}>
        <Icon name={MODULE_ICONS[m.id] || m.id} /><span className="nl">{t(m.title)}</span>
        <span className="nbadge" hidden={!n}>{n}</span>
      </Link>
    );
  };
  const mainMods = mods.filter((m) => m.id !== 'alerts'), alertMod = mods.filter((m) => m.id === 'alerts');
  const members = info.limits.membersUsed;

  return (
    <div className={'ws-shell' + (navOpen ? ' nav-open' : '')} ref={shell}>
      <div className="ws-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
      <aside className="ws-side" id="ws-side" aria-label={t('Menu principal')}>
        <div className="ws-side-h"><Link className="logo" to="/">Brij<b>-IA</b></Link><button type="button" className="ws-close" aria-label={t('Fermer le menu')} onClick={() => setNavOpen(false)}>×</button></div>
        <div className="ws-org">
          <span className="av">{initialsOf(info.org.name)}</span>
          <div>
            <select className="org-sel" aria-label={t('Organisation')} value={orgId} onChange={(e) => { const v = e.target.value; if (v === 'new') ws.setOnboarding({ code: '' }); else loadOrg(Number(v), 'dashboard'); }}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              <option value="new">{t('+ Nouvelle organisation / rejoindre')}</option>
            </select>
            <small>{(info.org.sector ? info.org.sector + ' · ' : '') + (members > 1 ? t('{n} personnes', { n: members }) : t('{n} personne', { n: members }))}</small>
          </div>
        </div>
        <LangSwitch className="ws-lang ws-lang-side" />
        <div className="ws-label">{t('MON ESPACE')}</div>
        <nav className="ws-nav" aria-label={t('Sous-applications')}>{mainMods.map(link)}{alertMod.length ? <><hr />{alertMod.map(link)}</> : null}</nav>
        <div className="ws-me">
          <span className="av gold">{initialsOf(user && user.name)}</span>
          <div><b>{user ? user.name : ''}</b><small>{t(info.me.roleLabel)}</small></div>
          <button type="button" className="out" title={t('Sécurité du compte')} aria-label={t('Sécurité du compte')} onClick={openSecurity}><Icon name="shield" /></button>
          <button type="button" className="out" title={t('Me déconnecter')} aria-label={t('Me déconnecter')} onClick={logout}><Icon name="out" /></button>
        </div>
      </aside>
      <div className="ws-col">
        <header className="ws-top2">
          <button type="button" className="ws-burger" aria-label={t('Ouvrir le menu')} aria-expanded={navOpen} aria-controls="ws-side" onClick={() => setNavOpen(!navOpen)}>
            <svg viewBox="0 0 24 24" className="ic" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <AskBar onAsk={askAI} />
          <span className="grow" />
          <LangSwitch className="ws-lang ws-lang-top" />
          <Link className="bell" to={`/app/${orgId}/alerts`} aria-label={t('Alertes')}><Icon name="alerts" /><i className="dot" hidden={!bell} /></Link>
          <div className="ws-user" role="button" tabIndex={0} title={t('Sécurité du compte')} style={{ cursor: 'pointer' }} onClick={openSecurity} onKeyDown={(e) => { if (e.key === 'Enter') openSecurity(); }}><span className="av">{initialsOf(user && user.name)}</span><div><b>{user ? user.name : ''}</b><small>{t(info.me.roleLabel)}</small></div></div>
        </header>
        <main className="ws-main" id="ws-main" ref={main}>
          <div className="ws-mod" key={`${orgId}-${cur}-${refreshKey}`}>
            <Suspense fallback={<Loading />}><ModBoundary><Mod /></ModBoundary></Suspense>
          </div>
        </main>
      </div>
      <AIPanel mod={AI_MODULES.has(cur) ? cur : 'general'} />
      <button className="ws-fab" type="button" id="aiBtn" onClick={() => setAiOpen(!aiOpen)}><Icon name="ai" /><span>{t('Assistant IA')}</span></button>
    </div>
  );
}

function AskBar({ onAsk }) {
  const t = useT();
  const ref = useRef(null);
  return (
    <form className="ws-ask" onSubmit={(ev) => { ev.preventDefault(); const q = ref.current.value.trim(); if (q) { ref.current.value = ''; onAsk(q); } }}>
      <Icon name="ai" />
      <input ref={ref} type="text" placeholder={window.innerWidth < 640 ? t('Demandez à Brij-IA…') : t("Demandez à Brij-IA : « Quels sont les problèmes urgents aujourd'hui ? »")} aria-label={t('Demandez à Brij-IA')} autoComplete="off" />
    </form>
  );
}

/** Une erreur dans une sous-application ne doit pas faire tomber tout l'espace. */
class ModBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error(err); } // eslint-disable-line no-console
  render() { return this.state.err ? <ModError err={this.state.err} /> : this.props.children; }
}

function ModError({ err }) {
  const t = useT();
  return <Empty text={t("Cette partie n'a pas pu s'afficher : {msg}", { msg: err.message })} />;
}
