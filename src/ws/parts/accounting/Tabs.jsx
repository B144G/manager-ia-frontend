import { useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { AmountLine, EntryCard, YearBar } from './common.jsx';

/* ---------- Aperçu ---------- */
export function Home({ o, JN, onReverse, reload }) {
  const t = useT();
  const { oapi, money, toast, fail } = useWs();
  const k = o.kpi;
  const n = o.toPost.invoices + o.toPost.payments + o.toPost.purchases;
  const generate = () => {
    oapi('POST', '/accounting/generate', {}).then((r) => {
      toast(t('{invoices} facture(s), {payments} paiement(s), {purchases} achat(s) comptabilisés.', { invoices: r.invoices, payments: r.payments, purchases: r.purchases }) + (r.skipped.length ? ' ' + t('Ignorés : {n} (période clôturée).', { n: r.skipped.length }) : ''));
      reload();
    }).catch(fail);
  };
  return (
    <>
      <div className="kpis">
        <div className="stat"><b>{money(k.ventes)}</b><span>{t("ventes de l'année (HT)")}</span></div>
        <div className="stat"><b>{money(k.achats)}</b><span>{t("achats de l'année")}</span></div>
        <div className={'stat' + (k.resultat < 0 ? ' bad' : '')}><b className={k.resultat >= 0 ? 'ok' : ''}>{money(k.resultat)}</b><span>{t("résultat de l'année")}</span></div>
        <div className="stat"><b>{money(k.clients)}</b><span>{t('clients vous doivent')}</span></div>
        <div className="stat"><b>{money(k.fournisseurs)}</b><span>{t('vous devez aux fournisseurs')}</span></div>
        <div className="stat"><b>{money(k.tresorerie)}</b><span>{t('trésorerie (caisse, banque)')}</span></div>
      </div>
      <div className="ws-card">
        <h2>{t('Écritures automatiques')}</h2>
        <p>{n ? t('{n} opération(s) de votre activité ne sont pas encore dans la comptabilité : {invoices} facture(s), {payments} paiement(s) reçu(s), {purchases} achat(s) reçu(s).', { n, invoices: o.toPost.invoices, payments: o.toPost.payments, purchases: o.toPost.purchases }) : t('Tout est à jour : vos factures, paiements reçus et achats reçus sont comptabilisés.')}</p>
        <button className="btn primary small" type="button" disabled={!n} onClick={generate}>{t('Comptabiliser maintenant')}</button>
        <p className="muted small">{t("Facture → ventes (HT) + TVA collectée ; paiement → caisse/banque ; achat reçu → achats + fournisseurs. Chaque opération n'est comptabilisée qu'une fois.")}</p>
      </div>
      <div className="ws-card">
        <h2>{t('Dernières écritures ({n} au total)', { n: o.count })}</h2>
        {!o.entries.length ? <Empty text={t("Aucune écriture. Cliquez sur « Comptabiliser maintenant » ou « Nouvelle écriture ».")} /> : null}
        {o.entries.map((e) => <EntryCard key={e.id} e={e} canUndo JN={JN} onReverse={onReverse} />)}
      </div>
      <p className="muted small">{t(o.disclaimer)}</p>
    </>
  );
}

/* ---------- Journal ---------- */
export function JournalTab({ year, setYear, JN, journal, setJournal, onReverse }) {
  const t = useT();
  const { oapi, fail } = useWs();
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const list = useLoad(
    () => oapi('GET', '/accounting/entries?from=' + year + '-01-01&to=' + year + '-12-31' + (journal ? '&journal=' + journal : '') + (q ? '&q=' + encodeURIComponent(q) : '')),
    [year, journal, q],
  );

  return (
    <div className="ws-card">
      <div className="row">
        <YearBar year={year} setYear={setYear} />
        <select aria-label={t("Journal")} value={journal} onChange={(e) => { setJournal(e.target.value); setDraft(''); setQ(''); }}>
          <option value="">{t('Tous les journaux')}</option>
          {Object.keys(JN).map((k) => <option key={k} value={k}>{t(JN[k]) + ' (' + k + ')'}</option>)}
        </select>
        <input
          type="search" placeholder={t("Rechercher (libellé, pièce, numéro)")} aria-label={t("Rechercher")} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setQ(draft.trim())}
          onKeyDown={(e) => { if (e.key === 'Enter') setQ(draft.trim()); }}
        />
        <ExportButton year={year} fail={fail} />
      </div>
      <div>
        {list.loading ? <Loading /> : list.error ? <p className="ws-err" role="alert">{t(list.error.message)}</p> : list.data ? (
          <>
            {!list.data.entries.length ? <Empty text={t("Aucune écriture.")} /> : null}
            {list.data.entries.map((e) => <EntryCard key={e.id} e={e} canUndo JN={JN} onReverse={onReverse} />)}
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Export CSV : téléchargement avec le cookie de connexion. */
function ExportButton({ year, fail }) {
  const t = useT();
  const { orgId } = useWs();
  function exportCsv() {
    fetch(API_BASE + '/api/ws/orgs/' + orgId + '/accounting/export.csv?year=' + year, { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error(t('Export impossible.')); return r.blob(); })
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url; a.download = 'journal-' + year + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }).catch(fail);
  }
  return <button className="btn small" type="button" onClick={exportCsv}>{t('Exporter pour Excel')}</button>;
}

/* ---------- Balance ---------- */
export function BalanceTab({ year, setYear, onLedger }) {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/balance?year=' + year), [year]);
  if (st.loading) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  const j = st.data;
  return (
    <div className="ws-card">
      <YearBar year={year} setYear={setYear} />
      <h2>{t('Balance générale {year}', { year })}</h2>
      {!j.rows.length ? <Empty text={t("Aucune écriture sur cet exercice.")} /> : null}
      {j.rows.map((r) => (
        <div className="line" key={r.account}>
          <span><b>{r.account}</b><small>{' ' + t(r.label)}</small></span>
          <span className="row">
            <small>{t('Débit {d} · Crédit {c}', { d: money(r.debit), c: money(r.credit) })}</small>
            <b>{r.balance >= 0 ? t('D {amount}', { amount: money(Math.abs(r.balance)) }) : t('C {amount}', { amount: money(Math.abs(r.balance)) })}</b>
            <button className="link" type="button" onClick={() => onLedger(r.account)}>{t('Grand livre')}</button>
          </span>
        </div>
      ))}
      <div className="line">
        <b>{t('Totaux')}</b>
        <b>{t('Débit {d} · Crédit {c}', { d: money(j.totalDebit), c: money(j.totalCredit) }) + (j.totalDebit === j.totalCredit ? ' ' + t('✓ équilibrée') : ' ' + t('✗ déséquilibrée'))}</b>
      </div>
    </div>
  );
}

/** Contenu de la fenêtre « Grand livre ». */
export function LedgerBox({ account, year }) {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/ledger?account=' + account + '&year=' + year), []);
  if (st.loading) return <div><Loading /></div>;
  if (st.error) return <div>{t(st.error.message)}</div>;
  const j = st.data;
  return (
    <div>
      <p className="muted">{t(j.label)}</p>
      {!j.lines.length ? <Empty text={t("Aucun mouvement.")} /> : null}
      {j.lines.map((l, i) => (
        <div className="line" key={l.number + '-' + i}>
          <span><b>{dateFr(l.date)}</b><small>{' ' + l.number + ' · ' + t(l.label)}</small></span>
          <span>{(l.debit ? t('D {amount}', { amount: money(l.debit) }) : t('C {amount}', { amount: money(l.credit) })) + ' → ' + t('solde {amount}', { amount: money(l.running) })}</span>
        </div>
      ))}
      <p>{t('Solde : {amount}', { amount: money(j.balance) }) + ' ' + (j.balance >= 0 ? t('(débiteur)') : t('(créditeur)'))}</p>
    </div>
  );
}

/* ---------- Résultat et bilan ---------- */
export function ResultsTab({ year, setYear }) {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => Promise.all([oapi('GET', '/accounting/statements?year=' + year), oapi('GET', '/accounting/vat?year=' + year)]), [year]);
  if (st.loading) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{t(st.error.message)}</p>;
  const [s, v] = st.data;
  const r = s.resultat;
  const b = s.bilan;
  return (
    <>
      <YearBar year={year} setYear={setYear} />
      <div className="ws-card">
        <h2>{t('Compte de résultat {year}', { year })}</h2>
        <p>{t('Ventes {sales} − achats {purchases} = marge brute {margin}', { sales: money(r.ventes), purchases: money(r.achats), margin: money(r.margeBrute) })}</p>
        {r.produits.map((x) => <AmountLine key={'p' + x.account} x={x} />)}
        <div className="line"><b>{t('Total des produits')}</b><b>{money(r.totalProduits)}</b></div>
        {r.charges.map((x) => <AmountLine key={'c' + x.account} x={x} />)}
        <div className="line"><b>{t('Total des charges')}</b><b>{money(r.totalCharges)}</b></div>
        <div className="line"><b>{r.resultat >= 0 ? t('Bénéfice') : t('Perte')}</b><b className={r.resultat >= 0 ? 'ok' : ''}>{money(Math.abs(r.resultat))}</b></div>
      </div>
      <div className="ws-card">
        <h2>{t('Bilan simplifié au 31/12/{year}', { year })}</h2>
        <p className="muted small">{t('Immobilisations {fixed} · stocks {stocks} · créances et tiers {receivables} · trésorerie {cash} · capitaux propres (avec résultat) {equity}', { fixed: money(b.resume.immobilisations), stocks: money(b.resume.stocks), receivables: money(b.resume.creances), cash: money(b.resume.tresorerie), equity: money(b.resume.capitauxPropres) })}</p>
        <h3>{t('Actif')}</h3>
        {b.actif.map((x) => <AmountLine key={'a' + x.account} x={x} />)}
        <div className="line"><b>{t('Total actif')}</b><b>{money(b.totalActif)}</b></div>
        <h3>{t('Passif')}</h3>
        {b.passif.map((x) => <AmountLine key={'f' + x.account} x={x} />)}
        <div className="line"><span><b>{t("Résultat de l'exercice")}</b></span><span>{money(b.resultat)}</span></div>
        <div className="line"><b>{t('Total passif')}</b><b>{money(b.totalPassif) + (b.equilibre ? ' ✓' : ' ✗')}</b></div>
      </div>
      <div className="ws-card">
        <h2>{t('TVA {year} (taux {rate} %)', { year, rate: v.rate })}</h2>
        <p>{t('TVA collectée : {collected} · TVA récupérable : {deductible}', { collected: money(v.collected), deductible: money(v.deductible) })}</p>
        <p>{v.due ? t('TVA à reverser : {amount}', { amount: money(v.due) }) : v.credit ? t('Crédit de TVA : {amount}', { amount: money(v.credit) }) : t('Rien à reverser.')}</p>
        <p className="muted small">{t("Estimation d'après vos écritures. La déclaration officielle se fait auprès de l'administration fiscale.")}</p>
      </div>
    </>
  );
}

/* ---------- Réglages ---------- */
export function SettingsTab({ o, reload, onAccountAdded }) {
  const t = useT();
  const { oapi, toast, modal } = useWs();
  const s = o.settings;
  return (
    <>
      <div className="ws-card">
        <h2>{t('Réglages de la comptabilité')}</h2>
        <Form
          submitText={t("Enregistrer")}
          fields={[
            { k: 'vatRate', label: t('Taux de TVA (%)'), value: String(s.vatRate), hint: t("19,25 au Cameroun (TVA + centimes additionnels). Mettez 0 si vous n'êtes pas assujetti.") },
            { k: 'payAccount', label: t('Encaissements des clients'), type: 'select', options: [['571', t('Caisse (571)')], ['521', t('Banque (521)')], ['589', t('Mobile money (589)')]], value: s.payAccount },
            { k: 'purchaseVat', label: t('Les prix d\'achat saisis dans Stock incluent la TVA'), type: 'select', options: [['0', t('Non : montants pris tels quels')], ['1', t('Oui : la TVA récupérable est séparée')]], value: s.purchaseVat ? '1' : '0' },
            { k: 'lockedUntil', label: t('Période clôturée jusqu\'au'), type: 'date', value: s.lockedUntil || '', hint: t('Aucune écriture ne peut plus être ajoutée jusqu\'à cette date. Une clôture ne peut pas être rouverte.') },
          ]}
          onSubmit={(v) => oapi('PUT', '/accounting/settings', { vatRate: Number(String(v.vatRate).replace(',', '.')), payAccount: v.payAccount, purchaseVat: v.purchaseVat === '1', lockedUntil: v.lockedUntil || null }).then(() => { toast(t('Réglages enregistrés.')); reload(); })}
        />
      </div>
      <div className="ws-card">
        <h2>{t('Plan comptable')}</h2>
        <p className="muted small">{t('Plan de base inspiré du SYSCOHADA révisé. Ajoutez vos propres comptes (3 à 8 chiffres) si besoin.')}</p>
        <button className="btn small" type="button" onClick={() => modal(t('Nouveau compte'), (close) => (
          <Form
            submitText={t("Ajouter")}
            fields={[{ k: 'code', label: t('Numéro (ex. 6221)'), required: true }, { k: 'label', label: t('Nom du compte'), required: true }]}
            onSubmit={(v) => oapi('POST', '/accounting/accounts', v).then(() => { onAccountAdded(); close(); toast(t('Compte ajouté.')); })}
          />
        ))}>{t('Ajouter un compte')}</button>
      </div>
    </>
  );
}
