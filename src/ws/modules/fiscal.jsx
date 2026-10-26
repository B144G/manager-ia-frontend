import { useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import { Loading, useLoad } from '../ui.jsx';
import Calendar from '../parts/fiscal/Calendar.jsx';
import Liasse from '../parts/fiscal/Liasse.jsx';
import Vat from '../parts/fiscal/Vat.jsx';
import Exercises from '../parts/fiscal/Exercises.jsx';
import Classification from '../parts/fiscal/Classification.jsx';
import { BTN } from '../parts/finance/util.jsx';

/* Fiscalité et liasse : document de travail de fin d'exercice, calendrier fiscal paramétrable (échéances répétées), TVA du mois, exercices (clôture), classement des comptes.
   Réservé aux administrateurs. Ce n'est PAS une liasse officielle : à faire valider par un expert-comptable. */
const TABS = [['calendar', 'Calendrier'], ['liasse', 'Liasse de fin d\'exercice'], ['vat', 'TVA du mois'], ['exercises', 'Exercices'], ['classif', 'Classement']];

export default function Fiscal() {
  const t = useT();
  const { oapi, money } = useWs();
  const [tab, setTab] = useState('calendar');
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const st = useLoad(() => oapi('GET', '/fiscal?year=' + year), [year]);
  const k = st.data && st.data.kpi;
  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Fiscalité et liasse')}</h1><p className="muted">{t("Préparez votre fin d'exercice et suivez vos échéances. Réservé aux administrateurs.")}</p></div>
      </div>
      {st.loading && !k ? <Loading /> : null}
      {st.error ? <p className="ws-err" role="alert">{t(st.error.message)}</p> : null}
      {k ? (
        <div className="kpis">
          <div className="stat"><b className={k.resultat < 0 ? 'late' : ''}>{money(k.resultat)}</b><span>{t('résultat provisoire {year}', { year })}</span></div>
          <div className={'stat' + (k.toFix ? ' bad' : '')}><b>{k.toFix}</b><span>{t('anomalie(s) à corriger')}</span></div>
          <div className={'stat' + (k.late ? ' bad' : '')}><b>{k.late}</b><span>{t('échéance(s) en retard')}</span></div>
          <div className="stat"><b>{k.soon}</b><span>{t('échéance(s) sous 7 jours')}</span></div>
        </div>
      ) : null}
      <p className="ws-card small" role="note"><b>{t('Document de travail préparé par MANAGER-IA, à faire valider par un expert-comptable avant tout dépôt officiel.')}</b></p>
      <div className="ws-tabs" style={{ flexWrap: 'wrap', overflowX: 'visible' }}>
        {TABS.map((x) => <button key={x[0]} type="button" className={'tab' + (tab === x[0] ? ' on' : '')} style={BTN} onClick={() => setTab(x[0])}>{t(x[1])}</button>)}
      </div>
      {tab === 'calendar' ? <Calendar onChange={st.reload} /> : null}
      {tab === 'liasse' ? <Liasse year={year} setYear={setYear} /> : null}
      {tab === 'vat' ? <Vat /> : null}
      {tab === 'exercises' ? <Exercises onChange={st.reload} /> : null}
      {tab === 'classif' ? <Classification /> : null}
    </>
  );
}
