import { useEffect, useRef, useState } from 'react';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Badge, Button, Card, EmptyState, Loaded, Tabs, useLoad } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import { AUDIT } from './audit.js';

const when = (iso) => { try { return new Date(iso).toLocaleString(getLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
const KIND = { chat: 'Discussion', meeting: 'Réunion', library: 'Bibliothèque' };
const RIGHTS = { read: 'Lecture', write: 'Écriture', validate: 'Validation' };

/* Espaces partagés : chat, réunions, bibliothèque, entre organisations liées ou avec un partenaire. Membres désignés par personne, droits, expiration, révocation, journal. */
export default function Spaces({ openId, setOpenId }) {
  const { oapi, modal, orgId } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/shared/spaces'), [orgId]);
  if (openId) return <SpaceView id={openId} back={() => { setOpenId(null); st.reload(); }} />;
  return (
    <Loaded state={st}>{(j) => (
      <Card title={t('Espaces partagés')} subtitle={t("Chaque espace réunit des personnes désignées des deux côtés. Rien d'autre de l'entreprise n'est visible.")}
        actions={j.canManage ? <Button variant="primary" icon="plus" onClick={() => modal(t('Nouvel espace partagé'), (close) => <NewSpace done={(id) => { close(); st.reload(); setOpenId(id); }} />, { wide: true })}>{t('Nouvel espace')}</Button> : null}>
        {j.spaces.length === 0 ? <EmptyState icon="comments" title={t('Aucun espace partagé')}>{t("Créez un espace de discussion, de réunion ou de bibliothèque avec un partenaire ou une organisation liée.")}</EmptyState> : (
          <ul className="ent-list">{j.spaces.map((s) => (
            <li className="ent-person" key={s.id}>
              <div className="ent-person-h"><div><b>{s.title}</b><div className="muted small">{tsrv(KIND[s.kind])} · {s.orgs.join(' ↔ ')} · {t('{n} membre(s)', { n: s.members })}{s.objects ? ' · ' + t('{n} objet(s) partagé(s)', { n: s.objects }) : ''}</div></div>
                {s.status === 'archived' ? <Badge>{t('Archivé · lecture seule')}</Badge> : <Badge tone="ok">{t('Actif')}</Badge>}{!s.member ? <Badge tone="warn">{t('Vous n\'en êtes pas membre')}</Badge> : null}</div>
              <div className="ent-actions"><Button size="sm" onClick={() => setOpenId(s.id)}>{s.member ? t('Ouvrir') : t('Gérer mes membres')}</Button></div>
            </li>
          ))}</ul>
        )}
      </Card>
    )}</Loaded>
  );
}

export function NewSpace({ partnerId, done }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const parts = useLoad(() => Promise.all([oapi('GET', '/partners'), oapi('GET', '/shared/people'), oapi('GET', '/shared/linked-orgs')]), []);
  const [v, setV] = useState({ kind: 'chat', title: '', target: partnerId ? 'p' + partnerId : '', days: '' });
  const [sel, setSel] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  return (
    <Loaded state={parts}>{([pj, people, linked]) => {
      const active = pj.partners.filter((p) => p.status === 'active');
      const targets = [...active.map((p) => ['p' + p.id, t('Partenaire : {name}', { name: p.partner.company })]), ...linked.orgs.map((o) => ['o' + o.id, t('Organisation liée : {name}', { name: o.name })])];
      const target = v.target || (targets[0] && targets[0][0]) || '';
      const submit = (e) => {
        e.preventDefault(); setErr('');
        if (!v.title.trim()) { setErr(t("Donnez un nom à l'espace.")); return; }
        if (!target) { setErr(t('Aucun partenaire actif ni organisation liée.')); return; }
        const members = Object.entries(sel).filter(([, r]) => r).map(([userId, rights]) => ({ userId: Number(userId), rights }));
        setBusy(true);
        oapi('POST', '/shared/spaces', { kind: v.kind, title: v.title.trim(), scope: target[0] === 'p' ? 'partner' : 'linked', partnershipId: target[0] === 'p' ? Number(target.slice(1)) : undefined, otherOrgId: target[0] === 'o' ? Number(target.slice(1)) : undefined, members: members.length ? members : undefined, expiresInDays: v.days ? Number(v.days) : undefined })
          .then((j) => done(j.id)).catch((x) => { setErr(tsrv(x.message)); if (x.status === 401) fail(x); }).finally(() => setBusy(false));
      };
      return (
        <form className="ws-form" noValidate onSubmit={submit}>
          <label className="fld"><span>{t('Type')}</span><select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}><option value="chat">{t('Discussion')}</option><option value="meeting">{t('Réunion (ordre du jour et procès-verbal)')}</option><option value="library">{t('Bibliothèque (dossiers et documents)')}</option></select></label>
          <label className="fld"><span>{t('Nom de l\'espace')}</span><input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
          {!partnerId ? <label className="fld"><span>{t('Avec')}</span><select value={target} onChange={(e) => setV({ ...v, target: e.target.value })}>{targets.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label> : null}
          <label className="fld"><span>{t("Durée de l'espace")}</span><select value={v.days} onChange={(e) => setV({ ...v, days: e.target.value })}><option value="">{t('Sans limite')}</option><option value="30">{t('30 jours')}</option><option value="90">{t('3 mois')}</option><option value="365">{t('1 an')}</option></select></label>
          <fieldset className="ent-access"><legend>{t('Vos membres dans cet espace')}</legend>
            <p className="muted small">{t("Désignez les personnes de VOTRE organisation qui y ont accès. L'autre côté désigne les siennes.")}</p>
            {people.people.map((p) => (
              <label className="ent-acc-row" key={p.userId}><span>{p.name}</span>
                <select value={sel[p.userId] || ''} onChange={(e) => setSel({ ...sel, [p.userId]: e.target.value })} aria-label={p.name}><option value="">{t('Pas dans cet espace')}</option><option value="read">{t('Lecture')}</option><option value="write">{t('Écriture')}</option><option value="validate">{t('Validation')}</option></select></label>
            ))}</fieldset>
          <p className="ws-err" role="alert">{err}</p>
          <div className="row"><Button variant="primary" type="submit" loading={busy}>{t("Créer l'espace")}</Button></div>
        </form>
      );
    }}</Loaded>
  );
}

function SpaceView({ id, back }) {
  const { oapi } = useWs();
  const t = useT();
  const [tab, setTab] = useState('talk');
  const st = useLoad(() => oapi('GET', '/shared/spaces/' + id), [id]);
  return (
    <Loaded state={st}>{(j) => {
      const s = j.space; const member = Boolean(j.me);
      const tabs = [];
      if (member) tabs.push({ id: 'talk', label: t('Discussion'), icon: 'comments' });
      if (member && s.kind !== 'chat') tabs.push({ id: 'objects', label: s.kind === 'meeting' ? t('Réunions partagées') : t('Documents partagés'), icon: s.kind === 'meeting' ? 'calendar-check' : 'library' });
      if (member && s.kind === 'library') tabs.push({ id: 'files', label: t('Dépôt de fichiers'), icon: 'upload' });
      tabs.push({ id: 'members', label: t('Membres'), icon: 'users' });
      if (member) tabs.push({ id: 'audit', label: t('Journal'), icon: 'history' });
      const cur = tabs.find((x) => x.id === tab) ? tab : tabs[0].id;
      return (
        <div className="ent-space">
          <div className="ws-head"><div><h1>{s.title}</h1><p className="muted">{tsrv(KIND[s.kind])} · {j.orgs.map((o) => o.name).join(' ↔ ')}</p></div><div className="row"><Button onClick={back}>{t('← Tous les espaces')}</Button></div></div>
          {s.status === 'archived' ? <div className="ent-banner" role="note"><p>{t('Espace archivé : lecture seule. {why}', { why: s.archiveReason ? '(' + tsrv(s.archiveReason) + ')' : '' })}</p></div> : null}
          <Tabs items={tabs} value={cur} onChange={setTab} label={s.title} />
          {cur === 'talk' ? <Talk id={id} canWrite={j.me && j.me.canWrite} /> : null}
          {cur === 'objects' ? <Objects id={id} kind={s.kind} info={j} reload={st.reload} /> : null}
          {cur === 'files' ? <Files id={id} canWrite={j.me && j.me.canWrite} /> : null}
          {cur === 'members' ? <Members id={id} info={j} reload={st.reload} /> : null}
          {cur === 'audit' ? <AuditList id={id} /> : null}
        </div>
      );
    }}</Loaded>
  );
}

function Talk({ id, canWrite }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const [msgs, setMsgs] = useState([]); const [text, setText] = useState(''); const end = useRef(null);
  const load = () => oapi('GET', `/shared/spaces/${id}/messages`).then((j) => setMsgs(j.messages)).catch(() => {});
  useEffect(() => { load(); const h = setInterval(load, 8000); return () => clearInterval(h); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (end.current) end.current.scrollIntoView({ block: 'end' }); }, [msgs.length]);
  return (
    <section className="ws-card ent-talk">
      <div className="ent-msgs" aria-live="polite">{msgs.length === 0 ? <p className="muted">{t('Aucun message.')}</p> : msgs.map((m) => (
        <div className={'ent-msg' + (m.mine ? ' mine' : '')} key={m.id}><small><b>{m.name}</b> · {m.org} · {when(m.at)}</small><p>{m.body}</p></div>
      ))}<span ref={end} /></div>
      {canWrite ? (
        <form className="ent-compose" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; oapi('POST', `/shared/spaces/${id}/messages`, { body: text.trim() }).then(() => { setText(''); load(); }).catch(fail); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Écrire un message…')} maxLength={2000} aria-label={t('Message')} />
          <Button variant="primary" type="submit" icon="send">{t('Envoyer')}</Button>
        </form>
      ) : <p className="muted small">{t("Vous êtes en lecture seule dans cet espace, ou il est archivé.")}</p>}
    </section>
  );
}

function Objects({ id, kind, info, reload }) {
  const { oapi, modal, fail, toast, confirm } = useWs();
  const t = useT();
  const mine = info.canManage; const active = info.space.status === 'active';
  const open = (o) => oapi('GET', `/shared/spaces/${id}/objects/${o.id}`).then((d) => modal(o.title, () => <ObjectView id={id} d={d} />, { wide: true })).catch(fail);
  return (
    <Card title={kind === 'meeting' ? t('Réunions partagées') : t('Documents et dossiers partagés')} actions={mine && active ? <Button icon="plus" onClick={() => modal(t('Partager un élément'), (close) => <ShareForm id={id} kind={kind} done={() => { close(); reload(); }} />, { wide: true })}>{t('Partager')}</Button> : null}>
      {(info.objects || []).length === 0 ? <p className="muted">{t("Rien n'est partagé pour l'instant.")}</p> : (
        <ul className="ent-list">{info.objects.map((o) => (
          <li className="ent-row" key={o.id}><div className="ent-row-b"><b>{o.title}</b> <small className="muted">· {o.org} · {tsrv(RIGHTS[o.rights])}{o.expiresAt ? ' · ' + t("jusqu'au {date}", { date: when(o.expiresAt) }) : ''}</small></div>
            {o.revoked ? <Badge>{t('Terminé')}</Badge> : <Button size="sm" onClick={() => open(o)}>{t('Ouvrir')}</Button>}
            {o.mine && !o.revoked && mine ? <><Button size="sm" variant="ghost" icon="refresh" label={t('Republier')} iconOnly onClick={() => oapi('POST', `/shared/spaces/${id}/objects/${o.id}/refresh`).then(() => { toast(t('Republié.')); reload(); }).catch(fail)} />
              <Button size="sm" variant="ghost" icon="trash" label={t('Retirer le partage')} iconOnly onClick={() => confirm(t("Retirer ce partage ? L'accès est coupé tout de suite."), () => oapi('DELETE', `/shared/spaces/${id}/objects/${o.id}`).then(() => { toast(t('Partage retiré.')); reload(); }).catch(fail), t('Retirer'))} /></> : null}
          </li>
        ))}</ul>
      )}
    </Card>
  );
}

function ObjectView({ id, d }) {
  const { oapi, toast, fail, orgId } = useWs();
  const t = useT();
  const s = d.snapshot;
  const dl = (docId, name) => fetch(`/api/ws/orgs/${orgId}/shared/spaces/${id}/objects/${d.id}/files/${docId}`, { credentials: 'include' }).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(t('Téléchargement refusé.'))))).then((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }).catch(fail);
  const [comment, setComment] = useState('');
  const validate = (decision) => oapi('POST', `/shared/spaces/${id}/objects/${d.id}/validate`, { decision, comment }).then(() => toast(t('Décision enregistrée.'))).catch(fail);
  return (
    <div className="ws-form">
      {d.type === 'meeting' ? (
        <>
          <p><b>{s.title}</b> · {s.date} {s.startTime || ''} {s.place ? '· ' + s.place : ''}</p>
          {s.objective ? <p className="muted">{s.objective}</p> : null}
          <h3>{t('Ordre du jour')}</h3>
          <ol>{(s.agenda || []).map((a, i) => <li key={i}>{a.title}{a.owner ? ' — ' + a.owner : ''}{a.durationMin ? ` (${a.durationMin} min)` : ''}</li>)}</ol>
          {s.minutes ? <><h3>{t('Procès-verbal validé')}</h3><pre className="ent-pre">{s.minutes.content}</pre></> : <p className="muted small">{t("Aucun procès-verbal partagé.")}</p>}
        </>
      ) : null}
      {d.type === 'library_document' ? <p><b>{s.name}</b> <Button size="sm" icon="download" onClick={() => dl(d.objectId, s.name)}>{t('Télécharger')}</Button></p> : null}
      {d.type === 'library_folder' ? <ul className="ent-list">{(d.docs || []).map((x) => <li className="ent-row" key={x.id}><div className="ent-row-b">{x.name} <small className="muted">({Math.round(x.size / 1024)} Ko)</small></div><Button size="sm" icon="download" onClick={() => dl(x.id, x.name)}>{t('Télécharger')}</Button></li>)}{(d.docs || []).length === 0 ? <li className="muted">{t('Dossier vide.')}</li> : null}</ul> : null}
      {d.rights === 'validate' ? (
        <fieldset className="ent-legal"><legend>{t('Validation')}</legend>
          <label className="fld"><span>{t('Commentaire')} <small>({t('facultatif')})</small></span><input value={comment} onChange={(e) => setComment(e.target.value)} /></label>
          <div className="row"><Button variant="primary" onClick={() => validate('approved')}>{t('Approuver')}</Button><Button onClick={() => validate('rejected')}>{t('Refuser')}</Button></div>
        </fieldset>
      ) : null}
      {(d.validations || []).length ? <ul className="ent-log">{d.validations.map((v, i) => <li key={i}><b>{v.decision === 'approved' ? t('Approuvé') : t('Refusé')}</b> <span className="muted">{v.name} · {v.org} · {when(v.at)}{v.comment ? ' · ' + v.comment : ''}</span></li>)}</ul> : null}
    </div>
  );
}

function ShareForm({ id, kind, done }) {
  const { oapi, fail } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', '/shared/shareable?kind=' + kind), [kind]);
  const [pick, setPick] = useState(''); const [rights, setRights] = useState('read'); const [days, setDays] = useState(''); const [minutes, setMinutes] = useState(false); const [busy, setBusy] = useState(false);
  return (
    <Loaded state={st}>{(j) => (
      <div className="ws-form">
        <label className="fld"><span>{t('Élément à partager')}</span><select value={pick} onChange={(e) => setPick(e.target.value)}><option value="">{t('Choisir…')}</option>{j.items.map((x) => <option key={x.type + x.id} value={x.type + ':' + x.id}>{x.title}{x.sub ? ' · ' + x.sub : ''}</option>)}</select></label>
        <label className="fld"><span>{t('Droit donné')}</span><select value={rights} onChange={(e) => setRights(e.target.value)}><option value="read">{t('Lecture seule')}</option>{kind === 'meeting' ? <option value="validate">{t('Lecture + validation')}</option> : null}</select></label>
        <label className="fld"><span>{t('Durée du partage')}</span><select value={days} onChange={(e) => setDays(e.target.value)}><option value="">{t('Sans limite (jusqu\'au retrait)')}</option><option value="7">{t('7 jours')}</option><option value="30">{t('30 jours')}</option><option value="90">{t('3 mois')}</option></select></label>
        {kind === 'meeting' ? <label className="sp-check"><input type="checkbox" checked={minutes} onChange={(e) => setMinutes(e.target.checked)} /> {t('Inclure le procès-verbal (seulement s\'il est validé)')}</label> : null}
        <p className="muted small">{t("C'est une copie au moment du partage : vos modifications ne sont visibles qu'après « Republier ». Le reste de votre organisation reste invisible.")}</p>
        <div className="row"><Button variant="primary" disabled={!pick} loading={busy} onClick={() => { const [type, oid] = pick.split(':'); setBusy(true); oapi('POST', `/shared/spaces/${id}/objects`, { type, id: Number(oid), rights, expiresInDays: days ? Number(days) : undefined, includeMinutes: minutes }).then(done).catch(fail).finally(() => setBusy(false)); }}>{t('Partager')}</Button></div>
      </div>
    )}</Loaded>
  );
}

function Files({ id, canWrite }) {
  const { oapi, fail, toast, orgId } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', `/shared/spaces/${id}/files`), [id]);
  const upload = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    fetch(`/api/ws/orgs/${orgId}/shared/spaces/${id}/files?name=${encodeURIComponent(f.name)}`, { method: 'POST', credentials: 'include', headers: { 'x-file-type': f.type || 'application/octet-stream' }, body: f })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || t('Dépôt refusé.')); toast(t('Fichier déposé.')); st.reload(); }).catch(fail);
    e.target.value = '';
  };
  const dl = (f) => fetch(`/api/ws/orgs/${orgId}/shared/spaces/${id}/files/${f.id}`, { credentials: 'include' }).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(t('Téléchargement refusé.'))))).then((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }).catch(fail);
  return (
    <Card title={t('Dépôt de fichiers')} actions={canWrite ? <label className="ui-btn primary"><input type="file" hidden onChange={upload} />{t('Déposer un fichier')}</label> : null}>
      <Loaded state={st}>{(j) => j.files.length === 0 ? <p className="muted">{t('Aucun fichier déposé.')}</p> : j.files.map((f) => (
        <div className="line" key={f.id}><span><b>{f.name}</b><small> · {f.who} · {f.org} · {when(f.at)} · {Math.max(1, Math.round(f.size / 1024))} Ko</small></span>
          <span className="ent-actions"><button className="link" type="button" onClick={() => dl(f)}>{t('Télécharger')}</button>
            <button className="link" type="button" onClick={() => oapi('DELETE', `/shared/spaces/${id}/files/${f.id}`).then(() => { st.reload(); }).catch(fail)}>{t('Retirer')}</button></span></div>
      ))}</Loaded>
    </Card>
  );
}

function Members({ id, info, reload }) {
  const { oapi, fail, toast, orgId } = useWs();
  const t = useT();
  const people = useLoad(() => (info.canManage ? oapi('GET', '/shared/people') : Promise.resolve({ people: [] })), [orgId]);
  const mine = info.members.filter((m) => m.mine);
  const [sel, setSel] = useState(() => Object.fromEntries(mine.map((m) => [m.userId, m.rights])));
  const active = info.space.status === 'active';
  const save = () => oapi('PUT', `/shared/spaces/${id}/members`, { members: Object.entries(sel).filter(([, r]) => r).map(([userId, rights]) => ({ userId: Number(userId), rights })) }).then(() => { toast(t('Membres enregistrés.')); reload(); }).catch(fail);
  return (
    <>
      <Card title={t('Membres de cet espace')} subtitle={t("Seules ces personnes accèdent à l'espace. Chaque organisation désigne les siennes.")}>
        {info.members.map((m) => <div className="line" key={m.userId}><span><b>{m.name}</b><small> · {m.org}</small></span><Badge tone={m.rights === 'validate' ? 'brand' : 'neutral'}>{tsrv(RIGHTS[m.rights])}</Badge></div>)}
      </Card>
      {info.canManage && active ? (
        <Card title={t('Désigner mes membres')}>
          <Loaded state={people}>{(j) => (
            <>
              {j.people.map((p) => (
                <label className="ent-acc-row" key={p.userId}><span>{p.name}</span>
                  <select value={sel[p.userId] || ''} onChange={(e) => setSel({ ...sel, [p.userId]: e.target.value })} aria-label={p.name}><option value="">{t('Pas dans cet espace')}</option><option value="read">{t('Lecture')}</option><option value="write">{t('Écriture')}</option><option value="validate">{t('Validation')}</option></select></label>
              ))}
              <div className="row"><Button variant="primary" onClick={save}>{t('Enregistrer mes membres')}</Button></div>
            </>
          )}</Loaded>
        </Card>
      ) : null}
    </>
  );
}

function AuditList({ id }) {
  const { oapi } = useWs();
  const t = useT();
  const st = useLoad(() => oapi('GET', `/shared/spaces/${id}/audit`), [id]);
  return <Card title={t("Journal d'audit")} subtitle={t("Visible des deux côtés. Jamais le contenu des échanges.")}><Loaded state={st}>{(j) => <ul className="ent-log">{j.log.map((l, i) => <li key={i}><b>{tsrv(AUDIT[l.action] || l.action)}</b> <span className="muted">{l.detail} · {l.name || ''} · {l.org || ''} · {when(l.at)}</span></li>)}</ul>}</Loaded></Card>;
}
