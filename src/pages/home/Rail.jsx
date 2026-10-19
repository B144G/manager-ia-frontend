import { useCallback, useEffect, useRef, useState } from 'react';

const SLIDES = [
  ['support', "Boîte de demandes clients avec un brouillon de réponse de l'IA", 'Service client', "Toutes les demandes au même endroit, avec un brouillon de réponse rédigé par l'IA, prêt à envoyer."],
  ['projets', 'Tableau de tâches à faire, en cours et terminées', 'Projets et tâches', "Décrivez un objectif : l'IA le découpe en tâches avec des échéances. Avancement visible d'un coup d'œil."],
  ['budget', 'Budget avec entrées, sorties, solde et dépenses par catégorie', 'Budget', 'Entrées, sorties, solde et limites par catégorie, avec des alertes quand une dépense dérape.'],
  ['stock', 'Stock avec alertes de rupture et commande à valider', 'Stock et achats', 'Alertes de rupture, fournisseurs comparés, commande « à valider » puis stock et budget mis à jour.'],
  ['clients', 'Clients, factures, impayés et message de relance', 'Clients et ventes', 'Fiches clients, devis, factures et paiements. Les impayés sont signalés et la relance est rédigée.'],
  ['ventes-ligne', "Un prospect discute avec l'assistant et passe une commande", 'Assistant commercial', 'Il répond aux prospects après vos publicités, les enregistre et prend leurs commandes. Résultats par campagne.'],
  ['rh', 'Planning de la semaine et demande de congé', 'Ressources humaines', 'Employés, congés à accepter ou refuser, planning de la semaine. Salaires visibles des seuls administrateurs.'],
  ['comptabilite', "Comptabilité : journal d'écritures et compte de résultat", 'Comptabilité simple', "Plan OHADA de base, écritures automatiques, balance, résultat, bilan simplifié, TVA estimée, export Excel."],
  ['organisation', 'Organigramme avec direction, responsables et postes', 'Organisation', "Qui fait quoi, et quels postes manquent. L'IA suggère des postes que vous acceptez ou ignorez."],
  ['fonctionnement', 'Procédure en étapes cochées', 'Fonctionnement', "Vos procédures étape par étape, avec progression. L'IA en rédige une à partir d'une phrase."],
  ['equipe', 'Équipe avec rôles, antennes et invitation par lien', 'Équipe et antennes', 'Invitez par lien, choisissez le rôle, rattachez chacun à une antenne : chacun voit ce qui le concerne.'],
  ['canaux', 'Canaux et intégrations', 'Canaux et intégrations', "WhatsApp, Messenger, Instagram, e-mails, clés d'API et webhooks pour Zapier, Make ou n8n."],
];
const reduce = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Glissière horizontale des 12 sous-applications : flèches, glisser à la souris, points, flèches du clavier. */
export default function Rail() {
  const rail = useRef(null);
  const [pos, setPos] = useState({ idx: 0, atStart: true, atEnd: false });
  const drag = useRef({ down: false, moved: false, sx: 0, sl: 0 });
  const step = () => { const s = rail.current && rail.current.querySelector('.s-slide'); return s ? s.getBoundingClientRect().width + 20 : 400; };
  const update = useCallback(() => {
    const r = rail.current; if (!r) return;
    const max = r.scrollWidth - r.clientWidth - 2;
    setPos({ idx: Math.round(r.scrollLeft / step()), atStart: r.scrollLeft <= 2, atEnd: r.scrollLeft >= max });
  }, []);
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    const move = (e) => {
      const d = drag.current; if (!d.down) return;
      const dx = e.clientX - d.sx;
      if (Math.abs(dx) > 4) { d.moved = true; rail.current.classList.add('drag'); }
      rail.current.scrollLeft = d.sl - dx;
    };
    const up = () => { if (drag.current.down) { drag.current.down = false; if (rail.current) rail.current.classList.remove('drag'); } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [update]);
  const by = (n) => rail.current.scrollBy({ left: n * step(), behavior: reduce() ? 'auto' : 'smooth' });

  return (
    <section className="s-sec" id="modules">
      <div className="s-wrap">
        <div className="s-rail-head rv">
          <div className="s-head left"><span className="s-eyebrow">Votre espace de travail</span><h2>12 sous-applications, une seule IA</h2><p>Faites glisser pour toutes les voir. Chacune est une page de votre espace, et l'IA connaît vos données pour vous conseiller.</p></div>
          <div className="s-arrows">
            <button className="s-icon" id="prev" type="button" aria-label="Précédent" disabled={pos.atStart} onClick={() => by(-1)}><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></button>
            <button className="s-icon" id="next" type="button" aria-label="Suivant" disabled={pos.atEnd} onClick={() => by(1)}><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </div>
      </div>
      <div className="s-rail" id="rail" ref={rail} tabIndex={0} aria-label="Sous-applications, faites défiler horizontalement"
        onScroll={() => window.requestAnimationFrame(update)}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); by(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); by(-1); } }}
        onPointerDown={(e) => { if (e.pointerType !== 'mouse') return; drag.current = { down: true, moved: false, sx: e.clientX, sl: rail.current.scrollLeft }; }}
        onClickCapture={(e) => { if (drag.current.moved) { e.preventDefault(); e.stopPropagation(); drag.current.moved = false; } }}>
        {SLIDES.map((s, i) => (
          <article className="s-slide" key={s[2]}>
            <div className="th" data-zoom="" tabIndex={0} role="button" aria-label="Agrandir l'aperçu"><img src={`/assets/img/${s[0]}.svg`} alt={s[1]} width="640" height="420" loading="lazy" /></div>
            <div className="tx"><small>Sous-application {i + 1}</small><h3>{s[2]}</h3><p>{s[3]}</p></div>
          </article>
        ))}
      </div>
      <div className="s-wrap"><div className="s-dots" id="dots" aria-hidden="true">{SLIDES.map((s, i) => <i key={s[2]} className={i === pos.idx ? 'on' : ''} />)}</div></div>
    </section>
  );
}
