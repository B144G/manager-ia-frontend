import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../lib/i18n.jsx';
import { EMOJI_FA, Icon, hasIcon } from '../lib/fa.jsx';
import { useWs } from './WsContext.jsx';
import { publishScreens } from './shell/screens.js';

/* Cadre commun d'un module : menu à gauche en groupes dépliables (les écrans du module), recherche d'écran, fil d'Ariane et phrase d'explication.
   L'organisation, la personne et la recherche globale (Ctrl K) sont dans l'en-tête de l'application (src/ws/shell) ; ce cadre publie ses écrans
   pour le fil d'Ariane et la recherche. N'affiche que ce qu'on lui donne : il ne décide d'aucun droit (les droits restent contrôlés par le serveur).
   groups : [{ id, label, icon?, items: [{ id, label, hint, to? }] }]   active : id de l'écran affiché   onSelect(id)
   Un item avec `to` ouvre un autre module (ex. 'stock') au lieu d'un écran du module. quick : bloc « vue rapide » au-dessus de l'écran. */

// Anciennes icônes en émoji (dans les modules) → icônes Font Awesome. Un nom d'icône du registre est aussi accepté.
const EMOJI = { '📊': 'pie', '✏️': 'edit', '👥': 'users', '🏦': 'bank', '📈': 'chart', '📋': 'list', '🧾': 'billing', '📦': 'box', '🛒': 'sales', '🚚': 'logistics', '⚙️': 'settings', '🔧': 'maintenance', '💰': 'money', '📅': 'calendar', '🔍': 'search', '📁': 'folder', '🏭': 'production', '📝': 'doc', '🔔': 'alerts', '🎯': 'target', '🧮': 'table', '📑': 'doc', '🏗️': 'construction', '📚': 'library', '🔒': 'lock', '✅': 'ok', '⚠️': 'warn', '🛠️': 'maintenance', '🏷️': 'tag', '📥': 'download', '📤': 'upload', '🗂️': 'folder-open', '💼': 'briefcase', '🌱': 'seedling', '♻️': 'recycle' };
const iconOf = (x) => (hasIcon(x) ? x : EMOJI[x] || EMOJI_FA[x] || 'layer-group');

export default function ModuleShell({ title, groups, active, onSelect, actions, quick, children }) {
  const t = useT();
  const { orgId } = useWs();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState(false);
  const groupOf = (id) => (groups.find((g) => g.items.some((i) => i.id === id)) || {}).id;
  const [open, setOpen] = useState(() => new Set([groupOf(active)]));

  useEffect(() => { // l'écran affiché ouvre son groupe (ex. venu d'ailleurs)
    const g = groupOf(active);
    if (g) setOpen((s) => (s.has(g) ? s : new Set(s).add(g)));
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const flat = useMemo(() => groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), [groups]);
  useEffect(() => { publishScreens({ title, items: flat, groups, active, onSelect, pick }); }, [title, flat, groups, active, onSelect]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => publishScreens({ title: '', items: [], groups: [], active: null, onSelect: null, pick: null }), []);
  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? flat.filter((i) => (i.label + ' ' + (i.hint || '') + ' ' + i.group).toLowerCase().includes(s)) : [];
  }, [q, flat]);
  const cur = flat.find((i) => i.id === active) || flat[0];

  function pick(id) {
    setQ(''); setDrawer(false);
    const it = flat.find((x) => x.id === id);
    if (it && it.to) navigate(`/app/${orgId}/${it.to}`); else onSelect(id);
  }
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className={'msh' + (drawer ? ' msh-open' : '')}>
      <div className="msh-body">
        <button type="button" className="msh-burger ui-btn" aria-expanded={drawer} onClick={() => setDrawer(!drawer)}>
          <Icon name="list" />{cur ? cur.label : title} · {drawer ? t('Fermer le menu') : t('Afficher le menu')}
        </button>
        <nav className="msh-nav" aria-label={t('Menu du module')}>
          <div className="msh-title">{title}</div>
          <div className="msh-sw"><Icon name="search" /><input type="search" className="msh-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rechercher un écran…')} aria-label={t('Rechercher un écran…')} /></div>
          {q.trim() ? (
            found.length ? found.map((i) => (
              <button key={i.id} type="button" className={'msh-item' + (i.id === active ? ' on' : '')} onClick={() => pick(i.id)}>{i.label}{i.to ? <Icon name="arrow-right" /> : null}<small>{i.group}</small></button>
            )) : <p className="muted small msh-none">{t('Aucun écran trouvé.')}</p>
          ) : groups.map((g) => {
            const isOpen = open.has(g.id);
            return (
              <div key={g.id} className="msh-group">
                <button type="button" className="msh-gh" aria-expanded={isOpen} onClick={() => toggle(g.id)}>
                  <span>{g.icon ? <Icon name={iconOf(g.icon)} fixedWidth /> : null}{g.label}</span><Icon name={isOpen ? 'down' : 'right'} className="msh-caret" />
                </button>
                {isOpen ? g.items.map((i) => (
                  <button key={i.id} type="button" className={'msh-item' + (i.id === active ? ' on' : '')} aria-current={i.id === active ? 'page' : undefined} onClick={() => pick(i.id)}>{i.label}{i.to ? <Icon name="arrow-right" /> : null}</button>
                )) : null}
              </div>
            );
          })}
        </nav>
        <div className="msh-main">
          <div className="msh-top">
            <div>
              {cur ? <div className="msh-cur">{cur.label}</div> : null}
              {cur && cur.hint ? <p className="muted msh-hint">{cur.hint}</p> : null}
            </div>
            {actions ? <div className="row">{actions}</div> : null}
          </div>
          {quick || null}
          {children}
        </div>
      </div>
    </div>
  );
}
