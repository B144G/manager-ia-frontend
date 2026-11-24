import { useSyncExternalStore } from 'react';

/* Préférences d'affichage de la personne (et marque de l'entreprise), stockées dans le navigateur.
   theme : 'auto' | 'light' | 'dark' ; accent : identifiant de la palette ou '#rrggbb' ; density : 'comfortable' | 'compact'
   favorites : identifiants de modules épinglés ; order : ordre personnel du menu ; views : vues enregistrées { [clé]: [{ id, name, state }] }
   brand : { [orgId]: { color, logo } } (couleur de marque et logo de l'entreprise, appliqués à toute l'équipe sur cet appareil).
   Un petit magasin réactif : useSyncExternalStore ; aucun appel serveur (le stockage côté serveur viendra si nécessaire). */

const KEY = 'mi_prefs_v1';
export const ACCENTS = [
  ['indigo', 'var(--brand-base)'], ['blue', '#1d4ed8'], ['teal', '#0f766e'], ['green', '#15803d'], ['orange', '#c2410c'], ['rose', '#be123c'], ['slate', '#334155'],
];
/* « indigo » = la couleur de MABAH, lue dans src/styles/tokens.css (--brand-base) : changer la palette = changer ce fichier seul. */
const FALLBACK_BRAND = '#4f46e5';
const accentHex = (v) => { if (!/^var\(/.test(v)) return v; try { return getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim(); } catch { return ''; } }; // '' = feuille de styles pas encore chargée : les jetons de tokens.css s'appliquent seuls
/** Couleur de marque de MABAH (tokens.css) en hexadécimal, pour les sélecteurs de couleur ; repli seulement si la feuille de styles n'est pas chargée. */
export const defaultBrandHex = () => { const v = accentHex('var(--brand-base)'); return /^#[0-9a-f]{6}$/i.test(v) ? v : FALLBACK_BRAND; };
const DEFAULTS = { theme: 'auto', accent: 'indigo', density: 'comfortable', favorites: [], order: [], views: {}, brand: {}, navMini: false };
let state = { ...DEFAULTS };
const subs = new Set();

function read() {
  try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && typeof j === 'object') state = { ...DEFAULTS, ...j }; } catch { /* stockage indisponible */ }
  // ancien réglage du thème (avant les préférences)
  try { const t = localStorage.getItem('mi_theme'); if (t && !localStorage.getItem(KEY)) state.theme = t === 'dark' ? 'dark' : 'light'; } catch { /* ignoré */ }
}
function write() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignoré */ } }

/* ---- Couleurs : contraste AA garanti pour une couleur choisie librement ---- */
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbHex = (r) => '#' + r.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const lum = (r) => { const c = r.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const WHITE = [255, 255, 255], DARKPAGE = [18, 26, 44], INK = [11, 18, 32];

/** Calcule les 4 valeurs de marque : clair, texte sur clair, sombre (éclairci), texte sur sombre. */
export function brandVars(hex) {
  let c = hexRgb(hex) || hexRgb(FALLBACK_BRAND);
  let guard = 0;
  while (contrast(c, WHITE) < 4.6 && guard++ < 40) c = mix(c, [0, 0, 0], 0.08); // assez foncé pour porter du texte blanc et servir de lien sur fond clair
  let d = c; guard = 0;
  while (contrast(d, DARKPAGE) < 5 && guard++ < 40) d = mix(d, WHITE, 0.1); // assez clair sur fond sombre
  const on = (x) => (contrast(x, WHITE) >= contrast(x, INK) ? '#ffffff' : '#0b1220');
  return { brand: rgbHex(c), onBrand: on(c), brandDk: rgbHex(d), onBrandDk: on(d) };
}

export function applyPrefs() {
  const root = document.documentElement;
  const theme = state.theme === 'auto' && serverTheme ? serverTheme : state.theme; // le thème par défaut de l'entreprise ne s'applique que si la personne n'a pas choisi le sien
  if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
  root.setAttribute('data-density', state.density);
  const org = currentOrgBrand();
  const pre = ACCENTS.find((a) => a[0] === state.accent);
  const hex = serverColor || (org && org.color ? org.color : pre ? accentHex(pre[1]) : /^#[0-9a-f]{6}$/i.test(state.accent) ? state.accent : FALLBACK_BRAND);
  if (!hex) { ['--brand', '--on-brand', '--brand-dk', '--on-brand-dk'].forEach((k) => root.style.removeProperty(k)); return; } // couleur de MABAH lue plus tard : les valeurs de tokens.css font foi
  const v = brandVars(hex);
  root.style.setProperty('--brand', v.brand); root.style.setProperty('--on-brand', v.onBrand);
  root.style.setProperty('--brand-dk', v.brandDk); root.style.setProperty('--on-brand-dk', v.onBrandDk);
  try { // couleur de la barre du navigateur (téléphone)
    const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.setAttribute('content', dark ? '#0a101e' : v.brand); });
  } catch { /* ignoré */ }
}

/* Marque de l'entreprise (réglée par l'administrateur, voir src/lib/brand.js) : couleur principale et thème par défaut. */
let serverColor = ''; let serverTheme = '';
export function setServerBrand({ color, theme }) { serverColor = color || ''; serverTheme = theme || ''; applyPrefs(); emit(); }

let orgId = null;
const currentOrgBrand = () => (orgId && state.brand[orgId]) || null;
export function setActiveOrg(id) { if (orgId !== id) { orgId = id; applyPrefs(); emit(); } }

function emit() { subs.forEach((f) => f()); }
export function setPrefs(patch) { state = { ...state, ...patch }; write(); applyPrefs(); emit(); }
export function setBrand(id, brand) { const b = { ...state.brand }; if (brand) b[id] = { ...(b[id] || {}), ...brand }; else delete b[id]; setPrefs({ brand: b }); }
export const getPrefs = () => state;
export function usePrefs() { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state); }
export function resetPrefs() { setPrefs({ ...DEFAULTS, brand: state.brand }); }

/** Favoris, ordre du menu et vues enregistrées. */
export const toggleFavorite = (id) => setPrefs({ favorites: state.favorites.includes(id) ? state.favorites.filter((x) => x !== id) : [...state.favorites, id] });
export const setOrder = (order) => setPrefs({ order });
export function saveView(key, name, data) { const l = (state.views[key] || []).filter((v) => v.name !== name); setPrefs({ views: { ...state.views, [key]: [...l, { id: name, name, state: data }] } }); }
export function deleteView(key, name) { setPrefs({ views: { ...state.views, [key]: (state.views[key] || []).filter((v) => v.name !== name) } }); }

export function initPrefs() {
  read(); applyPrefs();
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.theme === 'auto') applyPrefs(); }); } catch { /* ignoré */ }
}
