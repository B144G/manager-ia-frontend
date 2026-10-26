/* Sous-application : Ressources humaines (employés, congés à valider, planning de la semaine). */
import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../ui.jsx';
import { EmployeeForm, LeaveForm } from '../parts/hr/Forms.jsx';
import Leaves from '../parts/hr/Leaves.jsx';
import Plan from '../parts/hr/Plan.jsx';

export default function Hr() {
  const t = useT();
  const { oapi, can, money, dateFr, modal, confirm, fail } = useWs();
  const [tab, setTab] = useState('staff');
  const [week, setWeek] = useState(null);
  const [ver, setVer] = useState(0);
  const st = useLoad(() => oapi('GET', '/hr'), [tab, ver]);
  const load = () => setVer((v) => v + 1);

  const editEmp = (e) => modal(e && e.id ? t("Modifier l'employé") : t('Nouvel employé'), (close) => <EmployeeForm employee={e} close={close} done={load} />);
  const editLeave = () => modal(t('Demande de congé'), (close) => (
    <LeaveForm employees={st.data ? st.data.employees : []} close={close} done={() => { setTab('leaves'); load(); }} />
  ));
  const pending = st.data ? st.data.summary.pendingLeaves : 0;

  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Ressources humaines')}</h1><p className="muted">{t('Votre équipe, ses congés et son planning.')}</p></div>
        <div className="row">
          <button className="btn small" type="button" onClick={() => editLeave()}>{t('Demander un congé')}</button>
          <button className="btn primary small" type="button" onClick={() => editEmp()}>{t('Ajouter un employé')}</button>
        </div>
      </div>
      <div className="ws-tabs">
        {st.data ? [['staff', t('Employés')], ['leaves', t('Congés') + (pending ? ' (' + pending + ')' : '')], ['plan', t('Planning')]].map((x) => (
          <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} onClick={() => setTab(x[0])}>{x[1]}</button>
        )) : null}
      </div>
      <div>
        <Loaded state={st}>{(j) => {
          if (tab === 'leaves') return <Leaves ver={ver} load={load} />;
          if (tab === 'plan') return <Plan week={week} setWeek={setWeek} ver={ver} />;
          const s = j.summary;
          return (
            <>
              <div className="kpis">
                <div className="stat"><b>{String(s.active)}</b><span>{t('en poste')}</span></div>
                <div className="stat"><b>{String(s.onLeave)}</b><span>{t("en congé aujourd'hui")}</span></div>
                <div className={'stat' + (s.pendingLeaves ? ' bad' : '')}><b>{String(s.pendingLeaves)}</b><span>{t('demande(s) de congé')}</span></div>
                {s.payroll !== undefined
                  ? <div className="stat"><b>{money(s.payroll)}</b><span>{t('masse salariale / mois')}</span></div>
                  : <div className="stat"><b>{String(j.employees.length)}</b><span>{t('fiches')}</span></div>}
              </div>
              <div className="ws-card">
                <h2>{t('Employés')}</h2>
                {!j.employees.length ? <Empty text={t("Aucun employé. Ajoutez votre équipe pour faire un planning et suivre les congés.")} /> : null}
                {j.employees.map((e) => (
                  <div className="line" key={e.id}>
                    <span>
                      <b>{e.name}</b>{e.status === 'left' ? <span className="pill bad">{t('Parti')}</span> : null}
                      <small>{' ' + [e.job, e.phone, e.hiredAt ? t('depuis le {date}', { date: dateFr(e.hiredAt) }) : '', e.salary ? t('{amount}/mois', { amount: money(e.salary) }) : ''].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className="row">
                      <button className="link" type="button" onClick={() => editEmp(e)}>{t('Modifier')}</button>
                      {can('admin') ? <button className="link" type="button" onClick={() => confirm(t('Supprimer la fiche de {name} ? Ses congés et horaires seront aussi supprimés.', { name: e.name }), () => { oapi('DELETE', '/hr/employees/' + e.id).then(load).catch(fail); })}>{t('Supprimer')}</button> : null}
                    </span>
                  </div>
                ))}
              </div>
              <p className="muted small">{can('admin') ? t('Les salaires ne sont visibles que par les administrateurs et le propriétaire.') : t('Les salaires sont réservés aux administrateurs et au propriétaire.')}</p>
            </>
          );
        }}
        </Loaded>
      </div>
    </>
  );
}
