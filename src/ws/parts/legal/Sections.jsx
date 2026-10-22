import { useWs } from '../../WsContext.jsx';
import { useLoad } from '../../ui.jsx';
import { Act } from './Act.jsx';
import Crud from './Crud.jsx';
import { FilesBox } from './Files.jsx';
import { HistoryBox } from './History.jsx';

/* Juridique : contrats, obligations de conformité, litiges, registre des données personnelles. */

const CONTRACT_TYPES = [['client', 'Client'], ['supplier', 'Fournisseur'], ['lease', 'Bail'], ['work', 'Travail'], ['insurance', 'Assurance'], ['partnership', 'Partenariat'], ['other', 'Autre']];
const OB_KINDS = [['license', 'Licence'], ['authorization', 'Autorisation'], ['insurance', 'Assurance'], ['declaration', 'Déclaration'], ['display', 'Affichage obligatoire'], ['inspection', 'Contrôle'], ['other', 'Autre']];
const D_KINDS = [['dispute', 'Litige'], ['incident', 'Incident'], ['claim', 'Réclamation'], ['inspection', 'Contrôle / sanction']];
const D_STATUS = [['open', 'Ouvert'], ['in_progress', 'En cours'], ['closed', 'Clos']];

/** Exemples d'obligations ou de lignes du registre : fournis par MANAGER-IA ou créés par l'organisation (onglet Modèles). */
function usePresets(kind) {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/legal/templates'), []);
  return st.data ? st.data.templates.filter((t) => t.kind === kind).map((t) => ({ label: t.title, values: t.data })) : [];
}

/** Boutons « Fichiers » et « Historique » d'une ligne. */
function useAttach(type, onChange) {
  const { modal } = useWs();
  return (it, reload) => (
    <Act onClick={() => modal('Fichiers : ' + it.title, () => <FilesBox type={type} id={it.id} onChange={() => { reload(); if (onChange) onChange(); }} />, { wide: true })}>{'Fichiers' + (it.filesCount ? ' (' + it.filesCount + ')' : '')}</Act>
  );
}

export function Contracts({ onChange }) {
  const { money, dateFr, modal } = useWs();
  const files = useAttach('contract', onChange);
  return (
    <Crud
      path="/legal/contracts" listKey="contracts" title="Registre des contrats" addLabel="Ajouter un contrat" formTitle="Nouveau contrat" onChange={onChange}
      intro="Notez vos contrats et leurs dates : l'application vous prévient 30 puis 7 jours avant la fin et avant la date limite de préavis."
      empty="Aucun contrat enregistré. Ajoutez votre bail, vos assurances, vos contrats de travail et de fournisseurs." deleteText="Supprimer ce contrat du registre ?"
      fields={(c, j) => [
        { k: 'title', label: 'Titre', required: true, value: c && c.title, placeholder: 'Bail du magasin' },
        { k: 'type', label: 'Type', type: 'select', options: CONTRACT_TYPES, value: c ? c.type : 'client' },
        { k: 'parties', label: 'Parties', value: c && c.parties, placeholder: 'Vous et M. Njoya' },
        { k: 'subject', label: 'Objet', type: 'textarea', rows: 2, value: c && c.subject },
        { k: 'amount', label: 'Montant', value: c && c.amount ? c.amount : '' },
        { k: 'startDate', label: 'Début', type: 'date', value: c && c.startDate }, { k: 'endDate', label: 'Fin', type: 'date', value: c && c.endDate },
        { k: 'tacit', label: 'Reconduction tacite', type: 'select', options: [['no', 'Non'], ['yes', 'Oui (se renouvelle seul)']], value: c && c.tacit ? 'yes' : 'no' },
        { k: 'noticeDays', label: 'Préavis (jours)', value: c ? c.noticeDays : '', hint: 'Délai à respecter avant la fin pour résilier ou ne pas renouveler.' },
        { k: 'status', label: 'Statut', type: 'select', options: [['active', 'En cours'], ['draft', 'Brouillon'], ['terminated', 'Terminé ou résilié']], value: c ? c.status : 'active' },
        { k: 'docRef', label: 'Où est le document ?', value: c && c.docRef, placeholder: 'Classeur A, lien du fichier…', hint: 'Une référence ou un lien. Vous pouvez aussi joindre un PDF ou une image avec « Fichiers ».' },
        { k: 'assigneeId', label: 'Rappels attribués à', type: 'select', options: [['', 'Personne']].concat(j.members.map((m) => [String(m.userId), m.name])), value: c && c.assigneeId ? String(c.assigneeId) : '' },
        { k: 'signStatus', label: 'Signature', type: 'select', options: [['none', 'Sans suivi'], ['to_sign', 'À signer'], ['signed', 'Signé']], value: c ? c.signStatus : 'none', hint: "Simple note pour vous : ce n'est pas une signature électronique et cela n'a pas de valeur légale." },
        { k: 'signedAt', label: 'Date de signature (si signé)', type: 'date', value: c && c.signedAt },
        { k: 'signers', label: 'Signataires', value: c && c.signers, placeholder: 'Awa, M. Njoya' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: c && c.notes },
      ]}
      payload={(v) => ({ ...v, tacit: v.tacit === 'yes' })}
      extra={(c, reload) => (
        <>
          <Act onClick={() => modal('Historique : ' + c.title, () => <HistoryBox id={c.id} />, { wide: true })}>Historique</Act>
          {files(c, reload)}
        </>
      )}
      line={(c) => (
        <>
          <b>{c.title}</b> <small>{c.typeLabel}</small>
          {c.status === 'draft' ? <span className="pill">Brouillon</span> : null}{c.status === 'terminated' ? <span className="pill">Terminé</span> : null}
          {c.signStatus !== 'none' ? <span className={'pill ' + (c.signStatus === 'signed' ? 'good' : 'mid')}>{c.signLabel + (c.signedAt ? ' le ' + dateFr(c.signedAt) : '')}</span> : null}
          <br /><small>{[c.parties, c.endDate ? 'fin le ' + dateFr(c.endDate) : 'sans date de fin', c.tacit ? 'reconduction tacite' : '', c.noticeDays ? 'préavis ' + c.noticeDays + ' j' : '', c.amount ? money(c.amount) : '', c.signers ? 'signataires : ' + c.signers : '', c.assignee ? 'rappels : ' + c.assignee : '', c.docRef].filter(Boolean).join(' · ')}</small>
          {c.alerts.map((a) => <div key={a.code}><span className={'pill ' + (a.level === 'high' ? 'bad' : 'mid')}>{a.text}</span></div>)}
        </>
      )}
    />
  );
}

export function Obligations({ onChange }) {
  const { oapi, dateFr, fail, toast, modal } = useWs();
  const presets = usePresets('obligation');
  const files = useAttach('obligation', onChange);
  const done = (o, reload) => modal('Marquer comme fait : ' + o.title, (close) => (
    <form className="ws-form" onSubmit={(e) => {
      e.preventDefault();
      oapi('POST', '/legal/obligations/' + o.id + '/done', { proof: new FormData(e.target).get('proof') }).then((r) => { close(); toast(r.repeats ? 'Fait. Prochaine échéance calculée.' : 'Fait.'); reload(); }).catch(fail);
    }}>
      <label className="fld"><span>Preuve (numéro de reçu, lien, emplacement du papier)</span><input name="proof" defaultValue={o.proof} autoComplete="off" /></label>
      <p className="muted small">{o.recurrenceMonths ? 'Cette obligation se répète tous les ' + o.recurrenceMonths + ' mois : son échéance passera à la prochaine période.' : 'Cette obligation sera terminée.'}</p>
      <div className="row"><button className="btn primary" type="submit">Marquer comme fait</button></div>
    </form>
  ));
  return (
    <Crud
      path="/legal/obligations" listKey="obligations" title="Obligations de conformité" addLabel="Ajouter une obligation" formTitle="Nouvelle obligation" onChange={onChange}
      intro="Licences, autorisations, assurances, déclarations, affichages, contrôles : ce qui revient à date fixe. Les exemples ci-dessous sont à adapter à votre pays et votre activité."
      presets={presets} empty="Aucune obligation. Partez d'un exemple ci-dessus ou ajoutez la vôtre." deleteText="Supprimer cette obligation ?"
      fields={(o, j) => [
        { k: 'title', label: 'Titre', required: true, value: o && o.title },
        { k: 'kind', label: 'Type', type: 'select', options: OB_KINDS, value: o ? o.kind : 'other' },
        { k: 'dueDate', label: 'Échéance', type: 'date', value: o && o.dueDate },
        { k: 'recurrenceMonths', label: 'Se répète tous les (mois)', value: o ? o.recurrenceMonths || '' : '', hint: 'Ex. 12 pour une fois par an. Laissez vide si ponctuelle.' },
        { k: 'responsibleId', label: 'Responsable', type: 'select', options: [['', 'Non défini']].concat(j.members.map((m) => [String(m.userId), m.name])), value: o && o.responsibleId ? String(o.responsibleId) : '' },
        { k: 'proof', label: 'Preuve', value: o && o.proof, placeholder: 'Numéro de reçu, emplacement du papier…' },
        { k: 'docRef', label: 'Où est le document ?', value: o && o.docRef, placeholder: 'Lien ou classeur', hint: 'Vous pouvez aussi joindre un PDF ou une image avec « Fichiers ».' },
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: o && o.notes },
      ]}
      line={(o) => (
        <>
          <b>{o.title}</b> <small>{o.kindLabel}</small>
          {o.status === 'done' ? <span className="pill good">Fait</span> : o.overdue ? <span className="pill bad">En retard</span> : null}
          <br /><small>{[o.dueDate ? 'échéance ' + dateFr(o.dueDate) : 'sans échéance', o.recurrenceMonths ? 'tous les ' + o.recurrenceMonths + ' mois' : '', o.responsible ? 'responsable : ' + o.responsible : '', o.proof ? 'preuve : ' + o.proof : '', o.docRef, o.lastDone ? 'dernière fois le ' + dateFr(o.lastDone) : ''].filter(Boolean).join(' · ')}</small>
        </>
      )}
      extra={(o, reload) => (
        <>
          {o.status === 'pending' ? <Act onClick={() => done(o, reload)}>Fait</Act> : null}
          {files(o, reload)}
        </>
      )}
    />
  );
}

export function Disputes({ onChange }) {
  const { money, dateFr } = useWs();
  const files = useAttach('dispute', onChange);
  return (
    <Crud
      path="/legal/disputes" listKey="disputes" title="Litiges et incidents" addLabel="Ajouter un dossier" formTitle="Nouveau dossier" onChange={onChange}
      empty="Aucun litige ni incident enregistré." deleteText="Supprimer ce dossier ?"
      extra={files}
      fields={(d, j) => [
        { k: 'title', label: 'Titre', required: true, value: d && d.title, placeholder: 'Impayé du client X' },
        { k: 'kind', label: 'Type', type: 'select', options: D_KINDS, value: d ? d.kind : 'dispute' },
        { k: 'counterparty', label: 'Autre partie', value: d && d.counterparty },
        { k: 'openedAt', label: 'Date d\'ouverture', type: 'date', value: d && d.openedAt },
        { k: 'status', label: 'Statut', type: 'select', options: D_STATUS, value: d ? d.status : 'open' },
        { k: 'amount', label: 'Montant en jeu', value: d && d.amount ? d.amount : '' },
        { k: 'description', label: 'Ce qui s\'est passé', type: 'textarea', rows: 3, value: d && d.description },
        { k: 'nextStep', label: 'Prochaine étape', value: d && d.nextStep }, { k: 'nextDate', label: 'Date de la prochaine étape', type: 'date', value: d && d.nextDate },
        { k: 'assigneeId', label: 'Rappels attribués à', type: 'select', options: [['', 'Personne']].concat(j.members.map((m) => [String(m.userId), m.name])), value: d && d.assigneeId ? String(d.assigneeId) : '' },
        { k: 'docRef', label: 'Où sont les documents ?', value: d && d.docRef, placeholder: 'Lien ou classeur', hint: 'Vous pouvez aussi joindre des PDF ou des images avec « Fichiers ».' },
        { k: 'outcome', label: 'Issue', value: d && d.outcome },
      ]}
      line={(d) => (
        <>
          <b>{d.title}</b> <small>{d.kindLabel}</small> <span className={'pill ' + (d.status === 'closed' ? 'good' : 'mid')}>{D_STATUS.find((s) => s[0] === d.status)[1]}</span>
          <br /><small>{[d.counterparty, 'ouvert le ' + dateFr(d.openedAt), d.amount ? money(d.amount) : '', d.nextStep ? 'à faire : ' + d.nextStep + (d.nextDate ? ' (' + dateFr(d.nextDate) + ')' : '') : '', d.outcome ? 'issue : ' + d.outcome : '', d.assignee ? 'rappels : ' + d.assignee : '', d.docRef].filter(Boolean).join(' · ')}</small>
        </>
      )}
    />
  );
}

export function Privacy({ onChange }) {
  const presets = usePresets('privacy');
  return (
    <Crud
      path="/legal/privacy" listKey="items" title="Registre des données personnelles" addLabel="Ajouter une ligne" formTitle="Nouvelle ligne du registre" onChange={onChange}
      intro="Aide-mémoire : quelles données vous collectez, où elles sont, pourquoi et combien de temps. Ce n'est pas un avis juridique : la règle exacte dépend de votre pays."
      presets={presets} empty="Aucune ligne. Partez d'un exemple ci-dessus ou décrivez les données que vous collectez." deleteText="Supprimer cette ligne du registre ?"
      fields={(p) => [
        { k: 'dataKind', label: 'Donnée collectée', required: true, value: p && p.dataKind, placeholder: 'Nom et téléphone des clients' },
        { k: 'people', label: 'Personnes concernées', value: p && p.people, placeholder: 'Clients, employés…' },
        { k: 'storedWhere', label: 'Où elle est conservée', value: p && p.storedWhere, placeholder: 'MANAGER-IA, carnet papier, téléphone…' },
        { k: 'purpose', label: 'Pourquoi', value: p && p.purpose, placeholder: 'Livrer, facturer…' },
        { k: 'retention', label: 'Durée de conservation', value: p && p.retention, placeholder: '3 ans après le dernier achat' },
        { k: 'sharedWith', label: 'Partagée avec', value: p && p.sharedWith, placeholder: 'Livreur, comptable…' },
        { k: 'notes', label: 'Notes', value: p && p.notes },
      ]}
      line={(p) => (
        <>
          <b>{p.dataKind}</b>
          <br /><small>{[p.people && 'concerne : ' + p.people, p.storedWhere && 'conservée : ' + p.storedWhere, p.purpose && 'pour : ' + p.purpose, p.retention ? 'durée : ' + p.retention : 'durée à définir', p.sharedWith && 'partagée avec : ' + p.sharedWith].filter(Boolean).join(' · ')}</small>
        </>
      )}
    />
  );
}
