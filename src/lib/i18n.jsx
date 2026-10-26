import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/* Traduction du site et de l'application.
   - Le texte d'origine (français) sert de clé : t('Se connecter'). Le français est la langue par défaut et n'a pas de dictionnaire.
   - Les traductions sont dans src/i18n/<langue>/*.js : chaque fichier exporte par défaut { 'Texte français': 'Translation' }.
   - Variables : t('Bonjour {name}', { name }) ; le dictionnaire garde les mêmes {accolades}.
   - Un texte sans traduction s'affiche en français (jamais de page vide). */

export const LANGS = [
  { code: 'fr', label: 'Français', locale: 'fr-FR' },
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'es', label: 'Español', locale: 'es-ES' },
];
const KEY = 'mia-lang';
const loaders = import.meta.glob('../i18n/*/*.js');

let current = 'fr';
let dict = {};
const listeners = new Set();

const valid = (c) => LANGS.some((l) => l.code === c);
export const getLang = () => current;
export const getLocale = () => (LANGS.find((l) => l.code === current) || LANGS[0]).locale;

/** Traduit un texte français. Hors composant : utilisez cette fonction ; dans un composant : useT(). */
export function tr(text, vars) {
  const s = typeof text === 'string' ? text : String(text ?? '');
  let out = (current !== 'fr' && dict[s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
  if (current !== 'fr' && !dict[s] && typeof window !== 'undefined' && window.__miaMissing) window.__miaMissing.add(s);
  return out;
}

async function loadDict(code) {
  if (code === 'fr') return {};
  const files = Object.entries(loaders).filter(([p]) => p.startsWith(`../i18n/${code}/`));
  const mods = await Promise.all(files.map(([, load]) => load().catch(() => ({ default: {} }))));
  return Object.assign({}, ...mods.map((m) => m.default || {}));
}

export async function setLang(code) {
  const c = valid(code) ? code : 'fr';
  dict = await loadDict(c);
  current = c;
  try { localStorage.setItem(KEY, c); } catch { /* stockage indisponible */ }
  if (typeof document !== 'undefined') document.documentElement.lang = c;
  listeners.forEach((f) => f(c));
}

/** À appeler une fois au démarrage : relit le choix enregistré (français par défaut). */
export async function initLang() {
  let c = 'fr';
  try { c = localStorage.getItem(KEY) || 'fr'; } catch { /* stockage indisponible */ }
  if (c !== 'fr' && valid(c)) await setLang(c);
}

const Ctx = createContext({ lang: 'fr' });

export function I18nProvider({ children }) {
  const [lang, setL] = useState(current);
  useEffect(() => { const f = (c) => setL(c); listeners.add(f); return () => listeners.delete(f); }, []);
  const value = useMemo(() => ({ lang }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Fonction de traduction qui fait se redessiner le composant quand la langue change. */
export function useT() {
  const { lang } = useContext(Ctx);
  return useCallback((text, vars) => tr(text, vars), [lang]); // eslint-disable-line react-hooks/exhaustive-deps
}
export const useLang = () => useContext(Ctx).lang;
