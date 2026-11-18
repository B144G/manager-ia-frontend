# Module Trésorerie (site)

Le rapport complet (rôles, écritures, prévision, indicateurs, tests, commandes de fusion) est dans le dépôt serveur : `docs/tresorerie.md`.

## Fichiers du site

| Fichier | Rôle |
|---|---|
| `src/ws/modules/treasury.jsx` | module (`ModuleShell`, 5 groupes : Pilotage, Prévision, Clients et fournisseurs, Analyse, Contrôle) ; exports PDF / Excel en haut à droite pour le responsable |
| `src/ws/parts/treasury/Dashboard.jsx` | tableau de bord : soldes, prévision 13 semaines, fonds de sécurité, créances, dettes, jours de crédit, alertes |
| `.../Accounts.jsx` | comptes (banque, caisse, mobile money, devises), formulaire d'opération (encaissement, décaissement, virement), validation / refus / annulation, rapprochement |
| `.../Forecast.jsx` | prévision 13 semaines / 12 mois, calendrier jour par jour, éléments prévus, scénarios et comparaison |
| `.../Clients.jsx` | créances (balance âgée, risque, provision, relances) et dettes (échéancier, paiements optimisés, conditions fournisseur) |
| `.../Analysis.jsx` | écarts prévu / réalisé (cascade), tableau des flux, indicateurs (BFR, FRNG, trésorerie nette, DSO, DPO, DIO, CCC), fonds de sécurité |
| `.../Admin.jsx` | équipe et droits, réglages, journal de traçabilité |
| `.../common.jsx`, `charts.jsx`, `charts-impl.jsx`, `download.js` | libellés, phrases d'interprétation et d'alerte, cascade et courbes (Recharts, chargés à la demande), téléchargement des exports |
| `src/styles/ws-treasury.css` | quelques ajustements (jetons de `tokens.css`) |
| `src/i18n/{en,de,es}/ws-treasury.js` | 478 textes traduits (FR est la langue des sources) |

Fichiers partagés modifiés : `src/ws/registry.js` (icône + suggestions de l'assistant), `src/lib/fa.jsx` (une icône de menu).
Les droits sont décidés par le serveur ; l'écran n'affiche que ce que `GET /treasury/me` autorise. Aucun texte « à faire valider par un expert-comptable ».
