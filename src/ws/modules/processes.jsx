import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Fonctionnement (procédures : comment l'activité tourne, étape par étape). */

export default function Processes() {
  const { oapi, can, modal, confirm, propose, fail } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/structure/processes'), []);
  const load = st.reload;

  const edit = (p0) => {
    const p = p0 || {};
    modal(p.id ? t('Modifier la procédure') : t('Nouvelle procédure'), (close) => (
      <Form
        fields={[
          { k: 'title', label: t('Titre'), required: true, value: p.title },
          { k: 'category', label: t('Catégorie'), value: p.category, placeholder: t('Ventes, Accueil, Stock…') },
          { k: 'steps', label: t('Étapes (une par ligne)'), type: 'textarea', rows: 8, required: true, value: (p.steps || []).join('\n') },
        ]}
        submitText={t('Enregistrer')}
        onSubmit={(v) => {
          const body = { title: v.title, category: v.category, steps: v.steps.split('\n').map((s) => s.trim()).filter(Boolean) };
          return oapi(p.id ? 'PUT' : 'POST', '/structure/processes' + (p.id ? '/' + p.id : ''), body).then(() => { close(); load(); });
        }}
      />
    ));
  };

  const aiDraft = () => {
    modal(t("Procédure rédigée par l'IA"), (close) => (
      <Form
        fields={[{ k: 'topic', label: t('Quelle procédure ?'), required: true, placeholder: t('Ex : accueillir et encaisser un client en boutique') }]}
        submitText={t('Rédiger')}
        onSubmit={(v) => {
          close();
          propose('process-draft', { topic: v.topic }, {
            title: t('Procédure proposée'),
            applyText: t('Enregistrer cette procédure'),
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
  if (j) j.processes.forEach((p) => { const k = p.category || t('Général'); (groups[k] = groups[k] || []).push(p); });

  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Fonctionnement')}</h1><p className="muted">{t('Les procédures de votre activité, pour que tout tourne même en votre absence.')}</p></div>
        {can('admin') ? (
          <div className="row">
            <button className="btn signal small" type="button" onClick={aiDraft}>{t("Rédiger avec l'IA")}</button>
            <button className="btn primary small" type="button" onClick={() => edit()}>{t('Nouvelle procédure')}</button>
          </div>
        ) : null}
      </div>
      <div>
        {st.loading ? <Loading /> : null}
        {!st.loading && st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : null}
        {!st.loading && j && !j.processes.length ? <Empty text={can('admin') ? t("Aucune procédure. Demandez à l'IA d'en rédiger une (accueil client, ouverture de la boutique, gestion du stock…).") : t("Aucune procédure pour l'instant.")} /> : null}
        {!st.loading && j ? Object.keys(groups).map((cat) => (
          <div className="ws-card" key={cat}>
            <h2>{cat}</h2>
            {groups[cat].map((p) => (
              <details className="proc" key={p.id}>
                <summary>{p.title}<small>{' · ' + (p.steps.length > 1 ? t('{n} étapes', { n: p.steps.length }) : t('{n} étape', { n: p.steps.length }))}</small></summary>
                <ol>{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                {can('admin') ? (
                  <div className="row">
                    <button className="btn small" type="button" onClick={() => edit(p)}>{t('Modifier')}</button>
                    <button className="btn small" type="button" onClick={() => confirm(t('Supprimer cette procédure ?'), () => { oapi('DELETE', '/structure/processes/' + p.id).then(load).catch(fail); })}>{t('Supprimer')}</button>
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
