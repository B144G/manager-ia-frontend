
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Tag, WMS, itemOptions, locOptions, qty, useItems, useLocations } from './kit.jsx';

/* Palettes, cartons et caisses (unités logistiques) : un code scannable, un contenu, un emplacement. Déplacer l'unité déplace son contenu. */
function UnitDetail({ id, reload, close }) {
  const t = useT();
  const { oapi, money, fail, modal, confirm } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/units/' + id), []);
  const items = useItems(); const locs = useLocations();
  const both = () => { st.reload(); reload(); };
  const add = () => modal(t("Ajouter à l'unité"), (c2) => (
    <Form submitText={t('Ajouter')} fields={[{ k: 'itemId', label: t('Article'), type: 'select', options: itemOptions(items.items.filter((i) => i.tracking !== 'serial'), t('Choisir…')), required: true }, { k: 'quantity', label: t('Quantité'), required: true, hint: t("Seule la quantité libre de l'emplacement (hors autres unités) peut être ajoutée.") }]}
    onSubmit={(v) => oapi('POST', WMS + '/units/' + id + '/items', { itemId: Number(v.itemId), quantity: v.quantity }).then(() => { c2(); both(); })} />
  ));
  const move = (u) => modal(t("Déplacer l'unité"), (c2) => (
    <Form submitText={t('Déplacer')} fields={[{ k: 'to', label: t("Vers l'emplacement"), type: 'select', options: locOptions(locs.locations.filter((l) => l.id !== u.locationId), t('Choisir…')), required: true }]}
    onSubmit={(v) => oapi('POST', WMS + '/units/' + id + '/move', { toLocationId: Number(v.to) }).then(() => { c2(); both(); })} />
  ));
  return (
    <Loaded state={st}>{({ unit: u }) => (
      <div>
        <p><b>{u.code}</b> <Tag tone="mid">{t(u.kindLabel)}</Tag> <small className="muted">{t('en {code}', { code: u.location }) + (u.parent ? ' · ' + t('sur {c}', { c: u.parent }) : '')}</small></p>
        {u.note ? <p className="muted small">{u.note}</p> : null}
        {!u.items.length ? <Empty text={t('Cette unité est vide.')} /> : null}
        {u.items.map((x) => (
          <div className="line" key={x.itemId}><span><b>{x.name}</b></span><span className="row"><b>{qty(x.quantity) + ' ' + x.unit}</b><button className="link" type="button" onClick={() => oapi('DELETE', WMS + '/units/' + id + '/items/' + x.itemId).then(both).catch(fail)}>{t('Retirer')}</button></span></div>
        ))}
        {u.kids.length ? <p className="small">{t('Contient : {l}', { l: u.kids.map((k) => k.code).join(', ') })}</p> : null}
        {u.value !== undefined ? <p className="muted small">{t('Valeur : {v}', { v: money(u.value) })}</p> : null}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn small" type="button" onClick={add}>{t('Ajouter un article')}</button>
          <button className="btn small" type="button" onClick={() => move(u)}>{t('Déplacer')}</button>
          <button className="btn small" type="button" onClick={() => confirm(t('Défaire cette unité ? Le stock reste à l\'emplacement.'), () => { oapi('DELETE', WMS + '/units/' + id).then(() => { close(); reload(); }).catch(fail); })}>{t('Défaire')}</button>
        </div>
      </div>
    )}
    </Loaded>
  );
}

export default function Units() {
  const t = useT();
  const { oapi, modal, toast, money } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/units'), []);
  const locs = useLocations();
  const create = () => modal(t('Nouvelle unité'), (close) => (
    <Form submitText={t('Créer')} fields={[
      { k: 'kind', label: t('Type'), type: 'select', options: [['pallet', t('Palette')], ['carton', t('Carton')], ['box', t('Caisse')]] },
      { k: 'locationId', label: t('Emplacement'), type: 'select', options: locOptions(locs.locations, t('Choisir…')), required: true },
      { k: 'note', label: t('Note (facultatif)') }]}
    onSubmit={(v) => oapi('POST', WMS + '/units', { kind: v.kind, locationId: Number(v.locationId), note: v.note }).then(() => { close(); toast(t('Unité créée.')); st.reload(); })} />
  ));
  return (
    <>
      <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={create}>{t('Nouvelle palette ou carton')}</button></div>
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.units.length ? <Empty text={t('Aucune palette ni carton.')} /> : null}
          {j.units.map((u) => (
            <div className="line" key={u.id}>
              <span><b>{u.code}</b> <Tag tone="mid">{t(u.kindLabel)}</Tag><small>{' ' + u.location + (u.parent ? ' · ' + t('sur {c}', { c: u.parent }) : '') + ' · ' + t('{n} article(s), {q} en tout', { n: u.lines, q: qty(u.quantity) }) + (u.value !== undefined ? ' · ' + money(u.value) : '')}</small></span>
              <button className="link" type="button" onClick={() => modal(t('Unité {code}', { code: u.code }), (close) => <UnitDetail id={u.id} reload={st.reload} close={close} />)}>{t('Ouvrir')}</button>
            </div>
          ))}
        </div>
      )}
      </Loaded>
    </>
  );
}
