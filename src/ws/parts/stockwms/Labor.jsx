import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { Kpis, Seg, Tag, WMS, qty, pct, useDate } from './kit.jsx';
import { Columns } from './charts.jsx';

/* Productivité des magasiniers : chaque opération (prélèvement, rangement, emballage, chargement, réapprovisionnement, comptage,
   réception, déplacement) est notée avec qui et quand. Lignes / heure, unités / heure, temps par ligne et performance par rapport aux
   temps standards. Les chiffres par personne et le classement sont réservés aux responsables ; chacun voit les siens. */

const iso = (d) => d.toISOString().slice(0, 10);
const back = (n) => iso(new Date(Date.now() - n * 86400000));
function usePeriod() {
  const [p, setP] = useState('7');
  const range = p === '1' ? { from: back(0), to: back(0) } : { from: back(Number(p) - 1), to: back(0) };
  return { p, setP, qs: '?from=' + range.from + '&to=' + range.to };
}
function PeriodSeg({ per }) {
  const t = useT();
  return <Seg tabs={[['1', t("Aujourd'hui")], ['7', t('7 jours')], ['30', t('30 jours')], ['90', t('90 jours')]]} value={per.p} onChange={per.setP} />;
}
const perf = (v) => (v === null || v === undefined ? '—' : pct(v));
const num = (v) => (v === null || v === undefined ? '—' : qty(v));
const tone = (v) => (v === null ? '' : v >= 100 ? 'good' : v >= 80 ? 'mid' : 'bad');

function TaskTable({ rows }) {
  const t = useT();
  if (!rows.length) return <Empty text={t('Aucune opération sur la période.')} />;
  return (
    <div className="wms-table-wrap">
      <table className="wms-table">
        <thead><tr><th scope="col">{t('Tâche')}</th><th scope="col">{t('Lignes')}</th><th scope="col">{t('Unités')}</th><th scope="col">{t('Heures')}</th><th scope="col">{t('Temps par ligne')}</th><th scope="col">{t('Standard')}</th><th scope="col">{t('Performance')}</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.task}><th scope="row">{t(r.label)}</th><td>{qty(r.lines)}</td><td>{qty(r.units)}</td><td>{qty(r.hours)}</td><td>{num(r.secondsPerLine) + ' s'}</td><td>{qty(r.standard) + ' s'}</td><td><Tag tone={tone(r.performance)}>{perf(r.performance)}</Tag></td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
function Totals({ x }) {
  const t = useT();
  return <Kpis list={[
    { label: t('Lignes'), value: qty(x.lines) }, { label: t('Unités'), value: qty(x.units) }, { label: t('Heures comptées'), value: qty(x.hours) },
    { label: t('Lignes / heure'), value: num(x.linesPerHour) }, { label: t('Unités / heure'), value: num(x.unitsPerHour) }, { label: t('Performance'), value: perf(x.performance), bad: x.performance !== null && x.performance < 80 },
  ]} />;
}
function ByDayChart({ days }) {
  const t = useT();
  const fmt = useDate();
  if (days.length < 2) return null;
  return <Columns title={t('Lignes par jour')} unit={t('lignes')} data={days.map((d, i) => ({ label: fmt(d.day), tick: days.length <= 10 || i % Math.ceil(days.length / 8) === 0 ? d.day.slice(8, 10) + '/' + d.day.slice(5, 7) : '', value: d.lines }))} />;
}

function Summary() {
  const t = useT();
  const { oapi } = useWs();
  const per = usePeriod();
  const st = useLoad(() => oapi('GET', WMS + '/labor/summary' + per.qs), [per.qs]);
  return (
    <>
      <PeriodSeg per={per} />
      <Loaded state={st}>{(s) => (
        <>
          <Totals x={s.totals} />
          <div className="ws-card"><h3>{t('Par type de tâche')}</h3><TaskTable rows={s.byTask} /></div>
          <div className="ws-card"><ByDayChart days={s.byDay} />{s.byHour ? <Columns title={t('Lignes par heure (UTC)')} unit={t('lignes')} data={s.byHour.map((h) => ({ label: String(h.hour).padStart(2, '0') + ' h', tick: h.hour % 3 === 0 ? String(h.hour) : '', value: h.lines }))} /> : null}</div>
          <div className="ws-card">
            <h3>{t('Par personne')}</h3>
            {!s.byPerson.length ? <Empty text={t('Aucune opération sur la période.')} /> : null}
            {s.byPerson.map((p) => (
              <details className="wms-person" key={p.userId}>
                <summary><b>{p.name}</b> <Tag tone={tone(p.performance)}>{perf(p.performance)}</Tag> <small className="muted">{' ' + t('{l} lignes · {h} h · {lph} lignes/h · {d} jour(s)', { l: qty(p.lines), h: qty(p.hours), lph: num(p.linesPerHour), d: p.days })}</small></summary>
                <div className="wms-table-wrap"><table className="wms-table">
                  <thead><tr><th scope="col">{t('Jour')}</th><th scope="col">{t('Lignes')}</th><th scope="col">{t('Unités')}</th><th scope="col">{t('Heures')}</th><th scope="col">{t('Lignes / heure')}</th><th scope="col">{t('Performance')}</th></tr></thead>
                  <tbody>{p.byDay.map((d) => <tr key={d.day}><th scope="row">{d.day}</th><td>{qty(d.lines)}</td><td>{qty(d.units)}</td><td>{qty(d.hours)}</td><td>{num(d.linesPerHour)}</td><td>{perf(d.performance)}</td></tr>)}</tbody>
                </table></div>
              </details>
            ))}
          </div>
        </>
      )}</Loaded>
    </>
  );
}

function Leaderboard() {
  const t = useT();
  const { oapi } = useWs();
  const per = usePeriod();
  const [anon, setAnon] = useState(false);
  const st = useLoad(() => oapi('GET', WMS + '/labor/leaderboard' + per.qs + (anon ? '&anonymous=1' : '')), [per.qs, anon]);
  return (
    <>
      <PeriodSeg per={per} />
      <div className="row wms-toolbar"><label className="row wms-check"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> <span>{t('Masquer les noms (affichage en équipe)')}</span></label></div>
      <Loaded state={st}>{(j) => (
        <div className="ws-card">
          <p className="muted small">{t('Classement par performance (temps standard ÷ temps réel). Seules les personnes ayant fait au moins {n} lignes sur la période y figurent.', { n: j.minLines })}{j.hidden ? ' ' + t('{n} personne(s) non classée(s).', { n: j.hidden }) : ''}</p>
          {!j.ranking.length ? <Empty text={t('Pas encore assez de données pour un classement.')} /> : null}
          {j.ranking.map((p) => (
            <div className="line" key={p.rank}>
              <span><b>{p.rank + '. ' + p.name}</b> <small>{' ' + t('{l} lignes · {lph} lignes/h · {uph} unités/h', { l: qty(p.lines), lph: num(p.linesPerHour), uph: num(p.unitsPerHour) })}</small></span>
              <Tag tone={tone(p.performance)}>{perf(p.performance)}</Tag>
            </div>
          ))}
        </div>
      )}</Loaded>
    </>
  );
}

function Standards() {
  const t = useT();
  const { oapi, toast } = useWs();
  const st = useLoad(() => oapi('GET', WMS + '/labor/standards'), []);
  return (
    <Loaded state={st}>{(j) => (
      <div className="ws-card">
        <h3>{t('Temps standards (secondes par ligne)')}</h3>
        <p className="muted small">{t("Durée d'une opération : le temps écoulé depuis l'opération précédente de la même personne, si l'écart ne dépasse pas le seuil d'inactivité ; sinon (première opération, reprise après une pause) le temps standard.")}</p>
        <Form submitText={t('Enregistrer les standards')} fields={[
          ...Object.entries(j.tasks).map(([k, label]) => ({ k, label: t(label), value: String(j.standards[k]), hint: t('Par défaut : {n} s', { n: j.defaults[k] }) })),
          { k: '_idle', label: t("Seuil d'inactivité (minutes)"), value: String(j.idleMinutes) },
          { k: '_min', label: t('Lignes minimum pour figurer au classement'), value: String(j.minLines) },
        ]} onSubmit={(v) => oapi('PUT', WMS + '/labor/standards', { standards: Object.fromEntries(Object.keys(j.tasks).map((k) => [k, v[k]])), idleMinutes: v._idle, minLines: v._min }).then(() => { toast(t('Standards enregistrés.')); st.reload(); })} />
      </div>
    )}</Loaded>
  );
}

function Mine() {
  const t = useT();
  const { oapi } = useWs();
  const per = usePeriod();
  const st = useLoad(() => oapi('GET', WMS + '/labor/me' + per.qs), [per.qs]);
  return (
    <>
      <PeriodSeg per={per} />
      <Loaded state={st}>{(s) => (
        <>
          <Totals x={s.totals} />
          <div className="ws-card"><h3>{t('Mes opérations par type')}</h3><TaskTable rows={s.byTask} /></div>
          <div className="ws-card"><ByDayChart days={s.byDay} />{s.byHour ? <Columns title={t('Lignes par heure (UTC)')} unit={t('lignes')} data={s.byHour.map((h) => ({ label: String(h.hour).padStart(2, '0') + ' h', tick: h.hour % 3 === 0 ? String(h.hour) : '', value: h.lines }))} /> : null}</div>
          <p className="muted small">{t('Ces chiffres ne sont visibles que de vous et de vos responsables.')}</p>
        </>
      )}</Loaded>
    </>
  );
}

export default function Labor() {
  const t = useT();
  const { can } = useWs();
  const mgr = can('manager');
  const [tab, setTab] = useState(mgr ? 'summary' : 'mine');
  const tabs = mgr ? [['summary', t('Synthèse')], ['ranking', t('Classement')], ['standards', t('Temps standards')], ['mine', t('Mes chiffres')]] : [['mine', t('Mes chiffres')]];
  return (
    <>
      <Seg tabs={tabs} value={tab} onChange={setTab} />
      {!mgr || tab === 'mine' ? <Mine /> : tab === 'ranking' ? <Leaderboard /> : tab === 'standards' ? <Standards /> : <Summary />}
    </>
  );
}
