import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';

const UPDATED = '23 octobre 2026';
const CONTACT_MAIL = 'tendabrandon9@gmail.com';

function Shell({ title, children }) {
  useEffect(() => { document.title = title + ' · MANAGER-IA'; window.scrollTo(0, 0); }, [title]);
  return (
    <>
      <header className="s-nav"><div className="s-wrap">
        <Logo />
        <div className="s-act"><Link className="s-btn login" to="/">Retour à l'accueil</Link></div>
      </div></header>
      <main className="s-legal"><div className="s-wrap">
        <h1>{title}</h1>
        <p className="muted">Dernière mise à jour : {UPDATED}. Ce texte est un modèle informatif : il doit être relu par un professionnel du droit avant une exploitation commerciale à grande échelle.</p>
        {children}
      </div></main>
      <footer className="s-foot"><div className="s-wrap">
        <div><Logo footer /></div>
        <nav aria-label="Liens du pied de page"><Link to="/confidentialite">Confidentialité</Link><Link to="/conditions">Conditions d'utilisation</Link><Link to="/">Accueil</Link></nav>
      </div></footer>
    </>
  );
}

export function Privacy() {
  return (
    <Shell title="Politique de confidentialité">
      <h2>Qui sommes-nous</h2>
      <p>MANAGER-IA est une plateforme de gestion d'activité assistée par l'intelligence artificielle, éditée par BrandX Creation (Cameroun). Contact : <a href={'mailto:' + CONTACT_MAIL}>{CONTACT_MAIL}</a>.</p>
      <h2>Les données que nous traitons</h2>
      <ul>
        <li><b>Votre compte :</b> nom, adresse e-mail ou numéro de téléphone, mot de passe (conservé sous forme chiffrée, jamais en clair) et offre choisie.</li>
        <li><b>Les données de votre organisation</b> que vous saisissez ou importez : clients, devis, factures, stock, équipe, comptabilité, projets, contrats, notes, etc. Vous en restez responsable.</li>
        <li><b>Les messages de vos clients</b> reçus par WhatsApp ou la page de discussion : texte, messages vocaux transcrits, photos et documents, ainsi que le numéro ou l'identifiant de l'expéditeur. Ils servent à répondre à ces personnes et à enregistrer leur demande ou leur commande.</li>
        <li><b>Des données techniques</b> : adresse IP, appareil et journal des actions sensibles, pour la sécurité du service.</li>
      </ul>
      <h2>À quoi elles servent</h2>
      <p>À fournir le service (gestion, réponses aux clients, notifications), à le sécuriser (détection d'abus, journal d'audit), et à vous contacter au sujet de votre compte. Nous ne vendons pas vos données et nous ne les utilisons pas pour de la publicité.</p>
      <h2>Les services qui participent au traitement</h2>
      <ul>
        <li><b>WhatsApp</b> transporte les messages entre vos clients et l'application.</li>
        <li><b>Un fournisseur d'intelligence artificielle</b> (Anthropic, Google ou un autre service compatible, selon la configuration) reçoit les extraits nécessaires pour rédiger une réponse ou une proposition. L'IA propose : elle ne modifie pas vos données sans votre validation.</li>
        <li><b>L'hébergement :</b> Vercel (site), Render (serveur) et Neon (base de données PostgreSQL), en Europe.</li>
        <li><b>Brevo</b> envoie les e-mails du service (codes de vérification, notifications).</li>
      </ul>
      <h2>Sécurité</h2>
      <p>Mots de passe chiffrés, jetons d'accès aux canaux chiffrés, séparation des données de chaque organisation, droits par rôle, double authentification disponible et journal d'audit des actions sensibles. Aucun système n'est infaillible : en cas d'incident touchant vos données, nous vous en informons.</p>
      <h2>Cookies et stockage local</h2>
      <p>MANAGER-IA utilise un cookie de session indispensable pour vous maintenir connecté, et le stockage du navigateur pour mémoriser le thème clair ou sombre et accélérer le chargement. Nous n'utilisons pas de cookies publicitaires.</p>
      <h2>Combien de temps nous conservons les données</h2>
      <p>Tant que votre compte est actif. Quand vous supprimez une organisation ou demandez la suppression de votre compte, les données correspondantes sont effacées, sauf celles que la loi nous oblige à conserver (par exemple des journaux de sécurité).</p>
      <h2 id="suppression">Vos droits et la suppression de vos données</h2>
      <p>Vous pouvez demander l'accès à vos données, leur correction ou leur suppression. Écrivez à <a href={'mailto:' + CONTACT_MAIL}>{CONTACT_MAIL}</a> depuis l'adresse de votre compte, en indiquant « Suppression de mes données » : nous traitons la demande dans un délai maximal de 30 jours. Une organisation peut aussi être supprimée directement dans l'application. Une personne dont le message a été reçu par un commerçant peut s'adresser à ce commerçant ou à nous pour demander l'effacement de la conversation.</p>
      <h2>Enfants</h2>
      <p>Le service s'adresse à des professionnels et n'est pas destiné aux personnes de moins de 16 ans.</p>
      <h2>Modifications</h2>
      <p>Nous pouvons modifier cette politique. La date de mise à jour figure en haut de la page.</p>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell title="Conditions d'utilisation">
      <h2>Le service</h2>
      <p>MANAGER-IA aide à gérer une activité (ventes, stock, comptabilité, équipe, etc.) et à répondre aux clients sur des canaux de messagerie, avec l'aide d'une intelligence artificielle. L'IA propose, vous validez : vous restez responsable de vos décisions.</p>
      <h2>Votre compte</h2>
      <p>Vous devez fournir des informations exactes, protéger votre mot de passe et nous prévenir en cas d'usage non autorisé. Vous êtes responsable des personnes que vous invitez dans votre organisation et des droits que vous leur donnez.</p>
      <h2>Utilisation acceptable</h2>
      <ul>
        <li>Respecter la loi, les règles de WhatsApp, et les droits des personnes que vous contactez (consentement, désabonnement).</li>
        <li>Ne pas envoyer de messages non sollicités en masse, de contenus illicites, trompeurs ou dangereux.</li>
        <li>Ne pas tenter de perturber, contourner ou attaquer le service.</li>
      </ul>
      <h2>Services de messagerie de tiers</h2>
      <p>La connexion à WhatsApp ou à un autre service de messagerie reste soumise aux règles de ce service, sur lesquelles nous n'avons pas la main. Un numéro peut être limité, suspendu ou déconnecté par le service de messagerie, et la connexion peut devoir être refaite. Nous ne sommes pas responsables de ces décisions ni de leurs conséquences.</p>
      <h2>Intelligence artificielle et documents préparés</h2>
      <p>Les réponses, propositions et documents produits par l'IA peuvent contenir des erreurs : relisez-les. Les états comptables, fiscaux, de paie ou juridiques fournis sont des <b>documents de travail</b> : ils ne remplacent pas un expert-comptable, un conseil fiscal ou un avocat, et ne sont pas des documents officiels.</p>
      <h2>Offres et paiement</h2>
      <p>L'offre Gratuite permet de découvrir le service dans ses limites. Les offres payantes sont facturées à l'avance pour la période choisie, par les moyens de paiement proposés dans l'application. Les limites de chaque offre sont indiquées sur la page des tarifs.</p>
      <h2>Disponibilité</h2>
      <p>Nous faisons de notre mieux pour que le service soit disponible, sans garantie d'absence d'interruption. Il dépend de services tiers (Meta, hébergeurs, fournisseur d'IA) sur lesquels nous n'avons pas la main.</p>
      <h2>Responsabilité</h2>
      <p>Dans la mesure permise par la loi, notre responsabilité est limitée aux sommes que vous avez payées pour le service au cours des 12 derniers mois. Nous ne sommes pas responsables des pertes indirectes ni des décisions prises à partir des propositions de l'IA.</p>
      <h2>Suspension et fin</h2>
      <p>Vous pouvez arrêter d'utiliser le service et supprimer votre organisation à tout moment. Nous pouvons suspendre un compte en cas d'abus ou de non-respect de ces conditions.</p>
      <h2>Droit applicable</h2>
      <p>Ces conditions sont régies par le droit camerounais. Contact : <a href={'mailto:' + CONTACT_MAIL}>{CONTACT_MAIL}</a>.</p>
      <p><Link to="/confidentialite">Voir la politique de confidentialité</Link></p>
    </Shell>
  );
}
