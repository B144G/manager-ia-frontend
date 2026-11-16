import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { FormFoot, Kpis, Tag, WMS, qty, useDate } from './kit.jsx';
import Scanner from './Scanner.jsx';

/* Vagues de préparation : plusieurs commandes en une seule tournée, lignes regroupées dans l'ordre du parcours. */
export function WaveRunner({ id, back }) {
  const t = useT();
  const { oapi, can, fail, toast, modal } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/waves/' + id), []);
  const [scan, setScan] = useState({}); const [err, setErr] = useState('');
  const key = (l) => l.locationId + ':' + l.itemId;
  const confirmLine = (l, quantity) => {
    setErr(''); const s = scan[key(l)] || {};
    oapi('POST', WMS + '/waves/' + id + '/confirm', { itemId: l.itemId, locationId: l.locationId, quantity, itemCode: s.item || undefined, locationCode: s.loc || undefined })
      .then(() => { setScan((x) => ({ ...x, [key(l)]: {} })); st.reload(); }).catch((e) => { if (e && e.status === 401) fail(e); setErr(e.message); });
  };
  const complete = (allowShort) => oapi('POST', WMS + '/waves/' + id + '/complete', { allowShort }).then(() => { toast(t('Vague préparée.')); st.reload(); }).catch((e) => {
    if (e.status === 409 && !allowShort) modal(t('Lignes incomplètes'), (close) => (<div><p>{e.message}</p><button className="btn primary" type="button" onClick={() => { close(); complete(true); }}>{t('Terminer quand même')}</button></div>));
    else fail(e);
  });
  const issue = () => oapi('POST', WMS + '/waves/' + id + '/issue', {}).then((j) => { toast(t('{n} commande(s) expédiée(s).', { n: j.orders })); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{({ wave: w }) => {
      const next = w.lines.find((l) => !l.done);
      return (
        <div className="wms-run">
          <div className="row" style={{ justifyContent: 'space-between' }}><h2>{w.code}</h2><button className="btn small" type="button" onClick={back}>{t('Retour')}</button></div>
          <p><Tag tone={w.status === 'done' ? 'good' : 'mid'}>{t(w.statusLabel)}</Tag> <small className="muted">{[w.label, w.orders.map((o) => o.code).join(', ')].filter(Boolean).join(' · ')}</small></p>
          <Kpis list={[{ label: t('commandes'), value: String(w.picks) }, { label: t('préparées'), value: String(w.picked) }, { label: t('expédiées'), value: String(w.issued) }]} />
          {err ? <p className="ws-err" role="alert">{err}</p> : null}
          {w.lines.map((l) => {
            const s = scan[key(l)] || {}; const isNext = next && key(next) === key(l);
            return (
              <div className={'wms-pickline' + (l.done ? ' done' : '') + (isNext ? ' next' : '')} key={key(l)}>
                <div className="wms-where"><b className="wms-loc">{l.location}</b></div>
                <div className="wms-what"><b>{l.name}</b><span>{qty(l.pickedQty) + ' / ' + qty(l.quantity) + ' ' + l.unit}</span></div>
                <small className="muted">{l.orders.map((o) => o.pick + ' : ' + qty(o.pickedQty) + '/' + qty(o.quantity)).join(' · ')}</small>
                {!l.done && w.status !== 'done' ? (
                  <div className="wms-do">
                    {isNext ? <><Scanner label={t("Scanner l'emplacement")} onCode={(c) => setScan({ ...scan, [key(l)]: { ...s, loc: c } })} />{s.loc ? <p className="small ok">{t('Emplacement lu : {c}', { c: s.loc })}</p> : null}
                      <Scanner label={t("Scanner l'article")} onCode={(c) => setScan({ ...scan, [key(l)]: { ...s, item: c } })} />{s.item ? <p className="small ok">{t('Article lu : {c}', { c: s.item })}</p> : null}</> : null}
                    <button className="btn primary" type="button" onClick={() => confirmLine(l)}>{t('Tout prélevé')}</button>
                  </div>
                ) : <small className="ok">{l.done ? t('Fait') : ''}</small>}
              </div>
            );
          })}
          <div className="row" style={{ marginTop: 12 }}>
            {w.status !== 'done' && w.lines.some((l) => l.pickedQty > 0) ? <button className="btn primary" type="button" onClick={() => complete(false)}>{t('Terminer la préparation')}</button> : null}
            {can('manager') && w.picked > w.issued ? <button className="btn primary" type="button" onClick={issue}>{t('Expédier la vague')}</button> : null}
          </div>
        </div>
      );
    }}
    </Loaded>
  );
}

function NewWave({ close, done }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const ords = useLoad(() => oapi('GET', '/sales/orders').catch(() => ({ orders: [] })), []);
  const docs = useLoad(() => oapi('GET', '/crm/documents').catch(() => ({ documents: [] })), []);
  const [sel, setSel] = useState({}); const [label, setLabel] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const list = [];
  if (ords.data) ords.data.orders.filter((o) => o.status !== 'cancelled').forEach((o) => list.push([o.id, o.number + ' · ' + o.customer]));
  if (docs.data) docs.data.documents.filter((d) => d.kind !== 'credit' && !['cancelled', 'refused', 'paid', 'credited'].includes(d.status)).forEach((d) => list.push([d.id, d.number + ' · ' + (d.customer || '')]));
  const ids = Object.keys(sel).filter((k) => sel[k]).map(Number);
  const submit = (e) => {
    e.preventDefault(); setErr('');
    if (ids.length < 2) { setErr(t('Cochez au moins deux commandes.')); return; }
    setBusy(true);
    oapi('POST', WMS + '/waves', { documentIds: ids, label }).then(() => { close(); done(); }).catch((x) => { if (x && x.status === 401) fail(x); setErr(x.message); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      {!list.length ? <Empty text={t('Aucune commande à regrouper.')} /> : null}
      {list.map((o) => <label className="line wms-check" key={o[0]}><input type="checkbox" checked={!!sel[o[0]]} onChange={(e) => setSel({ ...sel, [o[0]]: e.target.checked })} /><span><b>{o[1]}</b></span></label>)}
      <label className="fld"><span>{t('Nom de la tournée (facultatif)')}</span><input type="text" style={{ fontSize: 16 }} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <FormFoot busy={busy} err={err} text={t('Créer la vague')} />
    </form>
  );
}

export default function Waves() {
  const t = useT();
  const { oapi, can, modal, toast, fail, confirm } = useWs();
  const date = useDate();
  const [run, setRun] = useState(null);
  const st = useLoad(() => oapi('GET', WMS + '/waves'), []);
  if (run) return <WaveRunner id={run} back={() => { setRun(null); st.reload(); }} />;
  return (
    <>
      {can('manager') ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t('Nouvelle vague de préparation'), (close) => <NewWave close={close} done={() => { toast(t('Vague créée.')); st.reload(); }} />, { wide: true })}>{t('Nouvelle vague')}</button></div> : null}
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.waves.length ? <Empty text={t('Aucune vague de préparation.')} /> : null}
          {j.waves.map((w) => (
            <div className="line" key={w.id}>
              <span><b>{w.code}</b> <Tag tone={w.status === 'done' ? 'good' : w.status === 'cancelled' ? 'bad' : 'mid'}>{t(w.statusLabel)}</Tag><small>{' ' + (w.label ? w.label + ' · ' : '') + t('{n} commande(s)', { n: w.picks }) + ' · ' + date(w.createdAt.slice(0, 10))}</small></span>
              <span className="row">
                <button className="btn small" type="button" onClick={() => setRun(w.id)}>{w.status === 'open' ? t('Préparer') : t('Ouvrir')}</button>
                {can('manager') && w.status === 'open' ? <button className="link" type="button" onClick={() => confirm(t('Annuler cette vague ?'), () => { oapi('POST', WMS + '/waves/' + w.id + '/cancel', {}).then(st.reload).catch(fail); })}>{t('Annuler')}</button> : null}
              </span>
            </div>
          ))}
        </div>
      )}
      </Loaded>
    </>
  );
}
