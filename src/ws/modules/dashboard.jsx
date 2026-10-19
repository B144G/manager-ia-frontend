/* Sous-application : Tableau de bord. Données réelles : alertes et score de santé calculés par le serveur, budget (responsables et plus),
   projets, tâches et demandes de validation. Utilise l'état global `dash` (mis à jour par l'espace de travail, comme les pastilles du menu). */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Icon, Loading } from '../ui.jsx';
import { HealthRing, flowChart } from '../parts/dashboard/Charts.jsx';
import { JOURS, MOIS, ago, when } from '../parts/dashboard/helpers.js';

function delta(cur, prev, label) {
  if (!prev) return { text: label, cls: '' };
  const pct = Math.round(100 * (cur - prev) / Math.abs(prev));
  return { text: (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + ' % ' + label, cls: pct >= 0 ? 'up' : 'down' };
}

function Kpi({ title, value, sub, color, onClick }) {
  return (
    <button type="button" className={'kpi ' + color} onClick={onClick}>
      <small>{title}</small><b>{value}</b><span className={'sub ' + (sub.cls || '')}>{sub.text}</span>
    </button>
  );
}

function DecisionForm({ close, done }) {
  const { oapi, info, toast } = useWs();
  return (
    <>
      <p className="muted small">Soumettez une dépense, une embauche ou toute décision qui demande l'accord d'un responsable.</p>
      <Form
        fields={[
          { k: 'title', label: 'Que voulez-vous faire valider ?', required: true, placeholder: 'Ex : acheter 20 mètres de tissu' },
          { k: 'amount', label: 'Montant (' + info.org.currency + ', facultatif)' },
          { k: 'detail', label: 'Précisions', type: 'textarea', rows: 3 },
        ]}
        submitText="Envoyer pour validation"
        onSubmit={(v) => oapi('POST', '/decisions', { title: v.title, amount: v.amount || null, detail: v.detail }).then(() => { close(); toast('Demande envoyée.'); done(); })}
      />
    </>
  );
}

export default function Dashboard() {
  const { dash: j, orgId, info, money, dateFr, today, firstName, askAI, oapi, modal, toast, fail, refreshBadges } = useWs();
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const go = (mod) => navigate(`/app/${orgId}/${mod}`);

  const decide = (d, status) => {
    oapi('PUT', '/decisions/' + d.id, { status }).then(() => { toast(status === 'approved' ? 'Décision validée.' : 'Décision refusée.'); refreshBadges(); }).catch(fail);
  };
  const newDecision = () => modal('Nouvelle demande de validation', (close) => <DecisionForm close={close} done={refreshBadges} />);

  const head = (
    <div className="dh">
      <h1>{'Bonjour ' + firstName()}</h1>
      <p className="muted">{'Voici l\'état de votre entreprise ce ' + JOURS[now.getDay()] + ' ' + now.getDate() + ' ' + MOIS[now.getMonth()] + ' ' + now.getFullYear() + '.'}</p>
    </div>
  );
  if (!j) return <>{head}<div><Loading /></div></>;

  const s = j.stats;
  const hl = j.health;
  const al = j.alerts;
  const hasMoney = !!s.budget;
  const important = al.filter((a) => a.level !== 'info');
  const tone = hl.score >= 80 ? 'good' : hl.score >= 60 ? 'mid' : 'bad';

  const sr = j.series || [];
  const cur = sr[sr.length - 1] || { income: 0, expense: 0 };
  const prev = sr[sr.length - 2] || { income: 0, expense: 0 };
  const pm = prev.month ? MOIS[Number(prev.month.slice(5)) - 1] : '';

  const alertsCard = (
    <section className="dc">
      <div className="ch"><h2>Alertes de MANAGER-IA</h2><button className="link" type="button" onClick={() => go('alerts')}>Voir tout</button></div>
      {!al.length ? <Empty text="Aucune alerte : tout va bien." /> : null}
      {al.slice(0, 4).map((a, i) => (
        <button type="button" className={'al ' + a.level} key={i + ':' + a.title} onClick={() => go(a.module)}>
          <b>{a.title}</b><em>{ago(a.at, dateFr)}</em><span>{a.text}</span>
        </button>
      ))}
    </section>
  );

  const chart = j.series ? flowChart(j.series) : null;

  return (
    <>
      {head}
      <div>
        <div className="g2">
          <section className="brief">
            <div className="brief-h"><Icon name="ai" /><b>Point de situation de MANAGER-IA</b><small>{"Aujourd'hui, " + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></div>
            <ul className="prio">
              {!important.length ? <li className="ok">Aucune alerte importante : tout est sous contrôle.</li> : null}
              {important.slice(0, 3).map((a, i) => <li className={a.level} key={i + ':' + a.title}>{a.title + ' : ' + a.text}</li>)}
            </ul>
            <div className="row">
              <button className="bt white" type="button" onClick={() => go('alerts')}>Voir le détail</button>
              <button className="bt ghost" type="button" onClick={() => askAI('Fais le point sur mon organisation et dis-moi quoi faire en premier.')}>Poser une question</button>
            </div>
          </section>
          <section className="dc health">
            <h2>Santé de l'entreprise</h2>
            <div className="hrow">
              <div className="ringbox"><HealthRing score={hl.score} /><div className="rv"><b>{String(hl.score)}</b><small>sur 100</small></div></div>
              <div className="hside"><span className={'pill ' + tone}>{hl.label}</span><p className="muted">{hl.summary}</p></div>
            </div>
          </section>
        </div>

        <div className="kpis4">
          {hasMoney ? (
            <>
              <Kpi title="Chiffre d'affaires du mois" value={money(s.budget.income)} sub={delta(cur.income, prev.income, 'vs ' + pm)} color="blue" onClick={() => go('budget')} />
              <Kpi title="Solde de trésorerie" value={money(s.budget.balance)} sub={delta(cur.income - cur.expense, prev.income - prev.expense, 'vs ' + pm)} color="green" onClick={() => go('budget')} />
            </>
          ) : (
            <>
              <Kpi title="Projets en cours" value={String(s.projects.active)} sub={{ text: 'visibles par vous', cls: '' }} color="blue" onClick={() => go('projects')} />
              <Kpi title="Mes tâches ouvertes" value={String(s.tasks.mine)} sub={{ text: 'assignées à vous', cls: '' }} color="green" onClick={() => go('projects')} />
            </>
          )}
          <Kpi title="Demandes clients à traiter" value={String(s.tickets.open)} sub={{ text: s.tickets.urgent ? 'dont ' + s.tickets.urgent + ' urgente' + (s.tickets.urgent > 1 ? 's' : '') : 'aucune urgente', cls: s.tickets.urgent ? 'down' : 'up' }} color="red" onClick={() => go('support')} />
          <Kpi title="Tâches en retard" value={String(s.tasks.overdue)} sub={{ text: 'sur ' + s.tasks.todo + ' tâche' + (s.tasks.todo > 1 ? 's' : '') + ' ouverte' + (s.tasks.todo > 1 ? 's' : ''), cls: s.tasks.overdue ? 'warn' : 'up' }} color="amber" onClick={() => go('projects')} />
        </div>

        {chart ? (
          <div className="g3">
            <section className="dc">
              <div className="ch"><h2>Entrées et sorties</h2><small className="muted">{'6 derniers mois, en ' + (chart.unit === 1000000 ? 'millions' : 'milliers') + ' de ' + info.org.currency}</small></div>
              <div className="legend"><i className="li" />Entrées<i className="lo" />Sorties</div>
              {chart.svg}
            </section>
            {alertsCard}
          </div>
        ) : alertsCard}

        <div className="g4">
          <section className="dc">
            <div className="ch"><h2>Décisions à prendre</h2><small className="muted">{j.decisions.length + ' en attente'}</small></div>
            {!j.decisions.length ? <Empty text={j.canDecide ? 'Aucune décision en attente.' : "Vous n'avez aucune demande en attente."} /> : null}
            {j.decisions.map((d) => (
              <div className="dec" key={d.id}>
                <div className="dt"><b>{d.title}</b><small>{(d.amount ? money(d.amount) + ' · ' : '') + (d.detail || ('demandé par ' + (d.requester || 'un membre')))}</small></div>
                {j.canDecide ? (
                  <div className="row nowrap">
                    <button className="dv" type="button" onClick={() => decide(d, 'approved')}>Valider</button>
                    <button className="dr" type="button" onClick={() => decide(d, 'rejected')}>Refuser</button>
                  </div>
                ) : <span className="pill mid">En attente</span>}
              </div>
            ))}
            <button className="link soft" type="button" onClick={newDecision}>+ Soumettre une demande de validation</button>
          </section>

          <section className="dc">
            <div className="ch"><h2>Projets en cours</h2></div>
            {!j.projects.length ? <Empty text="Aucun projet en cours." /> : null}
            {j.projects.slice(0, 3).map((p) => {
              const col = p.percent >= 80 ? 'ok' : p.percent < 50 ? 'amber' : 'blue';
              return (
                <div className="pr" key={p.id}>
                  <div className="line"><span>{p.name}</span><b>{p.percent + ' %'}</b></div>
                  <div className={'meter ' + col}><i style={{ width: p.percent + '%' }} /></div>
                </div>
              );
            })}
          </section>

          <section className="dc">
            <div className="ch"><h2>Mes tâches</h2></div>
            {!j.myTasks.length ? <Empty text="Aucune tâche ne vous est assignée." /> : null}
            {j.myTasks.slice(0, 3).map((t, i) => {
              const n = t.due ? Math.round((new Date(t.due + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000) : 9;
              const tone2 = n <= 0 ? 'red' : n === 1 ? 'amber' : 'blue';
              return (
                <div className="tkl" key={t.id != null ? t.id : i}>
                  <span className={'box ' + tone2} />
                  <div><b>{t.title}</b><small className={tone2}>{t.due ? when(t.due, today(), dateFr) : 'sans date'}</small></div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </>
  );
}
