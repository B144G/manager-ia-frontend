// Thème clair / sombre, mémorisé si le navigateur le permet.
const root = document.documentElement;
export function loadTheme() {
  try { const t = localStorage.getItem('mi_theme'); if (t) root.setAttribute('data-theme', t); } catch { /* stockage indisponible */ }
}
export function isDark() {
  const t = root.getAttribute('data-theme');
  if (t) return t === 'dark';
  return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
export function toggleTheme() {
  const n = isDark() ? 'light' : 'dark';
  root.setAttribute('data-theme', n);
  try { localStorage.setItem('mi_theme', n); } catch { /* ignoré */ }
}
