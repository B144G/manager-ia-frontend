import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Seg, Tag, WMS, qty, pct, useItems } from './kit.jsx';
import Scanner from './Scanner.jsx';

/* Optimisation des emplacements : les articles les plus prélevés près du quai, les articles lourds en bas. L'analyse simule le gain
   de parcours ; les propositions deviennent des tâches de déplacement exécutées par scan. */

const meters = (n) => qty(n) + ' m';

function Analysis() {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const [days, setDays] = useState('');
  const st = useLoad(() => oapi('GET', WMS + '/slotting/analysis' + (days ? '?days=' + days : '')), [days]);
  const create = (itemIds) => oapi('POST', WMS + '/slotting/tasks', { days: days || undefined, itemIds }).then((j) => { toast(t('{n} tâche(s) de déplacement créée(s).', { n: j.created.length })); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{(a) => (
      <>
        <div className="row wms-toolbar wms-pilot-top">
          <label className="fld wms-inline"><span>{t('Période analysée')}</span>
            <select style={{ fontSize: 16 }} value={days} onChange={(e) => setDays(e.target.value)}>
              {[['', t('Réglage ({n} jours)', { n: a.days })], ['30', t('30 jours')], ['90', t('90 jours')], ['180', t('180 jours')], ['365', t('1 an')]].map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
            </select></label>
          {a.proposals.length ? <button className="btn primary" type="button" onClick={() => create()}>{t('Créer les {n} tâches', { n: a.proposals.length })}</button> : null}
        </div>
        <Kpis list={[
          { label: t('Parcours actuel (aller-retour)'), value: meters(a.totals.currentTravel) },
          { label: t('Parcours proposé'), value: meters(a.totals.proposedTravel) },
          { label: t('Gain simulé'), value: meters(a.totals.gain) + ' · ' + pct(a.totals.gainPct) },
          { label: t('Déplacements proposés'), value: qty(a.totals.moves) },
        ]} />
        <p className="muted small">{t('Parcours = visites × 2 × distance au quai, sur les {d} derniers jours ({h} lignes prélevées, {l} emplacements avec une distance).', { d: a.days, h: qty(a.totals.hits), l: qty(a.totals.locations) })}</p>
        <div className="ws-card">
          <h3>{t('Propositions')}</h3>
          {!a.proposals.length ? <Empty text={t('Rien à proposer : les articles les plus prélevés sont déjà au plus près du quai.')} /> : null}
          {a.proposals.map((p) => (
            <div className="line" key={p.itemId}>
              <span><b>{p.name}</b> <Tag tone={p.velocity === 'A' ? 'good' : p.velocity === 'B' ? 'mid' : ''}>{t('classe {c}', { c: p.velocity })}</Tag> {p.reason === 'heavy' ? <Tag tone="bad">{t('lourd : à descendre')}</Tag> : null}
                <small>{' ' + p.from + ' (' + meters(p.fromDistance) + ') → ' + p.to + ' (' + meters(p.toDistance) + ') · ' + t('{n} visites', { n: qty(p.hits) }) + ' · ' + qty(p.quantity) + ' ' + p.unit}</small>
                <small className={p.gain >= 0 ? 'ok' : 'muted'}>{' · ' + (p.gain >= 0 ? t('gain {g}', { g: meters(p.gain) }) : t('libère la place ({g})', { g: meters(p.gain) }))}</small>
                {p.onPallet ? <small className="muted">{' · ' + t('une partie est sur palette')}</small> : null}</span>
              <button className="btn small" type="button" onClick={() => create([p.itemId])}>{t('Créer la tâche')}</button>
            </div>
          ))}
        </div>
        <div className="ws-card">
          <h3>{t('Rotation des articles')}</h3>
          {!a.items.length ? <Empty text={t('Aucun stock dans des emplacements avec une distance.')} /> : null}
          {a.items.map((x) => (
            <div className="line" key={x.itemId}>
              <span><b>{x.name}</b> {x.velocity !== '-' ? <Tag tone={x.velocity === 'A' ? 'good' : x.velocity === 'B' ? 'mid' : ''}>{x.velocity}</Tag> : null} {x.heavy ? <Tag tone="mid">{t('lourd')}</Tag> : null} {x.pending ? <Tag tone="mid">{t('déplacement en cours')}</Tag> : null}
                <small>{' ' + x.location + ' · ' + meters(x.distance) + (x.level !== null ? ' · ' + t('niveau {n}', { n: x.level }) : '') + ' · ' + t('{n} visites', { n: qty(x.hits) }) + ' · ' + qty(x.units) + ' ' + x.unit}</small></span>
            </div>
          ))}
        </div>
      </>
    )}</Loaded>
  );
}

function RunTask({ task, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const [from, setFrom] = useState(''); const [item, setItem] = useState(''); const [err, setErr] = useState('');
  const send = (to) => {
    setErr('');
    oapi('POST', WMS + '/slotting/tasks/' + task.id + '/confirm', { fromLocationCode: from || undefined, itemCode: item || undefined, toLocationCode: to || undefined }).then(() => { close(); done(); }).catch((e) => setErr(tsrv(e.message)));
  };
  return (
    <div className="wms-run">
      <p><b>{task.item}</b> · {qty(task.quantity) + ' ' + task.unit}</p>
      <p className="muted small">{t('Prendre {q} {u} en {from}, les déposer en {to}.', { q: qty(task.quantity), u: task.unit, from: task.from, to: task.to })}</p>
      {!from ? <Scanner autoFocus label={t("Scanner l'emplacement de départ")} onCode={setFrom} />
        : !item ? <><p className="small ok">{t('Lu : {c}', { c: from })}</p><Scanner autoFocus label={t("Scanner l'article")} onCode={setItem} /></>
          : <><p className="small ok">{t('Lu : {c}', { c: from + ' · ' + item })}</p><Scanner autoFocus label={t("Scanner l'emplacement d'arrivée")} onCode={send} /></>}
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      <div className="row"><button className="btn" type="button" onClick={() => send(undefined)}>{t('Confirmer sans scanner')}</button></div>
    </div>
  );
}

function Tasks() {
  const t = useT();
  const { oapi, modal, toast, fail, can } = useWs();
  const [f, setF] = useState('open');
  const st = useLoad(() => oapi('GET', WMS + '/slotting/tasks?status=' + f), [f]);
  return (
    <>
      <Seg tabs={[['open', t('À faire')], ['done', t('Faites')], ['cancelled', t('Annulées')]]} value={f} onChange={setF} />
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          {!j.tasks.length ? <Empty text={t("Aucune tâche d'optimisation.")} /> : null}
          {j.tasks.map((x) => (
            <div className="line" key={x.id}>
              <span><b>{x.code}</b> {x.reason === 'heavy' ? <Tag tone="bad">{t('article lourd')}</Tag> : null}
                <small>{' ' + x.item + ' · ' + qty(x.status === 'done' ? x.doneQty : x.quantity) + ' ' + x.unit + ' · ' + (x.from || '—') + ' → ' + (x.to || '—') + (x.gain > 0 ? ' · ' + t('gain {g}', { g: meters(x.gain) }) : '') + (x.doneBy ? ' · ' + x.doneBy : '')}</small></span>
              {x.status === 'open' ? (
                <span className="row">
                  <button className="btn small primary" type="button" onClick={() => modal(t('Déplacer vers {to}', { to: x.to }), (close) => <RunTask task={x} close={close} done={() => { toast(t('Article déplacé.')); st.reload(); }} />)}>{t('Faire')}</button>
                  {can('manager') ? <button className="link" type="button" onClick={() => oapi('POST', WMS + '/slotting/tasks/' + x.id + '/cancel', {}).then(st.reload).catch(fail)}>{t('Annuler')}</button> : null}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}

function Settings() {
  const t = useT();
  const { oapi, toast, modal } = useWs();
  const cfg = useLoad(() => oapi('GET', WMS + '/slotting/config'), []);
  const locs = useLoad(() => oapi('GET', WMS + '/slotting/locations'), []);
  const items = useItems();
  const editLoc = (l) => modal(t('Emplacement {c}', { c: l.code }), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'distance', label: t('Distance au quai (m), vide = calculée'), value: l.manualDistance === null ? '' : String(l.manualDistance) },
      { k: 'level', label: t('Niveau (0 = sol), vide = inconnu'), value: l.level === null ? '' : String(l.level) },
    ]} onSubmit={(v) => oapi('PUT', WMS + '/slotting/locations/' + l.id, { distance: v.distance, level: v.level }).then(() => { close(); locs.reload(); })} />
  ));
  const weight = () => modal(t("Poids d'un article"), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'itemId', label: t('Article'), type: 'select', options: [['', t('Choisir…')]].concat(items.items.map((i) => [String(i.id), i.name])), required: true },
      { k: 'weightKg', label: t('Poids unitaire (kg)') },
    ]} onSubmit={(v) => oapi('PUT', WMS + '/slotting/items/' + v.itemId, { weightKg: v.weightKg }).then(() => { close(); toast(t('Poids enregistré.')); })} />
  ));
  return (
    <>
      <Loaded state={cfg}>{(j) => (
        <div className="ws-card">
          <h3>{t('Calcul des distances et règles')}</h3>
          <Form submitText={t('Enregistrer les réglages')} fields={[
            { k: 'slotDays', label: t('Période analysée (jours)'), value: String(j.config.slotDays) },
            { k: 'aislePitch', label: t('Distance entre deux allées (m)'), value: String(j.config.aislePitch), hint: t("Distance d'une allée = son rang × cette valeur, sauf si elle est saisie ci-dessous.") },
            { k: 'rackPitch', label: t('Distance entre deux rayons (m)'), value: String(j.config.rackPitch) },
            { k: 'aisles', label: t('Distances par allée (ex. A=8, B=14)'), value: Object.entries(j.config.aisleDistances).map(([a, d]) => a + '=' + d).join(', ') },
            { k: 'heavyKg', label: t('Article lourd à partir de (kg)'), value: String(j.config.heavyKg) },
            { k: 'heavyMaxLevel', label: t('Niveau le plus haut pour un article lourd'), value: String(j.config.heavyMaxLevel) },
          ]} onSubmit={(v) => {
            const aisleDistances = {};
            for (const part of String(v.aisles || '').split(/[,;]+/)) { const [a, d] = part.split('='); if (a && a.trim() && d !== undefined && d.trim()) aisleDistances[a.trim()] = d.trim(); }
            return oapi('PUT', WMS + '/slotting/config', { slotDays: v.slotDays, aislePitch: v.aislePitch, rackPitch: v.rackPitch, heavyKg: v.heavyKg, heavyMaxLevel: v.heavyMaxLevel, aisleDistances }).then(() => { toast(t('Réglages enregistrés.')); cfg.reload(); locs.reload(); });
          }} />
        </div>
      )}</Loaded>
      <div className="row wms-toolbar"><button className="btn small" type="button" onClick={weight}>{t("Poids d'un article")}</button></div>
      <Loaded state={locs}>{(j) => (
        <div className="ws-card">
          <h3>{t('Emplacements : distance et niveau ({w})', { w: j.warehouse.name })}</h3>
          {j.locations.map((l) => (
            <div className="line" key={l.id}>
              <span><b>{l.code}</b> {l.source === 'manual' ? <Tag tone="mid">{t('saisie')}</Tag> : null}
                <small>{' ' + (l.distance === null ? t('pas de distance') : meters(l.distance)) + (l.level !== null ? ' · ' + t('niveau {n}', { n: l.level }) : '') + (l.zone ? ' · ' + l.zone : '')}</small></span>
              <button className="btn small" type="button" onClick={() => editLoc(l)}>{t('Modifier')}</button>
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}

export default function Slotting() {
  const t = useT();
  const { can } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState(mgr ? 'analysis' : 'tasks');
  const tabs = mgr ? [['analysis', t('Analyse et gain')], ['tasks', t('Tâches de déplacement')], ['settings', t('Distances et règles')]] : [['tasks', t('Tâches de déplacement')]];
  return (
    <>
      <Seg tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'analysis' && mgr ? <Analysis /> : tab === 'settings' && mgr ? <Settings /> : <Tasks />}
    </>
  );
}
