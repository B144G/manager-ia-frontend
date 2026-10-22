import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';
import Settings from '../parts/payroll/Settings.jsx';
import { SlipModal } from '../parts/payroll/Slip.jsx';
import { downloadCsv, monthLabel } from '../parts/finance/util.jsx';

/* Paie : bulletins du mois (brouillon, validé, payé), lancement en un clic, bulletin imprimable, export CSV, paramètres.
   Réservée aux administrateurs. Les taux sont des paramètres à vérifier : ce module ne connaît pas les barèmes officiels. */
const ST = { draft: ['Brouillon', 'mid'], validated: ['Validé', 'good'], paid: ['Payé', 'good'] };

export default function Payroll() {
  const { oapi, modal, confirm, toast, fail, money, info, today } = useWs();
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
    <Form
      submitText="Enregistrer"
      fields={[
        { k: 'base', label: 'Salaire de base (' + info.org.currency + ')', required: true, value: s.base },
        { k: 'bonuses', label: 'Primes', value: s.bonuses },
        { k: 'overtime', label: 'Heures supplémentaires (montant)', value: s.overtime },
        { k: 'advances', label: 'Avances et acomptes à déduire', value: s.advances },
        { k: 'otherDeductions', label: 'Autres retenues', value: s.otherDeductions },
        { k: 'note', label: 'Remarque', value: s.note, hint: 'Le net et les charges sont recalculés avec vos paramètres.' },
      ]}
      onSubmit={(v) => oapi('PUT', '/payroll/slips/' + s.id, v).then(() => { close(); load(); })}
    />
  ));
  const pay = (s) => modal('Payer ' + s.employee, (close) => (
    <Form
      submitText="Marquer comme payé"
      fields={[
        { k: 'method', label: 'Mode de paiement', type: 'select', options: Object.entries(j.methods) },
        { k: 'date', label: 'Date du paiement', type: 'date', value: today() },
      ]}
      onSubmit={(v) => oapi('POST', '/payroll/slips/' + s.id + '/pay', v).then(() => { close(); toast('Paiement enregistré.'); load(); })}
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
          <input type="month" value={month} aria-label="Mois" onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} />
          <button className="btn primary small" type="button" onClick={run}>Lancer la paie du mois</button>
        </div>
      </div>
      <div className="ws-tabs">
        {[['slips', 'Bulletins'], ['settings', 'Paramètres']].map((t) => <button key={t[0]} type="button" className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => setTab(t[0])}>{t[1]}</button>)}
      </div>
      {tab === 'settings' ? <Settings onSaved={load} /> : null}
      {tab === 'slips' && st.loading && !j ? <Loading /> : null}
      {tab === 'slips' && st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
      {tab === 'slips' && j ? (
        <>
          {j.settings.isDefault ? <p className="ws-card small" role="note"><b>Taux d'exemple.</b>{' ' + j.settings.disclaimer + " Ouvrez l'onglet Paramètres pour les adapter."}</p> : null}
          <div className="kpis">
            <div className="stat"><b>{money(j.totals.gross)}</b><span>masse salariale (brut)</span></div>
            <div className="stat"><b>{money(j.totals.net)}</b><span>net à payer</span></div>
            <div className="stat"><b>{money(j.totals.employerCost)}</b><span>coût total employeur</span></div>
            <div className={'stat' + (j.pending ? ' bad' : '')}><b>{j.pending}</b><span>bulletin(s) en attente</span></div>
          </div>
          <div className="ws-card">
            <div className="row"><h2 className="grow">{'Bulletins de ' + monthLabel(month)}</h2>{j.slips.length ? <button className="btn small" type="button" onClick={csv}>Exporter en CSV</button> : null}</div>
            {!j.slips.length ? <Empty text="Aucun bulletin ce mois-ci. Cliquez sur « Lancer la paie du mois » pour créer les brouillons." /> : null}
            {j.slips.map((s) => (
              <div className="line" key={s.id} style={{ flexWrap: 'wrap' }}>
                <span><b>{s.employee}</b>{' '}<span className={'pill ' + ST[s.status][1]}>{ST[s.status][0]}</span><br /><small>{'Net ' + money(s.net) + ' · coût employeur ' + money(s.employerCost)}</small></span>
                <span className="row" style={{ flexWrap: 'wrap' }}>
                  <button className="link" type="button" onClick={() => view(s)}>Voir / imprimer</button>
                  {s.status === 'draft' ? <button className="link" type="button" onClick={() => edit(s)}>Modifier</button> : null}
                  {s.status === 'draft' ? <button className="link" type="button" onClick={() => confirm('Valider ce bulletin ? Il ne pourra plus être modifié.', () => act('/payroll/slips/' + s.id + '/validate', 'Bulletin validé.'), 'Valider')}>Valider</button> : null}
                  {s.status === 'validated' ? <button className="link" type="button" onClick={() => pay(s)}>Payer</button> : null}
                  {s.status !== 'draft' && !s.budgetEntryId ? <button className="link" type="button" onClick={() => act('/payroll/slips/' + s.id + '/budget', 'Ajouté au budget (Salaires).')}>Enregistrer au budget</button> : null}
                  {s.budgetEntryId ? <small className="muted">Au budget</small> : null}
                  {s.status === 'draft' ? <button className="link" type="button" onClick={() => confirm('Supprimer ce brouillon ?', () => { oapi('DELETE', '/payroll/slips/' + s.id).then(load).catch(fail); })}>Supprimer</button> : null}
                </span>
              </div>
            ))}
            {j.missing.length ? <p className="muted small">{'Sans bulletin ce mois-ci : ' + j.missing.map((m) => m.name + (m.salary ? '' : ' (salaire non renseigné dans RH)')).join(', ') + '.'}</p> : null}
          </div>
          <p className="muted small">L'IA aide à préparer et contrôler la paie ; elle ne donne pas de conseil juridique définitif. « Enregistrer au budget » ajoute une sortie « Salaires » égale au coût total employeur.</p>
        </>
      ) : null}
    </>
  );
}
