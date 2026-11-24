import { useSyncExternalStore } from 'react';
/* Compteur de messages non lus du chat (pastille du menu). Alimenté par le module et par la balise (Beacon) quand le chat n'est pas ouvert. */
let value = 0; const subs = new Set();
export const setChatUnread = (n) => { if (n !== value) { value = n; subs.forEach((f) => f()); } };
export const useChatUnread = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => value);
