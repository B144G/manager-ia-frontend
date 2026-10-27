import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { useWs } from '../WsContext.jsx';
import { Vacancies } from '../parts/w3/TeamExtras.jsx';
import { Empty, Form, Loading, useLoad } from '../ui.jsx';

/* Sous-application : Organisation (fiche de l'organisation, organigramme des postes, complétion par l'IA). */

export default function Structure() {
  const { info, oapi, can, modal, propose, fail, reloadOrg } = useWs();
  const t = useT();
  const org = info.org;
  const [members, setMembers] = useState([]);
  const st = useLoad(() => oapi('GET', '/structure/positions'), []);
  const load = st.reload;
  const positions = st.data ? st.data.positions : [];

  useEffect(() => {
    let off = false;
    oapi('GET', '/members').then((j) => { if (!off) setMembers(j.members); }, () => {});
    return () => { off = true; };
  }, [oapi]);

  const editOrg = () => {
    modal(t("Fiche de l'organisation"), (close) => (
      <Form
        fields={[
          { k: 'name', label: t('Nom'), required: true, value: org.name },
          { k: 'sector', label: t('Secteur'), value: org.sector },
          { k: 'description', label: t("Description de l'activité"), type: 'textarea', rows: 4, value: org.description },
          { k: 'currency', label: t('Monnaie'), value: org.currency },
        ]}
        submitText={t('Enregistrer')}
        onSubmit={(v) => oapi('PUT', '', v).then(() => { close(); reloadOrg(); })}
      />
    ));
  };

  const editPos = (p0, parent) => {
    const p = p0 || {};
    const parents = [['', t('Aucun (sommet)')]].concat(positions.filter((x) => x.id !== p.id).map((x) => [String(x.id), x.title]));
    modal(p.id ? t('Modifier le poste') : t('Nouveau poste'), (close) => (
      <Form
        fields={[
          { k: 'title', label: t('Intitulé du poste'), required: true, value: p.title },
          { k: 'description', label: t('Responsabilités'), type: 'textarea', rows: 3, value: p.description },
          { k: 'parentId', label: t('Rend compte à'), type: 'select', options: parents, value: String(p.parentId || parent || '') },
          { k: 'holderId', label: t('Tenu par'), type: 'select', options: [['', t('Poste libre')]].concat(members.map((m) => [String(m.userId), m.name])), value: p.holderId ? String(p.holderId) : '' },
        ]}
        submitText={t('Enregistrer')}
        onSubmit={(v) => {
          const body = { title: v.title, description: v.description, parentId: v.parentId || null, holderId: v.holderId || null };
          return oapi(p.id ? 'PUT' : 'POST', '/structure/positions' + (p.id ? '/' + p.id : ''), body).then(() => { close(); load(); });
        }}
        extra={p.id ? <button className="btn" type="button" onClick={() => { oapi('DELETE', '/structure/positions/' + p.id).then(() => { close(); load(); }).catch(fail); }}>{t('Supprimer')}</button> : null}
      />
    ));
  };

  const aiComplete = () => {
    modal(t("Compléter l'organigramme avec l'IA"), (close) => (
      <Form
        fields={[{ k: 'context', label: t('Précisions (facultatif)'), type: 'textarea', rows: 3, placeholder: t("Ex : nous prévoyons d'ouvrir 2 antennes l'an prochain") }]}
        submitText={t('Demander une proposition')}
        onSubmit={(v) => {
          close();
          propose('org-structure', { context: v.context }, {
            title: t('Postes proposés'),
            applyText: t('Ajouter ces postes'),
            render: (p) => (
              <>
                {(p.positions || []).map((x, i) => (
                  <div className="line" key={i}>
                    <span><b>{x.title}</b><small>{' — ' + (x.description || '')}</small></span>
                    <small>{x.reportsTo ? '→ ' + x.reportsTo : t('sommet')}</small>
                  </div>
                ))}
              </>
            ),
            done: load,
          });
        }}
      />
    ));
  };

  const ids = {};
  positions.forEach((p) => { ids[p.id] = true; });
  const roots = positions.filter((p) => !p.parentId || !ids[p.parentId]);

  return (
    <>
      <div className="ws-head">
        <div><h1>{t('Organisation')}</h1><p className="muted">{t('Qui fait quoi, et qui rend compte à qui.')}</p></div>
        {can('admin') ? (
          <div className="row">
            <button className="btn signal small" type="button" onClick={aiComplete}>{t("Compléter avec l'IA")}</button>
            <button className="btn primary small" type="button" onClick={() => editPos()}>{t('Ajouter un poste')}</button>
          </div>
        ) : null}
      </div>
      <div className="ws-card">
        <h2>{org.name}</h2>
        <p className="muted">{[org.sector, org.currency].filter(Boolean).join(' · ')}</p>
        <p>{org.description || t("Aucune présentation. Décrivez votre activité : l'IA s'en sert pour mieux vous conseiller.")}</p>
        {can('admin') ? <button className="btn small" type="button" onClick={editOrg}>{t('Modifier la fiche')}</button> : null}
      </div>
      <div className="ws-card">
        {st.loading && !st.data ? <Loading /> : null}
        {st.error ? <p className="ws-err" role="alert">{tsrv(st.error.message)}</p> : null}
        {st.data ? (
          <>
            <h2>{t('Organigramme')}</h2>
            {!positions.length ? <Empty text={can('admin') ? t("Aucun poste défini. Ajoutez-en un, ou laissez l'IA proposer une structure.") : t("Aucun poste défini pour l'instant.")} /> : (
              <ul className="tree">{roots.map((p) => <Node key={p.id} p={p} positions={positions} editPos={editPos} />)}</ul>
            )}
          </>
        ) : null}
      </div>
      <Vacancies />
    </>
  );
}

function Node({ p, positions, editPos }) {
  const { can } = useWs();
  const t = useT();
  const kids = positions.filter((x) => x.parentId === p.id);
  return (
    <li>
      <div className={'pos' + (p.holder ? '' : ' free')}>
        <b>{p.title}</b>
        <small>{p.holder ? p.holder : t('Poste libre')}</small>
        {p.description ? <p className="small muted">{p.description}</p> : null}
        {can('admin') ? (
          <span className="row">
            <button className="link" type="button" onClick={() => editPos(p)}>{t('Modifier')}</button>
            <button className="link" type="button" onClick={() => editPos(null, p.id)}>{t('+ sous ce poste')}</button>
          </span>
        ) : null}
      </div>
      {kids.length ? <ul>{kids.map((k) => <Node key={k.id} p={k} positions={positions} editPos={editPos} />)}</ul> : null}
    </li>
  );
}
