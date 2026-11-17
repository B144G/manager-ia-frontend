import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Tag, WMS, qty, useDate } from './kit.jsx';
import Scanner from './Scanner.jsx';
import { Fa } from '../../../lib/fa.jsx';
import { PickRunner } from './Picking.jsx';
import { HuScan } from './HandlingUnits.jsx';
import { Queue as CrossDockQueue } from './CrossDock.jsx';
import { Tasks as VasTasks } from './Vas.jsx';
import { tsrv } from '../../../lib/srv.js';

/* Écran du téléphone : chercher, réceptionner, préparer, compter, en scannant (caméra du téléphone si le navigateur sait lire les codes, sinon saisie ou lecteur). */
function Lookup() {
  const t = useT();
  const { oapi, fail, money } = useWs();
  const [res, setRes] = useState(null);
  const go = (code) => oapi('GET', WMS + '/scan?code=' + encodeURIComponent(code)).then(async (r) => {
    if (r.type === 'item') {
      const [it, av, lv] = await Promise.all([oapi('GET', '/stock/lookup?code=' + encodeURIComponent(code)), oapi('GET', WMS + '/items/' + r.id + '/availability'), oapi('GET', WMS + '/items/' + r.id + '/levels')]);
      setRes({ type: 'item', item: it.item, av, lv });
    } else if (r.type === 'location') { const l = await oapi('GET', WMS + '/locations/' + r.id); setRes({ type: 'location', ...l }); } else setRes({ type: r.type, label: r.label });
  }).catch((e) => { setRes(null); fail(e); });
  return (
    <div className="ws-card">
      <Scanner label={t('Article, emplacement ou document')} onCode={go} autoFocus />
      {res && res.type === 'item' ? (
        <div>
          <h2>{res.item.name}</h2>
          <Kpis list={[{ label: t('en stock'), value: qty(res.av.quantity) + ' ' + res.item.unit }, { label: t('disponible à promettre'), value: qty(res.av.available) }, { label: t('réservé'), value: qty(res.av.reserved) }]} />
          {res.lv.levels.map((l) => <div className="line" key={l.locationId}><span><b>{l.code}</b> <small>{l.warehouse}</small></span><b>{qty(l.quantity)}</b></div>)}
          {res.item.avgCost ? <p className="muted small">{t('coût moyen {p}', { p: money(res.item.avgCost) })}</p> : null}
        </div>
      ) : null}
      {res && res.type === 'location' ? (
        <div>
          <h2>{res.location.code}</h2><p className="muted small">{res.location.warehouse + (res.location.zone ? ' · ' + res.location.zone : '')}</p>
          {!res.content.length ? <Empty text={t('Cet emplacement est vide.')} /> : null}
          {res.content.map((c) => <div className="line" key={c.itemId}><b>{c.name}</b><b>{qty(c.quantity) + ' ' + c.unit}</b></div>)}
        </div>
      ) : null}
      {res && !['item', 'location'].includes(res.type) ? <p><Tag tone="mid">{t({ pick: 'Liste de préparation', transfer: 'Transfert', return: 'Retour', receipt: 'Réception', hu: 'Palette ou colis', wave: 'Vague de préparation', package: 'Colis', unit: 'Palette ou carton' }[res.type] || res.type)}</Tag> <b>{res.label}</b></p> : null}
    </div>
  );
}

function Receive() {
  const t = useT();
  const { oapi, fail, toast } = useWs();
  const [item, setItem] = useState(null);
  const [v, setV] = useState({ quantity: '', lotNo: '', expiry: '', loc: '', serials: '' });
  const [err, setErr] = useState('');
  const [last, setLast] = useState('');
  const [awaited, setAwaited] = useState(null);
  const j0 = (x) => (item && item.tracking === 'serial' ? String(x.serials || '').split(/[\n,;]+/).filter((y) => y.trim()).length : x.quantity);
  const find = (code) => oapi('GET', '/stock/lookup?code=' + encodeURIComponent(code)).then((j) => { setItem(j.item); setErr(''); }).catch((e) => { setItem(null); fail(e); });
  const place = (code) => oapi('GET', WMS + '/locations/lookup?code=' + encodeURIComponent(code)).then((j) => setV((x) => ({ ...x, loc: String(j.location.id), locCode: j.location.code }))).catch(fail);
  const save = () => {
    setErr('');
    const body = { kind: 'in', quantity: v.quantity, lotNo: v.lotNo || undefined, expiry: v.expiry || undefined, serials: v.serials || undefined, locationId: v.loc ? Number(v.loc) : undefined, reason: t('Réception au scanner') };
    const got = { item, quantity: j0(v), locationId: v.loc ? Number(v.loc) : undefined };
    oapi('POST', '/stock/items/' + item.id + '/move', body).then((j) => {
      setLast(t('{name} : +{n}, stock {s}', { name: item.name, n: v.quantity || v.serials, s: qty(j.quantity) })); toast(t('Réception enregistrée.')); setItem(null); setV({ quantity: '', lotNo: '', expiry: '', loc: '', serials: '' });
      // Une commande attend-elle cet article ? On propose de le transborder au lieu de le ranger.
      oapi('GET', WMS + '/crossdock/check?itemId=' + got.item.id + '&quantity=' + encodeURIComponent(got.quantity)).then((c) => setAwaited(c.awaited > 0 ? { ...got, awaited: c.awaited } : null)).catch(() => setAwaited(null));
    }).catch((e) => { if (e && e.status === 401) fail(e); setErr(e.message); });
  };
  const xdock = () => oapi('POST', WMS + '/crossdock/from-stock', { itemId: awaited.item.id, quantity: Math.min(Number(String(awaited.quantity).replace(',', '.')) || 0, awaited.awaited), locationId: awaited.locationId })
    .then((j) => { setAwaited(null); toast(j.crossDock.length ? t('{n} transbordement(s) prêt(s) : mode « Transborder ».', { n: j.crossDock.length }) : t('Aucune commande ne peut recevoir cette marchandise (réglage ou stock déjà réservé).')); }).catch((e) => setErr(tsrv(e.message)));
  return (
    <div className="ws-card">
      {last ? <p className="ok">{last}</p> : null}
      {awaited ? <div className="wms-xd-hint" role="status"><p><b>{t('Une commande attend {q} {u} de « {name} ».', { q: qty(awaited.awaited), u: awaited.item.unit, name: awaited.item.name })}</b></p><div className="row"><button className="btn primary" type="button" onClick={xdock}>{t('Transborder au lieu de ranger')}</button><button className="btn" type="button" onClick={() => setAwaited(null)}>{t('Ranger normalement')}</button></div></div> : null}
      {!item ? <Scanner label={t("Scanner l'article reçu")} onCode={find} autoFocus /> : (
        <div className="ws-form">
          <h2>{item.name}</h2>
          {item.tracking === 'serial'
            ? <label className="fld"><span>{t('Numéros de série (un par ligne)')}</span><textarea rows={3} style={{ fontSize: 16 }} value={v.serials} onChange={(e) => setV({ ...v, serials: e.target.value })} /></label>
            : <label className="fld"><span>{t('Quantité reçue ({unit})', { unit: item.unit })}</span><input type="text" inputMode="decimal" style={{ fontSize: 16 }} autoFocus value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} /></label>}
          {item.tracking === 'lot' ? <><label className="fld"><span>{t('Numéro de lot')}</span><input type="text" style={{ fontSize: 16 }} value={v.lotNo} onChange={(e) => setV({ ...v, lotNo: e.target.value })} /></label><label className="fld"><span>{t('Péremption (facultatif)')}</span><input type="date" style={{ fontSize: 16 }} value={v.expiry} onChange={(e) => setV({ ...v, expiry: e.target.value })} /></label></> : null}
          <Scanner label={t("Scanner l'emplacement (facultatif)")} onCode={place} />
          {v.locCode ? <p className="small ok">{t('Emplacement : {c}', { c: v.locCode })}</p> : <p className="muted small">{t('Sans emplacement, les règles de rangement décident.')}</p>}
          {err ? <p className="ws-err" role="alert">{err}</p> : null}
          <div className="row"><button className="btn primary" type="button" onClick={save}>{t('Enregistrer la réception')}</button><button className="btn" type="button" onClick={() => setItem(null)}>{t('Changer d\'article')}</button></div>
        </div>
      )}
    </div>
  );
}

function Prepare() {
  const t = useT();
  const date = useDate();
  const { oapi } = useWs();
  const [id, setId] = useState(null);
  const st = useLoad(() => oapi('GET', WMS + '/picks?mine=0'), []);
  if (id) return <PickRunner id={id} back={() => { setId(null); st.reload(); }} />;
  const open = (p) => p.status === 'open' || p.status === 'in_progress';
  const scanPick = (code) => oapi('GET', WMS + '/scan?code=' + encodeURIComponent(code)).then((r) => { if (r.type === 'pick') setId(r.id); });
  return (
    <div className="ws-card">
      <Scanner label={t('Scanner la liste de préparation')} onCode={scanPick} />
      <Loaded state={st}>{(j) => (
        <>
          <h2>{t('Listes à préparer')}</h2>
          {!j.picks.filter(open).length ? <Empty text={t('Aucune liste à préparer.')} /> : null}
          {j.picks.filter(open).map((p) => <div className="line" key={p.id}><span><b>{p.code}</b>{p.priority === 1 ? <Tag tone="bad">{t('Urgente')}</Tag> : null}<small>{' ' + [p.documentNumber, p.customer, p.label].filter(Boolean).join(' · ') + ' · ' + date(p.createdAt.slice(0, 10))}</small></span><button className="btn small primary" type="button" onClick={() => setId(p.id)}>{t('Préparer')}</button></div>)}
        </>
      )}
      </Loaded>
    </div>
  );
}

function Count() {
  const t = useT();
  const { oapi, fail, toast } = useWs();
  const st = useLoad(() => oapi('GET', '/stock/counts'), []);
  const [cid, setCid] = useState(null);
  return (
    <div className="ws-card">
      <Loaded state={st}>{(j) => {
        const open = j.counts.filter((c) => c.status === 'open');
        if (!open.length) return <Empty text={t("Aucun inventaire ouvert. Un responsable en ouvre un dans « Inventaire » ou « Inventaires tournants ».")} />;
        const cur = cid || open[0].id;
        return <CountSheet id={cur} list={open} setId={setCid} fail={fail} toast={toast} done={st.reload} />;
      }}
      </Loaded>
    </div>
  );
}
function CountSheet({ id, list, setId, fail, toast, done }) {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/stock/counts/' + id), [id]);
  const [cur, setCur] = useState(null);
  const [val, setVal] = useState('');
  const [saved, setSaved] = useState({});
  const find = (c, code) => {
    const it = c.items.find((x) => x.name && (x.barcode === code || x.sku === code));
    if (it) { setCur(it); setVal(''); return; }
    oapi('GET', '/stock/lookup?code=' + encodeURIComponent(code)).then((j) => { const x = c.items.find((y) => y.itemId === j.item.id); if (x) { setCur(x); setVal(''); } else fail(new Error(t("Cet article n'est pas dans cet inventaire."))); }).catch(fail);
  };
  const put = (c) => {
    if (!cur || String(val).trim() === '') return;
    oapi('PUT', '/stock/counts/' + id + '/lines', { lines: [{ itemId: cur.itemId, counted: val }] }).then(() => { setSaved((s) => ({ ...s, [cur.itemId]: val })); setCur(null); setVal(''); st.reload(); }).catch(fail);
  };
  const submit = () => oapi('POST', '/stock/counts/' + id + '/submit').then(() => { toast(t('Comptage soumis à validation.')); done(); }).catch(fail);
  return (
    <Loaded state={st}>{({ count: c }) => (
      <div>
        {list.length > 1 ? <label className="fld"><span>{t('Inventaire')}</span><select style={{ fontSize: 16 }} value={id} onChange={(e) => setId(Number(e.target.value))}>{list.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}</select></label> : <h2>{c.code}</h2>}
        <Kpis list={[{ label: t('comptés'), value: c.counted + ' / ' + c.lines }]} />
        {!cur ? <Scanner label={t("Scanner l'article à compter")} onCode={(code) => find(c, code)} autoFocus /> : (
          <div className="ws-form">
            <h2>{cur.name}</h2>
            <label className="fld"><span>{t('Quantité comptée ({unit})', { unit: cur.unit })}</span><input type="text" inputMode="decimal" style={{ fontSize: 16 }} autoFocus value={val} onChange={(e) => setVal(e.target.value)} /></label>
            <div className="row"><button className="btn primary" type="button" onClick={() => put(c)}>{t('Enregistrer')}</button><button className="btn" type="button" onClick={() => setCur(null)}>{t('Autre article')}</button></div>
          </div>
        )}
        {c.items.filter((x) => x.counted !== null).slice(0, 30).map((x) => <div className="line" key={x.itemId}><span><b>{x.name}</b></span><b>{qty(x.counted) + ' ' + x.unit}</b></div>)}
        <button className="btn primary" type="button" style={{ marginTop: 10 }} disabled={!c.counted && !Object.keys(saved).length} onClick={submit}>{t('Soumettre le comptage')}</button>
        <p className="muted small">{t("Une autre personne valide l'inventaire : le stock n'est ajusté qu'à ce moment-là.")}</p>
      </div>
    )}
    </Loaded>
  );
}

export default function Scan() {
  const t = useT();
  const [mode, setMode] = useState('lookup');
  const MODES = [['lookup', t('Chercher'), 'search'], ['receive', t('Réceptionner'), 'box-open'], ['prepare', t('Préparer'), 'list-check'], ['count', t('Compter'), 'clipboard-check'], ['pallet', t('Palette'), 'stock'], ['xdock', t('Transborder'), 'shuffle'], ['vas', t('Services'), 'tags']];
  return (
    <div className="wms-scan">
      <div className="wms-modes" role="tablist">{MODES.map((m) => <button key={m[0]} type="button" role="tab" aria-selected={mode === m[0]} className={'wms-mode' + (mode === m[0] ? ' on' : '')} onClick={() => setMode(m[0])}><Fa name={m[2]} fixedWidth />{m[1]}</button>)}</div>
      {mode === 'lookup' ? <Lookup /> : null}
      {mode === 'receive' ? <Receive /> : null}
      {mode === 'prepare' ? <Prepare /> : null}
      {mode === 'count' ? <Count /> : null}
      {mode === 'pallet' ? <HuScan /> : null}
      {mode === 'xdock' ? <CrossDockQueue status="todo" compact /> : null}
      {mode === 'vas' ? <VasTasks mine /> : null}
    </div>
  );
}

