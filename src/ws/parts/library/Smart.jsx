import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Badge } from '../../ui.jsx';
import { RecordModal, STATUS_TONE, statusLabel, typeLabel } from './Catalog.jsx';

/* Recherche intelligente : tolère les fautes, comprend les synonymes du vocabulaire et les questions simples
   (« rapports en français depuis 2023 »), cherche aussi dans le texte des documents. Le serveur ne renvoie que ce que la personne a le droit de voir. */

/** ⟦mot⟧ → mot en gras. */
const Snip = ({ text }) => <small className="lib-snip">{String(text).split(/(⟦[^⟧]*⟧)/).map((p, i) => (p.startsWith('⟦') ? <mark key={i}>{p.slice(1, -1)}</mark> : p))}</small>;

export default function Smart({ L }) {
  const t = useT();
  const { modal } = useWs();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [sugg, setSugg] = useState([]);
  const [f, setF] = useState({});
  const run = (text, filters = f) => {
    const p = new URLSearchParams({ q: text }); for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    setErr('');
    return L.lib('GET', `/smart-search?${p.toString()}`).then(setRes, (e) => { setRes(null); setErr(tsrv(e.message)); });
  };
  const typing = (v) => { setQ(v); if (v.trim().length >= 2) L.lib('GET', `/smart-search/suggest?q=${encodeURIComponent(v)}`).then((j) => setSugg(j.suggestions), () => setSugg([])); else setSugg([]); };
  const open = (r) => modal(r.title, (close) => <RecordModal L={L} id={r.id} close={close} onChange={() => run(q)} />, { wide: true });
  const pick = (k) => (v) => { const n = { ...f, [k]: f[k] === v ? '' : v }; setF(n); run(q, n); };
  const NOTE = { type: (v) => `${t('Type')} : ${t(typeLabel(v))}`, language: (v) => `${t('Langue')} : ${v}`, year: (v) => `${t('Année')} : ${v}`, yearFrom: (v) => `${t('À partir de')} ${v}`, yearTo: (v) => `${t("Jusqu'à")} ${v}`, available: () => t('Disponibles'), status: (v) => `${t('Statut')} : ${t(statusLabel(v))}` };
  return (
    <>
      <div className="ws-head"><div><h1>{t('Recherche intelligente')}</h1><p className="muted">{t("Tapez des mots, même avec une faute, ou une question : « rapports en français depuis 2023 », « livres disponibles ». La recherche couvre aussi le texte des documents (texte, Word, PDF simples).")}</p></div></div>
      <form className="lib-bar" role="search" onSubmit={(e) => { e.preventDefault(); setF({}); if (q.trim()) run(q.trim(), {}); }}>
        <input type="search" list="lib-sugg" value={q} onChange={(e) => typing(e.target.value)} placeholder={t('Votre recherche…')} aria-label={t('Votre recherche…')} />
        <datalist id="lib-sugg">{sugg.map((s) => <option key={s.kind + s.text} value={s.text} />)}</datalist>
        <button className="btn primary small" type="submit">{t('Chercher')}</button>
      </form>
      <p className="ws-err" role="alert">{err}</p>
      {res ? (
        <>
          {res.interpreted.notes.length ? <p className="lib-tags"><span className="muted small">{t('Compris :')}</span>{res.interpreted.notes.map(([k, v]) => <span key={k} className="lib-tag">{(NOTE[k] || (() => k))(v)}</span>)}{res.interpreted.text ? <span className="lib-tag">« {res.interpreted.text} »</span> : null}</p> : null}
          {res.relaxed ? <p className="muted small">{t('Aucune ressource ne contient tous les mots : voici celles qui en contiennent certains.')}</p> : null}
          {res.didYouMean.length ? <p>{t('Vouliez-vous dire')} {res.didYouMean.map((d) => <button key={d} type="button" className="btn small" onClick={() => { setQ(d); run(d, {}); }}>{d}</button>)} ?</p> : null}
          <p className="muted small" role="status">{t('{n} résultat(s)', { n: res.total })}</p>
          <div className="lib-cat">
            <aside className="lib-facets" aria-label={t('Filtres')}>
              {[['type', t('Type'), res.facets.type, true], ['year', t('Année'), res.facets.year, false], ['language', t('Langue'), res.facets.language, false], ['status', t('Statut'), res.facets.status, true]].map(([k, title, items, tr]) => (items.length ? (
                <fieldset key={k} className="lib-facet"><legend>{title}</legend><ul>{items.slice(0, 8).map((it) => <li key={it.value}><button type="button" aria-pressed={String(f[k]) === String(it.value)} onClick={() => pick(k)(it.value)}><span>{tr ? t(it.label) : it.label}</span><small>{it.count}</small></button></li>)}</ul></fieldset>) : null))}
            </aside>
            <div className="lib-cat-main">
              {res.records.length ? <ul className="lib-docs">{res.records.map((r) => (
                <li key={r.id} className="lib-doc">
                  <span className="lib-kind">{t(typeLabel(r.type)).slice(0, 3).toUpperCase()}</span>
                  <div className="lib-doc-main"><button type="button" className="lib-doc-name" onClick={() => open(r)}>{r.title}</button>
                    <small className="muted">{[r.author, r.year, r.classCode, r.callNumber].filter(Boolean).join(' · ')}{r.inText ? ` · ${t('trouvé dans le texte')}` : ''}</small>
                    {r.snippet ? <Snip text={r.snippet} /> : null}</div>
                  <Badge tone={STATUS_TONE[r.status]}>{t(statusLabel(r.status))}</Badge>
                </li>))}</ul> : <p className="ws-empty">{t('Aucune ressource trouvée. Essayez d’autres mots ou retirez un filtre.')}</p>}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
