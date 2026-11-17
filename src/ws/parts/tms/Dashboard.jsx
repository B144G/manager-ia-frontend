import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { TMS, addDays, num, pct, useFile } from './kit.jsx';

/* Indicateurs du transport : taux à l'heure et au premier passage, coûts (par livraison, km, kg), km par tournée, utilisation
   des véhicules, échecs par motif, CO2 estimé. Graphiques SVG dessinés ici (aucune bibliothèque), info-bulle au survol, exports CSV. */

/** Barres par jour : livrées et échecs côte à côte (une seule échelle), info-bulle au survol de chaque jour. */
function DaysChart({ days }) {
  const t = useT();
  const { dateFr } = useWs();
  const [hover, setHover] = useState(null);
  const W = 640; const H = 200; const B = 170; const L = 32;
  const max = Math.max(1, ...days.map((d) => Math.max(d.delivered, d.failed)));
  const step = (W - L) / Math.max(days.length, 1);
  const bw = Math.max(2, Math.min(14, step / 2 - 2));
  const ticks = [0, Math.ceil(max / 2), max];
  const h = hover !== null ? days[hover] : null;
  return (
    <div className="tms-chart">
      <div className="tms-legend"><span><i className="sw ok" />{t('Livrées')}</span><span><i className="sw bad" />{t('Échecs et retours')}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Livraisons par jour')} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => <g key={v}><line x1={L} x2={W} y1={B - (v / max) * 150} y2={B - (v / max) * 150} className="grid" /><text x={L - 6} y={B - (v / max) * 150 + 4} textAnchor="end" className="ax">{v}</text></g>)}
        {days.map((d, i) => {
          const x = L + i * step + step / 2;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)}>
              <rect x={x - step / 2} y={0} width={step} height={B} fill="transparent" />
              <rect x={x - bw - 1} y={B - (d.delivered / max) * 150} width={bw} height={(d.delivered / max) * 150} rx="2" className="b-ok" />
              <rect x={x + 1} y={B - (d.failed / max) * 150} width={bw} height={(d.failed / max) * 150} rx="2" className="b-bad" />
              {days.length <= 14 || i % Math.ceil(days.length / 10) === 0 ? <text x={x} y={B + 18} textAnchor="middle" className="ax">{d.date.slice(8, 10) + '/' + d.date.slice(5, 7)}</text> : null}
            </g>
          );
        })}
        {h ? <line x1={L + hover * step + step / 2} x2={L + hover * step + step / 2} y1={10} y2={B} className="cross" /> : null}
      </svg>
      <p className="tms-tip" aria-live="polite">{h ? t('{date} : {d} livrée(s), {f} échec(s), à l\'heure {p}', { date: dateFr(h.date), d: h.delivered, f: h.failed, p: pct(h.onTime) }) : t('Survolez un jour pour le détail.')}</p>
    </div>
  );
}

/** Barres horizontales d'une seule série (échecs par motif, utilisation) : valeur écrite au bout, en texte. */
function HBars({ rows, unit = '', max }) {
  const top = max || Math.max(1, ...rows.map((r) => r.value || 0));
  return (
    <div className="tms-hbars">
      {rows.map((r) => (
        <div className="tms-hbar" key={r.label} title={r.label + ' : ' + num(r.value) + unit}>
          <span className="lbl">{r.label}</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="1" width={Math.max(0.5, (100 * (r.value || 0)) / top)} height="8" rx="2" className="b-acc" /></svg>
          <b>{r.value === null || r.value === undefined ? '—' : num(r.value) + unit}</b>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const t = useT();
  const { oapi, can, money, today } = useWs();
  const file = useFile();
  const [to, setTo] = useState(today());
  const [from, setFrom] = useState(addDays(today(), -29));
  const st = useLoad(() => oapi('GET', TMS + '/kpi?from=' + from + '&to=' + to), [from, to]);
  const mgr = can('manager');
  const csv = (kind) => file(TMS + '/kpi/export?kind=' + kind + '&from=' + from + '&to=' + to, 'transport-' + kind + '.csv', { download: true });
  return (
    <>
      <div className="row tms-toolbar">
        <label className="fld"><span>{t('Du')}</span><input type="date" style={{ fontSize: 16 }} value={from} onChange={(e) => setFrom(e.target.value || from)} /></label>
        <label className="fld"><span>{t('Au')}</span><input type="date" style={{ fontSize: 16 }} value={to} onChange={(e) => setTo(e.target.value || to)} /></label>
        <button className="btn small" type="button" onClick={() => csv('deliveries')}>{t('Exporter les livraisons (CSV)')}</button>
        <button className="btn small" type="button" onClick={() => csv('trips')}>{t('Exporter les tournées (CSV)')}</button>
      </div>
      <Loaded state={st}>{(k) => {
        const s = k.summary;
        return (
          <>
            <div className="kpis wms-kpis">
              <div className="stat"><b>{pct(s.onTimePct)}</b><span>{t("livraisons à l'heure")}{s.declaredTimes ? ' · ' + t('dont {n} heure(s) saisie(s) après coup ; en direct : {p}', { n: s.declaredTimes, p: pct(s.onTimeLivePct) }) : ''}</span></div>
              <div className="stat"><b>{pct(s.firstAttemptPct)}</b><span>{t('réussies au premier passage')}</span></div>
              <div className="stat"><b>{s.delivered + ' / ' + s.deliveries}</b><span>{t('livrées sur la période')}</span></div>
              <div className={'stat' + (s.failed ? ' bad' : '')}><b>{String(s.failed)}</b><span>{t('en échec ou retournées')}</span></div>
              <div className="stat"><b>{s.kmPerTrip === null ? '—' : num(s.kmPerTrip) + ' km'}</b><span>{t('par tournée ({n} tournées, {km} km)', { n: s.trips, km: num(s.km) })}</span></div>
              <div className="stat"><b>{num(s.co2Kg) + ' kg'}</b><span>{t('CO2 estimé')}</span></div>
              {mgr ? <div className="stat"><b>{s.costPerDelivery === undefined ? '—' : money(s.costPerDelivery)}</b><span>{t('coût par livraison')}</span></div> : null}
              {mgr ? <div className="stat"><b>{s.costPerKm === undefined ? '—' : money(s.costPerKm)}</b><span>{t('coût au km (flotte)')}</span></div> : null}
              {mgr ? <div className="stat"><b>{s.costPerKg === undefined ? '—' : num(s.costPerKg) + ' ' + t('par kg')}</b><span>{t('coût au kg livré')}</span></div> : null}
              {mgr ? <div className="stat"><b>{money(s.totalCost)}</b><span>{t('coût total (frais {a} + transporteurs {b})', { a: money(s.tripCosts), b: money(s.carrierCosts) })}</span></div> : null}
            </div>
            <div className="ws-card"><h2>{t('Livraisons par jour')}</h2>{k.days.length ? <DaysChart days={k.days} /> : <Empty text={t('Aucune donnée.')} />}</div>
            <div className="tms-grid2">
              <div className="ws-card"><h2>{t('Échecs par motif')}</h2>{k.failures.length ? <HBars rows={k.failures.map((f) => ({ label: t(f.label), value: f.count }))} /> : <Empty text={t('Aucun échec sur la période.')} />}
                <button className="btn small" type="button" onClick={() => csv('failures')}>{t('Exporter (CSV)')}</button></div>
              <div className="ws-card"><h2>{t('Utilisation des véhicules')}</h2>
                <p className="small muted">{t('Jours avec une tournée sur {n} jours ouvrés ; chargement moyen par rapport à la capacité.', { n: k.workDays })}</p>
                {k.vehicles.length ? <HBars rows={k.vehicles.map((v) => ({ label: v.plate + (v.avgLoad !== null ? ' · ' + t('charge {p}', { p: pct(v.avgLoad) }) : ''), value: v.utilisation }))} unit=" %" max={100} /> : <Empty text={t('Aucun véhicule.')} />}
                <button className="btn small" type="button" onClick={() => csv('vehicles')}>{t('Exporter (CSV)')}</button></div>
            </div>
            {k.carriers.length ? (
              <div className="ws-card"><h2>{t('Transporteurs')}</h2>
                {k.carriers.map((c) => <div className="line" key={c.carrierId}><span><b>{c.carrier}</b><small>{' ' + t('{d} / {n} livrées · {f} échec(s)', { d: c.delivered, n: c.deliveries, f: c.failed })}</small></span><small>{t("à l'heure {p}", { p: pct(c.onTimePct) })}</small></div>)}
              </div>
            ) : null}
          </>
        );
      }}</Loaded>
    </>
  );
}
