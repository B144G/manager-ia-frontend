import { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/api.js';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';

/** Témoignages : seulement des avis approuvés par l'administrateur ET consentis par leur auteur (le serveur n'envoie rien d'autre). Rien n'est affiché s'il n'y en a pas. */
export default function Testimonials() {
  const t = useT();
  const [items, setItems] = useState([]);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`${API_BASE}/api/ws/public/testimonials?limit=6`, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : { items: [] })).then((j) => setItems(Array.isArray(j.items) ? j.items : []), () => {});
    return () => ctl.abort();
  }, []);
  if (!items.length) return null;
  return (
    <section className="vt-testi" aria-labelledby="vt-testi">
      <div className="vt-wrap">
        <h2 className="vt-h2" id="vt-testi">{t('Ils utilisent Brij-IA')}</h2>
        <ul className="vt-testi-list">
          {items.map((x) => (
            <li key={x.id} className="vt-testi-card">
              <p className="vt-testi-stars" aria-label={t('{n} sur 5', { n: x.stars })}>{'★'.repeat(x.stars)}{'☆'.repeat(5 - x.stars)}</p>
              <blockquote>{x.text}</blockquote>
              <footer>{x.name ? <b>{x.name}</b> : <b>{t('Un utilisateur de Brij-IA')}</b>} · {tsrv(x.moduleTitle)}</footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
