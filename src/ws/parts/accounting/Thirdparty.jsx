import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN, Check, TAP, WorkNotice } from '../finance/util.jsx';

/* Tiers : balance âgée clients / fournisseurs, lettrage 411 / 401, dettes fournisseurs avec échéances. Documents de travail. */

const BUCKETS = [['current', 'Non échu'], ['d30', '1 à 30 jours'], ['d60', '31 à 60 jours'], ['d90', '61 à 90 jours'], ['over90', 'Plus de 90 jours']];

function Aged() {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const [kind, setKind] = useState('customers');
  const st = useLoad(() => oapi('GET', '/accounting/aged?kind=' + kind), [kind]);
  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        {[['customers', 'Clients'], ['suppliers', 'Fournisseurs']].map((x) => <button key={x[0]} type="button" className={'tab' + (kind === x[0] ? ' on' : '')} style={BTN} onClick={() => setKind(x[0])}>{t(x[1])}</button>)}
      </div>
      <Loaded state={st}>
        {(j) => (
          <div className="ws-card" style={{ overflowX: 'auto' }}>
            <h2>{t('Balance âgée au {date}', { date: dateFr(j.asOf) })}</h2>
            {!j.rows.length ? <Empty text={kind === 'customers' ? t('Aucune facture client en attente de paiement.') : t('Aucune dette fournisseur en attente.')} /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ textAlign: 'left' }}>{kind === 'customers' ? t('Client') : t('Fournisseur')}</th>{BUCKETS.map((b) => <th key={b[0]} style={{ textAlign: 'right' }}>{t(b[1])}</th>)}<th style={{ textAlign: 'right' }}>{t('Total')}</th></tr></thead>
                <tbody>
                  {j.rows.map((r) => <tr key={r.party}><td>{r.party}</td>{BUCKETS.map((b) => <td key={b[0]} style={{ textAlign: 'right' }} className={b[0] !== 'current' && r[b[0]] ? 'late' : ''}>{r[b[0]] ? money(r[b[0]]) : ''}</td>)}<td style={{ textAlign: 'right' }}><b>{money(r.total)}</b></td></tr>)}
                  <tr><td><b>{t('Total')}</b></td>{BUCKETS.map((b) => <td key={b[0]} style={{ textAlign: 'right' }}><b>{money(j.totals[b[0]])}</b></td>)}<td style={{ textAlign: 'right' }}><b>{money(j.totals.total)}</b></td></tr>
                </tbody>
              </table>
            )}
            <p className="muted small">{t("Soldes actuels classés selon l'ancienneté de l'échéance (à défaut, de la date de la pièce).")}</p>
          </div>
        )}
      </Loaded>
    </>
  );
}

function Lettering() {
  const t = useT();
  const { oapi, money, dateFr, toast, fail } = useWs();
  const [account, setAccount] = useState('411');
  const [sel, setSel] = useState([]);
  const st = useLoad(() => oapi('GET', '/accounting/lettering?account=' + account), [account]);
  const toggle = (id) => setSel((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const done = (msg) => { toast(msg); setSel([]); st.reload(); };
  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        {[['411', 'Clients (411)'], ['401', 'Fournisseurs (401)']].map((x) => <button key={x[0]} type="button" className={'tab' + (account === x[0] ? ' on' : '')} style={BTN} onClick={() => { setAccount(x[0]); setSel([]); }}>{t(x[1])}</button>)}
      </div>
      <Loaded state={st}>
        {(j) => {
          const chosen = j.open.filter((l) => sel.includes(l.id));
          const d = chosen.reduce((a, l) => a + l.debit, 0); const c = chosen.reduce((a, l) => a + l.credit, 0);
          return (
            <div className="ws-card">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <h2 className="grow">{t('Lignes non lettrées')}</h2>
                {j.proposals.length ? <button className="btn small" type="button" style={BTN} onClick={() => oapi('POST', '/accounting/lettering/auto', { account }).then((r) => done(t('{n} lettrage(s) fait(s).', { n: r.lettered }))).catch(fail)}>{t('Lettrer automatiquement ({n})', { n: j.proposals.length })}</button> : null}
                <button className="btn primary small" type="button" style={BTN} disabled={chosen.length < 2 || d !== c} onClick={() => oapi('POST', '/accounting/lettering', { account, lineIds: sel }).then((r) => done(t('Lettrage {code} fait.', { code: r.code }))).catch(fail)}>{t('Lettrer la sélection')}</button>
              </div>
              <p className="muted small">{chosen.length ? t('Sélection : débit {d}, crédit {c}', { d: money(d), c: money(c) }) + (d === c ? '' : ' · ' + t('doit être équilibrée')) : t('Cochez les lignes d\'un même tiers dont le débit égale le crédit (ex. facture et règlement).')}</p>
              {!j.open.length ? <Empty text={t('Tout est lettré.')} /> : null}
              {j.open.map((l) => (
                <div className="line" key={l.id}><Check checked={sel.includes(l.id)} onChange={() => toggle(l.id)} label={(l.party || t('(sans nom)')) + ' · ' + l.number} hint={dateFr(l.date) + ' · ' + l.label} /><b>{l.debit ? money(l.debit) : '− ' + money(l.credit)}</b></div>
              ))}
              <p className="muted small">{t("Le lettrage rapproche débits et crédits d'un même tiers ; il ne modifie pas les écritures.")}</p>
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

function Payables() {
  const t = useT();
  const { oapi, money, dateFr, modal, toast, fail, today, confirm } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/payables'), []);
  const reload = st.reload;
  const pay = (b) => modal(t('Régler {supplier}', { supplier: b.supplier }), (close) => (
    <Form submitText={t('Enregistrer le règlement')} fields={[
      { k: 'amount', label: t('Montant'), value: String(b.balance), required: true },
      { k: 'method', label: t('Mode'), type: 'select', options: [['bank', t('Banque')], ['cash', t('Espèces')], ['mobile', t('Mobile Money')]] },
      { k: 'date', label: t('Date'), type: 'date', value: today() }, { k: 'reference', label: t('Référence') }]}
    onSubmit={(v) => oapi('POST', '/accounting/payables/' + b.id + '/pay', v).then(() => { close(); reload(); })} />
  ));
  const add = () => modal(t('Nouvelle facture fournisseur'), (close) => (
    <Form submitText={t('Enregistrer et comptabiliser')} fields={[
      { k: 'supplierName', label: t('Fournisseur'), required: true }, { k: 'number', label: t('N° de facture') },
      { k: 'amount', label: t('Montant TTC'), required: true }, { k: 'billDate', label: t('Date de la facture'), type: 'date', value: today() },
      { k: 'dueDate', label: t("Date d'échéance"), type: 'date', hint: t('Vide : 30 jours après la facture.') },
      { k: 'expenseAccount', label: t('Compte de charge'), value: '601', hint: t('Ex. 601 achats de marchandises, 605 autres achats, 622 loyers.') }]}
    onSubmit={(v) => oapi('POST', '/accounting/payables', { ...v, dueDate: v.dueDate || undefined }).then(() => { close(); reload(); })} />
  ));
  const ST = { open: ['mid', 'À payer'], partial: ['mid', 'Payée en partie'], paid: ['good', 'Payée'], cancelled: ['bad', 'Annulée'] };
  return (
    <Loaded state={st}>
      {(j) => (
        <>
          <div className="kpis">
            <div className="stat"><b>{money(j.summary.balance)}</b><span>{t('dettes à payer')}</span></div>
            <div className={'stat' + (j.summary.overdue ? ' bad' : '')}><b>{money(j.summary.overdueAmount)}</b><span>{t('échues ({n})', { n: j.summary.overdue })}</span></div>
            <div className="stat"><b>{money(j.summary.dueIn7Days)}</b><span>{t('à payer sous 7 jours')}</span></div>
          </div>
          <div className="ws-card">
            <div className="row" style={{ flexWrap: 'wrap' }}><h2 className="grow">{t('Factures fournisseurs')}</h2>
              <button className="btn small" type="button" style={BTN} onClick={() => oapi('POST', '/accounting/payables/from-purchases', {}).then((r) => { toast(t('{n} dette(s) créée(s) depuis les achats.', { n: r.created })); reload(); }).catch(fail)}>{t('Importer depuis les achats reçus')}</button>
              <button className="btn primary small" type="button" style={BTN} onClick={add}>{t('Nouvelle facture')}</button></div>
            {!j.bills.length ? <Empty text={t('Aucune facture fournisseur. Importez vos achats reçus ou saisissez une facture.')} /> : null}
            {j.bills.map((b) => (
              <div className="line" key={b.id} style={{ flexWrap: 'wrap' }}>
                <span><b>{b.supplier || t('(sans nom)')}</b>{b.number ? ' · ' + b.number : ''}{' '}<span className={'pill ' + (b.overdue ? 'bad' : ST[b.status][0])}>{b.overdue ? t('En retard de {n} j', { n: b.daysLate }) : t(ST[b.status][1])}</span><br /><small className="muted">{t('échéance {date}', { date: dateFr(b.dueDate) }) + ' · ' + t('reste {amount} sur {total}', { amount: money(b.balance), total: money(b.amount) })}</small></span>
                <span className="row">
                  {['open', 'partial'].includes(b.status) ? <button className="link" type="button" style={TAP} onClick={() => pay(b)}>{t('Régler')}</button> : null}
                  {!b.paid && b.status !== 'cancelled' ? <button className="link" type="button" style={TAP} onClick={() => confirm(t('Annuler cette facture fournisseur ?'), () => { oapi('DELETE', '/accounting/payables/' + b.id).then(reload).catch(fail); })}>{t('Annuler')}</button> : null}
                </span>
              </div>
            ))}
            <p className="muted small">{t("Les achats reçus dans « Stock et achats » alimentent ces dettes : l'achat est déjà comptabilisé (via « Comptabiliser maintenant »), la dette ne fait que suivre l'échéance et le règlement.")}</p>
          </div>
        </>
      )}
    </Loaded>
  );
}

export default function ThirdTab() {
  const t = useT();
  const [sub, setSub] = useState('aged');
  return (
    <>
      <WorkNotice>{t("Documents de travail : à faire valider par un expert-comptable.")}</WorkNotice>
      <div className="ws-tabs" style={{ flexWrap: 'wrap', overflowX: 'visible' }}>
        {[['aged', 'Balance âgée'], ['payables', 'Dettes fournisseurs'], ['lettering', 'Lettrage']].map((x) => <button key={x[0]} type="button" className={'tab' + (sub === x[0] ? ' on' : '')} style={BTN} onClick={() => setSub(x[0])}>{t(x[1])}</button>)}
      </div>
      {sub === 'aged' ? <Aged /> : sub === 'payables' ? <Payables /> : <Lettering />}
    </>
  );
}
