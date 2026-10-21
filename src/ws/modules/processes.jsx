import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Fonctionnement (procédures : comment l'activité tourne, étape par étape). */

export default function Processes() {
  const { oapi, can, modal, confirm, propose, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/structure/processes'), []);
  const load = st.reload;

  const edit = (p0) => {
    const p = p0 || {};
    modal(p.id ? 'Modifier la procédure' : 'Nouvelle procédure', (close) => (
      <Form
        fields={[
          { k: 'title', label: 'Titre', required: true, value: p.title },
          { k: 'category', label: 'Catégorie', value: p.category, placeholder: 'Ventes, Accueil, Stock…' },
          { k: 'steps', label: 'Étapes (une par ligne)', type: 'textarea', rows: 8, required: true, value: (p.steps || []).join('\n') },
        ]}
        submitText="Enregistrer"
        onSubmit={(v) => {
          const body = { title: v.title, category: v.category, steps: v.steps.split('\n').map((s) => s.trim()).filter(Boolean) };
          return oapi(p.id ? 'PUT' : 'POST', '/structure/processes' + (p.id ? '/' + p.id : ''), body).then(() => { close(); load(); });
        }}
      />
    ));
  };

  const aiDraft = () => {
    modal('Procédure rédigée par l\'IA', (close) => (
      <Form
        fields={[{ k: 'topic', label: 'Quelle procédure ?', required: true, placeholder: 'Ex : accueillir et encaisser un client en boutique' }]}
        submitText="Rédiger"
        onSubmit={(v) => {
          close();
          propose('process-draft', { topic: v.topic }, {
            title: 'Procédure proposée',
            applyText: 'Enregistrer cette procédure',
            render: (p) => (
              <>
                <h3>{p.title}</h3>
                {p.category ? <p className="muted small">{p.category}</p> : null}
                <ol>{(p.steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
              </>
            ),
            done: load,
          });
        }}
      />
    ));
  };

  const j = st.data;
  const groups = {};
  if (j) j.processes.forEach((p) => { const k = p.category || 'Général'; (groups[k] = groups[k] || []).push(p); });

  return (
    <>
      <div className="ws-head">
        <div><h1>Fonctionnement</h1><p className="muted">Les procédures de votre activité, pour que tout tourne même en votre absence.</p></div>
        {can('admin') ? (
          <div className="row">
            <button className="btn signal small" type="button" onClick={aiDraft}>Rédiger avec l'IA</button>
            <button className="btn primary small" type="button" onClick={() => edit()}>Nouvelle procédure</button>
          </div>
        ) : null}
      </div>
      <div>
        {st.loading ? <Loading /> : null}
        {!st.loading && st.error ? <p className="ws-err" role="alert">{st.error.message}</p> : null}
        {!st.loading && j && !j.processes.length ? <Empty text={can('admin') ? 'Aucune procédure. Demandez à l\'IA d\'en rédiger une (accueil client, ouverture de la boutique, gestion du stock…).' : 'Aucune procédure pour l\'instant.'} /> : null}
        {!st.loading && j ? Object.keys(groups).map((cat) => (
          <div className="ws-card" key={cat}>
            <h2>{cat}</h2>
            {groups[cat].map((p) => (
              <details className="proc" key={p.id}>
                <summary>{p.title}<small>{' · ' + p.steps.length + ' étapes'}</small></summary>
                <ol>{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                {can('admin') ? (
                  <div className="row">
                    <button className="btn small" type="button" onClick={() => edit(p)}>Modifier</button>
                    <button className="btn small" type="button" onClick={() => confirm('Supprimer cette procédure ?', () => { oapi('DELETE', '/structure/processes/' + p.id).then(load).catch(fail); })}>Supprimer</button>
                  </div>
                ) : null}
              </details>
            ))}
          </div>
        )) : null}
      </div>
    </>
  );
}
