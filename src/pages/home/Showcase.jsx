import { useCallback, useEffect, useRef, useState } from 'react';
import { ICONS } from '../../lib/icons.js';

const GROUPS = ['Vendre', 'Finances', 'Opérations', 'Équipe', 'Pilotage'];
const MODS = [
  ['sales', 'Vendre', 'Assistant commercial', "Répond sur WhatsApp, Messenger et Instagram, enregistre les prospects et prend les commandes."],
  ['crm', 'Vendre', 'Clients et ventes', 'Devis, factures, paiements et impayés, avec la relance déjà rédigée.'],
  ['marketing', 'Vendre', 'Marketing', 'Campagnes, coût par prospect, calendrier de contenu et offres.'],
  ['support', 'Vendre', 'Service client', 'Toutes les demandes au même endroit, avec un brouillon de réponse.'],
  ['accounting', 'Finances', 'Comptabilité', 'Écritures automatiques, balance, résultat et bilan simplifié.'],
  ['budget', 'Finances', 'Budget', 'Entrées, sorties et limites par catégorie, avec alertes.'],
  ['payroll', 'Finances', 'Paie', 'Bulletins, retenues paramétrables, écritures comptables.'],
  ['fiscal', 'Finances', 'Fiscalité et liasse', 'États de travail, TVA estimée et calendrier des déclarations.'],
  ['stock', 'Opérations', 'Stock et achats', 'Alertes de rupture, fournisseurs comparés, commandes à valider.'],
  ['logistics', 'Opérations', 'Logistique', 'Livraisons, transporteurs, zones et tournées.'],
  ['production', 'Opérations', 'Production', 'Nomenclatures, coût de revient et ordres de fabrication.'],
  ['maintenance', 'Opérations', 'Maintenance', 'Équipements, plans préventifs, pannes et pièces.'],
  ['construction', 'Opérations', 'Chantiers (BTP)', 'Phases, budget, pointages, rapports et situations de travaux.'],
  ['hr', 'Équipe', 'Ressources humaines', 'Employés, congés et planning de la semaine.'],
  ['projects', 'Équipe', 'Projets et tâches', "Décrivez un objectif : l'IA le découpe en tâches."],
  ['structure', 'Équipe', 'Organisation', "Qui fait quoi, et quels postes manquent."],
  ['processes', 'Équipe', 'Fonctionnement', 'Vos procédures, étape par étape.'],
  ['legal', 'Pilotage', 'Juridique et conformité', 'Contrats, échéances, obligations et modèles de documents.'],
  ['memory', 'Pilotage', "Mémoire de l'entreprise", 'Décisions et historique, avec des réponses sourcées.'],
  ['agents', 'Pilotage', 'Agents spécialisés', 'Une équipe d\'agents par domaine, avec une synthèse.'],
  ['alerts', 'Pilotage', 'Alertes et résumé', 'Ce qui est urgent, chaque matin, jusque sur WhatsApp.'],
].map(([id, group, title, text]) => ({ id, group, title, text }));

/** Carrousel horizontal de blocs : un bloc par sous-application, regroupés par métier (onglets). */
export default function Showcase() {
  const [group, setGroup] = useState('Tous');
  const rail = useRef(null);
  const drag = useRef({ down: false, moved: false, sx: 0, sl: 0 });
  const [pos, setPos] = useState({ p: 0, atStart: true, atEnd: false });
  const list = group === 'Tous' ? MODS : MODS.filter((m) => m.group === group);

  const update = useCallback(() => {
    const r = rail.current; if (!r) return;
    const max = Math.max(r.scrollWidth - r.clientWidth, 1);
    setPos({ p: r.scrollLeft / max, atStart: r.scrollLeft <= 2, atEnd: r.scrollLeft >= max - 2 });
  }, []);
  useEffect(() => { if (rail.current) rail.current.scrollTo({ left: 0 }); update(); }, [group, update]);
  useEffect(() => {
    window.addEventListener('resize', update);
    const move = (e) => { const d = drag.current; if (!d.down) return; const dx = e.clientX - d.sx; if (Math.abs(dx) > 4) { d.moved = true; rail.current.classList.add('drag'); } rail.current.scrollLeft = d.sl - dx; };
    const up = () => { if (drag.current.down) { drag.current.down = false; if (rail.current) rail.current.classList.remove('drag'); } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [update]);

  const step = () => { const c = rail.current && rail.current.querySelector('.s-mod'); return c ? c.getBoundingClientRect().width + 16 : 320; };
  const go = (dir) => rail.current && rail.current.scrollBy({ left: dir * step() * 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const onKey = (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } };

  return (
    <div className="s-show">
      <div className="s-seg" role="tablist" aria-label="Domaines">
        {['Tous', ...GROUPS].map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>
      <div className="s-railwrap">
        <button type="button" className="s-arr prev" aria-label="Blocs précédents" disabled={pos.atStart} onClick={() => go(-1)}><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></button>
        <div className="s-rail2" ref={rail} tabIndex={0} role="region" aria-label="Sous-applications de MANAGER-IA" onScroll={update} onKeyDown={onKey}
          onPointerDown={(e) => { if (e.pointerType !== 'mouse') return; drag.current = { down: true, moved: false, sx: e.clientX, sl: rail.current.scrollLeft }; }}
          onClickCapture={(e) => { if (drag.current.moved) { e.preventDefault(); e.stopPropagation(); drag.current.moved = false; } }}>
          {list.map((m) => (
            <article className="s-mod" key={m.id}>
              <div className="pic" data-zoom="" tabIndex={0} role="button" aria-label={'Agrandir : ' + m.title}>
                <img src={`/assets/mods/${m.id}.jpg`} alt={'Écran « ' + m.title + ' » de MANAGER-IA (données d\'exemple)'} width="800" height="520" loading="lazy" draggable="false" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                <span className="tg">{m.group}</span>
              </div>
              <div className="tx">
                <span className="ic"><svg viewBox="0 0 24 24"><path d={ICONS[m.id] || ICONS.dashboard} /></svg></span>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </div>
            </article>
          ))}
        </div>
        <button type="button" className="s-arr next" aria-label="Blocs suivants" disabled={pos.atEnd} onClick={() => go(1)}><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg></button>
      </div>
      <div className="s-prog" aria-hidden="true"><i style={{ width: Math.max(12, 100 * (pos.p * 0.7 + 0.3 * (list.length > 1 ? 1 / list.length : 1))) + '%' }} /></div>
      <p className="s-note">Écrans d'exemple, avec des données de démonstration.</p>
    </div>
  );
}
