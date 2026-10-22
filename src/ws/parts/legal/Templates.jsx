import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { Empty } from '../../ui.jsx';

/* Juridique : modèles de documents en texte brut. Informatifs : à faire relire par un professionnel du droit. */

const MODELS = [
  {
    id: 'demand', title: 'Lettre de mise en demeure', fields: [['creditor', 'Votre nom ou raison sociale'], ['creditorAddr', 'Votre adresse'], ['debtor', 'Nom du débiteur'], ['debtorAddr', 'Adresse du débiteur'], ['amount', 'Montant dû'], ['origin', 'Origine de la dette (facture n°, date)'], ['days', 'Délai accordé (jours)'], ['city', 'Ville'], ['date', 'Date']],
    body: `{{creditor}}\n{{creditorAddr}}\n\n{{debtor}}\n{{debtorAddr}}\n\n{{city}}, le {{date}}\n\nObjet : mise en demeure de payer\n\nMadame, Monsieur,\n\nSauf erreur de notre part, vous restez nous devoir la somme de {{amount}} au titre de : {{origin}}.\n\nMalgré nos précédents rappels, cette somme n'a pas été réglée. Nous vous mettons donc en demeure de la payer dans un délai de {{days}} jours à compter de la réception de la présente lettre.\n\nÀ défaut de paiement dans ce délai, nous nous réservons le droit d'engager les démarches prévues pour obtenir le règlement de cette somme.\n\nNous restons disponibles pour trouver une solution amiable.\n\nVeuillez agréer, Madame, Monsieur, nos salutations distinguées.\n\n{{creditor}}\nSignature :`,
  },
  {
    id: 'work', title: 'Attestation de travail', fields: [['employer', 'Entreprise (nom)'], ['rep', 'Nom et fonction de la personne qui signe'], ['employee', "Nom de l'employé"], ['job', 'Poste occupé'], ['start', "Date d'entrée"], ['end', 'Date de sortie (ou « à ce jour »)'], ['city', 'Ville'], ['date', 'Date']],
    body: `ATTESTATION DE TRAVAIL\n\nJe soussigné(e), {{rep}}, agissant pour {{employer}}, atteste que {{employee}} a travaillé dans notre entreprise en qualité de {{job}} du {{start}} au {{end}}.\n\nCette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.\n\nFait à {{city}}, le {{date}}\n\n{{rep}}\nSignature et cachet :`,
  },
  {
    id: 'debt', title: 'Reconnaissance de dette', fields: [['debtor', 'Nom du débiteur (celui qui doit)'], ['creditor', 'Nom du créancier (celui qui prête)'], ['amount', 'Montant (en chiffres et en lettres)'], ['reason', 'Origine de la somme'], ['terms', 'Conditions de remboursement (dates, mensualités)'], ['city', 'Ville'], ['date', 'Date']],
    body: `RECONNAISSANCE DE DETTE\n\nJe soussigné(e) {{debtor}} reconnais devoir à {{creditor}} la somme de {{amount}}, correspondant à : {{reason}}.\n\nJe m'engage à rembourser cette somme selon les conditions suivantes : {{terms}}.\n\nFait à {{city}}, le {{date}}, en deux exemplaires.\n\nLe débiteur ({{debtor}}) :\nÉcrire « Lu et approuvé » puis signer.\n\nLe créancier ({{creditor}}) :\nSignature :`,
  },
  {
    id: 'service', title: 'Contrat de prestation simple', fields: [['provider', 'Prestataire (nom)'], ['client', 'Client (nom)'], ['service', 'Description du travail à faire'], ['price', 'Prix'], ['payment', 'Modalités de paiement (acompte, solde, dates)'], ['start', 'Date de début'], ['duration', 'Durée ou date de fin'], ['city', 'Ville'], ['date', 'Date']],
    body: `CONTRAT DE PRESTATION DE SERVICES\n\nEntre {{provider}} (le prestataire) et {{client}} (le client).\n\nArticle 1 - Objet\nLe prestataire s'engage à réaliser pour le client : {{service}}.\n\nArticle 2 - Durée\nLa prestation commence le {{start}}. Durée ou date de fin : {{duration}}.\n\nArticle 3 - Prix et paiement\nLe prix est de {{price}}. Paiement : {{payment}}.\n\nArticle 4 - Obligations\nLe prestataire réalise le travail avec soin. Le client fournit les informations nécessaires et paie aux dates prévues.\n\nArticle 5 - Fin anticipée\nChaque partie peut mettre fin au contrat par écrit, en prévenant l'autre à l'avance et en réglant ce qui est déjà fait.\n\nArticle 6 - Litiges\nEn cas de désaccord, les parties cherchent d'abord une solution amiable.\n\nFait à {{city}}, le {{date}}, en deux exemplaires.\n\nLe prestataire ({{provider}}) :        Le client ({{client}}) :\nSignature :                              Signature :`,
  },
];

const fill = (m, vals) => m.body.replace(/\{\{(\w+)\}\}/g, (_, k) => (vals[k] && vals[k].trim()) || '[à compléter]');

export default function Templates() {
  const { copy, toast, today } = useWs();
  const [id, setId] = useState(null);
  const [vals, setVals] = useState({});
  const [text, setText] = useState('');
  const model = MODELS.find((m) => m.id === id);
  const choose = (m) => { setId(m.id); const v = { date: today().split('-').reverse().join('/') }; setVals(v); setText(fill(m, v)); };
  const setVal = (k, v) => { const next = { ...vals, [k]: v }; setVals(next); setText(fill(model, next)); };
  // Impression : une page vide reçoit le texte par textContent (jamais de HTML), puis la fenêtre d'impression s'ouvre.
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) { toast("Votre navigateur a bloqué l'ouverture. Autorisez les fenêtres pour imprimer.", true); return; }
    const pre = w.document.createElement('pre');
    pre.textContent = text;
    pre.style.whiteSpace = 'pre-wrap'; pre.style.fontFamily = 'Georgia, serif'; pre.style.fontSize = '14px'; pre.style.margin = '24px';
    w.document.title = model.title;
    w.document.body.appendChild(pre);
    w.focus(); w.print();
  };
  return (
    <div className="ws-card">
      <h2>Modèles de documents</h2>
      <p className="ws-err">Modèle informatif à faire relire par un professionnel du droit avant tout usage.</p>
      <p className="muted small">Choisissez un modèle, complétez les champs : le texte se remplit tout seul et reste modifiable. Les lois changent d'un pays à l'autre : adaptez le texte à votre situation.</p>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {MODELS.map((m) => <button key={m.id} type="button" className={'btn small' + (id === m.id ? ' primary' : '')} onClick={() => choose(m)}>{m.title}</button>)}
      </div>
      {!model ? <Empty text="Choisissez un modèle ci-dessus." /> : (
        <>
          <div className="ws-form">
            {model.fields.map(([k, label]) => <label className="fld" key={k}><span>{label}</span><input value={vals[k] || ''} autoComplete="off" onChange={(e) => setVal(k, e.target.value)} /></label>)}
          </div>
          <label className="fld"><span>Texte du document (modifiable)</span><textarea rows={18} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" type="button" onClick={() => copy(text, 'Texte copié.')}>Copier le texte</button>
            <button className="btn" type="button" onClick={print}>Imprimer</button>
          </div>
          <p className="muted small">Modèle informatif à faire relire par un professionnel du droit.</p>
        </>
      )}
    </div>
  );
}
