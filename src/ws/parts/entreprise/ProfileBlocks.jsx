import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Button, Empty, Loaded, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import Driver from '../tms/Driver.jsx';

/* Blocs d'un profil de rôle : indicateurs, listes, tâches, et les composants du chauffeur (missions, carburant, incident). */

export function Tiles({ b }) {
  const { orgId } = useWs();
  const t = useT();
  return (
    <ul className="sp-tiles" aria-label={t('Indicateurs')}>
      {b.tiles.map((x) => {
        const body = <><span className="sp-n">{x.value}</span><span className="sp-l">{tsrv(x.label)}</span></>;
        return <li key={x.id} className={'sp-tile ' + (x.value && x.tone ? x.tone : 'plain')}>{x.to ? <Link to={`/app/${orgId}/${x.to}`}>{body}</Link> : <div>{body}</div>}</li>;
      })}
    </ul>
  );
}

export function ListBlock({ b }) {
  const { orgId } = useWs();
  const t = useT();
  return (
    <section className="ws-card ent-block">
      <h2>{tsrv(b.title)}</h2>
      {b.rows.length === 0 ? <p className="muted">{t('Rien à signaler.')}</p> : b.rows.map((r) => (
        <Link className="line ent-rowlink" key={r.id} to={`/app/${orgId}/${b.module}`}><span>{r.title}</span><small>{r.sub}</small></Link>
      ))}
    </section>
  );
}

export function TasksBlock({ b }) {
  const { orgId, dateFr } = useWs();
  const t = useT();
  return (
    <section className="ws-card ent-block">
      <h2>{t('Mes prochaines tâches')}</h2>
      {b.tasks.length === 0 ? <p className="muted">{t('Aucune tâche en cours.')}</p> : b.tasks.map((k) => <Link className="line ent-rowlink" key={k.id} to={`/app/${orgId}/projects`}><span>{k.title}</span><small>{k.due ? dateFr(k.due) : ''}</small></Link>)}
    </section>
  );
}

/** Carburant : un plein en quelques touches (véhicule, litres, compteur). */
export function Fuel() {
  const { oapi, toast, fail } = useWs();
  const t = useT();
  const fleet = useLoad(() => oapi('GET', '/logistics/fleet'), []);
  const [v, setV] = useState({ vehicleId: '', liters: '', odometer: '', amount: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  return (
    <section className="ws-card ent-block">
      <h2>{t('Carburant')}</h2>
      <Loaded state={fleet}>{(j) => (
        <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); setBusy(true); oapi('POST', '/logistics/fuel', { vehicleId: Number(v.vehicleId || (j.vehicles[0] && j.vehicles[0].id)), liters: v.liters, odometer: v.odometer, amount: v.amount }).then(() => { toast(t('Plein enregistré.')); setV({ vehicleId: v.vehicleId, liters: '', odometer: '', amount: '' }); }).catch(fail).finally(() => setBusy(false)); }}>
          <label className="fld"><span>{t('Véhicule')}</span><select value={v.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>{j.vehicles.map((x) => <option key={x.id} value={x.id}>{x.plate}{x.label ? ' · ' + x.label : ''}</option>)}</select></label>
          <div className="ent-two">
            <label className="fld"><span>{t('Litres')}</span><input inputMode="decimal" value={v.liters} onChange={(e) => set('liters', e.target.value)} /></label>
            <label className="fld"><span>{t('Kilométrage au compteur')}</span><input inputMode="numeric" value={v.odometer} onChange={(e) => set('odometer', e.target.value)} /></label>
          </div>
          <label className="fld"><span>{t('Montant')} <small>({t('facultatif')})</small></span><input inputMode="numeric" value={v.amount} onChange={(e) => set('amount', e.target.value)} /></label>
          <div className="row"><Button variant="primary" type="submit" loading={busy} disabled={!j.vehicles.length}>{t('Enregistrer le plein')}</Button></div>
        </form>
      )}</Loaded>
    </section>
  );
}

/** Incident : signaler une panne ou un problème du véhicule (crée une intervention corrective chez la maintenance). */
export function Incident() {
  const { oapi, toast, fail } = useWs();
  const t = useT();
  const fleet = useLoad(() => oapi('GET', '/logistics/fleet'), []);
  const [v, setV] = useState({ vehicleId: '', title: '' });
  const [busy, setBusy] = useState(false);
  return (
    <section className="ws-card ent-block">
      <h2>{t('Signaler un incident')}</h2>
      <Loaded state={fleet}>{(j) => {
        const linked = j.vehicles.filter((x) => x.equipmentId);
        if (!linked.length) return <Empty text={t("Aucun véhicule relié à la maintenance : prévenez votre responsable.")} />;
        return (
          <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); if (!v.title.trim()) { fail(new Error(t('Décrivez le problème.'))); return; } setBusy(true); const veh = linked.find((x) => String(x.id) === v.vehicleId) || linked[0]; oapi('POST', '/maintenance/orders', { equipmentId: veh.equipmentId, title: v.title.trim() }).then(() => { toast(t('Incident signalé à la maintenance.')); setV({ ...v, title: '' }); }).catch(fail).finally(() => setBusy(false)); }}>
            <label className="fld"><span>{t('Véhicule')}</span><select value={v.vehicleId} onChange={(e) => setV({ ...v, vehicleId: e.target.value })}>{linked.map((x) => <option key={x.id} value={x.id}>{x.plate}{x.label ? ' · ' + x.label : ''}</option>)}</select></label>
            <label className="fld"><span>{t('Que se passe-t-il ?')}</span><textarea rows={3} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
            <div className="row"><Button variant="primary" type="submit" loading={busy}>{t("Envoyer l'incident")}</Button></div>
          </form>
        );
      }}</Loaded>
    </section>
  );
}

function DriverBlock() {
  const t = useT();
  return <section className="ws-card ent-block"><h2>{t('Mes missions du jour')}</h2><Driver /></section>;
}
export const COMPONENTS = { driver: DriverBlock, fuel: Fuel, incident: Incident };
