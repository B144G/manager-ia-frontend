import { useCallback, useEffect, useRef, useState } from 'react';
import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import { shot } from './shared.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Carrousel des écrans de l'application : défilement tactile (scroll-snap), flèches, points, clavier, pause au survol/au focus,
    bouton pause, et aucune lecture automatique si la personne préfère moins d'animations. */
export default function Carousel() {
  const t = useT();
  const slides = [
    { id: 'crm', title: t('Clients et ventes'), text: t('Devis, commandes, factures et impayés au même endroit, avec la relance déjà rédigée.'), pts: [t('Factures et avoirs'), t('Mentions légales et TVA'), t('Envoi par e-mail ou WhatsApp')] },
    { id: 'stock', title: t('Stock et entrepôt'), text: t('Sachez ce qu\'il reste, où c\'est rangé, et ce qu\'il faut commander avant la rupture.'), pts: [t('Alertes de rupture'), t('Emplacements et inventaire'), t('Valeur du stock')] },
    { id: 'accounting', title: t('Comptabilité'), text: t('Vos factures, paiements et achats deviennent des écritures, avec résultat et bilan simplifié.'), pts: [t('Écritures automatiques'), t('Grand livre, balance, bilan'), t('Import des relevés bancaires')] },
    { id: 'payroll', title: t('Paie'), text: t('Bulletins de paie du mois, retenues paramétrables et écritures comptables.'), pts: [t('Paie du Cameroun'), t('Bulletins en PDF'), t('Envoi à chaque salarié')] },
    { id: 'budget', title: t('Budget'), text: t('Prévu, réalisé et reste à dépenser : pilotez vos sorties avec des alertes.'), pts: [t('Limites par catégorie'), t('Trésorerie'), t('Alertes de dépassement')] },
    { id: 'hr', title: t('Ressources humaines'), text: t('Employés, congés, planning de la semaine et dossiers du personnel.'), pts: [t('Demandes de congé'), t('Planning'), t('Contrats')] },
    { id: 'logistics', title: t('Logistique et transport'), text: t('Livraisons, retards, transporteurs et tournées : prévenez le client avant qu\'il ne vous appelle.'), pts: [t('Suivi des livraisons'), t('Zones et tournées'), t('Lien de suivi client')] },
    { id: 'projects', title: t('Projets et tâches'), text: t('Décrivez un objectif : l\'IA le découpe en tâches que vous répartissez dans l\'équipe.'), pts: [t('Portefeuille de projets'), t('Charge par personne'), t('Tâches en retard')] },
  ];
  const n = slides.length;
  const track = useRef(null);
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);       // survol ou focus
  const [paused, setPaused] = useState(true);    // pause demandée par la personne (démarre en pause tant qu'on ne sait pas)
  const [ready, setReady] = useState(false);
  useEffect(() => { setPaused(reduced()); setReady(true); }, []);

  const go = useCallback((k, smooth = true) => {
    const el = track.current; if (!el) return;
    const j = (k + n) % n;
    el.scrollTo({ left: j * el.clientWidth, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
    setI(j);
  }, [n]);
  const onScroll = () => { const el = track.current; if (!el || !el.clientWidth) return; setI(Math.round(el.scrollLeft / el.clientWidth)); };
  useEffect(() => {
    if (paused || hold || !ready) return undefined;
    const id = setInterval(() => go(i + 1), 6000);
    return () => clearInterval(id);
  }, [paused, hold, ready, i, go]);
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(n - 1); }
  };
  return (
    <section className="vt-sec vt-sec--soft" id="apercu" aria-labelledby="vt-car">
      <div className="vt-wrap">
        <div className="vt-head vt-rv"><span className="vt-eyebrow">{t("L'application en images")}</span><h2 className="vt-h2" id="vt-car">{t('Voyez ce que vous allez utiliser')}</h2><p>{t("De vraies pages de l'application, avec des données d'exemple.")}</p></div>
        <div className="vt-car" role="region" aria-roledescription={t('carrousel')} aria-label={t("Écrans de l'application")} onKeyDown={onKey}
          onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
          <div className="vt-track" ref={track} onScroll={onScroll} tabIndex={0} aria-live={paused || hold ? 'polite' : 'off'}>
            {slides.map((s, k) => (
              <div className="vt-slide" key={s.id} role="group" aria-roledescription={t('diapositive')} aria-label={`${k + 1} / ${n} : ${s.title}`}>
                <div className="vt-slide-txt">
                  <h3 className="vt-h3" style={{ fontSize: 'clamp(1.375rem,2.4vw,1.875rem)' }}>{s.title}</h3>
                  <p>{s.text}</p>
                  <ul>{s.pts.map((p) => <li key={p}><Fa name="check" />{p}</li>)}</ul>
                </div>
                <div className="vt-slide-img">
                  <img src={shot(s.id, 1280)} srcSet={`${shot(s.id, 720)} 720w, ${shot(s.id, 1280)} 1280w`} sizes="(min-width:900px) 640px, 90vw" width="1280" height="900" loading="lazy" decoding="async"
                    alt={t("Écran « {title} » de Brij-IA (données d'exemple)", { title: s.title })} />
                </div>
              </div>
            ))}
          </div>
          <div className="vt-carctl">
            <button type="button" className="vt-iconbtn" aria-label={t('Écran précédent')} onClick={() => go(i - 1)}><Fa name="arrow-left" /></button>
            <div className="vt-dots">
              {slides.map((s, k) => <button key={s.id} type="button" className="vt-dot" aria-label={t('Aller à {title}', { title: s.title })} aria-current={k === i ? 'true' : undefined} onClick={() => go(k)} />)}
            </div>
            <button type="button" className="vt-iconbtn" aria-label={t('Écran suivant')} onClick={() => go(i + 1)}><Fa name="arrow-right" /></button>
            <button type="button" className="vt-iconbtn" aria-label={paused ? t('Lancer le défilement automatique') : t('Mettre en pause le défilement automatique')} onClick={() => setPaused(!paused)}><Fa name={paused ? 'right' : 'stop'} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
