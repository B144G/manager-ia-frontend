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

## Essayer sur votre ordinateur

```bash
# 1) le serveur (voir le README de manager-ia-backend) : http://localhost:3000
# 2) le site
cd manager-ia-frontend
npm install
cp .env.example .env      # DEV_API_TARGET = adresse du serveur (3000 par défaut)
npm run dev               # http://localhost:5173
```

Vite renvoie `/api/...` vers le serveur : le navigateur ne voit qu'un seul site, les cookies de connexion fonctionnent sans réglage. Si le port 3000 est déjà pris sur votre machine, changez `PORT` dans le `.env` du serveur et `DEV_API_TARGET` ici.

Autres commandes : `npm run build` (dossier `dist/`), `npm run preview`, `npm run lint`.

## Mettre en ligne sur Vercel

1. Déployez d'abord le serveur sur Render (voir son README) et notez son adresse, par exemple `https://manager-ia-backend.onrender.com`.
2. **Ouvrez `vercel.json`** et remplacez `https://VOTRE-SERVEUR.onrender.com` par l'adresse de votre serveur (ligne `"/api/:path*"`). C'est ce qui garde les cookies « du même site » (indispensable sur iPhone/Safari) et évite tout réglage CORS.
3. Sur <https://vercel.com> : *Add New → Project* → importez ce dépôt GitHub. Vercel détecte Vite (`npm run build`, dossier `dist`). Aucune variable n'est obligatoire.
4. Une fois en ligne, sur **Render**, réglez `SITE_URL` et `ALLOWED_ORIGINS` avec l'adresse Vercel (ou votre domaine), `COOKIE_SAMESITE=lax`, puis redéployez le serveur.
5. Testez : `https://votre-site.vercel.app/api/health` doit répondre `{"ok":true,"db":true}` ; puis inscrivez-vous.
6. Votre propre nom de domaine : *Settings → Domains* sur Vercel, puis mettez-le dans `SITE_URL` / `ALLOWED_ORIGINS` du serveur.

**Variante sans redirection** : mettre `VITE_API_BASE=https://votre-serveur.onrender.com` dans les variables Vercel et `COOKIE_SAMESITE=none` côté serveur. Moins fiable (Safari bloque les cookies tiers) : à éviter.

Les liens de webhook (WhatsApp, Messenger, Campay) pointent directement vers le **serveur** (Render), pas vers Vercel.

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

## Sécurité

- Aucun secret dans ce dépôt : seules des adresses publiques (`.env.example`).
- Toute donnée affichée passe par React (échappée) ; aucun `dangerouslySetInnerHTML`.
- `vercel.json` ajoute des en-têtes de sécurité (anti-iframe, `nosniff`, politique de référent).
- Le service worker (`public/sw.js`) ne met en cache que les fichiers du site, jamais les données (`/api/` n'est pas intercepté).
