import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN } from '../w3/common.jsx';

/* Projets · planning : frise des tâches (début, fin, dépendances), décalage des tâches qui suivent un retard, fiabilité des données et prévision. */

const DAY = 86400000;
const dn = (d) => Math.round(Date.parse(d + 'T00:00:00Z') / DAY);
const PX = 22;

/** Liste des décalages proposés (avant / après), avec la raison. */
function ChangeList({ changes }) {
  const t = useT();
  const { dateFr } = useWs();
  return changes.map((c) => (
    <div className="line" key={c.id}>
      <span><b>{c.title}</b>{c.because ? <small>{' · ' + t('après « {name} »', { name: c.because })}</small> : null}</span>
      <small>{dateFr(c.fromEnd) + ' → ' + dateFr(c.toEnd) + ' (' + (c.days > 0 ? '+' : '') + t('{n} j', { n: c.days }) + ')'}</small>
    </div>
  ));
}

function ReplanModal({ id, close, done }) {
  const t = useT();
  const { oapi, toast, fail, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/projects/' + id + '/replan'), [id]);
  return (
    <Loaded state={st}>{(j) => (
      <div>
        {!j.changes.length ? <Empty text={t('Rien à décaler : les dates sont cohérentes.')} /> : (
          <>
            <p className="muted small">{t("Une tâche ne peut pas commencer avant la fin de celle dont elle dépend. Voici les dates qui changeraient (jours entiers, week-ends non retirés) :")}</p>
            <ChangeList changes={j.changes} />
            {j.forecastEnd ? <p className={j.lateDays ? 'small late' : 'small'}>{t('Fin prévue : {date}', { date: dateFr(j.forecastEnd) }) + (j.lateDays ? ' · ' + t("{n} jour(s) après l'échéance du projet", { n: j.lateDays }) : '')}</p> : null}
            <button className="btn primary small" type="button" onClick={() => oapi('POST', '/projects/' + id + '/replan', {}).then((r) => { toast(t('{n} tâche(s) décalée(s).', { n: r.applied })); close(); done(); }).catch(fail)}>{t('Décaler ces tâches')}</button>
          </>
        )}
      </div>
    )}
    </Loaded>
  );
}

function ShiftModal({ task, close, done }) {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const [prev, setPrev] = useState(null);
  const [days, setDays] = useState('');
  return (
    <div>
      <Form
        fields={[{ k: 'days', label: t('Décaler de combien de jours ? (négatif pour avancer)'), required: true, value: days, placeholder: '3' }]}
        submitText={t('Voir ce qui change')}
        onSubmit={(v) => oapi('POST', '/projects/tasks/' + task.id + '/shift', { days: v.days }).then((r) => { setDays(v.days); setPrev(r.changes); })}
      />
      {prev ? (
        <>
          <ChangeList changes={prev} />
          <button className="btn primary small" type="button" onClick={() => oapi('POST', '/projects/tasks/' + task.id + '/shift', { days, apply: true }).then(() => { toast(t('Dates mises à jour.')); close(); done(); }).catch(fail)}>{t('Appliquer')}</button>
        </>
      ) : null}
    </div>
  );
}

export function Planning({ id, rev }) {
  const t = useT();
  const { oapi, can, dateFr, modal } = useWs();
  const [v, setV] = useState(0);
  const st = useLoad(() => oapi('GET', '/projects/' + id + '/schedule'), [id, v, rev]);
  const again = () => setV((n) => n + 1);
  return (
    <div className="ws-card">
      <h2>{t('Planning du projet')}</h2>
      <Loaded state={st}>{(j) => {
        const items = j.tasks.filter((x) => x.start);
        if (!items.length) return <Empty text={t('Donnez une date aux tâches (et une estimation en heures) pour voir la frise.')} />;
        const from = dn(j.from) - 1; const days = dn(j.to) - from + 2;
        const x = (d) => (dn(d) - from) * PX;
        const marks = [];
        for (let i = 0; i < days; i += 7) marks.push(i);
        return (
          <>
            {j.forecast.conflicts ? (
              <p className="small late" role="alert">{t('{n} tâche(s) sont en conflit avec un retard.', { n: j.forecast.conflicts })}{' '}
                {can('manager') ? <button className="link" type="button" style={BTN} onClick={() => modal(t('Décaler les tâches qui suivent un retard'), (close) => <ReplanModal id={id} close={close} done={again} />, { wide: true })}>{t("Voir et décaler")}</button> : null}</p>
            ) : null}
            {j.forecast.endDate ? <p className={'small' + (j.forecast.lateDays ? ' late' : '')}>{t('Fin prévue : {date}', { date: dateFr(j.forecast.endDate) }) + (j.forecast.lateDays ? ' · ' + t("{n} jour(s) après l'échéance du projet", { n: j.forecast.lateDays }) : '')}</p> : null}
            <div className="gantt" role="img" aria-label={t('Frise du planning')}>
              <div className="gantt-in" style={{ width: days * PX + 190 }}>
                <div className="g-row g-head"><span className="g-name" />
                  <span className="g-track" style={{ width: days * PX }}>{marks.map((i) => <i key={i} style={{ left: i * PX }}>{dateFr(new Date((from + i) * DAY).toISOString().slice(0, 10)).slice(0, 5)}</i>)}</span></div>
                {items.map((tk) => (
                  <div className="g-row" key={tk.id}>
                    <span className="g-name" title={tk.title}>{tk.title}{tk.assignee ? <small>{' · ' + tk.assignee}</small> : null}</span>
                    <span className="g-track" style={{ width: days * PX }}>
                      <b className={'g-bar ' + (tk.status === 'done' ? 'done' : tk.late ? 'late' : tk.status === 'doing' ? 'doing' : 'todo') + (tk.needsShift ? ' shift' : '')} style={{ left: x(tk.start), width: Math.max((dn(tk.end) - dn(tk.start) + 1) * PX, 8) }}
                        title={dateFr(tk.start) + ' → ' + dateFr(tk.end)} />
                      {tk.needsShift ? <b className="g-bar ghost" style={{ left: x(tk.needsShift.toStart), width: Math.max((dn(tk.needsShift.toEnd) - dn(tk.needsShift.toStart) + 1) * PX, 8) }} title={t('Nouvelle date proposée : {date}', { date: dateFr(tk.needsShift.toEnd) })} /> : null}
                    </span>
                  </div>
                ))}
                <span className="g-line today" style={{ left: 190 + x(j.today) }} title={t("Aujourd'hui")} />
                {j.project.due ? <span className="g-line due" style={{ left: 190 + x(j.project.due) + PX }} title={t('Échéance du projet')} /> : null}
              </div>
            </div>
            <p className="muted small">{t("Barre pleine : la tâche. Barre pointillée : où elle serait décalée. Ligne verte : aujourd'hui. Ligne rouge : échéance du projet.")}</p>
            {can('manager') ? (
              <div className="row">
                {items.filter((tk) => tk.status !== 'done').slice(0, 30).map((tk) => (
                  <button className="btn small" type="button" key={tk.id} style={BTN} onClick={() => modal(tk.title, (close) => <ShiftModal task={tk} close={close} done={again} />)}>{t('Décaler « {name} »', { name: tk.title.length > 22 ? tk.title.slice(0, 21) + '…' : tk.title })}</button>
                ))}
              </div>
            ) : null}
          </>
        );
      }}
      </Loaded>
    </div>
  );
}

const LEVEL = { good: 'Bonne', medium: 'Moyenne', low: 'Faible' };
/** Fiabilité des données saisies, et prévision de fin et de coût (avec ses limites). */
export function Insight({ id, rev }) {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/projects/' + id + '/insight'), [id, rev]);
  return (
    <div className="ws-card">
      <h2>{t('Fiabilité des données et prévision')}</h2>
      <Loaded state={st}>{(j) => (
        <>
          <div className="kpis">
            <div className={'stat' + (j.quality.level === 'low' ? ' bad' : '')}><b>{j.quality.score + ' / 100'}</b><span>{t('Fiabilité') + ' : ' + t(LEVEL[j.quality.level])}</span></div>
            <div className={'stat' + (j.forecast.lateDays ? ' bad' : '')}><b>{j.forecast.endDate ? dateFr(j.forecast.endDate) : '—'}</b><span>{t('fin prévue') + (j.forecast.lateDays ? ' (+' + t('{n} j', { n: j.forecast.lateDays }) + ')' : '')}</span></div>
            {j.forecast.projectedCost !== undefined && j.forecast.projectedCost !== null ? <div className={'stat' + (j.forecast.overBudgetProjected ? ' bad' : '')}><b>{money(j.forecast.projectedCost)}</b><span>{t('coût prévu (temps restant compris)')}</span></div> : null}
            <div className="stat"><b>{j.forecast.remainingHours + ' h'}</b><span>{t('heures restantes estimées')}</span></div>
          </div>
          {j.quality.gaps.length ? (
            <>
              <p className="small"><b>{t('Pour une prévision plus sûre, il manque :')}</b></p>
              <ul className="small">{j.quality.gaps.map((g) => <li key={g.code}>{g.text}</li>)}</ul>
            </>
          ) : <p className="small">{t('Les données du projet sont complètes.')}</p>}
          <p className="muted small">{t("Ces prévisions sont des calculs à partir de ce qui est saisi : si les estimations sont fausses, la prévision l'est aussi. L'assistant en tient compte et le dit.")}</p>
          {j.forecast.notes.map((n, i) => <p className="muted small" key={i}>{n}</p>)}
        </>
      )}
      </Loaded>
    </div>
  );
}
