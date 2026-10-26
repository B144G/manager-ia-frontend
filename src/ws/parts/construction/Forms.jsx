/* Formulaires du module Chantiers. */
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Form } from '../../ui.jsx';
import { CATS, KINDS, STATUS } from './common.jsx';

const save = (oapi, method, path, body, close, done) => oapi(method, '/construction' + path, body).then((r) => { close(); done(r); });

export function SiteForm({ site, members, close, done }) {
  const t = useT();
  const { oapi, info } = useWs();
  const s = site || {};
  const cur = info.org.currency;
  const f = [
    { k: 'name', label: t('Nom du chantier'), required: true, value: s.name },
    { k: 'client', label: t('Client'), value: s.client },
    { k: 'location', label: t('Lieu'), value: s.location },
    { k: 'foremanId', label: t('Chef de chantier'), type: 'select', options: [['', t('Non défini')]].concat(members.map((m) => [String(m.userId), m.name])), value: s.foremanId ? String(s.foremanId) : '' },
    { k: 'startDate', label: t('Début prévu'), type: 'date', value: s.startDate || '' },
    { k: 'endDate', label: t('Fin prévue'), type: 'date', value: s.endDate || '' },
    { k: 'budget', label: t('Montant du marché ({cur})', { cur }), value: s.budget ? String(s.budget) : '' },
    { k: 'costBudget', label: t('Budget de dépenses prévu ({cur})', { cur }), value: s.costBudget ? String(s.costBudget) : '', hint: t('Facultatif. Vide : les dépenses sont comparées au montant du marché.') },
    { k: 'remainingEstimate', label: t('Reste à faire estimé ({cur})', { cur }), value: s.remainingEstimate ? String(s.remainingEstimate) : '', hint: t("Ce qu'il vous reste à dépenser pour finir. Sert à la marge prévisionnelle.") },
    { k: 'status', label: t('Statut'), type: 'select', options: STATUS.map((x) => [x[0], t(x[1])]), value: s.status || 'preparation' },
    { k: 'notes', label: t('Notes'), type: 'textarea', rows: 2, value: s.notes },
  ];
  if (!s.id && info.branches.length) f.push({ k: 'branchId', label: t('Antenne'), type: 'select', options: [['', t("Toute l'organisation")]].concat(info.branches.map((x) => [String(x.id), x.name])) });
  return (
    <Form
      fields={f}
      submitText={t("Enregistrer")}
      onSubmit={(v) => {
        const b = { ...v, startDate: v.startDate || null, endDate: v.endDate || null, foremanId: v.foremanId || null };
        if (!v.branchId) delete b.branchId;
        return save(oapi, s.id ? 'PUT' : 'POST', '/sites' + (s.id ? '/' + s.id : ''), b, close, done);
      }}
    />
  );
}

export function PhaseForm({ siteId, phase, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const p = phase || {};
  return (
    <Form
      fields={[
        { k: 'name', label: t('Phase ou lot'), required: true, value: p.name, placeholder: t('Fondations, gros œuvre, électricité…') },
        { k: 'weight', label: t('Poids dans le chantier'), value: String(p.weight || 1), hint: t("Une phase qui pèse 3 compte trois fois plus qu'une phase qui pèse 1 dans l'avancement global.") },
        { k: 'progress', label: t('Avancement (%)'), value: String(p.progress || 0) },
        { k: 'plannedStart', label: t('Début prévu'), type: 'date', value: p.plannedStart || '' },
        { k: 'plannedEnd', label: t('Fin prévue'), type: 'date', value: p.plannedEnd || '' },
        ...(p.id ? [{ k: 'actualStart', label: t('Début réel'), type: 'date', value: p.actualStart || '' }, { k: 'actualEnd', label: t('Fin réelle'), type: 'date', value: p.actualEnd || '' }] : []),
      ]}
      submitText={t("Enregistrer")}
      onSubmit={(v) => {
        const b = {}; Object.keys(v).forEach((k) => { b[k] = /Start|End/.test(k) ? (v[k] || null) : v[k]; });
        return save(oapi, p.id ? 'PUT' : 'POST', p.id ? '/phases/' + p.id : '/sites/' + siteId + '/phases', b, close, done);
      }}
    />
  );
}

export function ExpenseForm({ siteId, expense, close, done }) {
  const t = useT();
  const { oapi, info, today, toast } = useWs();
  const e = expense || {};
  return (
    <Form
      fields={[
        { k: 'category', label: t('Catégorie'), type: 'select', options: CATS.map((x) => [x[0], t(x[1])]), value: e.category || 'materials' },
        { k: 'label', label: t('Libellé'), value: e.label, placeholder: t('Ciment, location de pelleteuse…') },
        { k: 'amount', label: t('Montant ({cur})', { cur: info.org.currency }), required: true, value: e.amount ? String(e.amount) : '' },
        { k: 'date', label: t('Date'), type: 'date', value: e.date || today() },
      ]}
      submitText={t("Enregistrer")}
      onSubmit={(v) => save(oapi, e.id ? 'PUT' : 'POST', e.id ? '/expenses/' + e.id : '/sites/' + siteId + '/expenses', v, close, (r) => { if (r && r.alert) toast(/\(([^)]*)\).*\(([^)]*)\)/.test(r.alert) ? t('Attention : les dépenses ({spent}) dépassent le budget ({ceiling}).', { spent: r.alert.match(/\(([^)]*)\)/)[1], ceiling: r.alert.match(/\(([^)]*)\)[^(]*$/)[1] }) : t(r.alert), true); done(); })}
    />
  );
}

export function TimesheetForm({ siteId, close, done }) {
  const t = useT();
  const { oapi, today } = useWs();
  return (
    <Form
      fields={[
        { k: 'date', label: t('Date'), type: 'date', value: today() },
        { k: 'worker', label: t('Équipe ou ouvrier'), placeholder: t('Équipe maçons, Moussa…') },
        { k: 'headcount', label: t('Nombre de personnes'), required: true, value: '1' },
        { k: 'hours', label: t('Heures travaillées par personne'), required: true, value: '8' },
        { k: 'notes', label: t('Remarque') },
      ]}
      submitText={t("Enregistrer")}
      onSubmit={(v) => save(oapi, 'POST', '/sites/' + siteId + '/timesheets', v, close, done)}
    />
  );
}

export function ReportForm({ siteId, report, close, done }) {
  const t = useT();
  const { oapi, today } = useWs();
  const r = report || {};
  return (
    <Form
      fields={[
        { k: 'date', label: t('Date'), type: 'date', value: r.date || today() },
        { k: 'weather', label: t('Météo'), value: r.weather, placeholder: t('Soleil, pluie…') },
        { k: 'work', label: t('Travaux réalisés'), type: 'textarea', rows: 4, required: true, value: r.work },
        { k: 'headcount', label: t('Effectif présent'), value: String(r.headcount || '') },
        { k: 'incidents', label: t('Incidents'), type: 'textarea', rows: 2, value: r.incidents, hint: t('Les photos ne sont pas prises en charge ici.') },
      ]}
      submitText={t("Enregistrer")}
      onSubmit={(v) => save(oapi, r.id ? 'PUT' : 'POST', r.id ? '/reports/' + r.id : '/sites/' + siteId + '/reports', v, close, done)}
    />
  );
}

export function IssueForm({ siteId, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  return (
    <Form
      fields={[
        { k: 'kind', label: t('Type'), type: 'select', options: KINDS.map((x) => [x[0], t(x[1])]) },
        { k: 'title', label: t('Titre'), required: true },
        { k: 'description', label: t('Détails'), type: 'textarea', rows: 3 },
      ]}
      submitText={t("Enregistrer")}
      onSubmit={(v) => save(oapi, 'POST', '/sites/' + siteId + '/issues', v, close, done)}
    />
  );
}

export function BillingForm({ siteId, billing, close, done }) {
  const t = useT();
  const { oapi, info, today } = useWs();
  const b = billing || {};
  return (
    <Form
      fields={[
        { k: 'label', label: t('Libellé'), required: true, value: b.label, placeholder: t('Situation n° 1, acompte de démarrage…') },
        { k: 'amount', label: t('Montant facturé ({cur})', { cur: info.org.currency }), required: true, value: b.amount ? String(b.amount) : '' },
        { k: 'billedAt', label: t('Date de facturation'), type: 'date', value: b.billedAt || today() },
        { k: 'dueDate', label: t('Échéance de paiement'), type: 'date', value: b.dueDate || '' },
      ]}
      submitText={t("Enregistrer")}
      onSubmit={(v) => save(oapi, b.id ? 'PUT' : 'POST', b.id ? '/billings/' + b.id : '/sites/' + siteId + '/billings', { ...v, dueDate: v.dueDate || null }, close, done)}
    />
  );
}

export function PayForm({ billing, close, done }) {
  const t = useT();
  const { oapi, info, today } = useWs();
  return (
    <Form
      fields={[
        { k: 'amount', label: t('Montant reçu ({cur})', { cur: info.org.currency }), required: true, value: String(billing.left) },
        { k: 'date', label: t('Date de réception'), type: 'date', value: today() },
      ]}
      submitText={t('Enregistrer le paiement')}
      onSubmit={(v) => save(oapi, 'POST', '/billings/' + billing.id + '/pay', v, close, done)}
    />
  );
}
