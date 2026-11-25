# Espaces par rôle · côté site

Le fonctionnement complet (droits, niveaux, routes serveur) est décrit dans `docs/espaces-par-role.md` du dépôt serveur. Cette page ne couvre que la **navigation** du site.

## Navigation (pied de page des espaces)

- **Les espaces sont en bas de l'écran** : barre `SpaceDock` (`src/ws/spaces/SpaceFrame.jsx`), sous la zone de contenu et le pied de page légal, collée en bas. Une entrée par espace de la personne (icône + libellé court : Direction, Commercial, Finances, Stock, RH, Opérations, Projets, Juridique, Compte), l'espace actif en surbrillance (`aria-current="page"`), un petit œil pour un espace en consultation seule. En tête : **Accueil** (icône grille) = écran de choix de l'espace (`/app/<org>/espaces`).
- **Le menu latéral n'affiche que l'espace choisi** : sa carte (nom + niveau), « Tableau de bord » de l'espace, puis le contenu de l'espace (la liste vient de `info.spaces.spaces[].modules`, déjà renvoyée par `GET /api/ws/orgs/:id` : aucun changement serveur, aucun module masqué par du code en dur). Plus de section « Mon espace » générale ni de grille « Mes espaces ».
- **Un seul menu** : le panneau blanc intérieur des modules est masqué en mode espaces (`body.sp-merged`) ; ses rubriques sont publiées par `ModuleShell` (`publishScreens({ groups, pick })`) et affichées dans le menu latéral. Espace à **un seul module** (ex. Commercial) : directement Pilotage › Aperçu, CRM, Prospection, Pipeline… (rubriques repliables). Espace à **plusieurs modules** (ex. Finances) : un lien par module, et sous le module affiché ses rubriques. Les renvois vers un module d'un autre espace ne sont pas proposés. Les rubriques d'un module n'existent qu'une fois le module ouvert (elles viennent du module lui-même).
- Menu réduit (icônes seules, grand écran) : les rubriques sont masquées, seuls les modules restent.
- **Adresses** : cliquer un espace ouvre `/app/<org>/home/<espace>` (le bouton retour du navigateur fonctionne) ; ouvrir directement `/app/<org>/<module>` sélectionne l'espace qui contient ce module.
- **Mémoire** : le dernier espace est retenu par personne et par entreprise dans `localStorage` (`mabah-nav:space:<org>:<utilisateur>`, protégé par try/catch), en plus de la mémoire serveur ; il sert à l'ouverture de `/app`.
- **Téléphone (≤ 767 px)** : la même barre est fixe en bas, défilable à l'horizontale (l'espace actif reste centré), avec « Assistant IA » et « Menu » à droite ; le menu latéral reste un tiroir.
- **Espaces coupés** (réglage propriétaire ou `SPACES_BY_ROLE=off`) : ni barre ni changement ; l'ancien menu général et l'ancienne barre basse s'affichent comme avant.
- Libellés courts : table `SHORT` dans `SpaceFrame.jsx` (le serveur ne renvoie que les titres complets). Un nouvel espace sans libellé court retombe sur son titre complet.

Captures : `docs/captures-navigation/`.
