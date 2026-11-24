/* Chiffrement de bout en bout des conversations à deux (WebCrypto, aucune bibliothèque externe).
   - Chaque appareil crée une paire de clés ECDH P-256. La clé PRIVÉE reste dans le navigateur (IndexedDB, non exportable) : elle n'est jamais envoyée.
   - Le serveur ne reçoit que la clé PUBLIQUE. Entre deux personnes, une clé AES-256-GCM est dérivée (ECDH) : seuls leurs appareils peuvent la calculer.
   - Chaque message ou fichier a son propre vecteur d'initialisation (IV) de 12 octets.
   Limites assumées (voir docs/chat-interne.md) : pas de synchronisation entre appareils, historique perdu si les données du navigateur sont effacées,
   conversations à deux seulement (pas les groupes). */
const DB = 'chat-e2ee'; const STORE = 'keys';
const b64 = (buf) => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_'); };
const unb64 = (s) => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const a = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; };

const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async (k) => { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
const idbSet = async (k, v) => { const d = await idb(); return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); };

export const supported = () => typeof crypto !== 'undefined' && Boolean(crypto.subtle) && typeof indexedDB !== 'undefined';

/** Clés de CET appareil pour cette personne dans cette entreprise (créées au premier usage). */
export async function ensureKeys(orgId, userId) {
  const k = `${orgId}:${userId}`;
  let rec = await idbGet(k);
  if (!rec) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']); // privée non exportable
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    rec = { privateKey: pair.privateKey, publicKey: pair.publicKey, jwk: JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }) };
    await idbSet(k, rec);
  }
  return rec;
}
const sameJwk = (a, b) => { try { const x = JSON.parse(a); const y = JSON.parse(b); return x.x === y.x && x.y === y.y; } catch { return false; } };
const cache = new Map();
/** Clé AES partagée avec l'autre personne (dérivée de MA clé privée et de SA clé publique). */
export async function sharedKey(mine, theirJwk) {
  const id = theirJwk;
  if (cache.has(mine.jwk + id)) return cache.get(mine.jwk + id);
  const j = JSON.parse(theirJwk);
  const pub = await crypto.subtle.importKey('jwk', { kty: j.kty, crv: j.crv, x: j.x, y: j.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const key = await crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, mine.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  cache.set(mine.jwk + id, key);
  return key;
}
export const sameKey = sameJwk;
const enc = new TextEncoder(); const dec = new TextDecoder();
export async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function decryptText(key, cipher) {
  const [iv, ct] = String(cipher).split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
  return dec.decode(pt);
}
/** Octets chiffrés : IV (12 octets) puis texte chiffré. */
export async function encryptBytes(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return out;
}
export async function decryptBytes(key, buf) {
  const a = new Uint8Array(buf);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: a.slice(0, 12) }, key, a.slice(12));
}
/** « Code de sécurité » à comparer de vive voix : empreinte des deux clés publiques (identique des deux côtés). */
export async function safetyCode(jwkA, jwkB) {
  const [x, y] = [jwkA, jwkB].map((j) => { const o = JSON.parse(j); return o.x + o.y; }).sort();
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(x + '|' + y)));
  return Array.from(h.slice(0, 10)).map((v) => String(v).padStart(3, '0')).join(' ').replace(/((?:\d{3} ){4})/g, '$1\n').trim();
}
