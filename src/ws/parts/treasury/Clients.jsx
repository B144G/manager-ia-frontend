import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Alert, Badge, Button, Card, ChartFrame, Form, Loaded, Stat, Table, useLoad } from '../../ui.jsx';
import { Bars, Combo, Donut, compact } from '../../charts/lazy.jsx';
import { OpForm } from './Accounts.jsx';
import { RiskBadge } from './common.jsx';

/* Trésorerie · créances clients (balance âgée, risque d'impayé, provision, relances) et dettes fournisseurs (échéancier, paiements optimisés). */

const BUCKET = (t) => ({ notDue: t('Non échu'), d30: t('1 à 30 jours'), d60: t('31 à 60 jours'), d90: t('61 à 90 jours'), d90p: t('Plus de 90 jours') });
const BCOL = { notDue: 'var(--c2)', d30: 'var(--c3)', d60: 'var(--c4)', d90: 'var(--c5)', d90p: 'var(--danger)' };

export function ReceivablesScreen({ me }) {
  const t = useT();
  const { oapi, money, dateFr, modal, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/receivables'), []);
  const names = BUCKET(t);
  const collect = (i) => modal(t('Encaisser la facture {n}', { n: i.number }), (close) => <OpForm preset={{ kind: 'receipt', category: 'customer', ref: 'invoice:' + i.id, amount: String(i.left) }} close={close} done={st.reload} />, { wide: true });
  const remind = () => oapi('POST', '/treasury/receivables/reminders', {}).then(() => toast(t('Relances préparées : retrouvez-les dans Assistant commercial › Relances.'))).catch(fail);
  const rates = () => modal(t('Taux de provision par tranche'), (close) => (
    <Form submitText={t('Enregistrer')} onSubmit={(v) => oapi('PUT', '/treasury/settings', { provision: { notDue: v.notDue, d30: v.d30, d60: v.d60, d90: v.d90, d90p: v.d90p } }).then(() => { close(); st.reload(); })}
      fields={Object.keys(names).map((k) => ({ k, label: names[k] + ' (%)', value: String(st.data.provisionRates[k]) }))} />
  ));
  return (
    <Loaded state={st}>{(j) => {
      const pie = j.buckets.filter((b) => b.amount > 0).map((b) => ({ name: names[b.key], value: b.amount, color: BCOL[b.key] }));
      const top = j.customers.slice(0, 8).map((c) => ({ x: c.customer.slice(0, 12), notDue: c.buckets.notDue, d30: c.buckets.d30, d60: c.buckets.d60, d90: c.buckets.d90, d90p: c.buckets.d90p }));
      return (
        <>
          <div className="kpis4">
            <Stat icon="address-book" label={t('Reste à encaisser')} value={money(j.total)} sub={t('{n} facture(s) ouverte(s)', { n: j.items.length })} />
            <Stat icon="hourglass" tone={j.overdue ? 'warn' : 'ok'} label={t('Dont échu')} value={money(j.overdue)} sub={j.total ? Math.round(100 * j.overdue / j.total) + ' %' : '0 %'} />
            <Stat icon="shield" label={t('Provision conseillée')} value={money(j.provision)} sub={t('Selon l\'ancienneté du retard')} onClick={me.canConfigure ? rates : undefined} />
            <Stat icon="clock" label={t('Retard moyen constaté')} value={t('{n} jours', { n: j.avgDelay })} sub={t('Sur les factures déjà payées')} />
          </div>
          <div className="pd-grid two">
            <Card title={t('Balance âgée')}>
              {pie.length ? <div style={{ height: 240 }}><Donut data={pie} fmt={money} center={compact(j.total)} sub={t('à encaisser')} colors={pie.map((p) => p.color)} /></div> : <p className="muted">{t('Aucune créance ouverte.')}</p>}
              {j.buckets.map((b) => <div className="line" key={b.key}><span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: BCOL[b.key], marginRight: 6 }} />{names[b.key]}</span><b className="num">{money(b.amount)} · {b.share} %</b></div>)}
            </Card>
            <Card>
              <ChartFrame title={t('Les clients qui doivent le plus')} subtitle={t('Par ancienneté de la créance')} height={280} summary={j.customers.map((c) => c.customer + ' ' + money(c.total)).join(', ')} legend={Object.keys(names).map((k) => ({ label: names[k], color: BCOL[k] }))}>
                <Combo data={top} fmt={money} height={280} stacked series={Object.keys(names).map((k) => ({ key: k, label: names[k], type: 'bar', color: BCOL[k] }))} />
              </ChartFrame>
            </Card>
          </div>
          <Card title={t('Risque d\'impayé par client')} subtitle={t('Score de 0 à 100 : part échue, plus gros retard, habitude de paiement.')} actions={me.canApprove ? <Button size="sm" icon="envelope" onClick={remind}>{t('Lancer les relances')}</Button> : null} flush>
            <Table caption={t('Clients')} empty={t('Aucune créance ouverte.')} columns={[
              { key: 'customer', label: t('Client') }, { key: 'total', label: t('Reste dû'), align: 'r', render: (c) => money(c.total) }, { key: 'overdue', label: t('Échu'), align: 'r', render: (c) => money(c.overdue) },
              { key: 'late', label: t('Plus gros retard'), align: 'r', render: (c) => t('{n} j', { n: c.maxLate }) }, { key: 'avg', label: t('Retard habituel'), align: 'r', render: (c) => t('{n} j', { n: c.avgDelay }) },
              { key: 'prov', label: t('Provision'), align: 'r', render: (c) => money(c.provision) }, { key: 'risk', label: t('Risque'), render: (c) => <span><RiskBadge risk={c.risk} /> {c.riskScore}</span> },
            ]} rows={j.customers.map((c) => ({ ...c, id: c.customerId }))} />
          </Card>
          <Card title={t('Factures ouvertes')} subtitle={t('Les relances automatiques utilisent le centre de relances de l\'Assistant commercial (cadence, canal, journal).')} flush>
            <Table caption={t('Factures')} empty={t('Aucune facture ouverte.')} columns={[
              { key: 'number', label: t('Facture') }, { key: 'customer', label: t('Client') }, { key: 'due', label: t('Échéance'), render: (i) => dateFr(i.due) },
              { key: 'late', label: t('Retard'), align: 'r', render: (i) => (i.late ? <Badge tone={i.late > 60 ? 'danger' : 'warn'}>{t('{n} j', { n: i.late })}</Badge> : <Badge tone="ok">{t('Non échu')}</Badge>) },
              { key: 'left', label: t('Reste dû'), align: 'r', render: (i) => money(i.left) }, { key: 'rem', label: t('Relances'), align: 'r', render: (i) => i.reminders || '—' },
              { key: 'act', label: '', render: (i) => <Button size="sm" onClick={() => collect(i)}>{t('Encaisser')}</Button> },
            ]} rows={j.items} />
          </Card>
        </>
      );
    }}</Loaded>
  );
}

export function PayablesScreen({ me }) {
  const t = useT();
  const { oapi, money, dateFr, modal, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/treasury/payables'), []);
  const opt = useLoad(() => (me.canApprove ? oapi('GET', '/treasury/payables/optimize') : Promise.resolve(null)), []);
  const pay = (b) => modal(t('Régler {n}', { n: b.number || b.supplier }), (close) => <OpForm preset={{ kind: 'payment', category: 'supplier', ref: 'bill:' + b.id, amount: String(b.left) }} close={close} done={() => { st.reload(); opt.reload(); }} />, { wide: true });
  const terms = (b) => modal(t('Conditions de {s}', { s: b.supplier }), (close) => (
    <Form submitText={t('Enregistrer')} onSubmit={(v) => oapi('PUT', '/treasury/terms/' + b.supplierId, { discountPct: v.discountPct, discountDays: v.discountDays, priority: v.priority }).then(() => { close(); st.reload(); opt.reload(); toast(t('Conditions enregistrées.')); }).catch((e) => { fail(e); throw e; })}
      fields={[{ k: 'discountPct', label: t('Escompte pour paiement rapide (%)'), value: String(b.discountPct) }, { k: 'discountDays', label: t('… si payé dans les (jours après facture)'), value: String(b.discountDays) },
        { k: 'priority', label: t('Priorité'), type: 'select', value: String(b.priority), options: [['1', t('Critique : à payer sans attendre')], ['2', t('Normale')], ['3', t('Reportable')]] }]} />
  ));
  const reason = { critical: t('Critique ou très en retard'), discount: t('Escompte à saisir'), overdue: t('Échue'), soon: t('Échéance proche'), cash: t('Trésorerie insuffisante'), deferrable: t('Reportable'), later: t('Pas encore urgent') };
  return (
    <Loaded state={st}>{(j) => {
      const weeks = j.weeks.map((w) => ({ x: w.label, amount: w.amount }));
      return (
        <>
          <div className="kpis4">
            <Stat icon="cart" label={t('Total à payer')} value={money(j.total)} sub={t('{n} dette(s)', { n: j.bills.length })} />
            <Stat icon="hourglass" tone={j.overdue ? 'warn' : 'ok'} label={t('En retard')} value={money(j.overdue)} />
            <Stat icon="calendar" label={t('Dans les 13 semaines')} value={money(j.weeks.reduce((s, w) => s + w.amount, 0))} />
            <Stat icon="clock" label={t('Au-delà')} value={money(j.later)} />
          </div>
          <Card>
            <ChartFrame title={t('Échéancier des dettes')} subtitle={t('Montants à payer chaque semaine (hors retard)')} height={240} summary={j.weeks.map((w) => w.label + ' ' + money(w.amount)).join(', ')}>
              <Bars data={weeks} fmt={money} height={240} series={[{ key: 'amount', label: t('À payer'), color: 'var(--c3)' }]} />
            </ChartFrame>
          </Card>
          {opt.data ? (
            <Card title={t('Paiements conseillés')} subtitle={t('Trésorerie disponible après le fonds de sécurité : {amount}', { amount: money(opt.data.available) })}>
              <Alert tone={opt.data.payNow.length ? 'info' : 'ok'}>{opt.data.payNow.length ? t('Payer maintenant {amount} sur {n} dette(s) ; escompte gagné : {saved}.', { amount: money(opt.data.paid), n: opt.data.payNow.length, saved: money(opt.data.saved) }) : t('Rien à payer d\'urgence avec la trésorerie disponible.')}</Alert>
              <Table caption={t('Paiements conseillés')} empty={t('Aucune dette ouverte.')} columns={[
                { key: 'supplier', label: t('Fournisseur') }, { key: 'number', label: t('Facture') }, { key: 'due', label: t('Échéance'), render: (b) => dateFr(b.due) },
                { key: 'left', label: t('Reste dû'), align: 'r', render: (b) => money(b.left) },
                { key: 'dec', label: t('Conseil'), render: (b) => (b.payAmount !== undefined ? <Badge tone="ok">{t('Payer {amount}', { amount: money(b.payAmount) })}</Badge> : <Badge tone="outline">{t('Reporter')}{b.suggestedDate ? ' · ' + dateFr(b.suggestedDate) : ''}</Badge>) },
                { key: 'why', label: t('Raison'), render: (b) => reason[b.reason] || '' },
              ]} rows={opt.data.payNow.concat(opt.data.defer).map((b) => ({ ...b, id: b.id }))} />
            </Card>
          ) : null}
          <Card title={t('Dettes ouvertes')} flush>
            <Table caption={t('Dettes')} empty={t('Aucune dette ouverte.')} columns={[
              { key: 'supplier', label: t('Fournisseur') }, { key: 'number', label: t('Facture') }, { key: 'due', label: t('Échéance'), render: (b) => dateFr(b.due) },
              { key: 'late', label: t('Retard'), align: 'r', render: (b) => (b.late ? <Badge tone="danger">{t('{n} j', { n: b.late })}</Badge> : '—') },
              { key: 'left', label: t('Reste à payer'), align: 'r', render: (b) => money(b.left) },
              { key: 'terms', label: t('Conditions'), render: (b) => (b.discountPct ? t('{p} % sous {d} j', { p: b.discountPct, d: b.discountDays }) : '—') + (b.priority === 1 ? ' · ' + t('critique') : b.priority === 3 ? ' · ' + t('reportable') : '') },
              { key: 'act', label: '', render: (b) => <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}><Button size="sm" onClick={() => pay(b)}>{t('Régler')}</Button>{me.canConfigure && b.supplierId ? <Button size="sm" iconOnly icon="edit" label={t('Conditions')} onClick={() => terms(b)} /> : null}</span> },
            ]} rows={j.bills} />
          </Card>
        </>
      );
    }}</Loaded>
  );
}
