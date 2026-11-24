import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import composerCss from '../styles/composer.css?inline';
import vitrineCss from '../styles/vitrine.css?inline';
import { useT } from '../lib/i18n.jsx';
import Audience from './vitrine/Audience.jsx';
import Faq from './vitrine/Faq.jsx';
import Final from './vitrine/Final.jsx';
import Testimonials from './vitrine/Testimonials.jsx';
import Footer from './vitrine/Footer.jsx';
import Header from './vitrine/Header.jsx';
import Hero, { ExampleChat } from './vitrine/Hero.jsx';
import Stats from './vitrine/Stats.jsx';
import Steps3 from './vitrine/Steps3.jsx';
import Story from './vitrine/Story.jsx';
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
    <div className="vt-modal" role="dialog" aria-modal="true" aria-label={t('Vidéo de présentation de MABAH')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="box">
        <button type="button" className="x" aria-label={t('Fermer')} autoFocus onClick={onClose}>×</button>
        <video controls autoPlay playsInline preload="none" poster="/video/poster.jpg" aria-label={t('Vidéo de présentation de MABAH')}><source src="/video/manager-ia.mp4" type="video/mp4" /></video>
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

  // Apparition douce des blocs « .vt-rv » : seuls ceux encore sous l'écran sont masqués (.vt-pre) puis révélés ; une minuterie de sécurité
  // les révèle tous au bout de 4 s, donc rien ne reste jamais invisible (JavaScript lent, observateur défaillant, etc.).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('js-vt');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return () => root.classList.remove('js-vt');
    const els = [...page.current.querySelectorAll('.vt-rv')];
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove('vt-pre'); io.unobserve(e.target); } }), { threshold: 0.05, rootMargin: '0px 0px -4% 0px' });
    els.forEach((n) => { if (n.getBoundingClientRect().top > window.innerHeight) { n.classList.add('vt-pre'); io.observe(n); } });
    const safety = setTimeout(() => els.forEach((n) => n.classList.remove('vt-pre')), 4000);
    return () => { clearTimeout(safety); io.disconnect(); root.classList.remove('js-vt'); };
  }, []);

  return (
    <div className="vt-page" ref={page}>
      <Header />
      <main id="contenu">
        <Hero onPlay={() => setVideo(true)} />
        <Stats modules={mods.length} />
        <Problem />
        <Story chat={<ExampleChat compact />} />
        <Modules mods={mods} />
        <Audience />
        <Steps3 />
        <Pricing />
        <Security />
        <Testimonials />
        <Faq />
        <Final />
      </main>
      <Footer onPlay={() => setVideo(true)} />
      {late ? <Suspense fallback={null}><SiteAssistant /></Suspense> : null}
      {video ? <VideoModal onClose={() => setVideo(false)} /> : null}
    </div>
  );
}
