import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import { BTN, saveFile } from './common.jsx';

/* Intégrations · vague 3 : historique de livraison des webhooks, export / import CSV. */

export function Deliveries() {
  const t = useT();
  const { oapi, dateFr, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/integrations/deliveries'), []);
  return (
    <div className="ws-card">
      <h2>{t('Historique de livraison des webhooks')}</h2>
      <Loaded state={st}>{(j) => (
        <>
          {!j.items.length ? <Empty text={t('Aucune livraison pour le moment.')} /> : null}
          {j.items.slice(0, 30).map((d) => (
            <div className="line" key={d.id}>
              <span><b>{d.event}</b><span className={'pill ' + (d.ok ? '' : 'bad')}>{d.ok ? t('Livré') : t('Échec')}</span><br /><small className="muted">{dateFr(d.at) + ' · ' + d.status + ' · ' + t('essai {n}', { n: d.attempts })}</small></span>
              {!d.ok ? <button className="link" type="button" style={BTN} onClick={() => oapi('POST', '/integrations/deliveries/' + d.id + '/retry', {}).then((r) => { toast(r.ok ? t('Livré.') : t('Échec : {s}', { s: tsrv(r.status) }), !r.ok); st.reload(); }).catch(fail)}>{t('Renvoyer')}</button> : null}
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}

const EXPORTS = [['customers', 'Clients'], ['invoices', 'Factures'], ['stock', 'Stock'], ['tickets', 'Tickets']];
export function CsvTools() {
  const t = useT();
  const { oapi, orgId, fail, toast } = useWs();
  const [kind, setKind] = useState('customers');
  const [csv, setCsv] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) { fail(new Error(t('Fichier trop lourd (1,5 Mo au plus).'))); return; }
    const r = new FileReader();
    r.onload = () => { setCsv(String(r.result)); setRes(null); };
    r.readAsText(f);
  };
  const run = (dryRun) => { setBusy(true); oapi('POST', '/data/import/' + kind, { csv, dryRun }).then((r) => { setRes(r); if (!dryRun) toast(t('{n} ligne(s) importée(s).', { n: r.created })); }).catch(fail).finally(() => setBusy(false)); };
  return (
    <div className="ws-card">
      <h2>{t('Export et import CSV')}</h2>
      <p className="muted small">{t('Les fichiers sont lisibles dans Excel (séparateur « ; »). Le consentement marketing n’est jamais importé.')}</p>
      <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        {EXPORTS.map(([k, l]) => <button key={k} className="btn small" type="button" style={BTN} onClick={() => saveFile('/orgs/' + orgId + '/data/export/' + k, k + '.csv', fail)}>{t('Exporter : {what}', { what: t(l) })}</button>)}
      </div>
      <h3>{t('Importer')}</h3>
      <label className="fld"><span>{t('Que voulez-vous importer ?')}</span><select style={{ fontSize: 16 }} value={kind} onChange={(e) => { setKind(e.target.value); setRes(null); }}><option value="customers">{t('Clients (colonnes : Nom, Téléphone, E-mail, Notes)')}</option><option value="stock">{t('Stock (colonnes : Article, SKU, Unité, Quantité, Seuil minimum, Coût unitaire)')}</option></select></label>
      <input type="file" accept=".csv,text/csv,text/plain" onChange={load} aria-label={t('Choisir un fichier CSV')} style={{ fontSize: 16 }} />
      <label className="fld"><span>{t('ou collez le contenu')}</span><textarea rows={5} style={{ fontSize: 16 }} value={csv} onChange={(e) => { setCsv(e.target.value); setRes(null); }} /></label>
      <div className="row"><button className="btn small" type="button" style={BTN} disabled={busy || !csv.trim()} onClick={() => run(true)}>{t('Vérifier avant import')}</button><button className="btn primary small" type="button" style={BTN} disabled={busy || !res || !res.dryRun || !res.created} onClick={() => run(false)}>{t('Importer')}</button></div>
      {res ? (
        <>
          <p className="small">{(res.dryRun ? t('Aperçu : ') : '') + t('{c} à créer, {d} doublon(s) ignoré(s), {e} erreur(s).', { c: res.created, d: res.duplicates, e: res.errorCount })}</p>
          {res.errors.map((e, i) => <p className="small late" key={i}>{t('Ligne {line} : {message}', { line: e.line, message: tsrv(e.message) })}</p>)}
        </>
      ) : null}
    </div>
  );
}
