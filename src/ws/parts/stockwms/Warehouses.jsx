import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, Loading, useLoad } from '../../ui.jsx';
import { Kpis, Tag, WMS, itemOptions, locOptions, qty, useItems, useLocations } from './kit.jsx';

/* Entrepôts → zones → emplacements (allée / rayon / bac), contenu d'un emplacement, stock d'un article par emplacement, règles et tâches de rangement. */
const KIND_TONE = { storage: 'good', picking: 'good', reception: 'mid', quarantine: 'bad', returns: 'mid', scrap: 'bad', transit: 'mid', staging: 'mid', shipping: 'mid' };

/** Stock d'un article par emplacement (fenêtre ouverte depuis la liste des articles). */
export function ItemLevels({ item }) {
  const t = useT();
  const { oapi, money, modal } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/items/' + item.id + '/levels'), []);
  const locs = useLocations();
  const move = (from, close) => modal(t('Déplacer : {name}', { name: item.name }), (c2) => (
    <Form submitText={t('Déplacer')} fields={[
      { k: 'to', label: t('Vers l\'emplacement'), type: 'select', options: locOptions(locs.locations.filter((l) => l.id !== from.locationId), t('Choisir…')), required: true },
      { k: 'quantity', label: t('Quantité ({unit})', { unit: item.unit }), value: String(from.quantity), required: true },
      { k: 'reason', label: t('Motif (facultatif)') }]}
    onSubmit={(v) => oapi('POST', WMS + '/move', { itemId: item.id, fromLocationId: from.locationId, toLocationId: Number(v.to), quantity: v.quantity, reason: v.reason }).then(() => { c2(); if (close) close(); st.reload(); })} />
  ));
  return (
    <Loaded state={st}>{(j) => (
      <div>
        <p className="muted small">{t('En stock : {n} {unit} · disponibles : {m}', { n: qty(j.quantity), unit: item.unit, m: qty(j.usable) })}</p>
        {!j.levels.length ? <Empty text={t("Aucune quantité en stock.")} /> : null}
        {j.levels.map((l) => (
          <div className="line" key={l.locationId}>
            <span><b>{l.code}</b> <Tag tone={KIND_TONE[l.kind]}>{t(l.kindLabel)}</Tag><small>{' ' + l.warehouse}</small></span>
            <span className="row"><b>{qty(l.quantity) + ' ' + item.unit}</b>{l.value !== undefined ? <small>{money(l.value)}</small> : null}
              {locs.locations.length > 1 ? <button className="link" type="button" onClick={() => move(l)}>{t('Déplacer')}</button> : null}</span>
          </div>
        ))}
      </div>
    )}
    </Loaded>
  );
}

function LocationDetail({ id, reload, close }) {
  const t = useT();
  const { oapi, can, money, fail, confirm, modal } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/locations/' + id), []);
  const mgr = can('manager');
  const edit = (l) => modal(t("Modifier l'emplacement"), (c2) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'name', label: t('Nom (facultatif)'), value: l.name },
      { k: 'capacity', label: t('Capacité maximale (facultatif)'), value: l.capacity === null ? '' : l.capacity },
      { k: 'active', label: t('État'), type: 'select', value: l.active ? '1' : '0', options: [['1', t('Actif')], ['0', t('Désactivé')]] }]}
    onSubmit={(v) => oapi('PUT', WMS + '/locations/' + l.id, { name: v.name, capacity: v.capacity === '' ? null : v.capacity, active: v.active === '1' }).then(() => { c2(); st.reload(); reload(); })} />
  ));
  return (
    <Loaded state={st}>{({ location: l, content, hus }) => (
      <div>
        <p><b>{l.code}</b> <Tag tone={KIND_TONE[l.kind]}>{t(l.kindLabel)}</Tag> <small className="muted">{l.warehouse}{l.zone ? ' · ' + l.zone : ''}</small></p>
        {l.capacity !== null ? <p className="muted small">{t('Capacité {n}', { n: qty(l.capacity) })}</p> : null}
        {!content.length ? <Empty text={t('Cet emplacement est vide.')} /> : null}
        {content.map((c) => <div className="line" key={c.itemId}><span><b>{c.name}</b>{c.sku ? <small>{' ' + c.sku}</small> : null}</span><span className="row"><b>{qty(c.quantity) + ' ' + c.unit}</b>{c.value !== undefined ? <small>{money(c.value)}</small> : null}</span></div>)}
        {hus && hus.length ? <p className="muted small">{t('Palettes et colis ici : {list}', { list: hus.map((h) => h.code).join(', ') })}</p> : null}
        {mgr ? (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn small" type="button" onClick={() => edit(l)}>{t('Modifier')}</button>
            {!l.isDefault && l.kind !== 'transit' ? <button className="btn small" type="button" onClick={() => confirm(t('Supprimer l\'emplacement {code} ?', { code: l.code }), () => { oapi('DELETE', WMS + '/locations/' + l.id).then(() => { close(); reload(); }).catch(fail); })}>{t('Supprimer')}</button> : null}
          </div>
        ) : null}
      </div>
    )}
    </Loaded>
  );
}

export default function Warehouses() {
  const t = useT();
  const { oapi, can, money, modal, fail, confirm, info } = useWs();
  const mgr = can('manager');
  const [wh, setWh] = useState('');
  const st = useLoad(() => oapi('GET', WMS + '/overview'), []);
  const ls = useLoad(() => oapi('GET', WMS + '/locations' + (wh ? '?warehouseId=' + wh : '')), [wh]);
  const zs = useLoad(() => oapi('GET', WMS + '/zones'), []);
  const all = () => { st.reload(); ls.reload(); zs.reload(); };
  const branchOpts = [['', t('Toute l\'organisation')]].concat((info.branches || []).map((b) => [String(b.id), b.name]));

  const addWh = () => modal(t('Nouvel entrepôt'), (close) => (
    <Form submitText={t('Créer')} fields={[{ k: 'name', label: t('Nom'), required: true, placeholder: t('Dépôt Douala') }, { k: 'code', label: t('Code (facultatif)'), hint: t('Lettres et chiffres, sans espace.') }, { k: 'address', label: t('Adresse (facultatif)') },
      ...((info.branches || []).length ? [{ k: 'branchId', label: t('Antenne'), type: 'select', options: branchOpts }] : [])]}
    onSubmit={(v) => oapi('POST', WMS + '/warehouses', { name: v.name, code: v.code, address: v.address, branchId: v.branchId || undefined }).then(() => { close(); all(); })} />
  ));
  const addZone = () => {
    const whs = st.data ? st.data.warehouses : [];
    modal(t('Nouvelle zone'), (close) => (
      <Form submitText={t('Créer')} fields={[{ k: 'warehouseId', label: t('Entrepôt'), type: 'select', options: whs.map((w) => [String(w.id), w.name]), required: true }, { k: 'name', label: t('Nom'), required: true, placeholder: t('Froid') },
        { k: 'kind', label: t('Type'), type: 'select', options: Object.entries(st.data.zoneKinds).map(([k, v]) => [k, t(v)]) }]}
      onSubmit={(v) => oapi('POST', WMS + '/zones', { warehouseId: Number(v.warehouseId), name: v.name, kind: v.kind }).then(() => { close(); all(); })} />
    ));
  };
  const addLoc = () => {
    const whs = st.data ? st.data.warehouses : [];
    modal(t('Nouvel emplacement'), (close) => (
      <Form submitText={t('Créer')} fields={[{ k: 'warehouseId', label: t('Entrepôt'), type: 'select', options: whs.map((w) => [String(w.id), w.name]), value: wh || (whs[0] && String(whs[0].id)) }, { k: 'aisle', label: t('Allée'), placeholder: 'A' }, { k: 'rack', label: t('Rayon'), placeholder: '01' }, { k: 'bin', label: t('Bac'), placeholder: '02' },
        { k: 'code', label: t('Code (facultatif)'), hint: t('Sinon : allée-rayon-bac. Il sert au scan et doit être unique.') },
        { k: 'kind', label: t('Type'), type: 'select', options: Object.entries(st.data.kinds).filter(([k]) => k !== 'transit').map(([k, v]) => [k, t(v)]) }, { k: 'capacity', label: t('Capacité maximale (facultatif)') }]}
      onSubmit={(v) => oapi('POST', WMS + '/locations', { warehouseId: Number(v.warehouseId), aisle: v.aisle, rack: v.rack, bin: v.bin, code: v.code, kind: v.kind, capacity: v.capacity === '' ? undefined : v.capacity }).then(() => { close(); all(); })} />
    ));
  };
  const bulk = () => {
    const whs = st.data ? st.data.warehouses : [];
    modal(t('Créer plusieurs emplacements'), (close) => (
      <Form submitText={t('Créer')} fields={[{ k: 'warehouseId', label: t('Entrepôt'), type: 'select', options: whs.map((w) => [String(w.id), w.name]), value: wh || (whs[0] && String(whs[0].id)) }, { k: 'aisles', label: t('Allées (séparées par une virgule)'), placeholder: 'A, B, C', required: true },
        { k: 'racks', label: t('Rayons par allée'), value: '3', required: true }, { k: 'bins', label: t('Bacs par rayon'), value: '2', required: true },
        { k: 'zoneId', label: t('Zone (facultatif)'), type: 'select', options: [['', t('Aucune')]].concat(zs.data ? zs.data.zones.map((z) => [String(z.id), z.warehouse + ' · ' + z.name]) : []) }, { k: 'capacity', label: t('Capacité de chaque emplacement (facultatif)') }]}
      onSubmit={(v) => oapi('POST', WMS + '/locations/bulk', { warehouseId: Number(v.warehouseId), aisles: v.aisles, racks: v.racks, bins: v.bins, zoneId: v.zoneId || undefined, capacity: v.capacity === '' ? undefined : v.capacity }).then((j) => { close(); all(); modal(t('Emplacements créés'), () => <p>{t('{n} créé(s), {m} déjà existant(s).', { n: j.created, m: j.skipped })}</p>); })} />
    ));
  };
  const detail = (l) => modal(t('Emplacement {code}', { code: l.code }), (close) => <LocationDetail id={l.id} reload={all} close={close} />);
  const editWh = (w) => modal(t("Modifier l'entrepôt"), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'name', label: t('Nom'), value: w.name, required: true }, { k: 'address', label: t('Adresse'), value: w.address }, { k: 'active', label: t('État'), type: 'select', value: w.active ? '1' : '0', options: [['1', t('Actif')], ['0', t('Désactivé')]] }]}
    onSubmit={(v) => oapi('PUT', WMS + '/warehouses/' + w.id, { name: v.name, address: v.address, active: v.active === '1' }).then(() => { close(); all(); })} />
  ));

  return (
    <>
      {mgr ? (
        <div className="row wms-toolbar">
          <button className="btn primary small" type="button" onClick={addWh}>{t('Ajouter un entrepôt')}</button>
          <button className="btn small" type="button" onClick={addZone}>{t('Ajouter une zone')}</button>
          <button className="btn small" type="button" onClick={addLoc}>{t('Ajouter un emplacement')}</button>
          <button className="btn small" type="button" onClick={bulk}>{t('Créer en série')}</button>
        </div>
      ) : null}
      <Loaded state={st}>{(o) => (
        <>
          <Kpis list={[{ label: t('entrepôts'), value: String(o.warehouses.length) }, { label: t('emplacements'), value: String(o.warehouses.reduce((a, w) => a + w.locations, 0)) }, ...(mgr ? [{ label: t('valeur du stock'), value: money(o.warehouses.reduce((a, w) => a + w.value, 0)) }] : [])]} />
          <div className="ws-card">
            <h2>{t('Entrepôts')}</h2>
            {o.warehouses.map((w) => (
              <div className="line" key={w.id}>
                <span><b>{w.name}</b> <small>{w.code}{w.branch ? ' · ' + w.branch : ''}{w.isDefault ? ' · ' + t('principal') : ''}</small>{!w.active ? <Tag tone="bad">{t('Désactivé')}</Tag> : null}
                  <small>{' ' + t('{z} zone(s), {l} emplacement(s), {q} en stock', { z: w.zones, l: w.locations, q: qty(w.quantity) }) + (w.value !== undefined ? ' · ' + money(w.value) : '')}</small></span>
                <span className="row">
                  <button className="link" type="button" onClick={() => setWh(wh === String(w.id) ? '' : String(w.id))}>{wh === String(w.id) ? t('Tous les emplacements') : t('Voir les emplacements')}</button>
                  {mgr ? <button className="link" type="button" onClick={() => editWh(w)}>{t('Modifier')}</button> : null}
                  {mgr && !w.isDefault ? <button className="link" type="button" onClick={() => confirm(t('Supprimer l\'entrepôt « {name} » ?', { name: w.name }), () => { oapi('DELETE', WMS + '/warehouses/' + w.id).then(all).catch(fail); })}>{t('Supprimer')}</button> : null}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      </Loaded>
      <div className="ws-card">
        <h2>{t('Emplacements')}</h2>
        {ls.loading && !ls.data ? <Loading /> : null}
        {ls.data && !ls.data.locations.length ? <Empty text={t("Aucun emplacement.")} /> : null}
        {ls.data ? ls.data.locations.map((l) => (
          <div className="line" key={l.id}>
            <span><b>{l.code}</b> <Tag tone={KIND_TONE[l.kind]}>{t(l.kindLabel)}</Tag>{!l.active ? <Tag tone="bad">{t('Désactivé')}</Tag> : null}
              <small>{' ' + l.warehouse + (l.zone ? ' · ' + l.zone : '') + ' · ' + t('{n} article(s), {q} en tout', { n: l.items, q: qty(l.quantity) }) + (l.capacity !== null ? ' · ' + t('capacité {n}', { n: qty(l.capacity) }) : '') + (l.value !== undefined ? ' · ' + money(l.value) : '')}</small></span>
            <button className="link" type="button" onClick={() => detail(l)}>{t('Voir')}</button>
          </div>
        )) : null}
      </div>
    </>
  );
}

/** Rangement : ce qui attend en réception, et les règles qui disent où le ranger. */
export function Putaway() {
  const t = useT();
  const { oapi, can, modal, fail, toast } = useWs();
  const mgr = can('manager');
  const tasks = useLoad(() => oapi('GET', WMS + '/putaway/pending'), []);
  const rules = useLoad(() => oapi('GET', WMS + '/putaway-rules'), []);
  const locs = useLocations();
  const items = useItems();
  const go = (task, to) => oapi('POST', WMS + '/putaway', { itemId: task.itemId, fromLocationId: task.fromLocationId, toLocationId: to || undefined }).then(() => { toast(t('Rangé.')); tasks.reload(); }).catch(fail);
  const choose = (task) => modal(t('Ranger : {name}', { name: task.name }), (close) => (
    <Form submitText={t('Ranger')} fields={[{ k: 'to', label: t('Emplacement'), type: 'select', options: locOptions(locs.locations.filter((l) => l.id !== task.fromLocationId), t('Choisir…'), true), required: true }]}
      onSubmit={(v) => oapi('POST', WMS + '/putaway', { itemId: task.itemId, fromLocationId: task.fromLocationId, toLocationId: Number(v.to) }).then(() => { close(); tasks.reload(); })} />
  ));
  const addRule = () => modal(t('Nouvelle règle de rangement'), (close) => (
    <Form submitText={t('Créer')} fields={[
      { k: 'itemId', label: t('Article (ou laissez vide pour un type de suivi)'), type: 'select', options: itemOptions(items.items, t('— Tous —')) },
      { k: 'tracking', label: t('Type de suivi'), type: 'select', options: [['', t('Aucun')], ['lot', t('Par lot')], ['serial', t('Par numéro de série')], ['none', t('Sans suivi')]] },
      { k: 'locationId', label: t('Ranger dans'), type: 'select', options: locOptions(locs.locations, t('Choisir…'), true), required: true },
      { k: 'priority', label: t('Priorité (1 = d\'abord)'), value: '100' }]}
    onSubmit={(v) => oapi('POST', WMS + '/putaway-rules', { itemId: v.itemId || undefined, tracking: v.itemId ? undefined : v.tracking || undefined, locationId: Number(v.locationId), priority: v.priority }).then(() => { close(); rules.reload(); })} />
  ));
  return (
    <>
      <div className="ws-card">
        <h2>{t('À ranger')}</h2>
        <p className="muted small">{t("Le stock arrivé en réception attend sa place. La destination suit les règles ci-dessous ; sans règle, il va à l'emplacement principal.")}</p>
        <Loaded state={tasks}>{(j) => (
          <>
            {!j.tasks.length ? <Empty text={t('Rien à ranger.')} /> : null}
            {j.tasks.map((x) => (
              <div className="line" key={x.fromLocationId + '-' + x.itemId}>
                <span><b>{x.name}</b><small>{' ' + qty(x.quantity) + ' ' + x.unit + ' · ' + t('en {code}', { code: x.from })}</small>
                  {x.suggestion.length ? <small>{' → ' + x.suggestion.map((s) => s.code + ' (' + qty(s.quantity) + ')').join(', ')}</small> : null}</span>
                <span className="row">
                  {x.suggestion.length ? <button className="btn small primary" type="button" onClick={() => go(x)}>{t('Ranger comme proposé')}</button> : null}
                  <button className="link" type="button" onClick={() => choose(x)}>{t('Choisir la place')}</button>
                </span>
              </div>
            ))}
          </>
        )}
        </Loaded>
      </div>
      <div className="ws-card">
        <div className="ws-head"><h2>{t('Règles de rangement')}</h2>{mgr ? <button className="btn small" type="button" onClick={addRule}>{t('Ajouter une règle')}</button> : null}</div>
        <Loaded state={rules}>{(j) => (
          <>
            {!j.rules.length ? <Empty text={t('Aucune règle : tout est rangé à l\'emplacement principal.')} /> : null}
            {j.rules.map((r) => (
              <div className="line" key={r.id}>
                <span><b>{r.item || (r.tracking ? t('Suivi : {x}', { x: r.tracking === 'lot' ? t('par lot') : r.tracking === 'serial' ? t('par numéro de série') : t('aucun') }) : '')}</b><small>{' → ' + r.location + ' · ' + t('priorité {n}', { n: r.priority })}</small></span>
                {mgr ? <button className="link" type="button" onClick={() => oapi('DELETE', WMS + '/putaway-rules/' + r.id).then(rules.reload).catch(fail)}>{t('Supprimer')}</button> : null}
              </div>
            ))}
          </>
        )}
        </Loaded>
      </div>
    </>
  );
}
