import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../../ui.jsx';
import { YearBar } from './common.jsx';

/* Écrans du lot 3 de la comptabilité : écritures sans justificatif, piste d'audit, emprunts, plan de financement.
   Tout passe par les routes du serveur (qui contrôlent droits, équilibre et périodes clôturées) ; rien n'est calculé ici sauf le plan de financement, simple lecture de la balance. */

const SOURCES = { invoice: 'Facture', credit_note: 'Avoir', payment: 'Encaissement', purchase: 'Achat', receipt: 'Réception', recurring: 'Récurrente', loan_disburse: 'Emprunt : déblocage', loan_pay: 'Emprunt : échéance', year_end: 'Clôture annuelle', year_open: 'À-nouveaux' };

function Failed({ e }) { const t = useT(); return <p className="ws-err" role="alert">{t(e.message)}</p>; }

/** Écritures saisies à la main sans numéro de pièce : à compléter ou à justifier. */
export function UnsupportedScreen({ year, setYear }) {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/unsupported?year=' + year), [year]);
  return (
    <div className="ws-card">
      <YearBar year={year} setYear={setYear} />
      <h2>{t('Écritures sans justificatif')}</h2>
      <p className="muted small">{t("Écritures saisies à la main sans numéro de pièce (facture, reçu…). Une écriture ne se modifie pas : retrouvez le document, puis annulez et ressaisissez l'écriture avec sa pièce si besoin.")}</p>
      {st.loading && !st.data ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {st.data ? (
        <>
          <p><b>{t('{n} écriture(s)', { n: st.data.count })}</b>{st.data.count ? ' · ' + t('montant cumulé {amount}', { amount: money(st.data.total) }) : ''}</p>
          {!st.data.entries.length ? <Empty text={t('Toutes vos écritures ont un justificatif. Bravo.')} /> : null}
          {st.data.entries.map((e) => (
            <div className="line" key={e.id}>
              <span><b>{dateFr(e.date)}</b><small>{' ' + e.number + ' · ' + e.label}</small></span>
              <b>{money(e.total)}</b>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

/** Piste d'audit : qui a passé quelle écriture, quand, et d'où elle vient. */
export function TrailScreen({ year, setYear }) {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/audit-trail?year=' + year + '&limit=200'), [year]);
  const j = st.data;
  return (
    <div className="ws-card">
      <YearBar year={year} setYear={setYear} />
      <h2>{t("Piste d'audit")}</h2>
      <p className="muted small">{t("Chaque écriture garde son auteur, sa date de saisie et son origine. Rien n'est jamais modifié ni supprimé : une erreur se corrige par une écriture d'annulation, visible ici.")}</p>
      {st.loading && !j ? <Loading /> : null}
      {st.error ? <Failed e={st.error} /> : null}
      {j ? (
        <>
          <p className="muted small">{t('{shown} écriture(s) affichée(s) sur {count}.', { shown: j.shown, count: j.count })}{j.byAuthor.length ? ' ' + j.byAuthor.map((a) => (a.author || t('Automatique')) + ' : ' + a.count).join(' · ') : ''}</p>
          {!j.entries.length ? <Empty text={t('Aucune écriture sur cet exercice.')} /> : null}
          {j.entries.map((e) => (
            <div className="line" key={e.id} style={{ flexWrap: 'wrap' }}>
              <span>
                <b>{e.number}</b> <small>{dateFr(e.date)} · {e.label}</small>
                <br /><small className="muted">
                  {t('Saisie par {who}', { who: e.author || t('le système') }) + ' · ' + dateFr(String(e.createdAt).slice(0, 10)) + (e.source ? ' · ' + t(SOURCES[e.source] || e.source) : '')}
                  {e.reversesNumber ? ' · ' + t('annule {number}', { number: e.reversesNumber }) : ''}
                  {e.cancelledBy ? ' · ' + t('annulée par {number}', { number: e.cancelledBy }) : ''}
                </small>
              </span>
              <b>{money(e.total)}</b>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

const METHODS = [['annuity', 'Annuités constantes'], ['constant_principal', 'Capital constant']];
const ACCTS = [['521', 'Banque (521)'], ['589', 'Mobile money (589)'], ['571', 'Caisse (571)']];

function Schedule({ id }) {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/loans/' + id), [id]);
  if (st.loading) return <Loading />;
  if (st.error) return <Failed e={st.error} />;
  const j = st.data;
  return (
    <div>
      <p className="muted small">{t('{rate} % par an sur {months} mois · intérêts totaux {interest}', { rate: j.ratePct, months: j.months, interest: money(j.totalInterest) })}</p>
      {j.lines.map((g) => (
        <div className="line" key={g.n} style={{ flexWrap: 'wrap' }}>
          <span><b>{g.n}</b><small>{' ' + dateFr(g.dueDate)}</small></span>
          <span className="small">{t('capital {c} · intérêts {i} · reste {r}', { c: money(g.principal), i: money(g.interest), r: money(g.balanceAfter) })}</span>
          <span className={'pill ' + (g.entry ? 'good' : g.late ? 'bad' : 'mid')}>{g.entry ? t('Comptabilisée {number}', { number: g.entry }) : g.late ? t('En retard') : t('À venir')}</span>
        </div>
      ))}
    </div>
  );
}

/** Emprunts : tableau d'amortissement, déblocage et remboursements passés en écritures. */
export function LoansScreen() {
  const t = useT();
  const { oapi, money, dateFr, modal, toast, today } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/loans'), []);
  const add = () => modal(t('Nouvel emprunt'), (close) => (
    <Form
      submitText={t("Enregistrer l'emprunt")}
      fields={[
        { k: 'label', label: t("Nom de l'emprunt"), required: true, placeholder: t('Prêt pour le véhicule') },
        { k: 'lender', label: t('Banque ou prêteur') },
        { k: 'principal', label: t('Montant emprunté (FCFA)'), required: true },
        { k: 'ratePct', label: t("Taux d'intérêt annuel (%)"), value: '0', hint: t('0 si le prêt est sans intérêt.') },
        { k: 'months', label: t('Durée (mois)'), required: true, value: '12' },
        { k: 'method', label: t('Remboursement'), type: 'select', options: METHODS.map(([k, v]) => [k, t(v)]) },
        { k: 'startDate', label: t('Date de réception des fonds'), type: 'date', value: today() },
        { k: 'account', label: t('Fonds reçus sur'), type: 'select', options: ACCTS.map(([k, v]) => [k, t(v)]) },
      ]}
      onSubmit={(v) => oapi('POST', '/accounting/loans', { label: v.label, lender: v.lender, principal: v.principal, ratePct: v.ratePct, months: Number(v.months), method: v.method, startDate: v.startDate, account: v.account })
        .then((r) => { close(); toast(t('Emprunt enregistré, écriture {number} passée.', { number: r.entry })); st.reload(); })}
    />
  ));
  const pay = (l) => modal(t('Échéance {n} de {label}', { n: l.next.n, label: l.label }), (close) => (
    <Form
      submitText={t("Comptabiliser l'échéance")}
      fields={[
        { k: 'date', label: t('Date du paiement'), type: 'date', value: today() },
        { k: 'account', label: t('Payée avec'), type: 'select', options: ACCTS.map(([k, v]) => [k, t(v)]) },
      ]}
      extra={<p className="muted small">{t('Capital {c} + intérêts {i} = {total}', { c: money(l.next.principal), i: money(l.next.interest), total: money(l.next.principal + l.next.interest) })}</p>}
      onSubmit={(v) => oapi('POST', '/accounting/loans/' + l.id + '/pay', { date: v.date, account: v.account }).then((r) => { close(); toast(t('Échéance comptabilisée : {number}.', { number: r.entry })); st.reload(); })}
    />
  ));
  const j = st.data;
  return (
    <>
      <div className="ws-card">
        <div className="row"><h2 className="grow">{t('Emprunts')}</h2><button className="btn primary small" type="button" onClick={add}>{t('Nouvel emprunt')}</button></div>
        {st.loading && !j ? <Loading /> : null}
        {st.error ? <Failed e={st.error} /> : null}
        {j ? <p><b>{t('Capital restant dû : {amount}', { amount: money(j.outstanding) })}</b></p> : null}
        {j && !j.loans.length ? <Empty text={t("Aucun emprunt enregistré. Un prêt bancaire ou d'un tiers apparaît ici avec son tableau de remboursement.")} /> : null}
        {j ? j.loans.map((l) => (
          <div className="line" key={l.id} style={{ flexWrap: 'wrap' }}>
            <span>
              <b>{l.label}</b>{l.lender ? <small>{' · ' + l.lender}</small> : null}
              <br /><small className="muted">{t('{amount} sur {months} mois à {rate} %', { amount: money(l.principal), months: l.months, rate: l.ratePct }) + ' · ' + t('{paid}/{months} échéances payées', { paid: l.paidCount, months: l.months })}</small>
              {l.next ? <><br /><small className={l.next.late ? 'late' : 'muted'}>{t('Prochaine échéance : {date} · {amount}', { date: dateFr(l.next.dueDate), amount: money(l.next.principal + l.next.interest) })}</small></> : <><br /><small className="ok">{t('Emprunt remboursé.')}</small></>}
            </span>
            <span className="row">
              <b>{money(l.outstanding)}</b>
              <button className="link" type="button" onClick={() => modal(t('Tableau de remboursement : {label}', { label: l.label }), () => <Schedule id={l.id} />, { wide: true })}>{t('Tableau')}</button>
              {l.next ? <button className="btn small" type="button" onClick={() => pay(l)}>{t("Comptabiliser l'échéance")}</button> : null}
            </span>
          </div>
        )) : null}
      </div>
    </>
  );
}

/** Plan de financement de l'exercice : emplois et ressources d'après la balance (lecture seule, sans rien enregistrer). */
export function FinancingScreen({ year, setYear }) {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/balance?year=' + year), [year]);
  const rows = (st.data && st.data.rows) || [];
  const sum = (f, side) => rows.filter((r) => f(r.account)).reduce((a, r) => a + Number(r[side]), 0);
  const fixed = (a) => /^2[0-7]/.test(a); // immobilisations (hors amortissements 28 et dépréciations 29)
  const loan = (a) => /^16/.test(a);
  const capital = (a) => /^10/.test(a);
  const uses = [[t("Acquisitions d'immobilisations"), sum(fixed, 'debit')], [t("Remboursements d'emprunts"), sum(loan, 'debit')]];
  const res = [[t('Emprunts reçus'), sum(loan, 'credit')], [t('Apports en capital'), sum(capital, 'credit')]];
  const tu = uses.reduce((a, x) => a + x[1], 0); const tr = res.reduce((a, x) => a + x[1], 0);
  return (
    <>
      <div className="ws-card">
        <YearBar year={year} setYear={setYear} />
        <h2>{t('Plan de financement {year}', { year })}</h2>
        <p className="muted small">{t("Ce que l'entreprise a investi ou remboursé (emplois), et l'argent venu des emprunts et des apports (ressources).")}</p>
        {st.loading && !st.data ? <Loading /> : null}
        {st.error ? <Failed e={st.error} /> : null}
        {st.data ? (
          <>
            <h3>{t('Emplois')}</h3>
            {uses.map((x) => <div className="line" key={x[0]}><span>{x[0]}</span><b>{money(x[1])}</b></div>)}
            <div className="line"><b>{t('Total des emplois')}</b><b>{money(tu)}</b></div>
            <h3>{t('Ressources')}</h3>
            {res.map((x) => <div className="line" key={x[0]}><span>{x[0]}</span><b>{money(x[1])}</b></div>)}
            <div className="line"><b>{t('Total des ressources')}</b><b>{money(tr)}</b></div>
            <div className="line"><b>{tr - tu >= 0 ? t("Ressources d'avance sur les emplois") : t('Emplois non couverts par ces ressources')}</b><b className={tr - tu >= 0 ? 'ok' : 'late'}>{money(Math.abs(tr - tu))}</b></div>
            <p className="muted small">{t("Un emploi non couvert est normalement financé par l'activité (bénéfices) ou la trésorerie.")}</p>
          </>
        ) : null}
      </div>
    </>
  );
}
