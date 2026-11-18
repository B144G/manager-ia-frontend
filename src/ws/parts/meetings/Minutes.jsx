import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Alert, Badge, Button, Card, EmptyState, Field } from '../../ui/index.jsx';
import { ReasonForm, fmtShort, useDownload, useLabels, useMtg } from './common.jsx';

/* Déroulé (présence réelle, notes point par point) et compte rendu (décisions, actions, soumission, validation, versions). */

function ActionForm({ close, onSaved, meeting, agenda, members, action }) {
  const t = useT();
  const { oapi, fail } = useMtg();
  const [text, setText] = useState(action ? action.text : '');
  const [assigneeId, setAssigneeId] = useState(action && action.assigneeId ? String(action.assigneeId) : '');
  const [assigneeName, setAssigneeName] = useState(action && !action.assigneeId ? action.assignee : '');
  const [due, setDue] = useState(action && action.due ? action.due : '');
  const [agendaId, setAgendaId] = useState(action && action.agendaId ? String(action.agendaId) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = (ev) => {
    ev.preventDefault(); setErr('');
    if (!text.trim()) { setErr(t("Décrivez l'action.")); return; }
    const body = { text, assigneeId: assigneeId || null, assigneeName: assigneeId ? '' : assigneeName, due: due || null, agendaId: agendaId || null };
    setBusy(true);
    oapi(action ? 'PUT' : 'POST', `/meetings/${meeting.id}/actions${action ? '/' + action.id : ''}`, body).then(() => { close(); onSaved(); }).catch((e) => { setBusy(false); if (e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  return (
    <form className="ws-form" onSubmit={save} noValidate>
      <Field label={t('Action à mener')} required>{(p) => <textarea {...p} rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />}</Field>
      <div className="mtg-grid2">
        <Field label={t('Responsable')}>{(p) => <select {...p} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">{t('— Personne extérieure ou à définir —')}</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select>}</Field>
        {!assigneeId ? <Field label={t('Nom du responsable (facultatif)')}>{(p) => <input {...p} value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} maxLength={100} />}</Field> : null}
        <Field label={t('Échéance')}>{(p) => <input {...p} type="date" min={meeting.date} value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
        <Field label={t("Point de l'ordre du jour")}>{(p) => <select {...p} value={agendaId} onChange={(e) => setAgendaId(e.target.value)}><option value="">{t('— Aucun —')}</option>{agenda.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>}</Field>
      </div>
      <p className="mtg-muted">{t('À la validation du compte rendu, cette action devient une tâche assignée dans Projets, avec son échéance.')}</p>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      <div className="mtg-row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </form>
  );
}

function DecisionForm({ close, onSaved, meeting, agenda, decision }) {
  const t = useT();
  const { oapi, fail } = useMtg();
  const [text, setText] = useState(decision ? decision.text : '');
  const [agendaId, setAgendaId] = useState(decision && decision.agendaId ? String(decision.agendaId) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = (ev) => {
    ev.preventDefault(); setErr('');
    if (!text.trim()) { setErr(t('Écrivez la décision.')); return; }
    setBusy(true);
    oapi(decision ? 'PUT' : 'POST', `/meetings/${meeting.id}/decisions${decision ? '/' + decision.id : ''}`, { text, agendaId: agendaId || null }).then(() => { close(); onSaved(); }).catch((e) => { setBusy(false); if (e.status === 401) fail(e); setErr(tsrv(e.message)); });
  };
  return (
    <form className="ws-form" onSubmit={save} noValidate>
      <Field label={t('Décision prise')} required>{(p) => <textarea {...p} rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />}</Field>
      <Field label={t("Point de l'ordre du jour")}>{(p) => <select {...p} value={agendaId} onChange={(e) => setAgendaId(e.target.value)}><option value="">{t('— Aucun —')}</option>{agenda.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>}</Field>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      <div className="mtg-row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button><Button type="button" variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </form>
  );
}

/** Proposition de l'IA : décisions et actions à cocher. Rien n'est enregistré sans validation de la personne. */
function ExtractReview({ close, meeting, proposal, onSaved }) {
  const t = useT();
  const { oapi, fail, toast, dateFr } = useMtg();
  const [dsel, setDsel] = useState(() => new Set(proposal.decisions.map((_, i) => i)));
  const [asel, setAsel] = useState(() => new Set(proposal.actions.map((_, i) => i)));
  const [busy, setBusy] = useState(false);
  const flip = (setter, i) => setter((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const save = async () => {
    setBusy(true);
    try {
      const decisions = proposal.decisions.filter((_, i) => dsel.has(i)).map((d) => ({ text: d.text }));
      const actions = proposal.actions.filter((_, i) => asel.has(i)).map((a) => ({ text: a.text, assigneeId: a.assigneeId, assigneeName: a.assigneeName, due: a.due }));
      if (decisions.length) await oapi('POST', `/meetings/${meeting.id}/decisions`, { items: decisions });
      if (actions.length) await oapi('POST', `/meetings/${meeting.id}/actions`, { items: actions });
      toast(t('{n} élément(s) ajouté(s) au compte rendu.', { n: decisions.length + actions.length }));
      close(); onSaved();
    } catch (e) { setBusy(false); fail(e); }
  };
  return (
    <div className="ws-form">
      <Alert tone="info">{t("Proposition de l'IA à relire : cochez ce que vous gardez. Rien n'est ajouté avant votre accord.")}</Alert>
      <b>{t('Décisions')}</b>
      {proposal.decisions.length ? proposal.decisions.map((d, i) => <label className="mtg-check" key={i}><input type="checkbox" checked={dsel.has(i)} onChange={() => flip(setDsel, i)} /><span>{d.text}</span></label>) : <p className="mtg-muted">{t('Aucune décision trouvée.')}</p>}
      <b>{t('Actions')}</b>
      {proposal.actions.length ? proposal.actions.map((a, i) => <label className="mtg-check" key={i}><input type="checkbox" checked={asel.has(i)} onChange={() => flip(setAsel, i)} /><span>{a.text}{a.assigneeName ? ` — ${a.assigneeName}` : ''}{a.due ? ` — ${dateFr(a.due)}` : ''}</span></label>) : <p className="mtg-muted">{t('Aucune action trouvée.')}</p>}
      <div className="mtg-row"><Button variant="primary" loading={busy} onClick={save}>{t('Ajouter la sélection')}</Button><Button variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </div>
  );
}

function SummaryReview({ close, text, onUse }) {
  const t = useT();
  const [v, setV] = useState(text);
  return (
    <div className="ws-form">
      <Alert tone="info">{t("Résumé proposé par l'IA : relisez-le et corrigez-le. Il ne sera gardé dans le brouillon que si vous le choisissez.")}</Alert>
      <textarea rows={8} value={v} onChange={(e) => setV(e.target.value)} maxLength={8000} aria-label={t('Résumé')} />
      <div className="mtg-row"><Button variant="primary" onClick={() => { onUse(v); close(); }}>{t('Utiliser ce résumé')}</Button><Button variant="ghost" onClick={close}>{t('Annuler')}</Button></div>
    </div>
  );
}

export function Run({ j, reload }) {
  const t = useT();
  const L = useLabels();
  const { oapi, modal, toast, fail } = useMtg();
  const m = j.meeting;
  const canWrite = j.rights.write;
  const [summary, setSummary] = useState(j.summary);
  const [next, setNext] = useState(j.nextMeeting);
  const [notes, setNotes] = useState(() => Object.fromEntries(j.agenda.map((a) => [a.id, { notes: a.notes, done: a.done }])));
  const [att, setAtt] = useState(() => Object.fromEntries(j.participants.map((p) => [p.id, p.attended])));
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const save = (quiet) => {
    setBusy(true);
    return oapi('PUT', `/meetings/${m.id}/notes`, { summary, nextMeeting: next, agenda: j.agenda.map((a) => ({ id: a.id, notes: notes[a.id].notes, done: notes[a.id].done })), attendance: j.participants.map((p) => ({ id: p.id, attended: att[p.id] })) })
      .then(() => { if (quiet !== true) { toast(t('Déroulé enregistré.')); reload(); } }).finally(() => setBusy(false));
  };
  const aiSummary = () => {
    setAiBusy(true);
    save(true).then(() => oapi('POST', `/meetings/${m.id}/ai/summary`, {})).then((r) => modal(t("Résumé proposé par l'IA"), (close) => <SummaryReview close={close} text={r.summary} onUse={setSummary} />, { wide: true })).catch(fail).finally(() => setAiBusy(false));
  };
  const hold = () => oapi('POST', `/meetings/${m.id}/hold`, {}).then(() => { toast(t('Réunion marquée comme tenue.')); reload(); }).catch(fail);
  return (
    <div className="mtg">
      {!canWrite ? <Alert tone="info">{m.minutesStatus === 'validated' ? t('Le compte rendu est validé : pour le modifier, créez une nouvelle version (onglet Compte rendu).') : m.minutesStatus === 'submitted' ? t('Le compte rendu est soumis à validation : le déroulé est verrouillé.') : t('Seules les personnes qui gèrent cette réunion rédigent le déroulé.')}</Alert> : null}
      {canWrite && m.status === 'planned' ? <div><Button icon="check" onClick={hold}>{t('Marquer la réunion comme tenue')}</Button></div> : null}
      <Card title={t('Présence réelle')} subtitle={t('Qui était vraiment là ? Cela alimente le taux de présence.')}>
        <ul className="mtg-list">{j.participants.map((p) => (
          <li className="mtg-person" key={p.id}>
            <span><b>{p.name}</b><small>{L.resp[p.response]}{p.reason ? ' — ' + p.reason : ''}</small></span>
            {canWrite ? (
              <span className="ui-seg" role="group" aria-label={t('Présence de {name}', { name: p.name })}>
                {[['yes', t('Présent')], ['no', t('Absent')]].map(([v, lab]) => <button key={v} type="button" aria-pressed={att[p.id] === v} onClick={() => setAtt((s) => ({ ...s, [p.id]: s[p.id] === v ? 'unknown' : v }))}>{lab}</button>)}
              </span>
            ) : <Badge tone={p.attended === 'yes' ? 'ok' : p.attended === 'no' ? 'danger' : 'neutral'}>{p.attended === 'yes' ? t('Présent') : p.attended === 'no' ? t('Absent') : '—'}</Badge>}
          </li>
        ))}</ul>
      </Card>
      <Card title={t('Notes point par point')}>
        {j.agenda.length ? <div className="mtg-sec">{j.agenda.map((a, i) => (
          <div className="mtg-point" key={a.id}>
            <div className="mtg-point-h"><b>{i + 1}. {a.title}</b>{a.owner ? <Badge tone="outline">{a.owner}</Badge> : null}{a.durationMin ? <Badge tone="neutral">{t('{n} min', { n: a.durationMin })}</Badge> : null}</div>
            {canWrite
              ? (
                <>
                  <textarea rows={3} aria-label={t('Notes du point {n}', { n: i + 1 })} value={notes[a.id].notes} onChange={(e) => setNotes((s) => ({ ...s, [a.id]: { ...s[a.id], notes: e.target.value } }))} maxLength={8000} />
                  <label className="mtg-check"><input type="checkbox" checked={notes[a.id].done} onChange={(e) => setNotes((s) => ({ ...s, [a.id]: { ...s[a.id], done: e.target.checked } }))} />{t('Point traité')}</label>
                </>
              )
              : <p className="mtg-pre">{a.notes || <span className="mtg-muted">—</span>}</p>}
          </div>
        ))}</div> : <EmptyState icon="list" title={t("Pas d'ordre du jour")}>{t("Ajoutez des points à l'ordre du jour depuis la convocation pour prendre des notes point par point.")}</EmptyState>}
      </Card>
      <Card title={t('Résumé et suite')} actions={canWrite ? <Button size="sm" icon="wand-magic-sparkles" loading={aiBusy} onClick={aiSummary}>{t("Résumé avec l'IA")}</Button> : null}>
        <div className="mtg-sec">
          {canWrite ? (
            <>
              <Field label={t('Résumé de la réunion')}>{(p) => <textarea {...p} rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={8000} />}</Field>
              <Field label={t('Prochaine réunion')}>{(p) => <input {...p} value={next} onChange={(e) => setNext(e.target.value)} maxLength={500} />}</Field>
            </>
          ) : <><p className="mtg-pre">{j.summary || '—'}</p>{j.nextMeeting ? <p><b>{t('Prochaine réunion')} :</b> {j.nextMeeting}</p> : null}</>}
        </div>
      </Card>
      {canWrite ? <div className="mtg-row"><Button variant="primary" icon="check" loading={busy} onClick={() => save(false)}>{t('Enregistrer le déroulé')}</Button></div> : null}
    </div>
  );
}

export function Minutes({ j, reload, members, goRun }) {
  const t = useT();
  const L = useLabels();
  const { oapi, modal, confirm, toast, fail, dateFr, info } = useMtg();
  const dl = useDownload();
  const [aiBusy, setAiBusy] = useState(false);
  const m = j.meeting;
  const r = j.rights;
  const mn = j.minutes;
  const base = `/meetings/${m.id}`;
  const me = info.me.userId;
  const call = (path, body, okMsg) => oapi('POST', base + path, body).then((x) => { if (okMsg) toast(okMsg(x)); reload(); return x; }).catch(fail);
  const addAction = (a) => modal(a ? t("Modifier l'action") : t('Nouvelle action'), (close) => <ActionForm close={close} onSaved={reload} meeting={m} agenda={j.agenda} members={members} action={a} />, { wide: true });
  const addDecision = (d) => modal(d ? t('Modifier la décision') : t('Nouvelle décision'), (close) => <DecisionForm close={close} onSaved={reload} meeting={m} agenda={j.agenda} decision={d} />);
  const extract = () => { setAiBusy(true); oapi('POST', base + '/ai/extract', {}).then((p) => modal(t("Décisions et actions proposées par l'IA"), (close) => <ExtractReview close={close} meeting={m} proposal={p} onSaved={reload} />, { wide: true })).catch(fail).finally(() => setAiBusy(false)); };
  const delDecision = (d) => confirm(t('Supprimer cette décision ?'), () => oapi('DELETE', `${base}/decisions/${d.id}`).then(reload).catch(fail));
  const delAction = (a) => confirm(t('Supprimer cette action ?'), () => oapi('DELETE', `${base}/actions/${a.id}`).then(reload).catch(fail));
  const setStatus = (a, status) => oapi('PUT', `${base}/actions/${a.id}/status`, { status }).then(() => { toast(t('Statut mis à jour.')); reload(); }).catch(fail);
  const submit = () => confirm(t("Soumettre le compte rendu à validation ? Il ne pourra plus être modifié tant qu'il n'est pas validé ou renvoyé."), () => call('/minutes/submit', {}, () => t('Compte rendu soumis à validation.')), t('Soumettre'));
  const validate = () => confirm(t('Valider le compte rendu ? Il sera verrouillé, envoyé aux participants, et chaque action deviendra une tâche dans Projets.'), () => call('/minutes/validate', {}, (x) => t('Compte rendu validé : {n} tâche(s) créée(s).', { n: x.tasks })), t('Valider'));
  const sendBack = () => modal(t('Renvoyer pour correction'), (close) => <ReasonForm close={close} label={t('Motif du renvoi')} submit={(reason) => oapi('POST', base + '/minutes/return', { reason })} onDone={() => { toast(t('Compte rendu renvoyé.')); reload(); }} />);
  const newVersion = () => modal(t('Nouvelle version'), (close) => <ReasonForm close={close} label={t('Pourquoi rouvrir le compte rendu validé ?')} submit={(reason) => oapi('POST', base + '/minutes/new-version', { reason })} onDone={() => { toast(t('Compte rendu rouvert : modifiez-le puis soumettez-le à nouveau.')); reload(); }} />);
  const pdf = (version) => dl(`${base}/minutes.pdf${version ? '?version=' + version : mn.status === 'validated' ? '' : '?draft=1'}`, `compte-rendu-${m.id}${version ? '-v' + version : ''}.pdf`);
  const editable = r.write;
  const canTrack = (a) => (r.write || r.validate || a.assigneeId === me) && (a.taskId || mn.status === 'validated');
  const bannerTone = { none: 'info', draft: 'warn', submitted: 'info', validated: 'ok' }[mn.status];
  const hasContent = j.summary || j.decisions.length || j.actions.length || j.agenda.some((a) => a.notes);
  const officialV = (mn.versions.find((v) => v.status === 'validated') || {}).version || mn.version;
  return (
    <div className="mtg">
      <Alert tone={bannerTone} title={mn.status === 'validated' ? t('Compte rendu validé (version {n})', { n: officialV }) : mn.status === 'submitted' ? t('Soumis à validation') : t('Brouillon du compte rendu')}>
        {mn.status === 'validated' ? t("Il est verrouillé. Pour le corriger, un validateur crée une nouvelle version : l'historique est conservé.") : null}
        {mn.status === 'submitted' ? (r.decide ? t('Relisez-le puis validez-le, ou renvoyez-le avec un motif.') : j.blockedByDistinct ? t("Le responsable du compte exige un validateur distinct de l'auteur : une autre personne autorisée doit le valider.") : t('En attente de la personne autorisée à le valider.')) : null}
        {mn.status === 'draft' || mn.status === 'none' ? (mn.returnReason ? t('Renvoyé pour correction : {reason}', { reason: mn.returnReason }) : t('Complétez le déroulé, les décisions et les actions, puis soumettez-le à validation.')) : null}
      </Alert>
      <div className="mtg-row">
        {r.submit && hasContent ? <Button variant="primary" icon="paper-plane" onClick={submit}>{t('Soumettre à validation')}</Button> : null}
        {r.decide ? <><Button variant="primary" icon="circle-check" onClick={validate}>{t('Valider')}</Button><Button icon="rotate-right" onClick={sendBack}>{t('Renvoyer pour correction')}</Button></> : null}
        {r.newVersion ? <Button icon="pen" onClick={newVersion}>{t('Créer une nouvelle version')}</Button> : null}
        {(mn.status === 'validated' || editable || r.validate) && hasContent ? <Button icon="file-pdf" onClick={() => pdf(null)}>{t('Exporter en PDF')}</Button> : null}
        {editable && mn.status !== 'validated' ? <Button variant="ghost" onClick={goRun}>{t('Aller au déroulé')}</Button> : null}
      </div>

      {j.summary ? <Card title={t('Résumé')}><p className="mtg-pre">{j.summary}</p>{j.nextMeeting ? <p className="mtg-muted">{t('Prochaine réunion')} : {j.nextMeeting}</p> : null}</Card> : null}

      <Card title={t('Décisions')} actions={editable ? <><Button size="sm" icon="wand-magic-sparkles" loading={aiBusy} onClick={extract}>{t("Extraire avec l'IA")}</Button><Button size="sm" icon="plus" onClick={() => addDecision(null)}>{t('Ajouter')}</Button></> : null}>
        {j.decisions.length ? (
          <ol className="mtg-list" style={{ listStyle: 'none', padding: 0 }}>{j.decisions.map((d, i) => (
            <li className="mtg-act" key={d.id}>
              <span><b>{i + 1}. {d.text}</b>{d.agendaId ? <small>{(j.agenda.find((a) => a.id === d.agendaId) || {}).title}</small> : null}</span>
              {editable ? <span className="mtg-row"><Button size="sm" variant="ghost" iconOnly label={t('Modifier')} icon="pen" onClick={() => addDecision(d)} /><Button size="sm" variant="ghost" iconOnly label={t('Supprimer')} icon="trash" onClick={() => delDecision(d)} /></span> : null}
            </li>
          ))}</ol>
        ) : <p className="mtg-muted">{t('Aucune décision notée.')}</p>}
      </Card>

      <Card title={t('Actions')} subtitle={t('Chaque action validée devient une tâche assignée dans Projets ; son statut remonte ici.')} actions={editable ? <Button size="sm" icon="plus" onClick={() => addAction(null)}>{t('Ajouter')}</Button> : null}>
        {j.actions.length ? (
          <ul className="mtg-list">{j.actions.map((a) => (
            <li className={'mtg-act' + (a.overdue ? ' late' : '') + (a.status === 'done' ? ' done' : '')} key={a.id}>
              <span><b>{a.text}</b><small>{a.assignee || t('Responsable à définir')}{a.due ? ' · ' + t('pour le {date}', { date: dateFr(a.due) }) : ''}{a.taskId ? ' · ' + t('tâche créée dans Projets') : ''}</small></span>
              <span className="mtg-row">
                <Badge tone={a.status === 'done' ? 'ok' : a.status === 'cancelled' ? 'neutral' : a.overdue ? 'danger' : 'brand'}>{a.overdue ? t('En retard') : L.action[a.status]}</Badge>
                {canTrack(a) && a.status !== 'cancelled' ? <Button size="sm" onClick={() => setStatus(a, a.status === 'done' ? 'open' : 'done')}>{a.status === 'done' ? t('Rouvrir') : t('Marquer faite')}</Button> : null}
                {canTrack(a) && a.status === 'open' && (r.write || r.validate) ? <Button size="sm" variant="ghost" onClick={() => setStatus(a, 'cancelled')}>{t('Annuler')}</Button> : null}
                {editable ? <><Button size="sm" variant="ghost" iconOnly label={t('Modifier')} icon="pen" onClick={() => addAction(a)} />{!a.taskId ? <Button size="sm" variant="ghost" iconOnly label={t('Supprimer')} icon="trash" onClick={() => delAction(a)} /> : null}</> : null}
              </span>
            </li>
          ))}</ul>
        ) : <p className="mtg-muted">{t('Aucune action notée.')}</p>}
      </Card>

      {mn.versions.length ? (
        <Card title={t('Historique des versions')}>
          <ul className="mtg-list">{mn.versions.map((v) => (
            <li className="mtg-act" key={v.version}>
              <span><b>{t('Version {n}', { n: v.version })}</b><small>{t('soumise par {who}', { who: v.submittedBy || '—' })} · {fmtShort(String(v.submittedAt).slice(0, 10))}{v.decidedBy ? ' · ' + t('décidée par {who}', { who: v.decidedBy }) : ''}{v.reason ? ' · ' + v.reason : ''}</small></span>
              <span className="mtg-row">
                <Badge tone={v.status === 'validated' ? 'ok' : v.status === 'returned' ? 'warn' : v.status === 'superseded' ? 'neutral' : 'info'}>{{ validated: t('Validée'), returned: t('Renvoyée'), superseded: t('Remplacée'), submitted: t('En attente') }[v.status]}</Badge>
                {v.status === 'validated' || v.status === 'superseded' ? <Button size="sm" icon="file-pdf" onClick={() => pdf(v.version)}>PDF</Button> : null}
              </span>
            </li>
          ))}</ul>
        </Card>
      ) : null}
    </div>
  );
}
