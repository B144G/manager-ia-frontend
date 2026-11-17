import { useEffect, useRef, useState } from 'react';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';

/** Compteur : la vraie valeur est dans la page dès le départ ; l'animation ne fait que la rejouer depuis zéro à l'apparition (désactivée si mouvement réduit). */
function Counter({ to }) {
  const ref = useRef(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window) || !ref.current) return undefined;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now) => { const p = Math.min(1, (now - t0) / 1200); setV(Math.round(to * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(tick); };
      setV(0); raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <b ref={ref}>{v}</b>;
}

/** Faits réels et vérifiables (nombre de modules lu dans la liste affichée), puis bandeau « paiements et canaux » sans suggestion de partenariat. */
export default function Stats({ modules }) {
  const t = useT();
  return (
    <section className="vt-band vt-dark" aria-label={t('Chiffres clés')}>
      <div className="vt-wrap">
        <dl className="vt-stats">
          <div className="vt-stat"><dt className="sr-only">{t('Modules')}</dt><dd style={{ margin: 0 }}><Counter to={modules} /><span>{t('modules intégrés')}</span></dd></div>
          <div className="vt-stat"><dt className="sr-only">{t('Langues')}</dt><dd style={{ margin: 0 }}><Counter to={4} /><span>{t('langues : français, anglais, allemand, espagnol')}</span></dd></div>
          <div className="vt-stat"><dt className="sr-only">{t("Niveaux d'accès")}</dt><dd style={{ margin: 0 }}><Counter to={4} /><span>{t("niveaux d'accès : propriétaire, administrateur, responsable, membre")}</span></dd></div>
          <div className="vt-stat"><dt className="sr-only">{t('Paiement')}</dt><dd style={{ margin: 0 }}><Counter to={2} /><span>{t('moyens de paiement Mobile Money : MTN et Orange')}</span></dd></div>
        </dl>
        <div className="vt-pay">
          <p>{t('Paiements et canaux')}</p>
          <ul>
            <li><Fa name="phone" />MTN Mobile Money</li>
            <li><Fa name="phone" />Orange Money</li>
            <li><Fa name="whatsapp" />WhatsApp</li>
          </ul>
          <small>{t("Noms cités à titre indicatif pour les moyens de paiement et le canal pris en charge ; cela ne suggère aucun partenariat officiel.")}</small>
        </div>
      </div>
    </section>
  );
}
