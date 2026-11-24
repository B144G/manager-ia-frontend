import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { saveBlob } from '../sales/util.jsx';
import { fileUrl } from './api.js';
import { Badge } from '../../ui.jsx';
import { bytes, when } from './util.jsx';
import { DiscussButton } from '../chat/ObjectUI.jsx';

/** Aperçu : une image est lue avec la session puis affichée ; un PDF s'ouvre dans un cadre de la même origine. Les autres types se téléchargent. */
function Preview({ L, d }) {
  const t = useT();
  const [src, setSrc] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    let url = ''; let off = false;
    setSrc(''); setErr('');
    if (d.mime.startsWith('image/')) {
      L.lib('GET', `/docs/${d.id}/preview`, undefined, { blob: true }).then((b) => { if (off) return; url = URL.createObjectURL(b); setSrc(url); }, (e) => { if (!off) setErr(tsrv(e.message)); });
    }
    return () => { off = true; if (url) URL.revokeObjectURL(url); };
  }, [d.id, d.version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <p className="ws-err" role="alert">{err}</p>;
  if (d.mime.startsWith('image/')) return src ? <div className="lib-prev"><img src={src} alt={t('Aperçu de « {name} »', { name: d.name })} /></div> : <p className="muted small">{t('Chargement…')}</p>;
  if (d.mime === 'application/pdf') return <div className="lib-prev"><iframe title={t('Aperçu de « {name} »', { name: d.name })} src={fileUrl(L.orgId, d.id, 'preview', d.version)} /></div>;
  return <p className="muted small lib-noprev">{t("Pas d'aperçu pour ce type de fichier : téléchargez-le pour l'ouvrir.")}</p>;
}

/** Une nouvelle version garde le nom du document ; seule l'extension suit le fichier choisi (ex. .doc → .docx). */
const keepName = (docName, fileName) => docName.replace(/\.[A-Za-z0-9]{1,8}$/, '').slice(0, 110) + ((/\.[A-Za-z0-9]{1,8}$/.exec(fileName) || [''])[0]);

const STATUS = { draft: 'Brouillon', published: 'Publié', obsolete: 'Obsolète' };

/** Comparaison de deux versions : empreintes, taille, auteur et, pour un fichier texte, les lignes modifiées. */
function Compare({ L, id, a, b }) {
  const t = useT();
  const st = useLoad(() => L.lib('GET', `/docs/${id}/compare?a=${a}&b=${b}`), [id, a, b]);
  return (
    <Loaded state={st}>{(j) => (
      <div>
        <table className="ui-table lib-cmp"><thead><tr><th scope="col" /><th scope="col">v{j.a.label}</th><th scope="col">v{j.b.label}</th></tr></thead><tbody>
          <tr><th scope="row">{t('Date')}</th><td>{when(j.a.createdAt)}</td><td>{when(j.b.createdAt)}</td></tr>
          <tr><th scope="row">{t('Auteur')}</th><td>{j.a.author || '—'}</td><td>{j.b.author || '—'}</td></tr>
          <tr><th scope="row">{t('Taille')}</th><td>{bytes(j.a.size, t)}</td><td>{bytes(j.b.size, t)}</td></tr>
          <tr><th scope="row">{t('Commentaire')}</th><td>{j.a.note || '—'}</td><td>{j.b.note || '—'}</td></tr>
          <tr><th scope="row">{t('Empreinte SHA-256')}</th><td className="mono lib-hash">{j.a.sha256.slice(0, 16)}…</td><td className="mono lib-hash">{j.b.sha256.slice(0, 16)}…</td></tr>
        </tbody></table>
        <p className={j.identical ? 'muted' : 'ws-err'}>{j.identical ? t('Contenu identique.') : t('Le contenu est différent.')}</p>
        {j.text && !j.text.tooLarge ? (
          <>
            <p className="muted small">{t('{a} ligne(s) ajoutée(s), {r} retirée(s).', { a: j.text.added, r: j.text.removed })}</p>
            <pre className="lib-diff">{j.text.lines.map((l, i) => <span key={i} className={'d' + (l.op === '+' ? ' add' : l.op === '-' ? ' del' : l.op === '~' ? ' skip' : '')}>{l.op === '~' ? t('… {n} ligne(s) inchangée(s) …', { n: l.text }) : `${l.op === '=' ? ' ' : l.op} ${l.text}`}{'\n'}</span>)}</pre>
          </>
        ) : j.text ? <p className="muted small">{t('Fichier trop long pour comparer ligne à ligne.')}</p> : <p className="muted small">{t('La comparaison ligne à ligne est disponible pour les fichiers texte.')}</p>}
      </div>
    )}
    </Loaded>
  );
}

export function DocModal({ L, id, close, onChange }) {
  const t = useT();
  const { toast, confirm } = useWs();
  const st = useLoad(() => L.lib('GET', `/docs/${id}`), [id]);
  const up = useRef(null);
  const [note, setNote] = useState('');
  const [bump, setBump] = useState('minor');
  const [busy, setBusy] = useState(false);
  const { modal } = useWs();
  const done = () => { st.reload(); onChange(); };
  const fail = (e) => toast(tsrv(e.message), true);

  const download = (d, v) => L.lib('GET', `/docs/${d.id}/download${v ? '?version=' + v.n : ''}`, undefined, { blob: true }).then((b) => saveBlob(b, v ? v.name : d.name), fail);
  const newVersion = async (f, d) => {
    if (!f) return;
    setBusy(true);
    try { await L.lib('POST', `/docs/${d.id}/versions?bump=${bump}&note=${encodeURIComponent(note.slice(0, 200))}&name=${encodeURIComponent(keepName(d.name, f.name))}`, f); setNote(''); toast(t('Nouvelle version ajoutée.')); done(); } catch (e) { fail(e); }
    setBusy(false);
  };
  const remove = (d) => confirm(t('Mettre « {name} » à la corbeille ? Vous pourrez le restaurer pendant 30 jours.', { name: d.name }), () => L.lib('DELETE', `/docs/${d.id}`).then(() => { close(); onChange(); toast(t('Document mis à la corbeille.')); }, fail), t('Mettre à la corbeille'));
  const fav = (d) => L.lib('POST', `/docs/${d.id}/favorite`, { on: !d.favorite }).then(done, fail);
  const compare = (d, v, cur) => modal(t('Comparer {a} et {b}', { a: v.label, b: cur.label }), () => <Compare L={L} id={d.id} a={v.n} b={cur.n} />, { wide: true });
  const setStatus = (d, status) => L.lib('PUT', `/docs/${d.id}/status`, { status }).then(() => { toast(t('Statut modifié.')); done(); }, fail);
  const lock = (d, on) => L.lib('POST', `/docs/${d.id}/${on ? 'lock' : 'unlock'}`, {}).then(() => { toast(on ? t('Document verrouillé : vous seul pouvez déposer une version.') : t('Document déverrouillé.')); done(); }, fail);
  const restoreV = (d, v) => confirm(t('Rétablir la version {n} ? Elle deviendra la version actuelle (une nouvelle version est créée).', { n: v.label }), () => L.lib('POST', `/docs/${d.id}/versions/${v.n}/restore`, {}).then(() => { toast(t('Version rétablie.')); done(); }, fail), t('Rétablir'));
  const delV = (d, v) => confirm(t('Supprimer la version {n} définitivement ?', { n: v.label }), () => L.lib('DELETE', `/docs/${d.id}/versions/${v.n}`).then(done, fail), t('Supprimer'));

  return (
    <Loaded state={st}>{(j) => {
      const d = j.doc; const p = j.perms;
      return (
        <div className="lib-docmodal">
          <Preview L={L} d={d} />
          <dl className="lib-meta">
            <div><dt>{t('Auteur')}</dt><dd>{d.author || '—'}</dd></div>
            <div><dt>{t('Ajouté le')}</dt><dd>{when(d.createdAt)}</dd></div>
            <div><dt>{t('Modifié le')}</dt><dd>{when(d.updatedAt)}{d.editor ? ` · ${d.editor}` : ''}</dd></div>
            <div><dt>{t('Taille')}</dt><dd>{bytes(d.size, t)}</dd></div>
            <div><dt>{t('Type')}</dt><dd className="mono">{d.mime}</dd></div>
            <div><dt>{t('Version')}</dt><dd>{(j.versions.find((x) => x.current) || {}).label || d.version}</dd></div>
            <div><dt>{t('Statut')}</dt><dd><Badge tone={j.status === 'published' ? 'ok' : j.status === 'draft' ? 'warn' : 'neutral'}>{t(STATUS[j.status] || j.status)}</Badge>{j.lock ? <> <Badge tone="danger">{j.lock.mine ? t('Verrouillé par vous') : t('Verrouillé par {name}', { name: j.lock.by })}</Badge></> : null}</dd></div>
            {d.linkType ? <div><dt>{t('Lié à')}</dt><dd>{d.linkType === 'project' ? t('Projet') : t('Contrat')} n° {d.linkId}</dd></div> : null}
          </dl>
          <div className="row lib-actions">
            <button className="btn primary small" type="button" onClick={() => download(d)}>{t('Télécharger')}</button>
            <DiscussButton type="library_doc" id={d.id} variant="secondary" />
            <button className="btn small" type="button" aria-pressed={d.favorite} onClick={() => fav(d)}>{d.favorite ? t('★ Retirer des favoris') : t('☆ Ajouter aux favoris')}</button>
            {p.delete ? <button className="btn small" type="button" onClick={() => remove(d)}>{t('Mettre à la corbeille')}</button> : null}
            {p.edit ? <button className="btn small" type="button" onClick={() => lock(d, !j.lock)}>{j.lock ? t('Déverrouiller') : t('Verrouiller pour modification')}</button> : null}
            {p.edit ? <label className="lib-statussel"><span className="sr-only">{t('Statut')}</span><select value={j.status} onChange={(e) => setStatus(d, e.target.value)} aria-label={t('Statut')}><option value="draft">{t('Brouillon')}</option><option value="published">{t('Publié')}</option><option value="obsolete">{t('Obsolète')}</option></select></label> : null}
          </div>

          {p.edit ? (
            <Form key={d.updatedAt} className="ws-form lib-edit" submitText={t('Enregistrer')}
              fields={[{ k: 'name', label: t('Nom'), required: true, value: d.name }, { k: 'tags', label: t('Étiquettes (séparées par des virgules)'), value: d.tags.join(', '), placeholder: t('facture, 2026') }]}
              onSubmit={(v) => L.lib('PUT', `/docs/${d.id}`, { name: v.name, tags: v.tags }).then(() => { toast(t('Enregistré.')); done(); })} />
          ) : (d.tags.length ? <p className="lib-tags">{d.tags.map((x) => <span key={x} className="lib-tag">{x}</span>)}</p> : null)}

          <h3>{t('Versions')}</h3>
          <ul className="lib-versions">
            {j.versions.map((v) => (
              <li key={v.n}>
                <span><b>v{v.label}</b>{v.n === d.version ? <em> {t('(actuelle)')}</em> : null}{v.bump === 'major' ? <small className="muted"> {t('majeure')}</small> : null} · {when(v.createdAt)} · {v.author || '—'} · {bytes(v.size, t)}{v.note ? <small className="muted"> — {v.note}</small> : null}</span>
                <span className="row">
                  <button className="btn small" type="button" onClick={() => download(d, v)}>{t('Télécharger')}</button>
                  {v.n !== d.version ? <button className="btn small" type="button" onClick={() => compare(d, v, j.versions.find((x) => x.current))}>{t('Comparer')}</button> : null}
                  {p.edit && v.n !== d.version ? <button className="btn small" type="button" onClick={() => restoreV(d, v)}>{t('Rétablir')}</button> : null}
                  {p.delete && v.n !== d.version ? <button className="btn small" type="button" onClick={() => delV(d, v)}>{t('Supprimer')}</button> : null}
                </span>
              </li>
            ))}
          </ul>
          {p.edit ? (
            <div className="lib-newv">
              <label className="fld" htmlFor="lib_note"><span>{t('Nouvelle version')}</span><input id="lib_note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t('Commentaire de version (ce qui a changé)')} /></label>
              <label className="fld" htmlFor="lib_bump"><span>{t('Numérotation')}</span><select id="lib_bump" value={bump} onChange={(e) => setBump(e.target.value)}><option value="minor">{t('Mineure (1.0 → 1.1)')}</option><option value="major">{t('Majeure (1.1 → 2.0)')}</option></select></label>
              <button className="btn small" type="button" disabled={busy} onClick={() => up.current && up.current.click()}>{busy ? t('Envoi…') : t('Choisir le fichier')}</button>
              <input ref={up} type="file" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; newVersion(f, d); }} />
            </div>
          ) : null}
        </div>
      );
    }}
    </Loaded>
  );
}
