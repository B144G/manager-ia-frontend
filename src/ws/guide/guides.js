/* Contenu du guide interactif. Chaque guide = { id, group, title, keys, steps }.
   Une étape : { to, at, title, text, click, optional, nav }
     to       sous-application à ouvrir avant l'étape
     at       où pointer la flèche : css(…), nav(…), tab(…), btn(…), fld(…) (ou une liste d'essais)
     click    l'utilisateur clique lui-même sur l'élément (« Le faire pour moi » le fait à sa place)
     optional l'étape est sautée si l'élément n'existe pas (ex. bouton réservé aux responsables)
     nav      sur téléphone, ouvre le menu avant l'étape
   Les textes passent par la fonction de traduction t : ils sont traduits et contrôlés par scripts/i18n-check.mjs.
   Les repères par texte (btn, tab, fld) reprennent les libellés exacts de l'écran, déjà traduits. */

const css = (sel) => ({ sel });
const nav = (id) => ({ sel: `.ws-nav a[href$="/${id}"]` });
const fld = (k) => ({ sel: `.ws-modal label[for="f_${k}"]` }); // champ de formulaire, par identifiant : fonctionne dans toutes les langues
const send = css('.ws-modal button[type="submit"]');
const head = css('.ws-mod h1');

export function buildGuides(t, { admin, mods }) {
  // Les libellés des boutons et onglets sont ceux de l'écran : on les traduit pour retrouver l'élément dans la langue affichée.
  const tab = (text) => ({ sel: '.ws-tabs .tab, .ws-tabs button', text: t(text) });
  const btn = (text) => ({ sel: 'button, a.btn', text: t(text) });
  const has = (id) => mods.includes(id);
  const out = [];
  const add = (g) => { out.push({ keys: '', ...g }); };
  // « Ouvrir la sous-application » : première étape de chaque guide
  const open = (id, title, text) => ({ to: id, at: nav(id), nav: true, click: true, title, text });

  const G1 = t('Prise en main');
  add({ id: 'welcome', group: G1, title: t("Visite de l'espace de travail"), keys: 'bienvenue découvrir démarrer menu', steps: [
    { title: t('Bienvenue sur Brij-IA'), text: t("En une minute, vous allez voir où se trouve chaque chose. Utilisez « Suivant », ou les flèches du clavier. « Échap » quitte le guide à tout moment.") },
    { at: css('.ws-nav'), nav: true, title: t('Vos sous-applications'), text: t("Chaque métier a sa sous-application : clients, stock, budget, équipe… Cliquez sur l'une d'elles pour l'ouvrir. Le menu ne montre que ce que votre rôle permet.") },
    { at: css('.org-sel'), nav: true, optional: true, title: t('Votre organisation'), text: t("Ici, vous changez d'organisation ou vous en créez une nouvelle. Tout ce que vous voyez appartient à l'organisation choisie.") },
    { at: css('.ws-ask'), title: t("Demandez à l'IA"), text: t("Écrivez une question en français : « Quelles factures relancer ? », « Qu'est-ce qui manque en stock ? ». L'IA lit vos données et vous répond.") },
    { at: css('.bell'), title: t('Les alertes'), text: t("La cloche signale ce qui est urgent : factures en retard, stock bas, tâches en retard. Un point rouge veut dire « à voir maintenant ».") },
    { at: css('#aiBtn'), title: t("L'assistant IA"), text: t("Ce bouton ouvre la discussion avec l'assistant. Il connaît la sous-application ouverte et peut préparer des actions que vous validez vous-même.") },
    { at: css('.ws-user'), title: t('Votre compte'), text: t('Cliquez ici pour sécuriser votre compte : mot de passe, double vérification, appareils connectés.') },
    { at: css('#guideBtn'), title: t('Je reste à votre disposition'), text: t('Ce bouton « Guide » contient un guide pas à pas pour chaque tâche : créer une facture, ajouter un article, lancer la paie… Choisissez, et les flèches vous montrent quoi faire.') },
  ] });

  if (has('dashboard')) add({ id: 'dashboard', group: G1, title: t('Lire le tableau de bord'), keys: 'accueil chiffres indicateurs', steps: [
    open('dashboard', t('Ouvrez le tableau de bord'), t("C'est votre page d'accueil : l'essentiel de l'organisation sur un seul écran.")),
    { at: head, title: t("L'essentiel du jour"), text: t("En haut : un résumé de votre journée. Plus bas : les chiffres clés, les alertes et les prochaines échéances.") },
    { at: css('.ws-mod .ws-card'), title: t('Des cartes cliquables'), text: t('Chaque carte résume un domaine (ventes, stock, tâches…). Cliquez sur un chiffre ou un titre pour ouvrir le détail dans la sous-application correspondante.') },
    { at: css('.bell'), title: t('Que faire en premier ?'), text: t("Commencez par les alertes : elles sont classées de la plus urgente à la moins urgente, avec un bouton « Que faire ? » qui explique la marche à suivre.") },
  ] });

  if (has('crm')) {
    const G = t('Clients et ventes');
    add({ id: 'crm-customer', group: G, title: t('Ajouter un client'), keys: 'client fiche contact prospect', steps: [
      open('crm', t('Ouvrez Clients et ventes'), t('Toutes vos fiches clients, devis, factures et paiements sont ici.')),
      { at: tab('Clients'), optional: true, title: t("L'onglet Clients"), text: t('La liste de vos clients. Pour en ajouter un, utilisez le bouton « Ajouter un client ».') },
      { at: btn('Ajouter un client'), click: true, optional: true, title: t('Nouveau client'), text: t('Cliquez pour ouvrir la fiche vide.') },
      { at: fld('name'), title: t('Son nom'), text: t("Seul le nom est obligatoire. Le reste peut être complété plus tard.") },
      { at: fld('phone'), optional: true, title: t('Son téléphone'), text: t("Le numéro WhatsApp permet d'envoyer facture et relance en un clic.") },
      { at: send, title: t('Enregistrer'), text: t('Cliquez pour enregistrer. Le client apparaît dans la liste et pourra recevoir devis et factures.') },
    ] });
    add({ id: 'crm-invoice', group: G, title: t('Créer une facture'), keys: 'facture devis tva client vente', steps: [
      open('crm', t('Ouvrez Clients et ventes'), t('Les factures se créent depuis cette sous-application.')),
      { at: btn('Nouvelle facture'), click: true, optional: true, title: t('Nouvelle facture'), text: t('Cliquez pour ouvrir le formulaire de facture. Pour un devis, utilisez « Nouveau devis » : le principe est le même.') },
      { at: fld('customerId'), title: t('Choisissez le client'), text: t("Il doit exister dans vos fiches. Sinon, fermez et ajoutez-le d'abord (guide « Ajouter un client »).") },
      { at: fld('lines'), title: t('Écrivez les lignes'), text: t('Une ligne par article, au format « Désignation ; quantité ; prix ». Exemple : Pagne ; 2 ; 15000.') },
      { at: fld('pricesIncl'), optional: true, title: t('TTC ou HT ?'), text: t('Précisez si vos prix incluent déjà la TVA. Le taux (19,25 % au Cameroun) est modifiable juste en dessous.') },
      { at: send, title: t('Créer la facture'), text: t('Cliquez pour créer. Un numéro est donné automatiquement et une écriture comptable est préparée.') },
      { at: tab('Factures'), click: true, optional: true, title: t('Retrouvez-la ici'), text: t("L'onglet Factures liste tout. Sur chaque ligne : télécharger le PDF, envoyer par e-mail ou WhatsApp, enregistrer un paiement reçu, créer un avoir.") },
    ] });
    add({ id: 'crm-payment', group: G, title: t('Encaisser un paiement et relancer'), keys: 'paiement impayé relance retard encaisser mobile money', steps: [
      open('crm', t('Ouvrez Clients et ventes'), t('Les paiements et les relances se gèrent dans les factures.')),
      { at: tab('Factures'), click: true, optional: true, title: t('Ouvrez les factures'), text: t('Les factures en retard sont signalées en rouge.') },
      { at: btn('Paiement reçu'), optional: true, title: t('Paiement reçu'), text: t("Quand un client paie (espèces, MTN ou Orange Money, banque), cliquez sur « Paiement reçu » sur sa facture : choisissez le mode, indiquez le montant et la référence de la transaction.") },
      { at: btn('Centre de relances'), optional: true, title: t('Relancer les impayés'), text: t("Le centre de relances prépare un message poli pour chaque facture en retard. Vous le relisez, puis vous l'envoyez : rien ne part sans vous.") },
    ] });
  }

  if (has('budget')) {
    const G = t('Argent et comptabilité');
    add({ id: 'budget-entry', group: G, title: t('Noter une dépense ou une recette'), keys: 'budget dépense recette entrée sortie argent loyer', steps: [
      open('budget', t('Ouvrez le Budget'), t("Vos entrées et sorties d'argent, mois par mois.")),
      { at: btn('Ajouter une ligne'), click: true, optional: true, title: t('Nouvelle opération'), text: t('Cliquez pour saisir une dépense ou une recette.') },
      { at: fld('kind'), title: t('Sortie ou entrée ?'), text: t("Une sortie est une dépense (loyer, salaires…). Une entrée est de l'argent reçu (ventes…).") },
      { at: fld('category'), title: t('La catégorie'), text: t('Elle sert à voir où part votre argent : Loyer, Salaires, Transport, Ventes…') },
      { at: fld('amount'), title: t('Le montant'), text: t('Saisissez le montant sans espace, dans la monnaie de votre organisation.') },
      { at: fld('ledger'), optional: true, title: t('Une seule saisie'), text: t("Choisissez « Oui » pour que l'opération soit aussi écrite en comptabilité : plus de double saisie.") },
      { at: send, title: t('Enregistrer'), text: t('Cliquez pour enregistrer. Le solde du mois est mis à jour.') },
    ] });
    add({ id: 'budget-limits', group: G, title: t('Fixer des limites de dépenses'), keys: 'budget limite plafond trésorerie validation', steps: [
      open('budget', t('Ouvrez le Budget'), t('Les limites se règlent depuis cet écran.')),
      { at: btn('Limites'), click: true, optional: true, title: t('Limites mensuelles'), text: t("Fixez un montant maximum par catégorie. Brij-IA vous alerte quand vous approchez de la limite.") },
      { at: tab('Trésorerie'), optional: true, title: t('La trésorerie'), text: t("Cet onglet montre l'argent disponible aujourd'hui et ce qui est prévu dans les prochaines semaines.") },
      { at: tab('Validations'), optional: true, title: t('Les validations'), text: t('Les dépenses importantes peuvent demander l\'accord d\'un responsable : elles attendent ici.') },
    ] });
  }

  if (has('accounting')) {
    const G = t('Argent et comptabilité');
    add({ id: 'accounting-tour', group: G, title: t('Comptabilité : écritures, banque, clôture'), keys: 'comptabilité écriture journal balance bilan rapprochement bancaire clôture ohada', steps: [
      open('accounting', t('Ouvrez la Comptabilité'), t('Le plan comptable OHADA est préparé : les factures et les paiements y créent des écritures automatiquement.')),
      { at: tab('Journal'), click: true, optional: true, title: t('Le journal'), text: t("Toutes les écritures, de la plus récente à la plus ancienne. Une écriture validée n'est plus modifiable : on la corrige par une écriture inverse.") },
      { at: btn('Nouvelle écriture'), optional: true, title: t('Une écriture à la main'), text: t('Pour une opération sans facture : choisissez les comptes au débit et au crédit. Le total doit être équilibré.') },
      { at: tab('Rapprochement'), click: true, optional: true, title: t('Le rapprochement bancaire'), text: t("Importez le relevé de la banque ou du Mobile Money : Brij-IA liste les lignes à pointer. Pour chacune, vous pointez, écrivez en comptabilité ou ignorez.") },
      { at: tab('Résultat et bilan'), optional: true, title: t('Résultat et bilan'), text: t("Les états de fin d'exercice se calculent à partir des écritures. Ce sont des documents de travail à faire valider par votre expert-comptable.") },
      { at: tab('Clôture'), optional: true, title: t('La clôture'), text: t("En fin de période, vérifiez puis clôturez : les écritures de la période sont alors verrouillées.") },
    ] });
  }

  if (has('stock')) {
    const G = t('Stock et production');
    add({ id: 'stock-item', group: G, title: t('Ajouter un article en stock'), keys: 'stock article produit quantité seuil inventaire', steps: [
      open('stock', t('Ouvrez Stock et achats'), t('Vos articles, fournisseurs et commandes sont ici.')),
      { at: btn('Ajouter un article'), click: true, optional: true, title: t('Nouvel article'), text: t('Cliquez pour créer la fiche de l\'article.') },
      { at: fld('name'), title: t("Le nom de l'article"), text: t('Donnez un nom clair : « Contreplaqué 18 mm », « Farine 25 kg ».') },
      { at: fld('unit'), optional: true, title: t("L'unité"), text: t('Pièce, kilo, litre, sac… Elle apparaît partout avec la quantité.') },
      { at: fld('quantity'), optional: true, title: t('La quantité de départ'), text: t("Ce que vous avez déjà. Ensuite, utilisez « Entrée » et « Sortie » sur la ligne de l'article : l'historique garde la trace de chaque mouvement.") },
      { at: send, title: t('Enregistrer'), text: t("Cliquez pour enregistrer. En dessous du seuil, l'article sera signalé « Sous le seuil ».") },
    ] });
    add({ id: 'stock-order', group: G, title: t('Commander ce qui manque'), keys: 'stock commande fournisseur achat réception rupture', steps: [
      open('stock', t('Ouvrez Stock et achats'), t('Les commandes se préparent à partir des alertes de stock.')),
      { at: btn('Commander ce qui manque'), click: true, optional: true, title: t('Commandes proposées'), text: t("Brij-IA regroupe les articles sous le seuil par fournisseur et crée des commandes à valider. Rien n'est commandé sans votre accord.") },
      { at: btn('Fournisseurs'), optional: true, title: t('Vos fournisseurs'), text: t("Gardez ici leurs contacts, leurs prix et leurs délais. L'onglet « fiabilité » note leurs retards.") },
      { at: tab('Inventaire'), optional: true, title: t("L'inventaire"), text: t('Comptez vos articles réels, saisissez les quantités : Brij-IA montre les écarts et ajuste le stock après votre validation.') },
    ] });
  }

  if (has('support')) {
    const G = t('Clients et ventes');
    add({ id: 'support-ticket', group: G, title: t('Enregistrer et traiter une demande client'), keys: 'support service client demande réclamation ticket sav', steps: [
      open('support', t('Ouvrez le Service client'), t('Toutes les demandes de vos clients au même endroit.')),
      { at: btn('Nouvelle demande'), click: true, optional: true, title: t('Nouvelle demande'), text: t("Un client vous appelle ou vous écrit ? Notez sa demande ici pour ne rien oublier.") },
      { at: fld('customerName'), title: t('Qui est-ce ?'), text: t('Son nom, puis son contact pour pouvoir le rappeler.') },
      { at: fld('subject'), title: t('Le sujet'), text: t('Une phrase courte : « Colis non reçu », « Erreur sur la facture ».') },
      { at: fld('priority'), optional: true, title: t('La priorité'), text: t('« Urgente » remonte la demande en tête de liste.') },
      { at: send, title: t('Enregistrer'), text: t('La demande arrive dans « À traiter ». Ouvrez-la pour répondre : l\'IA peut proposer une réponse que vous relisez.') },
      { at: btn('Formulaire client'), optional: true, title: t('Le formulaire client'), text: t("Partagez ce lien : vos clients déposent eux-mêmes leur demande, qui arrive directement ici.") },
    ] });
  }

  if (has('hr')) {
    const G = t('Équipe et paie');
    add({ id: 'hr-employee', group: G, title: t('Ajouter un employé'), keys: 'rh employé salarié personnel embauche poste salaire', steps: [
      open('hr', t('Ouvrez les Ressources humaines'), t('Votre équipe, ses congés et son planning.')),
      { at: btn('Ajouter un employé'), click: true, optional: true, title: t('Nouvel employé'), text: t("Cliquez pour ouvrir sa fiche. Elle servira au planning, aux congés et à la paie.") },
      { at: fld('name'), title: t('Son nom'), text: t('Son nom complet, tel qu\'il apparaîtra sur ses bulletins.') },
      { at: fld('job'), optional: true, title: t('Son poste'), text: t("Le poste sert à partager des documents à tous les employés d'un même poste.") },
      { at: fld('salary'), optional: true, title: t('Son salaire'), text: t("Visible seulement par les administrateurs. La paie du mois part de ce montant.") },
      { at: send, title: t('Enregistrer'), text: t('Cliquez pour enregistrer. Vous pourrez ensuite remplir son dossier, son contrat et suivre son pointage.') },
    ] });
    add({ id: 'hr-planning', group: G, title: t('Planning, congés et pointage'), keys: 'planning congé absence pointage présence horaire', steps: [
      open('hr', t('Ouvrez les Ressources humaines'), t('Le planning et les congés sont dans les onglets.')),
      { at: tab('Planning'), click: true, optional: true, title: t('Le planning'), text: t("Qui travaille quand. Brij-IA signale les trous et les jours où trop de personnes sont absentes.") },
      { at: tab('Soldes'), optional: true, title: t('Les soldes de congés'), text: t('Combien de jours chacun a pris et lui reste. Les demandes de congé arrivent chez le responsable, qui accepte ou refuse.') },
      { at: tab('Pointage'), optional: true, title: t('Le pointage'), text: t("Les heures d'arrivée et de départ servent ensuite au calcul des heures supplémentaires.") },
    ] });
  }

  if (has('payroll') && admin) {
    const G = t('Équipe et paie');
    add({ id: 'payroll-run', group: G, title: t('Lancer la paie du mois'), keys: 'paie bulletin salaire cnps virement', steps: [
      open('payroll', t('Ouvrez la Paie'), t('Réservé aux administrateurs : les bulletins se préparent mois par mois.')),
      { at: btn('Lancer la paie du mois'), click: true, optional: true, title: t('Lancer la paie'), text: t("Brij-IA calcule un bulletin par employé à partir de sa fiche. Vérifiez chaque bulletin avant de le valider.") },
      { at: tab('Bulletins'), optional: true, title: t('Les bulletins'), text: t("Après validation, chaque salarié ne reçoit que le sien. Ce sont des documents de travail à faire valider par un expert.") },
      { at: tab('Déclarations et virements'), optional: true, title: t('Déclarations et virements'), text: t('Préparez ici le fichier de virement et les montants à déclarer.') },
    ] });
  }

  if (has('projects')) {
    const G = t('Projets et chantiers');
    add({ id: 'proj-new', group: G, title: t('Créer un projet et ses tâches'), keys: 'projet tâche planning gantt échéance budget', steps: [
      open('projects', t('Ouvrez Projets et tâches'), t("Découpez vos objectifs en tâches et suivez l'avancement.")),
      { at: btn('Nouveau projet'), click: true, optional: true, title: t('Nouveau projet'), text: t('Cliquez pour créer un projet.') },
      { at: fld('name'), title: t('Son nom'), text: t('Donnez-lui le nom du résultat attendu : « Ouverture de la boutique », « Chantier Bastos ».') },
      { at: fld('due'), optional: true, title: t('Sa date de fin'), text: t("Brij-IA s'en sert pour signaler les retards.") },
      { at: send, title: t('Créer'), text: t('Le projet s\'ouvre. Ajoutez maintenant ses tâches, avec une personne responsable et une date pour chacune.') },
      { at: btn('Ajouter une tâche'), optional: true, title: t('Ajouter une tâche'), text: t("Une tâche = une action avec un responsable et une date. Dans la frise du planning, une tâche en retard décale celles qui en dépendent.") },
    ] });
  }

  if (has('marketing')) {
    const G = t('Clients et ventes');
    add({ id: 'marketing-campaign', group: G, title: t('Lancer une campagne et suivre ses résultats'), keys: 'marketing campagne publicité publication promo whatsapp facebook', steps: [
      open('marketing', t('Ouvrez le Marketing'), t('Vos campagnes, publications et offres.')),
      { at: tab('Campagnes'), click: true, optional: true, title: t('Les campagnes'), text: t('Chaque campagne a un canal, un budget et des dates. Ouvrez cet onglet pour les voir et en créer.') },
      { at: btn('Nouvelle campagne'), click: true, optional: true, title: t('Nouvelle campagne'), text: t("Choisissez le canal (WhatsApp, Facebook, affiche, radio…), le budget et les dates.") },
      { at: send, optional: true, title: t('Enregistrer'), text: t("Pendant la campagne, notez les résultats : Brij-IA compare ce que chaque canal rapporte.") },
      { at: tab('Calendrier'), click: true, optional: true, title: t('Le calendrier'), text: t('Vos publications planifiées, jour après jour.') },
      { at: btn('Nouvelle publication'), optional: true, title: t('Calendrier des publications'), text: t('Planifiez vos publications à l\'avance : idée, prête, publiée.') },
    ] });
  }

  if (has('sales')) {
    const G = t('Clients et ventes');
    add({ id: 'sales-agent', group: G, title: t("L'assistant commercial qui répond aux prospects"), keys: 'prospect commande conversation catalogue whatsapp rendez-vous négociation relance', steps: [
      open('sales', t("Ouvrez l'Assistant commercial"), t("Après une publicité, l'IA répond à vos prospects 24 h sur 24 et enregistre leurs commandes.")),
      { at: tab('Catalogue'), click: true, optional: true, title: t('Votre catalogue'), text: t("Renseignez ici vos produits et vos prix : l'IA ne propose que ce qui est dans le catalogue.") },
      { at: tab('Conversations'), optional: true, title: t('Les conversations'), text: t("Relisez ce que l'IA répond. Vous pouvez reprendre la main à tout moment.") },
      { at: tab('Commandes'), optional: true, title: t('Les commandes'), text: t("Les commandes prises par l'IA arrivent ici, à confirmer et livrer.") },
      { at: tab('Négociation'), optional: true, title: t('La négociation'), text: t("Fixez la remise maximale autorisée : l'IA ne descendra jamais plus bas.") },
    ] });
  }

  if (has('logistics')) {
    const G = t('Stock et production');
    add({ id: 'logistics-delivery', group: G, title: t('Organiser une livraison'), keys: 'logistique livraison tournée livreur transporteur véhicule', steps: [
      open('logistics', t('Ouvrez la Logistique'), t('Vos livraisons, vos livreurs et vos tournées.')),
      { at: btn('Nouvelle livraison'), click: true, optional: true, title: t('Nouvelle livraison'), text: t("Indiquez le client, l'adresse et la zone. Le coût de livraison se calcule à partir de la zone.") },
      { at: tab('Tournées'), optional: true, title: t('Les tournées'), text: t('Regroupez plusieurs livraisons dans une tournée pour un même livreur.') },
      { at: tab('Transporteurs'), optional: true, title: t('Transporteurs et zones'), text: t('Comparez vos transporteurs et fixez vos tarifs par zone.') },
    ] });
  }

  if (has('production')) {
    const G = t('Stock et production');
    add({ id: 'production-order', group: G, title: t('Fabriquer : nomenclature et ordre de fabrication'), keys: 'production fabrication recette nomenclature coût de revient matière', steps: [
      open('production', t('Ouvrez la Production'), t('Vos recettes, leur coût de revient et vos ordres de fabrication.')),
      { at: tab('Nomenclatures'), click: true, optional: true, title: t('La nomenclature'), text: t("La recette d'un produit : les matières premières et leurs quantités. Brij-IA en déduit le coût de revient.") },
      { at: btn('Nouvelle nomenclature'), optional: true, title: t('Nouvelle recette'), text: t('Créez-la une fois ; elle sert ensuite à chaque fabrication.') },
      { at: tab('Ordres de fabrication'), optional: true, title: t('Les ordres de fabrication'), text: t("Un ordre consomme les matières du stock et ajoute le produit fini. Brij-IA vous dit s'il manque quelque chose avant de commencer.") },
    ] });
  }

  if (has('construction')) add({ id: 'construction-site', group: t('Projets et chantiers'), title: t('Suivre un chantier'), keys: 'chantier btp phase situation dépense avancement', steps: [
    open('construction', t('Ouvrez les Chantiers'), t('Vos chantiers : avancement, dépenses, équipe et paiements du client.')),
    { at: btn('Nouveau chantier'), click: true, optional: true, title: t('Nouveau chantier'), text: t('Indiquez le client, le budget et les dates.') },
    { at: send, optional: true, title: t('Enregistrer'), text: t("Ensuite, ajoutez les phases, les dépenses et les situations de travaux : l'écart avec le budget se calcule seul.") },
  ] });

  if (has('maintenance')) add({ id: 'maintenance-eq', group: t('Stock et production'), title: t('Suivre l\'entretien des équipements'), keys: 'maintenance machine panne équipement entretien préventif', steps: [
    open('maintenance', t('Ouvrez la Maintenance'), t('Vos équipements, leur entretien et leurs pannes.')),
    { at: btn('Ajouter un équipement'), click: true, optional: true, title: t('Nouvel équipement'), text: t('Machine, véhicule, groupe électrogène… Un équipement = une fiche avec son historique.') },
    { at: tab('Plans préventifs'), optional: true, title: t('Les plans préventifs'), text: t('Programmez les entretiens à intervalles réguliers : vous êtes alerté avant la panne.') },
    { at: tab('Indicateurs'), optional: true, title: t('Les indicateurs'), text: t('Pannes, durée des arrêts, coût : voyez quelles machines vous coûtent le plus.') },
  ] });

  if (has('legal')) add({ id: 'legal-tour', group: t('Autres sous-applications'), title: t('Contrats, échéances et obligations'), keys: 'juridique contrat échéance obligation litige registre conformité', steps: [
    open('legal', t('Ouvrez le Juridique'), t('Vos contrats, vos échéances et vos obligations.')),
    { at: tab('Contrats'), click: true, optional: true, title: t('Les contrats'), text: t('Enregistrez vos contrats avec leur date de fin : vous êtes prévenu avant le renouvellement.') },
    { at: tab('Obligations'), optional: true, title: t('Les obligations'), text: t('Ce que vous devez faire et quand (déclarations, renouvellements, visites).') },
    { at: tab('Conformité Cameroun'), optional: true, title: t('Conformité Cameroun'), text: t('Une liste de contrôle des obligations courantes. Ce sont des repères de travail : faites confirmer par un professionnel du droit.') },
  ] });

  if (has('fiscal') && admin) add({ id: 'fiscal-tour', group: t('Argent et comptabilité'), title: t('Fiscalité : TVA et liasse de fin d\'exercice'), keys: 'fiscalité tva liasse impôt déclaration exercice', steps: [
    open('fiscal', t('Ouvrez la Fiscalité'), t("Préparez votre fin d'exercice et suivez vos échéances.")),
    { at: tab('Calendrier'), optional: true, title: t('Le calendrier fiscal'), text: t('Les dates à ne pas manquer, avec un rappel avant chaque échéance.') },
    { at: tab('TVA du mois'), click: true, optional: true, title: t('La TVA du mois'), text: t("Une estimation de la TVA collectée moins la TVA déductible. À vérifier avant toute déclaration.") },
    { at: tab("Liasse de fin d'exercice"), optional: true, title: t('La liasse'), text: t("Le document de fin d'exercice se prépare à partir de la comptabilité. À faire valider par votre expert-comptable.") },
  ] });

  if (has('structure')) add({ id: 'structure-tour', group: t('Équipe et paie'), title: t("Organiser les postes de l'entreprise"), keys: 'organisation poste organigramme responsable', steps: [
    open('structure', t("Ouvrez l'Organisation"), t('Qui fait quoi, et qui rend compte à qui.')),
    { at: btn('Ajouter un poste'), click: true, optional: true, title: t('Ajouter un poste'), text: t("Un poste a un nom, une mission et un responsable. Brij-IA signale les zones floues et les postes sans titulaire.") },
  ] });

  if (has('team')) add({ id: 'team-invite', group: t('Équipe et paie'), title: t('Inviter quelqu\'un et gérer les antennes'), keys: 'équipe inviter membre rôle antenne accès code', steps: [
    open('team', t('Ouvrez Équipe et antennes'), t('Les personnes qui ont accès, leur rôle et vos antennes.')),
    { at: btn("Inviter quelqu'un"), click: true, optional: true, title: t('Inviter'), text: t("Choisissez un rôle (membre, responsable, administrateur) : il définit ce que la personne peut voir et faire. Un code d'invitation est créé pour elle.") },
    { at: btn('Ajouter une antenne'), optional: true, title: t('Les antennes'), text: t('Une antenne = un site ou une boutique. Vous pouvez limiter une personne à son antenne.') },
  ] });

  if (has('processes')) add({ id: 'processes-tour', group: t('Autres sous-applications'), title: t('Écrire une procédure'), keys: 'procédure fonctionnement mode opératoire checklist', steps: [
    open('processes', t('Ouvrez Fonctionnement'), t('Les procédures de votre activité, pour que tout tourne même en votre absence.')),
    { at: btn('Nouvelle procédure'), click: true, optional: true, title: t('Nouvelle procédure'), text: t("Décrivez les étapes pour une tâche répétitive : ouverture de la boutique, prise de commande, clôture de caisse.") },
  ] });

  if (has('memory')) add({ id: 'memory-tour', group: t('Autres sous-applications'), title: t("La mémoire de l'entreprise"), keys: 'mémoire décision réunion incident leçon note recherche', steps: [
    open('memory', t('Ouvrez la Mémoire'), t('Décisions, incidents, réunions et leçons apprises.')),
    { at: btn('Nouvelle note'), click: true, optional: true, title: t('Garder une trace'), text: t("Notez une décision ou une leçon avec sa raison. Dans six mois, vous saurez pourquoi.") },
    { at: btn('Demander à la mémoire'), optional: true, title: t('Poser une question'), text: t("Demandez « Pourquoi avons-nous choisi ce fournisseur ? » : l'IA cherche dans vos notes.") },
  ] });

  if (has('alerts')) add({ id: 'alerts-tour', group: G1, title: t('Comprendre les alertes'), keys: 'alerte urgent que faire retard', steps: [
    open('alerts', t('Ouvrez les Alertes'), t("Ce que Brij-IA a repéré dans votre organisation.")),
    { at: css('.ws-mod .ws-card, .ws-mod .alert'), optional: true, title: t('Classées par urgence'), text: t("Les plus urgentes sont en haut. Chaque alerte dit ce qui se passe, et un bouton « Que faire ? » propose la suite.") },
    { at: css('.bell'), title: t('Aussi dans la cloche'), text: t("Un point rouge sur la cloche signale une alerte urgente. Vous pouvez aussi recevoir un résumé du matin par e-mail.") },
  ] });

  if (has('integrations') && admin) add({ id: 'integrations-tour', group: t('Autres sous-applications'), title: t('Relier Brij-IA à vos autres outils'), keys: 'intégration api clé webhook zapier', steps: [
    open('integrations', t('Ouvrez les Intégrations'), t('Zapier, webhooks et clés pour relier vos autres outils.')),
    { at: btn('Créer une clé'), click: true, optional: true, title: t('Une clé d\'accès'), text: t("Elle permet à un autre outil de lire (ou d'ajouter) des données. Gardez-la secrète : elle ne s'affiche qu'une fois.") },
    { at: btn('Ajouter un webhook'), optional: true, title: t('Un webhook'), text: t('Brij-IA prévient un autre service dès qu\'un événement arrive (nouvelle facture, nouveau client…).') },
  ] });

  if (has('agents')) add({ id: 'agents-tour', group: t('Autres sous-applications'), title: t("Votre équipe d'agents IA"), keys: 'agent ia assistant digest automatique', steps: [
    open('agents', t("Ouvrez l'équipe d'agents"), t('Des agents IA spécialisés par domaine.')),
    { at: head, title: t('Ce que fait un agent'), text: t("Il lit vos données, repère ce qui doit l'être et vous propose des actions. Vous validez toujours : un agent ne décide pas à votre place.") },
  ] });

  if (has('billing')) add({ id: 'billing-tour', group: t('Autres sous-applications'), title: t('Votre abonnement et vos quotas'), keys: 'abonnement offre plan quota paiement facture', steps: [
    open('billing', t("Ouvrez l'Abonnement"), t('Votre offre, vos quotas et vos paiements.')),
    { at: head, title: t('Vos limites'), text: t("Vous voyez ici le nombre de personnes, de messages IA et d'e-mails inclus dans votre offre, et ce qui reste ce mois-ci.") },
  ] });

  return out;
}
