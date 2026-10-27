import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';

/* Logistique : parc (véhicules, chauffeurs), échéances réglementaires, carburant, et articles du stock d'une livraison. */

const VKIND = [['van', 'Fourgonnette'], ['truck', 'Camion'], ['car', 'Voiture'], ['moto', 'Moto'], ['other', 'Autre']];
const VSTATUS = [['active', 'En service'], ['maintenance', 'En maintenance'], ['retired', 'Retiré du parc']];
const STATE_PILL = { expired: ['bad', 'Périmée'], critical: ['bad', 'Moins de 7 jours'], soon: ['mid', 'Moins de 30 jours'], ok: ['good', 'À jour'] };

/** Pastille d'une échéance : le libellé passe par t() à l'affichage. */
function Due({ c }) {
  const t = useT();
  const { dateFr } = useWs();
  const kinds = { insurance: t('Assurance'), inspection: t('Visite technique'), tax: t('Vignette / taxe'), license: t('Permis'), medical: t('Visite médicale'), other: t('Autre échéance') };
  const p = STATE_PILL[c.state];
  return <span><span className={'pill ' + p[0]}>{t(p[1])}</span>{' ' + kinds[c.kind] + ' · ' + dateFr(c.expiresAt) + (c.reference ? ' · ' + c.reference : '')}</span>;
}

export function Fleet() {
  const t = useT();
  const { oapi, can, money, modal, confirm, fail, toast } = useWs();
  const st = useLoad(() => Promise.all([oapi('GET', '/logistics/fleet'), oapi('GET', '/maintenance')]), []);
  const mgr = can('manager');
  const reload = st.reload;

  const editVehicle = (v, equipment) => modal(v ? t('Modifier le véhicule') : t('Nouveau véhicule'), (close) => (
    <Form
      submitText={t('Enregistrer')}
      fields={[
        { k: 'plate', label: t('Immatriculation'), required: true, value: v && v.plate }, { k: 'label', label: t('Marque / modèle'), value: v && v.label },
        { k: 'kind', label: t('Type'), type: 'select', value: v ? v.kind : 'van', options: VKIND.map((x) => [x[0], t(x[1])]) },
        { k: 'vin', label: t('Numéro de châssis (VIN)'), value: v && v.vin }, { k: 'capacity', label: t('Capacité / charge utile'), value: v && v.capacity },
        { k: 'odometer', label: t('Kilométrage actuel'), value: v ? v.odometer : '' },
        { k: 'status', label: t('État'), type: 'select', value: v ? v.status : 'active', options: VSTATUS.map((x) => [x[0], t(x[1])]) },
        { k: 'equipmentId', label: t('Équipement de maintenance lié'), type: 'select', value: v && v.equipmentId ? String(v.equipmentId) : '', options: [['', t('Aucun')]].concat(equipment.filter((e) => e.kind === 'vehicle').map((e) => [String(e.id), e.name])), hint: t("Les plans d'entretien au kilomètre suivent alors le compteur du véhicule.") },
        { k: 'note', label: t('Note'), value: v && v.note },
      ]}
      onSubmit={(v2) => oapi(v ? 'PUT' : 'POST', '/logistics/vehicles' + (v ? '/' + v.id : ''), v2).then(() => { close(); reload(); })}
    />
  ));
  const editDriver = (d) => modal(d ? t('Modifier le chauffeur') : t('Nouveau chauffeur'), (close) => (
    <Form
      submitText={t('Enregistrer')}
      fields={[
        { k: 'name', label: t('Nom'), required: true, value: d && d.name }, { k: 'phone', label: t('Téléphone'), value: d && d.phone },
        { k: 'licenseNo', label: t('Numéro de permis'), value: d && d.licenseNo }, { k: 'licenseCategory', label: t('Catégorie'), value: d && d.licenseCategory, placeholder: 'B, C…' },
        { k: 'active', label: t('Disponible'), type: 'select', value: d && !d.active ? 'no' : 'yes', options: [['yes', t('Oui')], ['no', t('Non, en pause')]] },
      ]}
      onSubmit={(v) => oapi(d ? 'PUT' : 'POST', '/logistics/drivers' + (d ? '/' + d.id : ''), { ...v, active: v.active === 'yes' }).then(() => { close(); reload(); })}
    />
  ));
  const addDue = (subject, id) => modal(t('Nouvelle échéance'), (close) => (
    <Form
      submitText={t('Enregistrer')}
      fields={[
        { k: 'kind', label: t('Type'), type: 'select', options: subject === 'vehicle' ? [['insurance', t('Assurance')], ['inspection', t('Visite technique')], ['tax', t('Vignette / taxe')], ['other', t('Autre échéance')]] : [['license', t('Permis')], ['medical', t('Visite médicale')], ['other', t('Autre échéance')]] },
        { k: 'expiresAt', label: t("Date d'échéance"), type: 'date', required: true }, { k: 'reference', label: t('Référence (police, numéro…)') },
      ]}
      onSubmit={(v) => oapi('POST', '/logistics/compliance', { ...v, subject, vehicleId: subject === 'vehicle' ? id : undefined, driverId: subject === 'driver' ? id : undefined }).then(() => { close(); reload(); })}
    />
  ));
  const fuel = (v) => modal(t('Plein de carburant : {plate}', { plate: v.plate }), (close) => (
    <Form
      submitText={t('Enregistrer')}
      fields={[
        { k: 'date', label: t('Date'), type: 'date' }, { k: 'liters', label: t('Litres'), required: true }, { k: 'odometer', label: t('Kilométrage au compteur'), required: true, value: v.odometer, hint: t('Le plein précédent doit être plein aussi : la consommation se calcule entre deux pleins.') },
        ...(mgr ? [{ k: 'amount', label: t('Montant payé'), hint: t('Facultatif.') }, { k: 'toBudget', label: t('Inscrire au budget'), type: 'select', options: [['no', t('Non')], ['yes', t('Oui, en dépense « Carburant »')]] }] : []),
        { k: 'station', label: t('Station') },
      ]}
      onSubmit={(v2) => oapi('POST', '/logistics/fuel', { ...v2, vehicleId: v.id, toBudget: v2.toBudget === 'yes' }).then((j) => { close(); reload(); if (j.consumption) toast(t('Consommation : {n} L/100 km', { n: j.consumption })); })}
    />
  ));
  const fuelLog = (v) => oapi('GET', '/logistics/fuel?vehicleId=' + v.id).then((j) => modal(t('Carburant : {plate}', { plate: v.plate }), () => (
    <>
      {!j.fuel.length ? <Empty text={t('Aucun relevé.')} /> : null}
      {j.fuel.map((f) => <div className="line" key={f.id}><span><b>{f.liters + ' L'}</b><small>{' ' + [f.date, f.odometer + ' km', f.consumption ? f.consumption + ' L/100' : '', f.driver, f.station].filter(Boolean).join(' · ')}</small></span>{f.amount ? <small>{money(f.amount)}</small> : null}</div>)}
    </>
  ))).catch(fail);

  return (
    <Loaded state={st}>{([j, m]) => (
      <>
        <div className="kpis">
          <div className="stat"><b>{String(j.summary.active)}</b><span>{t('véhicule(s) en service')}</span></div>
          <div className={'stat' + (j.summary.expired ? ' bad' : '')}><b>{String(j.summary.expired)}</b><span>{t('échéance(s) périmée(s)')}</span></div>
          <div className={'stat' + (j.summary.soon ? ' bad' : '')}><b>{String(j.summary.soon)}</b><span>{t('échéance(s) à renouveler sous 30 jours')}</span></div>
        </div>
        <div className="ws-card">
          <div className="ws-head"><h2>{t('Véhicules')}</h2>{mgr ? <button className="btn primary small" type="button" onClick={() => editVehicle(null, m.equipment)}>{t('Ajouter un véhicule')}</button> : null}</div>
          {!j.vehicles.length ? <Empty text={t('Aucun véhicule. Ajoutez vos véhicules pour suivre leurs échéances, leur carburant et les affecter aux tournées.')} /> : null}
          {j.vehicles.map((v) => (
            <div className="ws-card" key={v.id}>
              <div className="line">
                <span><b>{v.plate}</b>{v.status !== 'active' ? <span className="pill mid">{t(VSTATUS.find((x) => x[0] === v.status)[1])}</span> : null}<small>{' ' + [v.label, v.odometer + ' km', v.avgConsumption ? t('{n} L/100 km en moyenne', { n: v.avgConsumption }) : '', v.equipment ? t('maintenance : {name}', { name: v.equipment }) : '', mgr && v.costPerKm ? t('{amount} par km', { amount: money(v.costPerKm) }) : ''].filter(Boolean).join(' · ')}</small></span>
                <span className="row">
                  <button className="link" type="button" onClick={() => fuel(v)}>{t('Plein')}</button>
                  <button className="link" type="button" onClick={() => fuelLog(v)}>{t('Carburant')}</button>
                  {mgr ? <button className="link" type="button" onClick={() => addDue('vehicle', v.id)}>{t('Échéance')}</button> : null}
                  {mgr ? <button className="link" type="button" onClick={() => editVehicle(v, m.equipment)}>{t('Modifier')}</button> : null}
                  {mgr ? <button className="link" type="button" onClick={() => confirm(t('Supprimer le véhicule {plate} ?', { plate: v.plate }), () => { oapi('DELETE', '/logistics/vehicles/' + v.id).then(reload).catch(fail); })}>{t('Supprimer')}</button> : null}
                </span>
              </div>
              {v.deadlines.map((c) => <div className="line" key={c.id}><Due c={c} />{mgr ? <button className="link" type="button" onClick={() => confirm(t('Supprimer cette échéance ?'), () => { oapi('DELETE', '/logistics/compliance/' + c.id).then(reload).catch(fail); })}>{t('Supprimer')}</button> : null}</div>)}
              {v.maintenance.map((p, i) => <div className="line" key={'m' + i}><small>{t('Entretien prévu : {task}', { task: p.task }) + (p.dueAt ? ' · ' + p.dueAt : '') + (p.dueMeter ? ' · ' + p.dueMeter + ' km' : '')}</small></div>)}
            </div>
          ))}
        </div>
        <div className="ws-card">
          <div className="ws-head"><h2>{t('Chauffeurs')}</h2>{mgr ? <button className="btn primary small" type="button" onClick={() => editDriver(null)}>{t('Ajouter un chauffeur')}</button> : null}</div>
          {!j.drivers.length ? <Empty text={t('Aucun chauffeur. Ajoutez-les avec leur permis : ils pourront être affectés aux tournées.')} /> : null}
          {j.drivers.map((d) => (
            <div key={d.id}>
              <div className="line">
                <span><b>{d.name}</b>{!d.active ? <span className="pill">{t('En pause')}</span> : null}<small>{' ' + [d.phone, d.licenseNo ? t('permis {no}', { no: d.licenseNo }) + (d.licenseCategory ? ' ' + d.licenseCategory : '') : ''].filter(Boolean).join(' · ')}</small></span>
                {mgr ? <span className="row"><button className="link" type="button" onClick={() => addDue('driver', d.id)}>{t('Échéance')}</button><button className="link" type="button" onClick={() => editDriver(d)}>{t('Modifier')}</button>
                  <button className="link" type="button" onClick={() => confirm(t('Supprimer {name} ?', { name: d.name }), () => { oapi('DELETE', '/logistics/drivers/' + d.id).then(reload).catch(fail); })}>{t('Supprimer')}</button></span> : null}
              </div>
              {d.deadlines.map((c) => <div className="line" key={c.id}><Due c={c} />{mgr ? <button className="link" type="button" onClick={() => confirm(t('Supprimer cette échéance ?'), () => { oapi('DELETE', '/logistics/compliance/' + c.id).then(reload).catch(fail); })}>{t('Supprimer')}</button> : null}</div>)}
            </div>
          ))}
        </div>
      </>
    )}
    </Loaded>
  );
}

/** Articles du stock d'une livraison : expédier les sort du stock, un retour les remet. */
export function DeliveryItems({ delivery, close, done }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const st = useLoad(() => Promise.all([oapi('GET', '/stock'), oapi('GET', '/logistics/deliveries/' + delivery.id)]), []);
  const [rows, setRows] = useState(null);
  const [pick, setPick] = useState({ itemId: '', quantity: '1', serials: '' });
  return (
    <Loaded state={st}>{([s, d]) => {
      const locked = d.delivery.stockOut && !d.delivery.stockBack;
      const cur = rows || d.delivery.items.map((x) => ({ itemId: x.itemId, name: x.name, unit: x.unit, tracking: x.tracking, quantity: x.quantity, serials: x.serials.join('\n') }));
      const it = s.items.find((x) => String(x.id) === String(pick.itemId));
      const add = () => { if (!it) return; setRows(cur.filter((x) => x.itemId !== it.id).concat({ itemId: it.id, name: it.name, unit: it.unit, tracking: it.tracking, quantity: pick.quantity, serials: pick.serials })); setPick({ itemId: '', quantity: '1', serials: '' }); };
      const save = () => oapi('PUT', '/logistics/deliveries/' + delivery.id + '/items', { items: cur.map((x) => ({ itemId: x.itemId, quantity: x.quantity, serials: x.serials })) }).then(() => { close(); done(); }).catch(fail);
      return (
        <>
          <p className="muted small">{locked ? t('Le stock est déjà sorti pour cette livraison.') : t('Quand la livraison passe à « Expédiée », ces articles sortent du stock. Si elle est « Retournée », ils y reviennent (une seule fois).')}</p>
          {!cur.length ? <Empty text={t('Aucun article du stock lié.')} /> : null}
          {cur.map((x) => <div className="line" key={x.itemId}><span><b>{x.name}</b><small>{' ' + (x.tracking === 'serial' ? String(x.serials).split(/[\n,;]+/).filter(Boolean).join(', ') : x.quantity + ' ' + x.unit)}</small></span>{!locked ? <button className="link" type="button" onClick={() => setRows(cur.filter((y) => y.itemId !== x.itemId))}>{t('Retirer')}</button> : null}</div>)}
          {!locked ? (
            <div className="ws-form">
              <label className="fld"><span>{t('Article')}</span><select style={{ fontSize: 16 }} value={pick.itemId} onChange={(e) => setPick({ ...pick, itemId: e.target.value })}><option value="">{t('Choisir…')}</option>{s.items.map((x) => <option key={x.id} value={x.id}>{x.name + ' (' + x.quantity + ' ' + x.unit + ')'}</option>)}</select></label>
              {it && it.tracking === 'serial'
                ? <label className="fld"><span>{t('Numéros de série ou VIN (un par ligne)')}</span><textarea style={{ fontSize: 16 }} rows={2} value={pick.serials} onChange={(e) => setPick({ ...pick, serials: e.target.value })} /></label>
                : <label className="fld"><span>{t('Quantité')}</span><input style={{ fontSize: 16 }} value={pick.quantity} onChange={(e) => setPick({ ...pick, quantity: e.target.value })} /></label>}
              <div className="row"><button className="btn small" type="button" disabled={!it} onClick={add}>{t('Ajouter')}</button><button className="btn primary small" type="button" onClick={save}>{t('Enregistrer')}</button></div>
            </div>
          ) : null}
        </>
      );
    }}
    </Loaded>
  );
}
