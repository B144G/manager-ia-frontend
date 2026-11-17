# Interface Brij-IA : système de design, cadre d'application, Projets et Budget

Ce dossier documente le travail « interface professionnelle et uniforme ». Les captures de référence sont dans `captures/`, les mesures dans `taille-*.txt` et `verif-responsive.txt`, l'audit de départ dans `audit-avant.md` (régénérable : `node scripts/audit-ui.mjs`).

## 1. Une seule base visuelle

| Sujet | Où | Règle |
|---|---|---|
| Jetons (couleurs, police, échelle, espacements, rayons, ombres, durées, hauteurs de champs, séries de graphiques) | `src/styles/tokens.css` | **Fichier unique.** Thèmes clair / sombre / automatique, densité compacte, cibles tactiles. Les anciens noms (`--bg`, `--fg`, `--pink`…) sont des alias en bas du fichier. |
| Police | `--font` = **Inter** (variable, auto-hébergée) | Une seule famille pour tout (site public compris). Plus de Plus Jakarta Sans ni de police à chasse fixe : les chiffres utilisent `tabular-nums`. |
| Échelle typographique | `--fs-xs … --fs-4xl` (12 · 13 · 14 · 15 · 17 · 20 · 24 · 30 · 40) | Champs de saisie à 16 px sur téléphone/tablette (pas de zoom iOS). |
| Base | `src/styles/base.css` | Focus visible, sélection, barres de défilement, mouvement réduit, impression, contraste forcé. |
| Composants | `src/styles/ui.css` + `src/ws/ui/index.jsx` | Voir §2. Les anciennes classes (`btn`, `ws-card`, `pill`, `stat`, `fld`, `ws-tabs`, `kpis`…) sont restylées avec les mêmes jetons : les 28 modules prennent l'apparence commune sans réécriture de leur logique. |
| Cadre d'application | `src/styles/shell.css` + `src/ws/shell/*` | Voir §3. |
| Graphiques, Gantt, Kanban, calendrier | `src/styles/charts.css` + `src/ws/charts/*` | Voir §5. |

Nouvelle règle d'équipe : **aucune couleur, taille de police, rayon ou ombre en dur** dans un écran ; on utilise un jeton. Pour un composant nouveau, ajouter la classe `ui-…` dans `ui.css`.

## 2. Bibliothèque de composants (`src/ws/ui/index.jsx`, ré-exportée par `src/ws/ui.jsx`)

`Button` (variantes primary · secondary · soft · ghost · danger · danger-outline ; tailles sm · md · lg ; états normal, survol, appui, focus, désactivé, chargement ; icône à gauche/droite ; icône seule avec libellé accessible ; lien interne `to`), `Icon` (unique : Font Awesome Free, `src/lib/fa.jsx`), `Card`, `Badge`, `Tabs` (clavier ← → Début Fin), `Segmented`, `Field`, `Form` (existant, restylé), `Table`, `EmptyState`, `Skeleton`, `Alert`, `Stat`, `PageHeader`, `Drawer` (piège à focus, Échap), `ModalBox` (fenêtre, piège à focus), toasts, `ChartFrame` (enveloppe de graphique avec légende et résumé pour lecteurs d'écran).

Icônes : un seul composant `<Icon name="…" />`. Le registre de base (site public) est dans `src/lib/fa.jsx`, celui de l'espace de travail dans `src/ws/icons.js` (chargé avec lui). Les émojis des menus de modules sont convertis automatiquement en icônes (`ModuleShell.jsx`).

## 3. Cadre d'application unique

- **Barre latérale** (`Frame.jsx`) : logo ou logo de l'entreprise, sélecteur d'organisation, recherche d'écran, **favoris** (étoile) puis menu dans l'**ordre choisi par la personne**, compte, bouton de réduction (icônes seules). Tiroir sur tablette et téléphone.
- **En-tête** : bouton menu, **fil d'Ariane** (module › groupe › écran, publié par `ModuleShell`), question à l'IA, recherche Ctrl K, guide, langue, alertes, personnalisation, compte.
- **Recherche d'écran Ctrl K / ⌘K** (`Palette.jsx`) : modules, écrans du module ouvert, actions (thème, personnalisation), question à l'IA ; flèches, Entrée, Échap.
- **Pied de page** : légal (confidentialité, conditions), aide, protection des données.
- **Barre basse (téléphone)** : accueil, deux favoris (ou Projets/Ventes), assistant IA, menu.
- **Cadre de module** (`ModuleShell.jsx`) : menu des écrans du module à gauche (groupes dépliables, recherche) ; l'organisation et la personne sont désormais dans l'en-tête.

## 4. Personnalisation (stockage navigateur : `src/lib/prefs.js`, clé `mi_prefs_v1`)

Thème (clair / sombre / automatique), couleur d'accent (7 palettes + couleur libre), **couleur de marque et logo de l'entreprise** (par organisation, réservé aux administrateurs ; le logo est réduit à 256 px), densité (confortable / compacte), **favoris**, **ordre du menu**, **vues enregistrées** (filtres des tâches), menu réduit. Le contraste est garanti : toute couleur choisie est assombrie automatiquement jusqu'à 4,6:1 avec le texte blanc (et éclaircie en mode sombre). Aucune route serveur n'a été nécessaire ; **limite** : ces réglages ne suivent pas la personne d'un appareil à l'autre (une petite route `GET/PUT /api/ws/orgs/:id/preferences` serait le prolongement naturel).

## 5. Graphiques : Recharts, à la demande

Une seule bibliothèque (**Recharts**), chargée **à la demande** (`React.lazy` : `src/ws/charts/lazy.jsx` → `engine.jsx`) : elle n'est téléchargée que lorsqu'un écran qui contient un graphique s'affiche. Couleurs = jetons `--c1…--c8` (testés clair et sombre), axes abrégés (1,2 M), infobulle exacte, résumé texte pour lecteurs d'écran, animations désactivées (lisibilité, performance, mouvement réduit).
**Budget de taille** (gzip) : premier chargement ≤ 145 Ko (mesuré : voir `taille-apres.txt`), moteur de graphiques ≤ 125 Ko, chargé seulement à l'ouverture de Projets ou Budget. Vérification : `npx vite build && node scripts/size.mjs`.

## 6. Projets (`src/ws/modules/projects.jsx`, `src/ws/parts/projects/*`)

- **Vue d'ensemble** : indicateurs (projets, tâches, avancement global, retards), avancement comparé par projet (barres), cartes de projets (progression, retard, échéance), mes tâches (liste filtrable), charge par personne (graphique + tableau).
- **Projet** : onglets **Tableau de bord** (avancement, retards, jalons, fin prévue, budget consommé, temps ; anneaux et barres ; échéances et jalons ; fiabilité des données), **Gantt**, **Kanban**, **Calendrier**, **Liste**, **Suivi** (budget, dépenses, jalons, pièces, réglages).
- **Gantt** : barres par tâche avec avancement, **dépendances** (flèches), **jalons** (losanges), aujourd'hui, échéance du projet, week-ends, zoom jour/semaine/mois, remplissage de la largeur, ligne de synthèse du projet, tâches décalées en pointillé, **charge** par personne et par semaine (rouge au-dessus de 40 h), accessible au clavier (chaque barre est un bouton).
- **Kanban** : glisser-déposer (et bouton « avancer » pour le clavier et le tactile), carrousel sur téléphone.
- **Calendrier** : mois, tâches et jalons à leur échéance, détail du jour (indispensable sur téléphone).
- **Liste** : tableau triable (en-têtes accessibles), filtres communs (texte, personne, priorité, statut, en retard) et **vues enregistrées**.

Données : routes existantes uniquement (`/projects`, `/projects/:id`, `/schedule`, `/summary`, `/insight`, `/workload`, `/tasks`). Aucune route serveur ajoutée.

## 7. Budget (`src/ws/modules/budget.jsx`, `src/ws/parts/budget/Overview.jsx`)

Nouvel onglet **Vue d'ensemble** (administrateurs) : alertes visuelles (lignes hors budget, trésorerie négative prévue, validations en attente, engagements, budget annuel manquant), indicateurs (recettes, dépenses, résultat, trésorerie), **courbes prévu / réalisé cumulées** (dépenses ou recettes), **écarts par catégorie** (rouge = dépassement), **répartition des dépenses**, **comparatif mensuel recettes / dépenses**, **trésorerie prévisionnelle** (encaissements, décaissements, solde), tableau des lignes avec consommation. L'onglet **Mois** gagne un graphique dépensé / limite par catégorie. Les onglets Budget annuel, Trésorerie et Validations conservent leur logique avec les styles communs. Routes utilisées : `/budget`, `/budget/annual`, `/budget/cashflow`, `/budget/requests` (aucune ajoutée).

## 8. Responsive, installation, accessibilité

- Téléphone : zones sûres (encoche, barre d'accueil), `100dvh`, clavier virtuel (`--kb`), champs 16 px, **cibles 44 px**, barre basse, fenêtres en feuille basse, paysage pris en charge. Tablette : menu en tiroir, tableaux et diagrammes défilants. Ordinateur : menu fixe réductible, assistant IA en colonne.
- Installation : manifeste (icônes standard et « maskable », raccourcis Projets et Budget), service worker qui **ne met jamais en cache l'API** (inchangé : réseau d'abord, jamais `/api`).
- Accessibilité : focus visible partout, lien « Aller au contenu », fenêtres et tiroirs avec piège à focus et retour du focus, onglets et palette au clavier, libellés (`aria-label`) sur les boutons-icônes, contrastes AA vérifiés par `scripts/contrast.mjs` (clair et sombre), mouvement réduit, mode contraste forcé.

## 9. Vérifications (scripts)

`node scripts/shots.mjs <dossier> <largeurs> <modules> [clair|sombre] [--land] [--full]` (captures + débordement horizontal + cibles < 44 px), `scripts/flow-projects.mjs`, `scripts/flow-budget.mjs`, `scripts/flow-shell.mjs` (Ctrl K, personnalisation, persistance, favoris, menu réduit, tiroir), `scripts/contrast.mjs` (contrastes AA), `scripts/shot-public.mjs`, `scripts/size.mjs`, `scripts/audit-ui.mjs`, `scripts/seed-demo-projects.mjs` (données de démonstration pour les captures). Ils utilisent le serveur de démonstration et puppeteer-core.

## 10. Ce qu'il reste (hors de ce lot)

1. Migration fine des écrans de modules vers les composants (`Button`, `Card`, `Table`…) : tous bénéficient déjà des mêmes styles ; il reste des `style={{…}}` ponctuels (≈ 450) et des tableaux faits à la main à convertir en `Table`.
2. Tableau de bord : ses graphiques SVG maison (`parts/dashboard/Charts.jsx`) pourraient passer sur le moteur commun.
3. Préférences côté serveur (suivi d'un appareil à l'autre) et glisser-déposer de l'ordre du menu (aujourd'hui : boutons monter/descendre, accessibles).
4. Les textes « à faire valider par un expert-comptable » existent encore dans des écrans de Comptabilité/Fiscalité/Impressions écrits par d'autres sessions : non modifiés ici (hors périmètre), à retirer si le fondateur le confirme.
5. Pied de page et en-tête du site public : volontairement distincts du cadre applicatif (même police et mêmes jetons).

## 11. Logique métier à prévoir (session ultérieure) pour un niveau SAP / Microsoft Project

**Projets** : historique des changements de statut et date d'achèvement des tâches (nécessaire au burn-down/burn-up, au débit hebdomadaire et à la vélocité) ; progression réelle par tâche (% saisi, pas seulement à faire/en cours/terminé) ; plusieurs dépendances par tâche avec types (fin→début, début→début, fin→fin) et décalages (lead/lag) ; chemin critique et marges ; calendriers de travail (week-ends, jours fériés camerounais, congés issus des RH) dans le calcul des dates ; capacité par personne (heures par semaine, temps partiel) pour que la charge soit comparée à une vraie capacité ; **ligne de base** (planning initial figé) et écarts avec la base ; tâches récapitulatives (sous-projets, WBS) ; affectation de plusieurs personnes à une tâche ; ressources non humaines (matériel, engins) ; modèles de projets ; jalons liés à des livrables et à des facturations ; valeur acquise (EVM : BCWS/BCWP/ACWP, CPI/SPI) ; portefeuille : budget et dépenses agrégés par projet dans `/projects` (aujourd'hui il faut appeler `/summary` projet par projet) ; droits par projet et notifications d'échéances.
**Budget** : budget par version (initial, révisé, reprévision) avec historique et approbation ; budgets par centre de coût / projet / antenne (dimension analytique) ; engagements (commandes) et réservations par ligne ; réaffectations entre lignes ; années fiscales décalées et clôture de période ; prévision glissante (rolling forecast) et scénarios (optimiste / pessimiste) ; règles d'alerte configurables par ligne (seuils 80 %/100 %) avec notification ; tableau de bord consolidé multi-organisations ; export vers le tableur ; trésorerie : ventes futures récurrentes et saisonnalité, encaissements réels pour mesurer la fiabilité des prévisions, plusieurs comptes bancaires et devises.
