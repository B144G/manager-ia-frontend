import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Seg, Tag, WMS, itemOptions, qty, useDate, useItems } from './kit.jsx';
import Scanner from './Scanner.jsx';

/* Services à valeur ajoutée : étiquetage, reconditionnement, emballage cadeau, contrôle… Un type a un coût (par tâche ou par unité) et peut
   être obligatoire ; les tâches se rattachent à une préparation, une expédition ou une réception (à la main ou par une règle) ; chaque personne
   a sa liste, une tâche se termine en scannant son code. Une tâche obligatoire non faite bloque la sortie du stock. */
const ST = { open: ['À faire', 'mid'], in_progress: ['En cours', 'mid'], done: ['Terminée', 'good'], cancelled: ['Annulée', 'bad'] };
const REFS = { pick: 'Liste de préparation', shipment: 'Expédition', receipt: 'Réception', pur_receipt: "Réception d'achat" };

function TaskLine({ x, reload, showRef = true }) {
  const t = useT();
  const { oapi, can, fail, modal, toast, money } = useWs();
  const mgr = can('manager');
  const done = (close) => (
    <Form submitText={t('Terminer la tâche')} fields={[
      { k: 'quantity', label: t('Quantité traitée'), value: String(x.quantity) },
      { k: 'minutes', label: t('Durée (minutes, facultatif)'), value: x.minutes == null ? '' : String(x.minutes) },
      ...(mgr ? [{ k: 'cost', label: t('Coût réel (facultatif)'), hint: t('Vide : coût du type de service.') }] : []),
      { k: 'result', label: t('Remarque (facultatif)') }]}
    onSubmit={(v) => oapi('POST', WMS + '/vas/tasks/' + x.id + '/complete', v).then(() => { close(); toast(t('Tâche terminée.')); reload(); })} />
  );
  const open = x.status === 'open' || x.status === 'in_progress';
  return (
    <div className="line">
      <span><b>{x.code}</b> {x.name} <Tag tone={ST[x.status][1]}>{t(ST[x.status][0])}</Tag> {x.mandatory ? <Tag tone="bad">{t('obligatoire')}</Tag> : null} {x.auto ? <Tag tone="mid">{t('règle')}</Tag> : null}
        <small>{' ' + [showRef ? t(REFS[x.refKind]) + ' ' + (x.refCode || '') : '', x.item ? x.item + ' × ' + qty(x.quantity) : '', x.assignedName, x.cost !== undefined && x.status === 'done' ? money(x.cost) : '', x.doneBy].filter(Boolean).join(' · ')}</small>
        {x.instructions && open ? <small className="muted">{' · ' + x.instructions}</small> : null}{x.result ? <small className="muted">{' · ' + x.result}</small> : null}</span>
      {open ? (
        <span className="row">
          {x.status === 'open' ? <button className="btn small" type="button" onClick={() => oapi('POST', WMS + '/vas/tasks/' + x.id + '/start', {}).then(reload).catch(fail)}>{t('Commencer')}</button> : null}
          <button className="btn small primary" type="button" onClick={() => modal(t('Terminer {code}', { code: x.code }), done)}>{t('Terminer')}</button>
          {mgr ? <button className="link" type="button" onClick={() => oapi('POST', WMS + '/vas/tasks/' + x.id + '/cancel', {}).then(reload).catch(fail)}>{t('Annuler')}</button> : null}
        </span>
      ) : null}
    </div>
  );
}

/** Ajouter une tâche à un document (responsables). */
function NewTask({ refKind, refId, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const types = useLoad(() => oapi('GET', WMS + '/vas/types'), []);
  const items = useItems();
  return (
    <Loaded state={types}>{(j) => (
      <Form submitText={t('Ajouter la tâche')} fields={[
        { k: 'typeId', label: t('Service'), type: 'select', options: [['', t('Choisir…')]].concat(j.types.filter((x) => x.active).map((x) => [String(x.id), x.name + ' · ' + t(x.categoryLabel)])), required: true },
        ...(refId ? [] : [{ k: 'refKind', label: t('Rattaché à'), type: 'select', options: Object.entries(REFS).map(([k, v]) => [k, t(v)]) }, { k: 'refCode', label: t('Code du document (PR-…, EX-…, RC-…, BR-…)'), required: true }]),
        { k: 'itemId', label: t('Article (facultatif)'), type: 'select', options: itemOptions(items.items, t('Aucun')) },
        { k: 'quantity', label: t('Quantité'), value: '1' },
        { k: 'mandatory', label: t('Obligatoire avant la sortie du stock'), type: 'select', options: [['', t('Selon le type de service')], ['1', t('Oui')], ['0', t('Non')]] },
        { k: 'note', label: t('Consigne (facultatif)') }]}
      onSubmit={(v) => oapi('POST', WMS + '/vas/tasks', { typeId: Number(v.typeId), refKind: refKind || v.refKind, refId: refId || undefined, refCode: refId ? undefined : v.refCode, itemId: v.itemId ? Number(v.itemId) : undefined, quantity: v.quantity, mandatory: v.mandatory === '' ? undefined : v.mandatory === '1', note: v.note })
        .then((r) => { close(); done(r); })} />
    )}</Loaded>
  );
}

/** Bloc « Services » d'une préparation ou d'une expédition. */
export function VasPanel({ refKind, refId }) {
  const t = useT();
  const { oapi, can, modal, toast } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/vas/tasks?status=all&refKind=' + refKind + '&refId=' + refId), [refKind, refId]);
  const list = st.data ? st.data.tasks.filter((x) => x.status !== 'cancelled') : [];
  if (!list.length && !can('manager')) return null;
  const blocking = list.filter((x) => x.mandatory && (x.status === 'open' || x.status === 'in_progress')).length;
  return (
    <div className="ws-card">
      <div className="row" style={{ justifyContent: 'space-between' }}><b>{t('Services à valeur ajoutée')}</b>
        {can('manager') ? <button className="btn small" type="button" onClick={() => modal(t('Ajouter un service'), (close) => <NewTask refKind={refKind} refId={refId} close={close} done={(r) => { toast(t('Tâche {code} ajoutée.', { code: r.code })); st.reload(); }} />)}>{t('Ajouter un service')}</button> : null}</div>
      {blocking ? <p className="ws-err small">{t('{n} service(s) obligatoire(s) à terminer avant la sortie du stock.', { n: blocking })}</p> : null}
      {!list.length ? <Empty text={t('Aucun service sur ce document.')} /> : null}
      {list.map((x) => <TaskLine key={x.id} x={x} reload={st.reload} showRef={false} />)}
    </div>
  );
}

export function Tasks({ mine }) {
  const t = useT();
  const { oapi, can, modal, toast } = useWs();
  const [f, setF] = useState('todo');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [found, setFound] = useState(null);
  const st = useLoad(() => oapi('GET', WMS + '/vas/tasks?status=' + f + (mine ? '&mine=1' : '')), [f, mine]);
  const scan = (code) => {
    setErr(''); setMsg(''); setFound(null);
    oapi('POST', WMS + '/vas/scan', { code }).then((j) => {
      if (j.completed) { setMsg(t('{code} terminée : {name}.', { code: j.completed.code, name: j.completed.name })); st.reload(); } else setFound(j);
    }).catch((e) => setErr(tsrv(e.message)));
  };
  return (
    <>
      {!mine && can('manager') ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t('Nouvelle tâche de service'), (close) => <NewTask close={close} done={(r) => { toast(t('Tâche {code} ajoutée.', { code: r.code })); st.reload(); }} />)}>{t('Nouvelle tâche')}</button></div> : null}
      <div className="ws-card">
        <Scanner label={t('Scanner le code de la tâche (VAS-…) pour la terminer, ou celui d\'une préparation ou expédition')} onCode={scan} />
        {msg ? <p className="small ok" role="status">{msg}</p> : null}
        {err ? <p className="ws-err" role="alert">{err}</p> : null}
        {found ? <div><p><b>{t(found.refLabel) + ' ' + found.refCode}</b></p>{!found.tasks.length ? <Empty text={t('Aucun service à faire sur ce document.')} /> : found.tasks.map((x) => <TaskLine key={x.id} x={x} reload={() => { st.reload(); scan(found.refCode); }} showRef={false} />)}</div> : null}
      </div>
      <Seg tabs={[['todo', t('À faire')], ['done', t('Terminées')], ['cancelled', t('Annulées')]]} value={f} onChange={setF} />
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.tasks.length ? <Empty text={mine ? t('Aucune tâche pour vous.') : t('Aucune tâche de service.')} /> : null}
          {j.tasks.map((x) => <TaskLine key={x.id} x={x} reload={st.reload} />)}
        </div>
      )}</Loaded>
    </>
  );
}

function Types() {
  const t = useT();
  const { oapi, can, modal, toast, fail, money, confirm } = useWs();
  const mgr = can('manager');
  const st = useLoad(() => oapi('GET', WMS + '/vas/types'), []);
  const fields = (j, x = {}) => [
    { k: 'name', label: t('Nom du service'), value: x.name || '', required: true, placeholder: t('Étiquetage prix, emballage cadeau…') },
    { k: 'category', label: t('Catégorie'), type: 'select', value: x.category || 'labeling', options: Object.entries(j.categories).map(([k, v]) => [k, t(v)]) },
    { k: 'unitCost', label: t('Coût'), value: x.unitCost === undefined ? '' : String(x.unitCost) },
    { k: 'costBasis', label: t('Le coût est compté'), type: 'select', value: x.costBasis || 'task', options: Object.entries(j.bases).map(([k, v]) => [k, t(v)]) },
    { k: 'minutes', label: t('Durée prévue (minutes, facultatif)'), value: x.minutes == null ? '' : String(x.minutes) },
    { k: 'mandatory', label: t('Obligatoire avant la sortie du stock'), type: 'select', value: x.mandatory ? '1' : '', options: [['', t('Non')], ['1', t('Oui')]] },
    { k: 'instructions', label: t('Consigne pour l\'opérateur'), type: 'textarea', rows: 2, value: x.instructions || '' }];
  const send = (v) => ({ ...v, mandatory: v.mandatory === '1' });
  return (
    <Loaded state={st}>{(j) => (
      <>
        {mgr ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={() => modal(t('Nouveau type de service'), (close) => <Form submitText={t('Créer')} fields={fields(j)} onSubmit={(v) => oapi('POST', WMS + '/vas/types', send(v)).then(() => { close(); toast(t('Type de service créé.')); st.reload(); })} />)}>{t('Nouveau type de service')}</button></div> : null}
        <div className="ws-card">
          {!j.types.length ? <Empty text={t('Aucun type de service : créez-en un (étiquetage, emballage cadeau, contrôle…).')} /> : null}
          {j.types.map((x) => (
            <div className="line" key={x.id}>
              <span><b>{x.name}</b> <Tag tone="mid">{t(x.categoryLabel)}</Tag> {x.mandatory ? <Tag tone="bad">{t('obligatoire')}</Tag> : null} {!x.active ? <Tag tone="bad">{t('inactif')}</Tag> : null}
                <small>{' ' + [x.unitCost !== undefined ? money(x.unitCost) + ' · ' + t(x.costBasisLabel).toLowerCase() : '', x.minutes ? t('{n} min', { n: x.minutes }) : '', x.instructions].filter(Boolean).join(' · ')}</small></span>
              {mgr ? <span className="row">
                <button className="btn small" type="button" onClick={() => modal(t('Modifier le service'), (close) => <Form submitText={t('Enregistrer')} fields={fields(j, x)} onSubmit={(v) => oapi('PUT', WMS + '/vas/types/' + x.id, send(v)).then(() => { close(); st.reload(); })} />)}>{t('Modifier')}</button>
                <button className="link" type="button" onClick={() => confirm(t('Supprimer ce type de service ? S\'il a déjà servi, il est seulement désactivé.'), () => oapi('DELETE', WMS + '/vas/types/' + x.id).then(st.reload).catch(fail))}>{t('Supprimer')}</button>
              </span> : null}
            </div>
          ))}
        </div>
      </>
    )}</Loaded>
  );
}

function Rules() {
  const t = useT();
  const { oapi, can, modal, toast, fail } = useWs();
  const mgr = can('manager');
  const st = useLoad(() => oapi('GET', WMS + '/vas/rules'), []);
  const types = useLoad(() => oapi('GET', WMS + '/vas/types'), []);
  const cust = useLoad(() => oapi('GET', '/crm/customers').catch(() => ({ customers: [] })), []);
  const items = useItems();
  const APPLY = { pick: t('Chaque préparation'), shipment: t('Chaque expédition'), receipt: t('Chaque réception') };
  const add = () => modal(t('Nouvelle règle de service'), (close) => (
    <Form submitText={t('Créer la règle')} fields={[
      { k: 'typeId', label: t('Service'), type: 'select', options: [['', t('Choisir…')]].concat((types.data ? types.data.types : []).filter((x) => x.active).map((x) => [String(x.id), x.name])), required: true },
      { k: 'applies', label: t('Quand'), type: 'select', options: Object.entries(APPLY) },
      { k: 'itemId', label: t('Seulement pour cet article (facultatif)'), type: 'select', options: itemOptions(items.items, t('Tous les articles')) },
      { k: 'customerId', label: t('Seulement pour ce client (facultatif)'), type: 'select', options: [['', t('Tous les clients')]].concat((cust.data ? cust.data.customers : []).map((c) => [String(c.id), c.name])) },
      { k: 'mandatory', label: t('Obligatoire avant la sortie du stock'), type: 'select', options: [['', t('Selon le type de service')], ['1', t('Oui')], ['0', t('Non')]] }]}
    onSubmit={(v) => oapi('POST', WMS + '/vas/rules', { typeId: Number(v.typeId), applies: v.applies, itemId: v.itemId ? Number(v.itemId) : undefined, customerId: v.customerId ? Number(v.customerId) : undefined, mandatory: v.mandatory === '' ? undefined : v.mandatory === '1' }).then(() => { close(); toast(t('Règle créée.')); st.reload(); })} />
  ));
  return (
    <>
      {mgr ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={add}>{t('Nouvelle règle')}</button></div> : null}
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.rules.length ? <Empty text={t('Aucune règle : les tâches se créent à la main, ou automatiquement pour un article, un client ou chaque document.')} /> : null}
          {j.rules.map((r) => (
            <div className="line" key={r.id}>
              <span><b>{r.type}</b> {r.mandatory ? <Tag tone="bad">{t('obligatoire')}</Tag> : null}<small>{' ' + [APPLY[r.applies], r.item, r.customer].filter(Boolean).join(' · ')}</small></span>
              {mgr ? <button className="link" type="button" onClick={() => oapi('DELETE', WMS + '/vas/rules/' + r.id).then(st.reload).catch(fail)}>{t('Supprimer')}</button> : null}
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}

function Costs() {
  const t = useT();
  const { oapi, money } = useWs();
  const date = useDate();
  const today = new Date().toISOString().slice(0, 10);
  const [p, setP] = useState({ from: today.slice(0, 7) + '-01', to: today });
  const st = useLoad(() => oapi('GET', WMS + '/vas/costs?from=' + p.from + '&to=' + p.to), [p.from, p.to]);
  return (
    <>
      <div className="row wms-toolbar">
        <label className="fld"><span>{t('Du')}</span><input type="date" style={{ fontSize: 16 }} value={p.from} onChange={(e) => setP({ ...p, from: e.target.value })} /></label>
        <label className="fld"><span>{t('Au')}</span><input type="date" style={{ fontSize: 16 }} value={p.to} onChange={(e) => setP({ ...p, to: e.target.value })} /></label>
      </div>
      <Loaded state={st}>{(j) => (
        <>
          <Kpis list={[{ label: t('tâches terminées'), value: String(j.tasks) }, { label: t('coût total'), value: money(j.total) }, { label: t('temps passé'), value: t('{n} min', { n: qty(j.minutes) }) }]} />
          <div className="ws-card"><b>{t('Par service')}</b>
            {!j.byType.length ? <Empty text={t('Aucun service terminé du {a} au {b}.', { a: date(j.from), b: date(j.to) })} /> : null}
            {j.byType.map((x) => <div className="line" key={x.name}><span><b>{x.name}</b><small>{' ' + t('{n} tâche(s)', { n: x.tasks }) + ' · ' + qty(x.quantity) + (x.minutes ? ' · ' + t('{n} min', { n: qty(x.minutes) }) : '')}</small></span><b>{money(x.cost)}</b></div>)}
          </div>
          <div className="ws-card"><b>{t('Par document')}</b>
            {j.byRef.map((x) => <div className="line" key={x.refKind + x.refId}><span><b>{x.refCode}</b><small>{' ' + t(x.refLabel) + ' · ' + t('{n} tâche(s)', { n: x.tasks })}</small></span><b>{money(x.cost)}</b></div>)}
          </div>
        </>
      )}</Loaded>
    </>
  );
}

export default function Vas() {
  const t = useT();
  const { can } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState('mine');
  const tabs = [['mine', t('Mes tâches')], ['all', t('Toutes les tâches')], ['types', t('Types de service')], ['rules', t('Règles')], ...(mgr ? [['costs', t('Coûts')]] : [])];
  return (
    <>
      <Seg tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'mine' ? <Tasks mine /> : tab === 'all' ? <Tasks /> : tab === 'types' ? <Types /> : tab === 'rules' ? <Rules /> : <Costs />}
    </>
  );
}
