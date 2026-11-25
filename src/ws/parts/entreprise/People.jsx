import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, EmptyState, Icon } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import { joinLink } from './lib.js';

/* Personnes de l'entreprise : identité individuelle, invitation personnelle (code à usage unique), affectation aux postes. */

/** Postes ouverts, regroupés par département (pour les listes de choix). */
export function openPosts(chart) {
  const out = [];
  for (const dir of chart.directions) {
    for (const p of dir.directors) if (p.active) out.push({ ...p, group: tsrv(dir.name) });
    for (const d of dir.departments) if (d.active) for (const p of d.posts) if (p.active) out.push({ ...p, group: tsrv(d.name) });
  }
  for (const d of chart.departments) if (d.active) for (const p of d.posts) if (p.active) out.push({ ...p, group: tsrv(d.name) });
  return out;
}

export function CodeBox({ code, name }) {
  const { copy } = useWs();
  const t = useT();
  const text = t("Bonjour {name}, voici votre code d'invitation personnel : {code}. Ouvrez {link} (ou saisissez le code dans « Rejoindre avec un code »).", { name, code, link: joinLink(code) });
  return (
    <div className="ent-code" role="group" aria-label={t("Code d'invitation")}>
      <code>{code}</code>
      <Button size="sm" icon="copy" onClick={() => copy(code, t('Code copié.'))}>{t('Copier le code')}</Button>
      <Button size="sm" icon="link" onClick={() => copy(text, t("Message d'invitation copié."))}>{t("Copier le message d'invitation")}</Button>
    </div>
  );
}

/** Ajouter une personne : nom, coordonnées facultatives, poste, rôle ; un code d'invitation personnel est créé. */
export function AddPerson({ chart, done }) {
  const { oapi, can, fail } = useWs();
  const t = useT();
  const posts = openPosts(chart);
  const [v, setV] = useState({ fullName: '', email: '', phone: '', role: 'member', postId: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [made, setMade] = useState(null);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const groups = [...new Set(posts.map((p) => p.group))];
  const go = (ev) => {
    ev.preventDefault();
    if (!v.fullName.trim()) { setErr(t('Indiquez le nom de la personne.')); return; }
    setBusy(true); setErr('');
    oapi('POST', '/entreprise/people', { fullName: v.fullName.trim(), email: v.email.trim(), phone: v.phone.trim(), role: v.role, postIds: v.postId ? [Number(v.postId)] : [] })
      .then((j) => { setMade({ code: j.code, name: v.fullName.trim() }); done(false); })
      .catch((e) => { setErr(tsrv(e.message)); if (e.status === 401) fail(e); }).finally(() => setBusy(false));
  };
  if (made) {
    return (
      <div className="ws-form">
        <p><b>{t('{name} est ajouté(e).', { name: made.name })}</b></p>
        <p className="muted">{t("Transmettez-lui ce code personnel : il ne sert qu'une fois et expire dans 14 jours. À son arrivée, elle ou il retrouve directement son poste.")}</p>
        <CodeBox code={made.code} name={made.name} />
        <div className="row"><Button onClick={() => { setMade(null); setV({ fullName: '', email: '', phone: '', role: 'member', postId: '' }); }}>{t('Ajouter une autre personne')}</Button><Button variant="primary" onClick={() => done(true)}>{t('Terminer')}</Button></div>
      </div>
    );
  }
  return (
    <form className="ws-form" noValidate onSubmit={go}>
      <label className="fld"><span>{t('Nom complet')}</span><input value={v.fullName} onChange={(e) => set('fullName', e.target.value)} autoFocus /></label>
      <div className="ent-two">
        <label className="fld"><span>{t('Adresse e-mail')} <small>({t('facultatif')})</small></span><input type="email" value={v.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label className="fld"><span>{t('Téléphone')} <small>({t('facultatif')})</small></span><input value={v.phone} onChange={(e) => set('phone', e.target.value)} /></label>
      </div>
      <label className="fld"><span>{t('Poste')}</span>
        <select value={v.postId} onChange={(e) => set('postId', e.target.value)}>
          <option value="">{t('Aucun poste pour le moment')}</option>
          {groups.map((g) => <optgroup key={g} label={g}>{posts.filter((p) => p.group === g).map((p) => <option key={p.id} value={p.id} disabled={p.vacant < 1}>{tsrv(p.title)}{p.vacant < 1 ? ' · ' + t('complet') : ''}</option>)}</optgroup>)}
        </select></label>
      <label className="fld"><span>{t("Rôle dans l'organisation")}</span>
        <select value={v.role} onChange={(e) => set('role', e.target.value)}>
          <option value="member">{t('Membre')}</option><option value="manager">{t('Responsable')}</option>{can('owner') ? <option value="admin">{t('Administrateur')}</option> : null}
        </select>
        <small>{t("Le poste donne l'accès aux espaces concernés ; le rôle reste « Membre » sauf besoin particulier.")}</small></label>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={busy}>{t('Créer et générer le code')}</Button></div>
    </form>
  );
}

export default function People({ chart, reload }) {
  const { can, modal, oapi, confirm, fail, toast } = useWs();
  const t = useT();
  const edit = can('admin');
  const people = chart.people;
  const add = () => modal(t('Ajouter une personne'), (close) => <AddPerson chart={chart} done={(fin) => { reload(); if (fin) close(); }} />, { wide: true });
  const enroll = () => oapi('GET', '/entreprise/people-elsewhere').then((j) => modal(t("Personne d'une autre organisation de l'entreprise"), (close) => <Enroll people={j.people} done={() => { close(); reload(); }} />)).catch(fail);
  const assign = (p) => modal(t('Affecter {name} à un poste', { name: p.name }), (close) => <PickPost chart={chart} person={p} done={() => { close(); reload(); }} />);
  const code = (p) => oapi('POST', '/entreprise/people/' + p.id + '/invite').then((j) => { reload(); modal(t('Nouveau code pour {name}', { name: p.name }), () => <CodeBox code={j.code} name={p.name} />); }).catch(fail);
  const del = (p) => confirm(t('Retirer {name} de la liste ? Son code d’invitation sera supprimé.', { name: p.name }), () => oapi('DELETE', '/entreprise/people/' + p.id).then(() => { toast(t('Personne retirée.')); reload(); }).catch(fail), t('Retirer'));
  return (
    <div className="ent-people">
      {edit ? <div className="row"><Button variant="primary" icon="user-plus" onClick={add}>{t('Ajouter une personne')}</Button><Button icon="users" onClick={enroll}>{t("Faire entrer une personne de l'entreprise")}</Button></div> : null}
      {people.length === 0 ? <EmptyState icon="users" title={t('Aucune personne pour le moment')}>{t("Ajoutez les employés : chacun garde sa propre identité (traçabilité, droits par personne).")}</EmptyState> : null}
      <ul className="ent-list">
        {people.map((p) => (
          <li className="ent-person" key={p.id}>
            <div className="ent-person-h">
              <span className="ent-av" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
              <div><b>{p.name}</b>
                <div className="muted small">{[p.memberTitle, p.email, p.phone].filter(Boolean).join(' · ')}</div></div>
              {p.isDg ? <Badge tone="brand">{t('Direction générale')}</Badge> : null}
              <Badge tone={p.status === 'invited' ? 'warn' : 'ok'}>{p.status === 'invited' ? t('Invitation en attente') : t('Dans l’équipe')}</Badge>
            </div>
            <div className="ent-holders">{p.posts.length ? p.posts.map((x) => <span className="ent-chip" key={x.assignmentId}><Icon name="briefcase" />{tsrv(x.title)}</span>) : <span className="muted small">{t('Aucun poste')}</span>}</div>
            {p.status === 'invited' && p.inviteCode ? <CodeBox code={p.inviteCode} name={p.name} /> : null}
            {edit ? (
              <div className="ent-actions">
                <Button size="sm" icon="briefcase" onClick={() => assign(p)}>{t('Affecter à un poste')}</Button>
                {p.status === 'invited' ? <Button size="sm" icon="refresh" onClick={() => code(p)}>{t('Nouveau code')}</Button> : null}
                {p.status === 'invited' ? <Button size="sm" variant="ghost" icon="trash" onClick={() => del(p)}>{t('Retirer')}</Button> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PickPost({ chart, person, done }) {
  const { oapi, fail, toast } = useWs();
  const t = useT();
  const mine = new Set(person.posts.map((x) => x.postId));
  const posts = openPosts(chart).filter((p) => !mine.has(p.id) && p.vacant > 0);
  const groups = [...new Set(posts.map((p) => p.group))];
  const [pid, setPid] = useState(posts[0] ? String(posts[0].id) : ''); const [busy, setBusy] = useState(false);
  if (!posts.length) return <p className="muted">{t('Aucun poste vacant : ajoutez des places ou créez un poste.')}</p>;
  const go = () => { setBusy(true); oapi('POST', '/entreprise/assignments', { postId: Number(pid), personId: person.id }).then(() => { toast(t('Personne affectée.')); done(); }).catch(fail).finally(() => setBusy(false)); };
  return (
    <div className="ws-form">
      <label className="fld"><span>{t('Poste')}</span><select value={pid} onChange={(e) => setPid(e.target.value)}>{groups.map((g) => <optgroup key={g} label={g}>{posts.filter((p) => p.group === g).map((p) => <option key={p.id} value={p.id}>{tsrv(p.title)}</option>)}</optgroup>)}</select></label>
      <div className="row"><Button variant="primary" loading={busy} onClick={go}>{t('Affecter')}</Button></div>
    </div>
  );
}

function Enroll({ people, done }) {
  const { oapi, fail, toast } = useWs();
  const t = useT();
  const [pid, setPid] = useState(people[0] ? String(people[0].id) : ''); const [role, setRole] = useState('member'); const [busy, setBusy] = useState(false);
  if (!people.length) return <p className="muted">{t("Toutes les personnes de l'entreprise font déjà partie de cette organisation, ou seule la direction générale peut en faire entrer.")}</p>;
  return (
    <div className="ws-form">
      <label className="fld"><span>{t('Personne')}</span><select value={pid} onChange={(e) => setPid(e.target.value)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="fld"><span>{t('Rôle')}</span><select value={role} onChange={(e) => setRole(e.target.value)}><option value="member">{t('Membre')}</option><option value="manager">{t('Responsable')}</option></select></label>
      <p className="muted small">{t("Ses affectations restent propres à chaque organisation : affectez-la ensuite à un poste de celle-ci.")}</p>
      <div className="row"><Button variant="primary" loading={busy} onClick={() => { setBusy(true); oapi('POST', '/entreprise/people/' + pid + '/enroll', { role }).then(() => { toast(t('Personne ajoutée à l\'organisation.')); done(); }).catch(fail).finally(() => setBusy(false)); }}>{t('Faire entrer')}</Button></div>
    </div>
  );
}
