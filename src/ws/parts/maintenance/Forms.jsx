/* Formulaires du module Maintenance. */
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Form } from '../../ui.jsx';
import { EQ_STATUS, KIND, PERIOD, PRIO } from './common.jsx';

export function EquipmentForm({ equipment, close, done }) {
  const t = useT();
  const { oapi, info, can } = useWs();
  const e = equipment || {};
  const f = [
    { k: 'name', label: t('Nom'), required: true, value: e.name },
    { k: 'kind', label: t('Type'), type: 'select', options: KIND.map((x) => [x[0], t(x[1])]), value: e.kind || 'machine' },
    { k: 'reference', label: t('Référence / numéro de série'), value: e.reference },
    { k: 'location', label: t('Emplacement'), value: e.location, placeholder: t('Atelier, entrepôt, parking…') },
    { k: 'purchasedAt', label: t("Date d'achat"), type: 'date', value: e.purchasedAt || '' },
    { k: 'value', label: t('Valeur ({cur})', { cur: info.org.currency }), value: e.value || '' },
    { k: 'status', label: t('Statut'), type: 'select', options: EQ_STATUS.map((x) => [x[0], t(x[1])]), value: e.status || 'running' },
    { k: 'meter', label: t('Compteur actuel (heures ou km)'), value: String(e.meter || 0), hint: t('Sert aux plans de maintenance en heures ou en kilomètres.') },
    { k: 'notes', label: t('Notes'), type: 'textarea', rows: 2, value: e.notes },
  ];
  if (!e.id && info.branches.length && can('admin')) f.push({ k: 'branchId', label: t('Antenne'), type: 'select', options: [['', t("Toute l'organisation")]].concat(info.branches.map((x) => [String(x.id), x.name])) });
  return (
    <Form
      fields={f}
      submitText={t("Enregistrer")}
      onSubmit={(v) => {
        const b = { ...v, purchasedAt: v.purchasedAt || null };
        if (!v.branchId) delete b.branchId;
        return oapi(e.id ? 'PUT' : 'POST', '/maintenance/equipment' + (e.id ? '/' + e.id : ''), b).then(() => { close(); done(); });
      }}
    />
  );
}

export function PlanForm({ plan, equipment, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  const p = plan || {};
  return (
    <Form
      fields={[
        ...(p.id ? [] : [{ k: 'equipmentId', label: t('Équipement'), type: 'select', options: equipment.map((e) => [String(e.id), e.name]) }]),
        { k: 'task', label: t('Tâche à réaliser'), required: true, value: p.task, placeholder: t('Graissage, vidange, contrôle…') },
        { k: 'periodKind', label: t('Périodicité'), type: 'select', options: PERIOD.map((x) => [x[0], t(x[1])]), value: p.periodKind || 'days' },
        { k: 'periodValue', label: t('Valeur de la périodicité (X)'), required: true, value: p.periodValue ? String(p.periodValue) : '', placeholder: '30' },
        { k: 'lastDoneAt', label: t('Dernière réalisation (jours)'), type: 'date', value: p.lastDoneAt || '', hint: t("Laissez vide : le décompte part d'aujourd'hui.") },
        { k: 'lastMeter', label: t('Compteur à la dernière réalisation (heures/km)'), value: p.id ? String(p.lastMeter) : '', hint: t("Laissez vide : le compteur actuel de l'équipement est utilisé.") },
      ]}
      submitText={t("Enregistrer")}
      onSubmit={(v) => {
        const b = { ...v, lastDoneAt: v.lastDoneAt || null };
        if (!v.lastMeter) delete b.lastMeter;
        return oapi(p.id ? 'PUT' : 'POST', '/maintenance/plans' + (p.id ? '/' + p.id : ''), b).then(() => { close(); done(); });
      }}
    />
  );
}

export function OrderForm({ equipment, members, preset, close, done }) {
  const t = useT();
  const { oapi, can } = useWs();
  const mgr = can('manager');
  const pre = preset || {};
  return (
    <Form
      fields={[
        { k: 'equipmentId', label: t('Équipement'), type: 'select', options: equipment.map((e) => [String(e.id), e.name]), value: pre.equipmentId ? String(pre.equipmentId) : undefined },
        ...(mgr ? [{ k: 'kind', label: t('Type'), type: 'select', options: [['corrective', t('Corrective (panne)')], ['preventive', t('Préventive')]] }] : []),
        { k: 'title', label: t('Problème ou tâche'), required: true, placeholder: t("Le moteur chauffe, fuite d'huile…") },
        { k: 'description', label: t('Détails'), type: 'textarea', rows: 3 },
        { k: 'priority', label: t('Priorité'), type: 'select', options: PRIO.map((x) => [x[0], t(x[1])]), value: 'normal' },
        ...(mgr ? [
          { k: 'assigneeId', label: t('Assignée à'), type: 'select', options: [['', t('Personne')]].concat(members.map((m) => [String(m.userId), m.name])) },
          { k: 'contractor', label: t('Ou prestataire externe'), placeholder: t("Nom de l'entreprise ou du technicien") },
        ] : []),
      ]}
      submitText={mgr ? t('Créer') : t('Signaler la panne')}
      onSubmit={(v) => oapi('POST', '/maintenance/orders', { ...v, assigneeId: v.assigneeId || null }).then(() => { close(); done(); })}
    />
  );
}

export function CloseForm({ order, close, done }) {
  const t = useT();
  const { oapi, can, info } = useWs();
  return (
    <Form
      fields={[
        { k: 'downtimeHours', label: t("Durée d'arrêt de l'équipement (heures)"), value: String(order.downtimeHours || 0) },
        ...(can('manager') || order.assigneeId === info.me.userId ? [{ k: 'laborCost', label: t("Coût de main-d'œuvre ou du prestataire ({cur})", { cur: info.org.currency }), value: String(order.laborCost || 0) }] : []),
        { k: 'meter', label: t('Compteur relevé (heures ou km, facultatif)'), value: '' },
        { k: 'notes', label: t('Compte rendu'), type: 'textarea', rows: 3, value: order.notes },
      ]}
      submitText={t("Terminer l'intervention")}
      onSubmit={(v) => { const b = { ...v }; if (!v.meter) delete b.meter; return oapi('POST', '/maintenance/orders/' + order.id + '/close', b).then(() => { close(); done(); }); }}
    />
  );
}

export function PartForm({ orderId, items, close, done }) {
  const t = useT();
  const { oapi, info } = useWs();
  return (
    <Form
      fields={[
        { k: 'itemId', label: t('Pièce du stock'), type: 'select', options: [['', t('Pièce hors stock (saisie libre)')]].concat(items.map((i) => [String(i.id), i.name + ' (' + i.quantity + ' ' + i.unit + ')'])), hint: t('Une pièce du stock sort automatiquement du stock.') },
        { k: 'name', label: t('Nom (pièce hors stock)'), placeholder: t('Courroie, filtre…') },
        { k: 'quantity', label: t('Quantité'), required: true, value: '1' },
        { k: 'unitCost', label: t('Prix unitaire ({cur})', { cur: info.org.currency }), hint: t("Pour une pièce du stock, laissez vide : son coût d'achat est utilisé.") },
      ]}
      submitText={t('Ajouter la pièce')}
      onSubmit={(v) => {
        const b = { quantity: v.quantity, unitCost: v.unitCost };
        if (v.itemId) b.itemId = v.itemId; else b.name = v.name;
        return oapi('POST', '/maintenance/orders/' + orderId + '/parts', b).then(() => { close(); done(); });
      }}
    />
  );
}
