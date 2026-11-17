// Compatibilité : le thème est désormais géré par les préférences (src/lib/prefs.js).
import { getPrefs, initPrefs, setPrefs } from './prefs.js';
export const loadTheme = initPrefs;
export function isDark() {
  const t = getPrefs().theme;
  return t === 'dark' || (t === 'auto' && Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
}
export function toggleTheme() { setPrefs({ theme: isDark() ? 'light' : 'dark' }); }
