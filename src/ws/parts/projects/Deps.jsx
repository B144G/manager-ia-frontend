import { useNavigate } from 'react-router-dom';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Alert, Badge, Button, Card, EmptyState } from '../../ui/index.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import '../../../styles/ws-ro.css';

/* Projets · dépendances (fin-début, début-début, fin-fin, début-fin, avec décalage ; externes : fournisseur, client, autorisation),
   détection des boucles et des incohérences, et outils conseillés selon les risques et les dépendances du projet. */

const TYPE = (t) => ({ FS: t('Fin → début'), SS: t('Début → début'), FF: t('Fin → fin'), SF: t('Début → fin') });
const TYPE_HELP = (t) => ({ FS: t('B commence quand A est terminée'), SS: t('B commence quand A commence'), FF: t('B se termine quand A se termine'), SF: t('B se termine quand A commence') });
const EXT = (t) => ({ supplier: t('Fournisseur'), client: t('Client'), authorization: t('Autorisation'), other: t('Autre') });
const EXT_ST = (t) => ({ pending: t('En attente'), received: t('Reçu'), blocked: t('Bloqué') });

/** Phrase lisible pour chaque problème détecté (le serveur envoie un code et des valeurs). */
export function issueText(i, t, dateFr) {
  const p = i.params || {};
  switch (i.code) {
    case 'cycle': return t('Dépendance circulaire : {chain}. Aucune de ces tâches ne pourra commencer.', { chain: p.chain });
    case 'self': return t('« {a} » dépend d\'elle-même.', { a: p.a });
    case 'duplicate': return t('Le lien « {a} → {b} » existe en double.', { a: p.a, b: p.b });
    case 'missing': return t('Un lien pointe vers une tâche qui n\'existe plus.');
    case 'dates': return t('Dates incohérentes : « {b} » est prévue trop tôt par rapport à « {a} » (lien {type}). Elle ne devrait pas commencer ou finir avant le {need}.', { a: p.a, b: p.b, type: (TYPE(t)[p.type] || p.type), need: dateFr(p.need) });
    case 'doneBefore': return t('« {b} » est terminée alors que « {a} », dont elle dépend, ne l\'est pas.', { a: p.a, b: p.b });
    case 'startedBefore': return t('« {b} » a commencé avant que « {a} » soit commencée.', { a: p.a, b: p.b });
    case 'extMissing': return t('L\'attente « {title} » est liée à une tâche supprimée.', { title: p.title });
    case 'extBlocked': return t('Attente bloquée : « {title} ».', { title: p.title });
    case 'extLate': return t('« {title} » était attendu le {date} et n\'est pas arrivé.', { title: p.title, date: dateFr(p.date) });
    case 'extAfterStart': return t('« {title} » est attendu le {date}, après le début de « {task} » ({start}).', { title: p.title, date: dateFr(p.date), task: p.task, start: dateFr(p.start) });
    case 'extUnlinked': return t('« {title} » n\'est reliée à aucune tâche : on ne sait pas ce qu\'elle bloque.', { title: p.title });
    default: return i.code;
  }
}

/** Texte de chaque conseil d'outil. */
const ADVICE = (t, p) => ({
  depsCycle: [t('Corrigez d\'abord les dépendances circulaires'), t('Tant qu\'une boucle existe, ni le PERT ni le planning ne sont fiables : {n} problème(s).', p)],
  depsInconsistent: [t('Mettez les dates et les liens d\'accord'), t('{n} incohérence(s) entre vos dates, vos liens et vos attentes externes.', p)],
  depsMany: [t('Beaucoup de dépendances : utilisez le PERT et le chemin critique'), t('{links} liens entre {tasks} tâches : seul un réseau PERT montre quelles tâches ne doivent surtout pas glisser.', p)],
  depSupplier: [t('Un fournisseur conditionne le projet : préparez un plan B'), t('{n} livraison(s) attendue(s). Comparez des fournisseurs et fixez des délais dans les Achats.', p)],
  depClient: [t('Une réponse du client est attendue'), t('{n} attente(s) côté client : placez-les comme jalons dans la planification et relancez à date fixe.', p)],
  depAuthorization: [t('Une autorisation est nécessaire'), t('{n} autorisation(s) à obtenir : ajoutez un jalon et anticipez les délais de l\'administration.', p)],
  riskDelay: [t('Risque de délai : regardez les marges et lancez la simulation'), t('{n} risque(s) de délai : le PERT montre les marges et la probabilité de tenir la date.', p)],
  riskCost: [t('Risque de coût : suivez la courbe en S et la valeur acquise'), t('{n} risque(s) de coût : le pilotage compare ce qui est dépensé à ce qui est produit.', p)],
  riskResource: [t('Risque de ressource : regardez l\'histogramme de charge'), t('{n} risque(s) de ressource : la charge par personne et par semaine montre les surcharges.', p)],
  riskSupplier: [t('Risque fournisseur : plan B et achats'), t('{n} risque(s) fournisseur : comparez les prix et délais de plusieurs fournisseurs.', p)],
  riskQuality: [t('Risque de qualité : vérifiez vos points de contrôle'), t('{n} risque(s) de qualité : contrôlez l\'avancement et, en production, le circuit.', p)],
  optimSale: [t('Projet de vente : trouvez le meilleur prix et le meilleur mélange'), t('Le système calcule la marge maximale sous vos contraintes (matières, heures, demande).', p)],
  optimProduction: [t('Projet de production : trouvez le coût le plus bas'), t('Le système répartit la production entre vos moyens pour minimiser le coût.', p)],
  riskCostOptim: [t('Testez vos hypothèses de coût dans l\'optimisation'), t('Comparez des scénarios pour voir l\'effet d\'une hausse des coûts.', p)],
  productionFlow: [t('Vérifiez votre circuit de production'), t('Le système cherche les failles de votre circuit : goulots, étapes sans responsable, contrôle qualité.', p)],
});
const OPEN = (t) => ({ pert: t('Ouvrir le PERT'), pilot: t('Ouvrir le pilotage'), workload: t('Ouvrir la charge'), purchasing: t('Ouvrir les Achats'), planning: t('Ouvrir la planification'), optim: t('Ouvrir l\'optimisation'), deps: t('Voir les dépendances'), flow: t('Ouvrir le circuit') });

export function Advice({ id, openTool, reloadKey }) {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', `/projects/${id}/advice`), [id, reloadKey]);
  return (
    <Card title={t('Outils conseillés pour ce projet')} subtitle={t('Choisis selon vos risques et vos dépendances.')}>
      <Loaded state={st}>{(d) => (!d.items.length
        ? <p className="muted">{t('Aucun conseil pour l\'instant. Ajoutez des risques (avec leur catégorie) et des dépendances : le système proposera l\'outil adapté.')}</p>
        : (
          <div className="ro-advice">{d.items.map((a) => {
            const x = ADVICE(t, a.params)[a.code] || [a.code, ''];
            return (
              <div className="ro-adv" key={a.code}>
                <div><b>{x[0]}</b><p className="muted small">{x[1]}</p></div>
                <div><Button size="sm" variant={a.priority === 1 ? 'primary' : 'secondary'} onClick={() => openTool(a.tool)}>{OPEN(t)[a.tool] || t('Ouvrir')}</Button></div>
              </div>
            );
          })}</div>
        ))}
      </Loaded>
    </Card>
  );
}

export function Dependencies({ id, onChange }) {
  const t = useT();
  const { oapi, can, modal, confirm, fail, dateFr, toast } = useWs();
  const st = useLoad(() => oapi('GET', `/projects/${id}/deps`), [id]);
  const again = () => { st.reload(); if (onChange) onChange(); };
  const tasksOpt = (d) => d.tasks.map((x) => [String(x.id), x.title]);
  const addLink = (d) => modal(t('Nouvelle dépendance entre tâches'), (close) => (
    <Form
      fields={[
        { k: 'predId', label: t('Tâche précédente (A)'), type: 'select', options: tasksOpt(d) },
        { k: 'succId', label: t('Tâche suivante (B)'), type: 'select', options: tasksOpt(d), value: d.tasks[1] ? String(d.tasks[1].id) : undefined },
        { k: 'type', label: t('Type de lien'), type: 'select', options: Object.keys(TYPE(t)).map((k) => [k, TYPE(t)[k] + ' — ' + TYPE_HELP(t)[k]]) },
        { k: 'lag', label: t('Décalage en jours (négatif = chevauchement)'), type: 'number', value: '0' },
      ]}
      submitText={t('Ajouter')}
      onSubmit={(v) => oapi('POST', `/projects/${id}/deps`, { kind: 'task', predId: v.predId, succId: v.succId, type: v.type, lag: v.lag === '' ? 0 : v.lag }).then((r) => { close(); again(); if (r.issues.length) toast(t('Attention : ce lien crée une boucle.')); })}
    />
  ));
  const extFields = (x) => [
    { k: 'title', label: t('Ce que vous attendez'), required: true, value: x.title, placeholder: t('Ex : livraison du ciment, permis de construire') },
    { k: 'extKind', label: t('De la part de'), type: 'select', options: Object.entries(EXT(t)), value: x.kind || 'supplier' },
    { k: 'succId', label: t('Tâche bloquée en attendant'), type: 'select', options: [['', t('Aucune')]].concat(tasksOpt(st.data)), value: x.taskId ? String(x.taskId) : '' },
    { k: 'expectedDate', label: t('Date attendue'), type: 'date', value: x.expectedDate || '' },
    { k: 'status', label: t('État'), type: 'select', options: Object.entries(EXT_ST(t)), value: x.status || 'pending' },
  ];
  const editExt = (x) => modal(x.id ? t('Modifier l\'attente') : t('Nouvelle dépendance externe'), (close) => (
    <Form fields={extFields(x)} submitText={t('Enregistrer')}
      onSubmit={(v) => oapi(x.id ? 'PUT' : 'POST', x.id ? `/projects/deps/${x.id}` : `/projects/${id}/deps`, { kind: 'external', title: v.title, extKind: v.extKind, succId: v.succId || null, expectedDate: v.expectedDate || null, status: v.status }).then(() => { close(); again(); })} />
  ));
  return (
    <Card title={t('Dépendances')} subtitle={t('Ce qui doit être fait ou reçu avant qu\'une tâche puisse avancer.')} actions={can('manager') ? <><Button size="sm" icon="plus" onClick={() => st.data && addLink(st.data)}>{t('Lien entre tâches')}</Button><Button size="sm" icon="plus" onClick={() => st.data && editExt({})}>{t('Attente externe')}</Button></> : null}>
      <Loaded state={st}>{(d) => (
        <>
          {d.issues.length ? d.issues.map((i, k) => <Alert key={k} tone={i.severity === 'high' ? 'danger' : 'warn'}>{issueText(i, t, dateFr)}</Alert>) : (d.links.length || d.externals.length ? <Alert tone="ok">{t('Aucune boucle ni incohérence détectée.')}</Alert> : null)}
          {!d.links.length && !d.externals.length ? <EmptyState icon="flag" title={t('Aucune dépendance')}>{t('Ajoutez les liens entre vos tâches et ce que vous attendez de vos fournisseurs, clients ou de l\'administration.')}</EmptyState> : null}
          {d.links.length ? (
            <div className="bp-scroll"><table className="bp-table">
              <thead><tr><th>{t('Tâche précédente (A)')}</th><th>{t('Tâche suivante (B)')}</th><th>{t('Lien')}</th><th>{t('Décalage')}</th><th>{''}</th></tr></thead>
              <tbody>{d.links.map((l, k) => (
                <tr key={k}><td>{l.pred}</td><td>{l.succ}</td><td title={TYPE_HELP(t)[l.type]}>{TYPE(t)[l.type]}</td><td>{l.lag ? `${l.lag > 0 ? '+' : ''}${l.lag} ${t('j')}` : '—'}</td>
                  <td>{can('manager') ? <button className="link" type="button" onClick={() => confirm(t('Supprimer ce lien ?'), () => (l.id ? oapi('DELETE', `/projects/deps/${l.id}`) : oapi('DELETE', `/projects/${id}/links/${l.succId}`)).then(again).catch(fail))}>{t('Supprimer')}</button> : null}</td></tr>
              ))}</tbody>
            </table></div>
          ) : null}
          {d.externals.length ? (
            <div className="bp-scroll" style={{ marginTop: 12 }}><table className="bp-table">
              <thead><tr><th>{t('Attente externe')}</th><th>{t('De la part de')}</th><th>{t('Bloque')}</th><th>{t('Date attendue')}</th><th>{t('État')}</th><th>{''}</th></tr></thead>
              <tbody>{d.externals.map((x) => (
                <tr key={x.id}><td><b>{x.title}</b></td><td>{EXT(t)[x.kind] || t('Autre')}</td><td>{x.task || '—'}</td><td>{x.expectedDate ? dateFr(x.expectedDate) : '—'}</td>
                  <td><Badge tone={x.status === 'received' ? 'ok' : x.status === 'blocked' ? 'danger' : 'warn'} dot>{EXT_ST(t)[x.status]}</Badge></td>
                  <td>{can('manager') ? <><button className="link" type="button" onClick={() => editExt(x)}>{t('Modifier')}</button>{' '}<button className="link" type="button" onClick={() => confirm(t('Supprimer cette attente ?'), () => oapi('DELETE', `/projects/deps/${x.id}`).then(again).catch(fail))}>{t('Supprimer')}</button></> : null}</td></tr>
              ))}</tbody>
            </table></div>
          ) : null}
        </>
      )}
      </Loaded>
    </Card>
  );
}

/** Ouvre l'outil conseillé : onglet du projet, ou autre module. */
export function useOpenTool(setView, orgId) {
  const navigate = useNavigate();
  return (tool) => {
    const view = { pert: 'pert', pilot: 'pilot', workload: 'follow', planning: 'plan', optim: 'optim', deps: 'risks' }[tool];
    if (view) { setView(view); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (tool === 'purchasing') navigate(`/app/${orgId}/purchasing`);
    else if (tool === 'flow') navigate(`/app/${orgId}/production`);
  };
}
