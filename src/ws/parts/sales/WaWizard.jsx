import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';

const ONE_CLICK = { id: 'oneclick', t: 'Connexion en un clic', auto: (w) => w.connected, body: ["Le bouton « Connecter WhatsApp » en haut de la page ouvre une fenêtre de Meta : vous y choisissez votre compte et votre numéro, sans copier aucun identifiant.", "Si cela fonctionne pour vous, vous pouvez ignorer toutes les étapes suivantes. Elles servent seulement à la saisie manuelle."],
  ask: "Comment fonctionne la connexion WhatsApp en un clic de Meta et que dois-je préparer ?" };
const BASE = [
  { id: 'compte', t: 'Créer votre compte Meta Developers', url: 'https://developers.facebook.com', link: 'Ouvrir developers.facebook.com',
    body: ["Connectez-vous d'abord à facebook.com avec votre compte, puis ouvrez developers.facebook.com dans le même navigateur.", 'Cliquez sur « Démarrer », acceptez les conditions et confirmez votre téléphone si Meta le demande. Pour le rôle, choisissez « Dirigeant/Fondateur ».'],
    ask: "Je suis bloqué à la création de mon compte Meta Developers. Que dois-je faire ?" },
  { id: 'app', t: 'Créer votre application', body: ['« Mes applications », puis « Créer une application ». Nom : celui de votre entreprise.', "Cas d'utilisation : « Tisser des liens avec votre clientèle via WhatsApp » (ou « Autre », puis type « Entreprise »).", 'Choisissez ou créez votre portefeuille business, puis « Créer l\'application ».'],
    ask: "Je dois créer mon application Meta pour WhatsApp. Quel cas d'utilisation et quel type dois-je choisir ?" },
  { id: 'numero', t: 'Choisir le numéro', body: ["Pour essayer : Meta donne un numéro de test gratuit. Dans « Configuration de l'API », ajoutez votre téléphone dans le champ « À » et confirmez le code reçu. Il ne peut écrire qu'à 5 numéros au maximum.", "Pour vos vrais clients : ajoutez votre numéro WhatsApp Business (« Ajouter un numéro de téléphone »). Il ne doit plus être utilisé dans l'application WhatsApp normale. Le code de vérification arrive par SMS ou appel : saisissez-le vous-même chez Meta."],
    ask: "Quelle différence entre le numéro de test Meta et mon vrai numéro WhatsApp, et comment ajouter mon vrai numéro ?" },
  { id: 'phone', t: "Repérer l'identifiant du numéro (Phone number ID)", auto: (w) => Boolean(w.phoneId), body: ["Dans « Configuration de l'API », sous le numéro, copiez « Phone number ID » (un long nombre).", "Attention : ce n'est ni le numéro de téléphone, ni le « WhatsApp Business Account ID »."],
    ask: "Où trouver le Phone number ID chez Meta, et comment ne pas le confondre avec le WhatsApp Business Account ID ?" },
  { id: 'token', t: "Créer le jeton d'accès permanent", url: 'https://business.facebook.com/settings/system-users', link: 'Ouvrir les utilisateurs système', auto: (w) => w.tokenSet, body: ["Paramètres de l'entreprise, puis Utilisateurs, puis Utilisateurs système. Créez un utilisateur système (rôle Admin), ajoutez votre application, puis « Générer un jeton ».", 'Cochez whatsapp_business_messaging et whatsapp_business_management, et choisissez « Jamais » pour l\'expiration.', "Le jeton temporaire du tableau de bord Meta expire en 24 heures : ne l'utilisez que pour un essai rapide.", "Ce jeton est un mot de passe : collez-le seulement dans le formulaire ci-dessous, jamais dans une discussion."],
    ask: "Comment créer le jeton d'accès permanent WhatsApp avec un utilisateur système Meta ?" },
  { id: 'secret', t: "Copier le secret de l'application", auto: (w) => w.secretSet, body: ["Dans votre application Meta : « Paramètres de l'app », puis « De base ». À côté de « Clé secrète de l'application », cliquez sur « Afficher » (Meta demande votre mot de passe).", 'Collez-le seulement dans le formulaire ci-dessous.'],
    ask: "Où trouver le secret de l'application dans Meta ?" },
  { id: 'save', t: 'Enregistrer vos identifiants', auto: (w) => w.connected, body: ["Remplissez « Vos identifiants » plus bas (identifiant du numéro, identifiant du compte WhatsApp Business, numéro avec indicatif, jeton, secret) et cliquez sur « Enregistrer ». Le jeton est chiffré et ne s'affiche plus jamais."] },
  { id: 'hook', t: 'Configurer le webhook chez Meta', body: ["Après l'enregistrement, un encadré « À coller dans Meta » apparaît plus bas.", "Dans Meta : WhatsApp, puis Configuration, puis Webhook, « Modifier ». Collez l'adresse du webhook et le jeton de vérification, puis « Vérifier et enregistrer ».", "Dans « Champs du webhook », abonnez-vous au champ « messages ».", "Puis, dans Brij-IA, cliquez sur « Activer la réception des messages » : cela abonne l'application à votre compte WhatsApp Business (il faut avoir saisi son identifiant, « ID du compte de messagerie »). Sans cette étape, Meta peut ne rien envoyer."],
    ask: "Comment configurer le webhook WhatsApp dans Meta avec l'adresse et le jeton de vérification de Brij-IA ?" },
  { id: 'test', t: 'Tester', body: ["Cliquez sur « Tester la connexion » dans l'encadré « À coller dans Meta ».", "Puis écrivez un message au numéro depuis un autre téléphone : l'assistant doit répondre. Avec le numéro de test, seul un numéro ajouté dans « À » peut écrire."],
    ask: "J'ai tout configuré mais l'assistant ne répond pas sur WhatsApp. Comment trouver la cause ?" },
  { id: 'live', t: 'Passer en production (vrais clients)', info: true, body: ["Publiez l'application en mode « Live » (menu « Publier » chez Meta). Meta demande une adresse de politique de confidentialité.", 'La vérification de votre entreprise chez Meta lève les limites d\'envoi.', 'Un client qui écrit en premier peut recevoir vos réponses pendant 24 heures. Après ce délai, ou pour écrire en premier, il faut un modèle de message validé par Meta.'],
    ask: "Que faut-il faire chez Meta pour passer de l'essai à de vrais clients sur WhatsApp ?" },
];

/** Assistant d'installation WhatsApp : étapes cochables, avance seul selon ce qui est déjà enregistré. */
export function WaWizard({ w, embedded }) {
  const t = useT();
  const { orgId, askAI } = useWs();
  const key = 'mia-wa-steps-' + orgId;
  const [manual, setManual] = useState({});
  const [open, setOpen] = useState(null);
  useEffect(() => { try { setManual(JSON.parse(localStorage.getItem(key) || '{}')); } catch { setManual({}); } }, [key]);
  const toggle = (id) => setManual((m) => { const n = { ...m, [id]: !m[id] }; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* stockage indisponible */ } return n; });
  const isDone = (s) => (s.auto ? s.auto(w) : false) || Boolean(manual[s.id]);
  const STEPS = embedded ? [ONE_CLICK, ...BASE] : BASE;
  const todo = STEPS.filter((s) => !s.info);
  const done = todo.filter(isDone).length;
  const cur = STEPS.find((s) => !s.info && !isDone(s));
  return (
    <div className="ws-card wa-wiz">
      <h2>{t("Assistant d'installation WhatsApp")}</h2>
      <div className="wa-bar" role="progressbar" aria-valuemin={0} aria-valuemax={todo.length} aria-valuenow={done} aria-label={t("Progression")}><i style={{ width: (100 * done / todo.length) + '%' }} /></div>
      <p className="muted small">{t("{done} étape(s) sur {total} faites. Cochez au fur et à mesure : les étapes d'identifiants se cochent seules quand vous enregistrez. Ne collez jamais un jeton ou un secret dans la discussion avec l'assistant IA.", { done, total: todo.length })}</p>
      <ol className="wa-steps">
        {STEPS.map((s, i) => {
          const d = isDone(s), o = open === s.id || (open === null && cur && cur.id === s.id);
          return (
            <li key={s.id} className={(d ? 'done ' : '') + (o ? 'open' : '')}>
              <div className="wa-h">
                {s.info ? <span className="wa-n info">i</span> : <button type="button" className="wa-n" aria-pressed={d} aria-label={d ? t('Décocher : {step}', { step: t(s.t) }) : t('Cocher : {step}', { step: t(s.t) })} onClick={() => !s.auto || !s.auto(w) ? toggle(s.id) : null}>{d ? '✓' : i + 1}</button>}
                <button type="button" className="wa-t" aria-expanded={o} onClick={() => setOpen(o ? '' : s.id)}>{t(s.t)}</button>
              </div>
              {o ? (
                <div className="wa-b">
                  {s.body.map((p) => <p key={p}>{t(p)}</p>)}
                  <div className="row">
                    {s.url ? <a className="btn small" href={s.url} target="_blank" rel="noopener noreferrer">{t(s.link)}</a> : null}
                    {s.ask ? <button type="button" className="btn small" onClick={() => askAI(t(s.ask))}>{t("Je bloque : demander à l'assistant IA")}</button> : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
