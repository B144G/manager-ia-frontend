/* Sous-application : Qualité, hygiène, sécurité, environnement (incidents, accidents, inspections, non-conformités, réserves, réceptions techniques). */
import { useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { Badge, Button, Card, EmptyState, Form, Loaded, Tabs, useLoad } from '../ui.jsx';
import { useWs } from '../WsContext.jsx';
import '../../styles/ws-entreprise.css';

const KIND = { incident: 'Incidents', accident: 'Accidents du travail', inspection: 'Inspections', nonconformity: 'Non-conformités', snag: 'Réserves', reception: 'Réceptions techniques' };
const KIND_ONE = { incident: 'Incident', accident: 'Accident du travail', inspection: 'Inspection', nonconformity: 'Non-conformité', snag: 'Réserve', reception: 'Réception technique' };
const SEV = { low: 'Faible', normal: 'Normale', high: 'Élevée', critical: 'Critique' };
const TONE = { low: 'neutral', normal: 'neutral', high: 'warn', critical: 'bad' };

export function Declare({ kind, close, done }) {
  const t = useT();
  const { oapi, toast } = useWs();
  return (
    <Form submitText={t('Déclarer')} fields={[
      { k: 'kind', label: t('Type de fiche'), type: 'select', value: kind || 'incident', options: Object.keys(KIND_ONE).map((k) => [k, t(KIND_ONE[k])]) },
      { k: 'title', label: t('Titre'), required: true },
      { k: 'place', label: t('Lieu (chantier, atelier…)') },
      { k: 'severity', label: t('Gravité'), type: 'select', value: 'normal', options: Object.keys(SEV).map((k) => [k, t(SEV[k])]) },
      { k: 'persons', label: t('Personnes touchées (accident)'), type: 'number' },
      { k: 'daysLost', label: t('Jours d’arrêt (accident)'), type: 'number' },
      { k: 'detail', label: t('Détail'), type: 'textarea' },
    ]} onSubmit={(v) => oapi('POST', '/qhse', { ...v, persons: Number(v.persons) || 0, daysLost: Number(v.daysLost) || 0 }).then(() => { toast(t('Fiche déclarée.')); close(); done(); })} />
  );
}

function Handle({ x, members, close, done }) {
  const t = useT();
  const { oapi, toast } = useWs();
  return (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'assigneeId', label: t('Responsable de l’action'), type: 'select', value: x.assigneeId ? String(x.assigneeId) : '', options: [['', t('Personne')]].concat(members.map((m) => [String(m.userId), m.name])) },
      { k: 'dueDate', label: t('Échéance'), type: 'date', value: x.dueDate || '' },
      { k: 'status', label: t('Avancement'), type: 'select', value: x.status === 'closed' ? 'open' : x.status, options: [['open', t('Ouverte')], ['in_progress', t('En cours')]] },
      { k: 'corrective', label: t('Action corrective'), type: 'textarea', value: x.corrective },
    ]} onSubmit={(v) => oapi('PUT', '/qhse/' + x.id, { ...v, assigneeId: v.assigneeId ? Number(v.assigneeId) : null }).then(() => { toast(t('Fiche mise à jour.')); close(); done(); })} />
  );
}

export default function Qhse() {
  const t = useT();
  const { oapi, modal, fail, toast, confirm, dateFr } = useWs();
  const [tab, setTab] = useState('all');
  const st = useLoad(() => Promise.all([oapi('GET', '/qhse'), oapi('GET', '/members')]), []);
  const act = (p, m, ok) => oapi('POST', p, m || {}).then(() => { toast(ok); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{([j, mem]) => {
      const s = j.stats;
      const list = j.items.filter((x) => tab === 'all' || x.kind === tab);
      return (
        <>
          <div className="ws-head">
            <div><h1>{t('Qualité, hygiène, sécurité, environnement')}</h1><p className="muted">{t('Incidents, accidents, contrôles, non-conformités, réserves et réceptions : déclarés par tous, clôturés par un responsable autre que le déclarant.')}</p></div>
            <Button variant="primary" onClick={() => modal(t('Déclarer une fiche'), (close) => <Declare kind={tab === 'all' ? '' : tab} close={close} done={st.reload} />)}>{t('Déclarer')}</Button>
          </div>
          <div className="kpis">
            <div className={'stat' + (s.openIncidents ? ' bad' : '')}><b>{String(s.openIncidents)}</b><span>{t('incident(s) et accident(s) ouverts')}</span></div>
            <div className="stat"><b>{String(s.accidents)}</b><span>{t('accident(s) sur 12 mois')}</span></div>
            <div className={'stat' + (s.openNc ? ' bad' : '')}><b>{String(s.openNc)}</b><span>{t('non-conformité(s) ouverte(s)')}</span></div>
            <div className={'stat' + (s.openSnags ? ' bad' : '')}><b>{String(s.openSnags)}</b><span>{t('réserve(s) à lever')}</span></div>
          </div>
          <Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: t('Tout') }, ...j.kinds.map((k) => ({ id: k, label: t(KIND[k]) }))]} />
          {list.length === 0 ? <EmptyState icon="shield-halved" title={t('Aucune fiche')}>{t('Déclarez un incident, une non-conformité ou une réserve pour commencer.')}</EmptyState> : (
            <Card>
              {list.map((x) => (
                <div className="line" key={x.id}>
                  <span><b>{x.ref + ' · ' + x.title}</b> <Badge tone={x.status === 'closed' ? 'ok' : TONE[x.severity]}>{x.status === 'closed' ? t('Clôturée') : t(SEV[x.severity])}</Badge>
                    <small className="muted">{' · ' + t(KIND_ONE[x.kind]) + (x.place ? ' · ' + x.place : '') + (x.assigneeName ? ' · ' + x.assigneeName : '') + (x.dueDate ? ' · ' + t('échéance {d}', { d: dateFr(x.dueDate) }) : '') + (x.kind === 'accident' ? ' · ' + t('{n} jour(s) d’arrêt', { n: x.daysLost }) : '') + ' · ' + t('déclaré par {n}', { n: x.declaredByName })}</small></span>
                  {x.status !== 'closed' && j.canManage ? (
                    <span className="ent-actions">
                      <Button size="sm" onClick={() => modal(x.ref, (close) => <Handle x={x} members={mem.members} close={close} done={st.reload} />)}>{t('Traiter')}</Button>
                      {x.kind === 'reception' && !x.requestId ? <Button size="sm" onClick={() => act('/qhse/' + x.id + '/reception-request', {}, t('Demande de validation envoyée.'))}>{t('Demander la validation')}</Button> : null}
                      <Button size="sm" variant="primary" onClick={() => confirm(t('Clôturer cette fiche ?'), () => act('/qhse/' + x.id + '/close', {}, t('Fiche clôturée.')))}>{t('Clôturer')}</Button>
                    </span>
                  ) : null}
                </div>
              ))}
            </Card>
          )}
        </>
      );
    }}</Loaded>
  );
}
void tsrv;
