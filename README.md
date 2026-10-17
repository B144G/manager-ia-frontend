# Liaison site (frontend) ↔ serveur (backend)

Deux dossiers, deux adresses. Le site doit connaître l'adresse du serveur, et le serveur doit autoriser l'adresse du site.

| | Dossier | Adresse en essai local | Où se règle le lien |
|---|---|---|---|
| **Serveur (API)** | `manager-ia-backend` | `http://localhost:3000` | fichier `.env` du serveur : `PORT`, `SITE_URL`, `ALLOWED_ORIGINS` |
| **Site** | `manager-ia-frontend` | `http://localhost:5173` | fichier `.env` du site : `API_BASE` (puis `npm run config`) |

## Essayer sur votre ordinateur (3 commandes de chaque côté)

```bash
# 1) Le serveur
cd manager-ia-backend
npm run setup      # crée .env avec des secrets aléatoires et affiche le mot de passe administrateur
npm install
npm start          # http://localhost:3000

# 2) Le site (autre terminal)
cd manager-ia-frontend
npm start          # écrit config.js depuis .env puis sert le site sur http://localhost:5173
```

Ouvrez <http://localhost:5173>. Si le port 3000 est déjà pris sur votre machine, changez `PORT` dans le `.env` du serveur **et** `API_BASE` dans le `.env` du site (puis `npm run config`).

## En ligne

| Situation | `.env` du site | `.env` du serveur |
|---|---|---|
| **Même domaine** (recommandé : copiez le site dans `manager-ia-backend/public`) | `API_BASE=` (vide) | `ALLOWED_ORIGINS` vide, `COOKIE_SAMESITE=lax` |
| **Deux domaines** (site `https://manager-ia.com`, serveur `https://api.manager-ia.com`) | `API_BASE=https://api.manager-ia.com` | `ALLOWED_ORIGINS=https://manager-ia.com`, `SITE_URL=https://manager-ia.com`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS obligatoire) |

Vérifications : `https://<serveur>/api/health` doit répondre `{"ok":true}` ; dans le navigateur, la connexion crée un cookie `mia_token`. Une erreur « Origine non autorisée » signifie que `ALLOWED_ORIGINS` ne contient pas l'adresse exacte du site (avec `http`/`https` et sans `/` final).

Le `.env` du site ne contient **aucun secret** (l'adresse du serveur est publique). Celui du serveur en contient : ne le publiez jamais (il est exclu des zips et de Git).

---

# MANAGER-IA : le site (frontend)

Le site est un ensemble de pages statiques (HTML, CSS, JavaScript simples, rien à compiler) :

| Fichier | Rôle |
|---|---|
| `index.html` | **Page de présentation** (style : `assets/site.css`, comportements : `assets/site.js`) : message d'accueil, bandeau défilant, grille des fonctions, histoire au défilement, glissière des sous-applications, onglets « pour qui », contrôle et sécurité, tarifs, questions, contact |
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


## Fichiers de réglage du site

| Fichier | Rôle |
|---|---|
| `.env` / `.env.example` | `API_BASE` (adresse du serveur) et `PORT` du serveur local |
| `package.json` | `npm run config` (écrit `config.js` depuis `.env`), `npm start` (config + site local) |
| `config.js` | **Généré** : lu par le navigateur. Ne le modifiez pas à la main |
| `scripts/` | `make-config.js`, `serve.js` (aucune dépendance) |

Les aperçus (`assets/img/*.svg`) sont des illustrations générées ; pour les modifier, voir le générateur fourni à part (`design-src`).
