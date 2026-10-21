import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { ShiftForm } from './Forms.jsx';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

/** Onglet « Planning » : semaine (lundi → dimanche), horaires et congés acceptés. */
export default function Plan({ week, setWeek, ver }) {
  const { oapi, dateFr, modal, confirm, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/hr/planning' + (week ? '?week=' + week : '')), [week, ver]);
  const reload = st.reload;
  const addShift = (e, day) => modal('Horaire de ' + e.name + ' · ' + dateFr(day), (close) => <ShiftForm employee={e} day={day} close={close} done={reload} />);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <div className="ws-card">
          <div className="row plan-nav">
            <button className="btn small" type="button" onClick={() => setWeek(addDays(j.start, -7))}>← Semaine précédente</button>
            <b>{'Du ' + dateFr(j.start) + ' au ' + dateFr(j.end)}</b>
            <button className="btn small" type="button" onClick={() => setWeek(addDays(j.start, 7))}>Semaine suivante →</button>
          </div>
          {!j.employees.length ? <Empty text="Ajoutez des employés pour construire le planning." /> : (
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
        {j.employees.length ? <p className="muted small">« + » ajoute un horaire. Un horaire existant se supprime en cliquant dessus. Impossible de planifier une personne en congé accepté.</p> : null}
      </>
    )}
    </Loaded>
  );
}

function PlanRow({ e, j, addShift, confirm, oapi, fail, reload }) {
  const cells = [];
  for (let k = 0; k < 7; k++) {
    const day = addDays(j.start, k);
    const off = j.leaves.some((l) => l.employeeId === e.id && l.start <= day && l.end >= day);
    cells.push(
      <div className="pc" key={day}>
        {off ? <span className="pill mid">Congé</span> : null}
        {j.shifts.filter((s) => s.employeeId === e.id && s.day === day).map((s) => (
          <button className="shift" type="button" title="Supprimer cet horaire" key={s.id} onClick={() => confirm("Supprimer l'horaire de " + e.name + ' (' + s.start + '–' + s.end + ') ?', () => { oapi('DELETE', '/hr/shifts/' + s.id).then(reload).catch(fail); })}>{s.start + '–' + s.end}</button>
        ))}
        {!off ? <button className="shift add" type="button" aria-label={'Ajouter un horaire pour ' + e.name} onClick={() => addShift(e, day)}>+</button> : null}
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
