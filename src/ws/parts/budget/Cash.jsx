import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN, TAP, WorkNotice, monthLabel } from '../finance/util.jsx';

/* Prévision de trésorerie (3 mois par défaut) et validation des dépenses au-dessus d'un seuil. Estimations de gestion. */

const KIND = { invoice: 'Facture client', bill: 'Dette fournisseur', order: 'Commande', payroll: 'Paie', tax: 'Échéance fiscale' };

export function CashTab() {
  const t = useT();
  const { oapi, money, dateFr } = useWs();
  const [months, setMonths] = useState(3);
  const [rate, setRate] = useState('100');
  const st = useLoad(() => oapi('GET', '/budget/cashflow?months=' + months + '&collectRate=' + (Number(rate) >= 0 ? Math.min(Number(rate), 100) : 100)), [months, rate]);
  const item = (x, i) => <div className="line" key={i}><span>{x.label}<br /><small className="muted">{t(KIND[x.kind])}{x.dueDate ? ' · ' + dateFr(x.dueDate) : ''}{x.overdue ? ' · ' + t('en retard') : ''}{x.estimated ? ' · ' + t('estimation') : ''}</small></span><b>{money(x.amount)}</b></div>;
  return (
    <>
      <WorkNotice>{t("Prévision de gestion : une estimation à partir des factures, dettes, paie et échéances connues. Ce n'est ni un engagement bancaire ni un conseil financier.")}</WorkNotice>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <label className="small">{t('Horizon')}{' '}<select style={{ fontSize: 16, minHeight: 44 }} value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[1, 2, 3, 6, 12].map((n) => <option key={n} value={n}>{t('{n} mois', { n })}</option>)}</select></label>
        <label className="small">{t("Taux d'encaissement des factures (%)")}{' '}<input style={{ fontSize: 16, minHeight: 44, width: 80 }} inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
      </div>
      <Loaded state={st}>
        {(j) => (
          <>
            {j.alert ? <p className="ws-card small late" role="alert"><b>{t('Alerte : trésorerie négative prévue en {month}', { month: monthLabel(j.alert.month) })}</b>{' (' + money(j.alert.closing) + ')'}</p> : null}
            {!j.openingKnown ? <p className="small muted">{t("Aucune écriture de trésorerie en comptabilité : le solde de départ est 0. Comptabilisez vos mouvements pour un point de départ réel.")}</p> : null}
            <div className="kpis"><div className="stat"><b>{money(j.opening)}</b><span>{t("trésorerie aujourd'hui (comptabilité)")}</span></div></div>
            {j.months.map((m) => (
              <div className="ws-card" key={m.month}>
                <div className="row" style={{ flexWrap: 'wrap' }}><h2 className="grow">{monthLabel(m.month)}</h2><b className={m.closing < 0 ? 'late' : ''}>{t('Fin de mois : {amount}', { amount: money(m.closing) })}</b></div>
                <p className="small">{t('Encaissements {i} · décaissements {o} · net {n}', { i: money(m.inflows), o: money(m.outflows), n: money(m.net) })}</p>
                <details><summary style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>{t('Détail')}</summary>
                  <h3 className="small">{t('Encaissements attendus')}</h3>{!m.inflowItems.length ? <Empty text={t('Aucun.')} /> : m.inflowItems.map(item)}
                  <h3 className="small">{t('Décaissements prévus')}</h3>{!m.outflowItems.length ? <Empty text={t('Aucun.')} /> : m.outflowItems.map(item)}
                </details>
              </div>
            ))}
            <div className="ws-card">
              <h2>{t('Hypothèses')}</h2>
              {j.assumptions.map((a) => <p className="small" key={a}>{'• ' + t(a)}</p>)}
            </div>
          </>
        )}
      </Loaded>
    </>
  );
}

export function ApprovalsTab() {
  const t = useT();
  const { oapi, can, money, dateFr, modal, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/budget/requests'), []);
  const reload = st.reload;
  const threshold = () => modal(t('Seuil de validation des dépenses'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[{ k: 'approvalThreshold', label: t('Montant à partir duquel une dépense doit être validée'), value: String(st.data.threshold || ''), hint: t('0 ou vide : pas de validation. Les administrateurs ne sont pas concernés.') }]}
      onSubmit={(v) => oapi('PUT', '/budget/settings', v).then(() => { close(); reload(); })} />
  ));
  const decide = (r, decision) => {
    if (decision === 'approved') { oapi('POST', '/budget/requests/' + r.id + '/decide', { decision }).then(() => { toast(t('Dépense acceptée et inscrite au budget.')); reload(); }).catch(fail); return; }
    modal(t('Refuser la dépense'), (close) => (
      <Form submitText={t('Refuser')} fields={[{ k: 'note', label: t('Motif du refus'), required: true }]} onSubmit={(v) => oapi('POST', '/budget/requests/' + r.id + '/decide', { decision, note: v.note }).then(() => { close(); reload(); })} />
    ));
  };
  const LBL = { pending: ['mid', 'En attente'], approved: ['good', 'Acceptée'], rejected: ['bad', 'Refusée'] };
  return (
    <Loaded state={st}>
      {(j) => (
        <div className="ws-card">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <h2 className="grow">{t('Dépenses à valider')}</h2>
            <span className="small">{j.threshold ? t('Seuil : {amount}', { amount: money(j.threshold) }) : t('Validation par seuil désactivée')}</span>
            {can('admin') ? <button className="btn small" type="button" style={BTN} onClick={threshold}>{t('Fixer le seuil')}</button> : null}
          </div>
          {!j.requests.length ? <Empty text={t('Aucune demande.')} /> : null}
          {j.requests.map((r) => (
            <div className="line" key={r.id} style={{ flexWrap: 'wrap' }}>
              <span><b>{money(r.amount)}</b>{' ' + r.category}{r.label ? <small className="muted">{' · ' + r.label}</small> : null}{' '}<span className={'pill ' + LBL[r.status][0]}>{t(LBL[r.status][1])}</span><br /><small className="muted">{t('demandé par {name} le {date}', { name: r.requester, date: dateFr(r.date) })}{r.decisionNote ? ' · ' + r.decisionNote : ''}</small></span>
              {can('admin') && r.status === 'pending' ? <span className="row"><button className="link" type="button" style={TAP} onClick={() => decide(r, 'approved')}>{t('Accepter')}</button><button className="link" type="button" style={TAP} onClick={() => decide(r, 'rejected')}>{t('Refuser')}</button></span> : null}
            </div>
          ))}
        </div>
      )}
    </Loaded>
  );
}
