import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../lib/i18n.jsx';
import { Icon } from '../../lib/fa.jsx';
import { MODULE_ICONS } from '../registry.js';
import { toggleTheme } from '../../lib/theme.js';
import { trap } from '../ui/index.jsx';
import { useScreens } from './screens.js';

/* Recherche d'écran (Ctrl K / Cmd K) : sous-applications, écrans de la sous-application ouverte, actions rapides. Clavier : ↑ ↓ Entrée Échap. */
export default function Palette({ mods, orgId, onClose, onPersonalize, onAsk }) {
  const t = useT();
  const nav = useNavigate();
  const sc = useScreens();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const box = useRef(null);
  const input = useRef(null);
  const list = useRef(null);
  const items = useMemo(() => {
    const all = [];
    sc.items.forEach((s) => all.push({ key: 's' + s.id, icon: 'list', label: s.label, sub: `${sc.title} › ${s.group}`, run: () => (s.to ? nav(`/app/${orgId}/${s.to}`) : sc.onSelect && sc.onSelect(s.id)) }));
    mods.forEach((m) => all.push({ key: 'm' + m.id, icon: MODULE_ICONS[m.id] || m.id, label: t(m.title), sub: t('Sous-application'), run: () => nav(`/app/${orgId}/${m.id}`) }));
    all.push({ key: 'a-theme', icon: 'theme', label: t('Changer de thème (clair / sombre)'), sub: t('Action'), run: toggleTheme });
    all.push({ key: 'a-pers', icon: 'brand', label: t('Personnaliser l\'affichage'), sub: t('Action'), run: onPersonalize });
    const s = q.trim().toLowerCase();
    const found = s ? all.filter((x) => (x.label + ' ' + x.sub).toLowerCase().includes(s)) : all.filter((x) => x.key[0] !== 'a' || true).slice(0, 14);
    if (s) found.push({ key: 'ask', icon: 'ai', label: t('Demander à Brij-IA : « {q} »', { q: q.trim() }), sub: t('Assistant'), run: () => onAsk(q.trim()) });
    return found.slice(0, 40);
  }, [q, sc, mods, orgId, nav, t, onPersonalize, onAsk]);
  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { if (input.current) input.current.focus(); const prev = document.activeElement; return () => { if (prev && prev.focus && prev !== document.body) prev.focus(); }; }, []);
  useEffect(() => { const el = list.current && list.current.querySelector('[aria-selected="true"]'); if (el) el.scrollIntoView({ block: 'nearest' }); }, [i]);
  const run = (it) => { onClose(); setTimeout(it.run, 0); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    else if (e.key === 'Enter' && items[i]) { e.preventDefault(); run(items[i]); }
    else if (e.key === 'Tab' && box.current) trap(e, box.current);
  };
  return (
    <div className="pal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pal" role="dialog" aria-modal="true" aria-label={t('Rechercher un écran…')} ref={box} onKeyDown={onKey}>
        <div className="pal-in"><Icon name="search" />
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rechercher un écran…')} aria-label={t('Rechercher un écran…')} role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant={items[i] ? 'pal-' + items[i].key : undefined} autoComplete="off" />
          <kbd>Échap</kbd></div>
        <ul id="pal-list" role="listbox" ref={list}>
          {items.length ? items.map((it, n) => (
            <li key={it.key} id={'pal-' + it.key} role="option" aria-selected={n === i} onMouseMove={() => setI(n)} onClick={() => run(it)}>
              <Icon name={it.icon} fixedWidth /><span>{it.label}</span><small>{it.sub}</small>
            </li>
          )) : <li className="none">{t('Aucun écran trouvé.')}</li>}
        </ul>
        <div className="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> {t('naviguer')}</span><span><kbd>↵</kbd> {t('ouvrir')}</span></div>
      </div>
    </div>
  );
}
