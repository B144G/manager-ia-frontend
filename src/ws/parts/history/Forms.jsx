import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Button, Icon } from '../../ui/index.jsx';
import { CATEGORY_IDS, today, uploadMedia, useLabels } from './util.jsx';

/* Formulaires : événement, personne, envoi d'un média. Les champs reprennent les classes communes (fld) ; le serveur reste maître des règles. */

const DEFAULT_NATURE = { creation: 'good', recruitment: 'good', contract: 'good', award: 'good', launch: 'good', meeting: 'good', move: 'good', training: 'good', crisis: 'bad', loss: 'bad', dispute: 'bad', incident: 'bad', financial: 'bad', departure: 'bad', other: 'good' };

function useSubmit(fn) {
  const t = useT();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (ev) => {
    ev.preventDefault(); setErr(''); setBusy(true);
    try { await fn(); } catch (e) { setErr(e.message || t('Erreur')); }
    setBusy(false);
  };
  return { err, busy, run };
}

export function EventForm({ H, event, onDone, preset }) {
  const t = useT();
  const L = useLabels();
  const e0 = event || {};
  const [v, setV] = useState({
    title: e0.title || '', date: e0.date || (preset && preset.date) || today(), endDate: e0.endDate || '', place: e0.place || '', description: e0.description || '',
    category: e0.category || (preset && preset.category) || 'other', nature: e0.nature || (preset && preset.nature) || '', lesson: e0.lesson || '', successFactors: e0.successFactors || '',
    minutes: e0.minutes || '', visibility: e0.visibility || 'internal',
  });
  const [people, setPeople] = useState(() => new Set((e0.people || []).map((p) => p.id)));
  const [guests, setGuests] = useState(e0.guests && e0.guests.length ? e0.guests : []);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const S = useSubmit(async () => {
    if (!v.nature) throw new Error(t('Indiquez si c’est un moment fort ou un moment dur.'));
    const body = { ...v, endDate: v.endDate || null, peopleIds: [...people], guests: v.category === 'meeting' ? guests.filter((g) => g.name.trim()) : [] };
    await H.oapi(event ? 'PUT' : 'POST', '/history/events' + (event ? '/' + event.id : ''), body);
    H.toast(t('Événement enregistré.'));
    onDone();
  });
  const togglePerson = (id) => setPeople((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <form className="hst-form" noValidate onSubmit={S.run}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, marginBottom: 6 }}>{t('Nature de ce moment')} *</legend>
        <div className="ui-seg" role="group" aria-label={t('Nature de ce moment')}>
          <button type="button" aria-pressed={v.nature === 'good'} onClick={() => set('nature', 'good')}><Icon name="arrow-trend-up" /> {L.nature.good}</button>
          <button type="button" aria-pressed={v.nature === 'bad'} onClick={() => set('nature', 'bad')}><Icon name="arrow-trend-down" /> {L.nature.bad}</button>
        </div>
      </fieldset>
      <label className="fld"><span>{t('Titre')} *</span><input value={v.title} maxLength={160} onChange={(x) => set('title', x.target.value)} placeholder={t('Ex. : Premier grand contrat')} /></label>
      <div className="two">
        <label className="fld"><span>{t('Date')} *</span><input type="date" value={v.date} onChange={(x) => set('date', x.target.value)} /></label>
        <label className="fld"><span>{t('Date de fin (facultatif)')}</span><input type="date" value={v.endDate} onChange={(x) => set('endDate', x.target.value)} /></label>
      </div>
      <div className="two">
        <label className="fld"><span>{t('Catégorie')}</span>
          <select value={v.category} onChange={(x) => { set('category', x.target.value); if (!v.nature) set('nature', DEFAULT_NATURE[x.target.value]); }}>
            {CATEGORY_IDS.map((c) => <option key={c} value={c}>{L.cat[c]}</option>)}
          </select>
        </label>
        <label className="fld"><span>{t('Lieu')}</span><input value={v.place} maxLength={160} onChange={(x) => set('place', x.target.value)} placeholder={t('Ex. : Douala')} /></label>
      </div>
      <label className="fld"><span>{t('Description')}</span><textarea rows={4} maxLength={4000} value={v.description} onChange={(x) => set('description', x.target.value)} /></label>
      {v.nature === 'bad' ? <label className="fld"><span>{t("Ce qu'on en a retenu")}</span><textarea rows={3} maxLength={3000} value={v.lesson} onChange={(x) => set('lesson', x.target.value)} placeholder={t('Les leçons apprises, ce que nous ferons autrement.')} /></label> : null}
      {v.nature === 'good' ? <label className="fld"><span>{t('Ce qui a fait le succès')}</span><textarea rows={3} maxLength={3000} value={v.successFactors} onChange={(x) => set('successFactors', x.target.value)} placeholder={t('Les décisions, les personnes et les habitudes qui ont fait la différence.')} /></label> : null}
      {v.category === 'meeting' ? (
        <>
          <label className="fld"><span>{t('Compte rendu court')}</span><textarea rows={4} maxLength={6000} value={v.minutes} onChange={(x) => set('minutes', x.target.value)} /></label>
          <div>
            <b>{t('Participants externes')}</b>
            {guests.map((g, i) => (
              <div className="hst-guest" key={i} style={{ marginTop: 6 }}>
                <input aria-label={t('Nom')} placeholder={t('Nom')} value={g.name} onChange={(x) => setGuests(guests.map((y, j) => (j === i ? { ...y, name: x.target.value } : y)))} />
                <input aria-label={t('Société')} placeholder={t('Société')} value={g.org || ''} onChange={(x) => setGuests(guests.map((y, j) => (j === i ? { ...y, org: x.target.value } : y)))} />
                <Button size="sm" iconOnly icon="trash" label={t('Retirer')} onClick={() => setGuests(guests.filter((_, j) => j !== i))} />
              </div>
            ))}
            <div style={{ marginTop: 6 }}><Button size="sm" icon="plus" onClick={() => setGuests([...guests, { name: '', org: '', role: '' }])}>{t('Ajouter un participant externe')}</Button></div>
          </div>
        </>
      ) : null}
      <div>
        <b>{v.category === 'meeting' ? t('Participants internes') : t('Personnes concernées')}</b>
        {H.people.length ? (
          <div className="hst-people-pick" style={{ marginTop: 6 }}>
            {H.people.map((p) => <label key={p.id}><input type="checkbox" checked={people.has(p.id)} onChange={() => togglePerson(p.id)} />{p.name}</label>)}
          </div>
        ) : <p className="muted small">{t("Ajoutez d'abord des personnes dans « Personnes et organigramme ».")}</p>}
      </div>
      {H.direction ? (
        <label className="fld"><span>{t('Qui peut le lire ?')}</span>
          <select value={v.visibility} onChange={(x) => set('visibility', x.target.value)}>
            <option value="internal">{L.vis.internal}</option><option value="direction">{L.vis.direction}</option>
          </select>
        </label>
      ) : null}
      <p className="ws-err" role="alert">{S.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={S.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

export function PersonForm({ H, person, onDone }) {
  const t = useT();
  const L = useLabels();
  const p0 = person || {};
  const [v, setV] = useState({ name: p0.name || '', title: p0.title || '', level: String(p0.level ?? 5), parentId: p0.parentId ? String(p0.parentId) : '', employeeId: p0.employeeId ? String(p0.employeeId) : '',
    startDate: p0.startDate || '', endDate: p0.endDate || '', departureReason: p0.departureReason || '', bio: p0.bio || '' });
  const [photo, setPhoto] = useState(null);
  const [consent, setConsent] = useState(false);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const S = useSubmit(async () => {
    const body = { name: v.name, title: v.title, level: Number(v.level), parentId: v.parentId || null, employeeId: v.employeeId || null, startDate: v.startDate || null, endDate: v.endDate || null, departureReason: v.departureReason, bio: v.bio };
    const r = await H.oapi(person ? 'PUT' : 'POST', '/history/people' + (person ? '/' + person.id : ''), body);
    const id = person ? person.id : r.id;
    if (photo) await uploadMedia(H.orgId, photo, { personId: id, avatar: true, consent });
    H.toast(t('Personne enregistrée.'));
    onDone();
  });
  const emps = H.employees || [];
  return (
    <form className="hst-form" noValidate onSubmit={S.run}>
      <label className="fld"><span>{t('Nom')} *</span><input value={v.name} maxLength={100} onChange={(x) => set('name', x.target.value)} /></label>
      <div className="two">
        <label className="fld"><span>{t('Poste')}</span><input value={v.title} maxLength={100} onChange={(x) => set('title', x.target.value)} placeholder={t('Ex. : Directeur technique')} /></label>
        <label className="fld"><span>{t('Niveau hiérarchique')}</span>
          <select value={v.level} onChange={(x) => set('level', x.target.value)}>{L.level.slice(0, 7).map((l, i) => <option key={i} value={i}>{l}</option>)}</select>
        </label>
      </div>
      <label className="fld"><span>{t('Supérieur direct')}</span>
        <select value={v.parentId} onChange={(x) => set('parentId', x.target.value)}>
          <option value="">{t('Aucun (sommet de l’organigramme)')}</option>
          {H.people.filter((p) => !person || p.id !== person.id).map((p) => <option key={p.id} value={p.id}>{p.name}{p.title ? ' — ' + p.title : ''}</option>)}
        </select>
      </label>
      {H.can('manager') ? (
        <label className="fld"><span>{t('Fiche employé (Ressources humaines)')}</span>
          <select value={v.employeeId} onChange={(x) => set('employeeId', x.target.value)}>
            <option value="">{t('Aucune')}</option>
            {person && person.employeeId && !emps.some((e) => e.id === person.employeeId) ? <option value={person.employeeId}>{t('Fiche déjà reliée')}</option> : null}
            {emps.map((e) => <option key={e.id} value={e.id}>{e.name}{e.job ? ' — ' + e.job : ''}</option>)}
          </select>
        </label>
      ) : null}
      <div className="two">
        <label className="fld"><span>{t("Date d'arrivée")}</span><input type="date" value={v.startDate} onChange={(x) => set('startDate', x.target.value)} /></label>
        <label className="fld"><span>{t('Date de départ')}</span><input type="date" value={v.endDate} onChange={(x) => set('endDate', x.target.value)} /></label>
      </div>
      {v.endDate ? <label className="fld"><span>{t('Motif du départ')}</span><input value={v.departureReason} maxLength={300} onChange={(x) => set('departureReason', x.target.value)} /></label> : null}
      <label className="fld"><span>{t('Parcours, rôle, anecdotes')}</span><textarea rows={4} maxLength={2000} value={v.bio} onChange={(x) => set('bio', x.target.value)} /></label>
      <label className="fld"><span>{t('Photo (JPEG, PNG, WebP ; 8 Mo au plus)')}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(x) => setPhoto(x.target.files[0] || null)} /></label>
      {photo ? <label className="check"><input type="checkbox" checked={consent} onChange={(x) => setConsent(x.target.checked)} /><span>{t("La personne a donné son accord pour que sa photo soit visible de toute l'entreprise. Sans cet accord, seule la direction la voit.")}</span></label> : null}
      <p className="ws-err" role="alert">{S.err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={S.busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}

export function MediaForm({ H, preset, onDone }) {
  const t = useT();
  const L = useLabels();
  const [file, setFile] = useState(null);
  const [v, setV] = useState({ caption: '', eventId: preset && preset.eventId ? String(preset.eventId) : '', visibility: 'internal', hasPeople: false, consent: false, takenOn: '' });
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const S = useSubmit(async () => {
    if (!file) throw new Error(t('Choisissez un fichier.'));
    const big = file.type.startsWith('video/') ? 20 : 8;
    if (file.size > big * 1024 * 1024) throw new Error(t('Fichier trop lourd : {n} Mo au plus.', { n: big }));
    await uploadMedia(H.orgId, file, { eventId: v.eventId, caption: v.caption, visibility: v.visibility, hasPeople: v.hasPeople, consent: v.hasPeople && v.consent, takenOn: v.takenOn });
    H.toast(t('Fichier ajouté.'));
    onDone();
  });
  return (
    <form className="hst-form" noValidate onSubmit={S.run}>
      <label className="fld"><span>{t('Image ou vidéo')} *</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(x) => setFile(x.target.files[0] || null)} />
        <small>{t('Images : JPEG, PNG, WebP, GIF (8 Mo au plus). Vidéos : MP4, WebM, MOV (20 Mo au plus).')}</small></label>
      <label className="fld"><span>{t('Légende')}</span><input value={v.caption} maxLength={300} onChange={(x) => set('caption', x.target.value)} /></label>
      <div className="two">
        <label className="fld"><span>{t('Événement')}</span>
          <select value={v.eventId} onChange={(x) => set('eventId', x.target.value)}>
            <option value="">{t('Aucun (photo de la galerie)')}</option>
            {H.events.map((e) => <option key={e.id} value={e.id}>{e.date.slice(0, 4)} — {e.title}</option>)}
          </select>
        </label>
        <label className="fld"><span>{t('Date de prise de vue')}</span><input type="date" value={v.takenOn} onChange={(x) => set('takenOn', x.target.value)} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={v.hasPeople} onChange={(x) => set('hasPeople', x.target.checked)} /><span>{t('Des personnes sont reconnaissables sur ce fichier.')}</span></label>
      {v.hasPeople ? <label className="check"><input type="checkbox" checked={v.consent} onChange={(x) => set('consent', x.target.checked)} /><span>{t("Ces personnes ont donné leur accord. Sans cet accord, seule la direction voit le fichier.")}</span></label> : null}
      <label className="fld"><span>{t('Qui peut le voir ?')}</span>
        <select value={v.visibility} onChange={(x) => set('visibility', x.target.value)}><option value="internal">{L.vis.internal}</option><option value="direction">{L.vis.direction}</option></select>
      </label>
      <p className="ws-err" role="alert">{S.err}</p>
      <div className="row"><Button variant="primary" type="submit" icon="upload" loading={S.busy}>{t('Envoyer')}</Button></div>
    </form>
  );
}
