# Matrice de fusion du site Brij-IA (ligne A + ligne B)

Base : ligne A = `origin/main` (tête `f5d11dd`). Ligne B = branches locales `securite`, `claude/interface-pro-b256c3`, `stock-wms` (dernier commit `b5f82aa`).
Les branches `achats-module` et `bibliotheque-module` sont déjà des ancêtres de la ligne A : leurs écrans (Achats, Bibliothèque avec fenêtre de mot de passe par bloc) sont identiques des deux côtés, rien à réunir.

Méthode : `git merge` des trois branches B dans la base A (commits « Fusion : … »), conflits résolus à la main, puis vérifications dans le navigateur.

| Module / écran | Ligne A | Ligne B | Décision |
|---|---|---|---|
| Design : jetons, composants | « Interface pro » (`ws-pro.css`, classes `ws-*`, `btn`) | `tokens.css`, `base.css`, `ui.css`, composants `src/ws/ui/` (bouton, carte, badge, onglets, tableau, tiroir, fenêtre, état vide, squelette, alerte, indicateur, enveloppe de graphique), Inter seule | **B est la base** (un seul jeu de jetons, une police). `ws-pro.css` de A est conservé et chargé avec l'espace de travail (`src/ws/wsStyles.js`) : aucun écran de A ne change de mise en page. |
| Icônes | `Fa` + `MODULE_FA`, `EMOJI_FA`, `faName` | `Icon` unique + registre `src/ws/icons.js` | **Union** : `Icon` (alias `Fa` conservé), `MODULE_FA`/`EMOJI_FA`/`faName` gardés, 16 noms de A ajoutés au registre (`box-open`, `shuffle`, `cubes`, `gears`, …). |
| Cadre d'application | bandeau (organisation, personne) dans chaque module | menu latéral réductible avec favoris, fil d'Ariane, Ctrl K, pied de page, barre basse téléphone | **B** (le bandeau de A est remplacé par l'en-tête global : mêmes informations). Menu de module de A (groupes, icônes) conservé, il utilise `Icon`. |
| Personnalisation | – | accent, logo/couleur de marque, densité, favoris, ordre du menu, vues enregistrées, thèmes clair/sombre/auto | **B**, entier. |
| PWA | – | manifeste installable | **B**. |
| Projets : liste | cartes + onglets Projets / Portefeuille / Charge prévue | tableau de bord, cartes, tâches filtrables, vues enregistrées | **Union** : onglet « Projets » (B), « Portefeuille » et « Charge prévue » (A). |
| Projets : un projet | Tâches, Pilotage, Risques, Planning/Insight, références | Tableau de bord, Gantt (dépendances, jalons, charge), Kanban glisser-déposer, Calendrier, Liste, Suivi | **Union** : 9 vues : Tableau de bord, Gantt, Kanban, Calendrier, Liste, Suivi (B) + Planification, Pilotage, Risques (A). `Planning.jsx` contient les deux jeux de fonctions. |
| Budget | onglet « Pilotage » (budget-pro) | « Vue d'ensemble » (Recharts : prévu/réalisé, écarts, répartition, comparatif mensuel, trésorerie, alertes) | **Union** : onglets Vue d'ensemble + Pilotage + Mois + Budget annuel + Trésorerie + Validations. Recharts chargé à la demande (`engine-*.js`). |
| Graphiques | SVG maison (`ws/parts/bp/Charts.jsx`) | Recharts via `ChartFrame` | **Les deux** : A garde ses SVG (Pilotage Budget/Projets), B ajoute Recharts à la demande. |
| Entrepôt : pilotage (4E), flux spéciaux (4D), 4B/4C | tableau de bord, cour/quais, slotting, productivité, transbordement, kits, services, vagues, emballage, expéditions, réappro., palettes (HU) | – | **A**, entier. |
| Entrepôt : emplacements, rangement, transferts, réservations, réceptions, préparation, retours, ABC, prévision, états, scan | présents | présents (identiques à l'origine) | A + ajouts B : réservations par entrepôt, lots/séries par emplacement (fiche article), messages du serveur traduits (`srv-wms.js`). |
| Inventaire | inventaire simple | inventaire d'un emplacement, **à l'aveugle** | **B** ajouté à l'écran Inventaire (bouton « Inventaire d'un emplacement »). |
| Vagues de préparation | `Waves.jsx` (candidates, lancement, tri, confirmation par scan) | `Waves.jsx` (regroupement, confirmation, expédition de la vague) | **Doublon fusionné : A gardé** (plus complet ; l'expédition passe par « Expéditions »). Le Waves de B n'est pas repris. |
| Palettes / cartons | `HandlingUnits.jsx` (création, réception, déplacement, ajout/retrait, imbrication, étiquette, scan) | `Units.jsx` (création, ajout, déplacement, défaire) | **Doublon fusionné : A gardé** (⊇ B). `Units.jsx` supprimé. Types de scan `wave`, `package`, `unit` ajoutés à l'écran Scanner. |
| Colisage | Poste d'emballage (colis, pesée, contrôle scan, liste de colisage) | panneau « Colisage » dans la liste préparée | **Doublon fusionné : A gardé** (poste d'emballage). |
| Transport (TMS) | complet | – | **A**. |
| Achats | complet | identique | inchangé. |
| Bibliothèque | complet, fenêtre de mot de passe par bloc (focus, Entrée, message d'erreur) | identique | inchangé (vérifié : champ `type=password`, rien dans l'URL). |
| Comptabilité | menu en groupes, import bancaire Excel/OFX/MT940/CAMT, écran Stocks | – | **A**, vérifié par le parcours. |
| Cookies | – | bandeau conforme, trois boutons de même apparence, validité 12 mois | **B**. |
| Confidentialité | – | centre de confidentialité du compte et de l'organisation (export, suppression), rappel de double authentification, sessions actives | **B** (`src/privacy/`, routes `/app/confidentialite…`). |
| Pages légales | `Legal.jsx` (Privacy, Terms) | moteur `LegalCenter`, 10 textes FR/EN, champs `[À COMPLÉTER …]` | **Union** : `LegalCenter` en tête, `Legal.jsx` gardé comme repli (`legacy`). Champs à compléter laissés tels quels. |
| Abonnement / prix | « Illimité » 21 500 / 80 000 / 224 000 / 425 000 / 800 000 FCFA | anciens prix | **A, inchangé** (`pages/home/Plans.jsx`, `ws/parts/billing`, traductions). |
| Suivi public de livraison (`/suivi/:token`) | oui | – | A. |
| Démo | scripts de démo A | scripts d'audit et de captures B (`scripts/*.mjs`) | Union. |

## Contradictions tranchées
1. Deux implémentations des vagues, palettes et colisage sur des routes serveur différentes → l'interface de A est gardée ; les routes serveur de B (`/stock/wms/units`, `/packages`, `/waves/:id/issue`) ne sont plus appelées par le site.
2. Deux jeux d'icônes → un registre.
3. Bandeau de module (A) contre en-tête global (B) → en-tête global.
