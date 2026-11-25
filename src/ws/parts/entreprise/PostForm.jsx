import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Button } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';
import { SPACE_ORDER, SPACE_TITLE } from './lib.js';

/* Fenêtre : créer ou modifier un poste (titre, type, nombre de places, accès aux espaces). Le serveur applique les droits ; ici on les reflète. */
export default function PostForm({ post, departmentId, directionId, done }) {
  const { oapi, can, fail, toast } = useWs();
  const t = useT();
  const [title, setTitle] = useState(post ? post.title : '');
  const [kind, setKind] = useState(post ? post.kind : 'staff');
  const [hc, setHc] = useState(post ? post.headcount : 1);
  const [spaces, setSpaces] = useState(() => ({ ...(post ? post.spaces : { projets: 'write' }) }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const owner = can('owner');
  const set = (sp, lv) => setSpaces((s) => { const n = { ...s }; if (lv) n[sp] = lv; else delete n[sp]; return n; });
  const save = (ev) => {
    ev.preventDefault();
    if (!title.trim()) { setErr(t('Indiquez le titre du poste.')); return; }
    setBusy(true); setErr('');
    const body = { title: title.trim(), kind, headcount: Number(hc) || 1, spaces };
    const p = post ? oapi('PUT', '/entreprise/posts/' + post.id, body) : oapi('POST', '/entreprise/posts', { ...body, departmentId, directionId });
    p.then(() => { toast(t('Poste enregistré.')); done(); }).catch((e) => { setErr(tsrv(e.message)); if (e.status === 401) fail(e); }).finally(() => setBusy(false));
  };
  return (
    <form className="ws-form" noValidate onSubmit={save}>
      <label className="fld"><span>{t('Titre du poste')}</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Comptable, chauffeur, magasinier…')} /></label>
      <div className="ent-two">
        <label className="fld"><span>{t('Type de poste')}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="director">{t('Directeur')}</option><option value="head">{t('Responsable')}</option><option value="staff">{t('Équipe')}</option>
          </select></label>
        <label className="fld"><span>{t('Nombre de places')}</span><input type="number" min="1" max="200" value={hc} onChange={(e) => setHc(e.target.value)} /></label>
      </div>
      <fieldset className="ent-access">
        <legend>{t('Ce que la personne affectée peut ouvrir')}</legend>
        <p className="muted small">{t("Visiteur : lecture seule. Membre : travaille avec ses droits habituels. Responsable : gère l'espace. Sans affectation, personne ne reçoit rien de plus.")}</p>
        {SPACE_ORDER.map((sp) => (
          <label className="ent-acc-row" key={sp}><span>{tsrv(SPACE_TITLE[sp])}</span>
            <select value={spaces[sp] || ''} onChange={(e) => set(sp, e.target.value)} aria-label={tsrv(SPACE_TITLE[sp])}>
              <option value="">{t('Aucun accès')}</option><option value="view">{t('Visiteur (lecture seule)')}</option><option value="write">{t("Membre de l'espace")}</option>
              <option value="manage" disabled={sp === 'compte' && !owner}>{t("Responsable de l'espace")}</option>
            </select></label>
        ))}
      </fieldset>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><Button variant="primary" type="submit" loading={busy}>{t('Enregistrer')}</Button></div>
    </form>
  );
}
