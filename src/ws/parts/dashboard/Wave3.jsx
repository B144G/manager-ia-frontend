import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN, SettingsCard, saveFile } from '../w3/common.jsx';

/* Tableau de bord · vague 3 : notifications, indicateurs (CA, marge estimée, créances, trésorerie, objectifs), seuils, circuit de validation. */

export function Notices() {
  const t = useT();
  const { oapi, dateFr, refreshBadges } = useWs();
  const st = useLoad(() => oapi('GET', '/notices'), []);
  return (
    <section className="dc">
      <div className="ch"><h2>{t('Notifications')}</h2>
        <small className="muted">{st.data ? t('{n} non lue(s)', { n: st.data.unread }) : ''}</small></div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.items.length ? <Empty text={t('Aucune notification.')} /> : null}
          {j.items.slice(0, 6).map((n) => <div className="line" key={n.id}><span style={{ fontWeight: n.read ? 400 : 700 }}>{n.text}<br /><small className="muted">{dateFr(n.at)}</small></span></div>)}
          {j.unread ? <button className="link soft" type="button" style={BTN} onClick={() => oapi('POST', '/notices/read', {}).then(() => { st.reload(); refreshBadges(); })}>{t('Tout marquer comme lu')}</button> : null}
        </>
      )}
      </Loaded>
    </section>
  );
}

export function Kpis() {
  const t = useT();
  const { oapi, orgId, money, can, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/dashboard/kpis'), []);
  return (
    <section className="dc" style={{ gridColumn: '1 / -1' }}>
      <div className="ch"><h2>{t('Indicateurs du mois')}</h2>
        <span className="row">
          <button className="link" type="button" style={BTN} onClick={() => saveFile('/orgs/' + orgId + '/dashboard/kpis.csv', 'tableau-de-bord.csv', fail)}>{t('Exporter en CSV')}</button>
          <a className="link" style={{ ...BTN, display: 'inline-flex', alignItems: 'center' }} href={'/imprimer-kpi/' + orgId} target="_blank" rel="noopener noreferrer">{t('Version imprimable')}</a>
        </span></div>
      <Loaded state={st}>{(j) => {
        const g = j.goals;
        return (
          <>
            <div className="kpis">
              <div className="stat"><b>{money(j.revenue)}</b><span>{t("chiffre d'affaires HT")}</span></div>
              <div className="stat"><b>{money(j.margin)}</b><span>{t('marge estimée')}</span></div>
              <div className="stat"><b>{money(j.receivables.total)}</b><span>{t('créances clients')}</span></div>
              <div className="stat"><b>{money(j.cash.balance)}</b><span>{t('trésorerie (budget)')}</span></div>
            </div>
            <p className="muted small">{t("Estimation de gestion : chiffre d'affaires HT moins les sorties du budget du mois.")}</p>
            <h3>{t('Créances par âge')}</h3>
            {[['notDue', t('Non échues')], ['d1_30', t('1 à 30 jours')], ['d31_60', t('31 à 60 jours')], ['d61_90', t('61 à 90 jours')], ['d90', t('Plus de 90 jours')]].map(([k, l]) => <div className="line" key={k}><span>{l}</span><b>{money(j.receivables.aging[k])}</b></div>)}
            {g.revenue || g.newCustomers || g.csat ? <h3>{t('Objectifs du mois')}</h3> : null}
            {g.revenue ? <div className="line"><span>{t("Chiffre d'affaires")}</span><b>{g.revenue.percent + ' %'}</b></div> : null}
            {g.newCustomers ? <div className="line"><span>{t('Nouveaux clients')}</span><b>{g.newCustomers.value + ' / ' + g.newCustomers.target}</b></div> : null}
            {g.csat ? <div className="line"><span>{t('Satisfaction client')}</span><b>{g.csat.value + ' / ' + g.csat.target}</b></div> : null}
            {j.hr.due || j.hr.payrollMissing ? <p className="small late">{[j.hr.due ? t('{n} échéance(s) RH à traiter.', { n: j.hr.due }) : '', j.hr.payrollMissing ? t("La paie du mois n'est pas encore préparée.") : ''].filter(Boolean).join(' ')}</p> : null}
          </>
        );
      }}
      </Loaded>
      {can('manager') ? (
        <SettingsCard path="/dashboard" canEdit={can('admin')} title={t('Seuils d’alerte et objectifs')}
          intro={t('Chaque organisation fixe ses propres seuils. 0 = désactivé.')}
          keys={[['alert_overdue_days', t('Facture impayée : alerte urgente après (jours)')], ['alert_ticket_hours', t('Demande sans réponse après (heures)')], ['alert_cash_min', t('Trésorerie minimale')], ['alert_receivable_max', t('Créances clients maximales')],
            ['goal_revenue_month', t("Objectif de chiffre d'affaires du mois")], ['goal_new_customers_month', t('Objectif de nouveaux clients du mois')], ['goal_csat', t('Objectif de satisfaction (sur 5)')]]} />
      ) : null}
    </section>
  );
}

export function Circuit() {
  const t = useT();
  const { oapi, can, toast, fail, dateFr } = useWs();
  const rules = useLoad(() => oapi('GET', '/decisions/rules'), []);
  const dele = useLoad(() => oapi('GET', '/decisions/delegations'), []);
  const [members, setMembers] = useState(null);
  const [draft, setDraft] = useState(null);
  const LV = [['manager', t('Responsable')], ['admin', t('Administrateur')], ['owner', t('Propriétaire')]];
  const loadMembers = () => { if (!members) oapi('GET', '/members').then((j) => setMembers(j.members)).catch(() => {}); };
  return (
    <section className="dc" style={{ gridColumn: '1 / -1' }}>
      <div className="ch"><h2>{t('Circuit de validation')}</h2></div>
      <Loaded state={rules}>{(j) => {
        const cur = draft || j.rules;
        return (
          <>
            <p className="muted small">{j.note}</p>
            {cur.map((r, i) => (
              <div className="row" key={i} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                <input aria-label={t('À partir de (montant)')} style={{ fontSize: 16, width: 150 }} disabled={!can('admin')} value={r.minAmount} onChange={(e) => setDraft(cur.map((x, k) => (k === i ? { ...x, minAmount: e.target.value } : x)))} />
                <select aria-label={t('Niveau')} style={{ fontSize: 16 }} disabled={!can('admin')} value={r.role} onChange={(e) => setDraft(cur.map((x, k) => (k === i ? { ...x, role: e.target.value } : x)))}>{LV.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
                {can('admin') ? <button className="link" type="button" style={BTN} onClick={() => setDraft(cur.filter((_, k) => k !== i))}>{t('Retirer')}</button> : null}
              </div>
            ))}
            {can('admin') ? (
              <div className="row">
                <button className="btn small" type="button" style={BTN} onClick={() => setDraft([...cur, { minAmount: '', role: 'manager' }])}>{t('Ajouter un seuil')}</button>
                <button className="btn primary small" type="button" style={BTN} onClick={() => oapi('PUT', '/decisions/rules', { rules: cur.map((r) => ({ minAmount: Number(String(r.minAmount).replace(/\s/g, '')) || 0, role: r.role })) }).then(() => { setDraft(null); toast(t('Enregistré.')); rules.reload(); }).catch(fail)}>{t('Enregistrer les seuils')}</button>
              </div>
            ) : null}
          </>
        );
      }}
      </Loaded>
      {can('manager') ? (
        <>
          <h3>{t('Délégations en cours')}</h3>
          <Loaded state={dele}>{(j) => (
            <>
              {!j.delegations.length ? <Empty text={t('Aucune délégation.')} /> : null}
              {j.delegations.map((d) => <div className="line" key={d.id}><span>{t('{from} délègue à {to} jusqu’au {date}', { from: d.from, to: d.to, date: dateFr(d.until) })}</span><button className="link" type="button" style={BTN} onClick={() => oapi('DELETE', '/decisions/delegations/' + d.id).then(dele.reload).catch(fail)}>{t('Retirer')}</button></div>)}
            </>
          )}
          </Loaded>
          <button className="btn small" type="button" style={BTN} onMouseEnter={loadMembers} onFocus={loadMembers} onClick={() => { loadMembers(); document.getElementById('deleg-form').hidden = false; }}>{t('Déléguer mes validations')}</button>
          <div id="deleg-form" hidden>
            {members ? (
              <Form
                fields={[{ k: 'toUserId', label: t('Personne'), type: 'select', options: members.map((m) => [String(m.userId), m.name]) }, { k: 'until', label: t("Jusqu'au"), type: 'date', required: true }]}
                submitText={t('Déléguer')}
                onSubmit={(f) => oapi('POST', '/decisions/delegations', { toUserId: Number(f.toUserId), until: f.until }).then(() => { toast(t('Délégation créée.')); dele.reload(); })}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
