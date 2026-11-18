import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Button, Card, Loading, Segmented, useLoad } from '../../ui.jsx';
import { TaskForm, TaskList } from './Panels.jsx';
import { Failed, qs, useCp } from './common.jsx';

/* Tâches et rappels : les miennes (ou toute l'équipe pour qui n'est pas commercial terrain), en retard en rouge, à cocher quand c'est fait. */

export default function Tasks() {
  const t = useT();
  const { api, fail, me, tick, bump, has, screen } = useCp();
  const { modal } = useWs();
  const [scope, setScope] = useState(screen.params.scope || 'mine');
  const [status, setStatus] = useState('open');
  const st = useLoad(() => api('GET', '/tasks' + qs({ mine: scope === 'mine', status: status === 'all' ? '' : status })), [scope, status, tick]);
  const toggle = (k) => api('PUT', '/tasks/' + k.id, { status: k.status === 'done' ? 'open' : 'done' }).then(() => { st.reload(); bump(); }, fail);
  const del = (k) => api('DELETE', '/tasks/' + k.id).then(() => { st.reload(); bump(); }, fail);
  const add = () => modal(t('Nouvelle tâche'), (close) => <TaskForm close={close} onSaved={() => { st.reload(); bump(); }} />);
  return (
    <Card title={t('Tâches et rappels')} actions={has('write') ? <Button variant="primary" icon="plus" onClick={add}>{t('Nouvelle tâche')}</Button> : null}>
      <div className="row cp-bar">
        {!me.scopeOwn ? <Segmented label={t('Qui')} value={scope} onChange={setScope} items={[{ id: 'mine', label: t('Mes tâches') }, { id: 'all', label: t("Toute l'équipe") }]} /> : null}
        <Segmented label={t('État')} value={status} onChange={setStatus} items={[{ id: 'open', label: t('À faire') }, { id: 'done', label: t('Faites') }, { id: 'all', label: t('Toutes') }]} />
      </div>
      {st.error ? <Failed e={st.error} /> : !st.data ? <Loading /> : (
        <>
          {st.data.overdue ? <Alert tone="danger">{t('{n} tâche(s) en retard.', { n: st.data.overdue })}</Alert> : null}
          <TaskList tasks={st.data.tasks} onToggle={toggle} onDelete={del} showWho={scope === 'all'} />
        </>
      )}
    </Card>
  );
}
