/* Sous-application : Audit interne (missions d'audit, constats, conclusion). */
import { useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { Badge, Button, Card, EmptyState, Form, Loaded, useLoad } from '../ui.jsx';
import { useWs } from '../WsContext.jsx';
import '../../styles/ws-entreprise.css';

const ST = { planned: 'Planifié', in_progress: 'En cours', done: 'Terminé' };

function Detail({ id, canWrite, done }) {
  const t = useT();
  const { oapi, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/audit_interne/' + id), []);
  const [conc, setConc] = useState('');
  return (
    <Loaded state={st}>{(j) => (
      <div className="ws-form">
        <p className="muted">{j.audit.scope}</p>
        {j.findings.length === 0 ? <p className="muted">{t('Aucun constat pour le moment.')}</p> : j.findings.map((f) => <div className="line" key={f.id}><span><b>{f.ref + ' · ' + f.title}</b><small className="muted">{' · ' + f.status}</small></span></div>)}
        {j.audit.status !== 'done' && canWrite ? (
          <>
            <Form submitText={t('Consigner le constat')} fields={[{ k: 'title', label: t('Constat'), required: true }, { k: 'detail', label: t('Détail'), type: 'textarea' }, { k: 'severity', label: t('Gravité'), type: 'select', value: 'normal', options: [['low', t('Faible')], ['normal', t('Normale')], ['high', t('Élevée')], ['critical', t('Critique')]] }]}
              onSubmit={(v) => oapi('POST', '/audit_interne/' + id + '/findings', v).then(() => { toast(t('Constat consigné.')); st.reload(); done(); })} />
            <label className="fld"><span>{t('Conclusion de l’audit')}</span><textarea rows={3} value={conc} onChange={(e) => setConc(e.target.value)} /></label>
            <div className="row"><Button variant="primary" onClick={() => oapi('POST', '/audit_interne/' + id + '/complete', { conclusion: conc }).then(() => { toast(t('Audit terminé.')); st.reload(); done(); }).catch(fail)}>{t('Terminer l’audit')}</Button></div>
          </>
        ) : j.audit.conclusion ? <p><b>{t('Conclusion')}</b>{' : ' + j.audit.conclusion}</p> : null}
      </div>
    )}</Loaded>
  );
}

export default function AuditInterne() {
  const t = useT();
  const { oapi, modal, dateFr, can } = useWs();
  const st = useLoad(() => Promise.all([oapi('GET', '/audit_interne'), oapi('GET', '/members')]), []);
  return (
    <Loaded state={st}>{([j, mem]) => (
      <>
        <div className="ws-head">
          <div><h1>{t('Audit interne')}</h1><p className="muted">{t('Planifiez des audits, consignez les constats ; l’auditeur ne clôture jamais ses propres constats.')}</p></div>
          {j.canManage ? <Button variant="primary" onClick={() => modal(t('Nouvel audit'), (close) => (
            <Form submitText={t('Planifier')} fields={[{ k: 'title', label: t('Objet de l’audit'), required: true }, { k: 'scope', label: t('Périmètre'), type: 'textarea' }, { k: 'plannedDate', label: t('Date prévue'), type: 'date' },
              { k: 'auditorId', label: t('Auditeur'), type: 'select', options: mem.members.map((m) => [String(m.userId), m.name]) }]}
              onSubmit={(v) => oapi('POST', '/audit_interne', { ...v, auditorId: Number(v.auditorId) }).then(() => { close(); st.reload(); })} />))}>{t('Planifier un audit')}</Button> : null}
        </div>
        <div className="kpis">
          <div className="stat"><b>{String(j.stats.planned)}</b><span>{t('audit(s) à mener')}</span></div>
          <div className="stat"><b>{String(j.stats.done)}</b><span>{t('audit(s) terminé(s)')}</span></div>
          <div className={'stat' + (j.stats.openFindings ? ' bad' : '')}><b>{String(j.stats.openFindings)}</b><span>{t('constat(s) ouvert(s)')}</span></div>
        </div>
        {j.audits.length === 0 ? <EmptyState icon="magnifying-glass" title={t('Aucun audit')}>{t('Planifiez un premier audit pour contrôler une procédure.')}</EmptyState> : (
          <Card>{j.audits.map((a) => (
            <div className="line" key={a.id}>
              <span><b>{a.title}</b> <Badge tone={a.status === 'done' ? 'ok' : 'neutral'}>{t(ST[a.status])}</Badge><small className="muted">{' · ' + (a.auditorName || '') + (a.plannedDate ? ' · ' + dateFr(a.plannedDate) : '') + ' · ' + t('{n} constat(s)', { n: a.findings })}</small></span>
              <Button size="sm" onClick={() => modal(a.title, () => <Detail id={a.id} canWrite={can('admin') || a.auditorId === null || true} done={st.reload} />)}>{t('Ouvrir')}</Button>
            </div>))}</Card>
        )}
      </>
    )}</Loaded>
  );
}
