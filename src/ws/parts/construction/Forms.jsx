/* Formulaires du module Chantiers. */
import { useWs } from '../../WsContext.jsx';
import { Form } from '../../ui.jsx';
import { CATS, KINDS, STATUS } from './common.jsx';

const save = (oapi, method, path, body, close, done) => oapi(method, '/construction' + path, body).then((r) => { close(); done(r); });

export function SiteForm({ site, members, close, done }) {
  const { oapi, info } = useWs();
  const s = site || {};
  const cur = info.org.currency;
  const f = [
    { k: 'name', label: 'Nom du chantier', required: true, value: s.name },
    { k: 'client', label: 'Client', value: s.client },
    { k: 'location', label: 'Lieu', value: s.location },
    { k: 'foremanId', label: 'Chef de chantier', type: 'select', options: [['', 'Non défini']].concat(members.map((m) => [String(m.userId), m.name])), value: s.foremanId ? String(s.foremanId) : '' },
    { k: 'startDate', label: 'Début prévu', type: 'date', value: s.startDate || '' },
    { k: 'endDate', label: 'Fin prévue', type: 'date', value: s.endDate || '' },
    { k: 'budget', label: 'Montant du marché (' + cur + ')', value: s.budget ? String(s.budget) : '' },
    { k: 'costBudget', label: 'Budget de dépenses prévu (' + cur + ')', value: s.costBudget ? String(s.costBudget) : '', hint: 'Facultatif. Vide : les dépenses sont comparées au montant du marché.' },
    { k: 'remainingEstimate', label: 'Reste à faire estimé (' + cur + ')', value: s.remainingEstimate ? String(s.remainingEstimate) : '', hint: 'Ce qu\'il vous reste à dépenser pour finir. Sert à la marge prévisionnelle.' },
    { k: 'status', label: 'Statut', type: 'select', options: STATUS, value: s.status || 'preparation' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: s.notes },
  ];
  if (!s.id && info.branches.length) f.push({ k: 'branchId', label: 'Antenne', type: 'select', options: [['', "Toute l'organisation"]].concat(info.branches.map((x) => [String(x.id), x.name])) });
  return (
    <Form
      fields={f}
      submitText="Enregistrer"
      onSubmit={(v) => {
        const b = { ...v, startDate: v.startDate || null, endDate: v.endDate || null, foremanId: v.foremanId || null };
        if (!v.branchId) delete b.branchId;
        return save(oapi, s.id ? 'PUT' : 'POST', '/sites' + (s.id ? '/' + s.id : ''), b, close, done);
      }}
    />
  );
}

export function PhaseForm({ siteId, phase, close, done }) {
  const { oapi } = useWs();
  const p = phase || {};
  return (
    <Form
      fields={[
        { k: 'name', label: 'Phase ou lot', required: true, value: p.name, placeholder: 'Fondations, gros œuvre, électricité…' },
        { k: 'weight', label: 'Poids dans le chantier', value: String(p.weight || 1), hint: "Une phase qui pèse 3 compte trois fois plus qu'une phase qui pèse 1 dans l'avancement global." },
        { k: 'progress', label: 'Avancement (%)', value: String(p.progress || 0) },
        { k: 'plannedStart', label: 'Début prévu', type: 'date', value: p.plannedStart || '' },
        { k: 'plannedEnd', label: 'Fin prévue', type: 'date', value: p.plannedEnd || '' },
        ...(p.id ? [{ k: 'actualStart', label: 'Début réel', type: 'date', value: p.actualStart || '' }, { k: 'actualEnd', label: 'Fin réelle', type: 'date', value: p.actualEnd || '' }] : []),
      ]}
      submitText="Enregistrer"
      onSubmit={(v) => {
        const b = {}; Object.keys(v).forEach((k) => { b[k] = /Start|End/.test(k) ? (v[k] || null) : v[k]; });
        return save(oapi, p.id ? 'PUT' : 'POST', p.id ? '/phases/' + p.id : '/sites/' + siteId + '/phases', b, close, done);
      }}
    />
  );
}

export function ExpenseForm({ siteId, expense, close, done }) {
  const { oapi, info, today, toast } = useWs();
  const e = expense || {};
  return (
    <Form
      fields={[
        { k: 'category', label: 'Catégorie', type: 'select', options: CATS, value: e.category || 'materials' },
        { k: 'label', label: 'Libellé', value: e.label, placeholder: 'Ciment, location de pelleteuse…' },
        { k: 'amount', label: 'Montant (' + info.org.currency + ')', required: true, value: e.amount ? String(e.amount) : '' },
        { k: 'date', label: 'Date', type: 'date', value: e.date || today() },
      ]}
      submitText="Enregistrer"
      onSubmit={(v) => save(oapi, e.id ? 'PUT' : 'POST', e.id ? '/expenses/' + e.id : '/sites/' + siteId + '/expenses', v, close, (r) => { if (r && r.alert) toast(r.alert, true); done(); })}
    />
  );
}

export function TimesheetForm({ siteId, close, done }) {
  const { oapi, today } = useWs();
  return (
    <Form
      fields={[
        { k: 'date', label: 'Date', type: 'date', value: today() },
        { k: 'worker', label: 'Équipe ou ouvrier', placeholder: 'Équipe maçons, Moussa…' },
        { k: 'headcount', label: 'Nombre de personnes', required: true, value: '1' },
        { k: 'hours', label: 'Heures travaillées par personne', required: true, value: '8' },
        { k: 'notes', label: 'Remarque' },
      ]}
      submitText="Enregistrer"
      onSubmit={(v) => save(oapi, 'POST', '/sites/' + siteId + '/timesheets', v, close, done)}
    />
  );
}

export function ReportForm({ siteId, report, close, done }) {
  const { oapi, today } = useWs();
  const r = report || {};
  return (
    <Form
      fields={[
        { k: 'date', label: 'Date', type: 'date', value: r.date || today() },
        { k: 'weather', label: 'Météo', value: r.weather, placeholder: 'Soleil, pluie…' },
        { k: 'work', label: 'Travaux réalisés', type: 'textarea', rows: 4, required: true, value: r.work },
        { k: 'headcount', label: 'Effectif présent', value: String(r.headcount || '') },
        { k: 'incidents', label: 'Incidents', type: 'textarea', rows: 2, value: r.incidents, hint: 'Les photos ne sont pas prises en charge ici.' },
      ]}
      submitText="Enregistrer"
      onSubmit={(v) => save(oapi, r.id ? 'PUT' : 'POST', r.id ? '/reports/' + r.id : '/sites/' + siteId + '/reports', v, close, done)}
    />
  );
}

export function IssueForm({ siteId, close, done }) {
  const { oapi } = useWs();
  return (
    <Form
      fields={[
        { k: 'kind', label: 'Type', type: 'select', options: KINDS },
        { k: 'title', label: 'Titre', required: true },
        { k: 'description', label: 'Détails', type: 'textarea', rows: 3 },
      ]}
      submitText="Enregistrer"
      onSubmit={(v) => save(oapi, 'POST', '/sites/' + siteId + '/issues', v, close, done)}
    />
  );
}

export function BillingForm({ siteId, billing, close, done }) {
  const { oapi, info, today } = useWs();
  const b = billing || {};
  return (
    <Form
      fields={[
        { k: 'label', label: 'Libellé', required: true, value: b.label, placeholder: 'Situation n° 1, acompte de démarrage…' },
        { k: 'amount', label: 'Montant facturé (' + info.org.currency + ')', required: true, value: b.amount ? String(b.amount) : '' },
        { k: 'billedAt', label: 'Date de facturation', type: 'date', value: b.billedAt || today() },
        { k: 'dueDate', label: 'Échéance de paiement', type: 'date', value: b.dueDate || '' },
      ]}
      submitText="Enregistrer"
      onSubmit={(v) => save(oapi, b.id ? 'PUT' : 'POST', b.id ? '/billings/' + b.id : '/sites/' + siteId + '/billings', { ...v, dueDate: v.dueDate || null }, close, done)}
    />
  );
}

export function PayForm({ billing, close, done }) {
  const { oapi, info, today } = useWs();
  return (
    <Form
      fields={[
        { k: 'amount', label: 'Montant reçu (' + info.org.currency + ')', required: true, value: String(billing.left) },
        { k: 'date', label: 'Date de réception', type: 'date', value: today() },
      ]}
      submitText="Enregistrer le paiement"
      onSubmit={(v) => save(oapi, 'POST', '/billings/' + billing.id + '/pay', v, close, done)}
    />
  );
}
