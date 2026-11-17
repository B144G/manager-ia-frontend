import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { FormFoot, Kpis, LinesEditor, Seg, Tag, WMS, cleanRows, qty, useDate, useItems, useRows } from './kit.jsx';
import Scanner from './Scanner.jsx';
import { VasPanel } from './Vas.jsx';

/* Listes de préparation : créées depuis une commande (ou à la main), parcours allée → rayon → bac, scan de l'article et de l'emplacement, puis expédition par un responsable. */
const ST = { open: ['À préparer', 'mid'], in_progress: ['En préparation', 'mid'], picked: ['Préparée', 'good'], issued: ['Expédiée', 'good'], cancelled: ['Annulée', 'bad'] };

/** Exécution d'une liste (écran du préparateur, prévu pour le téléphone). */
export function PickRunner({ id, back }) {
  const t = useT();
  const { oapi, can, fail, toast, modal } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/picks/' + id), []);
  const mgr = can('manager');
  const [scan, setScan] = useState({});
  const [err, setErr] = useState('');
  const confirmLine = (p, l, extra = {}) => {
    setErr('');
    const s = scan[l.id] || {};
    oapi('POST', WMS + '/picks/' + id + '/lines/' + l.id + '/confirm', { quantity: extra.quantity, itemCode: s.item || undefined, locationCode: extra.body && extra.body.fromLocationId ? undefined : s.loc || undefined, ...extra.body })
      .then(() => { setScan((x) => ({ ...x, [l.id]: {} })); st.reload(); }).catch((e) => { if (e && e.status === 401) fail(e); setErr(e.message); });
  };
  const partial = (p, l) => modal(t('Quantité réellement prélevée'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'q', label: t('Quantité ({unit})', { unit: l.unit }), value: String(l.quantity - l.pickedQty), required: true, hint: t('Moins que prévu si le bac est vide : le manque sera signalé.') }]}
    onSubmit={(v) => oapi('POST', WMS + '/picks/' + id + '/lines/' + l.id + '/confirm', { quantity: v.q }).then(() => { close(); st.reload(); })} />
  ));
  const elsewhere = (l) => oapi('GET', WMS + '/items/' + l.itemId + '/levels').then((j) => {
    const others = j.levels.filter((x) => x.locationId !== l.locationId && x.kind !== 'transit' && x.kind !== 'quarantine' && x.kind !== 'returns' && x.kind !== 'scrap');
    modal(t('Où avez-vous pris ?'), (close) => (
      <div>
        {!others.length ? <Empty text={t("Aucun autre emplacement n'a de stock.")} /> : null}
        {others.map((x) => (
          <div className="line" key={x.locationId}>
            <span><b>{x.code}</b><small>{' ' + x.warehouse + ' · ' + qty(x.quantity) + ' ' + j.unit}</small></span>
            <button className="btn small primary" type="button" onClick={() => { close(); confirmLine(null, l, { body: { fromLocationId: x.locationId } }); }}>{t('Prendre ici')}</button>
          </div>
        ))}
      </div>
    ));
  }).catch(fail);
  const complete = (allowShort) => oapi('POST', WMS + '/picks/' + id + '/complete', { allowShort }).then(() => { toast(t('Liste préparée.')); st.reload(); }).catch((e) => {
    if (e.status === 409 && !allowShort) {
      modal(t('Lignes incomplètes'), (close) => (
        <div><p>{e.message}</p><button className="btn primary" type="button" onClick={() => { close(); complete(true); }}>{t('Terminer quand même')}</button></div>
      ));
    } else fail(e);
  });
  const issue = (p) => {
    const serial = p.lines.filter((l) => l.tracking === 'serial');
    const go = (serials) => oapi('POST', WMS + '/picks/' + id + '/issue', { serials }).then(() => { toast(t('Liste expédiée : le stock est sorti.')); st.reload(); }).catch(fail);
    if (!serial.length) { go(undefined); return; }
    modal(t('Numéros de série expédiés'), (close) => (
      <Form submitText={t('Expédier')} fields={Array.from(new Set(serial.map((l) => l.itemId))).map((iid) => ({ k: 'i' + iid, label: serial.find((l) => l.itemId === iid).name, type: 'textarea', rows: 3, required: true, hint: t('Un numéro par ligne.') }))}
      onSubmit={(v) => { const m = {}; Object.keys(v).forEach((k) => { m[k.slice(1)] = v[k]; }); return oapi('POST', WMS + '/picks/' + id + '/issue', { serials: m }).then(() => { close(); toast(t('Liste expédiée : le stock est sorti.')); st.reload(); }); }} />
    ));
  };
  return (
    <Loaded state={st}>{({ pick: p }) => {
      const open = p.status === 'open' || p.status === 'in_progress';
      const next = p.lines.find((l) => !l.done);
      return (
        <div className="wms-run">
          <div className="row" style={{ justifyContent: 'space-between' }}><h2>{p.code}</h2>{back ? <button className="btn small" type="button" onClick={back}>{t('Retour')}</button> : null}</div>
          <p><Tag tone={ST[p.status][1]}>{t(ST[p.status][0])}</Tag> <small className="muted">{[p.documentNumber, p.customer, p.label].filter(Boolean).join(' · ')}</small></p>
          <Kpis list={[{ label: t('à prélever'), value: qty(p.toPick) }, { label: t('prélevé'), value: qty(p.picked) }]} />
          {err ? <p className="ws-err" role="alert">{err}</p> : null}
          {p.lines.map((l) => {
            const s = scan[l.id] || {};
            const isNext = open && next && next.id === l.id;
            return (
              <div className={'wms-pickline' + (l.done ? ' done' : '') + (isNext ? ' next' : '')} key={l.id}>
                <div className="wms-where"><b className="wms-loc">{l.location}</b><small>{[l.aisle && t('allée {x}', { x: l.aisle }), l.rack && t('rayon {x}', { x: l.rack }), l.bin && t('bac {x}', { x: l.bin })].filter(Boolean).join(' · ')}</small></div>
                <div className="wms-what"><b>{l.name}</b><span>{qty(l.pickedQty) + ' / ' + qty(l.quantity) + ' ' + l.unit}</span></div>
                {open && !l.done ? (
                  <div className="wms-do">
                    {isNext ? (
                      <>
                        <Scanner label={t("Scanner l'emplacement")} onCode={(c) => setScan({ ...scan, [l.id]: { ...s, loc: c } })} />
                        {s.loc ? <p className="small ok">{t('Emplacement lu : {c}', { c: s.loc })}</p> : null}
                        <Scanner label={t("Scanner l'article")} onCode={(c) => setScan({ ...scan, [l.id]: { ...s, item: c } })} />
                        {s.item ? <p className="small ok">{t('Article lu : {c}', { c: s.item })}</p> : null}
                      </>
                    ) : null}
                    <div className="row">
                      <button className="btn primary" type="button" onClick={() => confirmLine(p, l)}>{t('Prélevé')}</button>
                      <button className="btn" type="button" onClick={() => partial(p, l)}>{t('Moins que prévu')}</button>
                      <button className="btn" type="button" onClick={() => elsewhere(l)}>{t('Prendre ailleurs')}</button>
                    </div>
                  </div>
                ) : <small className="ok">{l.done ? t('Fait') : ''}</small>}
              </div>
            );
          })}
          <VasPanel refKind="pick" refId={p.id} />
          <div className="row" style={{ marginTop: 12 }}>
            {open ? <button className="btn primary" type="button" onClick={() => complete(false)}>{t('Terminer la préparation')}</button> : null}
            {mgr && p.status === 'picked' ? <button className="btn primary" type="button" onClick={() => issue(p)}>{t('Expédier (sortir le stock)')}</button> : null}
          </div>
        </div>
      );
    }}
    </Loaded>
  );
}

function NewPick({ close, done }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const ords = useLoad(() => oapi('GET', '/sales/orders').catch(() => ({ orders: [] })), []);
  const docs = useLoad(() => oapi('GET', '/crm/documents').catch(() => ({ documents: [] })), []);
  const items = useItems();
  const mem = useLoad(() => oapi('GET', '/members').catch(() => ({ members: [] })), []);
  const [mode, setMode] = useState('doc');
  const [rows, setRows] = useRows();
  const [v, setV] = useState({ documentId: '', label: '', priority: '2', assignedTo: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const list = [];
  if (ords.data) ords.data.orders.filter((o) => o.status !== 'cancelled').forEach((o) => list.push([String(o.id), o.number + ' · ' + o.customer]));
  if (docs.data) docs.data.documents.filter((d) => d.kind !== 'credit' && !['cancelled', 'refused', 'paid', 'credited'].includes(d.status)).forEach((d) => list.push([String(d.id), d.number + ' · ' + (d.customer || '')]));
  const submit = (e) => {
    e.preventDefault(); setErr('');
    const body = { priority: Number(v.priority), assignedTo: v.assignedTo ? Number(v.assignedTo) : undefined };
    if (mode === 'doc') { if (!v.documentId) { setErr(t('Choisissez la commande.')); return; } body.documentId = Number(v.documentId); } else { const lines = cleanRows(rows); if (!lines.length) { setErr(t('Ajoutez au moins une ligne.')); return; } body.lines = lines; body.label = v.label; }
    setBusy(true);
    oapi('POST', WMS + '/picks', body).then(() => { close(); done(); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(x.message); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <Seg tabs={[['doc', t('Depuis une commande')], ['free', t('Liste libre')]]} value={mode} onChange={setMode} />
      {mode === 'doc'
        ? <label className="fld"><span>{t('Commande, devis ou facture')}</span><select value={v.documentId} onChange={(e) => setV({ ...v, documentId: e.target.value })}><option value="">{t('Choisir…')}</option>{list.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
        : <><LinesEditor items={items.items} rows={rows} setRows={setRows} /><label className="fld"><span>{t('Pour quoi ?')}</span><input type="text" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder={t('Atelier, chantier…')} /></label></>}
      <label className="fld"><span>{t('Priorité')}</span><select value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value })}><option value="1">{t('Urgente')}</option><option value="2">{t('Normale')}</option><option value="3">{t('Basse')}</option></select></label>
      <label className="fld"><span>{t('Confiée à (facultatif)')}</span><select value={v.assignedTo} onChange={(e) => setV({ ...v, assignedTo: e.target.value })}><option value="">{t('Personne en particulier')}</option>{(mem.data ? mem.data.members : []).map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select></label>
      <p className="muted small">{t('Créer la liste met le stock de côté : personne ne peut le prendre pendant la préparation.')}</p>
      <FormFoot busy={busy} err={err} text={t('Créer la liste')} />
    </form>
  );
}

export default function Picking() {
  const t = useT();
  const { oapi, can, modal, toast, fail, confirm } = useWs();
  const date = useDate();
  const mgr = can('manager');
  const [f, setF] = useState('');
  const [run, setRun] = useState(null);
  const st = useLoad(() => oapi('GET', WMS + '/picks' + (f ? '?status=' + f : '')), [f]);
  if (run) return <PickRunner id={run} back={() => { setRun(null); st.reload(); }} />;
  return (
    <>
      {mgr ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t('Nouvelle liste de préparation'), (close) => <NewPick close={close} done={() => { toast(t('Liste créée.')); st.reload(); }} />, { wide: true })}>{t('Nouvelle liste')}</button></div> : null}
      <Seg tabs={[['', t('Toutes')], ['open', t('À préparer')], ['in_progress', t('En préparation')], ['picked', t('Préparées')], ['issued', t('Expédiées')]]} value={f} onChange={setF} />
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.picks.length ? <Empty text={t('Aucune liste de préparation.')} /> : null}
          {j.picks.map((p) => (
            <div className="line" key={p.id}>
              <span><b>{p.code}</b> <Tag tone={ST[p.status][1]}>{t(ST[p.status][0])}</Tag>{p.priority === 1 ? <Tag tone="bad">{t('Urgente')}</Tag> : null}
                <small>{' ' + [p.documentNumber, p.customer, p.label].filter(Boolean).join(' · ') + ' · ' + t('{n} ligne(s)', { n: p.lineCount }) + ' · ' + date(p.createdAt.slice(0, 10)) + (p.assignedName ? ' · ' + p.assignedName : '')}</small>{p.short ? <Tag tone="bad">{t('manque')}</Tag> : null}{p.waveCode ? <Tag tone="mid">{t('vague {code}', { code: p.waveCode })}</Tag> : null}{p.packedAt && p.status === 'picked' ? <Tag tone="good">{t('emballée')}</Tag> : null}</span>
              <span className="row">
                <button className="btn small" type="button" onClick={() => setRun(p.id)}>{p.status === 'open' || p.status === 'in_progress' ? t('Préparer') : t('Ouvrir')}</button>
                {mgr && (p.status === 'open' || p.status === 'in_progress' || p.status === 'picked') ? <button className="link" type="button" onClick={() => confirm(t('Annuler cette liste ? Le stock mis de côté est libéré.'), () => { oapi('POST', WMS + '/picks/' + p.id + '/cancel', {}).then(st.reload).catch(fail); })}>{t('Annuler')}</button> : null}
              </span>
            </div>
          ))}
        </div>
      )}
      </Loaded>
    </>
  );
}
