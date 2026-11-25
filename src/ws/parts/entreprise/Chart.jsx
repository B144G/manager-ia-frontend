import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, EmptyState, Icon } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import PostForm from './PostForm.jsx';
import { SPACE_TITLE } from './lib.js';

/* Organigramme : direction générale → directions du pilotage → départements → postes (avec les personnes et les places vacantes). */

const LVN = { view: 'visiteur', write: 'membre', manage: 'responsable' };

export default function Chart({ chart, reload, people }) {
  const { can, modal, oapi, confirm, fail, toast } = useWs();
  const t = useT();
  const edit = can('admin');
  const run = (p, msg) => p.then(() => { if (msg) toast(msg); reload(); }).catch(fail);
  const postForm = (post, ctx) => modal(post ? t('Modifier le poste') : t('Nouveau poste'), (close) => <PostForm post={post} {...ctx} done={() => { close(); reload(); }} />, { wide: true });
  const assign = (post) => modal(t('Affecter à « {poste} »', { poste: tsrv(post.title) }), (close) => <AssignBox post={post} people={people} done={() => { close(); reload(); }} />);
  const addNamed = (kind) => modal(kind === 'direction' ? t('Nouvelle direction') : t('Nouveau département'), (close) => <NameBox chart={chart} kind={kind} done={() => { close(); reload(); }} />);

  const Post = ({ p, ctx }) => (
    <li className={'ent-post' + (p.active ? '' : ' off')}>
      <div className="ent-post-h">
        <b>{tsrv(p.title)}</b>
        <Badge tone={p.kind === 'staff' ? 'neutral' : 'brand'}>{p.kind === 'director' ? t('Directeur') : p.kind === 'head' ? t('Responsable') : t('Équipe')}</Badge>
        {!p.active ? <Badge tone="warn">{t('Désactivé')}</Badge> : null}
      </div>
      <div className="ent-holders">
        {p.holders.map((h) => (
          <span className="ent-chip" key={h.assignmentId}><Icon name="user-tie" />{h.name}{h.status === 'invited' ? <small> · {t('invitation envoyée')}</small> : null}
            {edit ? <button type="button" className="ent-x" aria-label={t('Retirer {name}', { name: h.name })} onClick={() => confirm(t('Retirer {name} de ce poste ?', { name: h.name }), () => run(oapi('DELETE', '/entreprise/assignments/' + h.assignmentId), t('Affectation retirée.')), t('Retirer'))}><Icon name="xmark" /></button> : null}
          </span>
        ))}
        {p.active && p.vacant > 0 ? <Badge tone="warn">{p.vacant > 1 ? t('{n} postes vacants', { n: p.vacant }) : t('Poste vacant')}</Badge> : null}
      </div>
      <div className="ent-acc">{Object.entries(p.spaces).map(([sp, lv]) => <span className={'ent-lv ' + lv} key={sp}>{tsrv(SPACE_TITLE[sp] || sp)} · {tsrv(LVN[lv] || lv)}</span>)}</div>
      {edit ? (
        <div className="ent-actions">
          {p.active && p.vacant > 0 ? <Button size="sm" icon="user-plus" onClick={() => assign(p)}>{t('Affecter')}</Button> : null}
          <Button size="sm" icon="pen" onClick={() => postForm(p, ctx)}>{t('Modifier')}</Button>
          <Button size="sm" variant="ghost" icon={p.active ? 'eye-slash' : 'eye'} onClick={() => run(oapi('PUT', '/entreprise/posts/' + p.id, { active: !p.active }))}>{p.active ? t('Désactiver') : t('Activer')}</Button>
          <Button size="sm" variant="ghost" icon="trash" label={t('Supprimer')} iconOnly onClick={() => confirm(t('Supprimer ce poste ? Les affectations doivent être retirées avant.'), () => run(oapi('DELETE', '/entreprise/posts/' + p.id), t('Poste supprimé.')), t('Supprimer'))} />
        </div>
      ) : null}
    </li>
  );

  const Dept = ({ d }) => (
    <section className={'ent-dept' + (d.active ? '' : ' off')}>
      <header>
        <h4><Icon name="folder-open" /> {tsrv(d.name)}</h4>
        {!d.active ? <Badge tone="warn">{t('Désactivé')}</Badge> : null}
        {edit ? (
          <span className="ent-actions">
            <Button size="sm" icon="plus" onClick={() => postForm(null, { departmentId: d.id })}>{t('Poste')}</Button>
            <Button size="sm" variant="ghost" icon="pen" label={t('Renommer')} iconOnly onClick={() => modal(t('Renommer le département'), (close) => <NameBox chart={chart} kind="rename-dept" item={d} done={() => { close(); reload(); }} />)} />
            <Button size="sm" variant="ghost" icon={d.active ? 'eye-slash' : 'eye'} label={d.active ? t('Désactiver') : t('Activer')} iconOnly onClick={() => run(oapi('PUT', '/entreprise/departments/' + d.id, { active: !d.active }))} />
          </span>
        ) : null}
      </header>
      {d.posts.length ? <ul className="ent-posts">{d.posts.map((p) => <Post key={p.id} p={p} ctx={{ departmentId: d.id }} />)}</ul> : <p className="muted small">{t('Aucun poste dans ce département.')}</p>}
    </section>
  );

  const noDir = chart.departments;
  return (
    <div className="ent-chart">
      <section className="ent-dg" aria-label={t('Direction générale')}>
        <div className="ent-dg-h"><Icon name="building-columns" /><div><h3>{t('Direction générale')}</h3><small>{chart.entreprise.name}</small></div></div>
        <div className="ent-holders">
          {chart.dg.length ? chart.dg.map((p) => <span className="ent-chip dg" key={p.id}><Icon name="user-tie" />{p.name}</span>) : <span className="muted">{t('Aucun directeur général désigné.')}</span>}
        </div>
      </section>
      {chart.directions.length === 0 && noDir.length === 0 ? (
        <EmptyState icon="sitemap" title={t("La structure de l'entreprise est vide")}>{t("Choisissez un modèle selon votre secteur : directions, départements et postes sont préparés, vous les adaptez ensuite.")}</EmptyState>
      ) : null}
      {chart.directions.map((dir) => (
        <article className={'ent-dir' + (dir.active ? '' : ' off')} key={dir.id}>
          <header className="ent-dir-h">
            <h3><Icon name="sitemap" /> {tsrv(dir.name)}</h3>
            {!dir.active ? <Badge tone="warn">{t('Désactivée')}</Badge> : null}
            {edit ? (
              <span className="ent-actions">
                <Button size="sm" icon="plus" onClick={() => postForm(null, { directionId: dir.id })}>{t('Poste de direction')}</Button>
                <Button size="sm" variant="ghost" icon="pen" label={t('Renommer')} iconOnly onClick={() => modal(t('Renommer la direction'), (close) => <NameBox chart={chart} kind="rename-dir" item={dir} done={() => { close(); reload(); }} />)} />
                <Button size="sm" variant="ghost" icon={dir.active ? 'eye-slash' : 'eye'} label={dir.active ? t('Désactiver') : t('Activer')} iconOnly onClick={() => run(oapi('PUT', '/entreprise/directions/' + dir.id, { active: !dir.active }))} />
              </span>
            ) : null}
          </header>
          {dir.directors.length ? <ul className="ent-posts">{dir.directors.map((p) => <Post key={p.id} p={p} ctx={{ directionId: dir.id }} />)}</ul> : null}
          <div className="ent-depts">{dir.departments.map((d) => <Dept key={d.id} d={d} />)}</div>
        </article>
      ))}
      {noDir.length ? (
        <article className="ent-dir">
          <header className="ent-dir-h"><h3><Icon name="folder" /> {t('Départements rattachés à la direction générale')}</h3></header>
          <div className="ent-depts">{noDir.map((d) => <Dept key={d.id} d={d} />)}</div>
        </article>
      ) : null}
      {edit ? <div className="row"><Button icon="plus" onClick={() => addNamed('direction')}>{t('Ajouter une direction')}</Button><Button icon="plus" onClick={() => addNamed('department')}>{t('Ajouter un département')}</Button></div> : null}
    </div>
  );
}

/** Nom d'une direction ou d'un département (création ou renommage). */
export function NameBox({ chart, kind, item, done }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const [name, setName] = useState(item ? item.name : '');
  const [dir, setDir] = useState(item && item.directionId ? String(item.directionId) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isDept = kind === 'department' || kind === 'rename-dept';
  const go = (ev) => {
    ev.preventDefault();
    if (!name.trim()) { setErr(t('Indiquez un nom.')); return; }
    setBusy(true); setErr('');
    const body = isDept ? { name: name.trim(), directionId: dir || null } : { name: name.trim() };
    const base = isDept ? '/entreprise/departments' : '/entreprise/directions';
    (item ? oapi('PUT', base + '/' + item.id, body) : oapi('POST', base, body)).then(done).catch((e) => { setErr(tsrv(e.message)); if (e.status === 401) fail(e); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={go}>
      <label className="fld"><span>{t('Nom')}</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      {isDept ? (
        <label className="fld"><span>{t('Direction du pilotage')}</span>
          <select value={dir} onChange={(e) => setDir(e.target.value)}>
            <option value="">{t('Direction générale (aucune direction)')}</option>
            {chart.directions.map((d) => <option key={d.id} value={d.id}>{tsrv(d.name)}</option>)}
          </select></label>
      ) : null}
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

/** Affecter une personne à un poste. */
export function AssignBox({ post, people, done }) {
  const { oapi, fail, toast } = useWs();
  const t = useT();
  const held = new Set(post.holders.map((h) => h.personId));
  const choices = people.filter((p) => !held.has(p.id));
  const [pid, setPid] = useState(choices[0] ? String(choices[0].id) : '');
  const [busy, setBusy] = useState(false);
  if (!choices.length) return <p className="muted">{t("Aucune personne disponible : ajoutez d'abord les personnes de l'entreprise (onglet Personnes).")}</p>;
  const go = () => { setBusy(true); oapi('POST', '/entreprise/assignments', { postId: post.id, personId: Number(pid) }).then(() => { toast(t('Personne affectée.')); done(); }).catch(fail).finally(() => setBusy(false)); };
  return (
    <div className="ws-form">
      <label className="fld"><span>{t('Personne')}</span>
        <select value={pid} onChange={(e) => setPid(e.target.value)}>{choices.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status === 'invited' ? ' · ' + t('invitation envoyée') : ''}</option>)}</select></label>
      <p className="muted small">{t("Elle reçoit les espaces et niveaux de ce poste, dans cette organisation seulement.")}</p>
      <div className="row"><Button variant="primary" loading={busy} onClick={go}>{t('Affecter')}</Button></div>
    </div>
  );
}
