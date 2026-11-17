import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT, getLocale } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Seg, Tag, WMS, qty, pct, useLocations } from './kit.jsx';
import { PctBars } from './charts.jsx';

/* Cour et quais : quais (rattachés à la réception ou au quai d'expédition), rendez-vous des camions (bon de commande ou expédition),
   arrivée au portail, mise à quai, départ ; attente, ponctualité et occupation des quais ; calendrier par quai. */

const STATUS_TONE = { planned: '', arrived: 'mid', docked: 'good', departed: '', cancelled: 'bad', no_show: 'bad' };
const hm = (iso) => (iso ? new Date(iso).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '—');
const todayLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const localIso = (day, time) => new Date(day + 'T' + (time || '00:00')).toISOString();

function useApptActions(reload) {
  const t = useT();
  const { oapi, toast, fail, modal } = useWs();
  const act = (a, path, body, msg) => oapi('POST', WMS + '/yard/appointments/' + a.id + '/' + path, body || {}).then(() => { if (msg) toast(msg); reload(); }).catch(fail);
  const arrive = (a) => modal(t('Arrivée de {c}', { c: a.code }), (close) => (
    <Form submitText={t("Noter l'arrivée")} fields={[{ k: 'plate', label: t('Plaque'), value: a.plate }, { k: 'driver', label: t('Chauffeur'), value: a.driver }]}
      onSubmit={(v) => oapi('POST', WMS + '/yard/appointments/' + a.id + '/arrive', v).then(() => { close(); toast(t('Arrivée notée.')); reload(); })} />
  ));
  return { act, arrive };
}

function ApptLine({ a, reload, docks }) {
  const t = useT();
  const { can, modal, oapi, toast } = useWs();
  const { act, arrive } = useApptActions(reload);
  const dockIt = () => {
    const ok = docks.filter((d) => d.active && (d.direction === 'both' || d.direction === a.direction));
    if (a.dockId) return act(a, 'dock', {}, t('Camion à quai.'));
    return modal(t('Mise à quai de {c}', { c: a.code }), (close) => (
      <Form submitText={t('Mettre à quai')} fields={[{ k: 'dockId', label: t('Quai'), type: 'select', options: [['', t('Choisir…')]].concat(ok.map((d) => [String(d.id), d.code + ' · ' + d.name])), required: true }]}
        onSubmit={(v) => oapi('POST', WMS + '/yard/appointments/' + a.id + '/dock', { dockId: Number(v.dockId) }).then(() => { close(); toast(t('Camion à quai.')); reload(); })} />
    ));
  };
  return (
    <div className="line">
      <span><b>{a.code}</b> <Tag tone={STATUS_TONE[a.status]}>{tsrv(a.statusLabel)}</Tag> {a.late ? <Tag tone="bad">{t('en retard')}</Tag> : null}
        <small>{' ' + tsrv(a.directionLabel) + ' · ' + hm(a.slotStart) + '–' + hm(a.slotEnd) + ' · ' + (a.dock || t('sans quai')) + (a.carrier ? ' · ' + a.carrier : '') + (a.plate ? ' · ' + a.plate : '') + (a.driver ? ' · ' + a.driver : '')}</small>
        <small className="muted">{(a.poNumber ? ' · ' + a.poNumber + (a.supplier ? ' (' + a.supplier + ')' : '') : '') + (a.shipmentCode ? ' · ' + a.shipmentCode + (a.customer ? ' (' + a.customer + ')' : '') : '') + (a.waitMinutes !== null ? ' · ' + t('attente {n} min', { n: a.waitMinutes }) : '') + (a.dockMinutes !== null ? ' · ' + t('{n} min à quai', { n: a.dockMinutes }) : '')}</small></span>
      <span className="row">
        {a.status === 'planned' ? <button className="btn small primary" type="button" onClick={() => arrive(a)}>{t('Arrivée')}</button> : null}
        {a.status === 'arrived' ? <button className="btn small primary" type="button" onClick={dockIt}>{t('Mettre à quai')}</button> : null}
        {['arrived', 'docked'].includes(a.status) ? <button className="btn small" type="button" onClick={() => act(a, 'depart', {}, t('Départ noté.'))}>{t('Départ')}</button> : null}
        {can('manager') && a.status === 'planned' ? <button className="link" type="button" onClick={() => act(a, 'cancel', { noShow: true })}>{t('Pas venu')}</button> : null}
        {can('manager') && ['planned', 'arrived'].includes(a.status) ? <button className="link" type="button" onClick={() => act(a, 'cancel', {})}>{t('Annuler')}</button> : null}
      </span>
    </div>
  );
}

function NewAppt({ docks, close, done, day }) {
  const t = useT();
  const { oapi } = useWs();
  const carriers = useLoad(() => oapi('GET', '/logistics/carriers').catch(() => ({ carriers: [] })), []);
  const pos = useLoad(() => oapi('GET', '/purchasing/orders').catch(() => ({ orders: [] })), []);
  const ships = useLoad(() => oapi('GET', WMS + '/shipments').catch(() => ({ shipments: [] })), []);
  const [dir, setDir] = useState('inbound');
  if (carriers.loading || pos.loading || ships.loading) return <p className="muted">{t('Chargement…')}</p>;
  const ok = docks.filter((d) => d.active && (d.direction === 'both' || d.direction === dir));
  const link = dir === 'inbound'
    ? { k: 'poId', label: t('Bon de commande fournisseur'), type: 'select', options: [['', t('Aucun')]].concat((pos.data.orders || []).filter((o) => ['approved', 'sent', 'partial'].includes(o.status)).map((o) => [String(o.id), o.number + ' · ' + o.supplier])) }
    : { k: 'shipmentId', label: t('Expédition'), type: 'select', options: [['', t('Aucune')]].concat((ships.data.shipments || []).filter((s) => ['open', 'loading'].includes(s.status)).map((s) => [String(s.id), s.code + (s.customerName ? ' · ' + s.customerName : '')])) };
  return (
    <>
      <Seg tabs={[['inbound', t('Réception')], ['outbound', t('Expédition')]]} value={dir} onChange={setDir} />
      <Form key={dir} submitText={t('Planifier le rendez-vous')} fields={[
        { k: 'dockId', label: t('Quai'), type: 'select', options: [['', t('À choisir plus tard')]].concat(ok.map((d) => [String(d.id), d.code + ' · ' + d.name])) },
        { k: 'day', label: t('Date'), type: 'date', value: day, required: true },
        { k: 'start', label: t('Début'), type: 'time', value: '08:00', required: true },
        { k: 'end', label: t('Fin'), type: 'time', value: '09:00', required: true },
        { k: 'carrierId', label: t('Transporteur'), type: 'select', options: [['', t('Autre (saisir ci-dessous)')]].concat((carriers.data.carriers || []).filter((c) => c.active).map((c) => [String(c.id), c.name])) },
        { k: 'carrierName', label: t('Nom du transporteur (si absent de la liste)') },
        { k: 'plate', label: t('Plaque') }, { k: 'driver', label: t('Chauffeur') }, { k: 'driverPhone', label: t('Téléphone du chauffeur'), type: 'tel' },
        link, { k: 'note', label: t('Note') },
      ]} onSubmit={(v) => oapi('POST', WMS + '/yard/appointments', {
        direction: dir, dockId: v.dockId ? Number(v.dockId) : undefined, slotStart: localIso(v.day, v.start), slotEnd: localIso(v.day, v.end),
        carrierId: v.carrierId ? Number(v.carrierId) : undefined, carrierName: v.carrierName, plate: v.plate, driver: v.driver, driverPhone: v.driverPhone, note: v.note,
        poId: v.poId ? Number(v.poId) : undefined, shipmentId: v.shipmentId ? Number(v.shipmentId) : undefined,
      }).then((j) => { close(); done(j); })} />
    </>
  );
}

/** Calendrier d'une journée : une ligne par quai, les rendez-vous placés sur l'échelle des heures (heure locale). */
function Calendar({ docks }) {
  const t = useT();
  const { oapi, modal, toast, can } = useWs();
  const [day, setDay] = useState(todayLocal());
  const st = useLoad(() => oapi('GET', WMS + '/yard/appointments?from=' + day + '&to=' + day), [day]);
  const start = new Date(day + 'T00:00').getTime(); const span = 24 * 3600000;
  const pos = (a) => { const s = Math.max(start, Date.parse(a.slotStart)); const e = Math.min(start + span, Date.parse(a.slotEnd)); return { left: ((s - start) / span) * 100 + '%', width: Math.max(1.5, ((e - s) / span) * 100) + '%' }; };
  const add = () => modal(t('Nouveau rendez-vous'), (close) => <NewAppt docks={docks} day={day} close={close} done={(j) => { toast(t('Rendez-vous {c} planifié.', { c: j.code })); st.reload(); }} />, { wide: true });
  return (
    <>
      <div className="row wms-toolbar wms-pilot-top">
        <label className="fld wms-inline"><span>{t('Jour')}</span><input type="date" style={{ fontSize: 16 }} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
        {can('manager') ? <button className="btn primary" type="button" onClick={add}>{t('Nouveau rendez-vous')}</button> : null}
      </div>
      <Loaded state={st}>{(j) => {
        const list = j.appointments.filter((a) => a.status !== 'cancelled');
        const lanes = docks.filter((d) => d.active).map((d) => ({ key: d.id, label: d.code, sub: d.name, items: list.filter((a) => a.dockId === d.id) }));
        const none = list.filter((a) => !a.dockId);
        if (none.length) lanes.push({ key: 0, label: t('Sans quai'), sub: '', items: none });
        return (
          <>
            <div className="ws-card wms-cal" role="region" aria-label={t('Calendrier des quais')}>
              <div className="wms-cal-scale" aria-hidden="true">{[0, 3, 6, 9, 12, 15, 18, 21].map((h) => <span key={h} style={{ left: (h / 24) * 100 + '%' }}>{String(h).padStart(2, '0') + ':00'}</span>)}</div>
              {!lanes.length ? <Empty text={t('Aucun quai : créez-les dans l\'onglet « Quais ».')} /> : null}
              {lanes.map((l) => (
                <div className="wms-cal-lane" key={l.key}>
                  <span className="wms-cal-dock"><b>{l.label}</b><small className="muted">{l.sub}</small></span>
                  <div className="wms-cal-track">
                    {l.items.map((a) => <span key={a.id} className={'wms-cal-slot ' + a.status + (a.late ? ' late' : '')} style={pos(a)} title={a.code + ' · ' + hm(a.slotStart) + '–' + hm(a.slotEnd) + (a.plate ? ' · ' + a.plate : '') + ' · ' + tsrv(a.statusLabel)}>{a.code}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="ws-card">
              <h3>{t('Rendez-vous du jour')}</h3>
              {!list.length ? <Empty text={t('Aucun rendez-vous ce jour-là.')} /> : null}
              {list.map((a) => <ApptLine key={a.id} a={a} docks={docks} reload={st.reload} />)}
            </div>
          </>
        );
      }}</Loaded>
    </>
  );
}

function InYard({ docks }) {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/yard/now'), []);
  return (
    <Loaded state={st}>{(j) => (
      <div className="ws-card">
        <h3>{t('Camions dans la cour')}</h3>
        {!j.appointments.length ? <Empty text={t('Aucun camion au portail ni à quai.')} /> : null}
        {j.appointments.map((a) => <ApptLine key={a.id} a={a} docks={docks} reload={st.reload} />)}
      </div>
    )}</Loaded>
  );
}

function Docks({ docks, reload }) {
  const t = useT();
  const { oapi, modal, toast, fail, can } = useWs();
  const locs = useLocations();
  const linkable = locs.locations.filter((l) => l.active && ['reception', 'shipping', 'staging'].includes(l.kind));
  const DIRS = [['both', t('Réception et expédition')], ['inbound', t('Réception')], ['outbound', t('Expédition')]];
  const add = () => modal(t('Nouveau quai'), (close) => (
    <Form submitText={t('Créer le quai')} fields={[
      { k: 'code', label: t('Code (Q1, PORTE-2…)'), required: true }, { k: 'name', label: t('Nom') },
      { k: 'direction', label: t('Usage'), type: 'select', options: DIRS },
      { k: 'locationId', label: t('Emplacement rattaché'), type: 'select', options: [['', t('Aucun')]].concat(linkable.map((l) => [String(l.id), l.code + ' · ' + tsrv(l.kindLabel)])), hint: t("Réception pour un quai d'arrivée, quai d'expédition pour un quai de départ.") },
    ]} onSubmit={(v) => oapi('POST', WMS + '/yard/docks', { ...v, locationId: v.locationId ? Number(v.locationId) : undefined }).then(() => { close(); toast(t('Quai créé.')); reload(); })} />
  ));
  return (
    <>
      {can('manager') ? <div className="row wms-toolbar wms-pilot-top"><span /><button className="btn primary" type="button" onClick={add}>{t('Nouveau quai')}</button></div> : null}
      <div className="ws-card">
        {!docks.length ? <Empty text={t('Aucun quai pour le moment.')} /> : null}
        {docks.map((d) => (
          <div className="line" key={d.id}>
            <span><b>{d.code}</b> {!d.active ? <Tag tone="mid">{t('inactif')}</Tag> : null}<small>{' ' + d.name + ' · ' + tsrv(d.directionLabel) + (d.location ? ' · ' + d.location : '') + (d.warehouse ? ' · ' + d.warehouse : '')}</small></span>
            {can('manager') ? <button className="btn small" type="button" onClick={() => oapi('PUT', WMS + '/yard/docks/' + d.id, { active: !d.active }).then(reload).catch(fail)}>{d.active ? t('Désactiver') : t('Activer')}</button> : null}
          </div>
        ))}
      </div>
    </>
  );
}

function Indicators() {
  const t = useT();
  const { oapi } = useWs();
  const [days, setDays] = useState('1');
  const to = todayLocal(); const from = new Date(Date.parse(to) - (Number(days) - 1) * 86400000).toISOString().slice(0, 10);
  const st = useLoad(() => oapi('GET', WMS + '/yard/kpis?from=' + from + '&to=' + to), [days]);
  const min = (v) => (v === null ? '—' : t('{n} min', { n: qty(v) }));
  return (
    <>
      <Seg tabs={[['1', t("Aujourd'hui")], ['7', t('7 jours')], ['30', t('30 jours')]]} value={days} onChange={setDays} />
      <Loaded state={st}>{(k) => (
        <>
          <Kpis list={[
            { label: t('Rendez-vous'), value: qty(k.appointments) }, { label: t('Ponctualité'), value: k.onTimeRate === null ? '—' : pct(k.onTimeRate), bad: k.onTimeRate !== null && k.onTimeRate < 80 },
            { label: t('Attente moyenne au portail'), value: min(k.avgWaitMinutes) }, { label: t('Attente maximale'), value: min(k.maxWaitMinutes) },
            { label: t('Temps moyen à quai'), value: min(k.avgDockMinutes) }, { label: t('Séjour moyen sur site'), value: min(k.avgDwellMinutes) },
            { label: t('Pas venus'), value: qty(k.noShows), bad: k.noShows > 0 }, { label: t('Occupation des quais'), value: pct(k.utilisation) },
          ]} />
          <div className="ws-card"><PctBars title={t('Occupation par quai')} warn={101} empty={t('Aucun quai actif.')} rows={k.perDock.map((d) => ({ label: d.code, value: d.utilisation, sub: t('{n} min occupées', { n: qty(d.minutes) }) }))} /></div>
          <p className="muted small">{t("Occupation = minutes occupées ÷ (quais actifs × heures d'ouverture par jour × jours). Ponctualité : arrivée au plus tard au début du créneau plus la tolérance.")}</p>
        </>
      )}</Loaded>
    </>
  );
}

function Config() {
  const t = useT();
  const { oapi, toast } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/yard/config'), []);
  return (
    <Loaded state={st}>{(j) => (
      <div className="ws-card">
        <Form submitText={t('Enregistrer')} fields={[
          { k: 'hoursPerDay', label: t("Heures d'ouverture des quais par jour"), value: String(j.config.hoursPerDay) },
          { k: 'tolerance', label: t('Tolérance de retard (minutes)'), value: String(j.config.tolerance) },
          { k: 'waitAlert', label: t("Alerte d'attente au portail (minutes)"), value: String(j.config.waitAlert) },
        ]} onSubmit={(v) => oapi('PUT', WMS + '/yard/config', v).then(() => { toast(t('Réglages enregistrés.')); st.reload(); })} />
      </div>
    )}</Loaded>
  );
}

export default function Yard() {
  const t = useT();
  const { oapi, can } = useWs();
  const [tab, setTab] = useState('calendar');
  const d = useLoad(() => oapi('GET', WMS + '/yard/docks'), []);
  const docks = d.data ? d.data.docks : [];
  const tabs = [['calendar', t('Calendrier')], ['yard', t('Dans la cour')], ['kpis', t('Indicateurs')], ['docks', t('Quais')]].concat(can('manager') ? [['config', t('Réglages')]] : []);
  return (
    <>
      <Seg tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'calendar' ? <Calendar docks={docks} /> : tab === 'yard' ? <InYard docks={docks} /> : tab === 'kpis' ? <Indicators /> : tab === 'docks' ? <Docks docks={docks} reload={d.reload} /> : <Config />}
    </>
  );
}
