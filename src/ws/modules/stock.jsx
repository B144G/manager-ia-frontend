/* Sous-application : Stock et achats. Cadre commun (menu en groupes, bandeau, fil d'Ariane) autour des écrans d'origine (articles et commandes, inventaire,
   fiabilité des fournisseurs) et des écrans d'entrepôt : emplacements, rangement, transferts, réservations, réceptions et frais d'arrivée, préparation,
   retours, classement ABC, prévision, états et scan sur téléphone ; pilotage de l'entrepôt (tableau de bord, cour et quais,
   optimisation des emplacements, productivité) ; flux spéciaux (transbordement, kits, services à valeur ajoutée). */
import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { useLoad } from '../ui.jsx';
import ModuleShell from '../ModuleShell.jsx';
import Items from '../parts/stock/Items.jsx';
import Counts from '../parts/stock/Counts.jsx';
import SupplierStats from '../parts/stock/SupplierStats.jsx';
import Warehouses, { Putaway } from '../parts/stockwms/Warehouses.jsx';
import Transfers from '../parts/stockwms/Transfers.jsx';
import Reservations from '../parts/stockwms/Reservations.jsx';
import Receipts from '../parts/stockwms/Receipts.jsx';
import Picking from '../parts/stockwms/Picking.jsx';
import Returns from '../parts/stockwms/Returns.jsx';
import Abc from '../parts/stockwms/Abc.jsx';
import Forecast from '../parts/stockwms/Forecast.jsx';
import Reports from '../parts/stockwms/Reports.jsx';
import Finance from '../parts/stockwms/Finance.jsx';
import Scan from '../parts/stockwms/Scan.jsx';
import HandlingUnits from '../parts/stockwms/HandlingUnits.jsx';
import Waves from '../parts/stockwms/Waves.jsx';
import Replenishment from '../parts/stockwms/Replenishment.jsx';
import Packing from '../parts/stockwms/Packing.jsx';
import Shipments from '../parts/stockwms/Shipments.jsx';
import WmsDashboard from '../parts/stockwms/Dashboard.jsx';
import Slotting from '../parts/stockwms/Slotting.jsx';
import Labor from '../parts/stockwms/Labor.jsx';
import Yard from '../parts/stockwms/Yard.jsx';
import CrossDock from '../parts/stockwms/CrossDock.jsx';
import Kits from '../parts/stockwms/Kits.jsx';
import Vas from '../parts/stockwms/Vas.jsx';

export default function Stock() {
  const t = useT();
  const { can } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('items');
  const only = (cond, list) => (cond ? list : []);
  const GROUPS = [
    { id: 'pilot', icon: 'chart-pie', label: t('Pilotage'), items: [
      { id: 'items', label: t('Articles et commandes'), hint: t('Vos articles, vos fournisseurs et vos commandes, avec des alertes avant la rupture.') },
      { id: 'stockouts', label: t('Ruptures et alertes'), hint: t('Articles en rupture, sous le seuil ou dont les réservations ne sont plus couvertes.') },
      ...only(mgr, [{ id: 'finance', label: t('Stock et finances'), hint: t("Valeur du stock face à la comptabilité, avoirs, frais d'arrivée, argent immobilisé et besoin de trésorerie.") }]),
      ...only(mgr, [{ id: 'valuation', label: t('Valorisation du stock'), hint: t('La valeur du stock par entrepôt et par emplacement : celle que reprend la comptabilité.') }])] },
    { id: 'wmspilot', icon: 'gauge', label: t("Pilotage de l'entrepôt"), items: [
      { id: 'wmsdash', label: t("Tableau de bord de l'entrepôt"), hint: t('En temps réel : lignes à prélever, vagues, retards, réceptions à ranger, remplissage des zones, quais et alertes.') },
      { id: 'yard', label: t('Cour et quais'), hint: t('Rendez-vous des camions, arrivée au portail, mise à quai, départ, attente et occupation des quais.') },
      { id: 'slotting', label: t('Optimisation des emplacements'), hint: t('Les articles les plus prélevés près du quai, les lourds en bas : gain simulé et tâches de déplacement par scan.') },
      { id: 'labor', label: t('Productivité'), hint: mgr ? t('Lignes par heure, temps par tâche et performance des magasiniers par rapport aux temps standards.') : t('Vos lignes par heure et votre performance par rapport aux temps standards.') }] },
    { id: 'wh', icon: 'warehouse', label: t('Entrepôt'), items: [
      { id: 'wh', label: t('Entrepôts et emplacements'), hint: t('Entrepôts, zones et emplacements (allée, rayon, bac) : où se trouve chaque article.') },
      { id: 'hus', label: t('Palettes et colis'), hint: t('Palettes, colis et bacs étiquetés : recevoir, ranger et déplacer en un scan, avec leur contenu.') },
      { id: 'putaway', label: t('Rangement'), hint: t("Ranger ce qui est arrivé en réception, selon vos règles de rangement.") },
      { id: 'replen', label: t('Réapprovisionnement des emplacements'), hint: t('Minimum et maximum des emplacements de préparation : des tâches ramènent le stock du rayonnage, palettes entières d\'abord.') },
      { id: 'transfers', label: t('Transferts'), hint: t('Déplacer du stock entre entrepôts ou emplacements : demande, transit, réception avec écarts.') },
      { id: 'reservations', label: t('Réservations'), hint: t("Mettre du stock de côté pour une commande ou une demande ; voir ce qui reste à promettre.") }] },
    { id: 'flow', icon: 'box-open', label: t('Entrées et sorties'), items: [
      ...only(mgr, [{ id: 'receipts', label: t("Réceptions et frais d'arrivée"), hint: t("Réceptions de plusieurs articles, avec transport, douane et manutention répartis dans le coût de revient.") }]),
      { id: 'picking', label: t('Préparation de commandes'), hint: t('Listes de préparation avec le parcours dans l\'entrepôt, le scan et l\'expédition.') },
      { id: 'waves', label: t('Vagues de préparation'), hint: t('Plusieurs commandes préparées en une seule tournée, parcours optimisé et tri par commande.') },
      { id: 'packing', label: t("Poste d'emballage"), hint: t('Mettre les commandes préparées en colis, peser, contrôler par scan et imprimer la liste de colisage.') },
      { id: 'shipments', label: t('Expéditions'), hint: t('Regrouper les colis par transporteur, charger au quai par scan, sortir le stock et imprimer le bon de livraison.') },
      { id: 'returns', label: t('Retours et rebuts'), hint: t('Retours des clients, retours aux fournisseurs et mises au rebut, avec leur motif.') },
      ...only(mgr, [{ id: 'suppliers', label: t('Fournisseurs : fiabilité'), hint: t('Retards et taux de livraison de vos fournisseurs.') }])] },
    { id: 'special', icon: 'shuffle', label: t('Flux spéciaux'), items: [
      { id: 'crossdock', label: t('Transbordement'), hint: t("La marchandise reçue qu'une commande attend part directement en dépose, sans passer par le rangement.") },
      { id: 'kits', label: t('Kits et assemblage'), hint: t('Assembler des kits à partir de leurs composants (lots FEFO, coût réel), ou les défaire.') },
      { id: 'vas', label: t('Services à valeur ajoutée'), hint: t('Étiquetage, reconditionnement, emballage cadeau, contrôle : tâches par opérateur, coûts, blocage de la sortie.') }] },
    { id: 'count', icon: 'clipboard-check', label: t('Inventaire'), items: [
      { id: 'counts', label: t('Inventaire'), hint: t('On compte, l\'écart est valorisé, un responsable valide et le stock est ajusté avec une trace.') },
      ...only(mgr, [{ id: 'abc', label: t('Classement ABC et inventaires tournants'), hint: t('Quels articles pèsent le plus, et le calendrier des comptages par classe.') }])] },
    ...only(mgr, [{ id: 'analysis', icon: 'chart', label: t('Analyse'), items: [
      { id: 'forecast', label: t('Réapprovisionnement et prévision'), hint: t('Que commander, quand, et combien, d\'après la demande des dernières semaines.') },
      { id: 'rotation', label: t('Rotation'), hint: t('Quels articles tournent vite, lentement ou pas du tout.') },
      { id: 'aging', label: t('Vieillissement du stock'), hint: t('Depuis combien de temps le stock actuel est entré.') },
      { id: 'moves', label: t('Journal des mouvements'), hint: t('Toutes les entrées, sorties et tous les déplacements, avec le document d\'origine.') }] }]),
    { id: 'mobile', icon: 'mobile', label: t('Téléphone'), items: [
      { id: 'scan', label: t('Scanner'), hint: t('Chercher, réceptionner, préparer et compter avec l\'appareil photo du téléphone ou un lecteur.') },
      ...only(!mgr, [{ id: 'moves', label: t('Journal des mouvements'), hint: t('Toutes les entrées, sorties et tous les déplacements, avec le document d\'origine.') }])] },
    { id: 'links', icon: 'link', label: t('Autres modules'), items: [
      ...only(mgr, [{ id: 'accounting', to: 'accounting', label: t('Stocks en comptabilité'), hint: t('Ouvre la Comptabilité : valeur du stock et variation de stock.') }]),
      { id: 'logistics', to: 'logistics', label: t('Livraisons'), hint: t('Ouvre le module Logistique.') },
      { id: 'production', to: 'production', label: t('Production'), hint: t('Ouvre le module Production.') }] },
  ];
  const SCREENS = {
    items: <Items />, stockouts: <Reports part="stockouts" />, valuation: <Reports part="valuation" />, finance: <Finance />, wh: <Warehouses />, putaway: <Putaway />, hus: <HandlingUnits />, transfers: <Transfers />, reservations: <Reservations />,
    receipts: <Receipts />, picking: <Picking />, waves: <Waves />, replen: <Replenishment />, packing: <Packing />, shipments: <Shipments />, returns: <Returns />, suppliers: <SupplierStats />, counts: <Counts />, abc: <Abc />, forecast: <Forecast />,
    crossdock: <CrossDock />, kits: <Kits />, vas: <Vas />, rotation: <Reports part="rotation" />, aging: <Reports part="aging" />, moves: <Reports part="moves" />, scan: <Scan />,
    wmsdash: <WmsDashboard />, yard: <Yard />, slotting: <Slotting />, labor: <Labor />,
  };
  return (
    <ModuleShell quick={['scan', 'picking', 'waves', 'packing', 'shipments', 'wmsdash', 'yard', 'slotting', 'labor', 'crossdock', 'kits', 'vas'].includes(tab) ? null : <QuickView tab={tab} />} title={t('Stock et achats')} groups={GROUPS} active={tab} onSelect={setTab}>
      <div key={tab}>{SCREENS[tab] || <Items />}</div>
    </ModuleShell>
  );
}

/** Vue rapide : articles, valeur du stock (responsables), ruptures. Lecture seule : ne bloque jamais l'écran. */
function QuickView({ tab }) {
  const t = useT();
  const { oapi, money, can } = useWs();
  const st = useLoad(() => oapi('GET', '/stock'), [tab]);
  const s = st.data && st.data.summary;
  if (!s) return null;
  return (
    <div className="ws-card msh-quick" aria-label={t('Vue rapide')}>
      <b>{t('Vue rapide')}</b>
      <div className="msh-quick-row">
        <span>{t('Articles')}<b>{String(s.count)}</b></span>
        {can('manager') && s.value !== undefined ? <span>{t('Valeur du stock')}<b className="ok">{money(s.value)}</b></span> : null}
        <span>{t('En rupture')}<b className={s.out ? 'late' : ''}>{String(s.out)}</b></span>
        <span>{t('Sous le seuil')}<b className={s.low ? 'late' : ''}>{String(s.low)}</b></span>
      </div>
    </div>
  );
}
