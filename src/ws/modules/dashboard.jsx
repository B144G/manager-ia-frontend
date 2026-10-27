/* Sous-application : Tableau de bord. Données réelles : alertes et score de santé calculés par le serveur, budget (responsables et plus),
   projets, tâches et demandes de validation. Utilise l'état global `dash` (mis à jour par l'espace de travail, comme les pastilles du menu). */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocale, useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Icon, Loading } from '../ui.jsx';
import { HealthRing, flowChart } from '../parts/dashboard/Charts.jsx';
import { monthName, ago, when } from '../parts/dashboard/helpers.js';
import { Circuit, Kpis, Notices } from '../parts/dashboard/Wave3.jsx';

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
  const t = useT();
  return (
    <>
      <p className="muted small">{t("Soumettez une dépense, une embauche ou toute décision qui demande l'accord d'un responsable.")}</p>
      <Form
        fields={[
          { k: 'title', label: t('Que voulez-vous faire valider ?'), required: true, placeholder: t('Ex : acheter 20 mètres de tissu') },
          { k: 'amount', label: t('Montant ({currency}, facultatif)', { currency: info.org.currency }) },
          { k: 'detail', label: t('Précisions'), type: 'textarea', rows: 3 },
        ]}
        submitText={t('Envoyer pour validation')}
        onSubmit={(v) => oapi('POST', '/decisions', { title: v.title, amount: v.amount || null, detail: v.detail }).then(() => { close(); toast(t('Demande envoyée.')); done(); })}
      />
    </>
  );
}

export default function Dashboard() {
  const { dash: j, orgId, info, money, dateFr, today, firstName, askAI, oapi, modal, toast, fail, refreshBadges } = useWs();
  const t = useT();
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const go = (mod) => navigate(`/app/${orgId}/${mod}`);

  const decide = (d, status) => {
    oapi('PUT', '/decisions/' + d.id, { status }).then(() => { toast(status === 'approved' ? t('Décision validée.') : t('Décision refusée.')); refreshBadges(); }).catch(fail);
  };
  const newDecision = () => modal(t('Nouvelle demande de validation'), (close) => <DecisionForm close={close} done={refreshBadges} />);

  const head = (
    <div className="dh">
      <h1>{t('Bonjour {name}', { name: firstName() })}</h1>
      <p className="muted">{t("Voici l'état de votre entreprise ce {date}.", { date: new Intl.DateTimeFormat(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now) })}</p>
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
  const pm = prev.month ? monthName(Number(prev.month.slice(5)) - 1) : '';

  const alertsCard = (
    <section className="dc">
      <div className="ch"><h2>{t('Alertes de MANAGER-IA')}</h2><button className="link" type="button" onClick={() => go('alerts')}>{t('Voir tout')}</button></div>
      {!al.length ? <Empty text={t('Aucune alerte : tout va bien.')} /> : null}
      {al.slice(0, 4).map((a, i) => (
        <button type="button" className={'al ' + a.level} key={i + ':' + a.title} onClick={() => go(a.module)}>
          <b>{tsrv(a.title)}</b><em>{ago(a.at, dateFr)}</em><span>{tsrv(a.text)}</span>
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
            <div className="brief-h"><Icon name="ai" /><b>{t('Point de situation de MANAGER-IA')}</b><small>{t("Aujourd'hui, {time}", { time: now.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })}</small></div>
            <ul className="prio">
              {!important.length ? <li className="ok">{t('Aucune alerte importante : tout est sous contrôle.')}</li> : null}
              {important.slice(0, 3).map((a, i) => <li className={a.level} key={i + ':' + a.title}>{tsrv(a.title) + ' : ' + tsrv(a.text)}</li>)}
            </ul>
            <div className="row">
              <button className="bt white" type="button" onClick={() => go('alerts')}>{t('Voir le détail')}</button>
              <button className="bt ghost" type="button" onClick={() => askAI(t('Fais le point sur mon organisation et dis-moi quoi faire en premier.'))}>{t('Poser une question')}</button>
            </div>
          </section>
          <section className="dc health">
            <h2>{t("Santé de l'entreprise")}</h2>
            <div className="hrow">
              <div className="ringbox"><HealthRing score={hl.score} /><div className="rv"><b>{String(hl.score)}</b><small>{t('sur 100')}</small></div></div>
              <div className="hside"><span className={'pill ' + tone}>{tsrv(hl.label)}</span><p className="muted">{tsrv(hl.summary)}</p></div>
            </div>
          </section>
        </div>

        <div className="kpis4">
          {hasMoney ? (
            <>
              <Kpi title={t("Chiffre d'affaires du mois")} value={money(s.budget.income)} sub={delta(cur.income, prev.income, t('vs {month}', { month: pm }))} color="blue" onClick={() => go('budget')} />
              <Kpi title={t("Solde de trésorerie")} value={money(s.budget.balance)} sub={delta(cur.income - cur.expense, prev.income - prev.expense, t('vs {month}', { month: pm }))} color="green" onClick={() => go('budget')} />
            </>
          ) : (
            <>
              <Kpi title={t("Projets en cours")} value={String(s.projects.active)} sub={{ text: t('visibles par vous'), cls: '' }} color="blue" onClick={() => go('projects')} />
              <Kpi title={t("Mes tâches ouvertes")} value={String(s.tasks.mine)} sub={{ text: t('assignées à vous'), cls: '' }} color="green" onClick={() => go('projects')} />
            </>
          )}
          <Kpi title={t("Demandes clients à traiter")} value={String(s.tickets.open)} sub={{ text: s.tickets.urgent ? (s.tickets.urgent > 1 ? t('dont {n} urgentes', { n: s.tickets.urgent }) : t('dont {n} urgente', { n: s.tickets.urgent })) : t('aucune urgente'), cls: s.tickets.urgent ? 'down' : 'up' }} color="red" onClick={() => go('support')} />
          <Kpi title={t("Tâches en retard")} value={String(s.tasks.overdue)} sub={{ text: s.tasks.todo > 1 ? t('sur {n} tâches ouvertes', { n: s.tasks.todo }) : t('sur {n} tâche ouverte', { n: s.tasks.todo }), cls: s.tasks.overdue ? 'warn' : 'up' }} color="amber" onClick={() => go('projects')} />
        </div>

        {chart ? (
          <div className="g3">
            <section className="dc">
              <div className="ch"><h2>{t('Entrées et sorties')}</h2><small className="muted">{chart.unit === 1000000 ? t('6 derniers mois, en millions de {currency}', { currency: info.org.currency }) : t('6 derniers mois, en milliers de {currency}', { currency: info.org.currency })}</small></div>
              <div className="legend"><i className="li" />{t('Entrées')}<i className="lo" />{t('Sorties')}</div>
              {chart.svg}
            </section>
            {alertsCard}
          </div>
        ) : alertsCard}

        <div className="g4">
          <section className="dc">
            <div className="ch"><h2>{t('Décisions à prendre')}</h2><small className="muted">{t('{n} en attente', { n: j.decisions.length })}</small></div>
            {!j.decisions.length ? <Empty text={j.canDecide ? t('Aucune décision en attente.') : t("Vous n'avez aucune demande en attente.")} /> : null}
            {j.decisions.map((d) => (
              <div className="dec" key={d.id}>
                <div className="dt"><b>{d.title}</b><small>{(d.amount ? money(d.amount) + ' · ' : '') + (d.detail || t('demandé par {name}', { name: d.requester || t('un membre') }))}</small>{d.steps && d.steps.length ? <small className="muted">{t('Niveau en cours : {role} ({i}/{n})', { role: t(d.currentRole === 'owner' ? 'Propriétaire' : d.currentRole === 'admin' ? 'Administrateur' : 'Responsable'), i: d.steps.filter((x) => x.status === 'approved').length + 1, n: d.steps.length })}</small> : null}{d.link ? <small className="muted">{t('Lié : {kind} n°{id}', { kind: t(d.link.label), id: d.link.id })}</small> : null}</div>
                {j.canDecide ? (
                  <div className="row nowrap">
                    <button className="dv" type="button" onClick={() => decide(d, 'approved')}>{t('Valider')}</button>
                    <button className="dr" type="button" onClick={() => decide(d, 'rejected')}>{t('Refuser')}</button>
                    <button className="link" type="button" onClick={() => oapi('POST', '/decisions/' + d.id + '/remind', {}).then(() => toast(t('Rappel envoyé.'))).catch(fail)}>{t('Rappeler')}</button>
                  </div>
                ) : <span className="pill mid">{t('En attente')}</span>}
              </div>
            ))}
            <button className="link soft" type="button" onClick={newDecision}>{t('+ Soumettre une demande de validation')}</button>
          </section>

          <section className="dc">
            <div className="ch"><h2>{t('Projets en cours')}</h2></div>
            {!j.projects.length ? <Empty text={t('Aucun projet en cours.')} /> : null}
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
            <div className="ch"><h2>{t('Mes tâches')}</h2></div>
            {!j.myTasks.length ? <Empty text={t('Aucune tâche ne vous est assignée.')} /> : null}
            {j.myTasks.slice(0, 3).map((tk, i) => {
              const n = tk.due ? Math.round((new Date(tk.due + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000) : 9;
              const tone2 = n <= 0 ? 'red' : n === 1 ? 'amber' : 'blue';
              return (
                <div className="tkl" key={tk.id != null ? tk.id : i}>
                  <span className={'box ' + tone2} />
                  <div><b>{tk.title}</b><small className={tone2}>{tk.due ? when(tk.due, today(), dateFr) : t('sans date')}</small></div>
                </div>
              );
            })}
          </section>
        </div>
        <div className="g4">
          <Notices />
          {info.me && info.me.role !== 'member' ? <><Kpis /><Circuit /></> : null}
        </div>
      </div>
    </>
  );
}
