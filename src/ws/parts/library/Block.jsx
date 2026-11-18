import { useRef, useState } from 'react';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { BlockIcon, bytes, day, headColor, hm, kindOf } from './util.jsx';
import { DocModal } from './Doc.jsx';
import { PermsEditor } from './Admin.jsx';

export function DocRow({ L, d, onOpen, onFav, showBlock }) {
  const t = useT();
  return (
    <li className="lib-doc">
      <span className="lib-kind" aria-hidden="true">{kindOf(d.mime)}</span>
      <div className="lib-doc-main">
        <button type="button" className="lib-doc-name" onClick={() => onOpen(d)}>{d.name}</button>
        <small className="muted">
          {showBlock && d.block ? <span className="lib-dot" style={{ background: headColor(d.block.color) }} aria-hidden="true" /> : null}
          {showBlock && d.block ? d.block.name + ' · ' : ''}{d.author ? d.author + ' · ' : ''}{day(d.updatedAt)} · {bytes(d.size, t)}{d.version > 1 ? ` · v${d.version}` : ''}
        </small>
        {d.tags.length ? <span className="lib-tags">{d.tags.map((x) => <span key={x} className="lib-tag">{x}</span>)}</span> : null}
      </div>
      <button type="button" className={'lib-fav' + (d.favorite ? ' on' : '')} aria-pressed={d.favorite} aria-label={d.favorite ? t('Retirer des favoris : {name}', { name: d.name }) : t('Ajouter aux favoris : {name}', { name: d.name })} onClick={() => onFav(d)}>{d.favorite ? '★' : '☆'}</button>
    </li>
  );
}

export default function BlockView({ L, block }) {
  const t = useT();
  const { modal, toast, confirm, can } = useWs();
  const [folder, setFolder] = useState(null);
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('name');
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState(false);
  const file = useRef(null);
  const st = useLoad(() => {
    const p = new URLSearchParams();
    if (folder) p.set('folderId', folder);
    if (applied) p.set('q', applied);
    if (tag) p.set('tag', tag);
    p.set('sort', sort);
    return L.lib('GET', `/blocks/${block.id}?${p.toString()}`);
  }, [block.id, folder, applied, tag, sort, L.tick]);

  async function upload(files) {
    const list = Array.from(files || []);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setMsg(t('Envoi de « {name} » ({i}/{n})…', { name: f.name, i: i + 1, n: list.length }));
      try {
        await L.lib('POST', `/blocks/${block.id}/docs?name=${encodeURIComponent(f.name.slice(0, 120))}${folder ? '&folderId=' + folder : ''}`, f);
      } catch (e) { setMsg(f.name + ' : ' + tsrv(e.message)); st.reload(); return; }
    }
    setMsg(t('Terminé.')); st.reload();
  }
  const newFolder = () => modal(t('Nouveau dossier'), (close) => (
    <Form fields={[{ k: 'name', label: t('Nom du dossier'), required: true }]} submitText={t('Créer')}
      onSubmit={(v) => L.lib('POST', `/blocks/${block.id}/folders`, { name: v.name.trim(), parentId: folder }).then(() => { close(); st.reload(); })} />
  ));
  const lock = () => L.lib('POST', `/blocks/${block.id}/lock`, {}).then(() => { L.closeBlock(); toast(t('Bloc refermé.')); }, () => {});
  const openDoc = (d) => modal(d.name, (close) => <DocModal L={L} id={d.id} close={close} onChange={st.reload} />, { wide: true });
  const fav = (d) => L.lib('POST', `/docs/${d.id}/favorite`, { on: !d.favorite }).then(() => st.reload(), (e) => toast(tsrv(e.message), true));
  const delFolder = (f) => confirm(t('Supprimer le dossier « {name} » ? Il doit être vide.', { name: f.name }), () => L.lib('DELETE', `/folders/${f.id}`).then(() => st.reload(), (e) => toast(tsrv(e.message), true)), t('Supprimer'));
  const stats = () => L.lib('GET', `/blocks/${block.id}/stats`).then((s) => modal(t('Statistiques du bloc'), () => (
    <div>
      <div className="kpis"><div className="stat lib-stat"><b>{s.documents}</b><span>{t('Documents')}</span></div><div className="stat lib-stat"><b>{s.folders}</b><span>{t('Dossiers')}</span></div><div className="stat lib-stat"><b>{bytes(s.volume, t)}</b><span>{t('Volume')}</span></div><div className="stat lib-stat"><b>{s.trash}</b><span>{t('À la corbeille')}</span></div></div>
      {s.byType.length ? <><h3>{t('Par type')}</h3>{s.byType.map((x) => <div className="line" key={x.type}><span>{t(x.type)}</span><b>{x.count}</b></div>)}</> : null}
      {s.byAuthor.length ? <><h3>{t('Par auteur')}</h3>{s.byAuthor.map((x) => <div className="line" key={x.author}><span>{x.author}</span><b>{x.count}</b></div>)}</> : null}
      {s.lastActivity ? <p className="muted small">{t('Dernière activité : {d}', { d: day(s.lastActivity) })}</p> : null}
    </div>
  ), { wide: true }), (e) => toast(tsrv(e.message), true));

  return (
    <Loaded state={st}>{(j) => {
      const b = j.block;
      const upper = (b.builtin ? t(b.name) : b.name).toLocaleUpperCase(getLocale());
      return (
        <div onDragOver={(e) => { if (j.perms.add) { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (j.perms.add) upload(e.dataTransfer.files); }}>
          <div className="lib-bhead" style={{ '--lib-c': headColor(b.color) }}>
            <span className="lib-badge"><BlockIcon name={b.icon} /></span>
            <div className="grow"><h1>{upper}</h1><p>{b.personal ? t('Vos documents privés : personne d’autre ne peut les voir.') : t('Ouvert jusqu’à {h} (renouvelé quand vous travaillez).', { h: hm(j.expiresAt) })}</p></div>
            <div className="row">
              <button type="button" className="btn small" onClick={stats}>{t('Statistiques')}</button>
              {can('admin') && !b.personal ? <button type="button" className="btn small" onClick={() => modal(t('Droits du bloc « {name} »', { name: b.name }), (c) => <PermsEditor L={L} block={b} close={c} />, { wide: true })}>{t("Droits d'accès")}</button> : null}
              <button type="button" className="btn small" onClick={lock}>{t('Refermer le bloc')}</button>
            </div>
          </div>

          <nav className="lib-crumbs" aria-label={t("Fil d'Ariane")}>
            <button type="button" className="link" onClick={() => setFolder(null)}>{t('Tous les documents')}</button>
            {j.breadcrumbs.map((c) => <span key={c.id}> › <button type="button" className="link" onClick={() => setFolder(c.id)}>{c.name}</button></span>)}
          </nav>

          <div className="lib-bar">
            <form className="lib-search" role="search" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); }}>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Chercher dans ce bloc…')} aria-label={t('Chercher dans ce bloc…')} />
              <button className="btn small" type="submit">{t('Chercher')}</button>
              {applied || tag ? <button className="btn small" type="button" onClick={() => { setQ(''); setApplied(''); setTag(''); }}>{t('Effacer')}</button> : null}
            </form>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('Trier par')}>
              <option value="name">{t('Nom')}</option><option value="date">{t('Date')}</option><option value="size">{t('Taille')}</option>
            </select>
            {j.tags.length ? (
              <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label={t('Étiquette')}>
                <option value="">{t('Toutes les étiquettes')}</option>{j.tags.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            ) : null}
            {j.perms.add ? (
              <>
                <button className="btn small primary" type="button" onClick={() => file.current && file.current.click()}>{t('Ajouter des documents')}</button>
                <input ref={file} type="file" multiple hidden onChange={(e) => { const f = e.target.files; upload(f); e.target.value = ''; }} />
                <button className="btn small" type="button" onClick={newFolder}>{t('Nouveau dossier')}</button>
              </>
            ) : null}
          </div>
          <p className="muted small lib-msg" role="status" aria-live="polite">{msg}</p>

          {j.folders.length ? (
            <ul className="lib-folders">
              {j.folders.map((f) => (
                <li key={f.id}>
                  <button type="button" className="lib-folder" onClick={() => setFolder(f.id)}><BlockIcon name="folder" size={22} /><span>{f.name}<small>{t('{n} document(s)', { n: f.docs })}{f.subfolders ? ' · ' + t('{n} dossier(s)', { n: f.subfolders }) : ''}</small></span></button>
                  {j.perms.delete ? <button type="button" className="lib-x" aria-label={t('Supprimer le dossier « {name} »', { name: f.name })} onClick={() => delFolder(f)}>×</button> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {j.docs.length ? <ul className={'lib-docs' + (drag ? ' drag' : '')}>{j.docs.map((d) => <DocRow key={d.id} L={L} d={d} onOpen={openDoc} onFav={fav} />)}</ul>
            : <p className={'ws-empty lib-empty' + (drag ? ' drag' : '')}>{applied || tag ? t('Aucun document ne correspond.') : j.perms.add ? t('Ce dossier est vide. Ajoutez des documents, ou déposez-les ici.') : t('Ce dossier est vide.')}</p>}
        </div>
      );
    }}
    </Loaded>
  );
}
