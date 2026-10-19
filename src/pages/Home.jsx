import { useEffect, useRef, useState } from 'react';
import SiteAssistant from '../components/SiteAssistant.jsx';
import Contact from './home/Contact.jsx';
import Control from './home/Control.jsx';
import Faq from './home/Faq.jsx';
import Final from './home/Final.jsx';
import Footer from './home/Footer.jsx';
import Header from './home/Header.jsx';
import Hero from './home/Hero.jsx';
import Marquee from './home/Marquee.jsx';
import Plans from './home/Plans.jsx';
import Product from './home/Product.jsx';
import Rail from './home/Rail.jsx';
import Soon from './home/Soon.jsx';
import Story from './home/Story.jsx';
import Who from './home/Who.jsx';

/** Fenêtre (vidéo ou aperçu agrandi) : Échap ou clic à côté pour fermer, le focus revient là où il était. */
function Lightbox({ onClose, label, children }) {
  const last = useRef(document.activeElement);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; if (last.current && last.current.focus) last.current.focus(); };
  }, [onClose]);
  return (
    <div className="s-modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="box"><button type="button" className="x" aria-label="Fermer" autoFocus onClick={onClose}>×</button>{children}</div>
    </div>
  );
}

export default function Home() {
  const [video, setVideo] = useState(false);
  const [zoom, setZoom] = useState(null);
  const page = useRef(null);

  // Apparition douce des blocs « .rv » au défilement (sauf si la personne préfère moins d'animations)
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window) || reduce) return undefined;
    root.classList.add('js');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    page.current.querySelectorAll('.rv').forEach((n) => io.observe(n));
    return () => { io.disconnect(); root.classList.remove('js'); };
  }, []);

  // Agrandir un aperçu : clic, Entrée ou Espace sur l'image (délégation d'événements)
  const openZoom = (el) => { const im = el.querySelector('img'); if (im) setZoom({ src: im.currentSrc || im.src, alt: im.getAttribute('alt') || '' }); };
  const onClick = (e) => { const el = e.target.closest('[data-zoom]'); if (el && page.current.contains(el)) openZoom(el); };
  const onKeyDown = (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const el = e.target.closest && e.target.closest('[data-zoom]'); if (el && el === e.target) { e.preventDefault(); openZoom(el); } };

  return (
    <div ref={page} onClick={onClick} onKeyDown={onKeyDown}>
      <Header />
      <main id="haut">
        <Hero onPlay={() => setVideo(true)} />
        <Marquee />
        <Product />
        <Story />
        <Rail />
        <Who />
        <Control />
        <Soon />
        <Plans />
        <Faq />
        <Contact />
        <Final />
      </main>
      <Footer />
      <SiteAssistant />
      {video ? (
        <Lightbox label="Vidéo de présentation de MANAGER-IA" onClose={() => setVideo(false)}>
          <video controls autoPlay playsInline poster="/video/poster.jpg" aria-label="Vidéo de présentation de MANAGER-IA"><source src="/video/manager-ia.mp4" type="video/mp4" /></video>
        </Lightbox>
      ) : null}
      {zoom ? <Lightbox label={zoom.alt} onClose={() => setZoom(null)}><div className="s-zoom"><img src={zoom.src} alt={zoom.alt} /></div></Lightbox> : null}
    </div>
  );
}
