/* Sous-application : Stock et achats. Cadre commun (menu en groupes, bandeau, fil d'Ariane) autour des écrans d'origine (articles et commandes, inventaire,
   fiabilité des fournisseurs) et des écrans d'entrepôt : emplacements, rangement, transferts, réservations, réceptions et frais d'arrivée, préparation,
   retours, classement ABC, prévision, états et scan sur téléphone. */
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
import Scan from '../parts/stockwms/Scan.jsx';
import Units from '../parts/stockwms/Units.jsx';
import Waves from '../parts/stockwms/Waves.jsx';

export default function Stock() {
  const t = useT();
  const { can } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('items');
  const only = (cond, list) => (cond ? list : []);
  const GROUPS = [
    { id: 'pilot', icon: '📊', label: t('Pilotage'), items: [
      { id: 'items', label: t('Articles et commandes'), hint: t('Vos articles, vos fournisseurs et vos commandes, avec des alertes avant la rupture.') },
      { id: 'stockouts', label: t('Ruptures et alertes'), hint: t('Articles en rupture, sous le seuil ou dont les réservations ne sont plus couvertes.') },
      ...only(mgr, [{ id: 'valuation', label: t('Valorisation du stock'), hint: t('La valeur du stock par entrepôt et par emplacement : celle que reprend la comptabilité.') }])] },
    { id: 'wh', icon: '🏭', label: t('Entrepôt'), items: [
      { id: 'wh', label: t('Entrepôts et emplacements'), hint: t('Entrepôts, zones et emplacements (allée, rayon, bac) : où se trouve chaque article.') },
      { id: 'putaway', label: t('Rangement'), hint: t("Ranger ce qui est arrivé en réception, selon vos règles de rangement.") },
      { id: 'units', label: t('Palettes et cartons'), hint: t('Unités logistiques : un code scannable, un contenu, un emplacement ; déplacer l\'unité déplace son contenu.') },
      { id: 'transfers', label: t('Transferts'), hint: t('Déplacer du stock entre entrepôts ou emplacements : demande, transit, réception avec écarts.') },
      { id: 'reservations', label: t('Réservations'), hint: t("Mettre du stock de côté pour une commande ou une demande ; voir ce qui reste à promettre.") }] },
    { id: 'flow', icon: '📦', label: t('Entrées et sorties'), items: [
      ...only(mgr, [{ id: 'receipts', label: t("Réceptions et frais d'arrivée"), hint: t("Réceptions de plusieurs articles, avec transport, douane et manutention répartis dans le coût de revient.") }]),
      { id: 'picking', label: t('Préparation de commandes'), hint: t('Listes de préparation avec le parcours dans l\'entrepôt, le scan et l\'expédition.') },
      { id: 'waves', label: t('Vagues de préparation'), hint: t('Plusieurs commandes préparées en une seule tournée, lignes regroupées dans l\'ordre du parcours.') },
      { id: 'returns', label: t('Retours et rebuts'), hint: t('Retours des clients, retours aux fournisseurs et mises au rebut, avec leur motif.') },
      ...only(mgr, [{ id: 'suppliers', label: t('Fournisseurs : fiabilité'), hint: t('Retards et taux de livraison de vos fournisseurs.') }])] },
    { id: 'count', icon: '✅', label: t('Inventaire'), items: [
      { id: 'counts', label: t('Inventaire'), hint: t('On compte, l\'écart est valorisé, un responsable valide et le stock est ajusté avec une trace.') },
      ...only(mgr, [{ id: 'abc', label: t('Classement ABC et inventaires tournants'), hint: t('Quels articles pèsent le plus, et le calendrier des comptages par classe.') }])] },
    ...only(mgr, [{ id: 'analysis', icon: '📈', label: t('Analyse'), items: [
      { id: 'forecast', label: t('Réapprovisionnement et prévision'), hint: t('Que commander, quand, et combien, d\'après la demande des dernières semaines.') },
      { id: 'rotation', label: t('Rotation'), hint: t('Quels articles tournent vite, lentement ou pas du tout.') },
      { id: 'aging', label: t('Vieillissement du stock'), hint: t('Depuis combien de temps le stock actuel est entré.') },
      { id: 'moves', label: t('Journal des mouvements'), hint: t('Toutes les entrées, sorties et tous les déplacements, avec le document d\'origine.') }] }]),
    { id: 'mobile', icon: '📱', label: t('Téléphone'), items: [
      { id: 'scan', label: t('Scanner'), hint: t('Chercher, réceptionner, préparer et compter avec l\'appareil photo du téléphone ou un lecteur.') },
      ...only(!mgr, [{ id: 'moves', label: t('Journal des mouvements'), hint: t('Toutes les entrées, sorties et tous les déplacements, avec le document d\'origine.') }])] },
    { id: 'links', icon: '🔗', label: t('Autres modules'), items: [
      ...only(mgr, [{ id: 'accounting', to: 'accounting', label: t('Stocks en comptabilité'), hint: t('Ouvre la Comptabilité : valeur du stock et variation de stock.') }]),
      { id: 'logistics', to: 'logistics', label: t('Livraisons'), hint: t('Ouvre le module Logistique.') },
      { id: 'production', to: 'production', label: t('Production'), hint: t('Ouvre le module Production.') }] },
  ];
  const SCREENS = {
    items: <Items />, stockouts: <Reports part="stockouts" />, valuation: <Reports part="valuation" />, wh: <Warehouses />, putaway: <Putaway />, transfers: <Transfers />, reservations: <Reservations />,
    receipts: <Receipts />, picking: <Picking />, units: <Units />, waves: <Waves />, returns: <Returns />, suppliers: <SupplierStats />, counts: <Counts />, abc: <Abc />, forecast: <Forecast />,
    rotation: <Reports part="rotation" />, aging: <Reports part="aging" />, moves: <Reports part="moves" />, scan: <Scan />,
  };
  return (
    <ModuleShell quick={tab === 'scan' || tab === 'picking' ? null : <QuickView tab={tab} />} title={t('Stock et achats')} groups={GROUPS} active={tab} onSelect={setTab}>
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
