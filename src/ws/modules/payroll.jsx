import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';
import Settings from '../parts/payroll/Settings.jsx';
import { SlipModal } from '../parts/payroll/Slip.jsx';
import SlipForm from '../parts/payroll/SlipForm.jsx';
import { BTN, INP, TAP, downloadCsv, incompleteText, monthLabel } from '../parts/finance/util.jsx';

/* Paie : bulletins du mois (brouillon, validé, payé), lancement en un clic, bulletin imprimable, export CSV, paramètres.
   Heures supplémentaires calculées, 13e mois, comptabilisation automatique (option), réouverture d'un bulletin validé avec motif.
   Réservée aux administrateurs. Les taux sont des paramètres à vérifier : ce module ne connaît pas les barèmes officiels. */
const ST = { draft: ['Brouillon', 'mid'], validated: ['Validé', 'good'], paid: ['Payé', 'good'] };

export default function Payroll() {
  const t = useT();
  const { oapi, modal, confirm, toast, fail, money, today } = useWs();
  const [tab, setTab] = useState('slips');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const st = useLoad(() => oapi('GET', '/payroll?month=' + month), [month]);
  const load = st.reload;
  const j = st.data;
  const act = (p, msg) => oapi('POST', p, {}).then(() => { toast(msg); load(); }).catch(fail);
  const inc = (list) => list.map((x) => incompleteText(t, x)).join(' ');

  const run = () => confirm(t("Créer un brouillon de bulletin pour chaque employé actif qui n'en a pas encore en {month} ?", { month: monthLabel(month) }), () => {
    oapi('POST', '/payroll/run', { month }).then((r) => {
      toast(r.noSalary.length ? t('{n} brouillon(s) créé(s) ; sans salaire : {names}.', { n: r.created, names: r.noSalary.join(', ') }) : t('{n} brouillon(s) créé(s).', { n: r.created }));
      load();
    }).catch(fail);
  }, t('Lancer la paie'));

  const edit = (s) => modal(t('Bulletin de {name}', { name: s.employee }), (close) => (
    <SlipForm s={s} tiers={j.settings.options.tiers} monthlyHours={j.settings.options.monthlyHours} onDone={() => { close(); load(); }} />
  ));
  const accMsg = (a) => {
    if (!a) return '';
    const one = (x) => (x ? (x.status === 'posted' ? t('écriture {number} créée', { number: x.number }) : x.status === 'skipped' ? t('écriture refusée : {reason}', { reason: t(x.reason) }) : '') : '');
    const parts = a.validation || a.payment ? [one(a.validation), one(a.payment)] : [one(a)];
    const txt = parts.filter(Boolean).join(' ; ');
    return txt ? ' ' + t('Comptabilité : {parts}.', { parts: txt }) : '';
  };
  const validate = (s) => confirm(t("Valider ce bulletin ? Il ne pourra plus être modifié (un administrateur pourra le rouvrir avec un motif tant qu'il n'est pas payé).") + (j.settings.incomplete.length ? ' ' + t('Attention, vos paramètres sont incomplets : {list}', { list: inc(j.settings.incomplete) }) : ''), () => {
    oapi('POST', '/payroll/slips/' + s.id + '/validate', {}).then((r) => { toast(t('Bulletin validé.') + accMsg(r.accounting)); load(); }).catch(fail);
  }, t('Valider'));
  const reopen = (s) => modal(t('Rouvrir le bulletin de {name}', { name: s.employee }), (close) => (
    <Form
      submitText={t("Rouvrir le bulletin")}
      fields={[{ k: 'reason', label: t('Motif de la réouverture (obligatoire)'), required: true, type: 'textarea', rows: 3, hint: t("Le motif est conservé dans le journal d'activité et le journal d'audit. L'écriture comptable éventuelle est annulée par une écriture inverse.") }]}
      onSubmit={(v) => oapi('POST', '/payroll/slips/' + s.id + '/reopen', v).then((r) => { close(); toast(t('Bulletin rouvert (brouillon).') + (r.reversedEntry ? ' ' + t('Écriture {number} annulée.', { number: r.reversedEntry }) : '')); load(); })}
    />
  ));
  const account = (s) => oapi('POST', '/payroll/slips/' + s.id + '/accounting', {}).then((r) => { toast(t('Comptabilisé.') + accMsg(r)); load(); }).catch(fail);
  const pay = (s) => modal(t('Payer {name}', { name: s.employee }), (close) => (
    <Form
      submitText={t("Marquer comme payé")}
      fields={[
        { k: 'method', label: t('Mode de paiement'), type: 'select', options: Object.entries(j.methods).map(([k, v]) => [k, t(v)]) },
        { k: 'date', label: t('Date du paiement'), type: 'date', value: today() },
      ]}
      onSubmit={(v) => oapi('POST', '/payroll/slips/' + s.id + '/pay', v).then((r) => { close(); toast(t('Paiement enregistré.') + accMsg(r.accounting)); load(); })}
    />
  ));
  const view = (s) => modal(t('Bulletin imprimable'), () => <SlipModal s={s} />, { wide: true });
  const csv = () => {
    const rows = [['Mois', 'Employé', 'Poste', 'Statut', 'Brut', 'Retenues salariales', 'Avances', 'Autres retenues', 'Net à payer', 'Charges patronales', 'Coût employeur', 'Date de paiement', 'Mode'].map((h) => t(h))];
    for (const s of j.slips) rows.push([month, s.employee, s.job, t(ST[s.status][0]), s.gross, s.employeeDeductions, s.advances, s.otherDeductions, s.net, s.employerCharges, s.employerCost, s.paidDate || '', t(s.payMethodLabel || '')]);
    rows.push([t('Total'), '', '', '', j.totals.gross, j.totals.employeeDeductions, j.totals.advances, '', j.totals.net, j.totals.employerCharges, j.totals.employerCost, '', '']);
    downloadCsv('paie-' + month + '.csv', rows);
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Paie')}</h1><p className="muted">{t('Les bulletins de paie de vos employés, mois par mois. Réservé aux administrateurs.')}</p></div>
        <div className="row">
          <input type="month" style={INP} value={month} aria-label={t("Mois")} onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} />
          <button className="btn primary small" type="button" style={BTN} onClick={run}>{t('Lancer la paie du mois')}</button>
        </div>
      </div>
      <div className="ws-tabs" style={{ flexWrap: 'wrap', overflowX: 'visible' }}>
        {[['slips', 'Bulletins'], ['settings', 'Paramètres']].map((x) => <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} style={BTN} onClick={() => setTab(x[0])}>{t(x[1])}</button>)}
      </div>
      {tab === 'settings' ? <Settings onSaved={load} /> : null}
      {tab === 'slips' && st.loading && !j ? <Loading /> : null}
      {tab === 'slips' && st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : null}
      {tab === 'slips' && j ? (
        <>
          {j.settings.incomplete.length ? <p className="ws-card small late" role="alert"><b>{t('À compléter dans les paramètres :')}</b>{' ' + inc(j.settings.incomplete)}</p> : null}
          {j.settings.isDefault ? <p className="ws-card small" role="note"><b>{t("Taux d'exemple.")}</b>{' ' + t(j.settings.disclaimer) + ' ' + t("Ouvrez l'onglet Paramètres pour les adapter.")}</p> : null}
          <div className="kpis">
            <div className="stat"><b>{money(j.totals.gross)}</b><span>{t('masse salariale (brut)')}</span></div>
            <div className="stat"><b>{money(j.totals.net)}</b><span>{t('net à payer')}</span></div>
            <div className="stat"><b>{money(j.totals.employerCost)}</b><span>{t('coût total employeur')}</span></div>
            <div className={'stat' + (j.pending ? ' bad' : '')}><b>{j.pending}</b><span>{t('bulletin(s) en attente')}</span></div>
          </div>
          <div className="ws-card">
            <div className="row"><h2 className="grow">{t('Bulletins de {month}', { month: monthLabel(month) })}</h2>{j.slips.length ? <button className="btn small" type="button" style={BTN} onClick={csv}>{t('Exporter en CSV')}</button> : null}</div>
            {!j.slips.length ? <Empty text={t("Aucun bulletin ce mois-ci. Cliquez sur « Lancer la paie du mois » pour créer les brouillons.")} /> : null}
            {j.slips.map((s) => (
              <div className="line" key={s.id} style={{ flexWrap: 'wrap' }}>
                <span><b>{s.employee}</b>{' '}<span className={'pill ' + ST[s.status][1]}>{t(ST[s.status][0])}</span>{s.accEntryId ? <>{' '}<span className="pill good">{t('Comptabilisé')}</span></> : null}<br /><small style={{ overflowWrap: 'anywhere' }}>{t('Net {net} · coût employeur {cost}', { net: money(s.net), cost: money(s.employerCost) })}{s.overtime ? ' · ' + t('heures sup.') + ' ' + money(s.overtime) : ''}{s.annualBonus ? ' · ' + (s.annualBonusLabel || t('prime annuelle')) + ' ' + money(s.annualBonus) : ''}</small>{s.reopenedCount ? <><br /><small className="muted">{t('Rouvert : {reason}', { reason: s.reopenReason })}</small></> : null}</span>
                <span className="row" style={{ flexWrap: 'wrap' }}>
                  <button className="link" type="button" style={TAP} onClick={() => view(s)}>{t('Voir / imprimer')}</button>
                  {s.status === 'draft' ? <button className="link" type="button" style={TAP} onClick={() => edit(s)}>{t('Modifier')}</button> : null}
                  {s.status === 'draft' ? <button className="link" type="button" style={TAP} onClick={() => validate(s)}>{t('Valider')}</button> : null}
                  {s.status === 'validated' ? <button className="link" type="button" style={TAP} onClick={() => pay(s)}>{t('Payer')}</button> : null}
                  {s.status === 'validated' && !s.budgetEntryId ? <button className="link" type="button" style={TAP} onClick={() => reopen(s)}>{t('Rouvrir')}</button> : null}
                  {s.status !== 'draft' && !s.accEntryId ? <button className="link" type="button" style={TAP} onClick={() => account(s)}>{t('Comptabiliser')}</button> : null}
                  {s.status !== 'draft' && !s.budgetEntryId ? <button className="link" type="button" style={TAP} onClick={() => act('/payroll/slips/' + s.id + '/budget', t('Ajouté au budget (Salaires).'))}>{t('Enregistrer au budget')}</button> : null}
                  {s.budgetEntryId ? <small className="muted">{t('Au budget')}</small> : null}
                  {s.status === 'draft' ? <button className="link" type="button" style={TAP} onClick={() => confirm(t('Supprimer ce brouillon ?'), () => { oapi('DELETE', '/payroll/slips/' + s.id).then(load).catch(fail); })}>{t('Supprimer')}</button> : null}
                </span>
              </div>
            ))}
            {j.missing.length ? <p className="muted small">{t('Sans bulletin ce mois-ci : {names}.', { names: j.missing.map((m) => m.name + (m.salary ? '' : ' (' + t('salaire non renseigné dans RH') + ')')).join(', ') })}</p> : null}
          </div>
          <p className="muted small">{t("L'IA aide à préparer et contrôler la paie ; elle ne donne pas de conseil juridique définitif. « Enregistrer au budget » ajoute une sortie « Salaires » égale au coût total employeur. « Comptabiliser » crée les écritures de paie dans la Comptabilité (une seule par événement, aussi automatique si vous l'activez dans les paramètres).")}</p>
        </>
      ) : null}
    </>
  );
}
