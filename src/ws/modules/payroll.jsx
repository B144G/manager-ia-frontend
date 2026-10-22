import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';
import Settings from '../parts/payroll/Settings.jsx';
import { SlipModal } from '../parts/payroll/Slip.jsx';
import SlipForm from '../parts/payroll/SlipForm.jsx';
import { BTN, INP, TAP, downloadCsv, monthLabel } from '../parts/finance/util.jsx';

/* Paie : bulletins du mois (brouillon, validé, payé), lancement en un clic, bulletin imprimable, export CSV, paramètres.
   Heures supplémentaires calculées, 13e mois, comptabilisation automatique (option), réouverture d'un bulletin validé avec motif.
   Réservée aux administrateurs. Les taux sont des paramètres à vérifier : ce module ne connaît pas les barèmes officiels. */
const ST = { draft: ['Brouillon', 'mid'], validated: ['Validé', 'good'], paid: ['Payé', 'good'] };

export default function Payroll() {
  const { oapi, modal, confirm, toast, fail, money, today } = useWs();
  const [tab, setTab] = useState('slips');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const st = useLoad(() => oapi('GET', '/payroll?month=' + month), [month]);
  const load = st.reload;
  const j = st.data;
  const act = (p, msg) => oapi('POST', p, {}).then(() => { toast(msg); load(); }).catch(fail);

  const run = () => confirm("Créer un brouillon de bulletin pour chaque employé actif qui n'en a pas encore en " + monthLabel(month) + ' ?', () => {
    oapi('POST', '/payroll/run', { month }).then((r) => {
      toast(r.created + ' brouillon(s) créé(s)' + (r.noSalary.length ? ' ; sans salaire : ' + r.noSalary.join(', ') : '') + '.');
      load();
    }).catch(fail);
  }, 'Lancer la paie');

  const edit = (s) => modal('Bulletin de ' + s.employee, (close) => (
    <SlipForm s={s} tiers={j.settings.options.tiers} monthlyHours={j.settings.options.monthlyHours} onDone={() => { close(); load(); }} />
  ));
  const accMsg = (a) => {
    if (!a) return '';
    const one = (x) => (x ? (x.status === 'posted' ? 'écriture ' + x.number + ' créée' : x.status === 'skipped' ? 'écriture refusée : ' + x.reason : '') : '');
    const parts = a.validation || a.payment ? [one(a.validation), one(a.payment)] : [one(a)];
    const t = parts.filter(Boolean).join(' ; ');
    return t ? ' Comptabilité : ' + t + '.' : '';
  };
  const validate = (s) => confirm('Valider ce bulletin ? Il ne pourra plus être modifié (un administrateur pourra le rouvrir avec un motif tant qu\'il n\'est pas payé).' + (j.settings.incomplete.length ? ' Attention, vos paramètres sont incomplets : ' + j.settings.incomplete.join(' ') : ''), () => {
    oapi('POST', '/payroll/slips/' + s.id + '/validate', {}).then((r) => { toast('Bulletin validé.' + accMsg(r.accounting)); load(); }).catch(fail);
  }, 'Valider');
  const reopen = (s) => modal('Rouvrir le bulletin de ' + s.employee, (close) => (
    <Form
      submitText="Rouvrir le bulletin"
      fields={[{ k: 'reason', label: 'Motif de la réouverture (obligatoire)', required: true, type: 'textarea', rows: 3, hint: "Le motif est conservé dans le journal d'activité et le journal d'audit. L'écriture comptable éventuelle est annulée par une écriture inverse." }]}
      onSubmit={(v) => oapi('POST', '/payroll/slips/' + s.id + '/reopen', v).then((r) => { close(); toast('Bulletin rouvert (brouillon).' + (r.reversedEntry ? ' Écriture ' + r.reversedEntry + ' annulée.' : '')); load(); })}
    />
  ));
  const account = (s) => oapi('POST', '/payroll/slips/' + s.id + '/accounting', {}).then((r) => { toast('Comptabilisé.' + accMsg(r)); load(); }).catch(fail);
  const pay = (s) => modal('Payer ' + s.employee, (close) => (
    <Form
      submitText="Marquer comme payé"
      fields={[
        { k: 'method', label: 'Mode de paiement', type: 'select', options: Object.entries(j.methods) },
        { k: 'date', label: 'Date du paiement', type: 'date', value: today() },
      ]}
      onSubmit={(v) => oapi('POST', '/payroll/slips/' + s.id + '/pay', v).then((r) => { close(); toast('Paiement enregistré.' + accMsg(r.accounting)); load(); })}
    />
  ));
  const view = (s) => modal('Bulletin imprimable', () => <SlipModal s={s} />, { wide: true });
  const csv = () => {
    const rows = [['Mois', 'Employé', 'Poste', 'Statut', 'Brut', 'Retenues salariales', 'Avances', 'Autres retenues', 'Net à payer', 'Charges patronales', 'Coût employeur', 'Date de paiement', 'Mode']];
    for (const s of j.slips) rows.push([month, s.employee, s.job, ST[s.status][0], s.gross, s.employeeDeductions, s.advances, s.otherDeductions, s.net, s.employerCharges, s.employerCost, s.paidDate || '', s.payMethodLabel]);
    rows.push(['Total', '', '', '', j.totals.gross, j.totals.employeeDeductions, j.totals.advances, '', j.totals.net, j.totals.employerCharges, j.totals.employerCost, '', '']);
    downloadCsv('paie-' + month + '.csv', rows);
  };

  return (
    <>
      <div className="ws-head">
        <div><h1>Paie</h1><p className="muted">Les bulletins de paie de vos employés, mois par mois. Réservé aux administrateurs.</p></div>
        <div className="row">
          <input type="month" style={INP} value={month} aria-label="Mois" onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} />
          <button className="btn primary small" type="button" style={BTN} onClick={run}>Lancer la paie du mois</button>
        </div>
      </div>
      <div className="ws-tabs" style={{ flexWrap: 'wrap', overflowX: 'visible' }}>
        {[['slips', 'Bulletins'], ['settings', 'Paramètres']].map((t) => <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} style={BTN} onClick={() => setTab(t[0])}>{t[1]}</button>)}
      </div>
      {tab === 'settings' ? <Settings onSaved={load} /> : null}
      {tab === 'slips' && st.loading && !j ? <Loading /> : null}
      {tab === 'slips' && st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
      {tab === 'slips' && j ? (
        <>
          {j.settings.incomplete.length ? <p className="ws-card small late" role="alert"><b>À compléter dans les paramètres :</b>{' ' + j.settings.incomplete.join(' ')}</p> : null}
          {j.settings.isDefault ? <p className="ws-card small" role="note"><b>Taux d'exemple.</b>{' ' + j.settings.disclaimer + " Ouvrez l'onglet Paramètres pour les adapter."}</p> : null}
          <div className="kpis">
            <div className="stat"><b>{money(j.totals.gross)}</b><span>masse salariale (brut)</span></div>
            <div className="stat"><b>{money(j.totals.net)}</b><span>net à payer</span></div>
            <div className="stat"><b>{money(j.totals.employerCost)}</b><span>coût total employeur</span></div>
            <div className={'stat' + (j.pending ? ' bad' : '')}><b>{j.pending}</b><span>bulletin(s) en attente</span></div>
          </div>
          <div className="ws-card">
            <div className="row"><h2 className="grow">{'Bulletins de ' + monthLabel(month)}</h2>{j.slips.length ? <button className="btn small" type="button" style={BTN} onClick={csv}>Exporter en CSV</button> : null}</div>
            {!j.slips.length ? <Empty text="Aucun bulletin ce mois-ci. Cliquez sur « Lancer la paie du mois » pour créer les brouillons." /> : null}
            {j.slips.map((s) => (
              <div className="line" key={s.id} style={{ flexWrap: 'wrap' }}>
                <span><b>{s.employee}</b>{' '}<span className={'pill ' + ST[s.status][1]}>{ST[s.status][0]}</span>{s.accEntryId ? <>{' '}<span className="pill good">Comptabilisé</span></> : null}<br /><small style={{ overflowWrap: 'anywhere' }}>{'Net ' + money(s.net) + ' · coût employeur ' + money(s.employerCost)}{s.overtime ? ' · heures sup. ' + money(s.overtime) : ''}{s.annualBonus ? ' · ' + (s.annualBonusLabel || 'prime annuelle') + ' ' + money(s.annualBonus) : ''}</small>{s.reopenedCount ? <><br /><small className="muted">{'Rouvert : ' + s.reopenReason}</small></> : null}</span>
                <span className="row" style={{ flexWrap: 'wrap' }}>
                  <button className="link" type="button" style={TAP} onClick={() => view(s)}>Voir / imprimer</button>
                  {s.status === 'draft' ? <button className="link" type="button" style={TAP} onClick={() => edit(s)}>Modifier</button> : null}
                  {s.status === 'draft' ? <button className="link" type="button" style={TAP} onClick={() => validate(s)}>Valider</button> : null}
                  {s.status === 'validated' ? <button className="link" type="button" style={TAP} onClick={() => pay(s)}>Payer</button> : null}
                  {s.status === 'validated' && !s.budgetEntryId ? <button className="link" type="button" style={TAP} onClick={() => reopen(s)}>Rouvrir</button> : null}
                  {s.status !== 'draft' && !s.accEntryId ? <button className="link" type="button" style={TAP} onClick={() => account(s)}>Comptabiliser</button> : null}
                  {s.status !== 'draft' && !s.budgetEntryId ? <button className="link" type="button" style={TAP} onClick={() => act('/payroll/slips/' + s.id + '/budget', 'Ajouté au budget (Salaires).')}>Enregistrer au budget</button> : null}
                  {s.budgetEntryId ? <small className="muted">Au budget</small> : null}
                  {s.status === 'draft' ? <button className="link" type="button" style={TAP} onClick={() => confirm('Supprimer ce brouillon ?', () => { oapi('DELETE', '/payroll/slips/' + s.id).then(load).catch(fail); })}>Supprimer</button> : null}
                </span>
              </div>
            ))}
            {j.missing.length ? <p className="muted small">{'Sans bulletin ce mois-ci : ' + j.missing.map((m) => m.name + (m.salary ? '' : ' (salaire non renseigné dans RH)')).join(', ') + '.'}</p> : null}
          </div>
          <p className="muted small">L'IA aide à préparer et contrôler la paie ; elle ne donne pas de conseil juridique définitif. « Enregistrer au budget » ajoute une sortie « Salaires » égale au coût total employeur. « Comptabiliser » crée les écritures de paie dans la Comptabilité (une seule par événement, aussi automatique si vous l'activez dans les paramètres).</p>
        </>
      ) : null}
    </>
  );
}
