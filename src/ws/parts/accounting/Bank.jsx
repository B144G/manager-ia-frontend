import { useRef, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN, TAP, WorkNotice } from '../finance/util.jsx';

/* Rapprochement bancaire : import CSV du relevé (format détecté), suggestions (montant + date + référence), pointage manuel, écarts.
   Document de travail : le rapprochement ne modifie jamais les écritures. */

const CONF = { high: ['good', 'Confiance élevée'], medium: ['mid', 'À vérifier'] };
const REASONS = { 'montant identique': 'montant identique', 'même date': 'même date', 'référence trouvée': 'référence trouvée', 'libellé proche': 'libellé proche', 'pièce citée dans le libellé': 'pièce citée dans le libellé' };
const reasonText = (t, r) => { const m = /^(\d+) jour\(s\) d'écart$/.exec(r); return m ? t("{n} jour(s) d'écart", { n: m[1] }) : t(REASONS[r] || r); };

function ImportBox({ bank, close, done }) {
  const t = useT();
  const { oapi, toast } = useWs();
  const [csv, setCsv] = useState('');
  const [prev, setPrev] = useState(null);
  const [err, setErr] = useState('');
  const file = useRef(null);
  const load = (f) => { if (!f) return; const r = new FileReader(); r.onload = () => { setCsv(String(r.result || '')); setPrev(null); }; r.readAsText(f); };
  const check = () => { setErr(''); oapi('POST', '/accounting/bank/' + bank.id + '/import', { csv, dryRun: true }).then(setPrev).catch((e) => { setPrev(null); setErr(e.message); }); };
  const go = () => oapi('POST', '/accounting/bank/' + bank.id + '/import', { csv }).then((r) => { toast(t('{n} ligne(s) importée(s), {d} déjà connue(s).', { n: r.imported, d: r.duplicates })); close(); done(); }).catch((e) => setErr(e.message));
  const COLS = { date: 'date', label: 'libellé', ref: 'référence', debit: 'débit', credit: 'crédit', amount: 'montant', balance: 'solde' };
  return (
    <div className="ws-form">
      <label className="fld"><span>{t('Fichier CSV du relevé')}</span><input ref={file} type="file" accept=".csv,.txt,text/csv" style={{ fontSize: 16 }} onChange={(e) => load(e.target.files[0])} /></label>
      <label className="fld"><span>{t('ou collez le contenu du relevé')}</span><textarea style={{ fontSize: 16 }} rows={6} value={csv} onChange={(e) => { setCsv(e.target.value); setPrev(null); }} /></label>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn small" type="button" style={BTN} disabled={!csv.trim()} onClick={check}>{t('Vérifier le format')}</button></div>
      {prev ? (
        <div className="ws-card small">
          <b>{t('Format détecté')}</b>
          <p>{t('Séparateur : {d} · dates : {f} · décimales : {x}', { d: prev.detected.delimiter, f: prev.detected.dateFormat === 'ymd' ? t('année-mois-jour') : prev.detected.dateFormat === 'mdy' ? t('mois/jour/année') : t('jour/mois/année'), x: prev.detected.decimal })}</p>
          <p>{Object.entries(prev.detected.columns).filter(([, v]) => v >= 0).map(([k, v]) => t(COLS[k]) + ' = ' + t('colonne {n}', { n: v + 1 })).join(' · ')}</p>
          {prev.detected.ambiguousDate ? <p className="late">{t('Les dates sont ambiguës : lues comme jour/mois/année. Vérifiez.')}</p> : null}
          <p>{t('{n} ligne(s) valide(s), {m} refusée(s).', { n: prev.valid, m: prev.invalid.length })}</p>
          {prev.preview.map((l, i) => <div className="line" key={i}><span>{l.date + ' · ' + l.label}</span><b>{l.amount}</b></div>)}
          <button className="btn primary small" type="button" style={BTN} onClick={go}>{t('Importer ces lignes')}</button>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ bank }) {
  const t = useT();
  const { oapi, money, dateFr, modal, toast, fail, confirm } = useWs();
  const st = useLoad(() => Promise.all([oapi('GET', '/accounting/bank/' + bank.id + '/summary'), oapi('GET', '/accounting/bank/' + bank.id + '/suggestions')]), [bank.id]);
  const reload = st.reload;
  const match = (b, a) => oapi('POST', '/accounting/bank/lines/' + b + '/match', { accLineId: a }).then(() => { toast(t('Pointé.')); reload(); }).catch(fail);
  return (
    <Loaded state={st}>
      {([sum, sug]) => {
        const high = sug.suggestions.filter((s) => s.confidence === 'high' && s.candidates.length === 1);
        const lineOf = (id) => sum.unmatchedBank.find((l) => l.id === id);
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{money(sum.glBalance)}</b><span>{t('solde comptable ({account})', { account: sum.glAccount })}</span></div>
              <div className="stat"><b>{sum.statementBalance === null ? '–' : money(sum.statementBalance)}</b><span>{t('solde du relevé')}</span></div>
              <div className={'stat' + (sum.gap ? ' bad' : '')}><b>{sum.gap === null ? '–' : money(sum.gap)}</b><span>{t('écart inexpliqué')}</span></div>
              <div className="stat"><b>{sum.unmatchedBankCount + sum.unmatchedGlCount}</b><span>{t('ligne(s) à pointer')}</span></div>
            </div>
            <p className="muted small">{sum.gap === null ? t("Le relevé n'a pas de colonne « solde » : l'écart ne peut pas être calculé, mais les lignes non pointées sont listées.") : t("Écart nul = tout ce qui diffère entre le relevé et la comptabilité est expliqué par les lignes non pointées.")}</p>
            <div className="ws-card">
              <div className="row"><h2 className="grow">{t('Suggestions')}</h2>
                {high.length ? <button className="btn primary small" type="button" style={BTN} onClick={() => oapi('POST', '/accounting/bank/' + bank.id + '/match-many', { pairs: high.map((s) => ({ bankLineId: s.bankLineId, accLineId: s.candidates[0].accLineId })) }).then((r) => { toast(t('{n} ligne(s) pointée(s).', { n: r.matched })); reload(); }).catch(fail)}>{t('Pointer les {n} suggestions sûres', { n: high.length })}</button> : null}</div>
              {!sug.suggestions.length ? <Empty text={t('Aucune suggestion.')} /> : null}
              {sug.suggestions.map((s) => { const l = lineOf(s.bankLineId); const c = s.candidates[0]; return l ? (
                <div className="line" key={s.bankLineId} style={{ flexWrap: 'wrap' }}>
                  <span style={{ flex: '1 1 280px' }}><b>{dateFr(l.date) + ' · ' + money(l.amount)}</b>{' ' + l.label}<br />
                    <small className="muted">{t('Écriture {number} du {date} : {label}', { number: c.number, date: dateFr(c.date), label: c.label })}</small><br />
                    <small><span className={'pill ' + CONF[s.confidence][0]}>{t(CONF[s.confidence][1])}</span>{' ' + c.reasons.map((r) => reasonText(t, r)).join(', ')}</small></span>
                  <button className="link" type="button" style={TAP} onClick={() => match(l.id, c.accLineId)}>{t('Pointer')}</button>
                </div>) : null; })}
            </div>
            <div className="ws-card">
              <h2>{t('Lignes du relevé non pointées')}</h2>
              {!sum.unmatchedBank.length ? <Empty text={t('Tout est pointé.')} /> : null}
              {sum.unmatchedBank.map((l) => (
                <div className="line" key={l.id} style={{ flexWrap: 'wrap' }}>
                  <span><b>{dateFr(l.date) + ' · ' + money(l.amount)}</b>{' ' + l.label}{l.reference ? <small className="muted">{' · ' + l.reference}</small> : null}</span>
                  <span className="row" style={{ flexWrap: 'wrap' }}>
                    <button className="link" type="button" style={TAP} onClick={() => modal(t('Pointer avec une écriture'), (close) => (
                      <div>{sum.unmatchedGl.filter((g) => g.amount === l.amount).map((g) => <div className="line" key={g.accLineId}><span>{g.number + ' · ' + dateFr(g.date)}<br /><small className="muted">{g.label}</small></span><button className="link" type="button" style={TAP} onClick={() => { close(); match(l.id, g.accLineId); }}>{t('Pointer')}</button></div>)}
                        {!sum.unmatchedGl.some((g) => g.amount === l.amount) ? <Empty text={t("Aucune écriture non pointée de ce montant. Créez l'écriture manquante.")} /> : null}</div>
                    ))}>{t('Pointer à…')}</button>
                    <button className="link" type="button" style={TAP} onClick={() => modal(t("Écrire cette ligne en comptabilité"), (close) => (
                      <Form submitText={t('Comptabiliser et pointer')} fields={[{ k: 'account', label: t('Compte de contrepartie'), required: true, placeholder: '631', hint: t('Ex. 631 frais bancaires, 771 intérêts, 622 loyer.') }, { k: 'label', label: t('Libellé'), value: l.label }]}
                        onSubmit={(v) => oapi('POST', '/accounting/bank/lines/' + l.id + '/post', v).then(() => { close(); reload(); })} />
                    ))}>{t('Écrire en compta')}</button>
                    <button className="link" type="button" style={TAP} onClick={() => confirm(t('Ignorer cette ligne (elle ne sera plus proposée) ?'), () => { oapi('POST', '/accounting/bank/lines/' + l.id + '/ignore', {}).then(reload).catch(fail); })}>{t('Ignorer')}</button>
                  </span>
                </div>
              ))}
            </div>
            <div className="ws-card">
              <h2>{t('Écritures comptables non pointées')}</h2>
              {!sum.unmatchedGl.length ? <Empty text={t('Tout est pointé.')} /> : null}
              {sum.unmatchedGl.map((g) => <div className="line" key={g.accLineId}><span>{g.number + ' · ' + dateFr(g.date)}<br /><small className="muted">{g.label}</small></span><b>{money(g.amount)}</b></div>)}
            </div>
          </>
        );
      }}
    </Loaded>
  );
}

export default function BankTab() {
  const t = useT();
  const { oapi, modal, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/bank'), []);
  const [sel, setSel] = useState(null);
  const create = () => modal(t('Nouveau compte suivi'), (close) => (
    <Form submitText={t('Créer')} fields={[
      { k: 'name', label: t('Nom (banque, opérateur…)'), required: true },
      { k: 'glAccount', label: t('Compte comptable'), type: 'select', options: [['521', t('521 · Banque')], ['589', t('589 · Mobile money')], ['571', t('571 · Caisse')]] },
      { k: 'accountNo', label: t('Numéro de compte (facultatif)') }]}
    onSubmit={(v) => oapi('POST', '/accounting/bank', v).then(() => { close(); st.reload(); })} />
  ));
  return (
    <Loaded state={st}>
      {(j) => {
        const bank = j.banks.find((b) => b.id === sel) || j.banks[0];
        return (
          <>
            <WorkNotice>{t("Document de travail : le rapprochement ne modifie pas vos écritures. À faire valider par un expert-comptable.")}</WorkNotice>
            <div className="row" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
              {j.banks.length ? <select aria-label={t('Compte')} style={{ fontSize: 16, minHeight: 44 }} value={bank.id} onChange={(e) => setSel(Number(e.target.value))}>{j.banks.map((b) => <option key={b.id} value={b.id}>{b.name + ' (' + b.glAccount + ') · ' + t('{n} à pointer', { n: b.unmatched })}</option>)}</select> : null}
              <button className="btn small" type="button" style={BTN} onClick={create}>{t('Ajouter un compte')}</button>
              {bank ? <button className="btn primary small" type="button" style={BTN} onClick={() => modal(t('Importer un relevé'), (close) => <ImportBox bank={bank} close={close} done={st.reload} />, { wide: true })}>{t('Importer un relevé CSV')}</button> : null}
              {bank && !bank.lines ? <button className="link" type="button" style={TAP} onClick={() => oapi('DELETE', '/accounting/bank/' + bank.id).then(() => { setSel(null); st.reload(); }).catch(fail)}>{t('Supprimer ce compte')}</button> : null}
            </div>
            {!bank ? <Empty text={t("Ajoutez votre compte bancaire ou Mobile Money, puis importez le relevé (CSV) pour le rapprocher de la comptabilité.")} /> : <Detail key={bank.id + ':' + bank.lines} bank={bank} />}
          </>
        );
      }}
    </Loaded>
  );
}
