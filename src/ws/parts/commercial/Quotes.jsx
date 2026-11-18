import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Card, Field, Loading, Segmented, Stat, Table, useLoad } from '../../ui.jsx';
import QuoteForm from './QuoteForm.jsx';
import { Failed, MapSelect, pct, qs, useCp, useForm } from './common.jsx';
import { tone2, useL2 } from './labels2.jsx';

/* Devis : liste (statut, version, validité, validation de remise, jours sans réponse), statistiques, file de validation des remises. */

export function QuoteBadges({ q }) {
  const t = useT();
  const L2 = useL2();
  return (
    <span className="cp-tags">
      <Badge tone={tone2(q.status)}>{L2.quoteStatus[q.status] || q.status}</Badge>
      {q.expired ? <Badge tone="danger">{t('Expiré')}</Badge> : null}
      {q.approvalRequired ? <Badge tone={tone2(q.approval)}>{t('Remise : {s}', { s: (L2.approval[q.approval] || q.approval).toLowerCase() })}</Badge> : null}
    </span>
  );
}

export default function Quotes() {
  const t = useT();
  const L2 = useL2();
  const { api, has, tick, openDrawer, bump } = useCp();
  const { money, dateFr, modal } = useWs();
  const [view, setView] = useState('all');
  const [f, setF] = useState({ status: '', approval: '', all: false });
  const st = useLoad(() => (view === 'pending' ? api('GET', '/quotes/pending') : api('GET', '/quotes' + qs(f))), [view, f, tick]);
  const stats = useLoad(() => api('GET', '/quotes/stats'), [tick]);
  const open = (id) => openDrawer('quote', id);
  const add = () => modal(t('Nouveau devis'), (close) => <QuoteForm close={close} onSaved={(id) => { bump(); open(id); }} />, { wide: true });
  const s = stats.data;
  const cols = [
    { key: 'number', label: t('Devis'), render: (q) => <button type="button" className="cp-link" onClick={() => open(q.id)}><b>{q.number}</b>{q.version > 1 || q.variant ? <span className="muted"> · v{q.version}{q.variant ? ' ' + q.variant : ''}</span> : null}</button> },
    { key: 'customer', label: t('Client') }, { key: 'total', label: t('Total'), align: 'r', render: (q) => money(q.total) },
    { key: 'status', label: t('État'), render: (q) => <QuoteBadges q={q} /> },
    { key: 'validUntil', label: t('Valable jusqu’au'), render: (q) => (q.validUntil ? dateFr(q.validUntil) : '—') },
    { key: 'days', label: t('Sans réponse depuis'), align: 'r', render: (q) => (q.daysSinceSent === null ? '—' : t('{n} j', { n: q.daysSinceSent })) },
    { key: 'discountPct', label: t('Remise'), align: 'r', render: (q) => pct(q.discountPct) },
  ];
  return (
    <div className="cp-stack">
      {s ? (
        <div className="ui-stats">
          <Stat label={t('Devis créés (6 mois)')} value={s.created} sub={t('{n} envoyé(s)', { n: s.sent })} icon="file-lines" />
          <Stat label={t("Taux d'acceptation")} value={pct(s.acceptanceRate)} sub={t('{a} accepté(s), {r} refusé(s)', { a: s.accepted, r: s.refused })} icon="circle-check" tone="ok" />
          <Stat label={t('Montant accepté')} value={money(s.acceptedAmount)} icon="coins" tone="ok" />
          <Stat label={t('En attente de réponse')} value={s.waiting} sub={money(s.waitingAmount)} icon="hourglass" tone={s.waiting ? 'warn' : 'ok'} />
          <Stat label={t("Délai moyen d'acceptation")} value={t('{n} j', { n: s.avgDaysToAccept })} icon="clock" />
        </div>
      ) : null}
      <Card title={t('Devis')} actions={has('quote') ? <Button variant="primary" icon="plus" onClick={add}>{t('Nouveau devis')}</Button> : null}>
        <div className="row cp-bar"><Segmented label={t('Vue')} value={view} onChange={setView} items={[{ id: 'all', label: t('Tous les devis') }, { id: 'pending', label: t('Sans réponse') }]} /></div>
        {view === 'all' ? (
          <div className="cp-filters">
            <Field label={t('État')}>{(p) => <MapSelect {...p} map={L2.quoteStatus} value={f.status} onChange={(v) => setF({ ...f, status: v })} none={t('Tous')} />}</Field>
            <Field label={t('Validation de remise')}>{(p) => <MapSelect {...p} map={L2.approval} skip={['none']} value={f.approval} onChange={(v) => setF({ ...f, approval: v })} none={t('Toutes')} />}</Field>
            <label className="cp-check"><input type="checkbox" checked={f.all} onChange={(e) => setF({ ...f, all: e.target.checked })} /> {t('Afficher aussi les anciennes versions')}</label>
          </div>
        ) : null}
        {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : <Table caption={t('Devis')} columns={cols} rows={st.data.quotes} empty={t('Aucun devis.')} />}
      </Card>
    </div>
  );
}

function DecideForm({ q, decision, close, onDone }) {
  const t = useT();
  const { api } = useCp();
  const f = useForm({ comment: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => {
      if (decision === 'reject' && !f.v.comment.trim()) throw new Error(t('Indiquez la raison du refus.'));
      await api('POST', '/quotes/' + q.id + '/decide', { decision, comment: f.v.comment }); close(); onDone();
    }); }}>
      <p>{t('Devis {n} : remise de {p}.', { n: q.number, p: pct(q.discountPct) })}</p>
      <Field label={decision === 'reject' ? t('Raison du refus') : t('Commentaire (facultatif)')}>{(p) => <textarea {...p} rows={3} maxLength={300} value={f.v.comment} onChange={f.set('comment')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant={decision === 'reject' ? 'danger' : 'primary'} type="submit" loading={f.busy}>{decision === 'reject' ? t('Refuser la remise') : t('Valider la remise')}</Button></div>
    </form>
  );
}

/** File des remises à valider (réservé à qui valide). */
export function QuoteApprovals() {
  const t = useT();
  const { api, tick, openDrawer, bump } = useCp();
  const { money, modal } = useWs();
  const st = useLoad(() => api('GET', '/quotes-approvals'), [tick]);
  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Loading />;
  const decide = (q, d) => modal(d === 'reject' ? t('Refuser la remise') : t('Valider la remise'), (close) => <DecideForm q={q} decision={d} close={close} onDone={() => { st.reload(); bump(); }} />);
  const cols = [
    { key: 'number', label: t('Devis'), render: (q) => <button type="button" className="cp-link" onClick={() => openDrawer('quote', q.id)}><b>{q.number}</b></button> },
    { key: 'customer', label: t('Client') }, { key: 'total', label: t('Total'), align: 'r', render: (q) => money(q.total) }, { key: 'discountPct', label: t('Remise'), align: 'r', render: (q) => pct(q.discountPct) },
    { key: 'why', label: t('Motif de la demande'), render: (q) => q.approvalReason || '—' }, { key: 'by', label: t('Demandé par'), render: (q) => q.createdBy },
    { key: 'act', label: '', render: (q) => <span className="row"><Button size="sm" variant="primary" onClick={() => decide(q, 'approve')}>{t('Valider')}</Button><Button size="sm" variant="danger-outline" onClick={() => decide(q, 'reject')}>{t('Refuser')}</Button></span> },
  ];
  return <Card title={t('Remises à valider')} subtitle={t('Remises supérieures au plafond du rôle de la personne qui a fait le devis.')}><Table caption={t('Remises à valider')} columns={cols} rows={st.data.quotes} empty={t('Aucune remise en attente.')} /></Card>;
}
