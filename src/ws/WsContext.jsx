import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api as wsApi, rq } from '../lib/api.js';
import { dateFr, firstName, formatMoney, initials, today } from '../lib/format.js';
import { Loading, ModalBox } from './ui.jsx';

const Ctx = createContext(null);
/** Accès à tout ce dont un module a besoin : appels serveur, organisation, droits, messages, fenêtres, IA. */
export const useWs = () => useContext(Ctx);

const RANK = { member: 1, manager: 2, admin: 3, owner: 4 };

/** Lit l'adresse : /app/<organisation>/<module>. */
export function parseRoute(pathname) {
  const m = /^\/app(?:\.html)?(?:\/(\d+)(?:\/([a-z]+))?)?/.exec(pathname || '');
  return m && m[1] ? { org: Number(m[1]), mod: m[2] || 'dashboard' } : null;
}

export function WsProvider({ children }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [info, setInfo] = useState(null);
  const [dash, setDash] = useState(null);
  const [onboarding, setOnboarding] = useState(null); // { code } quand il faut créer / rejoindre une organisation
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [pendingAsk, setPendingAsk] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [modals, setModals] = useState([]);
  const orgRef = useRef(null);
  orgRef.current = orgId;
  const seq = useRef(0);

  /* ---------- Messages ---------- */
  const toast = useCallback((msg, bad) => {
    const id = ++seq.current;
    setToasts((l) => [...l, { id, msg, bad }]);
    setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), bad ? 6000 : 3200);
  }, []);
  const fail = useCallback((e) => {
    if (e && e.status === 401) { setUser(null); navigate('/connexion', { replace: true }); return; }
    toast((e && e.message) || 'Erreur', true);
  }, [navigate, toast]);

  /* ---------- Fenêtres ---------- */
  const closeModal = useCallback((id) => setModals((l) => l.filter((m) => m.id !== id)), []);
  /** modal(titre, (fermer) => <contenu/>, { wide, onclose }) : ouvre une fenêtre et renvoie la fonction qui la ferme. */
  const modal = useCallback((title, render, opts = {}) => {
    const id = ++seq.current;
    setModals((l) => [...l, { id, title, render, opts }]);
    return () => closeModal(id);
  }, [closeModal]);
  useEffect(() => {
    if (!modals.length) return undefined;
    const esc = (ev) => { if (ev.key === 'Escape') { const top = modals[modals.length - 1]; closeModal(top.id); if (top.opts.onclose) top.opts.onclose(); } };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [modals, closeModal]);
  /** confirm(texte, siOui, texteDuBouton) */
  const confirm = useCallback((text, onYes, yesText) => {
    modal('Confirmer', (close) => (
      <>
        <p>{text}</p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary" type="button" onClick={() => { close(); onYes(); }}>{yesText || 'Oui, continuer'}</button>
          <button className="btn" type="button" onClick={close}>Annuler</button>
        </div>
      </>
    ));
  }, [modal]);

  /* ---------- Serveur ---------- */
  const api = wsApi;
  const oapi = useCallback((method, path, body) => wsApi(method, '/orgs/' + orgRef.current + path, body), []);

  /* ---------- Chargement ---------- */
  const refreshBadges = useCallback(() => {
    if (!orgRef.current) return Promise.resolve();
    return oapi('GET', '/dashboard').then(setDash, () => {});
  }, [oapi]);

  const loadOrg = useCallback(async (id, mod, replace) => {
    try {
      const i = await wsApi('GET', '/orgs/' + id);
      if (orgRef.current !== id) setDash(null); // évite d'afficher les chiffres d'une autre organisation
      orgRef.current = id;
      setOrgId(id); setInfo(i); setOnboarding(null);
      navigate(`/app/${id}/${mod || 'dashboard'}`, { replace: Boolean(replace) });
      oapi('GET', '/dashboard').then(setDash, () => {});
    } catch (e) { fail(e); }
  }, [navigate, fail, oapi]);

  const boot = useCallback(async () => {
    const join = (/^#join=([A-Za-z0-9]+)/.exec(window.location.hash || '') || [])[1] || new URLSearchParams(window.location.search).get('join');
    try {
      const j = await wsApi('GET', '/orgs');
      setOrgs(j.orgs);
      if (join) { window.history.replaceState(null, '', '/app'); setOnboarding({ code: join }); return; }
      if (!j.orgs.length) { setOnboarding({ code: '' }); return; }
      const r = parseRoute(window.location.pathname);
      const pick = (r && j.orgs.find((o) => o.id === r.org)) || j.orgs.find((o) => o.id === orgRef.current) || j.orgs[0];
      await loadOrg(pick.id, r && r.org === pick.id ? r.mod : 'dashboard', true);
    } catch (e) { fail(e); }
  }, [loadOrg, fail]);

  // Au démarrage : qui est connecté ?
  useEffect(() => {
    let off = false;
    rq('GET', '/api/me').then((j) => { if (off) return; setUser(j.user); setBooting(false); boot(); }, () => { if (!off) navigate('/connexion', { replace: true }); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changement d'adresse (menu, retour arrière) : autre organisation ?
  const route = parseRoute(loc.pathname);
  useEffect(() => {
    if (!user || !route || route.org === orgRef.current) return;
    loadOrg(route.org, route.mod, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, user]);

  const logout = useCallback(() => { rq('POST', '/api/logout').catch(() => {}).then(() => { window.location.href = '/'; }); }, []);

  /* ---------- Assistant IA ---------- */
  const askAI = useCallback((text) => { setPendingAsk(text); setAiOpen(true); }, []);
  const openAI = useCallback(() => setAiOpen(true), []);

  /* ---------- Propositions de l'IA (relues et validées par la personne) ---------- */
  const propose = useCallback((kind, input, o) => {
    modal(o.title, (close) => <ProposePanel kind={kind} input={input} o={o} close={close} />, { wide: true });
  }, [modal]);

  /* ---------- Outils ---------- */
  const can = useCallback((min) => Boolean(info && RANK[info.me.role] >= RANK[min]), [info]);
  const money = useCallback((n) => formatMoney(n, info ? info.org.currency : 'FCFA'), [info]);
  const memberName = useCallback((id, list) => { const m = (list || []).find((x) => x.userId === id); return m ? m.name : ''; }, []);
  const copy = useCallback((text, label) => {
    const done = () => toast(label || 'Copié.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt('Copiez :', text));
    else window.prompt('Copiez :', text);
  }, [toast]);

  const value = useMemo(() => ({
    // état
    S: { user, orgs, orgId, info, dash }, user, orgs, orgId, info, dash, route,
    // serveur
    api, oapi, rq,
    // messages, fenêtres
    toast, fail, modal, confirm,
    // outils
    money, dateFr, today, can, copy, memberName, firstName: () => firstName(user && user.name), initials,
    // navigation / rafraîchissement
    refresh: () => setRefreshKey((k) => k + 1), refreshKey, reloadOrg: () => loadOrg(orgId, route ? route.mod : 'dashboard', true), loadOrg, refreshBadges, logout, setOrgs, setUser,
    // IA
    askAI, openAI, propose, aiOpen, setAiOpen, pendingAsk, setPendingAsk,
    onboarding, setOnboarding, booting, boot,
  }), [user, orgs, orgId, info, dash, route, oapi, toast, fail, modal, confirm, money, can, copy, memberName, refreshKey, loadOrg, refreshBadges, logout, askAI, openAI, propose, aiOpen, pendingAsk, onboarding, booting, boot]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider value={value}>
      {children}
      {modals.map((m) => (
        <ModalBox key={m.id} title={m.title} wide={m.opts.wide} onClose={() => { closeModal(m.id); if (m.opts.onclose) m.opts.onclose(); }}>
          {m.render(() => closeModal(m.id))}
        </ModalBox>
      ))}
      <div id="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'toast' + (t.bad ? ' bad' : '')}>{t.msg}</div>)}</div>
    </Ctx.Provider>
  );
}

/** Contenu de la fenêtre « Proposition de l'IA » : l'IA ne modifie jamais rien toute seule. */
function ProposePanel({ kind, input, o, close }) {
  const { oapi, toast, fail } = useWs();
  const [st, setSt] = useState({ loading: true, proposal: null, error: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let off = false;
    oapi('POST', '/ai/propose', { kind, input }).then((j) => { if (!off) setSt({ loading: false, proposal: j.proposal, error: '' }); }, (e) => { if (!off) setSt({ loading: false, proposal: null, error: e.message }); });
    return () => { off = true; };
  }, [kind, input, oapi]);
  if (st.loading) return <Loading />;
  if (st.error) return <><p className="ws-err">{st.error}</p><button className="btn" type="button" onClick={close}>Fermer</button></>;
  const apply = () => {
    setBusy(true);
    oapi('POST', '/ai/apply', { kind, proposal: st.proposal }).then((r) => { close(); toast("C'est fait."); if (o.done) o.done(r); }, (e) => { setBusy(false); fail(e); });
  };
  return (
    <div>
      <p className="muted small">Proposition de l'IA. Relisez-la : rien n'est enregistré tant que vous n'avez pas validé.</p>
      <div className="ws-prop">{o.render(st.proposal)}</div>
      <div className="row" style={{ marginTop: 16 }}>
        {o.apply !== false ? <button className="btn primary" type="button" disabled={busy} onClick={apply}>{o.applyText || 'Appliquer'}</button> : null}
        <button className="btn" type="button" onClick={close}>{o.apply === false ? 'Fermer' : 'Annuler'}</button>
      </div>
      {o.after ? o.after(st.proposal, close) : null}
    </div>
  );
}
