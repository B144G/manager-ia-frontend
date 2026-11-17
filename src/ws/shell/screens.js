import { useSyncExternalStore } from 'react';
/* Écrans du module affiché (publiés par ModuleShell) : alimentent le fil d'Ariane de l'en-tête et la recherche Ctrl K globale. */
let cur = { title: '', items: [], active: null, onSelect: null, go: null };
const subs = new Set();
export function publishScreens(v) { cur = v; subs.forEach((f) => f()); }
export function useScreens() { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur); }
let palette = () => {};
export const bindPalette = (f) => { palette = f; };
export const openPalette = () => palette();
