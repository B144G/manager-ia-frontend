import { useState } from 'react';
import { API_BASE } from '../../../lib/api.js';
import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { AmountLine, EntryCard, YearBar } from './common.jsx';

/* ---------- Aperçu ---------- */
export function Home({ o, JN, onReverse, reload }) {
  const { oapi, money, toast, fail } = useWs();
  const k = o.kpi;
  const n = o.toPost.invoices + o.toPost.payments + o.toPost.purchases;
  const generate = () => {
    oapi('POST', '/accounting/generate', {}).then((r) => {
      toast(r.invoices + ' facture(s), ' + r.payments + ' paiement(s), ' + r.purchases + ' achat(s) comptabilisés.' + (r.skipped.length ? ' Ignorés : ' + r.skipped.length + ' (période clôturée).' : ''));
      reload();
    }).catch(fail);
  };
  return (
    <>
      <div className="kpis">
        <div className="stat"><b>{money(k.ventes)}</b><span>ventes de l'année (HT)</span></div>
        <div className="stat"><b>{money(k.achats)}</b><span>achats de l'année</span></div>
        <div className={'stat' + (k.resultat < 0 ? ' bad' : '')}><b className={k.resultat >= 0 ? 'ok' : ''}>{money(k.resultat)}</b><span>résultat de l'année</span></div>
        <div className="stat"><b>{money(k.clients)}</b><span>clients vous doivent</span></div>
        <div className="stat"><b>{money(k.fournisseurs)}</b><span>vous devez aux fournisseurs</span></div>
        <div className="stat"><b>{money(k.tresorerie)}</b><span>trésorerie (caisse, banque)</span></div>
      </div>
      <div className="ws-card">
        <h2>Écritures automatiques</h2>
        <p>{n ? n + " opération(s) de votre activité ne sont pas encore dans la comptabilité : " + o.toPost.invoices + ' facture(s), ' + o.toPost.payments + ' paiement(s) reçu(s), ' + o.toPost.purchases + ' achat(s) reçu(s).' : 'Tout est à jour : vos factures, paiements reçus et achats reçus sont comptabilisés.'}</p>
        <button className="btn primary small" type="button" disabled={!n} onClick={generate}>Comptabiliser maintenant</button>
        <p className="muted small">Facture → ventes (HT) + TVA collectée ; paiement → caisse/banque ; achat reçu → achats + fournisseurs. Chaque opération n'est comptabilisée qu'une fois.</p>
      </div>
      <div className="ws-card">
        <h2>{'Dernières écritures (' + o.count + ' au total)'}</h2>
        {!o.entries.length ? <Empty text="Aucune écriture. Cliquez sur « Comptabiliser maintenant » ou « Nouvelle écriture »." /> : null}
        {o.entries.map((e) => <EntryCard key={e.id} e={e} canUndo JN={JN} onReverse={onReverse} />)}
      </div>
      <p className="muted small">{o.disclaimer}</p>
    </>
  );
}

/* ---------- Journal ---------- */
export function JournalTab({ year, setYear, JN, journal, setJournal, onReverse }) {
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
        <select aria-label="Journal" value={journal} onChange={(e) => { setJournal(e.target.value); setDraft(''); setQ(''); }}>
          <option value="">Tous les journaux</option>
          {Object.keys(JN).map((k) => <option key={k} value={k}>{JN[k] + ' (' + k + ')'}</option>)}
        </select>
        <input
          type="search" placeholder="Rechercher (libellé, pièce, numéro)" aria-label="Rechercher" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setQ(draft.trim())}
          onKeyDown={(e) => { if (e.key === 'Enter') setQ(draft.trim()); }}
        />
        <ExportButton year={year} fail={fail} />
      </div>
      <div>
        {list.loading ? <Loading /> : list.error ? <p className="ws-err" role="alert">{list.error.message}</p> : list.data ? (
          <>
            {!list.data.entries.length ? <Empty text="Aucune écriture." /> : null}
            {list.data.entries.map((e) => <EntryCard key={e.id} e={e} canUndo JN={JN} onReverse={onReverse} />)}
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Export CSV : téléchargement avec le cookie de connexion. */
function ExportButton({ year, fail }) {
  const { orgId } = useWs();
  function exportCsv() {
    fetch(API_BASE + '/api/ws/orgs/' + orgId + '/accounting/export.csv?year=' + year, { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error('Export impossible.'); return r.blob(); })
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url; a.download = 'journal-' + year + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }).catch(fail);
  }
  return <button className="btn small" type="button" onClick={exportCsv}>Exporter pour Excel</button>;
}

/* ---------- Balance ---------- */
export function BalanceTab({ year, setYear, onLedger }) {
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/balance?year=' + year), [year]);
  if (st.loading) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  const j = st.data;
  return (
    <div className="ws-card">
      <YearBar year={year} setYear={setYear} />
      <h2>{'Balance générale ' + year}</h2>
      {!j.rows.length ? <Empty text="Aucune écriture sur cet exercice." /> : null}
      {j.rows.map((r) => (
        <div className="line" key={r.account}>
          <span><b>{r.account}</b><small>{' ' + r.label}</small></span>
          <span className="row">
            <small>{'Débit ' + money(r.debit) + ' · Crédit ' + money(r.credit)}</small>
            <b>{(r.balance >= 0 ? 'D ' : 'C ') + money(Math.abs(r.balance))}</b>
            <button className="link" type="button" onClick={() => onLedger(r.account)}>Grand livre</button>
          </span>
        </div>
      ))}
      <div className="line">
        <b>Totaux</b>
        <b>{'Débit ' + money(j.totalDebit) + ' · Crédit ' + money(j.totalCredit) + (j.totalDebit === j.totalCredit ? ' ✓ équilibrée' : ' ✗ déséquilibrée')}</b>
      </div>
    </div>
  );
}

/** Contenu de la fenêtre « Grand livre ». */
export function LedgerBox({ account, year }) {
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/ledger?account=' + account + '&year=' + year), []);
  if (st.loading) return <div><Loading /></div>;
  if (st.error) return <div>{st.error.message}</div>;
  const j = st.data;
  return (
    <div>
      <p className="muted">{j.label}</p>
      {!j.lines.length ? <Empty text="Aucun mouvement." /> : null}
      {j.lines.map((l, i) => (
        <div className="line" key={l.number + '-' + i}>
          <span><b>{dateFr(l.date)}</b><small>{' ' + l.number + ' · ' + l.label}</small></span>
          <span>{(l.debit ? 'D ' + money(l.debit) : 'C ' + money(l.credit)) + ' → solde ' + money(l.running)}</span>
        </div>
      ))}
      <p>{'Solde : ' + money(j.balance) + (j.balance >= 0 ? ' (débiteur)' : ' (créditeur)')}</p>
    </div>
  );
}

/* ---------- Résultat et bilan ---------- */
export function ResultsTab({ year, setYear }) {
  const { oapi, money } = useWs();
  const st = useLoad(() => Promise.all([oapi('GET', '/accounting/statements?year=' + year), oapi('GET', '/accounting/vat?year=' + year)]), [year]);
  if (st.loading) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{st.error.message}</p>;
  const [s, v] = st.data;
  const r = s.resultat;
  const b = s.bilan;
  return (
    <>
      <YearBar year={year} setYear={setYear} />
      <div className="ws-card">
        <h2>{'Compte de résultat ' + year}</h2>
        <p>{'Ventes ' + money(r.ventes) + ' − achats ' + money(r.achats) + ' = marge brute ' + money(r.margeBrute)}</p>
        {r.produits.map((x) => <AmountLine key={'p' + x.account} x={x} />)}
        <div className="line"><b>Total des produits</b><b>{money(r.totalProduits)}</b></div>
        {r.charges.map((x) => <AmountLine key={'c' + x.account} x={x} />)}
        <div className="line"><b>Total des charges</b><b>{money(r.totalCharges)}</b></div>
        <div className="line"><b>{r.resultat >= 0 ? 'Bénéfice' : 'Perte'}</b><b className={r.resultat >= 0 ? 'ok' : ''}>{money(Math.abs(r.resultat))}</b></div>
      </div>
      <div className="ws-card">
        <h2>{'Bilan simplifié au 31/12/' + year}</h2>
        <p className="muted small">{'Immobilisations ' + money(b.resume.immobilisations) + ' · stocks ' + money(b.resume.stocks) + ' · créances et tiers ' + money(b.resume.creances) + ' · trésorerie ' + money(b.resume.tresorerie) + ' · capitaux propres (avec résultat) ' + money(b.resume.capitauxPropres)}</p>
        <h3>Actif</h3>
        {b.actif.map((x) => <AmountLine key={'a' + x.account} x={x} />)}
        <div className="line"><b>Total actif</b><b>{money(b.totalActif)}</b></div>
        <h3>Passif</h3>
        {b.passif.map((x) => <AmountLine key={'f' + x.account} x={x} />)}
        <div className="line"><span><b>Résultat de l'exercice</b></span><span>{money(b.resultat)}</span></div>
        <div className="line"><b>Total passif</b><b>{money(b.totalPassif) + (b.equilibre ? ' ✓' : ' ✗')}</b></div>
      </div>
      <div className="ws-card">
        <h2>{'TVA ' + year + ' (taux ' + v.rate + ' %)'}</h2>
        <p>{'TVA collectée : ' + money(v.collected) + ' · TVA récupérable : ' + money(v.deductible)}</p>
        <p>{v.due ? 'TVA à reverser : ' + money(v.due) : v.credit ? 'Crédit de TVA : ' + money(v.credit) : 'Rien à reverser.'}</p>
        <p className="muted small">Estimation d'après vos écritures. La déclaration officielle se fait auprès de l'administration fiscale.</p>
      </div>
    </>
  );
}

/* ---------- Réglages ---------- */
export function SettingsTab({ o, reload, onAccountAdded }) {
  const { oapi, toast, modal } = useWs();
  const s = o.settings;
  return (
    <>
      <div className="ws-card">
        <h2>Réglages de la comptabilité</h2>
        <Form
          submitText="Enregistrer"
          fields={[
            { k: 'vatRate', label: 'Taux de TVA (%)', value: String(s.vatRate), hint: "19,25 au Cameroun (TVA + centimes additionnels). Mettez 0 si vous n'êtes pas assujetti." },
            { k: 'payAccount', label: 'Encaissements des clients', type: 'select', options: [['571', 'Caisse (571)'], ['521', 'Banque (521)'], ['589', 'Mobile money (589)']], value: s.payAccount },
            { k: 'purchaseVat', label: 'Les prix d\'achat saisis dans Stock incluent la TVA', type: 'select', options: [['0', 'Non : montants pris tels quels'], ['1', 'Oui : la TVA récupérable est séparée']], value: s.purchaseVat ? '1' : '0' },
            { k: 'lockedUntil', label: 'Période clôturée jusqu\'au', type: 'date', value: s.lockedUntil || '', hint: 'Aucune écriture ne peut plus être ajoutée jusqu\'à cette date. Une clôture ne peut pas être rouverte.' },
          ]}
          onSubmit={(v) => oapi('PUT', '/accounting/settings', { vatRate: Number(String(v.vatRate).replace(',', '.')), payAccount: v.payAccount, purchaseVat: v.purchaseVat === '1', lockedUntil: v.lockedUntil || null }).then(() => { toast('Réglages enregistrés.'); reload(); })}
        />
      </div>
      <div className="ws-card">
        <h2>Plan comptable</h2>
        <p className="muted small">Plan de base inspiré du SYSCOHADA révisé. Ajoutez vos propres comptes (3 à 8 chiffres) si besoin.</p>
        <button className="btn small" type="button" onClick={() => modal('Nouveau compte', (close) => (
          <Form
            submitText="Ajouter"
            fields={[{ k: 'code', label: 'Numéro (ex. 6221)', required: true }, { k: 'label', label: 'Nom du compte', required: true }]}
            onSubmit={(v) => oapi('POST', '/accounting/accounts', v).then(() => { onAccountAdded(); close(); toast('Compte ajouté.'); })}
          />
        ))}>Ajouter un compte</button>
      </div>
    </>
  );
}
