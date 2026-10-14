# MANAGER-IA : le site (frontend)

Le site est un ensemble de pages statiques (HTML, CSS, JavaScript simples, rien à compiler) :

| Fichier | Rôle |
|---|---|
| `index.html` | **Page de présentation** : vidéo, l'agent IA et ses sous-applications (texte + image), assistant intégré, pourquoi nous choisir, offres, questions, contact. Un seul bouton d'entrée : « Commencer gratuitement » |
| `connexion.html` | Page de connexion. Sous le formulaire : « Créer un compte » |
| `inscription.html` | Page d'inscription. Sous le formulaire : « Se connecter » |
| `app.html` | **Le tableau de bord** (espace de travail de l'agent IA). On y arrive après la connexion ou l'inscription |
| `form.html` | Formulaire public pour les clients d'une organisation (chaque message devient une demande de service client) |
| `assets/ws/*.js`, `assets/ws.css` | Le tableau de bord : une sous-application par fichier (`core.js` = noyau, menu, panneau de l'IA) |
| `assets/home.css`, `assets/home.js`, `assets/auth.js`, `assets/site-assistant.js` | Style et comportement de la présentation, des pages de connexion/inscription et de l'assistant IA intégré |
| `assets/img/*.svg` | Illustrations de chaque sous-application (modifiables) |
| `config.js` | **Le seul fichier à modifier pour brancher votre serveur** |
| `video/` | La vidéo de présentation et son image d'aperçu |

## Parcours d'un visiteur

`index.html` → « Commencer gratuitement » → `connexion.html` → (sans compte : « Créer un compte » → `inscription.html`) → après la connexion ou l'inscription : `app.html` (tableau de bord).

## 1. Voir le site sur votre ordinateur

Lancez le backend (voir son README) avec ce dossier copié dans `public/` et `API_BASE: ""` dans `config.js`, puis ouvrez http://localhost:3000. La présentation fonctionne seule (`python3 -m http.server 8080`), mais la connexion, l'inscription et le tableau de bord demandent le backend.

## 2. Brancher votre backend (`config.js`)

- **Même domaine (recommandé)** : copiez ce dossier dans `public/` du backend et mettez `API_BASE: ""`.
- **Autre domaine** : `API_BASE: "https://votre-backend.exemple.com"`, puis dans le `.env` du backend : `ALLOWED_ORIGINS=https://votre-site.exemple.com`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS obligatoire des deux côtés).

## 3. Modifier le site

- **Vos numéros et e-mail** : cherchez `237653621388`, `237697836796` et `tendabrandon9@gmail.com` dans `index.html` et `assets/site-assistant.js`.
- **La vidéo** : remplacez `video/manager-ia.mp4` (même nom) et `video/poster.jpg`.
- **Les couleurs** : début de `assets/style.css` (variables `--accent`, `--signal`, etc.).
- **Ajouter une sous-application au tableau de bord** : créez `assets/ws/ma-sous-app.js` (modèle : `WS.register({ id, icon, render(root, c){…} })`), ajoutez sa ligne dans `app.html` et dans `src/workspace/modules.js` côté serveur.


## Vidéo de la page d'accueil
`video/manager-ia.mp4` (1 min 20, 1080p, voix-off et sous-titres incrustés, environ 19 Mo) et `video/poster.jpg` (image affichée avant la lecture). Pour la remplacer, gardez les mêmes noms de fichiers (MP4 H.264 + AAC de préférence) ou modifiez la balise `<video>` dans `index.html`. La version complète (3 min) n'est pas dans le site : elle est fournie à part pour les démonstrations.
