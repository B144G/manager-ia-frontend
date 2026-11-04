import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../lib/i18n.jsx';
import { useWs } from '../WsContext.jsx';
import { buildGuides } from './guides.js';

/* Guide interactif : un halo autour de l'élément à utiliser, une flèche qui le désigne et une bulle qui explique quoi faire.
   Une étape = { to?, at?, title, text, click?, optional?, nav? } (voir guides.js).
   - to : sous-application à ouvrir avant l'étape ; at : où pointer (un ou plusieurs repères) ; click : l'utilisateur clique lui-même sur l'élément (« Le faire pour moi » le fait à sa place).
   - Rien n'est jamais envoyé ni enregistré par le guide : il ne fait qu'ouvrir des écrans et des fenêtres. */

const Ctx = createContext(null);
export const useGuide = () => useContext(Ctx);

const SEEN = 'brij-guide-seen';
const DONE = 'brij-guide-done';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible : le guide marche quand même */ } },
};

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const visible = (el) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };

/** Trouve l'élément visé : { sel, text } (premier élément visible du sélecteur dont le texte contient « text »). Une liste = plusieurs essais. */
export function findTarget(at) {
  const list = Array.isArray(at) ? at : at ? [at] : [];
  for (const a of list) {
    let nodes;
    try { nodes = [...document.querySelectorAll(a.sel)]; } catch { nodes = []; }
    nodes = nodes.filter((n) => !n.closest('.gd-root, .gd-pop, .gd-offer') && visible(n));
    if (a.text) { const w = norm(a.text); nodes = nodes.filter((n) => norm(n.textContent).includes(w)); if (a.exact) nodes = nodes.filter((n) => norm(n.textContent) === w); }
    // une fenêtre ouverte passe avant le reste de la page
    const modal = nodes.filter((n) => n.closest('.ws-modal'));
    const hit = modal.length ? modal[modal.length - 1] : nodes[0];
    if (hit) return hit;
  }
  return null;
}

export function GuideProvider({ children, openNav }) {
  const t = useT();
  const ws = useWs();
  const navigate = useNavigate();
  const [run, setRun] = useState(null); // { id, i }
  const [offer, setOffer] = useState(false);
  const [done, setDone] = useState(() => store.get(DONE, []));
  const admin = ws.can('admin'), mgr = ws.can('manager');
  const mods = useMemo(() => (ws.info ? ws.info.modules.map((m) => m.id) : []), [ws.info]);
  const guides = useMemo(() => buildGuides(t, { admin, mgr, mods }), [t, admin, mgr, mods]);

  const stop = useCallback(() => { setRun(null); if (openNav) openNav(false); }, [openNav]);
  const start = useCallback((id) => { setOffer(false); store.set(SEEN, true); setRun({ id, i: 0 }); }, []);
  const finish = useCallback((id) => {
    setDone((d) => { const n = d.includes(id) ? d : d.concat(id); store.set(DONE, n); return n; });
    stop();
  }, [stop]);

  // Première visite : on propose la visite, sans jamais l'imposer
  useEffect(() => {
    if (!ws.info || !ws.user || store.get(SEEN, false)) return undefined;
    const id = setTimeout(() => setOffer(true), 1500);
    return () => clearTimeout(id);
  }, [ws.info, ws.user]);

  const value = useMemo(() => ({ guides, start, stop, run, done, offer, setOffer }), [guides, start, stop, run, done, offer]);
  const guide = run && guides.find((g) => g.id === run.id);
  return (
    <Ctx.Provider value={value}>
      {children}
      {offer && !run ? <Offer onStart={() => start('welcome')} onLater={() => { store.set(SEEN, true); setOffer(false); }} /> : null}
      {guide ? <Runner key={guide.id} guide={guide} index={run.i} setIndex={(i) => setRun((r) => (r ? { ...r, i } : r))} onEnd={() => finish(guide.id)} onQuit={stop} navigate={navigate} openNav={openNav} orgId={ws.orgId} /> : null}
    </Ctx.Provider>
  );
}

function Offer({ onStart, onLater }) {
  const t = useT();
  return (
    <div className="gd-offer" role="dialog" aria-label={t('Guide de prise en main')} data-guide-ui>
      <b>{t('Bienvenue sur Brij-IA !')}</b>
      <p>{t('Voulez-vous une visite guidée d\'une minute ? Des flèches vous montrent où cliquer et quoi faire. Vous pourrez la relancer à tout moment avec le bouton « Guide ».')}</p>
      <div className="gd-row"><button type="button" className="btn primary small" onClick={onStart}>{t('Commencer la visite')}</button><button type="button" className="btn small" onClick={onLater}>{t('Plus tard')}</button></div>
    </div>
  );
}

const PAD = 7;
const GAP = 46; // place pour la flèche entre l'élément et la bulle
const POPW = 340;

function Runner({ guide, index, setIndex, onEnd, onQuit, navigate, openNav, orgId }) {
  const t = useT();
  const step = guide.steps[index];
  const total = guide.steps.length;
  const [box, setBox] = useState(null); // rect de l'élément visé
  const [lost, setLost] = useState(false);
  const [popH, setPopH] = useState(180);
  const pop = useRef(null);
  const el = useRef(null);
  const nextBtn = useRef(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  const go = useCallback((n) => { if (n >= total) onEnd(); else if (n >= 0) setIndex(n); }, [total, onEnd, setIndex]);

  // Entrée dans une étape : ouvrir la bonne sous-application, le menu sur téléphone, puis attendre l'élément
  useEffect(() => {
    let alive = true; let tries = 0; let timer = null;
    el.current = null; setBox(null); setLost(false);
    if (step.to && !location.pathname.endsWith('/' + step.to)) navigate(`/app/${orgId}/${step.to}`);
    if (openNav) openNav(Boolean(step.nav) && window.innerWidth < 1100);
    const look = () => {
      if (!alive) return;
      if (!step.at) { setLost(false); return; }
      const hit = findTarget(step.at);
      if (hit) {
        el.current = hit;
        const r = hit.getBoundingClientRect();
        if ((r.top < 70 || r.bottom > window.innerHeight - 20) && !hit.closest('.ws-modal, .ws-side, .ws-top2')) hit.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      tries += 1;
      if (tries > 28) { if (step.optional) go(index + 1); else setLost(true); return; }
      timer = setTimeout(look, 200);
    };
    timer = setTimeout(look, step.to ? 450 : 120);
    return () => { alive = false; clearTimeout(timer); };
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suivi de la position (défilement, ouverture d'une fenêtre, redimensionnement)
  useEffect(() => {
    const id = setInterval(() => {
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      const n = el.current;
      if (n && !document.body.contains(n)) { el.current = null; if (step.at) { const hit = findTarget(step.at); if (hit) el.current = hit; } }
      if (!el.current) { setBox((b) => (b ? null : b)); return; }
      const r = el.current.getBoundingClientRect();
      setBox((b) => (b && Math.abs(b.x - r.left) < 1 && Math.abs(b.y - r.top) < 1 && Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1 ? b : { x: r.left, y: r.top, w: r.width, h: r.height }));
    }, 120);
    return () => clearInterval(id);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (pop.current) { const h = pop.current.offsetHeight; if (h && Math.abs(h - popH) > 2) setPopH(h); } });
  useEffect(() => { if (nextBtn.current) nextBtn.current.focus({ preventScroll: true }); }, [index]);

  // L'utilisateur clique lui-même sur l'élément : on passe à l'étape suivante
  useEffect(() => {
    if (!step.click) return undefined;
    const onClick = (e) => { const n = el.current; if (n && n.contains(e.target)) setTimeout(() => go(index + 1), 380); };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [index, step.click, go]);

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onQuit(); }
      else if (e.key === 'ArrowRight' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) next();
      else if (e.key === 'ArrowLeft' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) go(index - 1);
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function next() {
    // Étape « cliquez » : « Suivant » fait le clic à la place de l'utilisateur (ouvre l'écran ou la fenêtre, rien d'irréversible)
    if (step.click && el.current) { try { el.current.click(); } catch { /* ignoré */ } return; }
    go(index + 1);
  }

  // Placement de la bulle et de la flèche
  const mobile = vp.w < 640;
  const popW = Math.min(POPW, vp.w - 24);
  let pos = { left: Math.max(12, (vp.w - popW) / 2), top: Math.max(12, (vp.h - popH) / 2) }; let side = null;
  if (box && !lost) {
    const room = { bottom: vp.h - (box.y + box.h) - PAD - GAP, top: box.y - PAD - GAP, right: vp.w - (box.x + box.w) - PAD - GAP, left: box.x - PAD - GAP };
    const fitV = (s) => room[s] >= popH + 10;
    const fitH = (s) => !mobile && room[s] >= popW + 10;
    side = fitV('bottom') ? 'bottom' : fitV('top') ? 'top' : fitH('right') ? 'right' : fitH('left') ? 'left' : null;
    const cx = box.x + box.w / 2; const cy = box.y + box.h / 2;
    const clampX = (x) => Math.min(Math.max(12, x), vp.w - popW - 12);
    const clampY = (y) => Math.min(Math.max(12, y), vp.h - popH - 12);
    if (side === 'bottom') pos = { left: clampX(cx - popW / 2), top: box.y + box.h + PAD + GAP };
    else if (side === 'top') pos = { left: clampX(cx - popW / 2), top: box.y - PAD - GAP - popH };
    else if (side === 'right') pos = { left: box.x + box.w + PAD + GAP, top: clampY(cy - popH / 2) };
    else if (side === 'left') pos = { left: box.x - PAD - GAP - popW, top: clampY(cy - popH / 2) };
    else pos = { left: Math.max(12, (vp.w - popW) / 2), top: box.y > vp.h / 2 ? 12 : vp.h - popH - 12 }; // élément trop grand : bulle en haut ou en bas de l'écran
  }
  const arrow = box && !lost && side ? arrowAt(box, side) : null;
  const last = index === total - 1;

  return (
    <div className="gd-root" data-guide-ui>
      {box && !lost ? <div className="gd-spot" style={{ left: box.x - PAD, top: box.y - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 }} /> : <div className="gd-dim" />}
      {arrow ? <div className={'gd-arrow ' + arrow.dir} style={{ left: arrow.x, top: arrow.y }} aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 4 L34 26 H24 V36 H16 V26 H6 Z" /></svg></div> : null}
      <div className={'gd-pop' + (lost ? ' lost' : '')} ref={pop} role="dialog" aria-live="polite" aria-label={step.title} style={{ left: pos.left, top: pos.top, width: popW }}>
        <div className="gd-head"><span className="gd-count">{guide.title} · {index + 1}/{total}</span><button type="button" className="gd-x" aria-label={t('Quitter le guide')} title={t('Quitter le guide')} onClick={onQuit}>×</button></div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        {step.click && !lost ? <p className="gd-do">{t('À vous : cliquez sur l\'élément en surbrillance.')}</p> : null}
        {lost ? <p className="gd-lost">{t("Cet élément n'est pas affiché ici (droits ou écran différent). Passez à l'étape suivante.")}</p> : null}
        <div className="gd-bar"><i style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
        <div className="gd-row">
          <button type="button" className="btn small" onClick={() => go(index - 1)} disabled={index === 0}>{t('Précédent')}</button>
          <button type="button" className="btn primary small" ref={nextBtn} onClick={next}>{last ? t('Terminer') : step.click && el.current && !lost ? t('Le faire pour moi') : t('Suivant')}</button>
          {step.click && !lost && !last ? <button type="button" className="btn small" onClick={() => go(index + 1)}>{t('Passer')}</button> : null}
        </div>
      </div>
    </div>
  );
}

/** Flèche placée entre la bulle et l'élément, orientée vers l'élément. */
function arrowAt(b, side) {
  const cx = b.x + b.w / 2; const cy = b.y + b.h / 2; const S = 40;
  if (side === 'bottom') return { dir: 'up', x: cx - S / 2, y: b.y + b.h + PAD - 2 };
  if (side === 'top') return { dir: 'down', x: cx - S / 2, y: b.y - PAD - S + 2 };
  if (side === 'right') return { dir: 'left', x: b.x + b.w + PAD - 2, y: cy - S / 2 };
  return { dir: 'right', x: b.x - PAD - S + 2, y: cy - S / 2 };
}

/** Bouton « Guide » de la barre du haut : visite, puis une liste de tâches avec recherche. */
export function GuideButton() {
  const t = useT();
  const g = useGuide();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!g) return null;
  const w = norm(q);
  const list = g.guides.filter((x) => !w || norm(x.title + ' ' + x.group + ' ' + (x.keys || '')).includes(w));
  const groups = [...new Set(list.map((x) => x.group))];
  return (
    <div className="gd-menu" ref={box} data-guide-ui>
      <button type="button" id="guideBtn" className="gd-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)} title={t('Guide : montre-moi comment faire')}><span aria-hidden="true">?</span><b>{t('Guide')}</b></button>
      {open ? (
        <div className="gd-list" role="menu">
          <label className="gd-search"><span className="sr">{t('Que voulez-vous faire ?')}</span><input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Que voulez-vous faire ? (ex : facture, stock, paie)')} /></label>
          {groups.length ? groups.map((gr) => (
            <div key={gr} className="gd-group">
              <small>{gr}</small>
              {list.filter((x) => x.group === gr).map((x) => (
                <button type="button" role="menuitem" key={x.id} onClick={() => { setOpen(false); setQ(''); g.start(x.id); }}>
                  <span>{x.title}</span>{g.done.includes(x.id) ? <i title={t('Déjà suivi')}>✓</i> : null}
                </button>
              ))}
            </div>
          )) : <p className="gd-none">{t('Aucun guide ne correspond. Essayez un autre mot, ou demandez à l\'assistant IA.')}</p>}
        </div>
      ) : null}
    </div>
  );
}
