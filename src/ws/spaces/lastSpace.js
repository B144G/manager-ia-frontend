/* Dernier espace ouvert, retenu par personne et par entreprise sur cet appareil (le serveur le retient aussi, d'un appareil à l'autre).
   Le stockage peut être indisponible (navigation privée, données bloquées) : tout est protégé, l'application marche sans. */
const key = (orgId, userId) => `mabah-nav:space:${orgId}:${userId || 0}`;

export function getLastSpace(orgId, userId) {
  try { return localStorage.getItem(key(orgId, userId)) || null; } catch { return null; }
}

export function setLastSpace(orgId, userId, spaceId) {
  try { if (spaceId) localStorage.setItem(key(orgId, userId), spaceId); } catch { /* stockage indisponible */ }
}
