/* Migration douce des clés de stockage du navigateur : « brij-… » devient « mabah-… » (créé par scripts/rename-brand.mjs).
   Les anciennes valeurs sont COPIÉES (jamais effacées) vers les nouvelles clés au démarrage : personne n'est déconnecté, le choix des cookies
   et les guides déjà vus sont conservés. Ce fichier est la seule exception « Brij » autorisée du code du site. */
const EXACT = [['brij-cookies', 'mabah-cookies'], ['brij-guide-seen', 'mabah-guide-seen'], ['brij-guide-done', 'mabah-guide-done'], ['brij-2fa-nudge', 'mabah-2fa-nudge']];
const PREFIX = [['brij-seen:', 'mabah-seen:']];

function migrate(store) {
  if (!store) return;
  for (const [o, n] of EXACT) if (store.getItem(n) === null && store.getItem(o) !== null) store.setItem(n, store.getItem(o));
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    for (const [o, n] of PREFIX) if (k && k.startsWith(o) && store.getItem(n + k.slice(o.length)) === null) store.setItem(n + k.slice(o.length), store.getItem(k));
  }
}

export function migrateLegacyKeys() {
  for (const get of [() => window.localStorage, () => window.sessionStorage]) {
    try { migrate(get()); } catch { /* stockage indisponible : on continue */ }
  }
}

if (typeof window !== 'undefined') migrateLegacyKeys();
