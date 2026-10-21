# Écrire une sous-application (module) de l'espace de travail

Un module = **un fichier** `src/ws/modules/<identifiant>.jsx` qui exporte par défaut un composant React. Le serveur dit quels modules existent pour l'organisation
(`info.modules`, avec `id` et `title`) ; `src/ws/registry.js` associe chaque identifiant à son icône. Le menu, l'URL (`/app/<organisation>/<module>`), l'assistant IA et les
pastilles du menu sont gérés par `Workspace.jsx` : un module ne s'occupe que de son contenu.

```jsx
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../ui.jsx';

export default function Budget() {
  const { oapi, money, can, modal, confirm, toast, fail, refresh } = useWs();
  const st = useLoad(() => oapi('GET', '/budget'), []);          // { data, loading, error, reload, setData }
  return (
    <>
      <div className="ws-head"><div><h1>Budget</h1><p className="muted">…</p></div></div>
      <Loaded state={st}>{(j) => <div className="kpis">…</div>}</Loaded>
    </>
  );
}
```

## `useWs()` : ce que fournit l'espace de travail

| Nom | Rôle |
|---|---|
| `oapi(méthode, chemin, corps?)` | appel serveur **de l'organisation courante** : `oapi('GET', '/stock')` appelle `/api/ws/orgs/<id>/stock`. Renvoie une promesse ; l'erreur porte `.message` (français) et `.status`. |
| `api(méthode, chemin, corps?)` | appel `/api/ws/...` hors organisation (`/orgs`…). `rq(méthode, '/api/...', corps?)` : appel brut. |
| `info` (= `S.info`) | `{ org, me:{role,roleLabel,userId?}, modules, limits, branches, … }` tel que renvoyé par `GET /api/ws/orgs/:id`. `user`, `orgId`, `orgs`, `dash` (tableau de bord léger) aussi. |
| `can('member'\|'manager'\|'admin'\|'owner')` | droits de la personne connectée. |
| `money(n)`, `dateFr(iso)`, `today()` | affichage (monnaie de l'organisation, `JJ/MM/AAAA`, date du jour `AAAA-MM-JJ`). |
| `toast(message, mauvais?)`, `fail(erreur)` | message court ; `fail` affiche l'erreur (ou renvoie à la connexion si 401). |
| `modal(titre, (fermer) => <contenu/>, { wide?, onclose? })` | ouvre une fenêtre, renvoie la fonction qui la ferme. |
| `confirm(texte, siOui, texteDuBouton?)` | fenêtre de confirmation. |
| `refresh()` | **remonte le module** (il se recharge entièrement) : équivalent de l'ancien `c.refresh()`. |
| `reloadOrg()` | recharge `info` (modules, limites…) puis remonte le module. `refreshBadges()` met à jour les pastilles du menu. |
| `propose(genre, entrée, { title, render:(proposition)=><JSX/>, applyText?, apply?:false, done?:(réponse)=>…, after?:(proposition, fermer)=><JSX/> })` | fenêtre « proposition de l'IA » (relue et validée par la personne). |
| `askAI(texte)`, `openAI()` | pose une question à l'assistant / ouvre son panneau. |
| `copy(texte, message?)`, `memberName(userId, liste)` | copier dans le presse-papiers ; nom d'un membre. |

## `ui.jsx`
`Icon`, `Empty text`, `Loading`, `Loaded state`, `useLoad(loader, deps)`, `Form` (champs `{k,label,type,options:[[valeur,libellé]],value,hint,required,rows,placeholder}`, `submitText`, `onSubmit(valeurs)`,
`extra`), `ModalBox`. `Form` garde ses valeurs dans son propre état : pour des champs qui changent selon une autre valeur, utilisez une clé (`key=`) ou écrivez le formulaire à la main avec les mêmes classes.

## Règles
- **Mêmes classes CSS, même structure de balises, mêmes textes français** que l'ancienne version (feuilles `src/styles/ws.css`, `ws-plus.css`). `class`→`className`, `for`→`htmlFor`, `style="a:b"`→`style={{a:'b'}}`.
- Jamais de `dangerouslySetInnerHTML` : les noms et messages de clients ne doivent pas pouvoir injecter de code (React échappe tout).
- Les anciens modules (DOM + `h()`) sont dans `/private/tmp/claude-501/legacy-frontend/assets/ws/` : le comportement, les appels serveur (chemins, corps, champs lus) et les droits (`c.can(...)`) doivent rester **identiques**.
- Les anciennes fonctions du genre `load()` qui reconstruisaient le DOM deviennent `useLoad` + `reload()` ; les `.then(load)` deviennent `.then(reload)`.
- Un fichier trop gros peut être découpé : `src/ws/parts/<module>/*.jsx` (un dossier par module pour éviter les collisions entre auteurs).
- Vérifier : `npx eslint src/ws/modules/<fichier>.jsx src/ws/parts/<module>` puis `npx vite build` (si le build échoue à cause d'un fichier d'un AUTRE module encore en cours d'écriture, ignorez-le).
