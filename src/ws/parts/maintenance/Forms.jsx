/* Formulaires du module Maintenance. */
import { useWs } from '../../WsContext.jsx';
import { Form } from '../../ui.jsx';
import { EQ_STATUS, KIND, PERIOD, PRIO } from './common.jsx';

export function EquipmentForm({ equipment, close, done }) {
  const { oapi, info, can } = useWs();
  const e = equipment || {};
  const f = [
    { k: 'name', label: 'Nom', required: true, value: e.name },
    { k: 'kind', label: 'Type', type: 'select', options: KIND, value: e.kind || 'machine' },
    { k: 'reference', label: 'Référence / numéro de série', value: e.reference },
    { k: 'location', label: 'Emplacement', value: e.location, placeholder: 'Atelier, entrepôt, parking…' },
    { k: 'purchasedAt', label: "Date d'achat", type: 'date', value: e.purchasedAt || '' },
    { k: 'value', label: 'Valeur (' + info.org.currency + ')', value: e.value || '' },
    { k: 'status', label: 'Statut', type: 'select', options: EQ_STATUS, value: e.status || 'running' },
    { k: 'meter', label: 'Compteur actuel (heures ou km)', value: String(e.meter || 0), hint: 'Sert aux plans de maintenance en heures ou en kilomètres.' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: e.notes },
  ];
  if (!e.id && info.branches.length && can('admin')) f.push({ k: 'branchId', label: 'Antenne', type: 'select', options: [['', "Toute l'organisation"]].concat(info.branches.map((x) => [String(x.id), x.name])) });
  return (
    <Form
      fields={f}
      submitText="Enregistrer"
      onSubmit={(v) => {
        const b = { ...v, purchasedAt: v.purchasedAt || null };
        if (!v.branchId) delete b.branchId;
        return oapi(e.id ? 'PUT' : 'POST', '/maintenance/equipment' + (e.id ? '/' + e.id : ''), b).then(() => { close(); done(); });
      }}
    />
  );
}

export function PlanForm({ plan, equipment, close, done }) {
  const { oapi } = useWs();
  const p = plan || {};
  return (
    <Form
      fields={[
        ...(p.id ? [] : [{ k: 'equipmentId', label: 'Équipement', type: 'select', options: equipment.map((e) => [String(e.id), e.name]) }]),
        { k: 'task', label: 'Tâche à réaliser', required: true, value: p.task, placeholder: 'Graissage, vidange, contrôle…' },
        { k: 'periodKind', label: 'Périodicité', type: 'select', options: PERIOD, value: p.periodKind || 'days' },
        { k: 'periodValue', label: 'Valeur de la périodicité (X)', required: true, value: p.periodValue ? String(p.periodValue) : '', placeholder: '30' },
        { k: 'lastDoneAt', label: 'Dernière réalisation (jours)', type: 'date', value: p.lastDoneAt || '', hint: 'Laissez vide : le décompte part d\'aujourd\'hui.' },
        { k: 'lastMeter', label: 'Compteur à la dernière réalisation (heures/km)', value: p.id ? String(p.lastMeter) : '', hint: 'Laissez vide : le compteur actuel de l\'équipement est utilisé.' },
      ]}
      submitText="Enregistrer"
      onSubmit={(v) => {
        const b = { ...v, lastDoneAt: v.lastDoneAt || null };
        if (!v.lastMeter) delete b.lastMeter;
        return oapi(p.id ? 'PUT' : 'POST', '/maintenance/plans' + (p.id ? '/' + p.id : ''), b).then(() => { close(); done(); });
      }}
    />
  );
}

export function OrderForm({ equipment, members, preset, close, done }) {
  const { oapi, can } = useWs();
  const mgr = can('manager');
  const pre = preset || {};
  return (
    <Form
      fields={[
        { k: 'equipmentId', label: 'Équipement', type: 'select', options: equipment.map((e) => [String(e.id), e.name]), value: pre.equipmentId ? String(pre.equipmentId) : undefined },
        ...(mgr ? [{ k: 'kind', label: 'Type', type: 'select', options: [['corrective', 'Corrective (panne)'], ['preventive', 'Préventive']] }] : []),
        { k: 'title', label: 'Problème ou tâche', required: true, placeholder: 'Le moteur chauffe, fuite d\'huile…' },
        { k: 'description', label: 'Détails', type: 'textarea', rows: 3 },
        { k: 'priority', label: 'Priorité', type: 'select', options: PRIO, value: 'normal' },
        ...(mgr ? [
          { k: 'assigneeId', label: 'Assignée à', type: 'select', options: [['', 'Personne']].concat(members.map((m) => [String(m.userId), m.name])) },
          { k: 'contractor', label: 'Ou prestataire externe', placeholder: 'Nom de l\'entreprise ou du technicien' },
        ] : []),
      ]}
      submitText={mgr ? 'Créer' : 'Signaler la panne'}
      onSubmit={(v) => oapi('POST', '/maintenance/orders', { ...v, assigneeId: v.assigneeId || null }).then(() => { close(); done(); })}
    />
  );
}

export function CloseForm({ order, close, done }) {
  const { oapi, can, info } = useWs();
  return (
    <Form
      fields={[
        { k: 'downtimeHours', label: "Durée d'arrêt de l'équipement (heures)", value: String(order.downtimeHours || 0) },
        ...(can('manager') || order.assigneeId === info.me.userId ? [{ k: 'laborCost', label: "Coût de main-d'œuvre ou du prestataire (" + info.org.currency + ')', value: String(order.laborCost || 0) }] : []),
        { k: 'meter', label: 'Compteur relevé (heures ou km, facultatif)', value: '' },
        { k: 'notes', label: 'Compte rendu', type: 'textarea', rows: 3, value: order.notes },
      ]}
      submitText="Terminer l'intervention"
      onSubmit={(v) => { const b = { ...v }; if (!v.meter) delete b.meter; return oapi('POST', '/maintenance/orders/' + order.id + '/close', b).then(() => { close(); done(); }); }}
    />
  );
}

export function PartForm({ orderId, items, close, done }) {
  const { oapi, info } = useWs();
  return (
    <Form
      fields={[
        { k: 'itemId', label: 'Pièce du stock', type: 'select', options: [['', 'Pièce hors stock (saisie libre)']].concat(items.map((i) => [String(i.id), i.name + ' (' + i.quantity + ' ' + i.unit + ')'])), hint: 'Une pièce du stock sort automatiquement du stock.' },
        { k: 'name', label: 'Nom (pièce hors stock)', placeholder: 'Courroie, filtre…' },
        { k: 'quantity', label: 'Quantité', required: true, value: '1' },
        { k: 'unitCost', label: 'Prix unitaire (' + info.org.currency + ')', hint: 'Pour une pièce du stock, laissez vide : son coût d\'achat est utilisé.' },
      ]}
      submitText="Ajouter la pièce"
      onSubmit={(v) => {
        const b = { quantity: v.quantity, unitCost: v.unitCost };
        if (v.itemId) b.itemId = v.itemId; else b.name = v.name;
        return oapi('POST', '/maintenance/orders/' + orderId + '/parts', b).then(() => { close(); done(); });
      }}
    />
  );
}
