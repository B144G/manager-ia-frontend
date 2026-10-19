import { Component, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import InstallPrompt from '../components/InstallPrompt.jsx';
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
  useEffect(() => {
    // « Installer l'application » (PWA) : enregistrement du service worker
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  if (ws.booting) return <p className="ws-boot">Chargement…</p>;
  if (ws.onboarding) return <Onboarding />;
  if (!ws.info) return <p className="ws-boot">Chargement…</p>;
  return <><Shell /><InstallPrompt /></>;
}

const Center = ({ children }) => (
  <div className="ws-center"><Link className="logo" to="/">MANAGER<b>-IA</b></Link>{children}</div>
);

/** Premier pas : créer son organisation ou rejoindre celle d'un collègue avec un code. */
function Onboarding() {
  const { user, api, loadOrg, onboarding, setOnboarding, orgs, logout, firstName } = useWs();
  const go = (j) => loadOrg(j.id, 'dashboard');
  return (
    <Center>
      <div className="ws-card">
        <h1>Bienvenue{user ? ', ' + firstName() : ''}</h1>
        <p className="muted">Créez votre organisation (entreprise, boutique, association, équipe…) ou rejoignez celle d'un collègue avec un code d'invitation.</p>
        <div className="ws-cols">
          <div className="ws-sub">
            <h2>Créer mon organisation</h2>
            <Form submitText="Créer" onSubmit={(v) => api('POST', '/orgs', v).then(go)} fields={[
              { k: 'name', label: 'Nom', required: true, placeholder: 'Boutique Awa' },
              { k: 'sector', label: "Secteur d'activité", placeholder: 'Commerce, restauration, services…' },
              { k: 'description', label: 'Décrivez votre activité', type: 'textarea', rows: 3, hint: "L'IA s'en sert pour mieux vous conseiller." },
              { k: 'currency', label: 'Monnaie', value: 'FCFA' },
            ]} />
          </div>
          <div className="ws-sub">
            <h2>Rejoindre avec un code</h2>
            <Form submitText="Rejoindre" onSubmit={(v) => api('POST', '/orgs/join', v).then(go)} fields={[{ k: 'code', label: "Code d'invitation", required: true, value: (onboarding && onboarding.code) || '' }]} />
          </div>
        </div>
        {orgs.length ? <p className="small"><button className="link" type="button" onClick={() => setOnboarding(null)}>← Retour à mon espace</button></p> : null}
        <p className="small"><button className="link" type="button" onClick={logout}>Me déconnecter</button></p>
      </div>
    </Center>
  );
}

// Sous-applications qui ont leur propre discussion avec l'IA (le serveur les connaît) ; les autres (comptabilité, abonnement, intégrations) utilisent la discussion générale.
const AI_MODULES = new Set(['support', 'projects', 'budget', 'stock', 'crm', 'hr', 'sales', 'structure', 'processes', 'team', 'alerts']);

/** Coque : menu, barre du haut, module affiché, panneau de l'IA. */
function Shell() {
  const ws = useWs();
  const { user, orgs, orgId, info, dash, route, aiOpen, setAiOpen, askAI, logout, loadOrg, refreshKey, refreshBadges, setOrgs } = ws;
  const shell = useRef(null);
  const main = useRef(null);
  const mods = info.modules.filter((m) => hasModule(m.id));
  let cur = route ? route.mod : 'dashboard';
  if (!mods.some((m) => m.id === cur)) cur = 'dashboard';
  const Mod = moduleComponent(cur);

  // Mise en page : la structure de la maquette est gardée identique de 640 à 1400 px de large (réduite pour tenir) ; sous 640 px, version téléphone.
  useLayoutEffect(() => {
    const fit = () => {
      const w = window.innerWidth, z = w >= 640 && w < 1400 ? w / 1400 : 1;
      document.documentElement.style.setProperty('--z', String(z));
      if (shell.current) shell.current.style.zoom = z === 1 ? '' : String(z);
    };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
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
        <Icon name={MODULE_ICONS[m.id] || m.id} /><span className="nl">{m.title}</span>
        <span className="nbadge" hidden={!n}>{n}</span>
      </Link>
    );
  };
  const mainMods = mods.filter((m) => m.id !== 'alerts'), alertMod = mods.filter((m) => m.id === 'alerts');
  const members = info.limits.membersUsed;

  return (
    <div className="ws-shell" ref={shell}>
      <aside className="ws-side">
        <Link className="logo" to="/">MANAGER<b>-IA</b></Link>
        <div className="ws-org">
          <span className="av">{initialsOf(info.org.name)}</span>
          <div>
            <select className="org-sel" aria-label="Organisation" value={orgId} onChange={(e) => { const v = e.target.value; if (v === 'new') ws.setOnboarding({ code: '' }); else loadOrg(Number(v), 'dashboard'); }}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              <option value="new">+ Nouvelle organisation / rejoindre</option>
            </select>
            <small>{(info.org.sector ? info.org.sector + ' · ' : '') + members + ' personne' + (members > 1 ? 's' : '')}</small>
          </div>
        </div>
        <div className="ws-label">MON ESPACE</div>
        <nav className="ws-nav" aria-label="Sous-applications">{mainMods.map(link)}{alertMod.length ? <><hr />{alertMod.map(link)}</> : null}</nav>
        <div className="ws-me">
          <span className="av gold">{initialsOf(user && user.name)}</span>
          <div><b>{user ? user.name : ''}</b><small>{info.me.roleLabel}</small></div>
          <button type="button" className="out" title="Me déconnecter" aria-label="Me déconnecter" onClick={logout}><Icon name="out" /></button>
        </div>
      </aside>
      <div className="ws-col">
        <header className="ws-top2">
          <AskBar onAsk={askAI} />
          <span className="grow" />
          <Link className="bell" to={`/app/${orgId}/alerts`} aria-label="Alertes"><Icon name="alerts" /><i className="dot" hidden={!bell} /></Link>
          <div className="ws-user"><span className="av">{initialsOf(user && user.name)}</span><div><b>{user ? user.name : ''}</b><small>{info.me.roleLabel}</small></div></div>
        </header>
        <main className="ws-main" id="ws-main" ref={main}>
          <div className="ws-mod" key={`${orgId}-${cur}-${refreshKey}`}>
            <Suspense fallback={<Loading />}><ModBoundary><Mod /></ModBoundary></Suspense>
          </div>
        </main>
      </div>
      <AIPanel mod={AI_MODULES.has(cur) ? cur : 'general'} />
      <button className="ws-fab" type="button" id="aiBtn" onClick={() => setAiOpen(!aiOpen)}><Icon name="ai" /><span>Assistant IA</span></button>
    </div>
  );
}

function AskBar({ onAsk }) {
  const ref = useRef(null);
  return (
    <form className="ws-ask" onSubmit={(ev) => { ev.preventDefault(); const q = ref.current.value.trim(); if (q) { ref.current.value = ''; onAsk(q); } }}>
      <Icon name="ai" />
      <input ref={ref} type="text" placeholder={window.innerWidth < 640 ? 'Demandez à MANAGER-IA…' : "Demandez à MANAGER-IA : « Quels sont les problèmes urgents aujourd'hui ? »"} aria-label="Demandez à MANAGER-IA" autoComplete="off" />
    </form>
  );
}

/** Une erreur dans une sous-application ne doit pas faire tomber tout l'espace. */
class ModBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error(err); } // eslint-disable-line no-console
  render() { return this.state.err ? <Empty text={"Cette partie n'a pas pu s'afficher : " + this.state.err.message} /> : this.props.children; }
}
