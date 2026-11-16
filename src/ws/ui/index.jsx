import { forwardRef, useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';

/* Bibliothèque de composants communs de l'espace de travail. Les styles sont dans src/styles/ui.css (jetons : src/styles/tokens.css).
   Règle : un écran n'invente ni bouton, ni carte, ni pastille, ni icône : il utilise ces composants (ou leurs classes « ui-… »). */

export { Icon };
const cx = (...a) => a.filter(Boolean).join(' ');

/** Bouton. variant : primary | secondary (défaut) | soft | ghost | danger | danger-outline ; size : sm | md | lg ; icon : nom d'icône ; loading : affiche un indicateur et bloque le clic ;
 *  to : lien interne (react-router) ; href : lien externe. Icône seule : iconOnly + label (obligatoire, devient le libellé accessible). */
export const Button = forwardRef(function Button({ variant = 'secondary', size = 'md', icon, iconRight, loading, iconOnly, label, block, to, href, className, children, type, disabled, ...rest }, ref) {
  const cls = cx('ui-btn', variant === 'primary' && 'primary', variant !== 'primary' && variant !== 'secondary' && variant, size === 'sm' && 'sm', size === 'lg' && 'lg', iconOnly && 'icon-only', block && 'block', loading && 'loading', className);
  const body = <>{icon ? <Icon name={icon} /> : null}{iconOnly ? null : children}{iconRight ? <Icon name={iconRight} /> : null}</>;
  const a11y = { 'aria-label': iconOnly ? label : rest['aria-label'], title: iconOnly ? label : rest.title, 'aria-busy': loading || undefined };
  if (to) return <Link ref={ref} to={to} className={cls} {...rest} {...a11y}>{body}</Link>;
  if (href) return <a ref={ref} href={href} className={cls} {...rest} {...a11y}>{body}</a>;
  return <button ref={ref} type={type || 'button'} className={cls} disabled={disabled || loading} {...rest} {...a11y}>{body}</button>;
});

export function Card({ title, subtitle, actions, flat, raised, flush, hover, className, children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={cx('ui-card', flat && 'flat', raised && 'raised', flush && 'pad-0', hover && 'hover', className)} {...rest}>
      {title || actions ? <div className="ui-card-h"><div>{title ? <h2>{title}</h2> : null}{subtitle ? <small>{subtitle}</small> : null}</div>{actions ? <div className="row">{actions}</div> : null}</div> : null}
      {children}
    </Tag>
  );
}

/** Badge d'état. tone : neutral | ok | warn | danger | info | brand | outline. */
export function Badge({ tone = 'neutral', dot, className, children }) {
  return <span className={cx('ui-badge', tone !== 'neutral' && tone, className)}>{dot ? <span className="dot" aria-hidden="true" /> : null}{children}</span>;
}

/** Onglets accessibles (flèches gauche/droite). items : [{ id, label, icon?, count? }] */
export function Tabs({ items, value, onChange, label, className }) {
  const t = useT();
  const onKey = (e) => {
    const i = items.findIndex((x) => x.id === value);
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1;
    if (n >= 0) { e.preventDefault(); const it = items[(n + items.length) % items.length]; onChange(it.id); setTimeout(() => { const el = document.getElementById('tab-' + it.id); if (el) el.focus(); }, 0); }
  };
  return (
    <div className={cx('ui-tabs', className)} role="tablist" aria-label={label || t('Onglets')} onKeyDown={onKey}>
      {items.map((it) => (
        <button key={it.id} id={'tab-' + it.id} type="button" role="tab" className="ui-tab" aria-selected={it.id === value} tabIndex={it.id === value ? 0 : -1} onClick={() => onChange(it.id)}>
          {it.icon ? <Icon name={it.icon} /> : null}{it.label}{it.count ? <Badge tone="brand">{it.count}</Badge> : null}
        </button>
      ))}
    </div>
  );
}

/** Bascule de vue (liste / kanban / gantt…) : boutons exclusifs. */
export function Segmented({ items, value, onChange, label }) {
  return (
    <div className="ui-seg" role="group" aria-label={label}>
      {items.map((it) => <button key={it.id} type="button" aria-pressed={it.id === value} onClick={() => onChange(it.id)}>{it.icon ? <Icon name={it.icon} /> : null}{it.label}</button>)}
    </div>
  );
}

/** Champ de formulaire : étiquette, aide, erreur, champ requis. children = le <input> (reçoit id et aria-describedby via render-prop). */
export function Field({ label, hint, error, required, children }) {
  const id = useId();
  const el = typeof children === 'function' ? children({ id, 'aria-describedby': hint || error ? id + '-d' : undefined, 'aria-invalid': error ? true : undefined }) : children;
  return (
    <div className={cx('ui-field', error && 'err')}>
      {label ? <label htmlFor={id}>{label}{required ? <span className="ui-req" aria-hidden="true">*</span> : null}</label> : null}
      {el}
      {hint || error ? <div id={id + '-d'}>{error ? <span className="error" role="alert">{error}</span> : <span className="hint">{hint}</span>}</div> : null}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, children, action }) {
  return <div className="ui-empty"><span className="ico"><Icon name={icon} /></span>{title ? <h3>{title}</h3> : null}{children ? <p>{children}</p> : null}{action || null}</div>;
}

export function Skeleton({ lines = 3, block }) {
  if (block) return <span className="ui-skel block" aria-hidden="true" />;
  return <div aria-hidden="true">{Array.from({ length: lines }, (_, i) => <span key={i} className="ui-skel line-s" style={{ width: i === lines - 1 ? '60%' : '100%' }} />)}</div>;
}

export function Alert({ tone = 'info', icon, title, children, className }) {
  const ic = icon || { ok: 'ok', warn: 'warn', danger: 'warn', info: 'info' }[tone];
  return <div className={cx('ui-alert', tone, className)} role={tone === 'danger' ? 'alert' : 'status'}><Icon name={ic} /><div>{title ? <b>{title}</b> : null}{children}</div></div>;
}

/** Indicateur chiffré. tone : brand | ok | warn | danger. */
export function Stat({ label, value, sub, subTone, icon, tone = 'brand', onClick, to }) {
  const inner = <>{icon ? <span className="ico"><Icon name={icon} /></span> : null}<span className="lbl">{label}</span><span className="val">{value}</span>{sub ? <span className={cx('sub', subTone)}>{sub}</span> : null}</>;
  const cls = cx('ui-stat', 'tone-' + tone);
  if (to) return <Link className={cls} to={to}>{inner}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return <div className="ui-page-h"><div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{actions ? <div className="row">{actions}</div> : null}</div>;
}

/** Tableau : columns [{ key, label, align?:'r', render?:(row)=>node }], rows, rowKey. Défilement horizontal sur petit écran. */
export function Table({ columns, rows, rowKey = 'id', empty, onRowClick, caption, foot }) {
  if (!rows.length && empty) return <EmptyState title={empty} />;
  return (
    <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="ui-table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col" className={c.align === 'r' ? 'r' : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r[rowKey]} onClick={onRowClick ? () => onRowClick(r) : undefined} style={onRowClick ? { cursor: 'pointer' } : undefined}>
            {columns.map((c) => <td key={c.key} className={c.align === 'r' ? 'r num' : undefined}>{c.render ? c.render(r) : r[c.key]}</td>)}
          </tr>
        ))}</tbody>
        {foot ? <tfoot>{foot}</tfoot> : null}
      </table>
    </div>
  );
}

/** Tiroir latéral (droite par défaut). Échap ou clic sur le fond pour fermer ; le focus y entre et revient à l'élément d'origine. */
export function Drawer({ title, onClose, side = 'right', wide, children }) {
  const t = useT();
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const first = ref.current && ref.current.querySelector('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
    const key = (e) => { if (e.key === 'Escape') onClose(); else if (e.key === 'Tab' && ref.current) trap(e, ref.current); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); };
  }, [onClose]);
  return (
    <>
      <div className="ui-drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className={cx('ui-drawer', side === 'left' && 'left', wide && 'wide')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="ui-drawer-h"><h2>{title}</h2><button type="button" className="x" aria-label={t('Fermer')} onClick={onClose}><Icon name="close" /></button></div>
        <div className="ui-drawer-b">{children}</div>
      </aside>
    </>
  );
}

/** Garde le focus clavier dans une fenêtre (Tab / Maj+Tab). */
export function trap(e, root) {
  const f = [...root.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const a = f[0], z = f[f.length - 1];
  if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
}

/** Enveloppe de graphique : titre, légende, zone de tracé, note d'accessibilité (résumé texte). */
export function ChartFrame({ title, subtitle, actions, legend, summary, height = 260, children }) {
  return (
    <figure className="ui-chart" style={{ margin: 0 }}>
      <div className="ui-chart-h"><div><h3>{title}</h3>{subtitle ? <small>{subtitle}</small> : null}</div>{actions || null}</div>
      <div className="ui-chart-body" style={{ height }} role="img" aria-label={summary || title}>{children}</div>
      {legend ? <div className="ui-legend">{legend.map((l) => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}</div> : null}
      {summary ? <figcaption className="sr-only">{summary}</figcaption> : null}
    </figure>
  );
}
