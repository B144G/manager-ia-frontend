import { getLocale } from '../../../lib/i18n.jsx';

/* Textes du chat : liens et mentions rendus SANS jamais construire de HTML (React échappe tout) ; dates ; émojis. */
const URL_RX = /(https?:\/\/[^\s<>"']+)/g;
export function renderText(body, names = []) {
  const out = [];
  const lowNames = names.filter(Boolean).sort((a, b) => b.length - a.length);
  const parts = String(body || '').split(URL_RX);
  parts.forEach((p, i) => {
    if (i % 2 === 1) { // lien : seulement http(s), ouvert dans un nouvel onglet sans accès à la page d'origine
      out.push(<a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow">{p}</a>);
      return;
    }
    // mentions : @tous / @nom (en évidence)
    const rest = p; let k = 0;
    const rx = new RegExp('@(tous|all|everyone' + (lowNames.length ? '|' + lowNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : '') + ')(?![\\p{L}\\p{N}_])', 'giu');
    let m; let last = 0;
    while ((m = rx.exec(rest))) {
      if (m.index > last) out.push(rest.slice(last, m.index));
      out.push(<span key={`${i}-${k++}`} className="ci-mention">{m[0]}</span>);
      last = m.index + m[0].length;
    }
    out.push(rest.slice(last));
  });
  return out;
}
export const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const dayKey = (iso) => String(iso).slice(0, 10);
export function fmtDay(iso, t) {
  const d = new Date(iso); const now = new Date();
  const y = new Date(now.getTime() - 86400000);
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return t("Aujourd'hui");
  if (same(d, y)) return t('Hier');
  return d.toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
}
/** Date courte pour la liste : l'heure si c'est aujourd'hui, sinon le jour. */
export function fmtShort(iso, t) {
  if (!iso) return '';
  const d = new Date(iso); const now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(iso);
  if (now - d < 6 * 86400000) return d.toLocaleDateString(getLocale(), { weekday: 'short' });
  return d.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit' });
}
export { dayKey };
export const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : n >= 1024 ? `${Math.round(n / 1024)} Ko` : `${n} o`);
export const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
export const fmtSeen = (iso, t) => { if (!iso) return t('Hors ligne'); const d = new Date(iso); const m = Math.round((Date.now() - d) / 60000); return m < 1 ? t("À l'instant") : m < 60 ? t('Vu il y a {n} min', { n: m }) : t('Vu {when}', { when: fmtShort(iso, t) }); };

export const EMOJIS = [
  ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '😉', '😊', '😍', '🥰', '😘', '😎', '🤔', '😐', '😴', '😢', '😭', '😡', '🤯', '😱', '🙄'],
  ['👍', '👎', '👏', '🙏', '💪', '🤝', '👌', '✌️', '🤞', '👋', '🙌', '🫡', '❤️', '💔', '🔥', '⭐', '🎉', '✅', '❌', '⚠️', '❓', '💯', '🚀', '💡'],
  ['📅', '⏰', '📎', '📄', '📊', '💼', '💰', '🧾', '📦', '🚚', '📞', '📍', '🏢', '🛒', '🔧', '📢', '🕐', '☕', '🍽️', '🎂', '🌍', '🇨🇲', '🌧️', '☀️'],
];
