# DEUXIÈME PASSE (direction artistique « nuit et or »)

Retour du fondateur sur la première version : « ça fait genre débutant ». Refonte visuelle et structurelle, mêmes règles d'honnêteté, de SEO, d'i18n et d'accessibilité.

## Ce qui change
- Identité : fond bleu nuit du logo (hero, chiffres, parcours, sécurité, pied de page), alternance avec des sections claires ; un seul accent chaud, l'or de l'étoile du logo, pour les boutons principaux et les chiffres clés ; halos, grille légère ; plus de lavande pâle.
- Typographie : Inter seule, titres jusqu'à 68 px (clamp), graisse 800, crénage −0,04 em, sur-titres en capitales espacées, texte courant 17 à 22 px, largeurs de ligne limitées (56 à 60 caractères).
- Hero sombre : accroche courte (« Toute votre entreprise, enfin au même endroit. »), deux grands boutons (Essai gratuit doré, WhatsApp contour), grande capture réelle en légère perspective + téléphone avec conversation WhatsApp animée présentée comme « Exemple illustratif ». Les images ont des dimensions et un fond de repli : plus de cadre vide.
- Chiffres animés (modules, langues, niveaux d'accès, moyens de paiement Mobile Money : tous réels ; le nombre de modules est compté dans la liste affichée) puis bandeau « Paiements et canaux » (MTN Mobile Money, Orange Money, WhatsApp, en texte, avec mention qu'aucun partenariat officiel n'est suggéré). Pas de « tests automatiques » : fait non vérifié ici.
- Constat (3 douleurs) + bloc solution sombre ; parcours collant en 4 étapes « de la commande WhatsApp à la facture et au stock » (vue qui change au défilement sur ordinateur, images intégrées sur téléphone) ; grille bento de 7 modules avec vrais écrans (cartes de tailles variées, élévation au survol) + les 14 autres modules en pastilles ; onglets « Pour qui ? » (Commerce, Atelier, École, Restaurant, Transport et logistique, BTP : titre, 3 bénéfices tirés de modules existants, vrai écran) ; 3 étapes de démarrage.
- Tarifs : offre Illimité mise en avant (carte sombre, étiquette « Recommandé »), bascule de durée (semaine à année) avec économie calculée sur les prix du serveur, tableau comparatif Gratuit / Illimité honnête (« Sans limite pratique », sans chiffres inventés).
- Sécurité : bandeau sombre de 6 garanties (inchangées, vérifiables). FAQ à deux colonnes (titre collant), 10 questions. Appel final en bandeau doré plein largeur. Pied de page dense à 5 colonnes (produit, ressources, légal, contact).
- Micro-interactions : apparition au défilement corrigée : tout est visible par défaut ; seuls les blocs encore sous l'écran au chargement sont masqués puis révélés, et une minuterie de sécurité (4 s) les révèle tous si l'observateur échoue ; rien n'est masqué en mouvement réduit.
- Carrousel retiré (remplacé par les onglets « Pour qui ? » et le parcours collant, comme demandé) ; `Carousel.jsx`, `How.jsx` supprimés. Captures ajoutées : Production, Chantiers (BTP).

## Mesures (deuxième passe)
Lighthouse 12.8, mobile, 3 passages : performance 90 / 90 / 91, accessibilité 100, SEO 100, bonnes pratiques 96 (une seule erreur de console : `/api/visit` renvoie 404 sur le serveur de démonstration local, absente en production), LCP ≈ 3,4 s, CLS 0, TBT 50 à 80 ms. Ordinateur : 100 / 100 / 96 / 100 (même cause).
Tailles : paquet principal 505,55 Ko (138,98 gzip) → 507,84 Ko (139,77 gzip, +0,8 Ko) ; chunk Home 70,8 Ko (18,7 gzip, chargé seulement sur `/`).
Vérifications : eslint 0 erreur ; `node scripts/i18n-check.mjs` 0 manque (6390/6390 en/de/es) ; aucun défilement horizontal de 360 à 1440 px ; aucune cible tactile < 44 px hors liens dans les phrases ; onglets, accordéon, menu mobile testés au clavier ; mouvement réduit (aucun bloc masqué) ; mode sombre.
Captures : `v1-*` (première passe), `v2-*` (deuxième passe), `avant-*` (page d'origine).
Décisions de contenu à valider en plus : accroche du hero, intitulés et bénéfices des 6 métiers (formulés à partir des modules existants), « Sans limite pratique » dans le tableau, nom des marques MTN/Orange/WhatsApp dans le bandeau.

---

# Refonte de la page de présentation : rapport

Branche `claude/vitrine-pro-48db9d` (base f5d11dd = origin/main). Rien n'est poussé. Patchs : `/Users/macboockpro/Downloads/MANAGER-IA/patches/vitrine/`.

## Avant / après
Captures dans `docs/vitrine/` : `avant-1440.jpg`, `avant-390.jpg` ; `apres-1440.jpg`, `apres-768.jpg`, `apres-390.jpg`, `apres-sombre-1280.jpg`, `apres-menu-mobile.jpg`, `apres-allemand-360.jpg`.

## Structure livrée
1. En-tête collant : logo, Fonctions / Modules / Tarifs / Questions / Contact, langue, thème, « Me connecter » (secondaire), « Essai gratuit » (principal) ; menu mobile en panneau (aria-expanded, Échap).
2. Hero : promesse, deux boutons (Essai gratuit, WhatsApp), lien vidéo, vraie capture de l'application (ordinateur) + capture téléphone, quatre faits vérifiables (nombre de modules calculé, 4 langues, FCFA/TVA/paie du Cameroun, Mobile Money).
3. Constat (3 douleurs) puis solution (3 blocs).
4. Carrousel de 8 vraies captures : tactile (scroll-snap), flèches, points (compteur sur téléphone), clavier (flèches, Début, Fin), pause au survol et au focus, bouton pause, aucune lecture automatique si `prefers-reduced-motion`.
5. Grille de 21 modules (tous présents dans `src/ws/modules`), icônes Font Awesome, filtres par domaine.
6. 3 étapes, puis démonstration WhatsApp (conversation clairement étiquetée « exemple »).
7. Tarifs : Gratuit / Illimité (sélecteur de durée, prix par mois et réduction calculés) / Sur mesure + tableau. Prix lus via `/api/plans` avec le même repli qu'avant (`src/pages/vitrine/plans.js`) ; le prix de la FAQ vient de la même lecture.
8. Sécurité : 6 affirmations vérifiables (isolation par entreprise, rôles, mots de passe chiffrés, double authentification, journal d'audit chaîné, validation humaine). Aucune certification revendiquée.
9. FAQ : 10 questions en accordéon (boutons `aria-expanded`/`aria-controls`, Entrée/Espace, flèches, Début/Fin).
10. Appel final et pied de page (produit, compte, légal, contact WhatsApp +237 653 62 13 88, e-mail).

Écart assumé : 3 étapes (et non 4) comme demandé ; les modules ne sont pas dans un carrousel mais une grille filtrable (plus lisible que deux carrousels).

## Mesures
Lighthouse 12.8 (Chrome, `vite preview` d'un build de production, émulation mobile par défaut ; 3 passages) :
- Mobile : performance 93 / 91 / 94, accessibilité 100, bonnes pratiques 100, SEO 100 ; LCP ≈ 3,1 s, CLS 0, TBT 10 à 120 ms, FCP 1,8 s.
- Ordinateur : 100 / 100 / 100 / 100 ; LCP 0,7 s.
- Avant refonte : non mesuré (ancienne page non rejouée).
Tailles (npx vite build) : paquet principal 505,55 Ko (138,98 Ko gzip) → 505,84 Ko (139,03 Ko gzip), soit +0,05 Ko gzip ; chunk Home 20,5 Ko (6,9 gzip) → 63,0 Ko (17,2 gzip), chargé seulement sur `/` (il embarque la feuille `vitrine.css`, hors du paquet principal). Images : 22 WebP de captures (≈ 790 Ko au total, 3 tailles chacune, chargement différé sauf le hero).
Vérifications : `npx eslint src` 0 erreur ; `node scripts/i18n-check.mjs` 0 manque (6375/6375 en/de/es) ; aucun défilement horizontal à 360, 390, 412, 768, 1024, 1280, 1440 px (français) et à 360/768 px en allemand, espagnol, anglais ; cibles tactiles ≥ 44 px (seuls les liens dans les phrases de la FAQ y échappent) ; mode sombre ; mouvement réduit testé (pas de défilement automatique, blocs visibles).
Non vérifié : appareils iOS/Android réels (émulation Chrome seulement) ; Lighthouse sur le site déployé.

## Fichiers existants modifiés (pour la fusion avec fusion-site)
- `src/App.jsx` : la route `/` passe dans un `StyleLayout group="vitrine" body="vt"` (les autres routes « site » inchangées).
- `src/lib/styles.jsx` : ajout du groupe `vitrine: []` (la feuille est chargée par `Home.jsx` pour rester hors du paquet principal).
- `src/pages/Home.jsx` : réécrit. `src/pages/home/*` supprimé (remplacé par `src/pages/vitrine/*`).
- `vite.config.js` : plugin `preloadFontPlugin` (préchargement de la police Inter, gain de LCP pour toutes les pages).
- Nouveaux : `src/styles/vitrine.css` (jetons `--vt-*`, à relier au système de design en redéfinissant le bloc « Jetons »), `src/i18n/{en,de,es}/site-vitrine.js`, `scripts/vitrine-captures.mjs`, `public/vitrine/*`, `docs/vitrine/*`.
- Non touchés : `src/ws/**`, styles de l'application, serveur, `vercel.json`, `index.html`, `seo/sitemap.xml`, `public/steve-brandon-tenda/`. Les feuilles `site.css`, `home.css`, `responsive-site.css` servent encore aux pages de confidentialité, conditions, connexion (leurs règles de l'ancienne page d'accueil sont désormais inutilisées ; nettoyage possible plus tard).
- Une seule famille de police (Inter) sur la vitrine ; la police Plus Jakarta Sans reste chargée par `main.jsx` pour le reste du site.

## À faire / à savoir
- Les captures montrent l'interface actuelle de l'application ; après la fusion du nouveau système de design, les refaire : `scripts/vitrine-captures.mjs` (instructions en tête du fichier) puis conversion en WebP (largeurs 480/720/1280 ; téléphone 240).
- Aucun réseau social n'est cité : aucun lien officiel n'existe dans le code. Pas de page « Mentions légales » ni « Cookies » séparée : « Cookies et données » renvoie à `/confidentialite` (qui a une section cookies).
- Preuve sociale : aucune (pas de témoignage ni de logo). Emplacement à ajouter après le hero quand de vrais clients acceptent d'être cités.
- Modules « Réunions » et « Bureau d'études » : non présentés (n'existent pas).
- Données JSON-LD, title, description, Open Graph : inchangés.
- Le prix « Illimité » du code de repli (80 000 FCFA/mois) est identique à celui du serveur ; l'affichage est relu depuis `/api/plans`.

## Décisions de contenu à valider par le fondateur
1. Titre : « Tout votre commerce au même endroit, avec une IA qui répond à vos clients » et sous-titre.
2. Badge « Fait au Cameroun · en français, en FCFA » et faits « 21 modules intégrés », « 4 langues ».
3. Section « Le constat » : trois douleurs (WhatsApp, cahiers/tableurs, tout faire soi-même) : ton et exactitude.
4. Démo WhatsApp : exemple de chaise de bureau à 45 000 FCFA, livraison à Bonamoussadi (illustratif, étiqueté comme exemple).
5. Affirmations de sécurité (mots de passe « chiffrés », double authentification, journal « chaîné ») : confirmées par l'ancien texte du site et le code serveur, à relire par vous.
6. FAQ : réponse « hors ligne » (pas de mode hors ligne, page d'avertissement), « import » (relevés bancaires et listes de clients/fournisseurs), « TVA et paie du Cameroun » (outil d'aide, pas de liasse officielle).
7. Réduction affichée pour les longues durées (−7 %, −11 %, −17 %) : calculée à partir des prix du serveur.
8. Appel final : « Prêt à reprendre la main sur votre entreprise ? » et promesse « nous vous répondons » sur WhatsApp.
9. Traductions anglais/allemand/espagnol écrites sans relecture native.
