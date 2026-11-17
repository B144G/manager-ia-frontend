import { useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { FormFoot, Kpis, Seg, Tag, WMS, itemOptions, locOptions, qty, useDate, useItems, useLocations, useRows } from './kit.jsx';
import Scanner from './Scanner.jsx';

/* Palettes et colis (unités de manutention) : une étiquette scannable, un emplacement, un contenu (article, lot, péremption).
   On reçoit sur une palette, on la déplace en un scan, on y ajoute ou en retire, on pose un colis dessus, on la défait.
   Toutes les règles (stock en vrac suffisant, emplacements autorisés, droits) sont contrôlées par le serveur. */
const TYPES = [['pallet', 'Palette'], ['box', 'Colis'], ['container', 'Conteneur'], ['tote', 'Bac']];
const TONE = { pallet: 'good', box: 'mid', container: 'mid', tote: 'mid' };

/** Ouvre l'étiquette PDF (cookie de connexion) dans un nouvel onglet, sinon la télécharge. */
function useLabel() {
  const t = useT();
  const { orgId, fail } = useWs();
  return (hu) => fetch(API_BASE + '/api/ws/orgs/' + orgId + WMS + '/hus/' + hu.id + '/label', { credentials: 'include' })
    .then((r) => { if (!r.ok) throw new Error(t('Étiquette indisponible.')); return r.blob(); })
    .then((b) => {
      const url = URL.createObjectURL(b);
      const w = window.open(url, '_blank', 'noopener');
      if (!w) { const a = document.createElement('a'); a.href = url; a.download = hu.code + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }).catch(fail);
}

/** Déplacer une unité : choisir l'emplacement, ou le scanner. */
function MoveForm({ hu, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const locs = useLocations();
  const [to, setTo] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const send = (body) => { setBusy(true); setErr(''); return oapi('POST', WMS + '/hus/' + hu.id + '/move', body).then(() => { close(); done(); }).catch((e) => setErr(tsrv(e.message))).finally(() => setBusy(false)); };
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); if (!to) { setErr(t('Choisissez un emplacement.')); return; } send({ toLocationId: Number(to) }); }}>
      <Scanner label={t("Scanner l'emplacement d'arrivée")} onCode={(code) => send({ toLocationCode: code })} autoFocus />
      <label className="fld"><span>{t('Ou choisir dans la liste')}</span>
        <select style={{ fontSize: 16 }} value={to} onChange={(e) => setTo(e.target.value)}>{locOptions(locs.locations.filter((l) => l.id !== hu.locationId), t('Choisir…')).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
      <FormFoot busy={busy} err={err} text={t('Déplacer')} />
    </form>
  );
}

/** Fiche d'une unité : contenu, colis posés dessus, historique et actions. */
export function HuDetail({ id, reload, close }) {
  const t = useT();
  const { oapi, can, money, fail, confirm, modal, toast } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/hus/' + id), []);
  const items = useItems();
  const date = useDate();
  const label = useLabel();
  const mgr = can('manager');
  const after = (msg) => () => { if (msg) toast(msg); st.reload(); if (reload) reload(); };
  const move = (h) => modal(t('Déplacer {code}', { code: h.code }), (c2) => <MoveForm hu={h} close={c2} done={after(t('Déplacé.'))} />);
  const add = (h) => modal(t('Ajouter sur {code}', { code: h.code }), (c2) => (
    <Form submitText={t('Ajouter')} fields={[
      { k: 'itemId', label: t('Article (pris dans le stock en vrac de l\'emplacement)'), type: 'select', options: itemOptions(items.items, t('Choisir…')), required: true },
      { k: 'quantity', label: t('Quantité'), required: true },
      { k: 'lotNo', label: t('N° de lot (facultatif)') },
      { k: 'expiry', label: t('Péremption (AAAA-MM-JJ, facultatif)') }]}
    onSubmit={(v) => oapi('POST', WMS + '/hus/' + h.id + '/add', { itemId: Number(v.itemId), quantity: v.quantity, lotNo: v.lotNo, expiry: v.expiry }).then(() => { c2(); after(t('Ajouté.'))(); })} />
  ));
  const remove = (h, c) => modal(t('Retirer de {code}', { code: h.code }), (c2) => (
    <Form submitText={t('Retirer')} fields={[{ k: 'quantity', label: t('Quantité de « {name} » à retirer (elle reste dans l\'emplacement, en vrac)', { name: c.name }), value: String(c.quantity), required: true }]}
    onSubmit={(v) => oapi('POST', WMS + '/hus/' + h.id + '/remove', { itemId: c.itemId, lotNo: c.lotNo || '', quantity: v.quantity }).then(() => { c2(); after(t('Retiré.'))(); })} />
  ));
  const nest = (h) => modal(t('Poser {code} sur une palette', { code: h.code }), (c2) => (
    <div className="ws-form">
      <Scanner label={t("Scanner l'étiquette de la palette d'accueil")} onCode={(code) => oapi('POST', WMS + '/hus/' + h.id + '/nest', { parentCode: code }).then(() => { c2(); after(t('Posé sur la palette.'))(); }).catch(fail)} autoFocus />
    </div>
  ));
  const act = (path, msg) => oapi('POST', WMS + '/hus/' + id + path, {}).then(after(msg)).catch(fail);
  const unpack = (h) => confirm(t('Défaire {code} ? Son contenu reste dans l\'emplacement, en vrac.', { code: h.code }), () => act('/unpack', t('Défait.')), t('Défaire'));
  const del = (h) => confirm(t('Supprimer {code} ?', { code: h.code }), () => oapi('DELETE', WMS + '/hus/' + h.id).then(() => { if (close) close(); if (reload) reload(); }).catch(fail), t('Supprimer'));
  return (
    <Loaded state={st}>{({ hu: h }) => (
      <div className="wms-hu">
        <div className="wms-where"><span className="wms-loc">{h.code}</span><Tag tone={TONE[h.type]}>{t(h.typeLabel)}</Tag>{h.status === 'empty' ? <Tag tone="bad">{t('Vide')}</Tag> : null}</div>
        <p className="muted small">{h.location ? t('Emplacement {code}', { code: h.location }) + (h.warehouse ? ' · ' + h.warehouse : '') : t('Sans emplacement')}{h.parentCode ? ' · ' + t('posé sur {code}', { code: h.parentCode }) : ''}{h.note ? ' · ' + h.note : ''}</p>
        <div className="row wms-toolbar" style={{ flexWrap: 'wrap' }}>
          {!h.parentId ? <button className="btn small primary" type="button" onClick={() => move(h)}>{t('Déplacer')}</button> : <button className="btn small" type="button" onClick={() => act('/unnest', t('Retiré de la palette.'))}>{t('Retirer de la palette')}</button>}
          <button className="btn small" type="button" onClick={() => label(h)}>{t("Imprimer l'étiquette")}</button>
          <button className="btn small" type="button" onClick={() => add(h)}>{t('Ajouter des articles')}</button>
          {h.type !== 'pallet' && h.type !== 'container' && !h.parentId ? <button className="btn small" type="button" onClick={() => nest(h)}>{t('Poser sur une palette')}</button> : null}
          {h.status !== 'empty' ? <button className="btn small" type="button" onClick={() => unpack(h)}>{t('Défaire')}</button> : null}
          {mgr && h.status === 'empty' ? <button className="btn small" type="button" onClick={() => del(h)}>{t('Supprimer')}</button> : null}
        </div>
        <h3>{t('Contenu')}</h3>
        {!h.contents.length ? <Empty text={t('Rien sur cette unité.')} /> : null}
        {h.contents.map((c) => (
          <div className="line" key={c.itemId + '|' + (c.lotNo || '')}>
            <span><b>{c.name}</b>{c.lotNo ? <small>{' · ' + t('lot {n}', { n: c.lotNo })}</small> : null}{c.expiry ? <small>{' · ' + t('pér. {d}', { d: date(c.expiry) })}</small> : null}</span>
            <span className="row"><b>{qty(c.quantity) + ' ' + c.unit}</b>{c.value !== undefined ? <small>{money(c.value)}</small> : null}<button className="link" type="button" onClick={() => remove(h, c)}>{t('Retirer')}</button></span>
          </div>
        ))}
        {h.children.length ? <><h3>{t('Posés dessus')}</h3>{h.children.map((k) => <div className="line" key={k.id}><span><b>{k.code}</b> <Tag tone={TONE[k.type]}>{t(k.typeLabel)}</Tag></span>{k.status === 'empty' ? <small className="muted">{t('Vide')}</small> : null}</div>)}</> : null}
        {h.history.length ? <><h3>{t('Déplacements')}</h3>{h.history.map((x, i) => <div className="line" key={i}><span>{(x.from || '—') + ' → ' + (x.to || '—')}<small>{x.by ? ' · ' + x.by : ''}</small></span><small className="muted">{date(String(x.at).slice(0, 10))}</small></div>)}</> : null}
      </div>
    )}
    </Loaded>
  );
}

/** Réception directe sur une nouvelle palette (ou colis) : la marchandise entre en stock et se range sur l'unité. */
function ReceiveForm({ close, done }) {
  const t = useT();
  const { oapi, can, fail } = useWs();
  const items = useItems(); const locs = useLocations();
  const [rows, setRows] = useRows([{ itemId: '', quantity: '' }]);
  const [v, setV] = useState({ type: 'pallet', locationId: '', reference: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const setRow = (i, k, x) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: x } : r)));
  const submit = (e) => {
    e.preventDefault(); setErr('');
    const lines = rows.filter((r) => r.itemId && String(r.quantity).trim()).map((r) => ({ itemId: Number(r.itemId), quantity: r.quantity, lotNo: r.lotNo || undefined, expiry: r.expiry || undefined, serials: r.serials || undefined, unitCost: r.unitCost || undefined }));
    if (!lines.length) { setErr(t('Ajoutez au moins une ligne.')); return; }
    setBusy(true);
    oapi('POST', WMS + '/hus/receive', { type: v.type, locationId: v.locationId ? Number(v.locationId) : undefined, reference: v.reference, lines })
      .then((j) => { close(); done(j); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(tsrv(x.message)); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <label className="fld"><span>{t('Type')}</span><select style={{ fontSize: 16 }} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>{TYPES.map((x) => <option key={x[0]} value={x[0]}>{t(x[1])}</option>)}</select></label>
      <label className="fld"><span>{t('Emplacement')}</span><select style={{ fontSize: 16 }} value={v.locationId} onChange={(e) => setV({ ...v, locationId: e.target.value })}>{locOptions(locs.locations, t('Emplacement principal'), true).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
      <label className="fld"><span>{t('Référence (bon de livraison, facultatif)')}</span><input type="text" style={{ fontSize: 16 }} value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} /></label>
      {rows.map((r, i) => {
        const it = items.items.find((x) => String(x.id) === String(r.itemId));
        return (
          <div className="wms-lrow" key={i}>
            <label className="fld wms-l-item"><span>{t('Article')}</span><select style={{ fontSize: 16 }} value={r.itemId} onChange={(e) => setRow(i, 'itemId', e.target.value)}>{itemOptions(items.items, t('Choisir…')).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
            <label className="fld wms-l-qty"><span>{t('Quantité')}</span><input type="text" inputMode="decimal" style={{ fontSize: 16 }} value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} /></label>
            {it && it.tracking === 'lot' ? <><label className="fld wms-l-qty"><span>{t('N° de lot')}</span><input type="text" style={{ fontSize: 16 }} value={r.lotNo || ''} onChange={(e) => setRow(i, 'lotNo', e.target.value)} /></label>
              <label className="fld wms-l-qty"><span>{t('Péremption')}</span><input type="date" style={{ fontSize: 16 }} value={r.expiry || ''} onChange={(e) => setRow(i, 'expiry', e.target.value)} /></label></> : null}
            {it && it.tracking === 'serial' ? <label className="fld wms-l-item"><span>{t('Numéros de série')}</span><input type="text" style={{ fontSize: 16 }} value={r.serials || ''} onChange={(e) => setRow(i, 'serials', e.target.value)} /></label> : null}
            {can('manager') ? <label className="fld wms-l-qty"><span>{t('Coût unitaire (facultatif)')}</span><input type="text" inputMode="numeric" style={{ fontSize: 16 }} value={r.unitCost || ''} onChange={(e) => setRow(i, 'unitCost', e.target.value)} /></label> : null}
            {rows.length > 1 ? <button className="link" type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}>{t('Retirer')}</button> : null}
          </div>
        );
      })}
      <button className="btn small" type="button" onClick={() => setRows(rows.concat([{ itemId: '', quantity: '' }]))}>{t('Ajouter une ligne')}</button>
      <FormFoot busy={busy} err={err} text={t('Recevoir sur cette unité')} />
    </form>
  );
}

/** Nouvelle unité vide (ou avec du stock en vrac déjà présent dans l'emplacement). */
function NewForm({ close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const locs = useLocations();
  return (
    <Form submitText={t('Créer')} fields={[
      { k: 'type', label: t('Type'), type: 'select', options: TYPES.map((x) => [x[0], t(x[1])]) },
      { k: 'locationId', label: t('Emplacement'), type: 'select', options: locOptions(locs.locations, t('Choisir…')), required: true },
      { k: 'note', label: t('Note (facultatif)') }]}
    onSubmit={(v) => oapi('POST', WMS + '/hus', { type: v.type, locationId: Number(v.locationId), note: v.note, lines: [] }).then((j) => { close(); done(j); })} />
  );
}

/** Liste des palettes et colis. */
export default function HandlingUnits() {
  const t = useT();
  const { oapi, modal, toast } = useWs();
  const [filter, setFilter] = useState('open');
  const st = useLoad(() => oapi('GET', WMS + '/hus?status=' + filter), [filter]);
  const open = (h) => modal(t('{type} {code}', { type: t(h.typeLabel), code: h.code }), (close) => <HuDetail id={h.id} reload={st.reload} close={close} />, { wide: true });
  const created = (j) => { toast(t('{code} créé.', { code: j.code })); st.reload(); open({ id: j.id, code: j.code, typeLabel: '' }); };
  const scan = (code) => oapi('GET', WMS + '/hus/lookup?code=' + encodeURIComponent(code)).then((j) => open({ id: j.hu.id, code: j.hu.code, typeLabel: '' })).catch((e) => toast(tsrv(e.message), true));
  return (
    <div>
      <div className="ws-head">
        <div><h1>{t('Palettes et colis')}</h1><p className="muted">{t('Chaque palette ou colis a une étiquette : on la reçoit, la range et la déplace en un scan, avec son contenu (lots et péremptions compris).')}</p></div>
        <div className="row">
          <button className="btn small primary" type="button" onClick={() => modal(t('Recevoir sur une palette'), (c) => <ReceiveForm close={c} done={created} />, { wide: true })}>{t('Recevoir sur une palette')}</button>
          <button className="btn small" type="button" onClick={() => modal(t('Nouvelle palette ou colis'), (c) => <NewForm close={c} done={created} />)}>{t('Nouvelle unité vide')}</button>
        </div>
      </div>
      <div className="ws-card"><Scanner label={t('Scanner une étiquette de palette ou de colis')} onCode={scan} /></div>
      <Seg tabs={[['open', t('En cours')], ['empty', t('Vides')], ['all', t('Toutes')]]} value={filter} onChange={setFilter} />
      <Loaded state={st}>{(j) => (
        <>
          <Kpis list={[{ label: t('Palettes'), value: String(j.hus.filter((h) => h.type === 'pallet').length) }, { label: t('Colis et bacs'), value: String(j.hus.filter((h) => h.type !== 'pallet').length) }, { label: t('Articles posés'), value: qty(j.hus.reduce((s, h) => s + h.quantity, 0)) }]} />
          {!j.hus.length ? <Empty text={t('Aucune palette ni colis ici. Recevez une livraison sur une palette pour commencer.')} /> : null}
          {j.hus.map((h) => (
            <button key={h.id} type="button" className="line wms-hu-row" onClick={() => open(h)}>
              <span><b>{h.code}</b> <Tag tone={TONE[h.type]}>{t(h.typeLabel)}</Tag><small>{' ' + (h.location || '—') + (h.parentCode ? ' · ' + t('sur {code}', { code: h.parentCode }) : '')}</small></span>
              <span><small>{t('{n} article(s)', { n: h.items })}</small> <b>{qty(h.quantity)}</b></span>
            </button>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}

/** Mode « Palette » du scanner : scanner la palette, puis l'emplacement où on la pose. */
export function HuScan() {
  const t = useT();
  const { oapi, toast } = useWs();
  const [hu, setHu] = useState(null);
  const [err, setErr] = useState('');
  const find = (code) => { setErr(''); return oapi('GET', WMS + '/hus/lookup?code=' + encodeURIComponent(code)).then((j) => oapi('GET', WMS + '/hus/' + j.hu.id)).then((j) => setHu(j.hu)).catch((e) => setErr(tsrv(e.message))); };
  const place = (code) => { setErr(''); return oapi('POST', WMS + '/hus/' + hu.id + '/move', { toLocationCode: code }).then((j) => { toast(t('{code} posé en {loc}.', { code: hu.code, loc: j.to })); setHu(null); }).catch((e) => setErr(tsrv(e.message))); };
  return (
    <div className="ws-card wms-run">
      {!hu ? <Scanner label={t("Scanner l'étiquette de la palette")} onCode={find} autoFocus /> : (
        <div>
          <div className="wms-where"><span className="wms-loc">{hu.code}</span><Tag tone={TONE[hu.type]}>{t(hu.typeLabel)}</Tag></div>
          <p className="muted small">{t('Actuellement en {code}', { code: hu.location || '—' })} · {t('{n} article(s)', { n: hu.items })}</p>
          {hu.contents.slice(0, 5).map((c) => <div className="line" key={c.itemId + '|' + (c.lotNo || '')}><span>{c.name}{c.lotNo ? <small>{' · ' + c.lotNo}</small> : null}</span><b>{qty(c.quantity) + ' ' + c.unit}</b></div>)}
          {hu.parentId ? <p className="ws-err">{t('Ce colis est posé sur une palette : scannez plutôt la palette.')}</p> : <Scanner label={t("Scanner l'emplacement où vous la posez")} onCode={place} autoFocus />}
          <button className="btn small" type="button" onClick={() => setHu(null)}>{t('Autre palette')}</button>
        </div>
      )}
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
    </div>
  );
}
