import { useWs } from '../../WsContext.jsx';
import { Empty, Form } from '../../ui.jsx';

export const LEAVE = { annual: 'Congé annuel', sick: 'Maladie', other: 'Autre' };

/** Fiche employé : création / modification. */
export function EmployeeForm({ employee, close, done }) {
  const { oapi, can, info } = useWs();
  const e = employee || {};
  const branches = info.branches;
  const f = [{ k: 'name', label: 'Nom', required: true, value: e.name }, { k: 'job', label: 'Poste', value: e.job }, { k: 'phone', label: 'Téléphone', value: e.phone }, { k: 'hiredAt', label: "Date d'embauche", type: 'date', value: e.hiredAt || '' }];
  if (can('admin')) f.push({ k: 'salary', label: 'Salaire mensuel (' + info.org.currency + ')', value: e.salary || '' });
  if (e.id) f.push({ k: 'status', label: 'Situation', type: 'select', options: [['active', 'En poste'], ['left', 'Parti']], value: e.status });
  else if (branches.length) f.push({ k: 'branchId', label: 'Antenne', type: 'select', options: [['', "Toute l'organisation"]].concat(branches.map((x) => [String(x.id), x.name])) });
  return (
    <Form
      fields={f}
      submitText="Enregistrer"
      onSubmit={(v) => {
        const p = { name: v.name, job: v.job, phone: v.phone, hiredAt: v.hiredAt || null };
        if (can('admin')) p.salary = v.salary;
        if (e.id) p.status = v.status; else if (v.branchId) p.branchId = v.branchId;
        return oapi(e.id ? 'PUT' : 'POST', '/hr/employees' + (e.id ? '/' + e.id : ''), p).then(() => { close(); done(); });
      }}
    />
  );
}

/** Demande de congé. */
export function LeaveForm({ employees, close, done }) {
  const { oapi } = useWs();
  const active = employees.filter((e) => e.status === 'active');
  if (!active.length) return <Empty text="Ajoutez d'abord un employé." />;
  return (
    <Form
      fields={[
        { k: 'employeeId', label: 'Employé', type: 'select', options: active.map((e) => [String(e.id), e.name]) },
        { k: 'kind', label: 'Type', type: 'select', options: Object.keys(LEAVE).map((k) => [k, LEAVE[k]]) },
        { k: 'start', label: 'Premier jour', type: 'date', required: true },
        { k: 'end', label: 'Dernier jour', type: 'date', required: true },
        { k: 'note', label: 'Précision', value: '' },
      ]}
      submitText="Enregistrer la demande"
      onSubmit={(v) => oapi('POST', '/hr/leaves', v).then(() => { close(); done(); })}
    />
  );
}

/** Horaire d'une personne pour un jour. */
export function ShiftForm({ employee, day, close, done }) {
  const { oapi } = useWs();
  return (
    <Form
      fields={[{ k: 'start', label: 'Début', type: 'time', value: '08:00', required: true }, { k: 'end', label: 'Fin', type: 'time', value: '16:00', required: true }, { k: 'note', label: 'Précision (facultatif)' }]}
      submitText="Ajouter"
      onSubmit={(v) => oapi('POST', '/hr/shifts', { employeeId: employee.id, day, start: v.start, end: v.end, note: v.note }).then(() => { close(); done(); })}
    />
  );
}
