import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { alertText } from './alertText.js';
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
  return st.data ? st.data.templates.filter((x) => x.kind === kind).map((x) => ({ label: x.title, values: x.data })) : [];
}

/** Boutons « Fichiers » et « Historique » d'une ligne. */
function useAttach(type, onChange) {
  const t = useT();
  const { modal } = useWs();
  return (it, reload) => (
    <Act onClick={() => modal(t('Fichiers : {title}', { title: it.title }), () => <FilesBox type={type} id={it.id} onChange={() => { reload(); if (onChange) onChange(); }} />, { wide: true })}>{it.filesCount ? t('Fichiers ({n})', { n: it.filesCount }) : t('Fichiers')}</Act>
  );
}

export function Contracts({ onChange }) {
  const t = useT();
  const { money, dateFr, modal } = useWs();
  const files = useAttach('contract', onChange);
  return (
    <Crud
      path="/legal/contracts" listKey="contracts" title={t('Registre des contrats')} addLabel={t('Ajouter un contrat')} formTitle={t('Nouveau contrat')} onChange={onChange}
      intro={t("Notez vos contrats et leurs dates : l'application vous prévient 30 puis 7 jours avant la fin et avant la date limite de préavis.")}
      empty={t('Aucun contrat enregistré. Ajoutez votre bail, vos assurances, vos contrats de travail et de fournisseurs.')} deleteText={t('Supprimer ce contrat du registre ?')}
      fields={(c, j) => [
        { k: 'title', label: t('Titre'), required: true, value: c && c.title, placeholder: t('Bail du magasin') },
        { k: 'type', label: t('Type'), type: 'select', options: CONTRACT_TYPES.map((x) => [x[0], t(x[1])]), value: c ? c.type : 'client' },
        { k: 'parties', label: t('Parties'), value: c && c.parties, placeholder: t('Vous et M. Njoya') },
        { k: 'subject', label: t('Objet'), type: 'textarea', rows: 2, value: c && c.subject },
        { k: 'amount', label: t('Montant'), value: c && c.amount ? c.amount : '' },
        { k: 'startDate', label: t('Début'), type: 'date', value: c && c.startDate }, { k: 'endDate', label: t('Fin'), type: 'date', value: c && c.endDate },
        { k: 'tacit', label: t('Reconduction tacite'), type: 'select', options: [['no', t('Non')], ['yes', t('Oui (se renouvelle seul)')]], value: c && c.tacit ? 'yes' : 'no' },
        { k: 'noticeDays', label: t('Préavis (jours)'), value: c ? c.noticeDays : '', hint: t('Délai à respecter avant la fin pour résilier ou ne pas renouveler.') },
        { k: 'status', label: t('Statut'), type: 'select', options: [['active', t('En cours')], ['draft', t('Brouillon')], ['terminated', t('Terminé ou résilié')]], value: c ? c.status : 'active' },
        { k: 'docRef', label: t('Où est le document ?'), value: c && c.docRef, placeholder: t('Classeur A, lien du fichier…'), hint: t('Une référence ou un lien. Vous pouvez aussi joindre un PDF ou une image avec « Fichiers ».') },
        { k: 'assigneeId', label: t('Rappels attribués à'), type: 'select', options: [['', t('Personne')]].concat(j.members.map((m) => [String(m.userId), m.name])), value: c && c.assigneeId ? String(c.assigneeId) : '' },
        { k: 'signStatus', label: t('Signature'), type: 'select', options: [['none', t('Sans suivi')], ['to_sign', t('À signer')], ['signed', t('Signé')]], value: c ? c.signStatus : 'none', hint: t("Simple note pour vous : ce n'est pas une signature électronique et cela n'a pas de valeur légale.") },
        { k: 'signedAt', label: t('Date de signature (si signé)'), type: 'date', value: c && c.signedAt },
        { k: 'signers', label: t('Signataires'), value: c && c.signers, placeholder: t('Awa, M. Njoya') },
        { k: 'notes', label: t('Notes'), type: 'textarea', rows: 2, value: c && c.notes },
      ]}
      payload={(v) => ({ ...v, tacit: v.tacit === 'yes' })}
      extra={(c, reload) => (
        <>
          <Act onClick={() => modal(t('Historique : {title}', { title: c.title }), () => <HistoryBox id={c.id} />, { wide: true })}>{t('Historique')}</Act>
          {files(c, reload)}
        </>
      )}
      line={(c) => (
        <>
          <b>{c.title}</b> <small>{t(c.typeLabel)}</small>
          {c.status === 'draft' ? <span className="pill">{t('Brouillon')}</span> : null}{c.status === 'terminated' ? <span className="pill">{t('Terminé')}</span> : null}
          {c.signStatus !== 'none' ? <span className={'pill ' + (c.signStatus === 'signed' ? 'good' : 'mid')}>{c.signedAt ? t('{status} le {date}', { status: t(c.signLabel), date: dateFr(c.signedAt) }) : t(c.signLabel)}</span> : null}
          <br /><small>{[c.parties, c.endDate ? t('fin le {date}', { date: dateFr(c.endDate) }) : t('sans date de fin'), c.tacit ? t('reconduction tacite') : '', c.noticeDays ? t('préavis {n} j', { n: c.noticeDays }) : '', c.amount ? money(c.amount) : '', c.signers ? t('signataires : {list}', { list: c.signers }) : '', c.assignee ? t('rappels : {name}', { name: c.assignee }) : '', c.docRef].filter(Boolean).join(' · ')}</small>
          {c.alerts.map((a) => <div key={a.code}><span className={'pill ' + (a.level === 'high' ? 'bad' : 'mid')}>{alertText(a, dateFr)}</span></div>)}
        </>
      )}
    />
  );
}

export function Obligations({ onChange }) {
  const t = useT();
  const { oapi, dateFr, fail, toast, modal } = useWs();
  const presets = usePresets('obligation');
  const files = useAttach('obligation', onChange);
  const done = (o, reload) => modal(t('Marquer comme fait : {title}', { title: o.title }), (close) => (
    <form className="ws-form" onSubmit={(e) => {
      e.preventDefault();
      oapi('POST', '/legal/obligations/' + o.id + '/done', { proof: new FormData(e.target).get('proof') }).then((r) => { close(); toast(r.repeats ? t('Fait. Prochaine échéance calculée.') : t('Fait.')); reload(); }).catch(fail);
    }}>
      <label className="fld"><span>{t('Preuve (numéro de reçu, lien, emplacement du papier)')}</span><input name="proof" defaultValue={o.proof} autoComplete="off" /></label>
      <p className="muted small">{o.recurrenceMonths ? t("Cette obligation se répète tous les {n} mois : son échéance passera à la prochaine période.", { n: o.recurrenceMonths }) : t('Cette obligation sera terminée.')}</p>
      <div className="row"><button className="btn primary" type="submit">{t('Marquer comme fait')}</button></div>
    </form>
  ));
  return (
    <Crud
      path="/legal/obligations" listKey="obligations" title={t('Obligations de conformité')} addLabel={t('Ajouter une obligation')} formTitle={t('Nouvelle obligation')} onChange={onChange}
      intro={t('Licences, autorisations, assurances, déclarations, affichages, contrôles : ce qui revient à date fixe. Les exemples ci-dessous sont à adapter à votre pays et votre activité.')}
      presets={presets} empty={t("Aucune obligation. Partez d'un exemple ci-dessus ou ajoutez la vôtre.")} deleteText={t('Supprimer cette obligation ?')}
      fields={(o, j) => [
        { k: 'title', label: t('Titre'), required: true, value: o && o.title },
        { k: 'kind', label: t('Type'), type: 'select', options: OB_KINDS.map((x) => [x[0], t(x[1])]), value: o ? o.kind : 'other' },
        { k: 'dueDate', label: t('Échéance'), type: 'date', value: o && o.dueDate },
        { k: 'recurrenceMonths', label: t('Se répète tous les (mois)'), value: o ? o.recurrenceMonths || '' : '', hint: t('Ex. 12 pour une fois par an. Laissez vide si ponctuelle.') },
        { k: 'responsibleId', label: t('Responsable'), type: 'select', options: [['', t('Non défini')]].concat(j.members.map((m) => [String(m.userId), m.name])), value: o && o.responsibleId ? String(o.responsibleId) : '' },
        { k: 'proof', label: t('Preuve'), value: o && o.proof, placeholder: t('Numéro de reçu, emplacement du papier…') },
        { k: 'docRef', label: t('Où est le document ?'), value: o && o.docRef, placeholder: t('Lien ou classeur'), hint: t('Vous pouvez aussi joindre un PDF ou une image avec « Fichiers ».') },
        { k: 'notes', label: t('Notes'), type: 'textarea', rows: 2, value: o && o.notes },
      ]}
      line={(o) => (
        <>
          <b>{o.title}</b> <small>{t(o.kindLabel)}</small>
          {o.status === 'done' ? <span className="pill good">{t('Fait')}</span> : o.overdue ? <span className="pill bad">{t('En retard')}</span> : null}
          <br /><small>{[o.dueDate ? t('échéance {date}', { date: dateFr(o.dueDate) }) : t('sans échéance'), o.recurrenceMonths ? t('tous les {n} mois', { n: o.recurrenceMonths }) : '', o.responsible ? t('responsable : {name}', { name: o.responsible }) : '', o.proof ? t('preuve : {text}', { text: o.proof }) : '', o.docRef, o.lastDone ? t('dernière fois le {date}', { date: dateFr(o.lastDone) }) : ''].filter(Boolean).join(' · ')}</small>
        </>
      )}
      extra={(o, reload) => (
        <>
          {o.status === 'pending' ? <Act onClick={() => done(o, reload)}>{t('Fait')}</Act> : null}
          {files(o, reload)}
        </>
      )}
    />
  );
}

export function Disputes({ onChange }) {
  const t = useT();
  const { money, dateFr } = useWs();
  const files = useAttach('dispute', onChange);
  return (
    <Crud
      path="/legal/disputes" listKey="disputes" title={t('Litiges et incidents')} addLabel={t('Ajouter un dossier')} formTitle={t('Nouveau dossier')} onChange={onChange}
      empty={t('Aucun litige ni incident enregistré.')} deleteText={t('Supprimer ce dossier ?')}
      extra={files}
      fields={(d, j) => [
        { k: 'title', label: t('Titre'), required: true, value: d && d.title, placeholder: t('Impayé du client X') },
        { k: 'kind', label: t('Type'), type: 'select', options: D_KINDS.map((x) => [x[0], t(x[1])]), value: d ? d.kind : 'dispute' },
        { k: 'counterparty', label: t('Autre partie'), value: d && d.counterparty },
        { k: 'openedAt', label: t("Date d'ouverture"), type: 'date', value: d && d.openedAt },
        { k: 'status', label: t('Statut'), type: 'select', options: D_STATUS.map((x) => [x[0], t(x[1])]), value: d ? d.status : 'open' },
        { k: 'amount', label: t('Montant en jeu'), value: d && d.amount ? d.amount : '' },
        { k: 'description', label: t("Ce qui s'est passé"), type: 'textarea', rows: 3, value: d && d.description },
        { k: 'nextStep', label: t('Prochaine étape'), value: d && d.nextStep }, { k: 'nextDate', label: t('Date de la prochaine étape'), type: 'date', value: d && d.nextDate },
        { k: 'assigneeId', label: t('Rappels attribués à'), type: 'select', options: [['', t('Personne')]].concat(j.members.map((m) => [String(m.userId), m.name])), value: d && d.assigneeId ? String(d.assigneeId) : '' },
        { k: 'docRef', label: t('Où sont les documents ?'), value: d && d.docRef, placeholder: t('Lien ou classeur'), hint: t('Vous pouvez aussi joindre des PDF ou des images avec « Fichiers ».') },
        { k: 'outcome', label: t('Issue'), value: d && d.outcome },
      ]}
      line={(d) => (
        <>
          <b>{d.title}</b> <small>{t(d.kindLabel)}</small> <span className={'pill ' + (d.status === 'closed' ? 'good' : 'mid')}>{t(D_STATUS.find((s) => s[0] === d.status)[1])}</span>
          <br /><small>{[d.counterparty, t('ouvert le {date}', { date: dateFr(d.openedAt) }), d.amount ? money(d.amount) : '', d.nextStep ? t('à faire : {step}', { step: d.nextStep }) + (d.nextDate ? ' (' + dateFr(d.nextDate) + ')' : '') : '', d.outcome ? t('issue : {text}', { text: d.outcome }) : '', d.assignee ? t('rappels : {name}', { name: d.assignee }) : '', d.docRef].filter(Boolean).join(' · ')}</small>
        </>
      )}
    />
  );
}

export function Privacy({ onChange }) {
  const t = useT();
  const presets = usePresets('privacy');
  return (
    <Crud
      path="/legal/privacy" listKey="items" title={t('Registre des données personnelles')} addLabel={t('Ajouter une ligne')} formTitle={t('Nouvelle ligne du registre')} onChange={onChange}
      intro={t("Aide-mémoire : quelles données vous collectez, où elles sont, pourquoi et combien de temps. Ce n'est pas un avis juridique : la règle exacte dépend de votre pays.")}
      presets={presets} empty={t("Aucune ligne. Partez d'un exemple ci-dessus ou décrivez les données que vous collectez.")} deleteText={t('Supprimer cette ligne du registre ?')}
      fields={(p) => [
        { k: 'dataKind', label: t('Donnée collectée'), required: true, value: p && p.dataKind, placeholder: t('Nom et téléphone des clients') },
        { k: 'people', label: t('Personnes concernées'), value: p && p.people, placeholder: t('Clients, employés…') },
        { k: 'storedWhere', label: t('Où elle est conservée'), value: p && p.storedWhere, placeholder: t('MANAGER-IA, carnet papier, téléphone…') },
        { k: 'purpose', label: t('Pourquoi'), value: p && p.purpose, placeholder: t('Livrer, facturer…') },
        { k: 'retention', label: t('Durée de conservation'), value: p && p.retention, placeholder: t('3 ans après le dernier achat') },
        { k: 'sharedWith', label: t('Partagée avec'), value: p && p.sharedWith, placeholder: t('Livreur, comptable…') },
        { k: 'notes', label: t('Notes'), value: p && p.notes },
      ]}
      line={(p) => (
        <>
          <b>{p.dataKind}</b>
          <br /><small>{[p.people && t('concerne : {text}', { text: p.people }), p.storedWhere && t('conservée : {text}', { text: p.storedWhere }), p.purpose && t('pour : {text}', { text: p.purpose }), p.retention ? t('durée : {text}', { text: p.retention }) : t('durée à définir'), p.sharedWith && t('partagée avec : {text}', { text: p.sharedWith })].filter(Boolean).join(' · ')}</small>
        </>
      )}
    />
  );
}
