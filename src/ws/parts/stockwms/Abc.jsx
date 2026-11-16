import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { CsvButton, Kpis, Seg, Tag, WMS, pct, qty, useDate } from './kit.jsx';

/* Classement ABC par valeur de consommation et inventaires tournants planifiés par classe. */
const TONE = { A: 'bad', B: 'mid', C: 'good' };

export default function Abc() {
  const t = useT();
  const { oapi, can, money, modal, fail, toast } = useWs();
  const date = useDate();
  const [tab, setTab] = useState('abc');
  const abc = useLoad(() => oapi('GET', WMS + '/abc'), []);
  const plan = useLoad(() => oapi('GET', WMS + '/cycle-counts/plan'), []);
  const varc = useLoad(() => oapi('GET', WMS + '/cycle-counts/variance'), []);
  const [cls, setCls] = useState('');
  const newCount = (classes) => oapi('POST', WMS + '/cycle-counts', { classes }).then((j) => { toast(t('Inventaire tournant ouvert : {n} article(s). Comptez-les dans « Inventaire ».', { n: j.items })); plan.reload(); }).catch(fail);
  const settings = () => oapi('GET', WMS + '/settings').then((j) => modal(t('Réglages du classement'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'abcA', label: t('Classe A : jusqu\'à (% de la valeur consommée)'), value: j.settings.abcA }, { k: 'abcB', label: t('Classe B : jusqu\'à (%)'), value: j.settings.abcB }, { k: 'abcDays', label: t('Période de calcul (jours)'), value: j.settings.abcDays },
      { k: 'cycleA', label: t('Compter la classe A tous les (jours)'), value: j.settings.cycleA }, { k: 'cycleB', label: t('Compter la classe B tous les (jours)'), value: j.settings.cycleB }, { k: 'cycleC', label: t('Compter la classe C tous les (jours)'), value: j.settings.cycleC }]}
    onSubmit={(v) => oapi('PUT', WMS + '/settings', v).then(() => { close(); abc.reload(); plan.reload(); toast(t('Réglages enregistrés.')); })} />
  ))).catch(fail);
  return (
    <>
      <div className="row wms-toolbar">{can('admin') ? <button className="btn small" type="button" onClick={settings}>{t('Réglages')}</button> : null}<CsvButton path="/reports/rotation" name="rotation-stock" /></div>
      <Seg tabs={[['abc', t('Classement ABC')], ['plan', t('Inventaires tournants')], ['gap', t('Écarts valorisés')]]} value={tab} onChange={setTab} />
      {tab === 'abc' ? (
        <Loaded state={abc}>{(j) => (
          <>
            <p className="muted small">{t("Valeur consommée sur {n} jours (sorties × coût moyen). A = les premiers {a} % de la valeur, B = jusqu'à {b} %, C = le reste.", { n: j.days, a: j.thresholds.a, b: j.thresholds.b })}</p>
            <Kpis list={j.classes.map((c) => ({ label: t('classe {c} : {n} article(s), {s} de la consommation', { c: c.class, n: c.items, s: pct(c.share) }), value: money(c.stockValue) }))} />
            <div className="ws-card">
              <div className="row" style={{ marginBottom: 8 }}>{['', 'A', 'B', 'C'].map((c) => <button key={c} type="button" className={'tab' + (cls === c ? ' on' : '')} onClick={() => setCls(c)}>{c || t('Toutes')}</button>)}</div>
              {!j.items.length ? <Empty text={t('Aucun article.')} /> : null}
              {j.items.filter((x) => !cls || x.class === cls).map((x) => (
                <div className="line" key={x.itemId}>
                  <span><b>{x.rank + '. ' + x.name}</b> <Tag tone={TONE[x.class]}>{x.class}</Tag>{x.noMovement ? <Tag tone="mid">{t('sans mouvement')}</Tag> : null}
                    <small>{' ' + t('{q} sortis', { q: qty(x.consumedQty) }) + ' · ' + pct(x.share) + ' · ' + t('cumul {p}', { p: pct(x.cumShare) })}</small></span>
                  <span><b>{money(x.consumption)}</b><small>{' ' + t('stock {v}', { v: money(x.stockValue) })}</small></span>
                </div>
              ))}
            </div>
          </>
        )}
        </Loaded>
      ) : null}
      {tab === 'plan' ? (
        <Loaded state={plan}>{(j) => (
          <>
            <p className="muted small">{t("Chaque classe a sa fréquence de comptage. Un inventaire tournant est un inventaire normal limité aux articles à compter : il est soumis puis validé par une autre personne.")}</p>
            <div className="kpis wms-kpis">{j.classes.map((c) => (
              <div className={'stat' + (c.due ? ' bad' : '')} key={c.class}><b>{c.due + ' / ' + c.items}</b><span>{t('classe {c} : à compter (tous les {n} jours)', { c: c.class, n: c.everyDays })}</span>
                {can('manager') && c.due ? <button className="btn small" type="button" onClick={() => newCount([c.class])}>{t('Ouvrir le comptage')}</button> : null}</div>
            ))}</div>
            <div className="ws-card">
              <h2>{t('À compter maintenant')}</h2>
              {!j.dueItems.length ? <Empty text={t('Tout est à jour.')} /> : null}
              {j.dueItems.slice(0, 60).map((x) => <div className="line" key={x.itemId}><span><b>{x.name}</b> <Tag tone={TONE[x.class]}>{x.class}</Tag><small>{' ' + (x.lastCounted ? t('compté le {d}', { d: date(x.lastCounted) }) : t('jamais compté'))}</small></span><small>{money(x.stockValue)}</small></div>)}
              {j.upcoming.length ? <><h3>{t('Prochainement')}</h3>{j.upcoming.slice(0, 10).map((x) => <div className="line" key={x.itemId}><span><b>{x.name}</b> <Tag tone={TONE[x.class]}>{x.class}</Tag></span><small>{t('à compter le {d}', { d: date(x.dueOn) })}</small></div>)}</> : null}
            </div>
          </>
        )}
        </Loaded>
      ) : null}
      {tab === 'gap' ? (
        <Loaded state={varc}>{(j) => (
          <>
            <Kpis list={[...j.classes.map((c) => ({ label: t('classe {c} : précision {p}', { c: c.class, p: c.accuracy === null ? '—' : pct(c.accuracy) }), value: money(c.netValue), bad: c.netValue < 0 })), { label: t('écart net valorisé'), value: money(j.netValue), bad: j.netValue < 0 }]} />
            <div className="ws-card">
              <h2>{t('Écarts constatés')}</h2>
              {!j.gaps.length ? <Empty text={t('Aucun écart sur la période.')} /> : null}
              {j.gaps.map((g, i) => <div className="line" key={i}><span><b>{g.name}</b> <Tag tone={TONE[g.class]}>{g.class}</Tag><small>{' ' + t('attendu {a}, compté {b}', { a: qty(g.expected), b: qty(g.counted) }) + ' · ' + date(g.at.slice(0, 10))}</small></span><b className={g.gapValue < 0 ? 'late' : 'ok'}>{(g.gap > 0 ? '+' : '') + qty(g.gap) + ' · ' + money(g.gapValue)}</b></div>)}
            </div>
          </>
        )}
        </Loaded>
      ) : null}
    </>
  );
}
