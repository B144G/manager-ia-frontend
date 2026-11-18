import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Badge, Card, ChartFrame, EmptyState, Icon, Loaded, Stat, Table, useLoad } from '../../ui.jsx';
import { Combo, Donut, compact } from '../../charts/lazy.jsx';
import { Gauge } from './charts.jsx';
import { Alerts, Level, useGroups, useInterpret } from './common.jsx';

/* Trésorerie · tableau de bord : soldes, prévision à 13 semaines, fonds de sécurité, créances, dettes, jours de crédit, alertes. */

export default function Dashboard({ go }) {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/dashboard'), []);
  return <Loaded state={st}>{(d) => <Body d={d} go={go} />}</Loaded>;
}

function Body({ d, go }) {
  const t = useT();
  const { money, dateFr } = useWs();
  const groups = useGroups();
  const interp = useInterpret();
  const f = d.forecast;
  const curve = f.weeks.map((w) => ({ x: w.label, closing: w.closing, inflows: w.in, outflows: -w.out }));
  const kindName = { bank: t('Banques'), cash: t('Caisses'), mobile: t('Mobile money') };
  const kinds = Object.entries(d.byKind).map(([k, v]) => ({ name: kindName[k] || k, value: Math.max(v, 0) })).filter((x) => x.value > 0);
  const days = [['DSO', d.kpi.dso, t('Délai de paiement des clients')], ['DPO', d.kpi.dpo, t('Délai de paiement des fournisseurs')], ['DIO', d.kpi.dio, t('Rotation du stock (jours)')], ['CCC', d.kpi.ccc, t('Cycle de conversion de trésorerie')]];
  const empty = !d.accounts.length;
  return (
    <>
      <Alerts list={d.alerts} />
      {empty ? <Card><EmptyState icon="bank" title={t('Ajoutez votre premier compte de trésorerie')}>{t('Banque, caisse ou mobile money : le tableau de bord se remplit dès que vous avez un compte.')}<div style={{ marginTop: 10 }}><button type="button" className="ui-btn primary" onClick={() => go('accounts')}><Icon name="plus" />{t('Comptes et soldes')}</button></div></EmptyState></Card> : null}
      <div className="kpis4">
        <Stat icon="coins" label={t('Trésorerie actuelle')} value={money(d.cash)} sub={d.pending ? t('{n} opération(s) en attente', { n: d.pending }) : t('Tous comptes confondus')} onClick={() => go('accounts')} />
        <Stat icon="arrow-trend-down" tone={f.low.balance < 0 ? 'danger' : 'brand'} label={t('Point bas à 13 semaines')} value={money(f.low.balance)} sub={dateFr(f.low.date)} subTone={f.low.balance < 0 ? 'bad' : undefined} onClick={() => go('forecast')} />
        <Stat icon="chart-line" label={t('Solde dans 13 semaines')} value={money(f.closing13)} sub={t('Dans 12 mois : {amount}', { amount: money(f.closing12m) })} onClick={() => go('forecast')} />
        <Stat icon="shield" tone={d.safety.level === 'ok' ? 'ok' : 'warn'} label={t('Fonds de sécurité')} value={d.safety.target ? Math.round((d.safety.ratio || 0) * 100) + ' %' : '—'} sub={d.safety.target ? t('Cible : {amount}', { amount: money(d.safety.target) }) : t('Cible non définie')} onClick={() => go('safety')} />
      </div>
      <div className="pd-grid two">
        <Card>
          <ChartFrame title={t('Prévision glissante à 13 semaines')} subtitle={t('Encaissements, décaissements et solde en fin de semaine')} height={290}
            summary={f.weeks.map((w) => w.label + ' ' + money(w.closing)).join(', ')}
            legend={[{ label: t('Encaissements'), color: 'var(--ok)' }, { label: t('Décaissements'), color: 'var(--danger)' }, { label: t('Solde fin de semaine'), color: 'var(--c1)' }]}>
            <Combo data={curve} fmt={money} zeroLine height={290} series={[{ key: 'inflows', label: t('Encaissements'), type: 'bar', color: 'var(--ok)' }, { key: 'outflows', label: t('Décaissements'), type: 'bar', color: 'var(--danger)' }, { key: 'closing', label: t('Solde fin de semaine'), type: 'line', color: 'var(--c1)' }]}
              refs={d.safety.target ? [{ y: d.safety.target, label: t('Fonds de sécurité') }] : []} />
          </ChartFrame>
        </Card>
        <Card title={t('Où est l\'argent')} subtitle={t('Soldes par type de compte')}>
          {kinds.length ? <div style={{ height: 200 }}><Donut data={kinds} fmt={money} center={compact(d.cash)} sub={t('au total')} /></div> : <EmptyState title={t('Aucun solde positif')} />}
          <Table caption={t('Comptes')} columns={[{ key: 'name', label: t('Compte') }, { key: 'balance', label: t('Solde'), align: 'r', render: (a) => money(a.balance) }]} rows={d.accounts} empty={t('Aucun compte')} />
        </Card>
      </div>
      <div className="pd-grid">
        <Card title={t('Créances clients')} subtitle={t('Reste à encaisser : {amount}', { amount: money(d.receivables.total) })} actions={<button type="button" className="ui-btn sm" onClick={() => go('receivables')}>{t('Détail')}</button>}>
          {d.receivables.buckets.map((b) => <div className="line" key={b.key}><span>{b.key === 'notDue' ? t('Non échu') : b.key === 'd30' ? t('1 à 30 jours') : b.key === 'd60' ? t('31 à 60 jours') : b.key === 'd90' ? t('61 à 90 jours') : t('Plus de 90 jours')}</span><b className="num">{money(b.amount)}</b></div>)}
          <div className="line"><span>{t('Provision conseillée')}</span><b className="num">{money(d.receivables.provision)}</b></div>
        </Card>
        <Card title={t('Dettes fournisseurs')} subtitle={t('À payer : {amount}', { amount: money(d.payables.total) })} actions={<button type="button" className="ui-btn sm" onClick={() => go('payables')}>{t('Détail')}</button>}>
          <div className="line"><span>{t('Dans les 7 jours')}</span><b className="num">{money(d.payables.next7)}</b></div>
          <div className="line"><span>{t('En retard')}</span><b className="num" style={{ color: d.payables.overdue ? 'var(--danger)' : undefined }}>{money(d.payables.overdue)}</b></div>
        </Card>
        <Card title={t('Fonds de sécurité')} actions={<Level level={d.safety.level} />}>
          <Gauge ratio={d.safety.ratio} level={d.safety.level} label={t('Fonds de sécurité')} />
          <p className="small muted" style={{ marginTop: 8 }}>{d.safety.target ? t('{amount} disponibles pour une cible de {target} ({days} jours de charges couverts).', { amount: money(d.safety.available), target: money(d.safety.target), days: d.safety.coverageDays === null ? 0 : d.safety.coverageDays }) : t('Définissez une cible dans les réglages.')}</p>
        </Card>
      </div>
      <Card title={t('Jours de crédit et cycle de trésorerie')} subtitle={t('Calculés sur les 90 derniers jours')} actions={<button type="button" className="ui-btn sm" onClick={() => go('kpis')}>{t('Indicateurs')}</button>}>
        <div className="kpis4">{days.map(([k, v, label]) => <div className="kpi" key={k}><span className="muted small">{k} · {label}</span><b>{v === null || v === undefined ? '—' : t('{n} jours', { n: v })}</b></div>)}</div>
        {d.interpretation.map((x) => <p key={x.code} className="small" style={{ margin: '4px 0' }}>• {interp(x)}</p>)}
      </Card>
      <div className="pd-grid two">
        <Card title={t('Dans les 14 prochains jours')}>
          <Table caption={t('Flux à venir')} columns={[{ key: 'date', label: t('Date'), render: (r) => dateFr(r.date) }, { key: 'label', label: t('Libellé') }, { key: 'group', label: t('Nature'), render: (r) => groups[r.group] || r.group }, { key: 'amount', label: t('Montant'), align: 'r', render: (r) => <span style={{ color: r.amount < 0 ? 'var(--danger)' : 'var(--ok)' }}>{money(r.amount)}</span> }]} rows={d.upcoming.map((u, i) => ({ ...u, id: i }))} empty={t('Aucun flux prévu.')} />
        </Card>
        <Card title={t('Clients à surveiller')}>
          <Table caption={t('Clients')} columns={[{ key: 'customer', label: t('Client') }, { key: 'overdue', label: t('Échu'), align: 'r', render: (r) => money(r.overdue) }, { key: 'risk', label: t('Risque'), render: (r) => <Badge tone={r.risk === 'high' ? 'danger' : r.risk === 'medium' ? 'warn' : 'ok'}>{r.risk === 'high' ? t('Élevé') : r.risk === 'medium' ? t('Moyen') : t('Faible')}</Badge> }]} rows={d.receivables.topRisk.map((r, i) => ({ ...r, id: i }))} empty={t('Aucune créance ouverte.')} />
        </Card>
      </div>
      {d.stock ? <Card title={t('Trésorerie du stock')} subtitle={t('Repris du module Stock et achats')}>
        <div className="kpis4"><div className="kpi"><span className="muted small">{t('Argent immobilisé en stock')}</span><b>{money(d.stock.tiedUp)}</b></div><div className="kpi"><span className="muted small">{t('Stock dormant')}</span><b>{money(d.stock.dormant)}</b></div><div className="kpi"><span className="muted small">{t('Besoin de trésorerie du stock')}</span><b>{money(d.stock.cashNeed)}</b></div></div>
      </Card> : null}
    </>
  );
}
