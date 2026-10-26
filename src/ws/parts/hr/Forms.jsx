import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form } from '../../ui.jsx';

export const LEAVE = { annual: 'Congé annuel', sick: 'Maladie', other: 'Autre' };

/** Fiche employé : création / modification. */
export function EmployeeForm({ employee, close, done }) {
  const t = useT();
  const { oapi, can, info } = useWs();
  const e = employee || {};
  const branches = info.branches;
  const f = [{ k: 'name', label: t('Nom'), required: true, value: e.name }, { k: 'job', label: t('Poste'), value: e.job }, { k: 'phone', label: t('Téléphone'), value: e.phone }, { k: 'hiredAt', label: t("Date d'embauche"), type: 'date', value: e.hiredAt || '' }];
  if (can('admin')) f.push({ k: 'salary', label: t('Salaire mensuel ({currency})', { currency: info.org.currency }), value: e.salary || '' });
  if (e.id) f.push({ k: 'status', label: t('Situation'), type: 'select', options: [['active', t('En poste')], ['left', t('Parti')]], value: e.status });
  else if (branches.length) f.push({ k: 'branchId', label: t('Antenne'), type: 'select', options: [['', t("Toute l'organisation")]].concat(branches.map((x) => [String(x.id), x.name])) });
  return (
    <Form
      fields={f}
      submitText={t("Enregistrer")}
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
  const t = useT();
  const { oapi } = useWs();
  const active = employees.filter((e) => e.status === 'active');
  if (!active.length) return <Empty text={t("Ajoutez d'abord un employé.")} />;
  return (
    <Form
      fields={[
        { k: 'employeeId', label: t('Employé'), type: 'select', options: active.map((e) => [String(e.id), e.name]) },
        { k: 'kind', label: t('Type'), type: 'select', options: Object.keys(LEAVE).map((k) => [k, t(LEAVE[k])]) },
        { k: 'start', label: t('Premier jour'), type: 'date', required: true },
        { k: 'end', label: t('Dernier jour'), type: 'date', required: true },
        { k: 'note', label: t('Précision'), value: '' },
      ]}
      submitText={t("Enregistrer la demande")}
      onSubmit={(v) => oapi('POST', '/hr/leaves', v).then(() => { close(); done(); })}
    />
  );
}

/** Horaire d'une personne pour un jour. */
export function ShiftForm({ employee, day, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  return (
    <Form
      fields={[{ k: 'start', label: t('Début'), type: 'time', value: '08:00', required: true }, { k: 'end', label: t('Fin'), type: 'time', value: '16:00', required: true }, { k: 'note', label: t('Précision (facultatif)') }]}
      submitText={t("Ajouter")}
      onSubmit={(v) => oapi('POST', '/hr/shifts', { employeeId: employee.id, day, start: v.start, end: v.end, note: v.note }).then(() => { close(); done(); })}
    />
  );
}
