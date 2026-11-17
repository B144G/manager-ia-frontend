# Taille du paquet (`npx vite build`)

| | Ligne A seule | Site fusionné |
|---|---|---|
| Fichiers JS | 205 | 240 |
| JS total | 3 964 645 octets (gzip 1 332 789) | 4 800 990 octets (gzip 1 587 462) |
| Paquet d'entrée `index-*.js` | 505,55 ko (gzip 138,98 ko) | 499,85 ko |
| Recharts | absent | `engine-*.js` 462 ko, **chargé à la demande** (Budget › Vue d'ensemble, Projets › tableau de bord) |

Le paquet d'entrée n'augmente pas : les graphiques, les icônes de l'espace de travail et ses styles sont chargés avec lui.
