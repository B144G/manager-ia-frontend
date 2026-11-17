import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT, getLocale } from '../../../lib/i18n.jsx';
import { Fa } from '../../../lib/fa.jsx';
import { Loaded, useLoad } from '../../ui.jsx';
import { Kpis, WMS, qty, pct } from './kit.jsx';
import { Columns, Gauge, PctBars } from './charts.jsx';

/* Tableau de bord de l'entrepôt en temps réel : lignes à prélever, vagues, expéditions en retard, réceptions à ranger, tâches ouvertes,
   remplissage des zones, quais, productivité du jour (responsables) et alertes. Rafraîchi toutes les 30 secondes tant que l'onglet est visible. */
const REFRESH = 30000;

function useAlertText() {
  const t = useT();
  return (a) => {
    const list = a.list && a.list.length ? ' : ' + a.list.join(', ') : '';
    switch (a.kind) {
      case 'late_shipments': return t('{n} expédition(s) en retard', { n: a.n }) + list;
      case 'truck_waiting': return t('{n} camion(s) attendent au portail depuis plus de {m} min', { n: a.n, m: a.minutes }) + list;
      case 'truck_late': return t('{n} camion(s) en retard sur leur créneau', { n: a.n }) + list;
      case 'pick_face_low': return t('{n} emplacement(s) de préparation sous leur minimum, sans tâche', { n: a.n }) + list;
      case 'zone_full': return t('{n} zone(s) remplie(s) à 90 % ou plus', { n: a.n }) + list;
      case 'short_picks': return t("{n} ligne(s) prélevée(s) incomplètes aujourd'hui", { n: a.n });
      case 'putaway_backlog': return t('{n} article(s) attendent en réception', { n: a.n });
      default: return a.kind;
    }
  };
}

export default function Dashboard() {
  const t = useT();
  const { oapi, can } = useWs();
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(true);
  const st = useLoad(() => oapi('GET', WMS + '/dashboard/live'), [tick]);
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') setTick((x) => x + 1); }, REFRESH);
    return () => clearInterval(id);
  }, [live]);
  const alertText = useAlertText();
  const time = (iso) => new Date(iso).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <>
      <div className="row wms-toolbar wms-pilot-top">
        <span className="muted small" aria-live="polite">{st.data ? t('Mis à jour à {h}', { h: time(st.data.at) }) : ''}{live ? ' · ' + t('actualisation toutes les 30 s') : ''}</span>
        <span className="row">
          <button className="btn small" type="button" onClick={() => setLive((x) => !x)} aria-pressed={!live}>{live ? t('Mettre en pause') : t("Reprendre l'actualisation")}</button>
          <button className="btn small primary" type="button" onClick={() => setTick((x) => x + 1)}><Fa name="retry" /> {t('Actualiser')}</button>
        </span>
      </div>
      <Loaded state={st}>{(d) => (
        <>
          {d.alerts.length ? (
            <div className="ws-card wms-alerts" role="region" aria-label={t('Alertes')}>
              {d.alerts.map((a, i) => <p key={i} className={'wms-alert ' + a.level}><Fa name="warn" /> <span>{alertText(a)}</span></p>)}
            </div>
          ) : <p className="wms-alert ok"><Fa name="ok" /> <span>{t('Aucune alerte : tout est sous contrôle.')}</span></p>}
          <Kpis list={[
            { label: t('Lignes à prélever'), value: qty(d.picking.lines) },
            { label: t('Vagues en cours'), value: qty(d.waves.inProgress) },
            { label: t('Expéditions en retard'), value: qty(d.shipments.late), bad: d.shipments.late > 0 },
            { label: t('Réceptions à ranger'), value: qty(d.putaway.lines), bad: d.putaway.lines >= 10 },
            { label: t('Tâches de réapprovisionnement'), value: qty(d.tasks.replenishment) },
            { label: t('Commandes à emballer'), value: qty(d.picking.toPack) },
          ]} />
          <div className="wms-pilot-grid">
            <div className="ws-card">
              <PctBars title={t('Remplissage par zone')} empty={t('Aucun emplacement actif.')} rows={d.zones.map((z) => ({ label: z.zone || t('{w} · sans zone', { w: z.warehouse }), value: z.fill !== null ? z.fill : z.used, sub: z.fill !== null ? t('{q} / {c} unités · {u} emplacements occupés', { q: qty(z.filled), c: qty(z.capacity), u: pct(z.used) }) : t('emplacements occupés (pas de capacité saisie)') }))} />
            </div>
            <div className="ws-card">
              <h3>{t('Quais aujourd\'hui')}</h3>
              <div className="wms-gauges">
                <Gauge value={d.yard.utilisation} label={t('Occupation des quais')} />
                <div className="wms-mini">
                  <p><b>{qty(d.yard.appointments)}</b> {t('rendez-vous')}</p>
                  <p><b>{qty(d.yard.waitingNow)}</b> {t('au portail')} · <b>{qty(d.yard.atDockNow)}</b> {t('à quai')}</p>
                  <p>{t('Ponctualité')} <b>{d.yard.onTimeRate === null ? '—' : pct(d.yard.onTimeRate)}</b> · {t('attente moyenne')} <b>{d.yard.avgWaitMinutes === null ? '—' : t('{n} min', { n: qty(d.yard.avgWaitMinutes) })}</b></p>
                </div>
              </div>
              <PctBars title={t('Par quai')} warn={101} empty={t('Aucun quai : créez-les dans « Cour et quais ».')} rows={d.yard.perDock.map((q) => ({ label: q.code, value: q.utilisation }))} />
            </div>
            <div className="ws-card">
              <h3>{t('Expéditions')}</h3>
              <p>{t("Prévues aujourd'hui")} <b>{qty(d.shipments.dueToday)}</b> · {t('parties aujourd\'hui')} <b>{qty(d.shipments.shippedToday)}</b></p>
              <p>{t('Unités à prélever')} <b>{qty(d.picking.units)}</b> · {t('listes ouvertes')} <b>{qty(d.picking.picks)}</b></p>
              <p>{t("Tâches d'optimisation des emplacements")} <b>{qty(d.tasks.slotting)}</b> · {t('vagues en brouillon')} <b>{qty(d.waves.draft)}</b></p>
            </div>
          </div>
          {d.productivity ? (
            <div className="ws-card">
              <h3>{t('Productivité du jour')}</h3>
              <Kpis list={[
                { label: t('Lignes faites'), value: qty(d.productivity.lines) },
                { label: t('Lignes / heure'), value: d.productivity.linesPerHour === null ? '—' : qty(d.productivity.linesPerHour) },
                { label: t('Performance'), value: d.productivity.performance === null ? '—' : pct(d.productivity.performance) },
                { label: t('Personnes actives'), value: qty(d.productivity.people) },
              ]} />
              <Columns title={t('Lignes par heure (UTC)')} unit={t('lignes')} data={d.productivity.byHour.map((h) => ({ label: String(h.hour).padStart(2, '0') + ' h', tick: h.hour % 3 === 0 ? String(h.hour) : '', value: h.lines }))} />
            </div>
          ) : null}
          {!can('manager') ? <p className="muted small">{t('La productivité du jour est visible des responsables. Vos propres chiffres sont dans « Productivité ».')}</p> : null}
        </>
      )}</Loaded>
    </>
  );
}
