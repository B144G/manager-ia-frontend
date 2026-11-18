import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Drawer, Field, Loading, Stat, Table, useLoad } from '../../ui.jsx';
import QuoteForm from './QuoteForm.jsx';
import { QuoteBadges } from './Quotes.jsx';
import { Facts, Failed, pct, useCp, useForm } from './common.jsx';
import { tone2, useL2 } from './labels2.jsx';

/* Fiche d'un devis : lignes, validité, validation de remise, lien d'acceptation, relance, versions et variantes, passage en commande puis en facture. */

function AskForm({ title, label, field, submit, required, close, onSubmit }) {
  const t = useT();
  const f = useForm({ v: '' });
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); f.run(async () => { if (required && !f.v.v.trim()) throw new Error(t('Indiquez le motif.')); await onSubmit(f.v.v); close(); }); }}>
      <Field label={label}>{(p) => <input {...p} type="text" maxLength={300} value={f.v.v} onChange={f.set('v')} aria-label={title} data-field={field} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{submit}</Button></div>
    </form>
  );
}

export default function QuoteDetail({ id, onClose }) {
  const t = useT();
  const L2 = useL2();
  const { api, has, fail, bump, tick, openDrawer, openAccount, openOpp } = useCp();
  const { money, dateFr, modal, toast, copy, can, confirm } = useWs();
  const st = useLoad(() => api('GET', '/quotes/' + id), [id, tick]);
  const q = st.data && st.data.quote;
  const done = (msg) => (r) => { if (msg) toast(msg); st.reload(); bump(); return r; };
  const run = (p, msg) => p.then(done(msg), fail);
  const ask = (opts) => modal(opts.title, (close) => <AskForm {...opts} close={close} />);
  const link = () => api('POST', '/quotes/' + id + '/link', {}).then((r) => { copy(window.location.origin + r.path, t("Lien d'acceptation copié.")); st.reload(); }, fail);
  const editable = q && q.status === 'draft' && has('quote');
  const sendable = q && q.status === 'draft' && has('write');
  const lineCols = [
    { key: 'label', label: t('Désignation') }, { key: 'quantity', label: t('Quantité'), align: 'r' },
    { key: 'price', label: t('Prix unitaire'), align: 'r', render: (l) => money(l.price) }, { key: 'sum', label: t('Montant'), align: 'r', render: (l) => money(Math.round(l.quantity * l.price)) },
  ];
  return (
    <Drawer title={q ? t('Devis {n}', { n: q.number }) : t('Devis')} onClose={onClose} wide>
      {st.loading && !q ? <Loading /> : st.error ? <Failed e={st.error} /> : (
        <>
          <div className="row"><QuoteBadges q={q} />{q.version > 1 ? <Badge>{t('Version {n}', { n: q.version })}</Badge> : null}{q.variant ? <Badge tone="info">{q.variant}</Badge> : null}{q.superseded ? <Badge tone="warn">{t('Remplacé par une version plus récente')}</Badge> : null}
            <Button size="sm" onClick={() => openAccount(q.customerId)}>{q.customer}</Button>{q.oppId ? <Button size="sm" onClick={() => openOpp(q.oppId)}>{t("Opportunité")}</Button> : null}</div>
          <div className="ui-stats">
            <Stat label={t('Total')} value={money(q.total)} icon="coins" />
            <Stat label={t('Remise')} value={pct(q.discountPct)} icon="percent" tone={q.approvalRequired && q.approval !== 'approved' ? 'warn' : 'brand'} />
            <Stat label={t('Valable jusqu’au')} value={q.validUntil ? dateFr(q.validUntil) : '—'} icon="calendar" tone={q.expired ? 'danger' : 'brand'} />
            {q.daysSinceSent !== null ? <Stat label={t('Sans réponse depuis')} value={t('{n} j', { n: q.daysSinceSent })} icon="hourglass" tone="warn" /> : null}
          </div>
          {q.approvalRequired ? (
            <Alert tone={q.approval === 'approved' ? 'ok' : q.approval === 'rejected' ? 'danger' : 'warn'} title={t('Validation de la remise : {s}', { s: (L2.approval[q.approval] || q.approval).toLowerCase() })}>
              {q.approvalReason ? t('Motif de la demande : {m}. ', { m: q.approvalReason }) : ''}{q.approvalComment ? t('Commentaire : {m}', { m: q.approvalComment }) : ''}
              {has('quote') && ['none', 'rejected'].includes(q.approval) ? <div className="row"><Button size="sm" onClick={() => ask({ title: t('Demander la validation'), label: t('Motif de la demande'), submit: t('Envoyer la demande'), onSubmit: (v) => run(api('POST', '/quotes/' + id + '/request-approval', { reason: v }), t('Validation demandée.')) })}>{t('Demander la validation')}</Button></div> : null}
              {has('approve') && q.approval === 'pending' ? <div className="row">
                <Button size="sm" variant="primary" onClick={() => run(api('POST', '/quotes/' + id + '/decide', { decision: 'approve' }), t('Remise validée.'))}>{t('Valider la remise')}</Button>
                <Button size="sm" variant="danger-outline" onClick={() => ask({ title: t('Refuser la remise'), label: t('Raison du refus'), submit: t('Refuser la remise'), required: true, onSubmit: (v) => run(api('POST', '/quotes/' + id + '/decide', { decision: 'reject', comment: v }), t('Remise refusée.')) })}>{t('Refuser la remise')}</Button></div> : null}
            </Alert>
          ) : null}
          <Table caption={t('Lignes du devis')} rowKey="label" columns={lineCols} rows={q.lines} />
          <Facts items={[[t('Conditions'), q.conditions], [t('Créé par'), q.createdBy], [t('Envoyé le'), q.sentAt ? dateFr(q.sentAt) : ''], [t('Consulté par le client le'), q.viewedAt ? dateFr(q.viewedAt) : ''],
            [t('Accepté le'), q.acceptedAt ? dateFr(q.acceptedAt) + (q.acceptedName ? ' — ' + q.acceptedName : '') : ''], [t('Refusé le'), q.refusedAt ? dateFr(q.refusedAt) + (q.refuseReason ? ' — ' + q.refuseReason : '') : '']]} />
          <div className="row cp-actions">
            {editable ? <Button size="sm" onClick={() => modal(t('Modifier le devis'), (close) => <QuoteForm pre={q} close={close} onSaved={() => { st.reload(); bump(); }} />, { wide: true })}>{t('Modifier')}</Button> : null}
            {sendable ? <Button size="sm" variant="primary" icon="paper-plane" onClick={() => confirm(t('Marquer ce devis comme envoyé ?'), () => run(api('PUT', '/crm/documents/' + id, { status: 'sent' }), t('Devis marqué comme envoyé.')))}>{t('Marquer comme envoyé')}</Button> : null}
            {has('quote') && ['draft', 'sent'].includes(q.status) ? <Button size="sm" icon="link" onClick={link}>{q.hasLink ? t("Copier le lien d'acceptation") : t("Créer le lien d'acceptation")}</Button> : null}
            {has('quote') && q.hasLink ? <Button size="sm" variant="ghost" onClick={() => run(api('DELETE', '/quotes/' + id + '/link'), t('Lien désactivé.'))}>{t('Désactiver le lien')}</Button> : null}
            {has('quote') && ['draft', 'sent'].includes(q.status) ? <Button size="sm" onClick={() => ask({ title: t('Prolonger la validité'), label: t('Nombre de jours à partir d’aujourd’hui'), submit: t('Prolonger'), onSubmit: (v) => run(api('POST', '/quotes/' + id + '/extend', { days: Number(v) || 15 }), t('Validité prolongée.')) })}>{t('Prolonger')}</Button> : null}
            {has('quote') ? <Button size="sm" onClick={() => api('POST', '/quotes/' + id + '/version', {}).then((r) => { toast(t('Nouvelle version créée.')); bump(); openDrawer('quote', r.id); }, fail)}>{t('Nouvelle version')}</Button> : null}
            {has('quote') ? <Button size="sm" onClick={() => ask({ title: t('Nouvelle variante'), label: t('Nom de la variante'), submit: t('Créer la variante'), onSubmit: (v) => api('POST', '/quotes/' + id + '/variant', { variant: v }).then((r) => { toast(t('Variante créée.')); bump(); openDrawer('quote', r.id); }, fail) })}>{t('Variante')}</Button> : null}
            {has('activity') && q.status === 'sent' ? <Button size="sm" icon="paper-plane" onClick={() => run(api('POST', '/quotes/' + id + '/followup', {}), t('Relance démarrée : elle apparaît dans Relances.'))}>{t('Relancer')}</Button> : null}
            {has('write') && q.status === 'sent' ? <><Button size="sm" onClick={() => run(api('PUT', '/crm/documents/' + id, { status: 'accepted' }), t('Devis marqué comme accepté.'))}>{t('Marquer accepté')}</Button>
              <Button size="sm" onClick={() => run(api('PUT', '/crm/documents/' + id, { status: 'refused' }), t('Devis marqué comme refusé.'))}>{t('Marquer refusé')}</Button></> : null}
            {can('manager') && ['sent', 'accepted'].includes(q.status) && !st.data.chain.orders.length ? <Button size="sm" variant="primary" onClick={() => run(api('POST', '/crm/documents/' + id + '/order', {}), t('Commande créée.'))}>{t('Transformer en commande')}</Button> : null}
            {can('manager') && q.status === 'accepted' && !st.data.chain.orders.length && !st.data.chain.invoices.length ? <Button size="sm" onClick={() => run(api('POST', '/crm/documents/' + id + '/convert', {}), t('Facture créée.'))}>{t('Facturer directement')}</Button> : null}
          </div>
          <h3>{t('Chaîne de suivi')}</h3>
          <ol className="cp-chain">
            <li><b>{t('Devis')}</b> {q.number} <Badge tone={tone2(q.status)}>{L2.quoteStatus[q.status] || q.status}</Badge></li>
            {st.data.chain.orders.map((o) => <li key={o.id}><b>{t('Commande')}</b> {o.number} · {money(o.total)}</li>)}
            {st.data.chain.invoices.map((o) => <li key={o.id}><b>{t('Facture')}</b> {o.number} · {money(o.total)} · {t('payé {p}', { p: money(o.paid) })}</li>)}
          </ol>
          {st.data.versions.length > 1 ? (
            <>
              <h3>{t('Versions et variantes')}</h3>
              <ul className="cp-list">{st.data.versions.map((v) => (
                <li key={v.id} className="cp-item"><button type="button" className="cp-link grow" onClick={() => openDrawer('quote', v.id)}><b>{v.number}</b> · v{v.version}{v.variant ? ' · ' + v.variant : ''}{v.id === id ? ' · ' + t('affiché') : ''}</button>
                  <Badge tone={tone2(v.status)}>{L2.quoteStatus[v.status] || v.status}</Badge>{v.superseded ? <Badge>{t('Remplacée')}</Badge> : null}<b>{money(v.total)}</b></li>
              ))}</ul>
            </>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
