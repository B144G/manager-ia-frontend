import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { ShiftForm } from './Forms.jsx';

const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

/** Onglet « Planning » : semaine (lundi → dimanche), horaires et congés acceptés. */
export default function Plan({ week, setWeek, ver }) {
  const t = useT();
  const DAYS = [t('Lun'), t('Mar'), t('Mer'), t('Jeu'), t('Ven'), t('Sam'), t('Dim')];
  const { oapi, dateFr, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/hr/planning' + (week ? '?week=' + week : '')), [week, ver]);
  const reload = st.reload;
  const addShift = (e, day) => modal(t('Horaire de {name} · {date}', { name: e.name, date: dateFr(day) }), (close) => <ShiftForm employee={e} day={day} close={close} done={reload} />);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <div className="ws-card">
          <div className="row plan-nav">
            <button className="btn small" type="button" onClick={() => setWeek(addDays(j.start, -7))}>{t('← Semaine précédente')}</button>
            <b>{t('Du {start} au {end}', { start: dateFr(j.start), end: dateFr(j.end) })}</b>
            <button className="btn small" type="button" onClick={() => setWeek(addDays(j.start, 7))}>{t('Semaine suivante →')}</button>
          </div>
          {!j.employees.length ? <Empty text={t("Ajoutez des employés pour construire le planning.")} /> : (
            <div className="plan-wrap">
              <div className="plan">
                <div className="pc ph" />
                {DAYS.map((d, i) => <div className="pc ph" key={d}>{d + ' ' + addDays(j.start, i).slice(8)}</div>)}
                {j.employees.map((e) => (
                  <PlanRow key={e.id} e={e} j={j} addShift={addShift} confirm={confirm} oapi={oapi} fail={fail} reload={reload} />
                ))}
              </div>
            </div>
          )}
        </div>
        {j.employees.length ? <p className="muted small">{t('« + » ajoute un horaire. Un horaire existant se supprime en cliquant dessus. Impossible de planifier une personne en congé accepté.')}</p> : null}
      </>
    )}
    </Loaded>
  );
}

function PlanRow({ e, j, addShift, confirm, oapi, fail, reload }) {
  const t = useT();
  const cells = [];
  for (let k = 0; k < 7; k++) {
    const day = addDays(j.start, k);
    const off = j.leaves.some((l) => l.employeeId === e.id && l.start <= day && l.end >= day);
    cells.push(
      <div className="pc" key={day}>
        {off ? <span className="pill mid">{t('Congé')}</span> : null}
        {j.shifts.filter((s) => s.employeeId === e.id && s.day === day).map((s) => (
          <button className="shift" type="button" title={t("Supprimer cet horaire")} key={s.id} onClick={() => confirm(t("Supprimer l'horaire de {name} ({start}–{end}) ?", { name: e.name, start: s.start, end: s.end }), () => { oapi('DELETE', '/hr/shifts/' + s.id).then(reload).catch(fail); })}>{s.start + '–' + s.end}</button>
        ))}
        {!off ? <button className="shift add" type="button" aria-label={t('Ajouter un horaire pour {name}', { name: e.name })} onClick={() => addShift(e, day)}>+</button> : null}
      </div>,
    );
  }
  return (
    <>
      <div className="pc pn"><b>{e.name}</b>{e.job ? <small>{e.job}</small> : null}</div>
      {cells}
    </>
  );
}
