import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, Card, EmptyState, Loaded, Tabs, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import { MODULE_TITLES } from '../entreprise/lib.js';
import '../../../styles/ws-entreprise.css';

const day = (iso) => { try { return new Date(iso).toLocaleDateString(getLocale(), { day: '2-digit', month: 'short' }); } catch { return iso; } };

/* Espace de direction d'un département : pilotage, validations, tâches et dossiers PROPRES au directeur (invisibles du personnel), rapports. Le personnel travaille dans l'espace opérationnel. */
export default function DirectionHome({ space }) {
  const { oapi, orgId, info } = useWs();
  const t = useT();
  const [tab, setTab] = useState('pilot');
  const sum = useLoad(() => oapi('GET', `/${space}/summary`), [space, orgId]);
  const meta = info.spaces && info.spaces.spaces ? info.spaces.spaces.find((s) => s.id === space) : null;
  const level = meta ? meta.level : 'view';
  return (
    <Loaded state={sum}>{(j) => (
      <div className="ent dir-home">
        <div className="ws-head"><div><h1>{tsrv(j.space.title)}</h1><p className="muted">{t("Votre espace de direction : séparé de celui de votre équipe. Vos tâches et vos dossiers n'y sont visibles que par vous.")}</p></div>{level !== 'manage' ? <Badge tone="warn">{t('Consultation seule')}</Badge> : null}</div>
        <Tabs items={[{ id: 'pilot', label: t('Pilotage'), icon: 'gauge' }, { id: 'valid', label: t('Validations'), icon: 'circle-check' }, { id: 'tasks', label: t('Mes tâches'), icon: 'list-check' }, { id: 'notes', label: t('Mes dossiers'), icon: 'folder' }, { id: 'reports', label: t('Rapports'), icon: 'chart-line' }]} value={tab} onChange={setTab} label={tsrv(j.space.title)} />
        <div className="ent-tabbody">
          {tab === 'pilot' ? <Pilot space={space} j={j} reload={sum.reload} canEdit={level === 'manage'} /> : null}
          {tab === 'valid' ? <Valid space={space} canEdit={level === 'manage'} /> : null}
          {tab === 'tasks' ? <Tasks space={space} canEdit={level === 'manage'} /> : null}
          {tab === 'notes' ? <Notes space={space} canEdit={level === 'manage'} /> : null}
          {tab === 'reports' ? <Reports space={space} /> : null}
        </div>
      </div>
    )}</Loaded>
  );
}

function Pilot({ space, j, reload, canEdit }) {
  const { oapi, orgId, modal, fail, toast, confirm } = useWs();
  const t = useT();
  const add = () => modal(t('Nouvel objectif'), (close) => <ObjForm space={space} done={() => { close(); reload(); }} />);
  return (
    <>
      <ul className="sp-tiles" aria-label={t('Indicateurs du département')}>
        {j.tiles.map((x) => { const body = <><span className="sp-n">{x.value}</span><span className="sp-l">{tsrv(x.label)}</span></>; return <li key={x.id} className={'sp-tile ' + (x.value && x.tone ? x.tone : 'plain')}>{x.to ? <Link to={`/app/${orgId}/${x.to}`}>{body}</Link> : <div>{body}</div>}</li>; })}
      </ul>
      <Card title={t("Équipe du département")} subtitle={t('{filled} place(s) pourvue(s) sur {seats} · {vac} vacante(s)', { filled: j.team.filled, seats: j.team.seats, vac: j.team.vacancies })}>
        {j.team.load.length === 0 ? <p className="muted">{t("Aucune personne affectée au département pour l'instant.")}</p> : j.team.load.map((m) => (
          <div className="line" key={m.name}><span><b>{m.name}</b></span><span className="ent-actions"><Badge>{t('{n} en cours', { n: m.open })}</Badge>{m.late ? <Badge tone="danger">{t('{n} en retard', { n: m.late })}</Badge> : null}<Badge tone="ok">{t('{n} terminée(s)', { n: m.done })}</Badge></span></div>
        ))}
      </Card>
      <Card title={t('Objectifs')} actions={canEdit ? <Button icon="plus" onClick={add}>{t('Ajouter un objectif')}</Button> : null}>
        {j.objectives.length === 0 ? <p className="muted">{t("Aucun objectif fixé. Définissez les cibles de votre département (chiffre d'affaires, délais, budget…).")}</p> : j.objectives.map((o) => (
          <div className="ent-usage" key={o.id}>
            <div className="ent-usage-h"><b>{o.title}</b><span>{o.current.toLocaleString()} / {o.target.toLocaleString()} {o.unit}{o.due ? ' · ' + day(o.due) : ''}</span></div>
            <div className="ent-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={o.pct} aria-label={o.title}><span className={o.pct >= 100 ? '' : o.pct < 40 ? 'warn' : ''} style={{ width: o.pct + '%' }} /></div>
            {canEdit ? <div className="ent-actions"><Button size="sm" onClick={() => modal(t('Mettre à jour : {t}', { t: o.title }), (close) => <ObjForm space={space} o={o} done={() => { close(); reload(); }} />)}>{t('Mettre à jour')}</Button>
              <Button size="sm" variant="ghost" icon="trash" label={t('Supprimer')} iconOnly onClick={() => confirm(t('Supprimer cet objectif ?'), () => oapi('DELETE', `/${space}/objectives/${o.id}`).then(() => { toast(t('Objectif supprimé.')); reload(); }).catch(fail), t('Supprimer'))} /></div> : null}
          </div>
        ))}
      </Card>
    </>
  );
}
function ObjForm({ space, o, done }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const [v, setV] = useState({ title: o ? o.title : '', unit: o ? o.unit : '', target: o ? String(o.target) : '', current: o ? String(o.current) : '0', due: o && o.due ? o.due : '' });
  const [busy, setBusy] = useState(false);
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); setBusy(true); const body = { title: v.title, unit: v.unit, target: v.target, current: v.current, due: v.due || null }; (o ? oapi('PUT', `/${space}/objectives/${o.id}`, body) : oapi('POST', `/${space}/objectives`, body)).then(done).catch(fail).finally(() => setBusy(false)); }}>
      <label className="fld"><span>{t('Objectif')}</span><input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus /></label>
      <div className="ent-two"><label className="fld"><span>{t('Cible')}</span><input inputMode="decimal" value={v.target} onChange={(e) => setV({ ...v, target: e.target.value })} /></label><label className="fld"><span>{t('Atteint à ce jour')}</span><input inputMode="decimal" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} /></label></div>
      <div className="ent-two"><label className="fld"><span>{t('Unité')} <small>({t('facultatif')})</small></span><input value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} placeholder="FCFA, %, jours…" /></label><label className="fld"><span>{t('Échéance')} <small>({t('facultatif')})</small></span><input type="date" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} /></label></div>
      <div className="row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

function Valid({ space, canEdit }) {
  const { oapi, orgId, fail, toast } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', `/${space}/validations`), [space]);
  const decide = (id, decision) => oapi('PUT', `/${space}/validations/leave/${id}`, { decision }).then(() => { toast(t('Décision enregistrée.')); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{(j) => j.queues.length === 0 ? <EmptyState icon="circle-check" title={t('Rien à valider')}>{t("Les demandes de votre département à approuver apparaissent ici.")}</EmptyState> : j.queues.map((q) => (
      <Card key={q.kind} title={tsrv(q.title)} subtitle={q.items.length ? t('{n} en attente', { n: q.items.length }) : t('Rien en attente.')}>
        {q.items.map((x) => (
          <div className="line" key={x.id}><span><b>{x.title}</b><small> · {x.sub}</small></span>
            {q.decide && canEdit ? <span className="ent-actions"><Button size="sm" variant="primary" onClick={() => decide(x.id, 'approved')}>{t('Approuver')}</Button><Button size="sm" onClick={() => decide(x.id, 'refused')}>{t('Refuser')}</Button></span> : <Link className="link" to={`/app/${orgId}/${q.module}`}>{t('Ouvrir')}</Link>}</div>
        ))}
      </Card>
    ))}</Loaded>
  );
}

function Tasks({ space, canEdit }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', `/${space}/tasks`), [space]);
  const [title, setTitle] = useState(''); const [due, setDue] = useState('');
  const add = (e) => { e.preventDefault(); if (!title.trim()) return; oapi('POST', `/${space}/tasks`, { title: title.trim(), due: due || null }).then(() => { setTitle(''); setDue(''); st.reload(); }).catch(fail); };
  return (
    <Card title={t('Mes tâches de direction')} subtitle={t("Visibles de vous seul : jamais du personnel du département.")}>
      {canEdit ? <form className="ent-compose" onSubmit={add}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Nouvelle tâche…')} aria-label={t('Nouvelle tâche')} /><input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t('Échéance')} /><Button variant="primary" type="submit" icon="plus">{t('Ajouter')}</Button></form> : null}
      <Loaded state={st}>{(j) => j.tasks.length === 0 ? <p className="muted">{t('Aucune tâche.')}</p> : j.tasks.map((k) => (
        <div className="line" key={k.id}><label className="ent-chk"><input type="checkbox" checked={k.status === 'done'} disabled={!canEdit} onChange={(e) => oapi('PUT', `/${space}/tasks/${k.id}`, { status: e.target.checked ? 'done' : 'todo' }).then(st.reload).catch(fail)} aria-label={k.title} /> <span style={k.status === 'done' ? { textDecoration: 'line-through', opacity: 0.6 } : null}>{k.title}</span></label>
          <span className="ent-actions">{k.due ? <small className="muted">{day(k.due)}</small> : null}{k.priority === 'high' ? <Badge tone="danger">{t('Prioritaire')}</Badge> : null}{canEdit ? <Button size="sm" variant="ghost" icon="trash" label={t('Supprimer')} iconOnly onClick={() => oapi('DELETE', `/${space}/tasks/${k.id}`).then(st.reload).catch(fail)} /> : null}</span></div>
      ))}</Loaded>
    </Card>
  );
}

function Notes({ space, canEdit }) {
  const { oapi, modal, fail } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', `/${space}/notes`), [space]);
  const edit = (n) => modal(n ? t('Dossier : {t}', { t: n.title }) : t('Nouveau dossier'), (close) => <NoteForm space={space} n={n} canEdit={canEdit} done={() => { close(); st.reload(); }} />, { wide: true });
  return (
    <Card title={t('Mes dossiers')} subtitle={t('Notes et documents de travail du directeur : invisibles du personnel.')} actions={canEdit ? <Button icon="plus" onClick={() => edit(null)}>{t('Nouveau dossier')}</Button> : null}>
      <Loaded state={st}>{(j) => j.notes.length === 0 ? <p className="muted">{t('Aucun dossier.')}</p> : j.notes.map((n) => (
        <div className="line" key={n.id}><span><b>{n.title}</b><small> · {day(n.updatedAt)}</small></span><span className="ent-actions"><Button size="sm" onClick={() => edit(n)}>{canEdit ? t('Modifier') : t('Lire')}</Button>{canEdit ? <Button size="sm" variant="ghost" icon="trash" label={t('Supprimer')} iconOnly onClick={() => oapi('DELETE', `/${space}/notes/${n.id}`).then(st.reload).catch(fail)} /> : null}</span></div>
      ))}</Loaded>
    </Card>
  );
}
function NoteForm({ space, n, canEdit, done }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const [v, setV] = useState({ title: n ? n.title : '', body: n ? n.body : '' });
  const [busy, setBusy] = useState(false);
  return (
    <form className="ws-form" noValidate onSubmit={(e) => { e.preventDefault(); setBusy(true); (n ? oapi('PUT', `/${space}/notes/${n.id}`, v) : oapi('POST', `/${space}/notes`, v)).then(done).catch(fail).finally(() => setBusy(false)); }}>
      <label className="fld"><span>{t('Titre')}</span><input value={v.title} disabled={!canEdit} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus /></label>
      <label className="fld"><span>{t('Contenu')}</span><textarea rows={10} value={v.body} disabled={!canEdit} onChange={(e) => setV({ ...v, body: e.target.value })} /></label>
      {canEdit ? <div className="row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button></div> : null}
    </form>
  );
}

function Reports({ space }) {
  const { oapi, orgId } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', `/${space}/reports`), [space]);
  return (
    <Card title={t('Rapports et écrans du département')} subtitle={t("Ouvrent l'espace de votre équipe, en consultation : vous suivez son travail sans le modifier.")}>
      <Loaded state={st}>{(j) => <div className="ent-holders">{j.links.map((l) => <Link className="ent-chip" key={l.module} to={`/app/${orgId}/${l.module}`}>{tsrv(MODULE_TITLES[l.module] || l.label)}</Link>)}</div>}</Loaded>
      <p className="muted small">{t("Les réunions du département sont dans « Projets et réunions » ; elles restent communes à l'équipe.")}</p>
    </Card>
  );
}
