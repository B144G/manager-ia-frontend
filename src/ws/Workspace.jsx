import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InstallPrompt from '../components/InstallPrompt.jsx';
import { useT } from '../lib/i18n.jsx';
import AccountSecurity from './AccountSecurity.jsx';
import AIPanel from './AIPanel.jsx';
import UserNotices from './UserNotices.jsx';
import { hasModule, moduleComponent } from './registry.js';
import { Empty, Form, Icon, Loading } from './ui.jsx';
import { GuideProvider } from './guide/GuideContext.jsx';
import { setActiveOrg, setPrefs, usePrefs } from '../lib/prefs.js';
import { BottomNav, Footer, Sidebar, TopBar } from './shell/Frame.jsx';
import Palette from './shell/Palette.jsx';
import Personalize, { sortMods } from './shell/Personalize.jsx';
import { bindPalette } from './shell/screens.js';
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
        <UserNotices orgId={null} />
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

/** Cadre unique : barre latérale, en-tête (fil d'Ariane, recherche, outils), module affiché, pied de page, barre basse (téléphone), assistant IA. */
function Shell() {
  const ws = useWs();
  const t = useT();
  const p = usePrefs();
  const { user, orgs, orgId, info, dash, route, aiOpen, setAiOpen, askAI, logout, loadOrg, refreshKey, refreshBadges, setOrgs, modal } = ws;
  const openSecurity = () => modal(t('Sécurité du compte'), () => <AccountSecurity />, { wide: true });
  const main = useRef(null);
  const mods = sortMods(info.modules.filter((m) => hasModule(m.id)), p.order);
  let cur = route ? route.mod : 'dashboard';
  if (!mods.some((m) => m.id === cur)) cur = 'dashboard';
  const Mod = moduleComponent(cur);
  const curMod = mods.find((m) => m.id === cur);
  const canBrand = ws.can('admin');

  useEffect(() => { setActiveOrg(orgId); }, [orgId]);
  const personalize = useCallback(() => modal(t("Personnaliser l'affichage"), () => <Personalize mods={mods} orgId={orgId} orgName={info.org.name} canBrand={canBrand} />, { wide: true }), [modal, t, mods, orgId, info.org.name, canBrand]);
  const [palette, setPalette] = useState(false);
  useEffect(() => { bindPalette(() => setPalette(true)); return () => bindPalette(() => {}); }, []);
  useEffect(() => { // Ctrl K / Cmd K : recherche d'écran, partout dans l'application
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
  useEffect(() => { document.body.classList.toggle('nav-mini', p.navMini); return () => document.body.classList.remove('nav-mini'); }, [p.navMini]);
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
  const onOrg = (e) => { const v = e.target.value; if (v === 'new') ws.setOnboarding({ code: '' }); else loadOrg(Number(v), 'dashboard'); };

  return (
    <GuideProvider openNav={setNavOpen}>
    <div className={'ws-shell app' + (navOpen ? ' nav-open' : '')}>
      <a className="skip-link" href="#ws-main">{t('Aller au contenu')}</a>
      <div className="ws-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
      <Sidebar mods={mods} cur={cur} orgId={orgId} orgs={orgs} info={info} user={user} badgeOf={badgeOf} initials={ws.initials} onOrg={onOrg} onClose={() => setNavOpen(false)}
        onSecurity={openSecurity} onLogout={logout} onPersonalize={personalize} mini={p.navMini} onMini={() => setPrefs({ navMini: !p.navMini })} members={info.limits.membersUsed} />
      <div className="ws-col app-col">
        <TopBar orgName={info.org.name} modTitle={curMod ? t(curMod.title) : ''} navOpen={navOpen} onNav={() => setNavOpen(!navOpen)} onAsk={askAI} orgId={orgId} bell={bell} user={user}
          role={t(info.me.roleLabel)} initials={ws.initials} onSecurity={openSecurity} onPersonalize={personalize} />
        <UserNotices orgId={orgId} />
        <main className="ws-main" id="ws-main" ref={main} tabIndex={-1}>
          <div className="ws-mod" key={`${orgId}-${cur}-${refreshKey}`}>
            <Suspense fallback={<Loading />}><ModBoundary><Mod /></ModBoundary></Suspense>
          </div>
        </main>
        <Footer orgId={orgId} />
      </div>
      <AIPanel mod={AI_MODULES.has(cur) ? cur : 'general'} />
      <button className="ws-fab" id="aiBtn" type="button" onClick={() => setAiOpen(!aiOpen)}><Icon name="ai" /><span>{t('Assistant IA')}</span></button>
      <BottomNav mods={mods} cur={cur} orgId={orgId} onMenu={() => setNavOpen(true)} onAi={() => setAiOpen(!aiOpen)} alerts={bell} />
      {palette ? <Palette mods={mods} orgId={orgId} onClose={() => setPalette(false)} onPersonalize={personalize} onAsk={askAI} /> : null}
    </div>
    </GuideProvider>
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
