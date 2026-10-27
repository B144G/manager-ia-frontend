import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { useWs } from '../../WsContext.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN } from './common.jsx';

/* Agents · vague 3 : boutons « créer la tâche » / « créer la relance » (avec confirmation humaine) et lancement planifié du digest. */

export function ActionButtons({ x }) {
  const t = useT();
  const { oapi, confirm, modal, toast, fail, can } = useWs();
  const [done, setDone] = useState('');
  const createTask = () => confirm(t('Créer la tâche « {title} » ? L’IA ne crée rien seule : vous validez.', { title: x.title }), () => {
    oapi('POST', '/agents/actions', { type: 'task', title: x.title, why: x.why || '', confirm: true }).then(() => { setDone(t('Tâche créée')); toast(t('Tâche créée.')); }).catch(fail);
  }, t('Créer la tâche'));
  const createFollow = () => oapi('GET', '/crm/customers').then((j) => modal(t('Créer la relance'), (close) => (
    <Form
      fields={[{ k: 'customerId', label: t('Client à relancer'), type: 'select', options: j.customers.map((c) => [String(c.id), c.name]) }, { k: 'dueInDays', label: t('Dans combien de jours ?'), value: '2' }]}
      submitText={t('Créer la relance')}
      onSubmit={(f) => oapi('POST', '/agents/actions', { type: 'followup', title: x.title, why: x.why || '', customerId: Number(f.customerId), dueInDays: f.dueInDays, confirm: true }).then(() => { close(); setDone(t('Relance créée')); toast(t('Relance créée.')); })}
    />
  ))).catch(fail);
  if (done) return <small className="pill">{done}</small>;
  return (
    <span className="row">
      <button className="btn small" type="button" style={BTN} onClick={createTask}>{t('Créer la tâche')}</button>
      {can('manager') ? <button className="btn small" type="button" style={BTN} onClick={createFollow}>{t('Créer la relance')}</button> : null}
    </span>
  );
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export function Schedule() {
  const t = useT();
  const { oapi, toast, fail, can } = useWs();
  const st = useLoad(() => oapi('GET', '/agents/schedule'), []);
  const [s, setS] = useState(null);
  useEffect(() => { if (st.data) setS(st.data.schedule); }, [st.data]);
  if (!can('manager')) return null;
  return (
    <div className="ws-card">
      <h2>{t('Digest planifié')}</h2>
      <Loaded state={st}>{(j) => (s ? (
        <>
          <p className="muted small">{j.note}</p>
          <label style={{ display: 'flex', gap: 8, minHeight: 44, alignItems: 'center' }}><input type="checkbox" disabled={!can('admin')} checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} style={{ width: 24, height: 24 }} />{t('Lancer automatiquement le digest de l’agent Direction')}</label>
          <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <select aria-label={t('Jour')} style={{ fontSize: 16 }} disabled={!can('admin')} value={s.weekday} onChange={(e) => setS({ ...s, weekday: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={i} value={i}>{t(d)}</option>)}<option value={7}>{t('Tous les jours')}</option></select>
            <input aria-label={t('Heure')} style={{ fontSize: 16, width: 90 }} inputMode="numeric" disabled={!can('admin')} value={s.hour} onChange={(e) => setS({ ...s, hour: e.target.value })} />
            <span className="muted small">{t('h (heure locale)')}</span>
          </div>
          {s.lastRun ? <p className="muted small">{t('Dernier lancement : {d} ({status})', { d: s.lastRun, status: s.lastStatus || '—' })}</p> : null}
          {can('admin') ? (
            <div className="row">
              <button className="btn primary small" type="button" style={BTN} onClick={() => oapi('PUT', '/agents/schedule', { enabled: s.enabled, weekday: s.weekday, hour: Number(s.hour), agentKey: s.agentKey }).then(() => toast(t('Enregistré.'))).catch(fail)}>{t('Enregistrer')}</button>
              <button className="btn small" type="button" style={BTN} onClick={() => oapi('POST', '/agents/schedule/run', {}).then((r) => { toast(r.status === 'ok' ? t('Digest créé : voyez vos notifications.') : t('Digest non créé : {why}', { why: r.status }), r.status !== 'ok'); st.reload(); }).catch(fail)}>{t('Lancer maintenant')}</button>
            </div>
          ) : null}
        </>
      ) : null)}
      </Loaded>
    </div>
  );
}
