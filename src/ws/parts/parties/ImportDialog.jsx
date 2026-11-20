import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Icon } from '../../ui.jsx';
import { tsrv } from '../../../lib/srv.js';
import { PT } from './common.jsx';

/* Import CSV : simulation d'abord (rien n'est écrit), puis import. Les lignes en erreur sont listées avec leur numéro ; les autres passent. */
const MODEL = 'Nom;Type;Fin de validité;Statut;Contact;Téléphone;E-mail;Adresse;Ville;N° contribuable;Catégorie;Étiquettes;Latitude;Longitude;Remise %;Délai de paiement (j);Délai de livraison (j);Plafond;Notes\nBoutique Exemple;vip;;actif;;690000000;;Bonanjo;Douala;;;grossiste;4.05;9.70;10;30;1;;';
export default function ImportDialog({ kind, close, done }) {
  const t = useT();
  const { oapi, fail, toast } = useWs();
  const [csv, setCsv] = useState(''); const [rep, setRep] = useState(null); const [busy, setBusy] = useState(false);
  const read = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 1.5e6) { toast(t('Fichier trop volumineux (1,5 Mo au plus).'), true); return; } f.text().then((x) => { setCsv(x); setRep(null); }); };
  const run = (dry) => { setBusy(true); oapi('POST', PT + '/' + kind + '/import', { csv, dryRun: dry }).then((j) => { setRep(j); if (!dry) { toast(t('{c} créé(s), {u} mis à jour.', { c: j.created, u: j.updated })); done(); } }).catch(fail).finally(() => setBusy(false)); };
  return (
    <div className="pty-imp">
      <p>{t('Un fichier CSV avec une ligne d\'en-têtes. Colonnes reconnues : Nom (obligatoire), Type (simple, temporaire, permanent, vip), Fin de validité (AAAA-MM-JJ), Statut, Téléphone, E-mail, Adresse, Ville, Étiquettes, Latitude, Longitude, Remise %, etc. Une fiche du même nom est mise à jour.')}</p>
      <div className="row">
        <label className="ui-btn"><Icon name="upload" />{t('Choisir un fichier')}<input type="file" accept=".csv,text/csv,text/plain" onChange={read} style={{ display: 'none' }} /></label>
        <button type="button" className="ui-btn" onClick={() => { setCsv(MODEL); setRep(null); }}>{t('Insérer un exemple')}</button>
      </div>
      <label className="fld"><span>{t('Contenu du fichier')}</span><textarea rows={8} value={csv} onChange={(e) => { setCsv(e.target.value); setRep(null); }} spellCheck={false} /></label>
      {rep ? (
        <Alert tone={rep.errors.length ? 'warn' : 'ok'} title={rep.dryRun ? t('Simulation : rien n\'est enregistré') : t('Import terminé')}>
          <p>{t('{c} à créer, {u} à mettre à jour, {s} ligne(s) refusée(s).', { c: rep.created, u: rep.updated, s: rep.skipped })}</p>
          {rep.errors.length ? <ul>{rep.errors.slice(0, 20).map((e) => <li key={e.line}>{t('Ligne {n} : {m}', { n: e.line, m: tsrv(e.message) })}</li>)}</ul> : null}
        </Alert>
      ) : null}
      <div className="row">
        <button type="button" className="ui-btn" disabled={busy || !csv.trim()} onClick={() => run(true)}><Icon name="search" />{t('Simuler')}</button>
        <button type="button" className="ui-btn primary" disabled={busy || !csv.trim() || !rep || !rep.dryRun || (!rep.created && !rep.updated)} onClick={() => run(false)}><Icon name="check" />{t('Importer')}</button>
        <button type="button" className="ui-btn" onClick={close}>{t('Fermer')}</button>
      </div>
    </div>
  );
}
