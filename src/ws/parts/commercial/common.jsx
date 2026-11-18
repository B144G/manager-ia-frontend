import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Icon, Loading } from '../../ui.jsx';

/* Pièces communes du module Commercial : contexte (rôle, équipe, zones, navigation entre écrans, tiroirs de fiches), libellés, pastilles, formatage.
   Les étapes suivantes (devis, prévision, performance…) ajoutent leurs écrans dans commercial.jsx et réutilisent ce contexte (useCp()).
   Les droits réels sont contrôlés par le serveur : ici on masque seulement les boutons. */

const Ctx = createContext(null);
export const useCp = () => useContext(Ctx);

/** Adresse d'appel avec paramètres : les valeurs vides sont ignorées. */
export const qs = (o) => {
  const p = Object.entries(o || {}).filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== false).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v === true ? 1 : v));
  return p.length ? '?' + p.join('&') : '';
};

/**
 * Fournisseur du module. `drawers` : { account, opp, lead… } = composants de fiche affichés dans un tiroir (props : id, onClose).
 * Une étape ajoute un type de fiche en ajoutant une entrée ici (dans commercial.jsx), sans toucher au reste.
 */
export function CommercialProvider({ drawers = {}, children }) {
  const { oapi, orgId, fail: wsFail, toast } = useWs();
  const [me, setMe] = useState(null);
  const [noRole, setNoRole] = useState(false);
  const [error, setError] = useState(null);
  const [team, setTeam] = useState({ members: [], roles: [], zones: [], teams: [] });
  const [screen, setScreen] = useState({ id: 'home', params: {} });
  const [drawer, setDrawer] = useState(null);
  const [tick, setTick] = useState(0);

  const api = useCallback((method, path, body) => oapi(method, '/commercial' + path, body), [oapi]);
  /** Appel qui rend aussi les réponses d'erreur (409 doublons, 422 lien WhatsApp…) : { ok, status, data }. */
  const raw = useCallback(async (method, path, body) => {
    const r = await fetch(API_BASE + '/api/ws/orgs/' + orgId + '/commercial' + path, {
      method, credentials: 'include', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) wsFail(Object.assign(new Error(data.error || ''), { status: 401 }));
    return { ok: r.ok, status: r.status, data };
  }, [orgId, wsFail]);
  const fail = useCallback((e) => { if (e && e.status === 401) wsFail(e); else toast(tsrv((e && e.message) || 'Erreur'), true); }, [wsFail, toast]);

  const loadTeam = useCallback(() => Promise.all([api('GET', '/roles'), api('GET', '/zones'), api('GET', '/teams')])
    .then(([r, z, tm]) => setTeam({ members: r.members, roles: r.roles, zones: z.zones, teams: tm.teams })), [api]);

  useEffect(() => {
    let off = false;
    api('GET', '/me').then((j) => { if (off) return null; setMe(j); return loadTeam(); }).catch((e) => {
      if (off) return;
      if (e && e.status === 403) setNoRole(true); else if (e && e.status === 401) wsFail(e); else setError(e);
    });
    return () => { off = true; };
  }, [api, loadTeam, wsFail]);

  const perms = me ? me.perms : [];
  const has = useCallback((p) => perms.includes(p), [perms]);
  const members = team.members;
  const memberName = useCallback((id) => { const m = members.find((x) => x.userId === Number(id)); return m ? m.name : ''; }, [members]);
  const go = useCallback((id, params = {}) => { setDrawer(null); setScreen({ id, params }); }, []);
  const open = useCallback((kind, id) => setDrawer({ kind, id }), []);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  const value = useMemo(() => ({
    api, raw, fail, me, has, perms, members, zones: team.zones, teams: team.teams, cRoles: team.roles, reloadTeam: loadTeam, memberName,
    screen, go, tick, bump, openAccount: (id) => open('account', id), openOpp: (id) => open('opp', id), openLead: (id) => open('lead', id), openDrawer: open, closeDrawer: () => setDrawer(null),
  }), [api, raw, fail, me, has, perms, members, team, loadTeam, memberName, screen, go, tick, bump, open]);

  if (noRole) return <Alert tone="warn" title={null}>{<NoRole />}</Alert>;
  if (error) return <p className="ws-err" role="alert">{tsrv(error.message)}</p>;
  if (!me) return <Loading />;
  const D = drawer && drawers[drawer.kind];
  return (
    <Ctx.Provider value={value}>
      {children}
      {D ? <D key={drawer.kind + drawer.id} id={drawer.id} onClose={() => setDrawer(null)} /> : null}
    </Ctx.Provider>
  );
}
function NoRole() {
  const t = useT();
  return <span>{t("Vous n'avez pas de rôle commercial : demandez au responsable du compte de vous en désigner un.")}</span>;
}

/* ---------- Libellés (traduits à l'affichage ; les codes viennent du serveur) ---------- */
export function useL() {
  const t = useT();
  return useMemo(() => ({
    source: { whatsapp: t('WhatsApp'), ad: t('Publicité'), referral: t('Recommandation'), trade_show: t('Salon'), field: t('Terrain'), web: t('Site web'), other: t('Autre') },
    leadStatus: { new: t('Nouveau'), contacted: t('Contacté'), qualified: t('Qualifié'), converted: t('Converti'), lost: t('Perdu'), disqualified: t('Écarté') },
    temp: { '': t('Non précisée'), chaud: t('Chaude'), tiede: t('Tiède'), froid: t('Froide') },
    kind: { company: t('Entreprise'), person: t('Particulier') },
    stage: { prospect: t('Prospect'), client: t('Client') },
    potential: { '': t('Non précisé'), high: t('Élevé'), medium: t('Moyen'), low: t('Faible') },
    actKind: { call: t('Appel'), visit: t('Visite'), meeting: t('Rendez-vous'), message: t('Message'), email: t('E-mail') },
    taskKind: { todo: t('À faire'), call: t('Appel'), visit: t('Visite'), message: t('Message'), quote: t('Devis'), reminder: t('Rappel') },
    oppStatus: { open: t('En cours'), won: t('Gagnée'), lost: t('Perdue') },
    stageKind: { open: t('Étape ouverte'), won: t('Gagné'), lost: t('Perdu') },
    channel: { whatsapp: t('WhatsApp'), task: t('Tâche') },
    target: { lead: t('Prospects'), customer: t('Comptes'), quote: t('Devis') },
    strategy: { load: t('Le moins chargé'), round_robin: t('Tour de rôle') },
    runState: { active: t('En cours'), sending: t('Envoi en cours'), done: t('Terminée'), stopped: t('Arrêtée') },
    stopReason: { manual: t('Arrêtée à la main'), replied: t('Le client a répondu'), optout: t('Opposition aux relances'), subject_deleted: t('Fiche supprimée'), converted: t('Prospect converti'), lost: t('Prospect perdu'), disqualified: t('Prospect écarté'), accepted: t('Devis accepté'), refused: t('Devis refusé'), cancelled: t('Devis annulé') },
    logResult: { sent: t('Envoyé'), skipped: t('Sautée'), manual: t('Envoyé à la main'), task: t('Tâche créée'), failed: t("Échec de l'envoi") },
    dupReason: { phone: t('même téléphone'), email: t('même e-mail'), name: t('même nom'), similar_name: t('nom très proche') },
    rfm: { champions: t('Champions'), loyal: t('Clients fidèles'), promising: t('Prometteurs'), new: t('Nouveaux'), need_attention: t('À surveiller'), at_risk: t('À risque'), hibernating: t('En sommeil'), lost: t('Perdus') },
    action: {
      reward: t('Récompenser'), ask_referral: t('Demander une recommandation'), upsell: t('Proposer une vente additionnelle'), loyalty_offer: t('Offre de fidélité'), ask_review: t('Demander un avis'),
      nurture: t('Entretenir la relation'), second_offer: t('Proposer une seconde offre'), welcome: t('Message de bienvenue'), follow_first_order: t('Suivre la première commande'),
      reminder_offer: t('Offre de rappel'), check_satisfaction: t('Vérifier la satisfaction'), call_now: t('Appeler sans attendre'), win_back_offer: t('Offre de reconquête'),
      reactivation_campaign: t('Campagne de réactivation'), special_offer: t('Offre spéciale'), last_chance: t('Dernière chance'), ask_why_left: t('Demander pourquoi il est parti'),
    },
    orgRole: { owner: t('Propriétaire'), admin: t('Administrateur'), manager: t('Responsable'), member: t('Membre') },
    cRole: { sales_manager: t('Responsable commercial'), sales_assistant: t('Assistant commercial'), sales_field: t('Commercial terrain'), viewer: t('Lecture seule'), none: t('Aucun rôle commercial') },
    perm: {
      view: t('Consulter les fiches'), write: t('Créer et modifier les fiches'), quote: t('Préparer des devis'), activity: t('Saisir ses activités et relances'), approve: t('Valider les dépassements et remises'),
      targets: t('Fixer les objectifs'), rules: t('Définir règles, zones et étapes'), pricing: t('Gérer tarifs et marges'), commissions: t('Gérer les commissions'), merge: t('Fusionner les doublons'),
      delete: t('Supprimer des fiches'), export: t('Exporter les données'), coach: t("Accompagner l'équipe"), roles_light: t('Désigner assistants et commerciaux'), roles: t('Désigner le responsable commercial'),
    },
    tl: {
      message: [t('Message'), 'comment'], call: [t('Appel'), 'phone'], visit: [t('Visite'), 'location-dot'], meeting: [t('Rendez-vous'), 'handshake'], email: [t('E-mail'), 'envelope'], appointment: [t('Rendez-vous'), 'calendar'],
      invoice: [t('Facture'), 'receipt'], quote: [t('Devis'), 'file-lines'], credit: [t('Avoir'), 'receipt'], order: [t('Commande'), 'cart-shopping'], payment: [t('Paiement'), 'coins'], ticket: [t('Demande'), 'headset'],
      note: [t('Note'), 'pen'], task: [t('Tâche'), 'list-check'], opportunity: [t('Opportunité'), 'bullseye'], attachment: [t('Pièce jointe'), 'paperclip'],
    },
    moved: { documents: t('documents'), chats: t('conversations'), appointments: t('rendez-vous'), tickets: t('demandes'), wms_vas_rules: t('règles de services'), fu_items: t('relances'), cp_contacts: t('contacts'), cp_leads: t('prospects'), cp_opps: t('opportunités'), cp_activities: t('activités'), cp_notes: t('notes'), cp_attachments: t('pièces jointes'), cp_tasks: t('tâches'), cp_cadence_runs: t('relances automatiques') },
    entity: { account: t('Compte'), lead: t('Prospect'), opportunity: t('Opportunité'), zone: t('Zone'), team: t('Équipe'), role: t('Rôle'), settings: t('Réglages'), stage: t('Étape'), assign_rule: t("Règle d'attribution"), cadence: t('Cadence'), cadence_run: t('Relance'), segment: t('Segment'), bant_lead: t('BANT du prospect'), bant_opp: t("BANT de l'opportunité") },
    ruleField: { revenue: t("Chiffre d'affaires"), orders: t('Nombre de commandes'), recencyDays: t('Jours depuis le dernier achat'), avgBasket: t('Panier moyen'), city: t('Ville'), sector: t('Secteur'), potential: t('Potentiel'), stage: t('Statut'), kind: t('Type de compte'), abc: t('Classe ABC'), segment: t('Segment RFM'), r: t('Note de récence (1 à 5)'), f: t('Note de fréquence (1 à 5)'), m: t('Note de montant (1 à 5)'), ownerId: t('Commercial (numéro)') },
    ruleOp: { eq: t('est égal à'), ne: t('est différent de'), gt: t('est supérieur à'), gte: t('est supérieur ou égal à'), lt: t('est inférieur à'), lte: t('est inférieur ou égal à'), in: t('est parmi (séparés par des virgules)'), contains: t('contient') },
  }), [t]);
}

const TONES = { new: 'info', contacted: 'brand', qualified: 'ok', converted: 'ok', lost: 'danger', disqualified: 'neutral', open: 'brand', won: 'ok', active: 'brand', done: 'ok', stopped: 'neutral', sending: 'warn' };
/** Pastille d'état : `map` = table de libellés (useL), `k` = code. */
export function Tag({ map, k }) { return <Badge tone={TONES[k] || 'neutral'}>{map[k] || k}</Badge>; }
const GRADE_TONE = { A: 'ok', B: 'info', C: 'warn', D: 'neutral' };
export function Grade({ grade, score }) {
  const t = useT();
  return <Badge tone={GRADE_TONE[grade] || 'neutral'}><b aria-label={t('Note {g}', { g: grade })}>{grade}</b>{score !== undefined ? <span> · {score}</span> : null}</Badge>;
}
export const GRADE_COLOR = { A: 'var(--ok)', B: 'var(--c5)', C: 'var(--warn)', D: 'var(--c8)' };

/** Date et heure courtes, dans la langue de l'interface. */
export function fmtDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso).slice(0, 16) : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
/** Valeur d'un champ « datetime-local » → date ISO pour le serveur (vide si rien). */
export const isoOf = (v) => (v ? new Date(v).toISOString() : '');
export const inputDT = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const num = (v) => { const n = Number(String(v === undefined || v === null ? '' : v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
export const pct = (v) => `${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} %`;
export const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** Petit état de formulaire : valeurs, erreur, occupation. */
export function useForm(initial) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const run = async (fn) => {
    setErr(''); setBusy(true);
    try { await fn(); } catch (e) { setErr(tsrv(e.message || 'Erreur')); }
    setBusy(false);
  };
  return { v, setV, set, err, setErr, busy, run };
}

/** Choix d'un membre de l'équipe (commercial). `none` : libellé de l'option vide. */
export function MemberSelect({ id, value, onChange, none, onlySales, ...rest }) {
  const { members } = useCp();
  const L = useL();
  const list = onlySales ? members.filter((m) => m.crole) : members;
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {none ? <option value="">{none}</option> : null}
      {list.map((m) => <option key={m.userId} value={m.userId}>{m.name}{m.crole ? ' · ' + L.cRole[m.crole] : ''}</option>)}
    </select>
  );
}
export function ZoneSelect({ id, value, onChange, none, ...rest }) {
  const { zones } = useCp();
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">{none}</option>
      {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
    </select>
  );
}
/** Liste de choix simple à partir d'une table de libellés. */
export function MapSelect({ id, map, value, onChange, none, skip = [], ...rest }) {
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {none ? <option value="">{none}</option> : null}
      {Object.entries(map).filter(([k]) => k !== '' && !skip.includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

/** Téléchargement d'un fichier du module avec le cookie de connexion. */
export function useDownload() {
  const t = useT();
  const { orgId } = useWs();
  const { fail } = useCp();
  return (path, name) => fetch(API_BASE + '/api/ws/orgs/' + orgId + '/commercial' + path, { credentials: 'include' })
    .then((r) => { if (!r.ok) throw new Error(t('Téléchargement impossible.')); return r.blob(); })
    .then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }).catch(fail);
}

/** Lit un fichier choisi et renvoie son contenu en base64 (sans l'en-tête « data: »). */
export const readBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(new Error('read'));
  r.readAsDataURL(file);
});

/** Barre de progression simple (score, part). */
export function Meter({ value, max = 100, label }) {
  const w = Math.max(0, Math.min(100, max ? (value * 100) / max : 0));
  return <span className="cp-meter" role="img" aria-label={label}><i style={{ width: w + '%' }} /></span>;
}

/** Bloc d'erreur de chargement. */
export function Failed({ e }) { return <p className="ws-err" role="alert">{tsrv((e && e.message) || 'Erreur')}</p>; }

/** Ligne « libellé : valeur » des fiches. */
export function Facts({ items }) {
  return <dl className="cp-facts">{items.filter(Boolean).map(([k, v]) => (v === '' || v === null || v === undefined ? null : <div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>;
}

export function Ico({ name }) { return <Icon name={name} fixedWidth />; }
