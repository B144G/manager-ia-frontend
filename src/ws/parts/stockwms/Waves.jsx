import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { FormFoot, Kpis, Progress, Seg, Tag, WMS, qty, useDate } from './kit.jsx';
import Scanner from './Scanner.jsx';

/* Vagues de préparation : plusieurs commandes préparées en une seule tournée. Le parcours est consolidé (un arrêt par emplacement et
   par article) et suit un serpentin allée par allée ; au scan, la consigne de tri dit combien déposer pour chaque commande. */
const ST = { draft: ['Brouillon', 'mid'], released: ['Lancée', 'mid'], in_progress: ['En cours', 'mid'], picked: ['Terminée', 'good'], cancelled: ['Annulée', 'bad'] };
const PICK_ST = { open: ['À préparer', 'mid'], in_progress: ['En préparation', 'mid'], picked: ['Préparée', 'good'], issued: ['Expédiée', 'good'], cancelled: ['Annulée', 'bad'] };
const tag = (t, map, s) => <Tag tone={(map[s] || ['', 'mid'])[1]}>{t((map[s] || [s])[0])}</Tag>;

function NewWave({ close, done }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const cand = useLoad(() => oapi('GET', WMS + '/waves/candidates'), []);
  const mem = useLoad(() => oapi('GET', '/members').catch(() => ({ members: [] })), []);
  const [docs, setDocs] = useState([]); const [picks, setPicks] = useState([]);
  const [v, setV] = useState({ label: '', assignedTo: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const toggle = (list, set, id) => set(list.includes(id) ? list.filter((x) => x !== id) : list.concat([id]));
  const submit = (e) => {
    e.preventDefault(); setErr('');
    if (!docs.length && !picks.length) { setErr(t('Choisissez au moins une commande ou une liste de préparation.')); return; }
    setBusy(true);
    oapi('POST', WMS + '/waves', { documentIds: docs, pickIds: picks, label: v.label, assignedTo: v.assignedTo ? Number(v.assignedTo) : undefined })
      .then((j) => { close(); done(j); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(tsrv(x.message)); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <Loaded state={cand}>{(c) => (
        <>
          <h3>{t('Commandes à préparer')}</h3>
          {!c.orders.length ? <Empty text={t('Aucune commande ouverte sans liste de préparation.')} /> : null}
          {c.orders.map((o) => (
            <label className="row wms-check" key={'d' + o.id}><input type="checkbox" checked={docs.includes(o.id)} onChange={() => toggle(docs, setDocs, o.id)} />
              <span><b>{o.number}</b> <small>{[o.customer, t('{n} article(s)', { n: o.lineCount })].filter(Boolean).join(' · ')}</small></span></label>
          ))}
          <h3>{t('Listes de préparation ouvertes')}</h3>
          {!c.picks.length ? <Empty text={t('Aucune liste ouverte hors vague.')} /> : null}
          {c.picks.map((p) => (
            <label className="row wms-check" key={'p' + p.id}><input type="checkbox" checked={picks.includes(p.id)} onChange={() => toggle(picks, setPicks, p.id)} />
              <span><b>{p.code}</b> <small>{[p.documentNumber, p.customer, p.label, t('{n} ligne(s)', { n: p.lineCount })].filter(Boolean).join(' · ')}</small></span></label>
          ))}
        </>
      )}</Loaded>
      <label className="fld"><span>{t('Nom de la vague (facultatif)')}</span><input type="text" style={{ fontSize: 16 }} value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder={t('Tournée du matin, camion de 14 h…')} /></label>
      <label className="fld"><span>{t('Confiée à (facultatif)')}</span><select style={{ fontSize: 16 }} value={v.assignedTo} onChange={(e) => setV({ ...v, assignedTo: e.target.value })}><option value="">{t('Personne en particulier')}</option>{(mem.data ? mem.data.members : []).map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select></label>
      <p className="muted small">{t('Chaque commande devient une liste de préparation : le stock est mis de côté. La marchandise prélevée va en dépose, prête à emballer.')}</p>
      <FormFoot busy={busy} err={err} text={t('Créer la vague')} />
    </form>
  );
}

/** Tri : scanner un article pour savoir à quelles commandes il revient. */
function SortLookup({ id }) {
  const t = useT();
  const { oapi } = useWs();
  const [res, setRes] = useState(null); const [err, setErr] = useState('');
  const look = (code) => { setErr(''); oapi('GET', WMS + '/waves/' + id + '/sort?code=' + encodeURIComponent(code)).then(setRes).catch((e) => { setRes(null); setErr(tsrv(e.message)); }); };
  return (
    <div className="ws-card">
      <h3>{t('Tri par commande')}</h3>
      <Scanner label={t("Scanner l'article à trier")} onCode={look} />
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      {res ? (
        <div>
          <p><b>{res.item.name}</b></p>
          {!res.orders.length ? <Empty text={t('Aucune commande de la vague ne contient cet article.')} /> : null}
          {res.orders.map((o) => <div className="line" key={o.pickId}><span><b>{o.code}</b> <small>{[o.documentNumber, o.customer].filter(Boolean).join(' · ')}</small></span><b>{qty(o.quantity) + ' ' + res.item.unit}</b></div>)}
        </div>
      ) : null}
    </div>
  );
}

/** Le parcours du préparateur : un arrêt à la fois, dans l'ordre du serpentin. */
function WaveRun({ id, back }) {
  const t = useT();
  const { oapi, modal, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/waves/' + id), []);
  const [scan, setScan] = useState({});
  const [skip, setSkip] = useState(0);
  const [last, setLast] = useState(null);
  const [err, setErr] = useState('');
  const send = (s, body) => { setErr(''); return oapi('POST', WMS + '/waves/' + id + '/confirm', { locationId: s.locationId, itemId: s.itemId, itemCode: scan.item || undefined, locationCode: scan.loc || undefined, ...body })
    .then((j) => { setLast({ ...j, name: s.name, unit: s.unit }); setScan({}); setSkip(0); st.reload(); }).catch((e) => { if (e && e.status === 401) fail(e); setErr(tsrv(e.message)); }); };
  const partial = (s) => modal(t('Quantité réellement prélevée'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'q', label: t('Quantité ({unit})', { unit: s.unit }), value: String(s.quantity), required: true, hint: t('Moins que prévu si le bac est vide : le manque sera signalé.') }]}
      onSubmit={(v) => oapi('POST', WMS + '/waves/' + id + '/confirm', { locationId: s.locationId, itemId: s.itemId, quantity: v.q }).then((j) => { close(); setLast({ ...j, name: s.name, unit: s.unit }); st.reload(); })} />
  ));
  const complete = (allowShort) => oapi('POST', WMS + '/waves/' + id + '/complete', { allowShort }).then(() => { toast(t('Vague terminée : passez au poste d\'emballage.')); back(); }).catch((e) => {
    if (e.status === 409 && !allowShort) modal(t('Arrêts non faits'), (close) => <div><p>{tsrv(e.message)}</p><button className="btn primary" type="button" onClick={() => { close(); complete(true); }}>{t('Terminer quand même')}</button></div>);
    else fail(e);
  });
  return (
    <Loaded state={st}>{({ wave: w }) => {
      const stops = w.route;
      const cur = stops.length ? stops[Math.min(skip, stops.length - 1)] : null;
      return (
        <div className="wms-run">
          <div className="row" style={{ justifyContent: 'space-between' }}><h2>{w.code}</h2><button className="btn small" type="button" onClick={back}>{t('Retour')}</button></div>
          <Progress value={w.progress} label={t('Progression')} />
          <p className="muted small">{t('{a} / {b} prélevé · {n} arrêt(s) restant(s) · dépose : {s}', { a: qty(w.picked), b: qty(w.toPick), n: stops.length, s: w.staging || '—' })}</p>
          {last ? (
            <div className="ws-card wms-sort" role="status">
              <b>{t('Déposez en {s} : {q} {u} de « {name} »', { s: last.staging, q: qty(last.quantity), u: last.unit, name: last.name })}</b>
              {last.sort.map((x) => <div className="line" key={x.pickId}><span>{x.pickCode}</span><b>{qty(x.quantity) + ' ' + last.unit}</b></div>)}
            </div>
          ) : null}
          {err ? <p className="ws-err" role="alert">{err}</p> : null}
          {cur ? (
            <div className="wms-pickline next">
              <div className="wms-where"><b className="wms-loc">{cur.location || '—'}</b><small>{[cur.aisle && t('allée {x}', { x: cur.aisle }), cur.rack && t('rayon {x}', { x: cur.rack }), cur.bin && t('bac {x}', { x: cur.bin })].filter(Boolean).join(' · ')}</small></div>
              <div className="wms-what"><b>{cur.name}</b><span>{qty(cur.quantity) + ' ' + cur.unit}</span></div>
              <small className="muted">{t('Pour : {list}', { list: cur.orders.map((o) => o.pickCode + ' × ' + qty(o.quantity)).join(', ') })}</small>
              <div className="wms-do">
                <Scanner label={t("Scanner l'emplacement")} onCode={(c) => setScan({ ...scan, loc: c })} />
                {scan.loc ? <p className="small ok">{t('Emplacement lu : {c}', { c: scan.loc })}</p> : null}
                <Scanner label={t("Scanner l'article")} onCode={(c) => setScan({ ...scan, item: c })} />
                {scan.item ? <p className="small ok">{t('Article lu : {c}', { c: scan.item })}</p> : null}
                <div className="row">
                  <button className="btn primary" type="button" onClick={() => send(cur, {})}>{t('Prélevé')}</button>
                  <button className="btn" type="button" onClick={() => partial(cur)}>{t('Moins que prévu')}</button>
                  {stops.length > 1 ? <button className="btn" type="button" onClick={() => { setScan({}); setSkip((skip + 1) % stops.length); }}>{t('Passer cet arrêt')}</button> : null}
                </div>
              </div>
            </div>
          ) : <Empty text={t('Parcours terminé : tout est prélevé.')} />}
          {stops.length > 1 ? (
            <details className="ws-card"><summary>{t('Parcours complet ({n} arrêts)', { n: stops.length })}</summary>
              {stops.map((s, i) => <div className="line" key={s.key}><span><b>{(i + 1) + '. ' + (s.location || '—')}</b> <small>{s.name}</small></span><span>{qty(s.quantity) + ' ' + s.unit}</span></div>)}
            </details>
          ) : null}
          <div className="row" style={{ marginTop: 12 }}><button className={'btn' + (cur ? '' : ' primary')} type="button" onClick={() => complete(false)}>{t('Terminer la vague')}</button></div>
          <SortLookup id={id} />
        </div>
      );
    }}</Loaded>
  );
}

function WaveDetail({ id, back, onRun }) {
  const t = useT();
  const { oapi, can, toast, fail, confirm, modal } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/waves/' + id), []);
  const mgr = can('manager');
  const act = (path, msg) => oapi('POST', WMS + '/waves/' + id + path, {}).then(() => { if (msg) toast(msg); st.reload(); }).catch(fail);
  const addOrders = () => modal(t('Ajouter des commandes'), (close) => <AddOrders id={id} close={close} done={st.reload} />, { wide: true });
  return (
    <Loaded state={st}>{({ wave: w }) => (
      <div>
        <div className="row" style={{ justifyContent: 'space-between' }}><h2>{w.code}{w.label ? ' · ' + w.label : ''}</h2><button className="btn small" type="button" onClick={back}>{t('Retour')}</button></div>
        <p>{tag(t, ST, w.status)} {w.short ? <Tag tone="bad">{t('manque')}</Tag> : null} <small className="muted">{[w.assignedName, w.staging && t('dépose : {s}', { s: w.staging })].filter(Boolean).join(' · ')}</small></p>
        <Kpis list={[{ label: t('commandes'), value: String(w.orders) }, { label: t('à prélever'), value: qty(w.toPick) }, { label: t('prélevé'), value: qty(w.picked) }, { label: t('lignes faites'), value: w.linesDone + ' / ' + w.lines }]} />
        <Progress value={w.progress} label={t('Progression')} />
        <div className="row wms-toolbar" style={{ marginTop: 12 }}>
          {mgr && w.status === 'draft' ? <button className="btn primary" type="button" onClick={() => act('/release', t('Vague lancée.'))}>{t('Lancer la vague')}</button> : null}
          {['released', 'in_progress'].includes(w.status) ? <button className="btn primary" type="button" onClick={onRun}>{w.status === 'released' ? t('Commencer le parcours') : t('Reprendre le parcours')}</button> : null}
          {mgr && ['draft', 'released'].includes(w.status) ? <button className="btn" type="button" onClick={addOrders}>{t('Ajouter des commandes')}</button> : null}
          {mgr && ['draft', 'released'].includes(w.status) ? <button className="btn" type="button" onClick={() => confirm(t('Annuler cette vague ? Ses listes de préparation restent, hors vague.'), () => act('/cancel', t('Vague annulée.')))}>{t('Annuler la vague')}</button> : null}
        </div>
        <div className="ws-card">
          <h3>{t('Commandes de la vague')}</h3>
          {w.picks.map((p) => (
            <div className="line" key={p.pickId}>
              <span><b>{p.code}</b> {tag(t, PICK_ST, p.status)} {p.packedAt ? <Tag tone="good">{t('emballée')}</Tag> : null}
                <small>{' ' + [p.documentNumber, p.customer, p.label].filter(Boolean).join(' · ')}</small>
                <small className="muted">{' ' + p.items.map((x) => x.name + ' ' + qty(x.picked) + '/' + qty(x.quantity)).join(' · ')}</small></span>
              <span className="row">
                <span>{qty(p.picked) + ' / ' + qty(p.toPick)}</span>
                {mgr && ['draft', 'released'].includes(w.status) && p.picked === 0 ? <button className="link" type="button" onClick={() => oapi('DELETE', WMS + '/waves/' + id + '/picks/' + p.pickId).then(st.reload).catch(fail)}>{t('Retirer')}</button> : null}
              </span>
            </div>
          ))}
        </div>
        {w.status === 'picked' ? <p className="muted">{t("Vague terminée : emballez chaque commande au poste d'emballage.")}</p> : null}
        {w.status !== 'draft' && w.status !== 'cancelled' ? <SortLookup id={id} /> : null}
      </div>
    )}</Loaded>
  );
}

function AddOrders({ id, close, done }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const cand = useLoad(() => oapi('GET', WMS + '/waves/candidates'), []);
  return (
    <Loaded state={cand}>{(c) => (
      <Form submitText={t('Ajouter')} fields={[
        ...c.orders.map((o) => ({ k: 'd' + o.id, label: o.number + (o.customer ? ' · ' + o.customer : ''), type: 'select', options: [['', t('Non')], ['1', t('Oui')]] })),
        ...c.picks.map((p) => ({ k: 'p' + p.id, label: p.code + ' · ' + [p.documentNumber, p.customer, p.label].filter(Boolean).join(' · '), type: 'select', options: [['', t('Non')], ['1', t('Oui')]] })),
      ]} onSubmit={(v) => {
        const documentIds = Object.keys(v).filter((k) => k[0] === 'd' && v[k]).map((k) => Number(k.slice(1)));
        const pickIds = Object.keys(v).filter((k) => k[0] === 'p' && v[k]).map((k) => Number(k.slice(1)));
        if (!documentIds.length && !pickIds.length) throw new Error(t('Choisissez au moins une commande ou une liste de préparation.'));
        return oapi('POST', WMS + '/waves/' + id + '/picks', { documentIds, pickIds }).then((j) => { close(); toast(t('{n} commande(s) ajoutée(s).', { n: j.added.length })); done(); });
      }} />
    )}</Loaded>
  );
}

export default function Waves() {
  const t = useT();
  const { oapi, can, modal, toast } = useWs();
  const date = useDate();
  const mgr = can('manager');
  const [f, setF] = useState('');
  const [open, setOpen] = useState(null);
  const [run, setRun] = useState(false);
  const st = useLoad(() => oapi('GET', WMS + '/waves' + (f ? '?status=' + f : '')), [f]);
  if (open && run) return <WaveRun id={open} back={() => { setRun(false); st.reload(); }} />;
  if (open) return <WaveDetail id={open} back={() => { setOpen(null); st.reload(); }} onRun={() => setRun(true)} />;
  const created = (j) => {
    toast(t('Vague {code} créée.', { code: j.code }));
    if (j.skipped && j.skipped.length) modal(t('Commandes à revoir'), () => <div>{j.skipped.map((s, i) => <p key={i}><b>{s.number}</b> : {tsrv(s.reason)}</p>)}</div>);
    st.reload();
  };
  return (
    <>
      {mgr ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t('Nouvelle vague de préparation'), (close) => <NewWave close={close} done={created} />, { wide: true })}>{t('Nouvelle vague')}</button></div> : null}
      <Seg tabs={[['', t('En cours')], ['draft', t('Brouillons')], ['released', t('Lancées')], ['in_progress', t('En préparation')], ['picked', t('Terminées')]]} value={f} onChange={setF} />
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.waves.length ? <Empty text={t('Aucune vague de préparation.')} /> : null}
          {j.waves.map((w) => (
            <div className="line" key={w.id}>
              <span><b>{w.code}</b> {tag(t, ST, w.status)}{w.short ? <Tag tone="bad">{t('manque')}</Tag> : null}
                <small>{' ' + [w.label, t('{n} commande(s)', { n: w.orders }), qty(w.picked) + ' / ' + qty(w.toPick), date(w.createdAt.slice(0, 10)), w.assignedName].filter(Boolean).join(' · ')}</small>
                <Progress value={w.progress} label={t('Progression')} /></span>
              <span className="row">
                {['released', 'in_progress'].includes(w.status) ? <button className="btn small primary" type="button" onClick={() => { setOpen(w.id); setRun(true); }}>{t('Préparer')}</button> : null}
                <button className="btn small" type="button" onClick={() => setOpen(w.id)}>{t('Ouvrir')}</button>
              </span>
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}
