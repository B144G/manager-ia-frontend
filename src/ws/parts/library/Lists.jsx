import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Loaded, useLoad } from '../../ui.jsx';
import { DocRow } from './Block.jsx';
import { DocModal } from './Doc.jsx';
import { bytes, headColor } from './util.jsx';

function useOpen(L, reload) {
  const { modal, toast } = useWs();
  return {
    open: (d) => modal(d.name, (close) => <DocModal L={L} id={d.id} close={close} onChange={reload} />, { wide: true }),
    fav: (d) => L.lib('POST', `/docs/${d.id}/favorite`, { on: !d.favorite }).then(reload, (e) => toast(tsrv(e.message), true)),
  };
}

/** Favoris et récents : seulement les documents des blocs actuellement ouverts. */
export function DocList({ L, kind, title, empty }) {
  const t = useT();
  const st = useLoad(() => L.lib('GET', `/${kind}`), [kind, L.tick]);
  const a = useOpen(L, st.reload);
  return (
    <>
      <div className="ws-head"><div><h1>{title}</h1><p className="muted">{t("Seuls les documents des blocs que vous avez ouverts apparaissent ici. Les autres restent cachés tant que vous n'avez pas saisi votre mot de passe.")}</p></div></div>
      <Loaded state={st}>{(j) => (j.docs.length ? <ul className="lib-docs">{j.docs.map((d) => <DocRow key={d.id} L={L} d={d} onOpen={a.open} onFav={a.fav} showBlock />)}</ul> : <p className="ws-empty">{empty}</p>)}</Loaded>
    </>
  );
}

export function Search({ L }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const run = (reset) => {
    const p = new URLSearchParams();
    if (!reset && q.trim()) p.set('q', q.trim());
    if (!reset && tag.trim()) p.set('tag', tag.trim());
    if (!p.toString()) { setErr(t('Indiquez un nom ou une étiquette.')); setRes(null); return Promise.resolve(); }
    setErr('');
    return L.lib('GET', `/search?${p.toString()}`).then((j) => setRes(j.docs), (e) => setErr(tsrv(e.message)));
  };
  const a = useOpen(L, () => run(false));
  return (
    <>
      <div className="ws-head"><div><h1>{t('Recherche')}</h1><p className="muted">{t("La recherche porte seulement sur les blocs que vous avez ouverts avec votre mot de passe.")}</p></div></div>
      <form className="lib-bar" role="search" onSubmit={(e) => { e.preventDefault(); run(false); }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Nom du document…')} aria-label={t('Nom du document…')} />
        <input type="search" value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t('Étiquette')} aria-label={t('Étiquette')} />
        <button className="btn primary small" type="submit">{t('Chercher')}</button>
      </form>
      <p className="ws-err" role="alert">{err}</p>
      {res ? (res.length ? <ul className="lib-docs">{res.map((d) => <DocRow key={d.id} L={L} d={d} onOpen={a.open} onFav={a.fav} showBlock />)}</ul> : <p className="ws-empty">{t('Aucun document trouvé dans vos blocs ouverts.')}</p>) : null}
    </>
  );
}

export function Trash({ L }) {
  const t = useT();
  const { toast, confirm } = useWs();
  const st = useLoad(() => L.lib('GET', '/trash'), [L.tick]);
  const fail = (e) => toast(tsrv(e.message), true);
  const restore = (d) => L.lib('POST', `/docs/${d.id}/restore`, {}).then(() => { toast(t('Document restauré.')); st.reload(); }, fail);
  const purge = (d) => confirm(t('Supprimer « {name} » pour toujours ? Cette action est définitive.', { name: d.name }), () => L.lib('DELETE', `/docs/${d.id}/purge`).then(st.reload, fail), t('Supprimer pour toujours'));
  return (
    <>
      <div className="ws-head"><div><h1>{t('Corbeille')}</h1><p className="muted">{t("Les documents supprimés restent 30 jours ici, puis sont effacés définitivement. Seuls les blocs ouverts sont affichés.")}</p></div></div>
      <Loaded state={st}>{(j) => (j.docs.length ? (
        <ul className="lib-docs">
          {j.docs.map((d) => (
            <li className="lib-doc" key={d.id}>
              <div className="lib-doc-main">
                <b className="lib-doc-name static">{d.name}</b>
                <small className="muted"><span className="lib-dot" style={{ background: headColor(d.block.color) }} aria-hidden="true" />{d.block.name} · {bytes(d.size, t)} · {t('encore {n} jour(s)', { n: d.daysLeft })}</small>
              </div>
              <span className="row"><button className="btn small" type="button" onClick={() => restore(d)}>{t('Restaurer')}</button><button className="btn small" type="button" onClick={() => purge(d)}>{t('Supprimer pour toujours')}</button></span>
            </li>
          ))}
        </ul>
      ) : <p className="ws-empty">{t('La corbeille est vide (pour les blocs ouverts).')}</p>)}</Loaded>
    </>
  );
}
