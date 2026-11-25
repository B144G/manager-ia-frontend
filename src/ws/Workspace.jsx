import './icons.js';
import wsStyles from './wsStyles.js';
import { Component, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InstallPrompt from '../components/InstallPrompt.jsx';
import { useT } from '../lib/i18n.jsx';
import { tsrv } from '../lib/srv.js';
import AccountSecurity from './AccountSecurity.jsx';
import { FeedbackPanel } from './Feedback.jsx';
import AIPanel from './AIPanel.jsx';
import UserNotices from './UserNotices.jsx';
import SecurityNudge from '../privacy/SecurityNudge.jsx';
import { hasModule, moduleComponent } from './registry.js';
import { Empty, Form, Icon, Loading } from './ui.jsx';
import { GuideProvider } from './guide/GuideContext.jsx';
import { setActiveOrg, setPrefs, usePrefs } from '../lib/prefs.js';
import { brandHide, brandOrder, setBrand, useBrand } from '../lib/brand.js';
import { BottomNav, Footer, Sidebar, TopBar } from './shell/Frame.jsx';
import Palette from './shell/Palette.jsx';
import Personalize, { sortMods } from './shell/Personalize.jsx';
import { bindPalette } from './shell/screens.js';
import { WsProvider, useWs } from './WsContext.jsx';
// Espaces par rôle (réglage d'entreprise) : nouvelle navigation, active seulement si le serveur renvoie info.spaces.enabled.
import { SpaceChooser, SpaceDenied, SpaceDock, SpaceHome, SpaceSidebar, SpacesNotice, VisitorBanner, VisitorGuard, resolveSpaces } from './spaces/SpaceFrame.jsx';
import { Navigate } from 'react-router-dom';
import { getLastSpace, setLastSpace as saveLastSpace } from './spaces/lastSpace.js';
import { useChatUnread } from './parts/chat/unread.js';
const ChatBeacon = lazy(() => import('./parts/chat/Beacon.jsx')); // position en direct (si activée) et pastille « non lus » du chat

/** Espace de travail : connexion vérifiée, choix de l'organisation, menu des sous-applications, assistant IA. */
export default function Workspace() {
  useLayoutEffect(() => { // styles de l'espace de travail (chargés avec lui)
    const els = wsStyles.map((css) => { const el = document.createElement('style'); el.setAttribute('data-mia', 'ws-app'); el.textContent = css; document.head.appendChild(el); return el; });
    return () => els.forEach((e) => e.remove());
  }, []);
  useEffect(() => () => setBrand(null), []); // en quittant l'espace de travail : affichage d'origine (la marque de l'entreprise est posée au chargement de l'organisation)
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
  return <><Shell /><InstallPrompt /><SecurityNudge /></>;
}

const Center = ({ children }) => (
  <div className="ws-center"><Link className="logo" to="/">MABAH</Link>{children}</div>
);

/** Premier pas : créer son organisation ou rejoindre celle d'un collègue avec un code. */
function Onboarding() {
  const { user, api, loadOrg, onboarding, setOnboarding, orgs, logout, firstName } = useWs();
  const t = useT();
  const go = (j) => loadOrg(j.id, 'dashboard');
  // Entreprise qui vient d'être créée : l'assistant de configuration s'ouvre (étapes facultatives).
  const created = (j) => { try { sessionStorage.setItem('mabah.ent.wizard.' + j.id, '1'); } catch { /* navigation privée */ } return loadOrg(j.id, 'entreprise'); };
  return (
    <Center>
      <div className="ws-card">
        <UserNotices orgId={null} />
        <h1>{user ? t('Bienvenue, {name}', { name: firstName() }) : t('Bienvenue')}</h1>
        <p className="muted">{t("Créez votre organisation (entreprise, boutique, association, équipe…) ou rejoignez celle d'un collègue avec un code d'invitation.")}</p>
        <div className="ws-cols">
          <div className="ws-sub">
            <h2>{t('Créer mon organisation')}</h2>
            <Form submitText={t('Créer')} onSubmit={(v) => api('POST', '/orgs', v).then(created)} fields={[
              { k: 'name', label: t('Nom'), required: true, placeholder: 'Boutique Awa' },
              { k: 'sector', label: t("Secteur d'activité"), placeholder: t('Commerce, restauration, services…') },
              { k: 'description', label: t('Décrivez votre activité'), type: 'textarea', rows: 3, hint: t("L'IA s'en sert pour mieux vous conseiller.") },
              { k: 'currency', label: t('Monnaie'), value: 'FCFA' },
              { k: 'associationCode', label: t("Code d'association (facultatif)"), placeholder: 'ASSO-XXXXXX-…', hint: t("Pour une filiale ou un site : collez le code donné par la direction générale. L'organisation rejoint alors l'entreprise.") },
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
  const openFeedback = () => modal(t('Votre avis'), () => <FeedbackPanel orgId={orgId} />, { wide: true });
  const main = useRef(null);
  // ----- Espaces par rôle : si l'entreprise les a activés, le menu général est remplacé par le menu de l'espace courant (voir ./spaces). -----
  const spaces = ws.spaces; // null = ancien menu général
  const [lastSpace, setLastSpace] = useState(() => getLastSpace(orgId, info.me.userId));
  const sr = spaces ? resolveSpaces(spaces, route, lastSpace) : null;
  const allMods = spaces ? spaces.spaces.flatMap((s) => s.modules) : null;
  const cb = useBrand();
  // Ordre et visibilité choisis par l'entreprise (marque), puis ordre personnel ; dans un espace, on part des modules de l'espace.
  const baseMods = (spaces ? (sr.cur ? sr.cur.modules : []) : info.modules).filter((m) => hasModule(m.id));
  const mods = brandHide(sortMods(brandOrder(baseMods, cb), p.order), cb);
  let cur = route ? route.mod : 'dashboard';
  if (!spaces && !mods.some((m) => m.id === cur)) cur = 'dashboard';
  const Mod = moduleComponent(spaces ? (sr.kind === 'module' ? cur : 'dashboard') : cur);
  const curMod = mods.find((m) => m.id === cur);
  const canBrand = ws.can('admin');
  const homeSpace = spaces ? (spaces.landing || (spaces.spaces[0] && spaces.spaces[0].id)) : null; // « Retour à mon espace »
  useEffect(() => { if (sr && sr.cur) { setLastSpace(sr.cur.id); saveLastSpace(orgId, info.me.userId, sr.cur.id); } }, [sr && sr.cur && sr.cur.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Le dernier espace ouvert est mémorisé côté serveur (d'un appareil à l'autre) quand la personne ouvre l'accueil d'un espace.
  useEffect(() => { if (spaces && route && route.mod === 'home' && sr.cur && spaces.last !== sr.cur.id) ws.oapi('PUT', '/spaces/last', { space: sr.cur.id }).catch(() => {}); }, [spaces && route && route.mod === 'home' ? route.sub : '']); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!spaces) return undefined; document.body.classList.add('sp-merged'); return () => document.body.classList.remove('sp-merged'); }, [Boolean(spaces)]); // eslint-disable-line react-hooks/exhaustive-deps
  const visitor = Boolean(sr && sr.visitor);
  useEffect(() => { ws.setReadOnly(visitor); return () => ws.setReadOnly(false); }, [visitor]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const chatUnread = useChatUnread();
  const badgeOf = (id) => (id === 'support' ? tickets : id === 'alerts' ? alerts : id === 'chat' ? chatUnread : 0);
  const onOrg = (e) => { const v = e.target.value; if (v === 'new') ws.setOnboarding({ code: '' }); else loadOrg(Number(v), 'dashboard'); };

  return (
    <GuideProvider openNav={setNavOpen}>
    <div className={'ws-shell app' + (navOpen ? ' nav-open' : '')}>
      <a className="skip-link" href="#ws-main">{t('Aller au contenu')}</a>
      <div className="ws-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
      {spaces ? (
        <SpaceSidebar cur={sr.cur} curMod={cur === 'home' ? 'home' : cur} orgId={orgId} orgs={orgs} info={info} user={user} badgeOf={badgeOf} initials={ws.initials} onOrg={onOrg} onClose={() => setNavOpen(false)}
          onSecurity={openSecurity} onLogout={logout} onPersonalize={personalize} mini={p.navMini} onMini={() => setPrefs({ navMini: !p.navMini })} />
      ) : (
      <Sidebar mods={mods} cur={cur} orgId={orgId} orgs={orgs} info={info} user={user} badgeOf={badgeOf} initials={ws.initials} onOrg={onOrg} onClose={() => setNavOpen(false)}
        onSecurity={openSecurity} onLogout={logout} onPersonalize={personalize} mini={p.navMini} onMini={() => setPrefs({ navMini: !p.navMini })} members={info.limits.membersUsed} />
      )}
      <div className="ws-col app-col">
        <TopBar spaceTitle={spaces && sr.cur ? tsrv(sr.cur.title) : ''} modTitle={spaces && cur === 'home' ? t('Tableau de bord') : curMod ? t(curMod.title) : ''} navOpen={navOpen} onNav={() => setNavOpen(!navOpen)} onAsk={askAI} orgId={orgId} bell={bell} user={user}
          role={t(info.me.roleLabel)} initials={ws.initials} onSecurity={openSecurity} onPersonalize={personalize} />
        <UserNotices orgId={orgId} />
        {spaces ? <SpacesNotice orgId={orgId} userId={user && user.id} fallback={spaces.fallback} /> : null}
        <Suspense fallback={null}><ChatBeacon /></Suspense>
        <main className="ws-main" id="ws-main" ref={main} tabIndex={-1}>
          <div className="ws-mod" key={`${orgId}-${cur}-${route ? route.sub : ''}-${refreshKey}`}>
            {spaces ? (
              <SpaceBody sr={sr} spaces={spaces} cur={cur} orgId={orgId} homeSpace={homeSpace} Mod={Mod} />
            ) : (
              <Suspense fallback={<Loading />}><ModBoundary><Mod /></ModBoundary></Suspense>
            )}
          </div>
        </main>
        <Footer orgId={orgId} onFeedback={openFeedback} />
        {spaces ? <SpaceDock spaces={spaces} cur={sr.cur} kind={sr.kind} orgId={orgId} onMenu={() => setNavOpen(true)} onAi={() => setAiOpen(!aiOpen)} alerts={bell} /> : null}
      </div>
      <AIPanel mod={AI_MODULES.has(cur) ? cur : 'general'} />
      <button className="ws-fab" id="aiBtn" type="button" onClick={() => setAiOpen(!aiOpen)}><Icon name="ai" /><span>{t('Assistant IA')}</span></button>
      {spaces ? null
        : <BottomNav mods={mods} cur={cur} orgId={orgId} onMenu={() => setNavOpen(true)} onAi={() => setAiOpen(!aiOpen)} alerts={bell} />}
      {palette ? <Palette mods={spaces ? allMods.filter((m, i, a) => hasModule(m.id) && a.findIndex((x) => x.id === m.id) === i) : mods} spaces={spaces} curSpace={sr && sr.cur} orgId={orgId} onClose={() => setPalette(false)} onPersonalize={personalize} onAsk={askAI} /> : null}
    </div>
    </GuideProvider>
  );
}

/** Contenu en mode « Espaces par rôle » : choix de l'espace, accueil de l'espace, écran d'un module (avec bandeau visiteur) ou refus clair. */
function SpaceBody({ sr, spaces, cur, orgId, homeSpace, Mod }) {

  if (sr.kind === 'choose') return <SpaceChooser spaces={spaces} orgId={orgId} />;
  if (sr.kind === 'home') return <SpaceHome space={sr.cur} orgId={orgId} />;
  if (cur === 'dashboard' && !(sr.cur && sr.cur.id === 'direction')) return <Navigate to={`/app/${orgId}/home/${homeSpace || ''}`} replace />; // plus de tableau de bord général
  if (sr.kind === 'denied') return <SpaceDenied orgId={orgId} home={homeSpace} />;
  return (
    <>
      {sr.visitor ? <VisitorBanner space={sr.cur} orgId={orgId} home={homeSpace} /> : null}
      <VisitorGuard on={sr.visitor} key={cur}>
        <Suspense fallback={<Loading />}><ModBoundary><Mod /></ModBoundary></Suspense>
      </VisitorGuard>
    </>
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
