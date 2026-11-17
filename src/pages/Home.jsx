import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import composerCss from '../styles/composer.css?inline';
import vitrineCss from '../styles/vitrine.css?inline';
import { useT } from '../lib/i18n.jsx';
import Carousel from './vitrine/Carousel.jsx';
import Faq from './vitrine/Faq.jsx';
import Final from './vitrine/Final.jsx';
import Footer from './vitrine/Footer.jsx';
import Header from './vitrine/Header.jsx';
import Hero from './vitrine/Hero.jsx';
import How from './vitrine/How.jsx';
import Modules, { useModules } from './vitrine/Modules.jsx';
import Pricing from './vitrine/Pricing.jsx';
import Problem from './vitrine/Problem.jsx';
import Security from './vitrine/Security.jsx';

// L'assistant du site (bulle flottante) se charge après l'affichage de la page.
const SiteAssistant = lazy(() => import('../components/SiteAssistant.jsx'));

/** Fenêtre de la vidéo : Échap ou clic à côté pour fermer, le focus revient là où il était. */
function VideoModal({ onClose }) {
  const t = useT();
  const last = useRef(document.activeElement);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; if (last.current && last.current.focus) last.current.focus(); };
  }, [onClose]);
  return (
    <div className="vt-modal" role="dialog" aria-modal="true" aria-label={t('Vidéo de présentation de Brij-IA')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="box">
        <button type="button" className="x" aria-label={t('Fermer')} autoFocus onClick={onClose}>×</button>
        <video controls autoPlay playsInline preload="none" poster="/video/poster.jpg" aria-label={t('Vidéo de présentation de Brij-IA')}><source src="/video/manager-ia.mp4" type="video/mp4" /></video>
      </div>
    </div>
  );
}

/** Page de présentation (accueil public). Sections : en-tête, hero, constat et solution, aperçu en images, modules, étapes et démonstration WhatsApp, tarifs, sécurité, questions, appel final, pied de page. */
export default function Home() {
  const [video, setVideo] = useState(false);
  const page = useRef(null);
  const mods = useModules();
  const [late, setLate] = useState(false);
  // Feuille de style de la présentation : posée avant l'affichage, retirée en quittant la page.
  useLayoutEffect(() => {
    const els = [vitrineCss, composerCss].map((css) => { const el = document.createElement('style'); el.setAttribute('data-mia', 'vitrine'); el.textContent = css; document.head.appendChild(el); return el; });
    return () => els.forEach((e) => e.remove());
  }, []);
  useEffect(() => { const id = setTimeout(() => setLate(true), 1200); return () => clearTimeout(id); }, []);

  // Apparition douce des blocs « .vt-rv » au défilement (rien ne bouge si la personne préfère moins d'animations ; sans JavaScript tout reste visible).
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window) || reduce) return undefined;
    root.classList.add('js-vt');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    page.current.querySelectorAll('.vt-rv').forEach((n) => io.observe(n));
    return () => { io.disconnect(); root.classList.remove('js-vt'); };
  }, []);

  return (
    <div className="vt-page" ref={page}>
      <Header />
      <main id="contenu">
        <Hero onPlay={() => setVideo(true)} modules={mods.length} />
        <Problem />
        <Carousel />
        <Modules mods={mods} />
        <How />
        <Pricing />
        <Security />
        <Faq />
        <Final />
      </main>
      <Footer />
      {late ? <Suspense fallback={null}><SiteAssistant /></Suspense> : null}
      {video ? <VideoModal onClose={() => setVideo(false)} /> : null}
    </div>
  );
}
