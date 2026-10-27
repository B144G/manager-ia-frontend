import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, Loading, useLoad } from '../../ui.jsx';
import { BTN, DownloadBtn, INP, PrintFrame, TAP, WorkNotice, monthLabel } from '../finance/util.jsx';

/* Paie Cameroun : modèle chiffré et versionné (CNPS, IRPP, CAC, CFC, FNE), surcharges, vérification par un expert, simulation,
   solde de tout compte, états CSV et fichier de virement. TOUT est un document de travail : les taux ne sont jamais présentés comme officiels. */

const CONF = { high: ['good', 'Confiance élevée'], medium: ['mid', 'Confiance moyenne'], low: ['bad', 'Confiance faible : à confirmer'] };
const GROUPS = [['cnps', 'CNPS (cotisations sociales)'], ['irpp', 'IRPP (impôt sur les salaires)'], ['taxes', 'CAC, CFC et FNE'], ['rules', 'Conventions de calcul']];

/** Bandeau permanent : le barème n'est jamais présenté comme officiel. */
export function CmWarning() {
  const t = useT();
  return (
    <WorkNotice>
      <b>{t('Barème à faire valider par un expert-comptable ou le CNPS/DGI avant usage officiel.')}</b>
      {' ' + t("Ces taux sont un point de départ chiffré d'après la connaissance de l'auteur du logiciel : ils ne sont pas présentés comme officiels et peuvent être dépassés.")}
    </WorkNotice>
  );
}

function ParamEditor({ p, close, done }) {
  const t = useT();
  const { oapi } = useWs();
  return (
    <Form
      submitText={t('Enregistrer')}
      fields={[{ k: 'v', label: p.unit ? t('Valeur ({unit})', { unit: p.unit }) : t('Valeur'), value: p.override === null ? '' : String(p.override), hint: t('Laissez vide pour revenir à la valeur du modèle ({value}).', { value: p.default === null ? t('vide') : p.default }) }]}
      onSubmit={(v) => oapi('PUT', '/payroll/cm/overrides', { overrides: { [p.key]: v.v === '' ? null : v.v } }).then(() => { close(); done(); })}
    />
  );
}

function Simulator() {
  const t = useT();
  const { oapi, money } = useWs();
  const [r, setR] = useState(null);
  return (
    <>
      <Form
        submitText={t('Calculer')}
        fields={[
          { k: 'base', label: t('Salaire de base mensuel'), required: true, placeholder: '300000' },
          { k: 'bonuses', label: t('Primes et indemnités imposables'), value: '' },
          { k: 'absenceDeduction', label: t('Retenue pour absences non payées'), value: '' },
        ]}
        onSubmit={(v) => oapi('POST', '/payroll/cm/simulate', { base: v.base, bonuses: v.bonuses, absenceDeduction: v.absenceDeduction }).then(setR)}
      />
      {r ? (
        <div style={{ marginTop: 12 }}>
          <div className="line"><span><b>{t('Salaire brut après absences')}</b></span><b>{money(r.gross)}</b></div>
          {r.lines.map((l) => (
            <div className="line" key={l.code}><span>{t(l.label)}{l.todo ? <>{' '}<span className="pill bad">{t('à compléter')}</span></> : null}<br /><small className="muted">{(l.kind === 'employee' ? t('Salarié') : t('Employeur')) + ' · ' + t('base {basis}, {rate} %', { basis: money(l.basis), rate: l.rate })}</small></span><b>{money(l.amount)}</b></div>
          ))}
          <div className="line"><span><b>{t('Net à payer')}</b></span><b>{money(r.net)}</b></div>
          <div className="line"><span><b>{t('Coût total employeur')}</b></span><b>{money(r.employerCost)}</b></div>
          <p className="muted small">{t("Détail de l'IRPP : base annuelle {base}, impôt annuel {year}.", { base: money(r.detail.taxableAnnual), year: money(r.detail.irppYear) })}</p>
          <CmWarning />
        </div>
      ) : null}
    </>
  );
}

/** Onglet « Cameroun » : modèle, surcharges, vérification, simulation. */
export function CmTab({ onChanged }) {
  const t = useT();
  const { oapi, modal, toast, fail, dateFr, today, confirm } = useWs();
  const st = useLoad(() => oapi('GET', '/payroll/cm/model'), []);
  const reload = () => { st.reload(); if (onChanged) onChanged(); };
  const toggle = (on) => (on ? oapi('POST', '/payroll/cm/activate', {}).then(() => { toast(t('Modèle Cameroun activé pour les prochains calculs de bulletins.')); reload(); }).catch(fail)
    : confirm(t('Revenir au calcul par rubriques (les bulletins déjà calculés ne changent pas) ?'), () => { oapi('POST', '/payroll/cm/deactivate', {}).then(() => { toast(t('Modèle Cameroun désactivé.')); reload(); }).catch(fail); }));
  const verify = () => modal(t('Consigner la vérification du barème'), (close) => (
    <Form
      submitText={t('Enregistrer')}
      fields={[
        { k: 'by', label: t('Vérifié par (expert-comptable, CNPS, DGI…)'), required: true },
        { k: 'date', label: t('Barème à jour au'), type: 'date', value: today(), required: true },
        { k: 'note', label: t('Remarque'), hint: t("N'indiquez une date que si le barème a réellement été confronté aux textes en vigueur.") },
      ]}
      onSubmit={(v) => oapi('PUT', '/payroll/cm/validation', v).then(() => { close(); reload(); })}
    />
  ));
  return (
    <Loaded state={st}>
      {(j) => (
        <>
          <CmWarning />
          <div className="ws-card">
            <h2>{t('Modèle de paie Cameroun')}</h2>
            <p className="small">{t('Version {version}, encodée le {date}.', { version: j.version, date: dateFr(j.asOf) })}{' '}
              {j.validation.ratesAsOf ? <span className="pill good">{t('Vérifié par {by}, à jour au {date}', { by: j.validation.by || '?', date: dateFr(j.validation.ratesAsOf) })}</span> : <span className="pill bad">{t('Non vérifié : aucune date « à jour au »')}</span>}</p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {j.engine === 'cm' ? <span className="pill good">{t('Actif pour les nouveaux bulletins')}</span> : <span className="pill mid">{t('Inactif')}</span>}
              <button className="btn primary small" type="button" style={BTN} onClick={() => toggle(j.engine !== 'cm')}>{j.engine === 'cm' ? t('Désactiver') : t('Activer pour les bulletins')}</button>
              <button className="btn small" type="button" style={BTN} onClick={verify}>{t('Consigner la vérification')}</button>
              <button className="btn small" type="button" style={BTN} onClick={() => modal(t('Simuler un bulletin'), () => <Simulator />, { wide: true })}>{t('Simuler un bulletin')}</button>
            </div>
            {j.missing.length ? <p className="small late" role="alert">{t('{n} taux à renseigner avant de se fier aux calculs (les rubriques concernées valent 0).', { n: j.missing.length })}</p> : null}
            <p className="muted small">{t("Les absences « sans solde » approuvées dans les RH sont déduites automatiquement des brouillons de bulletin.")}</p>
          </div>
          {GROUPS.map(([g, title]) => (
            <div className="ws-card" key={g}>
              <h2>{t(title)}</h2>
              {j.params.filter((p) => p.group === g).map((p) => (
                <div className="line" key={p.key} style={{ flexWrap: 'wrap' }}>
                  <span style={{ flex: '1 1 260px' }}>
                    <b>{t(p.label)}</b>{' '}<span className={'pill ' + CONF[p.confidence][0]}>{t(CONF[p.confidence][1])}</span>
                    <br /><small className="muted">{t('Source supposée :') + ' ' + t(p.source)}</small>
                    {p.note ? <><br /><small className="muted">{t(p.note)}</small></> : null}
                  </span>
                  <span className="row" style={{ flexWrap: 'wrap' }}>
                    <b>{p.value === null ? t('à renseigner') : p.value + (p.unit ? ' ' + p.unit : '')}</b>
                    {p.overridden ? <small className="muted">{t('(modifié ; modèle : {value})', { value: p.default === null ? t('vide') : p.default })}</small> : null}
                    <button className="link" type="button" style={TAP} onClick={() => modal(t(p.label), (close) => <ParamEditor p={p} close={close} done={reload} />)}>{t('Modifier')}</button>
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="ws-card">
            <h2>{t('Ce que ce modèle ne calcule pas')}</h2>
            {j.notModeled.map((x) => <p className="small" key={x}>{'• ' + t(x)}</p>)}
          </div>
        </>
      )}
    </Loaded>
  );
}

/** Onglet « Déclarations » : états CSV du mois et fichier de virement en masse. */
export function ExportsTab({ month }) {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/payroll/cm/transfers?month=' + month), [month]);
  return (
    <>
      <CmWarning />
      <div className="ws-card">
        <h2>{t('États déclaratifs de {month}', { month: monthLabel(month) })}</h2>
        <p className="muted small">{t("Fichiers de travail pour préparer vos déclarations : ils ne remplacent pas les formulaires officiels du CNPS et de la DGI.")}</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <DownloadBtn path={'/payroll/cm/export/cnps.csv?month=' + month} name={'recapitulatif-cnps-' + month + '.csv'}>{t('Récapitulatif CNPS (CSV)')}</DownloadBtn>
          <DownloadBtn path={'/payroll/cm/export/irpp.csv?month=' + month} name={'etat-irpp-' + month + '.csv'}>{t('État des retenues IRPP (CSV)')}</DownloadBtn>
        </div>
      </div>
      <div className="ws-card">
        <h2>{t('Virements en masse')}</h2>
        <p className="muted small">{t('Bulletins validés ou payés dont le net est positif. Le compte ou le numéro se saisit sur la fiche employé (RH).')}</p>
        {st.loading && !st.data ? <Loading /> : null}
        {st.data ? (
          <>
            {!st.data.rows.length ? <Empty text={t('Aucun virement prêt : validez des bulletins et renseignez le compte des employés.')} /> : null}
            {st.data.rows.map((r) => <div className="line" key={r.slipId}><span>{r.employee}<br /><small className="muted">{(r.channel === 'bank' ? t('Banque') : t('Mobile Money')) + ' · ' + r.account}</small></span><b>{money(r.amount)}</b></div>)}
            {st.data.rows.length ? <div className="line"><span><b>{t('Total à virer')}</b></span><b>{money(st.data.total)}</b></div> : null}
            {st.data.missing.length ? <p className="small late">{t('Sans compte ou canal de paiement : {names}.', { names: st.data.missing.map((m) => m.employee).join(', ') })}</p> : null}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <DownloadBtn path={'/payroll/cm/export/transfers.csv?month=' + month + '&channel=bank'} name={'virements-banque-' + month + '.csv'}>{t('Fichier banque (CSV)')}</DownloadBtn>
              <DownloadBtn path={'/payroll/cm/export/transfers.csv?month=' + month + '&channel=mobile'} name={'virements-mobile-money-' + month + '.csv'}>{t('Fichier Mobile Money (CSV)')}</DownloadBtn>
            </div>
            <p className="muted small">{t("Adaptez les colonnes au format exigé par votre banque ou votre opérateur avant de l'envoyer.")}</p>
          </>
        ) : null}
      </div>
    </>
  );
}

/** Libellé d'une ligne du solde : reconstruit ici à partir des données (traduisible), pas du texte français du serveur. */
function lineLabel(t, l) {
  const m = l.meta || {};
  if (l.code === 'salary') return m.slipId ? t('Salaire de {month} : déjà couvert par le bulletin #{id}', { month: m.month, id: m.slipId }) : t('Salaire de {month} au prorata ({days}/{divisor} jours)', { month: m.month, days: m.days, divisor: m.divisor });
  if (l.code === 'leave') return t('Congés payés non pris : {days} jour(s)', { days: m.days }) + ' ' + (m.given ? t('(saisi)') : t('(acquis {accrued} - pris {taken})', { accrued: m.accrued, taken: m.taken }));
  if (l.code === 'notice') return t('Indemnité de préavis (saisie)');
  if (l.code === 'severance') return t('Indemnité de licenciement (saisie)');
  return l.label;
}

function SettlementDoc({ s }) {
  const t = useT();
  const { money, dateFr, info } = useWs();
  return (
    <PrintFrame title={t('Solde de tout compte')} height="65vh">
      <h1>{t('Solde de tout compte : document de travail')}</h1>
      <p className="muted">{info.org.name}</p>
      <p><b>{s.employee}</b>{' · ' + t('sortie le {date}', { date: dateFr(s.exitDate) })}{s.reason ? ' · ' + s.reason : ''}</p>
      <table>
        <thead><tr><th>{t('Désignation')}</th><th className="r">{t('Montant')}</th></tr></thead>
        <tbody>
          {s.lines.map((l) => <tr key={l.code}><td>{lineLabel(t, l)}</td><td className="r">{money(l.amount)}</td></tr>)}
          {s.deductions ? <tr><td>{t('Retenues et avances à déduire')}</td><td className="r">{'− ' + money(s.deductions)}</td></tr> : null}
          <tr className="tot"><td>{t('Total dû à la sortie')}</td><td className="r">{money(s.total)}</td></tr>
        </tbody>
      </table>
      {s.warnings.map((w, i) => <p className="note" key={i}>{t(w)}</p>)}
    </PrintFrame>
  );
}

/** Onglet « Solde de tout compte ». */
export function SettlementsTab() {
  const t = useT();
  const { oapi, modal, money, dateFr, today, confirm, fail } = useWs();
  const st = useLoad(() => Promise.all([oapi('GET', '/payroll/cm/settlements'), oapi('GET', '/hr')]), []);
  const create = (emps) => modal(t('Préparer un solde de tout compte'), (close) => (
    <Form
      submitText={t('Calculer et enregistrer le brouillon')}
      fields={[
        { k: 'employeeId', label: t('Employé'), type: 'select', options: emps.map((e) => [String(e.id), e.name]) },
        { k: 'exitDate', label: t('Date de sortie'), type: 'date', value: today(), required: true },
        { k: 'reason', label: t('Motif (démission, fin de contrat…)') },
        { k: 'unusedLeaveDays', label: t('Jours de congé non pris (laissez vide pour les calculer)'), value: '' },
        { k: 'noticeIndemnity', label: t('Indemnité de préavis (à saisir)'), value: '', hint: t('Non calculée : elle dépend de la convention collective et du contrat.') },
        { k: 'severance', label: t('Indemnité de licenciement (à saisir)'), value: '' },
        { k: 'otherDue', label: t('Autre somme due'), value: '' },
        { k: 'deductions', label: t('Avances et retenues à déduire'), value: '' },
      ]}
      onSubmit={(v) => oapi('POST', '/payroll/cm/settlements', v).then((r) => { close(); st.reload(); modal(t('Solde de tout compte'), () => <SettlementDoc s={r} />, { wide: true }); })}
    />
  ));
  return (
    <Loaded state={st}>
      {([a, hr]) => (
        <>
          <CmWarning />
          <div className="ws-card">
            <div className="row"><h2 className="grow">{t('Soldes de tout compte (documents de travail)')}</h2><button className="btn primary small" type="button" style={BTN} onClick={() => create(hr.employees)}>{t('Préparer un solde')}</button></div>
            {!a.settlements.length ? <Empty text={t('Aucun solde préparé.')} /> : null}
            {a.settlements.map((s) => (
              <div className="line" key={s.id}>
                <span><b>{s.employee}</b><br /><small className="muted">{t('sortie le {date}', { date: dateFr(s.exitDate) })}</small></span>
                <span className="row"><b>{money(s.total)}</b>
                  <button className="link" type="button" style={TAP} onClick={() => modal(t('Solde de tout compte'), () => <SettlementDoc s={s} />, { wide: true })}>{t('Voir / imprimer')}</button>
                  <button className="link" type="button" style={TAP} onClick={() => confirm(t('Supprimer ce brouillon ?'), () => { oapi('DELETE', '/payroll/cm/settlements/' + s.id).then(st.reload).catch(fail); })}>{t('Supprimer')}</button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Loaded>
  );
}

export { INP };
