import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN, Crud, FilesBox, SettingsCard } from '../w3/common.jsx';
import { WorkNotice } from '../finance/util.jsx';

/* RH · vague 3 : soldes de congés et jours fériés, dossier du personnel, contrats, pointage, recrutement, évaluations, formations. */

const empOptions = (employees) => (employees || []).filter((e) => e.status !== 'left').map((e) => [String(e.id), e.name]);

export function Balances({ ver }) {
  const t = useT();
  const { oapi, can, dateFr, modal, toast, fail } = useWs();
  const [year] = useState(() => String(new Date().getFullYear()));
  const [v, setV] = useState(0);
  const st = useLoad(() => oapi('GET', '/hr/balances?year=' + year), [year, v, ver]);
  const hol = useLoad(() => oapi('GET', '/hr/holidays?year=' + year), [year, v]);
  const reload = () => setV((n) => n + 1);
  const adjust = (e) => modal(t('Ajuster le solde de {name}', { name: e.name }), (close) => (
    <Form
      fields={[{ k: 'days', label: t('Jours (positif ou négatif)'), required: true }, { k: 'note', label: t('Motif') }]}
      submitText={t('Enregistrer')}
      onSubmit={(f) => oapi('POST', '/hr/leave-adjustments', { employeeId: e.employeeId, year, days: f.days, note: f.note }).then(() => { close(); toast(t('Enregistré.')); reload(); })}
    />
  ));
  const editHol = (h) => modal(h ? t('Modifier') : t('Ajouter un jour férié'), (close) => (
    <Form
      fields={[{ k: 'date', label: t('Date'), type: 'date', required: true, value: h ? h.date : '' }, { k: 'name', label: t('Nom'), required: true, value: h ? h.name : '' }]}
      submitText={t('Enregistrer')}
      onSubmit={(f) => (h ? oapi('PUT', '/hr/holidays/' + h.id, f) : oapi('POST', '/hr/holidays', f)).then(() => { close(); reload(); })}
    />
  ));
  return (
    <>
      <WorkNotice>{t('Repères de travail (jours ouvrables, lundi au samedi, hors jours fériés) : à faire valider selon votre convention collective.')}</WorkNotice>
      <div className="ws-card">
        <h2>{t('Soldes de congés {year}', { year })}</h2>
        <Loaded state={st}>{(j) => (
          <>
            <p className="muted small">{t('{rate} jour(s) acquis par mois, report maximal {max} jour(s).', { rate: j.accrualPerMonth, max: j.carryMax })}</p>
            {!j.items.length ? <Empty text={t('Aucun employé en poste.')} /> : null}
            {j.items.map((e) => (
              <div className="line" key={e.employeeId}>
                <span><b>{e.name}</b><br /><small className="muted">{t('acquis {a} · report {c} · ajustements {j} · pris {p} · en attente {w}', { a: e.accrued, c: e.carried, j: e.adjustments, p: e.taken, w: e.pending })}</small></span>
                <span className="row"><b>{t('{n} j', { n: e.available })}</b>{can('admin') ? <button className="link" type="button" style={BTN} onClick={() => adjust(e)}>{t('Ajuster')}</button> : null}</span>
              </div>
            ))}
          </>
        )}
        </Loaded>
      </div>
      <div className="ws-card">
        <div className="row"><h2 className="grow">{t('Jours fériés {year}', { year })}</h2>{can('admin') ? <button className="btn small" type="button" style={BTN} onClick={() => editHol(null)}>{t('Ajouter un jour férié')}</button> : null}</div>
        <Loaded state={hol}>{(j) => (
          <>
            <p className="muted small">{t('Jours fériés donnés en exemple, à vérifier et à compléter (fêtes musulmanes selon annonce officielle).')}</p>
            {j.items.map((h) => (
              <div className="line" key={h.id}>
                <span><b>{h.name}</b><span className="pill mid">{h.source === 'exemple' ? t('exemple à vérifier') : t('modifié')}</span><br /><small className="muted">{dateFr(h.date)}</small></span>
                {can('admin') ? <span className="row"><button className="link" type="button" style={BTN} onClick={() => editHol(h)}>{t('Modifier')}</button><button className="link" type="button" style={BTN} onClick={() => oapi('DELETE', '/hr/holidays/' + h.id).then(reload).catch(fail)}>{t('Supprimer')}</button></span> : null}
              </div>
            ))}
          </>
        )}
        </Loaded>
      </div>
      <SettingsCard path="/hr" canEdit={can('admin')} title={t('Règles de congé')} keys={[['leave_accrual', t('Jours acquis par mois'), t('1,5 jour ouvrable par mois par défaut')], ['leave_carry_max', t('Report maximal (jours)'), t('0 = aucun report')], ['alert_contract_days', t("Préavis des échéances RH (jours)"), t('Fin de contrat, essai, visite médicale, habilitation')]]} />
    </>
  );
}

export function Dossier({ employees }) {
  const t = useT();
  const { oapi, can, toast } = useWs();
  const [id, setId] = useState('');
  const [v, setV] = useState(0);
  if (!can('admin')) return <div className="ws-card"><Empty text={t('Le dossier du personnel est réservé aux administrateurs.')} /></div>;
  return (
    <div className="ws-card">
      <h2>{t('Dossier du personnel')}</h2>
      <p className="muted small">{t('Données personnelles : accès réservé aux administrateurs, chaque consultation et modification est journalisée.')}</p>
      <label className="fld"><span>{t('Employé')}</span>
        <select style={{ fontSize: 16 }} value={id} onChange={(e) => { setId(e.target.value); setV((n) => n + 1); }}><option value="">{t('Choisir…')}</option>{empOptions(employees).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
      </label>
      {id ? <Sheet key={id + ':' + v} id={id} oapi={oapi} toast={toast} /> : null}
    </div>
  );
}
function Sheet({ id, oapi, toast }) {
  const t = useT();
  const st = useLoad(() => oapi('GET', '/hr/employees/' + id + '/file'), [id]);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <Form
          fields={[
            { k: 'cniNo', label: t('N° de carte nationale d’identité'), value: j.file.cniNo }, { k: 'birthDate', label: t('Date de naissance'), type: 'date', value: j.file.birthDate || '' },
            { k: 'address', label: t('Adresse'), value: j.file.address }, { k: 'emergencyName', label: t("Contact d'urgence (nom)"), value: j.file.emergencyName }, { k: 'emergencyPhone', label: t("Contact d'urgence (téléphone)"), value: j.file.emergencyPhone },
            { k: 'diplomas', label: t('Diplômes'), type: 'textarea', rows: 2, value: j.file.diplomas }, { k: 'cnpsNo', label: t('Matricule CNPS'), value: j.file.cnpsNo },
          ]}
          submitText={t('Enregistrer le dossier')}
          onSubmit={(f) => oapi('PUT', '/hr/employees/' + id + '/file', f).then(() => toast(t('Enregistré.')))}
        />
        <h3>{t('Pièces (CNI, diplômes, contrat signé…)')}</h3>
        <FilesBox listPath={'/hr/employees/' + id + '/files'} filePath="/hr/employees/files" />
      </>
    )}
    </Loaded>
  );
}

const KIND = { cdi: 'CDI', cdd: 'CDD', stage: 'Stage', essai: 'Essai', prestation: 'Prestation' };
const DUE = { contract_end: 'Fin de contrat', trial_end: "Fin de période d'essai", medical: 'Visite médicale', certification: 'Habilitation' };

export function Contracts({ employees }) {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const due = useLoad(() => oapi('GET', '/hr/due'), []);
  return (
    <>
      <div className="ws-card">
        <h2>{t('Échéances à surveiller')}</h2>
        <Loaded state={due}>{(j) => (
          <>
            {!j.items.length ? <Empty text={t('Aucune échéance proche.')} /> : null}
            {j.items.map((d, i) => <div className="line" key={i}><span><b>{d.who}</b><span className={'pill ' + (d.expired ? 'bad' : 'mid')}>{t(DUE[d.kind])}</span></span><b>{dateFr(d.date)}</b></div>)}
          </>
        )}
        </Loaded>
      </div>
      <Crud path="/hr/contracts" title={t('Contrats de travail')} addLabel={t('Ajouter un contrat')} empty={t('Aucun contrat enregistré.')}
        fields={[{ k: 'employeeId', label: t('Employé'), type: 'select', options: empOptions(employees), required: true }, { k: 'kind', label: t('Type'), type: 'select', options: Object.keys(KIND).map((k) => [k, KIND[k]]) },
          { k: 'startDate', label: t('Début'), type: 'date' }, { k: 'endDate', label: t('Fin (CDD, stage)'), type: 'date' }, { k: 'trialEnd', label: t("Fin de la période d'essai"), type: 'date' }, { k: 'medicalDue', label: t('Prochaine visite médicale'), type: 'date' }, { k: 'note', label: t('Note') }]}
        row={(c) => ({ main: c.employee + ' · ' + KIND[c.kind], sub: [c.startDate ? t('du {d}', { d: dateFr(c.startDate) }) : '', c.endDate ? t('au {d}', { d: dateFr(c.endDate) }) : '', c.trialEnd ? t('essai jusqu’au {d}', { d: dateFr(c.trialEnd) }) : '', c.medicalDue ? t('visite médicale {d}', { d: dateFr(c.medicalDue) }) : ''].filter(Boolean).join(' · ') })} />
    </>
  );
}

const ATT = { present: 'Présent', late: 'En retard', absent: 'Absent', justified: 'Absence justifiée' };
export function Attendance({ employees }) {
  const t = useT();
  const { oapi, dateFr, today } = useWs();
  const month = today().slice(0, 7);
  const sum = useLoad(() => oapi('GET', '/hr/attendance-summary?month=' + month), [month]);
  return (
    <>
      <div className="ws-card">
        <h2>{t('Synthèse du mois')}</h2>
        <Loaded state={sum}>{(j) => (
          <>
            {!j.items.length ? <Empty text={t('Aucun pointage ce mois-ci.')} /> : null}
            {j.items.map((e) => <div className="line" key={e.employeeId}><b>{e.name}</b><span>{t('{p} présent(s) · {l} retard(s) ({m} min) · {a} absence(s)', { p: e.present, l: e.late, m: e.minutesLate, a: e.absent })}</span></div>)}
          </>
        )}
        </Loaded>
      </div>
      <Crud path="/hr/attendance" title={t('Pointage')} addLabel={t('Pointer')} empty={t('Aucun pointage.')}
        fields={[{ k: 'employeeId', label: t('Employé'), type: 'select', options: empOptions(employees), required: true }, { k: 'day', label: t('Jour'), type: 'date', required: true, def: today() },
          { k: 'status', label: t('Statut'), type: 'select', options: Object.keys(ATT).map((k) => [k, t(ATT[k])]) }, { k: 'minutesLate', label: t('Minutes de retard'), type: 'number' }, { k: 'note', label: t('Note') }]}
        row={(a) => ({ main: a.employee + ' · ' + dateFr(a.day), sub: a.minutesLate ? t('{m} min de retard', { m: a.minutesLate }) : a.note, pill: [t(ATT[a.status]), a.status === 'present' ? '' : a.status === 'justified' ? 'mid' : 'bad'] })} />
    </>
  );
}

const STAGES = { new: 'Nouveau', screening: 'Présélection', interview: 'Entretien', offer: 'Offre', hired: 'Embauché', rejected: 'Refusé' };
export function Recruit() {
  const t = useT();
  const { oapi, can, toast, fail } = useWs();
  const jobs = useLoad(() => oapi('GET', '/hr/jobs'), []);
  const opts = jobs.data ? jobs.data.items.map((j) => [String(j.id), j.title]) : [];
  return (
    <>
      <Crud path="/hr/jobs" title={t('Offres d’emploi')} addLabel={t('Nouvelle offre')} empty={t('Aucune offre.')}
        fields={[{ k: 'title', label: t('Intitulé du poste'), required: true }, { k: 'description', label: t('Description'), type: 'textarea', rows: 3 }, { k: 'status', label: t('Statut'), type: 'select', options: [['open', t('Ouverte')], ['closed', t('Fermée')]] }]}
        row={(j) => ({ main: j.title, sub: t('{n} candidat(s)', { n: j.candidates }), pill: [j.status === 'open' ? t('Ouverte') : t('Fermée'), j.status === 'open' ? '' : 'mid'] })} />
      {opts.length ? (
        <Crud path="/hr/candidates" title={t('Candidats')} addLabel={t('Ajouter un candidat')} empty={t('Aucun candidat.')}
          fields={[{ k: 'jobId', label: t('Offre'), type: 'select', options: opts, required: true }, { k: 'name', label: t('Nom'), required: true }, { k: 'phone', label: t('Téléphone') }, { k: 'email', label: t('E-mail') },
            { k: 'stage', label: t('Étape'), type: 'select', options: Object.keys(STAGES).map((k) => [k, t(STAGES[k])]) }, { k: 'note', label: t('Note'), type: 'textarea', rows: 2 }]}
          row={(c) => ({ main: c.name, sub: [c.phone, c.email].filter(Boolean).join(' · '), pill: [t(STAGES[c.stage]), c.stage === 'rejected' ? 'bad' : c.stage === 'hired' ? '' : 'mid'] })}
          extraRow={(c, reload) => (can('admin') && c.stage !== 'hired' ? <button className="link" type="button" style={BTN} onClick={() => oapi('POST', '/hr/candidates/' + c.id + '/hire', {}).then(() => { toast(t('Employé créé.')); reload(); }).catch(fail)}>{t('Embaucher')}</button> : null)} />
      ) : null}
    </>
  );
}

export function Reviews({ employees }) {
  const t = useT();
  const { dateFr } = useWs();
  return (
    <>
      <Crud path="/hr/reviews" title={t('Évaluations')} addLabel={t('Nouvelle évaluation')} empty={t('Aucune évaluation.')}
        fields={[{ k: 'employeeId', label: t('Employé'), type: 'select', options: empOptions(employees), required: true }, { k: 'period', label: t('Période'), required: true, placeholder: t('Ex : 2026 S1') }, { k: 'score', label: t('Note de 1 à 5'), type: 'number', def: 3 },
          { k: 'strengths', label: t('Points forts'), type: 'textarea', rows: 2 }, { k: 'goals', label: t('Objectifs'), type: 'textarea', rows: 2 }]}
        row={(r) => ({ main: r.employee + ' · ' + r.period, sub: [r.strengths, r.goals && t('Objectifs : {g}', { g: r.goals })].filter(Boolean).join(' · '), pill: [r.score + ' / 5', r.score <= 2 ? 'bad' : ''] })} />
      <Crud path="/hr/trainings" title={t('Formations et habilitations')} addLabel={t('Ajouter une formation')} empty={t('Aucune formation.')}
        fields={[{ k: 'employeeId', label: t('Employé'), type: 'select', options: empOptions(employees), required: true }, { k: 'title', label: t('Formation ou habilitation'), required: true }, { k: 'kind', label: t('Type'), type: 'select', options: [['training', t('Formation')], ['certification', t('Habilitation')]] },
          { k: 'doneAt', label: t('Date'), type: 'date' }, { k: 'expiresAt', label: t("Date d'expiration"), type: 'date' }, { k: 'provider', label: t('Organisme') }]}
        row={(r) => ({ main: r.employee + ' · ' + r.title, sub: [r.doneAt && dateFr(r.doneAt), r.provider].filter(Boolean).join(' · '), pill: r.expiresAt ? [t("expire le {d}", { d: dateFr(r.expiresAt) }), r.expiresAt < new Date().toISOString().slice(0, 10) ? 'bad' : 'mid'] : null })} />
    </>
  );
}
