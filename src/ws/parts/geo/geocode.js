/* Recherche d'une adresse (service gratuit d'OpenStreetMap, Nominatim) : appelée seulement sur demande de la personne (bouton), une requête par clic,
   jamais en arrière-plan. L'adresse saisie est transmise à ce service : un avis le dit à côté du bouton. */
export async function searchAddress(q, lang) {
  const s = String(q || '').trim();
  if (s.length < 3) return [];
  const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&accept-language=' + encodeURIComponent(lang || 'fr') + '&q=' + encodeURIComponent(s), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('search');
  const j = await r.json();
  return (Array.isArray(j) ? j : []).map((x) => ({ label: String(x.display_name || '').slice(0, 160), lat: Math.round(Number(x.lat) * 1e6) / 1e6, lng: Math.round(Number(x.lon) * 1e6) / 1e6 })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
}
/** Position GPS de l'appareil (demande l'autorisation du navigateur). */
export const gpsHere = (opts = {}) => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
  navigator.geolocation.getCurrentPosition((p) => resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, accuracy: Math.round(p.coords.accuracy || 0) }), (e) => reject(e), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000, ...opts });
});
