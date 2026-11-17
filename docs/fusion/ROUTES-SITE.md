# Routes serveur appelées par le site fusionné (à fournir par le serveur fusionné)

Vérifié contre le serveur de la ligne A (`fusion-base-serveur`, port 3122) : tous les écrans de A répondent sans erreur HTTP.
Les routes ci-dessous n'existent **que dans la ligne B** (404 sur A) ; elles sont lisibles dans les branches serveur indiquées. Le serveur fusionné doit les porter ; le site les appelle déjà.

| Écran du site | Route(s) | Source |
|---|---|---|
| Bandeau de cookies (`src/lib/consent.js`) | `POST /api/privacy/consents` | `claude/securite-784605` : `src/routes/privacy.js` |
| Centre de confidentialité du compte et de l'organisation | `GET /api/privacy/overview`, `GET /api/privacy/consents`, `GET /api/privacy/export`, `GET /api/privacy/orgs/:id/export`, suppression des données | idem |
| Rappel de double authentification, sessions actives | `GET /api/security/overview`, `POST …/sessions/revoke-others` | `src/routes/admin-security.js` |
| Stock › Inventaire › « Inventaire d'un emplacement » (à l'aveugle) | `POST /stock/wms/location-counts`, `POST /stock/wms/location-counts/:id/lines` | `claude/stock-wms-26eb73` : `stock-wms-counts.js` |
| Stock › fiche article › lots/séries par emplacement | `GET /stock/wms/items/:id/tracking` | `stock-wms-locations.js` |
| Stock › Réservations (choix de l'entrepôt) | `POST /stock/wms/reservations` et `/from-document` avec `warehouseId` ; `GET /stock/wms/overview` | `stock-wms-reservations.js` |
| Scanner | types de retour `wave`, `package`, `unit` (libellés déjà dans le site) | `stock-wms.js` |

## Routes de B que le site n'appelle plus (doublons fusionnés au profit de A)
`/stock/wms/units*`, `/stock/wms/packages*`, `/stock/wms/picks/:id/packages`, `/stock/wms/waves/:id/issue` : les écrans de A (`/hus`, `/packing`, `/shipments`, `/waves` de A) les remplacent. **Collision de chemin** : `/stock/wms/waves` existe des deux côtés avec des formats différents ; le site utilise le format de A (`candidates`, `release`, `sort`, `confirm`, `complete`).
