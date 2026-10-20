# MANAGER-IA : le site et l'espace de travail (frontend React)

Application **React 18 + Vite**, prévue pour être hébergée sur **Vercel**. Elle parle au serveur (API Node.js / PostgreSQL) du dépôt `manager-ia-backend`, hébergé sur **Render** (base de données chez **Neon**).

```
Navigateur ──► Vercel (ce dépôt : pages React)
                 │  /api/...  (redirigé par vercel.json, même domaine pour le navigateur)
                 └────────────► Render (manager-ia-backend) ──► Neon (PostgreSQL)
```

## Contenu

| Adresse | Page |
|---|---|
| `/` | Présentation (accueil, tarifs, FAQ, contact, assistant du site) |
| `/connexion`, `/inscription`, `/reinitialiser` | Comptes (code par e-mail à l'inscription, mot de passe oublié) |
| `/app` , `/app/<organisation>/<module>` | Espace de travail (15 sous-applications, assistant IA, installable comme application) |
| `/chat?o=<jeton>&c=<campagne>` | Chat public d'une organisation (lien de publicité, QR code) |
| `/form?o=<jeton>` | Formulaire « Nous écrire » d'une organisation |

Les anciennes adresses (`connexion.html`, `app.html`, `chat.html`…) sont redirigées (`vercel.json`), pour que les e-mails et liens déjà envoyés continuent de marcher.

## GUIDE COMPLET : mettre MANAGER-IA en ligne (base de données, serveur, site)

Trois services, tous créés par **vous** avec **vos** comptes (ne donnez jamais vos mots de passe ni vos clés à personne, ni dans un chat) :

```
Visiteurs ──► Vercel (le site React : manager-ia-frontend)
                │  tout ce qui commence par /api est transmis au serveur
                ▼
              Render (le serveur Node.js : manager-ia-backend) ──► Neon (la base PostgreSQL)
```

| Service | Rôle | Dépôt GitHub | Prix de départ |
|---|---|---|---|
| **Neon** | base de données PostgreSQL | — | offre gratuite (sans carte) ; la base se met en veille quand elle n'est pas utilisée |
| **Render** | serveur (API, assistant, WhatsApp, paiements) | `manager-ia-backend` | offre gratuite (le serveur s'endort après ~15 min sans visite) ; offre payante « Starter » pour un serveur toujours réveillé |
| **Vercel** | le site que voient les visiteurs | `manager-ia-frontend` | offre gratuite « Hobby » (réservée à un usage **non commercial** : pour une activité commerciale, prévoyez l'offre Pro) |

> Les prix et limites changent : vérifiez-les sur les sites de chaque service avant de choisir. Pour une vraie activité (clients, paiements, WhatsApp), prévoyez un serveur Render payant : un serveur qui dort répond lentement et peut rater des messages WhatsApp.

Durée : environ 45 minutes la première fois. **Suivez l'ordre : Neon → Render → Vercel → réglages finaux.**

---

### Étape 0 : préparer (10 min)

1. **Fusionnez le code sur GitHub.** Pour chaque dépôt (`manager-ia-backend` et `manager-ia-frontend`) : onglet *Pull requests* → la demande de la branche `claude/postgres-react` → **Merge pull request**. Sans cela, Render et Vercel déploieraient l'ancienne version.
2. **Créez vos comptes** (inscription avec votre e-mail, vous-même) : <https://neon.tech>, <https://render.com>, <https://vercel.com>. Choisissez « Continue with GitHub » pour Render et Vercel : cela leur permet de lire vos dépôts.
3. **Préparez 3 secrets** (sur votre ordinateur, dans un terminal). Notez-les dans un gestionnaire de mots de passe, jamais dans un fichier du projet :
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # à lancer 2 fois : JWT_SECRET puis DATA_KEY
   ```
   - `JWT_SECRET` : protège les connexions.
   - `DATA_KEY` : chiffre les jetons WhatsApp/Meta et les secrets de double authentification. **Ne la changez plus jamais ensuite** (les jetons déjà enregistrés deviendraient illisibles).
   - `ADMIN_PASSWORD` : choisissez une phrase longue (12 caractères minimum, mélangés) et un `ADMIN_USERNAME` pas trop prévisible (évitez « admin »).

---

### Étape 1 : la base de données sur Neon (5 min)

1. Sur <https://console.neon.tech> : **New Project**. Nom : `manager-ia`. Région : choisissez la plus proche de vos clients, par exemple **AWS Europe (Francfort)**. Notez-la : vous prendrez la même région sur Render.
2. Une fois le projet créé, cliquez sur le bouton **Connect**. Une fenêtre affiche une adresse commençant par `postgresql://…`.
3. Il vous faut **deux adresses**, en basculant l'option **« Connection pooling »** :
   - **Pooled connection** (option activée, l'adresse contient `-pooler`) → ce sera `DATABASE_URL`.
   - **Direct connection** (option désactivée, sans `-pooler`) → ce sera `DATABASE_URL_UNPOOLED`.
   Copiez-les dans votre gestionnaire de mots de passe. **Elles contiennent le mot de passe de la base : ne les publiez jamais** (ni dans GitHub, ni dans un message).
4. (Facultatif mais conseillé) Testez depuis votre ordinateur, dans le dossier `manager-ia-backend` :
   ```bash
   npm install
   DATABASE_URL='collez-ici-l-adresse-pooled' JWT_SECRET=test npm run db:check
   ```
   Vous devez voir « Connexion OK ». Les tables se créeront toutes seules au premier démarrage du serveur : **rien à créer à la main**.

> Vous avez déjà des données dans l'ancienne base SQLite ? Une seule fois, sur une base Neon vide : `npm i --no-save better-sqlite3` puis `npm run db:import-sqlite -- chemin/vers/manager-ia.db`. L'ancien fichier n'est jamais modifié.

---

### Étape 2 : le serveur sur Render (15 min)

**Méthode rapide (recommandée) : Blueprint.** Le fichier `render.yaml` du dépôt décrit tout.

1. Sur <https://dashboard.render.com> : **New +** → **Blueprint** → choisissez le dépôt `manager-ia-backend` → **Connect**.
2. Render lit `render.yaml` et vous demande les valeurs « secrètes ». Saisissez-les **vous-même** :

| Variable | Valeur à saisir |
|---|---|
| `DATABASE_URL` | l'adresse **Pooled** de Neon |
| `DATABASE_URL_UNPOOLED` | l'adresse **Direct** de Neon |
| `ADMIN_PASSWORD` | votre mot de passe administrateur (12+ caractères) |
| `SITE_URL`, `ALLOWED_ORIGINS`, `API_PUBLIC_URL` | laissez vide pour l'instant : vous les remplirez à l'étape 4 |
| `ANTHROPIC_API_KEY` | votre clé d'IA (facultatif pour démarrer ; vous pourrez l'ajouter plus tard) |

   `JWT_SECRET` et `DATA_KEY` sont **générés automatiquement** par Render (vous pouvez les remplacer par ceux de l'étape 0). Déjà réglés pour vous : `NODE_ENV=production`, `TRUST_PROXY=2`, `COOKIE_SAMESITE=lax`, `ADMIN_USERNAME`.
3. Choisissez la **région** (la même que Neon, par exemple Francfort) et l'offre (voir le tableau plus haut). Cliquez **Apply** / **Deploy**.

**Méthode manuelle (si vous ne voulez pas du Blueprint) :** **New +** → **Web Service** → dépôt `manager-ia-backend`. Runtime **Node**, *Build Command* `npm ci --omit=dev --omit=optional`, *Start Command* `node src/server.js`, *Health Check Path* `/api/health`. Ajoutez ensuite les variables du tableau ci-dessus et celles de l'étape 4 dans l'onglet **Environment**.

4. Attendez que l'état passe à **Live** (3 à 5 minutes la première fois). Le journal (*Logs*) doit afficher « MANAGER-IA démarré… » puis « Base de données : PostgreSQL ».
5. **Notez l'adresse de votre serveur**, en haut de la page du service, par exemple `https://manager-ia-backend.onrender.com`.
6. **Testez** en ouvrant dans le navigateur `https://VOTRE-SERVEUR.onrender.com/api/health` : la réponse doit être `{"ok":true,"db":true}`. (Si le serveur dormait, la première réponse peut prendre 30 à 60 secondes.)

---

### Étape 3 : le site sur Vercel (10 min)

1. **Indiquez l'adresse de votre serveur Render au site.** Dans le dépôt `manager-ia-frontend`, ouvrez le fichier `vercel.json` et remplacez `https://VOTRE-SERVEUR.onrender.com` par l'adresse notée à l'étape 2 (ligne `"destination": "https://…/api/:path*"`). Modifiez-le directement sur GitHub (icône crayon → *Commit changes*) ou chez vous, puis :
   ```bash
   cd ~/Downloads/manager-ia-frontend
   git add vercel.json && git commit -m "Adresse du serveur" && git push
   ```
   C'est ce réglage qui permet au site et au serveur de se comporter comme **un seul site** (indispensable pour que la connexion fonctionne partout, y compris sur iPhone/Safari).
2. Sur <https://vercel.com/new> : **Import** le dépôt `manager-ia-frontend`.
3. Vercel détecte **Vite** tout seul (commande `npm run build`, dossier `dist`). Ne changez rien. **Aucune variable n'est obligatoire.** Cliquez **Deploy**.
4. À la fin, Vercel affiche l'adresse de votre site, par exemple `https://manager-ia-frontend.vercel.app`. **Notez-la.**

---

### Étape 4 : relier le serveur et le site (5 min)

Retournez sur **Render** → votre service → **Environment** et renseignez (sans `/` à la fin) :

| Variable | Valeur | Pourquoi |
|---|---|---|
| `SITE_URL` | `https://votre-site.vercel.app` | liens des e-mails (mot de passe oublié…) |
| `ALLOWED_ORIGINS` | `https://votre-site.vercel.app` | le serveur n'accepte que les requêtes venant de votre site |
| `API_PUBLIC_URL` | `https://VOTRE-SERVEUR.onrender.com` | liens de médias et adresses de webhook affichées dans l'application |
| `TRUST_PROXY` | `2` | Vercel puis Render : sans cela, tous les visiteurs auraient la même adresse IP et les protections seraient faussées |
| `COOKIE_SAMESITE` | `lax` | connexion fiable (cookies « du même site ») |

Enregistrez : Render redéploie automatiquement (1 à 3 minutes).

---

### Étape 5 : vérifier que tout marche (10 min)

1. Ouvrez `https://votre-site.vercel.app/api/health` : `{"ok":true,"db":true}` (cette réponse vient du serveur *à travers* Vercel : le lien fonctionne).
2. Ouvrez `https://votre-site.vercel.app` : la page de présentation s'affiche.
3. **Créez un compte** (Inscription), puis créez votre organisation : vous arrivez dans l'espace de travail.
4. Ouvrez-le **sur votre téléphone** (iPhone et Android si possible) : menu ☰, une page, un formulaire.
5. **Administration** : `https://VOTRE-SERVEUR.onrender.com/admin` (l'administration est servie par le serveur, pas par Vercel). Identifiant et mot de passe de l'étape 0.
6. Dans **Sécurité**, activez la **double authentification** de l'administrateur (scannez avec Google Authenticator, Microsoft Authenticator, Authy…) et **notez les 10 codes de secours** hors ligne.

---

### Étape 6 : brancher les services (quand vous êtes prêt)

À faire **dans Render → Environment** (les clés se saisissent là, jamais dans un chat ni dans GitHub) :

| Fonction | Variables | Détail |
|---|---|---|
| **IA (Anthropic)** | `ANTHROPIC_API_KEY` | l'assistant et les propositions de l'IA ; le coût dépend de l'usage |
| **E-mails** (code d'inscription, mot de passe oublié) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | avec Gmail : mot de passe d'application (voir la section 5 du README du dépôt `manager-ia-backend`) ; active la vérification de l'e-mail à l'inscription |
| **Paiement manuel / Mobile Money** | `MTN_NUMBER`, `ORANGE_NUMBER`, `PAYMENT_HOLDER_NAME` | les numéros affichés aux clients |
| **Paiement automatique** | `CAMPAY_USERNAME`, `CAMPAY_PASSWORD` | voir la section 6 du README du dépôt `manager-ia-backend` |
| **Notifications administrateur** | `ADMIN_EMAIL`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_TEMPLATE` | voir la section 5 du README du dépôt `manager-ia-backend` |
| **WhatsApp, Messenger, Instagram** | `META_APP_SECRET`, `META_VERIFY_TOKEN` | voir la section 7 du README du dépôt `manager-ia-backend` |

**Adresses de webhook** (à coller chez Meta / Campay) : elles pointent vers **Render**, pas vers Vercel. Exemples : `https://VOTRE-SERVEUR.onrender.com/webhooks/whatsapp` et `https://VOTRE-SERVEUR.onrender.com/webhooks/meta`. Pour le WhatsApp **de chaque organisation**, l'adresse exacte s'affiche dans l'application (sous-application *Assistant commercial* → *Canaux*), à condition que `API_PUBLIC_URL` soit réglée.

---

### Étape 7 : votre propre nom de domaine (facultatif)

1. Achetez un domaine (chez le registrar de votre choix).
2. **Vercel** → votre projet → **Settings → Domains** → ajoutez `votre-domaine.com` et suivez les enregistrements DNS indiqués (le certificat HTTPS est automatique).
3. Sur **Render**, remplacez `SITE_URL` et `ALLOWED_ORIGINS` par `https://votre-domaine.com` (et `https://www.votre-domaine.com` si vous l'utilisez, séparés par une virgule).
4. Sur **Render** → **Settings → Custom Domains**, vous pouvez aussi donner un domaine au serveur (ex. `api.votre-domaine.com`) : mettez-le dans `API_PUBLIC_URL` et dans `vercel.json`.

---

### Étape 8 : mises à jour, sauvegardes, surveillance

- **Mettre à jour le site ou le serveur** : poussez le code sur la branche principale de GitHub (`git push`) ; Render et Vercel redéploient tout seuls. Les tables de la base se mettent à jour automatiquement au démarrage (migrations numérotées).
- **Revenir en arrière** : Render → *Events/Deploys* → *Rollback* ; Vercel → *Deployments* → *Promote to Production* sur une version précédente.
- **Sauvegardes** : Neon garde un historique restaurable (*Restore* : revenir à un instant précis) et permet de créer une **branche** (copie instantanée) avant une grosse modification. En plus, `npm run backup` écrit une copie compressée de toutes les tables dans `data/backups/` : programmez-la chaque nuit si vous avez un ordinateur toujours allumé, et copiez le dossier **ailleurs**.
- **Surveillance** : Render → *Logs*. Dans l'administration, l'écran **Sécurité** montre le journal d'audit, les adresses bloquées et l'état de la configuration (`npm run security:check` donne le même contrôle en ligne de commande).

---

### Dépannage

| Symptôme | Cause probable | Que faire |
|---|---|---|
| Le serveur ne démarre pas, journal : « DATABASE_URL manquant » | variable absente ou mal collée | Render → Environment : recollez l'adresse **Pooled** de Neon (commence par `postgresql://`) |
| « Origine non autorisée » à l'inscription ou à la connexion | `ALLOWED_ORIGINS` ne contient pas l'adresse exacte du site | mettez l'adresse Vercel **sans** `/` à la fin (et avec `https://`) |
| La connexion ne « tient » pas (déconnecté tout de suite) | `vercel.json` ne renvoie pas `/api` vers Render, ou `COOKIE_SAMESITE`/`TRUST_PROXY` mal réglés | vérifiez l'adresse dans `vercel.json`, puis `COOKIE_SAMESITE=lax` et `TRUST_PROXY=2` |
| Premier chargement très lent (30–60 s) | serveur Render gratuit endormi, ou base Neon en veille | normal sur l'offre gratuite ; prenez l'offre payante pour un serveur toujours réveillé |
| `/api/health` répond `db:false` | base inaccessible | vérifiez les adresses Neon (pooled), que le projet n'est pas suspendu, et la région |
| Page blanche ou 404 en ouvrant directement `/app/…` | le site n'a pas été déployé depuis le bon dépôt | le fichier `vercel.json` (redirections) doit être à la racine du dépôt déployé |
| Message « Trop de requêtes » (429) | limite de débit atteinte (ou adresse bloquée) | attendez quelques minutes ; administration → Sécurité → *Adresses bloquées* pour débloquer |
| Les e-mails n'arrivent pas | SMTP non configuré | renseignez les variables `SMTP_*` (section 5 du README du backend) ; l'inscription fonctionne sans e-mail, mais sans vérification |
| Les messages WhatsApp n'arrivent pas | adresse de webhook ou jeton incorrects, ou serveur endormi | vérifiez l'adresse (Render, pas Vercel), `META_APP_SECRET`, et prenez un serveur toujours réveillé |

---

### Check-list finale

- [ ] Les deux dépôts sont fusionnés dans la branche principale
- [ ] Neon : projet créé, deux adresses (pooled et directe) notées en lieu sûr
- [ ] Render : service **Live**, `/api/health` répond `{"ok":true,"db":true}`
- [ ] Vercel : site déployé, `vercel.json` pointe vers l'adresse Render
- [ ] Render : `SITE_URL`, `ALLOWED_ORIGINS`, `API_PUBLIC_URL`, `TRUST_PROXY=2`, `COOKIE_SAMESITE=lax` réglés
- [ ] Inscription, création d'organisation et connexion testées, sur ordinateur **et** téléphone
- [ ] Administration : double authentification activée, codes de secours notés
- [ ] `npm run security:check` : aucun point « dangereux »
- [ ] Les jetons GitHub utilisés pour pousser le code sont supprimés
- [ ] Un essai réel de chaque service branché (IA, e-mail, WhatsApp, paiement) a été fait

---

### Annexe : essayer sur votre ordinateur (sans rien mettre en ligne)

```bash
# 1) Le serveur (dossier manager-ia-backend) : il a besoin d'une base PostgreSQL (un projet Neon gratuit suffit pour les essais)
cd manager-ia-backend
npm run setup                 # crée .env avec des secrets aléatoires et affiche le mot de passe administrateur
# ouvrez .env et collez DATABASE_URL (adresse Neon), puis :
npm install
npm start                     # http://localhost:3000   (si le port 3000 est pris : PORT=3100 dans .env)

# 2) Le site (autre terminal, dossier manager-ia-frontend)
cd manager-ia-frontend
npm install
cp .env.example .env          # DEV_API_TARGET = adresse du serveur local
npm run dev                   # http://localhost:5173
```

Vite renvoie les appels `/api` vers le serveur local : le navigateur ne voit qu'un seul site, la connexion fonctionne sans réglage. Les tests automatiques (`npm test` dans le backend) démarrent leur propre base PostgreSQL jetable : rien à installer.

---

## Organisation du code

```
src/
  main.jsx, App.jsx          routes (React Router) ; chaque groupe de pages ne charge que ses styles (lib/styles.jsx)
  pages/                     Home (+ pages/home/*), Login, Register, Reset, ContactForm, PublicChat
  components/                Logo, AuthLayout, SiteAssistant, InstallPrompt
  lib/                       api.js (appels serveur), format.js, theme.js, styles.jsx
  styles/                    feuilles de style (site, espace de travail, chat)
  ws/                        espace de travail : Workspace.jsx (menu, connexion), WsContext.jsx (useWs), ui.jsx, AIPanel.jsx
  ws/modules/<id>.jsx        une sous-application = un fichier (voir ws/modules/README.md)
public/                      images, icônes, manifest, service worker (sw.js), page hors connexion
```

Ajouter une sous-application : créez `src/ws/modules/<id>.jsx` (composant par défaut), puis ajoutez son identifiant et son icône dans `src/ws/registry.js` ; le serveur doit la déclarer dans `info.modules`.

## Affichage sur tous les écrans (responsive)

- **Téléphones iOS et Android (dès 320 px)**, tablettes et ordinateurs : aucun défilement horizontal de la page. Les seuls défilements latéraux sont des **carrousels voulus** (onglets, offres tarifaires, sous-applications de l'accueil, colonnes du Kanban, planning).
- **Espace de travail** (`src/styles/responsive.css`) : barre latérale fixe dès 1100 px ; en dessous, **menu tiroir** (bouton ☰), assistant IA en panneau plein écran sur téléphone, fenêtres en feuille qui monte du bas. Les grilles se règlent sur la largeur réelle du contenu (requêtes de conteneur), même quand l'assistant IA est ouvert.
- **Site public et comptes** (`src/styles/responsive-site.css`) : zones tactiles de 44 px minimum, champs à 16 px (iOS ne zoome plus), marges de sécurité des écrans à encoche (`env(safe-area-inset-*)`), textes très longs coupés plutôt que débordants.
- Pour ajouter un écran : laissez les classes existantes (`ws-head`, `ws-tabs`, `g2/g3/g4`, `kpis4`, `kan`…) faire le travail, et n'utilisez pas de largeurs fixes en pixels.

## Sécurité

- Aucun secret dans ce dépôt : seules des adresses publiques (`.env.example`).
- Toute donnée affichée passe par React (échappée) ; aucun `dangerouslySetInnerHTML`.
- `vercel.json` ajoute des en-têtes de sécurité (anti-iframe, `nosniff`, politique de référent).
- Le service worker (`public/sw.js`) ne met en cache que les fichiers du site, jamais les données (`/api/` n'est pas intercepté).
