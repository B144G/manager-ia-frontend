import { useId, useState } from 'react';
import { Icon } from '../lib/fa.jsx';
import { useT } from '../lib/i18n.jsx';
import './icons.js';

/* Petits éléments communs du centre de confidentialité et de la sécurité du compte (sans dépendance à l'espace de travail : la page s'ouvre aussi seule). */

/** Carte de section : pastille d'icône, titre court, description courte. tone : '' | 'ok' | 'warn' | 'danger'. */
export function Section({ id, icon, title, desc, tone = '', danger, actions, children }) {
  return (
    <section className={'pv-sec' + (danger ? ' danger' : '')} id={id} aria-labelledby={id ? id + '-h' : undefined}>
      <header>
        <span className={'pv-ico ' + tone}><Icon name={icon} /></span>
        <div style={{ flex: 1, minWidth: 0 }}><h2 id={id ? id + '-h' : undefined}>{title}</h2>{desc ? <p>{desc}</p> : null}</div>
        {actions ? <div className="pv-act">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export const Rows = ({ children }) => <div className="pv-rows">{children}</div>;
export const Row = ({ title, desc, children }) => (
  <div className="pv-row"><div><b>{title}</b>{desc ? <small>{desc}</small> : null}</div>{children ? <div className="pv-act">{children}</div> : null}</div>
);

/** Encadré d'information (tone : info | ok | warn | danger). */
export function Note({ tone = 'info', icon, children }) {
  return <div className={'pv-note ' + tone} role={tone === 'danger' ? 'alert' : 'note'}><Icon name={icon || (tone === 'ok' ? 'pv-ok' : tone === 'info' ? 'pv-info' : 'pv-warn')} /><div>{children}</div></div>;
}

export function Empty({ icon = 'pv-info', title, children }) {
  return <div className="pv-empty"><span className="pv-ico"><Icon name={icon} /></span><b>{title}</b>{children ? <span>{children}</span> : null}</div>;
}

/** Message de retour d'une action (succès ou erreur), annoncé aux lecteurs d'écran. */
export function Msg({ f }) {
  if (!f) return null;
  return <p role={f.bad ? 'alert' : 'status'} className={'pv-msg ' + (f.bad ? 'bad' : 'ok')}>{f.text}</p>;
}

/** Champ de mot de passe avec bouton afficher / masquer. */
export function PasswordInput({ label, value, onChange, autoComplete = 'current-password', hint, id: idIn, describedBy }) {
  const t = useT();
  const gen = useId(); const id = idIn || gen;
  const [show, setShow] = useState(false);
  return (
    <label className="pv-field" htmlFor={id}>
      <span>{label}</span>
      <span className="pv-pw">
        <input id={id} type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} />
        <button type="button" aria-label={show ? t('Masquer le mot de passe') : t('Afficher le mot de passe')} aria-pressed={show} onClick={() => setShow(!show)}><Icon name={show ? 'pv-eye-off' : 'pv-eye'} /></button>
      </span>
      {hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}

/** Robustesse d'un mot de passe : 0 à 4, avec les critères remplis (le serveur exige au moins 8 caractères avec lettres et chiffres). */
export function strengthOf(pw) {
  const p = String(pw || '');
  const c = { len: p.length >= 8, letters: /[A-Za-zÀ-ÿ]/.test(p), digits: /\d/.test(p), mixed: /[a-zà-ÿ]/.test(p) && /[A-ZÀ-Ý]/.test(p), symbol: /[^A-Za-z0-9À-ÿ]/.test(p), long: p.length >= 12 };
  if (!p) return { score: 0, c };
  let s = 0;
  if (c.len && c.letters && c.digits) s = 2;
  else if (p.length >= 6) s = 1;
  if (s >= 2 && (c.long || c.mixed) && (c.symbol || c.long)) s = 3;
  if (s >= 3 && c.long && c.mixed && c.symbol) s = 4;
  if (s === 0 && p) s = 1;
  return { score: s, c };
}
const LABELS = ['', 'Trop faible', 'Correct', 'Bon', 'Excellent'];
export function StrengthMeter({ value, id }) {
  const t = useT();
  const { score, c } = strengthOf(value);
  const item = (ok, txt) => <li className={ok ? 'on' : ''}><Icon name={ok ? 'pv-check' : 'pv-x'} />{txt}</li>;
  return (
    <div className="pv-meter" data-s={score} id={id}>
      <div className="pv-bars" aria-hidden="true"><i /><i /><i /><i /></div>
      <small role="status" aria-live="polite">{value ? t('Robustesse : {niveau}', { niveau: t(LABELS[score]) }) : t('Choisissez un mot de passe que vous n’utilisez nulle part ailleurs.')}</small>
      <ul className="pv-checks" aria-label={t('Critères')}>{item(c.len, t('8 caractères ou plus'))}{item(c.letters && c.digits, t('Lettres et chiffres'))}{item(c.mixed, t('Majuscules et minuscules'))}{item(c.symbol || c.long, t('Un symbole ou 12 caractères'))}</ul>
    </div>
  );
}

export async function copyText(text) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
export function saveText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}
