import { tr } from '../../../lib/i18n.jsx';

/* Petits outils du « Suivi de l'IA » (états de l'IA, dates, texte d'une règle). */

export const STATE_LABEL = { active: 'IA active', excluded: 'Exclu', partial: 'Exclusion partielle', waiting: "En attente d'un conseiller", draft: 'Réponse à valider' };
export const STATES = ['active', 'excluded', 'partial', 'waiting', 'draft'];
export const CHANNEL_LABEL = { whatsapp: 'WhatsApp', web: 'Site', messenger: 'Messenger', instagram: 'Instagram' };
export const STAGE_LABEL = { prospect: 'Prospect', client: 'Client', contact: 'Sans fiche' };
export const FLAGS = [
  ['noPrice', 'Parler de prix et négocier', "L'IA renvoie vers un conseiller dès qu'il est question de prix."],
  ['noOrder', 'Prendre une commande', "L'IA n'enregistre aucune commande pour ce contact."],
  ['noAppt', 'Fixer un rendez-vous', "L'IA ne propose ni n'enregistre de rendez-vous."],
  ['noFollowup', 'Envoyer des relances automatiques', 'Ni relance de prospect, ni rappel de facture ou de rendez-vous, ni campagne.'],
  ['draft', 'Répondre seule', "Cochée : l'IA prépare un brouillon que vous validez, modifiez ou refusez avant l'envoi."],
];

export const IaPill = ({ state }) => <span className={'af-ia ' + state}>{tr(STATE_LABEL[state] || STATE_LABEL.active)}</span>;

const p2 = (n) => String(n).padStart(2, '0');
export const fmtDay = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const fmtHour = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const fmtDT = (iso) => (iso ? `${fmtDay(iso)} ${fmtHour(iso)}` : '');
const dayKey = (iso) => fmtDay(iso);
/** « Aujourd'hui », « Hier » ou la date. */
export function dayLabel(iso) {
  const k = dayKey(iso);
  if (k === dayKey(new Date().toISOString())) return tr("Aujourd'hui");
  if (k === dayKey(new Date(Date.now() - 86400000).toISOString())) return tr('Hier');
  return k;
}
export const sameDay = (a, b) => dayKey(a) === dayKey(b);

/** Phrase décrivant une règle (état renvoyé par le serveur : { mode|excluded, noPrice… , expiresAt }). */
export function ruleText(rule) {
  if (!rule) return '';
  const until = rule.expiresAt ? tr('jusqu\'au {date}', { date: fmtDT(rule.expiresAt) }) : tr('sans limite de durée');
  if (rule.mode === 'full' || rule.excluded) return tr("L'IA est exclue pour ce contact, {until}. Ses messages arrivent ici, répondez-lui à la main.", { until });
  const w = FLAGS.filter(([k]) => rule[k]).map(([k, label]) => (k === 'draft' ? tr('réponses à valider avant envoi') : tr('pas de : {what}', { what: tr(label).toLowerCase() })));
  return tr('Exclusion partielle ({list}), {until}.', { list: w.join(' ; '), until });
}
