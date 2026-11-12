import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../lib/i18n.jsx';
import { useWs } from './WsContext.jsx';

/* Cadre commun d'un module : bandeau (entreprise, personne, rôle), menu à gauche en groupes dépliables,
   recherche d'écran (Ctrl K), fil d'Ariane et phrase d'explication. N'affiche que ce qu'on lui donne :
   il ne décide d'aucun droit (les droits restent contrôlés par le serveur).
   groups : [{ id, label, items: [{ id, label, hint }] }]   active : id de l'écran affiché   onSelect(id) */

export default function ModuleShell({ title, groups, active, onSelect, actions, children }) {
  const t = useT();
  const { info, user } = useWs();
  const search = useRef(null);
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState(false);
  const groupOf = (id) => (groups.find((g) => g.items.some((i) => i.id === id)) || {}).id;
  const [open, setOpen] = useState(() => new Set([groupOf(active)]));

  useEffect(() => { // l'écran affiché ouvre son groupe (ex. venu d'ailleurs)
    const g = groupOf(active);
    if (g) setOpen((s) => (s.has(g) ? s : new Set(s).add(g)));
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setDrawer(true);
        setTimeout(() => { if (search.current) search.current.focus(); }, 30);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flat = useMemo(() => groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), [groups]);
  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? flat.filter((i) => (i.label + ' ' + (i.hint || '') + ' ' + i.group).toLowerCase().includes(s)) : [];
  }, [q, flat]);
  const cur = flat.find((i) => i.id === active) || flat[0];

  const pick = (id) => { setQ(''); setDrawer(false); onSelect(id); };
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const org = info && info.org ? info.org.name : '';
  const who = user ? user.name : '';
  const role = info && info.me ? t(info.me.roleLabel) : '';

  return (
    <div className={'msh' + (drawer ? ' msh-open' : '')}>
      <div className="msh-band">
        <span className="msh-org"><b>{org}</b><span aria-hidden="true"> — </span>{title}</span>
        <span className="msh-who">{who}{role ? <small>{role}</small> : null}</span>
      </div>
      <div className="msh-body">
        <button type="button" className="msh-burger btn small" aria-expanded={drawer} onClick={() => setDrawer(!drawer)}>
          {drawer ? t('Fermer le menu') : t('Afficher le menu')}
        </button>
        <nav className="msh-nav" aria-label={t('Menu du module')}>
          <input ref={search} type="search" className="msh-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rechercher un écran…')} aria-label={t('Rechercher un écran…')} />
          {q.trim() ? (
            found.length ? found.map((i) => (
              <button key={i.id} type="button" className={'msh-item' + (i.id === active ? ' on' : '')} onClick={() => pick(i.id)}>{i.label}<small>{i.group}</small></button>
            )) : <p className="muted small msh-none">{t('Aucun écran trouvé.')}</p>
          ) : groups.map((g) => {
            const isOpen = open.has(g.id);
            return (
              <div key={g.id} className="msh-group">
                <button type="button" className="msh-gh" aria-expanded={isOpen} onClick={() => toggle(g.id)}>
                  <span>{g.label}</span><span aria-hidden="true" className="msh-caret">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen ? g.items.map((i) => (
                  <button key={i.id} type="button" className={'msh-item' + (i.id === active ? ' on' : '')} aria-current={i.id === active ? 'page' : undefined} onClick={() => pick(i.id)}>{i.label}</button>
                )) : null}
              </div>
            );
          })}
        </nav>
        <div className="msh-main">
          <div className="msh-top">
            <div>
              <div className="msh-crumb">{title}{cur ? <> › {cur.group} › <b>{cur.label}</b></> : null}</div>
              {cur && cur.hint ? <p className="muted small msh-hint">{cur.hint}</p> : null}
            </div>
            {actions ? <div className="row">{actions}</div> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
