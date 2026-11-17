# Page de présentation : audit de l'existant et plan

## Existant (base f5d11dd)
- `src/pages/Home.jsx` + `src/pages/home/*` (En-tête, Hero, Essentials+Showcase, Steps, Plans, Faq, Final, Footer), styles `s-*` dans `home.css`, `site.css`, `responsive-site.css` (partagés avec les pages de connexion/inscription, confidentialité, conditions, 404 : groupe de styles « site »).
- Deux familles de police (Plus Jakarta Sans pour les titres, Inter) ; hero centré sans capture d'écran (aperçu de la vidéo seulement) ; FAQ de 5 questions en `<details>` ; carrousel de 21 images JPG 800×520 sans pause ni points ; pas de section « problème », ni de démonstration WhatsApp, ni de page de contact/pied de page complet ; liens légaux : seulement confidentialité et conditions (pas de page cookies/mentions dans le code).
- Tarifs : repli `DEFAULT_PRICES` (semaine 21 500, mois 80 000, trimestre 224 000, semestre 425 000, an 800 000 FCFA) relu depuis `/api/plans` ; Gratuit : 1 organisation, 3 personnes, 40 messages IA/mois ; Sur mesure dès `custom.minAmount` (10 000). Le serveur est la source ; la vitrine garde cette même logique.
- SEO : title/description/OG/JSON-LD dans `index.html` (à conserver), `seo/sitemap.xml`, règles de `vercel.json` (à conserver), `/steve-brandon-tenda` (statique, intact).

## Plan
1. Nouveau groupe de styles `vitrine` (route `/` seulement) : `src/styles/vitrine.css`, variables `--vt-*`, une seule police (Inter), sans conflit avec `site.css`. Les autres pages gardent le groupe « site ».
2. Composants dans `src/pages/vitrine/` (en-tête, hero, problème/solution, carrousel, modules, étapes + démo WhatsApp, tarifs, sécurité, FAQ accordéon, appel final, pied de page). Accordéon et carrousel écrits à la main.
3. Vraies captures de l'application (données d'exemple) : `scripts/vitrine-captures.mjs` → WebP dans `public/vitrine/`.
4. Traductions en/de/es, accessibilité, responsive, Lighthouse.

## Mesures de départ (avant)
Paquet principal `index` : 505,55 Ko (138,98 Ko gzip) ; chunk Home 20,53 Ko (6,87 Ko gzip) ; CSS principal 31,92 Ko (6,30 Ko gzip).
