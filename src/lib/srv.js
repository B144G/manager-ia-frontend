import { getLang, tr } from './i18n.jsx';
import { WMS_TEMPLATES } from './srv-wms.js';

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
rule(/^Nouveau message de (.+) : l'IA est exclue pour ce contact, répondez-lui vous-même \(Suivi de l'IA\)\.$/, "Nouveau message de {name} : l'IA est exclue pour ce contact, répondez-lui vous-même (Suivi de l'IA).", ['name']);
rule(/^Réponse à valider pour (.+) : l'IA a préparé un brouillon \(Suivi de l'IA\)\.$/, "Réponse à valider pour {name} : l'IA a préparé un brouillon (Suivi de l'IA).", ['name']);
rule(/^Projet « (.+) »$/, 'Projet « {name} »', ['name']);
rule(/^Risque élevé signalé sur le projet « (.+) » : (.+)$/, 'Risque élevé signalé sur le projet « {name} » : {title}', ['name', 'title']);
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

// Stock entrepôt, préparation avancée (vagues, emballage, expéditions) : messages du serveur avec des codes et des noms.
rule(/^Ce n'est pas le bon emplacement : déposez en (.+)\.$/, "Ce n'est pas le bon emplacement : déposez en {code}.", ['code']);
rule(/^Ce n'est pas le bon emplacement : prenez en (.+)\.$/, "Ce n'est pas le bon emplacement : prenez en {code}.", ['code']);
rule(/^Ce n'est pas le bon emplacement : allez en (.+)\.$/, "Ce n'est pas le bon emplacement : allez en {code}.", ['code']);
rule(/^Ce n'est pas la bonne palette : prenez (.+)\.$/, "Ce n'est pas la bonne palette : prenez {code}.", ['code']);
rule(/^Ce n'est pas le bon article : attendu « (.+) »\.$/, "Ce n'est pas le bon article : attendu « {name} ».", ['name']);
// Pilotage de l'entrepôt (4E) : cour et quais
rule(/^Ce quai est déjà réservé sur ce créneau \((.+)\)\.$/, 'Ce quai est déjà réservé sur ce créneau ({code}).', ['code']);
rule(/^Ce quai est occupé \((.+)\)\.$/, 'Ce quai est occupé ({code}).', ['code']);
rule(/^Fermez d'abord le colis (\S+) au poste d'emballage\.$/, "Fermez d'abord le colis {code} au poste d'emballage.", ['code']);
rule(/^Ce colis est sur la palette (\S+) : scannez la palette\.$/, 'Ce colis est sur la palette {code} : scannez la palette.', ['code']);
rule(/^Ce colis est sur l'expédition (\S+) : retirez-le d'abord de l'expédition\.$/, "Ce colis est sur l'expédition {code} : retirez-le d'abord de l'expédition.", ['code']);
rule(/^Le colis (\S+) est sur l'expédition (\S+) : retirez-le d'abord de l'expédition\.$/, "Le colis {code} est sur l'expédition {s} : retirez-le d'abord de l'expédition.", ['code', 's']);
rule(/^Le colis (\S+) est posé sur (.+) : ajoutez la palette entière\.$/, 'Le colis {code} est posé sur {p} : ajoutez la palette entière.', ['code', 'p']);
rule(/^(Palette|Colis|Conteneur|Bac) (\S+) ne fait pas partie de l'expédition (\S+)\.$/, "{type} {code} ne fait pas partie de l'expédition {s}.", ['type', 'code', 's']);
rule(/^(Palette|Colis|Conteneur|Bac) (\S+) est déjà sur l'expédition (\S+)\.$/, "{type} {code} est déjà sur l'expédition {s}.", ['type', 'code', 's']);
rule(/^(Palette|Colis|Conteneur|Bac) (\S+) : déjà expédié\.$/, '{type} {code} : déjà expédié.', ['type', 'code']);
rule(/^(Palette|Colis|Conteneur|Bac) (\S+) ne contient aucun colis emballé\.$/, '{type} {code} ne contient aucun colis emballé.', ['type', 'code']);
rule(/^(Palette|Colis|Conteneur|Bac) (\S+) contient de la marchandise qui n'est emballée pour aucune commande\.$/, "{type} {code} contient de la marchandise qui n'est emballée pour aucune commande.", ['type', 'code']);
rule(/^(\d+) unité\(s\) ne sont pas encore chargées\. Expédier sans elles \? Elles seront retirées de l'expédition\.$/, "{n} unité(s) ne sont pas encore chargées. Expédier sans elles ? Elles seront retirées de l'expédition.", ['n']);
rule(/^(\d+) ligne\(s\) ne sont pas entièrement prélevées\. Terminer quand même \? Le reste ne sera pas préparé\.$/, '{n} ligne(s) ne sont pas entièrement prélevées. Terminer quand même ? Le reste ne sera pas préparé.', ['n']);
rule(/^La liste (\S+) est déjà commencée\.$/, 'La liste {code} est déjà commencée.', ['code']);
rule(/^La liste (\S+) est déjà commencée ou dans une autre vague\.$/, 'La liste {code} est déjà commencée ou dans une autre vague.', ['code']);
rule(/^La liste (\S+) est déjà commencée : elle reste dans la vague\.$/, 'La liste {code} est déjà commencée : elle reste dans la vague.', ['code']);
rule(/^Il n'y a que (\S+) (\S+) de « (.+) » dans ce colis\.$/, "Il n'y a que {q} {u} de « {name} » dans ce colis.", ['q', 'u', 'name']);
rule(/^Il ne reste que (\S+) (\S+) de « (.+) » à emballer\.$/, 'Il ne reste que {q} {u} de « {name} » à emballer.', ['q', 'u', 'name']);
rule(/^« (.+) » est déjà entièrement emballé\.$/, '« {name} » est déjà entièrement emballé.', ['name']);
rule(/^« (.+) » ne fait pas partie de cette commande\.$/, '« {name} » ne fait pas partie de cette commande.', ['name']);
rule(/^Il reste (\S+) à déplacer sur cette tâche\.$/, 'Il reste {q} à déplacer sur cette tâche.', ['q']);
rule(/^Tout n'est pas emballé : (.+)\.$/, "Tout n'est pas emballé : {list}.", ['list']);
rule(/^Aucune commande n'a pu entrer dans la vague : (.+)$/, "Aucune commande n'a pu entrer dans la vague : {list}", ['list']);
rule(/^Rien à préparer pour (.+) : aucun stock disponible\.$/, 'Rien à préparer pour {n} : aucun stock disponible.', ['n']);
// Flux spéciaux (4D) : transbordement, kits, services à valeur ajoutée
rule(/^Services obligatoires à terminer avant la sortie du stock : (.+)\.$/, 'Services obligatoires à terminer avant la sortie du stock : {list}.', ['list']);
rule(/^Il reste (\S+) (\S+) à transborder\.$/, 'Il reste {q} {u} à transborder.', ['q', 'u']);
rule(/^Aucun transbordement en attente pour « (.+) » : rangez-le normalement\.$/, 'Aucun transbordement en attente pour « {name} » : rangez-le normalement.', ['name']);
rule(/^Cette commande n'attend que (\S+) (\S+) de « (.+) »\.$/, "Cette commande n'attend que {q} {u} de « {name} ».", ['q', 'u', 'name']);
rule(/^Cette commande n'attend pas de « (.+) » \(déjà couverte par le stock, une liste ou un transbordement\)\.$/, "Cette commande n'attend pas de « {name} » (déjà couverte par le stock, une liste ou un transbordement).", ['name']);
rule(/^Stock insuffisant pour « (.+) » dans l'entrepôt : il manque (\S+) (\S+) \(hors stock promis aux préparations\)\.$/, "Stock insuffisant pour « {name} » dans l'entrepôt : il manque {q} {u} (hors stock promis aux préparations).", ['name', 'q', 'u']);
rule(/^Stock disponible insuffisant pour « (.+) » : (\S+) (\S+) \(il en faut (\S+)\)\.$/, 'Stock disponible insuffisant pour « {name} » : {q} {u} (il en faut {n}).', ['name', 'q', 'u', 'n']);
rule(/^Il reste (\S+) à assembler sur cet ordre\.$/, 'Il reste {q} à assembler sur cet ordre.', ['q']);
rule(/^Il reste (\S+) à désassembler sur cet ordre\.$/, 'Il reste {q} à désassembler sur cet ordre.', ['q']);
// Commandes clients (devis → commande)
rule(/^Ce devis est déjà devenu la commande (\S+) : facturez-la depuis l'onglet Commandes\.$/, "Ce devis est déjà devenu la commande {number} : facturez-la depuis l'onglet Commandes.", ['number']);
rule(/^Ce devis est déjà devenu la commande (\S+)\.$/, 'Ce devis est déjà devenu la commande {number}.', ['number']);
// Transport (TMS)
rule(/^Le véhicule (.+) est trop chargé \((.+)\)\.$/, 'Le véhicule {plate} est trop chargé ({detail}).', ['plate', 'detail']);
rule(/^Le permis de (.+) est périmé à la date de la tournée\.$/, 'Le permis de {name} est périmé à la date de la tournée.', ['name']);
rule(/^L'assurance du véhicule (.+) est périmée à la date de la tournée\.$/, "L'assurance du véhicule {plate} est périmée à la date de la tournée.", ['plate']);
rule(/^La visite technique du véhicule (.+) est périmée à la date de la tournée\.$/, 'La visite technique du véhicule {plate} est périmée à la date de la tournée.', ['plate']);
rule(/^Il reste (\d+) arrêt\(s\) sans issue \(livrée, échec ou report\) : (.+)\.$/, 'Il reste {n} arrêt(s) sans issue (livrée, échec ou report) : {list}.', ['n', 'list']);
rule(/^Le véhicule (.+) est déjà affecté à la tournée « (.+) » ce jour-là\.$/, 'Le véhicule {plate} est déjà affecté à la tournée « {name} » ce jour-là.', ['plate', 'name']);
rule(/^Le chauffeur (.+) est déjà affecté à la tournée « (.+) » ce jour-là\.$/, 'Le chauffeur {driver} est déjà affecté à la tournée « {name} » ce jour-là.', ['driver', 'name']);
rule(/^(\d+) ligne\(s\) à vérifier \((.+)\)\. Corrigez, ou validez quand même en expliquant pourquoi\.$/, '{n} ligne(s) à vérifier ({list}). Corrigez, ou validez quand même en expliquant pourquoi.', ['n', 'list']);
rule(/^Indiquez le montant encaissé \((.+) à encaisser\)\.$/, 'Indiquez le montant encaissé ({amount} à encaisser).', ['amount']);
// Entrepôt (WMS) : messages à variables, reconnus d'après leur modèle « … {nom} … » (les plus longs d'abord, pour que le plus précis gagne).
for (const k of [...WMS_TEMPLATES].sort((a, b) => b.length - a.length)) {
  const names = [];
  const src = esc(k).replace(/\\\{(\w+)\\\}/g, (m, n) => { names.push(n); return '(.+?)'; });
  rule(new RegExp('^' + src + '$'), k, names);
}

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
    r.names.forEach((k, i) => { vars[k] = k === 'when' ? whenTr(m[i + 1]) : k === 'type' ? quiet(() => tr(m[i + 1])) : m[i + 1]; });
    return tr(r.key, vars);
  }
  return FR_HINT.test(text) ? tr(text) : text;
}
