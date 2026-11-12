import { useRef, useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Form, Loading, useLoad } from '../ui.jsx';
import ModuleShell from '../ModuleShell.jsx';
import EntryForm from '../parts/accounting/EntryForm.jsx';
import BankTab from '../parts/accounting/Bank.jsx';
import ThirdTab from '../parts/accounting/Thirdparty.jsx';
import AssetsTab from '../parts/accounting/Assets.jsx';
import ClosingTab from '../parts/accounting/Closing.jsx';
import AnalyticsTab from '../parts/accounting/Analytics.jsx';
import RecurringTab from '../parts/accounting/Recurring.jsx';
import YearEndTab from '../parts/accounting/YearEnd.jsx';
import AuditTab from '../parts/accounting/Audit.jsx';
import RatiosTab from '../parts/accounting/Ratios.jsx';
import { BalanceTab, Home, JournalTab, LedgerBox, ResultsTab, SettingsTab } from '../parts/accounting/Tabs.jsx';

/* Comptabilité (plan OHADA de base, journal, balance, résultat, bilan, TVA). Les écritures ne se modifient pas :
   une erreur se corrige par une écriture inverse. Outil d'aide : à faire valider par un expert-comptable. */

export default function Accounting() {
  const t = useT();
  const GROUPS = [
    { id: 'pilot', label: t('Pilotage'), items: [
      { id: 'home', label: t('Aperçu'), hint: t("Vue d'ensemble de votre comptabilité.") },
      { id: 'ratios', label: t('Ratios'), hint: t('Les indicateurs clés, expliqués simplement.') }] },
    { id: 'entry', label: t('Saisie et journaux'), items: [
      { id: 'journal', label: t('Journal'), hint: t('Toutes les écritures, par journal.') },
      { id: 'recurring', label: t('Récurrentes'), hint: t('Écritures qui reviennent chaque mois, trimestre ou année.') }] },
    { id: 'third', label: t('Tiers et recouvrement'), items: [
      { id: 'third', label: t('Tiers et dettes'), hint: t('Ce que les clients vous doivent et ce que vous devez.') }] },
    { id: 'bank', label: t('Banque et trésorerie'), items: [
      { id: 'bank', label: t('Rapprochement'), hint: t('Faites correspondre votre relevé de banque et vos écritures.') }] },
    { id: 'states', label: t('États et éditions'), items: [
      { id: 'balance', label: t('Balance'), hint: t('Le solde de chaque compte.') },
      { id: 'results', label: t('Résultat et bilan'), hint: t("Compte de résultat, bilan et comparaison avec l'année précédente.") },
      { id: 'analytics', label: t('Analytique'), hint: t('Résultat par projet, antenne ou activité.') }] },
    { id: 'assets', label: t('Immobilisations'), items: [
      { id: 'assets', label: t('Immobilisations'), hint: t("Les biens de l'entreprise et leurs amortissements.") }] },
    { id: 'control', label: t('Clôture et contrôle'), items: [
      { id: 'audit', label: t('Contrôles'), hint: t('Contrôles automatiques de vos écritures.') },
      { id: 'closing', label: t('Clôture'), hint: t('Clôturer un mois et verrouiller la période.') },
      { id: 'yearend', label: t('Clôture annuelle'), hint: t("Résultat de l'année et à-nouveaux.") }] },
    { id: 'params', label: t('Paramètres'), items: [
      { id: 'settings', label: t('Réglages'), hint: t('Plan comptable, TVA et paramètres.') }] },
  ];
  const { oapi, modal, toast, fail } = useWs();
  const [tab, setTab] = useState('home');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [journal, setJournal] = useState('');
  const accountsRef = useRef(null);
  const st = useLoad(() => oapi('GET', '/accounting'), [tab, year]);
  const o = st.data;
  const JN = (o && o.journals) || {};

  const getAccounts = () => (accountsRef.current ? Promise.resolve(accountsRef.current) : oapi('GET', '/accounting/accounts').then((j) => { accountsRef.current = j.accounts; return j.accounts; }));

  const getSections = () => oapi('GET', '/accounting/analytics/sections').then((j) => j.sections || []).catch(() => []);

  function reverse(e) {
    oapi('POST', '/accounting/entries/' + e.id + '/reverse', {}).then(() => { toast(t('Écriture annulée.')); st.reload(); }).catch(fail);
  }
  function ledger(account) {
    modal(t('Grand livre du compte {account}', { account }), () => <LedgerBox account={account} year={year} />, { wide: true });
  }
  /* Saisie d'une écriture à la main (ou préremplie par l'IA) */
  function editEntry(pre) {
    Promise.all([getAccounts(), getSections()]).then(([accs, sections]) => {
      modal(t('Nouvelle écriture'), (close) => <EntryForm accs={accs} JN={JN} pre={pre} sections={sections} close={close} onSaved={st.reload} />, { wide: true });
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
  const OWN = { bank: BankTab, third: ThirdTab, assets: AssetsTab, closing: ClosingTab, analytics: AnalyticsTab, ratios: RatiosTab, audit: AuditTab, recurring: RecurringTab, yearend: YearEndTab }; // onglets de la vague 2 : ils chargent leurs propres données
  if (OWN[tab]) { const Own = OWN[tab]; content = <Own year={year} setYear={setYear} />; } else if (st.loading) content = <Loading />;
  else if (st.error) content = <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  else if (o) {
    if (tab === 'home') content = <Home o={o} JN={JN} onReverse={reverse} reload={st.reload} year={year} />;
    else if (tab === 'journal') content = <JournalTab year={year} setYear={setYear} JN={JN} journal={journal} setJournal={setJournal} onReverse={reverse} />;
    else if (tab === 'balance') content = <BalanceTab year={year} setYear={setYear} onLedger={ledger} />;
    else if (tab === 'results') content = <ResultsTab year={year} setYear={setYear} />;
    else content = <SettingsTab o={o} reload={st.reload} onAccountAdded={() => { accountsRef.current = null; }} />;
  }

  return (
    <ModuleShell
      title={t('Comptabilité')}
      groups={GROUPS}
      active={tab}
      onSelect={(id) => { setTab(id); st.reload(); }}
      actions={<>
        <button className="btn small" type="button" onClick={suggest}>{t('Décrire une opération (IA)')}</button>
        <button className="btn primary small" type="button" onClick={() => editEntry()}>{t('Nouvelle écriture')}</button>
      </>}
    >
      <p className="muted small">{t("Vos écritures, votre balance, votre résultat et votre TVA. Outil d'aide : à faire valider par un expert-comptable.")}</p>
      <div>{content}</div>
    </ModuleShell>
  );
}
