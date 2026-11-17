import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { bytes, when } from './util.jsx';

const KEYS = ['view', 'read', 'add', 'edit', 'delete'];

/** Droits d'un bloc : par rôle, puis des exceptions pour une personne (l'exception remplace les droits de son rôle). */
export function PermsEditor({ L, block, close }) {
  const t = useT();
  const { toast, can } = useWs();
  const st = useLoad(() => L.lib('GET', `/blocks/${block.id}/perms`), [block.id]);
  const [roles, setRoles] = useState(null);
  const [users, setUsers] = useState(null);
  const [add, setAdd] = useState('');
  const [err, setErr] = useState('');
  const label = { view: t('Voir'), read: t('Lire'), add: t('Ajouter'), edit: t('Modifier'), delete: t('Supprimer') };
  const roleLabel = { member: t('Membres'), manager: t('Responsables'), admin: t('Administrateurs') };
  return (
    <Loaded state={st}>{(j) => {
      const R = roles || j.roles; const U = users || j.users;
      const setRole = (r, k, v) => setRoles({ ...R, [r]: { ...R[r], [k]: v } });
      const setUser = (id, k, v) => setUsers(U.map((u) => (u.userId === id ? { ...u, [k]: v } : u)));
      const nameOf = (id) => { const m = j.members.find((x) => x.userId === id); return m ? `${m.name} (${t(m.roleLabel)})` : String(id); };
      const boxes = (cur, on, who) => (
        <div className="lib-perm-boxes">{KEYS.map((k) => (
          <label key={k} className="lib-check"><input type="checkbox" checked={!!cur[k]} disabled={k === 'view' && (cur.read || cur.add || cur.edit || cur.delete)} onChange={(e) => on(k, e.target.checked)} aria-label={`${who} : ${label[k]}`} /><span>{label[k]}</span></label>
        ))}</div>
      );
      const save = () => L.lib('PUT', `/blocks/${block.id}/perms`, { roles: can('owner') ? R : { member: R.member, manager: R.manager }, users: can('owner') ? U : U.filter((u) => { const m = j.members.find((x) => x.userId === u.userId); return m && m.role !== 'admin'; }) }).then(() => { toast(t('Droits enregistrés.')); close(); L.reload(); }, (e) => setErr(tsrv(e.message)));
      if (j.personal) return <p>{t('Les dossiers personnels sont privés : chacun ne voit que ses propres documents. Il n’y a pas de droits à régler.')}</p>;
      const free = j.members.filter((m) => m.role !== 'owner' && !U.some((u) => u.userId === m.userId));
      return (
        <div className="lib-perms">
          <p className="muted small">{t("Un membre doit toujours saisir son mot de passe pour entrer dans un bloc, même s'il a le droit de le voir. Le propriétaire a toujours tous les droits.")}</p>
          {['member', 'manager', 'admin'].map((r) => (
            <fieldset key={r} className="lib-perm" disabled={r === 'admin' && !can('owner')}>
              <legend>{roleLabel[r]}</legend>
              {boxes(R[r], (k, v) => setRole(r, k, v), roleLabel[r])}
              {r === 'admin' && !can('owner') ? <small className="muted">{t('Seul le propriétaire règle les droits des administrateurs.')}</small> : null}
            </fieldset>
          ))}
          <h3>{t('Exceptions pour une personne')}</h3>
          <p className="muted small">{t("Une exception remplace les droits du rôle pour cette personne : elle peut donner plus, ou retirer tout accès (tout décoché).")}</p>
          {U.map((u) => (
            <fieldset key={u.userId} className="lib-perm">
              <legend>{nameOf(u.userId)}</legend>
              {boxes(u, (k, v) => setUser(u.userId, k, v), nameOf(u.userId))}
              <button type="button" className="btn small" onClick={() => setUsers(U.filter((x) => x.userId !== u.userId))}>{t("Retirer l'exception")}</button>
            </fieldset>
          ))}
          {free.length ? (
            <div className="row">
              <select value={add} onChange={(e) => setAdd(e.target.value)} aria-label={t('Ajouter une exception')}>
                <option value="">{t('Ajouter une exception…')}</option>{free.map((m) => <option key={m.userId} value={m.userId}>{m.name} ({t(m.roleLabel)})</option>)}
              </select>
              <button type="button" className="btn small" disabled={!add} onClick={() => { setUsers([...U, { userId: Number(add), view: true, read: true, add: false, edit: false, delete: false }]); setAdd(''); }}>{t('Ajouter')}</button>
            </div>
          ) : null}
          <p className="ws-err" role="alert">{err}</p>
          <div className="row"><button type="button" className="btn primary" onClick={save}>{t('Enregistrer les droits')}</button><button type="button" className="btn" onClick={close}>{t('Annuler')}</button></div>
        </div>
      );
    }}
    </Loaded>
  );
}

export function Audit({ L }) {
  const t = useT();
  const [action, setAction] = useState('');
  const [blockId, setBlockId] = useState('');
  const [extra, setExtra] = useState([]);
  const [next, setNext] = useState(undefined);
  const blocks = useLoad(() => L.lib('GET', '/overview'), []);
  const st = useLoad(() => {
    const p = new URLSearchParams({ limit: '100' });
    if (action) p.set('action', action);
    if (blockId) p.set('blockId', blockId);
    return L.lib('GET', `/audit?${p.toString()}`).then((j) => { setExtra([]); setNext(j.next); return j; });
  }, [action, blockId, L.tick]);
  const more = (j) => {
    const p = new URLSearchParams({ limit: '100', before: String(next) });
    if (action) p.set('action', action);
    if (blockId) p.set('blockId', blockId);
    L.lib('GET', `/audit?${p.toString()}`).then((r) => { setExtra((x) => [...x, ...r.entries]); setNext(r.next); });
  };
  return (
    <>
      <div className="ws-head"><div><h1>{t("Journal d'audit")}</h1><p className="muted">{t("Chaque entrée dans un bloc, chaque mot de passe raté, chaque téléchargement, ajout, suppression et changement de droits. Les mots de passe ne sont jamais enregistrés.")}</p></div></div>
      <Loaded state={st}>{(j) => (
        <>
          <div className="lib-bar">
            <select value={action} onChange={(e) => setAction(e.target.value)} aria-label={t('Action')}>
              <option value="">{t('Toutes les actions')}</option>{j.actions.map((a) => <option key={a.id} value={a.id}>{t(a.label)}</option>)}
            </select>
            <select value={blockId} onChange={(e) => setBlockId(e.target.value)} aria-label={t('Bloc')}>
              <option value="">{t('Tous les blocs')}</option>{(blocks.data ? blocks.data.blocks : []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {[...j.entries, ...extra].length ? (
            <ul className="lib-audit">
              {[...j.entries, ...extra].map((e) => (
                <li key={e.id} className={/fail|locked|denied/.test(e.action) ? 'bad' : ''}>
                  <b>{t(e.label)}</b>
                  <span>{e.user || t('Système')}{e.block ? ` · ${e.block}` : ''}{e.detail ? ` · ${e.detail}` : ''}</span>
                  <small className="muted">{when(e.at)}{e.ip ? ` · ${e.ip}` : ''}</small>
                </li>
              ))}
            </ul>
          ) : <p className="ws-empty">{t('Aucune entrée.')}</p>}
          {next ? <button type="button" className="btn small" onClick={() => more(j)}>{t('Voir plus')}</button> : null}
        </>
      )}
      </Loaded>
    </>
  );
}

export function Settings({ L }) {
  const t = useT();
  const { toast } = useWs();
  const st = useLoad(() => L.lib('GET', '/settings'), [L.tick]);
  return (
    <>
      <div className="ws-head"><div><h1>{t('Sécurité et espace')}</h1><p className="muted">{t("Réglez combien de temps un bloc reste ouvert après la saisie du mot de passe.")}</p></div></div>
      <Loaded state={st}>{(j) => {
        const pct = j.storage.quota ? Math.min(100, Math.round((j.storage.used / j.storage.quota) * 100)) : 0;
        return (
          <div className="ws-cols">
            <div className="ws-card">
              <h2>{t('Ouverture des blocs')}</h2>
              <Form submitText={t('Enregistrer')}
                fields={[
                  { k: 'grantMinutes', label: t("Durée d'ouverture (minutes)"), type: 'number', value: j.settings.grantMinutes, hint: t('Entre 5 et 60. Chaque action la renouvelle. Au bout, il faut ressaisir le mot de passe.') },
                  { k: 'grantMaxMinutes', label: t('Durée maximale (minutes)'), type: 'number', value: j.settings.grantMaxMinutes, hint: t("Entre 15 et 480. Après ce délai, le bloc se referme même si la personne travaille encore.") },
                  { k: 'maxFileMb', label: t("Taille maximale d'un fichier (Mo)"), type: 'number', value: j.settings.maxFileMb, hint: t("0 = la limite de l'offre. Jamais plus de 20 Mo.") },
                ]}
                onSubmit={(v) => L.lib('PUT', '/settings', { grantMinutes: Number(v.grantMinutes), grantMaxMinutes: Number(v.grantMaxMinutes), maxFileMb: Number(v.maxFileMb) }).then(() => { toast(t('Enregistré.')); L.reload(); })} />
            </div>
            <div className="ws-card">
              <h2>{t('Espace utilisé')}</h2>
              <p>{t('{used} sur {total} (offre {plan})', { used: bytes(j.storage.used, t), total: bytes(j.storage.quota, t), plan: j.storage.plan })}</p>
              <div className={'meter' + (pct >= 90 ? ' over' : '')} role="img" aria-label={t('Espace utilisé : {pct} %', { pct })}><i style={{ width: pct + '%' }} /></div>
              <p className="muted small">{t("Les versions successives d'un document et la corbeille comptent dans l'espace utilisé. Un fichier ne dépasse pas {max}.", { max: bytes(j.storage.maxFile, t) })}</p>
            </div>
          </div>
        );
      }}
      </Loaded>
    </>
  );
}
