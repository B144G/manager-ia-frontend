import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useT } from '../../../lib/i18n.jsx';

/* Carte OpenStreetMap (Leaflet) : fond gratuit, mention d'attribution obligatoire, aucune clé.
   Points : le client (épingle bleue), les transporteurs (VERT = disponible, ROUGE = indisponible ; pointillé = position ancienne), le dépôt.
   Chaque point porte aussi un signe (✓ / ✕) : la couleur n'est jamais le seul signal. Clic sur la carte : pose le point du client (si onPick).
   Les données sont posées dans des nœuds DOM (textContent) : jamais de HTML construit à partir d'une donnée. */
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

function dot(cls, glyph, label) {
  const el = document.createElement('div');
  el.className = 'geo-pin ' + cls; el.setAttribute('aria-label', label);
  const g = document.createElement('span'); g.textContent = glyph; el.appendChild(g);
  return L.divIcon({ html: el, className: 'geo-pin-wrap', iconSize: [30, 30], iconAnchor: [15, 15] });
}

export default function GeoMap({ client, depot, drivers = [], selectedId, onSelect, onPick, points = [], height = 380, ariaLabel }) {
  const t = useT();
  const box = useRef(null); const map = useRef(null); const layer = useRef(null); const fitted = useRef('');
  const pick = useRef(onPick); pick.current = onPick;

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([4.05, 9.7], 11);
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e) => { if (pick.current) pick.current(Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6); });
    m.on('focus', () => m.scrollWheelZoom.enable()); m.on('blur', () => m.scrollWheelZoom.disable());
    map.current = m;
    setTimeout(() => m.invalidateSize(), 0);
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current; const g = layer.current; if (!m || !g) return;
    g.clearLayers();
    const bounds = [];
    const add = (lat, lng, icon, title, on) => {
      const mk = L.marker([lat, lng], { icon, title, keyboard: true, riseOnHover: true }).addTo(g);
      if (on) mk.on('click', on);
      bounds.push([lat, lng]); return mk;
    };
    if (depot) add(depot.lat, depot.lng, dot('depot', 'D', t('Dépôt')), t('Dépôt'));
    for (const p of points) add(p.lat, p.lng, dot('party ' + (p.cls || ''), p.glyph || '•', p.label), p.label, p.onClick);
    if (client) add(client.lat, client.lng, dot('client', '★', t('Client')), t('Client'));
    for (const d of drivers) {
      if (!d.position) continue;
      const cls = (d.available ? 'ok' : 'bad') + (d.position.state === 'stale' ? ' stale' : '') + (d.id === selectedId ? ' sel' : '');
      const label = `${d.name} — ${d.available ? t('Disponible') : t('Indisponible')}`;
      add(d.position.lat, d.position.lng, dot(cls, d.available ? '✓' : '✕', label), label, () => onSelect && onSelect(d.id));
      if (client && d.id === selectedId) L.polyline([[d.position.lat, d.position.lng], [client.lat, client.lng]], { color: '#1d4ed8', weight: 3, dashArray: '6 8' }).addTo(g);
    }
    const key = bounds.map((b) => b.join(',')).join('|');
    if (bounds.length && key !== fitted.current) {
      fitted.current = key;
      if (bounds.length === 1) m.setView(bounds[0], 15); else m.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    }
  }, [client, depot, drivers, selectedId, points]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className={'geo-map' + (onPick ? ' picking' : '')} style={{ height }} role="application" aria-label={ariaLabel || t('Carte OpenStreetMap')} tabIndex={0} />;
}
