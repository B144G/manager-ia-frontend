import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { Icon } from '../../lib/fa.jsx';
import { rq, API_BASE } from '../../lib/api.js';
import { usePrefs } from '../../lib/prefs.js';
import { MODULE_ICONS } from '../registry.js';
import { BrandMark } from '../shell/Frame.jsx';
import { openPalette } from '../shell/screens.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Loading, useLoad } from '../ui.jsx';

/* Espaces par rôle : tout ce qui remplace le menu général quand l'entreprise a activé « Espaces par rôle ».
   Le serveur décide de tout (droits, visiteur en lecture seule) ; ici on ne fait que refléter ce qu'il a accordé. */

export const LEVEL_LABEL = { manage: "Responsable de l'espace", write: "Membre de l'espace", view: 'Visiteur (consultation seule)' };
const LEVEL_SHORT = { manage: 'Responsable', write: 'Membre', view: 'Visiteur' };

/** Espaces de la personne et résolution de l'écran courant. */
export function resolveSpaces(spaces, route, lastSpace) {
  const list = spaces.spaces;
  const byId = (id) => list.find((s) => s.id === id) || null;
  const mod = route ? route.mod : 'dashboard';
  let cur = null; let kind = 'module';
  if (mod === 'espaces') kind = 'choose';
  else if (mod === 'home') { cur = byId(route.sub); kind = cur ? 'home' : 'denied'; }
  else {
    cur = list.find((s) => s.modules.some((m) => m.id === mod)) || null;
    if (!cur && mod === 'alerts') { cur = byId(lastSpace) || list[0] || null; } // les alertes (cloche) sont ouvertes à tous
    if (!cur) kind = 'denied';
  }
  return { cur, kind, visitor: Boolean(cur && cur.level === 'view' && kind === 'module') };
}

export function Avatar({ person, orgId, size = 56 }) {
  const [src, setSrc] = useState('');
  const uid = person && person.userId;
  const has = person && person.hasPhoto;
  useEffect(() => {
    let off = false; let url = '';
    setSrc('');
    if (!has) return undefined;
    // La photo est servie avec le cookie de connexion : on la charge puis on l'affiche (fonctionne aussi quand le site et l'API sont sur deux domaines).
    fetch(`${API_BASE}/api/ws/orgs/${orgId}/spaces/photo/${uid}`, { credentials: 'include' }).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b && !off) { url = URL.createObjectURL(b); setSrc(url); } }).catch(() => {});
    return () => { off = true; if (url) URL.revokeObjectURL(url); };
  }, [orgId, uid, has]);
  const initials = ((person && person.name) || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return src ? <img className="sp-avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} /> : <span className="sp-avatar sp-avatar-i" aria-hidden="true" style={{ width: size, height: size, fontSize: size / 2.6 }}>{initials}</span>;
}

/** Menu latéral de l'espace courant : les écrans de CET espace, puis une barre compacte pour les autres espaces (consultation seule). */
export function SpaceSidebar({ cur, curMod, orgId, orgs, info, user, initials, onOrg, onClose, onSecurity, onLogout, onPersonalize, badgeOf, mini, onMini }) {
  const t = useT();
  const p = usePrefs();
  const brand = p.brand[orgId];
  const mods = cur ? cur.modules.filter((m) => m.id !== 'dashboard') : [];
  const hasDash = cur && cur.modules.some((m) => m.id === 'dashboard');
  const item = (m) => {
    const n = badgeOf(m.id);
    return (
      <li key={m.id} className="app-li">
        <Link to={`/app/${orgId}/${m.id}`} className={m.id === curMod ? 'on' : ''} aria-current={m.id === curMod ? 'page' : undefined} title={mini ? t(m.title) : undefined}>
          <Icon name={MODULE_ICONS[m.id] || m.id} fixedWidth /><span className="nl">{t(m.title)}</span>
          {n ? <span className="nbadge">{n}</span> : null}
        </Link>
      </li>
    );
  };
  return (
    <aside className="app-side sp-side" id="ws-side" aria-label={t('Menu de mon espace')}>
      <div className="app-side-h">
        <Link className="app-logo" to="/" aria-label="MABAH"><BrandMark brand={brand} /><span className="app-logo-t">{brand && brand.logo ? info.org.name : <>MABAH</>}</span></Link>
        <button type="button" className="ws-close app-x" aria-label={t('Fermer le menu')} onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="ws-org">
        <span className="av">{initials(info.org.name)}</span>
        <div>
          <select className="org-sel" aria-label={t('Organisation')} value={orgId} onChange={onOrg}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            <option value="new">{t('+ Nouvelle organisation / rejoindre')}</option>
          </select>
          <small>{info.org.sector || ''}</small>
        </div>
      </div>
      {cur ? (
        <div className={'sp-cur' + (cur.level === 'view' ? ' visitor' : '')}>
          <span className="sp-cur-ic"><Icon name={cur.icon} fixedWidth /></span>
          <div><b>{tsrv(cur.title)}</b><small>{t(LEVEL_SHORT[cur.level])}</small></div>
        </div>
      ) : null}
      <button type="button" className="app-find" onClick={openPalette} aria-label={t('Rechercher un écran…')}><Icon name="search" /><span>{t('Rechercher un écran…')}</span><kbd>Ctrl K</kbd></button>
      <nav className="ws-nav" aria-label={t('Écrans de mon espace')}>
        {!cur ? <p className="sp-hint">{t('Choisissez un espace dans la barre en bas de l\'écran : le menu affichera ses écrans.')}</p> : null}
        <ul>
          {cur ? (
            <li className="app-li"><Link to={`/app/${orgId}/home/${cur.id}`} className={curMod === 'home' ? 'on' : ''} aria-current={curMod === 'home' ? 'page' : undefined} title={mini ? t('Tableau de bord') : undefined}><Icon name="house" fixedWidth /><span className="nl">{t('Tableau de bord')}</span></Link></li>
          ) : null}
          {hasDash ? item(cur.modules.find((m) => m.id === 'dashboard')) : null}
          {mods.map(item)}
        </ul>
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

// Libellés courts des espaces (la barre du bas est étroite) ; le serveur ne renvoie que le titre complet.
const SHORT = { direction: 'Direction', commercial: 'Commercial', finances: 'Finances', stock: 'Stock', rh: 'RH', operations: 'Opérations', projets: 'Projets', gestion: 'Juridique', compte: 'Compte' };

/**
 * Pied de page de navigation : Accueil, puis un bouton par espace de la personne (icône + libellé court, espace actif en surbrillance, œil =
 * consultation seule). Défilable à l'horizontale ; sur téléphone elle prend la place de l'ancienne barre basse (avec l'assistant et le menu).
 */
export function SpaceDock({ spaces, cur, kind, orgId, onMenu, onAi, alerts }) {
  const t = useT();
  useEffect(() => { document.body.classList.add('has-bottom', 'has-dock'); return () => document.body.classList.remove('has-bottom', 'has-dock'); }, []);
  const on = (id) => cur && cur.id === id && kind !== 'choose';
  const list = useRef(null);
  useEffect(() => { // l'espace actif reste visible quand la barre défile (téléphone, beaucoup d'espaces)
    const ul = list.current; const a = ul && ul.querySelector('.on');
    if (a) ul.scrollTo({ left: Math.max(0, a.offsetLeft - (ul.clientWidth - a.offsetWidth) / 2) });
  }, [cur && cur.id, kind]);
  return (
    <nav className="sp-dock" aria-label={t('Mes espaces')}>
      <ul className="sp-dock-list" ref={list}>
        <li><Link to={`/app/${orgId}/espaces`} className={'sp-dock-a' + (kind === 'choose' ? ' on' : '')} aria-current={kind === 'choose' ? 'page' : undefined}><Icon name="table-cells" fixedWidth /><span>{t('Accueil')}</span></Link></li>
        {spaces.spaces.map((s) => {
          const name = SHORT[s.id] ? t(SHORT[s.id]) : tsrv(s.title);
          const full = `${tsrv(s.title)}${s.level === 'view' ? ' · ' + t('Consultation seule') : ''}`;
          return (
            <li key={s.id}>
              <Link to={`/app/${orgId}/home/${s.id}`} className={'sp-dock-a' + (on(s.id) ? ' on' : '')} aria-current={on(s.id) ? 'page' : undefined} title={full} aria-label={full}>
                <Icon name={s.icon} fixedWidth /><span>{name}</span>
                {s.level === 'view' ? <i className="sp-eye" aria-hidden="true"><Icon name="eye" /></i> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="sp-dock-tools">
        <button type="button" className="sp-dock-a" onClick={onAi}><Icon name="ai" fixedWidth /><span>{t('Assistant IA')}</span></button>
        <button type="button" className="sp-dock-a" onClick={onMenu} aria-label={t('Ouvrir le menu')}><Icon name="menu" fixedWidth />{alerts ? <i className="dot" /> : null}<span>{t('Menu')}</span></button>
      </div>
    </nav>
  );
}

/**
 * Message d'information au premier passage : les espaces par rôle sont activés pour tout le monde. Affiché une seule fois par personne, par
 * entreprise et par navigateur (le choix est retenu localement ; si le stockage est indisponible, le message s'affiche à chaque visite et se ferme).
 */
export function SpacesNotice({ orgId, userId, fallback }) {
  const t = useT();
  const key = `mabah-seen:spaces-notice:${orgId}:${userId}`;
  const [open, setOpen] = useState(() => { try { return !localStorage.getItem(key); } catch { return true; } });
  if (!open) return null;
  const close = () => { try { localStorage.setItem(key, '1'); } catch { /* stockage indisponible */ } setOpen(false); };
  return (
    <div className="sp-notice" role="status">
      <Icon name="info" />
      <p><b>{t('Votre menu est maintenant organisé par espaces de travail.')}</b> {fallback
        ? t("Vous gardez les mêmes accès qu'avant, regroupés par espace (Commercial, Stock, Comptabilité…). Le propriétaire peut vous affecter un espace précis ; changez d'espace à tout moment depuis le menu.")
        : t("Vous arrivez dans votre espace ; les autres espaces restent accessibles selon ce que le propriétaire vous accorde. Changez d'espace à tout moment depuis le menu.")}</p>
      <button className="btn small primary" type="button" onClick={close}>{t("J'ai compris")}</button>
    </div>
  );
}

/** Bandeau clair « consultation seule » + désactivation de l'apparence des boutons d'écriture (le serveur refuse de toute façon). */
export function VisitorBanner({ space, orgId, home }) {
  const t = useT();
  return (
    <div className="sp-banner" role="status">
      <Icon name="eye" />
      <p><b>{t('Consultation seule')}</b> — {t("vous êtes visiteur dans l'espace {space} : vous pouvez tout lire, rien modifier.", { space: tsrv(space.title) })}</p>
      <Link className="btn small" to={home ? `/app/${orgId}/home/${home}` : `/app/${orgId}/espaces`}>{t('Retour à mon espace')}</Link>
    </div>
  );
}
const WRITE_SEL = 'button.primary,button.danger,button[type="submit"],input[type="submit"]';
// Boutons-liens d'écriture (« Modifier », « Supprimer »…) : désactivés à l'affichage ; le serveur refuse de toute façon toute écriture.
const WRITE_WORDS = /^(modifier|supprimer|retirer|archiver|edit|delete|remove|bearbeiten|löschen|entfernen|editar|eliminar|quitar)\b/i;
export function VisitorGuard({ on, children }) {
  const t = useT();
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !on) return undefined;
    const lock = () => [...el.querySelectorAll(WRITE_SEL), ...[...el.querySelectorAll('button.link,button.btn')].filter((b) => WRITE_WORDS.test(b.textContent.trim()))].forEach((b) => { if (!b.dataset.spLock) { b.dataset.spLock = '1'; b.disabled = true; b.setAttribute('aria-disabled', 'true'); b.title = t('Consultation seule'); } });
    lock();
    const mo = new MutationObserver(lock);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [on, t]);
  return <div ref={box} className={on ? 'sp-visitor' : undefined}>{children}</div>;
}

/** Écran de choix de l'espace (plusieurs rôles) : une carte par espace, avec icône, nom, rôle. */
export function SpaceChooser({ spaces, orgId, onPick }) {
  const t = useT();
  const { firstName } = useWs();
  return (
    <div className="sp-choose">
      <h1>{t('Bonjour {name}, dans quel espace travaillez-vous ?', { name: firstName() })}</h1>
      <p className="muted">{t('Vous avez plusieurs rôles dans cette entreprise. Choisissez votre espace ; vous pourrez en changer à tout moment sans vous déconnecter.')}</p>
      <ul className="sp-cards" aria-label={t('Mes espaces')}>
        {spaces.spaces.map((s) => (
          <li key={s.id}>
            <Link className={'sp-card' + (s.level === 'view' ? ' visitor' : '')} to={`/app/${orgId}/home/${s.id}`} onClick={() => onPick && onPick(s.id)}>
              <span className="sp-card-ic"><Icon name={s.icon} /></span>
              <span className="sp-card-t"><b>{tsrv(s.title)}</b><small>{tsrv(s.desc)}</small></span>
              <span className={'sp-lv ' + s.level}>{s.level === 'view' ? <Icon name="eye" /> : null}{t(LEVEL_LABEL[s.level])}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tableau de bord d'UN espace : nom et photo de la personne, indicateurs, mes tâches ; la direction ajoute la vue d'ensemble des espaces. */
export function SpaceHome({ space, orgId, onPhotoChanged }) {
  const t = useT();
  const { oapi, fail, toast, dateFr, info } = useWs();
  const st = useLoad(() => oapi('GET', '/spaces/dashboard/' + space.id), [space.id, orgId]);
  const ov = useLoad(() => (space.id === 'direction' ? oapi('GET', '/spaces/overview') : Promise.resolve(null)), [space.id, orgId]);
  const file = useRef(null);
  const d = st.data;
  const open = (to) => (space.modules.some((m) => m.id === to) ? `/app/${orgId}/${to}` : null);
  const upload = (f) => {
    if (!f) return;
    if (f.size > 400 * 1024) { toast(t('Photo trop lourde (400 Ko au plus).'), true); return; }
    fetch(`${API_BASE}/api/ws/orgs/${orgId}/spaces/photo`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: f })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur'); toast(t('Photo enregistrée.')); st.reload(); if (onPhotoChanged) onPhotoChanged(); }).catch(fail);
  };
  const removePhoto = () => rq('DELETE', `/api/ws/orgs/${orgId}/spaces/photo`).then(() => { st.reload(); }).catch(fail);
  return (
    <>
      <header className="sp-hello">
        {d ? <Avatar person={d.person} orgId={orgId} size={64} /> : <span className="sp-avatar sp-avatar-i" style={{ width: 64, height: 64 }} />}
        <div className="sp-hello-t">
          <h1>{d ? t('Bonjour {name}', { name: d.person.name.split(' ')[0] }) : t('Bonjour')}</h1>
          <p className="muted">{d ? [d.person.name, d.person.title || t(info.me.roleLabel)].join(' · ') : ''} — <b>{tsrv(space.title)}</b> · {t(LEVEL_SHORT[space.level])}</p>
          <p className="small">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} aria-label={t('Choisir ma photo')} />
            <button className="link" type="button" onClick={() => file.current && file.current.click()}>{d && d.person.hasPhoto ? t('Changer ma photo') : t('Ajouter ma photo')}</button>
            {d && d.person.hasPhoto ? <> · <button className="link" type="button" onClick={removePhoto}>{t('Retirer ma photo')}</button></> : null}
          </p>
        </div>
      </header>
      {space.level === 'view' ? <div className="sp-banner" role="status"><Icon name="eye" /><p><b>{t('Consultation seule')}</b> — {t("vous êtes visiteur dans l'espace {space} : vous pouvez tout lire, rien modifier.", { space: tsrv(space.title) })}</p></div> : null}
      {st.loading && !d ? <Loading /> : null}
      {st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : null}
      {d ? (
        <>
          <ul className="sp-tiles" aria-label={t('Indicateurs de mon espace')}>
            {d.tiles.map((x) => {
              const to = open(x.to);
              const body = <><span className="sp-n">{x.value}</span><span className="sp-l">{tsrv(x.label)}</span></>;
              return <li key={x.id} className={'sp-tile ' + (x.value && x.tone ? x.tone : 'plain')}>{to ? <Link to={to}>{body}</Link> : <div>{body}</div>}</li>;
            })}
          </ul>
          {d.myTasks.length ? (
            <div className="ws-card">
              <h2>{t('Mes prochaines tâches')}</h2>
              {d.myTasks.map((k) => <div className="line" key={k.id}><span>{k.title}</span><small>{k.due ? dateFr(k.due) : ''}</small></div>)}
            </div>
          ) : null}
        </>
      ) : null}
      {space.id === 'direction' && ov.data ? (
        <section className="sp-overview" aria-label={t('Vue d\'ensemble des espaces')}>
          <h2>{t("Vue d'ensemble de l'entreprise")}</h2>
          <div className="sp-ov">
            {ov.data.spaces.map((s) => (
              <div className="ws-card sp-ov-card" key={s.id}>
                <h3><Icon name={s.icon} fixedWidth /> {tsrv(s.title)}</h3>
                <ul>{s.tiles.map((x) => <li key={x.id}><b>{x.value}</b> {tsrv(x.label)}</li>)}</ul>
                <Link className="link" to={`/app/${orgId}/home/${s.id}`}>{t('Ouvrir cet espace')}{s.level === 'view' ? ' · ' + t('consultation') : ''}</Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function SpaceDenied({ orgId, home }) {
  const t = useT();
  return (
    <div className="sp-denied">
      <Empty text={t("Cet écran n'est pas dans vos espaces. Demandez au propriétaire de vous y donner accès (en consultation ou en travail).")} />
      <p><Link className="btn primary" to={home ? `/app/${orgId}/home/${home}` : `/app/${orgId}/espaces`}>{t('Retour à mon espace')}</Link></p>
    </div>
  );
}
