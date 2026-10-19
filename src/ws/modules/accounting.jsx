import { useRef, useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Form, Loading, useLoad } from '../ui.jsx';
import EntryForm from '../parts/accounting/EntryForm.jsx';
import { BalanceTab, Home, JournalTab, LedgerBox, ResultsTab, SettingsTab } from '../parts/accounting/Tabs.jsx';

/* Comptabilité (plan OHADA de base, journal, balance, résultat, bilan, TVA). Les écritures ne se modifient pas :
   une erreur se corrige par une écriture inverse. Outil d'aide : à faire valider par un expert-comptable. */
const TABS = [['home', 'Aperçu'], ['journal', 'Journal'], ['balance', 'Balance'], ['results', 'Résultat et bilan'], ['settings', 'Réglages']];

export default function Accounting() {
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
    oapi('POST', '/accounting/entries/' + e.id + '/reverse', {}).then(() => { toast('Écriture annulée.'); st.reload(); }).catch(fail);
  }
  function ledger(account) {
    modal('Grand livre du compte ' + account, () => <LedgerBox account={account} year={year} />, { wide: true });
  }
  /* Saisie d'une écriture à la main (ou préremplie par l'IA) */
  function editEntry(pre) {
    getAccounts().then((accs) => {
      modal('Nouvelle écriture', (close) => <EntryForm accs={accs} JN={JN} pre={pre} close={close} onSaved={st.reload} />, { wide: true });
    }).catch(fail);
  }
  /* « J'ai payé le loyer 150 000 en espèces » → l'IA propose, vous relisez et enregistrez */
  function suggest() {
    getAccounts().then(() => {
      modal('Décrire une opération', (close) => (
        <Form
          submitText="Proposer une écriture"
          fields={[{ k: 'text', label: "Que s'est-il passé ?", type: 'textarea', rows: 3, required: true, placeholder: "Ex. J'ai payé le loyer d'octobre 150 000 en espèces", hint: "L'assistant propose une écriture. Vous la relisez avant de l'enregistrer. Compte comme un message IA." }]}
          onSubmit={(v) => oapi('POST', '/accounting/suggest', { text: v.text }).then((r) => { close(); editEntry(r.proposal); })}
        />
      ));
    }).catch(fail);
  }

  let content = null;
  if (st.loading) content = <Loading />;
  else if (st.error) content = <p className="ws-err" role="alert">{st.error.message}</p>;
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
          <h1>Comptabilité</h1>
          <p className="muted">Vos écritures, votre balance, votre résultat et votre TVA. Outil d'aide : à faire valider par un expert-comptable.</p>
        </div>
        <div className="row">
          <button className="btn small" type="button" onClick={suggest}>Décrire une opération (IA)</button>
          <button className="btn primary small" type="button" onClick={() => editEntry()}>Nouvelle écriture</button>
        </div>
      </div>
      <div className="ws-tabs">
        {TABS.map((t) => <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => { setTab(t[0]); st.reload(); }}>{t[1]}</button>)}
      </div>
      <div>{content}</div>
    </>
  );
}
