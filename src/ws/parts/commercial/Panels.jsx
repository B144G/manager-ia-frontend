import { useRef, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, EmptyState, Field, Icon, Loading, useLoad } from '../../ui.jsx';
import { Failed, MapSelect, MemberSelect, Tag, fmtDT, inputDT, isoOf, qs, readBase64, useCp, useDownload, useForm, useL } from './common.jsx';

/* Panneaux réutilisés par les fiches (compte, prospect, opportunité) : tâches, notes, pièces jointes, activités, BANT.
   `ref` = { customerId } ou { leadId } ou { oppId } : à quoi se rattache la saisie. */

const MAX_FILE = 1400 * 1024;

/* ---------- Tâches ---------- */
export function TaskList({ tasks, onToggle, onDelete, showWho }) {
  const t = useT();
  const { openAccount, has } = useCp();
  const L = useL();
  if (!tasks.length) return <EmptyState icon="list-check" title={t('Aucune tâche.')} />;
  return (
    <ul className="cp-list">
      {tasks.map((k) => (
        <li key={k.id} className={'cp-item' + (k.status === 'done' ? ' done' : '')}>
          <input type="checkbox" checked={k.status === 'done'} onChange={() => onToggle(k)} aria-label={t('Fait : {titre}', { titre: k.title })} />
          <div className="grow">
            <b>{k.title}</b>
            <div className="small muted">
              {L.taskKind[k.kind] || k.kind}
              {k.dueAt ? <> · <span className={k.overdue ? 'late' : ''}>{k.overdue ? t('En retard : ') : ''}{fmtDT(k.dueAt)}</span></> : null}
              {showWho && k.assignee ? ' · ' + k.assignee : null}
              {k.customerId && k.customer ? <> · <button type="button" className="cp-link" onClick={() => openAccount(k.customerId)}>{k.customer}</button></> : null}
            </div>
          </div>
          {has('write') && onDelete ? <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer')} onClick={() => onDelete(k)} /> : null}
        </li>
      ))}
    </ul>
  );
}

/** Formulaire de création d'une tâche (rattachée ou non à une fiche). */
export function TaskForm({ refs = {}, onSaved, close }) {
  const t = useT();
  const L = useL();
  const { api, has, me } = useCp();
  const { toast } = useWs();
  const f = useForm({ title: '', kind: 'todo', dueAt: '', assigneeId: '' });
  const submit = (e) => {
    e.preventDefault();
    if (!f.v.title.trim()) { f.setErr(t('Indiquez ce qu’il faut faire.')); return; }
    f.run(async () => {
      await api('POST', '/tasks', { ...refs, title: f.v.title, kind: f.v.kind, dueAt: isoOf(f.v.dueAt) || undefined, assigneeId: f.v.assigneeId || undefined });
      toast(t('Tâche créée.')); if (close) close(); onSaved();
    });
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <Field label={t('Tâche')} required>{(p) => <input {...p} type="text" maxLength={200} value={f.v.title} onChange={f.set('title')} />}</Field>
      <div className="cp-grid">
        <Field label={t('Type')}>{(p) => <MapSelect {...p} map={L.taskKind} value={f.v.kind} onChange={f.set('kind')} />}</Field>
        <Field label={t('Échéance')}>{(p) => <input {...p} type="datetime-local" value={f.v.dueAt} onChange={f.set('dueAt')} />}</Field>
        {!me.scopeOwn && has('write') ? <Field label={t('Pour')}>{(p) => <MemberSelect {...p} value={f.v.assigneeId} onChange={f.set('assigneeId')} none={t('Moi')} />}</Field> : null}
      </div>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={f.busy}>{t('Créer la tâche')}</Button></div>
    </form>
  );
}

export function TasksPanel({ refs }) {
  const t = useT();
  const { api, fail, has, tick, bump } = useCp();
  const { modal } = useWs();
  const st = useLoad(() => api('GET', '/tasks' + qs(refs)), [JSON.stringify(refs), tick]);
  const toggle = (k) => api('PUT', '/tasks/' + k.id, { status: k.status === 'done' ? 'open' : 'done' }).then(() => { st.reload(); bump(); }, fail);
  const del = (k) => api('DELETE', '/tasks/' + k.id).then(() => { st.reload(); bump(); }, fail);
  return (
    <div>
      {has('write') ? <div className="row"><Button size="sm" icon="plus" onClick={() => modal(t('Nouvelle tâche'), (close) => <TaskForm refs={refs} close={close} onSaved={() => { st.reload(); bump(); }} />)}>{t('Nouvelle tâche')}</Button></div> : null}
      {st.loading && !st.data ? <Loading /> : st.error ? <Failed e={st.error} /> : <TaskList tasks={st.data.tasks} onToggle={toggle} onDelete={del} showWho />}
    </div>
  );
}

/* ---------- Notes ---------- */
export function NotesPanel({ refs }) {
  const t = useT();
  const { api, fail, has } = useCp();
  const st = useLoad(() => api('GET', '/notes' + qs(refs)), [JSON.stringify(refs)]);
  const f = useForm({ body: '' });
  const add = (e) => {
    e.preventDefault();
    if (!f.v.body.trim()) { f.setErr(t('Écrivez la note.')); return; }
    f.run(async () => { await api('POST', '/notes', { ...refs, body: f.v.body }); f.setV({ body: '' }); st.reload(); });
  };
  return (
    <div>
      {has('write') ? (
        <form className="ws-form" noValidate onSubmit={add}>
          <Field label={t('Nouvelle note')}>{(p) => <textarea {...p} rows={3} maxLength={2000} value={f.v.body} onChange={f.set('body')} />}</Field>
          <p className="ws-err" role="alert">{f.err}</p>
          <div className="row"><Button size="sm" variant="primary" type="submit" loading={f.busy}>{t('Ajouter la note')}</Button></div>
        </form>
      ) : null}
      {st.loading && !st.data ? <Loading /> : st.error ? <Failed e={st.error} /> : !st.data.notes.length ? <EmptyState icon="pen" title={t('Aucune note.')} /> : (
        <ul className="cp-list">
          {st.data.notes.map((n) => (
            <li key={n.id} className="cp-item">
              <div className="grow"><p className="cp-body">{n.body}</p><div className="small muted">{n.by} · {fmtDT(n.at)}</div></div>
              {has('write') ? <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer')} onClick={() => api('DELETE', '/notes/' + n.id).then(st.reload, fail)} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Pièces jointes ---------- */
export function FilesPanel({ refs }) {
  const t = useT();
  const { api, fail, has } = useCp();
  const { toast, confirm } = useWs();
  const download = useDownload();
  const st = useLoad(() => api('GET', '/attachments' + qs(refs)), [JSON.stringify(refs)]);
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE) { toast(t('Fichier trop volumineux (1,4 Mo au plus).'), true); return; }
    setBusy(true);
    try {
      const data = await readBase64(file);
      await api('POST', '/attachments', { ...refs, name: file.name, mime: file.type, data });
      toast(t('Fichier ajouté.')); st.reload();
    } catch (err) { fail(err.message === 'read' ? new Error(t('Fichier illisible.')) : err); }
    setBusy(false);
  };
  const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko');
  return (
    <div>
      {has('write') ? (
        <div className="row">
          <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label={t('Choisir un fichier')} accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx" onChange={pick} />
          <Button size="sm" icon="upload" loading={busy} onClick={() => input.current && input.current.click()}>{t('Ajouter un fichier')}</Button>
          <span className="small muted">{t('PDF, image, texte, Word ou Excel — 1,4 Mo au plus.')}</span>
        </div>
      ) : null}
      {st.loading && !st.data ? <Loading /> : st.error ? <Failed e={st.error} /> : !st.data.attachments.length ? <EmptyState icon="paperclip" title={t('Aucune pièce jointe.')} /> : (
        <ul className="cp-list">
          {st.data.attachments.map((f) => (
            <li key={f.id} className="cp-item">
              <Icon name="paperclip" />
              <div className="grow"><b>{f.name}</b><div className="small muted">{kb(f.size)} · {f.by} · {fmtDT(f.at)}</div></div>
              <Button size="sm" icon="download" onClick={() => download('/attachments/' + f.id + '/file', f.name)}>{t('Télécharger')}</Button>
              {has('write') ? <Button size="sm" variant="ghost" iconOnly icon="delete" label={t('Supprimer')} onClick={() => confirm(t('Supprimer ce fichier ?'), () => api('DELETE', '/attachments/' + f.id).then(st.reload, fail))} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Activités ---------- */
export function ActivityForm({ refs, onSaved }) {
  const t = useT();
  const L = useL();
  const { api, has } = useCp();
  const { toast } = useWs();
  const f = useForm({ kind: 'call', outcome: '', durationMin: '', note: '', happenedAt: inputDT(new Date().toISOString()) });
  if (!has('activity')) return null;
  const submit = (e) => {
    e.preventDefault();
    f.run(async () => {
      await api('POST', '/activities', { ...refs, kind: f.v.kind, outcome: f.v.outcome, durationMin: Number(f.v.durationMin) || 0, note: f.v.note, happenedAt: isoOf(f.v.happenedAt) || undefined });
      toast(t('Activité enregistrée.')); f.setV((s) => ({ ...s, outcome: '', durationMin: '', note: '' })); onSaved();
    });
  };
  return (
    <form className="ws-form" noValidate onSubmit={submit}>
      <div className="cp-grid">
        <Field label={t('Type')}>{(p) => <MapSelect {...p} map={L.actKind} value={f.v.kind} onChange={f.set('kind')} />}</Field>
        <Field label={t('Date et heure')}>{(p) => <input {...p} type="datetime-local" value={f.v.happenedAt} onChange={f.set('happenedAt')} />}</Field>
        <Field label={t('Durée (minutes)')}>{(p) => <input {...p} type="text" inputMode="numeric" value={f.v.durationMin} onChange={f.set('durationMin')} />}</Field>
        <Field label={t('Résultat')}>{(p) => <input {...p} type="text" maxLength={120} value={f.v.outcome} onChange={f.set('outcome')} />}</Field>
      </div>
      <Field label={t('Compte rendu')}>{(p) => <textarea {...p} rows={3} maxLength={1000} value={f.v.note} onChange={f.set('note')} />}</Field>
      <p className="ws-err" role="alert">{f.err}</p>
      <div className="row"><Button size="sm" variant="primary" type="submit" loading={f.busy}>{t("Enregistrer l'activité")}</Button></div>
    </form>
  );
}
export function ActivityList({ items }) {
  const t = useT();
  const L = useL();
  if (!items.length) return <EmptyState icon="phone" title={t('Aucune activité.')} />;
  return (
    <ul className="cp-list">
      {items.map((a, i) => (
        <li key={(a.id || a.ref || i) + a.kind} className="cp-item">
          <Icon name={{ call: 'phone', visit: 'location-dot', meeting: 'handshake', message: 'comment', email: 'envelope' }[a.kind] || 'phone'} />
          <div className="grow"><b>{L.actKind[a.kind] || a.kind}{a.outcome ? ' — ' + a.outcome : ''}</b><div className="small muted">{a.note || a.title}</div><div className="small muted">{fmtDT(a.at)}{a.by ? ' · ' + a.by : ''}</div></div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- BANT (budget, autorité, besoin, délai) ---------- */
export function BantCard({ kind, id, onChange }) {
  const t = useT();
  const { api, fail, has } = useCp();
  const { toast } = useWs();
  const st = useLoad(() => api('GET', '/bant/' + kind + '/' + id), [kind, id]);
  const [edit, setEdit] = useState({});
  const [busy, setBusy] = useState(false);
  const NAMES = { budget: t('Budget'), authority: t('Autorité'), need: t('Besoin'), timing: t('Délai') };
  const RATE = [t('0 — inconnu'), t('1 — faible'), t('2 — partiel'), t('3 — probable'), t('4 — confirmé')];
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <Failed e={st.error} />;
  const { bant, score } = st.data;
  const done = (msg) => { toast(msg); setEdit({}); st.reload(); if (onChange) onChange(); };
  const run = (fn, msg) => { setBusy(true); fn().then(() => done(msg), fail).then(() => setBusy(false)); };
  const save = () => run(() => api('PUT', '/bant/' + kind + '/' + id, Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, { rating: Number(v.rating ?? (bant[k] || {}).rating ?? 0), note: v.note ?? (bant[k] || {}).note ?? '' }]))), t('BANT enregistré.'));
  const suggest = () => { setBusy(true); api('POST', '/bant/' + kind + '/' + id + '/suggest').then(() => done(t('Suggestion préparée : à valider.')), fail).then(() => setBusy(false)); };
  const validate = (k) => run(() => api('POST', '/bant/' + kind + '/' + id + '/validate', { criteria: [k] }), t('Suggestion validée.'));
  const dirty = Object.keys(edit).length > 0;
  return (
    <div className="cp-bant">
      <div className="row"><b>{t('Score BANT : {n} / 100', { n: score })}</b><span className="small muted">{t("Seuls les critères validés par une personne comptent.")}</span></div>
      {['budget', 'authority', 'need', 'timing'].map((k) => {
        const c = bant[k] || {};
        const e = edit[k] || {};
        return (
          <div className="cp-bant-row" key={k}>
            <div className="row"><b>{NAMES[k]}</b>{c.validated ? <Badge tone="ok">{t('Validé')}</Badge> : <Badge>{t('Non validé')}</Badge>}</div>
            <div className="cp-grid">
              <Field label={t('Note')}>{(p) => <select {...p} disabled={!has('write')} value={e.rating ?? c.rating ?? 0} onChange={(ev) => setEdit((s) => ({ ...s, [k]: { ...s[k], rating: ev.target.value } }))}>{RATE.map((l, i) => <option key={i} value={i}>{l}</option>)}</select>}</Field>
              <Field label={t('Remarque')}>{(p) => <input {...p} type="text" maxLength={300} disabled={!has('write')} value={e.note ?? c.note ?? ''} onChange={(ev) => setEdit((s) => ({ ...s, [k]: { ...s[k], note: ev.target.value } }))} />}</Field>
            </div>
            {c.suggestion ? (
              <div className="cp-sugg small"><Icon name="wand-magic-sparkles" /> {t("Suggestion de l'IA : {n} / 4", { n: c.suggestion.rating })} — {tsrv(c.suggestion.evidence)}
                {has('write') ? <Button size="sm" variant="soft" loading={busy} onClick={() => validate(k)}>{t('Valider la suggestion')}</Button> : null}</div>
            ) : null}
          </div>
        );
      })}
      {has('write') ? (
        <div className="row">
          <Button variant="primary" size="sm" disabled={!dirty} loading={busy} onClick={save}>{t('Valider mes notes')}</Button>
          <Button size="sm" icon="wand-magic-sparkles" loading={busy} onClick={suggest}>{t("Suggestion d'après la conversation")}</Button>
        </div>
      ) : null}
    </div>
  );
}

/** Pastille de statut d'un prospect ou d'une opportunité. */
export function StatusTag({ status, kind = 'lead' }) {
  const L = useL();
  return <Tag map={kind === 'lead' ? L.leadStatus : L.oppStatus} k={status} />;
}
