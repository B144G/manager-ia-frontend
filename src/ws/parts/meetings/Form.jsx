import { useEffect, useMemo, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Failed } from './Failed.jsx';
import { Alert, Badge, Button, Card, Field, Skeleton } from '../../ui/index.jsx';
import { useLoad } from '../../ui.jsx';
import { REMINDERS, TYPE_IDS, URGENCY_IDS, addDays, todayLocal, useLabels, useReminderLabel, useMtg } from './common.jsx';
import { ConflictCheck } from './Conflicts.jsx';
import { useBuiltinTemplates } from './Templates.jsx';

/* Convocation d'une réunion (création et modification) : titre, type, date et heure, durée, lieu ou lien visio, participants (équipe et invités),
   ordre du jour, pièces jointes de la Bibliothèque, récurrence, rappel. Le serveur contrôle les droits et les données. */

function DocPicker({ close, onPick }) {
  const t = useT();
  const { oapi } = useMtg();
  const ov = useLoad(() => oapi('GET', '/library/overview'), []);
  const [block, setBlock] = useState('');
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!block || q.trim().length < 2) { setRes(null); return undefined; }
    let off = false;
    const h = setTimeout(() => oapi('GET', `/library/blocks/${block}?q=${encodeURIComponent(q.trim())}`).then((j) => { if (!off) { setErr(''); setRes(j.docs || []); } }).catch((e) => { if (!off) { setRes([]); setErr(e.code === 'library_locked' ? t("Ce bloc est verrouillé : ouvrez la Bibliothèque pour le déverrouiller.") : tsrv(e.message)); } }), 300);
    return () => { off = true; clearTimeout(h); };
  }, [block, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const blocks = (ov.data && ov.data.blocks) || [];
  return (
    <div className="ws-form">
      <Field label={t('Bloc de la Bibliothèque')}>{(p) => <select {...p} value={block} onChange={(e) => setBlock(e.target.value)}><option value="">{t('Choisir un bloc…')}</option>{blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}</Field>
      <Field label={t('Nom du document (2 lettres au moins)')}>{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
      {err ? <p className="ws-err" role="alert">{err}</p> : null}
      {res && !res.length && !err ? <p className="mtg-muted">{t('Aucun document trouvé.')}</p> : null}
      {res ? <ul className="mtg-list">{res.map((d) => <li key={d.id}><button type="button" className="mtg-item" onClick={() => { onPick({ id: d.id, name: d.name }); close(); }}><span /><span><b>{d.name}</b></span><span /></button></li>)}</ul> : null}
    </div>
  );
}

export default function MeetingForm({ meeting, detail, prefillDate, done, cancel }) {
  const t = useT();
  const L = useLabels();
  const remLabel = useReminderLabel();
  const { oapi, modal, toast, fail, info } = useMtg();
  const builtin = useBuiltinTemplates();
  const edit = Boolean(meeting);
  const st = useLoad(() => Promise.all([oapi('GET', '/members'), oapi('GET', '/meetings/settings'), oapi('GET', '/meetings/templates'), oapi('GET', '/projects').catch(() => ({ projects: [] })), oapi('GET', '/meetings/types').catch(() => ({ custom: [] })), oapi('GET', '/meetings/scope-options').catch(() => ({ branches: [], departments: [] }))]), []);
  const [f, setF] = useState(() => ({
    title: meeting ? meeting.title : '', type: meeting ? meeting.type : '', date: meeting ? meeting.date : (prefillDate || addDays(todayLocal(), 1)), time: meeting ? meeting.time : '09:00', durationMin: meeting ? meeting.durationMin : 60,
    place: meeting ? meeting.place : '', link: meeting ? meeting.link : '', objective: meeting ? meeting.objective : '', confidential: meeting ? meeting.confidential : false,
    reminderMin: meeting ? meeting.reminderMin : 60, secretaryId: meeting && meeting.secretaryId ? String(meeting.secretaryId) : '', projectId: meeting && meeting.projectId ? String(meeting.projectId) : '',
    freq: '', count: 4, send: true, notify: false, urgency: meeting ? meeting.urgency : 'normal', chairId: meeting && meeting.chairId ? String(meeting.chairId) : '', typeId: meeting && meeting.typeId ? String(meeting.typeId) : '',
    branchId: meeting && meeting.branchId ? String(meeting.branchId) : '', departmentId: meeting && meeting.departmentId ? String(meeting.departmentId) : '', exceptions: [], skipHolidays: false, newExc: '', force: false, autoRoom: !meeting,
  }));
  const [sites, setSites] = useState(() => new Set(detail && detail.scope ? detail.scope.sites : []));
  const [depts, setDepts] = useState(() => new Set(detail && detail.scope ? detail.scope.depts : []));
  const [conflictBlocked, setConflictBlocked] = useState(false);
  const [members, setMembers] = useState(() => new Set(detail ? detail.participants.filter((p) => p.userId).map((p) => p.userId) : []));
  const [guests, setGuests] = useState(() => (detail ? detail.participants.filter((p) => !p.userId).map((p) => ({ name: p.name, email: p.email || '', phone: p.phone || '' })) : []));
  const [agenda, setAgenda] = useState(() => (detail ? detail.agenda.map((a) => ({ id: a.id, title: a.title, ownerId: a.ownerId ? String(a.ownerId) : '', ownerName: a.ownerId ? '' : a.owner, durationMin: a.durationMin, kind: a.kind || 'discuss' })) : []));
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const mems = (st.data && st.data[0].members) || [];
  const settings = st.data && st.data[1];
  const allowed = settings ? settings.me.convene : [];
  const customTpl = (st.data && st.data[2].templates) || [];
  const projects = (st.data && st.data[3].projects) || [];
  const customTypes = ((st.data && st.data[4].custom) || []).filter((x) => x.active && (allowed.includes(x.base) || x.id === Number(f.typeId)));
  const branches = (st.data && st.data[5].branches) || [];
  const departments = (st.data && st.data[5].departments) || [];
  const me = info.me.userId;
  useEffect(() => { if (settings && !f.type) set('type', allowed.includes('team') ? 'team' : allowed[0] || ''); }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const tpls = useMemo(() => [...customTpl, ...builtin], [customTpl, builtin]);

  if (st.error) return <Failed e={st.error} />;
  if (!st.data) return <Skeleton lines={8} />;
  if (!edit && !allowed.length) return <Alert tone="warn" title={t("Vous ne pouvez pas convoquer de réunion")}>{t('Le responsable du compte choisit qui peut convoquer, par personne, par rôle ou par type de réunion. Demandez-lui de vous accorder ce droit dans les réglages des réunions.')}</Alert>;

  const applyTpl = (id) => {
    const x = tpls.find((y) => String(y.id) === id);
    if (!x) return;
    setAgenda(x.items.map((i) => ({ id: null, title: i.title, ownerId: '', ownerName: '', durationMin: i.durationMin, kind: 'discuss' })));
    if (!f.title) set('title', x.name);
    if (allowed.includes(x.type)) set('type', x.type);
    set('durationMin', x.durationMin);
  };
  const aiAgenda = () => {
    setAiBusy(true);
    oapi('POST', '/meetings/ai/agenda', { type: f.type, title: f.title }).then((j) => {
      setAgenda(j.items.map((i) => ({ id: null, title: i.title, ownerId: '', ownerName: '', durationMin: i.durationMin })));
      toast(j.basedOn ? t('Ordre du jour proposé d\'après « {title} » : relisez-le avant d\'enregistrer.', { title: j.basedOn.title }) : t('Ordre du jour proposé : relisez-le avant d\'enregistrer.'));
    }).catch(fail).finally(() => setAiBusy(false));
  };
  const setA = (i, k, v) => setAgenda((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const moveA = (i, d) => setAgenda((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const pickDoc = () => modal(t('Joindre un document de la Bibliothèque'), (close) => <DocPicker close={close} onPick={(d) => setDocs((l) => (l.some((x) => x.id === d.id) ? l : [...l, d]))} />);
  const pickType = (v) => {
    if (v.startsWith('c')) {
      const x = customTypes.find((y) => 'c' + y.id === v);
      if (!x) return;
      setF((s) => ({ ...s, typeId: String(x.id), type: x.base, durationMin: x.durationMin, reminderMin: x.reminderMin, confidential: x.confidential }));
    } else setF((s) => ({ ...s, typeId: '', type: v }));
  };
  const toggleSet = (setter, id) => setter((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleM = (id) => setMembers((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = (ev) => {
    ev.preventDefault(); setErr('');
    if (!f.title.trim()) { setErr(t('Indiquez le titre de la réunion.')); return; }
    const body = {
      title: f.title, type: f.type, date: f.date, time: f.time, durationMin: Number(f.durationMin), place: f.place, link: f.link, objective: f.objective, confidential: f.confidential, reminderMin: Number(f.reminderMin),
      secretaryId: f.secretaryId || null, projectId: f.projectId || null, urgency: f.urgency, chairId: f.chairId || null, branchId: f.branchId || null, departmentId: f.departmentId || null, sites: [...sites], departments: [...depts], typeId: f.typeId || undefined, force: f.force || undefined, autoRoom: !edit && !f.link && f.autoRoom ? true : undefined,
      participants: [...[...members].map((userId) => ({ userId })), ...guests.filter((g) => g.name.trim() || g.email.trim() || g.phone.trim()).map((g) => ({ name: g.name, email: g.email, phone: g.phone }))],
      agenda: agenda.filter((a) => a.title.trim()).map((a) => ({ id: a.id || undefined, title: a.title, ownerId: a.ownerId || null, ownerName: a.ownerName || '', durationMin: Number(a.durationMin) || 0, kind: a.kind || 'discuss' })),
    };
    if (edit) body.notify = f.notify;
    else { body.attachments = docs.map((d) => d.id); body.send = f.send; if (f.freq) body.recurrence = { freq: f.freq, count: Number(f.count), exceptions: f.exceptions, skipHolidays: f.skipHolidays }; }
    setBusy(true);
    oapi(edit ? 'PUT' : 'POST', edit ? '/meetings/' + meeting.id : '/meetings', body).then((j) => {
      const inv = j.invite;
      toast(inv ? t('Réunion enregistrée. Invitations : {n} message(s) dans l\'application, {m} e-mail(s).', { n: inv.notices, m: inv.email.sent }) : t('Réunion enregistrée.'));
      done(edit ? meeting.id : j.id);
    }).catch((e) => { setBusy(false); if (e.status === 401) fail(e); if (e.code === 'conflict') setConflictBlocked(true); setErr(tsrv(e.message)); });
  };

  return (
    <form className="mtg" onSubmit={submit} noValidate>
      <Card title={t('Convocation')}>
        <div className="mtg-sec">
          <Field label={t('Titre de la réunion')} required>{(p) => <input {...p} value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={160} />}</Field>
          <div className="mtg-grid2">
            <Field label={t('Type de réunion')} hint={t('Le type détermine qui peut convoquer et valider.')}>{(p) => <select {...p} value={f.typeId ? 'c' + f.typeId : f.type} onChange={(e) => pickType(e.target.value)}>
              <optgroup label={t('Catégories')}>{TYPE_IDS.filter((x) => allowed.includes(x) || x === f.type).map((x) => <option key={x} value={x}>{L.types[x]}</option>)}</optgroup>
              {customTypes.length ? <optgroup label={t('Types de votre organisation')}>{customTypes.map((x) => <option key={x.id} value={'c' + x.id}>{x.name}</option>)}</optgroup> : null}
            </select>}</Field>
            <Field label={t('Modèle d\'ordre du jour')}>{(p) => <select {...p} value="" onChange={(e) => applyTpl(e.target.value)}><option value="">{t('Choisir un modèle…')}</option>{tpls.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
          </div>
          <div className="mtg-grid2">
            <Field label={t('Date')} required>{(p) => <input {...p} type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />}</Field>
            <Field label={t('Heure')} required>{(p) => <input {...p} type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />}</Field>
            <Field label={t('Durée (minutes)')}>{(p) => <input {...p} type="number" min="5" max="1440" value={f.durationMin} onChange={(e) => set('durationMin', e.target.value)} />}</Field>
            <Field label={t('Rappel')}>{(p) => <select {...p} value={f.reminderMin} onChange={(e) => set('reminderMin', e.target.value)}>{REMINDERS.map((m) => <option key={m} value={m}>{remLabel(m)}</option>)}</select>}</Field>
          </div>
          <div className="mtg-grid2">
            <Field label={t("Niveau d'urgence")} hint={t('Une réunion urgente a un préavis réduit, des invitations envoyées tout de suite et une notification prioritaire.')}>{(p) => <select {...p} value={f.urgency} onChange={(e) => set('urgency', e.target.value)}>{URGENCY_IDS.map((x) => <option key={x} value={x}>{L.urgency[x]}</option>)}</select>}</Field>
            <Field label={t('Président de séance')} hint={t('Peut ouvrir et clore les votes.')}>{(p) => <select {...p} value={f.chairId} onChange={(e) => set('chairId', e.target.value)}><option value="">{t('— Aucun —')}</option>{mems.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select>}</Field>
          </div>
          <div className="mtg-grid2">
            <Field label={t('Lieu')}>{(p) => <input {...p} value={f.place} onChange={(e) => set('place', e.target.value)} maxLength={200} placeholder={t('Salle, adresse…')} />}</Field>
            <Field label={t('Lien de visioconférence')} hint={t('Collez un lien Meet, Zoom, Teams ou WhatsApp : Brij-IA ne fait que le transmettre aux participants.')}>{(p) => <input {...p} type="url" inputMode="url" value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" />}</Field>
          </div>
          <Field label={t('Objet de la réunion')}>{(p) => <textarea {...p} rows={2} value={f.objective} onChange={(e) => set('objective', e.target.value)} maxLength={2000} />}</Field>
          <div className="mtg-grid2">
            <Field label={t('Secrétaire de séance')} hint={t('Rédige le compte rendu avec vous.')}>{(p) => <select {...p} value={f.secretaryId} onChange={(e) => set('secretaryId', e.target.value)}><option value="">{t('— Aucun —')}</option>{mems.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select>}</Field>
            <Field label={t('Projet lié')} hint={t('Les actions décidées deviendront des tâches de ce projet.')}>{(p) => <select {...p} value={f.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">{t('— Aucun —')}</option>{projects.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}</Field>
          </div>
          {branches.length || departments.length ? (
            <div className="mtg-grid2">
              {branches.length ? <Field label={t("Site d'accueil")}>{(p) => <select {...p} value={f.branchId} onChange={(e) => set('branchId', e.target.value)}><option value="">{t('— Aucun —')}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}</Field> : null}
              {departments.length ? <Field label={t('Service porteur')}>{(p) => <select {...p} value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)}><option value="">{t('— Aucun —')}</option>{departments.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}</Field> : null}
            </div>
          ) : null}
          {branches.length > 1 ? <div><b>{t('Autres sites concernés (réunion multi-sites)')}</b><div className="mtg-row" role="group" aria-label={t('Autres sites concernés')}>{branches.filter((b) => String(b.id) !== f.branchId).map((b) => <label className="mtg-check" key={b.id}><input type="checkbox" checked={sites.has(b.id)} onChange={() => toggleSet(setSites, b.id)} />{b.name}</label>)}</div></div> : null}
          {departments.length > 1 ? <div><b>{t('Autres services concernés (réunion inter-services)')}</b><div className="mtg-row" role="group" aria-label={t('Autres services concernés')}>{departments.filter((b) => String(b.id) !== f.departmentId).map((b) => <label className="mtg-check" key={b.id}><input type="checkbox" checked={depts.has(b.id)} onChange={() => toggleSet(setDepts, b.id)} />{b.name}</label>)}</div></div> : null}
          {!edit && !f.link ? <label className="mtg-check"><input type="checkbox" checked={f.autoRoom} onChange={(e) => set('autoRoom', e.target.checked)} />{t('Créer une salle de visioconférence avec partage d’écran (Jitsi Meet)')}</label> : null}
          <label className="mtg-check"><input type="checkbox" checked={f.confidential} onChange={(e) => set('confidential', e.target.checked)} />{t('Réunion confidentielle : visible seulement par ses participants')}</label>
          {!edit ? (
            <div className="mtg-grid2">
              <Field label={t('Répétition')}>{(p) => <select {...p} value={f.freq} onChange={(e) => set('freq', e.target.value)}><option value="">{t('Une seule fois')}</option>{['weekly', 'biweekly', 'monthly', 'quarterly'].map((x) => <option key={x} value={x}>{L.freq[x]}</option>)}</select>}</Field>
              {f.freq ? <Field label={t('Nombre de réunions')}>{(p) => <input {...p} type="number" min="2" max="26" value={f.count} onChange={(e) => set('count', e.target.value)} />}</Field> : null}
            </div>
          ) : null}
          {!edit && f.freq ? (
            <div className="mtg-sec">
              <label className="mtg-check"><input type="checkbox" checked={f.skipHolidays} onChange={(e) => set('skipHolidays', e.target.checked)} />{t('Sauter les jours fériés')}</label>
              <div className="mtg-row">
                <Field label={t("Date d'exception (sautée)")}>{(p) => <input {...p} type="date" value={f.newExc} onChange={(e) => set('newExc', e.target.value)} />}</Field>
                <Button type="button" size="sm" icon="plus" onClick={() => { if (f.newExc && !f.exceptions.includes(f.newExc)) setF((s) => ({ ...s, exceptions: [...s.exceptions, s.newExc].sort(), newExc: '' })); }}>{t('Ajouter')}</Button>
              </div>
              {f.exceptions.length ? <div className="mtg-row">{f.exceptions.map((d) => <Badge key={d} tone="outline">{d} <button type="button" className="mtg-x" aria-label={t('Retirer la date {d}', { d })} onClick={() => setF((s) => ({ ...s, exceptions: s.exceptions.filter((x) => x !== d) }))}>×</button></Badge>)}</div> : null}
            </div>
          ) : null}
        </div>
      </Card>

      <ConflictCheck f={f} userIds={[...new Set([...members, me, ...(f.secretaryId ? [Number(f.secretaryId)] : []), ...(f.chairId ? [Number(f.chairId)] : [])])]} excludeId={edit ? meeting.id : undefined} onPick={(a) => setF((s) => ({ ...s, date: a.date, time: a.time }))} />

      <Card title={t('Participants')} subtitle={t('Vous êtes ajouté automatiquement comme organisateur.')}>
        <div className="mtg-sec">
          <div className="mtg-picks" role="group" aria-label={t("Membres de l'équipe")}>
            {mems.filter((m) => m.userId !== me).map((m) => <label key={m.userId}><input type="checkbox" checked={members.has(m.userId)} onChange={() => toggleM(m.userId)} /><span>{m.name}{m.title ? <small className="mtg-muted"> · {m.title}</small> : null}</span></label>)}
            {mems.length <= 1 ? <p className="mtg-muted">{t("Invitez d'abord des personnes dans l'équipe, ou ajoutez des invités externes ci-dessous.")}</p> : null}
          </div>
          <b>{t('Invités externes')}</b>
          {guests.map((g, i) => (
            <div className="mtg-edit-row" key={i}>
              <Field label={t('Nom')}>{(p) => <input {...p} value={g.name} onChange={(e) => setGuests((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={100} />}</Field>
              <Field label={t('E-mail')}>{(p) => <input {...p} type="email" inputMode="email" value={g.email} onChange={(e) => setGuests((l) => l.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />}</Field>
              <Field label={t('Téléphone')}>{(p) => <input {...p} type="tel" inputMode="tel" value={g.phone} onChange={(e) => setGuests((l) => l.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />}</Field>
              <Button type="button" iconOnly label={t('Retirer cet invité')} icon="trash" variant="ghost" onClick={() => setGuests((l) => l.filter((_, j) => j !== i))} />
            </div>
          ))}
          <div><Button type="button" size="sm" icon="user-plus" onClick={() => setGuests((l) => [...l, { name: '', email: '', phone: '' }])}>{t('Ajouter un invité externe')}</Button></div>
        </div>
      </Card>

      <Card title={t("Ordre du jour")} actions={<Button type="button" size="sm" icon="wand-magic-sparkles" loading={aiBusy} onClick={aiAgenda}>{t('Proposer avec l\'IA')}</Button>}>
        <div className="mtg-sec">
          <p className="mtg-muted">{t("L'IA propose un ordre du jour d'après les actions en retard de la dernière réunion du même type. Vous le relisez et le corrigez avant d'enregistrer.")}</p>
          {agenda.map((a, i) => (
            <div className="mtg-edit-row" key={i}>
              <Field label={t('Point')}>{(p) => <input {...p} value={a.title} onChange={(e) => setA(i, 'title', e.target.value)} maxLength={200} />}</Field>
              <Field label={t('Responsable')}>{(p) => <select {...p} value={a.ownerId} onChange={(e) => setA(i, 'ownerId', e.target.value)}><option value="">{a.ownerName || t('— Aucun —')}</option>{mems.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select>}</Field>
              <Field label={t('Minutes')}>{(p) => <input {...p} type="number" min="0" max="600" value={a.durationMin} onChange={(e) => setA(i, 'durationMin', e.target.value)} />}</Field>
              <Field label={t('Nature')}>{(p) => <select {...p} value={a.kind || 'discuss'} onChange={(e) => setA(i, 'kind', e.target.value)}>{['info', 'discuss', 'decide'].map((k) => <option key={k} value={k}>{L.agendaKind[k]}</option>)}</select>}</Field>
              <span className="mtg-row">
                <Button type="button" iconOnly label={t('Monter')} icon="chevron-up" variant="ghost" size="sm" onClick={() => moveA(i, -1)} />
                <Button type="button" iconOnly label={t('Descendre')} icon="chevron-down" variant="ghost" size="sm" onClick={() => moveA(i, 1)} />
                <Button type="button" iconOnly label={t('Retirer ce point')} icon="trash" variant="ghost" size="sm" onClick={() => setAgenda((l) => l.filter((_, j) => j !== i))} />
              </span>
            </div>
          ))}
          <div><Button type="button" size="sm" icon="plus" onClick={() => setAgenda((l) => [...l, { id: null, title: '', ownerId: '', ownerName: '', durationMin: 10, kind: 'discuss' }])}>{t('Ajouter un point')}</Button></div>
        </div>
      </Card>

      {!edit ? (
        <Card title={t('Pièces jointes')}>
          <div className="mtg-sec">
            {docs.map((d) => <div className="mtg-row" key={d.id}><Badge tone="outline"><span className="mtg-ellipsis">{d.name}</span></Badge><Button type="button" size="sm" variant="ghost" iconOnly label={t('Retirer')} icon="xmark" onClick={() => setDocs((l) => l.filter((x) => x.id !== d.id))} /></div>)}
            <div><Button type="button" size="sm" icon="paperclip" onClick={pickDoc}>{t('Joindre un document de la Bibliothèque')}</Button></div>
          </div>
        </Card>
      ) : null}

      {err ? <Alert tone="danger">{err}{conflictBlocked ? <div className="mtg-row" style={{ marginTop: 8 }}><label className="mtg-check"><input type="checkbox" checked={f.force} onChange={(e) => set('force', e.target.checked)} />{t('Convoquer malgré le conflit')}</label></div> : null}</Alert> : null}
      <div className="mtg-row">
        {!edit ? <label className="mtg-check"><input type="checkbox" checked={f.send} onChange={(e) => set('send', e.target.checked)} />{t('Envoyer les invitations maintenant')}</label> : <label className="mtg-check"><input type="checkbox" checked={f.notify} onChange={(e) => set('notify', e.target.checked)} />{t('Renvoyer la convocation par e-mail si la date, le lieu ou le lien change')}</label>}
      </div>
      <div className="mtg-row">
        <Button variant="primary" type="submit" loading={busy} icon="check">{edit ? t('Enregistrer les modifications') : t('Convoquer')}</Button>
        <Button type="button" variant="ghost" onClick={cancel}>{t('Annuler')}</Button>
      </div>
    </form>
  );
}
