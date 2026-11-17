import { Fa } from '../../lib/fa.jsx';
import { useT } from '../../lib/i18n.jsx';
import { shot } from './shared.js';

/** Liste des modules réellement présents dans l'application (src/ws/modules). */
export function useModules() {
  const t = useT();
  return [
    { id: 'crm', g: 'sell', icon: 'address-book', title: t('Clients et ventes'), text: t('Devis, factures, paiements et impayés, avec la relance déjà rédigée.') },
    { id: 'sales', g: 'sell', icon: 'whatsapp', title: t('Assistant WhatsApp'), text: t('Répond à vos clients, enregistre les prospects et prend les commandes.') },
    { id: 'marketing', g: 'sell', icon: 'bullhorn', title: t('Marketing'), text: t('Campagnes, coût par prospect, calendrier de contenu et offres.') },
    { id: 'support', g: 'sell', icon: 'headset', title: t('Service client'), text: t('Toutes les demandes au même endroit, avec un brouillon de réponse.') },
    { id: 'accounting', g: 'money', icon: 'calculator', title: t('Comptabilité'), text: t('Écritures automatiques, balance, résultat et bilan simplifié.') },
    { id: 'fiscal', g: 'money', icon: 'file-invoice', title: t('Fiscalité et TVA'), text: t('États de travail, TVA estimée et calendrier des déclarations.') },
    { id: 'budget', g: 'money', icon: 'wallet', title: t('Budget'), text: t('Entrées, sorties et limites par catégorie, avec alertes.') },
    { id: 'payroll', g: 'money', icon: 'money-check', title: t('Paie'), text: t('Bulletins, retenues paramétrables, écritures comptables.') },
    { id: 'stock', g: 'ops', icon: 'warehouse', title: t('Stock et entrepôt'), text: t('Articles, emplacements, inventaires et alertes de rupture.') },
    { id: 'purchasing', g: 'ops', icon: 'cart', title: t('Achats'), text: t('Fournisseurs comparés, bons de commande et réceptions.') },
    { id: 'production', g: 'ops', icon: 'industry', title: t('Production'), text: t('Nomenclatures, coût de revient et ordres de fabrication.') },
    { id: 'logistics', g: 'ops', icon: 'truck', title: t('Logistique et transport'), text: t('Livraisons, transporteurs, zones et tournées.') },
    { id: 'construction', g: 'ops', icon: 'helmet', title: t('Chantiers (BTP)'), text: t('Phases, budget, pointages, rapports et situations de travaux.') },
    { id: 'maintenance', g: 'ops', icon: 'tools', title: t('Maintenance'), text: t('Équipements, plans préventifs, pannes et pièces.') },
    { id: 'hr', g: 'team', icon: 'users', title: t('Ressources humaines'), text: t('Employés, congés et planning de la semaine.') },
    { id: 'projects', g: 'team', icon: 'list-check', title: t('Projets et tâches'), text: t("Décrivez un objectif : l'IA le découpe en tâches.") },
    { id: 'library', g: 'team', icon: 'book-open', title: t('Bibliothèque'), text: t("Les documents de l'entreprise, rangés et protégés.") },
    { id: 'legal', g: 'team', icon: 'scale', title: t('Juridique'), text: t('Contrats, échéances, obligations et modèles de documents.') },
    { id: 'memory', g: 'team', icon: 'brain', title: t("Mémoire de l'entreprise"), text: t('Décisions et historique, avec des réponses sourcées.') },
    { id: 'agents', g: 'team', icon: 'robot', title: t('Agents spécialisés'), text: t("Une équipe d'agents par domaine, avec une synthèse.") },
    { id: 'alerts', g: 'team', icon: 'bell', title: t('Alertes et résumé'), text: t('Ce qui est urgent, chaque matin.') },
  ];
}

const BENTO = [['crm', 'vt-b7'], ['sales', 'vt-b5'], ['stock', 'vt-b5'], ['accounting', 'vt-b7'], ['payroll', 'vt-b4'], ['budget', 'vt-b4'], ['logistics', 'vt-b4']];
const sizes = '(min-width:1040px) 560px, (min-width:720px) 46vw, 90vw';

/** Grille « bento » : cartes de tailles variées avec un vrai écran de l'application (ou la conversation WhatsApp), puis les autres modules en pastilles. */
export default function Modules({ mods }) {
  const t = useT();
  const byId = Object.fromEntries(mods.map((m) => [m.id, m]));
  const rest = mods.filter((m) => !BENTO.some(([id]) => id === m.id));
  return (
    <section className="vt-sec vt-sec--soft" id="modules" aria-labelledby="vt-mods">
      <div className="vt-wrap">
        <div className="vt-head vt-rv"><span className="vt-eyebrow">{t('Modules')}</span><h2 className="vt-h2" id="vt-mods">{t("Les outils d'une PME, réunis dans un seul endroit")}</h2><p className="vt-lead">{t("Utilisez ce qui vous sert. Les modules partagent les mêmes données : rien n'est saisi deux fois.")}</p></div>
        <div className="vt-bento">
          {BENTO.map(([id, cls]) => {
            const m = byId[id];
            return (
              <article key={id} className={'vt-bcard vt-rv ' + cls}>
                <div className="top"><span className="vt-ico"><Fa name={m.icon} /></span><h3 className="vt-h4">{m.title}</h3></div>
                <p>{m.text}</p>
                {id === 'sales' ? (
                  <div className="vt-bchat" aria-hidden="true">
                    <div className="m in">{t('Bonjour, vous avez la chaise de bureau en stock ? Quel prix ?')}</div>
                    <div className="m out">{t('Bonjour ! Oui, elle est disponible : 45 000 FCFA. Voulez-vous que je prépare une commande ?')}</div>
                  </div>
                ) : (
                  <div className="vt-bimg"><img src={shot(id, 720)} srcSet={`${shot(id, 480)} 480w, ${shot(id, 720)} 720w, ${shot(id, 1280)} 1280w`} sizes={sizes} width="1280" height="760" loading="lazy" decoding="async" alt={t("Écran « {title} » de Brij-IA (données d'exemple)", { title: m.title })} /></div>
                )}
              </article>
            );
          })}
        </div>
        <h3 className="vt-more-h vt-rv">{t('Et aussi')}</h3>
        <ul className="vt-chips vt-rv">
          {rest.map((m) => <li key={m.id}><Fa name={m.icon} />{m.title}</li>)}
        </ul>
      </div>
    </section>
  );
}
