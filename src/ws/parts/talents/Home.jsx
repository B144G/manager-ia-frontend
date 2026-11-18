import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Loaded, Stat, useLoad } from '../../ui.jsx';
import { Bar, Panel, pct, useAct, useTl } from './common.jsx';

/* Mon espace : ce qui concerne la personne connectée (objectifs, questionnaires 360° à remplir, enquêtes ouvertes, actions de développement). */
export default function Home({ go }) {
  const t = useT();
  const { dateFr } = useWs();
  const { tp, me } = useTl();
  const act = useAct();
  const scores = useLoad(() => tp('GET', '/goals-scores'), []);
  const todo = useLoad(() => tp('GET', '/360/todo'), []);
  const surveys = useLoad(() => tp('GET', '/engagement/surveys'), []);
  const acts = useLoad(() => tp('GET', '/actions'), []);
  const mineScore = (s) => (me && me.employee ? s.items.find((i) => i.employeeId === me.employee.id) : null);
  return (
    <div className="tl-grid">
      {!me || !me.employee ? <Panel title={t('Bienvenue')}><p>{t("Votre compte n'est lié à aucune fiche employé : demandez à la RH de relier votre compte pour voir vos objectifs, évaluations et formations.")}</p></Panel> : null}
      <div className="tl-kpis">
        <Loaded state={scores}>{(s) => { const m = mineScore(s); return <Stat label={t('Mon score de réalisation')} value={m ? pct(m.score) : '—'} sub={m ? t('{n} objectif(s)', { n: m.goals }) : t('Aucun objectif actif')} onClick={() => go('goals')} />; }}</Loaded>
        <Stat label={t('Questionnaires 360° à remplir')} value={todo.data ? todo.data.items.filter((x) => x.status !== 'done').length : '…'} onClick={() => go('r360')} />
        <Stat label={t('Enquêtes ouvertes')} value={surveys.data ? surveys.data.items.filter((x) => x.status === 'open' && !x.answered).length : '…'} onClick={() => go('engagement')} />
      </div>
      <Panel title={t('Mes actions')}>
        <Loaded state={acts}>{(a) => (!a.items.length ? <p className="ws-empty">{t('Aucune action en cours.')}</p> : a.items.filter((x) => x.status !== 'cancelled').slice(0, 10).map((x) => (
          <div className="tl-row" key={x.id}><span><b>{x.title}</b> <small className="tl-note">{[x.dueDate ? dateFr(x.dueDate) : '', x.employee].filter(Boolean).join(' · ')}</small></span>
            {x.status === 'done' ? <Badge tone="ok">{t('Fait')}</Badge> : <Button size="sm" onClick={() => act(tp('PUT', '/actions/' + x.id, { status: 'done' }), acts.reload)}>{t('Marquer comme fait')}</Button>}</div>
        )))}
        </Loaded>
      </Panel>
      <Loaded state={scores}>{(s) => { const m = mineScore(s); return m ? <Panel title={t('Mon avancement')}><Bar value={m.score} /></Panel> : null; }}</Loaded>
    </div>
  );
}
