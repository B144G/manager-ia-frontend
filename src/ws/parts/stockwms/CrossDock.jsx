import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Seg, Tag, WMS, qty, useDate } from './kit.jsx';
import Scanner from './Scanner.jsx';

/* Transbordement (cross-docking) : la marchandise qui arrive et qu'une commande attend part directement en dépose (ou à quai) au lieu d'être rangée.
   Planifié : un responsable lie à l'avance une arrivée (bon de commande fournisseur, ou toute arrivée) à une commande. Opportuniste : chaque
   réception détecte ce que les listes de préparation et les commandes attendent et propose le transbordement (ou l'exécute, selon le réglage). */
const ST = { planned: ['Planifié', 'mid'], proposed: ['Proposé', 'mid'], ready: ['Prêt', 'good'], done: ['Fait', 'good'], cancelled: ['Annulé', 'bad'] };

/** Exécuter : scanner l'emplacement où est la marchandise (facultatif), puis la dépose. */
function Run({ x, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const [from, setFrom] = useState(''); const [q, setQ] = useState(String(x.remaining)); const [err, setErr] = useState('');
  const send = (to) => {
    setErr('');
    oapi('POST', WMS + '/crossdock/' + x.id + '/execute', { fromLocationCode: from || undefined, toLocationCode: to || undefined, quantity: q })
      .then((j) => { close(); done(j); }).catch((e) => setErr(tsrv(e.message)));
  };
  return (
    <div className="wms-run">
      <p><b>{x.item}</b> · {qty(x.remaining) + ' ' + x.unit} · {[x.documentNumber, x.pickCode, x.customer].filter(Boolean).join(' · ')}</p>
      <p className="muted small">{t('Prendre en {from}{hu}, déposer en dépose / emballage ou sur un quai d\'expédition.', { from: x.from || t('réception'), hu: x.huCode ? ' (' + x.huCode + ')' : '' })}</p>
      <label className="fld"><span>{t('Quantité')}</span><input type="text" inputMode="decimal" style={{ fontSize: 16 }} value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {!from ? <Scanner autoFocus label={t("Scanner l'emplacement de départ (facultatif)")} onCode={setFrom} /> : <p className="small ok">{t('Lu : {c}', { c: from })}</p>}
      <Scanner label={t('Scanner la dépose ou le quai')} onCode={send} />
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      <div className="row"><button className="btn primary" type="button" onClick={() => send('')}>{t('Déposer à l\'emplacement prévu')}</button></div>
    </div>
  );
}

function XdLine({ x, reload }) {
  const t = useT();
  const { can, modal, toast, oapi, fail, confirm } = useWs();
  const date = useDate();
  const run = () => modal(t('Transborder {code}', { code: x.code }), (close) => <Run x={x} close={close} done={(j) => { toast(t('{q} transbordé(s) vers {to} pour {p}.', { q: qty(j.quantity), to: j.to, p: j.pickCode })); reload(); }} />);
  const pending = ['planned', 'proposed', 'ready'].includes(x.status);
  return (
    <div className="line">
      <span><b>{x.code}</b> <Tag tone={ST[x.status][1]}>{t(ST[x.status][0])}</Tag> {x.planned ? <Tag tone="mid">{t('planifié')}</Tag> : <Tag tone="mid">{t('opportuniste')}</Tag>}
        <small>{' ' + [x.item + ' × ' + qty(x.status === 'done' ? x.doneQty : x.remaining) + ' ' + x.unit, x.documentNumber || x.pickCode, x.customer, x.waveCode && t('vague {x}', { x: x.waveCode }), x.purchaseOrder && t('commande fournisseur {x}', { x: x.purchaseOrder }),
          x.sourceCode && t(x.source) + ' ' + x.sourceCode, (x.from || x.to) && [x.from, x.to].filter(Boolean).join(' → '), x.huCode, x.doneBy, x.doneAt && date(x.doneAt.slice(0, 10)), x.closeReason && tsrv(x.closeReason)].filter(Boolean).join(' · ')}</small>
        {x.note ? <small className="muted">{' · ' + x.note}</small> : null}</span>
      {pending ? (
        <span className="row">
          {x.status !== 'planned' ? <button className="btn small primary" type="button" onClick={run}>{t('Transborder')}</button> : null}
          {can('manager') ? <button className="link" type="button" onClick={() => confirm(x.status === 'planned' ? t('Annuler ce transbordement planifié ?') : t('Refuser ce transbordement ? La marchandise sera rangée normalement.'), () => oapi('POST', WMS + '/crossdock/' + x.id + '/cancel', {}).then(reload).catch(fail))}>{x.status === 'planned' ? t('Annuler') : t('Refuser')}</button> : null}
        </span>
      ) : null}
    </div>
  );
}

export function Queue({ status, compact }) {
  const t = useT();
  const { oapi } = useWs();
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const st = useLoad(() => oapi('GET', WMS + '/crossdock?status=' + status), [status]);
  const scan = (code) => {
    setErr(''); setMsg('');
    oapi('POST', WMS + '/crossdock/scan', { code }).then((j) => { setMsg(j.done.map((d) => t('{code} : {q} vers {to} ({p})', { code: d.code, q: qty(d.quantity), to: d.to, p: d.pickCode })).join(' · ')); st.reload(); }).catch((e) => setErr(tsrv(e.message)));
  };
  return (
    <>
      {status === 'todo' ? (
        <div className="ws-card">
          <Scanner autoFocus label={t("Scanner l'article reçu, sa palette ou le code XD-…")} hint={t('La marchandise part en dépose, prête à emballer pour la commande qui l\'attend.')} onCode={scan} />
          {msg ? <p className="small ok" role="status">{msg}</p> : null}
          {err ? <p className="ws-err" role="alert">{err}</p> : null}
        </div>
      ) : null}
      <Loaded state={st}>{(j) => (
        <>
          {status === 'todo' && !compact ? <Kpis list={[{ label: t('prêts'), value: String(j.counts.ready) }, { label: t('proposés'), value: String(j.counts.proposed) }, { label: t('planifiés'), value: String(j.counts.planned) }]} /> : null}
          <div className="ws-card">
            {!j.crossdocks.length ? <Empty text={status === 'todo' ? t('Rien à transborder : les réceptions proposent un transbordement dès qu\'une commande attend la marchandise.') : status === 'planned' ? t('Aucun transbordement planifié.') : t('Aucun transbordement terminé.')} /> : null}
            {j.crossdocks.map((x) => <XdLine key={x.id} x={x} reload={st.reload} />)}
          </div>
        </>
      )}</Loaded>
    </>
  );
}

/** Planifier : lier une arrivée attendue à une commande. */
function PlanForm({ item, demand, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  return (
    <Form submitText={t('Planifier le transbordement')} fields={[
      { k: 'quantity', label: t('Quantité ({u})', { u: item.unit }), value: String(demand.missing), required: true },
      { k: 'purchaseOrderId', label: t('Arrivée attendue'), type: 'select', options: [['', t('Toute réception de cet article')]].concat(item.inbound.map((p) => [String(p.purchaseOrderId), p.number + (p.supplier ? ' · ' + p.supplier : '') + ' · ' + t('{q} attendu(s)', { q: qty(p.remaining) })])) },
      { k: 'note', label: t('Remarque (facultatif)') }]}
    onSubmit={(v) => oapi('POST', WMS + '/crossdock/plan', { itemId: item.itemId, quantity: v.quantity, documentId: demand.documentId || undefined, pickId: demand.documentId ? undefined : demand.pickId, purchaseOrderId: v.purchaseOrderId ? Number(v.purchaseOrderId) : undefined, note: v.note }).then((j) => { close(); done(j); })} />
  );
}

function Demand() {
  const t = useT();
  const { oapi, can, modal, toast } = useWs();
  const date = useDate();
  const st = useLoad(() => oapi('GET', WMS + '/crossdock/demand'), []);
  return (
    <Loaded state={st}>{(j) => (
      <div className="ws-card">
        {!j.items.length ? <Empty text={t('Aucune commande n\'attend de marchandise : le stock couvre les préparations en cours.')} /> : null}
        {j.items.map((it) => (
          <div key={it.itemId} className="wms-xd-item">
            <p><b>{it.name}</b> <small>{' ' + t('{m} {u} attendu(s) · {a} disponible(s){p}', { m: qty(it.missing), u: it.unit, a: qty(Math.max(0, it.available)), p: it.planned ? ' · ' + t('{q} déjà planifié(s)', { q: qty(it.planned) }) : '' })}</small></p>
            {it.demands.map((d, i) => (
              <div className="line" key={i}>
                <span><b>{d.documentNumber || d.pickCode}</b> <Tag tone={d.targetKind === 'pick' ? 'mid' : 'bad'}>{d.targetKind === 'pick' ? t('liste {x}', { x: d.pickCode }) : t('sans liste')}</Tag>
                  <small>{' ' + [d.customer, d.waveCode && t('vague {x}', { x: d.waveCode }), t('manque {q}', { q: qty(d.missing) })].filter(Boolean).join(' · ')}</small></span>
                {can('manager') ? <button className="btn small" type="button" onClick={() => modal(t('Planifier pour {d}', { d: d.documentNumber || d.pickCode }), (close) => <PlanForm item={it} demand={d} close={close} done={(r) => { toast(t('Transbordement {code} planifié.', { code: r.code })); st.reload(); }} />)}>{t('Planifier')}</button> : null}
              </div>
            ))}
            {it.inbound.length ? <p className="muted small">{t('En route : {list}', { list: it.inbound.map((p) => p.number + ' (' + qty(p.remaining) + (p.expectedDate ? ', ' + date(p.expectedDate) : '') + ')').join(', ') })}</p> : null}
          </div>
        ))}
      </div>
    )}</Loaded>
  );
}

function ModeSetting() {
  const t = useT();
  const { oapi, can, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/settings'), []);
  if (!st.data) return null;
  const mode = st.data.settings.crossDock || 'propose';
  const LABEL = { propose: t('Proposer à la réception'), auto: t('Transborder automatiquement'), off: t('Désactivé') };
  if (!can('admin')) return <p className="muted small">{t('Transbordement à la réception : {m}.', { m: LABEL[mode] })}</p>;
  return (
    <label className="fld wms-xd-mode"><span>{t('Transbordement à la réception')}</span>
      <select style={{ fontSize: 16 }} value={mode} onChange={(e) => oapi('PUT', WMS + '/settings', { crossDock: e.target.value }).then(() => { toast(t('Réglage enregistré.')); st.reload(); }).catch(fail)}>
        {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select></label>
  );
}

export default function CrossDock() {
  const t = useT();
  const [tab, setTab] = useState('todo');
  return (
    <>
      <div className="row wms-toolbar" style={{ justifyContent: 'space-between' }}><ModeSetting /></div>
      <Seg tabs={[['todo', t('À transborder')], ['demand', t('Commandes en attente')], ['planned', t('Planifiés')], ['history', t('Historique')]]} value={tab} onChange={setTab} />
      {tab === 'demand' ? <Demand /> : <Queue key={tab} status={tab} />}
    </>
  );
}
