import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { useEffect, useState } from 'react';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Fonctionnement (procédures : comment l'activité tourne, étape par étape). */

export default function Processes() {
  const { oapi, can, modal, confirm, propose, fail, toast, dateFr, info } = useWs();
  const t = useT();
  const [members, setMembers] = useState([]);
  useEffect(() => { let off = false; oapi('GET', '/members').then((j) => { if (!off) setMembers(j.members); }, () => {}); return () => { off = true; }; }, [oapi]);
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
          { k: 'ownerId', label: t('Propriétaire de la procédure'), type: 'select', options: [['', t('Personne')]].concat(members.map((m) => [String(m.userId), m.name])), value: p.ownerId ? String(p.ownerId) : '' },
          { k: 'reviewMonths', label: t('Réviser tous les (mois, 0 = jamais)'), value: p.reviewMonths || 0 },
        ]}
        submitText={t('Enregistrer')}
        onSubmit={(v) => {
          const body = { title: v.title, category: v.category, steps: v.steps.split('\n').map((s) => s.trim()).filter(Boolean), ownerId: v.ownerId || null, reviewMonths: v.reviewMonths || 0 };
          return oapi(p.id ? 'PUT' : 'POST', '/structure/processes' + (p.id ? '/' + p.id : ''), body).then(() => { close(); load(); });
        }}
      />
    ));
  };

  const versions = (p) => modal(t('Versions de « {title} »', { title: p.title }), () => <Versions id={p.id} />, { wide: true });
  const reads = (p) => modal(t('Accusés de lecture'), () => <Reads id={p.id} />);
  const markRead = (p) => oapi('POST', '/structure/processes/' + p.id + '/read', {}).then(() => { toast(t('Lecture enregistrée.')); load(); }).catch(fail);
  const reviewed = (p) => oapi('POST', '/structure/processes/' + p.id + '/reviewed', {}).then(() => { toast(t('Révision validée.')); load(); }).catch(fail);

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
                <summary>{p.title}<small>{' · ' + (p.steps.length > 1 ? t('{n} étapes', { n: p.steps.length }) : t('{n} étape', { n: p.steps.length })) + ' · ' + t('version {v}', { v: p.version })}</small>{p.reviewDue ? <span className="pill bad">{t('À réviser')}</span> : null}{!p.readByMe ? <span className="pill mid">{t('À lire')}</span> : null}</summary>
                <ol>{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                <p className="muted small">{[p.owner && t('Propriétaire : {name}', { name: p.owner }), p.nextReview && t('Prochaine révision : {date}', { date: dateFr(p.nextReview) }), t('{n} lecteur(s)', { n: p.readers })].filter(Boolean).join(' · ')}</p>
                <div className="row">
                  {!p.readByMe ? <button className="btn primary small" type="button" style={{ minHeight: 44 }} onClick={() => markRead(p)}>{t('J’ai lu cette version')}</button> : null}
                  <button className="btn small" type="button" style={{ minHeight: 44 }} onClick={() => versions(p)}>{t('Versions')}</button>
                  {can('manager') ? <button className="btn small" type="button" style={{ minHeight: 44 }} onClick={() => reads(p)}>{t('Qui a lu ?')}</button> : null}
                  {p.nextReview && (can('admin') || p.ownerId === info.me.userId) ? <button className="btn small" type="button" style={{ minHeight: 44 }} onClick={() => reviewed(p)}>{t('Révision faite')}</button> : null}
                </div>
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

function Versions({ id }) {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/structure/processes/' + id + '/versions'), [id]);
  if (!st.data) return <Loading />;
  const j = st.data;
  return (
    <>
      <h3>{t('Version {v} (en cours)', { v: j.current.version })}</h3>
      <ol>{j.current.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {j.versions.map((v) => (
        <details key={v.version}>
          <summary>{t('Version {v}', { v: v.version }) + ' · ' + t('remplacée le {date}', { date: dateFr(v.replacedAt) })}</summary>
          <ol>{v.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </details>
      ))}
    </>
  );
}

function Reads({ id }) {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/structure/processes/' + id + '/reads'), [id]);
  if (!st.data) return <Loading />;
  return st.data.items.map((r) => <div className="line" key={r.userId}><b>{r.name}</b><span className={'pill ' + (r.readAt ? '' : 'mid')}>{r.readAt ? t('lu le {date}', { date: dateFr(r.readAt) }) : t('pas encore lu')}</span></div>);
}
