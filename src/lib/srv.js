import { getLang, tr } from './i18n.jsx';

/* Traduction des textes que le serveur fabrique en français (alertes, score de santé…).
   Les textes fixes passent par le dictionnaire ; les phrases avec des nombres ou des noms sont reconnues par un modèle
   et traduites avec une clé à variables (ex. '{n} tâches en retard'). Un texte inconnu reste en français. */

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RULES = [];
/** Règle avec singulier / pluriel : `tail` = reste de la phrase (modèle, clé avec variables, noms des variables). */
function pl(one, many, tailRe = '', tailKey = '', names = []) {
  RULES.push({
    re: new RegExp('^(\\d+) (?:' + esc(one) + '|' + esc(many) + ')' + tailRe + '$'),
    one: '{n} ' + one + tailKey, many: '{n} ' + many + tailKey, names,
  });
}
/** Règle sans nombre : modèle, clé avec variables, noms des variables. */
function rule(re, key, names) { RULES.push({ re, key, names }); }

pl('demande urgente en attente', 'demandes urgentes en attente');
pl('demande sans réponse', 'demandes sans réponse', ' depuis plus de 48 h', ' depuis plus de 48 h');
pl('tâche en retard', 'tâches en retard');
pl('conversation client vous est attribuée', 'conversations clients vous sont attribuées');
pl('article en rupture', 'articles en rupture', ' : (.+)', ' : {list}', ['list']);
pl('article sous son seuil', 'articles sous leur seuil', ' : (.+)', ' : {list}', ['list']);
pl('commande attend', 'commandes attendent', ' votre validation', ' votre validation');
pl('facture impayée en retard', 'factures impayées en retard', ' \\((.+)\\), la plus ancienne depuis (\\d+) jours', ' ({amount}), la plus ancienne depuis {days} jours', ['amount', 'days']);
pl('commande de client attend', 'commandes de clients attendent', ' votre validation', ' votre validation');
pl('conversation attend', 'conversations attendent', ' un conseiller', ' un conseiller');
pl('rendez-vous attend', 'rendez-vous attendent', ' votre confirmation', ' votre confirmation');
pl('demande de congé attend', 'demandes de congé attendent', ' une réponse', ' une réponse');
pl('décision attend', 'décisions attendent', ' votre validation', ' votre validation');
rule(/^Projet « (.+) »$/, 'Projet « {name} »', ['name']);
rule(/^Budget · (.+)$/, 'Budget · {name}', ['name']);
rule(/^(\d+) % au-dessus de la limite \((.+) pour (.+)\)$/, '{pct} % au-dessus de la limite ({spent} pour {limit})', ['pct', 'spent', 'limit']);
rule(/^Les sorties dépassent les entrées ce mois-ci \(solde (.+)\)$/, 'Les sorties dépassent les entrées ce mois-ci (solde {balance})', ['balance']);

rule(/^Limite de messages IA atteinte \((.+) messages pour toute l'organisation sur la période en cours\)\. Elle se renouvelle le (.+), ou passez à une offre supérieure à la fin de votre abonnement\.$/, "Limite de messages IA atteinte ({n} messages pour toute l'organisation sur la période en cours). Elle se renouvelle le {date}, ou passez à une offre supérieure à la fin de votre abonnement.", ['n', 'date']);
rule(/^Patientez (\d+) s avant de redemander un code\.$/, 'Patientez {n} s avant de redemander un code.', ['n']);
rule(/^Vous pouvez avoir (\d+) webhooks au plus\.$/, 'Vous pouvez avoir {n} webhooks au plus.', ['n']);
rule(/^Vous pouvez avoir (\d+) clés au plus\. Supprimez-en une\.$/, 'Vous pouvez avoir {n} clés au plus. Supprimez-en une.', ['n']);
rule(/^L'offre (.+) permet (\d+) antenne\(s\)\. Passez à une offre supérieure pour en ajouter\.$/, "L'offre {plan} permet {n} antenne(s). Passez à une offre supérieure pour en ajouter.", ['plan', 'n']);
rule(/^Votre offre (.+) permet (\d+) organisation\(s\)\. Passez à une offre supérieure pour en créer d'autres\.$/, "Votre offre {plan} permet {n} organisation(s). Passez à une offre supérieure pour en créer d'autres.", ['plan', 'n']);
rule(/^Votre offre (.+) est active jusqu'au (.+)\. Un changement d'offre n'est possible qu'à la fin de l'abonnement : vous pourrez choisir l'offre (.+) à partir de cette date \(vous pouvez en attendant renouveler (.+)\)\.$/, "Votre offre {plan} est active jusqu'au {date}. Un changement d'offre n'est possible qu'à la fin de l'abonnement : vous pourrez choisir l'offre {next} à partir de cette date (vous pouvez en attendant renouveler {plan}).", ['plan', 'date', 'next']);
rule(/^Une demande de paiement de (.+) FCFA a été envoyée au (.+) \((.+)\)\. Confirmez-la sur votre téléphone avec votre code secret\. Votre offre (.+) s'activera automatiquement dès la confirmation\. Référence : (.+)\.$/, "Une demande de paiement de {amount} FCFA a été envoyée au {phone} ({op}). Confirmez-la sur votre téléphone avec votre code secret. Votre offre {plan} s'activera automatiquement dès la confirmation. Référence : {ref}.", ['amount', 'phone', 'op', 'plan', 'ref']);
rule(/^Envoyez (.+) FCFA par (.+) au (\S+) \(au nom de (.+)\)\. Dans le motif du transfert, écrivez la référence (\S+)\. Ensuite, saisissez ici l'ID de transaction reçu par SMS : nous validons votre paiement et activons votre offre (.+)\.$/, "Envoyez {amount} FCFA par {op} au {number} (au nom de {holder}). Dans le motif du transfert, écrivez la référence {ref}. Ensuite, saisissez ici l'ID de transaction reçu par SMS : nous validons votre paiement et activons votre offre {plan}.", ['amount', 'op', 'number', 'holder', 'ref', 'plan']);
rule(/^Envoyez (.+) FCFA par (.+) au (\S+)\. Dans le motif du transfert, écrivez la référence (\S+)\. Ensuite, saisissez ici l'ID de transaction reçu par SMS : nous validons votre paiement et activons votre offre (.+)\.$/, "Envoyez {amount} FCFA par {op} au {number}. Dans le motif du transfert, écrivez la référence {ref}. Ensuite, saisissez ici l'ID de transaction reçu par SMS : nous validons votre paiement et activons votre offre {plan}.", ['amount', 'op', 'number', 'ref', 'plan']);
rule(/^Le numéro de paiement n'est pas encore disponible\. Contactez-nous sur WhatsApp \(\+237 653 62 13 88\) en indiquant la référence (.+)\.$/, "Le numéro de paiement n'est pas encore disponible. Contactez-nous sur WhatsApp (+237 653 62 13 88) en indiquant la référence {ref}.", ['ref']);

// Quelques règles pour les rappels juridiques (texte fabriqué par le serveur avec des noms et des dates).
const WHEN = /^(aujourd'hui|demain|dans (\d+) jours)$/;
const whenTr = (w) => { const m = WHEN.exec(w); if (!m) return w; if (m[2]) return tr('dans {n} jours', { n: m[2] }); return tr(m[1]); };
rule(/^« (.+) » est expiré depuis le (.+)$/, '« {name} » est expiré depuis le {date}', ['name', 'date']);
rule(/^« (.+) » était à faire le (.+)$/, '« {name} » était à faire le {date}', ['name', 'date']);
rule(/^« (.+) » à faire (aujourd'hui|demain|dans \d+ jours) \((.+)\)$/, '« {name} » à faire {when} ({date})', ['name', 'when', 'date']);
rule(/^Étape du dossier « (.+) » prévue le (.+)$/, 'Étape du dossier « {name} » prévue le {date}', ['name', 'date']);
rule(/^(\d+) contrat\(s\) à signer : (.+)$/, '{n} contrat(s) à signer : {list}', ['n', 'list']);
rule(/^(\d+) autre\(s\) rappel\(s\) juridique\(s\) : ouvrez le module pour la liste complète$/, '{n} autre(s) rappel(s) juridique(s) : ouvrez le module pour la liste complète', ['n']);

rule(/^« (.+) » : terminé depuis le (.+) \(reconduction tacite : vérifiez si le contrat continue\)$/, '« {name} » : terminé depuis le {date} (reconduction tacite : vérifiez si le contrat continue)', ['name', 'date']);
rule(/^« (.+) » : expiré depuis le (.+)$/, '« {name} » : expiré depuis le {date}', ['name', 'date']);
rule(/^« (.+) » : se termine dans (\d+) jour\(s\)$/, '« {name} » : se termine dans {n} jour(s)', ['name', 'n']);
rule(/^« (.+) » : se termine dans (\d+) jours$/, '« {name} » : se termine dans {n} jours', ['name', 'n']);
rule(/^« (.+) » : date limite de préavis dépassée \((.+)\) : le contrat peut se reconduire$/, '« {name} » : date limite de préavis dépassée ({date}) : le contrat peut se reconduire', ['name', 'date']);
rule(/^« (.+) » : date limite de préavis dépassée \((.+)\)$/, '« {name} » : date limite de préavis dépassée ({date})', ['name', 'date']);
rule(/^« (.+) » : préavis à envoyer avant le (.+) \((\d+) jour\(s\)\)$/, '« {name} » : préavis à envoyer avant le {date} ({n} jour(s))', ['name', 'date', 'n']);
rule(/^« (.+) » : préavis à envoyer avant le (.+) \((\d+) jours\)$/, '« {name} » : préavis à envoyer avant le {date} ({n} jours)', ['name', 'date', 'n']);
rule(/^Dossier « (.+?) » : (.+?) (aujourd'hui|demain|dans \d+ jours) \((.+)\)$/, 'Dossier « {name} » : {step} {when} ({date})', ['name', 'step', 'when', 'date']);
rule(/^Dossier « (.+?) » (aujourd'hui|demain|dans \d+ jours) \((.+)\)$/, 'Dossier « {name} » {when} ({date})', ['name', 'when', 'date']);

// Vague 3 : alertes fabriquées par le serveur (délais de service client, échéances RH, paie, conformité, seuils réglables).
pl('demande a dépassé son délai (SLA)', 'demandes ont dépassé leur délai (SLA)');
pl('procédure est à réviser', 'procédures sont à réviser');
for (const what of ['fin de contrat', "fin de période d'essai", 'visite médicale', 'habilitation']) {
  rule(new RegExp('^' + esc(what) + ' de (.+) dépassée depuis le (.+)$'), what + ' de {who} dépassée depuis le {date}', ['who', 'date']);
  rule(new RegExp('^' + esc(what) + ' de (.+) avant le (.+)$'), what + ' de {who} avant le {date}', ['who', 'date']);
}
rule(/^Les créances clients \((.+)\) dépassent votre seuil$/, 'Les créances clients ({amount}) dépassent votre seuil', ['amount']);
rule(/^La trésorerie \((.+)\) est sous votre seuil$/, 'La trésorerie ({amount}) est sous votre seuil', ['amount']);
rule(/^Échéance dépassée \((.+?)\) · à vérifier$/, 'Échéance dépassée ({date}) · à vérifier', ['date']);
rule(/^Échéance dépassée \((.+?)\)$/, 'Échéance dépassée ({date})', ['date']);
rule(/^À faire avant le (.+?) · à vérifier$/, 'À faire avant le {date} · à vérifier', ['date']);
rule(/^À faire avant le (.+)$/, 'À faire avant le {date}', ['date']);

const FR_HINT = /[àâçéèêëîïôùûœ]|\b(vous|votre|vos|pour|dans|aucun|aucune|avec|cette|sont)\b/i;
/** Recherche sans signaler de manque (un texte déjà traduit n'est pas une erreur). */
function quiet(fn) {
  const w = typeof window !== 'undefined' ? window.__miaMissing : null;
  if (w) window.__miaMissing = null;
  try { return fn(); } finally { if (w) window.__miaMissing = w; }
}

/** Traduit un texte fourni par l'appelant ou par le serveur ; un texte inconnu reste tel quel (un manque n'est signalé que s'il ressemble à du français). */
export function tsrv(text) {
  if (typeof text !== 'string' || !text || getLang() === 'fr') return text == null ? '' : text;
  const direct = quiet(() => tr(text));
  if (direct !== text) return direct;
  // appareils connectés : « Chrome sur Mac »
  const dv = /^(Edge|Opera|Chrome|Firefox|Safari) sur (.+)$/.exec(text);
  if (dv) return tr('{browser} sur {os}', { browser: dv[1], os: tsrv(dv[2]) });
  // suffixe « · attribué à … » des rappels
  const at = / · attribué à (.+)$/.exec(text);
  if (at) {
    const rest = tsrv(text.slice(0, at.index));
    return rest + ' · ' + (at[1] === 'vous' ? tr('attribué à vous') : tr('attribué à {name}', { name: at[1] }));
  }
  // « À surveiller : service client, tâches. » : liste de titres de modules en minuscules
  const w = /^À surveiller : (.+)\.$/.exec(text);
  if (w) {
    const parts = w[1].split(', ').map((p) => {
      const cap = p.charAt(0).toUpperCase() + p.slice(1);
      const x = quiet(() => tr(cap));
      return x !== cap ? (getLang() === 'de' ? x : x.charAt(0).toLowerCase() + x.slice(1)) : p;
    });
    return tr('À surveiller : {list}.', { list: parts.join(', ') });
  }
  for (const r of RULES) {
    const m = r.re.exec(text);
    if (!m) continue;
    if (r.one) {
      const n = Number(m[1]);
      const vars = { n };
      r.names.forEach((k, i) => { vars[k] = m[i + 2]; });
      return tr(n > 1 ? r.many : r.one, vars);
    }
    const vars = {};
    r.names.forEach((k, i) => { vars[k] = k === 'when' ? whenTr(m[i + 1]) : m[i + 1]; });
    return tr(r.key, vars);
  }
  return FR_HINT.test(text) ? tr(text) : text;
}
