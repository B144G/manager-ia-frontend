import { useRef, useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Form, Loading, useLoad } from '../ui.jsx';
import EntryForm from '../parts/accounting/EntryForm.jsx';
import { BalanceTab, Home, JournalTab, LedgerBox, ResultsTab, SettingsTab } from '../parts/accounting/Tabs.jsx';

/* Comptabilité (plan OHADA de base, journal, balance, résultat, bilan, TVA). Les écritures ne se modifient pas :
   une erreur se corrige par une écriture inverse. Outil d'aide : à faire valider par un expert-comptable. */

export default function Accounting() {
  const t = useT();
  const TABS = [['home', t('Aperçu')], ['journal', t('Journal')], ['balance', t('Balance')], ['results', t('Résultat et bilan')], ['settings', t('Réglages')]];
  const { oapi, modal, toast, fail } = useWs();
  const [tab, setTab] = useState('home');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [journal, setJournal] = useState('');
  const accountsRef = useRef(null);
  const st = useLoad(() => oapi('GET', '/accounting'), [tab, year]);
  const o = st.data;
  const JN = (o && o.journals) || {};

  const getAccounts = () => (accountsRef.current ? Promise.resolve(accountsRef.current) : oapi('GET', '/accounting/accounts').then((j) => { accountsRef.current = j.accounts; return j.accounts; }));

  function reverse(e) {
    oapi('POST', '/accounting/entries/' + e.id + '/reverse', {}).then(() => { toast(t('Écriture annulée.')); st.reload(); }).catch(fail);
  }
  function ledger(account) {
    modal(t('Grand livre du compte {account}', { account }), () => <LedgerBox account={account} year={year} />, { wide: true });
  }
  /* Saisie d'une écriture à la main (ou préremplie par l'IA) */
  function editEntry(pre) {
    getAccounts().then((accs) => {
      modal(t('Nouvelle écriture'), (close) => <EntryForm accs={accs} JN={JN} pre={pre} close={close} onSaved={st.reload} />, { wide: true });
    }).catch(fail);
  }
  /* « J'ai payé le loyer 150 000 en espèces » → l'IA propose, vous relisez et enregistrez */
  function suggest() {
    getAccounts().then(() => {
      modal(t('Décrire une opération'), (close) => (
        <Form
          submitText={t("Proposer une écriture")}
          fields={[{ k: 'text', label: t("Que s'est-il passé ?"), type: 'textarea', rows: 3, required: true, placeholder: t("Ex. J'ai payé le loyer d'octobre 150 000 en espèces"), hint: t("L'assistant propose une écriture. Vous la relisez avant de l'enregistrer. Compte comme un message IA.") }]}
          onSubmit={(v) => oapi('POST', '/accounting/suggest', { text: v.text }).then((r) => { close(); editEntry(r.proposal); })}
        />
      ));
    }).catch(fail);
  }

  let content = null;
  if (st.loading) content = <Loading />;
  else if (st.error) content = <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  else if (o) {
    if (tab === 'home') content = <Home o={o} JN={JN} onReverse={reverse} reload={st.reload} />;
    else if (tab === 'journal') content = <JournalTab year={year} setYear={setYear} JN={JN} journal={journal} setJournal={setJournal} onReverse={reverse} />;
    else if (tab === 'balance') content = <BalanceTab year={year} setYear={setYear} onLedger={ledger} />;
    else if (tab === 'results') content = <ResultsTab year={year} setYear={setYear} />;
    else content = <SettingsTab o={o} reload={st.reload} onAccountAdded={() => { accountsRef.current = null; }} />;
  }

  return (
    <>
      <div className="ws-head">
        <div>
          <h1>{t('Comptabilité')}</h1>
          <p className="muted">{t("Vos écritures, votre balance, votre résultat et votre TVA. Outil d'aide : à faire valider par un expert-comptable.")}</p>
        </div>
        <div className="row">
          <button className="btn small" type="button" onClick={suggest}>{t('Décrire une opération (IA)')}</button>
          <button className="btn primary small" type="button" onClick={() => editEntry()}>{t('Nouvelle écriture')}</button>
        </div>
      </div>
      <div className="ws-tabs">
        {TABS.map((x) => <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} onClick={() => { setTab(x[0]); st.reload(); }}>{x[1]}</button>)}
      </div>
      <div>{content}</div>
    </>
  );
}
