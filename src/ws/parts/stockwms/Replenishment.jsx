import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Seg, Tag, WMS, itemOptions, qty, useItems, useLocations } from './kit.jsx';
import Scanner from './Scanner.jsx';

/* Réapprovisionnement des emplacements de préparation : un minimum et un maximum par article et emplacement. Sous le minimum, des tâches
   ramènent du rayonnage des palettes entières d'abord, puis du vrac ; elles s'exécutent par scan. */

/** Exécuter une tâche : scanner le départ (ou la palette), puis l'emplacement de préparation. */
function RunTask({ task, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const [from, setFrom] = useState(''); const [err, setErr] = useState('');
  const send = (to) => {
    setErr('');
    const body = task.huId ? { huCode: from || undefined, toLocationCode: to } : { fromLocationCode: from || undefined, toLocationCode: to };
    oapi('POST', WMS + '/replenishment/tasks/' + task.id + '/confirm', body).then(() => { close(); done(); }).catch((e) => setErr(tsrv(e.message)));
  };
  return (
    <div className="wms-run">
      <p><b>{task.item}</b> · {qty(task.quantity) + ' ' + task.unit}</p>
      <p className="muted small">{task.huCode ? t('Prendre la palette {hu} en {from}, la déposer en {to}.', { hu: task.huCode, from: task.from, to: task.to }) : t('Prendre {q} {u} en {from}, les déposer en {to}.', { q: qty(task.quantity), u: task.unit, from: task.from, to: task.to })}</p>
      {!from ? <Scanner autoFocus label={task.huCode ? t("Scanner l'étiquette de la palette") : t("Scanner l'emplacement de départ")} onCode={setFrom} />
        : <><p className="small ok">{t('Lu : {c}', { c: from })}</p><Scanner autoFocus label={t("Scanner l'emplacement de préparation")} onCode={send} /></>}
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      <div className="row"><button className="btn" type="button" onClick={() => send(undefined)}>{t('Confirmer sans scanner')}</button></div>
    </div>
  );
}

function Tasks() {
  const t = useT();
  const { oapi, modal, toast, fail, can } = useWs();
  const [f, setF] = useState('open');
  const st = useLoad(() => oapi('GET', WMS + '/replenishment/tasks?status=' + f), [f]);
  const gen = () => oapi('POST', WMS + '/replenishment/generate', {}).then((j) => { toast(j.created.length ? t('{n} tâche(s) créée(s).', { n: j.created.length }) : t('Aucun emplacement sous son minimum.')); st.reload(); }).catch(fail);
  return (
    <>
      <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={gen}>{t('Créer les tâches nécessaires')}</button></div>
      <Seg tabs={[['open', t('À faire')], ['done', t('Faites')], ['cancelled', t('Annulées')]]} value={f} onChange={setF} />
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.tasks.length ? <Empty text={t('Aucune tâche de réapprovisionnement.')} /> : null}
          {j.tasks.map((x) => (
            <div className="line" key={x.id}>
              <span><b>{x.code}</b> {x.auto ? <Tag tone="mid">{t('automatique')}</Tag> : null} {x.huCode ? <Tag tone="good">{t('palette entière')}</Tag> : null}
                <small>{' ' + x.item + ' · ' + qty(x.status === 'done' ? x.doneQty : x.quantity) + ' ' + x.unit + ' · ' + (x.huCode ? x.huCode + ' · ' : '') + (x.from || '—') + ' → ' + (x.to || '—') + (x.doneBy ? ' · ' + x.doneBy : '')}</small></span>
              {x.status === 'open' ? (
                <span className="row">
                  <button className="btn small primary" type="button" onClick={() => modal(t('Réapprovisionner {to}', { to: x.to }), (close) => <RunTask task={x} close={close} done={() => { toast(t('Emplacement réapprovisionné.')); st.reload(); }} />)}>{t('Faire')}</button>
                  {can('manager') || x.auto ? <button className="link" type="button" onClick={() => oapi('POST', WMS + '/replenishment/tasks/' + x.id + '/cancel', {}).then(st.reload).catch(fail)}>{t('Annuler')}</button> : null}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}

function Suggestions() {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/replenishment/suggestions'), []);
  const gen = (ruleIds) => oapi('POST', WMS + '/replenishment/generate', { ruleIds }).then((j) => { toast(t('{n} tâche(s) créée(s).', { n: j.created.length })); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{(j) => (
      <div className="ws-card">
        {!j.suggestions.length ? <Empty text={t('Tous les emplacements de préparation sont au-dessus de leur minimum.')} /> : null}
        {j.suggestions.map((s) => (
          <div className="line" key={s.ruleId}>
            <span><b>{s.location}</b> <small>{s.item + ' · ' + t('{c} en place (min. {min}, max. {max}){o}', { c: qty(s.current), min: qty(s.min), max: qty(s.max), o: s.open ? ' · ' + t('{q} déjà en route', { q: qty(s.open) }) : '' })}</small>
              <small className="muted">{' ' + (s.sources.length ? s.sources.map((x) => (x.huCode ? x.huCode + ' ' : '') + x.from + ' × ' + qty(x.quantity)).join(', ') : t('aucun stock en rayonnage'))}{s.short ? ' · ' + t('il manque {q}', { q: qty(s.short) }) : ''}</small></span>
            {s.sources.length ? <button className="btn small primary" type="button" onClick={() => gen([s.ruleId])}>{t('Créer les tâches')}</button> : null}
          </div>
        ))}
      </div>
    )}</Loaded>
  );
}

function Rules() {
  const t = useT();
  const { oapi, modal, toast, fail, confirm, can } = useWs();
  const mgr = can('manager');
  const st = useLoad(() => oapi('GET', WMS + '/replenishment/rules'), []);
  const items = useItems();
  const locs = useLocations();
  const picking = locs.locations.filter((l) => l.kind === 'picking' && l.active);
  const add = () => modal(t('Nouvelle règle de réapprovisionnement'), (close) => (
    <Form submitText={t('Créer la règle')} fields={[
      { k: 'itemId', label: t('Article'), type: 'select', options: itemOptions(items.items, t('Choisir…')), required: true },
      { k: 'locationId', label: t('Emplacement de préparation'), type: 'select', options: [['', t('Choisir…')]].concat(picking.map((l) => [String(l.id), l.code + ' (' + l.warehouse + ')'])), required: true, hint: picking.length ? '' : t('Créez d\'abord un emplacement de type « Préparation ».') },
      { k: 'min', label: t('Minimum (on réapprovisionne en dessous)'), required: true },
      { k: 'max', label: t('Maximum (on remonte jusque-là)'), required: true },
    ]} onSubmit={(v) => oapi('POST', WMS + '/replenishment/rules', { itemId: Number(v.itemId), locationId: Number(v.locationId), min: v.min, max: v.max }).then(() => { close(); toast(t('Règle créée.')); st.reload(); })} />
  ));
  const edit = (r) => modal(t('Règle {loc} · {item}', { loc: r.location, item: r.item }), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'min', label: t('Minimum (on réapprovisionne en dessous)'), value: String(r.min), required: true }, { k: 'max', label: t('Maximum (on remonte jusque-là)'), value: String(r.max), required: true },
      { k: 'active', label: t('Active'), type: 'select', value: r.active ? '1' : '', options: [['1', t('Oui')], ['', t('Non')]] }]}
    onSubmit={(v) => oapi('PUT', WMS + '/replenishment/rules/' + r.id, { min: v.min, max: v.max, active: Boolean(v.active) }).then(() => { close(); st.reload(); })} />
  ));
  return (
    <>
      {mgr ? <div className="row wms-toolbar"><button className="btn primary small" type="button" onClick={add}>{t('Nouvelle règle')}</button></div> : null}
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.rules.length ? <Empty text={t('Aucune règle : fixez un minimum et un maximum pour vos emplacements de préparation.')} /> : null}
          {j.rules.map((r) => (
            <div className="line" key={r.id}>
              <span><b>{r.location}</b> {!r.active ? <Tag tone="mid">{t('inactive')}</Tag> : r.below ? <Tag tone="bad">{t('sous le minimum')}</Tag> : <Tag tone="good">{t('OK')}</Tag>}
                <small>{' ' + r.item + ' · ' + t('{c} en place (min. {min}, max. {max}){o}', { c: qty(r.current), min: qty(r.min), max: qty(r.max), o: r.open ? ' · ' + t('{q} déjà en route', { q: qty(r.open) }) : '' })}</small></span>
              {mgr ? <span className="row"><button className="btn small" type="button" onClick={() => edit(r)}>{t('Modifier')}</button><button className="link" type="button" onClick={() => confirm(t('Supprimer cette règle ?'), () => oapi('DELETE', WMS + '/replenishment/rules/' + r.id).then(st.reload).catch(fail))}>{t('Supprimer')}</button></span> : null}
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}

export default function Replenishment() {
  const t = useT();
  const [tab, setTab] = useState('tasks');
  return (
    <>
      <Seg tabs={[['tasks', t('Tâches')], ['suggest', t('Suggestions')], ['rules', t('Règles min / max')]]} value={tab} onChange={setTab} />
      {tab === 'tasks' ? <Tasks /> : tab === 'suggest' ? <Suggestions /> : <Rules />}
    </>
  );
}
