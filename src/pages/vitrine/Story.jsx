import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { shot } from './shared.js';

const Img = ({ id, alt, lazy = true }) => <img src={shot(id, 1280)} srcSet={`${shot(id, 720)} 720w, ${shot(id, 1280)} 1280w`} sizes="(min-width:980px) 640px, 92vw" width="1280" height="800" loading={lazy ? 'lazy' : undefined} decoding="async" alt={alt} />;

/** « De la commande WhatsApp à la facture et au stock » : quatre étapes, avec une vue collante qui change au défilement (ordinateur) ;
    sur téléphone chaque étape porte sa propre image. Sans JavaScript, tout reste lisible. */
export default function Story({ chat }) {
  const t = useT();
  const [on, setOn] = useState(0);
  const refs = useRef([]);
  const steps = [
    [t('Un client écrit sur WhatsApp'), t("L'assistant répond avec vos prix, enregistre le client et prépare la commande."), null],
    [t('Vous validez la commande'), t('Elle arrive dans Clients et ventes : vous la confirmez, la modifiez ou la refusez.'), 'crm'],
    [t('La facture suit'), t('Devis, facture, paiement et relance des impayés au même endroit.'), 'crm'],
    [t('Stock et comptabilité restent à jour'), t("Les modules partagent les mêmes données : rien n'est saisi deux fois."), 'stock'],
  ];
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setOn(Number(e.target.dataset.i)); }), { rootMargin: '-45% 0px -45% 0px' });
    refs.current.forEach((n) => n && io.observe(n));
    return () => io.disconnect();
  }, []);
  const alts = [t("Écran « Clients et ventes » de MABAH : liste des factures et montants à encaisser (données d'exemple)"), t("Écran « Stock et entrepôt » de MABAH (données d'exemple)")];
  return (
    <section className="vt-sec vt-dark vt-glow" id="parcours" aria-labelledby="vt-story">
      <div className="vt-wrap">
        <div className="vt-head vt-rv"><span className="vt-eyebrow">{t('Du premier message à la facture')}</span><h2 className="vt-h2" id="vt-story">{t('De la commande WhatsApp à la facture et au stock, sans ressaisie')}</h2></div>
        <div className="vt-story">
          <ol>
            {steps.map(([h, p, img], k) => (
              <li key={h} className={'vt-sstep' + (on === k ? ' is-on' : '')} data-i={k} ref={(n) => { refs.current[k] = n; }}>
                <span className="n" aria-hidden="true">{k + 1}</span>
                <h3 className="vt-h3">{h}</h3>
                <p>{p}</p>
                <div className="vt-shot">{img ? <Img id={img} alt={img === 'crm' ? alts[0] : alts[1]} /> : <div style={{ padding: 24, display: 'grid' }}>{chat}</div>}</div>
              </li>
            ))}
          </ol>
          <div className="vt-view" aria-hidden="true">
            <div className="vt-shot">
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: on === 0 ? 1 : 0, transition: 'opacity .5s' }}>{chat}</div>
              <img src={shot('crm', 1280)} alt="" className={on === 1 || on === 2 ? 'is-on' : ''} loading="lazy" width="1280" height="800" />
              <img src={shot('stock', 1280)} alt="" className={on === 3 ? 'is-on' : ''} loading="lazy" width="1280" height="800" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
