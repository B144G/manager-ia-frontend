import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const TABS = [
  { tab: 'Boutiques et commerces', title: 'Vendez même quand vous dormez', text: 'Après chaque publicité, des dizaines de personnes demandent « c\'est combien ? ». L\'IA répond à toutes, tout de suite.', points: ['Réponses sur WhatsApp, Messenger et Instagram', 'Prospects enregistrés, commandes à valider', 'Relances automatiques des prospects silencieux'], img: 'ventes-ligne', alt: "Un prospect discute avec l'assistant" },
  { tab: 'Grossistes', title: 'Ne soyez plus jamais en rupture', text: "Le stock, les fournisseurs et les impayés au même endroit, avec une IA qui prévient avant que le problème grossisse.", points: ['Alerte sous le seuil, commande proposée', 'Fournisseurs comparés sur le prix et le délai', 'Factures impayées relancées chaque semaine'], img: 'stock', alt: 'Stock avec commande à valider' },
  { tab: 'PME de services', title: 'Des devis à la comptabilité, sans ressaisie', text: 'Une petite équipe peut tout suivre sans logiciel compliqué : clients, projets, équipe et chiffres.', points: ['Devis, factures et paiements', "Projets découpés en tâches par l'IA", 'Comptabilité simple et export pour votre comptable'], img: 'budget', alt: 'Budget avec entrées, sorties et solde' },
  { tab: 'Restaurants et salons', title: 'Le planning et le stock sous contrôle', text: 'Planifiez votre équipe, suivez vos produits et recevez les demandes de vos clients par message.', points: ['Planning de la semaine, congés à valider', 'Stock de produits et commandes fournisseurs', 'Demandes clients reçues par WhatsApp'], img: 'rh', alt: 'Planning de la semaine' },
];

/** Onglets « Pour qui » (clavier : flèches gauche / droite). */
export default function Who() {
  const [cur, setCur] = useState(0);
  const btns = useRef([]);
  const pick = (i, focus) => { setCur(i); if (focus && btns.current[i]) btns.current[i].focus(); };
  return (
    <section className="s-sec alt" id="solutions"><div className="s-wrap">
      <div className="s-head rv"><span className="s-eyebrow">Pour qui</span><h2>Pensé pour celles et ceux qui vendent, achètent et gèrent tous les jours</h2></div>
      <div className="s-tabs rv" role="tablist" aria-label="Types d'activité">
        {TABS.map((t, i) => (
          <button key={t.tab} ref={(el) => { btns.current[i] = el; }} className="s-tab" role="tab" aria-selected={i === cur} aria-controls={'p' + i} id={'t' + i} type="button" tabIndex={i === cur ? 0 : -1}
            onClick={() => pick(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); pick((i + 1) % TABS.length, true); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); pick((i + TABS.length - 1) % TABS.length, true); }
            }}>{t.tab}</button>
        ))}
      </div>
      {TABS.map((t, i) => (
        <div key={t.tab} className={'s-panel' + (i === cur ? ' on' : '')} role="tabpanel" id={'p' + i} aria-labelledby={'t' + i} hidden={i !== cur}>
          <div><h3>{t.title}</h3><p>{t.text}</p><ul>{t.points.map((p) => <li key={p}>{p}</li>)}</ul><Link className="s-btn pri" to="/inscription">Essayer gratuitement</Link></div>
          <div className="pic" data-zoom="" tabIndex={0} role="button" aria-label="Agrandir l'aperçu"><img src={`/assets/img/${t.img}.svg`} alt={t.alt} width="640" height="420" loading="lazy" /></div>
        </div>
      ))}
    </div></section>
  );
}
